import "server-only";
import { z } from "zod";
import { kategorieStufe } from "@/lib/labels";
import { abgebildet } from "@/lib/kern/ergebnis";
import { meineTeams, teamPlan } from "@/lib/kern/team";
import { aendereTermin, entferneTermin, setzeAn, setzeErneutAn } from "@/lib/kern/termine";
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
 * Teams und Termine (Story #198).
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
  "Termine gibt es nur an Team-Trainings, und ein Training trägt höchstens einen. Eine weitere " +
  "Einheit desselben Trainings plant «training_erneut_ansetzen»: Es entsteht eine eigenständige " +
  "Kopie im selben Team mit eigenem Termin — so bleibt jede Einheit bei dem Stand, mit dem sie " +
  "gehalten wurde. Serientermine, Absagen und «hat stattgefunden» kennt KiFu nicht.";

const DATUM = z.string().describe("Datum der Einheit als JJJJ-MM-TT, etwa 2026-10-07.");
const BEGINN = z.string().describe("Beginn als HH:MM (24 Stunden), etwa 18:30.");
const ORT = z.string().describe("Ort, frei formuliert, etwa «Sportplatz Allmend, Feld 2».");
const BEMERKUNG = z.string().describe("Bemerkung zur Einheit, frei formuliert.");

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
  /** Kennung des Termins — für «termin_aendern» und «termin_entfernen». */
  id: z.string(),
  datum: z.string(),
  beginn: z.string().nullable(),
  ort: z.string().nullable(),
  bemerkung: z.string().nullable(),
  training: z.object({ id: z.string(), name: z.string(), stufen: z.array(Wert), url: z.string() }),
});

function planEintrag(t: TerminZeile, zugang: Zugang) {
  return {
    id: t.id,
    datum: t.datum,
    beginn: t.beginn,
    ort: t.ort,
    bemerkung: t.bemerkung,
    training: {
      id: t.training.id,
      name: t.training.name,
      stufen: t.training.stufen.map((s) => wert(kategorieStufe, s)),
      url: zugang.url("training", t.training.id, "edit"),
    },
  };
}

export const teamPlanAbrufen = werkzeug({
  name: "team_plan_abrufen",
  titel: "Trainingsplan eines Teams",
  beschreibung:
    "Liefert den Trainingsplan eines deiner Teams, bereits geteilt wie im Team-Bereich: " +
    "«kommend» (ab heute, aufsteigend; der heutige Tag zählt ganz dazu) und «vergangen» (die " +
    "jüngste Einheit zuerst). «heute» ist der Tag, an dem geteilt wurde — gemessen am " +
    "Trainingsort (Schweiz), nicht in deiner Zeitzone; rechne nicht selbst. Jeder Eintrag " +
    "nennt Datum, Beginn, Ort, Bemerkung und das angesetzte Training. Team-Trainings ohne " +
    "Termin stehen nicht im Plan — die nennt «trainings_suchen» (bestand: team). " +
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

// ── termin_ansetzen ─────────────────────────────────────────────────────────

const AnsetzenEingabe = z.object({
  training_id: TrainingId,
  datum: DATUM,
  beginn: BEGINN.optional(),
  ort: ORT.optional(),
  bemerkung: BEMERKUNG.optional(),
});

export const terminAnsetzen = werkzeug({
  name: "termin_ansetzen",
  titel: "Team-Training ansetzen",
  beschreibung:
    "Setzt ein Team-Training auf ein Datum an, optional mit Beginn, Ort und Bemerkung. Es " +
    "erscheint danach im Trainingsplan des Teams. Trägt das Training schon einen Termin, wird " +
    "abgewiesen — dann «training_erneut_ansetzen». Ein persönliches Training lässt sich nicht " +
    "ansetzen; stelle es zuerst mit «training_kopieren» (mit «team_id») ins Team. " +
    `${TERMIN_MODELL} ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: AnsetzenEingabe,
  ausgabe: z.object({ termin_id: z.string(), training_id: z.string(), team_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeAn(zugang.supabase, zugang.userId, {
        trainingId: e.training_id,
        datum: e.datum,
        beginn: e.beginn,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ termin_id: w.terminId, training_id: w.trainingId, team_id: w.teamId }),
    ),
});

// ── termin_aendern ──────────────────────────────────────────────────────────

const AendernEingabe = z.object({
  termin_id: TerminId,
  datum: DATUM.optional().describe("Neues Datum als JJJJ-MM-TT; ohne Angabe unverändert."),
  beginn: BEGINN.nullable()
    .optional()
    .describe("Neuer Beginn als HH:MM; null leert ihn, ohne Angabe unverändert."),
  ort: ORT.nullable().optional().describe("Neuer Ort; null leert ihn, ohne Angabe unverändert."),
  bemerkung: BEMERKUNG.nullable()
    .optional()
    .describe("Neue Bemerkung; null leert sie, ohne Angabe unverändert."),
});

export const terminAendern = werkzeug({
  name: "termin_aendern",
  titel: "Termin ändern",
  beschreibung:
    "Ändert Datum, Beginn, Ort oder Bemerkung eines Termins — nur die Felder, die du " +
    "mitgibst; «null» leert Beginn, Ort oder Bemerkung. Das Datum lässt sich ändern, aber " +
    "nicht leeren. Das angesetzte Training bleibt dasselbe. " +
    TERMIN_KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: AendernEingabe,
  ausgabe: z.object({ training_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await aendereTermin(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        datum: e.datum,
        beginn: e.beginn,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ training_id: w.trainingId }),
    ),
});

// ── termin_entfernen ────────────────────────────────────────────────────────

export const terminEntfernen = werkzeug({
  name: "termin_entfernen",
  titel: "Termin entfernen",
  beschreibung:
    "Entfernt einen Termin sofort. Das Training bleibt im Bestand des Teams — es ist danach " +
    "nur nicht mehr angesetzt und lässt sich wieder mit «termin_ansetzen» planen. Ein bereits " +
    "entfernter Termin gilt als erledigt: kein Fehler, «training_id» ist dann null. " +
    "Ein ganzes Team-Training samt Termin löscht «training_loeschen».",
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneTermin(zugang.supabase, zugang.userId, { terminId: e.termin_id }),
      (w) => ({ training_id: w.trainingId }),
    ),
});

// ── training_erneut_ansetzen ────────────────────────────────────────────────

export const trainingErneutAnsetzen = werkzeug({
  name: "training_erneut_ansetzen",
  titel: "Team-Training erneut ansetzen",
  beschreibung:
    "Plant eine weitere Einheit eines Team-Trainings: Es entsteht eine eigenständige Kopie im " +
    "selben Team (samt Übungen, Bildern, Gruppen, Durchlauf und Varianten), und diese Kopie " +
    "bekommt den neuen Termin. Das bisherige Training behält seinen Termin unverändert. " +
    "Das Ergebnis nennt die Kennung der Kopie — spätere Anpassungen für diese Einheit gehören " +
    "an sie. Scheitert das Ansetzen, entfernt KiFu die Kopie wieder, und «hinweis» sagt, dass " +
    "nichts entstanden ist (oder welche Kopie stehen blieb). Geht auch mit einem Training, das " +
    `noch keinen Termin trägt. ${TERMIN_MODELL} ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: AnsetzenEingabe,
  ausgabe: z.object({
    /** Kennung der neuen Kopie, die den Termin trägt. */
    training_id: z.string(),
    termin_id: z.string(),
    team_id: z.string(),
    url: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeErneutAn(zugang.supabase, zugang.userId, {
        trainingId: e.training_id,
        datum: e.datum,
        beginn: e.beginn,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({
        training_id: w.trainingId,
        termin_id: w.terminId,
        team_id: w.teamId,
        url: zugang.url("training", w.trainingId, "edit"),
      }),
    ),
});
