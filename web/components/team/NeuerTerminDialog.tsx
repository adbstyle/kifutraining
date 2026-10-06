"use client";

import { useEffect, useState } from "react";
import { Button, Checkbox, DateField, Dialog, SectionMessage, TextArea, TextField, TimeField, WochentagWahl } from "@/components/ui";
import { maxEnddatum, serieProblem, wochentagVon, type SerieFeld, type Wochentag } from "@/lib/serie";
import { BEMERKUNG_MAX, ORT_MAX, istKalendertag, terminProblem, type TerminFelder } from "@/lib/termin";
import type { Felder } from "@/lib/termin-felder";
import type { TeamMitglied } from "@/lib/queries/teams";
import { VerantwortlicheWahl, type VerantwortlicheWert } from "./VerantwortlicheWahl";
import { FelderField } from "./FelderField";
import { SpielerzahlField } from "./SpielerzahlField";
import { usePlatzAngaben } from "./usePlatzAngaben";

export type SerieFelder = {
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort: string;
  bemerkung: string;
  /** Kennungen der Mitglieder, die jeder Termin der Serie trägt (#325 AK 3). */
  verantwortliche: string[];
};

/** Was der Dialog festlegt: einen einzelnen Termin (#322 AK 1) oder eine
 *  Terminserie (#324 AK 1), beide mit Feldern und erwarteter Spielerzahl
 *  (#389, #390, #391 AK 1). `verantwortlich` nur, wenn jemand gewählt ist. */
export type NeuerTermin =
  | { art: "einzeln"; felder: TerminFelder; verantwortlich?: VerantwortlicheWert }
  | { art: "serie"; felder: SerieFelder & { felder: Felder | null; spielerzahl: number | null } };

const LEER: SerieFelder = { wochentage: [], von: "", bis: "", beginn: "", ende: "", ort: "", bemerkung: "", verantwortliche: [] };

/* Einen neuen Termin erstellen — einzeln oder, mit «Wiederholender Termin»,
   als Terminserie. Ein Einstieg statt zweier: Die Angaben sind dieselben, die
   Serie bringt nur Wochentage und Enddatum dazu, und das Datum wird zu ihrem
   Beginndatum. Die Regeln sind die des Fachkerns (lib/termin.ts bzw.
   lib/serie.ts); das Enddatum lässt sich nicht über den gleichen Kalendertag
   im Folgejahr hinaus wählen.

   Die Wochentage folgen dem Datum, bis der USER selbst einen wählt: Wer
   «jeden Dienstag ab dem 6.» meint, kreuzt nur an und wählt das Ende.

   Verantwortliche lassen sich gleich mitgeben (#325 AK 1, 3); gelöschte
   Konten gibt es bei einem neuen Termin noch nicht, darum ohne `bisher`.

   Erwartete Spielerzahl (#390 AK 1) und Felder des Platzes (#389 AK 1, 8)
   gelten für den einzelnen Termin wie für jeden Termin einer Serie
   (#391 AK 1). */
export function NeuerTerminDialog({
  open,
  start,
  pending,
  fehler: serverFehler,
  mitglieder,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  /** Das vorbelegte Datum (der Tag im Monatsüberblick); "" = ohne. */
  start: string;
  pending?: boolean;
  fehler?: string;
  mitglieder: readonly TeamMitglied[];
  onClose: () => void;
  onSpeichern: (t: NeuerTermin) => void;
}) {
  const [f, setF] = useState<SerieFelder>(LEER);
  const [wiederholen, setWiederholen] = useState(false);
  const [tageVonHand, setTageVonHand] = useState(false);
  const [problem, setProblem] = useState<{ feld: SerieFeld; text: string } | null>(null);
  const platz = usePlatzAngaben();
  // Ein Server-Fehler gilt für die Art, mit der gespeichert wurde; schaltet
  // der USER um, ist er verworfen — bis zum nächsten Speichern.
  const [verworfen, setVerworfen] = useState<string | undefined>();
  const fehlerAnzeigen = serverFehler && serverFehler !== verworfen ? serverFehler : undefined;

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten des letzten Termins.
  useEffect(() => {
    if (!open) return;
    setF({ ...LEER, von: start });
    setWiederholen(false);
    setTageVonHand(false);
    setProblem(null);
    platz.zuruecksetzen();
    setVerworfen(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fehlerAn = (k: SerieFeld) => (problem?.feld === k ? problem.text : undefined);
  const setze = <K extends keyof SerieFelder>(k: K, v: SerieFelder[K]) => setF((x) => ({ ...x, [k]: v }));
  const tageZu = (datum: string): Wochentag[] => (istKalendertag(datum) ? [wochentagVon(datum)] : []);

  function datumGewaehlt(datum: string) {
    setF((x) => ({ ...x, von: datum, ...(wiederholen && !tageVonHand ? { wochentage: tageZu(datum) } : {}) }));
  }

  function wiederholenGewaehlt(an: boolean) {
    setWiederholen(an);
    setProblem(null);
    setVerworfen(serverFehler);
    if (an && !tageVonHand) setze("wochentage", tageZu(f.von));
  }

  /** Erst beim Senden gilt ein verworfener Fehler wieder — sonst tauchte er
   *  bei einer Feldprüfung, die gar nicht sendet, erneut auf. */
  function senden(t: NeuerTermin) {
    setVerworfen(undefined);
    onSpeichern(t);
  }

  function speichern() {
    // Felder und Spielerzahl prüfen beide Arten gleich.
    const angaben = platz.pruefe();
    if (wiederholen) {
      const p = serieProblem(f);
      setProblem(p);
      if (!p && angaben) senden({ art: "serie", felder: { ...f, ...angaben } });
      return;
    }
    const felder: TerminFelder = {
      datum: f.von,
      beginn: f.beginn,
      ende: f.ende,
      ort: f.ort,
      bemerkung: f.bemerkung,
      ...angaben,
    };
    const p = terminProblem(felder);
    // Das Datum heisst in beiden Fällen `von` — so steht ein Fehler am selben Feld.
    setProblem(p && { feld: p.feld === "datum" ? "von" : p.feld, text: p.text });
    if (!p && angaben) {
      const verantwortlich = f.verantwortliche.length > 0 ? { userIds: f.verantwortliche, anonyme: [] } : undefined;
      senden({ art: "einzeln", felder, verantwortlich });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Termin erstellen"
      breit
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Erstellen</Button>
        </>
      }
    >
      {fehlerAnzeigen && <SectionMessage appearance="error" className="mb-4">{fehlerAnzeigen}</SectionMessage>}
      <div className="flex flex-col gap-4">
        <DateField
          label={wiederholen ? "Beginndatum" : "Datum"}
          value={f.von}
          onChange={(e) => datumGewaehlt(e.target.value)}
          error={!!fehlerAn("von")}
          supportingText={fehlerAn("von")}
        />
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label="Beginn" className="flex-1" value={f.beginn} onChange={(e) => setze("beginn", e.target.value)} error={!!fehlerAn("beginn")} supportingText={fehlerAn("beginn")} />
          <TimeField label="Ende" className="flex-1" value={f.ende} onChange={(e) => setze("ende", e.target.value)} error={!!fehlerAn("ende")} supportingText={fehlerAn("ende")} />
        </div>
        <Checkbox label="Wiederholender Termin" className="self-start" checked={wiederholen} onChange={(e) => wiederholenGewaehlt(e.target.checked)} />
        {wiederholen && (
          <>
            <WochentagWahl
              wert={f.wochentage}
              onChange={(w) => {
                setTageVonHand(true);
                setze("wochentage", w);
              }}
              error={fehlerAn("wochentage")}
            />
            <DateField
              label="Enddatum"
              value={f.bis}
              min={f.von || undefined}
              max={istKalendertag(f.von) ? maxEnddatum(f.von) : undefined}
              onChange={(e) => setze("bis", e.target.value)}
              error={!!fehlerAn("bis")}
              supportingText={fehlerAn("bis")}
            />
          </>
        )}
        <TextField label="Ort (optional)" maxLength={ORT_MAX} value={f.ort} onChange={(e) => setze("ort", e.target.value)} error={!!fehlerAn("ort")} supportingText={fehlerAn("ort")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={f.bemerkung} onChange={(e) => setze("bemerkung", e.target.value)} error={!!fehlerAn("bemerkung")} supportingText={fehlerAn("bemerkung")} />
        <VerantwortlicheWahl
          mitglieder={mitglieder}
          wert={{ userIds: f.verantwortliche, anonyme: [] }}
          onChange={(w) => setze("verantwortliche", w.userIds)}
          disabled={pending}
        />
        <SpielerzahlField {...platz.spielerzahlProps} disabled={pending} />
        <FelderField {...platz.felderProps} disabled={pending} />
      </div>
    </Dialog>
  );
}
