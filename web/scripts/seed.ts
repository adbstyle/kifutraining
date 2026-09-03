// Idempotenter Daten-Seed: data/*.yaml (Übungen + Diagramme) -> Postgres.
// Manual-Übungen: source='manual', owner_id=null, visibility='public'.
// Upsert per slug/id -> mehrfach ausführbar ohne Duplikate; User-Daten bleiben unberührt.
//
// Lokal:   npm run seed            (lädt web/.env.local)
// Prod:    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import yaml from "js-yaml";
import { createClient } from "@supabase/supabase-js";
import { parseDiagramm, type DiagrammData } from "../lib/diagramm";
import { diagrammProbleme } from "./diagramm-pruefung";

// .env.local laden, falls vorhanden (Prod übergibt Env inline).
try {
  process.loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* keine .env.local -> Env muss von aussen kommen */
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
const UEBUNGEN_DIR = resolve(REPO_ROOT, "data/uebungen");
// Gezeichnete KiFu-Manual-Diagramme als Vorlagen-Fundus (Epic #58, Story #60):
// data/diagramme/<slug>.json hält die DiagrammData einer Manual-Übung.
const DIAGRAMME_DIR = resolve(REPO_ROOT, "data/diagramme");

const URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "exercise-images";

if (!URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function loadYamlDir(dir: string): Record<string, unknown>[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => yaml.load(readFileSync(resolve(dir, f), "utf8")) as Record<string, unknown>);
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`Bucket '${BUCKET}' angelegt.`);
  }
}

/** Gezeichnetes Diagramm einer Manual-Übung laden (data/diagramme/<slug>.json).
 *  parseDiagramm ist die Trust-Boundary — strukturell Kaputtes wird verworfen,
 *  damit nie ein ungültiges Diagramm in die DB gelangt. null, wenn keine Datei
 *  existiert oder die Datei kein anzeigbares Diagramm enthält.
 *
 *  Zusätzlich `diagrammProbleme`: der Parser lässt unbekannte Symbol-Typen
 *  bewusst durch (Fallback-Rendering) — in einer von uns verfassten Vorlage ist
 *  ein solcher Tippfehler aber ein Fehler und bricht den Seed ab, statt still
 *  als „?"-Kreis in die DB zu wandern. */
function loadDiagramm(slug: string): DiagrammData | null {
  const path = resolve(DIAGRAMME_DIR, `${slug}.json`);
  if (!existsSync(path)) return null;
  const roh = JSON.parse(readFileSync(path, "utf8"));
  const diagramm = parseDiagramm(roh);
  if (!diagramm || diagramm.elemente.length === 0) {
    console.warn(`  Diagramm ungültig oder leer, übersprungen: data/diagramme/${slug}.json`);
    return null;
  }
  const probleme = diagrammProbleme(diagramm, Array.isArray(roh.elemente) ? roh.elemente.length : undefined);
  if (probleme.length > 0) {
    throw new Error(
      `data/diagramme/${slug}.json ist fehlerhaft:\n  ${probleme.join("\n  ")}\n` +
        `Prüfen mit: npm run check:diagramme`,
    );
  }
  return diagramm;
}

async function seedExercises() {
  const raw = loadYamlDir(UEBUNGEN_DIR);
  let count = 0;
  let mitDiagramm = 0;
  for (const u of raw) {
    // Diagramm-Vorlage (Epic #58) ist das einzige Anzeige-Bild einer
    // Manual-Übung. Beide Felder werden immer geschrieben, damit der Seed
    // idempotent bleibt: eine entfernte Diagramm-Datei setzt diagramm und
    // bild_quelle wieder zurück.
    const diagramm = loadDiagramm(u.id as string);
    if (diagramm) mitDiagramm++;

    const row = {
      slug: u.id,
      name: u.name,
      // Der Manual-Bestand ist per Definition Kinderfussball: er stammt aus
      // dem Manual Fussball Kinder (Story 1, Übungswelten). Ausdrücklich
      // geschrieben statt dem Spalten-Default überlassen — der Seed ist
      // idempotent und soll jede Zeile vollständig setzen.
      altersstufe: "kinderfussball",
      trainingsteil: u.trainingsteil,
      erscheinungsform: u.erscheinungsform ?? [],
      hauptteilkategorie: u.hauptteilkategorie ?? null,
      feldtyp: u.feldtyp ?? null,
      kategorien: u.kategorien ?? [],
      anzahl_kinder: u.anzahl_kinder ?? null,
      material: u.material ?? [],
      // Übungsablauf je Einordnung: methodischer_fahrplan (jsonb) bei
      // einleitung/hauptteil, flaches aufbau bei auffangen/ausklang sowie bei
      // der Hauptteilkategorie «Fussball spielen» (freies Spiel, Story 2).
      methodischer_fahrplan: u.methodischer_fahrplan ?? null,
      aufbau: u.aufbau ?? null,
      varianten: u.varianten ?? [],
      diagramm,
      bild_quelle: diagramm ? "diagramm" : null,
      // Manual-Übungen tragen kein Foto mehr (die Manual-Bitmaps sind
      // entfernt); explizit genullt, damit ein Alt-Bestand mit-bereinigt wird.
      bild_url: null,
      source: "manual",
      owner_id: null,
      visibility: "public",
    };

    const { error } = await supabase.from("exercises").upsert(row, { onConflict: "slug" });
    if (error) throw error;
    count++;
  }
  console.log(`Übungen geseedet: ${count} (davon mit Diagramm-Vorlage: ${mitDiagramm})`);
}

/** Der Storage-Ordner, in dem die früheren Manual-Bitmaps lagen. */
const MANUAL_PREFIX = "manual";

/** Zählt Zeilen, deren bild_url noch in den manual/-Ordner zeigt. */
async function manualReferenzen(tabelle: "exercises" | "training_exercises"): Promise<number> {
  const { count, error } = await supabase
    .from(tabelle)
    .select("id", { count: "exact", head: true })
    .like("bild_url", `%/${MANUAL_PREFIX}/%`);
  if (error) throw error;
  return count ?? 0;
}

/** Die Manual-Bitmaps aus dem Storage räumen.
 *
 *  Nötig, weil `seedExercises` nur die Spalte `bild_url` nullt: die Dateien
 *  selbst blieben sonst im öffentlichen Bucket liegen und wären unter ihrer
 *  bisherigen URL weiter abrufbar — bloss von keiner Zeile mehr referenziert.
 *  Genau das soll das Entfernen der Bitmaps aus dem Repo verhindern.
 *
 *  Läuft NACH dem Übungs-Seed, damit `bild_url` bereits genullt ist, und nur,
 *  wenn wirklich keine Zeile mehr auf den Ordner zeigt — sonst würde ein
 *  Zwischenstand (etwa ein abgebrochener Seed) sichtbare Bilder wegräumen. */
async function entferneManualBilder() {
  const offen =
    (await manualReferenzen("exercises")) + (await manualReferenzen("training_exercises"));
  if (offen > 0) {
    console.warn(
      `  ${offen} Zeile(n) zeigen noch auf ${MANUAL_PREFIX}/ — Storage bleibt unangetastet.`,
    );
    return;
  }

  const pfade: string[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(MANUAL_PREFIX, { limit, offset });
    if (error) throw error;
    if (!data || data.length === 0) break;
    // Einträge ohne `id` sind Unterordner, keine Dateien.
    pfade.push(...data.filter((e) => e.id).map((e) => `${MANUAL_PREFIX}/${e.name}`));
    if (data.length < limit) break;
  }
  if (pfade.length === 0) return;

  const { error } = await supabase.storage.from(BUCKET).remove(pfade);
  if (error) throw error;
  console.log(`Manual-Bitmaps aus dem Storage entfernt: ${pfade.length}`);
}

async function main() {
  console.log(`Seed gegen ${URL} (Bucket '${BUCKET}')`);
  await ensureBucket();
  await seedExercises();
  await entferneManualBilder();
  console.log("Seed abgeschlossen.");
}

main().catch((e) => {
  console.error("Seed fehlgeschlagen:", e);
  process.exit(1);
});
