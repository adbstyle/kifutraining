"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Info, ShieldAlert } from "lucide-react";
import { SectionMessage, Button, Dialog, TextField } from "@/components/ui";
import { AboAnleitung } from "./AboAnleitung";

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
  url,
  teamName,
  onClose,
}: {
  /** `null`: geschlossen. */
  url: string | null;
  teamName: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={url !== null}
      onClose={onClose}
      title={`Kalender abonnieren · ${teamName}`}
      actions={
        <Button variant="outlined" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      {/* Eigene Komponente, damit der Kopier-Zustand mit dem Schliessen
          verschwindet. */}
      {url && <AboInhalt url={url} />}
    </Dialog>
  );
}

function AboInhalt({ url }: { url: string }) {
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
      await navigator.clipboard.writeText(url);
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
      <SectionMessage icon={ShieldAlert}>
        Dieser Link ist persönlich. Gib ihn nicht weiter: Wer ihn hat, sieht Zeit und Ort der
        Trainings und Spiele dieses Teams, zu denen du eingeladen bist.
      </SectionMessage>
      {/* #522 AK 7: die Namen gehen an den Anbieter des Kalenderprogramms. */}
      <SectionMessage appearance="information" icon={Info} className="mt-3">
        Die Einträge nennen die Namen der eingeladenen Trainer:innen. Sie liegen damit auch beim Anbieter deines
        Kalenderprogramms.
      </SectionMessage>
      {fehler && (
        <SectionMessage appearance="error" className="mt-3">
          {KOPIEREN_FEHLER}
        </SectionMessage>
      )}
      <div className="mt-5 flex items-center gap-2">
        <TextField
          ref={feld}
          className="min-w-0 flex-1"
          label="Abo-Link"
          value={url}
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
      <div className="mt-4">
        <AboAnleitung />
      </div>
      <p className="type-body-small mt-4">
        Abgesagte Termine bleiben im Kalender und tragen «Abgesagt» im Titel. Wirst du ausgeladen,
        verschwindet der Termin beim nächsten Abgleich.
      </p>
      <p className="type-body-small mt-2">
        Unter «Konto» findest du deine Abos wieder und kannst sie widerrufen. Wie oft dein
        Kalenderprogramm nachsieht, bestimmt es selbst.
      </p>
    </>
  );
}
