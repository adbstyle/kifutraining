// Schritt 3 der Bestand-Überführung (Story 9 AK 6): maschineller Nachweis, dass
// die Überführung vollständig ist. Beendet sich mit Code 1, sobald etwas fehlt —
// erst ein grüner Lauf erlaubt den Verweis-Abbau (Schritt 4).
//
// MÄNGEL (blockieren, Exit 1) — jede Zuordnung muss für sich stehen:
//   1. Sie trägt einen Namen und einen vollständigen Herkunfts-Stempel.
//   2. Ihre Bilddatei existiert im Bildspeicher.
//   3. Hat die Quelle ein Bild, hat die Fassung eine eigene Bild-URL.
//
// HINWEISE (blockieren nicht): Inhalte, die von der noch auflösbaren Quelle
// abweichen. Direkt nach der Überführung sollte das nichts sein — eine Fassung
// ist aber bewusst bearbeitbar, und wer im Auslieferungsfenster schon bearbeitet
// hat, weicht zu Recht ab. Solche Abweichungen sind darum zu prüfen, aber kein
// Grund, den Verweis-Abbau zu blockieren.
//
// Lokal:   npx tsx scripts/fassungen-nachweis.ts
// Remote:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/fassungen-nachweis.ts
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { bildUrlToPath } from "../lib/storage";
import { FASSUNG_INHALT_FELDER } from "../lib/fassung";

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

// Verglichen wird genau die Feldmenge, die beim Kopieren übernommen wird —
// bewusst dieselbe Konstante, nicht eine zweite Liste: sonst prüfte der
// „maschinelle Nachweis" ein neu hinzugekommenes Übungsfeld stillschweigend
// nicht mehr. Bild und Diagramm sind eigene Kopien und werden separat geprüft.
const VERGLEICHSFELDER = FASSUNG_INHALT_FELDER;

type Zeile = Record<string, unknown> & {
  id: string;
  exercise_id: string | null;
  bild_url: string | null;
  diagramm: unknown;
  herkunft_name: string | null;
  herkunft_typ: string | null;
  herkunft_datum: string | null;
  name: string | null;
  exercises: (Record<string, unknown> & { bild_url: string | null; diagramm: unknown }) | null;
};

/** Zwei gespeicherte Werte inhaltlich vergleichen (jsonb/Arrays kommen als
 *  strukturierte Werte zurück, nicht als Text). */
function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Ein Diagramm ohne Element-IDs — die Vergleichsform für Kopien.
 *
 *  Die Überführungs-Migration kopiert das Diagramm unverändert, das Übernehmen
 *  im laufenden Betrieb dagegen mit frischen Element-IDs. Verglichen wird darum
 *  die Struktur ohne IDs: so gilt derselbe Nachweis für beide Wege. */
function diagrammStruktur(d: unknown): unknown {
  if (!d || typeof d !== "object") return null;
  const { version, elemente } = d as { version?: unknown; elemente?: unknown };
  if (!Array.isArray(elemente)) return null;
  return {
    version,
    elemente: elemente.map((e) => {
      const { id: _id, ...rest } = (e ?? {}) as Record<string, unknown>;
      return rest;
    }),
  };
}

async function main() {
  console.log(`Nachweis gegen ${URL_} (Bucket '${BUCKET}')`);
  const maengel: string[] = [];
  const hinweise: string[] = [];

  const felder = VERGLEICHSFELDER.join(", ");
  const { data, error } = await supabase
    .from("training_exercises")
    .select(
      `id, exercise_id, bild_url, diagramm, herkunft_name, herkunft_typ, herkunft_datum, ${felder},
       exercises ( bild_url, diagramm, ${felder} )`,
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
          hinweise.push(
            `${kurz}: Feld ${f} weicht von der Quelle ab ` +
              `(Fassung: ${JSON.stringify(z[f])}, Quelle: ${JSON.stringify(z.exercises[f])})`,
          );
      }
      // Das Diagramm ist eine eigene Kopie und darf frische Element-IDs tragen;
      // die Struktur muss übereinstimmen.
      if (!gleich(diagrammStruktur(z.diagramm), diagrammStruktur(z.exercises.diagramm)))
        hinweise.push(`${kurz}: Diagramm weicht in der Struktur von der Quelle ab`);

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

  if (hinweise.length > 0) {
    console.log(`\n${hinweise.length} Abweichung(en) von der Quelle — bitte prüfen:`);
    for (const h of hinweise) console.log(`  · ${h}`);
  }

  if (maengel.length > 0) {
    console.error(`\nNachweis NICHT erbracht — ${maengel.length} Mangel/Mängel:`);
    for (const m of maengel) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log("\nNachweis erbracht: jede Zuordnung steht für sich.");
}

main().catch((e) => {
  console.error("Nachweis fehlgeschlagen:", e);
  process.exit(1);
});
