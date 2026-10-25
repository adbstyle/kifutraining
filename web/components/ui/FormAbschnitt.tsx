"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ein beschrifteter Abschnitt eines längeren Formulars — die Überschrift im
 * Stil der Abschnitte auf der Übungs-Detailseite (`type-title-medium`,
 * gedämpft), damit Maske und Ansicht dieselbe Gliederung sprechen.
 *
 * `imDialog`: die kleinere Form innerhalb eines Dialogs (Termin erstellen
 * und ändern, Epic #518) — eine Linie trennt den Abschnitt vom Vorigen, die
 * Überschrift steht in `type-label-medium`, darunter ein Satz, wozu der
 * Abschnitt dient (`untertitel`), damit die Felder darunter nicht jedes für
 * sich erklärt werden müssen.
 *
 * `children` darf eine Funktion sein: Sie bekommt die Id der Überschrift, an
 * der ein Feld ohne eigenes Label (Dateifeld, Material-Gruppe) seinen Namen
 * per `aria-labelledby` festmacht, statt ihn ein zweites Mal sichtbar zu
 * wiederholen.
 */
export function FormAbschnitt({
  titel,
  untertitel,
  imDialog = false,
  fehler = false,
  children,
}: {
  titel: string;
  /** Ein Satz unter der Überschrift: wozu der Abschnitt dient. */
  untertitel?: string;
  /** Die kleinere Form innerhalb eines Dialogs, mit Linie darüber. */
  imDialog?: boolean;
  /** Trägt ein Feld ohne eigenes Label einen Fehler, zeigt ihn die
   *  Überschrift an — sie ist dann dessen Beschriftung. */
  fehler?: boolean;
  children: ReactNode | ((titelId: string) => ReactNode);
}) {
  const titelId = useId();
  return (
    <section
      aria-labelledby={titelId}
      className={cn("flex flex-col", imDialog ? "gap-4 border-t border-linie pt-4" : "gap-5")}
    >
      <div className="flex flex-col gap-1">
        <h2
          id={titelId}
          className={cn(
            imDialog ? "type-label-medium" : "type-title-medium",
            fehler ? "text-error" : imDialog ? "text-on-surface" : "text-on-surface-mittel",
          )}
        >
          {titel}
        </h2>
        {untertitel && <p className="type-body-small text-on-surface-mittel">{untertitel}</p>}
      </div>
      {typeof children === "function" ? children(titelId) : children}
    </section>
  );
}
