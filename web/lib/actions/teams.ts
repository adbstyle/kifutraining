"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loescheTrainingMitBildern } from "@/lib/training-loeschen";

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

// ── Story 13: Verlassen, Entfernen, Auflösen ─────────────────────────────────

/** Ergebnis eines Austritts bzw. einer Entfernung. `aufloesung_noetig` heisst:
 *  der Vorgang würde das letzte Mitglied entfernen und damit das Team samt
 *  seinen Trainings und Terminen auflösen — dafür braucht es eine eigene
 *  Bestätigung. */
export type MitgliedschaftResult =
  | { status: "entfernt" }
  | { status: "aufgeloest" }
  | { status: "aufloesung_noetig" }
  | { status: "fehler"; error: string };

/** Die Trainings eines Teams samt Bilddateien entfernen.
 *
 *  Läuft VOR dem Ende der Mitgliedschaft: danach greifen weder die
 *  Trainings- noch die Storage-Policy, und die Dateien blieben als Waisen
 *  liegen. Die DB-Kaskade allein räumt nur die Zeilen ab. */
async function raeumeTeamTrainings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  teamId: string,
) {
  const { data: trainings } = await supabase
    .from("trainings")
    .select("id")
    .eq("team_id", teamId);
  for (const t of trainings ?? []) {
    await loescheTrainingMitBildern(supabase, t.id);
  }
}

/** Ein Mitglied entfernen — sich selbst („verlassen") oder eine andere Person.
 *  Beides derselbe Vorgang: im Team sind alle gleichberechtigt.
 *
 *  Ob der Vorgang das Team leert, entscheidet die RPC in derselben Transaktion
 *  wie die Löschung — sonst könnte zwischen Prüfung und Ausführung jemand
 *  anders austreten und das Team unbestätigt verschwinden. */
export async function entferneMitglied(
  teamId: string,
  userId: string,
  bestaetigt = false,
): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };

  // Bei bestätigter Auflösung zuerst aufräumen, solange die Rechte noch stehen.
  if (bestaetigt) await raeumeTeamTrainings(supabase, teamId);

  const { data, error } = await supabase.rpc("entferne_team_mitglied", {
    p_team: teamId,
    p_user: userId,
    p_bestaetigt: bestaetigt,
  });
  if (error) return { status: "fehler", error: error.message };

  const res = data as { status: string };
  revalidiereTeam(teamId);
  if (res.status === "aufloesung_noetig") return { status: "aufloesung_noetig" };
  return res.status === "aufgeloest" ? { status: "aufgeloest" } : { status: "entfernt" };
}

/** Das Team selbst verlassen (Story 13 AK 1–3). */
export async function verlasseTeam(
  teamId: string,
  bestaetigt = false,
): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };
  return entferneMitglied(teamId, user.id, bestaetigt);
}

/** Das Team ausdrücklich auflösen (Story 13 AK 5). Trainings und Termine des
 *  Teams gehen dabei verloren; persönliche Trainings der Mitglieder — auch
 *  Kopien, die jemand zu sich übernommen hat — bleiben unberührt. */
export async function loeseTeamAuf(teamId: string): Promise<TeamActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  await raeumeTeamTrainings(supabase, teamId);

  const { data, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", teamId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Team nicht gefunden." };

  revalidiereTeam(teamId);
  return { ok: true };
}
