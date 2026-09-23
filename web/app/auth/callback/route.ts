import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { oeffentlicherOriginAus } from "@/lib/origin";
import { sichererRuecksprung } from "@/lib/weiterleitung";

/** PKCE-Code-Rücksprung (`?code=`): Code gegen eine Session tauschen (setzt die
 *  HttpOnly-Cookies via @supabase/ssr) und zum Ziel weiterleiten.
 *  Aktuell ungenutzt — E-Mail-Bestätigung/Recovery laufen über /auth/confirm
 *  (token_hash, geräteübergreifend stabil). Reserviert für künftiges OAuth. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Nur relative Ziele dieser Anwendung (#142, offene Weiterleitung).
  const safeNext = sichererRuecksprung(searchParams.get("next"));

  // Zurück auf den öffentlichen Host, begründet bei `oeffentlicherOriginAus`.
  const base = oeffentlicherOriginAus(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${base}${safeNext}`);
  }

  return NextResponse.redirect(`${base}/login?error=link`);
}
