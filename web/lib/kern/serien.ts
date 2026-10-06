import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import {
  SERIE_MELDUNG,
  serieProblem,
  vergangeneBestaetigen,
  type Reichweite,
  type Wochentag,
} from "@/lib/serie";
import { TERMIN_TEXT, istKalendertag, leerZuNull, textProblem, zeitProblem } from "@/lib/termin";
import type { FeldEingabe } from "@/lib/termin-felder";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import {
  TERMIN_FELD,
  aendereTermin,
  pruefeFelder,
  spielerzahlFehler,
  entferneTermin,
  bereinigeVerantwortliche,
  kalenderFehler,
  ladeTermin,
  type TerminAendern,
} from "@/lib/kern/termine";
import { NICHT_GEFUNDEN, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Terminserien (#324, #326): festlegen, mit Reichweite ändern und entfernen,
 * abweichende Angaben wieder der Serie folgen lassen.
 *
 * Die Rechnung steht in der Datenebene (terminserie_rechnen); hier stehen
 * die Vorprüfung mit den Feldnamen des KI-Werkzeugs, die Vorschau und die
 * Bestätigung des KI-Wegs (PO 16). Was die Datenebene sonst mit einem rohen
 * Postgres-Fehler abwiese (ungültiges Datum, Uhrzeit, zu langer Text), prüft
 * dieser Kern vorab — die Datenebene bleibt der Rückhalt.
 *
 * Felder und erwartete Spielerzahl (#391) gibt die Serie vor wie den Ort:
 * zwei Angaben, je mit eigener Abweichung am Termin. Ihre Regeln sind die
 * des einzelnen Termins (`pruefeFelder`, `spielerzahlFehler`), mit
 * denselben Sätzen.
 */

export type SerieFestlegen = {
  teamId: string;
  wochentage: Wochentag[];
  von: string;
  bis: string;
  beginn: string;
  ende: string;
  ort?: string | null;
  bemerkung?: string | null;
  /** Kennungen der Mitglieder, die jeder Termin der Serie trägt (#325 AK 3). */
  verantwortliche?: string[];
  /** Felder und erwartete Spielerzahl jedes Termins (#391 AK 1); ohne: unbekannt. */
  felder?: readonly FeldEingabe[] | null;
  spielerzahl?: number | null;
};

/** Eine Terminserie festlegen (#324): je gewähltem Wochentag im Zeitraum ein
 *  echter Termin ohne Training; bestehende Termine bleiben unberührt. */
export async function legeSerieFest(
  supabase: SupabaseClient,
  _userId: string,
  e: SerieFestlegen,
): Promise<KernErgebnis<{ serieId: string; teamId: string; termine: number }>> {
  const p = serieProblem(e);
  if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
  const verantwortliche = bereinigeVerantwortliche(e.verantwortliche ?? []);
  if (!verantwortliche.ok) return verantwortliche.fehler;
  const felder = pruefeFelder(e.felder);
  if (!felder.ok) return felder;
  const zahl = spielerzahlFehler(e.spielerzahl);
  if (zahl) return zahl;
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  const { data, error } = await supabase.rpc("terminserie_festlegen", {
    p_team: e.teamId,
    p_wochentage: e.wochentage,
    p_von: e.von,
    p_bis: e.bis,
    p_beginn: e.beginn,
    p_ende: e.ende,
    p_ort: leerZuNull(e.ort),
    p_bemerkung: leerZuNull(e.bemerkung),
    p_verantwortliche: verantwortliche.ids,
    p_felder: felder.felder,
    p_spielerzahl: e.spielerzahl ?? null,
  });
  if (error) return kalenderFehler(error);
  const r = data as { serie: string; termine: number };
  return ok({ serieId: r.serie, teamId: e.teamId, termine: r.termine });
}

export type SerienAenderung = {
  wochentage?: Wochentag[];
  von?: string;
  bis?: string;
  /** Beginn und Ende nur gemeinsam — eine Angabe «Zeit» (PC 2). */
  beginn?: string | null;
  ende?: string | null;
  /** `null` oder `""` = leeren. */
  ort?: string | null;
  bemerkung?: string | null;
  /** Kennungen der künftigen Verantwortlichen der Serie (#325); `[]` = niemand. */
  verantwortliche?: string[];
  /** Die Felder als ganze Liste (#391 AK 7); `null` oder `[]` = keine. */
  felder?: readonly FeldEingabe[] | null;
  /** Die erwartete Spielerzahl; `null` = unbekannt. */
  spielerzahl?: number | null;
};

export type EntfallenderTermin = {
  terminId: string;
  datum: string;
  beginn: string | null;
  training: { id: string; name: string };
};

export type SerienFolge = {
  /** Die Serie, in der geändert wurde (bei «folgende» die neue Teilserie);
   *  `null`, wenn keine übrig blieb. */
  serieId: string | null;
  /** Die Version, gegen die gerechnet wurde — die Oberfläche sendet sie beim
   *  Ausführen mit (PO 17). */
  versionVorher: number;
  /** Nur die entfallenden Termine MIT Training (AK 8, PC 17). */
  entfallend: EntfallenderTermin[];
  entfallendAnzahl: number;
  /** Vergangene Termine, die die Änderung erfasst oder entfallen lässt. */
  vergangene: number;
  teamId: string;
};

type Roh = {
  serie: string | null;
  version_vorher: number;
  entfallend: { id: string; datum: string; beginn: string | null; training: { id: string; name: string } }[];
  entfallend_anzahl: number;
  vergangene: number;
};

function folge(r: Roh, teamId: string): SerienFolge {
  return {
    serieId: r.serie,
    versionVorher: r.version_vorher,
    entfallend: r.entfallend.map((x) => ({ terminId: x.id, datum: x.datum, beginn: x.beginn, training: x.training })),
    entfallendAnzahl: r.entfallend_anzahl,
    vergangene: r.vergangene,
    teamId,
  };
}

type Lauf = {
  vorschau?: boolean;
  /** Was die Oberfläche in der Vorschau sah; ohne (KI) rechnet der Kern die
   *  Vorschau selbst und verlangt `bestaetigt` für Vergangenes. */
  erwartet?: { version: number; entfallend: string[] };
  bestaetigt?: boolean;
};

type RpcAntwort = { data: unknown; error: { message: string; code?: string } | null };

/** Vorschau, KI-Bestätigung und Ausführung — für Ändern und Entfernen
 *  derselbe Ablauf. `rpc(ausfuehren, erwartet)` ruft die Hülle der Datenebene. */
async function laufe(
  teamId: string,
  lauf: Lauf,
  rpc: (ausfuehren: boolean, erwartet: { version: number; entfallend: string[] } | null) => PromiseLike<RpcAntwort>,
): Promise<KernErgebnis<SerienFolge>> {
  // Ohne `erwartet` spricht der KI-Weg: Vorschau und Ausführung laufen hier
  // hintereinander, ein Wettlauf dazwischen lässt sich wiederholen.
  const kiWeg = !lauf.erwartet && !lauf.vorschau;
  let erwartet = lauf.erwartet;
  if (lauf.vorschau || !erwartet) {
    const v = await rpc(false, erwartet ?? null);
    if (v.error) return kalenderFehler(v.error);
    const vorschau = folge(v.data as Roh, teamId);
    if (lauf.vorschau) return ok(vorschau);
    if (vorschau.vergangene > 0 && !lauf.bestaetigt)
      return fehlschlag("regel", vergangeneBestaetigen(vorschau.vergangene), { feld: "bestaetigt" });
    erwartet = { version: vorschau.versionVorher, entfallend: vorschau.entfallend.map((x) => x.terminId) };
  }
  const r = await rpc(true, erwartet);
  if (r.error) return kalenderFehler(r.error, kiWeg);
  return ok(folge(r.data as Roh, teamId));
}

/** Eine Serie ab dem gewählten Termin («dieser und folgende») oder als Ganzes
 *  ändern (#326 AK 1, 3–5, 8, 9, 11; PC 2–10, 13–17, 19). */
export async function aendereSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; reichweite: "dieser_und_folgende" | "alle"; aenderung: SerienAenderung } & Lauf,
): Promise<KernErgebnis<SerienFolge>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (!t.serie_id) return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, TERMIN_FELD);

  const a = e.aenderung;
  const hatZeit = a.beginn !== undefined || a.ende !== undefined;
  const hatRegel = a.wochentage !== undefined || a.von !== undefined || a.bis !== undefined;
  if (
    !hatZeit &&
    !hatRegel &&
    a.ort === undefined &&
    a.bemerkung === undefined &&
    a.verantwortliche === undefined &&
    a.felder === undefined &&
    a.spielerzahl === undefined
  )
    return fehlschlag("eingabe", SERIE_MELDUNG.KEINE_AENDERUNG);
  if (a.von !== undefined && !istKalendertag(a.von)) return fehlschlag("eingabe", TERMIN_TEXT.datum, { feld: "von" });
  if (a.bis !== undefined && !istKalendertag(a.bis)) return fehlschlag("eingabe", TERMIN_TEXT.datum, { feld: "bis" });
  if (hatZeit) {
    const z = zeitProblem(a.beginn, a.ende);
    if (z) return fehlschlag("eingabe", z.text, { feld: z.feld });
  }
  const tp = textProblem(a);
  if (tp) return fehlschlag("eingabe", tp.text, { feld: tp.feld });
  const verantwortliche = a.verantwortliche === undefined ? null : bereinigeVerantwortliche(a.verantwortliche);
  if (verantwortliche && !verantwortliche.ok) return verantwortliche.fehler;
  const felder = a.felder === undefined ? null : pruefeFelder(a.felder);
  if (felder && !felder.ok) return felder;
  const zahl = spielerzahlFehler(a.spielerzahl);
  if (zahl) return zahl;

  // Die Regel vorab prüfen, mit den Feldnamen des Werkzeugs (AK 5, PC 19) —
  // nur wenn sie sich ändert: Eine reine Werteänderung an einem verlegten
  // Termin hinter dem Serienende hat keinen Regeltag und ist trotzdem gültig.
  if (hatRegel) {
    const { data: s } = await supabase
      .from("termin_serien")
      .select("wochentage, beginn_datum, end_datum")
      .eq("id", t.serie_id)
      .maybeSingle<{ wochentage: Wochentag[]; beginn_datum: string; end_datum: string }>();
    if (s) {
      const altVon = e.reichweite === "alle" ? s.beginn_datum : t.datum;
      const altBis = e.reichweite === "alle" ? s.end_datum : s.end_datum > t.datum ? s.end_datum : t.datum;
      const regel = { wochentage: a.wochentage ?? s.wochentage, von: a.von ?? altVon, bis: a.bis ?? altBis };
      if (e.reichweite === "dieser_und_folgende" && regel.von < t.datum)
        return fehlschlag("eingabe", SERIE_MELDUNG.TEILSERIE_BEGINN, { feld: "von" });
      // Platzhalterzeit: geprüft wird nur die Regel, Zeit und Texte oben.
      const p = serieProblem({ ...regel, beginn: "00:00", ende: "00:01" });
      if (p) return fehlschlag("eingabe", p.text, { feld: p.feld });
    }
  }

  const aenderung: Record<string, unknown> = {};
  if (a.wochentage) aenderung.wochentage = a.wochentage;
  if (a.von) aenderung.beginn_datum = a.von;
  if (a.bis) aenderung.end_datum = a.bis;
  if (hatZeit) Object.assign(aenderung, { beginn: leerZuNull(a.beginn), ende: leerZuNull(a.ende) });
  if (a.ort !== undefined) aenderung.ort = leerZuNull(a.ort);
  if (a.bemerkung !== undefined) aenderung.bemerkung = leerZuNull(a.bemerkung);
  if (verantwortliche?.ok) aenderung.verantwortliche = verantwortliche.ids;
  // Schlüssel vorhanden mit null heisst «auf unbekannt setzen» (#391).
  if (felder) aenderung.felder = felder.felder;
  if (a.spielerzahl !== undefined) aenderung.spielerzahl = a.spielerzahl;

  return laufe(t.team_id, e, async (ausfuehren, erwartet) =>
    supabase.rpc("terminserie_aendern", {
      p_termin: t.id,
      p_reichweite: e.reichweite,
      p_aenderung: aenderung,
      p_version: erwartet?.version ?? null,
      p_entfallend: ausfuehren ? (erwartet?.entfallend ?? null) : null,
      p_ausfuehren: ausfuehren,
    }),
  );
}

/** Einen Serientermin und alle folgenden oder alle Termine der Serie
 *  entfernen (#326 AK 7–9, 11; PC 11–17). */
export async function entferneSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; reichweite: "dieser_und_folgende" | "alle" } & Lauf,
): Promise<KernErgebnis<SerienFolge>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (!t.serie_id) return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, TERMIN_FELD);
  return laufe(t.team_id, e, async (ausfuehren, erwartet) =>
    supabase.rpc("terminserie_entfernen", {
      p_termin: t.id,
      p_reichweite: e.reichweite,
      p_version: erwartet?.version ?? null,
      p_entfallend: ausfuehren ? (erwartet?.entfallend ?? null) : null,
      p_ausfuehren: ausfuehren,
    }),
  );
}

export type FolgeAngabe = "zeit" | "ort" | "bemerkung" | "verantwortliche" | "felder" | "spielerzahl";
/** Auch das Datum lässt sich nennen — die Datenebene weist es ab (PO 3). */
export type FolgeWunsch = FolgeAngabe | "datum";

const FOLGE_ANGABEN: readonly FolgeAngabe[] = ["zeit", "ort", "bemerkung", "verantwortliche", "felder", "spielerzahl"];

/** Abweichende Angaben wieder der Serie folgen lassen (#326 AK 6; das Datum
 *  nie, PO 3 — «datum» reicht der Kern an die Datenebene durch, die es mit
 *  `DATUM_FOLGT_NICHT` abweist). */
export async function folgeDerSerie(
  supabase: SupabaseClient,
  _userId: string,
  e: { terminId: string; angaben: FolgeWunsch[] },
): Promise<KernErgebnis<{ terminId: string; teamId: string }>> {
  if (!istUuid(e.terminId)) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.termin, TERMIN_FELD);
  if (e.angaben.length === 0 || e.angaben.some((x) => x !== "datum" && !FOLGE_ANGABEN.includes(x)))
    return fehlschlag("eingabe", SERIE_MELDUNG.SERIE_ANGABEN_UNGUELTIG, {
      feld: "angaben",
      zulaessig: FOLGE_ANGABEN,
    });
  const { data, error } = await supabase.rpc("termin_der_serie_folgen", { p_termin: e.terminId, p_angaben: e.angaben });
  if (error) return kalenderFehler(error);
  return ok({ terminId: e.terminId, teamId: (data as { team: string }).team });
}

// ── Der KI-Weg: ein Werkzeug, die Reichweite als Angabe (#326 AK 10, 11) ──────

export type MitReichweite = TerminAendern & {
  reichweite?: Reichweite;
  wochentage?: Wochentag[];
  von?: string;
  bis?: string;
  bestaetigt?: boolean;
};

/** Ändern mit Reichweite: Ein Serientermin verlangt sie (AK 11); das Datum
 *  nur für diesen (AK 2), Wochentage und Zeitraum nur für folgende oder alle
 *  (AK 3, 4). */
export async function aendereMitReichweite(
  supabase: SupabaseClient,
  userId: string,
  e: MitReichweite,
): Promise<KernErgebnis<{ terminId: string; teamId: string; serie: SerienFolge | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  const regel = e.wochentage !== undefined || e.von !== undefined || e.bis !== undefined;

  if (!t.serie_id) {
    if (regel || (e.reichweite && e.reichweite !== "nur_dieser"))
      return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });
  } else if (!e.reichweite) {
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  }

  if (!t.serie_id || e.reichweite === "nur_dieser") {
    if (regel) return fehlschlag("regel", SERIE_MELDUNG.REGEL_NUR_SERIE, { feld: "reichweite" });
    const r = await aendereTermin(supabase, userId, e);
    return r.ok ? ok({ terminId: r.wert.terminId, teamId: r.wert.teamId, serie: null }) : r;
  }
  if (e.datum !== undefined) return fehlschlag("regel", SERIE_MELDUNG.DATUM_NUR_EINZELN, { feld: "datum" });
  const r = await aendereSerie(supabase, userId, {
    terminId: e.terminId,
    reichweite: e.reichweite as "dieser_und_folgende" | "alle",
    aenderung: {
      wochentage: e.wochentage,
      von: e.von,
      bis: e.bis,
      beginn: e.beginn,
      ende: e.ende,
      ort: e.ort,
      bemerkung: e.bemerkung,
      felder: e.felder,
      spielerzahl: e.spielerzahl,
    },
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ terminId: e.terminId, teamId: r.wert.teamId, serie: r.wert }) : r;
}

/** Entfernen mit Reichweite (AK 7, 11). */
export async function entferneMitReichweite(
  supabase: SupabaseClient,
  userId: string,
  e: { terminId: string; reichweite?: Reichweite; bestaetigt?: boolean },
): Promise<KernErgebnis<{ teamId: string; trainingId: string | null; serie: SerienFolge | null }>> {
  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (t.serie_id && !e.reichweite)
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  if (!t.serie_id && e.reichweite && e.reichweite !== "nur_dieser")
    return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });
  if (!t.serie_id || e.reichweite === "nur_dieser") {
    const r = await entferneTermin(supabase, userId, { terminId: t.id });
    return r.ok ? ok({ ...r.wert, serie: null }) : r;
  }
  const r = await entferneSerie(supabase, userId, {
    terminId: t.id,
    reichweite: e.reichweite as "dieser_und_folgende" | "alle",
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ teamId: r.wert.teamId, trainingId: null, serie: r.wert }) : r;
}
