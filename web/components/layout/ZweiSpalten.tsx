import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Inhalt links, eine zweite Spalte rechts daneben (Epic #350) — die
 * Einordnung einer Übung auf ihrer Seite und in ihrer Maske. Ab `xl` stehen
 * beide nebeneinander, die Spalte 20 rem breit; darunter stehen sie
 * untereinander. Der Inhalt behält seine Lesebreite (`max-w-4xl`) und auf
 * dem kleinsten zweispaltigen Fenster (1280 px, breite Leiste) noch die
 * Breite, die das Feld-Diagramm zum Zeichnen braucht.
 *
 * `spalteZuerst`: Gestapelt steht die Spalte VOR dem Inhalt — in der Maske,
 * wo die Einordnung bestimmt, welche Felder der Inhalt verlangt (#353 AK 6).
 * Sonst folgt sie ihm (Übungsseite). Der Quelltext folgt in beiden Fällen der
 * gestapelten Reihenfolge, so lesen Tastatur und Vorlesehilfe überall gleich.
 *
 * `druckDaneben`: Auf Papier bleibt die Spalte daneben, schmaler als am
 * Schirm (Übungsblatt).
 *
 * `beiseite`: Die Spalte ist ergänzender Inhalt (`aside`, Übungsseite). In der
 * Maske trägt sie Pflichtfelder und ist darum ein gewöhnlicher Block — eine
 * Vorlesehilfe soll sie nicht als Nebensache ankündigen.
 */
export function ZweiSpalten({
  spalte,
  spalteZuerst = false,
  druckDaneben = false,
  beiseite = true,
  children,
  className,
}: {
  spalte: ReactNode;
  spalteZuerst?: boolean;
  druckDaneben?: boolean;
  beiseite?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const inhalt = <div className="min-w-0 max-w-4xl xl:col-start-1 xl:row-start-1">{children}</div>;
  const Spalte = beiseite ? "aside" : "div";
  const rechts = (
    <Spalte
      className={cn(
        "min-w-0 max-w-4xl xl:col-start-2 xl:row-start-1",
        druckDaneben && "print:col-start-2 print:row-start-1",
      )}
    >
      {spalte}
    </Spalte>
  );
  return (
    <div
      className={cn(
        "flex flex-col gap-10 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start",
        druckDaneben &&
          "print:grid print:grid-cols-[minmax(0,1fr)_14rem] print:items-start print:gap-6",
        className,
      )}
    >
      {spalteZuerst ? (
        <>
          {rechts}
          {inhalt}
        </>
      ) : (
        <>
          {inhalt}
          {rechts}
        </>
      )}
    </div>
  );
}
