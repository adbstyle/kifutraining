import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { verifiziereZugang } from "@/lib/supabase/bearer";
import { oeffentlicherOriginAus } from "@/lib/origin";
import { registriereWerkzeuge } from "@/lib/mcp/server";
import { MCP_PFAD } from "@/lib/mcp/pfad";
import type { ZugangExtra } from "@/lib/mcp/werkzeug";
import pkg from "@/package.json";

/**
 * Der KI-Endpoint (Story #142): MCP über Streamable HTTP, zustandslos.
 *
 * Ein gewöhnlicher Route Handler auf Vercel — kein eigener Prozess, kein
 * Redis, keine MCP-Session. Jeder Aufruf trägt ein OAuth-Access-Token von
 * Supabase Auth; `withMcpAuth` beantwortet fehlende oder ungültige Tokens mit
 * 401 + `WWW-Authenticate … resource_metadata=…` (RFC 9728, PC 8), worauf der
 * Client die Anmeldung startet.
 *
 * Die Token-Prüfung verweigert NUR ungültige Zugänge; warum die
 * Aufruf-Begrenzung nicht hier sitzt, steht in lib/mcp/werkzeug.ts.
 */
export const dynamic = "force-dynamic";

const mcp = createMcpHandler((server) => registriereWerkzeuge(server), {
  serverInfo: { name: "ki-fu", version: pkg.version },
});

async function pruefeToken(token: string | undefined, origin: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const zugang = await verifiziereZugang(token);
  if (!zugang) return undefined;
  const extra: ZugangExtra = { userId: zugang.userId, origin };
  return {
    token,
    clientId: zugang.clientId,
    // Supabase Auth kennt keine Scopes; die Grenze ist der Werkzeugsatz.
    scopes: [],
    expiresAt: zugang.expiresAt,
    extra,
  };
}

// Je Request gebaut, mit EINMAL berechnetem Origin: `resource_metadata` nennt
// so denselben Origin wie die Metadaten-Route und die `url`-Felder der
// Werkzeuge. mcp-handler hängt den Pfad an den Origin an.
function handler(req: Request): Promise<Response> {
  const origin = oeffentlicherOriginAus(req);
  return withMcpAuth(mcp, (_req, token) => pruefeToken(token, origin), {
    required: true,
    resourceMetadataPath: `/.well-known/oauth-protected-resource${MCP_PFAD}`,
    resourceUrl: origin,
  })(req);
}

export { handler as GET, handler as POST, handler as DELETE };
