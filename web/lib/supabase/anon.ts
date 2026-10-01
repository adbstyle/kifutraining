import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Ein Client OHNE Anmeldung — nur für den Kalender-Feed (#330). Das Abo-Token
 * ist die Berechtigung; die RPC `kalender_abo_termine` prüft es als
 * SECURITY DEFINER und gibt ausschliesslich Zeit und Ort heraus. Kein
 * Service-Role-Schlüssel ausserhalb von Seed und Aufräumen (CLAUDE.md).
 */
export function createAnonClient(): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
