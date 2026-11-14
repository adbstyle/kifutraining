"use client";

import { LinkDialog } from "@/components/spieler/LinkDialog";
import { erneuereSpielerLinkAktion, holeSpielerLinkAktion } from "@/lib/actions/spieler";
import { spielerName, type Spieler } from "@/lib/spieler";

/* Der private Link einer Spieler:in am Team-Ort (#436): der gemeinsame
   Baustein `LinkDialog` mit den Team-Actions als Rückrufen. Der Verein-Ort
   bindet ihn an die Verein-Actions (Story #582). */
export function SpielerLinkDialog({
  spieler,
  abholungAktiv,
  onClose,
}: {
  spieler: Spieler | null;
  /** Die Selbstabholung ist eingeschaltet: Nach dem Erneuern holen die Eltern
   *  den neuen Link wieder über die Abholadresse (#438). */
  abholungAktiv: boolean;
  onClose: () => void;
}) {
  return (
    <LinkDialog
      spieler={spieler && { id: spieler.id, name: spielerName(spieler), bezogen: spieler.linkBezogen }}
      holen={holeSpielerLinkAktion}
      erneuern={erneuereSpielerLinkAktion}
      abholungAktiv={abholungAktiv}
      onClose={onClose}
    />
  );
}
