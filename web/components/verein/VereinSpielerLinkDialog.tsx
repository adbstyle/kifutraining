"use client";

import { useRouter } from "next/navigation";
import { LinkDialog, type LinkErneuern, type LinkHolen, type LinkTeams } from "@/components/spieler/LinkDialog";
import { erneuereVereinSpielerLinkAktion, holeVereinSpielerLinkAktion, ladeVereinSpielerTeamsAktion } from "@/lib/actions/verein";
import type { VereinSpieler } from "@/lib/kern/verein";
import { spielerName } from "@/lib/spieler";
import { linkOhneTeamText, zielWeg } from "@/lib/verein";

/* Der private Link einer Spieler:in am Verein-Ort (Story #582 AK 9–11): der
   gemeinsame Baustein `LinkDialog` mit den Verein-Actions als Rückrufen.
   Ohne Team steht über dem Link der Hinweis, dass die Spielervertretung erst
   mit einem Team Termine sieht. Die Teams für Hinweis und Erneuern
   (#583 AK 15, 16) liest der Dialog frisch (`verein_spieler_teams`). Ist die
   Spieler:in inzwischen gelöscht, lädt die Liste neu, und der Dialog zeigt
   den alten Link nicht mehr. */
export function VereinSpielerLinkDialog({ spieler, onClose }: { spieler: VereinSpieler | null; onClose: () => void }) {
  const router = useRouter();

  async function holen(id: string): Promise<LinkHolen> {
    const r = await holeVereinSpielerLinkAktion(id);
    if (!r.ok) {
      const weg = zielWeg(r.feld);
      if (weg) router.refresh();
      return { ok: false, error: r.error, weg };
    }
    return {
      ok: true,
      url: r.url,
      bezogen: r.bezogen,
      hinweis: r.ohneTeam && spieler ? linkOhneTeamText(spieler.vorname) : undefined,
    };
  }

  async function erneuern(id: string): Promise<LinkErneuern> {
    const r = await erneuereVereinSpielerLinkAktion(id);
    if (r.ok) return { ok: true, url: r.url };
    const weg = zielWeg(r.feld);
    if (weg) router.refresh();
    return { ok: false, error: r.error, weg };
  }

  async function teams(id: string): Promise<LinkTeams> {
    const r = await ladeVereinSpielerTeamsAktion(id);
    if (r.ok) return { ok: true, teams: r.teams.map((t) => ({ name: t.name, abholbar: t.abholbar })) };
    const weg = zielWeg(r.feld);
    if (weg) router.refresh();
    return { ok: false, error: r.error, weg };
  }

  return (
    <LinkDialog
      spieler={spieler && { id: spieler.id, vorname: spieler.vorname, name: spielerName(spieler), bezogen: spieler.linkBezogen }}
      holen={holen}
      erneuern={erneuern}
      teams={teams}
      onClose={onClose}
    />
  );
}
