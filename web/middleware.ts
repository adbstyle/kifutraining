import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Alles ausser statischen Assets und Bild-Optimierung. Ausgenommen sind
  // auch der KI-Endpoint und die Well-known-Metadaten (#142): sie tragen ein
  // Bearer-Token statt eines Session-Cookies, eine Session-Erneuerung wäre
  // dort sinnlos. `api/kalender` trägt ein Abo-Token statt einer Sitzung (#330),
  // `api/versionen` ist öffentlich und braucht keine (#410), `api/push` trägt
  // das Geheimnis der Datenbank als Bearer (#483), das Manifest von KiFu
  // holt der Browser ohne Cookies (#651). Hinter
  // `abmelden/` und `abholen/` steht ein privater Link ohne Konto (#436,
  // #438): keine Sitzung, kein Anmelde-Cookie (das Cookie der gesehenen
  // Benachrichtigungen setzt der Browser selbst, #642).
  // `/oauth/consent` bleibt drin — dort braucht es die Session.
  // `api/mcp` ist die einzige unvermeidbare Kopie von MCP_PFAD
  // (lib/mcp/pfad.ts): Next.js verlangt hier ein statisches Literal.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|api/kalender|api/versionen|api/push|manifest\\.webmanifest|abmelden/|abholen/|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
