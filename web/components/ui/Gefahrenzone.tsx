import { useId } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/* Gefahrenzone (#480): der Bereich am Ende einer Verwaltungsseite, in dem die
   Handlungen stehen, die sich nicht zurücknehmen lassen und andere mittreffen
   — beim Team Verlassen und Auflösen. Vorbild ist die «Danger Zone» von GitHub.

   Eine Karte wie jede andere (01dp), aber mit voller Kontur in Error und der
   Überschrift in Error: So hebt sie sich ab, ohne dass die ganze Fläche rot
   wird — eine getönte Fläche (`section-danger`) ist die Meldung «etwas ist
   schiefgegangen», nicht «hier ist Vorsicht geboten». Error trägt auf jeder
   Höhenstufe 4.5:1 als Schrift und 3:1 als Kontur (check:farben), auch im
   Druck. Eine Kontur mit Alpha bräche die 3:1 — darum volles `border-error`.

   Der Inhalt trägt die Knöpfe; die destruktive Handlung selbst ist `danger`. */
export function Gefahrenzone({
  titel = "Gefahrenzone",
  beschreibung,
  children,
  className,
}: {
  titel?: string;
  /** Ein Satz, was die Handlungen hier bewirken. */
  beschreibung?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-flaeche kontur border-error bg-elev-01 p-5 sm:p-6", className)}
    >
      <h2 id={id} className="type-title-large flex items-center gap-2 text-error">
        <AlertTriangle size={20} strokeWidth={2} aria-hidden />
        {titel}
      </h2>
      {beschreibung && (
        <p className="type-body-medium mt-2 text-on-surface-mittel">{beschreibung}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
