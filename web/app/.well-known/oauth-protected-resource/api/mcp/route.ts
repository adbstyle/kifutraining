import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { schutzMetadatenHandler } from "@/lib/mcp/metadaten";
import { MCP_PFAD } from "@/lib/mcp/pfad";

// RFC 9728, pfadbezogen: resource = <origin>/api/mcp. Diese Adresse nennt die
// 401-Antwort von /api/mcp (`resource_metadata`); MCP-Clients suchen sie laut
// Spezifikation (2025-11-25) zuerst hier, dann an der Wurzel.
export const dynamic = "force-dynamic";

export const GET = schutzMetadatenHandler(MCP_PFAD);
// Eine Fabrik, kein Handler: erst der Aufruf liefert die Funktion.
export const OPTIONS = metadataCorsOptionsRequestHandler();
