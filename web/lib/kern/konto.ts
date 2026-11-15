import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { kontoGrenzenAus, type KontoGrenzen } from "@/lib/konto-grenzen";
import { fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Der frisch gelesene Stand eines Kontos gegen die Grenzen (Story #588): die
 * Dialogstufe vor Kopieren, Übernehmen und «In die Bibliothek» fragt ihn beim
 * Öffnen, statt dem Zähler einer älteren Seite zu trauen.
 *
 * `null`: Das Konto gehört einem Verein, die Grenzen gelten nicht (PC 3). Der
 * Stand dient nur der Auskunft — die Datenebene weist ab, auch wenn er hier
 * «frei» sagt (Rennen, Aufnahme in einen Verein in der Zwischenzeit).
 */
export async function ladeKontoGrenzen(supabase: SupabaseClient): Promise<KernErgebnis<{ grenzen: KontoGrenzen | null }>> {
  const { data, error } = await supabase.rpc("meine_vereinslage");
  if (error) {
    console.error("[konto] Vereinslage lesen", error.message);
    return fehlschlag("technisch", "Der Stand liess sich nicht laden. Bitte versuche es noch einmal.", { wiederholbar: true });
  }
  const grenzen = kontoGrenzenAus((data as { grenzen?: unknown } | null)?.grenzen);
  if (grenzen === undefined) {
    console.error("[konto] meine_vereinslage: grenzen hat nicht die erwartete Form");
    return fehlschlag("technisch", "Der Stand liess sich nicht laden. Bitte versuche es noch einmal.", { wiederholbar: true });
  }
  return ok({ grenzen });
}
