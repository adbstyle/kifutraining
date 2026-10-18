import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  KADER_MELDUNG,
  kaderNameProblem,
  kaderVerfallBestaetigen,
  kaderVerfallGeaendert,
  nachKaderName,
  verfallAusFehler,
  type Kader,
} from "@/lib/kader";
import { bereinigeName, SPIELER_MELDUNG } from "@/lib/spieler";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { TERMIN_MELDUNG } from "@/lib/termin";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Die Kader eines Teams (Epic #447, Story #452): einsehen, anlegen,
 * umbenennen, entfernen, Spieler:innen zuteilen und herausnehmen —
 * dieselben Funktionen für die Karte «Kader» und die Spielerliste im
 * Team-Bereich und die KI-Werkzeuge «kader_*».
 *
 * Geschrieben wird nur über die RPCs `kader_*`. Sie halten vorher den Stand
 * begonnener Termine fest und lassen Abmeldungen nur verfallen, wenn genau
 * deren Zahl bestätigt ist (#453 AK 10, 12): Sonst weisen sie mit der Zahl ab
 * («ABMELDUNGEN_VERFALLEN n»), und nichts ist geschrieben.
 */

const KADER_FELD = { feld: "kader_id" } as const;

/** Was eine Änderung mit verfallenden Abmeldungen bestätigt: die Zahl, die
 *  die Oberfläche genannt hat, oder `true` (KI: was es ist, AK 16). */
export type VerfallBestaetigt = number | true | undefined;

type KaderRoh = { id: string; name: string; kader_spieler: { spieler_id: string }[] | null };

function ausRoh(k: KaderRoh): Kader {
  return { id: k.id, name: k.name, spielerIds: (k.kader_spieler ?? []).map((z) => z.spieler_id) };
}

/** Ein Fehler der Kader-RPCs als Kern-Fehler. `verfallen` ist schon
 *  abgefangen (`mitVerfall`). */
function kaderFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("KADER_NICHT_GEFUNDEN")) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  if (e.message.includes("TEAM_NICHT_GEFUNDEN")) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("SPIELER_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_ids" });
  if (e.message.includes("KADER_DOPPELT")) return fehlschlag("regel", KADER_MELDUNG.KADER_DOPPELT, { feld: "name" });
  if (e.message.includes("KADER_VOLL")) return fehlschlag("regel", KADER_MELDUNG.KADER_VOLL);
  if (e.message.includes("KADER_TERMIN_BEGONNEN"))
    return fehlschlag("regel", KADER_MELDUNG.KADER_TERMIN_BEGONNEN, { feld: "kader_ids" });
  if (e.message.includes("TERMIN_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN, { feld: "termin_id" });
  return ausDbFehler(e);
}

/**
 * Eine RPC, die Abmeldungen verfallen lassen kann (#453 AK 10, 12, 16).
 *
 * Die Datenebene zählt in derselben Transaktion, was verfiele, und schreibt
 * nur, wenn `p_bestaetigt` genau diese Zahl nennt. Die Oberfläche sendet die
 * Zahl, die sie genannt hat — stimmt sie nicht mehr, kommt der aktuelle Stand
 * zurück (AK 12). Die KI bestätigt mit `true`: Dann wiederholt der Kern den
 * Aufruf einmal mit der gemeldeten Zahl.
 */
export async function mitVerfall<T>(
  bestaetigt: VerfallBestaetigt,
  aufruf: (zahl: number | null) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
  fehler: (e: { message: string; code?: string }) => KernFehler,
): Promise<KernErgebnis<T>> {
  const zahl = typeof bestaetigt === "number" ? bestaetigt : null;
  const erst = await aufruf(zahl);
  if (!erst.error) return ok(erst.data as T);
  const n = verfallAusFehler(erst.error.message);
  if (n === null) return fehler(erst.error);
  // Eine Zahl, die nicht mehr stimmt: der aktuelle Stand (AK 12).
  if (zahl !== null) return verfallNachfrage(kaderVerfallGeaendert(n), n);
  if (bestaetigt !== true) return verfallNachfrage(kaderVerfallBestaetigen(n), n);
  // Die KI bestätigt, was es ist: einmal mit der gemeldeten Zahl.
  const dann = await aufruf(n);
  if (!dann.error) return ok(dann.data as T);
  const m = verfallAusFehler(dann.error.message);
  return m === null ? fehler(dann.error) : verfallNachfrage(kaderVerfallBestaetigen(m), m, true);
}

function verfallNachfrage(meldung: string, n: number, wiederholbar = false): KernFehler {
  return fehlschlag("regel", meldung, { feld: "bestaetigt", verfallend: n, ...(wiederholbar && { wiederholbar }) });
}

function namensFehler(name: string): KernFehler | null {
  const p = kaderNameProblem(name);
  return p ? fehlschlag("eingabe", p, { feld: "name" }) : null;
}

/** Die Kader eines Teams samt Zuteilung, nach Namen (AK 12). */
export async function ladeKader(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ team: { id: string; name: string }; kader: Kader[] }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase.from("kader").select("id, name, kader_spieler(spieler_id)").eq("team_id", e.teamId);
  if (error) return ausDbFehler(error);
  return ok({ team: team.wert, kader: nachKaderName(((data ?? []) as KaderRoh[]).map(ausRoh)) });
}

/** Ein Kader samt Team, soweit die RLS ihn zeigt. */
export async function ladeEinenKader(
  supabase: SupabaseClient,
  kaderId: string,
): Promise<KernErgebnis<Kader & { teamId: string }>> {
  if (!istUuid(kaderId)) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  const { data, error } = await supabase
    .from("kader")
    .select("id, name, team_id, kader_spieler(spieler_id)")
    .eq("id", kaderId)
    .maybeSingle<KaderRoh & { team_id: string }>();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  return ok({ ...ausRoh(data), teamId: data.team_id });
}

/** Einen Kader anlegen (AK 1, 10, 11). */
export async function legeKaderAn(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; name: string },
): Promise<KernErgebnis<{ kaderId: string; teamId: string; name: string }>> {
  const problem = namensFehler(e.name);
  if (problem) return problem;
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const name = bereinigeName(e.name);
  const { data, error } = await supabase.rpc("kader_anlegen", { p_team: e.teamId, p_name: name });
  if (error) return kaderFehler(error);
  return ok({ kaderId: data as string, teamId: e.teamId, name });
}

/** Einen Kader umbenennen (AK 2, 10, PC 2). */
export async function benenneKaderUm(
  supabase: SupabaseClient,
  _userId: string,
  e: { kaderId: string; name: string },
): Promise<KernErgebnis<{ kaderId: string; teamId: string; name: string }>> {
  const problem = namensFehler(e.name);
  if (problem) return problem;
  if (!istUuid(e.kaderId)) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  const name = bereinigeName(e.name);
  const { data, error } = await supabase.rpc("kader_umbenennen", { p_kader: e.kaderId, p_name: name });
  if (error) return kaderFehler(error);
  return ok({ kaderId: e.kaderId, teamId: data as string, name });
}

/** Einen Kader entfernen (AK 3, PC 1): Seine Spieler:innen bleiben auf der
 *  Liste. `verfallen`: wie viele Abmeldungen damit verfielen (#453). */
export async function entferneKader(
  supabase: SupabaseClient,
  _userId: string,
  e: { kaderId: string; bestaetigt?: VerfallBestaetigt },
): Promise<KernErgebnis<{ teamId: string; name: string; verfallen: number }>> {
  const k = await ladeEinenKader(supabase, e.kaderId);
  if (!k.ok) return k;
  const r = await mitVerfall<{ team: string; verfallen: number }>(
    e.bestaetigt,
    (zahl) => supabase.rpc("kader_entfernen", { p_kader: e.kaderId, p_bestaetigt: zahl }),
    kaderFehler,
  );
  return r.ok ? ok({ teamId: r.wert.team, name: k.wert.name, verfallen: r.wert.verfallen }) : r;
}

/** Spieler:innen Kadern zuteilen und aus Kadern nehmen, in einem Schritt
 *  (AK 5, 6). Wer schon dabei ist bzw. fehlt, bleibt, wie er ist. */
export async function aendereZuteilung(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerIds: string[]; dazu?: string[]; weg?: string[]; bestaetigt?: VerfallBestaetigt },
): Promise<KernErgebnis<{ teamId: string; dazu: number; weg: number; verfallen: number }>> {
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (!e.spielerIds.every(istUuid))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_ids" });
  if (![...(e.dazu ?? []), ...(e.weg ?? [])].every(istUuid))
    return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  const r = await mitVerfall<{ dazu: number; weg: number; verfallen: number }>(
    e.bestaetigt,
    (zahl) =>
      supabase.rpc("kader_zuteilung_aendern", {
        p_team: e.teamId,
        p_spieler: e.spielerIds,
        p_dazu: e.dazu ?? [],
        p_weg: e.weg ?? [],
        p_bestaetigt: zahl,
      }),
    kaderFehler,
  );
  return r.ok ? ok({ teamId: e.teamId, ...r.wert }) : r;
}

// ── Termine für Kader (#453) ─────────────────────────────────────────────────

/** Die Kader eines einzelnen Termins setzen (AK 1, 3, 13) — an einem
 *  Serientermin weicht er damit ab, auch mit keinem Kader («für alle»). */
export async function setzeTerminKader(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; kaderIds: string[]; bestaetigt?: VerfallBestaetigt },
): Promise<KernErgebnis<{ terminId: string; teamId: string; verfallen: number }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN, { feld: "termin_id" });
  if (!e.kaderIds.every(istUuid)) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, { feld: "kader_ids" });
  const r = await mitVerfall<{ team: string; verfallen: number }>(
    e.bestaetigt,
    (zahl) => supabase.rpc("termin_kader_setzen", { p_termin: e.terminId, p_kader: e.kaderIds, p_bestaetigt: zahl }),
    kaderFehler,
  );
  return r.ok ? ok({ terminId: e.terminId, teamId: r.wert.team, verfallen: r.wert.verfallen }) : r;
}

/** Was das Entfernen eines Kaders bewirkte (AK 11): anstehende Termine und
 *  Serien, die danach für alle gelten, und wie viele Abmeldungen verfielen. */
export type KaderEntfernenFolgen = {
  spieler: number;
  termine: { id: string; datum: string; beginn: string; ende: string; serieId: string | null }[];
  serien: { id: string; wochentage: number[]; beginn: string; ende: string; bis: string }[];
  verfallend: number;
};

export async function kaderEntfernenFolgen(
  supabase: SupabaseClient,
  _userId: string,
  e: { kaderId: string },
): Promise<KernErgebnis<KaderEntfernenFolgen>> {
  if (!istUuid(e.kaderId)) return fehlschlag("nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN, KADER_FELD);
  const { data, error } = await supabase.rpc("kader_entfernen_folgen", { p_kader: e.kaderId });
  if (error) return kaderFehler(error);
  const r = data as {
    spieler: number;
    termine: { id: string; datum: string; beginn: string; ende: string; serie: string | null }[];
    serien: KaderEntfernenFolgen["serien"];
    verfallend: number;
  };
  return ok({
    spieler: r.spieler,
    termine: r.termine.map((t) => ({ id: t.id, datum: t.datum, beginn: t.beginn, ende: t.ende, serieId: t.serie })),
    serien: r.serien,
    verfallend: r.verfallend,
  });
}
