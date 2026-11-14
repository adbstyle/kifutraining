"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Button, Dialog, KopierFeld, SectionMessage } from "@/components/ui";
import { BezogenLozenge } from "@/components/team/BezogenLozenge";
import { LINK_TEXT } from "@/lib/spieler";

/* Der private Link einer Spieler:in (#436 AK 1–3): holen, kopieren, erneuern.
   Der Link ist ein Geheimnis — was er kann, steht darum immer bei ihm (AK 2).
   Erneuern wirkt sofort: Der bisherige Link gilt nie wieder, die Abmeldungen
   bleiben (PC 2, 3). Ob der aktuelle Link über die Selbstabholung bezogen
   wurde, zeigt die Lozenge; Erneuern setzt ihn zurück (#438 PC 3).

   Rein darstellend, mit Rückrufen: Holen und Erneuern sind Sache der
   Aufrufer — die Spielerliste eines Teams (Team-Actions) und der
   Spielerbestand des Vereins (Verein-Actions, Story #582). So hängt der
   Baustein an keiner Rolle (Rollen nach Ort, check:kern).

   Ergebnisse stehen IM Dialog, nicht in der Snackbar: Sie liegt unter dem
   modalen Dialog und wäre dort unsichtbar (wie beim Abo-Link). */

/** Was Holen liefert: die Adresse; `bezogen` und `hinweis` nur, wo die
 *  Datenebene sie mitgibt (Verein-Ort: der Hinweis für eine Spieler:in ohne
 *  Team, #582 AK 10). */
export type LinkHolen = { ok: true; url: string; bezogen?: boolean; hinweis?: string } | { ok: false; error: string };
export type LinkErneuern = { ok: true; url: string } | { ok: false; error: string };

export function LinkDialog({
  spieler,
  holen,
  erneuern,
  abholungAktiv = false,
  onClose,
}: {
  /** Wer gemeint ist; `null`: zu. `bezogen` gilt, bis Holen den Stand liefert. */
  spieler: { id: string; name: string; bezogen: boolean } | null;
  holen: (spielerId: string) => Promise<LinkHolen>;
  erneuern: (spielerId: string) => Promise<LinkErneuern>;
  /** Die Selbstabholung ist eingeschaltet: Nach dem Erneuern holen die Eltern
   *  den neuen Link wieder über die Abholadresse (#438). */
  abholungAktiv?: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={spieler !== null}
      onClose={onClose}
      title={spieler ? `Privater Link für ${spieler.name}` : ""}
      actions={
        <Button variant="outlined" onClick={onClose}>
          Schliessen
        </Button>
      }
    >
      {/* Eigene Komponente, damit Link und Zustand mit dem Schliessen verschwinden. */}
      {spieler && <LinkInhalt key={spieler.id} spieler={spieler} holen={holen} erneuern={erneuern} abholungAktiv={abholungAktiv} />}
    </Dialog>
  );
}

function LinkInhalt({
  spieler,
  holen,
  erneuern,
  abholungAktiv,
}: {
  spieler: { id: string; name: string; bezogen: boolean };
  holen: (spielerId: string) => Promise<LinkHolen>;
  erneuern: (spielerId: string) => Promise<LinkErneuern>;
  abholungAktiv: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "error" | "success"; text: string } | null>(null);
  const [bezogen, setBezogen] = useState(spieler.bezogen);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let aktiv = true;
    holen(spieler.id).then((r) => {
      if (!aktiv) return;
      if (!r.ok) return setMeldung({ art: "error", text: r.error });
      setUrl(r.url);
      if (r.bezogen !== undefined) setBezogen(r.bezogen);
      setHinweis(r.hinweis ?? null);
    });
    return () => {
      aktiv = false;
    };
    // Einmal je Spieler:in; die Rückrufe des Aufrufers wechseln mit jedem Render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spieler.id]);

  function neu() {
    startTransition(async () => {
      const r = await erneuern(spieler.id);
      if (!r.ok) return setMeldung({ art: "error", text: r.error });
      setUrl(r.url);
      setBezogen(false);
      setMeldung({ art: "success", text: LINK_TEXT.erneuert });
    });
  }

  const oben: ReactNode = hinweis && <SectionMessage appearance="information">{hinweis}</SectionMessage>;

  return (
    <div className="flex flex-col gap-4">
      <BezogenLozenge bezogen={bezogen} className="self-start" />
      <p className="type-body-medium text-on-surface-mittel">
        Mit diesem Link meldet man {spieler.name} für Trainings ab und wieder an, ohne Konto. {LINK_TEXT.warnung}
      </p>
      {oben}
      {meldung && <SectionMessage appearance={meldung.art}>{meldung.text}</SectionMessage>}
      <KopierFeld label="Privater Link" value={url ?? "Wird geladen …"} disabled={!url} />
      <SectionMessage
        appearance="warning"
        actions={
          <Button variant="link" onClick={neu} disabled={pending || !url}>
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
