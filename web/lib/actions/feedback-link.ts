"use server";

// Feedback der Spielervertretungen über den privaten Link (Story #544) — ohne
// Anmeldung: Das Geheimnis im Link ist die Berechtigung, die RPCs
// `feedback_link_*` prüfen es bei jedem Schritt. Der Link geht nie ins
// Feedback: Als Seite gilt ein fester Platzhalter (PC 3).
import { createAnonClient } from "@/lib/supabase/anon";
import { istLinkToken } from "@/lib/spieler";
import {
  legeAb,
  sendeNachricht,
  type AblageEingabe,
  type AblageErgebnis,
  type NachrichtEingabe,
  type NachrichtErgebnis,
  type Weg,
} from "@/lib/feedback/dialog";

function linkWeg(token: string): Weg {
  const supabase = createAnonClient();
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc(name, { p_token: token, ...args });
    return error ? null : data;
  };
  return {
    rolle: "spielervertretung",
    seiteFest: "/abmelden/[privater Link]",
    beginnen: () => rpc("feedback_link_beginnen", {}),
    zaehlen: (dialog) => rpc("feedback_link_zaehlen", { p_dialog: dialog }),
    vermerken: async (dialog) => {
      await rpc("feedback_link_vermerken", { p_dialog: dialog });
    },
    ablegen: (dialog, f) =>
      rpc("feedback_link_ablegen", {
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

const UNGUELTIG = "Feedback ist gerade nicht möglich. Versuch es später nochmals.";

export async function feedbackLinkNachrichtAktion(token: string, e: NachrichtEingabe): Promise<NachrichtErgebnis> {
  if (!istLinkToken(token)) return { ok: false, error: UNGUELTIG, ende: true };
  return sendeNachricht(linkWeg(token), e);
}

export async function feedbackLinkAblegenAktion(token: string, e: AblageEingabe): Promise<AblageErgebnis> {
  if (!istLinkToken(token)) return { ok: false, error: UNGUELTIG, ende: true };
  return legeAb(linkWeg(token), e);
}
