// Der öffentliche Origin der Anwendung — EINE Quelle für alles, was absolute
// Adressen nach aussen gibt: Auth-Redirects, die Adresse des KI-Endpoints im
// Konto, die `url`-Felder in MCP-Ergebnissen, die Ressourcen-Metadaten.
//
// In Prod und Staging ist `APP_ORIGIN` gesetzt (Vercel-Env) und nagelt den
// Origin fest — gegen Host-Header-Spoofing. Lokal fehlt die Variable, dann
// gilt der Host des Aufrufs (hinter Vercel die weitergereichten Header):
// auf den tatsächlichen Host statt auf das evtl. normalisierte `request.url`,
// sonst wechselte er z. B. von 127.0.0.1 zu localhost, und die eben
// gesetzten, an den Host gebundenen Auth-Cookies gingen verloren.
import "server-only";
import { headers } from "next/headers";

/** APP_ORIGIN, sonst aus den Headern — oder `null`, wenn beides fehlt. Den
 *  Rückfall wählt der jeweilige Export. */
function ausHeadern(h: Headers): string | null {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : null;
}

/** Origin aus EINEM Request (Route Handler, Middleware); Rückfall ist der
 *  Origin von `req.url`. */
export function oeffentlicherOriginAus(req: { url: string; headers: Headers }): string {
  return ausHeadern(req.headers) ?? new URL(req.url).origin;
}

/** Origin des aktuellen Requests in Server Components und Server Actions;
 *  Rückfall ist der lokale Dev-Server. */
export async function oeffentlicherOrigin(): Promise<string> {
  return ausHeadern(await headers()) ?? "http://127.0.0.1:3000";
}
