import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BenachrichtigungEreignis } from "@/lib/benachrichtigung";

/**
 * Benachrichtigungen ablegen (Epic #641, Story #642) — der eine Weg des
 * Fachkerns in den Postausgang `spieler_benachrichtigungen`. Die Regeln
 * (welche Termine, wer, Inhalt, Doppelschutz) stehen allein in der Datenebene
 * (`termin_benachrichtigen`); der Kern entscheidet nur, OB er ruft (Prinzip 4)
 * und tut es nach dem letzten Schritt eines Vorgangs. Versendet wird nichts.
 */

/** Zu einem Ereignis die Benachrichtigungen ablegen. Liefert die Zahl der
 *  Spieler:innen, die eine erhalten (0, wenn der Termin nicht zählt oder sein
 *  Zustand nicht passt), oder `null`, wenn es nicht geklappt hat: Der Vorgang
 *  selbst bleibt dann gültig, die Oberfläche sagt es dazu. `wieder`: Ein
 *  ausgefallener Termin findet wieder statt (#644). */
export async function benachrichtige(
  supabase: SupabaseClient,
  terminId: string,
  ereignis: Exclude<BenachrichtigungEreignis, "serie">,
  wieder = false,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("termin_benachrichtigen", {
    p_termin: terminId,
    p_ereignis: ereignis,
    p_wieder: wieder,
  });
  if (error) {
    console.error(`[kern] benachrichtige ${ereignis}:`, error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}
