"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { revalidiereMitgliedschaften, revalidiereTeam } from "@/lib/revalidate";
import { fachlicheMeldung } from "@/lib/training-bedingungen";
import { PERSON_MELDUNG, type PersonSchritt } from "@/lib/verein";

/**
 * Server Actions am Team-Ort: Trainer:innen aufnehmen, entfernen, das Team
 * verlassen (Team-Epic Stories 4, 13; Vereine #581).
 *
 * Alles, was auth.users auflösen oder mehrere Tabellen atomar anfassen muss,
 * läuft über SECURITY-DEFINER-RPCs; hier bleiben Eingabeprüfung, Übersetzung
 * der RPC-Zustände in Klartext und die Cache-Invalidierung.
 *
 * Umbenennen, Auflösen und Anlegen von Teams gehören der Vereinsverwaltung und
 * liegen im Verein (`lib/actions/verein.ts`): Am Team-Ort gibt es nichts, was
 * ein Team verschwinden lässt oder umbenennt.
 */

const FEHLER = "Das hat nicht geklappt. Bitte erneut versuchen.";

/** Wer nicht (mehr) Mitglied des Teams ist — auch, weil die Vereinsverwaltung
 *  einen entfernt oder das Team aufgelöst hat —, bekommt von den Team-RPCs
 *  `not a member of this team`. */
const NICHT_MEHR_MITGLIED = "Du bist nicht mehr Mitglied dieses Teams.";

/** Der Satz zu einem Fehler der Team-RPCs: «nicht mehr Mitglied», ein Marker
 *  der Datenebene (z. B. `ANDERER_VEREIN` als Netz) oder die allgemeine
 *  Meldung. Der Rohtext steht nur im Log. */
function rpcFehlerMeldung(e: { message: string }): string {
  if (e.message.includes("not a member")) return NICHT_MEHR_MITGLIED;
  return fachlicheMeldung(e.message) ?? FEHLER;
}

/** Der Satz zu einem Status der Suche oder Aufnahme; ein unbekannter Status
 *  (eine neuere Datenebene) steht im Log und fällt auf die allgemeine Meldung. */
function personMeldung(status: string): string {
  if (status in PERSON_MELDUNG) return PERSON_MELDUNG[status as keyof typeof PERSON_MELDUNG];
  console.error("[team] unbekannter Status der Personensuche", status);
  return FEHLER;
}

/** Vor der Aufnahme nachsehen, wer sich hinter der Adresse verbirgt (Story 4
 *  AK 2). Bewusste, dokumentierte Ausnahme von der Anti-Enumeration-Linie: die
 *  Vorschau verhindert, dass jemand versehentlich eine fremde Person ins Team
 *  holt. Die RPC bremst erfolglose Versuche aus (`nicht_gefunden` und
 *  `anderer_verein` zählen, #581). */
export async function sucheTrainer(teamId: string, email: string): Promise<PersonSchritt> {
  const supabase = await createClient();
  const adresse = email.trim();
  if (!adresse) return { ok: false, meldung: "Bitte eine E-Mail-Adresse angeben." };

  const { data, error } = await supabase.rpc("finde_trainer", {
    p_team_id: teamId,
    p_email: adresse,
  });
  if (error) {
    console.error("[team] trainer suchen", error);
    return { ok: false, meldung: rpcFehlerMeldung(error) };
  }

  const res = data as { status: string; anzeige_name?: string };
  if (res.status === "gefunden") return { ok: true, anzeigeName: res.anzeige_name! };
  return { ok: false, meldung: personMeldung(res.status) };
}

/** Nach der Vorschau-Bestätigung aufnehmen (Story 4 AK 6). Zweimal aufnehmen
 *  wirkt einmalig — die Mitgliedschaft ist ein Zustand, kein Vorgang.
 *
 *  Die Aufnahme löst dieselbe E-Mail-Frage auf wie die Vorschau und unterliegt
 *  darum derselben Bremse (NFR 2); sonst liesse sich die Vorschau schlicht
 *  überspringen. */
export async function nimmMitgliedAuf(teamId: string, email: string): Promise<PersonSchritt> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_team_member", {
    p_team_id: teamId,
    p_email: email.trim(),
  });
  if (error) {
    console.error("[team] trainer aufnehmen", error);
    return { ok: false, meldung: rpcFehlerMeldung(error) };
  }

  const res = data as { status: string; anzeige_name?: string };
  if (res.status !== "aufgenommen") return { ok: false, meldung: personMeldung(res.status) };

  revalidiereTeam(teamId);
  return { ok: true, anzeigeName: res.anzeige_name! };
}

// ── Story 13: Verlassen und Entfernen ────────────────────────────────────────

/** Ergebnis einer Entfernung, die auf der Seite bleibt: Die Person ist nicht
 *  mehr im Team — auch, wenn sie es schon nicht mehr war. Alles andere leitet
 *  die Action selbst um (siehe `entferneMitglied`). */
type MitgliedschaftResult = { status: "entfernt" } | { status: "fehler"; error: string };

/** Ein Mitglied entfernen — sich selbst („verlassen") oder eine andere Person.
 *  Beides derselbe Vorgang. Geht die letzte Person, bleibt das Team bestehen:
 *  Auflösen kann es nur die Vereinsverwaltung (#581).
 *
 *  Macht der Vorgang die offene Team-Seite ungültig, leitet die Action selbst
 *  um: nach dem eigenen Austritt nach `/teams`, und hat die Verwaltung das
 *  Team inzwischen aufgelöst (`team_weg`), nach `/teams?weg=1`, das es meldet
 *  (#480 PC 5). Eine Weiterleitung im Client liefe gegen die Antwort der
 *  Action: `revalidiereMitgliedschaften` rendert die offene Seite neu, und
 *  deren Rahmen leitete ohne den Hinweis nach `/teams` um. Mit `redirect`
 *  rendert die Antwort nur das Ziel. */
export async function entferneMitglied(teamId: string, userId: string): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };

  const { data, error } = await supabase.rpc("entferne_team_mitglied", {
    p_team: teamId,
    p_user: userId,
  });
  if (error) {
    console.error("[team] entfernen", error);
    return { status: "fehler", error: rpcFehlerMeldung(error) };
  }

  const res = data as { status: "entfernt" | "team_weg" };
  // Mitgliedschaften wechseln: Der Wechsler der Seitenleiste liest sie im
  // Wurzel-Layout.
  revalidiereMitgliedschaften();
  if (res.status === "team_weg") redirect("/teams?weg=1");
  revalidiereTeam(teamId);
  if (userId === user.id) redirect("/teams");
  return { status: "entfernt" };
}

/** Das Team selbst verlassen (Story 13 AK 1–3). Gelingt es, leitet die
 *  Action um; zurück kommt nur ein Fehler. */
export async function verlasseTeam(teamId: string): Promise<MitgliedschaftResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", error: "Nicht angemeldet." };
  return entferneMitglied(teamId, user.id);
}
