import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Die Aufruf-Begrenzung je Konto (Story #142 AK 12, PC 9): höchstens
 * `KI_AUFRUFE_JE_STUNDE` Werkzeug-Aufrufe je Stunde über alle Zugänge.
 *
 * Gezählt wird in der Datenbank (`ki_aufruf_zaehlen()`, definer-RPC mit
 * Sperre je Konto), nicht im Speicher: Auf Vercel läuft jede Anfrage
 * womöglich in einer anderen Instanz, ein Zähler im Prozess wäre keiner.
 *
 * Aufgerufen wird sie aus dem Werkzeug-Wrapper, also nur bei `tools/call` —
 * `initialize` und `tools/list` zählen nicht. Bewusst NICHT in der
 * Token-Prüfung von `withMcpAuth`: dort hiesse Ablehnen 401, und der Client
 * startete eine neue Anmeldung statt zu warten.
 */
export type Aufrufgrenze =
  | { status: "ok" }
  | { status: "gebremst"; retryAfter: number }
  | { status: "fehler" };

export async function pruefeAufrufgrenze(supabase: SupabaseClient): Promise<Aufrufgrenze> {
  const { data, error } = await supabase.rpc("ki_aufruf_zaehlen");
  if (error) {
    // Rohtext nur ins Server-Log; der Aufrufer weist den Aufruf ab
    // (fail-closed): eine Grenze, die bei Störung aufgeht, ist keine.
    console.error("[mcp] ki_aufruf_zaehlen:", error.message);
    return { status: "fehler" };
  }
  const antwort = (data ?? {}) as { status?: unknown; retry_after?: unknown };
  if (antwort.status === "ok") return { status: "ok" };
  if (antwort.status === "gebremst") {
    const s = typeof antwort.retry_after === "number" ? antwort.retry_after : 3600;
    return { status: "gebremst", retryAfter: Math.max(1, Math.ceil(s)) };
  }
  console.error("[mcp] ki_aufruf_zaehlen: unerwartete Antwort", data);
  return { status: "fehler" };
}
