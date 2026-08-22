// Schritt 3 der Bestand-Überführung (Story 9 AK 6): maschineller Nachweis, dass
// die Überführung vollständig ist. Beendet sich mit Code 1, sobald etwas fehlt —
// erst ein grüner Lauf erlaubt den Verweis-Abbau (Schritt 4).
//
// Geprüft wird:
//   1. Jede Zuordnung trägt einen Namen und einen vollständigen Herkunfts-Stempel.
//   2. Wo die Quelle noch auflösbar ist, stimmen die Inhalte mit ihr überein.
//   3. Jede Fassung mit Bild-URL hat ihr Storage-Objekt.
//   4. Jede Zuordnung mit Quellbild hat auch eine eigene Bild-URL.
//
// Lokal:   npx tsx scripts/fassungen-nachweis.ts
// Remote:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/fassungen-nachweis.ts
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bildUrlToPath } from "../lib/storage";

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

const supabase = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Inhaltsfelder, die mit der Quelle übereinstimmen müssen. Bild und Diagramm
 *  werden separat geprüft (eigene Kopien, andere Identität). */
const VERGLEICHSFELDER = [
  "name",
  "kategorien",
  "erscheinungsform",
  "feldtyp",
  "anzahl_kinder",
  "material",
  "methodischer_fahrplan",
  "aufbau",
  "varianten",
  "bild_quelle",
] as const;

type Zeile = Record<string, unknown> & {
  id: string;
  exercise_id: string | null;
  bild_url: string | null;
  herkunft_name: string | null;
  herkunft_typ: string | null;
  herkunft_datum: string | null;
  name: string | null;
  exercises: (Record<string, unknown> & { bild_url: string | null }) | null;
};

/** Zwei gespeicherte Werte inhaltlich vergleichen (jsonb/Arrays kommen als
 *  strukturierte Werte zurück, nicht als Text). */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function main() {
  console.log(`Nachweis gegen ${URL_} (Bucket '${BUCKET}')`);
  const maengel: string[] = [];

  const felder = VERGLEICHSFELDER.join(", ");
  const { data, error } = await supabase
    .from("training_exercises")
    .select(
      `id, exercise_id, bild_url, herkunft_name, herkunft_typ, herkunft_datum, ${felder},
       exercises ( bild_url, ${felder} )`,
    );
  if (error) throw error;
  const zeilen = (data ?? []) as unknown as Zeile[];

  // Storage-Inventar je Eigentümer-Ordner einmal einlesen, statt pro Zeile zu
  // fragen (ein Request pro Ordner statt pro Bild).
  const inventar = new Map<string, Set<string>>();
  async function objektExistiert(pfad: string): Promise<boolean> {
    const ordner = pfad.slice(0, pfad.lastIndexOf("/"));
    const datei = pfad.slice(pfad.lastIndexOf("/") + 1);
    if (!inventar.has(ordner)) {
      const { data: liste } = await supabase.storage.from(BUCKET).list(ordner, { limit: 1000 });
      inventar.set(ordner, new Set((liste ?? []).map((o) => o.name)));
    }
    return inventar.get(ordner)!.has(datei);
  }

  let mitQuelle = 0;
  let ohneQuelle = 0;
  let mitBild = 0;

  for (const z of zeilen) {
    const kurz = `Zuordnung ${z.id}`;

    // 1) Grundstempel
    if (!z.name || !z.name.trim()) maengel.push(`${kurz}: kein Name`);
    if (!z.herkunft_name || !z.herkunft_typ || !z.herkunft_datum)
      maengel.push(`${kurz}: Herkunfts-Stempel unvollständig`);

    // 2) Inhaltsabgleich mit der noch auflösbaren Quelle
    if (z.exercises) {
      mitQuelle++;
      for (const f of VERGLEICHSFELDER) {
        if (!gleich(z[f], z.exercises[f]))
          maengel.push(
            `${kurz}: Feld ${f} weicht von der Quelle ab ` +
              `(Fassung: ${JSON.stringify(z[f])}, Quelle: ${JSON.stringify(z.exercises[f])})`,
          );
      }
      // 4) Quellbild vorhanden, Fassung ohne eigenes Bild
      if (z.exercises.bild_url && !z.bild_url)
        maengel.push(`${kurz}: Quelle hat ein Bild, die Fassung keines`);
    } else {
      ohneQuelle++;
    }

    // 3) Bilddatei der Fassung existiert
    if (z.bild_url) {
      mitBild++;
      const pfad = bildUrlToPath(z.bild_url);
      if (!pfad) {
        maengel.push(`${kurz}: bild_url ist kein Storage-Pfad (${z.bild_url})`);
      } else if (!(await objektExistiert(pfad))) {
        maengel.push(`${kurz}: Bilddatei fehlt im Storage (${pfad})`);
      }
    }
  }

  console.log(
    `Geprüft: ${zeilen.length} Zuordnungen — mit auflösbarer Quelle: ${mitQuelle}, ` +
      `ohne Quelle: ${ohneQuelle}, mit Bild: ${mitBild}`,
  );

  if (maengel.length > 0) {
    console.error(`\nNachweis NICHT erbracht — ${maengel.length} Mangel/Mängel:`);
    for (const m of maengel) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log("Nachweis erbracht: die Überführung ist vollständig.");
}

main().catch((e) => {
  console.error("Nachweis fehlgeschlagen:", e);
  process.exit(1);
});
