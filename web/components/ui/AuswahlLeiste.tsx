"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { nebenLeiste } from "./Seitenleiste";

/* Auswahlleiste (#447) — die Handlungen für mehrere ausgewählte Zeilen einer
   Liste (Spielerliste: «Kader zuteilen»). Sie schwebt unten in der Mitte, am
   Platz der Snackbar, solange etwas ausgewählt ist (PO 2026-10-18): So bleibt
   sie in Reichweite, wo man in einer langen Liste gerade auswählt, statt über
   der Liste aus dem Bild zu scrollen.

   Zwei Teile wie bei der Snackbar: `AuswahlLeisteFlaeche` ist nur die
   Fläche (06dp wie die Snackbar, aber dunkel — sie ist Werkzeug, keine
   Meldung, und soll neben einer hellen Snackbar als etwas anderes lesbar
   bleiben); `AuswahlLeiste` setzt sie an den unteren Rand.

   Am Rand liegt sie unter Snackbar (z-40) und Dialogen (z-50). Was sie
   unten belegt, meldet sie an das Dokument: `--fussleiste-hoehe` (ihre Höhe
   samt Abstand) hebt die Snackbar über sie, `--fussleiste-platz` (dazu der
   Rand darunter) hält die Seite unten frei, damit die letzte Zeile nicht
   unter der Leiste verschwindet (globals.css). */

/** Abstand zwischen Leiste und dem, was über ihr steht (Snackbar, letzte Zeile). */
const ABSTAND_PX = 8;

export function AuswahlLeisteFlaeche({
  titel,
  children,
  onAufheben,
  className,
}: {
  /** Was ausgewählt ist, etwa «2 ausgewählt». */
  titel: string;
  /** Die Handlungen für die Auswahl. */
  children: ReactNode;
  onAufheben: () => void;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label="Auswahl"
      className={cn(
        "flex min-h-13 max-w-full flex-wrap items-center gap-3 rounded-flaeche bg-elev-08 py-2 pl-4 pr-2 shadow-dp-06",
        className,
      )}
    >
      <span className="type-title-small text-on-surface">{titel}</span>
      {children}
      <Button variant="quiet" className="ml-auto" onClick={onAufheben}>
        Auswahl aufheben
      </Button>
    </div>
  );
}

export function AuswahlLeiste({
  offen,
  ...flaeche
}: { offen: boolean } & React.ComponentProps<typeof AuswahlLeisteFlaeche>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!offen || !el) return;
    const wurzel = document.documentElement;
    const melde = () => {
      const hoehe = el.offsetHeight + ABSTAND_PX;
      // Der Rand darunter (1rem oder die sichere Zone) — aus dem Stil, nicht
      // gemessen: Beim Einfahren steht die Leiste noch tiefer.
      const rand = el.parentElement ? parseFloat(getComputedStyle(el.parentElement).bottom) || 0 : 0;
      wurzel.style.setProperty("--fussleiste-hoehe", `${hoehe}px`);
      wurzel.style.setProperty("--fussleiste-platz", `${hoehe + Math.max(rand, 0)}px`);
    };
    melde();
    const beobachter = new ResizeObserver(melde);
    beobachter.observe(el);
    return () => {
      beobachter.disconnect();
      wurzel.style.removeProperty("--fussleiste-hoehe");
      wurzel.style.removeProperty("--fussleiste-platz");
    };
  }, [offen]);

  if (!offen) return null;
  return (
    <div
      className={cn(
        // `m-0`: Ein `space-y-*` der Liste darum verschöbe sonst die Leiste.
        "pointer-events-none fixed right-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-30 m-0 flex justify-center px-4 print:hidden",
        nebenLeiste,
      )}
    >
      <div ref={ref} className="pointer-events-auto w-full max-w-2xl motion-safe:animate-snackbar-ein motion-reduce:animate-einblenden">
        <AuswahlLeisteFlaeche {...flaeche} />
      </div>
    </div>
  );
}
