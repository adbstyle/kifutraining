"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ein beschrifteter Abschnitt eines längeren Formulars — die Überschrift im
 * Stil der Abschnitte auf der Übungs-Detailseite (`type-title-medium`,
 * gedämpft), damit Maske und Ansicht dieselbe Gliederung sprechen.
 *
 * `children` darf eine Funktion sein: Sie bekommt die Id der Überschrift, an
 * der ein Feld ohne eigenes Label (Dateifeld, Material-Gruppe) seinen Namen
 * per `aria-labelledby` festmacht, statt ihn ein zweites Mal sichtbar zu
 * wiederholen.
 */
export function FormAbschnitt({
  titel,
  fehler = false,
  children,
}: {
  titel: string;
  /** Trägt ein Feld ohne eigenes Label einen Fehler, zeigt ihn die
   *  Überschrift an — sie ist dann dessen Beschriftung. */
  fehler?: boolean;
  children: ReactNode | ((titelId: string) => ReactNode);
}) {
  const titelId = useId();
  return (
    <section aria-labelledby={titelId} className="flex flex-col gap-5">
      <h2
        id={titelId}
        className={cn("type-title-medium", fehler ? "text-error" : "text-on-surface-mittel")}
      >
        {titel}
      </h2>
      {typeof children === "function" ? children(titelId) : children}
    </section>
  );
}
