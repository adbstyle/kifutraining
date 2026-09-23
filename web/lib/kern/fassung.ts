import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import {
  istAltersstufe,
  vorlagePasst,
  zielblock,
  type Altersstufe,
  type VorlagenFilter,
} from "@/lib/altersstufe";
import { istHauptteil } from "@/lib/gruppen";
import { zaehle } from "@/lib/labels";
import {
  KEINE_PASSENDE_UEBUNG,
  NOTIZ_MAX,
  leerBestandText,
  teilTraegtDauer,
  zielLabel,
} from "@/lib/training";
import { UEBUNGSFOLGE_MELDUNG } from "@/lib/training-bedingungen";
import { bildOrdnerFuer } from "@/lib/training-zugriff";
import {
  entferneFassungsBild,
  entferneStorageObjekt,
  inhaltFelder,
  kopiereBild,
  kopiereDiagrammVon,
  VORLAGE_SELECT,
} from "@/lib/fassung";
import {
  getExercisesFuer,
  type ExerciseFilters,
  type ExerciseListRow,
} from "@/lib/queries/uebungen-fuer";
import { istUuid } from "@/lib/kennung";
import {
  aktualisiereZeile,
  ladeFassungZumBearbeiten,
  ladeTrainingZumBearbeiten,
  ladeTrainingZumLesen,
} from "@/lib/kern/zugriff";
import {
  MELDUNG_WIEDERHOLEN,
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

/**
 * Fassungen: eine Vorlage ins Training übernehmen und die Vorlagen eines
 * Blocks finden (Story 4, Story 6, Story #134, #201, #192).
 *
 * Eine Regelquelle für den Picker der Oberfläche (`pickExercises`,
 * `addTrainingExercise`) und die KI-Werkzeuge «training_uebungen_fuer_block»
 * und «training_uebung_zuordnen». Beide Wege fragen dieselbe Funktion, ob ein
 * Block eine Vorlage annimmt (`zielblock` / `vorlagePasst`) — der
 * Picker kann darum nichts anbieten, was das Zuordnen danach abweist.
 */

/** Eine Bibliotheks-Übung, wie sie für das Kopieren gelesen wird (VORLAGE_SELECT). */
type Vorlage = {
  id: string;
  name: string;
  /** Nach welchem Lehrmittel die Vorlage geführt wird — der Guard beim
   *  Zuordnen prüft sie gegen die Altersstufe des Trainings (Story 6 AK 4). */
  altersstufe: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  /** Die Erscheinungsformen der Vorlage. Sie kommen als Inhaltsfeld ohnehin
   *  mit (`FASSUNG_INHALT_FELDER`); der Guard beim Zuordnen liest sie, weil ein
   *  Block auch über sie gefüllt werden darf (Story #134). */
  erscheinungsform: string[] | null;
  bild_url: string | null;
  diagramm: unknown;
} & Record<string, unknown>;

// ── Position ────────────────────────────────────────────────────────────────

/** Die nächste freie Position am Ende eines Abschnitts (Story 5 AK 7,
 *  #192 PC 3) — geteilt vom Zuordnen und vom Umordnen einer Fassung
 *  (`updateFassung`).
 *
 *  Der Abschnitt ist die Einordnung, im Kinderfussball-Hauptteil zusätzlich
 *  die Hauptteilkategorie, und im Hauptteil beider Altersstufen zusätzlich die
 *  VARIANTE (#201): Dieselbe Position existiert dort einmal je
 *  Zusammenstellung. Der Variantenfilter hängt an der EINORDNUNG, nicht an der
 *  Hauptteilkategorie — die Junioren-Hauptteilblöcke tragen keine
 *  Unterkategorie und führen trotzdem Varianten.
 *
 *  `ausser` lässt die Fassung selbst aus, wenn sie in einen anderen Abschnitt
 *  wandert. Gesperrt wird nicht: Zwei gleichzeitige Aufrufe können dieselbe
 *  Position rechnen — dann weist der Unique-Index `training_ex_pos_*` den
 *  zweiten ab (#192 NFR 5), nie überschreibt einer den anderen. */
export async function naechstePosition(
  supabase: SupabaseClient,
  a: {
    trainingId: string;
    einordnung: string;
    hauptteilkategorie: string | null;
    varianteId: string | null;
    ausser?: string;
  },
): Promise<number> {
  let q = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", a.trainingId)
    .eq("trainingsteil", a.einordnung);
  q = a.ausser ? q.neq("id", a.ausser) : q;
  q = a.hauptteilkategorie ? q.eq("hauptteilkategorie", a.hauptteilkategorie) : q;
  q = istHauptteil(a.einordnung) && a.varianteId ? q.eq("variante_id", a.varianteId) : q;
  const { data } = await q.order("position", { ascending: false }).limit(1).maybeSingle();
  return (data?.position ?? -1) + 1;
}

// ── Zuordnen ────────────────────────────────────────────────────────────────

export type UebungZuordnen = {
  trainingId: string;
  einordnung: string;
  exerciseId: string;
  hauptteilkategorie?: string | null;
  /** Die Variante des Hauptteils (#201 AK 8). Ohne Angabe die erste nach
   *  Position — dieselbe Regel wie der Trigger `te_variante_ausrichten`.
   *  Ausserhalb des Hauptteils ohne Bedeutung. */
  varianteId?: string | null;
};

/** Eine sichtbare Bibliotheks-Übung als eigenständige Fassung ans Ende ihres
 *  Abschnitts hängen (Story 4, #192 AK 6/7/9, PC 2/3/5/6).
 *
 *  Die Fassung trägt die Inhalte der Vorlage zum Übernahmezeitpunkt sowie
 *  eine eigene Bild- und Diagrammkopie; die Vorlage bleibt unberührt und hat
 *  danach keinen Einfluss mehr auf das Training. Die Prüfung hier ist die
 *  Trust-Boundary gegen jeden Aufruf, der den Picker umgeht (Story 6 AK 4).
 *  Die Datenebene fängt Stufenfremdes zusätzlich über
 *  `te_kategorien_je_altersstufe` und `te_trainingsteil_je_altersstufe` —
 *  hier geht es um die verständliche Meldung davor.
 *
 *  Scheitert eine Zuordnung, bleiben alle vorherigen unberührt (#192 PC 6):
 *  Jede ist ein eigener Insert. */
export async function ordneUebungZu(
  supabase: SupabaseClient,
  userId: string,
  e: UebungZuordnen,
): Promise<
  KernErgebnis<{
    trainingId: string;
    fassungId: string;
    position: number;
    varianteId: string | null;
    name: string;
  }>
> {
  // Schreibrecht prüfen (UX-Guard; RLS setzt es ohnehin serverseitig durch).
  // Team-Trainings sind für jedes Mitglied bearbeitbar (Story 6, Team-Epic) —
  // und ihre Bildkopien gehören in den Team-Ordner, nicht in den persönlichen.
  // Die Altersstufe kommt aus derselben Zeile: sie ist eine Eigenschaft des
  // Trainings und darf nie vom Aufrufer stammen.
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const { zeile, ziel } = zugriff.wert;

  // Erst benennen, was am Zielblock fehlt (#192 NFR 4) — danach kann der
  // Filter nicht mehr `null` sein.
  const block = blockFilter(zeile.altersstufe, e.einordnung, e.hauptteilkategorie);
  if (!block.ok) return block;
  const filter = block.wert;
  const hkat = filter.hauptteilkategorie ?? null;

  // Vorlage mit allen Inhalten holen (RLS lässt nur Sichtbares durch, #192 AK 10).
  if (!istUuid(e.exerciseId))
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.vorlage, { feld: "exercise_id" });
  const { data: ex, error: exFehler } = await supabase
    .from("exercises")
    .select(VORLAGE_SELECT)
    .eq("id", e.exerciseId)
    .maybeSingle<Vorlage>();
  if (exFehler) return ausDbFehler(exFehler);
  if (!ex) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.vorlage, { feld: "exercise_id" });
  // Passt die Vorlage zu diesem Block? Erst die Altersstufe — sie ist die
  // oberste Dimension, und ihre Verletzung braucht eine eigene Meldung: «passt
  // nicht zu diesem Block» liesse den Trainer einen anderen Block suchen, den
  // es für diese Übung gar nicht gibt.
  if (!istAltersstufe(ex.altersstufe) || ex.altersstufe !== filter.altersstufe)
    return fehlschlag(
      "regel",
      `Diese Übung gehört zur Altersstufe ${
        istAltersstufe(ex.altersstufe) ? altersstufeLabels[ex.altersstufe] : "einer anderen"
      } und passt darum nicht in ein Training der Altersstufe ${altersstufeLabels[filter.altersstufe]}.`,
      { feld: "exercise_id" },
    );
  // Einordnung ODER anziehende Erscheinungsform — dieselbe Entscheidung, die
  // der Picker als Abfrage stellt (`vorlagePasst` liest denselben Filter).
  if (!vorlagePasst(filter, ex))
    return fehlschlag("regel", "Übung passt nicht zu diesem Block.", { feld: "exercise_id" });

  // Die Variante auflösen — im Hauptteil beider Altersstufen. Die Position
  // zählt je Variante; wer sie offen lässt, bekommt die erste, wie der Trigger
  // es ohnehin täte — nur rechnet die Position dann schon richtig.
  const variante = await loeseVarianteAuf(supabase, e.trainingId, e.einordnung, e.varianteId, false);
  if (!variante.ok) return variante;
  const varianteId = variante.wert;

  const position = await naechstePosition(supabase, {
    trainingId: e.trainingId,
    einordnung: e.einordnung,
    hauptteilkategorie: hkat,
    varianteId,
  });

  // Die ID vorab erzeugen: sie benennt die Bildkopie, die VOR dem Insert
  // entstehen muss (der Pfad steht dann bereits in bild_url). Scheitert der
  // Insert, wird die Kopie wieder entfernt — nie eine Fassung ohne Inhalt.
  const fassungId = crypto.randomUUID();
  const bild = await kopiereBild(supabase, ex.bild_url, bildOrdnerFuer(ziel), fassungId);
  if (bild.error) return fehlschlag("technisch", bild.error, { wiederholbar: true });

  const { error } = await supabase.from("training_exercises").insert({
    id: fassungId,
    training_id: e.trainingId,
    trainingsteil: e.einordnung,
    hauptteilkategorie: hkat,
    // Nur im Hauptteil: ausserhalb würde der CHECK
    // `te_variante_genau_bei_hauptteil` greifen, und der Trigger nullt sie
    // ohnehin.
    ...(varianteId ? { variante_id: varianteId } : {}),
    position,
    ...inhaltFelder(ex),
    bild_url: bild.url,
    diagramm: kopiereDiagrammVon(ex.diagramm),
  });
  if (error) {
    await entferneStorageObjekt(supabase, bild.pfad);
    // Die Fassung hat eine frische ID — eine Kollision kann nur die Position
    // sein: Ein zweiter Aufruf hat sie gleichzeitig vergeben (#192 NFR 5).
    if (error.code === "23505")
      return fehlschlag("konflikt", MELDUNG_WIEDERHOLEN, { wiederholbar: true });
    // Übersetzt statt roh: Eine Übung, deren Werte nicht zur Altersstufe des
    // Trainings passen, weist die Datenebene als Constraint-Verletzung ab.
    return ausDbFehler(error);
  }

  return ok({ trainingId: e.trainingId, fassungId, position, varianteId, name: ex.name });
}

/** Die Variante eines Abschnitts auflösen — nur im Hauptteil beider
 *  Altersstufen, sonst `null` (dort gibt es keine Varianten, eine Angabe ist
 *  ohne Bedeutung).
 *
 *  Eine angegebene Variante muss zum Training gehören. Ohne Angabe gilt die
 *  erste nach Position — dieselbe Regel wie der Trigger
 *  `te_variante_ausrichten`; mit `pflichtAbZwei` ist die Angabe ab zwei
 *  Varianten Pflicht: Wer eine Reihenfolge setzt, muss wissen, welche
 *  Zusammenstellung er ordnet. */
async function loeseVarianteAuf(
  supabase: SupabaseClient,
  trainingId: string,
  einordnung: string,
  angabe: string | null | undefined,
  pflichtAbZwei: boolean,
): Promise<KernErgebnis<string | null>> {
  if (!istHauptteil(einordnung)) return ok(null);
  const { data: varianten, error } = await supabase
    .from("training_varianten")
    .select("id")
    .eq("training_id", trainingId)
    .order("position")
    .order("id");
  if (error) return ausDbFehler(error);
  const ids = (varianten ?? []).map((v) => v.id as string);
  if (angabe) {
    // Derselbe Text wie der Marker `VARIANTE_FREMDES_TRAINING` des Triggers.
    if (!ids.includes(angabe))
      return fehlschlag("regel", "Diese Variante gehört zu einem anderen Training.", {
        feld: "variante_id",
        zulaessig: ids,
      });
    return ok(angabe);
  }
  if (pflichtAbZwei && ids.length > 1)
    return fehlschlag(
      "eingabe",
      "Dieses Training führt mehrere Varianten des Hauptteils. Gib an, welche du ordnest.",
      { feld: "variante_id", zulaessig: ids },
    );
  return ok(ids[0] ?? null);
}

/** Zielblock prüfen (`zielblock`) — ein Problem wird zur Regel-Meldung. */
function blockFilter(
  stufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie: string | null | undefined,
): KernErgebnis<VorlagenFilter> {
  const z = zielblock(stufe, einordnung, hauptteilkategorie);
  if (!z.ok)
    return fehlschlag("regel", z.problem.text, {
      feld: z.problem.feld,
      zulaessig: z.problem.zulaessig,
    });
  return ok(z.filter);
}

// ── Vorlagen eines Blocks ───────────────────────────────────────────────────

export type VorlagenSuche = {
  trainingId: string;
  einordnung: string;
  hauptteilkategorie?: string | null;
  /** Nutzerfilter — sie grenzen die ganze Vorschlagsmenge weiter ein, egal
   *  woher ein Treffer kommt (Story #134 AC 6). `form` ist der
   *  Erscheinungsform-Filter des Trainers, nicht die Vorschlagsquelle. */
  form?: string[];
  typ?: string[];
  q?: string;
  /** Höchstens so viele Treffer; ohne Angabe alle. */
  limit?: number;
  /** Favoriten mitlesen? Die Oberfläche ja, ein KI-Zugang nie
   *  (`getExercisesFuer`). */
  favoriten?: boolean;
  /** Bei null Treffern den Grund bestimmen (#192 AK 8)? Kostet mit
   *  Nutzerfiltern eine zweite Abfrage — der Picker braucht das nicht, er
   *  kennt seine Filter selbst; nur das KI-Werkzeug setzt es. */
  mitLeerGrund?: boolean;
};

export type LeerGrund = {
  /** `bestand_leer`: der sichtbare Bestand führt für den Block gar nichts;
   *  `eingrenzung_zu_eng`: ohne Suchtext und Filter gäbe es Treffer (#192 AK 8). */
  grund: "bestand_leer" | "eingrenzung_zu_eng";
  text: string;
};

/** Die Übungen, die dieser Block annimmt (#192 AK 4/5/8/10) — dieselbe
 *  Abfrage, die der Picker stellt.
 *
 *  Die Altersstufe kommt aus dem Training, nie vom Aufrufer (Story 6 AK 4).
 *  Lesen genügt: Wer ein Training sieht, sieht auch, was hineinpasst. Bleibt
 *  die Liste mit Nutzerfiltern leer, läuft dieselbe Abfrage ein zweites Mal
 *  ohne sie — erst das unterscheidet «nichts da» von «zu eng gesucht». */
export async function vorlagenFuerBlock(
  supabase: SupabaseClient,
  userId: string | null,
  e: VorlagenSuche,
): Promise<KernErgebnis<{ treffer: ExerciseListRow[]; weitere: boolean; leer: LeerGrund | null }>> {
  const training = await ladeTrainingZumLesen(supabase, e.trainingId);
  if (!training.ok) return training;

  const block = blockFilter(training.wert.altersstufe, e.einordnung, e.hauptteilkategorie);
  if (!block.ok) return block;
  const filter = block.wert;

  const basis: ExerciseFilters = {
    altersstufe: filter.altersstufe,
    // Einordnung und anziehende Erscheinungsform als EINE ODER-Dimension: der
    // Block zeigt seinen eigenen Bestand plus die Übungen, die er anzieht
    // (Story #134 AC 1/2/4/5).
    einordnung: {
      teile: [filter.trainingsteil],
      formen: filter.erscheinungsformen ? [...filter.erscheinungsformen] : undefined,
    },
    // Die Hauptteilkategorie bleibt der harte UND-Filter: Sie grenzt eine
    // Kinderfussball-Hauptteil-Zuordnung auf die fixierte Unterkategorie ein
    // (Story #23), sie ist keine Alternative zur Einordnung.
    hkat: filter.hauptteilkategorie ? [filter.hauptteilkategorie] : undefined,
  };
  const opt = { favoriten: e.favoriten ?? true };
  const q = e.q?.trim() || undefined;
  const eingegrenzt = !!q || !!e.form?.length || !!e.typ?.length;
  const rows = await getExercisesFuer(
    supabase,
    userId,
    { ...basis, form: e.form, typ: e.typ, q },
    opt,
  );

  let leer: LeerGrund | null = null;
  if (e.mitLeerGrund && rows.length === 0) {
    const ohneFilter = eingegrenzt ? (await getExercisesFuer(supabase, userId, basis, opt)).length : 0;
    leer =
      ohneFilter > 0
        ? {
            grund: "eingrenzung_zu_eng",
            text: `${KEINE_PASSENDE_UEBUNG} Ohne Suchtext und Filter hält dieser Block ${zaehle(ohneFilter, "Übung", "Übungen")} bereit.`,
          }
        : {
            grund: "bestand_leer",
            text: leerBestandText(
              zielLabel(filter.trainingsteil, filter.hauptteilkategorie),
              filter.altersstufe,
            ),
          };
  }

  const limit = e.limit ?? rows.length;
  return ok({ treffer: rows.slice(0, limit), weitere: rows.length > limit, leer });
}

// ── Überarbeiten (Story #11, #12, #152, #193 AK 7–11, 13) ──────────────────
//
// Eine Regelquelle für die Editor-Zeile (`removeTrainingExercise`,
// `setExerciseDuration`, `setzeNotiz`) und die KI-Werkzeuge
// «training_uebung_entfernen», «…_dauer_setzen», «…_notiz_setzen»,
// «training_uebungen_ordnen». Kein Owner-Filter beim Schreiben — die RLS
// entscheidet, an einem Team-Training darf jedes Mitglied. Das Laden davor
// trennt «nicht sichtbar» von «fremd» (#193 AK 14); `select` nach dem
// Schreiben zeigt, ob wirklich eine Zeile getroffen wurde.

/** Ein Update auf genau diese Fassung (lib/kern/zugriff.ts). */
const aktualisiereFassung = (
  supabase: SupabaseClient,
  fassungId: string,
  werte: Record<string, unknown>,
) =>
  aktualisiereZeile(supabase, "training_exercises", fassungId, werte, {
    nichtGefunden: NICHT_GEFUNDEN.fassung,
    feld: "fassung_id",
  });

export type UebungEntfernt = {
  trainingId: string;
  name: string;
  einordnung: string;
  varianteId: string | null;
  /** Die Gruppen, die die Übung durchliefen, in Wechselreihenfolge — ihre
   *  Zuweisungen fallen mit (#193 AK 8, PC 2). */
  gruppen: string[];
  /** Trug die Übung eine Notiz? Sie fällt mit. */
  notizEntfiel: boolean;
};

/** Eine Übung aus dem Training entfernen (Story #12 AK 5, #193 AK 7/8, PC 2).
 *
 *  Was mitfällt — Gruppen im Durchlauf, Notiz —, wird VOR dem Löschen
 *  gelesen, denn danach gibt es nichts mehr zu lesen. Ohne Rückfrage
 *  (#193 OoS 5): Die Auskunft kommt mit dem Ergebnis.
 *
 *  War es die letzte Übung, die ein öffentliches Training braucht, weist die
 *  Datenebene ab (`bedingung`, samt Variante — der Editor nennt damit Variante
 *  und Block, #204 AK 3). Die eigene Bilddatei fällt erst nach erfolgreichem
 *  Löschen — nie das Bild einer noch existierenden Fassung, nie das der
 *  Vorlage. */
export async function entferneUebung(
  supabase: SupabaseClient,
  userId: string,
  e: { fassungId: string },
): Promise<KernErgebnis<UebungEntfernt>> {
  const geladen = await ladeFassungZumBearbeiten<{
    bild_url: string | null;
    notiz: string | null;
    training_exercise_gruppen: { position: number; training_gruppen: { name: string } | null }[];
  }>(
    supabase,
    userId,
    e.fassungId,
    "bild_url, notiz, training_exercise_gruppen ( position, training_gruppen ( name ) )",
  );
  if (!geladen.ok) return geladen;
  const f = geladen.wert.fassung;
  const gruppen = (f.training_exercise_gruppen ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((z) => z.training_gruppen?.name)
    .filter((n): n is string => !!n);

  const { data: geloescht, error } = await supabase
    .from("training_exercises")
    .delete()
    .eq("id", e.fassungId)
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!geloescht)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.fassung, { feld: "fassung_id" });

  await entferneFassungsBild(supabase, f.bild_url, e.fassungId);

  return ok({
    trainingId: f.training_id,
    name: f.name,
    einordnung: f.trainingsteil,
    varianteId: f.variante_id,
    gruppen,
    notizEntfiel: f.notiz != null,
  });
}

/** Die Dauer einer Übung setzen (ganze Minuten ab 0) oder entfernen (`null`)
 *  (Story #11 AK 1/2, #193 AK 10/13).
 *
 *  Jede ganze Zahl ab 0 (PO-Entscheid 2026-09-08, Story #151); der CHECK an
 *  `duration_min` verlangt ebenfalls bloss `>= 0`. Das Auffangen trägt keine
 *  Dauer (DB-CHECK) — in beiden Altersstufen, darum zählt die gespeicherte
 *  Einordnung. Das Leeren bleibt überall erlaubt. */
export async function setzeDauer(
  supabase: SupabaseClient,
  userId: string,
  e: { fassungId: string; minuten: number | null },
): Promise<KernErgebnis<{ trainingId: string; minuten: number | null }>> {
  if (e.minuten !== null && (!Number.isInteger(e.minuten) || e.minuten < 0))
    return fehlschlag("eingabe", "Die Dauer muss eine ganze Zahl in Minuten sein.", {
      feld: "minuten",
    });

  const geladen = await ladeFassungZumBearbeiten(supabase, userId, e.fassungId);
  if (!geladen.ok) return geladen;
  const f = geladen.wert.fassung;
  if (e.minuten !== null && !teilTraegtDauer(f.trainingsteil))
    return fehlschlag("regel", "Für das Auffangen kann keine Dauer gesetzt werden.", {
      feld: "minuten",
    });

  const r = await aktualisiereFassung(supabase, e.fassungId, { duration_min: e.minuten });
  return r.ok ? ok({ trainingId: f.training_id, minuten: e.minuten }) : r;
}

/** Die Notiz einer Übung setzen, ändern oder leeren (Story #152 AK 1/2,
 *  #193 AK 11). Leer heisst Entfernen: In der Datenbank steht dann `null`,
 *  nicht eine leere Zeichenkette — sonst gäbe es zwei Schreibweisen für
 *  dasselbe Nichts. Die Notiz gilt an JEDER Übung, anders als die Dauer. */
export async function setzeNotiz(
  supabase: SupabaseClient,
  userId: string,
  e: { fassungId: string; notiz: string },
): Promise<KernErgebnis<{ trainingId: string; notiz: string | null }>> {
  const notiz = e.notiz.trim() === "" ? null : e.notiz.trim();
  // Der CHECK an `training_exercises.notiz` weist zu langen Text ohnehin ab —
  // hier mit einem Satz, der ans Feld passt.
  if (notiz && notiz.length > NOTIZ_MAX)
    return fehlschlag("eingabe", `Höchstens ${NOTIZ_MAX} Zeichen.`, { feld: "notiz" });

  const geladen = await ladeFassungZumBearbeiten(supabase, userId, e.fassungId);
  if (!geladen.ok) return geladen;
  const r = await aktualisiereFassung(supabase, e.fassungId, { notiz });
  return r.ok ? ok({ trainingId: geladen.wert.fassung.training_id, notiz }) : r;
}

export type UebungsfolgeSetzen = {
  trainingId: string;
  einordnung: string;
  hauptteilkategorie?: string | null;
  /** Im Hauptteil: welche Variante. Ab zwei Varianten Pflicht. */
  varianteId?: string | null;
  /** ALLE Übungen des Abschnitts in der neuen Reihenfolge, jede einmal. */
  fassungIds: readonly string[];
};

/** Die Reihenfolge eines Abschnitts in einem Zug festlegen (#193 AK 9, PC 1).
 *
 *  Ein Abschnitt ist, worin eine Position eindeutig ist: Einordnung, im
 *  Kinderfussball-Hauptteil die Hauptteilkategorie, im Hauptteil beider
 *  Altersstufen die Variante. Verlangt ist die VOLLSTÄNDIGE Folge — eine
 *  Teilfolge liesse offen, wohin die übrigen gehören. Die Vorprüfung hier
 *  nennt fehlende und fremde Übungen mit Namen (#193 NFR 2); die RPC
 *  `setze_uebungsfolge` prüft dasselbe unter Sperre des Trainings noch einmal
 *  und schreibt atomar — was zwischen Vorprüfung und Schreiben dazukommt,
 *  weist sie als unvollständig ab, statt es irgendwo einzusortieren. */
export async function setzeUebungsfolge(
  supabase: SupabaseClient,
  userId: string,
  e: UebungsfolgeSetzen,
): Promise<KernErgebnis<{ folge: { fassungId: string; name: string; position: number }[] }>> {
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;

  const block = blockFilter(zugriff.wert.zeile.altersstufe, e.einordnung, e.hauptteilkategorie);
  if (!block.ok) return block;
  const hkat = block.wert.hauptteilkategorie ?? null;

  const variante = await loeseVarianteAuf(supabase, e.trainingId, e.einordnung, e.varianteId, true);
  if (!variante.ok) return variante;
  const varianteId = variante.wert;

  // Alle Fassungen des Trainings: Der Abschnitt ergibt sich daraus, und eine
  // Kennung aus einem anderen Abschnitt lässt sich so mit Namen nennen.
  const { data, error } = await supabase
    .from("training_exercises")
    .select("id, name, trainingsteil, hauptteilkategorie, variante_id, position")
    .eq("training_id", e.trainingId)
    .order("position");
  if (error) return ausDbFehler(error);
  const alle = (data ?? []) as {
    id: string;
    name: string;
    trainingsteil: string;
    hauptteilkategorie: string | null;
    variante_id: string | null;
  }[];
  const nameVon = new Map(alle.map((f) => [f.id, f.name]));
  const abschnitt = alle.filter(
    (f) =>
      f.trainingsteil === e.einordnung &&
      f.hauptteilkategorie === hkat &&
      f.variante_id === varianteId,
  );
  const imAbschnitt = new Set(abschnitt.map((f) => f.id));
  // Name UND Kennung: Dieselbe Übung darf mehrfach im Training stehen
  // (#192), der Name allein sagte dann nicht, welche gemeint ist.
  const genannt = (id: string) => (nameVon.has(id) ? `„${nameVon.get(id)}" (${id})` : id);

  const doppelt = [...new Set(e.fassungIds.filter((id, i) => e.fassungIds.indexOf(id) !== i))];
  if (doppelt.length > 0)
    return fehlschlag(
      "regel",
      `${UEBUNGSFOLGE_MELDUNG.UEBUNGSFOLGE_DOPPELT} Mehrfach: ${doppelt.map(genannt).join(", ")}.`,
      { feld: "fassung_ids" },
    );
  if (abschnitt.length === 0)
    return fehlschlag("regel", UEBUNGSFOLGE_MELDUNG.UEBUNGSFOLGE_ABSCHNITT_LEER, {
      feld: "einordnung",
    });
  const fehlen = abschnitt.filter((f) => !e.fassungIds.includes(f.id));
  const fremd = e.fassungIds.filter((id) => !imAbschnitt.has(id));
  if (fehlen.length > 0 || fremd.length > 0) {
    const teile = [UEBUNGSFOLGE_MELDUNG.UEBUNGSFOLGE_UNVOLLSTAENDIG];
    if (fehlen.length > 0) teile.push(`Es fehlen: ${fehlen.map((f) => genannt(f.id)).join(", ")}.`);
    if (fremd.length > 0)
      teile.push(`Nicht in diesem Abschnitt: ${fremd.map(genannt).join(", ")}.`);
    return fehlschlag("regel", teile.join(" "), {
      feld: "fassung_ids",
      zulaessig: abschnitt.map((f) => f.id),
    });
  }

  const { error: rpcFehler } = await supabase.rpc("setze_uebungsfolge", {
    p_training: e.trainingId,
    p_einordnung: e.einordnung,
    p_hauptteilkategorie: hkat,
    p_variante: varianteId,
    p_ids: [...e.fassungIds],
  });
  if (rpcFehler) return ausDbFehler(rpcFehler);

  return ok({
    folge: e.fassungIds.map((id, position) => ({ fassungId: id, name: nameVon.get(id)!, position })),
  });
}
