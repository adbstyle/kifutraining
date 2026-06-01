// Server-only Zugriff auf Supabase-Konfiguration.
// `server-only` macht den Import in einer Client Component zum Build-Fehler —
// erzwingt die Architektur-Garantie, dass URL/Keys nie im Browser-Bundle landen.
// BEWUSST keine NEXT_PUBLIC_-Variablen: URL und Keys verlassen nie den Server.
// Werte werden lazy gelesen (Funktionen), damit der reine Import ohne gesetzte
// Env nicht crasht (z.B. im Build ohne DB).
import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment-Variable ${name} fehlt (server-only).`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseAnonKey: () => required("SUPABASE_ANON_KEY"),
  /** Nur in Seed-/Admin-Kontext verwenden — NIE in der Request-Pipeline. */
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
};
