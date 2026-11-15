// Die Antworten der RPCs zum Gründen und Löschen von Verein und Konto (Epic
// Vereine #575, Story #587), auf ihre Form geprüft.
//
// Die Datenebene antwortet mit `jsonb`; der Verein-Kern (lib/kern/verein.ts)
// verlässt sich nicht darauf, dass es so aussieht, wie der Vertrag sagt:
// Passt die Antwort nicht, ist das ein technischer Fehler, keine halbe
// Auskunft (Muster `vorschauAus` in lib/spieler-import.ts). Die Prüfung liegt
// hier, rein, damit `check:kern` sie ohne Datenbank durchläuft.
//
// REIN: keine Server-Importe.

const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const istText = (x: unknown): x is string => typeof x === "string" && x.length > 0;

// ── Gründen ─────────────────────────────────────────────────────────────────

/** Der gegründete Verein. */
export type Gruendung = { id: string; name: string };

/** `verein_gruenden` → `{status:'gegruendet', id, name}`; sonst `null`. */
export function gruendungAus(antwort: unknown): Gruendung | null {
  if (!istObjekt(antwort) || antwort.status !== "gegruendet" || !istText(antwort.id) || !istText(antwort.name)) return null;
  return { id: antwort.id, name: antwort.name };
}
