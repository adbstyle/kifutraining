import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";
import { istUuid } from "@/lib/kennung";
import { abweisungText, istLinkToken, type AbmeldeGrund, type AbmeldeStand, type Spielstand } from "@/lib/spieler";

/**
 * Die Seite hinter dem privaten Link einer Spieler:in (Epic #433, Story #436)
 * — ohne Konto und ohne Sitzung. Das Geheimnis im Link ist die Berechtigung;
 * die RPCs `spieler_link_*` prüfen es als SECURITY DEFINER und geben nur
 * heraus, was die Spielervertretung sehen darf: Teamname, ihre Spieler:in und
 * die anstehenden Termine mit der Zahl der Angemeldeten (OoS 2).
 *
 * Ungültig, erneuert, entfernt oder unbekannt sind nicht zu unterscheiden
 * (AK 11). Das Geheimnis steht in keinem Log und keiner Meldung.
 */

export type LinkTermin = {
  id: string;
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  ausgefallen: boolean;
  /** Begonnen: sichtbar bis Ende des Tages, nicht mehr änderbar (AK 9). */
  begonnen: boolean;
  /** `null` an einem ausgefallenen Termin. */
  angemeldet: number | null;
  abgemeldet: boolean;
};

export type LinkAnsicht =
  | { gueltig: true; team: string; spieler: { vorname: string; nachname: string }; termine: LinkTermin[] }
  | { gueltig: false };

const UNGUELTIG = { gueltig: false } as const;

/** Was der Link zeigt — oder einheitlich «ungültig». */
export async function ladeLinkAnsicht(token: string): Promise<LinkAnsicht> {
  if (!istLinkToken(token)) return UNGUELTIG;
  const { data, error } = await createAnonClient().rpc("spieler_link_ansicht", { p_token: token });
  // Ein Fehler der Datenebene ist kein Beweis, dass der Link nicht gilt — die
  // Seite sagt es trotzdem so, statt etwas über ihn preiszugeben.
  if (error || !data) return UNGUELTIG;
  return data as LinkAnsicht;
}

export type LinkAbmeldung = { terminId: string; abgemeldet: boolean; gesehen: { datum: string; beginn: string } };

export type LinkAbmeldeErgebnis =
  | { ok: true; abgemeldet: boolean; angemeldet: number }
  | { ok: false; ungueltig: true }
  | { ok: false; ungueltig?: false; error: string };

type Antwort =
  | { status: "ungueltig" }
  | { status: "ok"; abgemeldet: boolean; stand: Spielstand }
  | { status: "abgewiesen"; grund: AbmeldeGrund; stand?: AbmeldeStand };

export const LINK_FEHLER = "Das ging gerade nicht. Versuch es noch einmal.";

/** Über den Link ab- oder wieder anmelden (AK 8) — dieselbe Regel wie für
 *  Mitglieder, die Spieler:in ergibt sich aus dem Link. */
export async function meldeUeberLink(token: string, e: LinkAbmeldung): Promise<LinkAbmeldeErgebnis> {
  if (!istLinkToken(token)) return { ok: false, ungueltig: true };
  if (!istUuid(e.terminId) || !/^\d{4}-\d{2}-\d{2}$/.test(e.gesehen.datum) || !/^\d{2}:\d{2}$/.test(e.gesehen.beginn))
    return { ok: false, error: abweisungText("nicht_gefunden") };
  const { data, error } = await createAnonClient().rpc("spieler_link_abmelden", {
    p_token: token,
    p_termin: e.terminId,
    p_abgemeldet: e.abgemeldet,
    p_gesehen_datum: e.gesehen.datum,
    p_gesehen_beginn: e.gesehen.beginn,
  });
  if (error || !data) return { ok: false, error: LINK_FEHLER };
  const r = data as Antwort;
  if (r.status === "ungueltig") return { ok: false, ungueltig: true };
  if (r.status === "abgewiesen") return { ok: false, error: abweisungText(r.grund, r.stand) };
  return { ok: true, abgemeldet: r.abgemeldet, angemeldet: r.stand?.angemeldet ?? 0 };
}
