"use client";

import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ChipMenu } from "./ChipMenu";

export type SortierOption = {
  label: string;
  href: string;
  gewaehlt: boolean;
  /** Ein Strich davor: die Richtung folgt nach den Spalten. */
  trenner?: boolean;
};

/* Die Sortierung einer Tabelle schmal, wo die Spaltenköpfe fehlen — die
   Trainingsübersicht (#629) und die Teilnahme der Spieler:innen auf Karten
   (#702, Telefon-Prototyp «Sortieren nach»). Ein Chip mit Menü (`ChipMenu`),
   wie die übrigen Wahlen der Filterleiste. Oben die Spalten, nach dem Strich
   die Richtung; die Haken zeigen die aktuelle Wahl.

   Aus der Trainingsübersicht ins Kit gezogen (#702), weil eine zweite Tabelle
   ihn braucht; er kennt keine Domäne. Die Adressen rechnet die Seite, damit
   Kopf und Chip dieselbe Regel teilen; hier wird nur navigiert. */
export function SortierWahl({
  spalte,
  richtung,
  optionen,
  praefix,
  className,
}: {
  /** Die Beschriftung der aktiven Spalte. */
  spalte: string;
  /** Steht vor der Spalte im Chip, etwa «Sortieren nach:» — dort, wo der
   *  Chip allein über Karten steht und nicht in einer Filterleiste. */
  praefix?: string;
  richtung: "auf" | "ab";
  optionen: SortierOption[];
  className?: string;
}) {
  const router = useRouter();
  const Pfeil = richtung === "auf" ? ArrowUp : ArrowDown;
  return (
    <ChipMenu
      label={praefix ? `${praefix} ${spalte}` : spalte}
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
