// Gemeinsame Bild-Constraints für Feld-Diagramme — eine Quelle für Client
// (Eingabe-Prüfung + Kompressions-Zielwerte) und Server (Validierung der
// gespeicherten Datei, Sicherheit).
//
// Ablauf: Der Browser verkleinert das hochgeladene Bild VOR dem Upload
// (siehe lib/image-compress.ts) auf WebP mit max. COMPRESS_MAX_DIMENSION px.
// Dadurch erreicht nie das (grosse) Original den Server, sondern nur die
// kleine Fassung — das umgeht das Vercel-Function-Body-Limit und hält den
// Storage-Bucket klein. Der Server prüft die ankommende Datei gegen
// MAX_STORED_IMAGE_BYTES als Trust-Boundary (Client ist nicht vertrauenswürdig).

// Kompressions-Zielwerte (Client). 2000px deckt die grösste Bildschirm-
// darstellung (Detailansicht ~896px @2×) und einen A4-Druck (~280 DPI) ab.
// Quality 0.82 bewusst höher als üblich, damit dünne Diagramm-Linien lesbar
// bleiben. maxSizeMB knapp unter der Server-Obergrenze, damit die Kompression
// die Schranke praktisch immer einhält (sonst greift sie auf Quality zurück).
export const COMPRESS_MAX_DIMENSION = 2000;
export const COMPRESS_QUALITY = 0.82;
export const COMPRESS_OUTPUT_MIME = "image/webp";
export const COMPRESS_TARGET_MB = 1.4;

// Harte Obergrenze für die GESPEICHERTE (komprimierte) Datei — Trust-Boundary
// und Bucket-Schutz zugleich. Schlägt die Client-Kompression fehl oder wird sie
// umgangen, lehnt der Server hier ab (siehe storedImageError).
export const MAX_STORED_IMAGE_MB = 1.5;
export const MAX_STORED_IMAGE_BYTES = MAX_STORED_IMAGE_MB * 1024 * 1024;

// Sanity-Limit für die ROH-Eingabe im Browser, bevor komprimiert wird (schützt
// vor pathologisch grossen Dateien / Speicherproblemen). Grosse Handyfotos
// liegen klar darunter.
export const MAX_INPUT_IMAGE_MB = 40;
export const MAX_INPUT_IMAGE_BYTES = MAX_INPUT_IMAGE_MB * 1024 * 1024;

// Formate, die GESPEICHERT werden dürfen (Server-Validierung + Pfad-Endung).
// Die Kompression liefert WebP; eine unverändert beibehaltene Originalfassung
// (wenn Verkleinerung nichts brächte) kann JPG oder PNG sein.
export const STORED_IMAGE_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// Eingabe-Formate, die der Datei-Picker akzeptiert (inkl. HEIC von iPhones).
// Dateiendungen zusätzlich, weil Browser für HEIC teils keinen MIME-Type melden.
export const IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const INPUT_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/** HEIC/HEIF erkennen — MIME-Type ODER Endung (Browser melden HEIC uneinheitlich). */
export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** Akzeptiert der Picker diese Datei? MIME-Type ODER HEIC-Endung als Fallback. */
function isAcceptedInput(file: File): boolean {
  if (INPUT_IMAGE_MIME.has(file.type)) return true;
  return isHeic(file);
}

/** Client-seitige Eingabe-Prüfung VOR der Kompression. DE-Meldung oder null. */
export function inputImageError(file: File): string | null {
  if (!isAcceptedInput(file)) return "Nur JPG, PNG, WebP oder HEIC sind erlaubt.";
  if (file.size > MAX_INPUT_IMAGE_BYTES)
    return `Das Bild ist grösser als ${MAX_INPUT_IMAGE_MB} MB.`;
  return null;
}

/** Server-/Storage-seitige Prüfung der (komprimierten) Datei. DE-Meldung oder null. */
export function storedImageError(type: string, size: number): string | null {
  if (!STORED_IMAGE_TYPES[type]) return "Das Bild konnte nicht verarbeitet werden.";
  if (size > MAX_STORED_IMAGE_BYTES)
    return `Das Bild ist auch nach der Verkleinerung zu gross (über ${MAX_STORED_IMAGE_MB} MB).`;
  return null;
}
