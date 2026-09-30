"use client";

import { useEffect, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField, WochentagWahl } from "@/components/ui";
import { maxEnddatum, serieProblem, type SerieFeld, type Wochentag } from "@/lib/serie";
import { BEMERKUNG_MAX, ORT_MAX } from "@/lib/termin";

export type SerieFelder = {
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort: string;
  bemerkung: string;
};

const LEER: SerieFelder = { wochentage: [], von: "", bis: "", beginn: "", ende: "", ort: "", bemerkung: "" };

/* Eine Terminserie festlegen (#324 AK 1–7). Die Regeln sind dieselben wie
   im Fachkern (lib/serie.ts); das Enddatum lässt sich nicht über den
   gleichen Kalendertag im Folgejahr hinaus wählen. */
export function SerieDialog({
  open,
  start,
  pending,
  fehler: serverFehler,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  start?: Partial<SerieFelder>;
  pending?: boolean;
  fehler?: string;
  onClose: () => void;
  onSpeichern: (f: SerieFelder) => void;
}) {
  const [f, setF] = useState<SerieFelder>(LEER);
  const [problem, setProblem] = useState<{ feld: SerieFeld; text: string } | null>(null);

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten der letzten Serie.
  useEffect(() => {
    if (!open) return;
    setF({ ...LEER, ...start });
    setProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fehlerAn = (k: SerieFeld) => (problem?.feld === k ? problem.text : undefined);
  const setze = <K extends keyof SerieFelder>(k: K, v: SerieFelder[K]) => setF((x) => ({ ...x, [k]: v }));

  function speichern() {
    const p = serieProblem(f);
    setProblem(p);
    if (!p) onSpeichern(f);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Terminserie festlegen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Festlegen</Button>
        </>
      }
    >
      {serverFehler && <p role="alert" className="mb-4 text-error">{serverFehler}</p>}
      <div className="flex flex-col gap-4">
        <WochentagWahl wert={f.wochentage} onChange={(w) => setze("wochentage", w)} error={fehlerAn("wochentage")} />
        <div className="flex flex-col gap-4 sm:flex-row">
          <DateField label="Beginndatum" className="flex-1" value={f.von} onChange={(e) => setze("von", e.target.value)} error={!!fehlerAn("von")} supportingText={fehlerAn("von")} />
          <DateField
            label="Enddatum"
            className="flex-1"
            value={f.bis}
            min={f.von || undefined}
            max={f.von ? maxEnddatum(f.von) : undefined}
            onChange={(e) => setze("bis", e.target.value)}
            error={!!fehlerAn("bis")}
            supportingText={fehlerAn("bis")}
          />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label="Beginn" className="flex-1" value={f.beginn} onChange={(e) => setze("beginn", e.target.value)} error={!!fehlerAn("beginn")} supportingText={fehlerAn("beginn")} />
          <TimeField label="Ende" className="flex-1" value={f.ende} onChange={(e) => setze("ende", e.target.value)} error={!!fehlerAn("ende")} supportingText={fehlerAn("ende")} />
        </div>
        <TextField label="Ort (optional)" maxLength={ORT_MAX} value={f.ort} onChange={(e) => setze("ort", e.target.value)} error={!!fehlerAn("ort")} supportingText={fehlerAn("ort")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={f.bemerkung} onChange={(e) => setze("bemerkung", e.target.value)} error={!!fehlerAn("bemerkung")} supportingText={fehlerAn("bemerkung")} />
      </div>
    </Dialog>
  );
}
