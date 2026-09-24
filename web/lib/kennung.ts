// Kennungen (UUID) von aussen — eine reine Regel, die Fachkern (lib/kern),
// KI-Werkzeuge (lib/mcp) und Server Actions teilen. Neutral abgelegt, damit
// der Kern nichts aus lib/mcp importieren muss.
//
// REIN: keine Importe.

/** Das Format einer Kennung. Bewusst nicht streng nach RFC-Version und
 *  -Variante: Die Kennungen des Bestands stammen nicht alle aus
 *  `gen_random_uuid()`. */
export const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ist das eine UUID? Guard für Kennungen von aussen, bevor sie eine
 *  uuid-Spalte erreichen (dort gäbe es sonst einen Datenbankfehler). */
export function istUuid(wert: unknown): wert is string {
  return typeof wert === "string" && UUID_FORMAT.test(wert);
}
