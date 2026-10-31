import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";
import { istUuid } from "@/lib/kennung";
import { LINK_FEHLER, abweisungText, istLinkToken, type AbmeldeGrund, type AbmeldeStand, type Spielstand } from "@/lib/spieler";
import { meldungAbweisungText, type Meldung, type Treffpunkt } from "@/lib/spiel";
import type { MeldeAntwort } from "@/lib/kern/spiele";
import { spielerAboUrl } from "@/lib/spieler-abo";
import type { ProbeStand } from "@/lib/probe";

/**
 * Die Seite hinter dem privaten Link einer Spieler:in (Epic #433, Story #436)
 * — ohne Konto und ohne Sitzung. Das Geheimnis im Link ist die Berechtigung;
 * die RPCs `spieler_link_*` und `spieler_abo_holen`/`_widerrufen` (#506)
 * prüfen es als SECURITY DEFINER und geben nur heraus, was die
 * Spielervertretung sehen darf: Teamname, ihre Spieler:in, die anstehenden
 * Termine mit der Zahl der Angemeldeten und derer, für die sie gelten (OoS 2,
 * #472), und die Abo-Adresse ihres Kalender-Abos.
 *
 * Ungültig, erneuert, entfernt oder unbekannt sind nicht zu unterscheiden
 * (AK 11). Das Geheimnis steht in keiner Meldung und keinem eigenen Log; als
 * Teil des Pfads erscheint es aber in den Zugriffsprotokollen der Plattform —
 * wie das Kalender-Abo.
 */

export type LinkTermin = {
  id: string;
  /** Nur an einem Spiel (#463): ihre Meldung (null = ohne), ob sie mit einer
   *  Verlegung verfallen ist, die Meldefrist und der Zeitpunkt vorher. */
  meldung: Meldung;
  meldung_verfallen: boolean;
  frist: string | null;
  frist_abgelaufen: boolean;
  vorher: { datum: string; beginn: string } | null;
  /** Der Hinweis für Eltern eines Trainings oder Spiels (#590 AK 9–11) — an
   *  einem ausgefallenen keiner (`null`), dort spricht der Grund. Die
   *  Bemerkung sieht die Spielervertretung nie (AK 13). */
  hinweis_eltern: string | null;
  /** Nur an einem Spiel (#465 AK 10): die Treffpunkte, frühester zuerst — an
   *  einem ausgefallenen keine (`null`), dort spricht der Grund (#530). */
  treffpunkte: Treffpunkt[] | null;
  /** Nur an einem Spiel (#464 AK 8, 9; PC 3): ob sie nicht aufgeboten ist,
   *  ob die Kennzeichnung mit einer Verlegung verfallen ist, und wie viele
   *  nicht aufgeboten sind (`null` an einem ausgefallenen und bei Trainings). */
  nicht_aufgeboten: boolean;
  aufgebot_verfallen: boolean;
  nicht_aufgeboten_zahl: number | null;
  /** Training oder Spiel (#459 AK 17): ein Spiel mit Bezeichnung und Richtwert. */
  art: "training" | "spiel";
  bezeichnung: string | null;
  richtwert_min: number | null;
  richtwert_max: number | null;
  datum: string;
  beginn: string;
  ende: string;
  ort: string | null;
  /** Der Kartenlink zum Ort (#533 AK 6, 7); `null` ohne und an einem
   *  ausgefallenen Termin. Fehlt bei einer Datenebene vor der Migration. */
  ort_link?: string | null;
  ausgefallen: boolean;
  /** Der Grund eines Ausfalls, vollständig (#530 AK 1, 2, 4); `null` ohne
   *  Grund und an einem Termin, der stattfindet. */
  ausfall_grund: string | null;
  /** Begonnen: sichtbar bis Ende des Tages, nicht mehr änderbar (AK 9). */
  begonnen: boolean;
  /** `null` an einem ausgefallenen Termin. */
  angemeldet: number | null;
  /** Für wie viele er gilt — gezählt wie für die Mitglieder (#472 AK 2);
   *  `null` an einem ausgefallenen Termin. */
  gesamt: number | null;
  abgemeldet: boolean;
  /** Verlegt, seit sie abgemeldet wurde (#437 AK 2): der Zeitpunkt vorher —
   *  die Abmeldung gilt nicht mehr. `anmeldung`: Es war die Anmeldung einer
   *  Probe-Spieler:in (#555 PC 5). */
  verfallen: { datum: string; beginn: string; anmeldung?: boolean } | null;
  /** Die Kader der Spieler:in, über die der Termin für sie gilt (#454 AK 2);
   *  leer bei einem Termin für alle. Fremde Kader nennt der Link nie (AK 3). */
  kader: string[];
  /** Wer den Termin vorbereitet und leitet (#523), mit Anzeigenamen; `null`
   *  ohne Verantwortliche:n oder an einem ausgefallenen Termin. */
  verantwortlich: string | null;
};

export type LinkAnsicht =
  | {
      gueltig: true;
      team: string;
      spieler: { vorname: string; nachname: string };
      /** Im Probe-Modus ihr Stand (#555 AK 11), sonst `null`; fehlt bei einer
       *  Datenebene vor der Migration. */
      probe?: ProbeStand | null;
      /** Das Info-Schreiben des Teams, nur im Probe-Modus (#556 AK 4). */
      probe_info?: string | null;
      termine: LinkTermin[];
    }
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

export type LinkMeldung = { terminId: string; angemeldet: boolean; gesehen: { datum: string; beginn: string } };

export type LinkMeldeErgebnis =
  | { ok: true; angemeldet: boolean; zahl: number | null }
  | { ok: false; ungueltig: true }
  | { ok: false; ungueltig?: false; error: string };

/** Für ein Spiel über den Link an- oder abmelden (#463 AK 3, 9, 17): bis zur
 *  Meldefrist, ohne Frist bis zum Anpfiff — dieselbe Regel wie für
 *  Mitglieder, dazu die Frist. */
export async function meldeSpielUeberLink(token: string, e: LinkMeldung): Promise<LinkMeldeErgebnis> {
  if (!istLinkToken(token)) return { ok: false, ungueltig: true };
  if (!istUuid(e.terminId) || !/^\d{4}-\d{2}-\d{2}$/.test(e.gesehen.datum) || !/^\d{2}:\d{2}$/.test(e.gesehen.beginn))
    return { ok: false, error: meldungAbweisungText("nicht_gefunden") };
  const { data, error } = await createAnonClient().rpc("spieler_link_melden", {
    p_token: token,
    p_termin: e.terminId,
    p_angemeldet: e.angemeldet,
    p_gesehen_datum: e.gesehen.datum,
    p_gesehen_beginn: e.gesehen.beginn,
  });
  if (error || !data) return { ok: false, error: LINK_FEHLER };
  const r = data as MeldeAntwort | { status: "ungueltig" };
  if (r.status === "ungueltig") return { ok: false, ungueltig: true };
  if (r.status === "abgewiesen") return { ok: false, error: meldungAbweisungText(r.grund, r.stand) };
  return { ok: true, angemeldet: r.angemeldet, zahl: r.stand?.angemeldet ?? null };
}

export type AboHolenErgebnis =
  | { ok: true; url: string }
  | { ok: false; ungueltig: true }
  | { ok: false; ungueltig?: false; error: string };

/** Die Abo-Adresse zum Link holen (#507 AK 1, 5): dieselbe, solange sie gilt. */
export async function holeAbo(token: string, origin: string): Promise<AboHolenErgebnis> {
  if (!istLinkToken(token)) return { ok: false, ungueltig: true };
  const { data, error } = await createAnonClient().rpc("spieler_abo_holen", { p_link: token });
  if (error) return { ok: false, error: LINK_FEHLER };
  if (!data) return { ok: false, ungueltig: true };
  return { ok: true, url: spielerAboUrl(origin, data as string) };
}

export type AboWiderrufErgebnis = { ok: true } | { ok: false; ungueltig: true } | { ok: false; ungueltig?: false; error: string };

/** Das Abo über den Link widerrufen (#509 AK 1, PC 1–3): Die bisherige
 *  Adresse liefert nichts mehr; Link und Meldungen bleiben. */
export async function widerrufeAbo(token: string): Promise<AboWiderrufErgebnis> {
  if (!istLinkToken(token)) return { ok: false, ungueltig: true };
  const { data, error } = await createAnonClient().rpc("spieler_abo_widerrufen", { p_link: token });
  if (error || !data) return { ok: false, error: LINK_FEHLER };
  return data === "ungueltig" ? { ok: false, ungueltig: true } : { ok: true };
}
