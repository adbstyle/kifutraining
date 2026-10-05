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
 * Breit ist die ganze Zeile die Fläche des Knopfs und hellt beim Überfahren
 * auf wie eine Trainingskachel der Übersicht — die Zeile trägt dafür `state`
 * und ist `relative`; was in ihr selbst bedienbar ist, liegt mit `relative`
 * darüber.
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
          // Die Fläche des Knopfs reicht über die ganze Zeile (`before:`), wie
          // der Link einer Trainingskachel über die Kachel: Die Zeile öffnet,
          // wo sie keinen eigenen Knopf trägt. Aufgehellt wird sie von der
          // Zeile selbst (`state`), nicht vom Namen.
          "focus-ring hidden min-w-0 cursor-pointer truncate rounded-flaeche text-left type-body-medium xl:block",
          "xl:before:absolute xl:before:inset-0 xl:before:rounded-flaeche xl:before:content-['']",
          offen ? "text-primary" : "text-on-surface",
        )}
      >
        {name}
      </button>
    </>
  );
}
