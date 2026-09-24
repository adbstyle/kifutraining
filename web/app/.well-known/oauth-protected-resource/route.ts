import { metadataCorsOptionsRequestHandler } from "mcp-handler";
import { schutzMetadatenHandler } from "@/lib/mcp/metadaten";

// RFC 9728 an der Wurzel: resource = <origin>. Rückfall für Clients, die nur
// hier suchen; das SDK akzeptiert ihn, weil `resource` ein Präfix der
// Server-Adresse ist. Die angekündigte Adresse ist die pfadbezogene
// (./api/mcp/route.ts).
export const dynamic = "force-dynamic";

export const GET = schutzMetadatenHandler("");
// Eine Fabrik, kein Handler: erst der Aufruf liefert die Funktion.
export const OPTIONS = metadataCorsOptionsRequestHandler();
