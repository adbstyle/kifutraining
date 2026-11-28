import { useId } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

/* Gefahrenzone (#480): der Bereich am Ende einer Verwaltungsseite, in dem die
   Handlungen stehen, die sich nicht zurücknehmen lassen und andere mittreffen
   — beim Team das Verlassen, im Verein das Auflösen eines Teams und der
   Austritt aus der Verwaltung, im Konto das Löschen des Kontos (#662).
   Vorbild ist die «Danger Zone» von GitHub.

   Eine Karte wie jede andere (01dp), aber mit voller Kontur in Error und der
   Überschrift in Error: So hebt sie sich ab, ohne dass die ganze Fläche rot
   wird — eine getönte Fläche (`section-danger`) ist die Meldung «etwas ist
   schiefgegangen», nicht «hier ist Vorsicht geboten». Error trägt auf jeder
   Höhenstufe 4.5:1 als Schrift und 3:1 als Kontur (check:farben), auch im
   Druck. Eine Kontur mit Alpha bräche die 3:1 — darum volles `border-error`.

   Der Inhalt trägt die Knöpfe; die destruktive Handlung selbst ist `danger`.
   Eine eigene `<section>` statt `Card`: Die Überschrift benennt den Bereich
   (`aria-labelledby`), damit die Vorlesehilfe ihn als Gefahrenzone ansagt. */
export function Gefahrenzone({
  beschreibung,
  children,
  className,
  ebene = 2,
}: {
  /** Ein Satz, was die Handlungen hier bewirken. */
  beschreibung?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Die Ebene der Überschrift: 3 unter einer Bereichsüberschrift (Seite «Team», #704). */
  ebene?: 2 | 3;
}) {
  const id = useId();
  const Ueberschrift = ebene === 3 ? "h3" : "h2";
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-flaeche kontur border-error bg-elev-01 p-5 sm:p-6", className)}
    >
      <Ueberschrift id={id} className="type-title-large flex items-center gap-2 text-error">
        <AlertTriangle size={20} strokeWidth={2} aria-hidden />
        Gefahrenzone
      </Ueberschrift>
      {beschreibung && (
        <p className="type-body-medium mt-2 text-on-surface-mittel">{beschreibung}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}
