// Wo der KI-Endpoint liegt (Story #142) — EINE Quelle für die Route, die
// Ressourcen-Metadaten und die Adresse, die das Konto zum Eintragen im
// KI-Client nennt. Eigenes Modul, weil `lib/mcp/server.ts` den ganzen
// Werkzeugsatz nachzieht; die Konto-Seite braucht nur diese Zeichenkette.
// Die einzige unvermeidbare Kopie steht als Literal im Matcher von
// `web/middleware.ts` (Next.js verlangt dort statische Werte).
//
// REIN: keine Server-Importe.
export const MCP_PFAD = "/api/mcp";
