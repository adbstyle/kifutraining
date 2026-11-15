// Bilddateien abräumen, wenn mit dem Datensatz auch das Recht daran erlischt.
//
// Normalfall bleibt der Weg über den request-gebundenen Client: wer löschen
// darf, räumt selbst auf (`loescheTrainingMitBildern`). Beim Auflösen eines
// Teams geht das nicht — das löst die Vereinsverwaltung auf (`verein_team_aufloesen`),
// und sie ist kein Mitglied des Teams: Die Storage-Policy `ist_team_bildpfad`
// gilt nur dessen Mitgliedern und nach der Auflösung für niemanden mehr. Die
// RPC liefert darum die Bildpfade der gelöschten Fassungen zurück, und der
// Nachlauf räumt sie weg.
//
// Darum hier — und nur für diesen Nachlauf — der Service-Role-Client: er löscht
// ausschliesslich Pfade zu Zeilen, die nachweislich nicht mehr existieren.
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET } from "@/lib/storage";

/** So viele Pfade gehen in einem Aufruf an den Speicher: Beim Löschen eines
 *  ganzen Vereins können es viele sein, und eine Anfrage mit tausenden Pfaden
 *  ist zu gross. */
const STUECK = 100;

/** Verwaiste Bilddateien entfernen (no-op bei leerer Liste), in Stücken.
 *
 *  Best effort mit Absicht: die Zeilen sind bereits weg, eine liegengebliebene
 *  Datei ist folgenlos, und ein Fehlschlag darf den auslösenden Vorgang nie
 *  scheitern lassen — auch ein gescheitertes Stück nicht die übrigen. Der
 *  Rückgabewert von `remove` wird deshalb bewusst nicht geprüft. */
export async function raeumeVerwaisteBilder(pfade: string[]): Promise<void> {
  if (pfade.length === 0) return;
  for (let i = 0; i < pfade.length; i += STUECK) {
    try {
      await createAdminClient().storage.from(STORAGE_BUCKET).remove(pfade.slice(i, i + STUECK));
    } catch {
      /* ignorieren: Waisen im Bildspeicher sind folgenlos */
    }
  }
}
