"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  TriangleAlert,
  Info,
  Clock,
  ChevronUp,
  ChevronDown,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";
import {
  Card,
  KategorieChip,
  Badge,
  Dialog,
  Snackbar,
  Button,
  TextField,
  IconButton,
  Tooltip,
  TextArea,
} from "@/components/ui";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import { ExerciseThumb } from "./ExerciseThumb";
import { InBibliothekButton } from "./InBibliothekButton";
import { DurationStepper } from "./DurationStepper";
import { StufenField } from "./StufenField";
import { ZeitAbgleich, GesamtAbgleich } from "./ZeitAbgleich";
import {
  LEER_HINWEIS_BLOECKE,
  GESAMTDAUER_JUNIOREN,
  type Einordnung,
} from "@/lib/junioren";
import { kategorienFuer } from "@/lib/altersstufe";
import {
  altersstufe as altersstufeLabels,
  junioren_block as juniorenBlockLabels,
  type JuniorenBlockSlug,
} from "@/lib/vocab";
import { SichtbarkeitControl } from "./SichtbarkeitControl";
import { fehlendeBedingungenAus, type Bedingung } from "@/lib/training-bedingungen";
import { InTeamStellenControl } from "./InTeamStellenControl";
import {
  TRAININGSTEILE,
  HAUPTTEILKATEGORIEN,
  ANZAHL_HINWEIS,
  stufenAbgedeckt,
  teilTraegtDauer,
  groupHauptteil,
  groupJunioren,
  formatDuration,
  ZIEL_MAX,
} from "@/lib/training";
import {
  setExerciseDuration,
  moveTrainingExercise,
  removeTrainingExercise,
  renameTraining,
  setTrainingStufen,
  setTrainingZiel,
  deleteTraining,
} from "@/lib/actions/trainings";
import type { TrainingsteilSlug, HauptteilkategorieSlug } from "@/lib/vocab";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/* Trainings-Editor (Stories #10/#11/#12). Vier feste Trainingsteil-Abschnitte
   mit Übungs-Picker, Dauer-Erfassung, Umsortieren (Hoch/Runter) und Entfernen.
   Kopf: Name bearbeiten, Stufen setzen, Training löschen. Struktur-Änderungen
   frischen die Serverdaten auf; Dauern werden lokal überlagert. */
export function TrainingEditor({
  training,
  /** Die Teams des USERS — Ziele für „Ins Team stellen" (Team-Epic Story 5). */
  teams = [],
}: {
  training: TrainingDetail;
  teams?: TeamUebersicht[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Offener Picker: die Ziel-Einordnung (Kinderfussball-Teil oder
  // Junioren-Block) und — im Kinderfussball-Hauptteil — die Unterkategorie.
  const [open, setOpen] = useState<{
    teil: Einordnung;
    hkat?: HauptteilkategorieSlug;
  } | null>(null);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [stufen, setStufen] = useState<string[]>(training.stufen);
  const [ziel, setZiel] = useState<string>(training.ziel ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(training.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ id: string; name: string }[] | null>(null);

  // Nach welchem Lehrmittel das Training gegliedert ist. Es folgt aus der
  // geführten Altersstufe, die ab dem Anlegen feststeht — nicht mehr aus den
  // Alterskategorien (Story 5 PC 2). Ein Junioren-Training ohne Alterskategorie
  // ist damit möglich und fällt trotzdem nie aufs Kinderfussball-Schema zurück.
  const junioren = training.altersstufe === "juniorenfussball";

  const dur = (item: TrainingExerciseItem) =>
    item.id in durations ? durations[item.id] : item.durationMin;

  function changeDuration(item: TrainingExerciseItem, next: number | null) {
    setDurations((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      await setExerciseDuration(item.id, next);
    });
  }

  function move(item: TrainingExerciseItem, dir: -1 | 1) {
    startTransition(async () => {
      await moveTrainingExercise(item.id, dir);
      router.refresh();
    });
  }

  function remove(item: TrainingExerciseItem) {
    startTransition(async () => {
      const r = await removeTrainingExercise(item.id);
      router.refresh();
      // Am öffentlichen Training kann das Entfernen abgelehnt werden — es wäre
      // die letzte Übung, die es dort braucht. Ohne Meldung sähe der Trainer
      // die Übung einfach stehenbleiben (Story A AK 7).
      if (!r.ok) setNotice(r.error ?? "Entfernen fehlgeschlagen.");
    });
  }

  /** Alterskategorien setzen (Story #12 AC2). Die Altersstufe ist davon
   *  unberührt: Sie steht ab dem Anlegen fest, und die angebotenen Kategorien
   *  gehören ohnehin nur zu ihr (Story 5 AK 4/5). Eine stufenfremde Kategorie —
   *  etwa aus einem manipulierten Aufruf — weist die Server-Action ab und nennt
   *  den gangbaren Weg; die Meldung erscheint hier. */
  function changeStufen(next: string[]) {
    const vorher = stufen;
    setStufen(next);
    startTransition(async () => {
      const r = await setTrainingStufen(training.id, next);
      router.refresh();
      if (!r.ok) {
        // Auswahl zurücknehmen: sonst zeigte der Editor Stufen an, die nie
        // gespeichert wurden.
        setStufen(vorher);
        setNotice(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      if (r.mismatched && r.mismatched.length > 0) setMismatch(r.mismatched);
    });
  }

  function speichereZiel() {
    if (ziel.trim() === (training.ziel ?? "")) return;
    startTransition(async () => {
      const r = await setTrainingZiel(training.id, ziel);
      if (!r.ok) {
        setZiel(training.ziel ?? "");
        setNotice(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    });
  }

  function saveName() {
    startTransition(async () => {
      const r = await renameTraining(training.id, nameInput);
      if (r.ok) {
        setRenameOpen(false);
        router.refresh();
      } else {
        setNameError(r.error);
      }
    });
  }

  function removeMismatched(ids: string[]) {
    startTransition(async () => {
      let fehler: string | null = null;
      for (const id of ids) {
        const r = await removeTrainingExercise(id);
        if (!r.ok && !fehler) fehler = r.error ?? "Entfernen fehlgeschlagen.";
      }
      setMismatch(null);
      router.refresh();
      if (fehler) setNotice(fehler);
    });
  }

  const byTeil = (slug: string) =>
    training.exercises.filter((e) => e.trainingsteil === slug);

  // Auffangen trägt keine Dauer und zählt weder zur Summe noch zum
  // „ohne Dauer"-Hinweis.
  // Was zum Veröffentlichen fehlt: so erscheint die Tragweite-Bestätigung nur
  // für ein veröffentlichbares Training. Die Action prüft es serverseitig
  // erneut. Eine Übung im Hauptteil braucht es nicht eigens zu prüfen — das
  // freie Spiel liegt dort und deckt es zwingend ab.
  const oeffentlich = training.visibility === "public";

  // Live-Vorschau der Veröffentlichungs-Bedingungen aus dem lokalen Stand.
  // Dieselbe Funktion, die die Server Action nutzt — und dieselbe Regel, die
  // die Datenbank als Trust-Boundary durchsetzt (Story 7 AC 3).
  const fehlendeBedingungen = fehlendeBedingungenAus(
    training.altersstufe,
    stufen,
    training.exercises,
  );

  const dauerItems = training.exercises.filter((e) => teilTraegtDauer(e.trainingsteil));
  const totalDuration = dauerItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
  const totalMissing = dauerItems.filter((it) => dur(it) == null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf: Name, Stufen, Löschen */}
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="type-headline-medium truncate text-on-surface">
                {training.name}
              </h1>
              <button
                type="button"
                onClick={() => {
                  setNameInput(training.name);
                  setNameError(undefined);
                  setRenameOpen(true);
                }}
                aria-label="Namen bearbeiten"
                className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8"
              >
                <Pencil size={16} strokeWidth={2} aria-hidden />
              </button>
            </div>
            {/* Team-Training oder persönliches? Die Marke sagt, wem es gehört —
                und bei persönlichen zusätzlich, ob es öffentlich ist. Daneben,
                in derselben Zeile, welchem Lehrmittel es folgt (Story 5 AK 3):
                beide Schemata teilen Begriffe wie „Hauptteil", der Trainer muss
                jederzeit sehen, in welchem er plant. Neutral statt in einer
                Kategorie-Farbe — die Altersstufe ist keine Alterskategorie. */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {training.team ? (
                <Link
                  href={`/team/${training.team.id}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-[4px] type-label-medium text-on-surface-variant hover:text-primary"
                >
                  <Users size={16} strokeWidth={2} aria-hidden />
                  Team-Training von {training.team.name}
                </Link>
              ) : (
                <Badge tone={oeffentlich ? "oeffentlich" : "entwurf"}>
                  {oeffentlich ? "Öffentlich" : "✎ Entwurf"}
                </Badge>
              )}
              <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {/* Veröffentlichen und Ins-Team-Stellen gibt es nur für das eigene
                Training: ein Team-Training gehört dem Team, nicht einer Person. */}
            {!training.team && (
              <>
                <SichtbarkeitControl
                  trainingId={training.id}
                  oeffentlich={oeffentlich}
                  fehlend={fehlendeBedingungen}
                />
                <InTeamStellenControl trainingId={training.id} teams={teams} />
              </>
            )}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 type-label-large text-error transition-colors hover:bg-error/10"
            >
              <Trash2 size={18} strokeWidth={2} aria-hidden />
              Löschen
            </button>
          </div>
        </div>

        {/* Ziel: optional, jederzeit änder- und entfernbar (Story 10 AC 3).
            Gespeichert wird beim Verlassen des Felds — wie der Trainingsname
            über einen eigenen Schritt, nicht bei jedem Tastendruck. */}
        <div className="mt-4">
          <TextArea
            label="Ziel (optional)"
            rows={2}
            maxLength={ZIEL_MAX}
            value={ziel}
            onChange={(e) => setZiel(e.target.value)}
            onBlur={() => speichereZiel()}
            supportingText={`Woran das Team in diesem Training arbeitet. Höchstens ${ZIEL_MAX} Zeichen.`}
          />
        </div>

        <div className="mt-4">
          <p className="mb-2 type-label-large text-on-surface">Alterskategorien</p>
          {/* Nur die Kategorien der Altersstufe dieses Trainings: Sie folgen ihr,
              statt sie zu bestimmen (Story 5 AK 4). Ein Wechsel der Altersstufe
              ist bewusst nirgends vorgesehen (AK 5) — wer für die andere plant,
              legt ein neues Training an. */}
          <StufenField
            value={stufen}
            onChange={changeStufen}
            kategorien={kategorienFuer(training.altersstufe)}
          />
        </div>
      </Card>

      {/* Summenleiste */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-outline bg-surface-container px-4 py-3">
        <span className="inline-flex items-center gap-2 type-title-medium text-on-surface">
          <Clock size={18} strokeWidth={2} aria-hidden />
          Gesamtdauer: {formatDuration(totalDuration)}
        </span>
        {/* Die Zeit-Orientierung gilt nur im Juniorenschema — das
            Kinderfussball-Manual gibt bewusst keine Zeiten vor (Story 6
            AC 5 / Out of Scope 1). */}
        {junioren && <GesamtAbgleich sum={totalDuration} soll={GESAMTDAUER_JUNIOREN} />}
        {totalMissing > 0 && (
          <span className="type-label-medium text-on-surface-variant">
            {totalMissing} {totalMissing === 1 ? "Übung ohne" : "Übungen ohne"} Dauer
          </span>
        )}
      </div>

      {/* Juniorenschema: drei Trainingsteile, die Unterblöcke stets sichtbar —
          auch leere, damit die Struktur beim Planen erkennbar bleibt
          (Story 4 AC 1, Story 5a AC 1–3). */}
      {junioren &&
        groupJunioren(training.exercises).map((teil) => {
          const teilDur = teil.bloecke.reduce<number>(
            (a, b) => a + b.items.reduce<number>((x, it) => x + (dur(it) ?? 0), 0),
            0,
          );
          const teilMissing = teil.bloecke.reduce<number>(
            (a, b) => a + b.items.filter((it) => dur(it) == null).length,
            0,
          );
          return (
            <Card key={teil.slug} className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <h2 className="type-title-medium text-on-surface">{teil.label}</h2>
                {teilDur > 0 && (
                  <span className="type-label-medium text-on-surface-variant">
                    {formatDuration(teilDur)}
                  </span>
                )}
                <ZeitAbgleich slug={teil.slug} sum={teilDur} />
              </div>

              <div className="mt-4 flex flex-col gap-5">
                {teil.bloecke.map((b) => {
                  const blockDur = b.items.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
                  return (
                    <div key={b.slug}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="type-title-small text-on-surface">
                          {b.label}
                          {blockDur > 0 && (
                            <span className="ml-2 type-label-medium text-on-surface-variant">
                              {formatDuration(blockDur)}
                            </span>
                          )}
                          <span className="ml-2">
                            <ZeitAbgleich slug={b.slug} sum={blockDur} />
                          </span>
                        </h3>
                        <Tooltip label="Übung hinzufügen">
                          <IconButton
                            icon={Plus}
                            label={`Übung zu ${b.label} hinzufügen`}
                            size="sm"
                            onClick={() => setOpen({ teil: b.slug })}
                          />
                        </Tooltip>
                      </div>
                      <ExerciseList
                        items={b.items}
                        trainingId={training.id}
                        trainingStufen={stufen}
                        showDuration
                        dur={dur}
                        onDuration={changeDuration}
                        onMove={move}
                        onRemove={remove}
                      />
                      {/* Leere Blöcke, die das Lehrmittel als gesetzt ansieht:
                          Hinweis, keine Blockade (Story 5a AC 8/9). */}
                      {b.items.length === 0 &&
                        LEER_HINWEIS_BLOECKE.includes(b.slug) && (
                          <p className="mt-2 flex items-center gap-2 type-label-medium text-on-surface-variant">
                            <Info size={15} className="shrink-0 text-signal" aria-hidden />
                            {b.slug === "jun-spiel"
                              ? "Das Spiel ist noch leer — im Juniorenfussball gehört das freie Spiel in jedes Training."
                              : `«${b.label}» ist noch leer.`}
                          </p>
                        )}
                    </div>
                  );
                })}
              </div>

              {teilMissing > 0 && (
                <p className="mt-3 type-label-medium text-on-surface-variant">
                  {teilMissing} {teilMissing === 1 ? "Übung" : "Übungen"} ohne erfasste
                  Dauer (zählt nicht zur Summe).
                </p>
              )}
            </Card>
          );
        })}

      {!junioren &&
        TRAININGSTEILE.map(({ slug, label }) => {
        const traegtDauer = teilTraegtDauer(slug);
        const teilItems = byTeil(slug);

        // Hauptteil: in die drei Unterkategorien gegliedert (Story #23). Stets
        // alle drei sichtbar, je eigener Picker/Liste/Reihenfolge.
        if (slug === "hauptteil") {
          const subgroups = groupHauptteil(teilItems);
          const teilDur = teilItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0);
          const tooMany = teilItems.length > ANZAHL_HINWEIS[slug];
          const teilMissing = teilItems.filter((it) => dur(it) == null).length;
          const spielLeer =
            subgroups.find((g) => g.slug === "fussball-spielen")?.items.length === 0;
          return (
            <Card key={slug} className="p-4 sm:p-5">
              <div className="flex items-center gap-2">
                <h2 className="type-title-medium text-on-surface">{label}</h2>
                {teilDur > 0 && (
                  <span className="type-label-medium text-on-surface-variant">
                    {formatDuration(teilDur)}
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-5">
                {subgroups.map((g) => (
                  <div key={g.slug}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h3 className="type-title-small text-on-surface">
                        {g.label}
                        {g.sum > 0 && (
                          <span className="ml-2 type-label-medium text-on-surface-variant">
                            {formatDuration(g.sum)}
                          </span>
                        )}
                      </h3>
                      <Tooltip label="Übung hinzufügen">
                        <IconButton
                          icon={Plus}
                          label={`Übung zu ${g.label} hinzufügen`}
                          size="sm"
                          onClick={() => setOpen({ teil: slug, hkat: g.slug })}
                        />
                      </Tooltip>
                    </div>
                    <ExerciseList
                      items={g.items}
                      trainingId={training.id}
                      trainingStufen={stufen}
                      showDuration={traegtDauer}
                      dur={dur}
                      onDuration={changeDuration}
                      onMove={move}
                      onRemove={remove}
                    />
                  </div>
                ))}
              </div>

              {(spielLeer || tooMany || teilMissing > 0) && (
                <div className="mt-3 flex flex-col gap-1">
                  {spielLeer && (
                    <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
                      <Info size={15} className="shrink-0 text-signal" aria-hidden />
                      Das freie Spiel («Fussball spielen») ist noch leer — im
                      Kinderfussball gehört es in jedes Training.
                    </p>
                  )}
                  {tooMany && (
                    <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
                      <Info size={15} className="shrink-0 text-signal" aria-hidden />
                      Ungewöhnlich viele Übungen für diesen Trainingsteil — erlaubt,
                      achte nur auf die Gesamtdauer.
                    </p>
                  )}
                  {teilMissing > 0 && (
                    <p className="type-label-medium text-on-surface-variant">
                      {teilMissing} {teilMissing === 1 ? "Übung" : "Übungen"} ohne erfasste
                      Dauer (zählt nicht zur Summe).
                    </p>
                  )}
                </div>
              )}
            </Card>
          );
        }

        // Übrige Trainingsteile (Auffangen, Einleitung, Ausklang).
        const tooMany = teilItems.length > ANZAHL_HINWEIS[slug];
        const teilDur = traegtDauer
          ? teilItems.reduce<number>((a, it) => a + (dur(it) ?? 0), 0)
          : 0;
        const teilMissing = traegtDauer
          ? teilItems.filter((it) => dur(it) == null).length
          : 0;
        return (
          <Card key={slug} className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="type-title-medium text-on-surface">
                {label}
                {teilDur > 0 && (
                  <span className="ml-2 type-label-medium text-on-surface-variant">
                    {formatDuration(teilDur)}
                  </span>
                )}
              </h2>
              <Tooltip label="Übung hinzufügen">
                <IconButton
                  icon={Plus}
                  label={`Übung zu ${label} hinzufügen`}
                  size="sm"
                  onClick={() => setOpen({ teil: slug })}
                />
              </Tooltip>
            </div>

            <ExerciseList
              items={teilItems}
              trainingId={training.id}
              trainingStufen={stufen}
              showDuration={traegtDauer}
              dur={dur}
              onDuration={changeDuration}
              onMove={move}
              onRemove={remove}
            />

            {(tooMany || teilMissing > 0) && (
              <div className="mt-3 flex flex-col gap-1">
                {tooMany && (
                  <p className="flex items-center gap-2 type-label-medium text-on-surface-variant">
                    <Info size={15} className="shrink-0 text-signal" aria-hidden />
                    Ungewöhnlich viele Übungen für diesen Trainingsteil — erlaubt,
                    achte nur auf die Gesamtdauer.
                  </p>
                )}
                {teilMissing > 0 && (
                  <p className="type-label-medium text-on-surface-variant">
                    {teilMissing} {teilMissing === 1 ? "Übung" : "Übungen"} ohne erfasste
                    Dauer (zählt nicht zur Summe).
                  </p>
                )}
              </div>
            )}
          </Card>
        );
        })}

      {/* Ein Picker, gesteuert über `open` (Trainingsteil + ggf. Unterkategorie). */}
      {open &&
        (() => {
          const teilLabel =
            TRAININGSTEILE.find((t) => t.slug === open.teil)?.label ??
            juniorenBlockLabels[open.teil as JuniorenBlockSlug] ??
            open.teil;
          const sub = open.hkat
            ? HAUPTTEILKATEGORIEN.find((h) => h.slug === open.hkat)
            : undefined;
          const openItems = training.exercises.filter(
            (e) =>
              e.trainingsteil === open.teil &&
              (!open.hkat || e.hauptteilkategorie === open.hkat),
          );
          return (
            <ExercisePickerDialog
              open
              onClose={() => setOpen(null)}
              trainingId={training.id}
              altersstufe={training.altersstufe}
              trainingsteil={open.teil}
              trainingsteilLabel={teilLabel}
              hauptteilkategorie={sub?.slug}
              hauptteilkategorieLabel={sub?.label}
              trainingStufen={stufen}
              onAdded={() => router.refresh()}
            />
          );
        })()}

      {/* Namen bearbeiten */}
      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Name bearbeiten"
        actions={
          <>
            <Button variant="text" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={saveName}>
              Speichern
            </Button>
          </>
        }
      >
        <TextField
          label="Name des Trainings"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={!!nameError}
          supportingText={nameError}
          autoFocus
        />
      </Dialog>

      {/* Stufen-Abweichungs-Hinweis */}
      <Dialog
        open={mismatch != null}
        onClose={() => setMismatch(null)}
        title="Übungen ausserhalb der Stufen"
        actions={
          <>
            <Button variant="text" onClick={() => setMismatch(null)}>
              Behalten
            </Button>
            <Button
              variant="danger"
              onClick={() => removeMismatched((mismatch ?? []).map((m) => m.id))}
            >
              Übungen entfernen
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Diese zugeordneten Übungen decken keine der gewählten Stufen ab. Du
          kannst sie im Training behalten oder entfernen.
        </p>
        <ul className="flex flex-col gap-1">
          {(mismatch ?? []).map((m) => (
            <li key={m.id} className="type-body-medium text-on-surface">
              · {m.name}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Training löschen */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Training löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <form action={deleteTraining.bind(null, training.id)}>
              <Button type="submit" variant="danger">
                Endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        <p>
          Das Training „{training.name}" und alle seine Übungszuordnungen werden
          unwiderruflich gelöscht.
        </p>
        {/* Beim öffentlichen Training ist das Löschen mehr als ein Aufräumen im
            eigenen Bestand: es verschwindet aus der Öffentlichkeit (AK 8). */}
        {oeffentlich && (
          <p className="mt-3">
            Das Training verschwindet damit auch aus dem öffentlichen Bestand.
            Kopien, die andere bereits übernommen haben, bleiben bestehen.
          </p>
        )}
      </Dialog>

      {/* Fest am unteren Rand statt im Fluss: der Editor ist eine lange Seite,
          und die Meldung gehört zu einer Aktion irgendwo darin. Am Seitenende
          eingehängt stünde sie mehr als tausend Bildpunkte unter dem Klick und
          erreichte den Trainer nie — was gerade die abgelehnten Änderungen an
          einem öffentlichen Training betrifft (Story A AK 7). */}
      <Snackbar
        open={notice != null}
        message={notice ?? ""}
        onClose={() => setNotice(null)}
        placement="fixed"
      />
    </div>
  );
}

/** Geordnete Übungsliste eines (Unter-)Abschnitts: leerer Zustand oder die
 *  Zuordnungen als umsortierbare Zeilen. Wird vom Trainingsteil und von jeder
 *  Hauptteil-Unterkategorie gleichermassen genutzt. */
function ExerciseList({
  items,
  trainingId,
  trainingStufen,
  showDuration,
  dur,
  onDuration,
  onMove,
  onRemove,
}: {
  items: TrainingExerciseItem[];
  trainingId: string;
  trainingStufen: string[];
  showDuration: boolean;
  dur: (item: TrainingExerciseItem) => number | null;
  onDuration: (item: TrainingExerciseItem, next: number | null) => void;
  onMove: (item: TrainingExerciseItem, dir: -1 | 1) => void;
  onRemove: (item: TrainingExerciseItem) => void;
}) {
  if (items.length === 0)
    return (
      <p className="type-body-small text-on-surface-variant">
        Noch keine Übung zugeordnet.
      </p>
    );
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <TrainingExerciseRow
          key={item.id}
          item={item}
          index={i}
          isFirst={i === 0}
          isLast={i === items.length - 1}
          trainingId={trainingId}
          trainingStufen={trainingStufen}
          showDuration={showDuration}
          duration={dur(item)}
          onDuration={(next) => onDuration(item, next)}
          onMove={(d) => onMove(item, d)}
          onRemove={() => onRemove(item)}
        />
      ))}
    </ol>
  );
}

function TrainingExerciseRow({
  item,
  index,
  isFirst,
  isLast,
  trainingId,
  trainingStufen,
  showDuration,
  duration,
  onDuration,
  onMove,
  onRemove,
}: {
  item: TrainingExerciseItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  trainingId: string;
  trainingStufen: string[];
  showDuration: boolean;
  duration: number | null;
  onDuration: (next: number | null) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  // Ohne Kategorien gibt es nichts abzudecken (z. B. eine inhaltsleere Fassung
  // aus der Bestand-Überführung) — dieselbe Regel wie in setTrainingStufen,
  // sonst stünde ein Warndreieck, das keine Stufenwahl je entfernt.
  const mismatch =
    item.kategorien.length > 0 && !stufenAbgedeckt(trainingStufen, item.kategorien);

  return (
    <li className="flex items-center gap-2 rounded-[4px] border border-outline-variant bg-surface-container-low px-3 py-2.5 sm:gap-3">
      {/* Hoch/Runter */}
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label="Nach oben"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
        >
          <ChevronUp size={16} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Nach unten"
          onClick={() => onMove(1)}
          disabled={isLast}
          className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
        >
          <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </span>

      <span className="w-4 shrink-0 text-center type-label-medium text-on-surface-variant">
        {index + 1}
      </span>

      <ExerciseThumb
        bildUrl={item.bildUrl}
        diagramm={item.diagramm}
        bildQuelle={item.bildQuelle}
        name={item.name}
        className="hidden sm:block"
      />

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="truncate type-body-medium text-on-surface">{item.name}</span>
          {mismatch && (
            <span title="Deckt keine der Trainings-Stufen ab">
              <TriangleAlert size={15} className="shrink-0 text-signal" aria-hidden />
            </span>
          )}
        </span>
        {item.kategorien.length > 0 && (
          <span className="flex flex-wrap gap-1">
            {item.kategorien.map((k) => (
              <KategorieChip key={k} k={k as never} />
            ))}
          </span>
        )}
      </span>

      {showDuration && (
        <>
          <span className="shrink-0">
            <DurationStepper value={duration} onChange={onDuration} />
          </span>
          <span
            className="ml-0.5 h-6 w-px shrink-0 bg-outline-variant sm:ml-1"
            aria-hidden
          />
        </>
      )}

      <InBibliothekButton fassungId={item.id} name={item.name} />

      <Tooltip label="Übung bearbeiten">
        <Link
          href={`/training/${trainingId}/uebung/${item.id}/edit`}
          aria-label={`${item.name} bearbeiten`}
          className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-primary"
        >
          <Pencil size={16} strokeWidth={2.5} aria-hidden />
        </Link>
      </Tooltip>

      <Tooltip label="Übung entfernen">
        <button
          type="button"
          aria-label="Übung entfernen"
          onClick={onRemove}
          className="focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error/10 hover:text-error"
        >
          <Trash2 size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </Tooltip>
    </li>
  );
}
