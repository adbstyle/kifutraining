import { kontoManifest } from "@/lib/app-ablegen";

/* Das Manifest von KiFu für Personen mit Konto (#651): fest, ohne Daten einer
   Person — darum beim Build erzeugt und zwischengespeichert. Verlinkt nur in
   den Layouts von `(app)` und `(auth)` (`KONTO_APP_METADATA`), nie auf den
   Seiten eines privaten Links. Die Middleware lässt den Pfad aus. */
export const dynamic = "force-static";

export function GET() {
  return new Response(JSON.stringify(kontoManifest()), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}
