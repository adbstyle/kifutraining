// Ein Training als Auskunft für den KI-Assistenten (#193 AK 1, NFR 1).
//
// «So vollständig, dass der Assistent es ohne weitere Rückfragen
// überarbeiten kann»: alle Angaben, jede Übung mit ihrem Inhalt, und die
// Gliederung genau so, wie der Editor sie zeigt — mit LEEREN Blöcken (beim
// Planen ist gerade die Lücke die Information) und dem Hauptteil einmal je
// Variante. Die Gliederung kommt aus `editorGliederung`, derselben Funktion
// wie im Editor, damit Auskunft und Anzeige nicht auseinanderlaufen.
//
// Aussen snake_case und jede geführte Angabe als `Wert` ({slug, label}) —
// dieselbe Konvention wie jedes Werkzeug-Ergebnis (lib/wert.ts). Der Mapper
// baut sie hier direkt, statt einen camelCase-Zwischenstand zu erzeugen, den
// nur ein zweiter Mapper läse. Der Vertrag selbst — Felder, Typen,
// Bedeutung — steht einmal als zod-Schema in lib/kern/auskunft-schema.ts.
//
// Der Durchlauf je Variante (#194) rechnet mit derselben Verteilung wie der
// Editor (`verteilungAus`, `wechselZahl`, `zeitJeGruppe`).
//
// Der Termin eines Team-Trainings (#198) kommt als Parameter herein — er
// steht nicht im `TrainingDetail`, und `anstehend` hängt am heutigen Tag, den
// der Aufrufer bestimmt (am Trainingsort, lib/zeit.ts).
//
// Die Zeitrichtwerte (#199 AK 8) rechnet `zeitAbgleich`/`gesamtAbgleich`
// aus lib/junioren.ts — dieselben Funktionen wie die Anzeige im Editor und
// die Hinweise (lib/hinweise.ts), mit derselben Regel, wo ein Richtwert
// steht: am Teil, und am Block nur, wo er eine eigene Fläche trägt.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
import { materialAusgabe } from "@/lib/material-ausgabe";
import {
  altersstufe as altersstufeLabels,
  feldtyp as feldtypLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
  uebungstyp as uebungstypLabels,
} from "@/lib/vocab";
import { HAUPTTEILKATEGORIE_SLUGS, editorGliederung, stufenAbgedeckt } from "@/lib/training";
import { sichtbareZuordnungen, type Variante } from "@/lib/varianten";
import { EINORDNUNG_LABEL, ERSCHEINUNGSFORM_LABEL, kategorieStufe } from "@/lib/labels";
import { hatDiagramm } from "@/lib/diagramm";
import { istHauptteil, verteilungAus, wechselZahl, zeitJeGruppe, zeitText } from "@/lib/gruppen";
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { sichtbarkeitVon, wert, wertOderNull } from "@/lib/wert";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings-fuer";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { GESAMTDAUER_JUNIOREN, gesamtAbgleich, zeitAbgleich } from "@/lib/junioren";
import type {
  DurchlaufAuskunft,
  TeilAuskunft,
  TrainingAuskunft,
  UebungAuskunft,
} from "@/lib/kern/auskunft-schema";

export type { TrainingAuskunft } from "@/lib/kern/auskunft-schema";

/** Der Zeitrichtwert einer Stelle samt Abweichung ihrer Summe — `null`, wo
 *  das Schema keinen führt (kein `richtwertSlug` oder keine Bandbreite). */
function richtwertAuskunft(slug: string | undefined, summeMin: number): TeilAuskunft["richtwert"] {
  const a = slug ? zeitAbgleich(slug, summeMin) : null;
  return a ? { min_min: a.band.min, max_min: a.band.max, abweichung_min: a.abweichungMin } : null;
}

function uebungAuskunft(f: TrainingExerciseItem, trainingStufen: readonly string[]): UebungAuskunft {
  const fp = f.fahrplan;
  return {
    fassung_id: f.id,
    name: f.name,
    einordnung: wert(EINORDNUNG_LABEL, f.trainingsteil),
    hauptteilkategorie: wertOderNull(hauptteilkategorieLabels, f.hauptteilkategorie),
    variante_id: f.varianteId,
    position: f.position,
    dauer_min: f.durationMin,
    notiz: f.notiz,
    kategorien: f.kategorien.map((k) => wert(kategorieStufe, k)),
    deckt_stufen: f.kategorien.length === 0 || stufenAbgedeckt(trainingStufen, f.kategorien),
    erscheinungsform: f.erscheinungsform.map((s) => wert(ERSCHEINUNGSFORM_LABEL, s)),
    feldtyp: wertOderNull(feldtypLabels, f.feldtyp),
    spielfeld:
      f.spielfeldLaengeM != null && f.spielfeldBreiteM != null
        ? { laenge_m: f.spielfeldLaengeM, breite_m: f.spielfeldBreiteM }
        : null,
    uebungstyp: wertOderNull(uebungstypLabels, f.uebungstyp),
    anzahl_kinder: f.anzahlKinder
      ? { min: f.anzahlKinder.min ?? null, max: f.anzahlKinder.max ?? null }
      : null,
    material: materialAusgabe(f.materialListe, f.material),
    // Genau eine Form trägt den Ablauf (Fahrplan im Kinderfussball, Text im
    // Juniorenfussball, CHECK `ablauf_je_einordnung`).
    ablauf: fp
      ? {
          art: "fahrplan",
          offen_starten: fp.offen_starten ?? "",
          ueben: fp.ueben ?? [],
          wetteifern: fp.wetteifern ?? null,
        }
      : f.aufbau
        ? { art: "beschreibung", text: f.aufbau }
        : null,
    uebungsvarianten: f.uebungsvarianten,
    hat_bild: !!f.bildUrl,
    hat_diagramm: hatDiagramm(f.diagramm),
    gruppen: f.gruppen,
  };
}

/** Der Durchlauf des Hauptteils EINER Variante (#194 AK 8, PC 3): dieselbe
 *  Verteilung wie im Editor, im Juniorenfussball also über beide
 *  Hauptteil-Blöcke hinweg. Die Belegung eines Wechsels folgt der
 *  Reihenfolge der Gruppen, damit sie stabil steht. */
function durchlaufAuskunft(
  sichtbar: readonly TrainingExerciseItem[],
  gruppen: readonly { id: string; name: string }[],
  variante: { id: string; mehrere: boolean } | undefined,
): DurchlaufAuskunft {
  const verteilung = verteilungAus(sichtbar);
  const zeiten = zeitJeGruppe(verteilung);
  const zahl = wechselZahl(verteilung);
  const wechsel: DurchlaufAuskunft["wechsel"] = [];
  for (let w = 0; w < zahl; w++) {
    const belegung: DurchlaufAuskunft["wechsel"][number]["belegung"] = [];
    for (const g of gruppen)
      for (const f of verteilung)
        if (f.gruppen[w] === g.id)
          belegung.push({ gruppe_id: g.id, gruppe: g.name, fassung_id: f.id, uebung: f.name });
    wechsel.push({ nr: w + 1, belegung });
  }
  // Dieselbe Einschränkung wie am Chip der Gruppenleiste (#201 AK 9).
  const zusatz = variante?.mehrere ? "in dieser Variante" : undefined;
  return {
    ...(variante?.mehrere ? { variante_id: variante.id } : {}),
    wechsel_zahl: zahl,
    wechsel,
    zeit_je_gruppe: gruppen.map((g) => ({
      gruppe_id: g.id,
      gruppe: g.name,
      text: zeitText(zeiten.get(g.id), zusatz),
    })),
  };
}

/** Ein Training als Auskunft — für `userId` (entscheidet `eigen` und
 *  `bearbeitbar`). `termin` ist der Termin des Team-Trainings, falls es einen
 *  trägt; `heute` (`YYYY-MM-DD`) entscheidet `anstehend` — ohne Angabe der
 *  heutige Tag am Trainingsort. */
export function trainingAuskunft(
  d: TrainingDetail,
  k: { userId: string; termin?: TerminZeile | null; heute?: string },
): TrainingAuskunft {
  const mehrere = d.varianten.length > 1;
  // Jedes Training führt mindestens eine Variante; der Rückfall hält die
  // Auskunft trotzdem vollständig, falls der Embed einmal leer ausfällt.
  const varianten: (Variante | undefined)[] = d.varianten.length > 0 ? d.varianten : [undefined];
  const alsUebung = (f: TrainingExerciseItem) => uebungAuskunft(f, d.stufen);

  const teile: TeilAuskunft[] = [];
  const gesamt: TrainingAuskunft["gesamt"] = [];
  const durchlauf: DurchlaufAuskunft[] = [];

  varianten.forEach((v, i) => {
    const sichtbar = sichtbareZuordnungen(d.exercises, v?.id);
    const gliederung = editorGliederung(d.altersstufe, sichtbar);
    for (const teil of gliederung) {
      // In BEIDEN Schemata heisst der Hauptteil `hauptteil` (vgl.
      // `abschnittMitVariante`). Die übrigen Teile sind in jeder Variante
      // gleich und erscheinen einmal — aus der ersten.
      const imHauptteil = teil.key === "hauptteil";
      if (!imHauptteil && i > 0) continue;

      const ohneKategorie =
        imHauptteil && d.altersstufe === "kinderfussball"
          ? sichtbar.filter(
              (f) =>
                f.trainingsteil === "hauptteil" &&
                !HAUPTTEILKATEGORIE_SLUGS.includes(
                  f.hauptteilkategorie as (typeof HAUPTTEILKATEGORIE_SLUGS)[number],
                ),
            )
          : [];

      teile.push({
        teil: { slug: teil.key, label: teil.label },
        ...(imHauptteil && mehrere && v ? { variante: { id: v.id, name: v.name } } : {}),
        summe_min: teil.sum,
        ohne_dauer: teil.missing,
        richtwert: richtwertAuskunft(teil.richtwertSlug, teil.sum),
        bloecke: teil.bloecke.map((b) => ({
          einordnung: wert(EINORDNUNG_LABEL, b.einordnung),
          hauptteilkategorie: wertOderNull(hauptteilkategorieLabels, b.hkat),
          label: b.label,
          traegt_dauer: b.traegtDauer,
          traegt_gruppen: b.traegtGruppen,
          summe_min: b.sum,
          // Ein einblockiger Teil nennt seinen Richtwert einmal, am Teil —
          // wie `Unterblock` im Editor und die Hinweise.
          richtwert: richtwertAuskunft(b.flaeche ? b.richtwertSlug : undefined, b.sum),
          ...(b.items.length === 0 && b.leerHinweis ? { leer_hinweis: b.leerHinweis } : {}),
          uebungen: b.items.map(alsUebung),
        })),
        ...(ohneKategorie.length > 0 ? { ohne_kategorie: ohneKategorie.map(alsUebung) } : {}),
      });
    }
    const summe = gliederung.reduce((a, t) => a + t.sum, 0);
    gesamt.push({
      ...(mehrere && v ? { variante_id: v.id } : {}),
      summe_min: summe,
      ohne_dauer: gliederung.reduce((a, t) => a + t.missing, 0),
      // Wie die Summenleiste des Editors: nur im Juniorenfussball.
      richtwert:
        d.altersstufe === "juniorenfussball"
          ? {
              min_min: GESAMTDAUER_JUNIOREN,
              max_min: GESAMTDAUER_JUNIOREN,
              abweichung_min: gesamtAbgleich(summe, GESAMTDAUER_JUNIOREN).abweichungMin,
            }
          : null,
    });
    durchlauf.push(durchlaufAuskunft(sichtbar, d.gruppen, v && { id: v.id, mehrere }));
  });

  // An wie vielen Übungen eine Gruppe steht — über alle Varianten, wie die
  // Rückfrage vor dem Entfernen im Editor (#194 AK 5).
  const hauptteil = d.exercises.filter((f) => istHauptteil(f.trainingsteil));
  const anUebungen = (gruppeId: string) =>
    hauptteil.filter((f) => f.gruppen.some((g) => g.id === gruppeId)).length;

  // Die Hauptteile stehen nach der Schleife hinter den übrigen Teilen der
  // ersten Variante; zurück in die Reihenfolge des Schemas, Varianten
  // nebeneinander.
  const schema = editorGliederung(d.altersstufe, []).map((g) => g.key);
  teile.sort((a, b) => schema.indexOf(a.teil.slug) - schema.indexOf(b.teil.slug));

  return {
    id: d.id,
    name: d.name,
    ziel: d.ziel,
    altersstufe: wert(altersstufeLabels, d.altersstufe),
    stufen: d.stufen.map((s) => wert(kategorieStufe, s)),
    sichtbarkeit: sichtbarkeitVon(d.visibility),
    urheber: d.urheber,
    geaendert_am: d.updatedAt,
    bestand: d.team
      ? { art: "team", team: d.team }
      : { art: "persoenlich", eigen: d.ownerId === k.userId },
    bearbeitbar:
      bearbeitungszielVon({ owner_id: d.ownerId, team_id: d.team?.id ?? null }, k.userId) !== null,
    termin: k.termin
      ? {
          id: k.termin.id,
          datum: k.termin.datum,
          beginn: k.termin.beginn,
          ort: k.termin.ort,
          bemerkung: k.termin.bemerkung,
          // Dieselbe Grenze wie der Plan (`teilePlan`): der heutige Tag zählt
          // ganz zum Anstehenden.
          anstehend: k.termin.datum >= (k.heute ?? heuteAmTrainingsort()),
        }
      : null,
    uebungen_gesamt: d.exercises.length,
    varianten: d.varianten.map((v) => ({ id: v.id, name: v.name })),
    gruppen: d.gruppen.map((g) => ({ id: g.id, name: g.name, an_uebungen: anUebungen(g.id) })),
    teile,
    gesamt,
    durchlauf,
  };
}
