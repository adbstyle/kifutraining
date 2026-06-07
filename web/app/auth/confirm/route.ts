import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Bestätigt Signup- und Recovery-Links über token_hash + verifyOtp.
 *  Im Gegensatz zum PKCE-Code-Tausch braucht das KEINEN code_verifier-Cookie
 *  -> funktioniert auch, wenn der Link auf einem anderen Gerät geöffnet wird. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  // Auf den tatsächlichen Host-Header weiterleiten (nicht auf das evtl.
  // normalisierte request.url-Origin): sonst wechselt der Host z. B. von
  // 127.0.0.1 zu localhost und die soeben gesetzten Auth-Cookies (an den
  // Host gebunden) gehen verloren. In Prod via APP_ORIGIN festnageln
  // (gegen Host-Header-Spoofing).
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = process.env.APP_ORIGIN ?? (host ? `${proto}://${host}` : origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${base}${safeNext}`);
  }

  return NextResponse.redirect(`${base}/login?error=confirm`);
}
