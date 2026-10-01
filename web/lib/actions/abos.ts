"use server";

// Kalender-Abo holen und widerrufen (Story #330 AK 1, 6, 7, 9). Angelegt wird
// ein Abo nur über die RPC `kalender_abo_holen` (derselbe Link, solange es
// gilt); widerrufen heisst, die eigene Zeile zu löschen.

import { revalidatePath } from "next/cache";
import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";
import { oeffentlicherOrigin } from "@/lib/origin";
import { aboLinks } from "@/lib/ical";
import { NICHT_GEFUNDEN } from "@/lib/kern/ergebnis";
import { istUuid } from "@/lib/kennung";

export type AboHolenErgebnis = { ok: true; url: string; webcal: string } | { ok: false; error: string };
export type AboWiderrufErgebnis = { ok: true } | { ok: false; error: string };

const MELDUNG_NICHT_GEHOLT = "Der Abo-Link liess sich gerade nicht holen. Bitte versuche es noch einmal.";
const MELDUNG_NICHT_WIDERRUFEN = "Das Abo liess sich nicht widerrufen. Bitte versuche es noch einmal.";
const MELDUNG_ABO_WEG = "Das Abo gibt es nicht mehr.";

/** Den persönlichen Abo-Link eines Teams holen — beim ersten Mal wird er
 *  angelegt, danach kommt derselbe (AK 6). */
export async function holeAboAktion(teamId: string): Promise<AboHolenErgebnis> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  if (!istUuid(teamId)) return { ok: false, error: NICHT_GEFUNDEN.team };

  const { data, error } = await a.supabase.rpc("kalender_abo_holen", { p_team: teamId });
  if (error) {
    if (error.message.includes("TEAM_NICHT_GEFUNDEN")) return { ok: false, error: NICHT_GEFUNDEN.team };
    console.error("[kalender-abo] holen", error);
    return { ok: false, error: MELDUNG_NICHT_GEHOLT };
  }
  if (!data) {
    console.error("[kalender-abo] holen: kein Token zurückgegeben");
    return { ok: false, error: MELDUNG_NICHT_GEHOLT };
  }
  return { ok: true, ...aboLinks(await oeffentlicherOrigin(), data) };
}

/** Ein eigenes Abo widerrufen (AK 7); der Link liefert ab dem nächsten Abruf
 *  nichts mehr. Die RLS lässt nur eigene Zeilen löschen — eine fremde oder
 *  schon gelöschte Kennung löscht still nichts, darum zählt die zurückgegebene
 *  Zeile und nicht allein das Ausbleiben eines Fehlers. */
export async function widerrufeAboAktion(aboId: string): Promise<AboWiderrufErgebnis> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  if (!istUuid(aboId)) return { ok: false, error: MELDUNG_ABO_WEG };

  const { data, error } = await a.supabase.from("kalender_abos").delete().eq("id", aboId).select("id");
  if (error) {
    console.error("[kalender-abo] widerrufen", error);
    return { ok: false, error: MELDUNG_NICHT_WIDERRUFEN };
  }
  // Die Ansicht in beiden Fällen auffrischen: Eine veraltete Zeile soll
  // verschwinden, auch wenn das Abo schon anderswo widerrufen wurde.
  revalidatePath("/konto");
  if (!data || data.length === 0) return { ok: false, error: MELDUNG_ABO_WEG };
  return { ok: true };
}
