import { cn } from "@/lib/cn";

/** Die Töne des Punkts: `primary` meldet Neues (Version, #410), `success` und
 *  `warning` einen Zustand (privater Link bezogen oder nicht, #447). */
export type ZeichenPunktTon = "primary" | "success" | "warning";

const TON: Record<ZeichenPunktTon, string> = {
  primary: "bg-primary",
  success: "bg-icon-success",
  warning: "bg-icon-warning",
};

/* Ein Punkt oben rechts an einem Zeichen — wie die Benachrichtigung an einem
   App-Symbol. Er sagt etwas über das Zeichen, ohne eine Spalte oder Plakette
   zu brauchen. Der Ring in der Kartenfläche (`elev-01`) löst ihn vom Strich
   des Zeichens. Der Punkt ist stumm: Was er meldet, gehört in den Namen des
   Knopfs oder in einen sr-only-Text daneben. Der Eltern-Span trägt
   `relative`. */
export function ZeichenPunkt({ ton, className }: { ton: ZeichenPunktTon; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-elev-01", TON[ton], className)}
    />
  );
}
