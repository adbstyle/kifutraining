import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ALTERSSTUFEN, istAltersstufe } from "@/lib/altersstufe";
import { userSlug } from "@/lib/slug";
import { VORLAGE_SELECT, kopieName, legeUebungsKopieAn } from "@/lib/fassung";
import { sichtbarkeitVon, type Sichtbarkeit } from "@/lib/wert";
import { abgebildet, ausDbFehler, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";
import {
  UEBUNG_ZEILE,
  aktualisiereZeile,
  ladeUebungZumBearbeiten,
  ladeUebungZumLesen,
} from "@/lib/kern/zugriff";
import { HINWEIS_NICHTS_ENTSTANDEN } from "@/lib/kern/kopie";
import { diagrammZumAnlegen } from "@/lib/kern/uebung-diagramm";
import type { MaterialPosten } from "@/lib/material";
import type { Befund } from "@/lib/diagramm-pruefung";
import {
  NICHTS_ANGELEGT,
  UNVERAENDERT,
  abgelehnt,
  geaenderteSpalten,
  inhaltAusZeile,
  pruefeUebungsInhalt,
  ueberlagere,
  type Fund,
  type UebungInhalt,
  type UebungPatch,
  type UebungsZeile,
} from "@/lib/kern/uebung-inhalt";

/**
 * Eigene Übungen anlegen, ändern, öffentlich schalten und kopieren (Epic #139).
 *
 * Eine eigene Übung anlegen (Story #143; beide Altersstufen seit #147).
 *
 * Der Weg des KI-Werkzeugs «uebung_anlegen». Die Regeln sind die des
 * Formulars (`parseUebungsInhalt`, über lib/kern/uebung-inhalt.ts), je
 * Altersstufe die ihren (#147 AK 4, NFR 1), und die Übung
 * entsteht wie dort: als privater Entwurf des Aufrufers (#143 PC 1), mit
 * sprechendem Slug samt Zufalls-Suffix. Ein Feld-Diagramm kann mitkommen
 * (#145 AK 5): Es wird das Bild der Übung, und KiFu zählt das Material
 * daraus. Ein Foto kommt über diesen Weg nicht mit.
 *
 * Verletzt die Übung Regeln, entsteht nichts (PC 4), und die Antwort nennt
 * jede einzeln (AK 6) — die des Diagramms in derselben Liste (#145 AK 7).
 */
export async function legeUebungAn(
  supabase: SupabaseClient,
  userId: string,
  e: UebungInhalt & { altersstufe: string; diagramm?: unknown },
): Promise<
  KernErgebnis<{
    id: string;
    slug: string;
    sichtbarkeit: "entwurf";
    /** Nur mit Diagramm: die daraus gezählte Liste und die Ergänzung (#145 PC 6). */
    material?: { liste: MaterialPosten[]; ergaenzung: string[] };
    /** Nur mit Diagramm: seine Mängel (#146 AK 3); leer = nichts zu melden. */
    maengel?: Befund[];
  }>
> {
  // Die Altersstufe ist Pflicht und hat keinen Rückfall — wie beim Anlegen
  // eines Trainings: Sie bindet die Übung an ihr Lehrmittel.
  const altersstufe = e.altersstufe.trim();
  if (!istAltersstufe(altersstufe))
    return fehlschlag("eingabe", "Bitte die Altersstufe wählen.", {
      feld: "altersstufe",
      zulaessig: ALTERSSTUFEN,
      hinweis: NICHTS_ANGELEGT,
    });

  // Alle Verstösse in einer Antwort, damit der Assistent in einem Zug
  // korrigiert (#143 AK 6) — die Angaben und das Diagramm zusammen (#145 AK 7).
  const p = pruefeUebungsInhalt(e, { altersstufe });
  const d = diagrammZumAnlegen(e);
  if (!p.ok || d.funde.length) return abgelehnt([...(p.ok ? [] : p.funde), ...d.funde], NICHTS_ANGELEGT);

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      ...p.row,
      // Bild, Diagramm und die daraus gezählte Liste samt Basis (#145 PC 3, 4).
      ...d.spalten,
      slug: userSlug(String(p.row.name)),
      source: "user",
      owner_id: userId,
      visibility: "private",
    })
    .select("id, slug")
    .single();
  if (error) return ausDbFehler(error);
  return ok({
    id: data.id as string,
    slug: data.slug as string,
    sichtbarkeit: "entwurf",
    ...(d.spalten && {
      material: { liste: d.spalten.material_liste, ergaenzung: (p.row.material as string[] | undefined) ?? [] },
      maengel: d.maengel,
    }),
  });
}

/**
 * Einzelne Angaben einer eigenen Übung ändern (Story #144 AK 1, 4, 5).
 *
 * Die Änderung wird über die gespeicherte Übung gelegt, und geprüft wird die
 * GANZE Übung danach — die CHECKs der Datenebene gelten zeilenweise, und
 * eine neue Einordnung kann gespeicherte Angaben ungültig machen. Die werden
 * nicht still gelöscht, sondern benannt (PO 2026-09-29): Der Assistent setzt
 * sie ausdrücklich auf `null`. Verletzt die Übung danach eine Regel, bleibt
 * sie unverändert (PC 2). Geschrieben werden nur die Spalten, die sich
 * tatsächlich ändern.
 *
 * Die Altersstufe ändert sich nie; wer sie mitsendet, sendet sie zur
 * Kontrolle (#147 OoS 1). Bild, Diagramm und Sichtbarkeit berührt dieser Weg
 * nicht, die Fassungen der Übung in Trainings auch nicht.
 */
export async function aendereUebung(
  supabase: SupabaseClient,
  userId: string,
  e: { kennung: string; aenderung: UebungPatch; altersstufe?: string },
): Promise<KernErgebnis<{ id: string; slug: string; sichtbarkeit: Sichtbarkeit }>> {
  if (e.altersstufe === undefined && Object.values(e.aenderung).every((v) => v === undefined))
    return fehlschlag("eingabe", "Nenne mindestens eine Angabe, die sich ändern soll.", {
      hinweis: UNVERAENDERT,
    });

  const zugriff = await ladeUebungZumBearbeiten<UebungsZeile>(supabase, userId, e.kennung, VORLAGE_SELECT);
  if (!zugriff.ok) return zugriff;
  const zeile = zugriff.wert;

  const funde: Fund[] = [];
  if (e.altersstufe !== undefined && e.altersstufe !== zeile.altersstufe)
    funde.push({
      feld: "altersstufe",
      meldung:
        "Die Altersstufe einer Übung lässt sich über den KI-Zugang nicht wechseln — die " +
        "Überführung gibt es nur in KiFu selbst.",
      zulaessig: [zeile.altersstufe],
      art: "regel",
    });
  const { inhalt, ausBestand } = ueberlagere(inhaltAusZeile(zeile), e.aenderung);
  const p = pruefeUebungsInhalt(inhalt, { altersstufe: zeile.altersstufe, ausBestand });
  if (!p.ok) funde.push(...p.funde);
  if (!p.ok || funde.length > 0) return abgelehnt(funde, UNVERAENDERT);

  const werte = geaenderteSpalten(p.row, zeile);
  if (Object.keys(werte).length > 0) {
    const r = await aktualisiereZeile(supabase, "exercises", zeile.id, werte, UEBUNG_ZEILE);
    if (!r.ok) return r;
  }
  return ok({ id: zeile.id, slug: zeile.slug, sichtbarkeit: sichtbarkeitVon(zeile.visibility) });
}

/** Was das Öffentlich-Schalten bewirkt — der Assistent nennt es dem Trainer
 *  vorher (#144 AK 2). Einen Urheber zeigt KiFu an Übungen nie
 *  (docs/produkt/uebungen.md, «Drucken»; die Übungsseite ebenso). */
export const TRAGWEITE_UEBUNG_VEROEFFENTLICHEN =
  "Die Übung wird für alle sichtbar — mit allen Angaben, Bild und Feld-Diagramm — und trägt die " +
  "Plakette «Community». Einen Trainernamen zeigt KiFu bei Übungen nicht.";

/** Die Sichtbarkeit einer eigenen Übung setzen — gleich, welcher
 *  Altersstufe. Zweimal dasselbe ist kein Fehler. */
async function setzeSichtbarkeit(
  supabase: SupabaseClient,
  userId: string,
  kennung: string,
  visibility: "public" | "private",
): Promise<KernErgebnis<{ id: string; slug: string }>> {
  const zugriff = await ladeUebungZumBearbeiten(supabase, userId, kennung);
  if (!zugriff.ok) return zugriff;
  const { id, slug } = zugriff.wert;
  return abgebildet(await aktualisiereZeile(supabase, "exercises", id, { visibility }, UEBUNG_ZEILE), () => ({
    id,
    slug,
  }));
}

/** Eine eigene Übung öffentlich schalten (#144 AK 2, PC 3). Sie bleibt
 *  bearbeitbar; es entsteht keine Kopie. */
export async function veroeffentlicheUebung(
  supabase: SupabaseClient,
  userId: string,
  e: { kennung: string },
): Promise<KernErgebnis<{ id: string; slug: string; sichtbarkeit: "oeffentlich"; tragweite: string }>> {
  return abgebildet(await setzeSichtbarkeit(supabase, userId, e.kennung, "public"), (w) => ({
    ...w,
    sichtbarkeit: "oeffentlich",
    tragweite: TRAGWEITE_UEBUNG_VEROEFFENTLICHEN,
  }));
}

/** Eine eigene öffentliche Übung zurückziehen (#144 AK 3). Kopien, die
 *  andere schon in ihre Trainings oder ihren Bestand übernommen haben,
 *  bleiben — sie sind eigenständig. Ein Entwurf bleibt Entwurf. */
export async function setzeUebungAufEntwurf(
  supabase: SupabaseClient,
  userId: string,
  e: { kennung: string },
): Promise<KernErgebnis<{ id: string; slug: string; sichtbarkeit: "entwurf" }>> {
  return abgebildet(await setzeSichtbarkeit(supabase, userId, e.kennung, "private"), (w) => ({
    ...w,
    sichtbarkeit: "entwurf",
  }));
}

/** Die Quelle ist beim Kopieren nicht (mehr) sichtbar — wortgleich mit der
 *  Oberfläche («Übung kopieren»). */
export const UEBUNG_QUELLE_NICHT_VERFUEGBAR = "Die Übung ist nicht mehr verfügbar.";

/**
 * Eine sichtbare Übung in den eigenen Bestand kopieren (#171, Story 7
 * Übungswelten; KI-Weg #317) — eine Regelquelle für den Knopf «Übung
 * kopieren» und das Werkzeug «uebung_kopieren» (#317 NFR 1).
 *
 * Sichtbar heisst: was die RLS zeigt — die eigene, eine Manual-Übung oder die
 * öffentliche eines anderen Kontos, in beiden Altersstufen. Kopiert wird nur
 * aus dem Übungsbestand, nie eine Übung aus einem Training (#317 OoS 1): Die
 * Kennung wird allein in `exercises` gesucht.
 *
 * Es entsteht ein privater Entwurf mit allen Angaben, eigener Bild- und
 * Diagrammkopie und der Altersstufe der Quelle, ohne Verbindung zu ihr
 * (#317 PC 1/2). Nur die Kopie einer EIGENEN Übung trägt «(Kopie)» im Namen
 * (PC 3) — sie stünde sonst namensgleich neben der Quelle. Der Favoritenstatus
 * reist nicht mit: die Kopie trägt eine neue ID. Scheitert es, bleibt nichts
 * zurück — die Bildkopie fällt mit dem Insert weg.
 */
export async function kopiereUebungNach(
  supabase: SupabaseClient,
  userId: string,
  e: { kennung: string },
): Promise<KernErgebnis<{ id: string; slug: string; name: string; sichtbarkeit: "entwurf" }>> {
  const nichts = { hinweis: HINWEIS_NICHTS_ENTSTANDEN };
  const quelle = await ladeUebungZumLesen<UebungsZeile>(supabase, e.kennung, VORLAGE_SELECT);
  if (!quelle.ok)
    return quelle.art === "nicht_gefunden"
      ? fehlschlag("nicht_gefunden", UEBUNG_QUELLE_NICHT_VERFUEGBAR, { feld: "kennung", ...nichts })
      : { ...quelle, ...nichts };
  const q = quelle.wert;

  const name = q.owner_id === userId ? kopieName(q.name) : undefined;
  const kopie = await legeUebungsKopieAn(supabase, q, { ownerId: userId, altersstufe: q.altersstufe, name });
  if (!kopie.ok) return fehlschlag(kopie.art, kopie.error, nichts);
  return ok({ id: kopie.id, slug: kopie.slug, name: name ?? q.name, sichtbarkeit: "entwurf" });
}
