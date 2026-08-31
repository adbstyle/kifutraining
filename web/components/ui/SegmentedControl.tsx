"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/* Primärer Trainingsteil-Schalter im Übungspool.
   role=tablist + Pfeiltasten-Navigation (a11y). Horizontal
   scrollbar auf Mobile. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  function handleKey(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
  }

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex gap-1 overflow-x-auto rounded-[4px] bg-surface-container border-[1.5px] border-outline p-1",
        className,
      )}
    >
      {options.map((opt, i) => {
        const active = opt.value === value;
        // Der Tabstopp wandert mit der Auswahl. Ist noch nichts gewählt, trägt
        // ihn das erste Segment — sonst wäre die Leiste per Tastatur gar nicht
        // erreichbar (etwa das noch leere Einordnungsfeld einer neuen Übung).
        const tabStop = active || (i === 0 && !options.some((o) => o.value === value));
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={tabStop ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKey(e, i)}
            className={cn(
              "focus-ring type-title-small shrink-0 rounded-[3px] px-4 py-2 transition-colors",
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
