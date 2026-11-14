import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { nachSpielerName, SPIELER_MELDUNG } from "@/lib/spieler";
import { zuordnenAbweisungText, type ZuordnenAbweisung } from "@/lib/verein";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";
import { spielerFehler } from "@/lib/kern/spieler";

/** Ein Fehler der `verein_*`-RPCs: «Verein nicht gefunden» ordnet nur dieser
 *  Bereich ein, alles übrige `spielerFehler`. */
function vereinFehler(e: { message: string; code?: string }) {
  return e.message.includes("VEREIN_NICHT_GEFUNDEN")
    ? fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" })
    : spielerFehler(e);
}

/**
 * Der Spielerbestand des Vereins am Verein-Ort (Epic Vereine #575, Story
 * #579): die Grundfassung der Liste und das Zuordnen zu einem Team — nur für
 * die Vereinsverwaltung, nur in der Anwendung. Es gibt dafür kein KI-Werkzeug
 * (Architekturplan §4.1, §5.5); der Kern steht hier, damit Seite und Action
 * dieselbe Regelquelle nutzen.
 *
 * Geschrieben und gelesen wird nur über die RPCs `verein_*`: Sie prüfen die
 * Rolle als erste Anweisung und rufen `nur_in_der_anwendung()` auf.
 */

export type VereinSpieler = {
  id: string;
  vorname: string;
  nachname: string;
  jahrgang: number;
  /** Die Teams der Spieler:in, nach Namen; leer, wenn sie keinem zugeordnet ist. */
  teams: { id: string; name: string }[];
};

/** Ein Team des Vereins; `anzahl`: Zuordnungen, gezählt wie die Grenze 100. */
export type VereinTeam = { id: string; name: string; anzahl: number };

const nachName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de");

/** Alle Spieler:innen und Teams des Vereins, nach Vorname und Nachname bzw.
 *  Teamname geordnet (#579 AK 1) — die Grundfassung, die Story #580 ersetzt. */
export async function ladeVereinSpielerliste(
  supabase: SupabaseClient,
  _userId: string,
  e: { vereinId: string },
): Promise<KernErgebnis<{ spieler: VereinSpieler[]; teams: VereinTeam[] }>> {
  if (!istUuid(e.vereinId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.verein, { feld: "verein_id" });
  const { data, error } = await supabase.rpc("verein_spielerliste", { p_verein: e.vereinId });
  if (error) return vereinFehler(error);
  const r = data as { spieler: VereinSpieler[]; teams: VereinTeam[] };
  return ok({
    spieler: nachSpielerName(r.spieler).map((s) => ({ ...s, teams: [...s.teams].sort(nachName) })),
    teams: [...r.teams].sort(nachName),
  });
}

/**
 * Eine oder mehrere Spieler:innen einem Team des Vereins zuordnen (#579 AK
 * 2–8, 20–23): alles oder nichts. Lässt sich eine nicht zuordnen, ändert die
 * Datenebene nichts und nennt die Befunde, die hier in einen Satz gehen
 * (`zuordnenAbweisungText`); `teamName` ist der Name, den die Verwaltung
 * gewählt hat — er steht nur im Satz. `ersetzt`: Zahl der anstehenden
 * Termine, deren erwartete Spielerzahl wegfiel (nur beim ersten Zuordnen in
 * ein Team ohne Spieler:innen, AK 23).
 */
export async function ordneSpielerZu(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; teamName: string; spielerIds: string[] },
): Promise<KernErgebnis<{ anzahl: number; ersetzt: number }>> {
  if (!istUuid(e.teamId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.team, { feld: "team_id" });
  const ids = [...new Set(e.spielerIds)];
  if (ids.length === 0 || !ids.every(istUuid))
    return fehlschlag("nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, { feld: "spieler_ids" });
  const { data, error } = await supabase.rpc("verein_spieler_zuordnen", { p_team: e.teamId, p_spieler: ids });
  if (error) return vereinFehler(error);
  const r = data as { status: "zugeordnet"; anzahl: number; ersetzt: number } | ({ status: "abgewiesen" } & ZuordnenAbweisung);
  if (r.status === "abgewiesen") return fehlschlag("regel", zuordnenAbweisungText(r, e.teamName, ids.length), { feld: "spieler_ids" });
  return ok({ anzahl: r.anzahl, ersetzt: r.ersetzt });
}
