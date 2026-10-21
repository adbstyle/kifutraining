import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import {
  aendereSpieler,
  entferneSpieler,
  erneuereAbholung,
  erneuereSpielerLink,
  holeSpielerLink,
  ladeSpieler,
  ladeSpielerliste,
  leseAbholung,
  nimmSpielerAuf,
  schalteAbholung,
} from "@/lib/kern/spieler";
import { setzeAbmeldung, setzeAnwesenheit, terminSpieler } from "@/lib/kern/abmeldungen";
import { istSpiel, setzeAufgebot, setzeMeldung, spielSpieler, type SpielSpieler, type SpielTeilnehmer } from "@/lib/kern/spiele";
import { zaehlteBeimAnpfiff } from "@/lib/spiel";
import {
  ABHOL_PFAD,
  ABHOLUNG_TEXT,
  ABHOL_SPERRE_MINUTEN,
  ABHOL_VERSUCHE,
  EHEMALIGE_SPIELERIN,
  JS_MAX,
  LINK_PFAD,
  LINK_TEXT,
  NAME_MAX,
  SPIELER_MAX,
  teilnahmeStatus,
  type Teilnehmer,
} from "@/lib/spieler";
import { kennung } from "@/lib/mcp/bausteine";
import { TEAM_KENNUNG_FEHLER, TERMIN_KENNUNG_FEHLER, TeamId, TerminId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";
import { jetztAmTrainingsort } from "@/lib/zeit";

/**
 * Die Spielerliste eines Teams (Epic #433, Story #434) — dünne Adapter über
 * den Fachkern (lib/kern/spieler.ts), dieselben Funktionen wie die Karte
 * «Spieler:innen» im Team-Bereich.
 */

/** Was jede Beschreibung eines Spieler-Werkzeugs über das Modell sagt. */
const SPIELER_MODELL =
  "Ein Team kann eine Spielerliste führen: je Spieler:in Vorname, Nachname, Jahrgang und optional die J+S-Nummer, " +
  `höchstens ${SPIELER_MAX} je Team, jedes Mitglied führt sie. Vor- und Nachname haben je 1 bis ${NAME_MAX} Zeichen, ` +
  `der Jahrgang vier Ziffern, die J+S-Nummer höchstens ${JS_MAX} Zeichen. Dieselbe Spieler:in steht nur einmal auf ` +
  "der Liste: Gross- und Kleinschreibung, überzählige Leerzeichen, Bindestrich gegen Leerzeichen und Apostroph-Varianten " +
  "unterscheiden nicht, Umlaute schon; zwei Gleichnamige mit gleichem Jahrgang unterscheidet ein Zusatz im Vornamen. " +
  "Sobald die Liste jemanden enthält, kommt die Spielerzahl anstehender Termine aus ihr («spielerzahl» mit Quelle " +
  "«spielerliste» in «team_plan_abrufen») und lässt sich nicht mehr von Hand festlegen; beim ersten Aufnehmen verlieren " +
  "anstehende Termine und Serien ihre erwartete Zahl. Begonnene Termine behalten den Stand bei Beginn. " +
  "Die Angaben betreffen Kinder und Jugendliche: Nenne sie nur, wo es für die Planung nötig ist.";

export const SpielerId = kennung("Kennung einer Spieler:in («id» aus «spielerliste_abrufen»).");

export const SPIELER_KENNUNG_FEHLER =
  "Fehlerart zur Spieler-Kennung: «nicht_gefunden» - keine Spieler:in eines deiner Teams (es gibt sie nicht, sie " +
  "wurde entfernt, oder sie gehört einem fremden Team; bewusst nicht unterscheidbar).";

const VORNAME = z.string().describe(`Vorname, 1 bis ${NAME_MAX} Zeichen.`);
const NACHNAME = z.string().describe(`Nachname, 1 bis ${NAME_MAX} Zeichen.`);
const JAHRGANG = z.number().describe("Jahrgang als vierstellige Jahreszahl, etwa 2017.");
const JS_NUMMER = z.string().describe(`J+S-Nummer, höchstens ${JS_MAX} Zeichen; leer heisst keine.`);

const SpielerAusgabe = z.object({
  id: z.string(),
  vorname: z.string(),
  nachname: z.string(),
  jahrgang: z.number().int(),
  js_nummer: z.string().nullable(),
  link_bezogen: z.boolean().describe("Der aktuelle private Link wurde über die Selbstabholung herausgegeben."),
  kader_ids: z.array(z.string()).describe("Die Kader, denen sie angehört («kader_abrufen» nennt die Namen)."),
});

// ── spielerliste_abrufen ────────────────────────────────────────────────────

export const spielerlisteAbrufen = werkzeug({
  name: "spielerliste_abrufen",
  titel: "Spielerliste eines Teams",
  beschreibung:
    "Nennt die Spielerliste eines deiner Teams, nach Vorname und Nachname geordnet, mit Jahrgang und J+S-Nummer. " +
    `Eine leere Liste heisst: Das Team plant mit der erwarteten Spielerzahl. ${SPIELER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    anzahl: z.number().int(),
    spieler: z.array(SpielerAusgabe),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await ladeSpielerliste(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team: w.team,
      anzahl: w.spieler.length,
      spieler: w.spieler.map((s) => ({
        id: s.id,
        vorname: s.vorname,
        nachname: s.nachname,
        jahrgang: s.jahrgang,
        js_nummer: s.jsNummer,
        link_bezogen: s.linkBezogen,
        kader_ids: s.kaderIds,
      })),
    })),
});

// ── spieler_aufnehmen ───────────────────────────────────────────────────────

export const spielerAufnehmen = werkzeug({
  name: "spieler_aufnehmen",
  titel: "Spieler:in aufnehmen",
  beschreibung:
    "Nimmt eine Spieler:in in die Spielerliste eines deiner Teams auf. «ersetzte_zahlen» nennt, wie viele anstehende " +
    `Termine dabei ihre erwartete Zahl verloren (nur beim ersten Aufnehmen). ${SPIELER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    vorname: VORNAME,
    nachname: NACHNAME,
    jahrgang: JAHRGANG,
    js_nummer: JS_NUMMER.optional(),
  }),
  ausgabe: z.object({ spieler_id: z.string(), team_id: z.string(), ersetzte_zahlen: z.number().int() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await nimmSpielerAuf(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        vorname: e.vorname,
        nachname: e.nachname,
        jahrgang: e.jahrgang,
        jsNummer: e.js_nummer,
      }),
      (w) => ({ spieler_id: w.spielerId, team_id: w.teamId, ersetzte_zahlen: w.ersetzt }),
    ),
});

// ── spieler_aendern ─────────────────────────────────────────────────────────

export const spielerAendern = werkzeug({
  name: "spieler_aendern",
  titel: "Spieler:in ändern",
  beschreibung:
    "Ändert Vorname, Nachname und Jahrgang einer Spieler:in - immer alle drei - und, falls angegeben, die J+S-Nummer " +
    "(«js_nummer» weglassen lässt sie unverändert, leer entfernt sie). Ein neuer Name gilt überall, auch an " +
    `vergangenen Terminen. ${SPIELER_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    spieler_id: SpielerId,
    vorname: VORNAME,
    nachname: NACHNAME,
    jahrgang: JAHRGANG,
    js_nummer: JS_NUMMER.optional(),
  }),
  ausgabe: z.object({ spieler_id: z.string(), team_id: z.string() }),
  ausfuehren: async (e, zugang) => {
    let js = e.js_nummer;
    if (js === undefined) {
      const bisher = await ladeSpieler(zugang.supabase, e.spieler_id);
      if (!bisher.ok) return bisher;
      js = bisher.wert.jsNummer ?? "";
    }
    return abgebildet(
      await aendereSpieler(zugang.supabase, zugang.userId, {
        spielerId: e.spieler_id,
        vorname: e.vorname,
        nachname: e.nachname,
        jahrgang: e.jahrgang,
        jsNummer: js,
      }),
      (w) => ({ spieler_id: w.spielerId, team_id: w.teamId }),
    );
  },
});

// ── spieler_entfernen ───────────────────────────────────────────────────────

export const spielerEntfernen = werkzeug({
  name: "spieler_entfernen",
  titel: "Spieler:in entfernen",
  beschreibung:
    "Entfernt eine Spieler:in aus der Spielerliste ihres Teams. An vergangenen Terminen steht sie danach nur noch als " +
    "ehemalige Spieler:in ohne Namen, die Spielerzahl dort bleibt; an anstehenden zählt sie nicht mehr. Frag vorher " +
    `nach, ob die Person wirklich gemeint ist. ${SPIELER_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ spieler_id: SpielerId }),
  ausgabe: z.object({ team_id: z.string(), name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await entferneSpieler(zugang.supabase, zugang.userId, { spielerId: e.spieler_id }), (w) => ({
      team_id: w.teamId,
      name: w.name,
    })),
});

// ── termin_spieler_abrufen (#435) ───────────────────────────────────────────

/** Was jede Beschreibung eines Abmelde-Werkzeugs über das Modell sagt. */
const ABMELDE_MODELL =
  "Jede Spieler:in der Spielerliste ist für jeden Termin angemeldet, bis sie abgemeldet wird; «keine Rückmeldung» gibt " +
  "es nicht. Ab- und anmelden geht bis zum Beginn des Termins (Uhr am Trainingsort, Schweiz), nicht an einem " +
  "ausgefallenen. Ab Beginn gilt der Stand bei Beginn; dann tragen Mitglieder nach, wer trotz Anmeldung nicht erschienen " +
  "und wer trotz Abmeldung doch erschienen ist (termin_anwesenheit_setzen), unbefristet. Ohne Nachtrag gilt der Stand " +
  "bei Beginn als Anwesenheit - ob jemand geprüft hat, hält KiFu nicht fest. Wer aus der Liste fällt, steht an " +
  `begonnenen Terminen als «${EHEMALIGE_SPIELERIN}» ohne Namen, samt Nachtrag. Eine Abmeldung und ein Nachtrag tragen ` +
  "keinen Grund, und KiFu benachrichtigt niemanden. Spiele (art «spiel») sind anders: Jede Spieler:in ist zuerst ohne " +
  "Meldung («meldung: null»), bis sie an- oder abgemeldet wird; danach wechselt sie nur noch zwischen angemeldet und " +
  "abgemeldet. Mitglieder (und du) melden bis zum Anpfiff, auch nach der Meldefrist; Eltern über ihren Link nur bis zur " +
  "Meldefrist. Ein anderes Datum lässt alle Meldungen eines Spiels verfallen, eine andere Zeit am selben Tag nicht. " +
  "Mitglieder (und du) können eine Spieler:in für ein Spiel als nicht aufgeboten kennzeichnen (termin_aufgebot_setzen), " +
  "gleich welche Meldung sie trägt: Die Meldung bleibt darunter stehen, zählt aber nicht als angemeldet, und bis die " +
  "Kennzeichnung aufgehoben ist, nimmt das Spiel für sie keine Meldung an. Die Kennzeichnung trägt keinen Grund, " +
  "verfällt mit den Meldungen und wird beim Anpfiff mit ihnen festgehalten; die Eltern sehen sie über ihren Link. " +
  "Ab dem Anpfiff tragen Mitglieder (und du) nach, wer nicht oder doch erschienen ist (termin_anwesenheit_setzen): " +
  "Gezählt hat beim Anpfiff, wer angemeldet und nicht als nicht aufgeboten gekennzeichnet war; «nicht_erschienen» gilt " +
  "für sie, «doch_erschienen» für alle anderen. Jede Verlegung eines begonnenen Spiels lässt seine Nachträge verfallen. " +
  "Mindest- und Höchstzahl sind ein Richtwert; wie die Zahl dazu steht, beurteilst du selbst.";

/** Was die KI je Spieler:in zur Anwesenheit erhält (#475 AK 13). */
const ANWESENHEIT_BESCHREIBUNG =
  "Nachtrag ab Beginn: «nicht_erschienen» (war angemeldet, kam nicht) oder «doch_erschienen» (war abgemeldet, kam " +
  "doch); null ohne Nachtrag - dann gilt der Stand bei Beginn. An einem ausgefallenen Termin immer null.";

export const terminSpielerAbrufen = werkzeug({
  name: "termin_spieler_abrufen",
  titel: "Wer an einem Termin kommt",
  beschreibung:
    "Nennt für einen Termin, welche Spieler:innen angemeldet und welche abgemeldet sind und seit wann - an einem Spiel auch, " +
    "wer noch ohne Meldung ist -, dazu die Zahl der " +
    "angemeldeten. Trägt der Termin Kader, stehen nur die Spieler:innen da, für die er gilt, je mit den Kadern, über die er " +
    "für sie gilt. «begonnen: true» heisst, der Stand ist der bei Beginn; dazu kommen die Nachträge, wer nicht oder doch " +
    "erschienen ist, und «anwesend». " +
    `Ohne Spielerliste ist die Liste leer. ${ABMELDE_MODELL} ${TERMIN_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ termin_id: TerminId }),
  ausgabe: z.object({
    termin_id: z.string(),
    art: z.enum(["training", "spiel"]),
    datum: z.string(),
    beginn: z.string(),
    ende: z.string(),
    ausgefallen: z.boolean(),
    begonnen: z.boolean(),
    angemeldet: z.number().int(),
    gesamt: z.number().int(),
    ohne_meldung: z.number().int().nullable().describe("Nur an einem Spiel: wer noch ohne Meldung ist; bei Trainings null."),
    nicht_aufgeboten: z
      .number()
      .int()
      .nullable()
      .describe("Nur an einem Spiel: wie viele nicht aufgeboten sind; sie zählen weder als angemeldet noch abgemeldet noch ohne Meldung. Bei Trainings null."),
    mindestzahl: z.number().int().nullable().describe("Nur an einem Spiel: der Richtwert, soweit festgelegt."),
    hoechstzahl: z.number().int().nullable(),
    meldefrist: z
      .string()
      .nullable()
      .describe("Nur an einem Spiel: bis wann Eltern melden, als YYYY-MM-DDTHH:MM (Uhr am Trainingsort); null ohne Frist (bis zum Anpfiff)."),
    anwesend: z
      .number()
      .int()
      .nullable()
      .describe("Ab Beginn, wer da war: die Angemeldeten ohne die nicht Erschienenen, dazu die doch Erschienenen. Vor Beginn und an einem ausgefallenen Termin null."),
    kader: z
      .array(z.object({ id: z.string().nullable(), name: z.string().nullable() }))
      .describe("Für welche Kader der Termin gilt; leer heisst für alle. id null: ein ehemaliger Kader eines begonnenen Termins."),
    nicht_betroffen: z.number().int().describe("Wie viele Spieler:innen des Teams der Termin nicht betrifft (0 an begonnenen)."),
    spieler: z.array(
      z.object({
        id: z.string().nullable().describe("Kennung der Spieler:in; null bei einer ehemaligen."),
        vorname: z.string().nullable(),
        nachname: z.string().nullable(),
        abgemeldet: z.boolean().describe("Der Stand vor Beginn bzw. bei Beginn; ein Nachtrag ändert ihn nicht."),
        meldung: z
          .enum(["angemeldet", "abgemeldet"])
          .nullable()
          .describe("Die Meldung; an einem Spiel null, solange sie ohne Meldung ist. Bei Trainings nie null."),
        nicht_aufgeboten: z
          .boolean()
          .describe("Nur an einem Spiel: als nicht aufgeboten gekennzeichnet; «meldung» ist dann die Meldung darunter. Bei Trainings false."),
        ehemalig: z.boolean(),
        kader: z.array(z.string()).describe("Die Kader, über die der Termin für sie gilt; leer bei einem Termin für alle."),
        anwesenheit: z.enum(["nicht_erschienen", "doch_erschienen"]).nullable().describe(ANWESENHEIT_BESCHREIBUNG),
        zuletzt_gewechselt: z
          .string()
          .nullable()
          .describe(
            "Wann ihr Status an diesem Termin zuletzt zwischen angemeldet und abgemeldet wechselte, als YYYY-MM-DDTHH:MM " +
              "(Uhr am Trainingsort, Schweiz); an einem begonnenen Termin der letzte Wechsel vor Beginn. null: an diesem Termin " +
              "nie gewechselt (eine Verlegung oder ein Wegfall durch Kader setzt das zurück) oder eine ehemalige Spieler:in.",
          ),
      }),
    ),
  }),
  ausfuehren: async (e, zugang) => {
    // Ein Spiel hat eigene Meldungen (#463); Zahlen ohne Bewertung (PO 2026-10-21).
    if (await istSpiel(zugang.supabase, e.termin_id))
      return abgebildet(await spielSpieler(zugang.supabase, zugang.userId, { terminId: e.termin_id }), spielAusgabe);
    return abgebildet(await terminSpieler(zugang.supabase, zugang.userId, { terminId: e.termin_id }), (w) => ({
      termin_id: w.terminId,
      art: "training" as const,
      datum: w.datum,
      beginn: w.beginn,
      ende: w.ende,
      ausgefallen: w.ausgefallen,
      begonnen: w.begonnen,
      angemeldet: w.angemeldet,
      gesamt: w.gesamt,
      ohne_meldung: null,
      nicht_aufgeboten: null,
      mindestzahl: null,
      hoechstzahl: null,
      meldefrist: null,
      anwesend: w.anwesend,
      kader: w.kader,
      nicht_betroffen: w.uebrige,
      spieler: w.spieler.map(teilnehmerAusgabe),
    }));
  },
});

/** Ein Spiel, wie die KI es erhält (#463 AK 22). */
function spielAusgabe(w: SpielSpieler) {
  return {
    termin_id: w.terminId,
    art: "spiel" as const,
    datum: w.datum,
    beginn: w.beginn,
    ende: w.ende,
    ausgefallen: w.ausgefallen,
    begonnen: w.begonnen,
    angemeldet: w.angemeldet,
    gesamt: w.gesamt,
    ohne_meldung: w.ohneMeldung,
    nicht_aufgeboten: w.nichtAufgeboten,
    mindestzahl: w.richtwertMin,
    hoechstzahl: w.richtwertMax,
    meldefrist: w.frist,
    anwesend: w.anwesend,
    kader: w.kader,
    nicht_betroffen: w.uebrige,
    spieler: w.spieler.map(spielTeilnehmerAusgabe),
  };
}

function spielTeilnehmerAusgabe(s: SpielTeilnehmer) {
  return {
    id: s.spielerId,
    vorname: s.vorname,
    nachname: s.nachname,
    abgemeldet: s.meldung === "abgemeldet",
    meldung: s.meldung,
    nicht_aufgeboten: s.nichtAufgeboten,
    ehemalig: s.ehemalig,
    kader: s.kader,
    // #487 AK 14: der Nachtrag gegen den Stand beim Anpfiff.
    anwesenheit: s.nachgetragen
      ? zaehlteBeimAnpfiff(s.meldung, s.nichtAufgeboten)
        ? ("nicht_erschienen" as const)
        : ("doch_erschienen" as const)
      : null,
    zuletzt_gewechselt: s.gewechseltAm && jetztAmTrainingsort(new Date(s.gewechseltAm)),
  };
}

/** Eine Spieler:in, wie die KI sie erhält: der letzte Wechsel als Uhr am
 *  Trainingsort, nicht in UTC (#467 AK 12). */
export function teilnehmerAusgabe(s: Teilnehmer) {
  return {
    id: s.spielerId,
    vorname: s.vorname,
    nachname: s.nachname,
    abgemeldet: s.abgemeldet,
    meldung: s.abgemeldet ? ("abgemeldet" as const) : ("angemeldet" as const),
    nicht_aufgeboten: false,
    ehemalig: s.ehemalig,
    kader: s.kader,
    anwesenheit: anwesenheitAusgabe(s),
    zuletzt_gewechselt: s.gewechseltAm && jetztAmTrainingsort(new Date(s.gewechseltAm)),
  };
}

function anwesenheitAusgabe(s: Teilnehmer): "nicht_erschienen" | "doch_erschienen" | null {
  const status = teilnahmeStatus(s);
  return status === "nicht_erschienen" || status === "doch_erschienen" ? status : null;
}

// ── termin_abmeldung_setzen (#435) ──────────────────────────────────────────

export const terminAbmeldungSetzen = werkzeug({
  name: "termin_abmeldung_setzen",
  titel: "Spieler:in ab- oder anmelden",
  beschreibung:
    "Meldet eine Spieler:in für einen Termin ab («abgemeldet: true») oder wieder an («abgemeldet: false») - an einem " +
    "Spiel ist «abgemeldet: false» die Anmeldung. " +
    "«termin_datum» und «termin_beginn» sind Datum und Beginn, wie du den Termin zuletzt gelesen hast: Wurde er " +
    "inzwischen verlegt, weist KiFu mit dem neuen Stand ab (Fehlerart «konflikt») - lies ihn dann neu und frag nach. " +
    `${ABMELDE_MODELL} ${TERMIN_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    spieler_id: SpielerId,
    abgemeldet: z.boolean(),
    termin_datum: z.string().describe("Datum des Termins, wie zuletzt gelesen, als JJJJ-MM-TT."),
    termin_beginn: z.string().describe("Beginn des Termins, wie zuletzt gelesen, als HH:MM."),
  }),
  ausgabe: z.object({
    termin_id: z.string(),
    abgemeldet: z.boolean(),
    angemeldet: z.number().int().nullable(),
    gesamt: z.number().int().nullable(),
  }),
  ausfuehren: async (e, zugang) => {
    const gesehen = { datum: e.termin_datum, beginn: e.termin_beginn };
    // An einem Spiel die Meldung (#463 AK 22, 24): dieselben Regeln wie die Oberfläche.
    if (await istSpiel(zugang.supabase, e.termin_id))
      return abgebildet(
        await setzeMeldung(zugang.supabase, zugang.userId, {
          terminId: e.termin_id,
          spielerId: e.spieler_id,
          angemeldet: !e.abgemeldet,
          gesehen,
        }),
        (w) => ({
          termin_id: w.terminId,
          abgemeldet: !w.angemeldet,
          angemeldet: w.stand?.angemeldet ?? null,
          gesamt: w.stand?.gesamt ?? null,
        }),
      );
    return abgebildet(
      await setzeAbmeldung(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        spielerId: e.spieler_id,
        abgemeldet: e.abgemeldet,
        gesehen,
      }),
      (w) => ({
        termin_id: w.terminId,
        abgemeldet: w.abgemeldet,
        angemeldet: w.stand?.angemeldet ?? null,
        gesamt: w.stand?.gesamt ?? null,
      }),
    );
  },
});

// ── termin_aufgebot_setzen (#464) ───────────────────────────────────────────

export const terminAufgebotSetzen = werkzeug({
  name: "termin_aufgebot_setzen",
  titel: "Für ein Spiel nicht aufbieten",
  beschreibung:
    "Kennzeichnet eine Spieler:in für ein Spiel als nicht aufgeboten («nicht_aufgeboten: true») oder hebt das auf " +
    "(«nicht_aufgeboten: false») - etwa bei zu vielen Anmeldungen oder wenn jemand pausiert. Nur an Spielen, bis zum " +
    "Anpfiff, nicht an einem ausgefallenen, nur für wen das Spiel gilt - dieselben Bedingungen wie beim Melden. " +
    "«termin_datum» und «termin_beginn» sind Datum und Beginn, wie du das Spiel zuletzt gelesen hast: Wurde es " +
    "inzwischen verlegt, weist KiFu mit dem neuen Stand ab (Fehlerart «konflikt»). KiFu stellt kein Aufgebot zusammen " +
    `und benachrichtigt niemanden. ${ABMELDE_MODELL} ${TERMIN_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    spieler_id: SpielerId,
    nicht_aufgeboten: z.boolean(),
    termin_datum: z.string().describe("Datum des Spiels, wie zuletzt gelesen, als JJJJ-MM-TT."),
    termin_beginn: z.string().describe("Anpfiff des Spiels, wie zuletzt gelesen, als HH:MM."),
  }),
  ausgabe: z.object({
    termin_id: z.string(),
    nicht_aufgeboten: z.boolean(),
    angemeldet: z.number().int().nullable().describe("Die Angemeldeten danach, ohne die nicht Aufgebotenen."),
    gesamt: z.number().int().nullable(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeAufgebot(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        spielerId: e.spieler_id,
        nichtAufgeboten: e.nicht_aufgeboten,
        gesehen: { datum: e.termin_datum, beginn: e.termin_beginn },
      }),
      (w) => ({
        termin_id: w.terminId,
        nicht_aufgeboten: w.nichtAufgeboten,
        angemeldet: w.stand?.angemeldet ?? null,
        gesamt: w.stand?.gesamt ?? null,
      }),
    ),
});

// ── termin_anwesenheit_setzen (#475) ────────────────────────────────────────

export const terminAnwesenheitSetzen = werkzeug({
  name: "termin_anwesenheit_setzen",
  titel: "Nachtragen, wer da war",
  beschreibung:
    "Trägt an einem begonnenen Termin nach, ob eine Spieler:in da war («da»). Gegen den Stand bei Beginn ist es ein " +
    "Nachtrag: «da: false» bei einer Angemeldeten heisst nicht erschienen, «da: true» bei einer Abgemeldeten doch " +
    "erschienen - an einem Spiel bei einer, die ohne Meldung, abgemeldet oder nicht aufgeboten war. Gleich dem Stand " +
    "bei Beginn nimmt es den Nachtrag zurück. Nur für Spieler:innen im Stand bei Beginn, " +
    "nicht vor Beginn und nicht an einem ausgefallenen Termin. «termin_datum» und «termin_beginn» sind Datum und Beginn, " +
    "wie du den Termin zuletzt gelesen hast: Wurde er inzwischen verlegt, weist KiFu mit dem neuen Stand ab (Fehlerart " +
    `«konflikt»). ${ABMELDE_MODELL} ${TERMIN_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    termin_id: TerminId,
    spieler_id: SpielerId,
    da: z.boolean().describe("War die Spieler:in da?"),
    termin_datum: z.string().describe("Datum des Termins, wie zuletzt gelesen, als JJJJ-MM-TT."),
    termin_beginn: z.string().describe("Beginn des Termins, wie zuletzt gelesen, als HH:MM."),
  }),
  ausgabe: z.object({
    termin_id: z.string(),
    da: z.boolean(),
    anwesenheit: z.enum(["nicht_erschienen", "doch_erschienen"]).nullable().describe(ANWESENHEIT_BESCHREIBUNG),
    anwesend: z.number().int().nullable().describe("Wie viele jetzt als da gelten."),
    gesamt: z.number().int().nullable(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeAnwesenheit(zugang.supabase, zugang.userId, {
        terminId: e.termin_id,
        spielerId: e.spieler_id,
        da: e.da,
        gesehen: { datum: e.termin_datum, beginn: e.termin_beginn },
      }),
      (w) => ({
        termin_id: w.terminId,
        da: w.da,
        anwesenheit: w.nachgetragen ? (w.da ? ("doch_erschienen" as const) : ("nicht_erschienen" as const)) : null,
        anwesend: w.stand?.anwesend ?? null,
        gesamt: w.stand?.gesamt ?? null,
      }),
    ),
});

// ── spieler_link_abrufen / spieler_link_erneuern (#436) ─────────────────────

/** Was jede Beschreibung eines Link-Werkzeugs über das Modell sagt. */
const LINK_MODELL =
  "Jede Spieler:in hat einen privaten Link: Wer ihn öffnet, sieht ohne Konto den Teamnamen, Vor- und Nachnamen dieser " +
  "Spieler:in und die anstehenden Termine des Teams, die für sie gelten (bei Terminen mit Kadern nur die ihrer Kader, samt " +
  "dieser Kader), mit der Zahl der Angemeldeten und derer, für die er gilt, und meldet sie bis zum Beginn ab und " +
  "wieder an. Spiele meldet sie an oder ab bis zur Meldefrist (ohne Frist bis zum Anpfiff) und sieht dort Bezeichnung, " +
  "Richtwert, Meldefrist, Treffpunkte, Bemerkung und ob die Spieler:in nicht aufgeboten ist — keine Namen anderer, kein " +
  "Training, keine Nachträge, nichts Vergangenes. KiFu verschickt den Link nicht. Gib ihn nur der " +
  `Person weiter, die ihn verlangt, und nie in einer Gruppe. ${LINK_TEXT.warnung}`;

const LinkAusgabe = z.object({
  spieler_id: z.string(),
  team_id: z.string(),
  name: z.string(),
  url: z.string().describe("Der private Link. Ein Geheimnis: Wer ihn hat, kann diese Spieler:in für Trainings ab- und anmelden und für Spiele melden."),
  hinweis: z.string(),
});

export const spielerLinkAbrufen = werkzeug({
  name: "spieler_link_abrufen",
  titel: "Privater Link einer Spieler:in",
  beschreibung:
    "Holt den privaten Link einer Spieler:in, damit du ihn ihrer Spielervertretung (Eltern oder ihr selbst) weitergibst. " +
    `Er bleibt derselbe, bis ihn jemand erneuert. ${LINK_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ spieler_id: SpielerId }),
  ausgabe: LinkAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await holeSpielerLink(zugang.supabase, zugang.userId, { spielerId: e.spieler_id }), (w) => ({
      spieler_id: e.spieler_id,
      team_id: w.teamId,
      name: w.name,
      url: zugang.url(LINK_PFAD, w.token),
      hinweis: LINK_TEXT.warnung,
    })),
});

export const spielerLinkErneuern = werkzeug({
  name: "spieler_link_erneuern",
  titel: "Privaten Link einer Spieler:in erneuern",
  beschreibung:
    "Erneuert den privaten Link einer Spieler:in und gibt den neuen zurück — etwa wenn er weitergegeben oder " +
    `missbraucht wurde. ${LINK_TEXT.erneuern} Frag vorher nach, ob das gemeint ist. ${LINK_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ spieler_id: SpielerId }),
  ausgabe: LinkAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await erneuereSpielerLink(zugang.supabase, zugang.userId, { spielerId: e.spieler_id }), (w) => ({
      spieler_id: e.spieler_id,
      team_id: w.teamId,
      name: w.name,
      url: zugang.url(LINK_PFAD, w.token),
      hinweis: LINK_TEXT.erneuern,
    })),
});

// ── Selbstabholung (#438) ───────────────────────────────────────────────────

const ABHOL_MODELL =
  "Mit der Selbstabholung holen Eltern den privaten Link ihres Kindes selbst ab: Sie öffnen die Abholadresse des Teams " +
  "ohne Konto und geben Vorname, Nachname und Jahrgang ein; passt die Eingabe (wie die Eindeutigkeit der Liste: Gross- " +
  "und Kleinschreibung, Leerzeichen, Bindestrich und Apostroph-Varianten zählen nicht), erhalten sie den Link, und er " +
  `gilt als bezogen («link_bezogen» in «spielerliste_abrufen»). Nach ${ABHOL_VERSUCHE} nicht passenden Eingaben ist die ` +
  `Eingabe vom selben Anschluss ${ABHOL_SPERRE_MINUTEN} Minuten gesperrt. Die Selbstabholung ist aus, bis ein Mitglied ` +
  "sie einschaltet; aus und wieder ein gilt dieselbe Adresse. Erneuern macht die bisherige für immer ungültig. Bezogene " +
  "Spieler-Links gelten in jedem Fall weiter; ein erneuerter Spieler-Link gilt wieder als nicht bezogen. KiFu verschickt " +
  "die Adresse nicht.";

const AbholAusgabe = z.object({
  team_id: z.string(),
  aktiv: z.boolean(),
  url: z
    .string()
    .nullable()
    .describe(
      "Die Abholadresse. Wer sie hat und Vorname, Nachname und Jahrgang einer Spieler:in kennt, erhält deren Link. " +
        "null: Es gibt noch keine — sie entsteht beim ersten Einschalten.",
    ),
  hinweis: z.string(),
});

const abholAusgabe = (w: { teamId: string; aktiv: boolean }, url: string | null, hinweis: string) => ({
  team_id: w.teamId,
  aktiv: w.aktiv,
  url,
  hinweis,
});

export const selbstabholungAbrufen = werkzeug({
  name: "selbstabholung_abrufen",
  titel: "Selbstabholung eines Teams",
  beschreibung:
    "Nennt, ob die Selbstabholung eines deiner Teams eingeschaltet ist, und ihre Abholadresse, damit du sie weitergibst " +
    `(nur im Eltern-Chat des Teams). Welche Links bezogen sind, steht in «spielerliste_abrufen». ${ABHOL_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: AbholAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await leseAbholung(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) =>
      abholAusgabe(w, w.token ? zugang.url(ABHOL_PFAD, w.token) : null, w.aktiv ? ABHOLUNG_TEXT.beschreibung : ABHOLUNG_TEXT.aus),
    ),
});

export const selbstabholungSchalten = werkzeug({
  name: "selbstabholung_schalten",
  titel: "Selbstabholung ein- oder ausschalten",
  beschreibung:
    "Schaltet die Selbstabholung eines deiner Teams ein («aktiv: true») oder aus. Ausschalten stoppt neue Abholungen; " +
    `bezogene Links gelten weiter. ${ABHOL_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ team_id: TeamId, aktiv: z.boolean() }),
  ausgabe: AbholAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await schalteAbholung(zugang.supabase, zugang.userId, { teamId: e.team_id, aktiv: e.aktiv }), (w) =>
      abholAusgabe(w, zugang.url(ABHOL_PFAD, w.token), w.aktiv ? ABHOLUNG_TEXT.beschreibung : ABHOLUNG_TEXT.ausgeschaltet),
    ),
});

export const abholadresseErneuern = werkzeug({
  name: "abholadresse_erneuern",
  titel: "Abholadresse erneuern",
  beschreibung:
    "Erneuert die Abholadresse eines deiner Teams und gibt die neue zurück — etwa wenn sie ausserhalb des Teams gelandet " +
    `ist. Frag vorher nach, ob das gemeint ist. ${ABHOLUNG_TEXT.erneuern} ${ABHOL_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: AbholAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await erneuereAbholung(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) =>
      abholAusgabe(w, zugang.url(ABHOL_PFAD, w.token), ABHOLUNG_TEXT.erneuern),
    ),
});
