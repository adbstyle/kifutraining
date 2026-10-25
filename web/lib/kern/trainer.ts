import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istUuid } from "@/lib/kennung";
import { SERIE_MELDUNG, SERIE_TEXT, type Reichweite } from "@/lib/serie";
import { TRAINER_TEXT } from "@/lib/trainer";
import { getTeamMitgliederFuer } from "@/lib/queries/teams-fuer";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { kalenderFehler, ladeTermin } from "@/lib/kern/termine";
import { aendereSerie, type SerienFolge } from "@/lib/kern/serien";
import { fehlschlag, ok, type KernErgebnis, type KernFehler } from "@/lib/kern/ergebnis";

/**
 * Trainer:innen je Termin und Serie (#519): wen ein Termin einlädt und wer
 * ihn vorbereitet und leitet. Einzeln über termin_trainer_aendern — als
 * Differenz, damit gleichzeitiges Einladen die Einladungen anderer nicht
 * überschreibt —, für folgende und alle über die Serienrechnung (Schlüssel
 * «eingeladene» = ganze Liste, «verantwortlich» = Kennung).
 */

/** Kennungen vorab prüfen und von Doppelten befreien: Jede muss eine UUID
 *  sein, sonst wiese Postgres mit einem rohen Fehler ab. */
export function bereinigeKennungen(
  ids: readonly unknown[],
  feld: string,
): { ok: true; ids: string[] } | { ok: false; fehler: KernFehler } {
  if (!Array.isArray(ids) || !ids.every((x) => istUuid(x)))
    return { ok: false, fehler: fehlschlag("eingabe", TRAINER_TEXT.kennungUngueltig, { feld }) };
  return { ok: true, ids: [...new Set((ids as string[]).map((x) => x.toLowerCase()))] };
}

/** Eine einzelne Kennung prüfen — `undefined` bleibt unverändert. */
function bereinigeKennung(id: unknown, feld: string): { ok: true; id?: string } | { ok: false; fehler: KernFehler } {
  if (id === undefined) return { ok: true };
  if (!istUuid(id)) return { ok: false, fehler: fehlschlag("eingabe", TRAINER_TEXT.kennungUngueltig, { feld }) };
  return { ok: true, id: (id as string).toLowerCase() };
}

/** Die Mitglieder eines Teams mit Anzeigename, ohne E-Mail. */
export async function teamMitglieder(
  supabase: SupabaseClient,
  userId: string,
  e: { teamId: string },
): Promise<KernErgebnis<{ mitglieder: { id: string; anzeigename: string; ich: boolean }[] }>> {
  const team = await pruefeTeamMitglied(supabase, e.teamId);
  if (!team.ok) return team;
  try {
    const m = await getTeamMitgliederFuer(supabase, e.teamId);
    return ok({ mitglieder: m.map((x) => ({ id: x.userId, anzeigename: x.anzeigeName, ich: x.userId === userId })) });
  } catch (err) {
    console.error("[kern] teamMitglieder:", err instanceof Error ? err.message : err);
    return fehlschlag("technisch", "Das Team liess sich gerade nicht lesen. Bitte versuche es noch einmal.", {
      wiederholbar: true,
    });
  }
}

export type TrainerWahl = {
  /** Die Eingeladenen; ohne Angabe: alle Mitglieder des Teams (#519 AK 1, PO 9). */
  eingeladene?: readonly string[];
  /** Die Verantwortliche; ohne Angabe: wer festlegt. Sie ist damit eingeladen. */
  verantwortlich?: string | null;
};

/** Die Besetzung eines neuen Termins oder einer neuen Serie — mit den
 *  Vorgaben der Oberfläche, wo eine Angabe fehlt (#519 AK 1–4). */
export async function trainerBeimFestlegen(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  e: TrainerWahl,
): Promise<KernErgebnis<{ eingeladene: string[]; verantwortlich: string }>> {
  if (e.verantwortlich === null) return fehlschlag("regel", TRAINER_TEXT.verantwortlichPflicht, { feld: "verantwortlich" });
  const v = bereinigeKennung(e.verantwortlich ?? userId, "verantwortlich");
  if (!v.ok) return v.fehler;
  if (e.eingeladene !== undefined) {
    const l = bereinigeKennungen(e.eingeladene, "eingeladene");
    if (!l.ok) return l.fehler;
    return ok({ eingeladene: l.ids, verantwortlich: v.id! });
  }
  try {
    const m = await getTeamMitgliederFuer(supabase, teamId);
    return ok({ eingeladene: m.map((x) => x.userId), verantwortlich: v.id! });
  } catch (err) {
    console.error("[kern] trainerBeimFestlegen:", err instanceof Error ? err.message : err);
    return fehlschlag("technisch", "Das Team liess sich gerade nicht lesen. Bitte versuche es noch einmal.", {
      wiederholbar: true,
    });
  }
}

export type TrainerAendern = {
  terminId: string;
  /** Wer dazukommt bzw. wegfällt; Ausladen wirkt immer, auch bei der Verantwortlichen (AK 9). */
  einladen?: string[];
  ausladen?: string[];
  /** Einträge ohne Namen (gelöschte Konten), die wegfallen — nur für diesen Termin. */
  ausladenEintraege?: string[];
  /** Der KI-Weg: alle Einträge ohne Namen entfernen, ohne ihre Kennungen zu kennen. */
  ohneNamenEntfernen?: boolean;
  /** Die neue Verantwortliche; sie ist damit eingeladen. `undefined` = unverändert. */
  verantwortlich?: string;
  reichweite?: Reichweite;
  erwartet?: { version: number; entfallend: string[] };
  bestaetigt?: boolean;
};

/** Trainer:innen eines Termins einladen, ausladen und die Verantwortung
 *  übertragen — für diesen oder mit der Reichweite für folgende und alle
 *  Termine seiner Serie (#519 AK 5–14). */
export async function aendereTrainer(
  supabase: SupabaseClient,
  userId: string,
  e: TrainerAendern,
): Promise<KernErgebnis<{ terminId: string; teamId: string; serie: SerienFolge | null }>> {
  const einladen = bereinigeKennungen(e.einladen ?? [], "einladen");
  if (!einladen.ok) return einladen.fehler;
  const ausladen = bereinigeKennungen(e.ausladen ?? [], "ausladen");
  if (!ausladen.ok) return ausladen.fehler;
  const eintraege = bereinigeKennungen(e.ausladenEintraege ?? [], "ausladen_eintraege");
  if (!eintraege.ok) return eintraege.fehler;
  const v = bereinigeKennung(e.verantwortlich, "verantwortlich");
  if (!v.ok) return v.fehler;
  if (!einladen.ids.length && !ausladen.ids.length && !eintraege.ids.length && !e.ohneNamenEntfernen && v.id === undefined)
    return fehlschlag("eingabe", SERIE_MELDUNG.KEINE_AENDERUNG);

  const geladen = await ladeTermin(supabase, e.terminId);
  if (!geladen.ok) return geladen;
  const t = geladen.wert;
  if (e.ohneNamenEntfernen) {
    const { data, error } = await supabase.from("termin_trainer").select("id").eq("termin_id", t.id).is("user_id", null);
    if (error) return kalenderFehler(error);
    eintraege.ids.push(...(data as { id: string }[]).map((r) => r.id));
  }
  if (t.serie_id && !e.reichweite)
    return fehlschlag("regel", SERIE_MELDUNG.REICHWEITE_FEHLT, {
      feld: "reichweite",
      zulaessig: ["nur_dieser", "dieser_und_folgende", "alle"],
    });
  if (!t.serie_id && e.reichweite && e.reichweite !== "nur_dieser")
    return fehlschlag("regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE, { feld: "reichweite" });

  if (!t.serie_id || e.reichweite === "nur_dieser") {
    const { error } = await supabase.rpc("termin_trainer_aendern", {
      p_termin: t.id,
      p_einladen: einladen.ids,
      p_ausladen: ausladen.ids,
      p_verantwortlich: v.id ?? null,
      p_ausladen_eintraege: eintraege.ids,
    });
    if (error) return kalenderFehler(error);
    return ok({ terminId: t.id, teamId: t.team_id, serie: null });
  }

  // Für folgende und alle: Einträge ohne Namen gibt es nur am Termin.
  if (eintraege.ids.length) return fehlschlag("regel", SERIE_TEXT.namenloseNurEinzeln, { feld: "ausladen_eintraege" });
  const aenderung: { eingeladene?: string[]; verantwortlich?: string } = {};
  if (einladen.ids.length || ausladen.ids.length) {
    // Die Serie erhält die ganze Liste: die des Termins, um die Differenz geändert.
    const { data, error } = await supabase.from("termin_trainer").select("user_id").eq("termin_id", t.id);
    if (error) return kalenderFehler(error);
    const bisher = (data as { user_id: string | null }[]).flatMap((r) => (r.user_id ? [r.user_id] : []));
    aenderung.eingeladene = [...new Set([...bisher, ...einladen.ids])].filter((u) => !ausladen.ids.includes(u));
  }
  if (v.id !== undefined) aenderung.verantwortlich = v.id;
  const r = await aendereSerie(supabase, userId, {
    terminId: t.id,
    reichweite: e.reichweite as "dieser_und_folgende" | "alle",
    aenderung,
    erwartet: e.erwartet,
    bestaetigt: e.bestaetigt,
  });
  return r.ok ? ok({ terminId: t.id, teamId: r.wert.teamId, serie: r.wert }) : r;
}
