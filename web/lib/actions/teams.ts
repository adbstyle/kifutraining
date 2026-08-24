"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions rund um Teams (Team-Epic Stories 3, 4).
 *
 * Alles, was auth.users auflösen oder mehrere Tabellen atomar anfassen muss,
 * läuft über SECURITY-DEFINER-RPCs; hier bleiben Eingabeprüfung, Übersetzung
 * der RPC-Zustände in Klartext und die Cache-Invalidierung.
 */

const MAX_NAME = 60;

export type TeamActionResult = { ok: boolean; error?: string };

/** Alle Ansichten eines Teams neu validieren — eine Quelle, damit eine neue
 *  Route nicht an einer von mehreren Stellen vergessen wird. */
function revalidiereTeam(teamId?: string) {
  revalidatePath("/teams");
  if (teamId) revalidatePath(`/team/${teamId}`);
}

function pruefeName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bitte einen Teamnamen angeben." };
  if (trimmed.length > MAX_NAME)
    return { ok: false, error: `Der Teamname darf höchstens ${MAX_NAME} Zeichen lang sein.` };
  return { ok: true, name: trimmed };
}

/** Ein Team anlegen; der Anlegende ist sofort Mitglied (Story 3). Team und
 *  erste Mitgliedschaft entstehen atomar in der RPC — sonst gäbe es bei einem
 *  Abbruch ein Team, das niemand mehr sieht. */
export async function erstelleTeam(
  name: string,
): Promise<{ ok: true; teamId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const geprueft = pruefeName(name);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase.rpc("create_team", { p_name: geprueft.name });
  if (error) return { ok: false, error: error.message };

  revalidiereTeam();
  return { ok: true, teamId: data as string };
}

/** Team umbenennen (Story 3 AK 5). Jedes Mitglied darf das — alle sind
 *  gleichberechtigt; die RLS prüft die Mitgliedschaft. */
export async function benenneTeamUm(teamId: string, name: string): Promise<TeamActionResult> {
  const supabase = await createClient();
  const geprueft = pruefeName(name);
  if (!geprueft.ok) return geprueft;

  const { data, error } = await supabase
    .from("teams")
    .update({ name: geprueft.name })
    .eq("id", teamId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Team nicht gefunden." };

  revalidiereTeam(teamId);
  return { ok: true };
}

export type TrainerSuche =
  | { status: "gefunden"; anzeigeName: string }
  | { status: "bereits_mitglied" }
  | { status: "fehler"; error: string };

/** Vor der Aufnahme nachsehen, wer sich hinter der Adresse verbirgt (Story 4
 *  AK 2). Bewusste, dokumentierte Ausnahme von der Anti-Enumeration-Linie: die
 *  Vorschau verhindert, dass jemand versehentlich eine fremde Person ins Team
 *  holt. Die RPC bremst erfolglose Versuche aus. */
export async function sucheTrainer(teamId: string, email: string): Promise<TrainerSuche> {
  const supabase = await createClient();
  const adresse = email.trim();
  if (!adresse) return { status: "fehler", error: "Bitte eine E-Mail-Adresse angeben." };

  const { data, error } = await supabase.rpc("finde_trainer", {
    p_team_id: teamId,
    p_email: adresse,
  });
  if (error) return { status: "fehler", error: error.message };

  const res = data as { status: string; anzeige_name?: string };
  switch (res.status) {
    case "gefunden":
      return { status: "gefunden", anzeigeName: res.anzeige_name! };
    case "bereits_mitglied":
      return { status: "bereits_mitglied" };
    case "gebremst":
      return {
        status: "fehler",
        error: "Zu viele Versuche — bitte später erneut.",
      };
    default:
      return {
        status: "fehler",
        error: "Unter dieser Adresse ist niemand registriert.",
      };
  }
}

/** Nach der Vorschau-Bestätigung aufnehmen (Story 4 AK 6). Zweimal aufnehmen
 *  wirkt einmalig — die Mitgliedschaft ist ein Zustand, kein Vorgang. */
export async function nimmMitgliedAuf(
  teamId: string,
  email: string,
): Promise<{ ok: true; anzeigeName: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_team_member", {
    p_team_id: teamId,
    p_email: email.trim(),
  });
  if (error) return { ok: false, error: error.message };

  const res = data as { status: string; anzeige_name?: string };
  if (res.status !== "aufgenommen")
    return { ok: false, error: "Unter dieser Adresse ist niemand registriert." };

  revalidiereTeam(teamId);
  return { ok: true, anzeigeName: res.anzeige_name! };
}
