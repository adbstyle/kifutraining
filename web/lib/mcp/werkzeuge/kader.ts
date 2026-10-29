import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { aendereZuteilung, benenneKaderUm, entferneKader, ladeEinenKader, ladeKader, legeKaderAn } from "@/lib/kern/kader";
import { KADER_MAX, KADER_NAME_MAX, KADER_TEXT } from "@/lib/kader";
import { kennung } from "@/lib/mcp/bausteine";
import { TEAM_KENNUNG_FEHLER, TeamId } from "@/lib/mcp/werkzeuge/trainings";
import { SPIELER_KENNUNG_FEHLER, SpielerId } from "@/lib/mcp/werkzeuge/spieler";
import { werkzeug, type Zugang } from "@/lib/mcp/werkzeug";

/**
 * Die Kader eines Teams (Epic #447, Story #452) — dünne Adapter über den
 * Fachkern (lib/kern/kader.ts), dieselben Funktionen wie die Karte «Kader»
 * und die Spielerliste im Team-Bereich (AK 14, 15).
 */

/** Was jede Beschreibung eines Kader-Werkzeugs über das Modell sagt. */
export const KADER_MODELL =
  "Ein Team kann Kader führen - benannte Teile des Teams wie «Stärkeklasse 1», «Torhüterinnen» oder «Aushilfe». Eine " +
  `Spieler:in der Spielerliste gehört keinem, einem oder mehreren an; höchstens ${KADER_MAX} Kader je Team, jedes ` +
  `Mitglied führt sie. Ein Name hat 1 bis ${KADER_NAME_MAX} Zeichen und steht im Team nur einmal; Gross- und ` +
  "Kleinschreibung und überzählige Leerzeichen unterscheiden nicht. Ein Termin oder eine Terminserie mit Kadern gilt für " +
  "die Spieler:innen, die mindestens einem davon angehören, ohne Kader für alle; nur sie zählen, sehen ihn am privaten " +
  "Link und lassen sich dafür ab- und anmelden. Fällt eine Spieler:in durch eine Änderung aus einem anstehenden Termin, " +
  "für den sie abgemeldet war, verfällt die Abmeldung (bei einer Probe-Spieler:in die Anmeldung): Dann kommt zuerst ein Fehler mit «verfallend» (Anzahl); frag " +
  "nach und wiederhole den Aufruf mit «bestaetigt: true». Begonnene Termine behalten den Stand bei Beginn. " +
  `${KADER_TEXT.heikel}`;

export const KaderId = kennung("Kennung eines Kaders («id» aus «kader_abrufen»).");

export const KADER_KENNUNG_FEHLER =
  "Fehlerart zur Kader-Kennung: «nicht_gefunden» - kein Kader eines deiner Teams (es gibt ihn nicht, er wurde " +
  "entfernt, oder er gehört einem fremden Team; bewusst nicht unterscheidbar).";

const NAME = z.string().describe(`Name des Kaders, 1 bis ${KADER_NAME_MAX} Zeichen.`);

const Bestaetigt = z
  .boolean()
  .optional()
  .describe("Nur nötig, wenn die Änderung Abmeldungen verfallen lässt (Fehler mit «verfallend»).");

const SpielerIds = z
  .array(SpielerId)
  .describe("Kennungen von Spieler:innen dieses Teams («id» aus «spielerliste_abrufen»).");

const KaderAusgabe = z.object({
  id: z.string(),
  name: z.string(),
  spieler_ids: z.array(z.string()).describe("Wer dem Kader angehört."),
});

// ── kader_abrufen ───────────────────────────────────────────────────────────

export const kaderAbrufen = werkzeug({
  name: "kader_abrufen",
  titel: "Kader eines Teams",
  beschreibung:
    "Nennt die Kader eines deiner Teams nach Namen, je mit den Spieler:innen, die ihm angehören. Namen und Jahrgang " +
    `der Spieler:innen nennt «spielerliste_abrufen». ${KADER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ team_id: TeamId }),
  ausgabe: z.object({
    team: z.object({ id: z.string(), name: z.string() }),
    kader: z.array(KaderAusgabe),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await ladeKader(zugang.supabase, zugang.userId, { teamId: e.team_id }), (w) => ({
      team: w.team,
      kader: w.kader.map((k) => ({ id: k.id, name: k.name, spieler_ids: k.spielerIds })),
    })),
});

// ── kader_anlegen / kader_umbenennen ────────────────────────────────────────

export const kaderAnlegen = werkzeug({
  name: "kader_anlegen",
  titel: "Kader anlegen",
  beschreibung: `Legt in einem deiner Teams einen Kader an, noch ohne Spieler:innen. ${KADER_MODELL} ${TEAM_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ team_id: TeamId, name: NAME }),
  ausgabe: z.object({ kader_id: z.string(), team_id: z.string(), name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await legeKaderAn(zugang.supabase, zugang.userId, { teamId: e.team_id, name: e.name }), (w) => ({
      kader_id: w.kaderId,
      team_id: w.teamId,
      name: w.name,
    })),
});

export const kaderUmbenennen = werkzeug({
  name: "kader_umbenennen",
  titel: "Kader umbenennen",
  beschreibung: `Gibt einem Kader einen neuen Namen; er gilt überall, auch an vergangenen Terminen. ${KADER_MODELL} ${KADER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kader_id: KaderId, name: NAME }),
  ausgabe: z.object({ kader_id: z.string(), team_id: z.string(), name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await benenneKaderUm(zugang.supabase, zugang.userId, { kaderId: e.kader_id, name: e.name }), (w) => ({
      kader_id: w.kaderId,
      team_id: w.teamId,
      name: w.name,
    })),
});

// ── kader_entfernen ─────────────────────────────────────────────────────────

export const kaderEntfernen = werkzeug({
  name: "kader_entfernen",
  titel: "Kader entfernen",
  beschreibung:
    "Entfernt einen Kader. Seine Spieler:innen bleiben auf der Spielerliste. Anstehende Termine und Serien, die nur ihn " +
    "trugen, gelten danach für alle (frag vorher «team_plan_abrufen», welche es sind); begonnene Termine zeigen ihn als " +
    `ehemaligen Kader. Frag vorher nach, ob er wirklich gemeint ist. ${KADER_MODELL} ${KADER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kader_id: KaderId, bestaetigt: Bestaetigt }),
  ausgabe: z.object({
    team_id: z.string(),
    name: z.string(),
    abmeldungen_verfallen: z.number().int().describe("Wie viele Abmeldungen das Entfernen verfallen liess."),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneKader(zugang.supabase, zugang.userId, { kaderId: e.kader_id, bestaetigt: e.bestaetigt ? true : undefined }),
      (w) => ({ team_id: w.teamId, name: w.name, abmeldungen_verfallen: w.verfallen }),
    ),
});

// ── kader_zuteilen / kader_herausnehmen ─────────────────────────────────────

const ZuteilungAusgabe = z.object({
  kader_id: z.string(),
  team_id: z.string(),
  geaendert: z.number().int().describe("Bei wie vielen der genannten Spieler:innen sich etwas änderte."),
  abmeldungen_verfallen: z.number().int().describe("Wie viele Abmeldungen die Änderung verfallen liess."),
});

/** Zuteilen und herausnehmen teilen den Weg über die Zuteilung des Teams. */
async function zuteilung(
  zugang: Zugang,
  e: { kader_id: string; spieler_ids: string[]; bestaetigt?: boolean },
  richtung: "dazu" | "weg",
) {
  const k = await ladeEinenKader(zugang.supabase, e.kader_id);
  if (!k.ok) return k;
  return abgebildet(
    await aendereZuteilung(zugang.supabase, zugang.userId, {
      teamId: k.wert.teamId,
      spielerIds: e.spieler_ids,
      [richtung]: [e.kader_id],
      bestaetigt: e.bestaetigt ? true : undefined,
    }),
    (w) => ({
      kader_id: e.kader_id,
      team_id: w.teamId,
      geaendert: richtung === "dazu" ? w.dazu : w.weg,
      abmeldungen_verfallen: w.verfallen,
    }),
  );
}

export const kaderZuteilen = werkzeug({
  name: "kader_zuteilen",
  titel: "Spieler:innen einem Kader zuteilen",
  beschreibung:
    "Teilt Spieler:innen einem Kader zu; wer schon dabei ist, bleibt. Eine Spieler:in kann mehreren Kadern angehören. " +
    `${KADER_MODELL} ${KADER_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kader_id: KaderId, spieler_ids: SpielerIds }),
  ausgabe: ZuteilungAusgabe,
  ausfuehren: async (e, zugang) => zuteilung(zugang, e, "dazu"),
});

export const kaderHerausnehmen = werkzeug({
  name: "kader_herausnehmen",
  titel: "Spieler:innen aus einem Kader nehmen",
  beschreibung:
    "Nimmt Spieler:innen aus einem Kader; sie bleiben auf der Spielerliste und in ihren übrigen Kadern. " +
    `${KADER_MODELL} ${KADER_KENNUNG_FEHLER} ${SPIELER_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kader_id: KaderId, spieler_ids: SpielerIds, bestaetigt: Bestaetigt }),
  ausgabe: ZuteilungAusgabe,
  ausfuehren: async (e, zugang) => zuteilung(zugang, e, "weg"),
});
