import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { ladeSpieler } from "@/lib/kern/spieler";
import { ausDbFehler, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";
import {
  teilnahmeZahlen,
  zeitraumFehler,
  type TeilnahmeArt,
  type TeilnahmeZahlen,
  type TeilnahmeZeile,
  type Zeitraum,
} from "@/lib/teilnahme";

/**
 * Die Teilnahme-Statistik einer Spieler:in im Team (#700) — für die Spalte
 * neben der Spielerliste und das KI-Werkzeug «spieler_teilnahme_abrufen».
 * Beide rufen diese Funktion, damit sie für dieselbe Spieler:in und denselben
 * Zeitraum dieselben Zahlen liefern (NFR 3).
 *
 * Nur Mitglieder des Teams (NFR 2): `pruefeTeamMitglied` und die Zuordnung der
 * Spieler:in zum Team (`ladeSpieler`); gezählt wird in `spieler_teilnahme`
 * unter derselben RLS. Ohne Zeitraum zählt die ganze Zeit im Team, ein
 * einzelner Tag lässt die andere Seite offen (AK 2, 7).
 */
export type SpielerTeilnahme = {
  team: { id: string; name: string };
  spieler: { id: string; vorname: string; nachname: string };
  zeitraum: Zeitraum;
  zahlen: Record<TeilnahmeArt, TeilnahmeZahlen>;
};

export async function spielerTeilnahme(
  supabase: SupabaseClient,
  _userId: string,
  e: { teamId: string; spielerId: string; von?: string | null; bis?: string | null },
): Promise<KernErgebnis<SpielerTeilnahme>> {
  const zeitraum: Zeitraum = { von: e.von || null, bis: e.bis || null };
  const problem = zeitraumFehler(zeitraum);
  if (problem) return fehlschlag("eingabe", problem.text, { feld: problem.feld });

  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const spieler = await ladeSpieler(supabase, e.teamId, e.spielerId);
  if (!spieler.ok) return spieler;

  const { data, error } = await supabase.rpc("spieler_teilnahme", {
    p_team: e.teamId,
    p_spieler: e.spielerId,
    p_von: zeitraum.von,
    p_bis: zeitraum.bis,
  });
  if (error) return ausDbFehler(error);
  return ok({
    team: team.wert,
    spieler: { id: spieler.wert.id, vorname: spieler.wert.vorname, nachname: spieler.wert.nachname },
    zeitraum,
    zahlen: teilnahmeZahlen((data ?? []) as TeilnahmeZeile[]),
  });
}
