"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, SectionMessage } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ladeVereinSpielerTeamsAktion, loescheSpielerImVereinAktion } from "@/lib/actions/verein";
import type { VereinSpieler } from "@/lib/kern/verein";
import { spielerName } from "@/lib/spieler";
import { spielerLoeschenSaetze, spielerLoeschenTitel, zielWeg } from "@/lib/verein";

/* Eine Spieler:in aus dem Verein löschen (Story #582 AK 12, 13, 15): Die
   Bestätigung liest die Teams beim Öffnen frisch aus der Datenebene — sie
   nennt den echten Stand, auch wenn die Liste dahinter überholt ist — und
   sagt, dass Link und Meldungen endgültig entfallen und die Spieler:in an
   vergangenen Terminen ohne Namen erscheint. Gelöscht wird erst mit dem
   Knopf; vorher ändert nichts etwas. Löschen kann nur die Verwaltung, und
   nur hier: Am Team-Ort gibt es es nicht (Rollen nach Ort). */
export function VereinSpielerLoeschen({ spieler, onClose }: { spieler: VereinSpieler | null; onClose: () => void }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // Die Namen der Teams, frisch gelesen; `null`, solange sie laden.
  const [teams, setTeams] = useState<string[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!spieler) return;
    let aktiv = true;
    setTeams(null);
    setFehler(null);
    ladeVereinSpielerTeamsAktion(spieler.id).then((r) => {
      if (!aktiv) return;
      if (r.ok) return setTeams(r.teams.map((t) => t.name));
      setFehler(r.error);
      if (zielWeg(r.feld)) router.refresh();
    });
    return () => {
      aktiv = false;
    };
  }, [spieler, router]);

  function loeschen() {
    if (!spieler || pending) return;
    const name = spielerName(spieler);
    startTransition(async () => {
      const r = await loescheSpielerImVereinAktion(spieler.id);
      if (!r.ok) {
        setFehler(r.error);
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      onClose();
      router.refresh();
      melde(`${name} ist gelöscht.`);
    });
  }

  const saetze = spieler && teams ? spielerLoeschenSaetze(spieler.vorname, teams) : null;

  return (
    <Dialog
      open={spieler !== null}
      onClose={() => !pending && onClose()}
      title={spieler ? spielerLoeschenTitel(spielerName(spieler)) : undefined}
      actions={
        <>
          <Button variant="outlined" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button variant="danger" onClick={loeschen} disabled={pending || saetze === null}>
            Löschen
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
        {saetze && (
          <>
            <p>{saetze.zuordnung}</p>
            <p>{saetze.link}</p>
            <p>{saetze.vergangen}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
