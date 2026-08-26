// Bilddateien abräumen, wenn mit dem Datensatz auch das Recht daran erlischt.
//
// Normalfall bleibt der Weg über den request-gebundenen Client: wer löschen
// darf, räumt selbst auf (`loescheTrainingMitBildern`). Beim Auflösen eines
// Teams geht das nicht — die Entscheidung, ob wirklich aufgelöst wird, fällt in
// derselben Transaktion, die die Mitgliedschaft beendet, und danach greift die
// Storage-Policy `ist_team_bildpfad` für niemanden mehr. Vorher aufzuräumen
// hiesse, den Bestand eines Teams zu vernichten, das die Zählung anschliessend
// am Leben lässt.
//
// Darum hier — und nur für diesen Nachlauf — der Service-Role-Client: er löscht
// ausschliesslich Pfade zu Zeilen, die nachweislich nicht mehr existieren.
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage";
import { eigeneBildPfade } from "@/lib/fassung";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Eine Fassungs-Zeile, soweit fürs Aufräumen nötig. */
export type BildKandidat = { id: string; bild_url: string | null };

/** Die Fassungen aller Trainings dieser Teams — die eine Formulierung von
 *  „welche Bilddateien hängen an diesem Team", statt sie je Aufrufer erneut zu
 *  schreiben. Einzusammeln ist sie immer VOR dem Löschen: danach sind die
 *  Zeilen weg, und die Kaskade nimmt nur die Zeilen mit, nicht die Dateien. */
export async function teamBildKandidaten(
  supabase: SupabaseClient,
  teamIds: string[],
): Promise<BildKandidat[]> {
  if (teamIds.length === 0) return [];
  const { data } = await supabase
    .from("training_exercises")
    .select("id, bild_url, trainings!inner ( team_id )")
    .in("trainings.team_id", teamIds);
  return data ?? [];
}

/** Verwaiste Bilddateien entfernen (no-op bei leerer Liste).
 *
 *  Best effort mit Absicht: die Zeilen sind bereits weg, eine liegengebliebene
 *  Datei ist folgenlos, und ein Fehlschlag darf den auslösenden Vorgang nie
 *  scheitern lassen. Der Rückgabewert von `remove` wird deshalb bewusst nicht
 *  geprüft. */
export async function raeumeVerwaisteBilder(pfade: string[]): Promise<void> {
  if (pfade.length === 0) return;
  try {
    await createAdminClient().storage.from(STORAGE_BUCKET).remove(pfade);
  } catch {
    /* ignorieren: Waisen im Bildspeicher sind folgenlos */
  }
}

/** Von den Kandidaten nur die Bilder derer entfernen, deren Zeile tatsächlich
 *  verschwunden ist.
 *
 *  Für Vorgänge, die eine Löschung nur ANSTOSSEN und deren Tragweite erst
 *  nachher feststeht — etwa die Konto-Löschung, die Teams über die
 *  auth.users-Kaskade auflöst. Ob ein Team dabei wirklich fiel, entscheidet
 *  sich erst mit der Kaskade: ist zwischenzeitlich jemand beigetreten, lebt es
 *  weiter, und seine Bilder müssen bleiben. */
export async function raeumeGeloeschteFassungsBilder(
  kandidaten: BildKandidat[],
): Promise<void> {
  if (kandidaten.length === 0) return;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("training_exercises")
    .select("id")
    .in(
      "id",
      kandidaten.map((k) => k.id),
    );
  // Im Zweifel nichts löschen: eine Waise ist harmlos, ein gelöschtes Bild
  // einer noch lebenden Fassung wäre Datenverlust.
  if (error) return;
  const nochDa = new Set((data ?? []).map((r) => r.id));
  await raeumeVerwaisteBilder(
    eigeneBildPfade(kandidaten.filter((k) => !nochDa.has(k.id))),
  );
}
