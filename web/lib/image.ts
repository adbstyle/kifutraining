// Gemeinsame Bild-Constraints für Feld-Diagramme — eine Quelle für Client-
// (Pre-Check vor dem Submit, UX) und Server (Validierung, Sicherheit).
// Cap bewusst unter Vercels 4,5-MB-Function-Body-Limit, damit der Upload
// end-to-end (lokal wie Prod) durchgeht; Server-Action-bodySizeLimit ist der
// Backstop (siehe web/next.config.ts).
export const MAX_IMAGE_MB = 4;
export const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// accept-Attribut fürs Datei-Input.
export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

/** Format-/Grössenprüfung. Gibt eine deutsche Fehlermeldung zurück oder null. */
export function imageError(type: string, size: number): string | null {
  if (!IMAGE_TYPES[type]) return "Nur JPG, PNG oder WebP sind erlaubt.";
  if (size > MAX_IMAGE_BYTES) return `Das Bild ist grösser als ${MAX_IMAGE_MB} MB.`;
  return null;
}
