"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/* Primärer Trainingsteil-Schalter im Übungspool.
   role=tablist + Pfeiltasten-Navigation (a11y). Horizontal
   scrollbar auf Mobile.

   EINE Kontur um die ganze Leiste, kein Polster und keine Lücke dazwischen:
   Die Segmente stossen aneinander, das aktive ist die hellere Fläche IN der
   Leiste — nicht eine eigene Pille, die in einem Kasten schwimmt. Darum trägt
   auch nur die Leiste eine Rundung; die Segmente werden von ihr beschnitten. */
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
        // `overflow-x-auto` beschneidet bereits auf den Radius und lässt die
        // Leiste auf schmalen Schirmen weiterhin scrollen; senkrecht wird hart
        // abgeschnitten, damit die Ecken sauber bleiben.
        "inline-flex overflow-x-auto overflow-y-hidden rounded-flaeche kontur border-kante",
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
              // `focus-ring-inset` statt `focus-ring`: Die Leiste beschneidet
              // ihren Inhalt, ein Ring mit Aussen-Offset fiele darum an den
              // Rändern der Kontur zum Opfer.
              "focus-ring-inset type-title-small shrink-0 px-4 py-2 transition-colors",
              active
                ? "bg-elev-08 text-on-surface"
                : "text-on-surface-mittel state",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
