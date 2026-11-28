"use client";

import { EingrenzungLeer } from "./KaderEingrenzung";
import { useAdressFilter } from "@/lib/use-adress-filter";
import { TEAM_SPIELER_FILTER } from "@/lib/spieler";
import { BEHALTE_BEIM_ZURUECKSETZEN } from "@/lib/teilnahme";

/* Trifft die Eingrenzung in einer Sicht unter «Spieler:innen» niemanden
   (#702 AK 10), steht dasselbe Leerfeld wie in der Liste (#601 AK 7, 8): mit
   dem Weg zurück zu allen. Zurücksetzen lässt Zeitraum, offene Teilnahme und
   Sortierung stehen. */
export function TeilnahmeLeer() {
  const filter = useAdressFilter({ behalte: BEHALTE_BEIM_ZURUECKSETZEN });
  return (
    <EingrenzungLeer
      titel={TEAM_SPIELER_FILTER.leerTitel}
      aufhebenText={TEAM_SPIELER_FILTER.zuruecksetzen}
      onAufheben={filter.zuruecksetzen}
    >
      {TEAM_SPIELER_FILTER.leerText}
    </EingrenzungLeer>
  );
}
