"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* M2 Dialog — modal, auf dem nativen <dialog>-Element (echter Fokus-Trap,
   Escape, ::backdrop-Scrim aus dem Browser). Die höchste Fläche der App
   (24dp): ein Dialog liegt über allem, also trägt er die hellste Stufe und
   den weichesten Schatten.

   `actions` nimmt typischerweise Text-/Tonal-Buttons auf. Text-Knöpfe bleiben
   hier Primary, obwohl es auf 24dp knapp unter die 4.5:1 für Fliesstext fällt
   — Materials eigene Baseline hält es genauso, und ein eigener Farbton nur für
   Dialoge risse die Handlungsfarbe der App auseinander. Die Zahl steht nicht
   hier, sondern gerechnet im Styleguide (18 «Dialog & Snackbar»), wo sie auch
   als bewusste Abweichung begründet ist. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-dialog bg-elev-24 p-6 shadow-dp-24",
        // Schwebende Feldbeschriftungen stanzen ihre Fläche aus `--feld-grund`
        // (Vorgabe 00dp, der Grund). Im Dialog liegt darunter 24dp — ohne
        // diese Zeile stünde jedes Label in einem dunklen Rechteck.
        "[--feld-grund:var(--color-elev-24)]",
        "backdrop:bg-scrim/60 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {title && (
        <h2 className="type-headline-small mb-3 text-on-surface">
          {title}
        </h2>
      )}
      <div className="type-body-medium text-on-surface-mittel">{children}</div>
      {actions && (
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      )}
    </dialog>
  );
}
