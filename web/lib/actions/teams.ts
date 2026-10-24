"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidiereTeam } from "@/lib/revalidate";
import { teamNameProblem } from "@/lib/team";
import { eigeneBildPfade } from "@/lib/fassung";
import { raeumeVerwaisteBilder } from "@/lib/storage-aufraeumen";

/**
 * Server Actions rund um Teams (Team-Epic Stories 3, 4).
 *
 * Alles, was auth.users auflösen oder mehrere Tabellen atomar anfassen muss,
 * läuft über SECURITY-DEFINER-RPCs; hier bleiben Eingabeprüfung, Übersetzung
 * der RPC-Zustände in Klartext und die Cache-Invalidierung.
 */

export type TeamActionResult = { ok: boolean; error?: string };

function pruefeName(name: string): { ok: true; name: string } | { ok: false; error: string } {
  const problem = teamNameProblem(name);
  return problem ? { ok: false, error: problem } : { ok: true, name: name.trim() };
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

  revalidatePath("/teams");
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
  // Die Rohmeldung der Datenbank ist englisch und erklärt dem Trainer nichts;
  // sie gehört ins Log, nicht an den Bildschirmrand.
  if (error) {
    console.error("[team] umbenennen", error);
    return { ok: false, error: "Der Teamname liess sich nicht speichern. Bitte erneut versuchen." };
  }
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
        error: "Zu viele Versuche - bitte später erneut.",
      };
    default:
      return {
        status: "fehler",
        error: "Unter dieser Adresse ist niemand registriert.",
      };
  }
}

/** Nach der Vorschau-Bestätigung aufnehmen (Story 4 AK 6). Zweimal aufnehmen
 *  wirkt einmalig — die Mitgliedschaft ist ein Zustand, kein Vorgang.
 *
 *  Die Aufnahme löst dieselbe E-Mail-Frage auf wie die Vorschau und unterliegt
 *  darum derselben Bremse (NFR 2); sonst liesse sich die Vorschau schlicht
 *  überspringen. */
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
  if (res.status === "gebremst")
    return { ok: false, error: "Zu viele Versuche - bitte später erneut." };
  if (res.status !== "aufgenommen")
    return { ok: false, error: "Unter dieser Adresse ist niemand registriert." };

  revalidiereTeam(teamId);
  return { ok: true, anzeigeName: res.anzeige_name! };
}

// ── Story 13 / #480: Verlassen, Entfernen, Auflösen ──────────────────────────

/** Ergebnis eines Austritts, einer Entfernung oder einer Auflösung.
 *
 *  Ein Team verschwindet nur mit dem bestätigten aktuellen Teamnamen (#480) —
 *  die Datenbank prüft das, nicht die Oberfläche:
 *  - `aufloesung_noetig`: der Vorgang würde das letzte Mitglied entfernen und
 *    damit das Team auflösen; dafür braucht es den Namen (`name` = aktueller).
 *  - `name_falsch`: der bestätigte Name ist nicht (mehr) der aktuelle — etwa
 *    weil jemand das Team inzwischen umbenannt hat.
 *  - `team_weg`: ein anderes Mitglied hat das Team inzwischen aufgelöst. */
export type MitgliedschaftResult =
  | { status: "entfernt" }
  | { status: "aufgeloest" }
  | { status: "aufloesung_noetig"; name: string }
  | { status: "name_falsch"; name: string }
  | { status: "team_weg" }
  | { status: "fehler"; error: string };

type RpcAntwort = {
  status: "entfernt" | "aufgeloest" | "aufloesung_noetig" | "name_falsch" | "team_weg";
  name?: string;
  bilder?: { id: string; bild_url: string | null }[];
};

/** Die Antwort beider RPCs in Klartext übersetzen und nachlaufen lassen. */
async function auswerten(
  teamId: string,
  was: string,
  { data, error }: { data: unknown; error: { message: string } | null },
): Promise<MitgliedschaftResult> {
  if (error) {
    console.error(`[team] ${was}`, error);
    if (error.message.includes("not a member"))
      return { status: "fehler", error: "Du bist nicht mehr Mitglied dieses Teams." };
    return { status: "fehler", error: "Das hat nicht geklappt. Bitte erneut versuchen." };
  }

  const res = data as RpcAntwort;
  // Die Ansichten eines Teams, das es nicht mehr gibt, nicht neu rendern: Ihr
  // Rahmen leitete dann schon in der Antwort auf /teams um, und die Oberfläche
  // käme nicht mehr dazu, den Ausgang zu melden (PC 5).
  if (res.status === "team_weg" || res.status === "aufgeloest") revalidatePath("/teams");
  else revalidiereTeam(teamId);
  switch (res.status) {
    case "aufloesung_noetig":
    case "name_falsch":
      return { status: res.status, name: res.name! };
    case "team_weg":
    case "entfernt":
      return { status: res.status };
    case "aufgeloest":
      // Das Team ist weg — und mit der Mitgliedschaft auch das Recht, seine
      // Bilder zu löschen. Den Nachlauf erledigt darum der Service-Role-Client.
      await raeumeVerwaisteBilder(eigeneBildPfade(res.bilder ?? []));
      return { status: "aufgeloest" };
  }
}

/** Ein Mitglied entfernen — sich selbst („verlassen") oder eine andere Person.
 *  Beides derselbe Vorgang: im Team sind alle gleichberechtigt.
 *
 *  Ob der Vorgang das Team leert, entscheidet die RPC in derselben Transaktion
 *  wie die Löschung (#480 AK 12) — sonst könnte zwischen Prüfung und Ausführung
 *  jemand anders austreten und das Team unbestätigt verschwinden. Aus demselben
 *  Grund räumt hier NICHTS vor der RPC auf. Leert der Vorgang das Team, löst er
 *  nur mit dem aktuellen `teamname` auf. */
export async function entferneMitglied(
  teamId: string,
  userId: string,
  teamname?: string,
): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };

  return auswerten(
    teamId,
    "entfernen",
    await supabase.rpc("entferne_team_mitglied", {
      p_team: teamId,
      p_user: userId,
      // Wie die Oberfläche: Leerraum am Rand zählt nicht (AK 7).
      p_teamname: teamname?.trim(),
    }),
  );
}

/** Das Team selbst verlassen (Story 13 AK 1–3; als letztes Mitglied #480 AK 10). */
export async function verlasseTeam(
  teamId: string,
  teamname?: string,
): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };
  return entferneMitglied(teamId, user.id, teamname);
}

/** Das Team ausdrücklich auflösen (Story 13 AK 5, #480 AK 5–7). Alle Inhalte
 *  des Teams gehen dabei verloren; persönliche Trainings der Mitglieder — auch
 *  Kopien, die jemand zu sich übernommen hat — bleiben unberührt. */
export async function loeseTeamAuf(
  teamId: string,
  teamname: string,
): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };

  return auswerten(
    teamId,
    "auflösen",
    await supabase.rpc("loese_team_auf", { p_team: teamId, p_teamname: teamname.trim() }),
  );
}
