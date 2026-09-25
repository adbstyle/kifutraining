// Der Vertrag der Trainings-Auskunft (#193 AK 1, NFR 1) — EINMAL, als
// zod-Schema: Der Mapper (lib/kern/auskunft.ts) leitet seine Typen per
// `z.infer` daraus ab, das Werkzeug «training_abrufen» meldet es als
// `outputSchema`, und das SDK prüft jede Antwort dagegen. Ein Feld, das der
// Mapper baut, aber hier fehlt, bricht den Typecheck.
//
// Gebaut über eine Fabrik: `streng` nimmt `z.strictObject` auf allen Ebenen.
// Im Betrieb bleibt es beim gewöhnlichen `z.object` (ein unbekanntes Feld
// fiele still weg statt den Aufruf scheitern zu lassen); `check:kern` parst
// die Beispiel-Auskünfte streng, damit ein undeklariertes Feld dort auffällt.
//
// REIN: nur zod und lib/wert — `check:kern` lädt diese Datei mit tsx.
import { z } from "zod";
import { Sichtbarkeit, Wert } from "@/lib/wert";
import { materialSchema } from "@/lib/material-ausgabe";

function baueSchema(streng: boolean) {
  const obj = streng ? z.strictObject : z.object;
  const W = streng ? z.strictObject(Wert.shape) : Wert;
  const IdName = obj({ id: z.string(), name: z.string() });

  /** Der Zeitrichtwert des Manuals Fussball Jugendliche an dieser Stelle
   *  (#199 AK 8) — Orientierung, keine Bedingung (NFR 2): Speichern und
   *  Veröffentlichen bleiben unberührt. `abweichung_min` ist die Abweichung
   *  der Summe vom Band (negativ = darunter, 0 = innerhalb oder noch keine
   *  Dauer erfasst), wie der Editor sie hinter den Richtwert setzt. `null`
   *  im Kinderfussball (das Manual gibt keine Zeiten vor), im Auffangen (zählt
   *  nicht zur Trainingszeit) und an einem Block, dessen Teil nicht
   *  untergliedert ist (der Richtwert steht dann am Teil). */
  const Richtwert = obj({
    min_min: z.number().int(),
    max_min: z.number().int(),
    abweichung_min: z.number().int(),
  }).nullable();

  const Uebung = obj({
    /** Die Kennung für die Bearbeitungs-Werkzeuge. */
    fassung_id: z.string(),
    name: z.string(),
    einordnung: W,
    hauptteilkategorie: W.nullable(),
    /** Die Variante des Hauptteils; `null` ausserhalb — dort gilt die Übung
     *  für alle Varianten gemeinsam. */
    variante_id: z.string().nullable(),
    /** 0-basiert, innerhalb des Abschnitts. */
    position: z.number().int(),
    dauer_min: z.number().int().nullable(),
    notiz: z.string().nullable(),
    kategorien: z.array(W),
    /** Deckt die Übung mindestens eine Alterskategorie des Trainings ab? Ohne
     *  eigene Kategorien gibt es nichts abzudecken (wie im Editor). */
    deckt_stufen: z.boolean(),
    erscheinungsform: z.array(W),
    feldtyp: W.nullable(),
    spielfeld: obj({ laenge_m: z.number(), breite_m: z.number() }).nullable(),
    uebungstyp: W.nullable(),
    anzahl_kinder: obj({ min: z.number().nullable(), max: z.number().nullable() }).nullable(),
    /** Das Material dieser Übung, gegliedert wie in der Oberfläche. */
    material: materialSchema(streng),
    ablauf: z
      .discriminatedUnion("art", [
        obj({
          art: z.literal("fahrplan"),
          offen_starten: z.string(),
          ueben: z.array(z.string()),
          wetteifern: z.string().nullable(),
        }),
        obj({ art: z.literal("beschreibung"), text: z.string() }),
      ])
      .nullable(),
    /** Abwandlungen der Übung selbst (Freitext) — nicht die Varianten des
     *  Hauptteils. */
    uebungsvarianten: z.array(z.string()),
    hat_bild: z.boolean(),
    hat_diagramm: z.boolean(),
    /** Die Gruppen im Durchlauf, in Wechselreihenfolge; leer = alle gemeinsam. */
    gruppen: z.array(IdName),
  });

  const Block = obj({
    einordnung: W,
    /** Nur im Kinderfussball-Hauptteil. */
    hauptteilkategorie: W.nullable(),
    /** Die Überschrift wie im Editor. */
    label: z.string(),
    traegt_dauer: z.boolean(),
    traegt_gruppen: z.boolean(),
    summe_min: z.number().int(),
    richtwert: Richtwert,
    /** Nur bei einem leeren Block, den das Lehrmittel als gesetzt ansieht —
     *  der Satz, den der Editor dort zeigt. */
    leer_hinweis: z.string().optional(),
    uebungen: z.array(Uebung),
  });

  const Teil = obj({
    teil: W,
    /** Nur am Hauptteil, und erst ab zwei Varianten (Epic EK 7). */
    variante: IdName.optional(),
    summe_min: z.number().int(),
    /** Übungen mit Dauer-Feld, aber ohne erfasste Dauer. */
    ohne_dauer: z.number().int(),
    richtwert: Richtwert,
    bloecke: z.array(Block),
    /** Kinderfussball-Hauptteil-Übungen ohne Hauptteilkategorie
     *  (Altbestand): in keinem Block, aber nicht still weg. */
    ohne_kategorie: z.array(Uebung).optional(),
  });

  const Gruppe = obj({
    id: z.string(),
    name: z.string(),
    /** An wie vielen Hauptteil-Übungen die Gruppe im Durchlauf steht — über
     *  ALLE Varianten: so viele Zuweisungen fielen beim Entfernen weg. */
    an_uebungen: z.number().int(),
  });

  const Durchlauf = obj({
    /** Erst ab zwei Varianten: für welche dieser Durchlauf gilt. */
    variante_id: z.string().optional(),
    /** Wie viele Wechsel der Hauptteil hat: der längste Durchlauf einer
     *  Übung. Im Juniorenfussball über beide Hauptteil-Blöcke gezählt. */
    wechsel_zahl: z.number().int(),
    /** Je Wechsel (1-basiert), welche Gruppe an welcher Übung steht, in der
     *  Reihenfolge der Gruppen. Eine Übung ohne Gruppen (alle gemeinsam)
     *  steht in keinem Wechsel. */
    wechsel: z.array(
      obj({
        nr: z.number().int(),
        belegung: z.array(
          obj({ gruppe_id: z.string(), gruppe: z.string(), fassung_id: z.string(), uebung: z.string() }),
        ),
      }),
    ),
    /** Je Gruppe die zugewiesene Zeit, wie der Editor sie nennt
     *  («Zugewiesen 40 min», «Zugewiesen —» ohne erfasste Dauer). */
    zeit_je_gruppe: z.array(obj({ gruppe_id: z.string(), gruppe: z.string(), text: z.string() })),
  });

  const Training = obj({
    id: z.string(),
    name: z.string(),
    ziel: z.string().nullable(),
    altersstufe: W,
    stufen: z.array(W),
    sichtbarkeit: Sichtbarkeit,
    /** Anzeigename des Urhebers; `null` bei anonymisierten Trainings. */
    urheber: z.string().nullable(),
    geaendert_am: z.string(),
    bestand: z.discriminatedUnion("art", [
      obj({ art: z.literal("persoenlich"), eigen: z.boolean() }),
      obj({ art: z.literal("team"), team: IdName }),
    ]),
    bearbeitbar: z.boolean(),
    /** Der Termin eines Team-Trainings (#198) — höchstens einer je Training;
     *  `null` ohne Termin und bei persönlichen Trainings (die keinen tragen
     *  können). `anstehend`: heute oder später, am Trainingsort gemessen. */
    termin: obj({
      id: z.string(),
      datum: z.string(),
      beginn: z.string().nullable(),
      ort: z.string().nullable(),
      bemerkung: z.string().nullable(),
      anstehend: z.boolean(),
    }).nullable(),
    /** Alle Übungen des Trainings über ALLE Varianten des Hauptteils. */
    uebungen_gesamt: z.number().int(),
    varianten: z.array(IdName),
    /** Die Gruppen des Trainings in ihrer Reihenfolge. */
    gruppen: z.array(Gruppe),
    /** Der Hauptteil erscheint einmal je Variante, die übrigen Teile einmal. */
    teile: z.array(Teil),
    /** Je Variante die Summe — ein Training mit zwei Hauptteilen spielt nur
     *  einen davon. `variante_id` erst ab zwei Varianten. */
    gesamt: z.array(
      obj({
        variante_id: z.string().optional(),
        summe_min: z.number().int(),
        ohne_dauer: z.number().int(),
        /** Juniorenfussball: die vorgesehenen 90 Minuten (min = max) samt
         *  Abweichung; `null` im Kinderfussball. */
        richtwert: Richtwert,
      }),
    ),
    /** Der Durchlauf des Hauptteils je Variante (#194 AK 8, NFR 1). */
    durchlauf: z.array(Durchlauf),
  });

  return { Uebung, Block, Teil, Durchlauf, Training };
}

const schema = baueSchema(false);

export const TrainingAuskunft = schema.Training;
/** Der Ausschnitt für «training_durchlauf_abrufen»: Gruppen und Durchlauf. */
export const DurchlaufAusschnitt = schema.Training.pick({ gruppen: true, durchlauf: true });
/** Dasselbe Schema mit `strictObject` auf allen Ebenen — nur für Prüfungen. */
export const TrainingAuskunftStreng = baueSchema(true).Training;

export type TrainingAuskunft = z.infer<typeof schema.Training>;
export type TeilAuskunft = z.infer<typeof schema.Teil>;
export type UebungAuskunft = z.infer<typeof schema.Uebung>;
export type DurchlaufAuskunft = z.infer<typeof schema.Durchlauf>;
