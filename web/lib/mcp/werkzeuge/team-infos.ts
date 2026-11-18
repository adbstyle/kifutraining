import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { legeTeamInfosFest, leseTeamInfos } from "@/lib/kern/team-infos";
import { TEAM_INFOS_MAX } from "@/lib/team-infos";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Infos zum Team (#598, AK 9) — dünne Adapter über den Fachkern
 * (lib/kern/team-infos.ts), dieselben Funktionen wie die Karte «Infos zum
 * Team» im Team-Bereich.
 */

/** Was jede Beschreibung über die Infos sagt. */
export const TEAM_INFOS_MODELL =
  "Die Infos zum Team sind ein Text je Team für die Eltern: Regelbetrieb und Vorgehen des Teams (Trainingszeiten, " +
  "Abmelden, Ausrüstung). Die Eltern jeder Spieler:in des Teams lesen sie an ihrem privaten Link, mit Teamname und " +
  "Stand (Tag der letzten Textänderung) - nicht, solange die Spieler:in schnuppert (dafür gibt es das Info-Schreiben " +
  "des Schnuppertrainings), und weder im Kalender-Abo noch bei der Selbstabholung. Gliederung: eine Zeile mit «## » " +
  "ist ein Zwischentitel, eine mit «- » ein Aufzählungspunkt, eine mit «1. » ein nummerierter, «**Text**» ist " +
  "hervorgehoben, eine Leerzeile trennt Absätze; Webadressen werden anklickbar. Keine Bilder, Tabellen, Anhänge und " +
  `keine Links mit eigenem Linktext. Höchstens ${TEAM_INFOS_MAX} Zeichen samt Gliederung. Die zuletzt gespeicherte ` +
  "Fassung gilt; frühere bleiben nicht erhalten.";

const TeamInfosAusgabe = z.object({
  team_id: z.string(),
  text: z.string().nullable().describe("Die Infos zum Team; null: keine."),
  stand: z.string().nullable().describe("Tag der letzten Textänderung (YYYY-MM-DD); null ohne Infos."),
});

// ── team_infos_abrufen ──────────────────────────────────────────────────────

export const teamInfosAbrufen = werkzeug({
  name: "team_infos_abrufen",
  titel: "Infos zum Team",
  beschreibung: `Nennt die Infos zum Team eines deiner Teams. ${TEAM_INFOS_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: TeamInfosAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await leseTeamInfos(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team_id: w.teamId,
      text: w.text,
      stand: w.stand,
    })),
});

// ── team_infos_festlegen ────────────────────────────────────────────────────

export const teamInfosFestlegen = werkzeug({
  name: "team_infos_festlegen",
  titel: "Infos zum Team festlegen",
  beschreibung:
    "Verfasst die Infos zum Team eines deiner Teams, ersetzt sie oder entfernt sie (leerer Text). Übergib immer den " +
    "ganzen Text: Für eine Änderung zuerst «team_infos_abrufen», dann den geänderten Text. Die Eltern sehen die neue " +
    `Fassung sofort. ${TEAM_INFOS_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    team_id: TeamId,
    text: z.string().describe(`Der ganze Text, höchstens ${TEAM_INFOS_MAX} Zeichen samt Gliederung; leer entfernt die Infos.`),
  }),
  ausgabe: TeamInfosAusgabe,
  ausfuehren: async (e, zugang) =>
    abgebildet(await legeTeamInfosFest(zugang.supabase, zugang.userId, { teamId: e.team_id, text: e.text }), (w) => ({
      team_id: w.teamId,
      text: w.text,
      stand: w.stand,
    })),
});
