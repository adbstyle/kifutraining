// Storage-Spiegel Prod -> Staging: kopiert alle Dateien des Buckets
// 'exercise-images' (manual/* Seed-Bilder + user/<uid>/* Trainer-Uploads).
// Teil des manuellen Staging-Syncs (.github/workflows/sync-staging.yml) —
// der DB-Teil (pg_dump/Restore + bild_url-Rewrite) läuft dort direkt via psql.
//
// Idempotent: jede Datei wird per upsert überschrieben (bewusst kein
// Grössen-/Zeitstempel-Skip — gleich grosse, aber ersetzte Bilder würden sonst
// still veralten). Verwaiste Staging-Dateien werden NICHT gelöscht (Staging ist
// disposable, die DB referenziert nach dem Sync nur kopierte Pfade).
//
// Env (Prod lesend / Staging schreibend — bewusst getrennte Namen, damit ein
// Vertauschen auffällt):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                  (Prod, nur lesen)
//   SUPABASE_STAGING_URL, SUPABASE_STAGING_SERVICE_ROLE_KEY  (Staging, schreiben)
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// .env.local laden, falls vorhanden (CI übergibt Env inline; loadEnvFile
// überschreibt bereits gesetzte Variablen nicht).
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
// Schützt den Lokallauf: fehlen die Prod-Vars, liefert .env.local den lokalen
// Stack als vermeintliche "Prod"-Quelle — und der lokale Storage würde nach
// Staging gespiegelt.
if (/127\.0\.0\.1|localhost/.test(PROD_URL)) {
  console.error(
    `Prod-Quelle zeigt auf den lokalen Stack (${PROD_URL}) — SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY der Prod-Umgebung explizit setzen.`,
  );
  process.exit(1);
}

const clientOptions = { auth: { autoRefreshToken: false, persistSession: false } };
const prod = createClient(PROD_URL, PROD_KEY, clientOptions);
const staging = createClient(STAGING_URL, STAGING_KEY, clientOptions);

type RemoteFile = { path: string; contentType?: string };

/** Bucket rekursiv auflisten: list() ist nicht rekursiv, Einträge ohne id sind
 *  Ordner. Paging bis zur leeren Seite — der Server darf Seiten kleiner als
 *  `limit` liefern, ohne dass Dateien verloren gehen. */
async function listFiles(client: SupabaseClient, prefix = ""): Promise<RemoteFile[]> {
  const files: RemoteFile[] = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage.from(BUCKET).list(prefix, { limit, offset });
    if (error) throw new Error(`Listing '${prefix}' fehlgeschlagen: ${error.message}`);
    if (!data || data.length === 0) return files;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        files.push({ path, contentType: entry.metadata?.mimetype as string | undefined });
      } else {
        files.push(...(await listFiles(client, path)));
      }
    }
    offset += data.length;
  }
}

async function main() {
  console.log(`Storage-Sync ${PROD_URL} -> ${STAGING_URL} (Bucket '${BUCKET}')`);

  const prodFiles = await listFiles(prod);

  for (const file of prodFiles) {
    const { data: blob, error: downloadError } = await prod.storage.from(BUCKET).download(file.path);
    if (downloadError) throw new Error(`Download '${file.path}' fehlgeschlagen: ${downloadError.message}`);
    const { error: uploadError } = await staging.storage.from(BUCKET).upload(file.path, blob, {
      upsert: true,
      contentType: file.contentType,
    });
    if (uploadError) throw new Error(`Upload '${file.path}' fehlgeschlagen: ${uploadError.message}`);
  }

  console.log(`Storage-Sync abgeschlossen: ${prodFiles.length} Dateien kopiert.`);
}

main().catch((e) => {
  console.error("Storage-Sync fehlgeschlagen:", e);
  process.exit(1);
});
