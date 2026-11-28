import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { spielerTeilnahme, teamMeldezeitpunkte, teamTeilnahme } from "@/lib/kern/teilnahme";
import { MELDE_FENSTER, MELDEARTEN, stundenGerundet, type Meldeart } from "@/lib/meldezeitpunkte";
import { TEILNAHME_ERGEBNISSE, teilnahmeTabellenZeile, type TeilnahmeZahlen } from "@/lib/teilnahme";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { SPIELER_KENNUNG_FEHLER, SpielerId } from "@/lib/mcp/werkzeuge/spieler";
import { werkzeug } from "@/lib/mcp/werkzeug";

/* Die Teilnahme-Statistik über den KI-Assistenten: einer Spieler:in (#700
   AK 6), aller Spieler:innen eines Teams (#702 AK 11) und ihre
   Meldezeitpunkte (#703 AK 13). Dieselben Kern-Funktionen wie die Spalte
   neben der Spielerliste und die Reiter «Teilnahme» und «Meldezeitpunkte» —
   dieselbe Spieler:in und derselbe Zeitraum ergeben dieselben Zahlen
   (NFR 3); nur für Mitglieder des Teams (NFR 2). */

const TAG = z.string().describe("Tag als JJJJ-MM-TT, etwa 2026-10-07; leer oder weggelassen lässt diese Seite offen.");

const Gruende = (art: "training" | "spiel") =>
  z
    .object(
      Object.fromEntries(
        TEILNAHME_ERGEBNISSE[art].filter((e) => e !== "da").map((e) => [e, z.number().int()]),
      ) as Record<string, z.ZodNumber>,
    )
    .describe("Die Gründe für «nicht da»; zusammen ergeben sie «nicht_da».");

const Zahlen = (art: "training" | "spiel") =>
  z.object({
    gezaehlt: z.number().int().describe("Gezählte Termine: da und nicht da zusammen."),
    da: z.number().int(),
    nicht_da: z.number().int(),
    gruende: Gruende(art),
  });

const zahlen = (z: TeilnahmeZahlen) => ({
  gezaehlt: z.gesamt,
  da: z.da,
  nicht_da: z.nichtDa,
  gruende: Object.fromEntries(z.gruende.map((g) => [g.grund, g.anzahl])),
});

// ── spieler_teilnahme_abrufen ───────────────────────────────────────────────

export const spielerTeilnahmeAbrufen = werkzeug({
  name: "spieler_teilnahme_abrufen",
  titel: "Teilnahme einer Spieler:in",
  beschreibung:
    "Nennt, wie oft eine Spieler:in eines deiner Teams in einem Zeitraum an Trainings und an Spielen dieses Teams da " +
    "war und aus welchem Grund nicht — je Art die gezählten Termine, «da», «nicht_da» und die Gründe. Gezählt sind " +
    "begonnene Termine, die nicht ausgefallen sind und für sie galten, solange sie auf der Spielerliste stand; " +
    "Termine anderer Teams zählen nicht. Da ist, wer bei Beginn angemeldet war und nicht als «nicht erschienen» " +
    "nachgetragen ist, oder als «doch erschienen» nachgetragen ist; ob jemand die Anwesenheit geprüft hat, hält KiFu " +
    "nicht fest. Gründe bei Trainings: «abgemeldet» (auch: während des Schnupperns nicht angemeldet), " +
    "«nicht_erschienen» (angemeldet, aber nicht erschienen). Bei Spielen dazu «nicht_aufgeboten», " +
    "«meldefrist_verpasst» (ohne Meldung bis zur Frist) und «ohne_meldung» (ohne Meldung an einem Spiel ohne Frist). " +
    "«von» und «bis» schliessen beide Tage ein; ohne beide zählt die ganze Zeit im Team, ein einzelner Tag lässt die " +
    "andere Seite offen. Die Zahlen gelten je Zeitraum; welche einzelnen Termine es waren, nennt «termin_spieler_abrufen». " +
    "Die Angaben betreffen Kinder und Jugendliche: Nenne sie nur, wo es für die Planung nötig ist. " +
    `Fehlerart zum Zeitraum: «eingabe» mit «feld» von oder bis - kein Kalendertag oder Bis vor Von. ${TEAM_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({
    team_id: TeamId,
    spieler_id: SpielerId,
    von: TAG.optional(),
    bis: TAG.optional(),
  }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    spieler: z.object({ id: z.string(), vorname: z.string(), nachname: z.string() }),
    zeitraum: z
      .object({ von: z.string().nullable(), bis: z.string().nullable() })
      .describe("Der gezählte Zeitraum; null: diese Seite offen."),
    trainings: Zahlen("training"),
    spiele: Zahlen("spiel"),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await spielerTeilnahme(zugang.supabase, zugang.userId, {
        teamId: e.team_id,
        spielerId: e.spieler_id,
        von: e.von,
        bis: e.bis,
      }),
      (w) => ({
        team: w.team,
        spieler: w.spieler,
        zeitraum: w.zeitraum,
        trainings: zahlen(w.zahlen.training),
        spiele: zahlen(w.zahlen.spiel),
      }),
    ),
});

// ── team_teilnahme_abrufen ──────────────────────────────────────────────────

export const teamTeilnahmeAbrufen = werkzeug({
  name: "team_teilnahme_abrufen",
  titel: "Teilnahme aller Spieler:innen eines Teams",
  beschreibung:
    "Nennt für jede Spieler:in, die aktuell in einem deiner Teams ist (auch Schnuppernde; wer das Team verlassen hat, " +
    "fehlt), wie oft sie in einem Zeitraum an Trainings und an Spielen dieses Teams da war und aus welchem Grund nicht " +
    "— dieselben Zahlen und Zählregeln wie «spieler_teilnahme_abrufen» für eine einzelne Spieler:in. Je Art die " +
    "gezählten Termine, «da», «nicht_da» und die Gründe; bei Spielen zusätzlich «nicht_gemeldet», die Summe aus " +
    "«meldefrist_verpasst» und «ohne_meldung». «nicht_erschienen» heisst: angemeldet und ohne Abmeldung gefehlt. " +
    "Gezählt sind begonnene Termine, die nicht ausgefallen sind und für die Spieler:in galten, solange sie auf der " +
    "Spielerliste stand. «von» und «bis» schliessen beide Tage ein; ohne beide zählt die ganze Zeit im Team, ein " +
    "einzelner Tag lässt die andere Seite offen. Spieler:innen ohne gezählten Termin stehen mit 0 da. Die Zahlen " +
    "bewerten niemanden: Stelle keine Rangliste auf und markiere niemanden, ausser es wird ausdrücklich danach gefragt. " +
    "Die Angaben betreffen Kinder und Jugendliche: Nenne sie nur, wo es für die Planung nötig ist. " +
    `Fehlerart zum Zeitraum: «eingabe» mit «feld» von oder bis - kein Kalendertag oder Bis vor Von. ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({
    team_id: TeamId,
    von: TAG.optional(),
    bis: TAG.optional(),
  }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    zeitraum: z
      .object({ von: z.string().nullable(), bis: z.string().nullable() })
      .describe("Der gezählte Zeitraum; null: diese Seite offen."),
    spieler: z
      .array(
        z.object({
          id: z.string(),
          vorname: z.string(),
          nachname: z.string(),
          trainings: Zahlen("training"),
          spiele: Zahlen("spiel").extend({
            nicht_gemeldet: z.number().int().describe("«meldefrist_verpasst» und «ohne_meldung» zusammen."),
          }),
        }),
      )
      .describe("Alle Spieler:innen des Teams, nach Vorname und Nachname."),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await teamTeilnahme(zugang.supabase, zugang.userId, { teamId: e.team_id, von: e.von, bis: e.bis }),
      (w) => ({
        team: w.team,
        zeitraum: w.zeitraum,
        spieler: w.spieler.map((s) => ({
          id: s.id,
          vorname: s.vorname,
          nachname: s.nachname,
          trainings: zahlen(s.zahlen.training),
          spiele: { ...zahlen(s.zahlen.spiel), nicht_gemeldet: teilnahmeTabellenZeile(s.zahlen).gNg },
        })),
      }),
    ),
});

// ── team_meldezeitpunkte_abrufen ────────────────────────────────────────────

const proMeldeart = <T extends z.ZodTypeAny>(wert: T) =>
  z.object(Object.fromEntries(MELDEARTEN.map((m) => [m, wert])) as Record<Meldeart, T>);
const jeMeldeart = <T>(f: (m: Meldeart) => T) => Object.fromEntries(MELDEARTEN.map((m) => [m, f(m)])) as Record<Meldeart, T>;

export const teamMeldezeitpunkteAbrufen = werkzeug({
  name: "team_meldezeitpunkte_abrufen",
  titel: "Meldezeitpunkte der Spieler:innen eines Teams",
  beschreibung:
    "Nennt, wie lange vor Beginn bzw. Anpfiff sich die Spieler:innen eines deiner Teams in einem Zeitraum von " +
    "Trainings abgemeldet und zu Spielen an- und abgemeldet haben. Je Spieler:in, die aktuell im Team ist (auch " +
    "Schnuppernde; wer das Team verlassen hat, fehlt), je Meldeart «training_abmeldung», «spiel_anmeldung» und " +
    "«spiel_abmeldung» den Median in Stunden (eine Nachkommastelle; null: keine Meldung mit festgehaltenem Zeitpunkt) " +
    "und auf wie vielen Meldungen er beruht. Für das Team je Meldeart die Anzahl Meldungen in fünf Fenstern: " +
    `${MELDE_FENSTER.map((f) => `«${f.label}»`).join(", ")}; ein Grenzwert zählt ins Fenster, das dort endet ` +
    "(genau 3 Tage vor Beginn zählt zu «1–3 Tage», genau 24 Stunden zu «6–24 Stunden»). Dazu, getrennt davon und " +
    "nicht in Fenstern und Medianen, «ohne_abmeldung_gefehlt» (angemeldet und nicht erschienen, für Trainings und " +
    "Spiele) und «nicht_gemeldet» (Spiele: Meldefrist verpasst oder ohne Meldung) — dieselben Zahlen wie in " +
    "«team_teilnahme_abrufen». Bezug ist Beginn bzw. Anpfiff, nicht die Meldefrist. Je Termin zählt nur der zuletzt " +
    "gültige Wechsel, egal wer ihn gesetzt hat; bei Trainings nur Abmeldungen, bei Spielen jede An- und Abmeldung, " +
    "auch wenn die Spieler:in danach nicht aufgeboten wurde oder nicht erschien. Nur Meldungen vor Beginn, zu " +
    "begonnenen, nicht ausgefallenen Terminen, die für die Spieler:in galten. Zeitpunkte gibt es erst seit dem " +
    "19.10.2026 (Trainings) bzw. 21.10.2026 (Spiele); eine Verlegung auf einen anderen Tag löscht sie. «von» und " +
    "«bis» schliessen beide Tage ein; ohne beide zählt die ganze Zeit im Team. Die Zahlen bewerten niemanden: " +
    "Stelle keine Rangliste auf und markiere niemanden, ausser es wird ausdrücklich danach gefragt. " +
    "Die Angaben betreffen Kinder und Jugendliche: Nenne sie nur, wo es für die Planung nötig ist. " +
    `Fehlerart zum Zeitraum: «eingabe» mit «feld» von oder bis - kein Kalendertag oder Bis vor Von. ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({
    team_id: TeamId,
    von: TAG.optional(),
    bis: TAG.optional(),
  }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    zeitraum: z
      .object({ von: z.string().nullable(), bis: z.string().nullable() })
      .describe("Der gezählte Zeitraum; null: diese Seite offen."),
    spieler: z
      .array(
        z.object({
          id: z.string(),
          vorname: z.string(),
          nachname: z.string(),
          mediane_stunden: proMeldeart(z.number().nullable()).describe(
            "Median vor Beginn bzw. Anpfiff in Stunden; null: keine Meldung mit festgehaltenem Zeitpunkt.",
          ),
          anzahl: proMeldeart(z.number().int()).describe("Auf wie vielen Meldungen der Median beruht."),
        }),
      )
      .describe("Alle Spieler:innen des Teams, nach Vorname und Nachname."),
    team_zahlen: z.object({
      fenster: proMeldeart(
        z.object(Object.fromEntries(MELDE_FENSTER.map((f) => [f.label, z.number().int()])) as Record<string, z.ZodNumber>),
      ).describe("Anzahl Meldungen je Fenster, über alle Spieler:innen des Teams."),
      ohne_abmeldung_gefehlt: z.object({ trainings: z.number().int(), spiele: z.number().int() }),
      nicht_gemeldet: z.number().int().describe("Spiele: «meldefrist_verpasst» und «ohne_meldung» zusammen."),
    }),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await teamMeldezeitpunkte(zugang.supabase, zugang.userId, { teamId: e.team_id, von: e.von, bis: e.bis }),
      (w) => ({
        team: w.team,
        zeitraum: w.zeitraum,
        spieler: w.spieler.map((s) => ({
          id: s.id,
          vorname: s.vorname,
          nachname: s.nachname,
          mediane_stunden: jeMeldeart((m) => stundenGerundet(s.mediane[m])),
          anzahl: s.anzahl,
        })),
        team_zahlen: {
          fenster: jeMeldeart((m) => Object.fromEntries(MELDE_FENSTER.map((f, i) => [f.label, w.fenster[m][i]]))),
          ohne_abmeldung_gefehlt: {
            trainings: w.summen.ohneAbmeldungGefehlt.training,
            spiele: w.summen.ohneAbmeldungGefehlt.spiel,
          },
          nicht_gemeldet: w.summen.nichtGemeldet,
        },
      }),
    ),
});
