"use client";

import { useEffect, useId, useState } from "react";
import { Button, DateField, Dialog, FormAbschnitt, SectionMessage, TextArea, TimeField, WochentagWahl } from "@/components/ui";
import {
  BEMERKUNG_MAX,
  HINWEIS_ELTERN_MAX,
  TERMIN_TEXT,
  ausfallProblem,
  leerZuNull,
  spielerzahlText,
  terminProblem,
  type TerminFeld,
  type TerminFelder,
} from "@/lib/termin";
import { feldName, feldText } from "@/lib/termin-felder";
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
import { TRAINER_TEXT, trainerName, verantwortlicheVon, type TerminTrainer } from "@/lib/trainer";
import type { TeamMitglied } from "@/lib/queries/teams";
import type { FolgeAngabe } from "@/lib/kern/serien";
import { TrainerWahl, gleicheMenge, trainerAenderung, trainerStart, type TrainerAenderung, type TrainerWert } from "./TrainerWahl";
import { KEINE_BESETZUNG, MindestbesetzungFeld, besetzungAusEingabe, besetzungEingabe, type BesetzungEingabe } from "./MindestbesetzungFeld";
import { besetzungText } from "@/lib/besetzung";
import { FelderField } from "./FelderField";
import { SpielerzahlField } from "./SpielerzahlField";
import { terminBegonnen } from "@/lib/zeit";
import { usePlatzAngaben } from "./usePlatzAngaben";
import { SPIEL_MELDUNG } from "@/lib/spiel";
import {
  BezeichnungFeld,
  MeldefristFelder,
  RichtwertFelder,
  TreffpunkteFelder,
  fristEingabe,
  treffpunkteEingabe,
  useSpielAngaben,
} from "./SpielFelder";
import type { Kader, TerminKader } from "@/lib/kader";
import { KaderWahl } from "./KaderWahl";
import { OrtFelder } from "./OrtFelder";

const ANGABE: Record<FolgeAngabe, string> = {
  zeit: "Die Zeit",
  ort: "Der Ort",
  bemerkung: "Die Bemerkung",
  hinweis_eltern: "Der Hinweis für Eltern",
  eingeladene: "Die Eingeladenen",
  verantwortung: "Die Verantwortung",
  besetzung: "Die Mindestbesetzung",
  spielerzahl: "Die erwartete Spielerzahl",
  felder: "Die Felder",
  kader: "Die Kader",
};
/** Mehrzahl: «weichen» statt «weicht». */
const MEHRZAHL: readonly FolgeAngabe[] = ["eingeladene", "felder", "kader"];
/** Die Angaben, die wieder der Serie folgen können, in der Reihenfolge des Dialogs. */
const FOLGEN_KANN: readonly FolgeAngabe[] = [
  "zeit",
  "ort",
  "hinweis_eltern",
  "bemerkung",
  "kader",
  "spielerzahl",
  "eingeladene",
  "verantwortung",
  "besetzung",
  "felder",
];
const FOLGEN_LABEL: Record<FolgeAngabe, string> = {
  zeit: "Zeit wieder der Serie folgen lassen",
  ort: "Ort wieder der Serie folgen lassen",
  bemerkung: "Bemerkung wieder der Serie folgen lassen",
  hinweis_eltern: "Hinweis für Eltern wieder der Serie folgen lassen",
  eingeladene: "Eingeladene wieder der Serie folgen lassen",
  verantwortung: "Verantwortung wieder der Serie folgen lassen",
  besetzung: "Mindestbesetzung wieder der Serie folgen lassen",
  spielerzahl: "Erwartete Spielerzahl wieder der Serie folgen lassen",
  felder: "Felder wieder der Serie folgen lassen",
  kader: "Kader wieder der Serie folgen lassen",
};

/* Einen Termin ändern (Team-Kalender #322); erstellt wird im
   NeuerTerminDialog.
   Die Regeln kommen aus lib/termin.ts — dieselben, die der Fachkern prüft;
   der Dialog zeigt den Fehler am Feld, bevor er etwas sendet.

   Ein Serientermin (#326) zeigt zusätzlich seine Serie: welche Angaben von
   ihr abweichen, mit dem Weg zurück (AK 6, 14), und Wochentage und Zeitraum
   zum Ändern (AK 3, 4). Für welchen Teil der Serie eine Änderung gilt, fragt
   danach der ReichweiteDialog.

   Nach der Bemerkung zwei Abschnitte wie beim Erstellen (Epic #518):
   «Spieler:innen» mit den Kadern (#453; ein begonnener Termin behält sie,
   AK 13) und der erwarteten Spielerzahl (#390; leer = unbekannt), dann
   «Trainer:innen» mit Eingeladenen und Verantwortlicher (#519). Weichen diese
   an einem Serientermin ab, sagt es der Serien-Abschnitt je für sich (AK 15)
   und bietet den Weg zurück (AK 14).

   Danach die Felder des Platzes (#389): alle Einzelheiten zum Ansehen und
   Ändern (AK 7, 11).
   Die Felder gehen als ganze Liste mit den übrigen Angaben; keine Zeile
   heisst «ohne Felder». An einem Serientermin zeigt der Serien-Abschnitt,
   was die Serie vorgibt und ob der Termin davon abweicht (#391 AK 4–6).

   Ein ausgefallener Termin zeigt zuoberst seinen Grund, ganz und änderbar
   (#402 AK 12, 13) — er gilt nur für diesen Termin, auch in einer Serie
   (PC 4). Wer ihn auf heute oder später verlegt, erfährt vor dem Speichern,
   dass der Ausfall damit endet (AK 14); der Grund ist dann gegenstandslos.

   Ein Spiel (#459) trägt statt Feldern und erwarteter Spielerzahl seine
   Bezeichnung und seinen Richtwert; die Art bleibt. Sein Anpfiff lässt sich
   nur auf einen bevorstehenden legen (AK 21), und jede Verlegung beendet
   seinen Ausfall (PC 5). */
export function TerminDialog({
  open,
  start,
  pending,
  fehler: serverFehler,
  serie,
  serienTag,
  abweichungen,
  mitglieder,
  ich,
  trainer,
  spielerzahlAktuell = null,
  ausfall,
  heute,
  fuehrtListe,
  kader = [],
  terminKader = [],
  spielerGesamt = 0,
  begonnen,
  onFolgen,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  /** Die Angaben des Termins; leer nur, solange der Dialog zu ist. */
  start?: Partial<TerminFelder>;
  pending?: boolean;
  fehler?: string;
  /** Die Serie des geöffneten Termins; ohne: ein einzelner Termin. */
  serie?: TerminSerie | null;
  serienTag?: string | null;
  abweichungen?: readonly Abweichung[];
  /** Wer als Trainer:in zur Wahl steht (#519). */
  mitglieder: readonly TeamMitglied[];
  /** Das eigene Konto — es steht mit «(du)» da. */
  ich: string;
  /** Die Trainer:innen des geöffneten Termins; ohne: keine. */
  trainer?: readonly TerminTrainer[];
  /** Die Spielerzahl, die der Termin anzeigt — für den Hinweis zum Verhältnis (#521 AK 14). */
  spielerzahlAktuell?: number | null;
  /** Der Termin ist ausgefallen, mit diesem Grund (#402 AK 12); ohne: nicht ausgefallen. */
  ausfall?: { grund: string | null } | null;
  /** Der heutige Kalendertag — ab ihm endet ein Ausfall beim Verlegen (AK 14). */
  heute: string;
  /** Das Team führt eine Spielerliste (#434): An einem anstehenden Termin
   *  kommt die Spielerzahl aus ihr, das Feld entfällt. */
  fuehrtListe?: boolean;
  /** Die Kader des Teams und die des geöffneten Termins (#453). */
  kader?: readonly Kader[];
  terminKader?: readonly TerminKader[];
  spielerGesamt?: number;
  /** Der Termin hat begonnen: Seine Kader stehen fest (AK 13). */
  begonnen?: boolean;
  onFolgen?: (angabe: FolgeAngabe) => void;
  onClose: () => void;
  /** `regel` nur bei einem Serientermin: Wochentage und Zeitraum, wie sie im
   *  Dialog stehen (geändert oder nicht). `trainer` nur, wenn sich die Wahl
   *  gegenüber dem Öffnen geändert hat (PO 17); ebenso `grund`, und nur,
   *  solange der Ausfall bestehen bleibt. */
  onSpeichern: (
    felder: TerminFelder,
    regel?: SerienRegel,
    trainer?: TrainerAenderung,
    grund?: string,
    /** Nur, wenn sich die Kader geändert haben (#453). */
    kaderIds?: string[],
  ) => void;
}) {
  const [felder, setFelder] = useState<TerminFelder>({ datum: "" });
  const [problem, setProblem] = useState<{ feld: TerminFeld; text: string } | null>(null);
  const [regel, setRegel] = useState<SerienRegel>({ wochentage: [], von: "", bis: "" });
  const [regelProblem, setRegelProblem] = useState<{ feld: SerieFeld | "beides"; text: string } | null>(null);
  const [besetzung, setBesetzung] = useState<TrainerWert>({ eingeladene: [], anonyme: [], verantwortlich: null });
  const besetzungStart = trainerStart(trainer ?? []);
  const [mindest, setMindest] = useState<BesetzungEingabe>(KEINE_BESETZUNG);
  const [mindestFehler, setMindestFehler] = useState<string>();
  const [grund, setGrund] = useState("");
  const [grundFehler, setGrundFehler] = useState<string>();
  const kaderStart = terminKader.flatMap((k) => (k.id ? [k.id] : []));
  const [kaderWahl, setKaderWahl] = useState<string[]>([]);
  const platz = usePlatzAngaben();
  const istSpiel = start?.art === "spiel";
  const spiel = useSpielAngaben(felder.datum, felder.beginn ?? "");
  // Ein begonnener Termin behält seine erwartete Zahl: Sie gilt dort, wenn die
  // Liste bei Beginn leer war (Migration spielerliste).
  const ausListe = !!fuehrtListe && !(!!felder.datum && !!felder.beginn && terminBegonnen(felder.datum, felder.beginn));

  // Beim Öffnen auf die Vorbelegung zurücksetzen — der Dialog überlebt sonst
  // mit den Werten des zuletzt bearbeiteten Termins.
  useEffect(() => {
    if (!open) return;
    setFelder({
      datum: start?.datum ?? "",
      beginn: start?.beginn ?? "",
      ende: start?.ende ?? "",
      ort: start?.ort ?? "",
      ortLink: start?.ortLink ?? "",
      bemerkung: start?.bemerkung ?? "",
      hinweisEltern: start?.hinweisEltern ?? "",
    });
    platz.zuruecksetzen(start);
    spiel.zuruecksetzen(
      {
        bezeichnung: start?.bezeichnung ?? "",
        min: start?.richtwertMin != null ? String(start.richtwertMin) : "",
        max: start?.richtwertMax != null ? String(start.richtwertMax) : "",
        ...fristEingabe(start?.meldefrist),
        treffpunkte: treffpunkteEingabe(start?.treffpunkte),
      },
      start?.datum && start.beginn ? `${start.datum}T${start.beginn.slice(0, 5)}` : null,
    );
    setProblem(null);
    if (serie) setRegel({ wochentage: [...serie.wochentage], von: serie.beginnDatum, bis: serie.endDatum });
    setRegelProblem(null);
    setBesetzung(trainerStart(trainer ?? []));
    setMindest(besetzungEingabe(start?.mindestbesetzung ?? null));
    setMindestFehler(undefined);
    setGrund(ausfall?.grund ?? "");
    setGrundFehler(undefined);
    setKaderWahl(kaderStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setze = (k: keyof TerminFelder) => (v: string) => setFelder((f) => ({ ...f, [k]: v }));
  // #533 PC 1: Der Kartenlink gehört zum Ort. Ändert sich der Ort, fällt der
  // bisherige Link weg (sichtbar vor dem Speichern, AK 12); kehrt der Ort
  // zurück, gilt der Link wieder.
  const startOrt = leerZuNull(start?.ort);
  const startLink = start?.ortLink ?? "";
  function ortGeaendert(v: string) {
    setFelder((f) => {
      const zurueck = leerZuNull(v) === startOrt;
      const linkUnberuehrt = (f.ortLink ?? "") === (zurueck ? "" : startLink);
      // AK 4: Ohne Ort kein Kartenlink.
      if (leerZuNull(v) === null) return { ...f, ort: v, ortLink: "" };
      return { ...f, ort: v, ...(linkUnberuehrt ? { ortLink: zurueck ? startLink : "" } : {}) };
    });
  }
  // Auch der Link der Serie fällt weg, wenn der neue Ort für sie gilt
  // (Reichweite «alle» oder «dieser und folgende»), und ein geleerter Ort
  // nimmt ihn ebenso mit (AK 12).
  const bisherigerLink = startLink || serie?.ortLink;
  const kartenlinkWeg = !!bisherigerLink && leerZuNull(felder.ort) !== startOrt && !leerZuNull(felder.ortLink);
  // #533 AK 13: Folgt der Ort wieder der Serie, fällt ein eigener Link weg.
  const eigenerLinkWeg = !!startLink && startLink !== (serie?.ortLink ?? "");
  const fehlerAn = (k: TerminFeld) => (problem?.feld === k ? problem.text : undefined);

  const regelFehlerAn = (k: SerieFeld) => (regelProblem?.feld === k ? regelProblem.text : undefined);
  const serieTitelId = useId();
  const terminDatum = start?.datum ?? "";
  const verschoben = !!serienTag && !!abweichungen?.includes("datum");
  const folgenKann = FOLGEN_KANN.filter((a) => abweichungen?.includes(a));
  // Dieselbe Regel wie der Fachkern (`aendereTermin`): ein anderes Datum ab
  // heute — bei einem Spiel jede Verlegung, auch nur der Zeit (#459 PC 5).
  const verlegt = felder.datum !== terminDatum || (felder.beginn ?? "") !== (start?.beginn ?? "");
  const ausfallEndet = !!ausfall && (istSpiel ? verlegt : felder.datum !== terminDatum && felder.datum >= heute);

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
    if (trainerAenderung(besetzung, besetzungStart)?.nurNamenlose) {
      setRegelProblem({ feld: "beides", text: SERIE_TEXT.namenloseUndRegel });
      return false;
    }
    // Die Reichweite ist noch offen: weitere Obergrenze, die engere prüft die Vorschau.
    const r = regelProblemVorab(serie, regel, terminDatum);
    setRegelProblem(r);
    return !r;
  }

  /** Ein Spiel (#459) trägt Bezeichnung, Richtwert, Meldefrist und
   *  Treffpunkte statt Feldern und Spielerzahl, hat nie eine Serie, und ein
   *  verlegter Anpfiff liegt nur in der Zukunft. */
  function speichern() {
    const p = terminProblem(felder);
    setProblem(p);
    const angaben = istSpiel ? spiel.pruefe() : platz.pruefe();
    const regelOk = regelPruefen();
    const gp = ausfall && !ausfallEndet ? ausfallProblem(grund) : null;
    setGrundFehler(gp?.text);
    const m = besetzungAusEingabe(mindest);
    setMindestFehler(m.ok ? undefined : m.text);
    if (p || !angaben || !regelOk || gp || !m.ok) return;
    if (istSpiel && verlegt && terminBegonnen(felder.datum, felder.beginn ?? "")) {
      setProblem({ feld: "beginn", text: SPIEL_MELDUNG.SPIEL_ANPFIFF_VERGANGEN });
      return;
    }
    const grundNeu = ausfall && !ausfallEndet && grund.trim() !== (ausfall.grund ?? "") ? grund : undefined;
    onSpeichern(
      istSpiel
        ? { ...felder, art: "spiel", ...angaben, mindestbesetzung: m.wert }
        : { ...felder, ...angaben, mindestbesetzung: m.wert },
      serie ? regel : undefined,
      trainerAenderung(besetzung, besetzungStart) ?? undefined,
      grundNeu,
      gleicheMenge(kaderWahl, kaderStart) ? undefined : kaderWahl,
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={istSpiel ? "Spiel ändern" : "Termin ändern"}
      breit
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Speichern</Button>
        </>
      }
    >
      {serverFehler && <SectionMessage appearance="error" className="mb-4">{serverFehler}</SectionMessage>}
      {ausfall && (
        <div className="mb-4 flex flex-col gap-3">
          {ausfallEndet ? (
            <SectionMessage appearance="information">
              {istSpiel
                ? "Verlegt findet das Spiel statt: Mit dem Speichern endet sein Ausfall, und der Grund entfällt."
                : "Am neuen Tag findet der Termin statt: Mit dem Speichern endet sein Ausfall, und der Grund entfällt."}
            </SectionMessage>
          ) : (
            <TextArea
              label="Grund des Ausfalls (optional)"
              rows={2}
              maxLength={BEMERKUNG_MAX}
              info={TERMIN_TEXT.grundSichtbar}
              infoAufTouch
              value={grund}
              onChange={(e) => {
                setGrund(e.target.value);
                setGrundFehler(undefined);
              }}
              error={!!grundFehler}
              supportingText={grundFehler}
              disabled={pending}
            />
          )}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {istSpiel && <BezeichnungFeld angaben={spiel} disabled={pending} />}
        <DateField label="Datum" value={felder.datum} onChange={(e) => setze("datum")(e.target.value)} error={!!fehlerAn("datum")} supportingText={fehlerAn("datum")} />
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label={istSpiel ? "Anpfiff" : "Beginn"} className="flex-1" value={felder.beginn ?? ""} onChange={(e) => setze("beginn")(e.target.value)} error={!!fehlerAn("beginn")} supportingText={fehlerAn("beginn")} />
          <TimeField label="Ende" className="flex-1" value={felder.ende ?? ""} onChange={(e) => setze("ende")(e.target.value)} error={!!fehlerAn("ende")} supportingText={fehlerAn("ende")} />
        </div>
        <OrtFelder
          ort={felder.ort ?? ""}
          ortLink={felder.ortLink ?? ""}
          onOrt={ortGeaendert}
          onOrtLink={setze("ortLink")}
          fehlerOrt={fehlerAn("ort")}
          fehlerLink={fehlerAn("ortLink")}
          hinweis={kartenlinkWeg ? TERMIN_TEXT.kartenlinkFaelltWeg : undefined}
          disabled={pending}
        />
        {istSpiel && <RichtwertFelder angaben={spiel} disabled={pending} />}
        {istSpiel && <MeldefristFelder angaben={spiel} disabled={pending} />}
        {istSpiel && <TreffpunkteFelder angaben={spiel} spieltag={felder.datum} disabled={pending} />}
        <TextArea label="Hinweis für Eltern (optional)" rows={3} maxLength={HINWEIS_ELTERN_MAX} value={felder.hinweisEltern ?? ""} onChange={(e) => setze("hinweisEltern")(e.target.value)} info={TERMIN_TEXT.hinweisElternSichtbar} infoAufTouch error={!!fehlerAn("hinweisEltern")} supportingText={fehlerAn("hinweisEltern")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={felder.bemerkung ?? ""} onChange={(e) => setze("bemerkung")(e.target.value)} info={TERMIN_TEXT.bemerkungIntern} error={!!fehlerAn("bemerkung")} supportingText={fehlerAn("bemerkung")} />
        {(kader.length > 0 || terminKader.length > 0 || !istSpiel) && (
          <FormAbschnitt titel="Spieler:innen" untertitel="Für wen der Termin gilt und mit wie vielen gerechnet wird." imDialog>
            {(kader.length > 0 || terminKader.length > 0) && (
              <KaderWahl
                kader={kader}
                spielerGesamt={spielerGesamt}
                wert={kaderWahl}
                onChange={setKaderWahl}
                begonnen={begonnen}
                disabled={pending}
              />
            )}
            {!istSpiel && <SpielerzahlField {...platz.spielerzahlProps} disabled={pending} ausListe={ausListe} />}
          </FormAbschnitt>
        )}
        <FormAbschnitt titel="Trainer:innen" untertitel={TRAINER_TEXT.eingeladenHinweis} imDialog>
          <TrainerWahl mitglieder={mitglieder} ich={ich} bisher={trainer} wert={besetzung} onChange={setBesetzung} disabled={pending} />
          <MindestbesetzungFeld
            wert={mindest}
            onChange={(w) => {
              setMindest(w);
              setMindestFehler(undefined);
            }}
            spielerzahl={
              fuehrtListe || istSpiel
                ? spielerzahlAktuell
                : platz.spielerzahlProps.wert.trim() === ""
                  ? null
                  : Number(platz.spielerzahlProps.wert)
            }
            spielerWort={fuehrtListe || istSpiel ? "angemeldeten" : "erwarteten"}
            fehler={mindestFehler}
            disabled={pending}
          />
        </FormAbschnitt>
        {!istSpiel && (
          <div className="border-t border-linie pt-4">
            <FelderField {...platz.felderProps} disabled={pending} />
          </div>
        )}
      </div>
      {serie && (
        <section aria-labelledby={serieTitelId} className="mt-6 border-t border-linie pt-4">
          <h3 id={serieTitelId} className="type-title-small text-on-surface">Terminserie</h3>
          <p className="type-body-small">
            {wochentageText(serie.wochentage)} · {datumKurz(serie.beginnDatum)} bis {datumKurz(serie.endDatum)} · {serie.beginn}–{serie.ende} Uhr
            {serie.ort ? <> · {serie.ort}</> : null}
          </p>
          {serie.trainer.length > 0 && (
            <p className="type-body-small">Eingeladen: {serie.trainer.map((v) => v.name).join(", ")}</p>
          )}
          {serie.mindestbesetzung && <p className="type-body-small">Mindestbesetzung: {besetzungText(serie.mindestbesetzung)}</p>}
          {verantwortlicheVon(serie.trainer) && (
            <p className="type-body-small">Verantwortlich: {trainerName(verantwortlicheVon(serie.trainer)!)}</p>
          )}
          {serie.kader.length > 0 && (
            <p className="type-body-small">Kader: {serie.kader.map((k) => k.name).join(", ")}</p>
          )}
          {/* #391 AK 4: was die Serie an Spielerzahl und Feldern vorgibt. */}
          {serie.spielerzahl !== null && (
            <p className="type-body-small">Erwartet: {spielerzahlText(serie.spielerzahl)}</p>
          )}
          {serie.felder?.map((f, i, alle) => (
            <p key={i} className="type-body-small">
              {feldName(i, alle.length)}: {feldText(f)}
            </p>
          ))}
          {/* AK 14 (#326), AK 19 (#325): welche Angaben abweichen — mit dem Weg
              zurück (AK 6). Das Datum folgt nie wieder der Serie (PO 3), es
              zählt das aktuelle. Keine Zeile, keine Liste. */}
          {(verschoben || folgenKann.length > 0) && (
            <ul className="mt-2 flex flex-col gap-1 type-body-small">
              {verschoben && <li>Verschoben - ursprünglich am {datumKurz(serienTag!)}.</li>}
              {folgenKann.map((a) => (
                <li key={a} className="flex flex-wrap items-center justify-between gap-x-2">
                  <span>
                    {ANGABE[a]} {MEHRZAHL.includes(a) ? "weichen" : "weicht"} von der Serie ab.
                    {a === "ort" && eigenerLinkWeg && <> {TERMIN_TEXT.kartenlinkFolgtSerie}</>}
                  </span>
                  <Button variant="link" aria-label={FOLGEN_LABEL[a]} disabled={pending} onClick={() => onFolgen?.(a)}>Der Serie folgen</Button>
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
