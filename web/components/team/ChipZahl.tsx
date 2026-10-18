import { Badge } from "@/components/ui";

/** Die Zahl an einem Kader-Chip (Spielerliste, Reiter «Spieler:innen» am
 *  Termin): wie viele Spieler:innen die Eingrenzung zeigt — als Badge, die
 *  Vorlesehilfe hört sie in Worten. */
export function ChipZahl({ n }: { n: number }) {
  return (
    <>
      <Badge>{n}</Badge>
      <span className="sr-only">, {n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`}</span>
    </>
  );
}
