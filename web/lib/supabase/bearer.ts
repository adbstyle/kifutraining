import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Supabase-Client für einen KI-Client (Story #142, Spike #141/#191) — der
 * dritte Client neben dem Cookie-Client (`server.ts`) und dem Seed-/Admin-
 * Client (`admin.ts`).
 *
 * Der KI-Client bringt ein OAuth-Access-Token mit, das Supabase Auth als
 * Authorization Server ausgestellt hat. Es ist ein gewöhnliches Supabase-JWT
 * (aud "authenticated", sub = Konto) mit einem zusätzlichen `client_id`-Claim.
 * Ein Client, der dieses Token als Authorization-Header trägt, ist gegenüber
 * PostgREST und Storage derselbe Nutzer wie im Browser: `auth.uid()` greift,
 * jede RLS-Policy wirkt unverändert. Kein Service-Role, kein Umweg — und
 * darum auch keine zweite Rechte-Logik, die auseinanderlaufen könnte.
 *
 * WICHTIG: `persistSession: false` heisst, `supabase.auth.getUser()` OHNE
 * Token-Argument kennt an diesem Client keinen User. Queries, die ihn
 * benutzen, bekommen die userId darum als Parameter (`…Fuer(client, userId)`
 * in lib/queries), statt sie selbst zu erfragen.
 */
export function createBearerClient(token: string): SupabaseClient {
  return createClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type VerifizierterZugang = {
  userId: string;
  /** OAuth-Client, dem das Token ausgestellt wurde. */
  clientId: string;
  /** Ablauf des Tokens, Sekunden seit Epoche (für `AuthInfo.expiresAt`). */
  expiresAt: number;
};

/** Die Claims eines JWT lesen, OHNE die Signatur zu prüfen — das tut
 *  unmittelbar davor Supabase Auth selbst (`getUser`). */
function jwtClaims(token: string): Record<string, unknown> | null {
  const teil = token.split(".")[1];
  if (!teil) return null;
  try {
    const claims: unknown = JSON.parse(Buffer.from(teil, "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? (claims as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Prüft ein Token für JEDEN Aufruf gegen Supabase Auth (`getUser(token)`):
 * Signatur, Ablauf UND ob die Sitzung dahinter noch existiert.
 *
 * NIE auf eine lokale Prüfung (`getClaims`, JWKS) umstellen, auch nicht aus
 * Performance-Gründen: Ein Access-Token bleibt bis zu seinem Ablauf
 * kryptografisch gültig. Nur die Rückfrage bei Supabase Auth merkt, dass der
 * Trainer den Zugang widerrufen (`revokeGrant` löscht die Sitzungen, #142
 * PC 6) oder sein Konto gelöscht hat (Kaskade auf Sitzungen und Zustimmungen,
 * PC 7). Lokal geprüft wirkten beide erst nach bis zu einer Stunde.
 *
 * Nur Tokens MIT `client_id`-Claim gelten: ein abgefangenes Browser-Session-
 * JWT desselben Kontos soll hier nicht ebenfalls als KI-Zugang taugen — es
 * stünde in keiner Zugangsliste und liesse sich nicht gezielt widerrufen.
 *
 * `null` heisst immer 401 mit `WWW-Authenticate` (withMcpAuth); der Client
 * startet daraufhin die Anmeldung neu. Ein Rohtext von Supabase wird nie
 * weitergegeben.
 */
export async function verifiziereZugang(token: string): Promise<VerifizierterZugang | null> {
  const claims = jwtClaims(token);
  const clientId = typeof claims?.client_id === "string" ? claims.client_id : null;
  // Vor dem Netzaufruf aussortieren, was ohnehin nicht gelten wird.
  if (!clientId) return null;

  const {
    data: { user },
    error,
  } = await createBearerClient(token).auth.getUser(token);
  if (error || !user) return null;

  const exp = typeof claims?.exp === "number" ? claims.exp : 0;
  return { userId: user.id, clientId, expiresAt: exp };
}
