"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TerminDialog } from "./TerminDialog";
import { TrainingWahlDialog, type TrainingWahl } from "./TrainingWahlDialog";
import {
  aendereTerminAktion,
  entferneTerminAktion,
  legeTerminFestAktion,
  loeseTrainingAktion,
  ordneTrainingZuAktion,
  type TerminFelder,
} from "@/lib/actions/termine";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Alle Aktionen am Kalender eines Teams an einer Stelle (Team-Kalender
   #322, #323). Die Liste und — ab Teil F — der Monatsüberblick rufen
   dieselben Funktionen auf, damit ein Termin in beiden Ansichten dieselben
   Aktionen bietet (#329 AK 8). */
export type TerminAktionen = {
  neu: (datum?: string) => void;
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
  const [bearbeiten, setBearbeiten] = useState<TerminZeile | null>(null);
  const [zuordnen, setZuordnen] = useState<TerminZeile | null>(null);
  const [entfernen, setEntfernen] = useState<TerminZeile | null>(null);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();

  /** Eine Aktion ausführen: bei Erfolg schliessen, neu laden, melden; bei
   *  einem Fehler bleibt ein Formular offen und zeigt ihn (`imDialog`),
   *  sonst meldet die Snackbar. */
  function lauf<T extends { ok: boolean; error?: string }>(
    aufruf: () => Promise<T>,
    erfolg: (r: T) => string,
    schliessen: () => void,
    imDialog = false,
  ) {
    startTransition(async () => {
      const r = await aufruf();
      if (!r.ok && imDialog) { setDialogFehler(r.error); return; }
      schliessen();
      setDialogFehler(undefined);
      router.refresh();
      melde(r.ok ? erfolg(r) : (r.error ?? "Fehlgeschlagen."));
    });
  }

  const aktionen: TerminAktionen = {
    neu: (datum) => { setDialogFehler(undefined); setNeu(datum ?? ""); },
    bearbeiten: (t) => { setDialogFehler(undefined); setBearbeiten(t); },
    zuordnen: setZuordnen,
    loesen: (t) =>
      t.training &&
      lauf(() => loeseTrainingAktion(t.id, t.training!.id), () => `«${t.training!.name}» ist gelöst und bleibt im Team-Bestand.`, () => {}),
    entfernen: setEntfernen,
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

      <TerminDialog
        open={bearbeiten !== null}
        titel="Termin ändern"
        bestaetigung="Speichern"
        start={bearbeiten ? { datum: bearbeiten.datum, beginn: bearbeiten.beginn ?? "", ende: bearbeiten.ende ?? "", ort: bearbeiten.ort ?? "", bemerkung: bearbeiten.bemerkung ?? "" } : undefined}
        bisher={bearbeiten ? { beginn: bearbeiten.beginn, ende: bearbeiten.ende } : undefined}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setBearbeiten(null)}
        onSpeichern={(f) =>
          bearbeiten &&
          lauf(() => aendereTerminAktion(bearbeiten.id, f, bearbeiten.training?.id ?? null), () => "Termin geändert.", () => setBearbeiten(null), true)
        }
      />

      <TrainingWahlDialog
        termin={zuordnen}
        trainings={trainings}
        heute={heute}
        pending={pending}
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
            (r) => ("kopie" in r && r.kopie ? "Kopie angelegt und dem Termin zugeordnet." : "Training zugeordnet."),
            () => setZuordnen(null),
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
          Der Termin am {entfernen ? datumKurz(entfernen.datum) : ""} verschwindet aus dem Kalender.
          {entfernen?.training && (
            <> <strong className="text-on-surface">{entfernen.training.name}</strong> bleibt ohne Termin im Team-Bestand.</>
          )}
        </p>
      </Dialog>
    </Kontext.Provider>
  );
}
