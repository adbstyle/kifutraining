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

/** Der Verein des angemeldeten Kontos, einmal pro Request gelesen: Der Kopf
 *  eines Teams und die Teamübersicht nennen ihn. `null`, wenn das Konto
 *  keinem Verein angehört — dann entfällt die Krume. Wirft bei einem
 *  Datenbankfehler — wie jede Query dieses Layers. */
export const getMeinVerein = cache(async (): Promise<Vereinslage | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("meine_vereinslage");
  if (error) throw error;
  const v = (data as VereinslageRoh | null)?.verein;
  return v ? { id: v.id, name: v.name, istVerwaltung: v.ist_verwaltung, istTeammitglied: v.ist_teammitglied } : null;
});
