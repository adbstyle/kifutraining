// Slugify analog zu scripts/parser.py (Umlaute -> ae/oe/ue/ss, Rest -> '-').
const UMLAUT: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", ß: "ss",
};

export function slugify(text: string): string {
  let s = text.trim().toLowerCase();
  for (const [k, v] of Object.entries(UMLAUT)) s = s.replaceAll(k, v);
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "uebung";
}

/** Eindeutiger Slug für Nutzer-Übungen: sprechender Stamm + Zufalls-Suffix.
 *  Mehrere Übungen mit gleichem Namen kollidieren so nicht (Story 6 EK10). */
export function userSlug(name: string): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 6);
  return `${slugify(name)}-${rand}`;
}
