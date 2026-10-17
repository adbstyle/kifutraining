import { Lozenge } from "@/components/ui";

/** Ob der aktuelle Link einer Spieler:in über die Selbstabholung bezogen
 *  wurde (#438 AK 21) — in der Spielerliste und im Link-Dialog. */
export function BezogenLozenge({ bezogen, className }: { bezogen: boolean; className?: string }) {
  return (
    <Lozenge appearance={bezogen ? "success" : "neutral"} className={className}>
      {bezogen ? "Bezogen" : "Nicht bezogen"}
    </Lozenge>
  );
}
