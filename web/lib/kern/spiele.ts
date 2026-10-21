import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { nachSpielerName } from "@/lib/spieler";
import {
  fristAbgelaufen,
  meldefristZeitpunkt,
  meldungAbweisungText,
  type MeldeGrund,
  type MeldeStand,
  type Meldung,
} from "@/lib/spiel";
import { jetztAmTrainingsort, terminBegonnen } from "@/lib/zeit";
import { ladeTermin, TERMIN_FELD } from "@/lib/kern/termine";
import { NICHT_GEFUNDEN, ausDbFehler, fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";
import { nachTerminKader, type TerminKader } from "@/lib/kader";

/**
 * Für Spiele ausdrücklich melden (Epic #448, Story #463) — dieselben
 * Funktionen für den Reiter «Spieler:innen» eines Spiels und die
 * KI-Werkzeuge «termin_spieler_abrufen» und «termin_abmeldung_setzen».
 *
 * Die Regel steht einmal in der Datenebene (`spiel_meldung_anwenden`): bis
 * zum Anpfiff, nicht an einem ausgefallenen oder inzwischen verlegten Spiel,
 * nur für wen es gilt; über den Link nur bis zur Meldefrist. Sie antwortet
 * mit einem Grund, den `meldungAbweisungText` in den Satz übersetzt.
 */

/** Eine Spieler:in an einem Spiel. `null`-Name: eine ehemalige an einem
 *  begonnenen Spiel. */
export type SpielTeilnehmer = {
  spielerId: string | null;
  vorname: string | null;
  nachname: string | null;
  meldung: Meldung;
  /** Ihre Meldung ist mit einer Verlegung verfallen (AK 15). */
  verfallen: boolean;
  ehemalig: boolean;
  kader: string[];
  /** Der letzte Wechsel ihrer Meldung (ISO); `null` ohne Meldung (AK 25). */
  gewechseltAm: string | null;
};

export type SpielSpieler = {
  terminId: string;
  teamId: string;
  datum: string;
  beginn: string;
  ende: string;
  ausgefallen: boolean;
  /** Ab Anpfiff gilt der Stand beim Anpfiff (AK 20). */
  begonnen: boolean;
  angemeldet: number;
  abgemeldet: number;
  ohneMeldung: number;
  gesamt: number;
  /** Mindest- und Höchstzahl (#459). */
  richtwertMin: number | null;
  richtwertMax: number | null;
  /** Die Meldefrist der Spielervertretung (`YYYY-MM-DDTHH:MM`) und ob sie
   *  abgelaufen ist; ohne Frist melden Eltern bis zum Anpfiff (AK 8, 9). */
  frist: string | null;
  fristAbgelaufen: boolean;
  /** Leer an einem ausgefallenen Spiel (AK 19). */
  spieler: SpielTeilnehmer[];
  mitListe: boolean;
  kader: TerminKader[];
  /** Wie viele Spieler:innen des Teams es nicht betrifft; 0 an begonnenen. */
  uebrige: number;
  gelesenAm: string;
};

type Zeile = {
  spieler_id: string | null;
  vorname: string | null;
  nachname: string | null;
  zustand: Meldung;
  verfallen: boolean;
  ehemalig: boolean;
  kader: string[] | null;
  gewechselt_am: string | null;
};

/** Nach Name, ehemalige zuletzt. */
function nachName(liste: SpielTeilnehmer[]): SpielTeilnehmer[] {
  const benannt = liste.filter((t) => t.vorname !== null) as (SpielTeilnehmer & { vorname: string; nachname: string })[];
  return [...nachSpielerName(benannt), ...liste.filter((t) => t.vorname === null)];
}

/** Wer an einem Spiel welche Meldung trägt (AK 5, 6, 20, 25). */
export async function spielSpieler(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string },
  jetzt: string = jetztAmTrainingsort(),
): Promise<KernErgebnis<SpielSpieler>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (t.art !== "spiel") return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  const [teilnehmer, termin, team] = await Promise.all([
    supabase.rpc("spiel_teilnehmer", { p_termin: t.id }),
    supabase
      .from("training_termine")
      .select("spielstand, meldefrist_vorlauf_min, termin_kader ( kader_id, kader ( name ) )")
      .eq("id", t.id)
      .maybeSingle<{
        spielstand: { gesamt: number } | null;
        meldefrist_vorlauf_min: number | null;
        termin_kader: { kader_id: string | null; kader: { name: string } | null }[];
      }>(),
    supabase.from("spieler").select("id", { count: "exact", head: true }).eq("team_id", t.team_id),
  ]);
  if (teilnehmer.error) return ausDbFehler(teilnehmer.error);
  if (termin.error) return ausDbFehler(termin.error);
  const begonnen = terminBegonnen(t.datum, t.beginn, jetzt);
  // AK 19: Ein ausgefallenes Spiel zeigt weder Meldungen noch Zahl.
  const spieler = t.ausgefallen
    ? []
    : nachName(
        ((teilnehmer.data ?? []) as Zeile[]).map((r) => ({
          spielerId: r.spieler_id,
          vorname: r.vorname,
          nachname: r.nachname,
          meldung: r.zustand,
          // Nach dem Anpfiff zählt der Stand beim Anpfiff, kein Verfall-Hinweis.
          verfallen: r.verfallen && !begonnen,
          ehemalig: r.ehemalig,
          kader: r.kader ?? [],
          gewechseltAm: r.gewechselt_am,
        })),
      );
  const vorlauf = termin.data?.meldefrist_vorlauf_min ?? null;
  const frist = vorlauf === null ? null : meldefristZeitpunkt(t.datum, t.beginn, vorlauf);
  const zaehle = (m: Meldung) => spieler.filter((s) => s.meldung === m).length;
  return ok({
    terminId: t.id,
    teamId: t.team_id,
    datum: t.datum,
    beginn: t.beginn,
    ende: t.ende,
    ausgefallen: t.ausgefallen,
    begonnen,
    angemeldet: zaehle("angemeldet"),
    abgemeldet: zaehle("abgemeldet"),
    ohneMeldung: zaehle(null),
    gesamt: spieler.length,
    richtwertMin: t.richtwert_min,
    richtwertMax: t.richtwert_max,
    frist,
    fristAbgelaufen: fristAbgelaufen(frist, jetzt),
    spieler,
    mitListe: termin.data?.spielstand != null,
    kader: nachTerminKader((termin.data?.termin_kader ?? []).map((k) => ({ id: k.kader_id, name: k.kader?.name ?? null }))),
    uebrige: begonnen ? 0 : Math.max(0, (team.count ?? 0) - ((teilnehmer.data ?? []) as Zeile[]).length),
    gelesenAm: new Date().toISOString(),
  });
}

/** Ist der Termin ein Spiel? `null`, wenn es ihn nicht gibt (oder er
 *  unsichtbar ist) — dann antwortet der Weg der Trainings mit «nicht gefunden». */
export async function istSpiel(supabase: SupabaseClient, terminId: string): Promise<boolean | null> {
  if (!istUuid(terminId)) return null;
  const { data } = await supabase.from("training_termine").select("art").eq("id", terminId).maybeSingle<{ art: string }>();
  return data ? data.art === "spiel" : null;
}

/** Eine abgewiesene Meldung als Kern-Fehler. Verlegt ist ein Konflikt — die
 *  Auswahl ist veraltet —, alles andere eine Regel. */
export function meldungAbweisung(grund: MeldeGrund, stand?: MeldeStand): KernFehler {
  const meldung = meldungAbweisungText(grund, stand);
  if (grund === "nicht_gefunden") return fehlschlag("nicht_gefunden", meldung, TERMIN_FELD);
  if (grund === "verlegt") return fehlschlag("konflikt", meldung);
  return fehlschlag("regel", meldung);
}

export type MeldungSetzen = {
  terminId: string;
  spielerId: string;
  angemeldet: boolean;
  /** Datum und Beginn, wie der Aufrufer das Spiel sah (AK 17). */
  gesehen?: { datum: string; beginn: string };
};

export type MeldeAntwort =
  | { status: "ok"; angemeldet: boolean; stand: { angemeldet: number; gesamt: number } | null }
  | { status: "abgewiesen"; grund: MeldeGrund; stand?: MeldeStand }
  | { status: "ungueltig" };

/** Eine Spieler:in für ein Spiel an- oder abmelden — als Mitglied, bis zum
 *  Anpfiff, auch nach der Meldefrist (AK 2, 4, 10). */
export async function setzeMeldung(
  supabase: SupabaseClient,
  _userId: string,
  e: MeldungSetzen,
): Promise<KernErgebnis<{ terminId: string; angemeldet: boolean; stand: { angemeldet: number; gesamt: number } | null }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (!istUuid(e.spielerId)) return meldungAbweisung("nicht_gefunden");
  const { data, error } = await supabase.rpc("termin_meldung_setzen", {
    p_termin: e.terminId,
    p_spieler: e.spielerId,
    p_angemeldet: e.angemeldet,
    p_gesehen_datum: e.gesehen?.datum ?? null,
    p_gesehen_beginn: e.gesehen?.beginn ?? null,
  });
  if (error) return ausDbFehler(error);
  const r = data as MeldeAntwort;
  if (r.status === "abgewiesen") return meldungAbweisung(r.grund, r.stand);
  if (r.status !== "ok") return meldungAbweisung("nicht_gefunden");
  return ok({ terminId: e.terminId, angemeldet: r.angemeldet, stand: r.stand });
}
