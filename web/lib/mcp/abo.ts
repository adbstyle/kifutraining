import type { createMcpHandler } from "mcp-handler";

/**
 * Kein Änderungs-Abo am KI-Endpoint. Der Werkzeugsatz ist fest, KiFu meldet
 * nie `list_changed`. Kündigt der Server `listChanged` an, öffnen Clients im
 * Protokoll 2026-07-28 (z. B. Claude Code) beim Verbinden einen
 * `subscriptions/listen`-Stream, der nie endet — auf Vercel hält er eine
 * Funktion bis zum Timeout wach, danach verbindet der Client neu.
 *
 * `listChanged: false` lässt Clients das Abo gar nicht erst öffnen;
 * `maxSubscriptions: 0` weist im SDK jedes trotzdem gesendete ab. Beides
 * hängt an SDK-Semantik (`?? true` beim Registrieren, `0` = keins) —
 * `check:ki-zugang` prüft es darum am echten Handler.
 */
export const KEIN_ABO = {
  capabilities: { tools: { listChanged: false } },
  maxSubscriptions: 0,
} satisfies Parameters<typeof createMcpHandler>[1];

/** Dieselbe Antwort, mit der das SDK über `maxSubscriptions` abweist — so
 *  reagieren Clients auf beide Wege gleich. */
export const ABO_ABGEWIESEN = { code: -32603, message: "Subscription limit reached" } as const;

/**
 * Weist ein Abo ab, bevor der Handler den ganzen Werkzeugsatz aufbaut. Erkannt
 * am `Mcp-Method`-Header, den Clients im Protokoll 2026-07-28 mitsenden —
 * gewöhnliche Aufrufe kostet das kein Lesen des Bodys. Was ohne Header
 * durchrutscht, fängt `maxSubscriptions: 0` ab.
 */
export async function aboAbweisung(req: Request): Promise<Response | null> {
  if (req.method !== "POST" || req.headers.get("mcp-method") !== "subscriptions/listen") return null;
  const nachricht: unknown = await req.clone().json().catch(() => null);
  const id = nachricht && typeof nachricht === "object" ? (nachricht as { id?: unknown }).id : undefined;
  return Response.json({
    jsonrpc: "2.0",
    error: ABO_ABGEWIESEN,
    id: typeof id === "string" || typeof id === "number" ? id : null,
  });
}
