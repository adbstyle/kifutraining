import { cn } from "@/lib/cn";

/* Die Grundfläche mit Inhalt: eine Stufe über dem Grund (01dp) und sonst
   nichts. Die Höhe trägt die Karte, nicht der Rand — im Dunkeln liest sich
   die aufgehellte Fläche als «liegt oben auf», eine zusätzliche Kontur
   zöge bloss einen zweiten Strich um etwas, das schon abgegrenzt ist. */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative rounded-flaeche bg-elev-01 [--feld-grund:var(--color-elev-01)]", className)}
      {...props}
    >
      {children}
    </div>
  );
}
