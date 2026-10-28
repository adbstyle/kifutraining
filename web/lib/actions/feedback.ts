"use server";

// Feedback der Trainer:innen im Dialog mit der KI (Story #542). Der Zugang ist
// das Konto: Die RPCs nehmen es aus der Sitzung, nie vom Aufrufer.
import type { SupabaseClient } from "@supabase/supabase-js";
import { angemeldet, NICHT_ANGEMELDET } from "@/lib/actions/adapter";
import {
  legeAb,
  sendeNachricht,
  type AblageEingabe,
  type NachrichtEingabe,
  type NachrichtErgebnis,
  type Weg,
} from "@/lib/feedback/dialog";

function kontoWeg(supabase: SupabaseClient): Weg {
  const rpc = async (name: string, args?: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name, args);
    return error ? null : data;
  };
  return {
    rolle: "trainer",
    beginnen: () => rpc("feedback_dialog_beginnen"),
    zaehlen: (dialog) => rpc("feedback_nachricht_zaehlen", { p_dialog: dialog }),
    vermerken: async (dialog) => {
      await rpc("feedback_vorschlag_vermerken", { p_dialog: dialog });
    },
    ablegen: (dialog, f) =>
      rpc("feedback_ablegen", {
        p_dialog: dialog,
        p_einordnung: f.einordnung,
        p_titel: f.titel,
        p_zusammenfassung: f.punkte,
        p_verlauf: f.verlauf,
        p_seite: f.seite,
        p_version: f.version,
        p_umgebung: f.umgebung,
        p_geraet: f.geraet,
      }),
  };
}

export async function feedbackNachrichtAktion(e: NachrichtEingabe): Promise<NachrichtErgebnis> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET, ende: true };
  return sendeNachricht(kontoWeg(a.supabase), e);
}

export async function feedbackAblegenAktion(e: AblageEingabe): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET };
  return legeAb(kontoWeg(a.supabase), e);
}
