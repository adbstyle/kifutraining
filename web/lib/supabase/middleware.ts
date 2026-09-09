import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// URL-Präfixe, die ein eingeloggtes Konto erfordern (UX-Guard; die echte
// Durchsetzung bleibt RLS). Route-Groups wie (app) wirken nicht auf die URL,
// daher die konkreten Pfade.
const PROTECTED_PREFIXES = [
  "/neu",
  "/konto",
  "/training/neu",
];

function isProtected(pathname: string): boolean {
  if (PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }
  // Bearbeiten-Routen: /uebung/[slug]/edit, /training/[id]/edit
  return pathname.endsWith("/edit");
}

/** Name des Request-Headers, der den angefragten Pfad an die
 *  Server-Komponenten weiterreicht (#156). */
export const PFAD_HEADER = "x-pathname";

/* Warum überhaupt: Eine Server-Komponente kennt die Adresse nicht — es gibt
   kein serverseitiges `usePathname`. Die Hauptnavigation muss aber schon beim
   ersten Ausliefern wissen, ob ein Team-Training offen ist (NFR 1); würde sie
   das erst im Browser nachschlagen, blitzte kurz der falsche Zustand auf. Die
   Middleware sieht den Pfad ohnehin und legt ihn hier ab. */
function pfadHeader(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.set(PFAD_HEADER, request.nextUrl.pathname);
  return headers;
}

export async function updateSession(request: NextRequest) {
  // `NextResponse.next({ request })` friert die Request-Header dieses Aufrufs
  // ein. Der Pfad-Header muss darum an JEDER Stelle mitgegeben werden, an der
  // die Antwort neu aufgebaut wird — sonst fiele er beim Cookie-Refresh
  // (unten im `setAll`) still wieder weg.
  let response = NextResponse.next({ request: { headers: pfadHeader(request) } });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request: { headers: pfadHeader(request) } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
