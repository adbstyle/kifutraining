"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ChipMenu } from "@/components/ui";

export type SortierOption = {
  label: string;
  href: string;
  gewaehlt: boolean;
  /** Ein Strich davor: die Richtung folgt nach den Spalten. */
  trenner?: boolean;
};

/* Die Sortierung der Trainingsübersicht schmal (#629): Dort fehlen die
   Spaltenköpfe, sortieren lässt sich trotzdem — über einen Chip mit Menü
   (`ChipMenu`), wie die übrigen Wahlen der Filterleiste. Oben die Spalten,
   nach dem Strich die Richtung; die Haken zeigen die aktuelle Wahl.

   Die Adressen rechnet die Seite (`sortierHref`), damit Kopf und Chip
   dieselbe Regel teilen; hier wird nur navigiert. */
export function TrainingSortierWahl({
  spalte,
  richtung,
  optionen,
  className,
}: {
  /** Die Beschriftung der aktiven Spalte. */
  spalte: string;
  richtung: "auf" | "ab";
  optionen: SortierOption[];
  className?: string;
}) {
  const router = useRouter();
  const Pfeil = richtung === "auf" ? ArrowUp : ArrowDown;
  return (
    <ChipMenu
      label={spalte}
      leading={<Pfeil size={14} strokeWidth={2} aria-hidden className="shrink-0" />}
      ariaLabel={`Sortiert nach ${spalte}, ${richtung === "auf" ? "aufsteigend" : "absteigend"}. Sortierung ändern`}
      menuClassName="right-0"
      className={className}
      items={optionen.map((o) => ({
        label: o.label,
        gewaehlt: o.gewaehlt,
        trenner: o.trenner,
        onSelect: () => router.push(o.href, { scroll: false }),
      }))}
    />
  );
}
