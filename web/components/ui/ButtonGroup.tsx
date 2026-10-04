import { cn } from "@/lib/cn";

import { chipTextSelected } from "./Chip";

/* Verbundene Knopfgruppe: Knöpfe oder Links in einer Reihe. Aussenecken
   gerundet, Innenecken eckig, 2 px Lücke (der Grund scheint durch). Die
   Glieder stehen direkt in der Gruppe, ohne Tooltip.
   Für GRUPPIERTE AKTIONEN und für den Wechsel der Darstellung derselben Sache
   (Liste/Monat) — die Einfachauswahl in einem Formular machen die
   ChoiceChipGroup (offen, 10) und das Auswahlfeld mit Panel (16). */
export function ButtonGroup({
  children,
  ariaLabel,
  className,
}: {
  children: React.ReactNode;
  /** Pflicht: a11y-Label der Gruppe (role="group"). */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex gap-0.5",
        "[&>:first-child]:rounded-r-none",
        "[&>:last-child]:rounded-l-none",
        "[&>:not(:first-child):not(:last-child)]:rounded-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Ein Glied nur mit Zeichen (36 px im Quadrat), etwa die Ansicht Liste/Monat.
 *  Gewählt trägt es die Auswahl-Optik der Chips — Kontur und Zeichen in
 *  Primary, ohne Fläche —, leiser als ein gefüllter Knopf daneben;
 *  sonst nur die Kontur. Die Gruppe kennt keine Wahl: Wer `gewaehlt` setzt,
 *  setzt auch `aria-current` bzw. `aria-pressed`. */
export function segmentClasses(gewaehlt: boolean): string {
  return cn(
    "state focus-ring kontur inline-flex h-9 w-9 items-center justify-center rounded-flaeche transition-colors",
    gewaehlt ? chipTextSelected : "border-kante text-on-surface-mittel",
  );
}
