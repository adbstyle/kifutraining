import { createClient } from "@/lib/supabase/server";

// Server-only Datenzugriff; kein Prerender ohne DB.
export const dynamic = "force-dynamic";

const TRAININGSTEILE = [
  { key: "auffangen", label: "Auffangen" },
  { key: "einleitung", label: "Einleitung" },
  { key: "hauptteil", label: "Hauptteil" },
  { key: "ausklang", label: "Ausklang" },
] as const;

export default async function Home() {
  let exercises:
    | { id: string; slug: string; name: string; trainingsteil: string }[]
    | null = null;
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error: dbError } = await supabase
      .from("exercises")
      .select("id, slug, name, trainingsteil")
      .order("name");
    if (dbError) throw dbError;
    exercises = data;
  } catch (e) {
    error = e instanceof Error ? e.message : "Unbekannter Fehler";
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Kinderfussball — Übungen</h1>
      <p className="mt-2 text-gray-600">
        Öffentlicher Übungskatalog. Server-only Datenzugriff über Supabase + RLS.
      </p>

      {error && (
        <div className="mt-6 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Datenbank nicht erreichbar oder noch nicht geseedet:
          <code className="ml-1">{error}</code>
          <div className="mt-1 text-amber-700">
            Lokal: <code>supabase start</code> → <code>npm run db:reset</code> →{" "}
            <code>npm run seed</code>.
          </div>
        </div>
      )}

      {exercises && (
        <div className="mt-6 space-y-6">
          <p className="text-sm text-gray-500">{exercises.length} Übungen</p>
          {TRAININGSTEILE.map(({ key, label }) => {
            const items = exercises!.filter((e) => e.trainingsteil === key);
            if (items.length === 0) return null;
            return (
              <section key={key}>
                <h2 className="font-semibold">
                  {label}{" "}
                  <span className="text-gray-400">({items.length})</span>
                </h2>
                <ul className="mt-1 list-inside list-disc text-gray-700">
                  {items.map((e) => (
                    <li key={e.id}>{e.name}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
