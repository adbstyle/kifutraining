import "server-only";
import { z } from "zod";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { kategorieStufe } from "@/lib/labels";
import { stufenOptionen } from "@/lib/filter-optionen";
import { abgebildet } from "@/lib/kern/ergebnis";
import { TrainingAuskunft } from "@/lib/kern/auskunft-schema";
import {
  trainingAbrufen as trainingAbrufenImKern,
  trainingsSuchen as trainingsSuchenImKern,
} from "@/lib/kern/lesen";
import { Sichtbarkeit, Wert, alsEnum, katalogFilter, sichtbarkeitVon, wert } from "@/lib/mcp/bausteine";
import {
  KENNUNG_FEHLER,
  TEAM_KENNUNG_FEHLER,
  TeamId,
  TrainingId,
} from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Trainings abrufen und suchen (Story #193 AK 1/2, NFR 1).
 *
 * Dünne Adapter über lib/kern/lesen.ts — dieselben Queries wie Editor,
 * Ansicht und Trainings-Übersicht; was sichtbar ist, entscheidet die RLS mit
 * dem Token des Kontos.
 *
 * Der Vertrag der Auskunft steht NICHT hier, sondern einmal als zod-Schema in
 * lib/kern/auskunft-schema.ts: Der Mapper (lib/kern/auskunft.ts) leitet seine
 * Typen daraus ab, dieses Werkzeug meldet es — um die Adresse `url` ergänzt —
 * als `outputSchema`, und das SDK prüft jede Antwort dagegen. Nur die
 * Suchtreffer beschreibt diese Datei selbst.
 */

// ── training_abrufen ────────────────────────────────────────────────────────

export const trainingAbrufen = werkzeug({
  name: "training_abrufen",
  titel: "Training abrufen",
  beschreibung:
    "Liefert ein Training vollständig: Name, Ziel, Altersstufe, Alterskategorien, " +
    "Sichtbarkeit, Bestand (persönlich oder Team), Varianten des Hauptteils und Gruppen (mit " +
    "«an_uebungen») — " +
    "und die Gliederung wie im Editor: alle Trainingsteile und Blöcke in fester Reihenfolge, " +
    "auch die leeren, der Hauptteil einmal je Variante (mit «variante» erst ab zwei). Jede " +
    "Übung mit Inhalt, Dauer, Notiz und den Gruppen ihres Durchlaufs; «fassung_id» ist die " +
    "Kennung für die Bearbeitungs-Werkzeuge. «uebungen_gesamt» zählt die Übungen aller " +
    "Varianten zusammen; «gesamt» nennt die Dauer je Variante, «durchlauf» je Variante die " +
    "Wechsel der Gruppen (wie «training_durchlauf_abrufen»). Lesbar ist jedes Training, " +
    "das dein Konto in KiFu sieht; ändern lassen sich nur die mit «bearbeitbar». Ein " +
    "Team-Training trägt in «termin» seinen Termin (höchstens einen; «anstehend» sagt, ob er " +
    "heute oder später ist), sonst steht dort null. Ob es " +
    "veröffentlicht werden kann und was dazu fehlt, zeigt «training_hinweise». " +
    `${KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ training_id: TrainingId }),
  // Editor, wenn bearbeitbar, sonst die Ansicht.
  ausgabe: TrainingAuskunft.extend({ url: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await trainingAbrufenImKern(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (a) => ({
        ...a,
        url: a.bearbeitbar ? zugang.url("training", a.id, "edit") : zugang.url("training", a.id),
      }),
    ),
});

// ── trainings_suchen ────────────────────────────────────────────────────────

const SuchenEingabe = z.object({
  bestand: alsEnum(["eigene", "oeffentlich", "team"] as const).describe(
    "eigene: deine persönlichen Trainings, Entwürfe eingeschlossen. " +
      "oeffentlich: alle öffentlichen Trainings der Community, auch deine eigenen öffentlichen. " +
      "team: der Trainingsbestand eines deiner Teams — dann mit «team_id».",
  ),
  team_id: TeamId.optional().describe(
    "Nur mit «bestand: team», dort Pflicht: das Team (Kennung aus «teams_abrufen»).",
  ),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Sucht im Namen des Trainings; Wortteile genügen, Akzente zählen nicht."),
  kategorien: katalogFilter(stufenOptionen, "Alterskategorien."),
  limit: z.number().int().min(1).max(50).default(20).describe("Höchstens so viele Treffer (bis 50)."),
});

const SuchenTreffer = z.object({
  id: z.string(),
  name: z.string(),
  /** Editor bei eigenen, sonst die Ansicht. */
  url: z.string(),
  altersstufe: Wert,
  stufen: z.array(Wert),
  sichtbarkeit: Sichtbarkeit,
  eigen: z.boolean(),
  /** Übungen der ERSTEN Variante — wie die Kachel der Übersicht. */
  uebungszahl: z.number().int(),
  /** Summe der erfassten Dauern der ersten Variante; `null`, wenn keine Übung
   *  eine trägt. */
  dauer_min: z.number().int().nullable(),
  varianten_zahl: z.number().int(),
  urheber: z.string().nullable(),
  geaendert_am: z.string(),
  /** Nur im Team-Bestand: der Termin des Trainings, `null` ohne. */
  termin: z
    .object({
      id: z.string(),
      datum: z.string(),
      beginn: z.string().nullable(),
      ort: z.string().nullable(),
      bemerkung: z.string().nullable(),
      anstehend: z.boolean(),
    })
    .nullable()
    .optional(),
});

export const trainingsSuchen = werkzeug({
  name: "trainings_suchen",
  titel: "Trainings suchen",
  beschreibung:
    "Durchsucht deine eigenen Trainings, die öffentlichen Trainings der Community oder den " +
    "Trainingsbestand eines deiner Teams — " +
    "dieselbe Suche wie die Trainings-Übersicht in KiFu: ohne Suchtext das zuletzt " +
    "Geänderte zuerst, mit Suchtext kürzere Namen zuerst. Eingrenzen nach " +
    "Alterskategorie (ODER). «uebungszahl» und «dauer_min» beziehen sich wie die Kachel der " +
    "Übersicht auf die erste Variante; «varianten_zahl» sagt, wie viele es gibt. " +
    "Team-Trainings erscheinen nur mit «bestand: team»; dort trägt jeder Treffer seinen " +
    "Termin («termin», null ohne) — «eigen» ist bei ihnen immer false, bearbeiten darf sie " +
    "jedes Mitglied. Das ganze Training liefert «training_abrufen», " +
    `übernehmen lässt es sich mit «training_kopieren». ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: SuchenEingabe,
  ausgabe: z.object({ treffer: z.array(SuchenTreffer), weitere: z.boolean() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await trainingsSuchenImKern(zugang.supabase, zugang.userId, {
        bestand: e.bestand,
        teamId: e.team_id,
        q: e.q,
        kategorien: e.kategorien,
        limit: e.limit,
      }),
      (w) => ({
        treffer: w.treffer.map((t) => ({
          id: t.id,
          name: t.name,
          // Editor, wo bearbeitet werden darf: eigene und Team-Trainings.
          url:
            t.istEigen || e.bestand === "team"
              ? zugang.url("training", t.id, "edit")
              : zugang.url("training", t.id),
          altersstufe: wert(altersstufeLabels, t.altersstufe),
          stufen: t.stufen.map((s) => wert(kategorieStufe, s)),
          sichtbarkeit: sichtbarkeitVon(t.visibility),
          eigen: t.istEigen,
          uebungszahl: t.exerciseCount,
          dauer_min: t.hasAnyDuration ? t.totalDuration : null,
          varianten_zahl: t.variantenZahl,
          urheber: t.urheber,
          geaendert_am: t.updatedAt,
          ...(t.termin !== undefined ? { termin: t.termin } : {}),
        })),
        weitere: w.weitere,
      }),
    ),
});
