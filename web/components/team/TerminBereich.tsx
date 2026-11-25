"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { AusfallDialog } from "./AusfallDialog";
import { AusfallZuruecknehmenDialog } from "./AusfallZuruecknehmenDialog";
import { EntfallendBestaetigung } from "./EntfallendBestaetigung";
import { useBenachrichtigen } from "./BenachrichtigenFeld";
import { ReichweiteDialog } from "./ReichweiteDialog";
import { useVerfallRueckfrage } from "./VerfallBestaetigung";
import { NeuerTerminDialog } from "./NeuerTerminDialog";
import { spielEntfernenText } from "@/lib/spiel";
import { TerminDialog } from "./TerminDialog";
import { TrainingWahlDialog } from "./TrainingWahlDialog";
import { angezeigteSpielerzahl } from "@/lib/besetzung";
import { spielerzahlVon } from "@/lib/spieler";
import { AbsageDialog } from "./AbsageDialog";
import { terminHref } from "@/lib/team-ansicht";
import { absageOffen, gesehenVon, istEingeladen, mitAbsicht, uebernehmenKoennen, type Eingrenzung, type StandAbsicht, type TerminTrainer } from "@/lib/trainer";
import type { TrainerAenderung } from "./TrainerWahl";
import {
  aendereSerieAktion,
  aendereTerminAktion,
  entferneSerieAktion,
  entferneTerminAktion,
  folgeDerSerieAktion,
  lasseAusfallenAktion,
  legeSerieFestAktion,
  holeVerlegungNachAktion,
  legeTerminFestAktion,
  loeseTrainingAktion,
  nimmAusfallZurueckAktion,
  ordneTrainingZuAktion,
  aendereTrainerAktion,
  helfeAusAktion,
  setzeAbsageAktion,
  vorschauSerieAktion,
  vorschauSerieEntfernenAktion,
  type TerminFelder,
} from "@/lib/actions/termine";
import { AUSFALL_ZURUECKNEHMEN_TEXT, geaenderteFelder, LINK_KANAL, trainingOhneTermin, ZUORDNEN_ERFOLG } from "@/lib/termin";
import {
  SERIE_MELDUNG,
  SERIE_TEXT,
  erlaubteReichweiten,
  regelAenderung,
  verfallSumme,
  type Reichweite,
  type SerienRegel,
} from "@/lib/serie";
import type { FolgeAngabe, SerienAenderung, SerienFolge } from "@/lib/kern/serien";
import { istVeraltet } from "@/lib/veraltet";
import { datumKurz, terminBegonnen } from "@/lib/zeit";
import { setzeTerminKaderAktion } from "@/lib/actions/kader";
import { BENACHRICHTIGEN_TEXT, benachrichtigungZaehlt } from "@/lib/benachrichtigung";
import type { AusstehendeVerlegung } from "@/lib/kern/benachrichtigungen";
import type { Kader } from "@/lib/kader";
import type { TeamTrainingRow, TrainingListRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";
import type { TeamMitglied } from "@/lib/queries/teams";

/* Alle Aktionen am Kalender eines Teams an einer Stelle (Team-Kalender
   #322, #323). Die Zeilen der Liste und der nächste Termin rufen dieselben
   Funktionen auf, damit jeder Termin dieselben Handgriffe bietet (#401). */
export type TerminAktionen = {
  /** Einen Termin oder eine Terminserie erstellen. */
  neu: () => void;
  bearbeiten: (t: TerminZeile) => void;
  zuordnen: (t: TerminZeile) => void;
  loesen: (t: TerminZeile) => void;
  entfernen: (t: TerminZeile) => void;
  /** Ausfall markieren oder, bei einem ausgefallenen Termin, den Grund ändern (#327). */
  ausfallen: (t: TerminZeile) => void;
  ausfallZuruecknehmen: (t: TerminZeile) => void;
  /** Trainer:innen dieses einen Termins ändern (#519 AK 5–10, 25): auch an
   *  einem Serientermin nur an ihm; `meldung` sagt die Snackbar. */
  trainer: (t: TerminZeile, aenderung: TrainerEinzeln, meldung: string) => void;
  /** Eine Eingeladene für diesen Termin absagen oder wieder zusagen (#520
   *  AK 1, 18); sagt die Verantwortliche ab, fragt erst «wer übernimmt?». */
  absagen: (t: TerminZeile, wer: TerminTrainer, abgesagt: boolean) => void;
  /** Der Termin mit dem eigenen Stand, wie man ihn zuletzt gesetzt hat —
   *  bis der Server ihn bestätigt (#691 NFR 1). Plan und Reiter lesen jeden
   *  Termin hierdurch, damit Schalter, Zahl und Lücke übereinstimmen. */
  stand: (t: TerminZeile) => TerminZeile;
  /** Den eigenen Stand umlegen (#691 AK 3): dabei, abgesagt oder aushelfen.
   *  Still und ohne Sperre, je Termin der Reihe nach; eine Abweisung zeigt
   *  danach den geltenden Stand (PC 3). Die Verantwortliche wählt beim
   *  Absagen, wer übernimmt (AK 4). */
  schalten: (t: TerminZeile, dabei: boolean) => void;
  /** Unter «Meine Termine» abgesagte Termine, die bis zum Wechsel der
   *  Eingrenzung stehen bleiben (#691 PC 2). */
  gehalten: TerminZeile[];
  /** Das eigene Konto. */
  ich: string;
  pending: boolean;
  /** Das Team führt Kader (#453). */
  mitKadern: boolean;
};

/** Eine Änderung an den Trainer:innen eines Termins, als Differenz. */
export type TrainerEinzeln = { einladen?: string[]; ausladen?: string[]; ausladenEintraege?: string[]; verantwortlich?: string };

const Kontext = createContext<TerminAktionen | null>(null);

export function useTerminAktionen(): TerminAktionen {
  const k = useContext(Kontext);
  if (!k) throw new Error("useTerminAktionen ausserhalb von <TerminBereich>");
  return k;
}

/** Die Werte, mit denen der Änderungs-Dialog öffnet — auch die Vergleichsbasis
 *  für `geaenderteFelder`. */
function startWerte(t: TerminZeile): TerminFelder {
  return {
    art: t.art,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ort: t.ort ?? "",
    ortLink: t.ortLink ?? "",
    bemerkung: t.bemerkung ?? "",
    hinweisEltern: t.hinweisEltern ?? "",
    // Ein Training (#561): der Treffpunkt zum Beginn; ein Spiel hat keinen.
    ...(t.spiel ? {} : { treffpunkt: t.treffpunkt }),
    felder: t.felder,
    spielerzahl: t.spielerzahl,
    mindestbesetzung: t.mindestbesetzung,
    // Ein Spiel (#459): Bezeichnung und Richtwert statt Feldern und Zahl.
    ...(t.spiel
      ? {
          bezeichnung: t.spiel.bezeichnung,
          richtwertMin: t.spiel.richtwertMin,
          richtwertMax: t.spiel.richtwertMax,
          meldefrist: t.spiel.meldefrist,
          treffpunkte: t.spiel.treffpunkte,
        }
      : {}),
  };
}

type Serienweit = Exclude<Reichweite, "nur_dieser">;
type SerienArt = "aendern" | "entfernen";

const JEDE_REICHWEITE: readonly Reichweite[] = ["nur_dieser", "dieser_und_folgende", "alle"];

const FOLGT_WIEDER: Record<FolgeAngabe, string> = {
  zeit: "Die Zeit folgt wieder der Serie.",
  ort: "Der Ort folgt wieder der Serie.",
  bemerkung: "Die Bemerkung folgt wieder der Serie.",
  hinweis_eltern: `Der ${LINK_KANAL.hinweis} folgt wieder der Serie.`,
  treffpunkt: "Der Treffpunkt folgt wieder der Serie.",
  eingeladene: "Die Eingeladenen folgen wieder der Serie.",
  verantwortung: "Die Verantwortung folgt wieder der Serie.",
  besetzung: "Die Mindestbesetzung folgt wieder der Serie.",
  felder: "Die Felder folgen wieder der Serie.",
  spielerzahl: "Die erwartete Spielerzahl folgt wieder der Serie.",
  kader: "Die Kader folgen wieder der Serie.",
};

/** Die offene Frage nach der Reichweite (#326 AK 1–4, 7). Beim Ändern stehen
 *  die geänderten Felder und Trainer:innen für «nur dieser» (`geaendert`,
 *  `trainer`, wie beim einzelnen Termin) und die Änderung für die Serie
 *  (`aenderung`, ohne Datum, die Eingeladenen als ganze Liste) bereit. */
type ReichweiteFrage = {
  art: SerienArt;
  t: TerminZeile;
  erlaubt: readonly Reichweite[];
  hinweis?: string;
  geaendert?: Partial<TerminFelder> | null;
  trainer?: TrainerAenderung;
  /** Die geänderten Kader (#453), für «nur dieser». */
  kader?: string[];
  aenderung?: SerienAenderung;
  /** Der geänderte Ausfallgrund — er gilt nur für diesen Termin (#402 PC 4). */
  grund?: string;
  /** Nur beim Ändern: der Entscheid des Häkchens im Termin-Dialog (#644),
   *  für «nur dieser» und die Serie. Beim Entfernen fällt er erst in der
   *  Bestätigung (#645 AK 1). */
  benachrichtigen?: boolean;
};

/** Die Felder sind gespeichert, die Trainer:innen nicht — weil der USER
 *  zwischen den beiden Schritten abbrach oder der zweite scheiterte (#519). */
const NUR_FELDER_GEAENDERT = "Termin geändert. Die Trainer:innen blieben unverändert.";
/** Dasselbe für den Ausfallgrund, den letzten Schritt (#402 AK 13). */
const GRUND_UNVERAENDERT = "Termin geändert. Der Grund des Ausfalls blieb unverändert.";
/** Dasselbe für die Kader (#453). */
const KADER_UNVERAENDERT = "Termin geändert. Die Kader blieben unverändert.";
/** Die Verlegung liesse Abmeldungen verfallen, die Rückfrage kam nicht mehr zum Zug (#437). */
const NICHT_GEAENDERT = "Termin nicht geändert.";

/** Eine gerechnete Vorschau, die auf Bestätigung oder Ausführung wartet. */
type SerienSchritt = {
  art: SerienArt;
  t: TerminZeile;
  reichweite: Serienweit;
  aenderung?: SerienAenderung;
  folge: SerienFolge;
  grund?: string;
  /** Wie in `ReichweiteFrage`; beim Entfernen aus der Bestätigung. */
  benachrichtigen?: boolean;
};

/** Ein einzelner Termin nach seinem ersten Schritt (#644): Die Verlegung
 *  wartet auf die Kader (`ausstehend`, PC 1), oder ihre Benachrichtigung ist
 *  nicht entstanden (`fehlt`). */
type NachFeldern = { ausstehend: AusstehendeVerlegung | null; fehlt: boolean };

export function TerminBereich({
  teamId,
  trainings,
  persoenliche,
  mitglieder,
  ich,
  heute,
  fuehrtListe,
  kader = [],
  spielerGesamt = 0,
  eingrenzung = null,
  children,
}: {
  teamId: string;
  trainings: TeamTrainingRow[];
  /** Die eigenen persönlichen Trainings des USERS (#328). */
  persoenliche: TrainingListRow[];
  /** Wer als Trainer:in zur Wahl steht (#519). */
  mitglieder: TeamMitglied[];
  /** Das eigene Konto: beim Festlegen verantwortlich vorgewählt (#519 AK 4). */
  ich: string;
  heute: string;
  /** Das Team führt eine Spielerliste (#434). */
  fuehrtListe: boolean;
  /** Die Kader des Teams (#453) und wie viele Spieler:innen die Liste führt. */
  kader?: Kader[];
  spielerGesamt?: number;
  /** Die Eingrenzung des Plans (#518 PO 12): Unter «Meine Termine» bleiben
   *  abgesagte Termine stehen, bis sie wechselt (#691 PC 2). */
  eingrenzung?: Eingrenzung | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<TerminZeile | null>(null);
  const [zuordnen, setZuordnen] = useState<TerminZeile | null>(null);
  const [entfernen, setEntfernen] = useState<TerminZeile | null>(null);
  // #645 AK 1: der Entscheid im Entfernen-Dialog, beim Öffnen vorbelegt an; er
  // bleibt über die Rückfrage zu verschwindenden Meldungen erhalten. Nur ein
  // Termin von heute oder später, der nicht ausgefallen ist (Prinzipien 1, 2).
  const entfernenBenachrichtigen = useBenachrichtigen("entfernen", {
    offen: entfernen,
    sichtbar: !!entfernen && !entfernen.ausgefallen && benachrichtigungZaehlt(entfernen.datum, heute),
    pending,
  });
  // Ein Spiel (#463 AK 27, #464 AK 10): wie viele Meldungen und
  // Kennzeichnungen mit ihm verschwinden — aus dem Plan, oder der aktuelle
  // Stand, wenn er sich inzwischen geändert hat.
  const [verschwindend, setVerschwindend] = useState<{ meldungen: number; kennzeichnungen: number } | null>(null);
  const meldungenVon = (t: TerminZeile) => ({
    meldungen: t.spiel ? (t.spielstand?.meldungen ?? 0) : 0,
    kennzeichnungen: t.spiel ? (t.spielstand?.nicht_aufgeboten ?? 0) : 0,
  });
  const entfernenStand = entfernen ? (verschwindend ?? meldungenVon(entfernen)) : { meldungen: 0, kennzeichnungen: 0 };
  const entfernenZahl = entfernenStand.meldungen + entfernenStand.kennzeichnungen;
  const [loesen, setLoesen] = useState<TerminZeile | null>(null);
  const [ausfall, setAusfall] = useState<TerminZeile | null>(null);
  const [ruecknahme, setRuecknahme] = useState<TerminZeile | null>(null);
  const [reichweite, setReichweite] = useState<ReichweiteFrage | null>(null);
  const [bestaetigen, setBestaetigen] = useState<SerienSchritt | null>(null);
  /** Eine Verlegung oder eine Änderung an Kadern liesse Abmeldungen
   *  verfallen (#437 AK 1, #453 AK 10): die Rückfrage samt Fortsetzung. */
  const verfall = useVerfallRueckfrage(pending);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();
  /** Die Verantwortliche sagt ab: Wer übernimmt (#520 AK 4, 19)? `still`:
   *  vom eigenen Schalter (#691), `melden`: mit Snackbar (Reiter). */
  const [absage, setAbsage] = useState<{ t: TerminZeile; wer: TerminTrainer; still?: { melden: boolean } } | null>(null);

  // ── Der eigene Stand per Schalter (#691) ─────────────────────────────────
  // Die Absicht je Termin liegt über den Daten des Servers, bis keine
  // Änderung mehr läuft und das Neuladen danach fertig ist; dann zeigt der
  // Termin wieder den Server — nach einer Abweisung den geltenden Stand.
  // Je Termin laufen die Aufrufe der Reihe nach (`kette`), über Termine
  // hinweg ohne gemeinsame Sperre.
  const ichName = mitglieder.find((m) => m.userId === ich)?.anzeigeName ?? null;
  const [absichten, setAbsichten] = useState<Record<string, StandAbsicht>>({});
  const [gehalten, setGehalten] = useState<Record<string, TerminZeile>>({});
  const offen = useRef(new Map<string, number>());
  const kette = useRef(new Map<string, Promise<void>>());
  const [aktualisiert, startAktualisieren] = useTransition();
  const warAktualisiert = useRef(false);
  useEffect(() => {
    if (aktualisiert) {
      warAktualisiert.current = true;
      return;
    }
    if (!warAktualisiert.current) return;
    warAktualisiert.current = false;
    setAbsichten((alt) => {
      const bleiben = Object.entries(alt).filter(([id]) => (offen.current.get(id) ?? 0) > 0);
      return bleiben.length === Object.keys(alt).length ? alt : Object.fromEntries(bleiben);
    });
  }, [aktualisiert]);
  // PC 2: Ein Wechsel der Eingrenzung zeigt den Plan neu (PO 2026-11-24).
  const [gehaltenFuer, setGehaltenFuer] = useState(eingrenzung);
  if (gehaltenFuer !== eingrenzung) {
    setGehaltenFuer(eingrenzung);
    setGehalten({});
  }

  const stand = (t: TerminZeile) => mitAbsicht(t, ich, ichName, absichten[t.id]);

  /** Den eigenen Stand am (schon überlagerten) Termin umlegen. Welcher Aufruf
   *  läuft, entscheidet der angezeigte Stand beim Klick; `gesehen` kommt
   *  daraus, damit ein Folgeklick nach einer Übergabe nicht veraltet ist. */
  function schalteJetzt(t: TerminZeile, ziel: StandAbsicht["ziel"], uebernimmt?: string, melden = false) {
    const eingeladen = istEingeladen(t.trainer, ich);
    if (ziel === "abgesagt" && !eingeladen) return;
    const absicht: StandAbsicht = { ziel, am: new Date().toISOString(), uebernimmt };
    setAbsichten((alt) => ({ ...alt, [t.id]: absicht }));
    // Festgehalten mit der Absage: Auch wenn die Absicht nach dem Neuladen
    // wegfällt und der Server den Termin nicht mehr liefert, zeigt die Zeile
    // den geltenden Stand (PC 2).
    if (ziel === "abgesagt" && eingrenzung === "dabei")
      setGehalten((alt) => ({ ...alt, [t.id]: mitAbsicht(t, ich, ichName, absicht) }));
    const aufruf = eingeladen
      ? () =>
          setzeAbsageAktion({
            terminId: t.id,
            userId: ich,
            abgesagt: ziel === "abgesagt",
            uebernimmt,
            gesehen: gesehenVon(t),
          })
      : () => helfeAusAktion(t.id);
    offen.current.set(t.id, (offen.current.get(t.id) ?? 0) + 1);
    const vorher = kette.current.get(t.id) ?? Promise.resolve();
    const jetzt = vorher
      .then(aufruf)
      .then((r) => {
        // Abgewiesen: Die festgehaltene Zeile trüge einen Stand, den es nicht
        // gibt — sie fällt mit dem Neuladen weg, der Server zeigt den geltenden.
        if (!r.ok) setGehalten((alt) => (t.id in alt ? Object.fromEntries(Object.entries(alt).filter(([id]) => id !== t.id)) : alt));
        if (melden) melde(r.ok ? (ziel === "abgesagt" ? "Du hast abgesagt." : "Du bist wieder dabei.") : (r.error ?? "Fehlgeschlagen."));
      })
      .catch(() => {})
      .finally(() => {
        const rest = (offen.current.get(t.id) ?? 1) - 1;
        offen.current.set(t.id, rest);
        if (rest === 0) {
          kette.current.delete(t.id);
          startAktualisieren(() => router.refresh());
        }
      });
    kette.current.set(t.id, jetzt);
  }

  function schalten(t: TerminZeile, dabei: boolean, melden = false) {
    // Die Uhr beim Klick: Was inzwischen begonnen hat, bleibt, wie es ist.
    if (!absageOffen(t, terminBegonnen(t.datum, t.beginn))) return;
    const wer = t.trainer.find((x) => x.userId === ich);
    if (!dabei && wer?.verantwortlich) return setAbsage({ t, wer, still: { melden } });
    schalteJetzt(t, dabei ? "dabei" : "abgesagt", undefined, melden);
  }

  /** Die Nummer des laufenden Ablaufs in einem Dialog. Öffnen und Abbrechen
   *  (Knopf, Escape, Klick daneben) zählen sie hoch; wer nach einem `await`
   *  weitermacht, prüft zuerst, ob seine Nummer noch gilt. Sonst liefe eine
   *  Vorschau, die der USER abgebrochen hat, trotzdem in die Bestätigung
   *  oder gleich ins Ausführen, und ein spätes Ergebnis schlösse einen
   *  inzwischen neu geöffneten Dialog oder schriebe seinen Fehler hinein.
   *  Abbrechen lässt sich der Server-Aufruf nicht; die Transition endet mit
   *  seiner Antwort, `pending` bleibt nicht hängen. */
  const laufNr = useRef(0);
  const neuerLauf = () => ++laufNr.current;

  /** Eine Aktion ausführen. Bei Erfolg: schliessen, neu laden, melden.
   *
   *  Bei einem Fehler wird IMMER neu geladen, damit die Liste den Stand zeigt,
   *  gegen den die Aktion abgewiesen wurde. Ob der Dialog offen bleibt, hängt
   *  an `imDialog`: dann steht der Fehler im Dialog — ausser er sagt «seit der
   *  Auswahl geändert» (PO 17). Dann trägt die Auswahl veraltete Angaben
   *  (`erwartet`), ein erneuter Versuch scheiterte immer wieder; der Dialog
   *  schliesst, die Snackbar meldet, und man öffnet die aufgefrischte Karte.
   *
   *  Mit `nr` (siehe `laufNr`): Gilt die Nummer nach dem Aufruf nicht mehr,
   *  bleiben die Dialoge unberührt, und nur die Snackbar sagt, was geschah.
   *
   *  `nachfrage`: fängt eine Antwort ab, die erst eine Bestätigung braucht
   *  (#437 AK 1) — dann bleibt alles, wie es ist. */
  function lauf<T extends { ok: boolean; error?: string }>(
    aufruf: () => Promise<T>,
    erfolg: (r: T) => string,
    schliessen: () => void,
    imDialog = false,
    nr?: number,
    nachfrage?: (r: T) => boolean,
  ) {
    startTransition(async () => {
      const r = await aufruf();
      if ((nr === undefined || laufNr.current === nr) && nachfrage?.(r)) return;
      router.refresh();
      if (nr !== undefined && laufNr.current !== nr) {
        melde(r.ok ? erfolg(r) : (r.error ?? "Fehlgeschlagen."));
        return;
      }
      if (!r.ok && imDialog && !istVeraltet(r.error)) {
        setDialogFehler(r.error ?? "Fehlgeschlagen.");
        return;
      }
      schliessen();
      setDialogFehler(undefined);
      melde(r.ok ? erfolg(r) : (r.error ?? "Fehlgeschlagen."));
    });
  }

  /** Einen Termin einzeln ändern — einen einzelnen oder einen Serientermin mit
   *  «nur dieser»: erst die Felder, dann die Trainer:innen (#519 AK 5–10).
   *  Jeder Aufruf läuft nur, wenn sich bei ihm etwas geändert hat (PO 17);
   *  scheitert der erste, läuft der zweite nicht. Hat der USER nach dem
   *  ersten abgebrochen, läuft der zweite auch nicht: Die Dialoge bleiben
   *  unberührt, die Snackbar sagt, dass nur die Felder gespeichert sind.
   *  Die Kader (#453) folgen den Trainer:innen; lassen sie Abmeldungen
   *  verfallen, fragt der Ablauf nach und setzt danach mit den Kadern fort.
   *  Ein geänderter Ausfallgrund (#402 AK 13) folgt als letzter Schritt.
   *  Folgen auf eine Verlegung die Kader, kommt ihre Benachrichtigung erst
   *  nach ihnen, für die neuen Kader (#644 PC 1); ohne gesetzte Kader keine.
   *  Ist eine Benachrichtigung nicht entstanden, sagt das jede Meldung dazu. */
  function aendereEinzeln(
    t: TerminZeile,
    geaendert: Partial<TerminFelder> | null | undefined,
    trainer: TrainerAenderung | undefined,
    grund: string | undefined,
    benachrichtigen: boolean,
    bestaetigt: number | false = false,
    kaderIds?: string[],
    kaderBestaetigt: number | false = false,
    /** Die Fortsetzung nach der Kader-Rückfrage trägt mit, was der erste
     *  Schritt hinterliess. */
    nachFeldern: NachFeldern = { ausstehend: null, fehlt: false },
  ) {
    const nr = laufNr.current;
    const gilt = () => laufNr.current === nr;
    startTransition(async () => {
      let { ausstehend, fehlt } = nachFeldern;
      const mitFehlt = (text: string) => (fehlt ? `${text} ${BENACHRICHTIGEN_TEXT.gescheitert}` : text);
      if (geaendert) {
        const r = await aendereTerminAktion(
          t.id,
          geaendert,
          t.training?.id ?? null,
          benachrichtigen,
          bestaetigt,
          kaderIds !== undefined,
        );
        // #437 AK 1: Verfallen Abmeldungen, erst nachfragen; der Dialog bleibt offen.
        // Ein Spiel fragt auch, wenn nur die Frist ins Abgelaufene rückt (#463 AK 26),
        // ein Training, wenn nur der Treffpunkt entfiele (#561 PC 5).
        if (!r.ok && (r.verfallend || r.fristAbgelaufen || r.treffpunktEntfaellt)) {
          const anzahl = r.verfallend ?? 0;
          if (gilt())
            return verfall.nachVerlegung({ ...r, verfallend: anzahl }, () =>
              aendereEinzeln(t, geaendert, trainer, grund, benachrichtigen, anzahl, kaderIds),
            );
          // Abgebrochen, bevor die Rückfrage kam: Gespeichert ist nichts.
          return melde(NICHT_GEAENDERT);
        }
        if (!r.ok) return einzelnGescheitert(r.error, gilt());
        ausstehend = r.ausstehend;
        fehlt = r.benachrichtigungFehlt;
      }
      if (trainer) {
        if (geaendert && !gilt()) {
          router.refresh();
          return melde(mitFehlt(NUR_FELDER_GEAENDERT));
        }
        const { einladen, ausladen, ausladenEintraege, verantwortlich } = trainer;
        const v = await aendereTrainerAktion(
          t.id,
          { einladen, ausladen, ausladenEintraege, verantwortlich },
          t.serie ? "nur_dieser" : undefined,
        );
        if (!v.ok) return einzelnGescheitert(v.error, gilt(), geaendert ? mitFehlt(NUR_FELDER_GEAENDERT) : undefined);
      }
      if (kaderIds) {
        const davor = geaendert || trainer ? mitFehlt(KADER_UNVERAENDERT) : undefined;
        if (davor && !gilt()) {
          router.refresh();
          return melde(davor);
        }
        const k = await setzeTerminKaderAktion(t.id, kaderIds, kaderBestaetigt);
        // #453 AK 10, 12: Verfallen Abmeldungen, erst nachfragen — mit dem aktuellen Stand.
        if (!k.ok && k.verfallend) {
          if (davor) router.refresh();
          if (gilt()) {
            verfall.nachKader(k, kaderBestaetigt, (n) =>
              aendereEinzeln(t, null, undefined, grund, benachrichtigen, false, kaderIds, n, { ausstehend, fehlt }),
            );
            return;
          }
          return melde(davor ?? NICHT_GEAENDERT);
        }
        if (!k.ok) return einzelnGescheitert(k.error, gilt(), davor);
        if (ausstehend) {
          const b = await holeVerlegungNachAktion(ausstehend);
          fehlt = !b.ok || b.benachrichtigungFehlt;
        }
      }
      if (grund !== undefined) {
        const vorher = geaendert || trainer ? mitFehlt(GRUND_UNVERAENDERT) : undefined;
        if (vorher && !gilt()) {
          router.refresh();
          return melde(vorher);
        }
        // Nur der Grund eines ausgefallenen Termins: bleibt still (#643 OoS 1).
        const g = await lasseAusfallenAktion(t.id, grund, true, false);
        if (!g.ok) return einzelnGescheitert(g.error, gilt(), vorher);
      }
      router.refresh();
      if (gilt()) {
        setBearbeiten(null);
        setDialogFehler(undefined);
      }
      melde(mitFehlt("Termin geändert."));
    });
  }

  /** Ein Fehler beim einzelnen Ändern, wie in `lauf`: Im noch offenen Dialog
   *  steht er dort, ausser er ist veraltet (PO 17) — dann schliessen und
   *  melden. Abgebrochen: nur melden. War ein früherer Schritt schon
   *  gespeichert, sagt `gespeichert` das vor dem Fehler. */
  function einzelnGescheitert(fehler: string, gilt: boolean, gespeichert?: string) {
    router.refresh();
    const text = gespeichert ? `${gespeichert} ${fehler}` : fehler;
    if (gilt && !istVeraltet(fehler)) return setDialogFehler(text);
    if (gilt) {
      setBearbeiten(null);
      setDialogFehler(undefined);
    }
    melde(text);
  }

  // ── Serientermine (#326) ──────────────────────────────────────────────────

  function serieSchliessen() {
    setReichweite(null);
    setBestaetigen(null);
    setBearbeiten(null);
    setDialogFehler(undefined);
  }

  /** Ein Fehler aus Vorschau oder Ausführung. Veraltet (PO 17, AK 9) —
   *  etwa eine inzwischen geänderte Serie: alles schliessen und melden, der
   *  Plan ist schon neu geladen. Sonst bleibt beim Ändern der Termin-Dialog
   *  offen und zeigt den Grund (etwa eine Regel, die erst mit der Reichweite
   *  feststeht); beim Entfernen gibt es keinen Dialog, der ihn trüge. */
  function serienFehler(art: SerienArt, fehler: string, abgebrochen = false) {
    router.refresh();
    if (abgebrochen || art === "entfernen" || istVeraltet(fehler)) {
      serieSchliessen();
      melde(fehler);
      return;
    }
    setReichweite(null);
    setBestaetigen(null);
    setDialogFehler(fehler);
  }

  /** Ausführen mit dem, was die Vorschau sah: die Version der Serie und die
   *  entfallenden Termine mit Training (PO 17, AK 9). Wurde währenddessen
   *  abgebrochen, ist die Änderung trotzdem geschehen (oder gescheitert):
   *  Dann schliessen und in der Snackbar melden, was passiert ist. */
  async function fuehreAus(b: SerienSchritt, nr: number) {
    const erwartet = { version: b.folge.versionVorher, entfallend: b.folge.entfallend.map((e) => e.terminId) };
    const r = b.art === "aendern"
      ? await aendereSerieAktion(
          b.t.id,
          b.reichweite,
          b.aenderung ?? {},
          { ...erwartet, verfallend: verfallSumme(b.folge) },
          b.benachrichtigen === true,
        )
      : await entferneSerieAktion(b.t.id, b.reichweite, erwartet, b.benachrichtigen === true);
    if (!r.ok) return serienFehler(b.art, r.error, laufNr.current !== nr);
    // Der Grund gilt nur für diesen Termin (#402 PC 4); er folgt der Serie nicht.
    // Nur der Grund: bleibt still (#643 OoS 1).
    const g = b.grund !== undefined ? await lasseAusfallenAktion(b.t.id, b.grund, true, false) : null;
    router.refresh();
    serieSchliessen();
    melde(b.art === "aendern" ? `Terminserie geändert.${g && !g.ok ? ` ${g.error}` : ""}` : "Termine entfernt.");
  }

  /** Speichern im Termin-Dialog. Ein einzelner Termin geht direkt; ein
   *  Serientermin fragt erst, wofür die Änderung gilt — auch, wenn sich nur
   *  die Trainer:innen geändert haben (#519 AK 12). Gesendet wird in jedem
   *  Fall nur, was sich geändert hat (PO 17); nichts geändert: kein Aufruf.
   *  `trainer` kommt nur, wenn sich die Wahl geändert hat. */
  function speichereBearbeitung(
    t: TerminZeile,
    f: TerminFelder,
    regel: SerienRegel | undefined,
    trainer: TrainerAenderung | undefined,
    grund: string | undefined,
    kaderIds: string[] | undefined,
    benachrichtigen: boolean,
  ) {
    const geaendert = geaenderteFelder(f, startWerte(t));
    const regelNeu = t.serie && regel ? regelAenderung(t.serie, regel) : null;
    if (!geaendert && !regelNeu && !trainer && !kaderIds) {
      if (grund === undefined) return setBearbeiten(null);
      // Nur der Grund: Er gilt für diesen Termin, eine Reichweite gibt es nicht
      // (#402 PC 4); er bleibt still (#643 OoS 1).
      return lauf(() => lasseAusfallenAktion(t.id, grund, true, false), () => "Grund gespeichert.", () => setBearbeiten(null), true, laufNr.current);
    }
    if (!t.serie) return aendereEinzeln(t, geaendert, trainer, grund, benachrichtigen, false, kaderIds);
    const datum = geaendert?.datum !== undefined;
    const namenlose = !!trainer?.nurNamenlose;
    const erlaubt = erlaubteReichweiten({ datum, regel: !!regelNeu, namenlose });
    // Der Dialog prüft das schon; hier nur als Rückhalt.
    if (!erlaubt) return setDialogFehler(datum ? SERIE_TEXT.datumUndRegel : SERIE_TEXT.namenloseUndRegel);
    // Felder und Spielerzahl gehen wie Ort und Bemerkung mit (#391 AK 2).
    const { datum: _datum, ...werte } = geaendert ?? {};
    setDialogFehler(undefined);
    neuerLauf();
    setReichweite({
      art: "aendern",
      t,
      erlaubt,
      hinweis: datum
        ? SERIE_MELDUNG.DATUM_NUR_EINZELN
        : namenlose
          ? SERIE_TEXT.namenloseNurEinzeln
          : regelNeu
            ? SERIE_MELDUNG.REGEL_NUR_SERIE
            : undefined,
      geaendert,
      trainer,
      kader: kaderIds,
      grund,
      benachrichtigen,
      // Für folgende und alle gehen die Trainer:innen mit der übrigen
      // Änderung in EINE Serienänderung (#519 AK 12). Die Serienrechnung
      // ersetzt damit an jedem erfassten Termin ALLE Eingeladenen durch diese
      // Konten, auch die namenlosen gelöschter Konten. Ändern sich allein
      // diese, bleibt darum nur «nur dieser» (`namenlose`).
      aenderung: {
        ...werte,
        ...regelNeu,
        // Nur aktuelle Mitglieder: Ehemalige eines vergangenen Termins lassen sich nicht neu einladen (#519 AK 11).
        ...(trainer?.eingeladene && { eingeladene: trainer.eingeladene.filter((u) => mitglieder.some((m) => m.userId === u)) }),
        ...(trainer?.verantwortlich && { verantwortlich: trainer.verantwortlich }),
        ...(kaderIds && { kaderIds }),
      },
    });
  }

  function reichweiteGewaehlt(r: Reichweite) {
    const frage = reichweite;
    if (!frage) return;
    const { art, t } = frage;
    if (r === "nur_dieser") {
      setReichweite(null);
      // Einzeln entfernen geht durch die Bestätigung aus Teil A: Sie sagt, was
      // mit dem Training geschieht (#322; PO 2026-10-06).
      if (art === "entfernen") return setEntfernen(t);
      if (!frage.geaendert && !frage.trainer && !frage.kader) return;
      return aendereEinzeln(t, frage.geaendert, frage.trainer, frage.grund, frage.benachrichtigen === true, false, frage.kader);
    }
    const version = t.serie?.version ?? 0;
    const nr = laufNr.current;
    startTransition(async () => {
      const v = art === "aendern"
        ? await vorschauSerieAktion(t.id, r, frage.aenderung ?? {}, version)
        : await vorschauSerieEntfernenAktion(t.id, r, version);
      // Abgebrochen, während die Vorschau lief: nichts mehr tun.
      if (laufNr.current !== nr) return;
      if (!v.ok) return serienFehler(art, v.error);
      setReichweite(null);
      const schritt: SerienSchritt = { art, t, reichweite: r, aenderung: frage.aenderung, folge: v.folge, grund: frage.grund, benachrichtigen: frage.benachrichtigen };
      // AK 8: bestätigen, wenn Termine wegfallen — beim Entfernen immer; ebenso,
      // wenn Abmeldungen verfallen (#437 AK 1) oder Treffpunkte entfallen (#561 PC 5).
      if (art === "entfernen" || v.folge.entfallendAnzahl > 0 || verfallSumme(v.folge) > 0)
        setBestaetigen(schritt);
      else await fuehreAus(schritt, nr);
    });
  }

  /** Eine Angabe wieder der Serie folgen lassen (#326 AK 6). Folgt die Zeit
   *  und verfallen damit Abmeldungen, erst nachfragen (#437 AK 1). */
  function folgen(t: TerminZeile, angabe: FolgeAngabe, benachrichtigen: boolean, bestaetigt: boolean | number = false) {
    lauf(
      () => folgeDerSerieAktion(t.id, [angabe], benachrichtigen, bestaetigt),
      () => FOLGT_WIEDER[angabe],
      () => setBearbeiten(null),
      true,
      laufNr.current,
      (r) => {
        // #453: Folgen die Kader, bestätigt die Zahl (erst `false`, dann die
        // gemeldete); die Zeit bestätigt `true`.
        if (angabe === "kader")
          return verfall.nachKader(r, typeof bestaetigt === "number" ? bestaetigt : false, (n) => folgen(t, angabe, benachrichtigen, n));
        if (r.ok || (!r.verfallend && !r.treffpunktEntfaellt)) return false;
        verfall.nachVerlegung({ ...r, verfallend: r.verfallend ?? 0 }, () => folgen(t, angabe, benachrichtigen, true));
        return true;
      },
    );
  }

  function loeseSofort(t: TerminZeile) {
    const training = t.training;
    if (!training) return;
    lauf(
      () => loeseTrainingAktion(t.id, training.id),
      () => `«${training.name}» ist gelöst und ${trainingOhneTermin(training.terminTraining)}.`,
      () => setLoesen(null),
    );
  }

  const aktionen: TerminAktionen = {
    neu: () => { neuerLauf(); setDialogFehler(undefined); setNeu(true); },
    bearbeiten: (t) => { neuerLauf(); setDialogFehler(undefined); setBearbeiten(t); },
    // Einem ausgefallenen Termin lässt sich kein Training zuordnen (#327 AK 9).
    zuordnen: (t) => { if (t.ausgefallen) return; neuerLauf(); setDialogFehler(undefined); setZuordnen(t); },
    // Ein Termin-Training geht beim Lösen verloren: erst nachfragen. Ein
    // Training aus dem Bestand bleibt dort — das löst sofort (PO 2026-10-06).
    loesen: (t) => {
      if (!t.training || pending) return;
      if (t.training.terminTraining) return setLoesen(t);
      loeseSofort(t);
    },
    entfernen: (t) => {
      setDialogFehler(undefined);
      if (t.serie) {
        neuerLauf();
        setReichweite({ art: "entfernen", t, erlaubt: JEDE_REICHWEITE });
      }
      else setEntfernen(t);
    },
    ausfallen: (t) => { neuerLauf(); setDialogFehler(undefined); setAusfall(t); },
    ausfallZuruecknehmen: (t) => {
      if (pending) return;
      // Heute oder später: erst der Dialog mit dem Entscheid (#643 AK 1);
      // ein vergangener Termin benachrichtigt nie, dort bleibt es ein Klick.
      if (benachrichtigungZaehlt(t.datum, heute)) {
        neuerLauf();
        setDialogFehler(undefined);
        return setRuecknahme(t);
      }
      lauf(() => nimmAusfallZurueckAktion(t.id, false), () => AUSFALL_ZURUECKNEHMEN_TEXT.erfolg, () => {});
    },
    trainer: (t, aenderung, meldung) => {
      if (pending) return;
      lauf(() => aendereTrainerAktion(t.id, aenderung, t.serie ? "nur_dieser" : undefined), () => meldung, () => {});
    },
    absagen: (t, wer, abgesagt) => {
      // Der eigene Stand im Reiter läuft mit dem Schalter der Zeile in einer
      // Reihe (#691), mit Snackbar wie bisher.
      if (wer.userId === ich) return schalten(stand(t), !abgesagt, true);
      if (pending || !wer.userId) return;
      if (abgesagt && wer.verantwortlich) return setAbsage({ t, wer });
      sageAb(t, wer, abgesagt);
    },
    stand,
    schalten: (t, dabei) => schalten(t, dabei),
    gehalten: Object.values(gehalten),
    ich,
    pending,
    mitKadern: kader.length > 0,
  };

  /** Absagen mit dem, was die Oberfläche zeigte (AK 10). */
  function sageAb(t: TerminZeile, wer: TerminTrainer, abgesagt: boolean, uebernimmt?: string) {
    const selbst = wer.userId === ich;
    const name = wer.name ?? "Die Trainer:in";
    const meldung = abgesagt
      ? selbst ? "Du hast abgesagt." : `${name} hat abgesagt.`
      : selbst ? "Du bist wieder dabei." : `${name} ist wieder dabei.`;
    lauf(
      () =>
        setzeAbsageAktion({
          terminId: t.id,
          userId: wer.userId!,
          abgesagt,
          uebernimmt,
          gesehen: gesehenVon(t),
        }),
      () => meldung,
      () => setAbsage(null),
    );
  }

  return (
    <Kontext.Provider value={aktionen}>
      {children}

      <NeuerTerminDialog
        open={neu}
        pending={pending}
        fehler={dialogFehler}
        mitglieder={mitglieder}
        ich={ich}
        fuehrtListe={fuehrtListe}
        kader={kader}
        spielerGesamt={spielerGesamt}
        onClose={() => {
          if (!neu) return;
          neuerLauf();
          setNeu(false);
        }}
        onSpeichern={(t) =>
          t.art === "serie"
            ? lauf(() => legeSerieFestAktion(teamId, t.felder), () => "Terminserie erstellt.", () => setNeu(false), true, laufNr.current)
            : lauf(
                () =>
                  legeTerminFestAktion(teamId, { ...t.felder, mindestbesetzung: t.trainer.mindestbesetzung }, t.kaderIds, t.trainer, t.benachrichtigen),
                // Das Spiel steht; nur die Benachrichtigung ist nicht entstanden (#642).
                (r) => (r.ok && r.benachrichtigungFehlt ? `Termin erstellt. ${BENACHRICHTIGEN_TEXT.gescheitert}` : "Termin erstellt."),
                () => setNeu(false),
                true,
                laufNr.current,
              )
        }
      />

      <TerminDialog
        open={bearbeiten !== null}
        start={bearbeiten ? startWerte(bearbeiten) : undefined}
        pending={pending}
        fehler={dialogFehler}
        serie={bearbeiten?.serie}
        serienTag={bearbeiten?.serienTag}
        abweichungen={bearbeiten?.abweichungen}
        mitglieder={mitglieder}
        ich={ich}
        trainer={bearbeiten?.trainer}
        spielerzahlAktuell={bearbeiten ? angezeigteSpielerzahl(spielerzahlVon(bearbeiten)) : null}
        ausfall={bearbeiten?.ausgefallen ? { grund: bearbeiten.ausfallGrund } : null}
        heute={heute}
        fuehrtListe={fuehrtListe}
        kader={kader}
        terminKader={bearbeiten?.kader}
        spielerGesamt={spielerGesamt}
        begonnen={!!bearbeiten && terminBegonnen(bearbeiten.datum, bearbeiten.beginn)}
        onFolgen={(angabe, benachrichtigen) => bearbeiten && folgen(bearbeiten, angabe, benachrichtigen)}
        onClose={() => {
          // Nur ein Abbruch durch den USER zählt; schliesst der Code den
          // Dialog, ist `bearbeiten` schon leer (gilt für alle drei Dialoge).
          if (!bearbeiten) return;
          neuerLauf();
          setBearbeiten(null);
        }}
        onSpeichern={(f, regel, trainer, grund, kaderIds, benachrichtigen) =>
          bearbeiten && speichereBearbeitung(bearbeiten, f, regel, trainer, grund, kaderIds, benachrichtigen)
        }
      />

      <AbsageDialog
        frage={
          absage && {
            datum: absage.t.datum,
            art: absage.t.art,
            wer: absage.wer,
            andere: uebernehmenKoennen(absage.t.trainer, absage.wer.userId!),
          }
        }
        ich={ich}
        pending={!absage?.still && pending}
        onClose={() => setAbsage(null)}
        onAbsagen={(uebernimmt) => {
          if (!absage) return;
          if (!absage.still) return sageAb(absage.t, absage.wer, true, uebernimmt);
          setAbsage(null);
          schalteJetzt(absage.t, "abgesagt", uebernimmt, absage.still.melden);
        }}
        onEinladen={() => {
          if (!absage) return;
          setAbsage(null);
          router.push(terminHref(teamId, null, absage.t.id, "trainer"), { scroll: false });
        }}
      />

      <ReichweiteDialog
        open={reichweite !== null}
        titel={reichweite?.art === "entfernen" ? "Termin entfernen" : "Termin ändern"}
        erlaubt={reichweite?.erlaubt ?? JEDE_REICHWEITE}
        hinweis={reichweite?.hinweis}
        pending={pending}
        onClose={() => {
          if (!reichweite) return;
          neuerLauf();
          setReichweite(null);
        }}
        onWahl={reichweiteGewaehlt}
      />

      {verfall.dialog}

      <EntfallendBestaetigung
        folge={bestaetigen?.folge ?? null}
        aktion={bestaetigen?.art ?? "aendern"}
        pending={pending}
        onClose={() => {
          if (!bestaetigen) return;
          neuerLauf();
          setBestaetigen(null);
        }}
        onBestaetigen={(benachrichtigen) => {
          const b = bestaetigen;
          const nr = laufNr.current;
          // Beim Entfernen entscheidet dieser Dialog (#645 AK 1); beim Ändern
          // galt der Entscheid des Termin-Dialogs schon (#644), auch für den
          // Wegfall (#645 PC 3).
          if (b) startTransition(() => fuehreAus(b.art === "entfernen" ? { ...b, benachrichtigen } : b, nr));
        }}
      />

      <TrainingWahlDialog
        termin={zuordnen}
        trainings={trainings}
        persoenliche={persoenliche}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => {
          if (!zuordnen) return;
          neuerLauf();
          setZuordnen(null);
        }}
        onWahl={(trainingId) =>
          zuordnen &&
          lauf(
            () => ordneTrainingZuAktion({
              terminId: zuordnen.id,
              trainingId,
              erwartet: { trainingAmTermin: zuordnen.training?.id ?? null },
            }),
            () => ZUORDNEN_ERFOLG,
            () => setZuordnen(null),
            true,
            laufNr.current,
          )
        }
      />

      <AusfallDialog
        termin={ausfall}
        heute={heute}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => {
          if (!ausfall) return;
          neuerLauf();
          setAusfall(null);
        }}
        onSpeichern={(grund, benachrichtigen) => {
          const t = ausfall;
          if (!t) return;
          // Der Grund geht immer als Text mit; «» leert ihn (ausdrücklich «Grund setzen»).
          lauf(
            () => lasseAusfallenAktion(t.id, grund, t.ausgefallen, benachrichtigen),
            (r) =>
              t.ausgefallen
                ? "Grund gespeichert."
                : // Der Ausfall steht; nur die Benachrichtigung ist nicht entstanden (#643).
                  `Termin als ausgefallen markiert.${r.ok && r.benachrichtigungFehlt ? ` ${BENACHRICHTIGEN_TEXT.gescheitert}` : ""}`,
            () => setAusfall(null),
            true,
            laufNr.current,
          );
        }}
      />

      <AusfallZuruecknehmenDialog
        termin={ruecknahme}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => {
          if (!ruecknahme) return;
          neuerLauf();
          setRuecknahme(null);
        }}
        onZuruecknehmen={(benachrichtigen) => {
          const t = ruecknahme;
          if (!t) return;
          lauf(
            () => nimmAusfallZurueckAktion(t.id, benachrichtigen),
            (r) =>
              `${AUSFALL_ZURUECKNEHMEN_TEXT.erfolg}${r.ok && r.benachrichtigungFehlt ? ` ${BENACHRICHTIGEN_TEXT.gescheitert}` : ""}`,
            () => setRuecknahme(null),
            true,
            laufNr.current,
          );
        }}
      />

      <Dialog
        open={entfernen !== null}
        onClose={() => {
          setEntfernen(null);
          setVerschwindend(null);
        }}
        title={entfernen?.spiel ? "Spiel entfernen?" : "Termin entfernen?"}
        actions={
          <>
            <Button variant="outlined" onClick={() => {
              setEntfernen(null);
              setVerschwindend(null);
            }}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                entfernen &&
                lauf(
                  () =>
                    entferneTerminAktion(
                      entfernen.id,
                      entfernen.training?.id ?? null,
                      entfernenBenachrichtigen.wert,
                      entfernenZahl,
                    ),
                  () => (entfernen.spiel ? "Spiel entfernt." : "Termin entfernt."),
                  () => {
                    setEntfernen(null);
                    setVerschwindend(null);
                  },
                  false,
                  undefined,
                  // Inzwischen andere Meldungen: die Rückfrage mit dem aktuellen Stand.
                  (r) => {
                    if (r.ok || r.verschwindend === undefined) return false;
                    const k = r.kennzeichnungen ?? 0;
                    setVerschwindend({ meldungen: r.verschwindend - k, kennzeichnungen: k });
                    return true;
                  },
                )
              }
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          {entfernen?.spiel
            ? `Das Spiel «${entfernen.spiel.bezeichnung}» am ${datumKurz(entfernen.datum)} verschwindet aus dem Trainingsplan. ${spielEntfernenText(entfernenStand.meldungen, entfernenStand.kennzeichnungen)}`
            : `Der Termin am ${entfernen ? datumKurz(entfernen.datum) : ""} verschwindet aus dem Trainingsplan.`}
          {entfernen?.training && (
            <> <strong className="text-on-surface">{entfernen.training.name}</strong> {trainingOhneTermin(entfernen.training.terminTraining)}.</>
          )}
        </p>
        {entfernenBenachrichtigen.feld}
      </Dialog>

      {/* Lösen eines Termin-Trainings löscht es — darum diese Rückfrage. */}
      <Dialog
        open={loesen !== null}
        onClose={() => setLoesen(null)}
        title="Training lösen?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setLoesen(null)}>Abbrechen</Button>
            <Button variant="danger" disabled={pending} onClick={() => loesen && loeseSofort(loesen)}>
              Lösen und löschen
            </Button>
          </>
        }
      >
        <p>
          <strong className="text-on-surface">{loesen?.training?.name}</strong> wird gelöscht — es gehört nur zu diesem
          Termin. Der Termin am {loesen ? datumKurz(loesen.datum) : ""} bleibt ohne Training im Trainingsplan.
        </p>
      </Dialog>
    </Kontext.Provider>
  );
}
