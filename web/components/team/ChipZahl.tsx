import { Badge } from "@/components/ui";

/** Die Zahl an einem Kader-Chip (Spielerliste, Reiter «Spieler:innen» am
 *  Termin): wie viele Spieler:innen die Eingrenzung zeigt — als Badge,
 *  neutral in Ruhe, Primary am gewählten Chip; die Vorlesehilfe hört sie in
 *  Worten. */
export function ChipZahl({ n, aktiv }: { n: number; aktiv: boolean }) {
  return (
    <>
      <Badge appearance={aktiv ? "primary" : "neutral"}>{n}</Badge>
      <span className="sr-only">, {n === 1 ? "1 Spieler:in" : `${n} Spieler:innen`}</span>
    </>
  );
}
