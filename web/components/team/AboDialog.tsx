"use client";

import { Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { Banner, Button, ButtonLink, Dialog, TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";

/* Der persönliche Abo-Link (#330). Er ist ein Geheimnis: Wer ihn hat, sieht
   Zeit und Ort der Termine (AK 3) — die Warnung steht darum immer bei ihm,
   im Team wie unter «Konto». Anleitung für die vier genannten
   Kalenderprogramme (AK 2). */
export function AboDialog({
  links,
  teamName,
  onClose,
}: {
  /** `null`: geschlossen. */
  links: { url: string; webcal: string } | null;
  teamName: string;
  onClose: () => void;
}) {
  const melde = useSnackbar();

  async function kopieren() {
    if (!links) return;
    try {
      await navigator.clipboard.writeText(links.url);
      melde("Abo-Link kopiert.");
    } catch {
      melde("Kopieren ging nicht — markiere den Link und kopiere ihn von Hand.");
    }
  }

  return (
    <Dialog
      open={links !== null}
      onClose={onClose}
      title={`Kalender abonnieren · ${teamName}`}
      actions={
        <Button variant="text" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      {links && (
        <>
          <Banner icon={ShieldAlert}>
            Dieser Link ist persönlich. Gib ihn nicht weiter: Wer ihn hat, sieht Zeit und Ort der
            Trainings dieses Teams.
          </Banner>
          <div className="mt-5 flex items-center gap-2">
            <TextField
              className="min-w-0 flex-1"
              label="Abo-Link"
              value={links.url}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="tonal" onClick={kopieren}>
              <Copy size={16} aria-hidden /> Kopieren
            </Button>
          </div>
          <ul className="type-body-small mt-4 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-on-surface">Apple Kalender:</strong>{" "}
              <ButtonLink variant="text" size="sm" href={links.webcal}>
                <ExternalLink size={14} aria-hidden /> Direkt öffnen
              </ButtonLink>{" "}
              oder Ablage → Neues Kalenderabonnement → Link einfügen.
            </li>
            <li>
              <strong className="text-on-surface">Google Kalender:</strong> Weitere Kalender → Per URL →
              Link einfügen.
            </li>
            <li>
              <strong className="text-on-surface">Outlook:</strong> Kalender hinzufügen → Aus dem
              Internet abonnieren → Link einfügen.
            </li>
            <li>
              <strong className="text-on-surface">Proton Calendar:</strong> Kalender hinzufügen → Über
              Link hinzufügen → Link einfügen.
            </li>
          </ul>
          <p className="type-body-small mt-4">
            Unter «Konto» findest du deine Abos wieder und kannst sie widerrufen. Wie oft dein
            Kalenderprogramm nachsieht, bestimmt es selbst.
          </p>
        </>
      )}
    </Dialog>
  );
}
