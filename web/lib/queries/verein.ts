import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Query-Layer für den Verein (Epic Vereine #575, Story #577).
 *
 * Die Zugehörigkeit zu einem Verein ist abgeleitet: Mitglied ist, wer einem
 * Team oder der Verwaltung des Vereins angehört. Gelesen wird sie über die
 * RPC `meine_vereinslage()`, nie aus den Tabellen.
 */

export type Vereinslage = {
  id: string;
  name: string;
  istVerwaltung: boolean;
  istTeammitglied: boolean;
};

type VereinslageRoh = {
  verein: { id: string; name: string; ist_verwaltung: boolean; ist_teammitglied: boolean } | null;
};

/** Die Vereinslage einmal pro Request gelesen: `lage` oder der Fehler der
 *  Datenebene. Beide Zugänge unten teilen sich diese Abfrage. */
const leseVereinslage = cache(async (): Promise<{ lage: Vereinslage | null; fehler: Error | null }> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meine_vereinslage");
  if (error) return { lage: null, fehler: new Error(`meine_vereinslage: ${error.message}`) };
  const v = (data as VereinslageRoh | null)?.verein;
  return {
    lage: v ? { id: v.id, name: v.name, istVerwaltung: v.ist_verwaltung, istTeammitglied: v.ist_teammitglied } : null,
    fehler: null,
  };
});

/** Der Verein des angemeldeten Kontos: Der Kopf eines Teams, die Teamübersicht
 *  und der Bereich-Wechsler nennen ihn. `null`, wenn das Konto keinem Verein
 *  angehört. Ein Datenbankfehler wird protokolliert und ergibt ebenfalls
 *  `null`: Krume und Wechsler sind Zierde und dürfen Seiten nicht auf die
 *  Fehlerseite schicken. */
export const getMeinVerein = async (): Promise<Vereinslage | null> => {
  const { lage, fehler } = await leseVereinslage();
  if (fehler) console.error("[verein] Vereinslage lesen", fehler);
  return lage;
};

/** Wie `getMeinVerein`, aber ein Datenbankfehler wirft: Die Seiten unter
 *  `/verein` dürfen nicht so tun, als gäbe es keinen Verein. */
export async function getMeinVereinOderWurf(): Promise<Vereinslage | null> {
  const { lage, fehler } = await leseVereinslage();
  if (fehler) throw fehler;
  return lage;
}
