import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { legeProbetrainingFest, leseProbetraining, schalteProbe } from "@/lib/kern/probe";
import { PROBE_ANZAHL_MAX, PROBE_ANZAHL_MIN } from "@/lib/probe";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { SPIELER_KENNUNG_FEHLER, SpielerId } from "@/lib/mcp/werkzeuge/spieler";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Probetraining (Epic #554, Story #555) — dünne Adapter über den Fachkern
 * (lib/kern/probe.ts), dieselben Funktionen wie die Karte «Probetraining» und
 * der Dialog «Spieler:in ändern» im Team-Bereich.
 */

/** Was jede Beschreibung eines Probe-Werkzeugs über das Modell sagt. */
export const PROBE_MODELL =
  "Ein Team kann Spieler:innen der Spielerliste in den Probe-Modus schalten. Eine Probe-Spieler:in ist an Trainings " +
  "zuerst nicht angemeldet und wird angemeldet - über ihren privaten Link von den Eltern, höchstens für so viele " +
  `Trainings, wie das Team festlegt (die Anzahl, ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX}; besuchte und künftig ` +
  "angemeldete zählen). Mitglieder (und du) melden sie ohne diese Grenze an; geht eine Anmeldung über die Anzahl, " +
  "kommt «hinweis» mit dem Stand zurück. Spiele gelten für sie nicht. Einschalten geht nur, wenn das Team eine " +
  "Anzahl festgelegt hat; es lässt Abmeldungen von kommenden Trainings, Meldungen zu kommenden Spielen und " +
  "Kennzeichnungen als nicht aufgeboten verfallen - dann kommt zuerst ein Fehler mit «verfallend» (Anzahl); frag nach " +
  "und wiederhole den Aufruf mit «bestaetigt: true». Ausschalten macht sie an allen kommenden Trainings angemeldet und " +
  "lässt Spiele wieder für sie gelten; schaltet man später wieder ein, zählt es ab null. Begonnene Termine behalten " +
  "den Stand bei Beginn.";

const Anzahl = z
  .number()
  .int()
  .describe(`Wie viele Trainings eine Probe-Spieler:in besuchen darf, ${PROBE_ANZAHL_MIN} bis ${PROBE_ANZAHL_MAX}.`);

const ProbetrainingAusgabe = z.object({
  team_id: z.string(),
  anzahl: z.number().int().nullable().describe("null: Das Team hat noch keine Anzahl festgelegt."),
});

// ── probetraining_abrufen ───────────────────────────────────────────────────

export const probetrainingAbrufen = werkzeug({
  name: "probetraining_abrufen",
  titel: "Probetraining eines Teams",
  beschreibung:
    "Nennt die Anzahl Probetrainings eines deiner Teams. Wer im Probe-Modus ist und wie weit, nennt " +
    `«spielerliste_abrufen» («probe»). ${PROBE_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: ProbetrainingAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await leseProbetraining(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team_id: w.teamId,
      anzahl: w.anzahl,
    })),
});

// ── probetraining_festlegen ─────────────────────────────────────────────────

export const probetrainingFestlegen = werkzeug({
  name: "probetraining_festlegen",
  titel: "Anzahl Probetrainings festlegen",
  beschreibung:
    "Legt die Anzahl Probetrainings eines deiner Teams fest oder ändert sie; sie gilt sofort für alle " +
    "Probe-Spieler:innen des Teams. Bestehende Anmeldungen bleiben, auch über einer kleineren Anzahl. Entfernen lässt " +
    `sie sich nicht. ${PROBE_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ team_id: TeamId, anzahl: Anzahl }),
  ausgabe: ProbetrainingAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await legeProbetrainingFest(zugang.supabase, zugang.userId, { teamId: e.team_id, anzahl: e.anzahl }), (w) => ({
      team_id: w.teamId,
      anzahl: w.anzahl,
    })),
});

// ── spieler_probe_setzen ────────────────────────────────────────────────────

export const spielerProbeSetzen = werkzeug({
  name: "spieler_probe_setzen",
  titel: "Probe-Modus ein- oder ausschalten",
  beschreibung:
    "Schaltet den Probe-Modus einer Spieler:in ein («probe: true») oder aus («probe: false»). Frag vorher nach, ob " +
    `das so gewollt ist. ${PROBE_MODELL} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    spieler_id: SpielerId,
    probe: z.boolean(),
    bestaetigt: z
      .boolean()
      .optional()
      .describe("Nur nötig, wenn das Einschalten Abmeldungen, Meldungen oder Kennzeichnungen verfallen lässt (Fehler mit «verfallend»)."),
  }),
  ausgabe: z.object({
    spieler_id: z.string(),
    team_id: z.string(),
    probe: z.boolean(),
    verfallen: z.number().int().describe("Wie viele Abmeldungen, Meldungen und Kennzeichnungen das Einschalten verfallen liess."),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await schalteProbe(zugang.supabase, zugang.userId, {
        spielerId: e.spieler_id,
        probe: e.probe,
        bestaetigt: e.bestaetigt ? true : undefined,
      }),
      (w) => ({ spieler_id: w.spielerId, team_id: w.teamId, probe: w.probe, verfallen: w.verfallen }),
    ),
});
