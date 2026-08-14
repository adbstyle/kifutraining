// Storage-Spiegel Prod -> Staging: kopiert alle Dateien des Buckets
// 'exercise-images' (manual/* Seed-Bilder + user/<uid>/* Trainer-Uploads).
// Teil des manuellen Staging-Syncs (.github/workflows/sync-staging.yml) —
// der DB-Teil (pg_dump/Restore + bild_url-Rewrite) läuft dort direkt via psql.
//
// Idempotent: upsert pro Datei; bereits vorhandene Dateien gleicher Grösse
// werden übersprungen. Verwaiste Staging-Dateien werden bewusst NICHT gelöscht
// (Staging ist disposable, die DB referenziert nach dem Sync nur kopierte Pfade).
//
// Env (Prod lesend / Staging schreibend — bewusst getrennte Namen, damit ein
// Vertauschen auffällt):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                  (Prod, nur lesen)
//   SUPABASE_STAGING_URL, SUPABASE_STAGING_SERVICE_ROLE_KEY  (Staging, schreiben)
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local laden, falls vorhanden (CI übergibt Env inline).
try {
  process.loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* keine .env.local -> Env muss von aussen kommen */
}

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "exercise-images";

const PROD_URL = process.env.SUPABASE_URL;
const PROD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STAGING_URL = process.env.SUPABASE_STAGING_URL;
const STAGING_KEY = process.env.SUPABASE_STAGING_SERVICE_ROLE_KEY;

if (!PROD_URL || !PROD_KEY || !STAGING_URL || !STAGING_KEY) {
  console.error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Prod) und SUPABASE_STAGING_URL, " +
      "SUPABASE_STAGING_SERVICE_ROLE_KEY (Staging) müssen gesetzt sein.",
  );
  process.exit(1);
}
if (PROD_URL === STAGING_URL) {
  console.error("Prod- und Staging-URL sind identisch — falsche Env-Belegung?");
  process.exit(1);
}

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const prod = createClient(PROD_URL, PROD_KEY, clientOptions);
const staging = createClient(STAGING_URL, STAGING_KEY, clientOptions);

type RemoteFile = { path: string; size: number | null; contentType: string | null };

/** Bucket rekursiv auflisten: list() ist nicht rekursiv, Einträge ohne id sind Ordner. */
async function listFiles(client: SupabaseClient, prefix = ""): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(BUCKET).list(prefix, { limit, offset });
    if (error) throw new Error(`Listing '${prefix}' fehlgeschlagen: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        files.push({
          path,
          size: (entry.metadata?.size as number | undefined) ?? null,
          contentType: (entry.metadata?.mimetype as string | undefined) ?? null,
        });
      } else {
        files.push(...(await listFiles(client, path)));
      }
    }
    if ((data?.length ?? 0) < limit) return files;
    offset += limit;
  }
}

async function main() {
  console.log(`Storage-Sync ${PROD_URL} -> ${STAGING_URL} (Bucket '${BUCKET}')`);

  // Bucket sollte via Migration existieren; absichern kostet nichts (wie seed.ts).
  const { data: bucket } = await staging.storage.getBucket(BUCKET);
  if (!bucket) {
    const { error } = await staging.storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists/i.test(error.message)) throw error;
    console.log(`Bucket '${BUCKET}' auf Staging angelegt.`);
  }

  const [prodFiles, stagingFiles] = await Promise.all([listFiles(prod), listFiles(staging)]);
  const stagingSizes = new Map(stagingFiles.map((f) => [f.path, f.size]));

  let copied = 0;
  let skipped = 0;
  for (const file of prodFiles) {
    if (file.size !== null && stagingSizes.get(file.path) === file.size) {
      skipped++;
      continue;
    }
    const { data: blob, error: downloadError } = await prod.storage.from(BUCKET).download(file.path);
    if (downloadError) throw new Error(`Download '${file.path}' fehlgeschlagen: ${downloadError.message}`);
    const { error: uploadError } = await staging.storage.from(BUCKET).upload(file.path, blob, {
      upsert: true,
      contentType: file.contentType ?? undefined,
    });
    if (uploadError) throw new Error(`Upload '${file.path}' fehlgeschlagen: ${uploadError.message}`);
    copied++;
  }

  console.log(`Storage-Sync abgeschlossen: ${copied} kopiert, ${skipped} übersprungen (${prodFiles.length} Dateien in Prod).`);
}

main().catch((e) => {
  console.error("Storage-Sync fehlgeschlagen:", e);
  process.exit(1);
});
