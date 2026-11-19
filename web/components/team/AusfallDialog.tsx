"use client";

import { useEffect, useState } from "react";
import { Button, Dialog, SectionMessage, TextArea } from "@/components/ui";
import { BEMERKUNG_MAX, TERMIN_TEXT, ausfallProblem } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";
import { benachrichtigungZaehlt } from "@/lib/benachrichtigung";
import { useBenachrichtigen } from "./BenachrichtigenFeld";

/* Einen Termin ausfallen lassen oder den Grund eines ausgefallenen ändern
   (Team-Kalender #327 AK 1–3). Ein zugeordnetes Training bleibt am Termin
   und ruht, bis der Ausfall zurückgenommen wird (PO 2026-10-06). Der Grund
   ist freiwillig; ein leerer Text heisst «ohne Grund». Beim Ausfallen lassen
   eines Termins von heute oder später entscheidet das Mitglied, ob die
   Spielervertretungen benachrichtigt werden (#643 AK 1, 2); beim Ändern des
   Grunds gibt es nichts zu entscheiden (OoS 1). */
export function AusfallDialog({
  termin,
  heute,
  pending,
  fehler,
  onClose,
  onSpeichern,
}: {
  termin: TerminZeile | null;
  /** Heute am Trainingsort («YYYY-MM-DD»): Vergangene Termine benachrichtigen nie. */
  heute: string;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  onClose: () => void;
  /** `benachrichtigen` ist `false`, wo das Feld fehlt. */
  onSpeichern: (grund: string, benachrichtigen: boolean) => void;
}) {
  const [grund, setGrund] = useState("");
  const [eigenerFehler, setEigenerFehler] = useState<string>();
  useEffect(() => {
    setGrund(termin?.ausfallGrund ?? "");
    setEigenerFehler(undefined);
  }, [termin]);

  const istAusfall = termin?.ausgefallen ?? false;
  // Nur beim Ausfallen lassen eines Termins von heute oder später (#643 AK 1).
  const benachrichtigen = useBenachrichtigen("ausfall", {
    offen: termin,
    sichtbar: termin !== null && !istAusfall && benachrichtigungZaehlt(termin.datum, heute),
    pending,
  });

  return (
    <Dialog
      open={termin !== null}
      onClose={onClose}
      title={istAusfall ? "Grund des Ausfalls" : "Termin ausfallen lassen"}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={pending}
            onClick={() => {
              const p = ausfallProblem(grund);
              setEigenerFehler(p?.text);
              if (!p) onSpeichern(grund, benachrichtigen.wert);
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
        info={TERMIN_TEXT.grundSichtbar}
        infoAufTouch
        value={grund}
        onChange={(e) => {
          setGrund(e.target.value);
          setEigenerFehler(undefined);
        }}
        error={!!eigenerFehler}
        supportingText={eigenerFehler}
      />
      {benachrichtigen.feld}
    </Dialog>
  );
}
