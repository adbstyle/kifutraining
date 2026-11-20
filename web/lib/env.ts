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
  /** Geheimer Wert, mit dem die Abholung den Anschluss zur Sperre verschlüsselt
   *  (#438 AK 15). Je Umgebung ein anderer; fehlt er, holt niemand ab. */
  abholSchluessel: () => process.env.ABHOL_SPERRE_SCHLUESSEL || null,
  /** Schlüssel für das Gesprächsmodell des Feedback-Dialogs (Epic #541).
   *  Fehlt er, ist Feedback nicht möglich; der Rest der App läuft weiter. */
  anthropicApiKey: () => process.env.ANTHROPIC_API_KEY || null,
  /** Mitteilungen aufs Mobile (#483): VAPID-Schlüsselpaar und Kontakt je
   *  Umgebung (`npx web-push generate-vapid-keys`). Fehlt einer der drei
   *  Werte, gibt es keine Mitteilungen: Der Schalter am Link ist
   *  ausgeblendet, die Route stellt nichts zu. Den öffentlichen Schlüssel
   *  bekommt der Browser als Prop, nie als NEXT_PUBLIC_-Variable. */
  vapid: (): { publicKey: string; privateKey: string; subject: string } | null => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;
    return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
  },
};
