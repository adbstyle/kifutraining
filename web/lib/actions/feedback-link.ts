"use server";

// Feedback der Spielervertretungen über den privaten Link (Story #544) — ohne
// Anmeldung: Das Geheimnis im Link ist die Berechtigung, die RPCs
// `feedback_link_*` prüfen es bei jedem Schritt. Der Link geht nie ins
// Feedback: Als Seite gilt ein fester Platzhalter (PC 3).
import { createAnonClient } from "@/lib/supabase/anon";
import { istLinkToken } from "@/lib/spieler";
import { MELDUNG_NICHT_MOEGLICH } from "@/lib/feedback/regeln";
import {
  legeAb,
  rpcWeg,
  sendeNachricht,
  type AblageEingabe,
  type AblageErgebnis,
  type NachrichtEingabe,
  type NachrichtErgebnis,
} from "@/lib/feedback/dialog";

const linkWeg = (token: string) =>
  rpcWeg({
    supabase: createAnonClient(),
    rolle: "spielervertretung",
    seiteFest: "/abmelden/[privater Link]",
    rpc: {
      beginnen: "feedback_link_beginnen",
      zaehlen: "feedback_link_zaehlen",
      vermerken: "feedback_link_vermerken",
      ablegen: "feedback_link_ablegen",
    },
    args: { p_token: token },
  });

export async function feedbackLinkNachrichtAktion(token: string, e: NachrichtEingabe): Promise<NachrichtErgebnis> {
  if (!istLinkToken(token)) return { ok: false, error: MELDUNG_NICHT_MOEGLICH, ende: true };
  return sendeNachricht(linkWeg(token), e);
}

export async function feedbackLinkAblegenAktion(token: string, e: AblageEingabe): Promise<AblageErgebnis> {
  if (!istLinkToken(token)) return { ok: false, error: MELDUNG_NICHT_MOEGLICH, ende: true };
  return legeAb(linkWeg(token), e);
}
