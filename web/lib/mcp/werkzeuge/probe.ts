import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { legeProbetrainingFest, leseProbetraining, schalteProbe } from "@/lib/kern/probe";
import { eigenesTeamVon } from "@/lib/kern/spieler";
import { PROBE_ANZAHL_MAX, PROBE_ANZAHL_MIN, PROBE_INFO_MAX } from "@/lib/probe";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { SPIELER_KENNUNG_FEHLER, SpielerId } from "@/lib/mcp/werkzeuge/spieler";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Schnuppertraining (Epic #554, Story #555, #584; intern `probe`) — dünne
 * Adapter über den Fachkern (lib/kern/probe.ts), dieselben Funktionen wie die
 * Karte «Schnuppertraining» und der Dialog «Spieler:in ändern» im
 * Team-Bereich. Nach aussen heisst es überall «Schnuppern»; die Werkzeuge
 * ohne Übergang (Epic Vereine, OoS 3).
 */

/** Was jede Beschreibung eines Schnupper-Werkzeugs über das Modell sagt. */
export const SCHNUPPER_MODELL =
  "Ein Team kann Spieler:innen der Spielerliste schnuppern lassen - aber nur, solange sie genau diesem einen Team " +
  "zugeordnet sind: Wer weiteren Teams angehört, macht regulär mit und schnuppert nicht; wer schnuppert, lässt sich " +
  "keinem weiteren Team zuordnen. Eine schnuppernde Spieler:in ist an Trainings " +
  "zuerst nicht angemeldet und wird angemeldet - über ihren privaten Link von den Eltern, höchstens für so viele " +
  `Trainings, wie das Team festlegt (die Anzahl, ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX}; besuchte und künftig ` +
  "angemeldete zählen). Mitglieder (und du) melden sie ohne diese Grenze an; geht eine Anmeldung über die Anzahl, " +
  "kommt «hinweis» mit dem Stand zurück. Spiele gelten für sie nicht. Einschalten geht nur, wenn das Team eine " +
  "Anzahl festgelegt hat; es lässt Abmeldungen von kommenden Trainings, Meldungen zu kommenden Spielen und " +
  "Kennzeichnungen als nicht aufgeboten verfallen - dann kommt zuerst ein Fehler mit «verfallend» (Anzahl); frag nach " +
  "und wiederhole den Aufruf mit «bestaetigt: true». Ausschalten macht sie an allen kommenden Trainings angemeldet und " +
  "lässt Spiele wieder für sie gelten; schaltet man später wieder ein, zählt es ab null. Begonnene Termine behalten " +
  "den Stand bei Beginn. Zur Anzahl kann das Team ein Info-Schreiben führen: reiner Text, höchstens " +
  `${PROBE_INFO_MAX} Zeichen, Zeilenumbrüche bleiben, Webadressen werden im Link anklickbar. Es steht im privaten Link ` +
  "jeder schnuppernden Spieler:in, sonst nirgends - nicht im Kalender-Abo, nicht bei der Selbstabholung.";

const Anzahl = z
  .number()
  .int()
  .describe(`Wie viele Trainings eine schnuppernde Spieler:in besuchen darf, ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX}.`);

const SchnuppertrainingAusgabe = z.object({
  team_id: z.string(),
  anzahl: z.number().int().nullable().describe("null: Das Team hat noch keine Anzahl festgelegt."),
  info: z.string().nullable().describe("Das Info-Schreiben für schnuppernde Spieler:innen; null: keines."),
});

// ── schnuppertraining_abrufen ───────────────────────────────────────────────────

export const schnuppertrainingAbrufen = werkzeug({
  name: "schnuppertraining_abrufen",
  titel: "Schnuppertraining eines Teams",
  beschreibung:
    "Nennt die Anzahl Schnuppertrainings eines deiner Teams und sein Info-Schreiben. Wer schnuppert und wie weit, nennt " +
    `«spielerliste_abrufen» («schnuppert»). ${SCHNUPPER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: SchnuppertrainingAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await leseProbetraining(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team_id: w.teamId,
      anzahl: w.anzahl,
      info: w.info,
    })),
});

// ── schnuppertraining_festlegen ─────────────────────────────────────────────────

export const schnuppertrainingFestlegen = werkzeug({
  name: "schnuppertraining_festlegen",
  titel: "Anzahl Schnuppertrainings festlegen",
  beschreibung:
    "Legt die Anzahl Schnuppertrainings eines deiner Teams fest oder ändert sie, und, falls angegeben, das " +
    "Info-Schreiben («info» weglassen lässt es unverändert, leer entfernt es). Beides gilt sofort für alle " +
    "schnuppernden Spieler:innen des Teams. Bestehende Anmeldungen bleiben, auch über einer kleineren Anzahl. Die Anzahl " +
    `lässt sich nicht entfernen. ${SCHNUPPER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    anzahl: Anzahl,
    info: z.string().optional().describe(`Das Info-Schreiben, reiner Text, höchstens ${PROBE_INFO_MAX} Zeichen; leer entfernt es.`),
  }),
  ausgabe: SchnuppertrainingAusgabe,
  ausfuehren: async (e, zugang) => {
    let info = e.info;
    if (info === undefined) {
      const bisher = await leseProbetraining(zugang.supabase, zugang.userId, { teamId: e.team_id });
      if (!bisher.ok) return bisher;
      info = bisher.wert.info ?? "";
    }
    return abgebildet(
      await legeProbetrainingFest(zugang.supabase, zugang.userId, { teamId: e.team_id, anzahl: e.anzahl, info }),
      (w) => ({ team_id: w.teamId, anzahl: w.anzahl, info: w.info }),
    );
  },
});

// ── spieler_schnuppern_setzen ────────────────────────────────────────────────────

export const spielerSchnuppernSetzen = werkzeug({
  name: "spieler_schnuppern_setzen",
  titel: "Schnuppern ein- oder ausschalten",
  beschreibung:
    "Schaltet das Schnuppern einer Spieler:in ein («schnuppern: true») oder aus («schnuppern: false»), im ältesten " +
    "ihrer Teams, dem du angehörst. Gehört sie weiteren Teams an, weist das Werkzeug das Einschalten ab. Frag vorher " +
    `nach, ob das so gewollt ist. ${SCHNUPPER_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    spieler_id: SpielerId,
    schnuppern: z.boolean(),
    bestaetigt: z
      .boolean()
      .optional()
      .describe("Nur nötig, wenn das Einschalten Abmeldungen, Meldungen oder Kennzeichnungen verfallen lässt (Fehler mit «verfallend»)."),
  }),
  ausgabe: z.object({
    spieler_id: z.string(),
    team_id: z.string(),
    schnuppert: z.boolean(),
    verfallen: z.number().int().describe("Wie viele Abmeldungen, Meldungen und Kennzeichnungen das Einschalten verfallen liess."),
  }),
  ausfuehren: async (e, zugang) => {
    // Das Team gibt es nicht als Eingabe: Schnuppern hängt an der einen Zuordnung.
    const team = await eigenesTeamVon(zugang.supabase, e.spieler_id);
    if (!team.ok) return team;
    return abgebildet(
      await schalteProbe(zugang.supabase, zugang.userId, {
        teamId: team.wert,
        spielerId: e.spieler_id,
        probe: e.schnuppern,
        bestaetigt: e.bestaetigt ? true : undefined,
      }),
      (w) => ({ spieler_id: w.spielerId, team_id: w.teamId, schnuppert: w.probe, verfallen: w.verfallen }),
    );
  },
});
