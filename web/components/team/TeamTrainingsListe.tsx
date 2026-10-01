"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  Clock,
  Download,
  Layers,
  ListChecks,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Dialog,
  IconButton,
  KategorieChip,
  OverflowMenu,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { TerminWahlDialog } from "./TerminWahlDialog";
import { entferneTeamTraining, uebernimmZuMir } from "@/lib/actions/team-trainings";
import { ordneTrainingZuAktion } from "@/lib/actions/termine";
import { ZUORDNEN_ERFOLG } from "@/lib/termin";
import { istVeraltet } from "@/lib/veraltet";
import { formatDuration } from "@/lib/training";
import { datumKurz } from "@/lib/zeit";
import type { TeamTrainingRow } from "@/lib/queries/trainings";
import type { TerminZeile } from "@/lib/queries/termine";

/* Der Trainingsbestand eines Teams (Story 5).
   Je Eintrag: „Zu mir übernehmen" (erzeugt eine persönliche Kopie) und
   „Entfernen" (nimmt es dem ganzen Team weg) und „Termin zuordnen"
   (Team-Kalender #323). */
export function TeamTrainingsListe({
  trainings,
  termine,
  heute,
}: {
  trainings: TeamTrainingRow[];
  /** Alle Termine des Teams: anstehende aufsteigend, dann vergangene
   *  absteigend (`teilePlan`). */
  termine: TerminZeile[];
  heute: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entfernen, setEntfernen] = useState<TeamTrainingRow | null>(null);
  const [zuordnen, setZuordnen] = useState<TeamTrainingRow | null>(null);
  const [dialogFehler, setDialogFehler] = useState<string | undefined>();
  const melde = useSnackbar();

  /** Zuordnen mit den Angaben, auf die sich die Wahl stützt (`erwartet`, PO 17).
   *  Fehler stehen im Dialog — ausser die Auswahl ist veraltet: dann würde ein
   *  erneuter Versuch immer wieder scheitern, der Dialog schliesst, und die
   *  aufgefrischte Liste zeigt den neuen Stand. */
  function zuordnenSpeichern({ termin, art }: { termin: TerminZeile; art?: "kopie" | "verschieben" }) {
    if (!zuordnen) return;
    startTransition(async () => {
      const res = await ordneTrainingZuAktion({
        terminId: termin.id,
        trainingId: zuordnen.id,
        art,
        erwartet: { terminTraining: termin.training?.id ?? null, trainingTermin: zuordnen.termin?.id ?? null },
      });
      router.refresh();
      if (!res.ok && !istVeraltet(res.error)) {
        setDialogFehler(res.error);
        return;
      }
      setZuordnen(null);
      setDialogFehler(undefined);
      melde(res.ok ? (res.kopie ? ZUORDNEN_ERFOLG.kopie : ZUORDNEN_ERFOLG.direkt) : res.error);
    });
  }

  function uebernehmen(t: TeamTrainingRow) {
    startTransition(async () => {
      const res = await uebernimmZuMir(t.id);
      melde(
        res.ok
          ? `„${t.name}" liegt jetzt als eigene Kopie bei dir.`
          : res.error,
      );
    });
  }

  function entfernenAusfuehren(t: TeamTrainingRow) {
    startTransition(async () => {
      const res = await entferneTeamTraining(t.id);
      setEntfernen(null);
      if (res.ok) {
        router.refresh();
        melde(`„${t.name}" wurde aus dem Team entfernt.`);
      } else {
        melde(res.error ?? "Entfernen fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {trainings.map((t) => (
          // Die ganze Karte führt ins Training und hellt beim Überfahren auf
          // wie die Teamkarte (`state`). Der Link spannt sich dafür über sie
          // (`before:inset-0`); die Aktionen liegen darüber und behalten
          // ihre eigenen Klicks.
          <Card key={t.id} className="state p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Der ganze Textblock führt ins Training, nicht nur der Titel.
                  Er enthält nichts Interaktives — die Aktionen stehen
                  daneben. Ohne eigenes aria-label, damit Übungszahl und Dauer
                  mitgelesen werden: gleichnamige Einheiten sind sonst nicht
                  auseinanderzuhalten. */}
              <Link
                href={`/training/${t.id}/edit`}
                className="focus-ring block min-w-0 flex-1 rounded-flaeche before:absolute before:inset-0 before:rounded-flaeche before:content-['']"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {t.stufen.map((k) => (
                    <KategorieChip key={k} k={k} />
                  ))}
                  {/* Dieselbe Marke wie auf der Trainings-Kachel, an derselben
                      Stelle der Chip-Zeile: der Trainingsbestand des Teams
                      zeigt Varianten genauso an (#206 AK 1). Die Liste
                      dupliziert die Kachel-Anzeige bewusst — sie trägt eigene
                      Aktionen und lässt sich darum nicht durch TrainingCard
                      ersetzen. Umrandet in Primary (`varianten`), weil die Zahl
                      eine Eigenschaft des Trainings meldet und keine
                      Alterskategorie ist; Plural immer, die Marke erscheint
                      erst ab zwei (AK 3). */}
                  {t.variantenZahl > 1 && (
                    <Badge tone="varianten">
                      <Layers size={12} strokeWidth={2.5} aria-hidden />
                      {t.variantenZahl} Varianten
                    </Badge>
                  )}
                  {/* „Eingeplant" ist ein Zustand, keine Aktion — darum als
                      Plakette beim Titel statt als Attrappe eines Buttons in
                      der Aktionsreihe. Geändert wird der Termin im Plan.
                      Das Datum steht mit dabei: mehrere eingeplante Einheiten
                      desselben Trainings heissen gleich und sind sonst nicht
                      auseinanderzuhalten (#156 AK 7). */}
                  {t.termin && (
                    <Badge tone="neutral">
                      <CalendarCheck size={12} strokeWidth={2.5} aria-hidden />
                      Eingeplant · {datumKurz(t.termin.datum)}
                    </Badge>
                  )}
                </div>
                <h3 className="type-title-medium text-on-surface">
                  {t.name}
                </h3>
                {/* Kennzahlen der ERSTEN Variante (#206 AK 2), gerechnet in
                    `mapListRow` — ein Training spielt nur eine Variante. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-body-medium text-on-surface-mittel">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks size={16} strokeWidth={2} aria-hidden />
                    {t.exerciseCount} {t.exerciseCount === 1 ? "Übung" : "Übungen"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={16} strokeWidth={2} aria-hidden />
                    {t.hasAnyDuration ? formatDuration(t.totalDuration) : "Keine Dauer"}
                  </span>
                </div>
              </Link>

              {/* Icon-only wie auf der Übungsseite; Entfernen liegt im
                  ⋮-Menü. Das Zuordnen bleibt auch bei einem bereits
                  eingeplanten Training erreichbar (Story 16): dort, wo der
                  Trainer sein Training auswählt, endete sonst der Weg zum
                  nächsten Termin. Den Termin selbst ändert man im Plan. */}
              <div className="relative flex shrink-0 items-center gap-0.5">
                <Tooltip label="Termin zuordnen">
                  <IconButton
                    icon={CalendarPlus}
                    label={`${t.name} einem Termin zuordnen`}
                    size="sm"
                    disabled={pending}
                    onClick={() => { setDialogFehler(undefined); setZuordnen(t); }}
                  />
                </Tooltip>
                <Tooltip label="Zu mir übernehmen">
                  <IconButton
                    icon={Download}
                    label={`${t.name} zu mir übernehmen`}
                    size="sm"
                    disabled={pending}
                    onClick={() => uebernehmen(t)}
                  />
                </Tooltip>
                <OverflowMenu
                  label={`Weitere Aktionen zu ${t.name}`}
                  disabled={pending}
                  items={[
                    {
                      label: "Aus dem Team entfernen",
                      icon: Trash2,
                      danger: true,
                      onSelect: () => setEntfernen(t),
                    },
                  ]}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <TerminWahlDialog
        training={zuordnen}
        termine={termine}
        heute={heute}
        pending={pending}
        fehler={dialogFehler}
        onClose={() => setZuordnen(null)}
        onWahl={zuordnenSpeichern}
      />

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title="Aus dem Team entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => entfernen && entfernenAusfuehren(entfernen)}
              disabled={pending}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          <strong className="text-on-surface">{entfernen?.name}</strong> wird für
          das ganze Team gelöscht.
          {entfernen?.termin && (
            <> Der Termin am {datumKurz(entfernen.termin.datum)} bleibt ohne Training im Trainingsplan bestehen.</>
          )}
        </p>
        <p className="mt-3">
          Persönliche Kopien, die jemand zu sich übernommen hat, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>
    </>
  );
}
