"use server";

// Der frisch gelesene Stand eines Kontos gegen die Grenzen (Story #588): Die
// Dialogstufe vor Kopieren, Übernehmen und «In die Bibliothek» fragt ihn beim
// Öffnen, statt dem Zähler einer älteren Seite zu trauen. Eine reine Auskunft:
// Die Datenebene weist ab, auch wenn dieser Stand «frei» sagt.

import { NICHT_ANGEMELDET, angemeldet } from "@/lib/actions/adapter";
import { ladeKontoGrenzen } from "@/lib/kern/konto";
import type { KontoArt, KontoGrenze } from "@/lib/konto-grenzen";

/** `grenze: null` — das Konto gehört einem Verein, die Grenzen gelten nicht. */
export type BestandErgebnis = { ok: true; grenze: KontoGrenze | null } | { ok: false; error: string };

export async function ladeBestandAktion(art: KontoArt): Promise<BestandErgebnis> {
  // Trust Boundary: Eine Server Action ist ein offener Endpunkt, die Art kommt vom Client.
  if (art !== "uebungen" && art !== "trainings") return { ok: false, error: "Unbekannte Angabe." };
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  const r = await ladeKontoGrenzen(a.supabase);
  if (!r.ok) return { ok: false, error: r.meldung };
  return { ok: true, grenze: r.wert.grenzen ? r.wert.grenzen[art] : null };
}
