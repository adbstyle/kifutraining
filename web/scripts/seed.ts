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

async function seedExercises() {
  const raw = loadYamlDir(UEBUNGEN_DIR);
  let count = 0;
  for (const u of raw) {
    const bildRel = (u.bild as string | null) ?? null;
    const bildUrl = bildRel ? await uploadImage(bildRel) : null;

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
  console.log(`Übungen geseedet: ${count}`);
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
