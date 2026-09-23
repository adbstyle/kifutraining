import "server-only";
import type {
  AuthInfo,
  CallToolResult,
  McpServer,
  ServerContext,
  ToolCallback,
} from "@modelcontextprotocol/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { createBearerClient } from "@/lib/supabase/bearer";
import type { KernErgebnis, KernFehler } from "@/lib/kern/ergebnis";
import { ausKern, fehlerErgebnis } from "@/lib/mcp/ergebnis";
import { pruefeAufrufgrenze } from "@/lib/mcp/aufrufgrenze";
import { meldungGebremst } from "@/lib/mcp/regeln";

/**
 * Der eine Weg, ein KI-Werkzeug zu beschreiben (Story #142, verbindlich für
 * Epic #139 und #190). Ein Werkzeug ist ein WERT — `werkzeug({...})` —, den
 * `lib/mcp/server.ts` in seine Liste aufnimmt. Der Wrapper erledigt, was sonst
 * jedes Werkzeug selbst wiederholen müsste und dabei irgendwann vergässe:
 *
 * 1. Zugang aus dem geprüften Token lesen (withMcpAuth hat es bereits bei
 *    Supabase Auth verifiziert, lib/supabase/bearer.ts).
 * 2. Aufruf-Begrenzung je Konto (AK 12) — nur hier, also nur bei
 *    `tools/call`; `initialize` und `tools/list` zählen nicht. Bewusst NICHT
 *    in der Token-Prüfung von `withMcpAuth`: dort hiesse Ablehnen 401, und
 *    der Client startete eine neue Anmeldung statt zu warten. Fällt die
 *    Zählung aus, wird abgewiesen (fail-closed).
 * 3. Das `KernErgebnis` nach der Konvention in lib/mcp/ergebnis.ts
 *    übersetzen. Unerwartetes wird zu `technisch`; der Rohtext steht nur im
 *    Server-Log.
 *
 * Weil `ausfuehren` ein `KernErgebnis<z.infer<Ausgabe>>` liefern muss, prüft
 * schon der Compiler, dass `structuredContent` zum angekündigten
 * `outputSchema` passt; zur Laufzeit prüft es das SDK zusätzlich.
 */

/** Was ein Werkzeug über seinen Aufrufer weiss: den Client, die eigene
 *  Kennung (für `eigene`-Vergleiche) und wie es absolute Adressen in KiFu
 *  bildet. Den Origin selbst sieht es nicht — jede `url` entsteht über
 *  `url(...)`, damit Pfadteile immer kodiert sind. */
export type Zugang = {
  supabase: SupabaseClient;
  userId: string;
  clientId: string;
  /** Absolute Adresse in KiFu: `url("uebung", slug)` → `<origin>/uebung/<slug>`.
   *  Jeder Teil wird mit `encodeURIComponent` kodiert. */
  url: (...teile: string[]) => string;
};

/** Was die Token-Prüfung in `AuthInfo.extra` ablegt (app/api/mcp/route.ts). */
export type ZugangExtra = { userId: string; origin: string };

function zugangAus(authInfo: AuthInfo | undefined): Zugang | null {
  const extra = authInfo?.extra as Partial<ZugangExtra> | undefined;
  if (!authInfo || typeof extra?.userId !== "string" || typeof extra.origin !== "string") {
    return null;
  }
  const origin = extra.origin.replace(/\/+$/, "");
  return {
    // Einmal je Aufruf; ein Client ist billig (kein Netz), und so hängt nie
    // ein Client mit fremdem Token an einer anderen Anfrage.
    supabase: createBearerClient(authInfo.token),
    userId: extra.userId,
    clientId: authInfo.clientId,
    url: (...teile) => `${origin}/${teile.map(encodeURIComponent).join("/")}`,
  };
}

/** Der eine Fehler für alles Unerwartete — auch eine ausgefallene Zählung. */
const TECHNISCH: Omit<KernFehler, "ok"> = {
  art: "technisch",
  meldung: "Die Anfrage liess sich gerade nicht ausführen. Bitte erneut versuchen.",
  wiederholbar: true,
};

export type WerkzeugDefinition<E extends z.ZodObject, A extends z.ZodObject> = {
  /** Deutsch, snake_case. */
  name: string;
  titel: string;
  /** Was das Werkzeug tut und wo seine Grenzen liegen — Grenzen gehören
   *  hierher, nicht ins Ergebnis (Ergebnis-Konvention #142). */
  beschreibung: string;
  /** Ändert das Werkzeug nichts? PFLICHT, ohne Vorgabe: ein schreibendes
   *  Werkzeug, das sich versehentlich als lesend ausgibt, liesse Clients
   *  ohne Rückfrage ausführen. */
  nurLesen: boolean;
  eingabe: E;
  ausgabe: A;
  ausfuehren: (eingabe: z.infer<E>, zugang: Zugang) => Promise<KernErgebnis<z.infer<A>>>;
};

/** Ein Werkzeug, bereit zur Registrierung. */
export type Werkzeug = {
  readonly name: string;
  registriere: (server: McpServer) => void;
};

export function werkzeug<E extends z.ZodObject, A extends z.ZodObject>(
  def: WerkzeugDefinition<E, A>,
): Werkzeug {
  // Der Callback nimmt die Argumente als `unknown` und castet einmal: das
  // SDK leitet ihren Typ über einen bedingten Typ aus `E` ab, den TypeScript
  // im generischen Kontext nicht auflöst. Geprüft sind sie zur Laufzeit
  // trotzdem — das SDK validiert gegen `inputSchema`, bevor es hier ankommt.
  const aufruf = async (args: unknown, ctx: ServerContext): Promise<CallToolResult> => {
    const zugang = zugangAus(ctx.http?.authInfo);
    if (!zugang) {
      // Kann nur passieren, wenn die Route ohne withMcpAuth liefe — dann
      // lieber gar nichts tun als anonym.
      return fehlerErgebnis({
        art: "technisch",
        meldung: "Kein gültiger Zugang. Bitte die Verbindung zu KiFu neu herstellen.",
      });
    }
    try {
      const grenze = await pruefeAufrufgrenze(zugang.supabase);
      if (grenze.status === "gebremst") {
        return fehlerErgebnis({
          art: "gebremst",
          meldung: meldungGebremst(grenze.retryAfter),
          retryAfter: grenze.retryAfter,
          wiederholbar: true,
        });
      }
      if (grenze.status === "fehler") return fehlerErgebnis(TECHNISCH);
      const ergebnis = await def.ausfuehren(args as z.infer<E>, zugang);
      return ausKern(ergebnis as KernErgebnis<Record<string, unknown>>);
    } catch (e) {
      console.error("[mcp]", def.name, e);
      return fehlerErgebnis(TECHNISCH);
    }
  };

  return {
    name: def.name,
    registriere: (server) => {
      server.registerTool<A, E>(
        def.name,
        {
          title: def.titel,
          description: def.beschreibung,
          inputSchema: def.eingabe,
          outputSchema: def.ausgabe,
          annotations: {
            title: def.titel,
            readOnlyHint: def.nurLesen,
            // Werkzeuge wirken nur auf den KiFu-Bestand dieses Kontos, nie
            // nach aussen (keine Mails, keine fremden Dienste).
            openWorldHint: false,
          },
        },
        aufruf as ToolCallback<E>,
      );
    },
  };
}
