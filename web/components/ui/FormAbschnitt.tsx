"use client";

import { useId, type ReactNode } from "react";

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
  children,
}: {
  titel: string;
  children: ReactNode | ((titelId: string) => ReactNode);
}) {
  const titelId = useId();
  return (
    <section aria-labelledby={titelId} className="flex flex-col gap-5">
      <h2 id={titelId} className="type-title-medium text-on-surface-mittel">
        {titel}
      </h2>
      {typeof children === "function" ? children(titelId) : children}
    </section>
  );
}
