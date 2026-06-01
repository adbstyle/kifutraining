import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-Role-Client — UMGEHT RLS.
 * Ausschliesslich für vertrauenswürdige Server-Kontexte: Seed-Script und
 * Admin-Operationen (z.B. Auth-User-Löschung im Konto-Löschen-Flow).
 * NIEMALS aus einer normalen Request-Pipeline / einem Client-Pfad importieren.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
