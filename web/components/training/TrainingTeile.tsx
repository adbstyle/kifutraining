import type { ReactNode } from "react";
import { formatDuration } from "@/lib/training";
import { abschnittMitVariante, type Variante } from "@/lib/varianten";

/** Ein Abschnitt aus `leseGliederung`. */
type Abschnitt<T> = {
  key: string;
  label: string;
  sum: number;
  traegtDauer: boolean;
  bloecke: { key: string; label: string | null; sum: number; items: T[] }[];
};

/* Die Trainingsteile eines Trainings zum Lesen: je Teil eine Karte mit Dauer,
   darin die Blöcke und ihre Übungen. Geteilt von der Trainingsansicht und dem
   Reiter «Training» am Termin (#435) — dieselbe Ansicht, nicht eine zweite.
   Wie eine Übungszeile aussieht, bestimmt der Aufrufer (`zeile`): In der
   Trainingsansicht öffnet sie die Übung, am Termin nicht. */
export function TrainingTeile<T extends { durationMin: number | null }>({
  sections,
  aktive,
  varianten,
  zeile,
}: {
  sections: Abschnitt<T>[];
  aktive: Variante | undefined;
  varianten: Variante[];
  zeile: (item: T, dauer: string | null) => ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {sections.map((s) => (
        <section key={s.key} className="rounded-flaeche bg-elev-01 p-4 sm:p-5">
          <h2 className="mb-3 type-title-medium text-on-surface">
            {/* Welche Variante hier steht, gehört an den Hauptteil selbst —
                nicht nur an die Wahl darüber (#203 AK 5). */}
            {abschnittMitVariante(s.key, s.label, aktive, varianten)}
            {s.sum > 0 && <span className="ml-2 type-label-medium text-on-surface-mittel">{formatDuration(s.sum)}</span>}
          </h2>
          <div className="flex flex-col gap-4">
            {s.bloecke.map((b) => (
              <div key={b.key}>
                {b.label && (
                  <h3 className="mb-2 type-title-small text-on-surface-mittel">
                    {b.label}
                    {b.sum > 0 && <span className="ml-2 type-label-medium text-on-surface-mittel">{formatDuration(b.sum)}</span>}
                  </h3>
                )}
                <ol className="flex flex-col gap-2">
                  {b.items.map((item) =>
                    zeile(item, s.traegtDauer && item.durationMin != null ? formatDuration(item.durationMin) : null),
                  )}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
