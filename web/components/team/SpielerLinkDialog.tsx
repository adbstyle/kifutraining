"use client";

import { LinkDialog } from "@/components/spieler/LinkDialog";
import { erneuereSpielerLinkAktion, holeSpielerLinkAktion, ladeSpielerTeamsAktion } from "@/lib/actions/spieler";
import { spielerName, type Spieler } from "@/lib/spieler";

/* Der private Link einer Spieler:in am Team-Ort (#436, #583): der gemeinsame
   Baustein `LinkDialog` mit den Team-Actions als Rückrufen. Der Link geht in
   jedem Team der Spieler:in; geholt und erneuert wird er im Team der Seite.
   Die Teams für Hinweis und Erneuern liest der Dialog frisch
   (`spieler_teams`). Der Verein-Ort bindet ihn an die Verein-Actions. */
export function SpielerLinkDialog({
  teamId,
  spieler,
  onClose,
}: {
  teamId: string;
  spieler: Spieler | null;
  onClose: () => void;
}) {
  return (
    <LinkDialog
      spieler={spieler && { id: spieler.id, vorname: spieler.vorname, name: spielerName(spieler), bezogen: spieler.linkBezogen }}
      holen={(id) => holeSpielerLinkAktion(teamId, id)}
      erneuern={(id) => erneuereSpielerLinkAktion(teamId, id)}
      teams={async (id) => {
        const r = await ladeSpielerTeamsAktion(teamId, id);
        return r.ok ? { ok: true, teams: r.teams.map((t) => ({ name: t.name, abholbar: t.abholbar })) } : r;
      }}
      ausgeschaltetHinweis
      onClose={onClose}
    />
  );
}
