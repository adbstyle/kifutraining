"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Dialog, IconButton, SectionMessage, TextField, Tooltip } from "@/components/ui";
import { erneuereSpielerLinkAktion, holeSpielerLinkAktion } from "@/lib/actions/spieler";
import { LINK_TEXT, spielerName, type Spieler } from "@/lib/spieler";

/** Wie lange der Knopf den Haken zeigt. */
const KOPIERT_MS = 2500;
const KOPIEREN_FEHLER = "Kopieren ging nicht - markiere den Link und kopiere ihn von Hand.";

/* Der private Link einer Spieler:in (#436 AK 1–3): holen, kopieren, erneuern.
   Der Link ist ein Geheimnis — was er kann, steht darum immer bei ihm (AK 2).
   Erneuern wirkt sofort: Der bisherige Link gilt nie wieder, die Abmeldungen
   bleiben (PC 2, 3).

   Ergebnisse stehen IM Dialog, nicht in der Snackbar: Sie liegt unter dem
   modalen Dialog und wäre dort unsichtbar (wie beim Abo-Link). */
export function SpielerLinkDialog({ spieler, onClose }: { spieler: Spieler | null; onClose: () => void }) {
  return (
    <Dialog
      open={spieler !== null}
      onClose={onClose}
      title={spieler ? `Privater Link für ${spielerName(spieler)}` : ""}
      actions={
        <Button variant="text" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      {/* Eigene Komponente, damit Link und Zustand mit dem Schliessen verschwinden. */}
      {spieler && <LinkInhalt key={spieler.id} spieler={spieler} />}
    </Dialog>
  );
}

function LinkInhalt({ spieler }: { spieler: Spieler }) {
  const feld = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "error" | "success"; text: string } | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let aktiv = true;
    holeSpielerLinkAktion(spieler.id).then((r) => {
      if (!aktiv) return;
      if (r.ok) setUrl(r.url);
      else setMeldung({ art: "error", text: r.error });
    });
    return () => {
      aktiv = false;
    };
  }, [spieler.id]);

  useEffect(() => {
    if (!kopiert) return;
    const t = setTimeout(() => setKopiert(false), KOPIERT_MS);
    return () => clearTimeout(t);
  }, [kopiert]);

  async function kopieren() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMeldung(null);
      setKopiert(true);
    } catch {
      // Ohne Zwischenablage bleibt der Handweg: das Feld markieren.
      setKopiert(false);
      setMeldung({ art: "error", text: KOPIEREN_FEHLER });
      feld.current?.focus();
      feld.current?.select();
    }
  }

  function erneuern() {
    startTransition(async () => {
      const r = await erneuereSpielerLinkAktion(spieler.id);
      if (!r.ok) return setMeldung({ art: "error", text: r.error });
      setUrl(r.url);
      setKopiert(false);
      setMeldung({ art: "success", text: "Link erneuert. Der bisherige gilt nicht mehr." });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="type-body-medium text-on-surface-mittel">
        Mit diesem Link meldet man {spielerName(spieler)} für Trainings ab und wieder an, ohne Konto. {LINK_TEXT.warnung}
      </p>
      {meldung && <SectionMessage appearance={meldung.art}>{meldung.text}</SectionMessage>}
      <div className="flex items-center gap-2">
        <TextField
          ref={feld}
          className="min-w-0 flex-1"
          label="Privater Link"
          value={url ?? "Wird geladen …"}
          readOnly
          onFocus={(e) => e.currentTarget.select()}
        />
        <Tooltip label={kopiert ? "Kopiert" : "Kopieren"} ende>
          <IconButton icon={kopiert ? Check : Copy} label="Link kopieren" onClick={kopieren} disabled={!url} />
        </Tooltip>
        {/* Die Vorlesehilfe erfährt das Ergebnis über die Live-Region. */}
        <span className="sr-only" role="status">
          {kopiert ? "Link kopiert." : ""}
        </span>
      </div>
      <SectionMessage
        appearance="warning"
        actions={
          <Button variant="text" onClick={erneuern} disabled={pending || !url}>
            Link erneuern
          </Button>
        }
      >
        Weitergegeben oder missbraucht? {LINK_TEXT.erneuern}
      </SectionMessage>
    </div>
  );
}
