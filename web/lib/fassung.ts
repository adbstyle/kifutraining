// Fassungen: eigenständige, im Training lebende Kopien von Bibliotheks-Übungen
// (Epic #72). Diese Datei hält die Regeln, die Erzeugung und Übernahme teilen —
// die Server Actions bleiben dadurch dünn.
import { brauchtFahrplan, type Altersstufe } from "@/lib/altersstufe";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { kopiereDiagramm, parseDiagramm } from "@/lib/diagramm";
import type { createClient } from "@/lib/supabase/server";

/** Die inhaltlichen Felder, die eine Fassung von ihrer Vorlage übernimmt.
 *  Bewusst NICHT dabei: slug, source, owner_id, visibility (Bibliotheks-
 *  Belange) sowie die Einordnung, die der Aufrufer setzt. */
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

/** Die Spaltenliste, mit der eine Vorlage für das Kopieren gelesen wird —
 *  Inhalte sowie Bild und Diagramm. Die
 *  Inhaltsfelder kommen aus derselben Konstante wie das Kopieren selbst, damit
 *  ein neues Übungsfeld nicht gelesen-aber-nicht-kopiert (oder umgekehrt)
 *  enden kann. */
/** Die Spalten, mit denen eine Fassung fürs Übernehmen in die Bibliothek
 *  gelesen wird. Aus derselben Konstante wie das Kopieren: eine handgepflegte
 *  Zweitliste liesse ein neues Übungsfeld hier still wegfallen. */
export const FASSUNG_UEBERNAHME_SELECT = [
  "altersstufe",
  "trainingsteil",
  "hauptteilkategorie",
  ...FASSUNG_INHALT_FELDER,
  "bild_url",
  "diagramm",
].join(", ");

export const VORLAGE_SELECT = [
  "id",
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
      : "Diese Übung hat keinen vollständigen methodischen Fahrplan. Ergänze ihn im Training, bevor du sie in deine Bibliothek übernimmst.";
  }

  return f.aufbau?.trim()
    ? null
    : "Diese Übung hat keine Ablaufbeschreibung. Ergänze sie im Training, bevor du sie in deine Bibliothek übernimmst.";
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
// Geteilt zwischen dem Übernehmen einer Vorlage ins Training und dem Übernehmen
// einer Fassung in die Bibliothek: beide erzeugen eine entkoppelte Kopie.

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Das Diagramm entkoppelt kopieren (frische Element-IDs). `parseDiagramm` ist
 *  die Trust-Boundary: ein strukturell unbrauchbares Diagramm ergibt keine
 *  Kopie, statt die ganze Übernahme scheitern zu lassen. */
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

/** Die inhaltlichen Felder einer Quelle übernehmen — eine Quelle für die
 *  Feldmenge, damit ein neues Übungsfeld nicht an einer von mehreren Stellen
 *  vergessen wird. */
export function inhaltFelder(quelle: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(FASSUNG_INHALT_FELDER.map((f) => [f, quelle[f]]));
}
