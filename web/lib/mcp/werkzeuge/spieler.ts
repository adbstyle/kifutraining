import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { aendereSpieler, entferneSpieler, ladeSpieler, ladeSpielerliste, nimmSpielerAuf } from "@/lib/kern/spieler";
import { JS_MAX, NAME_MAX, SPIELER_MAX } from "@/lib/spieler";
import { kennung } from "@/lib/mcp/bausteine";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

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
