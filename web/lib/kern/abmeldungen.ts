import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  abweisungText,
  nachTeilnehmer,
  type AbmeldeGrund,
  type AbmeldeStand,
  type Spielstand,
  type Teilnehmer,
} from "@/lib/spieler";
import { jetztAmTrainingsort, terminBegonnen } from "@/lib/zeit";
import { ladeTermin, TERMIN_FELD } from "@/lib/kern/termine";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";
import { nachTerminKader, type TerminKader } from "@/lib/kader";

/**
 * Ab- und Anmelden für einen Termin (Epic #433, Story #435) — dieselben
 * Funktionen für den Reiter «Spieler:innen» am Termin und die KI-Werkzeuge
 * «termin_spieler_abrufen» und «termin_abmeldung_setzen».
 *
 * Die Regel steht einmal in der Datenebene (`abmeldung_anwenden`): bis zum
 * Beginn, nicht an einem ausgefallenen und nicht an einem inzwischen
 * verlegten Termin. Sie antwortet mit einem Status, den `abweisung` in den
 * Satz der Oberfläche übersetzt.
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
  spieler: Teilnehmer[];
  /** Führt das Team eine Spielerliste (bzw. führte es bei Beginn eine)? Dann
   *  kann ein Termin mit Kadern auch für niemanden gelten (#453 AK 7). */
  mitListe: boolean;
  /** Für welche Kader der Termin gilt (#453 AK 5); leer = für alle. */
  kader: TerminKader[];
  /** Wie viele Spieler:innen des Teams er nicht betrifft (AK 6); 0 an begonnenen. */
  uebrige: number;
};

/** Wer an einem Termin angemeldet und wer abgemeldet ist (AK 5, 7, 8). */
export async function terminSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
  jetzt: string = jetztAmTrainingsort(),
): Promise<KernErgebnis<TerminSpieler>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const [teilnehmer, termin, team] = await Promise.all([
    supabase.rpc("termin_teilnehmer", { p_termin: t.id }),
    supabase
      .from("training_termine")
      .select("spielstand, termin_kader ( kader_id, kader ( name ) )")
      .eq("id", t.id)
      .maybeSingle<{ spielstand: Spielstand; termin_kader: { kader_id: string | null; kader: { name: string } | null }[] }>(),
    supabase.from("spieler").select("id", { count: "exact", head: true }).eq("team_id", t.team_id),
  ]);
  const { data, error } = teilnehmer;
  if (error) return ausDbFehler(error);
  if (termin.error) return ausDbFehler(termin.error);
  const spieler = nachTeilnehmer(
    (
      (data ?? []) as {
        spieler_id: string | null;
        vorname: string | null;
        nachname: string | null;
        abgemeldet: boolean;
        ehemalig: boolean;
        kader: string[] | null;
      }[]
    ).map((r) => ({
      spielerId: r.spieler_id,
      vorname: r.vorname,
      nachname: r.nachname,
      abgemeldet: r.abgemeldet,
      ehemalig: r.ehemalig,
      kader: r.kader ?? [],
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
    spieler,
    mitListe: termin.data?.spielstand != null,
    kader: nachTerminKader((termin.data?.termin_kader ?? []).map((k) => ({ id: k.kader_id, name: k.kader?.name ?? null }))),
    uebrige: begonnen ? 0 : Math.max(0, (team.count ?? 0) - spieler.length),
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
  | { status: "ok"; abgemeldet: boolean; stand: Spielstand }
  | { status: "abgewiesen"; grund: AbmeldeGrund; stand?: AbmeldeStand };

/** Eine Spieler:in für einen Termin ab- oder wieder anmelden (AK 1, 2, 9). */
export async function setzeAbmeldung(
  supabase: SupabaseClient,
  _userId: string,
  e: AbmeldungSetzen,
): Promise<KernErgebnis<{ terminId: string; abgemeldet: boolean; stand: Spielstand }>> {
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
  return ok({ terminId: e.terminId, abgemeldet: r.abgemeldet, stand: r.stand });
}
