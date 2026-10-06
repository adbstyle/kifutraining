import "server-only";
import { z } from "zod";
import { kategorieStufe } from "@/lib/labels";
import { abgebildet } from "@/lib/kern/ergebnis";
import { meineTeams, teamPlan } from "@/lib/kern/team";
import { setzeVerantwortliche, teamMitglieder } from "@/lib/kern/verantwortliche";
import { aendereMitReichweite, entferneMitReichweite, folgeDerSerie, legeSerieFest } from "@/lib/kern/serien";
import { lasseAusfallen, legeTerminFest, loeseTraining, nimmAusfallZurueck, ordneTrainingZu, type Verlassen } from "@/lib/kern/termine";
import { KI_WOCHENTAG, alsKiWochentag, alsWochentag } from "@/lib/serie";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { Wert, kennung, wert } from "@/lib/mcp/bausteine";
import {
  FELDER_MODELL,
  FelderEingabe,
  SPIELERZAHL_MODELL,
  SpielerzahlEingabe,
  felderAusgabe,
  felderSchema,
  spielerzahlSchema,
} from "@/lib/termin-felder-ausgabe";
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
 * Teams und Kalender (Stories #198, #322, #323, #324, #326; Felder #389,
 * erwartete Spielerzahl #390, beide an der Serie #391).
 *
 * Dünne Adapter über den Fachkern (lib/kern/team.ts, lib/kern/termine.ts) —
 * dieselben Funktionen wie Team-Übersicht, Trainingsplan und Termin-Dialog
 * im Team-Bereich. Team-Trainings anlegen, ins Team stellen und zu sich
 * übernehmen gehen über «training_anlegen» und «training_kopieren» mit
 * «team_id»; bearbeitet werden sie mit denselben Werkzeugen wie persönliche.
 *
 * Verantwortliche (#325) sind Mitglieder des Teams; ihre Kennungen nennt
 * «team_mitglieder_abrufen» — ohne E-Mail-Adresse, nur mit Anzeigename.
 *
 * Datum und Uhrzeit sind hier nur Zeichenketten: Das Format — und ob es den
 * Tag gibt — prüft der Kern (`terminProblem`, lib/termin.ts) und benennt es
 * wortgleich mit der Oberfläche.
 */

/** Was jede Beschreibung eines Termin-Werkzeugs über das Modell sagt. */
const TERMIN_MODELL =
  "Der Kalender eines Teams besteht aus Terminen: Datum, Beginn, Ende, Ort, Bemerkung, die Felder " +
  "des Platzes und die erwartete Spielerzahl, mit oder ohne Training. Einzelne Termine entstehen mit «termin_festlegen», wöchentliche Serien mit " +
  "«terminserie_festlegen»; ein Training kommt ausschliesslich durch «training_zuordnen» an einen " +
  "bestehenden Termin auf ein Datum. Ein Termin trägt höchstens " +
  "ein Training: immer eine eigene Kopie, ein Termin-Training. Es gehört dem Team, steht aber nicht " +
  "im Bestand und lebt mit seinem Termin - verliert es ihn (lösen, ersetzen, Termin entfernen, " +
  "Serienänderung), wird es gelöscht. Ältere Trainings aus dem Bestand, die einem Termin zugeordnet " +
  "sind, bleiben dabei im Bestand. Zeiten gelten am Trainingsort (Schweiz). Ein Termin kann ausfallen " +
  "(mit freiwilligem Grund); sein Training ruht dann am Termin. Ein ausgefallener nimmt kein neues " +
  "Training an und findet wieder statt, wenn er einzeln auf heute oder später verlegt wird; " +
  "«hat stattgefunden» kennt KiFu nicht. Felder und Spielerzahl " +
  "sind Angaben für deine Planung; KiFu prüft nicht, ob ein Training auf sie passt - das beurteilst du.";

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
  "Bemerkung, Verantwortliche, Felder, erwartete Spielerzahl) und behält die Abweichung bei späteren Serienänderungen; " +
  "das Datum gilt immer, wie es ist. Die Felder sind eine Angabe (die ganze Liste), die Spielerzahl eine zweite. " +
  "Wer an nur einem Serientermin Felder oder Spielerzahl entfernt, macht ihn bewusst leer: Er weicht ab und gilt " +
  "als unbekannt, bis er wieder der Serie folgt. Einzeln entfernte Termine legt keine Serienänderung wieder an.";

// ── teams_abrufen ───────────────────────────────────────────────────────────

export const teamsAbrufen = werkzeug({
  name: "teams_abrufen",
  titel: "Meine Teams",
  beschreibung:
    "Nennt die Teams, in denen du Mitglied bist, alphabetisch mit Name und Zahl der " +
    "Mitglieder. Die «id» ist die Kennung für «team_plan_abrufen», «trainings_suchen» " +
    "(bestand: team) und für «team_id» in «training_anlegen» und «training_kopieren». Teams " +
    "gründen, umbenennen, auflösen oder Mitglieder verwalten lässt sich über den KI-Client " +
    "nicht - das geht nur im Team-Bereich von KiFu.",
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

const Verantwortlich = z.object({
  id: z.string().nullable().describe("Kennung des Mitglieds; null bei einem gelöschten Konto."),
  anzeigename: z.string().nullable(),
  ehemalig: z.boolean().describe("Nicht mehr im Team."),
});

const PlanEintrag = z.object({
  /** Kennung des Termins — für «termin_aendern», «termin_entfernen», «training_zuordnen» und «training_loesen». */
  id: z.string(),
  datum: z.string(),
  beginn: z.string(),
  ende: z.string(),
  ort: z.string().nullable(),
  bemerkung: z.string().nullable(),
  /** Die Felder des Platzes (#389); `null` = unbekannt. */
  felder: felderSchema(),
  /** Die erwartete Spielerzahl (#390); `null` = unbekannt. */
  erwartete_spielerzahl: spielerzahlSchema(),
  /** `null`: ein einzelner Termin ohne Serie (#324). */
  serie_id: z.string().nullable(),
  /** Die Angaben, in denen der Termin von seiner Serie abweicht; leer ohne Serie. */
  abweichungen: z.array(z.enum(["datum", "zeit", "ort", "bemerkung", "verantwortliche", "felder", "spielerzahl"])),
  /** Wer den Termin vorbereitet und leitet (#325); leer ohne Eintrag. */
  verantwortliche: z.array(Verantwortlich),
  /** Ein ausgefallener Termin trägt kein Training und gilt nicht als unvorbereitet (#327). */
  ausgefallen: z.boolean(),
  /** Freiwilliger Grund des Ausfalls; `null` ohne Angabe und bei einem Termin, der stattfindet. */
  ausfall_grund: z.string().nullable(),
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
    felder: felderAusgabe(t.felder),
    erwartete_spielerzahl: t.spielerzahl,
    serie_id: t.serie?.id ?? null,
    abweichungen: t.abweichungen,
    verantwortliche: t.verantwortliche.map((v) => ({ id: v.userId, anzeigename: v.name, ehemalig: v.ehemalig })),
    ausgefallen: t.ausgefallen,
    ausfall_grund: t.ausfallGrund,
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
  /** Wer die Serie vorgibt (#325). */
  verantwortliche: z.array(z.object({ id: z.string(), anzeigename: z.string() })),
  /** Felder und erwartete Spielerzahl, die die Serie vorgibt (#391 AK 9). */
  felder: felderSchema(),
  erwartete_spielerzahl: spielerzahlSchema(),
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
        verantwortliche: t.serie.verantwortliche.map((v) => ({ id: v.userId, anzeigename: v.name })),
        felder: felderAusgabe(t.serie.felder),
        erwartete_spielerzahl: t.serie.spielerzahl,
      });
  return [...nachId.values()];
}

export const teamPlanAbrufen = werkzeug({
  name: "team_plan_abrufen",
  titel: "Kalender eines Teams",
  beschreibung:
    "Liefert den Kalender eines deiner Teams, bereits geteilt wie im Team-Bereich: «kommend» (ab " +
    "heute, aufsteigend; der heutige Tag zählt ganz dazu) und «vergangen» (der jüngste zuerst). " +
    "«heute» ist der Tag, an dem geteilt wurde - gemessen am Trainingsort (Schweiz), nicht in deiner " +
    "Zeitzone; rechne nicht selbst. Jeder Eintrag nennt Datum, Beginn, Ende, Ort, Bemerkung, die Felder " +
    "des Platzes, die erwartete Spielerzahl und das zugeordnete Training; «training: null» heisst, der Termin trägt noch keins. Ein anstehender " +
    "Termin ohne Training, der nicht ausgefallen ist, ist noch nicht vorbereitet. Termine einer Serie tragen «serie_id»; «serien» nennt Wochentage, Zeitraum, Zeit, " +
    "Ort, Bemerkung, Verantwortliche, Felder und erwartete Spielerzahl jeder Serie, «abweichungen» die Angaben, in denen ein Termin " +
    "von ihr abweicht. Jeder Eintrag nennt seine Verantwortlichen; «nur_meine» grenzt auf deine ein. " +
    "Ausgefallene Termine stehen mit «ausgefallen: true» und Grund im Plan. " +
    "Mit «von» und «bis» (beide eingeschlossen, höchstens bis zum gleichen Kalendertag im Folgejahr) " +
    "nur die Termine dieses Zeitraums, nach denselben Regeln für kommend und vergangen; ohne Termine eine leere Auskunft. " +
    "Den Bestand des Teams (ohne Termin-Trainings) nennt «trainings_suchen» (bestand: team). " +
    TEAM_KENNUNG_FEHLER,
  nurLesen: true,
  eingabe: z.object({
    team_id: TeamId,
    nur_meine: z.boolean().optional().describe("Nur Termine, für die du verantwortlich bist."),
    von: DATUM.optional().describe("Erster Tag des Zeitraums (eingeschlossen); nur zusammen mit «bis»."),
    bis: DATUM.optional().describe("Letzter Tag des Zeitraums (eingeschlossen); nur zusammen mit «von»."),
  }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    heute: z.string(),
    serien: z.array(PlanSerie),
    kommend: z.array(PlanEintrag),
    vergangen: z.array(PlanEintrag),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await teamPlan(zugang.supabase, zugang.userId, { teamId: e.team_id, nurMeine: e.nur_meine, von: e.von, bis: e.bis }), (w) => ({
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
    "Legt im Kalender eines deiner Teams einen einzelnen Termin ohne Training fest - auch in der " +
    "Vergangenheit. Datum, Beginn und Ende sind Pflicht, das Ende liegt am selben Tag nach dem " +
    "Beginn; Ort, Bemerkung, Felder und erwartete Spielerzahl sind frei. Ein Training ordnest du danach mit «training_zuordnen» zu. " +
    `${TERMIN_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    datum: DATUM,
    beginn: UHRZEIT.describe("Beginn als HH:MM, etwa 18:30."),
    ende: UHRZEIT.describe("Ende als HH:MM am selben Tag, etwa 20:00."),
    ort: ORT.optional(),
    bemerkung: BEMERKUNG.optional(),
    felder: FelderEingabe.optional().describe(`Die Felder des Platzes; ohne Angabe ist der Platz unbekannt. ${FELDER_MODELL}`),
    erwartete_spielerzahl: SpielerzahlEingabe.optional().describe(
      `Die erwartete Spielerzahl; ohne Angabe unbekannt. ${SPIELERZAHL_MODELL}`,
    ),
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
        felder: e.felder,
        spielerzahl: e.erwartete_spielerzahl,
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
      "Beginn und Ende lassen sich nicht leeren; «null» wird abgewiesen.",
  ),
  ende: UHRZEIT.nullable().optional().describe(
    "Neues Ende als HH:MM am selben Tag; ohne Angabe unverändert. Beginn und Ende lassen sich nicht " +
      "leeren; «null» wird abgewiesen.",
  ),
  ort: ORT.nullable().optional().describe("Neuer Ort; null leert ihn, ohne Angabe unverändert."),
  bemerkung: BEMERKUNG.nullable().optional().describe("Neue Bemerkung; null leert sie, ohne Angabe unverändert."),
  felder: FelderEingabe.nullable()
    .optional()
    .describe(
      "Die Felder des Platzes als GANZE neue Liste - sie ersetzt die bisherige; null (oder []) entfernt alle " +
        `Felder, ohne Angabe unverändert. An einem Termin einer Serie gilt «reichweite». ${FELDER_MODELL}`,
    ),
  erwartete_spielerzahl: SpielerzahlEingabe.nullable()
    .optional()
    .describe(
      "Neue erwartete Spielerzahl; null entfernt sie, ohne Angabe unverändert. An einem Termin einer Serie gilt " +
        `«reichweite». ${SPIELERZAHL_MODELL}`,
    ),
  reichweite: Reichweite.optional(),
  wochentage: Wochentage.optional().describe("Neue Wochentage der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  von: DATUM.optional().describe(
    "Neues Beginndatum der Serie (nur mit «dieser_und_folgende» oder «alle»; bei «dieser_und_folgende» frühestens am gewählten Termin).",
  ),
  bis: DATUM.optional().describe("Neues Enddatum der Serie (nur mit «dieser_und_folgende» oder «alle»)."),
  bestaetigt: Bestaetigt,
});

const EntfallenMitTraining = z.array(
  z.object({
    termin_id: z.string(),
    datum: z.string(),
    training: z.object({
      id: z.string(),
      name: z.string(),
      geloescht: z.boolean().describe("true: ein Termin-Training, das mit dem Termin gelöscht wurde; false: bleibt im Bestand."),
    }),
  }),
);

type Folge = { entfallend: { terminId: string; datum: string; training: { id: string; name: string; terminTraining: boolean } }[] } | null;

/** Die entfallenen Termine mit Training — Termin-Trainings gehen mit, die übrigen bleiben im Bestand. */
const entfallenMitTraining = (serie: Folge) =>
  (serie?.entfallend ?? []).map((x) => ({
    termin_id: x.terminId,
    datum: x.datum,
    training: { id: x.training.id, name: x.training.name, geloescht: x.training.terminTraining },
  }));

/** Was mit dem Training geschah, das einen Termin verliess. */
const VerlassenSchema = z
  .object({
    id: z.string(),
    geloescht: z.boolean().describe("true: ein Termin-Training, das gelöscht wurde; false: bleibt im Bestand des Teams."),
  })
  .nullable();
const verlassenAus = (v: Verlassen) => (v ? { id: v.trainingId, geloescht: v.geloescht } : null);

export const terminAendern = werkzeug({
  name: "termin_aendern",
  titel: "Termin ändern",
  beschreibung:
    "Ändert Datum, Zeit, Ort, Bemerkung, die Felder oder die erwartete Spielerzahl eines Termins - nur, was du mitgibst. Beginn und Ende " +
    "lassen sich nicht leeren; ändert sich die Zeit, braucht der Termin danach beide. Das " +
    "zugeordnete Training bleibt dasselbe. Für einen Termin einer Serie ist «reichweite» Pflicht; " +
    "das Datum ändert nur «nur_dieser», Wochentage und Zeitraum nur «dieser_und_folgende» oder " +
    "«alle». Das Ergebnis nennt entfallene Termine mit Training; Termin-Trainings gehen mit ihnen, " +
    `andere bleiben im Bestand. ${SERIEN_MODELL} ${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
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
        felder: e.felder,
        spielerzahl: e.erwartete_spielerzahl,
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
    "Entfernt einen Termin. Sein Termin-Training geht mit ihm; ein älteres Training aus dem " +
    "Bestand bleibt dort («training»). Ein ganzes Team-Training löscht «training_loeschen»; sein " +
    "Termin bleibt dann ohne Training bestehen. Für einen Termin einer Serie ist «reichweite» " +
    "Pflicht; bei «dieser_und_folgende» oder «alle» nennt das Ergebnis die entfallenen Termine mit " +
    "Training. Erfasst «dieser_und_folgende» oder «alle» " +
    "auch vergangene Termine, wird die Serie nur mit «bestaetigt: true» entfernt; ohne diese " +
    "Bestätigung nennt das Ergebnis, was entfiele. Ein einzelner Termin oder «nur_dieser» wird " +
    "sofort entfernt. " +
    `${SERIEN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, reichweite: Reichweite.optional(), bestaetigt: Bestaetigt }),
  ausgabe: z.object({ training: VerlassenSchema, entfallen_mit_training: EntfallenMitTraining }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneMitReichweite(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        reichweite: e.reichweite,
        bestaetigt: e.bestaetigt,
      }),
      (w) => ({ training: verlassenAus(w.training), entfallen_mit_training: entfallenMitTraining(w.serie) }),
    ),
});

// ── terminserie_festlegen ───────────────────────────────────────────────────

export const terminserieFestlegen = werkzeug({
  name: "terminserie_festlegen",
  titel: "Terminserie festlegen",
  beschreibung:
    "Legt für eines deiner Teams eine wöchentliche Terminserie fest: je gewähltem Wochentag " +
    "zwischen «von» und «bis» (beide eingeschlossen) einen Termin ohne Training mit Beginn, Ende, " +
    "Ort, Bemerkung, Verantwortlichen, Feldern und erwarteter Spielerzahl der Serie - auch ganz oder teilweise in " +
    "der Vergangenheit. Bestehende " +
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
    verantwortliche: z
      .array(kennung("Kennung eines Mitglieds aus «team_mitglieder_abrufen»."))
      .optional()
      .describe("Mitglieder, die jeden Termin der Serie vorbereiten und leiten; ohne Angabe niemand."),
    felder: FelderEingabe.optional().describe(`Die Felder jedes Termins der Serie; ohne Angabe unbekannt. ${FELDER_MODELL}`),
    erwartete_spielerzahl: SpielerzahlEingabe.optional().describe(
      `Die erwartete Spielerzahl jedes Termins der Serie; ohne Angabe unbekannt. ${SPIELERZAHL_MODELL}`,
    ),
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
        verantwortliche: e.verantwortliche,
        felder: e.felder,
        spielerzahl: e.erwartete_spielerzahl,
      }),
      (w) => ({ serie_id: w.serieId, termine: w.termine }),
    ),
});

// ── termin_der_serie_folgen ─────────────────────────────────────────────────

export const terminDerSerieFolgen = werkzeug({
  name: "termin_der_serie_folgen",
  titel: "Termin wieder der Serie folgen lassen",
  beschreibung:
    "Lässt abweichende Angaben eines Serientermins wieder seiner Serie folgen: Zeit, Ort, " +
    "Bemerkung, Verantwortliche, Felder oder erwartete Spielerzahl («spielerzahl») übernehmen die Werte der Serie und folgen ihr bei künftigen Änderungen. Das Datum " +
    `lässt sich nicht zurücksetzen («datum» wird abgewiesen). ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    angaben: z.array(z.enum(["zeit", "ort", "bemerkung", "verantwortliche", "felder", "spielerzahl", "datum"])).min(1),
  }),
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
    "Ordnet einem Termin ein Training zu: Der Termin bekommt immer eine eigene Kopie als " +
    "Termin-Training; die Quelle bleibt unverändert, und in den Bestand des Teams kommt nichts. " +
    "Quelle kann ein Training aus dem Bestand desselben Teams, das Training eines anderen Termins " +
    "oder ein eigenes persönliches Training sein (jeder Altersstufe, Entwurf oder öffentlich). " +
    "Trainings eines anderen Teams lassen sich nicht zuordnen. Trägt der Termin schon eins, wird es " +
    "ersetzt («ersetzt»): ein Termin-Training wird dabei gelöscht, ein älteres Training aus dem " +
    "Bestand bleibt dort. Scheitert die Zuordnung, entfernt KiFu die Kopie wieder; «hinweis» sagt, " +
    `ob etwas stehen blieb. ${TERMIN_MODELL} ${TERMIN_KENNUNG_FEHLER} ` +
    KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId, training_id: TrainingId }),
  ausgabe: z.object({
    termin_id: z.string(),
    training_id: z.string().describe("Das Termin-Training, das jetzt am Termin steht - die neu entstandene Kopie."),
    ersetzt: VerlassenSchema.describe("Das Training, das der Termin vorher trug; null, wenn er frei war."),
    url: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await ordneTrainingZu(zugang.supabase, zugang.userId, { terminId: e.termin_id, trainingId: e.training_id }),
      (w) => ({
        termin_id: w.terminId,
        training_id: w.trainingId,
        ersetzt: verlassenAus(w.ersetzt),
        url: zugang.url("training", w.trainingId, "edit"),
      }),
    ),
});

// ── training_loesen ─────────────────────────────────────────────────────────

export const trainingLoesen = werkzeug({
  name: "training_loesen",
  titel: "Training vom Termin lösen",
  beschreibung:
    "Löst das Training von seinem Termin: Der Termin bleibt ohne Training im Kalender. Ein " +
    "Termin-Training wird dabei gelöscht, ein älteres Training aus dem Bestand bleibt dort. " +
    TERMIN_KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ training: VerlassenSchema }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await loeseTraining(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      training: verlassenAus(w.training),
    })),
});

// ── termin_ausfallen_lassen ─────────────────────────────────────────────────

export const terminAusfallenLassen = werkzeug({
  name: "termin_ausfallen_lassen",
  titel: "Termin ausfallen lassen",
  beschreibung:
    "Markiert einen Termin als ausgefallen - wie ein abgesagter Kalendereintrag - oder ändert den " +
    "Grund eines schon ausgefallenen. Ohne «grund» bleibt ein vorhandener Grund stehen; «grund»: " +
    "null (oder leer) leert ihn. Trägt der Termin ein Training, ruht es am Termin und ist wieder da, " +
    "wenn der Ausfall zurückgenommen wird. Ein ausgefallener Termin gilt nicht als unvorbereitet " +
    `und nimmt kein neues Training an. Einzeln auf heute oder später verlegt, findet er wieder statt. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    grund: BEMERKUNG.nullable()
      .optional()
      .describe("Grund, frei, höchstens 500 Zeichen. Weggelassen: ein vorhandener Grund bleibt. null: leert ihn."),
  }),
  ausgabe: z.object({ termin_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await lasseAusfallen(zugang.supabase, zugang.userId, { terminId: e.termin_id, grund: e.grund }), (w) => ({
      termin_id: w.terminId,
    })),
});

// ── termin_ausfall_zuruecknehmen ────────────────────────────────────────────

export const terminAusfallZuruecknehmen = werkzeug({
  name: "termin_ausfall_zuruecknehmen",
  titel: "Ausfall zurücknehmen",
  beschreibung:
    "Nimmt den Ausfall eines Termins zurück: Er ist danach wieder ein normaler Termin ohne Grund; " +
    `ein Training, das am Termin ruhte, ist wieder da. ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({ termin_id: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await nimmAusfallZurueck(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      termin_id: w.terminId,
    })),
});

// ── team_mitglieder_abrufen ─────────────────────────────────────────────────

export const teamMitgliederAbrufen = werkzeug({
  name: "team_mitglieder_abrufen",
  titel: "Mitglieder eines Teams",
  beschreibung:
    "Nennt die Mitglieder eines deiner Teams mit Anzeigename und Kennung - ohne E-Mail-Adresse. " +
    "«ich» markiert dich selbst. Die Kennungen brauchst du für «verantwortliche» in " +
    `«termin_verantwortliche_setzen» und «terminserie_festlegen». ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({
    mitglieder: z.array(z.object({ id: z.string(), anzeigename: z.string(), ich: z.boolean() })),
  }),
  ausfuehren: async (e, zugang) => teamMitglieder(zugang.supabase, zugang.userId, { teamId: e.team_id }),
});

// ── termin_verantwortliche_setzen ───────────────────────────────────────────

export const terminVerantwortlicheSetzen = werkzeug({
  name: "termin_verantwortliche_setzen",
  titel: "Verantwortliche eines Termins setzen",
  beschreibung:
    "Setzt die Mitglieder, die einen Termin vorbereiten und leiten - ein oder mehrere, oder keine " +
    "(leere Liste). Neu eintragen lassen sich nur aktuelle Mitglieder. Für einen Termin einer Serie " +
    "ist «reichweite» Pflicht. Bei «nur_dieser» (und an einem einzelnen Termin) bleiben Einträge " +
    "ehemaliger Mitglieder, wenn du sie mitgibst, und Einträge gelöschter Konten (ohne Kennung), " +
    "ausser «ohne_namen_behalten» ist false. «dieser_und_folgende» und «alle» ersetzen dagegen alle " +
    "Einträge der erfassten Termine durch die genannten aktuellen Mitglieder - auch die " +
    "ehemaliger Mitglieder und gelöschter Konten; «dieser_und_folgende» teilt dabei die Serie, die " +
    `neue Serie trägt die neuen Verantwortlichen. ${SERIEN_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    verantwortliche: z.array(kennung("Kennung eines Mitglieds aus «team_mitglieder_abrufen».")),
    ohne_namen_behalten: z
      .boolean()
      .optional()
      .describe(
        "Nur bei nur_dieser oder einem Einzeltermin: false entfernt Einträge gelöschter Konten; ohne Angabe bleiben sie.",
      ),
    reichweite: Reichweite.optional(),
    bestaetigt: Bestaetigt,
  }),
  ausgabe: z.object({ termin_id: z.string(), serie_id: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeVerantwortliche(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        userIds: e.verantwortliche,
        anonyme: e.ohne_namen_behalten === false ? [] : null,
        reichweite: e.reichweite,
        bestaetigt: e.bestaetigt,
      }),
      (w) => ({ termin_id: w.terminId, serie_id: w.serie?.serieId ?? null }),
    ),
});
