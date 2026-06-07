// Client-seitige Bild-Verkleinerung VOR dem Upload. Läuft ausschliesslich im
// Browser (Web Worker); "client-only" verhindert versehentlichen Server-Import.
import "client-only";
import imageCompression from "browser-image-compression";
import {
  COMPRESS_MAX_DIMENSION,
  COMPRESS_OUTPUT_MIME,
  COMPRESS_QUALITY,
  COMPRESS_TARGET_MB,
  isHeic,
} from "@/lib/image";

/**
 * Verkleinert ein hochgeladenes Bild im Browser auf max. COMPRESS_MAX_DIMENSION px
 * (längste Kante) und kodiert es als WebP. HEIC wird zuvor nach JPEG dekodiert
 * (heic-to, lazy geladen — Bundle wächst nur bei tatsächlichem HEIC-Upload).
 *
 * Gibt die kleinere von komprimierter Fassung und Original zurück: brächte die
 * Verkleinerung nichts (z. B. bereits winziges Diagramm), bleibt das Original
 * erhalten. Wirft bei Dekodier-/Kompressionsfehlern — der Aufrufer bricht den
 * Upload dann mit einer Meldung ab.
 */
export async function compressImage(file: File): Promise<File> {
  let input = file;

  if (isHeic(file)) {
    // Next.js-spezifischer Einstiegspunkt (korrektes Bundling des WASM-Workers).
    const { heicTo } = await import("heic-to/next");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    input = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
    });
  }

  const compressed = await imageCompression(input, {
    maxWidthOrHeight: COMPRESS_MAX_DIMENSION,
    initialQuality: COMPRESS_QUALITY,
    maxSizeMB: COMPRESS_TARGET_MB,
    fileType: COMPRESS_OUTPUT_MIME,
    useWebWorker: true,
  });

  // Bringt die Verkleinerung nichts und war das Original kein HEIC (HEIC ist
  // nicht direkt darstellbar, muss also immer konvertiert werden), das kleinere
  // Original behalten.
  if (!isHeic(file) && compressed.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, "");
  return new File([compressed], `${base}.webp`, { type: COMPRESS_OUTPUT_MIME });
}
