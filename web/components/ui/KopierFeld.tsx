"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { SectionMessage } from "./SectionMessage";
import { TextField } from "./TextField";
import { Tooltip } from "./Tooltip";

/** Wie lange der Knopf den Haken zeigt. */
export const KOPIERT_MS = 2500;
export const KOPIEREN_FEHLER = "Kopieren ging nicht - markiere den Text und kopiere ihn von Hand.";

/* Ein Geheimnis zum Weitergeben (Epic #433): ein schreibgeschütztes Feld mit
   dem Kopier-Knopf rechts davon. Neu, weil privater Link, Abholadresse und
   abgeholter Link dasselbe brauchen — und sonst jede Stelle Zwischenablage,
   Haken, Rückfall und Vorlesehilfe nachbaute.

   Gelingt das Kopieren, zeigt der Knopf eine Weile einen Haken, und die
   Vorlesehilfe hört es über die Live-Region; `onKopiert` meldet es zusätzlich
   (etwa in der Snackbar, wo kein Dialog darüberliegt). Ohne Zwischenablage
   (unsicherer Kontext, verweigert) bleibt der Handweg: Das Feld wird
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
  const feld = useRef<HTMLInputElement>(null);
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
      feld.current?.focus();
      feld.current?.select();
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {fehler && <SectionMessage appearance="error">{KOPIEREN_FEHLER}</SectionMessage>}
      <div className="flex items-center gap-1">
        <TextField
          ref={feld}
          className="min-w-0 flex-1"
          label={label}
          value={value}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Tooltip label={kopiert ? "Kopiert" : "Kopieren"} ende>
          <IconButton icon={kopiert ? Check : Copy} label={`${label} kopieren`} onClick={kopieren} disabled={disabled} />
        </Tooltip>
        {danach}
        <span className="sr-only" role="status">
          {kopiert ? `${label} kopiert.` : ""}
        </span>
      </div>
    </div>
  );
}
