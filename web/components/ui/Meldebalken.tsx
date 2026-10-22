import { cn } from "@/lib/cn";
import { richtwertText } from "@/lib/spiel";

/* Wie viele kommen, als Balken (Epic #490, Tafeln 2b, 2d, 9): Der helle
   Anteil sind die Angemeldeten von allen, für die der Termin gilt; ein
   Richtwert liegt als hellere Zone darunter — mit nur einer Mindestzahl bis
   ans Ende, mit nur einer Höchstzahl ab dem Anfang. Der Balken bewertet
   nicht: Er bleibt ungefärbt, die Bewertung sagt allein der Status. Neu im
   Kit, weil keine Anzeige eine Menge gegen einen Bereich zeigt.

   Darüber links die Zahl («7 angemeldet»), rechts der gesuchte Bereich mit
   der Gesamtzahl («gesucht 9 bis 12 von 14»). Vorgelesen wird beides in
   einem Satz. */
export function Meldebalken({
  zahl,
  gesamt,
  min = null,
  max = null,
  wort = "angemeldet",
  className,
}: {
  zahl: number;
  gesamt: number;
  min?: number | null;
  max?: number | null;
  /** «angemeldet» oder, ab Beginn, «da». */
  wort?: string;
  className?: string;
}) {
  const bereich = richtwertText(min, max);
  const anteil = (n: number) => `${Math.min(100, Math.max(0, gesamt > 0 ? (n / gesamt) * 100 : 0))}%`;
  const von = min ?? 0;
  const bis = max ?? gesamt;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div aria-hidden className="flex items-baseline justify-between gap-3 type-body-medium text-on-surface">
        <span>
          <span className="font-semibold">{zahl}</span> {wort}
        </span>
        <span className="type-body-small text-on-surface-mittel">
          {bereich ? `gesucht ${bereich} von ${gesamt}` : `von ${gesamt}`}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${zahl} von ${gesamt} ${wort}${bereich ? `, gesucht ${bereich}` : ""}`}
        className="relative h-2 overflow-hidden rounded-full bg-on-surface/10"
      >
        {bereich && (
          <div className="absolute inset-y-0 bg-on-surface/16" style={{ left: anteil(von), width: `calc(${anteil(bis)} - ${anteil(von)})` }} />
        )}
        <div className="umkehr absolute inset-y-0 left-0 rounded-full" style={{ width: anteil(zahl) }} />
      </div>
    </div>
  );
}
