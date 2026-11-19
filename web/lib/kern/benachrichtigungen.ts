import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Benachrichtigungen ablegen (Epic #641, Story #642) — der eine Weg des
 * Fachkerns in den Postausgang `spieler_benachrichtigungen` für die Wege, die
 * direkt über RLS schreiben (Spiel erfassen, Ausfall, Rücknahme, einzeln
 * verlegen). Die Regeln (welche Termine, wer, Inhalt, Doppelschutz) stehen
 * allein in der Datenebene (`termin_benachrichtigen`); der Kern entscheidet
 * nur, OB er ruft (Prinzip 4), und tut es nach dem letzten Schritt eines
 * Vorgangs. Versendet wird nichts. Die RPC-Wege (Entfernen, der Serie folgen,
 * Serie ändern oder entfernen) benachrichtigen in ihrer eigenen Transaktion:
 * Dort entsteht die Benachrichtigung mit dem Vorgang oder gar nicht.
 */

/** Die Ereignisse, die der Kern einzeln ablegt. SQL-Zwilling: die Liste in
 *  `termin_benachrichtigen`. */
export type EinzelEreignis = "neues_spiel" | "ausfall" | "ruecknahme" | "verlegung";

/** Was ein Vorgang über seine Benachrichtigung meldet: `benachrichtigt` = wie
 *  viele Spieler:innen eine erhielten (0, wenn der Termin nicht zählt oder
 *  sein Zustand nicht passt); fehlt, wenn nicht benachrichtigt werden sollte.
 *  `benachrichtigungFehlt`: Sie sollte entstehen, das Ablegen scheiterte
 *  aber — der Vorgang selbst bleibt gültig, Oberfläche und KI sagen es dazu
 *  (`BENACHRICHTIGEN_TEXT.gescheitert`). */
export type Benachrichtigt = { benachrichtigt?: number; benachrichtigungFehlt: boolean };

/** Kein Aufruf: nichts zu melden. */
export const NICHT_BENACHRICHTIGT: Benachrichtigt = { benachrichtigungFehlt: false };

/** Eine Verlegung, deren Benachrichtigung der Aufrufer nach seinem letzten
 *  Schritt nachholt (#644 PC 1): Folgen auf die Felder noch die Kader, gilt
 *  die Benachrichtigung erst für die neuen (`aendereTermin` mit
 *  `kaderFolgen`). `wieder`: Der Termin war ausgefallen (AK 3). */
export type AusstehendeVerlegung = { terminId: string; wieder: boolean };

/** Zu einem Ereignis die Benachrichtigungen ablegen. `wieder`: Ein
 *  ausgefallener Termin findet wieder statt (#644). */
export async function benachrichtige(
  supabase: SupabaseClient,
  terminId: string,
  ereignis: EinzelEreignis,
  wieder = false,
): Promise<Benachrichtigt> {
  const { data, error } = await supabase.rpc("termin_benachrichtigen", {
    p_termin: terminId,
    p_ereignis: ereignis,
    p_wieder: wieder,
  });
  if (error || typeof data !== "number") {
    console.error(`[kern] benachrichtige ${ereignis}:`, error?.message ?? "keine Zahl");
    return { benachrichtigungFehlt: true };
  }
  return { benachrichtigt: data, benachrichtigungFehlt: false };
}

/** Eine zurückgestellte Verlegung nachholen, nach dem letzten Schritt des
 *  Vorgangs (#644 PC 1). Ohne ausstehende Verlegung: nichts. */
export async function holeVerlegungNach(
  supabase: SupabaseClient,
  a: AusstehendeVerlegung | null | undefined,
): Promise<Benachrichtigt> {
  return a ? benachrichtige(supabase, a.terminId, "verlegung", a.wieder) : NICHT_BENACHRICHTIGT;
}
