"use client";

import { useEffect, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField } from "@/components/ui";
import { BEMERKUNG_MAX, ORT_MAX, terminProblem, type TerminFeld, type TerminFelder } from "@/lib/termin";

/* Einen einzelnen Termin festlegen oder ändern (Team-Kalender #322).
   Die Regeln kommen aus lib/termin.ts — dieselben, die der Fachkern prüft;
   der Dialog zeigt den Fehler am Feld, bevor er etwas sendet. */
export function TerminDialog({
  open,
  titel,
  bestaetigung,
  start,
  /** Die Zeit vor dem Ändern — ohne: neuer Termin, Beginn und Ende Pflicht. */
  bisher,
  pending,
  fehler: serverFehler,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  titel: string;
  bestaetigung: string;
  start?: Partial<TerminFelder>;
  bisher?: { beginn: string | null; ende: string | null };
  pending?: boolean;
  fehler?: string;
  onClose: () => void;
  onSpeichern: (felder: TerminFelder) => void;
}) {
  const [felder, setFelder] = useState<TerminFelder>({ datum: "" });
  const [problem, setProblem] = useState<{ feld: TerminFeld; text: string } | null>(null);

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten des zuletzt bearbeiteten Termins.
  useEffect(() => {
    if (!open) return;
    setFelder({
      datum: start?.datum ?? "",
      beginn: start?.beginn ?? "",
      ende: start?.ende ?? "",
      ort: start?.ort ?? "",
      bemerkung: start?.bemerkung ?? "",
    });
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setze = (k: keyof TerminFelder) => (v: string) => setFelder((f) => ({ ...f, [k]: v }));
  const fehlerAn = (k: TerminFeld) => (problem?.feld === k ? problem.text : undefined);

  function speichern() {
    const p = terminProblem(felder, bisher);
    setProblem(p);
    if (!p) onSpeichern(felder);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>{bestaetigung}</Button>
        </>
      }
    >
      {serverFehler && <p role="alert" className="mb-4 text-error">{serverFehler}</p>}
      <div className="flex flex-col gap-4">
        <DateField label="Datum" value={felder.datum} onChange={(e) => setze("datum")(e.target.value)} error={!!fehlerAn("datum")} supportingText={fehlerAn("datum")} />
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label="Beginn" className="flex-1" value={felder.beginn ?? ""} onChange={(e) => setze("beginn")(e.target.value)} error={!!fehlerAn("beginn")} supportingText={fehlerAn("beginn")} />
          <TimeField label="Ende" className="flex-1" value={felder.ende ?? ""} onChange={(e) => setze("ende")(e.target.value)} error={!!fehlerAn("ende")} supportingText={fehlerAn("ende")} />
        </div>
        <TextField label="Ort (optional)" maxLength={ORT_MAX} value={felder.ort ?? ""} onChange={(e) => setze("ort")(e.target.value)} error={!!fehlerAn("ort")} supportingText={fehlerAn("ort")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={felder.bemerkung ?? ""} onChange={(e) => setze("bemerkung")(e.target.value)} error={!!fehlerAn("bemerkung")} supportingText={fehlerAn("bemerkung")} />
      </div>
    </Dialog>
  );
}
