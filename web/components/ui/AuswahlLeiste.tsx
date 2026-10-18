"use client";

import { useContext, useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { FussleisteKontext, UNTER_RAND_ABSTAND, unterRand } from "./UnterRand";

/* Auswahlleiste (#447) — die Handlungen für mehrere ausgewählte Zeilen einer
   Liste (Spielerliste: «Kader zuteilen»). Sie schwebt unten in der Mitte, am
   Platz der Snackbar (`unterRand`), solange etwas ausgewählt ist (PO
   2026-10-18): So bleibt sie in Reichweite, wo man in einer langen Liste
   gerade auswählt, statt über der Liste aus dem Bild zu scrollen.

   Die Fläche ist 06dp wie die Snackbar, aber dunkel — sie ist Werkzeug, keine
   Meldung, und soll neben einer hellen Snackbar als etwas anderes lesbar
   bleiben. Sie liegt unter Snackbar (z-40) und Dialogen (z-50); ihre Höhe
   meldet sie dem SnackbarProvider (`FussleisteKontext`), der die Snackbar
   darüber stellt und die Seite unten freihält.

   Tastatur: Im DOM gehört sie NACH die Liste — wer in einer Zeile auswählt,
   erreicht ihre Knöpfe mit Tab vorwärts, wie sie auch unten steht.
   Verschwindet sie mit dem Fokus darin («Auswahl aufheben», Handlung fertig),
   geht der Fokus dorthin zurück, woher er kam (meist das letzte Kästchen),
   statt an den Dokumentanfang zu fallen. */

/** Abstand zwischen Leiste und dem, was über ihr steht (Snackbar). */
const ABSTAND_PX = 8;

export function AuswahlLeiste({
  offen,
  titel,
  children,
  onAufheben,
}: {
  offen: boolean;
  /** Was ausgewählt ist, etwa «2 ausgewählt». */
  titel: string;
  /** Die Handlungen für die Auswahl. */
  children: ReactNode;
  onAufheben: () => void;
}) {
  const id = useId();
  const melde = useContext(FussleisteKontext);
  const ref = useRef<HTMLDivElement>(null);
  const fokusVorher = useRef<HTMLElement | null>(null);

  // Die eigene Höhe melden, solange sie steht; nur die eigene Meldung räumen.
  useEffect(() => {
    const el = ref.current;
    if (!offen || !el || !melde) return;
    const beobachter = new ResizeObserver(() => melde(id, el.offsetHeight + ABSTAND_PX));
    beobachter.observe(el);
    melde(id, el.offsetHeight + ABSTAND_PX);
    return () => {
      beobachter.disconnect();
      melde(id, null);
    };
  }, [offen, melde, id]);

  // Woher der Fokus kam: das letzte, was ausserhalb der Leiste und ausserhalb
  // eines Dialogs fokussiert war — beim Öffnen meist das eben gesetzte
  // Kästchen. Geht sie zu, und der Fokus fällt dabei ins Leere (er stand in
  // ihr oder in einem Dialog, den sie öffnete), kehrt er dorthin zurück.
  useLayoutEffect(() => {
    if (!offen) return;
    const aussen = (t: EventTarget | null): t is HTMLElement =>
      t instanceof HTMLElement && t !== document.body && !ref.current?.contains(t) && !t.closest("dialog");
    if (aussen(document.activeElement)) fokusVorher.current = document.activeElement;
    const merke = (e: FocusEvent) => {
      if (aussen(e.target)) fokusVorher.current = e.target;
    };
    document.addEventListener("focusin", merke);
    return () => {
      document.removeEventListener("focusin", merke);
      const zurueck = fokusVorher.current;
      requestAnimationFrame(() => {
        const leer = !document.activeElement || document.activeElement === document.body;
        if (leer && zurueck?.isConnected) zurueck.focus();
      });
    };
  }, [offen]);

  if (!offen) return null;
  return (
    <div className={cn(unterRand, "z-30")} style={{ bottom: UNTER_RAND_ABSTAND }}>
      <div
        ref={ref}
        role="region"
        aria-label="Auswahl"
        className="pointer-events-auto flex min-h-13 w-full max-w-2xl flex-wrap items-center gap-3 rounded-flaeche bg-elev-08 py-2 pl-4 pr-2 shadow-dp-06 motion-safe:animate-snackbar-ein motion-reduce:animate-einblenden"
      >
        <span className="type-title-small text-on-surface">{titel}</span>
        {children}
        <Button variant="quiet" className="ml-auto" onClick={onAufheben}>
          Auswahl aufheben
        </Button>
      </div>
    </div>
  );
}
