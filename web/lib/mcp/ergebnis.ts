// Übersetzung des Kern-Ergebnisses in ein MCP-Werkzeug-Ergebnis (Story #142,
// verbindlich für alle Werkzeuge aus Epic #139 und #190).
//
// Konvention:
// - Erfolg: `structuredContent` ist immer ein Objekt mit deutschen
//   snake_case-Schlüsseln; `content` trägt dasselbe als JSON-Text für Clients,
//   die `structuredContent` nicht auswerten. Fachliche Hinweise (#195) reisen
//   im Erfolg, nie als Fehler.
// - Fehler: `isError: true`. Der Text beginnt mit `[<art>]`, damit der
//   Assistent ohne Parsen erkennt, ob er korrigieren, wiederholen oder
//   aufgeben soll; `structuredContent.fehler` trägt dasselbe strukturiert.
//   Das SDK prüft `structuredContent` nur bei Erfolg gegen das `outputSchema`
//   (typescript-sdk #2748) — der Fehler darf darum seine eigene Form haben.
// - Nie ein roher Datenbank- oder Bibliothekstext: `meldung` ist immer eine
//   fertige Meldung des Kerns (lib/kern/ergebnis.ts).
//
// REIN: nur ein Typ-Import aus dem SDK (zur Laufzeit gelöscht) — das
// Prüfskript `check:ki-zugang` lädt diese Datei ohne Server.
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { KernErgebnis, KernFehler } from "@/lib/kern/ergebnis";

/** Ein erfolgreiches Werkzeug-Ergebnis. */
export function erfolg<T extends Record<string, unknown>>(wert: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(wert, null, 2) }],
    structuredContent: wert,
  };
}

/** Der Fehler, wie ihn der Assistent strukturiert liest: derselbe Kern-Fehler,
 *  nur die beiden camelCase-Felder in snake_case wie alle Ausgaben. Abgeleitet,
 *  damit ein neues Feld in `KernFehler` ohne Zutun auch hier erscheint. */
export type FehlerAusgabe = Omit<KernFehler, "ok" | "retryAfter" | "varianteId"> & {
  retry_after?: number;
  variante_id?: string;
};

/** Was nichts aussagt, fällt weg: `undefined`, leerer Text, leere Liste.
 *  `false` und `0` bleiben — `wiederholbar: false` ist eine Auskunft. */
function ohneLeere<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(
      ([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  ) as T;
}

/** Die Textzeile eines Fehlers: `[<art>] <feld>: <meldung>` samt zulässigen
 *  Werten und Wartezeit — für Clients, die nur `content` lesen. */
export function fehlerText(f: Omit<KernFehler, "ok">): string {
  let text = `[${f.art}] ${f.feld ? `${f.feld}: ` : ""}${f.meldung}`;
  if (f.zulaessig?.length) text += ` Zulässig: ${f.zulaessig.join(", ")}.`;
  if (typeof f.retryAfter === "number") text += ` retry_after=${f.retryAfter}`;
  if (f.hinweis) text += ` ${f.hinweis}`;
  return text;
}

/** Ein Fehler-Ergebnis aus einem Kern-Fehler (mit oder ohne `ok`). Generisch:
 *  jedes gesetzte Feld des Kern-Fehlers erscheint in `structuredContent.fehler`,
 *  auch solche, die spätere Stories hinzufügen. */
export function fehlerErgebnis(f: Omit<KernFehler, "ok"> & { ok?: false }): CallToolResult {
  const { ok: _ok, retryAfter, varianteId, ...rest } = f;
  const fehler: FehlerAusgabe = ohneLeere({
    ...rest,
    retry_after: retryAfter,
    variante_id: varianteId,
  });
  return {
    isError: true,
    content: [{ type: "text", text: fehlerText(f) }],
    structuredContent: { fehler },
  };
}

/** Kern-Ergebnis → Werkzeug-Ergebnis. Der einzige Weg, auf dem ein Werkzeug
 *  antwortet (lib/mcp/werkzeug.ts), damit die Konvention oben nirgends
 *  von Hand nachgebaut wird. */
export function ausKern<T extends Record<string, unknown>>(r: KernErgebnis<T>): CallToolResult {
  return r.ok ? erfolg(r.wert) : fehlerErgebnis(r);
}
