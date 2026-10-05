import { cn } from "@/lib/cn";

/**
 * Der Name einer Übung in den Übungen des Trainings — breit zugleich der
 * Knopf, der sie in der Spalte öffnet (Epic #369, Story #371 AK 1).
 *
 * Schmal gibt es keine Spalte und darum nichts zu öffnen: Dort steht der Name
 * als Text wie bisher (Epic OOS 1). Beide Fassungen stehen im Quelltext, die
 * Weiche ist CSS — so stimmt schon das erste HTML, ohne dass die Seite die
 * Breite erst messen müsste.
 *
 * Die geöffnete trägt `aria-current`: Sie ist die, deren Detail daneben steht
 * (AK 5). Ein zweiter Klick schliesst sie wieder.
 */
export function UebungsName({
  name,
  offen,
  onOeffnen,
}: {
  name: string;
  offen: boolean;
  onOeffnen: () => void;
}) {
  return (
    <>
      <span className="truncate type-body-medium text-on-surface xl:hidden">{name}</span>
      <button
        type="button"
        onClick={onOeffnen}
        aria-current={offen ? "true" : undefined}
        title={offen ? "Übung schliessen" : "Übung öffnen"}
        className={cn(
          "focus-ring hidden min-w-0 truncate rounded-flaeche text-left type-body-medium xl:block",
          offen ? "text-primary" : "text-on-surface hover:text-primary hover:underline",
        )}
      >
        {name}
      </button>
    </>
  );
}
