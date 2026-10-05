"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import {
  Dialog,
  KategorieChip,
  HerkunftBadge,
  AuswahlFilter,
  ButtonLink,
  UebungsBild,
  Zaehler,
  Badge,
  Banner,
  FilterSuche,
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
      /* Breiter als die 28rem des Kit-Dialogs: Er trägt ein Raster aus
         Karten, drei nebeneinander, wie die Diagramm-Vorlagen. */
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

        {/* Suche und Filter aus dem Kit, in einer umbrechenden Zeile wie auf
            den Übersichten (Epic #363). Die Suche trägt im Dialog eine
            Kontur, ohne eigene Fläche — der Dialoggrund bleibt stehen.
            Welche Filter überhaupt erscheinen, entscheidet dasselbe Gating wie
            am Übungsformular: Erscheinungsformen tragen nicht alle
            Einordnungen, den Übungstyp kennt nur der Juniorenfussball, dort nur
            in den Blöcken mit Spielformen (Story 9 AC 6). Die Erscheinungsformen
            des Juniorenschemas sind ganze Sätze; das Panel ist darum breiter als
            sein Knopf, und jeder Satz bleibt ganz lesbar. */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSuche label="Übungen durchsuchen" initial={q} onCommit={setQ} />
          {hatErscheinungsform && (
            <AuswahlFilter label="Erscheinungsform" options={formen} value={form} onChange={setForm} />
          )}
          {hatUebungstyp && (
            <AuswahlFilter label="Übungstyp" options={uebungstypOptionen} value={typ} onChange={setTyp} />
          )}
        </div>

        {error && <Banner tone="fehler">{error}</Banner>}

        {/* Die Treffer als Raster aus Karten, wie die Diagramm-Vorlagen
            (PO 2026-10-05): vorne, was zeigt, ob die Übung passt — Diagramm
            oder Bild und der Name —, danach Alterskategorien und Herkunft.
            Eine Karte ist ein Knopf und übernimmt die Übung; die Zahl zeigt
            die Übernahmen dieser Sitzung.

            Die Mindesthöhe gibt dem Dialog seine Statur: Ohne sie fällt er auf
            seinen Inhalt zusammen, sobald die Liste kurz oder leer ist — und
            dann bleibt den Filtern darüber so wenig Raum, dass ihr Panel auf
            zwei Zeilen zusammenschnurrt oder nach oben über den Titel klappt.
            Sie hält ausserdem die Höhe ruhig: Der Dialog springt beim
            Eingrenzen nicht auf und zu. Nach oben gedeckelt; beide Schranken
            weichen auf kleinen Schirmen dem Sichtfeld. Auf einem Telefon im
            Querformat wird der Dialog höher als das Sichtfeld und scrollt —
            ein Training wird am Schreibtisch oder im Hochformat
            zusammengestellt. */}
        <div className="-mx-1 flex min-h-[min(20rem,45vh)] max-h-[min(28rem,55vh)] flex-col overflow-y-auto px-1 py-1">
          {loading && results.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-6 text-center type-body-medium text-on-surface-mittel">
              Lädt…
            </p>
          ) : results.length === 0 ? (
            // `flex-1` zentriert die Meldung im nun hohen Kasten — am oberen
            // Rand eines leeren Kastens sähe sie wie ein Rest aus.
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center type-body-medium text-on-surface-mittel">
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
                  <ButtonLink
                    variant="text"
                    // Im Kinderfussball-Hauptteil kennt der Block seine Kategorie;
                    // sie reist mit, sonst stünde das Einordnungsfeld leer da.
                    href={`/neu?stufe=${altersstufe}&teil=${trainingsteil}${
                      hauptteilkategorie ? `&kategorie=${hauptteilkategorie}` : ""
                    }`}
                  >
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Übung erfassen
                  </ButtonLink>
                </>
              )}
            </div>
          ) : (
            <ul className="grid grid-cols-2 content-start gap-3 sm:grid-cols-3">
              {results.map((ex) => {
                const count = counts[ex.id] ?? 0;
                const mismatch = !stufenAbgedeckt(trainingStufen, ex.kategorien);
                return (
                  <li key={ex.id}>
                    <button
                      type="button"
                      onClick={() => add(ex)}
                      aria-label={
                        count > 0
                          ? `${ex.name} noch einmal übernehmen (in dieser Sitzung ${count}× übernommen)`
                          : `${ex.name} übernehmen`
                      }
                      className="focus-ring state flex w-full flex-col overflow-hidden rounded-flaeche border border-linie text-left"
                    >
                      <span className="relative block aspect-[16/10] w-full border-b border-linie">
                        <UebungsBild
                          name={ex.name}
                          bildUrl={ex.bild_url}
                          diagramm={ex.diagramm}
                          bildQuelle={ex.bild_quelle}
                          sizes="(min-width: 640px) 16rem, 50vw"
                        />
                        {count > 0 && (
                          <Zaehler className="absolute right-1.5 top-1.5">{count}×</Zaehler>
                        )}
                      </span>
                      <span className="flex flex-col gap-1.5 p-2">
                        <span className="flex items-center gap-1.5">
                          <span className="min-w-0 flex-1 truncate type-body-medium text-on-surface">
                            {ex.name}
                          </span>
                          {mismatch && (
                            <TriangleAlert
                              size={14}
                              className="shrink-0 text-primary"
                              aria-label={STUFE_ABWEICHEND_TEXT}
                            />
                          )}
                          <Plus
                            size={16}
                            strokeWidth={2}
                            aria-hidden
                            className="shrink-0 text-on-surface-mittel"
                          />
                        </span>
                        <span className="flex flex-wrap items-center gap-1">
                          {(ex.kategorien as KategorieSlug[]).map((k) => (
                            <KategorieChip key={k} k={k} />
                          ))}
                          <HerkunftBadge herkunft={ex.source} visibility={ex.visibility} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Dialog>
  );
}
