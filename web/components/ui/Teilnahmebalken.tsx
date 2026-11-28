import { cn } from "@/lib/cn";

/** Die Töne der Anteile — je einer für «da» und für jeden Grund, der Rest
 *  der Termine ausmacht. */
export type TeilnahmeTon = "da" | "grau" | "hellgrau" | "orange" | "violett" | "blau";

/* Literale Klassen — Tailwind findet nur, was ausgeschrieben im Quelltext
   steht. Die Töne der Icon-Rollen: dieselben, die Zeichen für Erfolg,
   Warnung und Hinweis tragen, also auf jedem Grund sichtbar. */
export const TEILNAHME_TON: Record<TeilnahmeTon, string> = {
  da: "bg-icon-success",
  grau: "bg-on-surface-tief",
  hellgrau: "bg-kante",
  orange: "bg-icon-warning",
  violett: "bg-icon-discovery",
  blau: "bg-icon-information",
};

/** Der Farbpunkt eines Anteils vor seiner Zahl — die Legende des Balkens. */
export function TeilnahmePunkt({ ton }: { ton: TeilnahmeTon }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-klein", TEILNAHME_TON[ton])} />;
}

/* Teilnahmebalken (#700): wie sich eine Zahl von Terminen auf «da» und die
   Gründe für «nicht da» verteilt, als Balken aus Anteilen. Er ergänzt die
   Zahlen daneben und trägt keine eigene Aussage — darum `aria-hidden`; wer
   ihn nutzt, nennt die Zahlen als Text (Liste der Gründe). Kein
   Fortschrittsbalken (`BestandAnzeige`): Er zeigt keinen Weg zu einem Ziel,
   sondern eine Verteilung. Anteile ohne Termine fallen weg; ohne Termine
   steht nur die leere Spur. Eine weisse Fuge trennt die Anteile, damit sie
   nicht nur über die Farbe zu unterscheiden sind. */
export function Teilnahmebalken({
  anteile,
  className,
}: {
  anteile: readonly { anzahl: number; ton: TeilnahmeTon }[];
  className?: string;
}) {
  const gesamt = anteile.reduce((s, a) => s + a.anzahl, 0);
  return (
    <div aria-hidden className={cn("flex h-3 overflow-hidden rounded-full bg-elev-04", className)}>
      {gesamt > 0 &&
        anteile
          .filter((a) => a.anzahl > 0)
          .map((a, i) => (
            <span
              key={i}
              className={cn("h-full border-r-2 border-elev-01 last:border-r-0", TEILNAHME_TON[a.ton])}
              style={{ width: `${(a.anzahl / gesamt) * 100}%` }}
            />
          ))}
    </div>
  );
}
