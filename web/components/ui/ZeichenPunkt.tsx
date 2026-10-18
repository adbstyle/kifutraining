import { cn } from "@/lib/cn";

/** Die Töne des Punkts: `primary` meldet Neues (Version, #410), `success`
 *  einen erreichten Zustand (privater Link bezogen, #447). */
export type ZeichenPunktTon = "primary" | "success";

const TON: Record<ZeichenPunktTon, string> = {
  primary: "bg-primary",
  success: "bg-icon-success",
};

/* Ein Punkt oben rechts an einem Zeichen — wie die Benachrichtigung an einem
   App-Symbol. Er sagt etwas über das Zeichen, ohne eine Spalte oder Plakette
   zu brauchen. Ein Ring in der Farbe des Grunds löst ihn vom Strich des
   Zeichens: `--zeichen-grund`, das eine Fläche wie der Dialog (`elev-24`)
   setzt, sonst die Kartenfläche `elev-01`. Der Punkt ist stumm: Was er meldet, gehört in den Namen des
   Knopfs oder in einen sr-only-Text daneben. Der Eltern-Span trägt
   `relative`. */
export function ZeichenPunkt({ ton, className }: { ton: ZeichenPunktTon; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-[var(--zeichen-grund,var(--color-elev-01))]", TON[ton], className)}
    />
  );
}
