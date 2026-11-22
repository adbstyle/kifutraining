"use client";

import { useRouter } from "next/navigation";
import { LinkDialog } from "@/components/spieler/LinkDialog";
import { erneuereSpielerLinkAktion, holeSpielerLinkAktion, ladeSpielerTeamsAktion, setzeLinkZugestelltAktion } from "@/lib/actions/spieler";
import { spielerName, type Spieler } from "@/lib/spieler";

/* Der private Link einer Spieler:in am Team-Ort (#436, #583): der gemeinsame
   Baustein `LinkDialog` mit den Team-Actions als Rückrufen. Der Link geht in
   jedem Team der Spieler:in; geholt und erneuert wird er im Team der Seite.
   Die Teams für Hinweis und Erneuern liest der Dialog frisch
   (`spieler_teams`). Zugestellt markieren (#657 AK 1) lädt danach die
   Liste neu, damit der Punkt am Knopf stimmt. Der Verein-Ort bindet ihn an
   die Verein-Actions. */
export function SpielerLinkDialog({
  teamId,
  spieler,
  onClose,
}: {
  teamId: string;
  spieler: Spieler | null;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <LinkDialog
      spieler={spieler && { id: spieler.id, vorname: spieler.vorname, name: spielerName(spieler), stand: spieler.linkStand }}
      holen={(id) => holeSpielerLinkAktion(teamId, id)}
      erneuern={(id) => erneuereSpielerLinkAktion(teamId, id)}
      zustellen={async (id, an) => {
        const r = await setzeLinkZugestelltAktion(teamId, id, an);
        if (r.ok) router.refresh();
        return r;
      }}
      teams={async (id) => {
        const r = await ladeSpielerTeamsAktion(teamId, id);
        return r.ok ? { ok: true, teams: r.teams.map((t) => ({ name: t.name, abholbar: t.abholbar })) } : r;
      }}
      ausgeschaltetHinweis
      onClose={onClose}
    />
  );
}
