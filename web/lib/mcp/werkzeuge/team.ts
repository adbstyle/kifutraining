import "server-only";
import { z } from "zod";
import { kategorieStufe } from "@/lib/labels";
import { abgebildet } from "@/lib/kern/ergebnis";
import { meineTeams, teamPlan } from "@/lib/kern/team";
import { aendereMitReichweite, entferneMitReichweite, folgeDerSerie, legeSerieFest } from "@/lib/kern/serien";
import { legeTerminFest, loeseTraining, ordneTrainingZu } from "@/lib/kern/termine";
import { KI_WOCHENTAG, alsKiWochentag, alsWochentag } from "@/lib/serie";
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
 * Teams und Kalender (Stories #198, #322, #323, #324, #326).
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
  "ohne Training. Einzelne Termine entstehen mit «termin_festlegen», wöchentliche Serien mit " +
  "«terminserie_festlegen»; ein Training kommt ausschliesslich durch «training_zuordnen» an einen " +
  "bestehenden Termin auf ein Datum. Ein Termin trägt höchstens " +
  "ein Training, und ein Training ist höchstens für einen Termin eingeplant — für einen weiteren " +
  "Termin entsteht eine eigenständige Kopie, oder ein Training mit anstehendem Termin wird " +
  "verschoben. Zeiten gelten am Trainingsort (Schweiz). «hat stattgefunden» kennt KiFu nicht.";

const DATUM = z.string().describe("Datum als JJJJ-MM-TT, etwa 2026-10-07.");
const UHRZEIT = z.string().describe("Uhrzeit als HH:MM (24 Stunden), etwa 18:30.");
const ORT = z.string().describe("Ort, frei formuliert, höchstens 100 Zeichen, etwa «Sportplatz Allmend, Feld 2».");
const BEMERKUNG = z.string().describe("Bemerkung, frei formuliert, höchstens 500 Zeichen.");

const Wochentage = z
  .array(z.enum(KI_WOCHENTAG))
  .min(1)
  .describe("Wochentage als «mo», «di», «mi», «do», «fr», «sa», «so».");
const Reichweite = z
  .enum(["nur_dieser", "dieser_und_folgende", "alle"])
  .describe(
    "Für Termine einer Serie Pflicht: «nur_dieser», «dieser_und_folgende» (teilt die Serie am " +
      "gewählten Termin) oder «alle» (ganze Serie, vergangene Termine eingeschlossen).",
  );
const Bestaetigt = z
  .boolean()
  .optional()
  .describe("Nur nötig, wenn «dieser_und_folgende» oder «alle» vergangene Termine erfasst oder entfallen lässt.");

/** Was jede Beschreibung eines Serien-Werkzeugs über das Modell sagt. */
const SERIEN_MODELL =
  "Eine Terminserie läuft wöchentlich an einem oder mehreren Wochentagen zwischen Beginn- und " +
  "Enddatum (höchstens bis zum gleichen Kalendertag im Folgejahr) und legt ihre Termine als " +
  "einzelne Termine an. Ein Termin einer Serie kann je Angabe abweichen (Datum, Zeit, Ort, " +
  "Bemerkung) und behält die Abweichung bei späteren Serienänderungen; das Datum gilt immer, wie " +
  "es ist. Einzeln entfernte Termine legt keine Serienänderung wieder an.";

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
  /** `null`: ein einzelner Termin ohne Serie (#324). */
  serie_id: z.string().nullable(),
  /** Die Angaben, in denen der Termin von seiner Serie abweicht; leer ohne Serie. */
  abweichungen: z.array(z.enum(["datum", "zeit", "ort", "bemerkung"])),
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
    serie_id: t.serie?.id ?? null,
    abweichungen: t.abweichungen,
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

const PlanSerie = z.object({
  id: z.string(),
  wochentage: z.array(z.enum(KI_WOCHENTAG)),
  von: z.string(),
  bis: z.string(),
  beginn: z.string(),
  ende: z.string(),
  ort: z.string().nullable(),
  bemerkung: z.string().nullable(),
});

/** Die Serien der Einträge, eindeutig je Kennung. */
function planSerien(termine: TerminZeile[]) {
  const nachId = new Map<string, z.infer<typeof PlanSerie>>();
  for (const t of termine)
    if (t.serie && !nachId.has(t.serie.id))
      nachId.set(t.serie.id, {
        id: t.serie.id,
        wochentage: t.serie.wochentage.map(alsKiWochentag),
        von: t.serie.beginnDatum,
        bis: t.serie.endDatum,
        beginn: t.serie.beginn,
        ende: t.serie.ende,
        ort: t.serie.ort,
        bemerkung: t.serie.bemerkung,
      });
  return [...nachId.values()];
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
    "Ende sein. Termine einer Serie tragen «serie_id»; «serien» nennt Wochentage, Zeitraum, Zeit, " +
    "Ort und Bemerkung jeder Serie, «abweichungen» die Angaben, in denen ein Termin von ihr " +
    "abweicht. Team-Trainings ohne Termin nennt «trainings_suchen» (bestand: team). " +
    TEAM_KENNUNG_FEHLER,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    heute: z.string(),
    serien: z.array(PlanSerie),
    kommend: z.array(PlanEintrag),
    vergangen: z.array(PlanEintrag),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await teamPlan(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team: w.team,
      heute: w.heute,
      serien: planSerien([...w.kommend, ...w.vergangen]),
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
      "Beginn und Ende lassen sich nicht leeren; «null» bei einem Termin mit Zeit wird abgewiesen.",
  ),
  ende: UHRZEIT.nullable().optional().describe(
    "Neues Ende als HH:MM am selben Tag; ohne Angabe unverändert. Beginn und Ende lassen sich nicht " +
      "leeren; «null» bei einem Termin mit Zeit wird abgewiesen.",
  ),
  ort: ORT.nullable().optional().describe("Neuer Ort; null leert ihn, ohne Angabe unverändert."),
  bemerkung: BEMERKUNG.nullable().optional().describe("Neue Bemerkung; null leert sie, ohne Angabe unverändert."),
  reichweite: Reichweite.optional(),
  wochentage: Wochentage.optional().describe("Neue Wochentage der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  von: DATUM.optional().describe(
    "Neues Beginndatum der Serie (nur mit «dieser_und_folgende» oder «alle»; bei «dieser_und_folgende» frühestens am gewählten Termin).",
  ),
  bis: DATUM.optional().describe("Neues Enddatum der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  bestaetigt: Bestaetigt,
});

const EntfallenMitTraining = z.array(
  z.object({ termin_id: z.string(), datum: z.string(), training: z.object({ id: z.string(), name: z.string() }) }),
);

type Folge = { entfallend: { terminId: string; datum: string; training: { id: string; name: string } }[] } | null;

/** Die entfallenen Termine mit Training — ihre Trainings bleiben im Bestand. */
const entfallenMitTraining = (serie: Folge) =>
  (serie?.entfallend ?? []).map((x) => ({ termin_id: x.terminId, datum: x.datum, training: x.training }));

export const terminAendern = werkzeug({
  name: "termin_aendern",
  titel: "Termin ändern",
  beschreibung:
    "Ändert Datum, Zeit, Ort oder Bemerkung eines Termins — nur, was du mitgibst. Beginn und Ende " +
    "lassen sich nicht leeren; ändert sich die Zeit, braucht der Termin danach beide. Ein " +
    "übernommener Termin ohne vollständige Zeit lässt sich ändern, ohne die Zeit zu ergänzen. Das " +
    "zugeordnete Training bleibt dasselbe. Für einen Termin einer Serie ist «reichweite» Pflicht; " +
    "das Datum ändert nur «nur_dieser», Wochentage und Zeitraum nur «dieser_und_folgende» oder " +
    "«alle». Das Ergebnis nennt entfallene Termine mit Training; ihre Trainings bleiben im Bestand " +
    `des Teams. ${SERIEN_MODELL} ${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: AendernEingabe,
  ausgabe: z.object({
    termin_id: z.string(),
    serie_id: z.string().nullable().describe("Bei «dieser_und_folgende» die neue Teilserie."),
    entfallen_mit_training: EntfallenMitTraining,
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await aendereMitReichweite(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        datum: e.datum,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
        reichweite: e.reichweite,
        wochentage: e.wochentage?.map(alsWochentag),
        von: e.von,
        bis: e.bis,
        bestaetigt: e.bestaetigt,
      }),
      (w) => ({
        termin_id: w.terminId,
        serie_id: w.serie?.serieId ?? null,
        entfallen_mit_training: entfallenMitTraining(w.serie),
      }),
    ),
});

// ── termin_entfernen ────────────────────────────────────────────────────────

export const terminEntfernen = werkzeug({
  name: "termin_entfernen",
  titel: "Termin entfernen",
  beschreibung:
    "Entfernt einen Termin. Sein Training bleibt im Bestand des Teams " +
    "— «training_id» nennt es — und lässt sich mit «training_zuordnen» einem anderen Termin " +
    "zuordnen. Ein ganzes Team-Training löscht «training_loeschen»; sein Termin bleibt dann ohne " +
    "Training bestehen. Für einen Termin einer Serie ist «reichweite» Pflicht; bei " +
    "«dieser_und_folgende» oder «alle» nennt das Ergebnis die entfallenen Termine mit Training — " +
    "ihre Trainings bleiben im Bestand des Teams. Erfasst «dieser_und_folgende» oder «alle» " +
    "auch vergangene Termine, wird die Serie nur mit «bestaetigt: true» entfernt; ohne diese " +
    "Bestätigung nennt das Ergebnis, was entfiele. Ein einzelner Termin oder «nur_dieser» wird " +
    "sofort entfernt. " +
    `${SERIEN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, reichweite: Reichweite.optional(), bestaetigt: Bestaetigt }),
  ausgabe: z.object({ training_id: z.string().nullable(), entfallen_mit_training: EntfallenMitTraining }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneMitReichweite(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        reichweite: e.reichweite,
        bestaetigt: e.bestaetigt,
      }),
      (w) => ({ training_id: w.trainingId, entfallen_mit_training: entfallenMitTraining(w.serie) }),
    ),
});

// ── terminserie_festlegen ───────────────────────────────────────────────────

export const terminserieFestlegen = werkzeug({
  name: "terminserie_festlegen",
  titel: "Terminserie festlegen",
  beschreibung:
    "Legt für eines deiner Teams eine wöchentliche Terminserie fest: je gewähltem Wochentag " +
    "zwischen «von» und «bis» (beide eingeschlossen) einen Termin ohne Training mit Beginn, Ende, " +
    "Ort und Bemerkung der Serie — auch ganz oder teilweise in der Vergangenheit. Bestehende " +
    "Termine an denselben Tagen bleiben daneben stehen. " +
    `${SERIEN_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    wochentage: Wochentage,
    von: DATUM.describe("Beginndatum als JJJJ-MM-TT."),
    bis: DATUM.describe("Enddatum als JJJJ-MM-TT, spätestens am gleichen Kalendertag im Folgejahr."),
    beginn: UHRZEIT,
    ende: UHRZEIT,
    ort: ORT.optional(),
    bemerkung: BEMERKUNG.optional(),
  }),
  ausgabe: z.object({ serie_id: z.string(), termine: z.number().int() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeSerieFest(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        wochentage: e.wochentage.map(alsWochentag),
        von: e.von,
        bis: e.bis,
        beginn: e.beginn,
        ende: e.ende,
        ort: e.ort,
        bemerkung: e.bemerkung,
      }),
      (w) => ({ serie_id: w.serieId, termine: w.termine }),
    ),
});

// ── termin_der_serie_folgen ─────────────────────────────────────────────────

export const terminDerSerieFolgen = werkzeug({
  name: "termin_der_serie_folgen",
  titel: "Termin wieder der Serie folgen lassen",
  beschreibung:
    "Lässt abweichende Angaben eines Serientermins wieder seiner Serie folgen: Zeit, Ort oder " +
    "Bemerkung übernehmen die Werte der Serie und folgen ihr bei künftigen Änderungen. Das Datum " +
    `lässt sich nicht zurücksetzen («datum» wird abgewiesen). ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, angaben: z.array(z.enum(["zeit", "ort", "bemerkung", "datum"])).min(1) }),
  ausgabe: z.object({ termin_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await folgeDerSerie(zugang.supabase, zugang.userId, { terminId: e.termin_id, angaben: e.angaben }), (w) => ({
      termin_id: w.terminId,
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
