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
} from "@/components/ui";
import { ExercisePickerDialog } from "./ExercisePickerDialog";
import { ExerciseThumb } from "./ExerciseThumb";
import { InBibliothekButton } from "./InBibliothekButton";
import { DurationStepper } from "./DurationStepper";
import { StufenField } from "./StufenField";
import {
  schemaAusStufen,
  stufenMischen,
  abbildungKifuZuJunioren,
  abbildungJuniorenZuKifu,
  JUNIOREN_PFLICHT_BLOECKE,
  JUNIOREN_TEILE,
  NACHARBEIT,
  schemaDerEinordnung,
  type Schema,
  type Einordnung,
} from "@/lib/junioren";
import {
  junioren_block as juniorenBlockLabels,
  type JuniorenBlockSlug,
} from "@/lib/vocab";
import { SichtbarkeitControl } from "./SichtbarkeitControl";
import { FREIES_SPIEL, type Bedingung } from "@/lib/training-bedingungen";
import { InTeamStellenControl } from "./InTeamStellenControl";
import {
  TRAININGSTEILE,
  HAUPTTEILKATEGORIEN,
  ANZAHL_HINWEIS,
  stufenAbgedeckt,
  teilTraegtDauer,
  groupHauptteil,
  formatDuration,
} from "@/lib/training";
import {
  setExerciseDuration,
  moveTrainingExercise,
  removeTrainingExercise,
  renameTraining,
  setTrainingStufen,
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
  // Offener Picker: Trainingsteil und — im Hauptteil — die Unterkategorie.
  const [open, setOpen] = useState<{
    teil: TrainingsteilSlug;
    hkat?: HauptteilkategorieSlug;
  } | null>(null);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  const [stufen, setStufen] = useState<string[]>(training.stufen);
  const [notice, setNotice] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(training.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mismatch, setMismatch] = useState<{ id: string; name: string }[] | null>(null);
  // Bevorstehender Schema-Wechsel, der bestätigt sein will (Story 3 AC 5).
  const [wechsel, setWechsel] = useState<{
    stufen: string[];
    ziel: Schema;
    ohneEntsprechung: string[];
    fehlendeBloecke: string[];
  } | null>(null);

  const schema = schemaAusStufen(stufen);

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

  function speichereStufen(next: string[]) {
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
      // Nach einem Schema-Wechsel bleibt der Stufen-Abgleich stumm: dass die
      // Fassungen noch die Kategorien des alten Schemas tragen, ist dort die
      // Normalität und kein Befund. Ihn hier zu melden, hiesse dem Trainer
      // unmittelbar nach dem bestätigten Wechsel anzubieten, sämtliche gerade
      // übertragenen Übungen zu entfernen (Story 3, offene UX-Frage).
      if (!r.wechsel && r.mismatched && r.mismatched.length > 0)
        setMismatch(r.mismatched);
    });
  }

  /** Stufen-Änderung. Ändert sich damit das Trainingsschema und liegen bereits
   *  Übungen im Training, fragt der Editor vorher nach: die Fassungen wandern
   *  in die Struktur des anderen Schemas, und einzelne finden dort keinen Platz
   *  (Story 3 AC 5–7). Ein leeres Training wechselt ohne Rückfrage. */
  function changeStufen(gewaehlt: string[]) {
    // Ein Training folgt genau einem Schema. Wählt der Trainer eine Stufe des
    // anderen, ist das kein Mischen, sondern ein Wechsel — die bisherige
    // Auswahl weicht der neuen. Das ist der Weg, auf dem ein bestehendes
    // E-Training zum D-Training wird (Story 3 AC 3/4).
    const next = stufenMischen(gewaehlt)
      ? gewaehlt.filter((k) => !stufen.includes(k))
      : gewaehlt;

    const zielSchema = schemaAusStufen(next);
    if (zielSchema === schema || training.exercises.length === 0) {
      speichereStufen(next);
      return;
    }

    // Vorschau: Was findet im Zielschema keine Entsprechung, und was fehlt
    // danach zum Veröffentlichen? Beides rechnet lokal dieselbe Regel wie die
    // Datenebene — Konserve zuerst, sonst die Abbildungsregel. Ohne die
    // Konserve wäre die Vorschau pessimistisch und meldete einen Verlust, den
    // der Rückweg gar nicht erleidet.
    const ziele = training.exercises.map((e) => {
      const konserve = e.einordnungVorher;
      if (konserve && schemaDerEinordnung(konserve) === zielSchema)
        return { name: e.name, ziel: konserve as Einordnung };
      return {
        name: e.name,
        ziel:
          zielSchema === "junioren"
            ? abbildungKifuZuJunioren(e.trainingsteil, e.hauptteilkategorie)
            : (() => {
                const r = abbildungJuniorenZuKifu(e.trainingsteil);
                return r === NACHARBEIT ? NACHARBEIT : r.trainingsteil;
              })(),
      };
    });
    const belegt = new Set(ziele.map((z) => z.ziel));
    setWechsel({
      stufen: next,
      ziel: zielSchema,
      ohneEntsprechung: ziele.filter((z) => z.ziel === NACHARBEIT).map((z) => z.name),
      fehlendeBloecke:
        zielSchema === "junioren"
          ? JUNIOREN_PFLICHT_BLOECKE.filter((b) => !belegt.has(b))
          : [],
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

  /** Fassungen ohne Entsprechung im aktuellen Schema. Sie erscheinen in einem
   *  eigenen Bereich, gesondert von den Trainingsteilen (Story 4 AC 9). */
  const nacharbeit = training.exercises.filter((e) => e.trainingsteil === NACHARBEIT);

  // Auffangen trägt keine Dauer und zählt weder zur Summe noch zum
  // „ohne Dauer"-Hinweis.
  // Was zum Veröffentlichen fehlt: so erscheint die Tragweite-Bestätigung nur
  // für ein veröffentlichbares Training. Die Action prüft es serverseitig
  // erneut. Eine Übung im Hauptteil braucht es nicht eigens zu prüfen — das
  // freie Spiel liegt dort und deckt es zwingend ab.
  const oeffentlich = training.visibility === "public";

  const fehlendeBedingungen: Bedingung[] = [
    stufen.length === 0 ? "stufe" : null,
    training.exercises.some((e) => e.trainingsteil === "einleitung") ? null : "einleitung",
    training.exercises.some((e) => e.hauptteilkategorie === FREIES_SPIEL)
      ? null
      : "freies_spiel",
  ].filter((x): x is Bedingung => x !== null);

  // Die Nacharbeit liegt ausserhalb der Trainingsstruktur und zählt darum
  // nicht zur Gesamtdauer.
  const dauerItems = training.exercises.filter(
    (e) => e.trainingsteil !== NACHARBEIT && teilTraegtDauer(e.trainingsteil),
  );
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
                und bei persönlichen zusätzlich, ob es öffentlich ist. */}
            {training.team ? (
              <Link
                href={`/team/${training.team.id}`}
                className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-[4px] type-label-medium text-on-surface-variant hover:text-primary"
              >
                <Users size={16} strokeWidth={2} aria-hidden />
                Team-Training von {training.team.name}
              </Link>
            ) : (
              <Badge tone={oeffentlich ? "oeffentlich" : "entwurf"} className="mt-2">
                {oeffentlich ? "Öffentlich" : "✎ Entwurf"}
              </Badge>
            )}
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

        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="type-label-large text-on-surface">Stufen</p>
            {/* Die Stufen bestimmen das Trainingsschema; beide Schemata teilen
                Begriffe wie „Hauptteil" — der Trainer muss jederzeit sehen, in
                welchem er plant (Story 4 AC 2). */}
            <span className="rounded-[4px] border-[1.5px] border-outline px-2 py-0.5 type-label-small text-on-surface-variant">
              {schema === "junioren" ? "Juniorenfussball" : "Kinderfussball"}
            </span>
          </div>
          <StufenField value={stufen} onChange={changeStufen} />
        </div>
      </Card>

      {/* Summenleiste */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-outline bg-surface-container px-4 py-3">
        <span className="inline-flex items-center gap-2 type-title-medium text-on-surface">
          <Clock size={18} strokeWidth={2} aria-hidden />
          Gesamtdauer: {formatDuration(totalDuration)}
        </span>
        {totalMissing > 0 && (
          <span className="type-label-medium text-on-surface-variant">
            {totalMissing} {totalMissing === 1 ? "Übung ohne" : "Übungen ohne"} Dauer
          </span>
        )}
      </div>

      {TRAININGSTEILE.map(({ slug, label }) => {
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
            TRAININGSTEILE.find((t) => t.slug === open.teil)?.label ?? open.teil;
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

      {/* Nacharbeit: Fassungen, die beim Schema-Wechsel keinen Platz im neuen
          Schema fanden. Sie bleiben erhalten und blockieren nur die
          Veröffentlichung — der Trainer ordnet sie ein oder entfernt sie
          (Story 3 PC 3/4, Story 4 AC 9). */}
      {nacharbeit.length > 0 && (
        <Card className="border-error p-4 sm:p-5">
          <h2 className="type-title-medium text-error">Nacharbeit</h2>
          <p className="mt-1 type-body-small text-on-surface-variant">
            Diese Übungen haben im{" "}
            {schema === "junioren" ? "Juniorenschema" : "Kinderfussball-Schema"} keine
            Entsprechung. Ordne sie einem Block zu oder entferne sie — solange sie hier
            liegen, lässt sich das Training nicht veröffentlichen.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {nacharbeit.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-outline px-3 py-2"
              >
                <span className="type-body-medium text-on-surface">{item.name}</span>
                <span className="flex items-center gap-1">
                  <Link
                    href={`/training/${training.id}/uebung/${item.id}`}
                    className="focus-ring rounded-[4px] px-2 py-1 type-label-medium text-on-surface-variant hover:bg-on-surface/8"
                  >
                    Einordnen
                  </Link>
                  <IconButton
                    label={`${item.name} entfernen`}
                    onClick={() => remove(item)}
                    icon={Trash2}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Schema-Wechsel bestätigen. Der Dialog sagt vorher, was danach anders
          ist: was keinen Platz findet, was zum Veröffentlichen noch fehlt —
          und dass der Weg zurück nichts kostet (Story 3 AC 5/6). */}
      {wechsel && (
        <Dialog
          open
          onClose={() => setWechsel(null)}
          title={
            wechsel.ziel === "junioren"
              ? "Auf das Juniorenschema wechseln?"
              : "Auf das Kinderfussball-Schema wechseln?"
          }
          actions={
            <>
              <Button variant="text" onClick={() => setWechsel(null)}>
                Abbrechen
              </Button>
              <Button
                onClick={() => {
                  const next = wechsel.stufen;
                  setWechsel(null);
                  speichereStufen(next);
                }}
              >
                Schema wechseln
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <p className="type-body-medium text-on-surface-variant">
              Deine Übungen wandern in die Struktur des{" "}
              {wechsel.ziel === "junioren" ? "Juniorenfussballs" : "Kinderfussballs"}. Du
              kannst jederzeit zurückwechseln — deine bisherige Gliederung wird dabei
              wiederhergestellt.
            </p>
            {wechsel.ohneEntsprechung.length > 0 && (
              <div>
                <p className="type-label-large text-on-surface">
                  Ohne Entsprechung im neuen Schema
                </p>
                <p className="type-body-small text-on-surface-variant">
                  Diese Übungen bleiben erhalten und landen in der Nacharbeit:
                </p>
                <ul className="mt-1 list-inside list-disc type-body-small text-on-surface-variant">
                  {wechsel.ohneEntsprechung.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
            {wechsel.fehlendeBloecke.length > 0 && (
              <div>
                <p className="type-label-large text-on-surface">
                  Zum Veröffentlichen fehlt danach
                </p>
                <p className="type-body-small text-on-surface-variant">
                  {wechsel.fehlendeBloecke
                    .map((b) => juniorenBlockLabels[b as JuniorenBlockSlug])
                    .join(", ")}
                  . Solche Übungen erfasst du selbst im Übungspool.
                </p>
              </div>
            )}
          </div>
        </Dialog>
      )}

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
