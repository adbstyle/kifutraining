"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { TriangleAlert } from "lucide-react";
import { Button, Leerzustand } from "@/components/ui";
import "./globals.css";

/* ── Letztes Netz: Fehler im Root-Layout selbst ───────────────
   Greift nur, wenn `app/layout.tsx` bricht — oder die Fehlerseite eine Ebene
   darunter. Alles Übrige fängt `app/error.tsx` ab, wo Navigation und Kopf
   stehen bleiben. Diese Datei ERSETZT das Root-Layout und bringt darum
   <html>/<body>, die Schriften und das Stylesheet selbst mit; geerbt wird
   hier nichts.

   BEWUSST OHNE `AppNav` UND `TeamKontextProvider`: Beide wohnen im
   Root-Layout und sind damit die wahrscheinlichsten Verursacher des Fehlers,
   den diese Seite gerade auffängt. Sie hier erneut zu rendern hiesse, den
   Absturz zu wiederholen. `Leerzustand` und `Button` sind dagegen sicher:
   reine Darstellung, kein Kontext, kein Datenzugriff — `cn()` ist ein blosser
   Klassen-Joiner. Aus demselben Grund steht hier `Button` und NICHT
   `ButtonLink`: Letzterer zöge `next/link` und damit Router-Kontext.

   `useRouter()` ist hier verfügbar — Next mountet diese Datei innerhalb des
   `AppRouterContext.Provider` (siehe app-router.js: die RootErrorBoundary mit
   der eigenen global-error-Komponente sitzt INNERHALB der Provider). */
const sans = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export default function GlobaleFehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();

  function nochmalVersuchen() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <html lang="de-CH" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <main className="mx-auto flex min-h-dvh max-w-2xl items-center px-4 sm:px-6">
          <div className="w-full">
            <Leerzustand
              icon={TriangleAlert}
              titel="Die Anwendung konnte nicht geladen werden"
              aktion={
                <Button onClick={nochmalVersuchen} disabled={laeuft}>
                  {laeuft ? "Wird geladen …" : "Nochmals versuchen"}
                </Button>
              }
            >
              Hier ist etwas grundlegend schiefgelaufen. Oft hilft ein zweiter
              Versuch — bleibt es dabei, probier es später noch einmal.
              {error.digest && (
                <span className="type-label-small mt-3 block text-on-surface-tief">
                  Fehler-ID {error.digest}
                </span>
              )}
            </Leerzustand>
          </div>
        </main>
      </body>
    </html>
  );
}
