// Schritt 1 der Bestand-Überführung (Story 9): die Bilddateien aller bestehenden
// Zuordnungen auf das Fassungs-Schema kopieren.
//
// Idempotent und wiederanlauffähig: der Zielname ist deterministisch
// (user/<trainings-eigentümer>/<zuordnungs-id>.<ext>), ein bereits vorhandenes
// Ziel wird übersprungen. Läuft VOR der Feld-Migration, damit nie eine Bild-URL
// auf ein noch fehlendes Objekt zeigt.
//
// Lokal:   npx tsx scripts/fassungen-bilder-kopieren.ts
// Remote:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/fassungen-bilder-kopieren.ts
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bildUrlToPath } from "../lib/storage";
import { fassungBildPfad } from "../lib/fassung";

try {
  process.loadEnvFile(resolve(process.cwd(), ".env.local"));
} catch {
  /* keine .env.local -> Env muss von aussen kommen */
}

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "exercise-images";

if (!URL_ || !SERVICE_KEY) {
  console.error("SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.");
  process.exit(1);
}

// Service-Role: die Kopie läuft über alle Trainings hinweg, also ausserhalb der
// nutzergebundenen Pfadregeln des Bildspeichers.
const supabase = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Zeile = {
  id: string;
  trainings: { owner_id: string | null } | null;
  exercises: { bild_url: string | null } | null;
};

async function main() {
  console.log(`Bildkopien gegen ${URL_} (Bucket '${BUCKET}')`);

  const { data, error } = await supabase
    .from("training_exercises")
    .select("id, trainings ( owner_id ), exercises ( bild_url )");
  if (error) throw error;

  const zeilen = (data ?? []) as unknown as Zeile[];
  let kopiert = 0;
  let uebersprungen = 0;
  let ohneBild = 0;
  const ohneEigentuemer: string[] = [];

  for (const z of zeilen) {
    // Quelle ist immer das Bild der referenzierten Übung — auch wenn die Fassung
    // schon eine eigene bild_url trägt. Eine eingetragene URL ist KEIN Beweis,
    // dass die Datei existiert; würde sie hier als «schon erledigt» gelten,
    // könnte ein erneuter Lauf eine fehlende Datei nie heilen. Ob das Ziel
    // bereits existiert, entscheidet der Bildspeicher weiter unten.
    const quellPfad = bildUrlToPath(z.exercises?.bild_url);
    if (!quellPfad) {
      ohneBild++;
      continue;
    }
    // Ein Training ohne Eigentümer (anonymisiertes Konto) hat kein Zielverzeichnis.
    // Nicht still überspringen: der Nachweis würde die Lücke sonst erst am Ende
    // melden, ohne zu sagen, welche Zeilen betroffen sind.
    const owner = z.trainings?.owner_id;
    if (!owner) {
      ohneEigentuemer.push(z.id);
      continue;
    }

    const zielPfad = fassungBildPfad(owner, z.id, quellPfad);
    const { error: copyErr } = await supabase.storage
      .from(BUCKET)
      .copy(quellPfad, zielPfad);

    if (copyErr) {
      // Ein vorhandenes Ziel ist der Normalfall beim Wiederanlauf.
      if (/exists|duplicate/i.test(copyErr.message)) {
        uebersprungen++;
        continue;
      }
      throw new Error(`${quellPfad} -> ${zielPfad}: ${copyErr.message}`);
    }
    kopiert++;
  }

  console.log(
    `Zuordnungen: ${zeilen.length} — kopiert: ${kopiert}, übersprungen: ${uebersprungen}, ohne Bild: ${ohneBild}`,
  );
  if (ohneEigentuemer.length > 0) {
    console.warn(
      `WARNUNG: ${ohneEigentuemer.length} Zuordnung(en) in Trainings ohne Eigentümer — ` +
        `Bild nicht kopierbar: ${ohneEigentuemer.join(", ")}`,
    );
  }
}

main().catch((e) => {
  console.error("Bildkopien fehlgeschlagen:", e);
  process.exit(1);
});
