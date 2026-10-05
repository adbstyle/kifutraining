"use client";

import { useEffect, useId, useState } from "react";
import { Button, DateField, Dialog, TextArea, TextField, TimeField, WochentagWahl } from "@/components/ui";
import { BEMERKUNG_MAX, ORT_MAX, spielerzahlProblem, terminProblem, zahlOderNull, type TerminFeld, type TerminFelder } from "@/lib/termin";
import { felderProblem, gleicheFelder, type FelderProblem } from "@/lib/termin-felder";
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
import type { Abweichung, TerminSerie, Verantwortlicher } from "@/lib/queries/termine";
import type { TeamMitglied } from "@/lib/queries/teams";
import type { FolgeAngabe } from "@/lib/kern/serien";
import {
  KEINE_VERANTWORTLICHEN,
  VerantwortlicheWahl,
  nurNamenloseGeaendert,
  verantwortlicheGeaendert,
  verantwortlicheStart,
  type VerantwortlicheWert,
} from "./VerantwortlicheWahl";
import { FelderField, felderAusZeilen, zeilenAusFeldern, type FeldZeile } from "./FelderField";
import { SpielerzahlField } from "./SpielerzahlField";

const ANGABE: Record<FolgeAngabe, string> = {
  zeit: "Die Zeit",
  ort: "Der Ort",
  bemerkung: "Die Bemerkung",
  verantwortliche: "Die Verantwortlichen",
};
/** Die Angaben, die wieder der Serie folgen können, in der Reihenfolge des Dialogs. */
const FOLGEN_KANN: readonly FolgeAngabe[] = ["zeit", "ort", "bemerkung", "verantwortliche"];
const FOLGEN_LABEL: Record<FolgeAngabe, string> = {
  zeit: "Zeit wieder der Serie folgen lassen",
  ort: "Ort wieder der Serie folgen lassen",
  bemerkung: "Bemerkung wieder der Serie folgen lassen",
  verantwortliche: "Verantwortliche wieder der Serie folgen lassen",
};

/* Einen Termin ändern (Team-Kalender #322); erstellt wird im
   NeuerTerminDialog.
   Die Regeln kommen aus lib/termin.ts — dieselben, die der Fachkern prüft;
   der Dialog zeigt den Fehler am Feld, bevor er etwas sendet.

   Ein Serientermin (#326) zeigt zusätzlich seine Serie: welche Angaben von
   ihr abweichen, mit dem Weg zurück (AK 6, 14), und Wochentage und Zeitraum
   zum Ändern (AK 3, 4). Für welchen Teil der Serie eine Änderung gilt, fragt
   danach der ReichweiteDialog.

   Die Verantwortlichen (#325) stehen nach der Bemerkung; weichen sie an
   einem Serientermin ab, sagt es der Serien-Abschnitt (AK 19) und bietet den
   Weg zurück (AK 6).

   Danach die erwartete Spielerzahl (#390; leer = unbekannt) und die Felder
   des Platzes (#389): alle Einzelheiten zum Ansehen und Ändern (AK 7, 11).
   Die Felder gehen als ganze Liste mit den übrigen Angaben; keine Zeile
   heisst «ohne Felder». An einem Serientermin gelten beide nur für ihn — die
   Serie gibt (noch) keine vor (bis #391). */
export function TerminDialog({
  open,
  start,
  /** Die Zeit vor dem Ändern: Nur wenn sie sich ändert, wird sie geprüft. */
  bisher,
  pending,
  fehler: serverFehler,
  serie,
  serienTag,
  abweichungen,
  mitglieder,
  verantwortliche,
  onFolgen,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  /** Die Angaben des Termins; leer nur, solange der Dialog zu ist. */
  start?: Partial<TerminFelder>;
  bisher?: { beginn: string | null; ende: string | null };
  pending?: boolean;
  fehler?: string;
  /** Die Serie des geöffneten Termins; ohne: ein einzelner Termin. */
  serie?: TerminSerie | null;
  serienTag?: string | null;
  abweichungen?: readonly Abweichung[];
  /** Wer als Verantwortliche:r zur Wahl steht (#325). */
  mitglieder: readonly TeamMitglied[];
  /** Die Verantwortlichen des geöffneten Termins; ohne: keine. */
  verantwortliche?: readonly Verantwortlicher[];
  onFolgen?: (angabe: FolgeAngabe) => void;
  onClose: () => void;
  /** `regel` nur bei einem Serientermin: Wochentage und Zeitraum, wie sie im
   *  Dialog stehen (geändert oder nicht). `verantwortlich` nur, wenn sich die
   *  Wahl gegenüber dem Öffnen geändert hat (PO 17). */
  onSpeichern: (felder: TerminFelder, regel?: SerienRegel, verantwortlich?: VerantwortlicheWert) => void;
}) {
  const [felder, setFelder] = useState<TerminFelder>({ datum: "" });
  const [problem, setProblem] = useState<{ feld: TerminFeld; text: string } | null>(null);
  const [regel, setRegel] = useState<SerienRegel>({ wochentage: [], von: "", bis: "" });
  const [regelProblem, setRegelProblem] = useState<{ feld: SerieFeld | "beides"; text: string } | null>(null);
  const [verantwortlich, setVerantwortlich] = useState<VerantwortlicheWert>(KEINE_VERANTWORTLICHEN);
  const [felderZeilen, setFelderZeilen] = useState<FeldZeile[]>([]);
  const [felderFehler, setFelderFehler] = useState<FelderProblem | null>(null);
  const [spielerzahl, setSpielerzahl] = useState("");
  const [spielerzahlFehler, setSpielerzahlFehler] = useState<string | undefined>();

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
    setFelderZeilen(zeilenAusFeldern(start?.felder));
    setFelderFehler(null);
    setSpielerzahl(start?.spielerzahl != null ? String(start.spielerzahl) : "");
    setSpielerzahlFehler(undefined);
    setProblem(null);
    if (serie) setRegel({ wochentage: [...serie.wochentage], von: serie.beginnDatum, bis: serie.endDatum });
    setRegelProblem(null);
    setVerantwortlich(verantwortlicheStart(verantwortliche ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setze = (k: keyof TerminFelder) => (v: string) => setFelder((f) => ({ ...f, [k]: v }));
  const fehlerAn = (k: TerminFeld) => (problem?.feld === k ? problem.text : undefined);

  const regelFehlerAn = (k: SerieFeld) => (regelProblem?.feld === k ? regelProblem.text : undefined);
  const serieTitelId = useId();
  const terminDatum = start?.datum ?? "";
  const verschoben = !!serienTag && !!abweichungen?.includes("datum");
  const folgenKann = FOLGEN_KANN.filter((a) => abweichungen?.includes(a));

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
    if (nurNamenloseGeaendert(verantwortlich, verantwortlicheStart(verantwortliche ?? []))) {
      setRegelProblem({ feld: "beides", text: SERIE_TEXT.namenloseUndRegel });
      return false;
    }
    const platzGeaendert =
      !gleicheFelder(felderAusZeilen(felderZeilen), start?.felder) ||
      zahlOderNull(spielerzahl) !== (start?.spielerzahl ?? null);
    if (platzGeaendert) {
      setRegelProblem({ feld: "beides", text: SERIE_TEXT.platzUndRegel });
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
    const platz = felderAusZeilen(felderZeilen);
    const fp = felderProblem(platz);
    setFelderFehler(fp);
    const zahl = zahlOderNull(spielerzahl);
    const zp = spielerzahlProblem(zahl);
    setSpielerzahlFehler(zp?.text);
    const regelOk = regelPruefen();
    if (!p && !fp && !zp && regelOk) {
      const geaendert = verantwortlicheGeaendert(verantwortlich, verantwortlicheStart(verantwortliche ?? []));
      onSpeichern({ ...felder, felder: platz, spielerzahl: zahl }, serie ? regel : undefined, geaendert ? verantwortlich : undefined);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Termin ändern"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Speichern</Button>
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
        <VerantwortlicheWahl mitglieder={mitglieder} bisher={verantwortliche} wert={verantwortlich} onChange={setVerantwortlich} disabled={pending} />
        <SpielerzahlField wert={spielerzahl} onChange={setSpielerzahl} fehler={spielerzahlFehler} disabled={pending} />
        <FelderField zeilen={felderZeilen} onZeilenChange={setFelderZeilen} problem={felderFehler} disabled={pending} />
      </div>
      {serie && (
        <section aria-labelledby={serieTitelId} className="mt-6 border-t border-linie pt-4">
          <h3 id={serieTitelId} className="type-title-small text-on-surface">Terminserie</h3>
          <p className="type-body-small">
            {wochentageText(serie.wochentage)} · {datumKurz(serie.beginnDatum)} bis {datumKurz(serie.endDatum)} · {serie.beginn}–{serie.ende} Uhr
            {serie.ort ? <> · {serie.ort}</> : null}
          </p>
          {serie.verantwortliche.length > 0 && (
            <p className="type-body-small">Verantwortlich: {serie.verantwortliche.map((v) => v.name).join(", ")}</p>
          )}
          {/* AK 14 (#326), AK 19 (#325): welche Angaben abweichen — mit dem Weg
              zurück (AK 6). Das Datum folgt nie wieder der Serie (PO 3), es
              zählt das aktuelle. Keine Zeile, keine Liste. */}
          {(verschoben || folgenKann.length > 0) && (
            <ul className="mt-2 flex flex-col gap-1 type-body-small">
              {verschoben && <li>Verschoben - ursprünglich am {datumKurz(serienTag!)}.</li>}
              {folgenKann.map((a) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-x-2">
                  <span>{ANGABE[a]} {a === "verantwortliche" ? "weichen" : "weicht"} von der Serie ab.</span>
                  <Button variant="text" aria-label={FOLGEN_LABEL[a]} disabled={pending} onClick={() => onFolgen?.(a)}>Der Serie folgen</Button>
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
