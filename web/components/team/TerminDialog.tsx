"use client";

import { useEffect, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField } from "@/components/ui";
import type { TerminFelder } from "@/lib/actions/termine";

/* Termin erfassen, ändern oder erneut ansetzen (Team-Epic Stories 7, 8).
   Ein Dialog für alle drei Wege — sie unterscheiden sich nur in Titel,
   Bestätigungstext und Vorbelegung. */
export function TerminDialog({
  open,
  titel,
  bestaetigung,
  hinweis,
  /** Vorbelegung; beim erneuten Ansetzen bewusst ohne Datum (PO-Entscheid). */
  start,
  pending,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  titel: string;
  bestaetigung: string;
  hinweis?: string;
  start?: Partial<TerminFelder>;
  pending?: boolean;
  onClose: () => void;
  onSpeichern: (felder: TerminFelder) => void;
}) {
  const [datum, setDatum] = useState(start?.datum ?? "");
  const [beginn, setBeginn] = useState(start?.beginn ?? "");
  const [ort, setOrt] = useState(start?.ort ?? "");
  const [bemerkung, setBemerkung] = useState(start?.bemerkung ?? "");
  const [fehler, setFehler] = useState<string | undefined>();

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten des zuletzt bearbeiteten Termins.
  useEffect(() => {
    if (!open) return;
    setDatum(start?.datum ?? "");
    setBeginn(start?.beginn ?? "");
    setOrt(start?.ort ?? "");
    setBemerkung(start?.bemerkung ?? "");
    setFehler(undefined);
    // Die Vorbelegung ist an das geöffnete Objekt gebunden; sie ändert sich
    // nicht, während der Dialog offen steht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function speichern() {
    if (!datum) {
      setFehler("Bitte ein Datum angeben.");
      return;
    }
    onSpeichern({ datum, beginn, ort, bemerkung });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>
            {bestaetigung}
          </Button>
        </>
      }
    >
      {hinweis && <p className="mb-4">{hinweis}</p>}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <DateField
            label="Datum"
            className="flex-1"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            error={!!fehler}
            supportingText={fehler}
          />
          <TimeField
            label="Beginn (optional)"
            className="flex-1"
            value={beginn ?? ""}
            onChange={(e) => setBeginn(e.target.value)}
          />
        </div>
        <TextField
          label="Ort (optional)"
          value={ort ?? ""}
          onChange={(e) => setOrt(e.target.value)}
        />
        <TextArea
          label="Bemerkung (optional)"
          rows={3}
          value={bemerkung ?? ""}
          onChange={(e) => setBemerkung(e.target.value)}
        />
      </div>
    </Dialog>
  );
}
