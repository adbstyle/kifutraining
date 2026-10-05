"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, ShieldAlert } from "lucide-react";
import { Banner, Button, ButtonLink, Dialog, TextField } from "@/components/ui";

/** Wie lange der Knopf «Kopiert» zeigt. */
const KOPIERT_MS = 2500;
const KOPIEREN_FEHLER = "Kopieren ging nicht - markiere den Link und kopiere ihn von Hand.";

/* Der persönliche Abo-Link (#330). Er ist ein Geheimnis: Wer ihn hat, sieht
   Zeit und Ort der Termine (AK 3) — die Warnung steht darum immer bei ihm,
   im Team wie unter «Konto». Anleitung für die vier genannten
   Kalenderprogramme (AK 2).

   Das Ergebnis des Kopierens steht IM Dialog, nicht in der Snackbar: Sie liegt
   unter dem modalen Dialog und wäre dort unsichtbar. */
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
      {/* Eigene Komponente, damit der Kopier-Zustand mit dem Schliessen
          verschwindet. */}
      {links && <AboInhalt links={links} />}
    </Dialog>
  );
}

function AboInhalt({ links }: { links: { url: string; webcal: string } }) {
  const feld = useRef<HTMLInputElement>(null);
  const [kopiert, setKopiert] = useState(false);
  const [fehler, setFehler] = useState(false);

  // «Kopiert» geht nach einer Weile von selbst; das Aufräumen verhindert ein
  // Setzen nach dem Schliessen.
  useEffect(() => {
    if (!kopiert) return;
    const t = setTimeout(() => setKopiert(false), KOPIERT_MS);
    return () => clearTimeout(t);
  }, [kopiert]);

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(links.url);
      setFehler(false);
      setKopiert(true);
    } catch {
      // Ohne Zwischenablage (unsicherer Kontext, verweigert) bleibt der
      // Handweg: das Feld markieren, damit Strg/Cmd+C genügt.
      setKopiert(false);
      setFehler(true);
      feld.current?.focus();
      feld.current?.select();
    }
  }

  return (
    <>
      <Banner icon={ShieldAlert}>
        Dieser Link ist persönlich. Gib ihn nicht weiter: Wer ihn hat, sieht Zeit und Ort der
        Trainings dieses Teams.
      </Banner>
      {fehler && (
        <Banner tone="fehler" className="mt-3">
          {KOPIEREN_FEHLER}
        </Banner>
      )}
      <div className="mt-5 flex items-center gap-2">
        <TextField
          ref={feld}
          className="min-w-0 flex-1"
          label="Abo-Link"
          value={links.url}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button variant="tonal" onClick={kopieren}>
          {kopiert ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
          {kopiert ? "Kopiert" : "Kopieren"}
        </Button>
        {/* Die Vorlesehilfe erfährt das Ergebnis über die Live-Region; der
            Knopftext allein wechselt, ohne dass der Fokus ihn neu liest. */}
        <span className="sr-only" role="status">
          {kopiert ? "Abo-Link kopiert." : ""}
        </span>
      </div>
      <ul className="type-body-small mt-4 list-disc space-y-1 pl-5">
        <li>
          <strong className="text-on-surface">Apple Kalender:</strong>{" "}
          <ButtonLink variant="text" href={links.webcal}>
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
  );
}
