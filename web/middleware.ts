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
  // `api/versionen` ist öffentlich und braucht keine (#410).
  // `/oauth/consent` bleibt drin — dort braucht es die Session.
  // `api/mcp` ist die einzige unvermeidbare Kopie von MCP_PFAD
  // (lib/mcp/pfad.ts): Next.js verlangt hier ein statisches Literal.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/mcp|api/kalender|api/versionen|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
