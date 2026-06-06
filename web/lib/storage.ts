// Storage-Helfer für die Feld-Diagramme (ein öffentlicher Bucket).
export const STORAGE_BUCKET = "exercise-images";
const MARKER = `/${STORAGE_BUCKET}/`;

/** Aus einer öffentlichen Bild-URL den Storage-Objektpfad ableiten
 *  (z. B. ".../exercise-images/user/<uid>/<id>.png" -> "user/<uid>/<id>.png"). */
export function bildUrlToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const i = url.indexOf(MARKER);
  return i >= 0 ? url.slice(i + MARKER.length) : null;
}
