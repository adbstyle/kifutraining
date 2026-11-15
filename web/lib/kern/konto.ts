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

/** Der Verein der handelnden Person, wie `meine_vereinslage()` ihn nennt:
 *  `null` für ein Konto ohne Verein. Eine Person gehört höchstens einem
 *  Verein an (AP §3.1), der Verein ihrer Teams ist also dieser. Lesbar auch
 *  ohne Team und mit einem KI-Token (keine `verein_*`-RPC, kein
 *  `nur_in_der_anwendung()`) — für die KI-Werkzeuge `teams_abrufen`,
 *  `spielerliste_abrufen` und die Rückfrage beim Herausnehmen (Story #589). */
export type Vereinslage = { name: string; istVerwaltung: boolean } | null;

export async function ladeVereinslage(supabase: SupabaseClient): Promise<KernErgebnis<Vereinslage>> {
  const { data, error } = await supabase.rpc("meine_vereinslage");
  if (error) {
    console.error("[konto] Vereinslage lesen", error.message);
    return fehlschlag("technisch", "Der Verein liess sich gerade nicht lesen. Bitte versuche es noch einmal.", { wiederholbar: true });
  }
  const v = (data as { verein: { name: string; ist_verwaltung: boolean } | null } | null)?.verein ?? null;
  return ok(v ? { name: v.name, istVerwaltung: v.ist_verwaltung } : null);
}
