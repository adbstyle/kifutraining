import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MELDUNG_VERGEBEN } from "@/lib/bezeichnung";
import { istHauptteil, nameProblem } from "@/lib/gruppen";
import { fachlicheMeldung } from "@/lib/training-bedingungen";
import {
  ladeFassungZumBearbeiten,
  ladeGruppeZumBearbeiten,
  ladeTrainingZumBearbeiten,
} from "@/lib/kern/zugriff";
import {
  MELDUNG_WIEDERHOLEN,
  NICHT_GEFUNDEN,
  ausDbFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
  type KernFehler,
} from "@/lib/kern/ergebnis";

/**
 * Gruppen eines Trainings und der Durchlauf einer Hauptteil-Übung
 * (Stories #149/#150, KI-Weg #194).
 *
 * Eine Regelquelle für den Editor (lib/actions/gruppen.ts) und die
 * KI-Werkzeuge «gruppe_*» und «training_uebung_durchlauf_setzen» — dieselben
 * Regeln, wortgleich dieselben Meldungen.
 *
 * Kein Owner-Filter in den Schreibzugriffen: Wer an eine Gruppe darf, sagen
 * die RLS-Policies `tg_*` (Eigentümer oder Team-Mitglied). Die Einordnung
 * vorab (`lade…ZumBearbeiten`) trennt «nicht sichtbar» von «fremd».
 *
 * Die Bezeichnung wird zweimal geprüft: hier gegen den gelesenen Bestand,
 * damit die Meldung die Regel nennt, und in der Datenbank durch den
 * Unique-Index `tg_name_je_training`. Nur die Datenbank kann zwei
 * gleichzeitige Anlagen auseinanderhalten — ihr `23505` ist darum derselbe
 * Satz wie die Vorabprüfung (`MELDUNG_VERGEBEN`), eine verletzte Regel und
 * keine Nebenläufigkeit, die ein zweiter Versuch löste.
 *
 * Nicht hier: das Verschieben einer Gruppe (`verschiebeGruppe` bleibt eine
 * Action ohne Kern — der KI-Weg ändert die Gruppenfolge nicht, #194 OoS 2)
 * und jede Konfliktmeldung der Verteilung (#195).
 */

/** Die Unique-Verletzung des Index `tg_name_je_training`. */
const UNIQUE_VERLETZUNG = "23505";

/** Die Auskunft für den Fall, der nach Lage der Daten nicht eintreten kann.
 *  Sie nennt keine Ursache, weil es keine bekannte gibt. */
export const GRUPPE_NICHT_ANGELEGT = "Die Gruppe liess sich nicht anlegen.";

/** Eine Gruppe steht im Durchlauf derselben Übung zweimal — der
 *  Primärschlüssel von `training_exercise_gruppen` wiese das ab, aber ohne
 *  sprechende Meldung. Darum benennt der Kern es vorher. */
export const DURCHLAUF_DOPPELT = "Eine Gruppe steht im Durchlauf mehrfach.";

/** Der Klartext eines `teg_guard`-Markers — derselbe Satz, den die Oberfläche
 *  zeigt, wenn die Datenbank abweist (`fachlicheMeldung`). */
const markerText = (marker: "GRUPPE_NUR_HAUPTTEIL" | "GRUPPE_FREMDES_TRAINING") =>
  fachlicheMeldung(marker) ?? marker;

type Gruppe = { id: string; name: string };

/** Die Gruppen eines Trainings in ihrer Reihenfolge — Grundlage der
 *  Namensprüfung und der Prüfung eines Durchlaufs. */
async function gruppenVon(
  supabase: SupabaseClient,
  trainingId: string,
): Promise<KernErgebnis<Gruppe[]>> {
  const { data, error } = await supabase
    .from("training_gruppen")
    .select("id, name")
    .eq("training_id", trainingId)
    .order("position");
  if (error) return ausDbFehler(error);
  return ok(data ?? []);
}

/** `nameProblem` als Kern-Fehler: leer oder zu lang ist eine Eingabe, eine
 *  vergebene Bezeichnung eine Regel des Trainings. */
function namensFehler(problem: string): KernFehler {
  return fehlschlag(problem === MELDUNG_VERGEBEN ? "regel" : "eingabe", problem, { feld: "name" });
}

/** Ein Schreibfehler an `training_gruppen`: 23505 ist die vergebene
 *  Bezeichnung, alles andere geht durch `ausDbFehler`. */
function schreibFehler(e: { message: string; code?: string }): KernFehler {
  return e.code === UNIQUE_VERLETZUNG
    ? fehlschlag("regel", MELDUNG_VERGEBEN, { feld: "name" })
    : ausDbFehler(e);
}

// ── Gruppen ─────────────────────────────────────────────────────────────────

/** Eine Gruppe am Training anlegen (#149 AK 1, #194 AK 1/9). Sie steht
 *  hinter den bestehenden (#194 OoS 2). */
export async function legeGruppeAn(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; name: string },
): Promise<KernErgebnis<{ trainingId: string; gruppe: Gruppe }>> {
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const bestehende = await gruppenVon(supabase, e.trainingId);
  if (!bestehende.ok) return bestehende;

  const name = e.name.trim();
  const problem = nameProblem(name, bestehende.wert);
  if (problem) return namensFehler(problem);

  const { data, error } = await supabase
    .from("training_gruppen")
    .insert({ training_id: e.trainingId, name })
    .select("id, name")
    .maybeSingle();
  if (error) return schreibFehler(error);
  // Defensiv: Ein geglückter Insert liefert die Zeile, ein fehlendes Recht
  // einen Fehler — einen dritten Ausgang gibt es nicht. Ein stiller Erfolg
  // ohne Gruppe wäre das Schlimmere.
  if (!data) return fehlschlag("technisch", GRUPPE_NICHT_ANGELEGT);
  return ok({ trainingId: e.trainingId, gruppe: { id: data.id, name: data.name } });
}

/** Eine Gruppe umbenennen (#149 AK 2, #194 AK 3/9). Die eigene Bezeichnung
 *  zählt dabei nicht als vergeben — «Rot» → «rot» geht. */
export async function benenneGruppe(
  supabase: SupabaseClient,
  userId: string,
  e: { gruppeId: string; name: string },
): Promise<KernErgebnis<{ trainingId: string; name: string }>> {
  const geladen = await ladeGruppeZumBearbeiten(supabase, userId, e.gruppeId);
  if (!geladen.ok) return geladen;
  const trainingId = geladen.wert.gruppe.training_id;
  const bestehende = await gruppenVon(supabase, trainingId);
  if (!bestehende.ok) return bestehende;

  const name = e.name.trim();
  const problem = nameProblem(name, bestehende.wert, e.gruppeId);
  if (problem) return namensFehler(problem);

  const { data, error } = await supabase
    .from("training_gruppen")
    .update({ name })
    .eq("id", e.gruppeId)
    .select("id")
    .maybeSingle();
  if (error) return schreibFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.gruppe, { feld: "gruppe_id" });
  return ok({ trainingId, name });
}

/** Eine Gruppe entfernen (#149 AK 3, #194 AK 4/5, PC 2). Die Datenbank räumt
 *  ihre Zuweisungen per Kaskade aus jedem Durchlauf, in jeder Variante;
 *  `anUebungen` sagt, an wie vielen Übungen sie stand — gezählt VOR dem
 *  Löschen, danach ist nichts mehr zu zählen. */
export async function entferneGruppe(
  supabase: SupabaseClient,
  userId: string,
  e: { gruppeId: string },
): Promise<KernErgebnis<{ trainingId: string; name: string; anUebungen: number }>> {
  const geladen = await ladeGruppeZumBearbeiten(supabase, userId, e.gruppeId);
  if (!geladen.ok) return geladen;
  const { gruppe } = geladen.wert;

  const { count, error: zaehlFehler } = await supabase
    .from("training_exercise_gruppen")
    .select("*", { count: "exact", head: true })
    .eq("gruppe_id", e.gruppeId);
  if (zaehlFehler) return ausDbFehler(zaehlFehler);

  const { data, error } = await supabase
    .from("training_gruppen")
    .delete()
    .eq("id", e.gruppeId)
    .select("id")
    .maybeSingle();
  if (error) return ausDbFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.gruppe, { feld: "gruppe_id" });
  return ok({ trainingId: gruppe.training_id, name: gruppe.name, anUebungen: count ?? 0 });
}

// ── Durchlauf ───────────────────────────────────────────────────────────────

/**
 * Den Durchlauf einer Hauptteil-Übung setzen (#150 AK 1–3, #194 AK 6/7/10/11,
 * PC 1): die Gruppen in Wechselreihenfolge; `[]` heisst «alle gemeinsam».
 * Die Folge wird vollständig ersetzt (RPC `setze_gruppenfolge`) —
 * Zuweisen, Umsortieren und Entfernen sind dieselbe Aktion.
 *
 * Die Regeln der Datenebene (`teg_guard`) benennt der Kern vorher, damit die
 * Meldung die Regel nennt statt eines Datenbankfehlers: nur im Hauptteil,
 * nur Gruppen dieses Trainings (samt den zulässigen Kennungen), keine Gruppe
 * zweimal. Die Datenbank bleibt der Rückhalt.
 */
export async function setzeDurchlauf(
  supabase: SupabaseClient,
  userId: string,
  e: { fassungId: string; gruppeIds: string[] },
): Promise<KernErgebnis<{ trainingId: string; gruppen: Gruppe[] }>> {
  const geladen = await ladeFassungZumBearbeiten(supabase, userId, e.fassungId);
  if (!geladen.ok) return geladen;
  const { fassung } = geladen.wert;
  if (!istHauptteil(fassung.trainingsteil))
    return fehlschlag("regel", markerText("GRUPPE_NUR_HAUPTTEIL"), { feld: "fassung_id" });

  if (new Set(e.gruppeIds).size !== e.gruppeIds.length)
    return fehlschlag("regel", DURCHLAUF_DOPPELT, { feld: "gruppe_ids" });

  const gruppen = await gruppenVon(supabase, fassung.training_id);
  if (!gruppen.ok) return gruppen;
  const nachId = new Map(gruppen.wert.map((g) => [g.id, g]));
  if (e.gruppeIds.some((id) => !nachId.has(id)))
    return fehlschlag("regel", markerText("GRUPPE_FREMDES_TRAINING"), {
      feld: "gruppe_ids",
      zulaessig: gruppen.wert.map((g) => g.id),
    });

  const { error } = await supabase.rpc("setze_gruppenfolge", {
    p_te: e.fassungId,
    p_gruppen: e.gruppeIds,
  });
  // 23505 kann hier nur Nebenläufigkeit sein: Doppelte fängt die Vorprüfung
  // oben, aber die RPC löscht und schreibt ohne Sperre — zwei gleichzeitige
  // Aufrufe an derselben Übung treffen sich am Primärschlüssel bzw. an
  // `teg_position_je_fassung`. Die RPC hat dann zurückgerollt; ein zweiter
  // Versuch setzt die Folge sauber.
  if (error?.code === UNIQUE_VERLETZUNG)
    return fehlschlag("konflikt", MELDUNG_WIEDERHOLEN, { wiederholbar: true });
  if (error) return ausDbFehler(error);
  return ok({
    trainingId: fassung.training_id,
    gruppen: e.gruppeIds.map((id) => nachId.get(id)!),
  });
}
