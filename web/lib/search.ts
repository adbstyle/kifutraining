/**
 * Geteilte Such-Helfer für die Teilstring-Suche (ILIKE) über die normalisierten
 * `search_text`-Spalten (Übungen wie Pläne). Muss zur DB-Normalisierung
 * `lower(unaccent(...))` passen (Migrationen 20260608120000 / 20260608130000),
 * damit z. B. "hutchen" das gespeicherte "Hütchen" findet.
 */

/** Suchbegriff akzent-/umlaut- und case-insensitiv normalisieren (inkl. ß→ss
 *  wie Postgres `unaccent`). */
export function normalizeSearch(s: string): string {
  return s
    .normalize("NFKD") // ä -> a + kombinierendes Diakritikum
    .replace(/\p{M}/gu, "") // kombinierende Diakritika entfernen
    .toLowerCase()
    .replace(/ß/g, "ss");
}

/** %, _ und \ sind LIKE-Sonderzeichen — als Literal maskieren, damit eine
 *  Eingabe wie "100%" nicht als Wildcard interpretiert wird. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Fertiges ILIKE-Pattern `%begriff%` aus einer Roh-Eingabe. */
export function likePattern(raw: string): string {
  return `%${escapeLike(normalizeSearch(raw.trim()))}%`;
}
