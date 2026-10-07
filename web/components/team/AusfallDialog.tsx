"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, SectionMessage, TextArea } from "@/components/ui";
import { BEMERKUNG_MAX, ausfallProblem } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einen Termin ausfallen lassen oder den Grund eines ausgefallenen ändern
   (Team-Kalender #327 AK 1–3). Ein zugeordnetes Training bleibt am Termin
   und ruht, bis der Ausfall zurückgenommen wird (PO 2026-10-06). Der Grund
   ist freiwillig; ein leerer Text heisst «ohne Grund». */
export function AusfallDialog({
  termin,
  pending,
  fehler,
  onClose,
  onSpeichern,
}: {
  termin: TerminZeile | null;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  onClose: () => void;
  onSpeichern: (grund: string) => void;
}) {
  const [grund, setGrund] = useState("");
  const [eigenerFehler, setEigenerFehler] = useState<string>();
  useEffect(() => {
    setGrund(termin?.ausfallGrund ?? "");
    setEigenerFehler(undefined);
  }, [termin]);

  const istAusfall = termin?.ausgefallen ?? false;

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={istAusfall ? "Grund des Ausfalls" : "Termin ausfallen lassen"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={pending}
            onClick={() => {
              const p = ausfallProblem(grund);
              setEigenerFehler(p?.text);
              if (!p) onSpeichern(grund);
            }}
          >
            {istAusfall ? "Speichern" : "Ausfallen lassen"}
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      <p className="mb-3">{termin ? datumKurz(termin.datum) : ""}</p>
      <TextArea
        label="Grund (optional)"
        rows={3}
        maxLength={BEMERKUNG_MAX}
        value={grund}
        onChange={(e) => {
          setGrund(e.target.value);
          setEigenerFehler(undefined);
        }}
        error={!!eigenerFehler}
        supportingText={eigenerFehler}
      />
    </Dialog>
  );
}
