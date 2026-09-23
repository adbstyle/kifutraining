// Die Brücke zwischen Server Actions und Fachkern (Epic #190, Blueprint 12 §6):
// den angemeldeten Nutzer holen und das Kern-Ergebnis in die Ergebnisformen
// der Oberfläche übersetzen.
//
// Bewusst OHNE "use server": Eine solche Datei darf nur async-Funktionen
// exportieren, und jede davon wäre ein öffentlich aufrufbarer Endpunkt.
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { revalidiereTraining } from "@/lib/revalidate";
import type { TrainingActionResult } from "@/lib/actions/trainings";
import { NICHT_GEFUNDEN, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/** Die Meldung jeder Action, die ohne Anmeldung aufgerufen wird. */
export const NICHT_ANGEMELDET = "Nicht angemeldet.";

/** Der Cookie-Client samt angemeldetem Nutzer, oder `null` ohne Anmeldung —
 *  der Anfang jeder Action, die den Kern aufruft. */
export async function angemeldet(): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** Die Meldung, wie die Oberfläche sie zeigt. Ein fremdes öffentliches
 *  Training (`fremd`) heisst dort weiter «nicht gefunden» — die eigene
 *  Meldung dafür ist dem KI-Weg vorbehalten (PO 2026-09-23). */
export function oberflaechenMeldung(
  f: KernFehler,
  nichtGefunden: string = NICHT_GEFUNDEN.training,
): string {
  return f.fremd ? nichtGefunden : f.meldung;
}

/** Kern-Ergebnis → Ergebnis einer Editor-Aktion. `bedingung` und
 *  `varianteId` reisen immer mit; ausgewertet werden sie nur dort, wo eine
 *  Veröffentlichungs-Bedingung greifen kann (#204 AK 3). `nichtGefunden`
 *  ist der Text für ein fremdes Training — bei Fassungs-Aktionen
 *  «Zuordnung nicht gefunden.» wie bisher. */
export function alsActionResult(
  r: KernErgebnis<unknown>,
  nichtGefunden: string = NICHT_GEFUNDEN.training,
): TrainingActionResult {
  if (r.ok) return { ok: true };
  return {
    ok: false,
    error: oberflaechenMeldung(r, nichtGefunden),
    bedingung: r.bedingung,
    varianteId: r.varianteId,
  };
}

/** Eine Editor-Aktion über den Kern — der Ablauf, den jede sofort speichernde
 *  Action des Editors teilt: angemeldet → Kern → bei Erfolg alle Ansichten
 *  des Trainings neu validieren (`wert.trainingId`) → Ergebnis der
 *  Oberfläche. `zusatz` hängt Felder an den Erfolg (etwa `mismatched`),
 *  `nichtGefunden` ist der Text für ein fremdes Training — bei
 *  Fassungs-Aktionen «Zuordnung nicht gefunden.». */
export async function editorAktion<T extends { trainingId: string }, Z extends object = object>(
  lauf: (supabase: SupabaseClient, userId: string) => Promise<KernErgebnis<T>>,
  o: { nichtGefunden?: string; zusatz?: (wert: T) => Z } = {},
): Promise<TrainingActionResult & Partial<Z>> {
  // Ein Fehlschlag trägt keine Zusatzfelder — `Partial<Z>` lässt sie offen.
  type Ergebnis = TrainingActionResult & Partial<Z>;
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET } as Ergebnis;
  const r = await lauf(a.supabase, a.userId);
  if (!r.ok) return alsActionResult(r, o.nichtGefunden) as Ergebnis;
  revalidiereTraining(r.wert.trainingId);
  return { ok: true, ...(o.zusatz?.(r.wert) ?? ({} as Z)) };
}
