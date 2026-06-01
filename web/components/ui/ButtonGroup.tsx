import { cn } from "@/lib/cn";

/* M3 Connected Button Group: verbundene Aktions-Buttons in einer Reihe.
   Außenecken gerundet, Innenecken eckig, 2px-Lücke (Container scheint durch).
   Für GRUPPIERTE AKTIONEN — Single-Select-Auswahl macht die SegmentedControl. */
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
        "[&>button:first-child]:rounded-r-none",
        "[&>button:last-child]:rounded-l-none",
        "[&>button:not(:first-child):not(:last-child)]:rounded-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
