import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Placement = "top" | "bottom";

/* Tooltip (schlicht): kurze Beschriftung auf der höchsten Stufe (24dp) samt
   Schatten — er schwebt über allem, was gerade auf dem Schirm liegt, und
   braucht darum keine Umkehrung ins Helle, um sich abzuheben. CSS-only — erscheint bei
   Hover und Tastatur-Fokus auf dem umschlossenen Trigger (`group-hover` /
   `group-focus-within`). `aria-hidden`, weil der Trigger (z. B. IconButton)
   den Namen bereits über sein `aria-label` trägt — kein doppeltes Vorlesen.

   Verwendung: einen einzelnen interaktiven Trigger umschliessen.
     <Tooltip label="Bearbeiten">
       <IconButton icon={Pencil} label="Bearbeiten" … />
     </Tooltip> */
export function Tooltip({
  label,
  placement = "top",
  children,
  className,
}: {
  label: string;
  placement?: Placement;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          // Standard: versteckt + nicht klickbar; sichtbar bei Hover/Fokus.
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-flaeche bg-elev-24 px-2 py-1 text-on-surface shadow-dp-08 opacity-0 transition-opacity duration-150",
          "type-label-small",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}
