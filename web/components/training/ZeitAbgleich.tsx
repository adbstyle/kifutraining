import { gesamtAbgleich, zeitAbgleich } from "@/lib/junioren";

/* Soll-Ist-Abgleich einer Dauer-Summe gegen die Zeitbandbreite des
   Juniorenschemas (Story 6). Das Kinderfussball-Manual gibt bewusst keine
   Zeiten vor — dort erscheint dieser Abgleich nie.

   Rechnung und Wortlaut stehen in `lib/junioren.ts` (`zeitAbgleich`,
   `gesamtAbgleich`), damit die Hinweise an den KI-Assistenten denselben Text
   tragen (#195). Hier bleibt nur die Darstellung: die Abweichung farbig. */
export function ZeitAbgleich({ slug, sum }: { slug: string; sum: number }) {
  const a = zeitAbgleich(slug, sum);
  if (!a) return null;
  return (
    <span className="type-label-medium text-on-surface-mittel">
      {a.richtwertText}
      {a.abweichungText && <span className="text-primary">{a.abweichungText}</span>}
    </span>
  );
}

/* Gesamtdauer gegen die vorgesehenen 90 Minuten (Story 6 AC 4). */
export function GesamtAbgleich({ sum, soll }: { sum: number; soll: number }) {
  const a = gesamtAbgleich(sum, soll);
  return (
    <span className="type-label-medium text-on-surface-mittel">
      {a.vorgesehenText}
      {a.abweichungText && <span className="text-primary">{a.abweichungText}</span>}
    </span>
  );
}
