"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, TriangleAlert } from "lucide-react";
import { Dialog, KategorieChip, HerkunftBadge, FilterChip, IconButton } from "@/components/ui";
import { addTrainingExercise, pickExercises } from "@/lib/actions/trainings";
import { stufenAbgedeckt } from "@/lib/training";
import {
  erscheinungsform as erscheinungsformLabels,
  erscheinungsform_junioren as formJuniorenLabels,
  uebungstyp as uebungstypLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import { ERSCHEINUNGSFORM_TEILE } from "@/lib/labels";
import type { Einordnung } from "@/lib/junioren";
import type { ExerciseListRow } from "@/lib/queries/exercises";

/** Beide Erscheinungsform-Vokabulare als eine flache Liste (Story 12). */
const alleFormLabels: Record<string, string> = {
  ...erscheinungsformLabels,
  ...formJuniorenLabels,
};

/* Übungs-Picker als Modal über dem Editor (Story #10). Lädt die für den USER
   sichtbaren Übungen des Trainingsteils serverseitig (RLS), eingrenzbar nach
   Erscheinungsform und Freitext. Im Hauptteil ist der Picker auf eine
   Hauptteilkategorie fixiert (Story #23): er zeigt nur Übungen dieser
   Unterkategorie. Auswahl persistiert sofort; das Panel bleibt für
   Mehrfachauswahl offen. */
export function ExercisePickerDialog({
  open,
  onClose,
  trainingId,
  trainingsteil,
  trainingsteilLabel,
  hauptteilkategorie,
  hauptteilkategorieLabel,
  trainingStufen,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  trainingId: string;
  /** Ziel-Einordnung: ein Kinderfussball-Trainingsteil oder ein
   *  Junioren-Unterblock (Epic #71). */
  trainingsteil: Einordnung;
  trainingsteilLabel: string;
  /** Im Hauptteil: die fixierte Unterkategorie, sonst undefined. */
  hauptteilkategorie?: string;
  hauptteilkategorieLabel?: string;
  trainingStufen: string[];
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [form, setForm] = useState<string[]>([]);
  // Übungstyp-Filter auch hier, nicht nur im Katalog (Story 9 AC 6).
  const [typ, setTyp] = useState<string[]>([]);
  const [results, setResults] = useState<ExerciseListRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Wie oft der USER eine Vorlage in dieser Sitzung übernommen hat — reine
  // Rückmeldung, dass der Klick angekommen ist. Es ist bewusst keine Aussage
  // über den Trainingsinhalt: jede Übernahme erzeugt eine eigenständige Fassung,
  // die danach frei bearbeitet und verschoben werden kann, und ist ihrer Vorlage
  // nicht mehr zugeordnet.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  // Mutationen werden serialisiert (eine nach der anderen): die Position
  // berechnet der Server aus max(position)+1, parallele Inserts würden sonst auf
  // der Positions-Unique kollidieren.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inFlightRef = useRef(0);

  // Erscheinungsformen tragen nicht alle Einordnungen — der Filter erscheint
  // nur, wo er etwas findet (Story 12 Out of Scope 5).
  const hatErscheinungsform = ERSCHEINUNGSFORM_TEILE.has(trainingsteil);

  // Beim Öffnen und Schliessen Filter, Suche und Sitzungszählung zurücksetzen.
  useEffect(() => {
    setQ("");
    setForm([]);
    setCounts({});
    setError(null);
  }, [open]);

  // Übungen laden (debounced auf den Suchbegriff).
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const rows = await pickExercises(trainingsteil, {
        typ,
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
    // Funktionales Update: der frühere Ref-Spiegel stammte aus der entfernten
    // «−»-Mechanik und ist ohne synchrone Guards nicht mehr nötig.
    setCounts((c) => ({ ...c, [id]: (c[id] ?? 0) + delta }));
  }

  /** Vorlage als eigenständige Fassung ins Training übernehmen. Der Picker fügt
   *  nur hinzu — entfernt wird im Trainings-Editor (Story 4 AK 6/7). */
  function add(ex: ExerciseListRow) {
    setError(null);
    // Zählung sofort hochsetzen → sichtbare Rückmeldung, ohne auf den Server
    // zu warten; bei einem Fehlschlag wird sie zurückgenommen.
    bump(ex.id, +1);
    inFlightRef.current += 1;
    queueRef.current = queueRef.current.then(async () => {
      const res = await addTrainingExercise(trainingId, trainingsteil, ex.id, hauptteilkategorie);
      inFlightRef.current -= 1;
      if (!res.ok) {
        bump(ex.id, -1);
        setError(res.error ?? "Übung konnte nicht hinzugefügt werden.");
      }
      // Editor hinter dem Modal erst aktualisieren, wenn die Klick-Salve durch
      // ist (vermeidet mehrfaches Neuladen bei schnellen Klicks).
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
            {Object.entries(alleFormLabels).map(([slug, label]) => (
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

        {/* Übungstyp-Filter — gilt in jedem Block (Story 9 AC 6). */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(uebungstypLabels).map(([slug, label]) => (
            <FilterChip
              key={slug}
              selected={typ.includes(slug)}
              onClick={() => toggle(typ, setTyp, slug)}
            >
              {label}
            </FilterChip>
          ))}
        </div>

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
              const mismatch = !stufenAbgedeckt(trainingStufen, ex.kategorien);
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
                          aria-label="Deckt keine der Trainings-Stufen ab"
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

                  {/* Nur Hinzufügen; die Zahl zeigt die Übernahmen dieser Sitzung. */}
                  <span className="flex shrink-0 items-center gap-1">
                    {count > 0 && (
                      <span
                        aria-hidden
                        className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary px-1.5 type-label-medium font-semibold leading-none text-on-primary"
                      >
                        {count}×
                      </span>
                    )}
                    <IconButton
                      icon={Plus}
                      label={
                        count > 0
                          ? `${ex.name} noch einmal übernehmen (in dieser Sitzung ${count}× übernommen)`
                          : `${ex.name} übernehmen`
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
