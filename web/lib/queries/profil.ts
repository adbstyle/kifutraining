import { createClient } from "@/lib/supabase/server";

/**
 * Query-Layer für den Anzeigenamen (Team-Epic Story 2).
 *
 * Der Name ist die einzige Personenangabe, die andere zu sehen bekommen —
 * E-Mail-Adressen verlassen den Server nie. Wer keinen gewählt hat, bekommt
 * einen automatisch vergebenen: die DB-Funktion `anzeige_name` bildet ihn aus
 * der User-ID und ist damit auch die Quelle für Mitgliederlisten und
 * Urheber-Angaben.
 */

/** Der aktuelle Anzeigename des angemeldeten Kontos (nie leer). `null` nur
 *  ohne Anmeldung. */
export async function getMeinAnzeigename(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("anzeige_name", { p_user: user.id });
  return (data as string | null) ?? null;
}

/** Hat das Konto einen selbst gewählten Namen — oder steht dort noch der
 *  automatisch vergebene? Steuert nur den Hinweistext im Konto. */
export async function hatEigenenAnzeigenamen(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}
