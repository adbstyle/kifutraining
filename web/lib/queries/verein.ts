import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { kontoGrenzenAus, type KontoGrenzen } from "@/lib/konto-grenzen";

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
  /** Nur für Konten ohne Verein (#588); mit Verein `null`. */
  grenzen: unknown;
};

/** Die Vereinslage einmal pro Request gelesen: `lage` oder der Fehler der
 *  Datenebene. Beide Zugänge unten teilen sich diese Abfrage. */
const leseVereinslage = cache(
  async (): Promise<{ lage: Vereinslage | null; grenzen: KontoGrenzen | null; fehler: Error | null }> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("meine_vereinslage");
    if (error) return { lage: null, grenzen: null, fehler: new Error(`meine_vereinslage: ${error.message}`) };
    const roh = data as VereinslageRoh | null;
    const v = roh?.verein;
    // Die Form von `grenzen` ist Teil des Vertrags: Eine Antwort, die ihr nicht
    // entspricht, ist ein technischer Fehler, keine halbe Auskunft.
    const grenzen = kontoGrenzenAus(roh?.grenzen);
    if (grenzen === undefined) return { lage: null, grenzen: null, fehler: new Error("meine_vereinslage: grenzen hat nicht die erwartete Form") };
    return {
      lage: v ? { id: v.id, name: v.name, istVerwaltung: v.ist_verwaltung, istTeammitglied: v.ist_teammitglied } : null,
      grenzen: v ? null : grenzen,
      fehler: null,
    };
  },
);

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

/** Die Grenzen eines Kontos ohne Verein (#588) für Anzeige und Seiten; `null`
 *  mit Verein (PC 3). Ein Datenbankfehler wird protokolliert und ergibt `null`:
 *  Die Anzeige ist Auskunft und entscheidet nie — die Datenebene weist ab. */
export const getMeineGrenzen = async (): Promise<KontoGrenzen | null> => {
  const { grenzen, fehler } = await leseVereinslage();
  if (fehler) console.error("[verein] Vereinslage lesen", fehler);
  return grenzen;
};

/** Wie `getMeinVerein`, aber ein Datenbankfehler wirft: Die Seiten unter
 *  `/verein` dürfen nicht so tun, als gäbe es keinen Verein. */
export async function getMeinVereinOderWurf(): Promise<Vereinslage | null> {
  const { lage, fehler } = await leseVereinslage();
  if (fehler) throw fehler;
  return lage;
}
