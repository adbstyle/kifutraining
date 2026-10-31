"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  ChoiceChip,
  ChoiceChipGroup,
  DateField,
  Dialog,
  FormAbschnitt,
  InfoKnopf,
  SectionMessage,
  TextArea,
  TimeField,
  WochentagWahl,
  feldNameKlasse,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { SPIEL_MELDUNG, SPIEL_TEXT, type TerminArt } from "@/lib/spiel";
import { BezeichnungFeld, MeldefristFelder, RichtwertFelder, TreffpunkteFelder, useSpielAngaben } from "./SpielFelder";
import { maxEnddatum, serieProblem, wochentagVon, type SerieFeld, type Wochentag } from "@/lib/serie";
import {
  BEMERKUNG_MAX,
  HINWEIS_ELTERN_MAX,
  TERMIN_TEXT,
  istKalendertag,
  terminProblem,
  type TerminFelder,
  type TerminTreffpunkt,
} from "@/lib/termin";
import type { Felder } from "@/lib/termin-felder";
import type { TeamMitglied } from "@/lib/queries/teams";
import { TrainerWahl, trainerVorwahl, type TrainerWert } from "./TrainerWahl";
import { KEINE_BESETZUNG, MindestbesetzungFeld, besetzungAusEingabe, type BesetzungEingabe } from "./MindestbesetzungFeld";
import { giltFuerAnzahl } from "@/lib/kader";
import type { Mindestbesetzung } from "@/lib/besetzung";
import { TRAINER_TEXT } from "@/lib/trainer";
import { FelderField } from "./FelderField";
import { SpielerzahlField } from "./SpielerzahlField";
import { usePlatzAngaben } from "./usePlatzAngaben";
import { terminBegonnen } from "@/lib/zeit";
import type { Kader } from "@/lib/kader";
import { KaderWahl } from "./KaderWahl";
import { OrtFelder } from "./OrtFelder";
import { TreffpunktFelder, treffpunktAusEingabe, type TrainingsTreffpunktEingabe } from "./TreffpunktFelder";

export type SerieFelder = {
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort: string;
  /** Der Kartenlink zum Ort (#533 AK 1, 2); leer = keiner. */
  ortLink: string;
  bemerkung: string;
  /** Der Hinweis für Eltern (#590 AK 1, 2); leer = keiner. */
  hinweisEltern: string;
  /** Für welche Kader jeder Termin gilt (#453 AK 1, 2); leer = für alle. */
  kaderIds: string[];
};

/** Die Trainer:innen beim Festlegen (#519 AK 1–4): wer eingeladen und wer verantwortlich ist. */
export type TrainerFestlegen = { eingeladene: string[]; verantwortlich: string; mindestbesetzung: Mindestbesetzung };

/** Was der Dialog festlegt: einen einzelnen Termin (#322 AK 1) oder eine
 *  Terminserie (#324 AK 1), beide mit Feldern und erwarteter Spielerzahl
 *  (#389, #390, #391 AK 1) und mit ihren Trainer:innen (#519). */
export type NeuerTermin =
  | { art: "einzeln"; felder: TerminFelder; trainer: TrainerFestlegen; kaderIds: string[] }
  | {
      art: "serie";
      felder: SerieFelder & { felder: Felder | null; spielerzahl: number | null; treffpunkt: TerminTreffpunkt | null } & TrainerFestlegen;
    };

const LEER: SerieFelder = { wochentage: [], von: "", bis: "", beginn: "", ende: "", ort: "", ortLink: "", bemerkung: "", hinweisEltern: "", kaderIds: [] };

/* Einen neuen Termin erstellen — einzeln oder, mit «Wiederholender Termin»,
   als Terminserie. Ein Einstieg statt zweier: Die Angaben sind dieselben, die
   Serie bringt nur Wochentage und Enddatum dazu, und das Datum wird zu ihrem
   Beginndatum. Die Regeln sind die des Fachkerns (lib/termin.ts bzw.
   lib/serie.ts); das Enddatum lässt sich nicht über den gleichen Kalendertag
   im Folgejahr hinaus wählen.

   Die Wochentage folgen dem Datum, bis der USER selbst einen wählt: Wer
   «jeden Dienstag ab dem 6.» meint, kreuzt nur an und wählt das Ende.

   Danach zwei Abschnitte (#518, Tafel «Termin erstellen»): «Spieler:innen»
   mit den Kadern und der Spielerzahl, dann «Trainer:innen» — alle Mitglieder
   eingeladen, du verantwortlich vorgewählt (#519 AK 1–4). Gelöschte Konten
   gibt es bei einem neuen Termin noch nicht, darum ohne `bisher`.

   Erwartete Spielerzahl (#390 AK 1) und Felder des Platzes (#389 AK 1, 8)
   gelten für den einzelnen Termin wie für jeden Termin einer Serie
   (#391 AK 1). Führt das Team Kader, gilt er für die gewählten (#453).

   Zuerst die Art (#459 AK 1): ohne Vorwahl, damit niemand aus Versehen ein
   Training erfasst. Ein Spiel trägt statt Feldern, Spielerzahl und Serie
   eine Bezeichnung und einen Richtwert; sein Beginn heisst Anpfiff und liegt
   in der Zukunft (AK 21). */
export function NeuerTerminDialog({
  open,
  pending,
  fehler: serverFehler,
  mitglieder,
  ich,
  fuehrtListe,
  kader = [],
  spielerGesamt = 0,
  onClose,
  onSpeichern,
}: {
  open: boolean;
  pending?: boolean;
  fehler?: string;
  mitglieder: readonly TeamMitglied[];
  /** Das eigene Konto: verantwortlich vorgewählt (#519 AK 4). */
  ich: string;
  /** Die Kader des Teams (#453) und wie viele Spieler:innen die Liste führt. */
  kader?: readonly Kader[];
  spielerGesamt?: number;
  /** Das Team führt eine Spielerliste (#434): kein Feld für die Spielerzahl. */
  fuehrtListe?: boolean;
  onClose: () => void;
  onSpeichern: (t: NeuerTermin) => void;
}) {
  const [f, setF] = useState<SerieFelder>(LEER);
  const [art, setArt] = useState<TerminArt | null>(null);
  const [artFehler, setArtFehler] = useState(false);
  const spiel = useSpielAngaben(f.von, f.beginn);
  const [wiederholen, setWiederholen] = useState(false);
  const [tageVonHand, setTageVonHand] = useState(false);
  const [problem, setProblem] = useState<{ feld: SerieFeld; text: string } | null>(null);
  const [trainer, setTrainer] = useState<TrainerWert>(() => trainerVorwahl(mitglieder, ich));
  const [trainerFehler, setTrainerFehler] = useState<string>();
  const [besetzung, setBesetzung] = useState<BesetzungEingabe>(KEINE_BESETZUNG);
  const [besetzungFehler, setBesetzungFehler] = useState<string>();
  const platz = usePlatzAngaben();
  const [treffpunkt, setTreffpunkt] = useState<TrainingsTreffpunktEingabe>(null);
  // Ein Server-Fehler gilt für die Art, mit der gespeichert wurde; schaltet
  // der USER um, ist er verworfen — bis zum nächsten Speichern.
  const [verworfen, setVerworfen] = useState<string | undefined>();
  const fehlerAnzeigen = serverFehler && serverFehler !== verworfen ? serverFehler : undefined;

  // Beim Öffnen leeren — der Dialog überlebt sonst mit den Werten des letzten
  // Termins.
  useEffect(() => {
    if (!open) return;
    setF(LEER);
    setArt(null);
    setArtFehler(false);
    spiel.zuruecksetzen();
    setWiederholen(false);
    setTageVonHand(false);
    setProblem(null);
    setTrainer(trainerVorwahl(mitglieder, ich));
    setTrainerFehler(undefined);
    setBesetzung(KEINE_BESETZUNG);
    setBesetzungFehler(undefined);
    platz.zuruecksetzen();
    setTreffpunkt(null);
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

  function artGewaehlt(a: TerminArt) {
    setArt(a);
    setArtFehler(false);
    setProblem(null);
    setVerworfen(serverFehler);
    if (a === "spiel") setWiederholen(false);
  }

  /** Genau eine Verantwortliche (#519 AK 3) — sonst der Satz am Feld. */
  function trainerPruefen(): TrainerFestlegen | null {
    const v = trainer.verantwortlich;
    setTrainerFehler(v ? undefined : TRAINER_TEXT.verantwortlichPflicht);
    // #521 AK 5: eine ganze Zahl von 1 bis 99.
    const m = besetzungAusEingabe(besetzung);
    setBesetzungFehler(m.ok ? undefined : m.text);
    return v && m.ok ? { eingeladene: trainer.eingeladene, verantwortlich: v, mindestbesetzung: m.wert } : null;
  }

  function speichern() {
    if (!art) {
      setArtFehler(true);
      return;
    }
    if (art === "spiel") return speichereSpiel();
    // Felder und Spielerzahl prüfen beide Arten gleich.
    const angaben = platz.pruefe();
    const besetzung = trainerPruefen();
    // #561: Der Treffpunkt zum Beginn im Dialog; entfiele er, gibt es keinen.
    const tp = treffpunktAusEingabe(treffpunkt, f.beginn) ?? null;
    if (wiederholen) {
      const p = serieProblem({ ...f, treffpunkt: tp });
      setProblem(p);
      if (!p && angaben && besetzung) senden({ art: "serie", felder: { ...f, ...angaben, ...besetzung, treffpunkt: tp } });
      return;
    }
    const felder: TerminFelder = {
      art: "training",
      datum: f.von,
      beginn: f.beginn,
      ende: f.ende,
      ort: f.ort,
      ortLink: f.ortLink,
      bemerkung: f.bemerkung,
      hinweisEltern: f.hinweisEltern,
      treffpunkt: tp,
      ...angaben,
    };
    const p = terminProblem(felder);
    // Das Datum heisst in beiden Fällen `von` — so steht ein Fehler am selben Feld.
    setProblem(p && { feld: p.feld === "datum" ? "von" : p.feld, text: p.text });
    if (!p && angaben && besetzung) {
      const begonnen = terminBegonnen(f.von, f.beginn);
      senden({ art: "einzeln", felder, trainer: besetzung, kaderIds: begonnen ? [] : f.kaderIds });
    }
  }

  /** Ein Spiel: Bezeichnung und Richtwert statt Feldern und Spielerzahl, nur
   *  einzeln, mit bevorstehendem Anpfiff. */
  function speichereSpiel() {
    const felder: TerminFelder = {
      art: "spiel",
      datum: f.von,
      beginn: f.beginn,
      ende: f.ende,
      ort: f.ort,
      ortLink: f.ortLink,
      bemerkung: f.bemerkung,
      hinweisEltern: f.hinweisEltern,
    };
    const p = terminProblem(felder);
    setProblem(p && { feld: p.feld === "datum" ? "von" : p.feld, text: p.text });
    const angaben = spiel.pruefe();
    const besetzung = trainerPruefen();
    if (p || !angaben || !besetzung) return;
    if (terminBegonnen(f.von, f.beginn)) {
      setProblem({ feld: "beginn", text: SPIEL_MELDUNG.SPIEL_ANPFIFF_VERGANGEN });
      return;
    }
    senden({ art: "einzeln", felder: { ...felder, ...angaben }, trainer: besetzung, kaderIds: f.kaderIds });
  }

  const istSpiel = art === "spiel";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Termin erstellen"
      breit
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" onClick={speichern} disabled={pending}>Erstellen</Button>
        </>
      }
    >
      {fehlerAnzeigen && <SectionMessage appearance="error" className="mb-4">{fehlerAnzeigen}</SectionMessage>}
      <div className="flex flex-col gap-4">
        {/* Die Art wie die Wochentage: Name in der Schrift der Feldnamen, die
            Wahl auf ihrer Linie (px-3.5). Der feste Hinweis steht hinter dem ⓘ. */}
        <fieldset>
          <legend className={cn(feldNameKlasse(artFehler), "flex w-full items-center justify-between")}>
            Art
            <InfoKnopf label="Art">Die Art lässt sich danach nicht mehr ändern.</InfoKnopf>
          </legend>
          <ChoiceChipGroup ariaLabel="Art des Termins" className="mt-1.5 px-3.5">
            {(["training", "spiel"] as const).map((a, i) => (
              <ChoiceChip key={a} look="nutzertext" tabStop={i === 0 && !art} selected={art === a} onSelect={() => artGewaehlt(a)}>
                {a === "training" ? "Training" : "Spiel"}
              </ChoiceChip>
            ))}
          </ChoiceChipGroup>
          {artFehler && <p role="alert" className="mt-1 px-3.5 type-body-small text-error">{SPIEL_TEXT.artWaehlen}</p>}
        </fieldset>
        {istSpiel && <BezeichnungFeld angaben={spiel} disabled={pending} />}
        <DateField
          label={wiederholen ? "Beginndatum" : "Datum"}
          value={f.von}
          onChange={(e) => datumGewaehlt(e.target.value)}
          error={!!fehlerAn("von")}
          supportingText={fehlerAn("von")}
        />
        <div className="flex flex-col gap-4 sm:flex-row">
          <TimeField label={istSpiel ? "Anpfiff" : "Beginn"} className="flex-1" value={f.beginn} onChange={(e) => setze("beginn", e.target.value)} error={!!fehlerAn("beginn")} supportingText={fehlerAn("beginn")} />
          <TimeField label="Ende" className="flex-1" value={f.ende} onChange={(e) => setze("ende", e.target.value)} error={!!fehlerAn("ende")} supportingText={fehlerAn("ende")} />
        </div>
        {!istSpiel && (
          <Checkbox label="Wiederholender Termin" className="self-start px-3.5" checked={wiederholen} onChange={(e) => wiederholenGewaehlt(e.target.checked)} />
        )}
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
        <OrtFelder
          ort={f.ort}
          ortLink={f.ortLink}
          // #533 AK 4: Ohne Ort kein Kartenlink — ein geleerter Ort nimmt ihn mit.
          onOrt={(v) => setF((x) => ({ ...x, ort: v, ...(v.trim() === "" ? { ortLink: "" } : {}) }))}
          onOrtLink={(v) => setze("ortLink", v)}
          fehlerOrt={fehlerAn("ort")}
          fehlerLink={fehlerAn("ortLink")}
        />
        {!istSpiel && (
          <TreffpunktFelder
            wert={treffpunkt}
            onChange={(w) => {
              setTreffpunkt(w);
              if (problem?.feld === "treffpunkt") setProblem(null);
            }}
            beginn={f.beginn}
            fehler={fehlerAn("treffpunkt")}
            disabled={pending}
          />
        )}
        {istSpiel && <RichtwertFelder angaben={spiel} disabled={pending} />}
        {istSpiel && <MeldefristFelder angaben={spiel} disabled={pending} />}
        {istSpiel && <TreffpunkteFelder angaben={spiel} spieltag={f.von} disabled={pending} />}
        <TextArea label="Hinweis für Eltern (optional)" rows={3} maxLength={HINWEIS_ELTERN_MAX} value={f.hinweisEltern} onChange={(e) => setze("hinweisEltern", e.target.value)} info={TERMIN_TEXT.hinweisElternSichtbar} infoAufTouch error={!!fehlerAn("hinweisEltern")} supportingText={fehlerAn("hinweisEltern")} />
        <TextArea label="Bemerkung (optional)" rows={3} maxLength={BEMERKUNG_MAX} value={f.bemerkung} onChange={(e) => setze("bemerkung", e.target.value)} info={TERMIN_TEXT.bemerkungIntern} error={!!fehlerAn("bemerkung")} supportingText={fehlerAn("bemerkung")} />
        {(kader.length > 0 || !istSpiel) && (
          <FormAbschnitt titel="Spieler:innen" untertitel="Für wen der Termin gilt und mit wie vielen gerechnet wird." imDialog>
            {kader.length > 0 && (
              <KaderWahl
                kader={kader}
                spielerGesamt={spielerGesamt}
                wert={f.kaderIds}
                onChange={(ids) => setze("kaderIds", ids)}
                // Kader gelten nur an anstehenden Terminen (#453 AK 1); eine Serie legt nur anstehende an.
                begonnen={!wiederholen && !!f.von && !!f.beginn && terminBegonnen(f.von, f.beginn)}
                disabled={pending}
              />
            )}
            {/* Ein einzelner Termin, der schon begonnen hat, nimmt die erwartete Zahl an (Migration spielerliste). */}
            {!istSpiel && (
              <SpielerzahlField
                {...platz.spielerzahlProps}
                disabled={pending}
                ausListe={!!fuehrtListe && (wiederholen || !f.von || !f.beginn || !terminBegonnen(f.von, f.beginn))}
              />
            )}
          </FormAbschnitt>
        )}
        <FormAbschnitt titel="Trainer:innen" untertitel={TRAINER_TEXT.eingeladenHinweis} imDialog>
          <TrainerWahl
            mitglieder={mitglieder}
            ich={ich}
            wert={trainer}
            onChange={(w) => {
              setTrainer(w);
              setTrainerFehler(undefined);
            }}
            fehler={trainerFehler}
            disabled={pending}
          />
          <MindestbesetzungFeld
            wert={besetzung}
            onChange={(w) => {
              setBesetzung(w);
              setBesetzungFehler(undefined);
            }}
            // AK 14: die Spielerzahl, für die der Termin bzw. die Serie gilt.
            spielerzahl={
              fuehrtListe
                ? giltFuerAnzahl(f.kaderIds, kader, spielerGesamt)
                : platz.spielerzahlProps.wert.trim() === "" || istSpiel
                  ? null
                  : Number(platz.spielerzahlProps.wert)
            }
            spielerWort={fuehrtListe ? "angemeldeten" : "erwarteten"}
            fehler={besetzungFehler}
            disabled={pending}
          />
        </FormAbschnitt>
        {!istSpiel && (
          <div className="border-t border-linie pt-4">
            <FelderField {...platz.felderProps} disabled={pending} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
