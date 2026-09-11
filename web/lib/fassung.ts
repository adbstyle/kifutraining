// Fassungen: eigenständige, im Training lebende Kopien von Bibliotheks-Übungen
// (Epic #72). Diese Datei hält die Regeln, die Erzeugung und Kopieren teilen —
// die Server Actions bleiben dadurch dünn.
import { brauchtFahrplan, type Altersstufe } from "@/lib/altersstufe";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { kopiereDiagramm, parseDiagramm } from "@/lib/diagramm";
import { userSlug } from "@/lib/slug";
import type { createClient } from "@/lib/supabase/server";

/** Die inhaltlichen Felder, die eine Fassung von ihrer Vorlage übernimmt.
 *  Bewusst NICHT dabei: slug, source, owner_id, visibility (Bibliotheks-
 *  Belange) sowie die Einordnung, die der Aufrufer setzt.
 *
 *  Ebenso wenig die `notiz` (#152): Sie sagt etwas über DIESES Training aus,
 *  nicht über die Übung — und `exercises` trägt die Spalte gar nicht, ein
 *  Kopieren in die Bibliothek scheiterte mit ihr. Sie steht darum in
 *  `FASSUNG_ZUORDNUNG_FELDER`. */
export const FASSUNG_INHALT_FELDER = [
  "name",
  "kategorien",
  "erscheinungsform",
  "feldtyp",
  "spielfeld_laenge_m",
  "spielfeld_breite_m",
  "anzahl_kinder",
  "material",
  "methodischer_fahrplan",
  "uebungstyp",
  "aufbau",
  "varianten",
  "bild_quelle",
] as const;

/** Die Felder der ZUORDNUNG — sie sagen, wo und wie die Fassung in genau
 *  diesem Training steht, nicht was die Übung ist.
 *
 *  Sie reisen beim Kopieren eines Trainings mit (die Kopie soll dasselbe
 *  Training sein) und gelangen nie in die Bibliothek: Dort gibt es weder eine
 *  Position noch eine Dauer noch eine Notiz. Zusammen mit
 *  `FASSUNG_INHALT_FELDER` ergeben sie den vollen Feldsatz einer Fassung.
 *
 *  `variante_id` (#201) gehört dazu — sie sagt, in welcher Zusammenstellung
 *  des Hauptteils die Fassung steht. Sie ist zugleich das einzige Feld, das
 *  ein Kopierpfad NACH dem Übernehmen überschreiben muss: Die Quell-ID
 *  bezeichnet eine Variante des Quell-Trainings. Vergisst er es, weist der
 *  Trigger `te_variante_ausrichten` die Kopie mit
 *  `VARIANTE_FREMDES_TRAINING` ab — laut statt still. */
export const FASSUNG_ZUORDNUNG_FELDER = [
  "trainingsteil",
  "hauptteilkategorie",
  "variante_id",
  "position",
  "duration_min",
  "notiz",
] as const;

/** Die Spalten, mit denen eine Fassung fürs Kopieren in die Bibliothek gelesen
 *  wird. Aus derselben Konstante wie das Kopieren selbst: eine handgepflegte
 *  Zweitliste liesse ein neues Übungsfeld hier still wegfallen. */
export const FASSUNG_KOPIE_SELECT = [
  "altersstufe",
  "trainingsteil",
  "hauptteilkategorie",
  ...FASSUNG_INHALT_FELDER,
  "bild_url",
  "diagramm",
].join(", ");

/** Die Spaltenliste, mit der eine Bibliotheks-Übung als Vorlage fürs Kopieren
 *  ins Training gelesen wird — Einordnung, Inhalte, Bild und Diagramm. Aus
 *  derselben Konstante wie das Kopieren selbst, damit ein neues Übungsfeld
 *  nicht gelesen-aber-nicht-kopiert (oder umgekehrt) enden kann. */
export const VORLAGE_SELECT = [
  "id",
  // Gelesen, aber nicht kopiert: Die Fassung erbt ihre Altersstufe vom
  // Training (Trigger `te_altersstufe_erben`). Der Aufrufer braucht sie, um zu
  // prüfen, ob die Vorlage überhaupt in dieses Training gehört (Story 6 AK 4).
  "altersstufe",
  "trainingsteil",
  "hauptteilkategorie",
  ...FASSUNG_INHALT_FELDER,
  "bild_url",
  "diagramm",
].join(", ");

/** Die Dateiendung eines Storage-Pfads (ohne Punkt), mit Rückfall auf `png`.
 *  Die Endung bestimmt den Zielnamen der Bildkopie. Modul-intern: nach aussen
 *  genügt `fassungBildPfad`. */
function dateiendung(pfad: string): string {
  const teil = pfad.split(".").pop();
  return teil && teil !== pfad && /^[a-z0-9]+$/i.test(teil) ? teil : "png";
}

/** Erfüllt der Inhalt einer Fassung die Vollständigkeitsregel für Übungen?
 *  Gibt `null` zurück, wenn sie erfüllt ist, sonst eine Meldung für den USER.
 *
 *  Spiegelt die DB-Constraints `ablauf_je_einordnung` und
 *  `fahrplan_vollstaendig`: die Datenbank würde eine lückenhafte Übung ohnehin
 *  abweisen — hier geht es um eine verständliche Meldung statt eines rohen
 *  Constraint-Fehlers. Betrifft vor allem die inhaltsleeren Fassungen aus der
 *  Bestand-Überführung. */
export function fassungUnvollstaendig(f: {
  name: string | null;
  /** Die Altersstufe entscheidet über die Ablaufform: der methodische Fahrplan
   *  ist dem Kinderfussball vorbehalten, eine Junioren-Übung trägt in jedem
   *  Block einen Beschreibungstext (Story 3, Übungswelten). */
  altersstufe: Altersstufe;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  methodischer_fahrplan: { offen_starten?: string; ueben?: string[]; wetteifern?: string | null } | null;
  aufbau: string | null;
}): string | null {
  if (!f.name?.trim()) return "Diese Übung hat keinen Namen.";

  if (brauchtFahrplan(f.altersstufe, f.trainingsteil, f.hauptteilkategorie)) {
    const fp = f.methodischer_fahrplan;
    const vollstaendig =
      !!fp?.offen_starten?.trim() &&
      Array.isArray(fp.ueben) &&
      fp.ueben.length > 0 &&
      !!fp.wetteifern?.trim();
    return vollstaendig
      ? null
      : "Diese Übung hat keinen vollständigen methodischen Fahrplan. Ergänze ihn im Training, bevor du sie in deine Bibliothek kopierst.";
  }

  return f.aufbau?.trim()
    ? null
    : "Diese Übung hat keine Ablaufbeschreibung. Ergänze sie im Training, bevor du sie in deine Bibliothek kopierst.";
}

/** Gehört diese Storage-Datei der Fassung selbst? Der Dateiname trägt dann die
 *  Zuordnungs-ID (wie `fassungBildPfad` sie bildet). Jeder Löschweg prüft das,
 *  bevor er eine Datei entfernt: ein verwaistes Bild ist harmlos, eine fremde
 *  oder geteilte Datei zu löschen wäre Datenverlust. */
export function istEigeneFassungsDatei(pfad: string, fassungId: string): boolean {
  return pfad.slice(pfad.lastIndexOf("/") + 1).startsWith(`${fassungId}.`);
}

/** Zielpfad der Bildkopie einer Fassung. Der Dateiname ist die Zuordnungs-ID —
 *  damit kollisionsfrei zu Übungsbildern (die tragen die Übungs-ID) und
 *  deterministisch, sodass ein erneuter Versuch dieselbe Datei überschreibt
 *  statt Waisen zu hinterlassen. */
export function fassungBildPfad(
  ordner: BildOrdner,
  trainingExerciseId: string,
  quellPfad: string,
): string {
  return `${ordner}/${trainingExerciseId}.${dateiendung(quellPfad)}`;
}

/** Der Storage-Ordner, in dem die Bildkopien liegen. Zwei Formen: `user/<uid>`
 *  für persönliche Inhalte, `team/<teamId>` für Team-Trainings — nur so kann
 *  jedes Mitglied das Bild einer Team-Fassung ersetzen (Team-Epic Story 6). Die
 *  Storage-Policies prüfen genau diese beiden Präfixe. */
export type BildOrdner = string;

export function userOrdner(userId: string): BildOrdner {
  return `user/${userId}`;
}

export function teamOrdner(teamId: string): BildOrdner {
  return `team/${teamId}`;
}

// ── Kopier-Bausteine ────────────────────────────────────────────────────────
// Geteilt zwischen dem Übernehmen einer Vorlage ins Training und dem Kopieren
// einer Fassung in die Bibliothek: beide erzeugen eine entkoppelte Kopie.

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Das Diagramm entkoppelt kopieren (frische Element-IDs). `parseDiagramm` ist
 *  die Trust-Boundary: ein strukturell unbrauchbares Diagramm ergibt keine
 *  Kopie, statt den ganzen Kopiervorgang scheitern zu lassen. */
export function kopiereDiagrammVon(quelle: unknown): unknown {
  const data = parseDiagramm(quelle);
  return data && data.elemente.length > 0 ? kopiereDiagramm(data) : null;
}

/** Eine Bilddatei byte-identisch in den Ziel-Ordner kopieren.
 *
 *  Kein Download/Upload und keine Bildverarbeitung — die Storage-Kopie prüft
 *  Leserecht auf der Quelle (der Bucket ist öffentlich lesbar) und Schreibrecht
 *  auf dem Ziel (eigener bzw. Team-Ordner), genau die benötigte Semantik. Der Zielname ist
 *  die ID des neuen Objekts, damit ein erneuter Versuch dieselbe Datei
 *  überschreibt statt Waisen zu hinterlassen. Ohne Quellbild ein No-op. */
export async function kopiereBild(
  supabase: SupabaseClient,
  quellUrl: string | null,
  ordner: BildOrdner,
  zielId: string,
): Promise<{ url: string | null; pfad: string | null; error?: string }> {
  const quellPfad = bildUrlToPath(quellUrl);
  if (!quellPfad) return { url: null, pfad: null };

  const zielPfad = fassungBildPfad(ordner, zielId, quellPfad);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).copy(quellPfad, zielPfad);
  if (error) return { url: null, pfad: null, error: `Bildkopie fehlgeschlagen: ${error.message}` };

  return {
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(zielPfad).data.publicUrl,
    pfad: zielPfad,
  };
}

/** Storage-Objekt best-effort entfernen (no-op bei null). */
export async function entferneStorageObjekt(
  supabase: SupabaseClient,
  pfad: string | null,
) {
  if (pfad) await supabase.storage.from(STORAGE_BUCKET).remove([pfad]);
}

/** Mehrere Storage-Objekte in EINEM Aufruf entfernen (no-op bei leerer Liste).
 *  Beim Abräumen ganzer Trainings oder Teams sind das je Vorgang Dutzende
 *  Dateien — einzeln nacheinander kostet je einen Roundtrip. */
export async function entferneStorageObjekte(
  supabase: SupabaseClient,
  pfade: string[],
) {
  if (pfade.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(pfade);
}

/** Aus Fassungs-Zeilen die Pfade der Dateien, die IHNEN gehören.
 *
 *  Der Dateiname muss die Zuordnungs-ID tragen (`fassungBildPfad`). Zeigt die
 *  URL auf etwas anderes — etwa noch auf das Bild der Vorlage —, bleibt die
 *  Datei unangetastet: ein verwaistes Bild ist harmlos, ein gelöschtes fremdes
 *  wäre Datenverlust. Eine Stelle für den Guard, damit ihn kein Löschweg
 *  vergisst. */
export function eigeneBildPfade(
  fassungen: { id: string; bild_url: string | null }[],
): string[] {
  return fassungen
    .map((f) => ({ id: f.id, pfad: bildUrlToPath(f.bild_url) }))
    .filter((f): f is { id: string; pfad: string } => !!f.pfad)
    .filter((f) => istEigeneFassungsDatei(f.pfad, f.id))
    .map((f) => f.pfad);
}

/** Das Suffix, an dem der USER die Kopie einer eigenen Übung erkennt (#171
 *  AK 3). Es nennt die Quelle bewusst nicht — es sagt «das ist eine Kopie»,
 *  nicht «das ist eine Kopie von X». */
const KOPIE_SUFFIX = " (Kopie)";

/** Der Name einer Kopie. Das Suffix wird IMMER angehängt, auch wenn der Name es
 *  schon trägt: die Kopie einer Kopie heisst „X (Kopie) (Kopie)" (PO-Entscheid).
 *  Eine fortlaufende Nummerierung gibt es bewusst nicht — alle Kopien derselben
 *  Quelle sind gleich gekennzeichnet (#171 PC 7).
 *
 *  Gekappt wird nichts: `exercises.name` ist `text not null` ohne Längen-CHECK
 *  (Migration `init_schema`), und auch das Übungsformular begrenzt den Namen
 *  nicht. */
export function kopieName(name: string): string {
  return `${name}${KOPIE_SUFFIX}`;
}

/** Die inhaltlichen Felder einer Quelle übernehmen — eine Quelle für die
 *  Feldmenge, damit ein neues Übungsfeld nicht an einer von mehreren Stellen
 *  vergessen wird. */
export function inhaltFelder(quelle: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(FASSUNG_INHALT_FELDER.map((f) => [f, quelle[f]]));
}

/** Die Quelle einer Übungskopie: eine Bibliotheks-Übung oder eine Fassung aus
 *  einem Training. Beide tragen denselben Feldsatz — die Kopie merkt keinen
 *  Unterschied. */
export type UebungsKopieQuelle = {
  name: string | null;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  bild_url: string | null;
  diagramm: unknown;
} & Record<string, unknown>;

/** Eine eigenständige, zunächst private Trainer-Übung aus einer Quelle anlegen —
 *  mit eigener Bild- und Diagrammkopie.
 *
 *  Der gemeinsame Rumpf dreier Wege, die fachlich verschieden beginnen und
 *  identisch enden: «Übung kopieren» — die eigene wie die kuratierte oder
 *  fremde (#171, Story 7 Übungswelten) — und «Fassung in die Bibliothek
 *  kopieren» (Story 7, Bibliotheks-Epic). Wer prüfen darf, was kopiert werden
 *  darf, entscheidet der Aufrufer; hier steht nur, woraus die Kopie besteht.
 *
 *  Herkunftsneutral: die Kennzeichnung der Kopie im Namen ist Sache des
 *  Aufrufers — er gibt sie als `ziel.name` mit (#171).
 *
 *  Eine Verknüpfung zur Quelle entsteht nicht: spätere Änderungen wirken in
 *  keine Richtung. Die Altersstufe gibt der Aufrufer mit — sie stammt bei der
 *  Übung von ihr selbst, bei der Fassung von ihrem Training.
 *
 *  Scheitert der Insert, fällt die bereits erzeugte Bildkopie wieder weg. */
export async function legeUebungsKopieAn(
  supabase: SupabaseClient,
  quelle: UebungsKopieQuelle,
  ziel: {
    ownerId: string;
    altersstufe: Altersstufe;
    /** Abweichender Name der Kopie. Ohne ihn trägt sie den Namen der Quelle. */
    name?: string;
  },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  // ID vorab: sie benennt die Bildkopie, die vor dem Insert liegen muss.
  const uebungId = crypto.randomUUID();
  const bild = await kopiereBild(supabase, quelle.bild_url, userOrdner(ziel.ownerId), uebungId);
  if (bild.error) return { ok: false, error: bild.error };

  const { data: angelegt, error } = await supabase
    .from("exercises")
    .insert({
      id: uebungId,
      // Zufallssuffix: dieselbe Quelle lässt sich mehrfach kopieren, jede
      // Kopie bekommt ihren eigenen Slug.
      slug: userSlug(ziel.name ?? quelle.name ?? "Übung"),
      altersstufe: ziel.altersstufe,
      trainingsteil: quelle.trainingsteil,
      hauptteilkategorie: quelle.hauptteilkategorie,
      ...inhaltFelder(quelle),
      // NACH dem Spread: `inhaltFelder` trägt den Namen der Quelle, ein
      // mitgegebener ersetzt ihn (die Kopie der eigenen Übung, #171).
      ...(ziel.name ? { name: ziel.name } : {}),
      bild_url: bild.url,
      diagramm: kopiereDiagrammVon(quelle.diagramm),
      source: "user",
      owner_id: ziel.ownerId,
      // Zunächst privat: veröffentlicht wird bewusst separat.
      visibility: "private",
    })
    .select("slug")
    .single();

  if (error || !angelegt) {
    await entferneStorageObjekt(supabase, bild.pfad);
    return { ok: false, error: error?.message ?? "Kopieren fehlgeschlagen." };
  }
  return { ok: true, slug: angelegt.slug };
}
