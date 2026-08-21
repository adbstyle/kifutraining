// Idempotenter Daten-Seed: data/*.yaml + images/*.png -> Postgres + Storage.
// Manual-Übungen: source='manual', owner_id=null, visibility='public'.
// Upsert per slug/id -> mehrfach ausführbar ohne Duplikate; User-Daten bleiben unberührt.
//
// Lokal:   npm run seed            (lädt web/.env.local)
// Prod:    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
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
const IMAGES_DIR = resolve(REPO_ROOT, "images");
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

async function uploadImage(relPath: string): Promise<string | null> {
  // relPath wie "images/dribbling-wechseltore.png"
  const localPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(localPath)) {
    console.warn(`  Bild fehlt, übersprungen: ${relPath}`);
    return null;
  }
  const storagePath = `manual/${basename(relPath)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, readFileSync(localPath), {
      contentType: "image/png",
      upsert: true,
    });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
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
    const bildRel = (u.bild as string | null) ?? null;
    const bildUrl = bildRel ? await uploadImage(bildRel) : null;

    // Diagramm-Vorlage (Epic #58): gesetzt -> aktives Anzeige-Bild, das Foto
    // (bild_url) bleibt als Umschalt-Option erhalten (#56). Beide Felder werden
    // immer geschrieben, damit der Seed idempotent bleibt: eine entfernte
    // Diagramm-Datei setzt diagramm/bild_quelle wieder zurück.
    const diagramm = loadDiagramm(u.id as string);
    if (diagramm) mitDiagramm++;

    const row: Record<string, unknown> = {
      slug: u.id,
      name: u.name,
      trainingsteil: u.trainingsteil,
      erscheinungsform: u.erscheinungsform ?? [],
      hauptteilkategorie: u.hauptteilkategorie ?? null,
      feldtyp: u.feldtyp ?? null,
      kategorien: u.kategorien ?? [],
      anzahl_kinder: u.anzahl_kinder ?? null,
      material: u.material ?? [],
      // Übungsablauf je Trainingsteil: methodischer_fahrplan (jsonb) bei
      // einleitung/hauptteil, flaches aufbau bei auffangen/ausklang.
      methodischer_fahrplan: u.methodischer_fahrplan ?? null,
      aufbau: u.aufbau ?? null,
      varianten: u.varianten ?? [],
      diagramm,
      bild_quelle: diagramm ? "diagramm" : null,
      source: "manual",
      owner_id: null,
      visibility: "public",
    };

    // bild_url nur schreiben, wenn ein Bild hochgeladen wurde ODER bewusst keins
    // existiert. Wurde ein Bild erwartet, der Upload schlug aber fehl (Datei fehlt),
    // das Feld auslassen -> ein bereits vorhandener bild_url bleibt beim Upsert erhalten.
    if (bildUrl !== null || !bildRel) {
      row.bild_url = bildUrl;
    }

    const { error } = await supabase.from("exercises").upsert(row, { onConflict: "slug" });
    if (error) throw error;
    count++;
  }
  console.log(`Übungen geseedet: ${count} (davon mit Diagramm-Vorlage: ${mitDiagramm})`);
}

async function main() {
  console.log(`Seed gegen ${URL} (Bucket '${BUCKET}')`);
  await ensureBucket();
  await seedExercises();
  console.log("Seed abgeschlossen.");
}

main().catch((e) => {
  console.error("Seed fehlgeschlagen:", e);
  process.exit(1);
});
