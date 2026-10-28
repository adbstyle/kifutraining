"use server";

// Feedback der Trainer:innen im Dialog mit der KI (Story #542). Der Zugang ist
// das Konto: Die RPCs nehmen es aus der Sitzung, nie vom Aufrufer.
import type { SupabaseClient } from "@supabase/supabase-js";
import { angemeldet, NICHT_ANGEMELDET } from "@/lib/actions/adapter";
import {
  legeAb,
  rpcWeg,
  sendeNachricht,
  type AblageEingabe,
  type AblageErgebnis,
  type NachrichtEingabe,
  type NachrichtErgebnis,
} from "@/lib/feedback/dialog";

const kontoWeg = (supabase: SupabaseClient) =>
  rpcWeg({
    supabase,
    rolle: "trainer",
    rpc: {
      beginnen: "feedback_dialog_beginnen",
      zaehlen: "feedback_nachricht_zaehlen",
      vermerken: "feedback_vorschlag_vermerken",
      ablegen: "feedback_ablegen",
    },
  });

export async function feedbackNachrichtAktion(e: NachrichtEingabe): Promise<NachrichtErgebnis> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET, ende: true };
  return sendeNachricht(kontoWeg(a.supabase), e);
}

export async function feedbackAblegenAktion(e: AblageEingabe): Promise<AblageErgebnis> {
  const a = await angemeldet();
  if (!a) return { ok: false, error: NICHT_ANGEMELDET, ende: true };
  return legeAb(kontoWeg(a.supabase), e);
}
