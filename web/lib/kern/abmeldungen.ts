import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  ABMELDUNG_TEXT,
  abweisungText,
  istAnwesend,
  nachTeilnehmer,
  spielerName,
  type AbmeldeGrund,
  type AbmeldeStand,
  type Spielstand,
  type Teilnehmer,
} from "@/lib/spieler";
import { jetztAmTrainingsort, terminBegonnen } from "@/lib/zeit";
import { ladeTerminMitStand, TERMIN_FELD, type TerminMitStand } from "@/lib/kern/termine";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";
import { nachTerminKader, type TerminKader } from "@/lib/kader";
import { SPIEL_TEXT } from "@/lib/spiel";
import { ueberAnzahl, ueberAnzahlText, type ProbeStand } from "@/lib/probe";

/**
 * Ab- und Anmelden für einen Termin (Epic #433, Story #435) — dieselben
 * Funktionen für den Reiter «Spieler:innen» am Termin und die KI-Werkzeuge
 * «termin_spieler_abrufen» und «termin_abmeldung_setzen».
 *
 * Die Regel steht einmal in der Datenebene (`abmeldung_anwenden`): bis zum
 * Beginn, nicht an einem ausgefallenen und nicht an einem inzwischen
 * verlegten Termin. Sie antwortet mit einem Status, den `abweisung` in den
 * Satz der Oberfläche übersetzt.
 *
 * Ab Beginn tragen Mitglieder und KI nach, wer nicht erschienen und wer doch
 * erschienen ist (#475, `termin_anwesenheit_setzen`) — mit derselben Antwort.
 */

export type TerminSpieler = {
  terminId: string;
  teamId: string;
  datum: string;
  beginn: string;
  ende: string;
  ausgefallen: boolean;
  /** Hat der Termin begonnen? Dann gilt der Stand bei Beginn, und niemand
   *  lässt sich mehr an- oder abmelden (AK 4, 7). */
  begonnen: boolean;
  angemeldet: number;
  gesamt: number;
  /** Ab Beginn die Anwesenden samt Nachträgen (#475 AK 9, 10); vorher und an
   *  einem ausgefallenen Termin `null` (AK 11). */
  anwesend: number | null;
  spieler: Teilnehmer[];
  /** Führt das Team eine Spielerliste (bzw. führte es bei Beginn eine)? Dann
   *  kann ein Termin mit Kadern auch für niemanden gelten (#453 AK 7). */
  mitListe: boolean;
  /** Für welche Kader der Termin gilt (#453 AK 5); leer = für alle. */
  kader: TerminKader[];
  /** Wie viele Spieler:innen des Teams er nicht betrifft (AK 6); 0 an begonnenen. */
  uebrige: number;
  /** Wann gelesen (ISO): der Bezug für «seit wann» je Spieler:in (#467) —
   *  vom Server, damit Server und Browser dasselbe rendern. */
  gelesenAm: string;
};

/** Wer an einem Termin angemeldet und wer abgemeldet ist (AK 5, 7, 8). */
export async function terminSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
  jetzt: string = jetztAmTrainingsort(),
): Promise<KernErgebnis<TerminSpieler>> {
  const geladen = await ladeTerminMitStand(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  // Ein Spiel kennt eigene Meldungen (#463), nicht die Abmeldung der Trainings.
  if (geladen.wert.art === "spiel") return fehlschlag("regel", SPIEL_TEXT.istSpiel, TERMIN_FELD);
  return terminSpielerVon(supabase, geladen.wert, jetzt);
}

/** Dasselbe für einen schon geladenen Termin (Verteiler in lib/kern/spiele.ts). */
export async function terminSpielerVon(
  supabase: SupabaseClient,
  t: TerminMitStand,
  jetzt: string = jetztAmTrainingsort(),
): Promise<KernErgebnis<TerminSpieler>> {
  const [teilnehmer, team] = await Promise.all([
    supabase.rpc("termin_teilnehmer", { p_termin: t.id }),
    supabase.from("spieler").select("id", { count: "exact", head: true }).eq("team_id", t.team_id),
  ]);
  const { data, error } = teilnehmer;
  if (error) return ausDbFehler(error);
  const spieler = nachTeilnehmer(
    (
      (data ?? []) as {
        spieler_id: string | null;
        vorname: string | null;
        nachname: string | null;
        abgemeldet: boolean;
        ehemalig: boolean;
        kader: string[] | null;
        gewechselt_am: string | null;
        nachgetragen: boolean;
        probe: boolean;
      }[]
    ).map((r) => ({
      spielerId: r.spieler_id,
      vorname: r.vorname,
      nachname: r.nachname,
      abgemeldet: r.abgemeldet,
      ehemalig: r.ehemalig,
      kader: r.kader ?? [],
      gewechseltAm: r.gewechselt_am,
      // Ein ausgefallener Termin zeigt keine Nachträge, auch der KI nicht (#475 AK 11).
      nachgetragen: r.nachgetragen && !t.ausgefallen,
      probe: r.probe ?? false,
    })),
  );
  const begonnen = terminBegonnen(t.datum, t.beginn, jetzt);
  return ok({
    terminId: t.id,
    teamId: t.team_id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ausgefallen: t.ausgefallen,
    begonnen,
    angemeldet: spieler.filter((s) => !s.abgemeldet).length,
    gesamt: spieler.length,
    anwesend: begonnen && !t.ausgefallen ? spieler.filter(istAnwesend).length : null,
    spieler,
    mitListe: t.spielstand != null,
    kader: nachTerminKader(t.termin_kader.map((k) => ({ id: k.kader_id, name: k.kader?.name ?? null }))),
    uebrige: begonnen ? 0 : Math.max(0, (team.count ?? 0) - spieler.length),
    gelesenAm: new Date().toISOString(),
  });
}

/** Ein abgewiesenes Ab- oder Anmelden als Kern-Fehler. Verlegt ist ein
 *  Konflikt — die Auswahl ist veraltet —, begonnen und ausgefallen sind
 *  Regeln. */
export function abweisung(grund: AbmeldeGrund, stand?: AbmeldeStand): KernFehler {
  const meldung = abweisungText(grund, stand);
  if (grund === "nicht_gefunden") return fehlschlag("nicht_gefunden", meldung, TERMIN_FELD);
  if (grund === "verlegt") return fehlschlag("konflikt", meldung);
  return fehlschlag("regel", meldung);
}

export type AbmeldungSetzen = {
  terminId: string;
  spielerId: string;
  abgemeldet: boolean;
  /** Datum und Beginn, wie der Aufrufer den Termin sah (#437 AK 5). */
  gesehen?: { datum: string; beginn: string };
};

type Antwort =
  | { status: "ok"; abgemeldet: boolean; stand: Spielstand; probe?: ProbeStand }
  | { status: "abgewiesen"; grund: AbmeldeGrund; stand?: AbmeldeStand };

/** Eine Spieler:in für einen Termin ab- oder wieder anmelden (AK 1, 2, 9).
 *  Bei einer Probe-Spieler:in dazu ihr Stand (#555); meldet ein Mitglied
 *  oder die KI sie über die Anzahl hinaus an, trägt `hinweis` den Satz dazu
 *  (Zusatzentscheid PO 2026-10-29) — an Oberfläche und KI wortgleich. */
export async function setzeAbmeldung(
  supabase: SupabaseClient,
  _userId: string,
  e: AbmeldungSetzen,
): Promise<
  KernErgebnis<{ terminId: string; abgemeldet: boolean; stand: Spielstand; probe: ProbeStand | null; hinweis: string | null }>
> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (!istUuid(e.spielerId)) return abweisung("nicht_gefunden");
  const { data, error } = await supabase.rpc("termin_abmeldung_setzen", {
    p_termin: e.terminId,
    p_spieler: e.spielerId,
    p_abgemeldet: e.abgemeldet,
    p_gesehen_datum: e.gesehen?.datum ?? null,
    p_gesehen_beginn: e.gesehen?.beginn ?? null,
  });
  if (error) return ausDbFehler(error);
  const r = data as Antwort;
  if (r.status !== "ok") return abweisung(r.grund, r.stand);
  const probe = r.probe ?? null;
  let hinweis: string | null = null;
  if (!e.abgemeldet && probe && ueberAnzahl(probe)) {
    const s = await supabase.from("spieler").select("vorname, nachname").eq("id", e.spielerId).maybeSingle();
    if (s.data) hinweis = ueberAnzahlText(spielerName(s.data), probe);
  }
  return ok({ terminId: e.terminId, abgemeldet: r.abgemeldet, stand: r.stand, probe, hinweis });
}

export type AnwesenheitSetzen = {
  terminId: string;
  spielerId: string;
  /** War sie da? Gegen den Stand bei Beginn ein Nachtrag, gleich ihm die
   *  Rücknahme (#475 AK 1–3). */
  da: boolean;
  /** Datum und Beginn, wie der Aufrufer den Termin sah (AK 7). */
  gesehen?: { datum: string; beginn: string };
};

type AnwesenheitAntwort =
  | { status: "ok"; da: boolean; nachgetragen: boolean; stand: Spielstand }
  | { status: "abgewiesen"; grund: AbmeldeGrund; stand?: AbmeldeStand };

/** Ab Beginn nachtragen, ob eine Spieler:in da war (#475 AK 1–7, 15). */
export async function setzeAnwesenheit(
  supabase: SupabaseClient,
  _userId: string,
  e: AnwesenheitSetzen,
): Promise<KernErgebnis<{ terminId: string; da: boolean; nachgetragen: boolean; stand: Spielstand }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (!istUuid(e.spielerId)) return abweisung("nicht_gefunden");
  const { data, error } = await supabase.rpc("termin_anwesenheit_setzen", {
    p_termin: e.terminId,
    p_spieler: e.spielerId,
    p_da: e.da,
    p_gesehen_datum: e.gesehen?.datum ?? null,
    p_gesehen_beginn: e.gesehen?.beginn ?? null,
  });
  if (error) return ausDbFehler(error);
  const r = data as AnwesenheitAntwort;
  // Ausgefallen: derselbe Grund wie beim Abmelden, der Satz sagt, was nicht geht.
  if (r.status !== "ok")
    return r.grund === "ausgefallen" ? fehlschlag("regel", ABMELDUNG_TEXT.ausgefallenNachtrag) : abweisung(r.grund, r.stand);
  return ok({ terminId: e.terminId, da: r.da, nachgetragen: r.nachgetragen, stand: r.stand });
}

/** Lehnt der Weg der Trainings ab, weil der Termin ein Spiel ist? Dann
 *  meldet der KI-Weg über `setzeMeldung` (lib/kern/spiele.ts) — ohne
 *  vorherige Abfrage der Art. */
export function istSpielAbweisung(f: KernFehler): boolean {
  return f.meldung === SPIEL_TEXT.istSpiel;
}
