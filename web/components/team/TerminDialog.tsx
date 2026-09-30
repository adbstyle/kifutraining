"use client";

import { useEffect, useId, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField, WochentagWahl } from "@/components/ui";
import { BEMERKUNG_MAX, ORT_MAX, terminProblem, type TerminFeld, type TerminFelder } from "@/lib/termin";
import {
  SERIE_MELDUNG,
  SERIE_TEXT,
  obergrenzeVorab,
  regelAenderung,
  regelProblemVorab,
  wochentageText,
  type SerieFeld,
  type SerienRegel,
} from "@/lib/serie";
import { datumKurz } from "@/lib/zeit";
import type { Abweichung, TerminSerie } from "@/lib/queries/termine";
import type { FolgeAngabe } from "@/lib/kern/serien";

const ANGABE: Record<FolgeAngabe, string> = { zeit: "Die Zeit", ort: "Der Ort", bemerkung: "Die Bemerkung" };
const FOLGEN_LABEL: Record<FolgeAngabe, string> = {
  zeit: "Zeit wieder der Serie folgen lassen",
  ort: "Ort wieder der Serie folgen lassen",
  bemerkung: "Bemerkung wieder der Serie folgen lassen",
};

/* Einen einzelnen Termin festlegen oder ändern (Team-Kalender #322).
   Die Regeln kommen aus lib/termin.ts — dieselben, die der Fachkern prüft;
   der Dialog zeigt den Fehler am Feld, bevor er etwas sendet.

   Ein Serientermin (#326) zeigt zusätzlich seine Serie: welche Angaben von
   ihr abweichen, mit dem Weg zurück (AK 6, 14), und Wochentage und Zeitraum
   zum Ändern (AK 3, 4). Für welchen Teil der Serie eine Änderung gilt, fragt
   danach der ReichweiteDialog. */
export function TerminDialog({
  open,
  titel,
  bestaetigung,
  start,
  /** Die Zeit vor dem Ändern — ohne: neuer Termin, Beginn und Ende Pflicht. */
  bisher,
  pending,
  fehler: serverFehler,
  serie,
  serienTag,
  abweichungen,
  onFolgen,
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
  /** Die Serie des geöffneten Termins; ohne: ein einzelner oder neuer Termin. */
  serie?: TerminSerie | null;
  serienTag?: string | null;
  abweichungen?: readonly Abweichung[];
  onFolgen?: (angabe: FolgeAngabe) => void;
  onClose: () => void;
  /** `regel` nur bei einem Serientermin: Wochentage und Zeitraum, wie sie im
   *  Dialog stehen (geändert oder nicht). */
  onSpeichern: (felder: TerminFelder, regel?: SerienRegel) => void;
}) {
  const [felder, setFelder] = useState<TerminFelder>({ datum: "" });
  const [problem, setProblem] = useState<{ feld: TerminFeld; text: string } | null>(null);
  const [regel, setRegel] = useState<SerienRegel>({ wochentage: [], von: "", bis: "" });
  const [regelProblem, setRegelProblem] = useState<{ feld: SerieFeld | "beides"; text: string } | null>(null);

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
    if (serie) setRegel({ wochentage: [...serie.wochentage], von: serie.beginnDatum, bis: serie.endDatum });
    setRegelProblem(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setze = (k: keyof TerminFelder) => (v: string) => setFelder((f) => ({ ...f, [k]: v }));
  const fehlerAn = (k: TerminFeld) => (problem?.feld === k ? problem.text : undefined);

  const regelFehlerAn = (k: SerieFeld) => (regelProblem?.feld === k ? regelProblem.text : undefined);
  const serieTitelId = useId();
  const terminDatum = start?.datum ?? "";

  function regelPruefen(): boolean {
    if (!serie) return true;
    const aenderung = regelAenderung(serie, regel);
    if (!aenderung) {
      setRegelProblem(null);
      return true;
    }
    if (felder.datum !== start?.datum) {
      setRegelProblem({ feld: "beides", text: SERIE_TEXT.datumUndRegel });
      return false;
    }
    // Die Reichweite ist noch offen: weitere Obergrenze, die engere prüft die Vorschau.
    const r = regelProblemVorab(serie, regel, terminDatum);
    setRegelProblem(r);
    return !r;
  }

  function speichern() {
    const p = terminProblem(felder, bisher);
    setProblem(p);
    const regelOk = regelPruefen();
    if (!p && regelOk) onSpeichern(felder, serie ? regel : undefined);
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
      {serie && (
        <section aria-labelledby={serieTitelId} className="mt-6 border-t border-linie pt-4">
          <h3 id={serieTitelId} className="type-title-small text-on-surface">Terminserie</h3>
          <p className="type-body-small">
            {wochentageText(serie.wochentage)} · {datumKurz(serie.beginnDatum)} bis {datumKurz(serie.endDatum)} · {serie.beginn}–{serie.ende} Uhr
            {serie.ort ? <> · {serie.ort}</> : null}
          </p>
          {/* AK 14: welche Angaben abweichen — mit dem Weg zurück (AK 6). Das
              Datum folgt nie wieder der Serie (PO 3), es zählt das aktuelle. */}
          {abweichungen && abweichungen.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 type-body-small">
              {abweichungen.includes("datum") && serienTag && (
                <li>Verschoben — ursprünglich am {datumKurz(serienTag)}.</li>
              )}
              {(["zeit", "ort", "bemerkung"] as const).filter((a) => abweichungen.includes(a)).map((a) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-x-2">
                  <span>{ANGABE[a]} weicht von der Serie ab.</span>
                  <Button variant="text" size="sm" aria-label={FOLGEN_LABEL[a]} disabled={pending} onClick={() => onFolgen?.(a)}>Der Serie folgen</Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-col gap-4">
            <WochentagWahl wert={regel.wochentage} onChange={(w) => setRegel((r) => ({ ...r, wochentage: w }))} error={regelFehlerAn("wochentage")} />
            <div className="flex flex-col gap-4 sm:flex-row">
              <DateField label="Beginn der Serie" className="flex-1" value={regel.von} onChange={(e) => setRegel((r) => ({ ...r, von: e.target.value }))} error={!!regelFehlerAn("von")} supportingText={regelFehlerAn("von")} />
              <DateField
                label="Ende der Serie"
                className="flex-1"
                value={regel.bis}
                min={regel.von || undefined}
                max={regel.von ? obergrenzeVorab(serie, regel, terminDatum) : undefined}
                onChange={(e) => setRegel((r) => ({ ...r, bis: e.target.value }))}
                error={!!regelFehlerAn("bis")}
                supportingText={regelFehlerAn("bis")}
              />
            </div>
            {regelProblem?.feld === "beides" && <p role="alert" className="type-body-small text-error">{regelProblem.text}</p>}
            <p className="type-body-small">{SERIE_MELDUNG.REGEL_NUR_SERIE}</p>
          </div>
        </section>
      )}
    </Dialog>
  );
}
