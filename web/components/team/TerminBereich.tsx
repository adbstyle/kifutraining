"use client";

import { createContext, useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { EntfallendBestaetigung } from "./EntfallendBestaetigung";
import { ReichweiteDialog } from "./ReichweiteDialog";
import { SerieDialog } from "./SerieDialog";
import { TerminDialog } from "./TerminDialog";
import { TrainingWahlDialog, type TrainingWahl } from "./TrainingWahlDialog";
import {
  aendereSerieAktion,
  aendereTerminAktion,
  entferneSerieAktion,
  entferneTerminAktion,
  folgeDerSerieAktion,
  legeSerieFestAktion,
  legeTerminFestAktion,
  loeseTrainingAktion,
  ordneTrainingZuAktion,
  vorschauSerieAktion,
  vorschauSerieEntfernenAktion,
  type TerminFelder,
} from "@/lib/actions/termine";
import { geaenderteFelder, ZUORDNEN_ERFOLG } from "@/lib/termin";
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
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Alle Aktionen am Kalender eines Teams an einer Stelle (Team-Kalender
   #322, #323). Die Liste und — ab Teil F — der Monatsüberblick rufen
   dieselben Funktionen auf, damit ein Termin in beiden Ansichten dieselben
   Aktionen bietet (#329 AK 8). */
export type TerminAktionen = {
  neu: (datum?: string) => void;
  neueSerie: (datum?: string) => void;
  bearbeiten: (t: TerminZeile) => void;
  zuordnen: (t: TerminZeile) => void;
  loesen: (t: TerminZeile) => void;
  entfernen: (t: TerminZeile) => void;
  pending: boolean;
};

const Kontext = createContext<TerminAktionen | null>(null);

export function useTerminAktionen(): TerminAktionen {
  const k = useContext(Kontext);
  if (!k) throw new Error("useTerminAktionen ausserhalb von <TerminBereich>");
  return k;
}

/** Die Werte, mit denen der Änderungs-Dialog öffnet — auch die Vergleichsbasis
 *  für `geaenderteFelder`. */
function startWerte(t: TerminZeile): TerminFelder {
  return { datum: t.datum, beginn: t.beginn ?? "", ende: t.ende ?? "", ort: t.ort ?? "", bemerkung: t.bemerkung ?? "" };
}

type Serienweit = Exclude<Reichweite, "nur_dieser">;
type SerienArt = "aendern" | "entfernen";

const JEDE_REICHWEITE: readonly Reichweite[] = ["nur_dieser", "dieser_und_folgende", "alle"];

const FOLGT_WIEDER: Record<FolgeAngabe, string> = {
  zeit: "Die Zeit folgt wieder der Serie.",
  ort: "Der Ort folgt wieder der Serie.",
  bemerkung: "Die Bemerkung folgt wieder der Serie.",
  verantwortliche: "Die Verantwortlichen folgen wieder der Serie.",
};

/** Die offene Frage nach der Reichweite (#326 AK 1–4, 7). Beim Ändern stehen
 *  die geänderten Felder für «nur dieser» (`geaendert`, wie beim einzelnen
 *  Termin) und die Änderung für die Serie (`aenderung`, ohne Datum) bereit. */
type ReichweiteFrage = {
  art: SerienArt;
  t: TerminZeile;
  erlaubt: readonly Reichweite[];
  hinweis?: string;
  geaendert?: Partial<TerminFelder> | null;
  aenderung?: SerienAenderung;
};

/** Eine gerechnete Vorschau, die auf Bestätigung oder Ausführung wartet. */
type SerienSchritt = {
  art: SerienArt;
  t: TerminZeile;
  reichweite: Serienweit;
  aenderung?: SerienAenderung;
  folge: SerienFolge;
};

export function TerminBereich({
  teamId,
  trainings,
  heute,
  children,
}: {
  teamId: string;
  trainings: TeamTrainingRow[];
  heute: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [neu, setNeu] = useState<string | null>(null); // Vorbelegtes Datum; "" = ohne
  const [serieNeu, setSerieNeu] = useState<string | null>(null); // Vorbelegtes Beginndatum; "" = ohne
  const [bearbeiten, setBearbeiten] = useState<TerminZeile | null>(null);
  const [zuordnen, setZuordnen] = useState<TerminZeile | null>(null);
  const [entfernen, setEntfernen] = useState<TerminZeile | null>(null);
  const [reichweite, setReichweite] = useState<ReichweiteFrage | null>(null);
  const [bestaetigen, setBestaetigen] = useState<SerienSchritt | null>(null);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();

  /** Eine Aktion ausführen. Bei Erfolg: schliessen, neu laden, melden.
   *
   *  Bei einem Fehler wird IMMER neu geladen, damit die Liste den Stand zeigt,
   *  gegen den die Aktion abgewiesen wurde. Ob der Dialog offen bleibt, hängt
   *  an `imDialog`: dann steht der Fehler im Dialog — ausser er sagt «seit der
   *  Auswahl geändert» (PO 17). Dann trägt die Auswahl veraltete Angaben
   *  (`erwartet`), ein erneuter Versuch scheiterte immer wieder; der Dialog
   *  schliesst, die Snackbar meldet, und man öffnet die aufgefrischte Karte. */
  function lauf<T extends { ok: boolean; error?: string }>(
    aufruf: () => Promise<T>,
    erfolg: (r: T) => string,
    schliessen: () => void,
    imDialog = false,
  ) {
    startTransition(async () => {
      const r = await aufruf();
      router.refresh();
      if (!r.ok && imDialog && !istVeraltet(r.error)) {
        setDialogFehler(r.error ?? "Fehlgeschlagen.");
        return;
      }
      schliessen();
      setDialogFehler(undefined);
      melde(r.ok ? erfolg(r) : (r.error ?? "Fehlgeschlagen."));
    });
  }

  // ── Serientermine (#326) ──────────────────────────────────────────────────

  /** Die Nummer des laufenden Serien-Ablaufs. Öffnen und Abbrechen (Knopf,
   *  Escape, Klick daneben) zählen sie hoch; wer nach einem `await`
   *  weitermacht, prüft zuerst, ob seine Nummer noch gilt. Sonst liefe eine
   *  Vorschau, die der USER abgebrochen hat, trotzdem in die Bestätigung
   *  oder gleich ins Ausführen. Abbrechen lässt sich der Server-Aufruf nicht;
   *  die Transition endet mit seiner Antwort, `pending` bleibt nicht hängen. */
  const laufNr = useRef(0);
  const neuerLauf = () => ++laufNr.current;

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
      ? await aendereSerieAktion(b.t.id, b.reichweite, b.aenderung ?? {}, erwartet)
      : await entferneSerieAktion(b.t.id, b.reichweite, erwartet);
    if (!r.ok) return serienFehler(b.art, r.error, laufNr.current !== nr);
    router.refresh();
    serieSchliessen();
    melde(b.art === "aendern" ? "Terminserie geändert." : "Termine entfernt.");
  }

  /** Speichern im Termin-Dialog. Ein einzelner Termin geht direkt; ein
   *  Serientermin fragt erst, wofür die Änderung gilt. Gesendet wird in jedem
   *  Fall nur, was sich geändert hat (PO 17); nichts geändert: kein Aufruf. */
  function speichereBearbeitung(t: TerminZeile, f: TerminFelder, regel?: SerienRegel) {
    const geaendert = geaenderteFelder(f, startWerte(t));
    const regelNeu = t.serie && regel ? regelAenderung(t.serie, regel) : null;
    if (!geaendert && !regelNeu) {
      setBearbeiten(null);
      return;
    }
    if (!t.serie) {
      lauf(() => aendereTerminAktion(t.id, geaendert!, t.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null), true);
      return;
    }
    const datum = geaendert?.datum !== undefined;
    const erlaubt = erlaubteReichweiten({ datum, regel: !!regelNeu });
    // Der Dialog prüft das schon; hier nur als Rückhalt.
    if (!erlaubt) return setDialogFehler(SERIE_TEXT.datumUndRegel);
    const { datum: _datum, ...werte } = geaendert ?? {};
    setDialogFehler(undefined);
    neuerLauf();
    setReichweite({
      art: "aendern",
      t,
      erlaubt,
      hinweis: datum ? SERIE_MELDUNG.DATUM_NUR_EINZELN : regelNeu ? SERIE_MELDUNG.REGEL_NUR_SERIE : undefined,
      geaendert,
      aenderung: { ...werte, ...regelNeu },
    });
  }

  function reichweiteGewaehlt(r: Reichweite) {
    const frage = reichweite;
    if (!frage) return;
    const { art, t } = frage;
    if (r === "nur_dieser") {
      setReichweite(null);
      // Einzeln entfernen geht durch die Bestätigung aus Teil A: Sie nennt das
      // Training, das im Bestand bleibt (#322).
      if (art === "entfernen") return setEntfernen(t);
      if (!frage.geaendert) return;
      const geaendert = frage.geaendert;
      lauf(() => aendereTerminAktion(t.id, geaendert, t.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null), true);
      return;
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
      const schritt: SerienSchritt = { art, t, reichweite: r, aenderung: frage.aenderung, folge: v.folge };
      // AK 8: bestätigen, wenn Termine wegfallen — beim Entfernen immer.
      if (art === "entfernen" || v.folge.entfallendAnzahl > 0) setBestaetigen(schritt);
      else await fuehreAus(schritt, nr);
    });
  }

  const aktionen: TerminAktionen = {
    neu: (datum) => { setDialogFehler(undefined); setNeu(datum ?? ""); },
    neueSerie: (datum) => { setDialogFehler(undefined); setSerieNeu(datum ?? ""); },
    bearbeiten: (t) => { setDialogFehler(undefined); setBearbeiten(t); },
    zuordnen: (t) => { setDialogFehler(undefined); setZuordnen(t); },
    loesen: (t) =>
      t.training &&
      !pending &&
      lauf(() => loeseTrainingAktion(t.id, t.training!.id), () => `«${t.training!.name}» ist gelöst und bleibt im Team-Bestand.`, () => {}),
    entfernen: (t) => {
      setDialogFehler(undefined);
      if (t.serie) {
        neuerLauf();
        setReichweite({ art: "entfernen", t, erlaubt: JEDE_REICHWEITE });
      }
      else setEntfernen(t);
    },
    pending,
  };

  return (
    <Kontext.Provider value={aktionen}>
      {children}

      <TerminDialog
        open={neu !== null}
        titel="Termin festlegen"
        bestaetigung="Festlegen"
        start={{ datum: neu ?? "" }}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setNeu(null)}
        onSpeichern={(f: TerminFelder) =>
          lauf(() => legeTerminFestAktion(teamId, f), () => "Termin festgelegt.", () => setNeu(null), true)
        }
      />

      <SerieDialog
        open={serieNeu !== null}
        start={{ von: serieNeu ?? "" }}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setSerieNeu(null)}
        onSpeichern={(f) =>
          lauf(() => legeSerieFestAktion(teamId, f), () => "Terminserie festgelegt.", () => setSerieNeu(null), true)
        }
      />

      <TerminDialog
        open={bearbeiten !== null}
        titel="Termin ändern"
        bestaetigung="Speichern"
        start={bearbeiten ? startWerte(bearbeiten) : undefined}
        bisher={bearbeiten ? { beginn: bearbeiten.beginn, ende: bearbeiten.ende } : undefined}
        pending={pending}
        fehler={dialogFehler}
        serie={bearbeiten?.serie}
        serienTag={bearbeiten?.serienTag}
        abweichungen={bearbeiten?.abweichungen}
        onFolgen={(angabe) =>
          bearbeiten &&
          lauf(() => folgeDerSerieAktion(bearbeiten.id, [angabe]), () => FOLGT_WIEDER[angabe], () => setBearbeiten(null), true)
        }
        onClose={() => {
          // Nur ein Abbruch durch den USER zählt; schliesst der Code den
          // Dialog, ist `bearbeiten` schon leer (gilt für alle drei Dialoge).
          if (!bearbeiten) return;
          neuerLauf();
          setBearbeiten(null);
        }}
        onSpeichern={(f, regel) => bearbeiten && speichereBearbeitung(bearbeiten, f, regel)}
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
        heute={heute}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setZuordnen(null)}
        onWahl={(w: TrainingWahl) =>
          zuordnen &&
          lauf(
            () => ordneTrainingZuAktion({
              terminId: zuordnen.id,
              trainingId: w.trainingId,
              art: w.art,
              erwartet: { terminTraining: zuordnen.training?.id ?? null, trainingTermin: w.trainingTermin },
            }),
            (r) => ("kopie" in r && r.kopie ? ZUORDNEN_ERFOLG.kopie : ZUORDNEN_ERFOLG.direkt),
            () => setZuordnen(null),
            true,
          )
        }
      />

      <Dialog
        open={entfernen !== null}
        onClose={() => setEntfernen(null)}
        title="Termin entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setEntfernen(null)}>Abbrechen</Button>
            <Button
              variant="danger"
              disabled={pending}
              onClick={() =>
                entfernen &&
                lauf(() => entferneTerminAktion(entfernen.id, entfernen.training?.id ?? null), () => "Termin entfernt.", () => setEntfernen(null))
              }
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          Der Termin am {entfernen ? datumKurz(entfernen.datum) : ""} verschwindet aus dem Trainingsplan.
          {entfernen?.training && (
            <> <strong className="text-on-surface">{entfernen.training.name}</strong> bleibt ohne Termin im Team-Bestand.</>
          )}
        </p>
      </Dialog>
    </Kontext.Provider>
  );
}
