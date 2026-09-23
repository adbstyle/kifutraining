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
// Noch nicht enthalten, weil erst ihre Stories sie bringen: Durchlauf je
// Variante (#194), Hinweise und Zeitrichtwerte (#195, #199), Veröffentlichung
// (#196), Termin (#198).
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.
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
import { bearbeitungszielVon } from "@/lib/training-zugriff";
import { sichtbarkeitVon, wert, wertOderNull } from "@/lib/wert";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings-fuer";
import type { TeilAuskunft, TrainingAuskunft, UebungAuskunft } from "@/lib/kern/auskunft-schema";

export type { TrainingAuskunft } from "@/lib/kern/auskunft-schema";

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
    material: f.material,
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

/** Ein Training als Auskunft — für `userId` (entscheidet `eigen` und
 *  `bearbeitbar`). */
export function trainingAuskunft(d: TrainingDetail, k: { userId: string }): TrainingAuskunft {
  const mehrere = d.varianten.length > 1;
  // Jedes Training führt mindestens eine Variante; der Rückfall hält die
  // Auskunft trotzdem vollständig, falls der Embed einmal leer ausfällt.
  const varianten: (Variante | undefined)[] = d.varianten.length > 0 ? d.varianten : [undefined];
  const alsUebung = (f: TrainingExerciseItem) => uebungAuskunft(f, d.stufen);

  const teile: TeilAuskunft[] = [];
  const gesamt: TrainingAuskunft["gesamt"] = [];

  varianten.forEach((v, i) => {
    const sichtbar = sichtbareZuordnungen(d.exercises, v?.id);
    const gliederung = editorGliederung(d.altersstufe, sichtbar);
    for (const teil of gliederung) {
      // In BEIDEN Schemata heisst der Hauptteil `hauptteil` (vgl.
      // `abschnittMitVariante`). Die übrigen Teile sind in jeder Variante
      // gleich und erscheinen einmal — aus der ersten.
      const istHauptteil = teil.key === "hauptteil";
      if (!istHauptteil && i > 0) continue;

      const ohneKategorie =
        istHauptteil && d.altersstufe === "kinderfussball"
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
        ...(istHauptteil && mehrere && v ? { variante: { id: v.id, name: v.name } } : {}),
        summe_min: teil.sum,
        ohne_dauer: teil.missing,
        bloecke: teil.bloecke.map((b) => ({
          einordnung: wert(EINORDNUNG_LABEL, b.einordnung),
          hauptteilkategorie: wertOderNull(hauptteilkategorieLabels, b.hkat),
          label: b.label,
          traegt_dauer: b.traegtDauer,
          traegt_gruppen: b.traegtGruppen,
          summe_min: b.sum,
          ...(b.items.length === 0 && b.leerHinweis ? { leer_hinweis: b.leerHinweis } : {}),
          uebungen: b.items.map(alsUebung),
        })),
        ...(ohneKategorie.length > 0 ? { ohne_kategorie: ohneKategorie.map(alsUebung) } : {}),
      });
    }
    gesamt.push({
      ...(mehrere && v ? { variante_id: v.id } : {}),
      summe_min: gliederung.reduce((a, t) => a + t.sum, 0),
      ohne_dauer: gliederung.reduce((a, t) => a + t.missing, 0),
    });
  });

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
    uebungen_gesamt: d.exercises.length,
    varianten: d.varianten.map((v) => ({ id: v.id, name: v.name })),
    gruppen: d.gruppen,
    teile,
    gesamt,
  };
}
