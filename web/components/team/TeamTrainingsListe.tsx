"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarCheck,
  CalendarPlus,
  Clock,
  CornerDownRight,
  Download,
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
  Snackbar,
  Tooltip,
} from "@/components/ui";
import { TerminDialog } from "./TerminDialog";
import { entferneTeamTraining, uebernimmZuMir } from "@/lib/actions/team-trainings";
import { erstelleTermin, setzeErneutAn, type TerminFelder } from "@/lib/actions/termine";
import { formatDuration } from "@/lib/training";
import type { TeamTrainingRow } from "@/lib/queries/trainings";

function datumKurz(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* Der Trainingsbestand eines Teams (Story 5).
   Je Eintrag: die Herkunft der Kopie, „Zu mir übernehmen" (erzeugt eine
   persönliche Kopie) und „Entfernen" (nimmt es dem ganzen Team weg). */
export function TeamTrainingsListe({
  teamId,
  trainings,
}: {
  teamId: string;
  trainings: TeamTrainingRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entfernen, setEntfernen] = useState<TeamTrainingRow | null>(null);
  const [ansetzen, setAnsetzen] = useState<TeamTrainingRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Ansetzen und erneut Ansetzen sind derselbe Vorgang aus Sicht des Trainers
   *  — nur führt der zweite über eine eigenständige Kopie (Story 8). Welcher
   *  Weg gilt, entscheidet allein, ob das Training schon einen Termin trägt. */
  function ansetzenSpeichern(felder: TerminFelder) {
    if (!ansetzen) return;
    const weitereEinheit = ansetzen.termin != null;
    startTransition(async () => {
      const res = weitereEinheit
        ? await setzeErneutAn(ansetzen.id, felder)
        : await erstelleTermin(ansetzen.id, felder);
      setAnsetzen(null);
      if (!res.ok) {
        setNotice(res.error);
        return;
      }
      // In den Trainingsplan wechseln — dort landet die neue Einheit. Die
      // Bestätigung reist über die Adresse mit: eine Snackbar von hier stürbe
      // mit dieser Komponente, sobald der Wechsel sie abräumt. Der Wechsel lädt
      // die Zielansicht ohnehin frisch; ein zusätzliches Auffrischen erübrigt sich.
      router.push(`/team/${teamId}?angesetzt=1`);
    });
  }

  function uebernehmen(t: TeamTrainingRow) {
    startTransition(async () => {
      const res = await uebernimmZuMir(t.id);
      setNotice(
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
        setNotice(`„${t.name}" wurde aus dem Team entfernt.`);
      } else {
        setNotice(res.error ?? "Entfernen fehlgeschlagen.");
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {trainings.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Wie im Trainingsplan: der ganze Textblock führt ins
                  Training, nicht nur der Titel. Er enthält nichts
                  Interaktives — die Aktionen stehen daneben. Ohne eigenes
                  aria-label, damit Übungszahl und Dauer mitgelesen werden:
                  gleichnamige Einheiten sind sonst nicht auseinanderzuhalten. */}
              <Link
                href={`/training/${t.id}/edit`}
                className="focus-ring group block min-w-0 flex-1 rounded-[4px]"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {t.stufen.map((k) => (
                    <KategorieChip key={k} k={k} />
                  ))}
                  {/* „Angesetzt" ist ein Zustand, keine Aktion — darum als
                      Plakette beim Titel statt als Attrappe eines Buttons in
                      der Aktionsreihe. Geändert wird der Termin im Plan. */}
                  {t.termin && (
                    <Badge tone="neutral">
                      <CalendarCheck size={12} strokeWidth={2.5} aria-hidden />
                      Angesetzt
                    </Badge>
                  )}
                </div>
                <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
                  {t.name}
                </h3>
                {t.herkunft && (
                  <p className="mt-1 flex items-start gap-1.5 type-body-small text-on-surface-variant">
                    <CornerDownRight
                      size={14}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <span>
                      basiert auf{" "}
                      <span className="text-on-surface">{t.herkunft.name}</span>, seit{" "}
                      {datumKurz(t.herkunft.datum)} im Team
                    </span>
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-label-medium text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <ListChecks size={15} strokeWidth={2} aria-hidden />
                    {t.exerciseCount} {t.exerciseCount === 1 ? "Übung" : "Übungen"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} strokeWidth={2} aria-hidden />
                    {t.hasAnyDuration ? formatDuration(t.totalDuration) : "Keine Dauer"}
                  </span>
                </div>
              </Link>

              {/* Icon-only wie auf der Übungsseite; Entfernen liegt im
                  ⋮-Menü. Das Ansetzen bleibt auch bei einem bereits
                  angesetzten Training erreichbar (Story 16): dort, wo der
                  Trainer sein Training auswählt, endete sonst der Weg zur
                  nächsten Einheit. Den Termin selbst ändert man im Plan. */}
              <div className="flex shrink-0 items-center gap-0.5">
                <Tooltip label={t.termin ? "Erneut ansetzen" : "Ansetzen"}>
                  <IconButton
                    icon={CalendarPlus}
                    label={
                      t.termin ? `${t.name} erneut ansetzen` : `${t.name} ansetzen`
                    }
                    size="sm"
                    disabled={pending}
                    onClick={() => setAnsetzen(t)}
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

      {/* Beim erneuten Ansetzen dieselbe Vorbelegung wie im Plan: Beginn, Ort
          und Bemerkung stehen meist wieder gleich, das Datum ist bewusst leer.
          Der Hinweis nennt die Tragweite — es entsteht eine eigene Kopie. */}
      <TerminDialog
        open={ansetzen != null}
        titel={ansetzen?.termin ? "Weitere Einheit ansetzen" : "Training ansetzen"}
        bestaetigung="Ansetzen"
        hinweis={
          ansetzen?.termin
            ? "Es entsteht eine eigenständige Kopie des Trainings für den neuen Termin. Die bisherige Einheit bleibt mit ihrem Stand bestehen."
            : "Der Termin erscheint im Trainingsplan des Teams."
        }
        start={
          ansetzen?.termin
            ? {
                beginn: ansetzen.termin.beginn,
                ort: ansetzen.termin.ort,
                bemerkung: ansetzen.termin.bemerkung,
              }
            : undefined
        }
        pending={pending}
        onClose={() => setAnsetzen(null)}
        onSpeichern={ansetzenSpeichern}
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
          das ganze Team gelöscht. Ein angesetzter Termin entfällt dabei.
        </p>
        <p className="mt-3">
          Persönliche Kopien, die jemand zu sich übernommen hat, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
