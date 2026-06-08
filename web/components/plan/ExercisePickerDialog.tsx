"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Plus, Search, TriangleAlert } from "lucide-react";
import { Dialog, KategorieChip, HerkunftBadge, FilterChip } from "@/components/ui";
import { addPlanExercise, pickExercises } from "@/lib/actions/plans";
import { stufenAbgedeckt } from "@/lib/plan";
import { FAHRPLAN_TEILE } from "@/lib/labels";
import {
  erscheinungsform as erscheinungsformLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
  type KategorieSlug,
  type TrainingsteilSlug,
} from "@/lib/vocab";
import type { ExerciseListRow } from "@/lib/queries/exercises";

/* Übungs-Picker als Modal über dem Editor (Story #10). Lädt die für den USER
   sichtbaren Übungen des Trainingsteils serverseitig (RLS), eingrenzbar nach
   Erscheinungsform, Hauptteilkategorie (nur Hauptteil) und Freitext. Auswahl
   persistiert sofort; das Panel bleibt für Mehrfachauswahl offen. */
export function ExercisePickerDialog({
  open,
  onClose,
  planId,
  trainingsteil,
  trainingsteilLabel,
  planStufen,
  addedExerciseIds,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  planId: string;
  trainingsteil: TrainingsteilSlug;
  trainingsteilLabel: string;
  planStufen: string[];
  addedExerciseIds: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<string[]>([]);
  const [hkat, setHkat] = useState<string[]>([]);
  const [results, setResults] = useState<ExerciseListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState<Set<string>>(new Set());
  const reqId = useRef(0);

  const hatErscheinungsform = FAHRPLAN_TEILE.has(trainingsteil);
  const istHauptteil = trainingsteil === "hauptteil";

  // Beim Schliessen Filter/Suche zurücksetzen, damit ein erneutes Öffnen frisch
  // startet.
  useEffect(() => {
    if (!open) {
      setQ("");
      setForm([]);
      setHkat([]);
      setJustAdded(new Set());
    }
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
        hkat: hkat.length ? hkat : undefined,
      });
      // Veraltete Antworten verwerfen (Race bei schneller Eingabe).
      if (id === reqId.current) {
        setResults(rows);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, form, hkat, trainingsteil]);

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  function add(ex: ExerciseListRow) {
    startTransition(async () => {
      const res = await addPlanExercise(planId, trainingsteil, ex.id);
      if (res.ok) {
        setJustAdded((s) => new Set(s).add(ex.id));
        onAdded();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Übung hinzufügen — ${trainingsteilLabel}`}
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

        {/* Hauptteilkategorie-Filter (nur Hauptteil, #23) */}
        {istHauptteil && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(hauptteilkategorieLabels).map(([slug, label]) => (
              <FilterChip
                key={slug}
                selected={hkat.includes(slug)}
                onClick={() => toggle(hkat, setHkat, slug)}
              >
                {label}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Trefferliste */}
        <ul className="-mx-2 max-h-[min(24rem,50vh)] overflow-y-auto">
          {loading && results.length === 0 ? (
            <li className="px-2 py-6 text-center type-body-medium text-on-surface-variant">
              Lädt…
            </li>
          ) : results.length === 0 ? (
            <li className="px-2 py-6 text-center type-body-medium text-on-surface-variant">
              Keine passende Übung gefunden.
            </li>
          ) : (
            results.map((ex) => {
              const added = addedExerciseIds.includes(ex.id) || justAdded.has(ex.id);
              const mismatch = !stufenAbgedeckt(planStufen, ex.kategorien);
              return (
                <li key={ex.id}>
                  <button
                    type="button"
                    onClick={() => add(ex)}
                    disabled={pending}
                    className="focus-ring flex w-full items-center gap-3 rounded-[4px] px-2 py-2.5 text-left transition-colors hover:bg-on-surface/8 disabled:opacity-60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
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
                    <span
                      className="shrink-0 text-on-surface-variant"
                      aria-hidden
                    >
                      {added ? <Check size={20} className="text-primary" /> : <Plus size={20} />}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Dialog>
  );
}
