import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  PROBE_TEXT,
  probeAnzahlProblem,
  probeFolgenAusFehler,
  probeFolgenSumme,
  probeVerfallBestaetigen,
  probeVerfallText,
  type ProbeFolgen,
  type Probetraining,
} from "@/lib/probe";
import { SPIELER_MELDUNG } from "@/lib/spieler";
import { SPIELER_FELD, ladeSpieler } from "@/lib/kern/spieler";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Probetraining (Epic #554, Story #555): die Anzahl des Teams festlegen und
 * den Probe-Modus einer Spieler:in schalten — dieselben Funktionen für die
 * Karte «Probetraining», den Dialog «Spieler:in ändern» und die KI-Werkzeuge.
 *
 * Geschrieben wird nur über die RPCs `team_probetraining_festlegen` und
 * `spieler_probe_setzen`; die Regeln (Anzahl 1–20, nicht entfernbar,
 * Einschalten nur mit Anzahl, Rückfrage mit Zahl) stehen in der Datenebene.
 */

function probeFehler(e: { message: string; code?: string }): KernFehler {
  if (e.message.includes("SPIELER_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  if (e.message.includes("TEAM_NICHT_GEFUNDEN"))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  if (e.message.includes("PROBE_ANZAHL_FEHLT")) return fehlschlag("regel", PROBE_TEXT.anzahlFehlt, { feld: "probe" });
  if (e.message.includes("PROBE_ANZAHL_UNGUELTIG")) return fehlschlag("eingabe", PROBE_TEXT.anzahlProblem, { feld: "anzahl" });
  return ausDbFehler(e);
}

/** Die Einstellung des Teams (AK 17, 18): `anzahl` leer = nicht konfiguriert. */
export async function leseProbetraining(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<Probetraining & { teamId: string }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase
    .from("team_probetraining")
    .select("anzahl")
    .eq("team_id", e.teamId)
    .maybeSingle<{ anzahl: number }>();
  if (error) return ausDbFehler(error);
  return ok({ teamId: e.teamId, anzahl: data?.anzahl ?? null });
}

/** Die Anzahl Probetrainings festlegen oder ändern (AK 1, 2). */
export async function legeProbetrainingFest(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; anzahl: number },
): Promise<KernErgebnis<Probetraining & { teamId: string }>> {
  const problem = probeAnzahlProblem(e.anzahl);
  if (problem) return fehlschlag("eingabe", problem, { feld: "anzahl" });
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const { error } = await supabase.rpc("team_probetraining_festlegen", { p_team: e.teamId, p_anzahl: e.anzahl });
  if (error) return probeFehler(error);
  return ok({ teamId: e.teamId, anzahl: e.anzahl });
}

/** Was das Einschalten verfallen liesse, vor dem Speichern (AK 5, 16). */
export async function probeFolgen(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string },
): Promise<KernErgebnis<ProbeFolgen & { anzahlFestgelegt: boolean; probe: boolean }>> {
  if (!istUuid(e.spielerId)) return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, SPIELER_FELD);
  const { data, error } = await supabase.rpc("spieler_probe_folgen", { p_spieler: e.spielerId });
  if (error) return probeFehler(error);
  const r = data as { anzahl_festgelegt: boolean; probe: boolean; abmeldungen: number; meldungen: number; kennzeichnungen: number };
  return ok({
    anzahlFestgelegt: r.anzahl_festgelegt,
    probe: r.probe,
    abmeldungen: r.abmeldungen,
    meldungen: r.meldungen,
    kennzeichnungen: r.kennzeichnungen,
  });
}

function verfallNachfrage(meldung: string, f: ProbeFolgen, wiederholbar = false): KernFehler {
  return fehlschlag("regel", meldung, {
    feld: "bestaetigt",
    verfallend: probeFolgenSumme(f),
    ...(f.meldungen > 0 && { verfallendSpiele: f.meldungen }),
    ...(f.kennzeichnungen > 0 && { kennzeichnungen: f.kennzeichnungen }),
    ...(wiederholbar && { wiederholbar }),
  });
}

/**
 * Den Probe-Modus ein- oder ausschalten (AK 3–5; PC 1, 9, 10).
 *
 * Lässt das Einschalten Meldungen verfallen, schreibt die Datenebene nur,
 * wenn `bestaetigt` genau deren Zahl nennt (wie bei Kader-Änderungen): Die
 * Oberfläche sendet die Zahl, die sie zeigte; stimmt sie nicht mehr, kommt
 * der aktuelle Stand zurück. Die KI bestätigt mit `true`, dann wiederholt der
 * Kern den Aufruf einmal mit der gemeldeten Zahl.
 */
export async function schalteProbe(
  supabase: SupabaseClient,
  _userId: string,
  e: { spielerId: string; probe: boolean; bestaetigt?: boolean | number },
): Promise<KernErgebnis<{ spielerId: string; teamId: string; probe: boolean; verfallen: number }>> {
  const geladen = await ladeSpieler(supabase, e.spielerId);
  if (!geladen.ok) return geladen;
  const zahl = typeof e.bestaetigt === "number" ? e.bestaetigt : null;
  const aufruf = (n: number | null) =>
    supabase.rpc("spieler_probe_setzen", { p_spieler: e.spielerId, p_probe: e.probe, p_bestaetigt: n });
  const fertig = (data: unknown) => {
    const r = data as { probe: boolean; verfallen: number };
    return ok({ spielerId: e.spielerId, teamId: geladen.wert.teamId, probe: r.probe, verfallen: r.verfallen });
  };
  const erst = await aufruf(zahl);
  if (!erst.error) return fertig(erst.data);
  const f = probeFolgenAusFehler(erst.error.message);
  if (!f) return probeFehler(erst.error);
  const vorname = geladen.wert.vorname;
  // Eine Zahl, die nicht mehr stimmt: der aktuelle Stand.
  if (zahl !== null) return verfallNachfrage(`Inzwischen hat sich etwas geändert. ${probeVerfallText(vorname, f)}`, f);
  if (e.bestaetigt !== true) return verfallNachfrage(probeVerfallBestaetigen(vorname, f), f);
  const dann = await aufruf(probeFolgenSumme(f));
  if (!dann.error) return fertig(dann.data);
  const g = probeFolgenAusFehler(dann.error.message);
  return g ? verfallNachfrage(probeVerfallBestaetigen(vorname, g), g, true) : probeFehler(dann.error);
}
