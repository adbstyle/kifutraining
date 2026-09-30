import "server-only";
import { z } from "zod";
import { kategorieStufe } from "@/lib/labels";
import { abgebildet } from "@/lib/kern/ergebnis";
import { meineTeams, teamPlan } from "@/lib/kern/team";
import { aendereTermin, entferneTermin, legeTerminFest, loeseTraining, ordneTrainingZu } from "@/lib/kern/termine";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { Wert, wert } from "@/lib/mcp/bausteine";
import {
  KENNUNG_FEHLER,
  TEAM_KENNUNG_FEHLER,
  TERMIN_KENNUNG_FEHLER,
  TeamId,
  TerminId,
  TrainingId,
} from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug, type Zugang } from "@/lib/mcp/werkzeug";

/**
 * Teams und Kalender (Stories #198, #322, #323).
 *
 * Dünne Adapter über den Fachkern (lib/kern/team.ts, lib/kern/termine.ts) —
 * dieselben Funktionen wie Team-Übersicht, Trainingsplan und Termin-Dialog
 * im Team-Bereich. Team-Trainings anlegen, ins Team stellen und zu sich
 * übernehmen gehen über «training_anlegen» und «training_kopieren» mit
 * «team_id»; bearbeitet werden sie mit denselben Werkzeugen wie persönliche.
 *
 * Datum und Uhrzeit sind hier nur Zeichenketten: Das Format — und ob es den
 * Tag gibt — prüft der Kern (`terminProblem`, lib/termin.ts) und benennt es
 * wortgleich mit der Oberfläche.
 */

/** Was jede Beschreibung eines Termin-Werkzeugs über das Modell sagt. */
const TERMIN_MODELL =
  "Der Kalender eines Teams besteht aus Terminen: Datum, Beginn, Ende, Ort und Bemerkung, mit oder " +
  "ohne Training. Termine entstehen nur mit «termin_festlegen»; ein Training kommt ausschliesslich " +
  "durch «training_zuordnen» an einen bestehenden Termin auf ein Datum. Ein Termin trägt höchstens " +
  "ein Training, und ein Training ist höchstens für einen Termin eingeplant — für einen weiteren " +
  "Termin entsteht eine eigenständige Kopie, oder ein Training mit anstehendem Termin wird " +
  "verschoben. Zeiten gelten am Trainingsort (Schweiz). «hat stattgefunden» kennt KiFu nicht.";

const DATUM = z.string().describe("Datum als JJJJ-MM-TT, etwa 2026-10-07.");
const UHRZEIT = z.string().describe("Uhrzeit als HH:MM (24 Stunden), etwa 18:30.");
const ORT = z.string().describe("Ort, frei formuliert, höchstens 100 Zeichen, etwa «Sportplatz Allmend, Feld 2».");
const BEMERKUNG = z.string().describe("Bemerkung, frei formuliert, höchstens 500 Zeichen.");

// ── teams_abrufen ───────────────────────────────────────────────────────────

export const teamsAbrufen = werkzeug({
  name: "teams_abrufen",
  titel: "Meine Teams",
  beschreibung:
    "Nennt die Teams, in denen du Mitglied bist, alphabetisch mit Name und Zahl der " +
    "Mitglieder. Die «id» ist die Kennung für «team_plan_abrufen», «trainings_suchen» " +
    "(bestand: team) und für «team_id» in «training_anlegen» und «training_kopieren». Teams " +
    "gründen, umbenennen, auflösen oder Mitglieder verwalten lässt sich über den KI-Client " +
    "nicht — das geht nur im Team-Bereich von KiFu.",
  nurLesen: true,
  eingabe: z.object({}),
  ausgabe: z.object({
    teams: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        mitglieder: z.number().int(),
        /** Der Team-Bereich in KiFu. */
        url: z.string(),
      }),
    ),
  }),
  ausfuehren: async (_e, zugang) =>
    abgebildet(await meineTeams(zugang.supabase, zugang.userId), (w) => ({
      teams: w.teams.map((t) => ({ ...t, url: zugang.url("team", t.id) })),
    })),
});

// ── team_plan_abrufen ───────────────────────────────────────────────────────

const PlanEintrag = z.object({
  /** Kennung des Termins — für «termin_aendern», «termin_entfernen», «training_zuordnen» und «training_loesen». */
  id: z.string(),
  datum: z.string(),
  beginn: z.string().nullable(),
  ende: z.string().nullable(),
  ort: z.string().nullable(),
  bemerkung: z.string().nullable(),
  /** `null`: Der Termin trägt kein Training (#322 AK 20). */
  training: z.object({ id: z.string(), name: z.string(), stufen: z.array(Wert), url: z.string() }).nullable(),
});

function planEintrag(t: TerminZeile, zugang: Zugang) {
  return {
    id: t.id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: t.training
      ? {
          id: t.training.id,
          name: t.training.name,
          stufen: t.training.stufen.map((s) => wert(kategorieStufe, s)),
          url: zugang.url("training", t.training.id, "edit"),
        }
      : null,
  };
}

export const teamPlanAbrufen = werkzeug({
  name: "team_plan_abrufen",
  titel: "Kalender eines Teams",
  beschreibung:
    "Liefert den Kalender eines deiner Teams, bereits geteilt wie im Team-Bereich: «kommend» (ab " +
    "heute, aufsteigend; der heutige Tag zählt ganz dazu) und «vergangen» (der jüngste zuerst). " +
    "«heute» ist der Tag, an dem geteilt wurde — gemessen am Trainingsort (Schweiz), nicht in deiner " +
    "Zeitzone; rechne nicht selbst. Jeder Eintrag nennt Datum, Beginn, Ende, Ort, Bemerkung und das " +
    "zugeordnete Training; «training: null» heisst, der Termin trägt noch keins. Ein anstehender " +
    "Termin ohne Training ist noch nicht vorbereitet. Übernommene Termine können ohne Beginn oder " +
    "Ende sein. Team-Trainings ohne Termin nennt «trainings_suchen» (bestand: team). " +
    TEAM_KENNUNG_FEHLER,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    heute: z.string(),
    kommend: z.array(PlanEintrag),
    vergangen: z.array(PlanEintrag),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await teamPlan(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team: w.team,
      heute: w.heute,
      kommend: w.kommend.map((t) => planEintrag(t, zugang)),
      vergangen: w.vergangen.map((t) => planEintrag(t, zugang)),
    })),
});

// ── termin_festlegen ────────────────────────────────────────────────────────

export const terminFestlegen = werkzeug({
  name: "termin_festlegen",
  titel: "Termin festlegen",
  beschreibung:
    "Legt im Kalender eines deiner Teams einen einzelnen Termin ohne Training fest — auch in der " +
    "Vergangenheit. Datum, Beginn und Ende sind Pflicht, das Ende liegt am selben Tag nach dem " +
    "Beginn; Ort und Bemerkung sind frei. Ein Training ordnest du danach mit «training_zuordnen» zu. " +
    `${TERMIN_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    datum: DATUM,
    beginn: UHRZEIT.describe("Beginn als HH:MM, etwa 18:30."),
    ende: UHRZEIT.describe("Ende als HH:MM am selben Tag, etwa 20:00."),
    ort: ORT.optional(),
    bemerkung: BEMERKUNG.optional(),
  }),
  ausgabe: z.object({ termin_id: z.string(), team_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeTerminFest(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        datum: e.datum,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ termin_id: w.terminId, team_id: w.teamId }),
    ),
});

// ── termin_aendern ──────────────────────────────────────────────────────────

export const AendernEingabe = z.object({
  termin_id: TerminId,
  datum: DATUM.optional().describe("Neues Datum als JJJJ-MM-TT; ohne Angabe unverändert."),
  // `nullable`, damit ein `null` beim Kern ankommt und dort mit «Bitte Beginn
  // und Ende angeben.» abgewiesen wird, statt schon an der Eingabeprüfung
  // mit einem Typfehler zu scheitern (#322 AK 21).
  beginn: UHRZEIT.nullable().optional().describe(
    "Neuer Beginn als HH:MM; ohne Angabe unverändert. Wer die Zeit ändert, gibt Beginn UND Ende an. " +
      "null wird abgewiesen: Beginn und Ende lassen sich nicht leeren.",
  ),
  ende: UHRZEIT.nullable().optional().describe(
    "Neues Ende als HH:MM am selben Tag; ohne Angabe unverändert. null wird abgewiesen: Beginn " +
      "und Ende lassen sich nicht leeren.",
  ),
  ort: ORT.nullable().optional().describe("Neuer Ort; null leert ihn, ohne Angabe unverändert."),
  bemerkung: BEMERKUNG.nullable().optional().describe("Neue Bemerkung; null leert sie, ohne Angabe unverändert."),
});

export const terminAendern = werkzeug({
  name: "termin_aendern",
  titel: "Termin ändern",
  beschreibung:
    "Ändert Datum, Zeit, Ort oder Bemerkung eines Termins — nur, was du mitgibst. Beginn und Ende " +
    "lassen sich nicht leeren; ändert sich die Zeit, braucht der Termin danach beide. Ein " +
    "übernommener Termin ohne vollständige Zeit lässt sich ändern, ohne die Zeit zu ergänzen. Das " +
    "zugeordnete Training bleibt dasselbe. " +
    `${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: AendernEingabe,
  ausgabe: z.object({ termin_id: z.string(), training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await aendereTermin(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        datum: e.datum,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ termin_id: w.terminId, training_id: w.trainingId }),
    ),
});

// ── termin_entfernen ────────────────────────────────────────────────────────

export const terminEntfernen = werkzeug({
  name: "termin_entfernen",
  titel: "Termin entfernen",
  beschreibung:
    "Entfernt einen Termin sofort und ohne Rückfrage. Sein Training bleibt im Bestand des Teams " +
    "— «training_id» nennt es — und lässt sich mit «training_zuordnen» einem anderen Termin " +
    "zuordnen. Ein ganzes Team-Training löscht «training_loeschen»; sein Termin bleibt dann ohne " +
    `Training bestehen. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await entferneTermin(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      training_id: w.trainingId,
    })),
});

// ── training_zuordnen ───────────────────────────────────────────────────────

export const trainingZuordnen = werkzeug({
  name: "training_zuordnen",
  titel: "Training einem Termin zuordnen",
  beschreibung:
    "Ordnet einem Termin ein Training aus dem Bestand desselben Teams zu; trägt der Termin schon " +
    "eins, bleibt jenes ohne Termin im Bestand («im_bestand_geblieben»). Ist das Training bereits " +
    "für einen ANSTEHENDEN Termin eingeplant, musst du «art» wählen: «kopie» legt eine " +
    "eigenständige, gleichnamige Kopie für diesen Termin an, «verschieben» nimmt es vom bisherigen " +
    "Termin weg («frei_gewordener_termin»). Ist sein Termin VERGANGEN, entsteht immer eine Kopie; " +
    "«verschieben» wird dann abgewiesen. Scheitert die Zuordnung einer Kopie, entfernt KiFu die " +
    `Kopie wieder; «hinweis» sagt, ob etwas stehen blieb. ${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER} ` +
    KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    training_id: TrainingId,
    art: z
      .enum(["kopie", "verschieben"])
      .optional()
      .describe("Nur für ein Training, das schon einem anderen Termin gehört."),
  }),
  ausgabe: z.object({
    termin_id: z.string(),
    training_id: z.string().describe("Das Training, das jetzt am Termin steht — bei einer Kopie die Kopie."),
    kopie: z.boolean(),
    im_bestand_geblieben: z.string().nullable(),
    frei_gewordener_termin: z.string().nullable(),
    url: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await ordneTrainingZu(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        trainingId: e.training_id,
        art: e.art,
      }),
      (w) => ({
        termin_id: w.terminId,
        training_id: w.trainingId,
        kopie: w.kopie,
        im_bestand_geblieben: w.imBestand,
        frei_gewordener_termin: w.freierTermin,
        url: zugang.url("training", w.trainingId, "edit"),
      }),
    ),
});

// ── training_loesen ─────────────────────────────────────────────────────────

export const trainingLoesen = werkzeug({
  name: "training_loesen",
  titel: "Training vom Termin lösen",
  beschreibung:
    "Löst das Training von seinem Termin: Der Termin bleibt ohne Training im Kalender, das " +
    `Training ohne Termin im Bestand des Teams. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await loeseTraining(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      training_id: w.trainingId,
    })),
});
