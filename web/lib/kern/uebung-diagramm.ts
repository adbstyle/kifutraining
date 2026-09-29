import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aktivesBild, type DiagrammData } from "@/lib/diagramm";
import { pruefeDiagramm, type Befund } from "@/lib/diagramm-pruefung";
import { diagrammSpalten } from "@/lib/diagramm-setzen";
import type { MaterialPosten } from "@/lib/material";
import { fehlschlag, ok, type KernErgebnis, type Verstoss } from "@/lib/kern/ergebnis";
import { UEBUNG_ZEILE, aktualisiereZeile, ladeUebungZumBearbeiten } from "@/lib/kern/zugriff";
import { UNVERAENDERT, alsVerstoesse, type Fund } from "@/lib/kern/uebung-inhalt";

/**
 * Das Feld-Diagramm einer eigenen Übung über den KI-Assistenten setzen
 * (Story #145) — an einer bestehenden Übung (`setzeDiagramm`) und beim
 * Anlegen (`diagrammZumAnlegen`, für `legeUebungAn`).
 *
 * Die Grenzen sind dieselben wie beim Speichern aus der Übungsmaske
 * (lib/diagramm-pruefung.ts, #145 NFR 1). Über diesen Zugang kommt dazu: Ein
 * leeres Diagramm wird abgelehnt — entfernen lässt sich ein Diagramm nur in
 * KiFu selbst. Mit dem Diagramm zählt KiFu das Material (PC 4); die freie
 * Ergänzung bleibt (PC 5). Fassungen in Trainings berührt das Setzen nie.
 */

/** Eine Grenzverletzung als Verstoss. `feld` ist der Pfad in der Eingabe des
 *  Werkzeugs: «diagramm.elemente[3].farbe», ohne Element «diagramm». */
function alsVerstoss(b: Befund): Verstoss {
  return {
    feld: `diagramm${b.index !== undefined ? `.elemente[${b.index}]` : ""}${b.angabe ? `.${b.angabe}` : ""}`,
    meldung: b.meldung,
    ...(b.zulaessig && { zulaessig: b.zulaessig }),
  };
}

export const DIAGRAMM_LEER =
  "Das Diagramm enthält kein Element. Über diesen Zugang lässt sich ein Diagramm setzen und " +
  "ersetzen, aber nicht entfernen.";

/** Mit einem Diagramm zählt KiFu das Material selbst (#145 PC 4). */
export const MATERIAL_MIT_DIAGRAMM =
  "Mit einem Feld-Diagramm zählt KiFu das Material selbst — lass «material.liste» weg; die " +
  "freie Ergänzung «material.ergaenzung» bleibt möglich.";

/** Ein Diagramm, wie der Assistent es schickt: geprüft gegen die Grenzen, ein
 *  leeres abgelehnt. Ohne Fund das normalisierte Diagramm. */
function diagrammVomAssistenten(roh: unknown): { ok: true; daten: DiagrammData } | { ok: false; funde: Fund[] } {
  const p = pruefeDiagramm(roh);
  const funde: Fund[] = p.grenzen.map((b) => ({ ...alsVerstoss(b), art: "eingabe" }));
  if (p.daten?.elemente.length === 0) funde.push({ feld: "diagramm", meldung: DIAGRAMM_LEER, art: "eingabe" });
  return p.daten && funde.length === 0 ? { ok: true, daten: p.daten } : { ok: false, funde };
}

/** Das Diagramm beim Anlegen (#145 AK 5, 7): Die Funde gehören in DIESELBE
 *  Liste wie die Verstösse der übrigen Angaben; ohne Fund die Spalten, die
 *  der Insert über die Zeile des Formulars legt (Bild, Diagramm, gezählte
 *  Liste und Basis). Ohne Diagramm weder Funde noch Spalten. */
export function diagrammZumAnlegen(e: {
  diagramm?: unknown;
  material?: { liste?: readonly unknown[] } | null;
}): { funde: Fund[]; spalten: ReturnType<typeof diagrammSpalten> | null } {
  if (e.diagramm === undefined) return { funde: [], spalten: null };
  const d = diagrammVomAssistenten(e.diagramm);
  const funde = d.ok ? [] : [...d.funde];
  if (e.material?.liste?.length)
    funde.push({ feld: "material.liste", meldung: MATERIAL_MIT_DIAGRAMM, art: "regel" });
  if (!d.ok || funde.length) return { funde, spalten: null };
  return { funde, spalten: diagrammSpalten({ bild_quelle: null, bild_url: null, diagramm: null }, d.daten) };
}

export type DiagrammGesetzt = {
  id: string;
  slug: string;
  name: string;
  anzahlElemente: number;
  angezeigtesBild: "diagramm" | "foto";
  /** Die aus dem Diagramm gezählte Liste und die unveränderte Ergänzung. */
  material: { liste: MaterialPosten[]; ergaenzung: string[] };
};

/** Das Diagramm einer eigenen Übung setzen oder vollständig ersetzen (#145
 *  AK 2, 3) — gleich welcher Altersstufe. Verletzt es eine Grenze, bleibt die
 *  Übung unverändert, und «verstoesse» nennt jedes betroffene Element samt
 *  Grund (AK 6). */
export async function setzeDiagramm(
  supabase: SupabaseClient,
  userId: string,
  e: { kennung: string; diagramm: unknown },
): Promise<KernErgebnis<DiagrammGesetzt>> {
  const zugriff = await ladeUebungZumBearbeiten<{
    name: string;
    bild_url: string | null;
    bild_quelle: string | null;
    diagramm: unknown;
    material: string[] | null;
  }>(supabase, userId, e.kennung, "name, bild_url, bild_quelle, diagramm, material");
  if (!zugriff.ok) return zugriff;
  const zeile = zugriff.wert;

  const d = diagrammVomAssistenten(e.diagramm);
  if (!d.ok) {
    const n = d.funde.length;
    return fehlschlag(
      "eingabe",
      `Das Diagramm wurde nicht gesetzt: ${n === 1 ? "eine Angabe verletzt" : `${n} Angaben verletzen`} ` +
        "die Grenzen eines Feld-Diagramms. Jede steht mit Element und Grund unter «verstoesse».",
      { verstoesse: alsVerstoesse(d.funde), hinweis: UNVERAENDERT },
    );
  }

  const s = diagrammSpalten(zeile, d.daten);
  const r = await aktualisiereZeile(supabase, "exercises", zeile.id, s, UEBUNG_ZEILE);
  if (!r.ok) return r;
  return ok({
    id: zeile.id,
    slug: zeile.slug,
    name: zeile.name,
    anzahlElemente: d.daten.elemente.length,
    // Mit einem nicht leeren Diagramm gibt es immer ein Bild; der Rückfall
    // ist nur der Typ-Guard.
    angezeigtesBild: aktivesBild({ bildQuelle: s.bild_quelle, bildUrl: zeile.bild_url, diagramm: s.diagramm }) ?? "diagramm",
    material: { liste: s.material_liste, ergaenzung: zeile.material ?? [] },
  });
}
