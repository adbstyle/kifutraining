import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Query-Layer für den Anzeigenamen (Team-Epic Story 2).
 *
 * Der Name ist die Personenangabe, die andere zu sehen bekommen; die
 * E-Mail-Adresse sehen nur die Mitglieder gemeinsamer Teams (`team_mitglieder`,
 * #425). Wer keinen gewählt hat, bekommt
 * einen automatisch vergebenen: die DB-Funktion `anzeige_name` bildet ihn aus
 * der User-ID und ist damit auch die Quelle für Mitgliederlisten und
 * Urheber-Angaben.
 */

/** Der Anzeigename eines Kontos (nie leer) — für einen Aufrufer, der den
 *  Client und den User schon hat (die Navigation, das Profil im Konto). */
export async function getAnzeigenameFuer(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase.rpc("anzeige_name", { p_user: userId });
  return (data as string | null) ?? null;
}
