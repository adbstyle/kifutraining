import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** PKCE-Code-Rücksprung (`?code=`): Code gegen eine Session tauschen (setzt die
 *  HttpOnly-Cookies via @supabase/ssr) und zum Ziel weiterleiten.
 *  Aktuell ungenutzt — E-Mail-Bestätigung/Recovery laufen über /auth/confirm
 *  (token_hash, geräteübergreifend stabil). Reserviert für künftiges OAuth. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  // Auf den tatsächlichen Host-Header weiterleiten (nicht auf das evtl.
  // normalisierte request.url-Origin): sonst wechselt der Host z. B. von
  // 127.0.0.1 zu localhost und die soeben gesetzten Auth-Cookies (an den
  // Callback-Host gebunden) gehen verloren. In Prod via APP_ORIGIN festnageln
  // (gegen Host-Header-Spoofing).
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = process.env.APP_ORIGIN ?? (host ? `${proto}://${host}` : origin);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${safeNext}`);
  }

  return NextResponse.redirect(`${base}/login?error=link`);
}
