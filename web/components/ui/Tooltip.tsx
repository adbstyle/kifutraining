import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Tooltip (schlicht): kurze Beschriftung auf der höchsten Stufe (24dp) samt
   Schatten — er schwebt über allem, was gerade auf dem Schirm liegt, und
   braucht darum keine Umkehrung ins Helle, um sich abzuheben. Er steht immer
   unterhalb des Triggers: so verdeckt er nicht, was darüber liegt, und sitzt
   dort, wo der Blick nach dem Zeichen ohnehin hinwandert. CSS-only — erscheint
   bei Hover und Tastatur-Fokus auf dem umschlossenen Trigger (`group-hover` /
   `group-focus-within`). `aria-hidden`, weil der Trigger (z. B. IconButton)
   den Namen bereits über sein `aria-label` trägt — kein doppeltes Vorlesen.

   Verwendung: einen einzelnen interaktiven Trigger umschliessen.
     <Tooltip label="Bearbeiten">
       <IconButton icon={Pencil} label="Bearbeiten" … />
     </Tooltip>

   Verborgen ist er `display: none`, nicht bloss durchsichtig: Ein
   durchsichtiger Tooltip liegt trotzdem im Layout und verbreiterte an einem
   Trigger am rechten Rand die ganze Seite (waagrechter Scroll). Das Einblenden
   bleibt weich — `transition-discrete` lässt `display` mitlaufen, `starting:`
   setzt den Anfangswert beim Erscheinen.

   `ende`: bündig mit der rechten Kante des Triggers statt mittig — für
   Trigger am rechten Rand, über den ein mittiger Tooltip beim Zeigen
   hinausragte und abgeschnitten würde. */
export function Tooltip({
  label,
  children,
  className,
  ende,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  ende?: boolean;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        aria-hidden
        className={cn(
          // Standard: versteckt + nicht klickbar; sichtbar bei Hover/Fokus.
          "pointer-events-none absolute top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-flaeche bg-elev-24 px-2 py-1 text-on-surface shadow-dp-08 opacity-0 transition-[opacity,display] transition-discrete duration-150 starting:opacity-0",
          ende ? "right-0" : "left-1/2 -translate-x-1/2",
          "type-body-small",
          "group-hover:block group-hover:opacity-100 group-focus-within:block group-focus-within:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
