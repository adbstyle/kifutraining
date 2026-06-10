"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Search, TriangleAlert } from "lucide-react";
import { Dialog, KategorieChip, HerkunftBadge, FilterChip, IconButton } from "@/components/ui";
import { addPlanExercise, removeOnePlanExercise, pickExercises } from "@/lib/actions/plans";
import { stufenAbgedeckt } from "@/lib/plan";
import { FAHRPLAN_TEILE } from "@/lib/labels";
import {
  erscheinungsform as erscheinungsformLabels,
  type KategorieSlug,
  type TrainingsteilSlug,
} from "@/lib/vocab";
import type { ExerciseListRow } from "@/lib/queries/exercises";

/* Übungs-Picker als Modal über dem Editor (Story #10). Lädt die für den USER
   sichtbaren Übungen des Trainingsteils serverseitig (RLS), eingrenzbar nach
   Erscheinungsform und Freitext. Im Hauptteil ist der Picker auf eine
   Hauptteilkategorie fixiert (Story #23): er zeigt nur Übungen dieser
   Unterkategorie. Auswahl persistiert sofort; das Panel bleibt für
   Mehrfachauswahl offen. */
export function ExercisePickerDialog({
  open,
  onClose,
  planId,
  trainingsteil,
  trainingsteilLabel,
  hauptteilkategorie,
  hauptteilkategorieLabel,
  planStufen,
  addedExerciseIds,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  planId: string;
  trainingsteil: TrainingsteilSlug;
  trainingsteilLabel: string;
  /** Im Hauptteil: die fixierte Unterkategorie, sonst undefined. */
  hauptteilkategorie?: string;
  hauptteilkategorieLabel?: string;
  planStufen: string[];
  addedExerciseIds: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<string[]>([]);
  const [results, setResults] = useState<ExerciseListRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Warenkorb-Zählung je Übung (exercise_id → Anzahl im Trainingsteil). Beim
  // Öffnen aus dem Plan befüllt und danach rein lokal/optimistisch gepflegt —
  // NICHT aus `addedExerciseIds` neu abgeleitet, da sich das per router.refresh()
  // während das Modal offen ist ändert (würde optimistische Klicks doppelt
  // zählen). `countsRef` spiegelt `counts` synchron für Guards bei schnellen
  // −/+-Klicks (Closures sähen sonst veralteten State).
  const [counts, setCounts] = useState<Record<string, number>>({});
  const countsRef = useRef<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  // Mutationen werden serialisiert (eine nach der anderen): die Position
  // berechnet der Server aus max(position)+1, parallele Inserts würden sonst auf
  // der Positions-Unique kollidieren.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightRef = useRef(0);

  // counts + Ref gemeinsam setzen, damit Guards synchron korrekt sind.
  function applyCounts(next: Record<string, number>) {
    countsRef.current = next;
    setCounts(next);
  }

  const hatErscheinungsform = FAHRPLAN_TEILE.has(trainingsteil);

  // Beim Schliessen Filter/Suche zurücksetzen; beim Öffnen die aktuelle Anzahl
  // je Übung als Warenkorb-Basis einfrieren. Absichtlich nur an `open` gebunden:
  // `addedExerciseIds` ändert sich durch router.refresh() während das Modal
  // offen ist — würde man dann neu zählen, erfasste man die optimistischen
  // Session-Adds doppelt.
  useEffect(() => {
    if (!open) {
      setQ("");
      setForm([]);
      applyCounts({});
      setError(null);
      return;
    }
    const base: Record<string, number> = {};
    for (const id of addedExerciseIds) base[id] = (base[id] ?? 0) + 1;
    applyCounts(base);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Übungen laden (debounced auf den Suchbegriff).
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const rows = await pickExercises(trainingsteil, {
        q: q.trim() || undefined,
        form: form.length ? form : undefined,
        // Im Hauptteil auf die fixierte Unterkategorie eingrenzen (harte Regel).
        hkat: hauptteilkategorie ? [hauptteilkategorie] : undefined,
      });
      // Veraltete Antworten verwerfen (Race bei schneller Eingabe).
      if (id === reqId.current) {
        setResults(rows);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, form, hauptteilkategorie, trainingsteil]);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function bump(id: string, delta: number) {
    applyCounts({ ...countsRef.current, [id]: (countsRef.current[id] ?? 0) + delta });
  }

  function add(ex: ExerciseListRow) {
    setError(null);
    // Optimistische Zählung sofort hochsetzen → sichtbares Warenkorb-Feedback.
    bump(ex.id, +1);
    inFlightRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      const res = await addPlanExercise(planId, trainingsteil, ex.id, hauptteilkategorie);
      inFlightRef.current -= 1;
      if (!res.ok) {
        bump(ex.id, -1); // optimistische Erhöhung zurücknehmen
        setError(res.error ?? "Übung konnte nicht hinzugefügt werden.");
      }
      // Editor hinter dem Modal erst aktualisieren, wenn die Klick-Salve durch
      // ist (vermeidet mehrfaches Neuladen bei schnellen Klicks).
      if (inFlightRef.current === 0) onAdded();
    });
  }

  function remove(ex: ExerciseListRow) {
    // Synchron gegen den Ref prüfen, damit schnelle „−"-Klicks nicht unter 0
    // laufen (Closures sähen sonst denselben veralteten Zählerstand).
    if ((countsRef.current[ex.id] ?? 0) <= 0) return;
    setError(null);
    bump(ex.id, -1);
    inFlightRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      const res = await removeOnePlanExercise(planId, trainingsteil, ex.id, hauptteilkategorie);
      inFlightRef.current -= 1;
      if (!res.ok) {
        bump(ex.id, +1); // optimistische Reduktion zurücknehmen
        setError(res.error ?? "Übung konnte nicht entfernt werden.");
      }
      if (inFlightRef.current === 0) onAdded();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Übung hinzufügen — ${
        hauptteilkategorieLabel
          ? `${trainingsteilLabel} · ${hauptteilkategorieLabel}`
          : trainingsteilLabel
      }`}
      className="w-[min(42rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        {/* Suche */}
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Übungen durchsuchen…"
            aria-label="Übungen durchsuchen"
            className="focus-ring w-full rounded-[4px] border-[1.5px] border-outline bg-surface-container-low py-2.5 pl-10 pr-3 type-body-medium text-on-surface placeholder:text-on-surface-variant"
          />
        </label>

        {/* Erscheinungsform-Filter (nur Trainingsteile, die eine tragen) */}
        {hatErscheinungsform && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(erscheinungsformLabels).map(([slug, label]) => (
              <FilterChip
                key={slug}
                selected={form.includes(slug)}
                onClick={() => toggle(form, setForm, slug)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-[4px] bg-error/10 px-3 py-2 type-label-medium text-error"
          >
            {error}
          </p>
        )}

        {/* Trefferliste */}
        <ul className="-mx-2 max-h-[min(24rem,50vh)] overflow-y-auto">
          {loading && results.length === 0 ? (
            <li className="px-2 py-6 text-center type-body-medium text-on-surface-variant">
              Lädt…
            </li>
          ) : results.length === 0 ? (
            <li className="px-2 py-6 text-center type-body-medium text-on-surface-variant">
              {hauptteilkategorieLabel && !q.trim() && form.length === 0
                ? `Für „${hauptteilkategorieLabel}" sind aktuell keine Übungen verfügbar.`
                : "Keine passende Übung gefunden."}
            </li>
          ) : (
            results.map((ex) => {
              const count = counts[ex.id] ?? 0;
              const mismatch = !stufenAbgedeckt(planStufen, ex.kategorien);
              return (
                <li
                  key={ex.id}
                  className="flex items-center gap-2 rounded-[4px] px-2 transition-colors hover:bg-on-surface/8"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate type-body-medium text-on-surface">
                        {ex.name}
                      </span>
                      {mismatch && (
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-signal"
                          aria-label="Deckt keine der Plan-Stufen ab"
                        />
                      )}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {(ex.kategorien as KategorieSlug[]).map((k) => (
                        <KategorieChip key={k} k={k} />
                      ))}
                      <HerkunftBadge herkunft={ex.source} visibility={ex.visibility} />
                    </span>
                  </span>

                  {/* Warenkorb-Stepper: −, Anzahl, + (− und Anzahl nur ab 1×). */}
                  <span className="flex shrink-0 items-center gap-1">
                    {count > 0 && (
                      <>
                        <IconButton
                          icon={Minus}
                          label={`${ex.name} einmal entfernen`}
                          onClick={() => remove(ex)}
                        />
                        <span
                          aria-hidden
                          className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary px-1.5 type-label-medium font-semibold leading-none text-on-primary"
                        >
                          {count}×
                        </span>
                      </>
                    )}
                    <IconButton
                      icon={Plus}
                      label={
                        count > 0
                          ? `${ex.name} noch einmal hinzufügen (aktuell ${count}× im Plan)`
                          : `${ex.name} hinzufügen`
                      }
                      onClick={() => add(ex)}
                    />
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Dialog>
  );
}
