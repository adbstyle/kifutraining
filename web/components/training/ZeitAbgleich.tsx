import { BANDBREITEN } from "@/lib/junioren";

/* Soll-Ist-Abgleich einer Dauer-Summe gegen die Zeitbandbreite des
   Juniorenschemas (Story 6). Das Kinderfussball-Manual gibt bewusst keine
   Zeiten vor — dort erscheint dieser Abgleich nie.

   Rein informativ: er beeinflusst weder Speichern noch Veröffentlichen
   (AC 6). Ohne erfasste Dauer nur der Richtwert, ohne Bewertung (AC 3).
   Werte exakt auf einer Grenze zählen als innerhalb. */
export function ZeitAbgleich({ slug, sum }: { slug: string; sum: number }) {
  const band = BANDBREITEN[slug];
  if (!band) return null;

  const richtwert = `${band.min}–${band.max} min`;
  if (sum === 0)
    return (
      <span className="type-label-medium text-on-surface-variant">
        Richtwert {richtwert}
      </span>
    );

  const delta = sum < band.min ? sum - band.min : sum > band.max ? sum - band.max : 0;
  return (
    <span className="type-label-medium text-on-surface-variant">
      Richtwert {richtwert}
      {delta !== 0 && (
        <span className="text-signal">
          {" "}
          ({delta > 0 ? `+${delta}` : delta} min)
        </span>
      )}
    </span>
  );
}

/* Gesamtdauer gegen die vorgesehenen 90 Minuten (Story 6 AC 4). */
export function GesamtAbgleich({ sum, soll }: { sum: number; soll: number }) {
  const delta = sum - soll;
  return (
    <span className="type-label-medium text-on-surface-variant">
      vorgesehen {soll} min
      {sum > 0 && delta !== 0 && (
        <span className="text-signal">
          {" "}
          ({delta > 0 ? `+${delta}` : delta} min)
        </span>
      )}
    </span>
  );
}
