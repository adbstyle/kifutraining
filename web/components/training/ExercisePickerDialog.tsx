"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, TriangleAlert } from "lucide-react";
import {
  Dialog,
  KategorieChip,
  HerkunftBadge,
  MultiSelect,
  IconButton,
  Badge,
  Meldung,
  SearchField,
} from "@/components/ui";
import { addTrainingExercise, pickExercises } from "@/lib/actions/trainings";
import {
  KEINE_PASSENDE_UEBUNG,
  STUFE_ABWEICHEND_TEXT,
  leerBestandText,
  stufenAbgedeckt,
  zielLabel,
} from "@/lib/training";
import {
  altersstufe as altersstufeLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import {
  erscheinungsformOptionen,
  uebungstypOptionen,
} from "@/lib/filter-optionen";
import {
  traegtErscheinungsform,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";
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
  hauptteilkategorie,
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
  /** Im Kinderfussball-Hauptteil: die fixierte Unterkategorie, sonst undefined. */
  hauptteilkategorie?: string;
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
  const ziel = zielLabel(trainingsteil, hauptteilkategorie);

  // Angeboten wird nur, was hier auch etwas findet: Erscheinungsformen tragen
  // nicht alle Einordnungen, und den Übungstyp kennt nur der Juniorenfussball,
  // dort nur in den Blöcken mit Spielformen. Beides entscheidet die Altersstufe
  // des Trainings — dieselben Funktionen, nach denen das Übungsformular seine
  // Felder zeigt.
  const hatErscheinungsform = traegtErscheinungsform(altersstufe, trainingsteil);
  const hatUebungstyp = traegtUebungstyp(altersstufe, trainingsteil);
  const formen = erscheinungsformOptionen(altersstufe);

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
      title={`Übung hinzufügen — ${ziel}`}
      /* Breiter als die 28rem des Kit-Dialogs. Der Dialog trägt eine
         Trefferliste, deren Zeilen Name, Alterskategorien und Herkunft
         nebeneinander führen, und darüber Felder, deren Optionen ganze Sätze
         sind — der längste misst 484 px. Mit 52rem bleiben innen 784 px: die
         Sätze passen ganz, und die Trefferzeilen bekommen Luft. */
      className="w-[min(52rem,calc(100vw-2rem))]"
    >
      <div className="flex flex-col gap-4">
        {/* Aus welcher Welt hier gewählt wird. Beide Schemata kennen einen
            „Hauptteil" — ohne die Altersstufe sagt der Titel allein nicht,
            welcher gemeint ist. Derselbe neutrale Badge wie im Editor-Kopf:
            die Altersstufe ist keine Alterskategorie. */}
        <div className="-mt-1">
          <Badge tone="neutral">{altersstufeLabels[altersstufe]}</Badge>
        </div>

        {/* Suche aus dem Kit. Offen statt gefüllt: Das Feld liegt im Dialog,
            und eine eigene Fläche darunter ginge in der Höhenleiter abwärts —
            die Kontur umreisst es, der Dialoggrund bleibt stehen. Dicht, weil
            der Dialog seine Höhe für die Trefferliste braucht. */}
        <SearchField
          dense
          label="Übungen durchsuchen"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {/* Die eingrenzenden Dimensionen als Mehrfachauswahl des Kits — eine
            umbrechende Zeile, beide Felder gleich breit. Aufgeklappte
            Chip-Reihen standen hier früher: Die Junioren-Erscheinungsformen
            sind ganze Sätze, elf davon füllten den Dialog, bevor die erste
            Übung zu sehen war. Die Trefferliste ist der Inhalt dieses Dialogs,
            nicht das Filtervokabular.
            Welche Felder überhaupt erscheinen, entscheidet dasselbe Gating wie
            am Übungsformular: Erscheinungsformen tragen nicht alle
            Einordnungen, den Übungstyp kennt nur der Juniorenfussball, dort nur
            in den Blöcken mit Spielformen (Story 9 AC 6).
            Anders als die Filterleiste des Katalogs behalten beide Felder die
            Suche im Panel (`searchable` bleibt auf seinem Vorgabewert): Im
            Dialog steht weniger Höhe zur Verfügung als auf der Katalogseite,
            und die langen Satz-Labels finden sich so schneller. Der Übungstyp
            mit seinen drei Werten braucht sie nicht, bekommt sie aber trotzdem
            — zwei Felder, von denen sich nur eines durchsuchen lässt, wären
            die grössere Irritation. */}
        {(hatErscheinungsform || hatUebungstyp) && (
          // Untereinander, nicht nebeneinander. Das Panel ist so breit wie sein
          // Feld, und die Erscheinungsformen des Juniorenschemas sind ganze
          // Sätze: Der längste braucht 484 px, nebeneinander blieben je 386 —
          // sieben von elf Optionen brachen am Ende ab. Über die volle Breite
          // passen alle elf. Zwei Felder nebeneinander unterzubringen wäre
          // Ökonomie auf Kosten dessen, was in ihnen steht.
          <div className="flex flex-col gap-3">
            {hatErscheinungsform && (
              <MultiSelect
                label="Erscheinungsform"
                options={formen}
                value={form}
                onChange={setForm}
                placeholder="Alle Erscheinungsformen"
              />
            )}
            {hatUebungstyp && (
              <MultiSelect
                label="Übungstyp"
                options={uebungstypOptionen}
                value={typ}
                onChange={setTyp}
                placeholder="Alle Übungstypen"
              />
            )}
          </div>
        )}

        {error && <Meldung tone="fehler">{error}</Meldung>}

        {/* Trefferliste. Die Mindesthöhe ist das, was dem Dialog seine Statur
            gibt: Ohne sie fällt er auf seinen Inhalt zusammen, sobald die Liste
            kurz oder leer ist — und dann bleibt der Mehrfachauswahl darüber so
            wenig Raum, dass ihr Panel auf zwei Zeilen zusammenschnurrt oder
            nach oben über den Titel klappt. Sie hält ausserdem die Höhe ruhig:
            Der Dialog springt beim Eingrenzen nicht mehr auf und zu.
            Nach oben gedeckelt bleibt sie wie bisher; beide Schranken weichen
            auf kleinen Schirmen dem Sichtfeld.
            Bewusst in Kauf genommen: Auf einem Telefon im Querformat (gemessen
            844×390) wird der Dialog höher als das Sichtfeld und scrollt — von
            der Trefferliste steht dann nur noch eine Zeile im Bild. Die feste
            Kopfzone aus Titel, Badge, Suchfeld und den zwei Feldern misst rund
            290 px und schrumpft nicht mit. Die Felder dafür erst ab einer
            Sichtfeldhöhe zu stapeln hiesse, im Querformat das Abschneiden der
            Optionen zurückzuholen — ein Tausch, kein Gewinn. Ein Training wird
            am Schreibtisch oder im Hochformat zusammengestellt; dort stimmt
            das Bild. */}
        <ul className="-mx-2 flex min-h-[min(20rem,45vh)] max-h-[min(24rem,50vh)] flex-col overflow-y-auto">
          {loading && results.length === 0 ? (
            <li className="flex flex-1 items-center justify-center px-2 py-6 text-center type-body-medium text-on-surface-mittel">
              Lädt…
            </li>
          ) : results.length === 0 ? (
            // `flex-1` zentriert die Meldung in der nun hohen Liste — am oberen
            // Rand eines leeren Kastens sähe sie wie ein Rest aus.
            <li className="flex flex-1 flex-col items-center justify-center gap-3 px-2 py-6 text-center type-body-medium text-on-surface-mittel">
              {filterAktiv ? (
                // Eingegrenzt: es gibt hier etwas, nur nicht das Gesuchte.
                KEINE_PASSENDE_UEBUNG
              ) : (
                // Der sichtbare Bestand dieser Altersstufe hält für diesen
                // Block gar nichts bereit (Story 6 AK 3). Das ist im
                // Juniorenfussball der Normalfall zu Beginn: Die Trennung der
                // Altersstufen hat den Manual-Bestand des Kinderfussballs hier
                // herausgenommen — der eigene Bestand entsteht erst.
                <>
                  <span>{leerBestandText(ziel, altersstufe)} Erfasse zuerst eine.</span>
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
                /* Die Zustands-Ebene sitzt hier bewusst auf dem `<li>` und
                   nicht auf dem interaktiven Kind — anders als bei den Karten,
                   wo ein Link die ganze Fläche trägt. Die Zeile ist kein
                   Bedienelement: Sie ist nicht fokussierbar, hat keine Rolle
                   und löst nichts aus. Was `state` hier leistet, ist allein
                   die Zeigerspur über die volle Breite — Name links, Knopf
                   rechts —, damit sichtbar bleibt, welcher Übung der Knopf am
                   Rand gehört. Ein Fokus-Anteil wäre nicht halb, sondern falsch:
                   Die Tastatur landet auf dem Übernehmen-Knopf, und der trägt
                   seinen Ring und seine eigene Ebene (`IconButton`). */
                <li
                  key={ex.id}
                  /* `shrink-0`: Die Liste ist seit der Mindesthöhe ein
                     Flex-Container. Ohne die Schranke stauchten sich die Zeilen
                     bei vielen Treffern gegenseitig, statt dass die Liste
                     scrollt. */
                  className="state flex shrink-0 items-center gap-2 rounded-flaeche px-2"
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
                          aria-label={STUFE_ABWEICHEND_TEXT}
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
