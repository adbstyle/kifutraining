"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { SectionMessage } from "./SectionMessage";
import { Tooltip } from "./Tooltip";

/** Wie lange der Knopf den Haken zeigt. */
export const KOPIERT_MS = 2500;
export const KOPIEREN_FEHLER = "Kopieren ging nicht - markiere den Text und kopiere ihn von Hand.";

/* Ein Geheimnis zum Weitergeben (Epic #433): der Wert in einem Kasten mit
   Kontur, so hoch wie die Knöpfe daneben und ohne sichtbaren Namen, rechts
   davon der Kopier-Knopf (PO 2026-10-17). Der Kasten ist kein Feld: nicht
   fokussierbar, ohne Fokus- und Überfahr-Zustand — bedient wird allein der
   Knopf; den Namen hört die Vorlesehilfe. Neu, weil privater Link, Abholadresse und
   abgeholter Link dasselbe brauchen — und sonst jede Stelle Zwischenablage,
   Haken, Rückfall und Vorlesehilfe nachbaute.

   Gelingt das Kopieren, zeigt der Knopf eine Weile einen Haken, und die
   Vorlesehilfe hört es über die Live-Region; `onKopiert` meldet es zusätzlich
   (etwa in der Snackbar, wo kein Dialog darüberliegt). Ohne Zwischenablage
   (unsicherer Kontext, verweigert) bleibt der Handweg: Der Wert wird
   markiert, und darüber steht, wie es weitergeht. `danach`: weitere Knöpfe
   in derselben Zeile (etwa ein Menü mit «erneuern»). */
export function KopierFeld({
  label,
  value,
  onKopiert,
  disabled,
  danach,
  className,
}: {
  label: string;
  value: string;
  onKopiert?: () => void;
  disabled?: boolean;
  danach?: React.ReactNode;
  className?: string;
}) {
  const wert = useRef<HTMLSpanElement>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (!kopiert) return;
    const t = setTimeout(() => setKopiert(false), KOPIERT_MS);
    return () => clearTimeout(t);
  }, [kopiert]);
  // Ein neuer Wert (erneuert) ist noch nicht kopiert.
  useEffect(() => setKopiert(false), [value]);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(value);
      setFehler(false);
      setKopiert(true);
      onKopiert?.();
    } catch {
      setKopiert(false);
      setFehler(true);
      // Den Wert markieren, damit Strg/Cmd+C genügt.
      const auswahl = window.getSelection();
      if (wert.current && auswahl) {
        const bereich = document.createRange();
        bereich.selectNodeContents(wert.current);
        auswahl.removeAllRanges();
        auswahl.addRange(bereich);
      }
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {fehler && <SectionMessage appearance="error">{KOPIEREN_FEHLER}</SectionMessage>}
      <div className="flex items-center gap-1">
        <div className="kontur flex h-9 min-w-0 flex-1 items-center rounded-flaeche border-kante px-3">
          <span className="sr-only">{label}: </span>
          <span ref={wert} className="min-w-0 truncate type-body-large text-on-surface">
            {value}
          </span>
        </div>
        <Tooltip label={kopiert ? "Kopiert" : "Kopieren"} ende>
          <IconButton primary icon={kopiert ? Check : Copy} label={`${label} kopieren`} onClick={kopieren} disabled={disabled} />
        </Tooltip>
        {danach}
        <span className="sr-only" role="status">
          {kopiert ? `${label} kopiert.` : ""}
        </span>
      </div>
    </div>
  );
}
