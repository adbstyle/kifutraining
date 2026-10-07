import { cn } from "@/lib/cn";

/* Verbundene Knopfgruppe: Knöpfe oder Links in einer Reihe. Aussenecken
   gerundet, Innenecken eckig, 2 px Lücke (der Grund scheint durch). Die
   Glieder stehen direkt in der Gruppe, ohne Tooltip.
   Für GRUPPIERTE AKTIONEN — die Einfachauswahl in einem Formular machen die
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
