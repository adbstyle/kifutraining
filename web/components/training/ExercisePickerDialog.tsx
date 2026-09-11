"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, TriangleAlert } from "lucide-react";
import {
  Dialog,
  KategorieChip,
  HerkunftBadge,
  FilterChip,
  IconButton,
  Badge,
} from "@/components/ui";
import { addTrainingExercise, pickExercises } from "@/lib/actions/trainings";
import { stufenAbgedeckt } from "@/lib/training";
import {
  altersstufe as altersstufeLabels,
  uebungstyp as uebungstypLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import {
  erscheinungsformenFuer,
  traegtErscheinungsform,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";
import { ERSCHEINUNGSFORM_LABEL } from "@/lib/labels";
import type { Einordnung } from "@/lib/junioren";
import type { ExerciseListRow } from "@/lib/queries/exercises";

/* Übungs-Picker als Modal über dem Editor (Story #10). Lädt die für den USER
   sichtbaren Übungen des Zielblocks serverseitig (RLS), eingrenzbar nach
   Erscheinungsform, Übungstyp und Freitext. Der angebotene Bestand ist doppelt
   eingegrenzt: auf die Altersstufe des Trainings und auf den Zielblock
   (Story 6 AK 1/2, Übungswelten) — im Kinderfussball-Hauptteil zusätzlich auf
   die fixierte Unterkategorie (Story #23). Auswahl persistiert sofort; das
   Panel bleibt für Mehrfachauswahl offen. */
export function ExercisePickerDialog({
  open,
  onClose,
  trainingId,
  altersstufe,
  trainingsteil,
  trainingsteilLabel,
  hauptteilkategorie,
  hauptteilkategorieLabel,
  varianteId,
  trainingStufen,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  trainingId: string;
  /** Die Altersstufe des Trainings. Sie bestimmt, welcher Bestand und welches
   *  Filtervokabular überhaupt in Frage kommen. Für die Anzeige — der Server
   *  liest sie beim Laden und beim Zuordnen selbst aus dem Training. */
  altersstufe: Altersstufe;
  /** Ziel-Einordnung: ein Kinderfussball-Trainingsteil oder ein
   *  Junioren-Unterblock (Epic #71). */
  trainingsteil: Einordnung;
  trainingsteilLabel: string;
  /** Im Kinderfussball-Hauptteil: die fixierte Unterkategorie, sonst undefined. */
  hauptteilkategorie?: string;
  hauptteilkategorieLabel?: string;
  /** Im Hauptteil: die Variante, in die die Übung kommt (#201 AK 8). Der Editor
   *  gibt die angezeigte mit; ausserhalb des Hauptteils bleibt sie leer, dort
   *  gilt die Übung für alle Varianten. */
  varianteId?: string;
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

  // Welches Ziel der Picker füllt — im Kinderfussball-Hauptteil Block und
  // Unterkategorie zusammen. Ein Text für Titel und Leermeldung.
  const zielLabel = hauptteilkategorieLabel
    ? `${trainingsteilLabel} · ${hauptteilkategorieLabel}`
    : trainingsteilLabel;

  // Angeboten wird nur, was hier auch etwas findet: Erscheinungsformen tragen
  // nicht alle Einordnungen, und den Übungstyp kennt nur der Juniorenfussball,
  // dort nur in den Blöcken mit Spielformen. Beides entscheidet die Altersstufe
  // des Trainings — dieselben Funktionen, nach denen das Übungsformular seine
  // Felder zeigt.
  const hatErscheinungsform = traegtErscheinungsform(altersstufe, trainingsteil);
  const hatUebungstyp = traegtUebungstyp(altersstufe, trainingsteil);
  const formen = erscheinungsformenFuer(altersstufe);

  // Ist der leere Bestand eine Folge der Eingrenzung — oder gibt es für diesen
  // Block schlicht noch keine Übung? Die beiden Fälle brauchen verschiedene
  // Auswege (Story 6 AK 3).
  const filterAktiv = !!q.trim() || form.length > 0 || typ.length > 0;

  // Beim Öffnen und Schliessen Filter, Suche und Sitzungszählung zurücksetzen.
  useEffect(() => {
    setQ("");
    setForm([]);
    setTyp([]);
    setCounts({});
    setError(null);
  }, [open]);

  // Übungen laden (debounced auf den Suchbegriff).
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      // Die Altersstufe wird bewusst nicht mitgegeben: der Server liest sie am
      // Training selbst (Story 6 AK 4).
      const rows = await pickExercises(
        trainingId,
        trainingsteil,
        // Im Kinderfussball-Hauptteil auf die fixierte Unterkategorie
        // eingrenzen (harte Regel, Story #23).
        hauptteilkategorie ?? null,
        {
          typ: typ.length ? typ : undefined,
          q: q.trim() || undefined,
          form: form.length ? form : undefined,
        },
      );
      // Veraltete Antworten verwerfen (Race bei schneller Eingabe).
      if (id === reqId.current) {
        setResults(rows);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, form, typ, hauptteilkategorie, trainingsteil, trainingId]);

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
      const res = await addTrainingExercise(
        trainingId,
        trainingsteil,
        ex.id,
        hauptteilkategorie,
        varianteId,
      );
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
      title={`Übung hinzufügen — ${zielLabel}`}
      className="w-[min(42rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        {/* Aus welcher Welt hier gewählt wird. Beide Schemata kennen einen
            „Hauptteil" — ohne die Altersstufe sagt der Titel allein nicht,
            welcher gemeint ist. Derselbe neutrale Badge wie im Editor-Kopf:
            die Altersstufe ist keine Alterskategorie. */}
        <div className="-mt-1">
          <Badge tone="neutral">{altersstufeLabels[altersstufe]}</Badge>
        </div>

        {/* Suche. Offen statt gefüllt: Das Feld liegt im Dialog, und eine
            eigene Fläche darunter ginge in der Höhenleiter abwärts — die
            Kontur umreisst es, der Dialoggrund bleibt stehen. */}
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-mittel"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Übungen durchsuchen…"
            aria-label="Übungen durchsuchen"
            className="focus-ring w-full rounded-flaeche kontur border-kante bg-transparent py-2.5 pl-10 pr-3 type-body-medium text-on-surface placeholder:text-on-surface-mittel"
          />
        </label>

        {/* Erscheinungsform-Filter — nur das Vokabular dieser Altersstufe und
            nur in Einordnungen, die überhaupt eine tragen. */}
        {hatErscheinungsform && (
          <div className="flex flex-wrap gap-2">
            {formen.map((slug) => (
              <FilterChip
                key={slug}
                selected={form.includes(slug)}
                onClick={() => toggle(form, setForm, slug)}
              >
                {ERSCHEINUNGSFORM_LABEL[slug] ?? slug}
              </FilterChip>
            ))}
          </div>
        )}

        {/* Übungstyp-Filter — nur wo eine Übung überhaupt einen tragen kann:
            im Juniorenfussball, und dort nur in den Blöcken mit Spielformen
            (Story 9 AC 6, eingegrenzt durch Story 3/6 der Übungswelten). */}
        {hatUebungstyp && (
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
        )}

        {error && (
          <p
            role="alert"
            className="kontur rounded-flaeche border-error bg-transparent px-3 py-2 type-label-medium text-error"
          >
            {error}
          </p>
        )}

        {/* Trefferliste */}
        <ul className="-mx-2 max-h-[min(24rem,50vh)] overflow-y-auto">
          {loading && results.length === 0 ? (
            <li className="px-2 py-6 text-center type-body-medium text-on-surface-mittel">
              Lädt…
            </li>
          ) : results.length === 0 ? (
            <li className="flex flex-col items-center gap-3 px-2 py-6 text-center type-body-medium text-on-surface-mittel">
              {filterAktiv ? (
                // Eingegrenzt: es gibt hier etwas, nur nicht das Gesuchte.
                "Keine passende Übung gefunden."
              ) : (
                // Der sichtbare Bestand dieser Altersstufe hält für diesen
                // Block gar nichts bereit (Story 6 AK 3). Das ist im
                // Juniorenfussball der Normalfall zu Beginn: Die Trennung der
                // Altersstufen hat den Manual-Bestand des Kinderfussballs hier
                // herausgenommen — der eigene Bestand entsteht erst.
                <>
                  <span>
                    Für „{zielLabel}" gibt es in deinem sichtbaren Bestand noch keine
                    Übung der Altersstufe {altersstufeLabels[altersstufe]}. Erfasse
                    zuerst eine.
                  </span>
                  <Link
                    href={`/neu?stufe=${altersstufe}&teil=${trainingsteil}`}
                    className="state focus-ring inline-flex items-center gap-1.5 rounded-flaeche px-3 py-1.5 type-label-large text-primary"
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Übung erfassen
                  </Link>
                </>
              )}
            </li>
          ) : (
            results.map((ex) => {
              const count = counts[ex.id] ?? 0;
              const mismatch = !stufenAbgedeckt(trainingStufen, ex.kategorien);
              return (
                <li
                  key={ex.id}
                  className="state flex items-center gap-2 rounded-flaeche px-2"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate type-body-medium text-on-surface">
                        {ex.name}
                      </span>
                      {mismatch && (
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-primary"
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
                        className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary px-1.5 type-plakette text-on-primary"
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
