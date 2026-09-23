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

function baueSchema(streng: boolean) {
  const obj = streng ? z.strictObject : z.object;
  const W = streng ? z.strictObject(Wert.shape) : Wert;
  const IdName = obj({ id: z.string(), name: z.string() });

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
    material: z.array(z.string()),
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
    bloecke: z.array(Block),
    /** Kinderfussball-Hauptteil-Übungen ohne Hauptteilkategorie
     *  (Altbestand): in keinem Block, aber nicht still weg. */
    ohne_kategorie: z.array(Uebung).optional(),
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
    /** Alle Übungen des Trainings über ALLE Varianten des Hauptteils. */
    uebungen_gesamt: z.number().int(),
    varianten: z.array(IdName),
    gruppen: z.array(IdName),
    /** Der Hauptteil erscheint einmal je Variante, die übrigen Teile einmal. */
    teile: z.array(Teil),
    /** Je Variante die Summe — ein Training mit zwei Hauptteilen spielt nur
     *  einen davon. `variante_id` erst ab zwei Varianten. */
    gesamt: z.array(
      obj({
        variante_id: z.string().optional(),
        summe_min: z.number().int(),
        ohne_dauer: z.number().int(),
      }),
    ),
  });

  return { Uebung, Block, Teil, Training };
}

const schema = baueSchema(false);

export const TrainingAuskunft = schema.Training;
/** Dasselbe Schema mit `strictObject` auf allen Ebenen — nur für Prüfungen. */
export const TrainingAuskunftStreng = baueSchema(true).Training;

export type TrainingAuskunft = z.infer<typeof schema.Training>;
export type TeilAuskunft = z.infer<typeof schema.Teil>;
export type BlockAuskunft = z.infer<typeof schema.Block>;
export type UebungAuskunft = z.infer<typeof schema.Uebung>;
