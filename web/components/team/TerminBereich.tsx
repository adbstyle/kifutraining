"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { AusfallDialog } from "./AusfallDialog";
import { EntfallendBestaetigung } from "./EntfallendBestaetigung";
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
import { uebernehmenKoennen, type TerminTrainer } from "@/lib/trainer";
import type { TrainerAenderung } from "./TrainerWahl";
import {
  aendereSerieAktion,
  aendereTerminAktion,
  entferneSerieAktion,
  entferneTerminAktion,
  folgeDerSerieAktion,
  lasseAusfallenAktion,
  legeSerieFestAktion,
  legeTerminFestAktion,
  loeseTrainingAktion,
  nimmAusfallZurueckAktion,
  ordneTrainingZuAktion,
  aendereTrainerAktion,
  setzeAbsageAktion,
  vorschauSerieAktion,
  vorschauSerieEntfernenAktion,
  type TerminFelder,
} from "@/lib/actions/termine";
import { geaenderteFelder, trainingOhneTermin, ZUORDNEN_ERFOLG } from "@/lib/termin";
import {
  SERIE_MELDUNG,
  SERIE_TEXT,
  erlaubteReichweiten,
  regelAenderung,
  type Reichweite,
  type SerienRegel,
} from "@/lib/serie";
import type { FolgeAngabe, SerienAenderung, SerienFolge } from "@/lib/kern/serien";
import { istVeraltet } from "@/lib/veraltet";
import { datumKurz, terminBegonnen } from "@/lib/zeit";
import { setzeTerminKaderAktion } from "@/lib/actions/kader";
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
};

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
  children: React.ReactNode;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<TerminZeile | null>(null);
  const [zuordnen, setZuordnen] = useState<TerminZeile | null>(null);
  const [entfernen, setEntfernen] = useState<TerminZeile | null>(null);
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
  const [reichweite, setReichweite] = useState<ReichweiteFrage | null>(null);
  const [bestaetigen, setBestaetigen] = useState<SerienSchritt | null>(null);
  /** Eine Verlegung oder eine Änderung an Kadern liesse Abmeldungen
   *  verfallen (#437 AK 1, #453 AK 10): die Rückfrage samt Fortsetzung. */
  const verfall = useVerfallRueckfrage(pending);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();
  /** Die Verantwortliche sagt ab: Wer übernimmt (#520 AK 4, 19)? */
  const [absage, setAbsage] = useState<{ t: TerminZeile; wer: TerminTrainer } | null>(null);

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
   *  Ein geänderter Ausfallgrund (#402 AK 13) folgt als letzter Schritt. */
  function aendereEinzeln(
    t: TerminZeile,
    geaendert: Partial<TerminFelder> | null | undefined,
    trainer?: TrainerAenderung,
    grund?: string,
    bestaetigt: number | false = false,
    kaderIds?: string[],
    kaderBestaetigt: number | false = false,
  ) {
    const nr = laufNr.current;
    const gilt = () => laufNr.current === nr;
    startTransition(async () => {
      if (geaendert) {
        const r = await aendereTerminAktion(t.id, geaendert, t.training?.id ?? null, bestaetigt);
        // #437 AK 1: Verfallen Abmeldungen, erst nachfragen; der Dialog bleibt offen.
        // Ein Spiel fragt auch, wenn nur die Frist ins Abgelaufene rückt (#463 AK 26).
        if (!r.ok && (r.verfallend || r.fristAbgelaufen)) {
          const anzahl = r.verfallend ?? 0;
          if (gilt())
            return verfall.nachVerlegung({ ...r, verfallend: anzahl }, () =>
              aendereEinzeln(t, geaendert, trainer, grund, anzahl, kaderIds),
            );
          // Abgebrochen, bevor die Rückfrage kam: Gespeichert ist nichts.
          return melde(NICHT_GEAENDERT);
        }
        if (!r.ok) return einzelnGescheitert(r.error, gilt());
      }
      if (trainer) {
        if (geaendert && !gilt()) {
          router.refresh();
          return melde(NUR_FELDER_GEAENDERT);
        }
        const { einladen, ausladen, ausladenEintraege, verantwortlich } = trainer;
        const v = await aendereTrainerAktion(
          t.id,
          { einladen, ausladen, ausladenEintraege, verantwortlich },
          t.serie ? "nur_dieser" : undefined,
        );
        if (!v.ok) return einzelnGescheitert(v.error, gilt(), geaendert ? NUR_FELDER_GEAENDERT : undefined);
      }
      if (kaderIds) {
        const davor = geaendert || trainer ? KADER_UNVERAENDERT : undefined;
        if (davor && !gilt()) {
          router.refresh();
          return melde(davor);
        }
        const k = await setzeTerminKaderAktion(t.id, kaderIds, kaderBestaetigt);
        // #453 AK 10, 12: Verfallen Abmeldungen, erst nachfragen — mit dem aktuellen Stand.
        if (!k.ok && k.verfallend) {
          if (davor) router.refresh();
          if (gilt()) {
            verfall.nachKader(k, kaderBestaetigt, (n) => aendereEinzeln(t, null, undefined, grund, false, kaderIds, n));
            return;
          }
          return melde(davor ?? NICHT_GEAENDERT);
        }
        if (!k.ok) return einzelnGescheitert(k.error, gilt(), davor);
      }
      if (grund !== undefined) {
        const vorher = geaendert || trainer ? GRUND_UNVERAENDERT : undefined;
        if (vorher && !gilt()) {
          router.refresh();
          return melde(vorher);
        }
        const g = await lasseAusfallenAktion(t.id, grund, true);
        if (!g.ok) return einzelnGescheitert(g.error, gilt(), vorher);
      }
      router.refresh();
      if (gilt()) {
        setBearbeiten(null);
        setDialogFehler(undefined);
      }
      melde("Termin geändert.");
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
      ? await aendereSerieAktion(b.t.id, b.reichweite, b.aenderung ?? {}, {
          ...erwartet,
          verfallend:
            b.folge.abmeldungenVerfallend + b.folge.abmeldungenKader + b.folge.nachtraegeVerfallend + b.folge.absagenVerfallend,
        })
      : await entferneSerieAktion(b.t.id, b.reichweite, erwartet);
    if (!r.ok) return serienFehler(b.art, r.error, laufNr.current !== nr);
    // Der Grund gilt nur für diesen Termin (#402 PC 4); er folgt der Serie nicht.
    const g = b.grund !== undefined ? await lasseAusfallenAktion(b.t.id, b.grund, true) : null;
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
    regel?: SerienRegel,
    trainer?: TrainerAenderung,
    grund?: string,
    kaderIds?: string[],
  ) {
    const geaendert = geaenderteFelder(f, startWerte(t));
    const regelNeu = t.serie && regel ? regelAenderung(t.serie, regel) : null;
    if (!geaendert && !regelNeu && !trainer && !kaderIds) {
      if (grund === undefined) return setBearbeiten(null);
      // Nur der Grund: Er gilt für diesen Termin, eine Reichweite gibt es nicht (#402 PC 4).
      return lauf(() => lasseAusfallenAktion(t.id, grund, true), () => "Grund gespeichert.", () => setBearbeiten(null), true, laufNr.current);
    }
    if (!t.serie) return aendereEinzeln(t, geaendert, trainer, grund, false, kaderIds);
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
      return aendereEinzeln(t, frage.geaendert, frage.trainer, frage.grund, false, frage.kader);
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
      const schritt: SerienSchritt = { art, t, reichweite: r, aenderung: frage.aenderung, folge: v.folge, grund: frage.grund };
      // AK 8: bestätigen, wenn Termine wegfallen — beim Entfernen immer; ebenso,
      // wenn Abmeldungen verfallen (#437 AK 1).
      if (
        art === "entfernen" ||
        v.folge.entfallendAnzahl > 0 ||
        v.folge.abmeldungenVerfallend > 0 ||
        v.folge.abmeldungenKader > 0 ||
        v.folge.nachtraegeVerfallend > 0 ||
        v.folge.absagenVerfallend > 0
      )
        setBestaetigen(schritt);
      else await fuehreAus(schritt, nr);
    });
  }

  /** Eine Angabe wieder der Serie folgen lassen (#326 AK 6). Folgt die Zeit
   *  und verfallen damit Abmeldungen, erst nachfragen (#437 AK 1). */
  function folgen(t: TerminZeile, angabe: FolgeAngabe, bestaetigt: boolean | number = false) {
    lauf(
      () => folgeDerSerieAktion(t.id, [angabe], bestaetigt),
      () => FOLGT_WIEDER[angabe],
      () => setBearbeiten(null),
      true,
      laufNr.current,
      (r) => {
        // #453: Folgen die Kader, bestätigt die Zahl (erst `false`, dann die
        // gemeldete); die Zeit bestätigt `true`.
        if (angabe === "kader")
          return verfall.nachKader(r, typeof bestaetigt === "number" ? bestaetigt : false, (n) => folgen(t, angabe, n));
        if (r.ok || !r.verfallend) return false;
        verfall.nachVerlegung({ ...r, verfallend: r.verfallend }, () => folgen(t, angabe, true));
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
      lauf(() => nimmAusfallZurueckAktion(t.id), () => "Ausfall zurückgenommen.", () => {});
    },
    trainer: (t, aenderung, meldung) => {
      if (pending) return;
      lauf(() => aendereTrainerAktion(t.id, aenderung, t.serie ? "nur_dieser" : undefined), () => meldung, () => {});
    },
    absagen: (t, wer, abgesagt) => {
      if (pending || !wer.userId) return;
      if (abgesagt && wer.verantwortlich) return setAbsage({ t, wer });
      sageAb(t, wer, abgesagt);
    },
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
          gesehen: { datum: t.datum, beginn: t.beginn, verantwortlich: t.trainer.find((x) => x.verantwortlich)?.userId ?? null },
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
                () => legeTerminFestAktion(teamId, { ...t.felder, mindestbesetzung: t.trainer.mindestbesetzung }, t.kaderIds, t.trainer),
                () => "Termin erstellt.",
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
        onFolgen={(angabe) => bearbeiten && folgen(bearbeiten, angabe)}
        onClose={() => {
          // Nur ein Abbruch durch den USER zählt; schliesst der Code den
          // Dialog, ist `bearbeiten` schon leer (gilt für alle drei Dialoge).
          if (!bearbeiten) return;
          neuerLauf();
          setBearbeiten(null);
        }}
        onSpeichern={(f, regel, trainer, grund, kaderIds) =>
          bearbeiten && speichereBearbeitung(bearbeiten, f, regel, trainer, grund, kaderIds)
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
        pending={pending}
        onClose={() => setAbsage(null)}
        onAbsagen={(uebernimmt) => absage && sageAb(absage.t, absage.wer, true, uebernimmt)}
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
        onBestaetigen={() => {
          const b = bestaetigen;
          const nr = laufNr.current;
          if (b) startTransition(() => fuehreAus(b, nr));
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
        pending={pending}
        fehler={dialogFehler}
        onClose={() => {
          if (!ausfall) return;
          neuerLauf();
          setAusfall(null);
        }}
        onSpeichern={(grund) => {
          const t = ausfall;
          if (!t) return;
          // Der Grund geht immer als Text mit; «» leert ihn (ausdrücklich «Grund setzen»).
          lauf(
            () => lasseAusfallenAktion(t.id, grund, t.ausgefallen),
            () => (t.ausgefallen ? "Grund gespeichert." : "Termin als ausgefallen markiert."),
            () => setAusfall(null),
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
                  () => entferneTerminAktion(entfernen.id, entfernen.training?.id ?? null, entfernenZahl),
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
