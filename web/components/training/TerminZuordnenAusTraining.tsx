"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog, SectionMessage } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TerminWahlDialog } from "@/components/team/TerminWahlDialog";
import { ordneTrainingZuAktion, termineFuerZuordnungAktion } from "@/lib/actions/termine";
import { PERSOENLICH_KOPIE_HINWEIS, ZUORDNEN_ERFOLG } from "@/lib/termin";
import { istVeraltet } from "@/lib/veraltet";
import type { TeamUebersicht } from "@/lib/queries/teams";
import type { TerminZeile } from "@/lib/queries/termine";

/* Ein persönliches Training einem Termin eines eigenen Teams zuordnen
   (#328 AK 2). Erst das Team, dann der Termin (der Dialog der Wahl ist
   derselbe wie im Team-Bestand); zugeordnet wird immer eine Kopie.

   Fehler wie im Trainingsplan (PO 17): Ein Fehler steht im Dialog, ausser die
   Auswahl ist veraltet — dann würde ein erneuter Versuch immer wieder
   scheitern; der Dialog schliesst, und die Snackbar sagt es. Die Meldung trägt
   auch den Hinweis auf eine übrig gebliebene Kopie (#328 PC 8). */
export function TerminZuordnenAusTraining({
  open,
  trainingId,
  name,
  teams,
  onClose,
}: {
  open: boolean;
  trainingId: string;
  name: string;
  teams: readonly TeamUebersicht[];
  onClose: () => void;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [teamId, setTeamId] = useState("");
  const [daten, setDaten] = useState<{ termine: TerminZeile[]; heute: string } | null>(null);
  const [fehler, setFehler] = useState<string | undefined>();

  /** Die Nummer des laufenden Ablaufs (siehe `TerminBereich`): Öffnen, Abbrechen
   *  und eine neue Teamwahl zählen sie hoch. Eine späte Antwort mit alter
   *  Nummer rührt den Dialog nicht mehr an — bei der Zuordnung sagt nur noch die
   *  Snackbar, was geschah. */
  const laufNr = useRef(0);

  // Geschlossen steht alles zurück; beim Öffnen ist ein einziges Team gleich
  // gewählt (eine Wahl mit einer Option ist bloss ein Klick mehr).
  // Als String abhängig, nicht vom Array: `router.refresh()` liefert nach jeder
  // Zuordnung ein neues Array und setzte sonst einen Fehler im Dialog zurück.
  const einzigesTeam = teams.length === 1 ? teams[0].id : "";
  useEffect(() => {
    laufNr.current++;
    setDaten(null);
    setFehler(undefined);
    setTeamId(open ? einzigesTeam : "");
  }, [open, einzigesTeam]);

  useEffect(() => {
    if (!open || !teamId) return;
    const nr = ++laufNr.current;
    setDaten(null);
    setFehler(undefined);
    startTransition(async () => {
      const r = await termineFuerZuordnungAktion(teamId);
      if (laufNr.current !== nr) return;
      if (r.ok) setDaten({ termine: r.termine, heute: r.heute });
      else {
        // Keine Sackgasse: Ohne gewähltes Team lässt sich dasselbe Team
        // (auch das einzige) erneut wählen und damit neu laden.
        setFehler(r.error);
        setTeamId("");
      }
    });
  }, [open, teamId]);

  // Der Wahldialog setzt seine Auswahl zurück, sobald `training` wechselt:
  // darum eine stabile Identität.
  const training = useMemo(() => ({ id: trainingId, name, termin: null }), [trainingId, name]);

  function schliessen() {
    laufNr.current++;
    onClose();
  }

  if (!open) return null;

  if (!daten)
    return (
      <Dialog
        open
        onClose={schliessen}
        title="Einem Team-Termin zuordnen"
        actions={<Button variant="text" onClick={schliessen}>Abbrechen</Button>}
      >
        {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
        {/* Wie `TrainingZielDialog`: Teamnamen als Einfachauswahl, `nutzertext`,
            weil sie vom Trainer vergeben sind. Ein Select ragte mit seinem
            Panel über den Rand des Dialogs. */}
        <ChoiceChipGroup ariaLabel="In welchem Team">
          {teams.map((t, i) => (
            <ChoiceChip
              key={t.id}
              look="nutzertext"
              selected={teamId === t.id}
              tabStop={teamId === t.id || (teamId === "" && i === 0)}
              onSelect={() => !pending && setTeamId(t.id)}
            >
              {t.name}
            </ChoiceChip>
          ))}
        </ChoiceChipGroup>
        {pending && <p className="mt-3">Termine werden geladen …</p>}
      </Dialog>
    );

  return (
    <TerminWahlDialog
      training={training}
      termine={daten.termine}
      heute={daten.heute}
      pending={pending}
      fehler={fehler}
      hinweis={PERSOENLICH_KOPIE_HINWEIS}
      onClose={schliessen}
      onWahl={({ termin }) => {
        const nr = laufNr.current;
        startTransition(async () => {
          const r = await ordneTrainingZuAktion({
            terminId: termin.id,
            trainingId,
            art: "kopie",
            erwartet: { terminTraining: termin.training?.id ?? null, trainingTermin: null },
          });
          router.refresh();
          // Abgebrochen, während die Zuordnung lief: nur melden, was geschah.
          if (laufNr.current !== nr) return melde(r.ok ? ZUORDNEN_ERFOLG.persoenlich : r.error);
          if (!r.ok && !istVeraltet(r.error)) {
            setFehler(r.error);
            // Die Liste zeigt sonst Belegungen von vor dem Fehler.
            const neu = await termineFuerZuordnungAktion(teamId);
            if (neu.ok && laufNr.current === nr) setDaten({ termine: neu.termine, heute: neu.heute });
            return;
          }
          onClose();
          melde(r.ok ? ZUORDNEN_ERFOLG.persoenlich : r.error);
        });
      }}
    />
  );
}
