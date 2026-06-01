"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* M3 Dialog — modal, auf dem nativen <dialog>-Element (echter Fokus-Trap,
   Escape, ::backdrop-Scrim aus dem Browser). Gespeist aus --dialog-*-Tokens.
   `actions` nimmt typischerweise Text-/Tonal-Buttons auf. */
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
        "m-auto w-[min(28rem,calc(100vw-2rem))] rounded-(--dialog-shape) bg-(--dialog-container) p-6 shadow-e5",
        "backdrop:bg-scrim/60 backdrop:backdrop-blur-[2px]",
        className,
      )}
    >
      {title && (
        <h2 className="type-headline-small mb-3 text-(--dialog-headline)">
          {title}
        </h2>
      )}
      <div className="type-body-medium text-(--dialog-text)">{children}</div>
      {actions && (
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      )}
    </dialog>
  );
}
