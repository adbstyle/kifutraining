import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-Role-Client — UMGEHT RLS.
 * Ausschliesslich für vertrauenswürdige Server-Kontexte: Seed-Script und
 * Admin-Operationen (z.B. Auth-User-Löschung im Konto-Löschen-Flow).
 * NIEMALS aus einer normalen Request-Pipeline / einem Client-Pfad importieren.
 *
 * Eine weitere bewusste Ausnahme: `lib/storage-aufraeumen.ts`. Löst die
 * Vereinsverwaltung ein Team auf, ist sie kein Mitglied des Teams und hat kein
 * Recht an seinen Bilddateien — mit den Zeilen verschwindet auch das der
 * Mitglieder. Der Nachlauf hat dort keinen anderen Handelnden mehr; er löscht
 * ausschliesslich Pfade zu nachweislich gelöschten Zeilen.
 */
export function createAdminClient() {
  return createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
