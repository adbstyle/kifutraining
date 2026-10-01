import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SERIE_MELDUNG, SERIE_TEXT, type Reichweite } from "@/lib/serie";
import { getTeamMitgliederFuer } from "@/lib/queries/teams-fuer";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { bereinigeVerantwortliche, kalenderFehler, ladeTermin } from "@/lib/kern/termine";
import { aendereSerie, type SerienFolge } from "@/lib/kern/serien";
import { fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Verantwortliche je Termin und Serie (#325). Einzeln über
 * termin_verantwortliche_setzen, für folgende und alle über die
 * Serienrechnung (terminserie_rechnen, Schlüssel «verantwortliche») — dort
 * teilt «dieser und folgende» die Serie wie jede andere Änderung (PC 11).
 */

/** Die Mitglieder eines Teams mit Anzeigename, ohne E-Mail (PC 9). */
export async function teamMitglieder(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ mitglieder: { id: string; anzeigename: string; ich: boolean }[] }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  try {
    const m = await getTeamMitgliederFuer(supabase, e.teamId);
    return ok({ mitglieder: m.map((x) => ({ id: x.userId, anzeigename: x.anzeigeName, ich: x.userId === userId })) });
  } catch (err) {
    console.error("[kern] teamMitglieder:", err instanceof Error ? err.message : err);
    return fehlschlag("technisch", "Das Team liess sich gerade nicht lesen. Bitte versuche es noch einmal.", {
      wiederholbar: true,
    });
  }
}

/** Die Verantwortlichen eines Termins festlegen — für diesen oder mit der
 *  Reichweite für folgende und alle Termine seiner Serie (#325 AK 1–5, 20, 21). */
export async function setzeVerantwortliche(
  supabase: SupabaseClient,
  userId: string,
  e: {
    terminId: string;
    userIds: string[];
    /** Einträge ohne Namen (gelöschte Konten), die bleiben; `null`/fehlend = alle behalten.
     *  Nur für einen Termin einzeln (`nur_dieser` oder ohne Serie): Eine
     *  Änderung für folgende oder alle ersetzt an jedem erfassten Termin ALLE
     *  Einträge, darum lehnt sie `anonyme` ab (AK 18, PC 8). */
    anonyme?: string[] | null;
    reichweite?: Reichweite;
    erwartet?: { version: number; entfallend: string[] };
    bestaetigt?: boolean;
  },
): Promise<KernErgebnis<{ terminId: string; teamId: string; serie: SerienFolge | null }>> {
  // Vorab: nur echte Kennungen erreichen die Datenebene (sonst ein roher
  // Postgres-Fehler); Doppelte fallen weg.
  const leute = bereinigeVerantwortliche(e.userIds);
  if (!leute.ok) return leute.fehler;
  const anonyme = e.anonyme ? bereinigeVerantwortliche(e.anonyme) : null;
  if (anonyme && !anonyme.ok) return anonyme.fehler;
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const userIds = leute.ids;

  if (t.serie_id && !e.reichweite)
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  if (!t.serie_id && e.reichweite && e.reichweite !== "nur_dieser")
    return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });

  if (e.reichweite && e.reichweite !== "nur_dieser" && e.anonyme != null)
    return fehlschlag("regel", SERIE_TEXT.namenloseNurEinzeln, { feld: "ohne_namen_behalten" });

  if (!t.serie_id || e.reichweite === "nur_dieser") {
    const { error } = await supabase.rpc("termin_verantwortliche_setzen", {
      p_termin: t.id,
      p_user_ids: userIds,
      p_anonyme: anonyme?.ok ? anonyme.ids : null,
    });
    if (error) return kalenderFehler(error);
    return ok({ terminId: t.id, teamId: t.team_id, serie: null });
  }
  const r = await aendereSerie(supabase, userId, {
    terminId: t.id,
    reichweite: e.reichweite as "dieser_und_folgende" | "alle",
    aenderung: { verantwortliche: userIds },
    erwartet: e.erwartet,
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ terminId: t.id, teamId: r.wert.teamId, serie: r.wert }) : r;
}
