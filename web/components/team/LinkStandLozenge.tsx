import { Lozenge, type ZeichenPunktTon } from "@/components/ui";
import type { LozengeAppearance } from "@/lib/farben";
import { LINK_STAND_TEXT, type LinkStand } from "@/lib/spieler";

/** Die Farben des Link-Stands (#657): grün abgeholt (erreicht), blau
 *  zugestellt (weitergegeben, ohne Gewissheit), offen neutral. Eine Quelle
 *  für Punkt und Lozenge. */
const LOZENGE: Record<LinkStand, LozengeAppearance> = { abgeholt: "success", zugestellt: "information", offen: "neutral" };

/** Der Punkt am Link-Knopf einer Zeile (AK 4): offen ohne Punkt. */
export const LINK_STAND_PUNKT: Record<LinkStand, ZeichenPunktTon | undefined> = {
  abgeholt: "success",
  zugestellt: "information",
  offen: undefined,
};

/** Der Stand des aktuellen Links einer Spieler:in (#438 AK 21, #657) — im
 *  Link-Dialog und in der Spielerliste des Vereins. */
export function LinkStandLozenge({ stand, className }: { stand: LinkStand; className?: string }) {
  return (
    <Lozenge appearance={LOZENGE[stand]} className={className}>
      {LINK_STAND_TEXT.label[stand]}
    </Lozenge>
  );
}
