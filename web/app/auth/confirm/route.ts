import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { oeffentlicherOriginAus } from "@/lib/origin";
import { sichererRuecksprung } from "@/lib/weiterleitung";

/** Bestätigt Signup- und Recovery-Links über token_hash + verifyOtp.
 *  Im Gegensatz zum PKCE-Code-Tausch braucht das KEINEN code_verifier-Cookie
 *  -> funktioniert auch, wenn der Link auf einem anderen Gerät geöffnet wird. */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Nur relative Ziele dieser Anwendung (#142, offene Weiterleitung).
  const safeNext = sichererRuecksprung(searchParams.get("next"));

  // Zurück auf den öffentlichen Host, begründet bei `oeffentlicherOriginAus`.
  const base = oeffentlicherOriginAus(request);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${base}${safeNext}`);
  }

  return NextResponse.redirect(`${base}/login?error=confirm`);
}
