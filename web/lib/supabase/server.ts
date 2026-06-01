import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/**
 * Request-gebundener Supabase-Client (server-only).
 * - Anonym (keine Session-Cookie) -> RLS liefert nur öffentliche Daten.
 * - Eingeloggt (Session-Cookie via @supabase/ssr) -> auth.uid() trägt die
 *   Eigentümer-Policies.
 * Wird in Server Components, Server Actions und Route Handlers verwendet.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({ name, value, ...options });
          }
        } catch {
          // In Server Components ist set nicht erlaubt — die Session-Erneuerung
          // übernimmt die Middleware. Hier bewusst ignorieren.
        }
      },
    },
  });
}
