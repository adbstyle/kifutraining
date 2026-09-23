import "server-only";
import { protectedResourceHandler } from "mcp-handler";
import { env } from "@/lib/env";
import { oeffentlicherOriginAus } from "@/lib/origin";

/**
 * Protected Resource Metadata nach RFC 9728 (Story #142, Spike #141).
 *
 * Ein KI-Client, der ohne Token an `/api/mcp` anklopft, bekommt 401 mit einem
 * Verweis hierher. Hier steht, WER Tokens für diese Anwendung ausstellt: der
 * OAuth-2.1-Server von Supabase Auth — dasselbe Auth-Projekt, das auch die
 * Browser-Anmeldung trägt. Kein zusätzlicher Dienst.
 *
 * `resource` bildet die Anwendung selbst über `oeffentlicherOriginAus` — dieselbe
 * Quelle wie die Route `/api/mcp` für ihren `resource_metadata`-Verweis. So
 * nennen Challenge und Metadaten garantiert denselben Origin (in Prod/Staging
 * fest über APP_ORIGIN, gegen Host-Header-Spoofing).
 *
 * Lazy: `env` und Origin werden erst im Request gelesen, damit der Build ohne
 * gesetzte Umgebung nicht bricht.
 */
export function schutzMetadatenHandler(pfad: "" | `/${string}`) {
  return (req: Request): Response =>
    protectedResourceHandler({
      // Muss dem `issuer` der Authorization-Server-Metadaten von Supabase Auth
      // entsprechen (RFC 8414) — das ist `<SUPABASE_URL>/auth/v1`.
      authServerUrls: [`${env.supabaseUrl()}/auth/v1`],
      resourceUrl: `${oeffentlicherOriginAus(req)}${pfad}`,
    })(req);
}
