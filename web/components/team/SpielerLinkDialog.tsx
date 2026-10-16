"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Dialog, KopierFeld, SectionMessage } from "@/components/ui";
import { erneuereSpielerLinkAktion, holeSpielerLinkAktion } from "@/lib/actions/spieler";
import { LINK_TEXT, spielerName, type Spieler } from "@/lib/spieler";
import { BezogenLozenge } from "./BezogenLozenge";

/* Der private Link einer Spieler:in (#436 AK 1–3): holen, kopieren, erneuern.
   Der Link ist ein Geheimnis — was er kann, steht darum immer bei ihm (AK 2).
   Erneuern wirkt sofort: Der bisherige Link gilt nie wieder, die Abmeldungen
   bleiben (PC 2, 3). Ob der aktuelle Link über die Selbstabholung bezogen
   wurde, zeigt die Lozenge; Erneuern setzt ihn zurück (#438 PC 3).

   Ergebnisse stehen IM Dialog, nicht in der Snackbar: Sie liegt unter dem
   modalen Dialog und wäre dort unsichtbar (wie beim Abo-Link). */
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
      {spieler && <LinkInhalt key={spieler.id} spieler={spieler} abholungAktiv={abholungAktiv} />}
    </Dialog>
  );
}

function LinkInhalt({ spieler, abholungAktiv }: { spieler: Spieler; abholungAktiv: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "error" | "success"; text: string } | null>(null);
  const [bezogen, setBezogen] = useState(spieler.linkBezogen);
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

  function erneuern() {
    startTransition(async () => {
      const r = await erneuereSpielerLinkAktion(spieler.id);
      if (!r.ok) return setMeldung({ art: "error", text: r.error });
      setUrl(r.url);
      setBezogen(false);
      setMeldung({ art: "success", text: LINK_TEXT.erneuert });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <BezogenLozenge bezogen={bezogen} className="self-start" />
      <p className="type-body-medium text-on-surface-mittel">
        Mit diesem Link meldet man {spielerName(spieler)} für Trainings ab und wieder an, ohne Konto. {LINK_TEXT.warnung}
      </p>
      {meldung && <SectionMessage appearance={meldung.art}>{meldung.text}</SectionMessage>}
      <KopierFeld label="Privater Link" value={url ?? "Wird geladen …"} disabled={!url} />
      <SectionMessage
        appearance="warning"
        actions={
          <Button variant="text" onClick={erneuern} disabled={pending || !url}>
            Link erneuern
          </Button>
        }
      >
        Weitergegeben oder missbraucht? {LINK_TEXT.erneuern}
        {abholungAktiv && ` ${LINK_TEXT.erneuertAbholen}`}
      </SectionMessage>
    </div>
  );
}
