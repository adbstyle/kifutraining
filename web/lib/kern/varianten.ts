import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { VARIANTENFOLGE_MELDUNG, fachlicheMeldung } from "@/lib/training-bedingungen";
import { varianteNameProblem, type Variante } from "@/lib/varianten";
import { bildOrdnerFuer } from "@/lib/training-zugriff";
import {
  eigeneBildPfade,
  entferneStorageObjekte,
  kopiereBild,
  kopiereDiagrammVon,
} from "@/lib/fassung";
import { ladeTrainingZumBearbeiten, ladeVarianteZumBearbeiten } from "@/lib/kern/zugriff";
import {
  NICHT_GEFUNDEN,
  ausDbFehler,
  bezeichnungsFehler,
  bezeichnungsSchreibFehler,
  fehlschlag,
  ok,
  type KernErgebnis,
} from "@/lib/kern/ergebnis";

/**
 * Varianten des Hauptteils anlegen, umbenennen, entfernen und ordnen
 * (Epic #200, Stories #201/#202/#209; KI-Weg #263).
 *
 * Eine Regelquelle für den Editor (lib/actions/varianten.ts) und die
 * KI-Werkzeuge «variante_*» und «varianten_ordnen» — dieselben Regeln,
 * wortgleich dieselben Meldungen.
 *
 * Kein Owner-Filter in den Schreibzugriffen: Wer an eine Variante darf, sagen
 * die RLS-Policies `tv_*` (Eigentümer oder Team-Mitglied). Die Einordnung
 * vorab (`lade…ZumBearbeiten`) trennt «nicht sichtbar» von «fremd».
 *
 * Die Bezeichnung wird zweimal geprüft: hier gegen den gelesenen Bestand,
 * damit die Meldung die Regel nennt, und in der Datenbank durch den
 * Unique-Index `tv_name_je_training`. Nur die Datenbank kann zwei
 * gleichzeitige Anlagen auseinanderhalten — ihr `23505` ist darum derselbe
 * Satz wie die Vorabprüfung (`MELDUNG_VERGEBEN`).
 *
 * Anlegen und Entfernen laufen über SECURITY-DEFINER-RPCs statt über direkte
 * Schreibzugriffe: Beide sind mehrstufig (Variante + Fassungskopien +
 * Zuweisungen bzw. Prüfung + Löschen + Auflösung) und müssen in EINER
 * Transaktion geschehen — eine halb gefüllte Variante wäre für den Trainer
 * eine Zumutung, und der Veröffentlichungs-Gate wiese sie zu Recht ab.
 *
 * Nicht hier: `verschiebeVariante`. Der Editor tauscht Nachbarn über das
 * Chip-Menü (`verschiebe_variante`), der KI-Weg setzt die Folge in einem Zug
 * (`setze_variantenfolge`). Zwei Bedienwege ohne gemeinsame Fachregel ausser
 * der Datenebene — in den Kern gehören nur Operationen mit Werkzeug (Muster
 * `verschiebeGruppe`).
 */

/** Die Auskunft für den Fall, der nach Lage der Daten nicht eintreten kann.
 *  Sie nennt keine Ursache, weil es keine bekannte gibt. */
export const VARIANTE_NICHT_ANGELEGT = "Die Variante liess sich nicht anlegen.";

/** Der Klartext eines Varianten-Markers — derselbe Satz, den die Oberfläche
 *  zeigt, wenn die Datenbank abweist (`fachlicheMeldung`). */
const markerText = (marker: "VARIANTE_FREMDES_TRAINING") => fachlicheMeldung(marker) ?? marker;

/** Die Varianten eines Trainings in ihrer Reihenfolge (position, id) — dieselbe
 *  Ordnung wie Anzeige, Trigger `te_variante_ausrichten` und Kopie. Geteilt mit
 *  `loeseVarianteAuf` (kern/fassung.ts). */
export async function variantenVon(
  supabase: SupabaseClient,
  trainingId: string,
): Promise<KernErgebnis<Variante[]>> {
  const { data, error } = await supabase
    .from("training_varianten")
    .select("id, name")
    .eq("training_id", trainingId)
    .order("position")
    .order("id");
  if (error) return ausDbFehler(error);
  return ok(data ?? []);
}

/**
 * Eine weitere Variante des Hauptteils anlegen — als vollständige Kopie einer
 * bestehenden (#201 AK 1/2, PC 1; #263). Ohne `quelleVarianteId` die vorderste.
 *
 * `nameQuelle` ist die (optional) neue Bezeichnung der Quelle: Beim Anlegen der
 * ZWEITEN Variante benennt der Trainer beide, denn bis dahin trug der Hauptteil
 * einen unsichtbaren Vorgabenamen (#201 AK 2).
 *
 * Der Ablauf ist geteilt, weil Storage und Diagramm-Kopie nicht in SQL gehen:
 * Die Anwendung erzeugt die IDs der Kopien vorab, kopiert Bilddatei und
 * Diagramm (mit frischen Element-IDs) und reicht das Mapping an die RPC. WAS
 * kopiert wird, entscheidet dort SQL — das Mapping kann nichts hinzufügen und
 * nichts weglassen, ohne `VARIANTE_KOPIE_UNVOLLSTAENDIG` auszulösen.
 *
 * Scheitert die RPC, fallen die bereits erzeugten Bilddateien wieder weg.
 */
export async function legeVarianteAn(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; quelleVarianteId?: string; name: string; nameQuelle?: string },
): Promise<
  KernErgebnis<{
    trainingId: string;
    variante: Variante;
    /** Die Quelle nach dem Anlegen — samt neuer Bezeichnung, falls `nameQuelle`. */
    quelle: Variante;
    uebungenKopiert: number;
  }>
> {
  // Das Bearbeitungsziel sagt zugleich, in welchen Storage-Ordner die
  // Bildkopien gehören: bei einem Team-Training in den Team-Ordner, damit jedes
  // Mitglied das Bild danach ersetzen darf.
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const { ziel } = zugriff.wert;

  const bestehend = await variantenVon(supabase, e.trainingId);
  if (!bestehend.ok) return bestehend;
  const bestehende = bestehend.wert;
  // Nach Lage der Daten unmöglich: Jedes Training führt mindestens eine Variante.
  if (bestehende.length === 0) return fehlschlag("technisch", VARIANTE_NICHT_ANGELEGT);

  const quelle = e.quelleVarianteId
    ? bestehende.find((v) => v.id === e.quelleVarianteId)
    : bestehende[0];
  if (!quelle)
    return fehlschlag("regel", markerText("VARIANTE_FREMDES_TRAINING"), {
      feld: "quelle_variante_id",
      zulaessig: bestehende.map((v) => v.id),
    });

  // Die Quelle darf ihren bisherigen Namen behalten und ihn zugleich ändern —
  // beides wird gegen den Bestand OHNE sie selbst geprüft. Und beide Eingaben
  // gegeneinander: Der Unique-Index sähe die Kollision erst, wenn schon die
  // halbe Umbenennung stünde.
  const getrimmt = e.name.trim();
  const getrimmtQuelle = e.nameQuelle?.trim();
  if (getrimmtQuelle !== undefined) {
    const problem = varianteNameProblem(getrimmtQuelle, bestehende, quelle.id);
    if (problem) return bezeichnungsFehler(problem, "name_quelle");
  }
  const nachher = bestehende.map((v) =>
    v.id === quelle.id && getrimmtQuelle !== undefined ? { ...v, name: getrimmtQuelle } : v,
  );
  const problem = varianteNameProblem(getrimmt, nachher);
  if (problem) return bezeichnungsFehler(problem, "name");

  // Die Fassungen der Quelle: nur ihre IDs, ihr Bild und ihr Diagramm. Alles
  // andere kopiert die RPC direkt aus der Zeile — so kann kein Übungsfeld
  // unterwegs verlorengehen.
  const { data: quellFassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select("id, bild_url, diagramm")
    .eq("variante_id", quelle.id);
  if (leseFehler) return ausDbFehler(leseFehler);

  const ordner = bildOrdnerFuer(ziel);
  const kopierteBilder: string[] = [];
  const mapping: {
    quelle_id: string;
    neue_id: string;
    bild_url: string | null;
    diagramm: unknown;
  }[] = [];
  for (const f of quellFassungen ?? []) {
    const neueId = crypto.randomUUID();
    const bild = await kopiereBild(supabase, f.bild_url, ordner, neueId);
    if (bild.error) {
      await entferneStorageObjekte(supabase, kopierteBilder);
      return fehlschlag("technisch", bild.error, { wiederholbar: true });
    }
    if (bild.pfad) kopierteBilder.push(bild.pfad);
    mapping.push({
      quelle_id: f.id,
      neue_id: neueId,
      bild_url: bild.url,
      // Frische Element-IDs: Die Kopie ist ab dem ersten Moment eigenständig
      // (#201 PC 2).
      diagramm: kopiereDiagrammVon(f.diagramm),
    });
  }

  const { data: neueId, error } = await supabase.rpc("lege_variante_an", {
    p_training: e.trainingId,
    p_quelle: quelle.id,
    p_name: getrimmt,
    p_name_quelle: getrimmtQuelle ?? null,
    p_fassungen: mapping,
  });
  if (error || !neueId) {
    await entferneStorageObjekte(supabase, kopierteBilder);
    // Weniger Fassungen angemeldet, als die Quelle inzwischen führt — jemand
    // hat parallel eine Übung ergänzt. Nebenläufigkeit, kein Regelverstoss:
    // ein zweiter Versuch liest die Quelle neu.
    if (error?.message.includes("VARIANTE_KOPIE_UNVOLLSTAENDIG"))
      return fehlschlag("konflikt", fachlicheMeldung(error.message) ?? VARIANTE_NICHT_ANGELEGT, {
        wiederholbar: true,
      });
    if (error) return bezeichnungsSchreibFehler(error, "name");
    // Defensiv: Eine geglückte RPC liefert die Kennung, ein fehlendes Recht
    // einen Fehler — ein stiller Erfolg ohne Variante wäre das Schlimmere.
    return fehlschlag("technisch", VARIANTE_NICHT_ANGELEGT);
  }

  return ok({
    trainingId: e.trainingId,
    variante: { id: neueId as string, name: getrimmt },
    quelle: { id: quelle.id, name: getrimmtQuelle ?? quelle.name },
    uebungenKopiert: mapping.length,
  });
}

/** Die Bezeichnung einer Variante ändern (#202, #263). Die eigene zählt dabei
 *  nicht als vergeben — dafür kennt `varianteNameProblem` die eigene ID. */
export async function benenneVariante(
  supabase: SupabaseClient,
  userId: string,
  e: { varianteId: string; name: string },
): Promise<KernErgebnis<{ trainingId: string; name: string }>> {
  const geladen = await ladeVarianteZumBearbeiten(supabase, userId, e.varianteId);
  if (!geladen.ok) return geladen;
  const trainingId = geladen.wert.variante.training_id;
  const bestehende = await variantenVon(supabase, trainingId);
  if (!bestehende.ok) return bestehende;

  const name = e.name.trim();
  const problem = varianteNameProblem(name, bestehende.wert, e.varianteId);
  if (problem) return bezeichnungsFehler(problem, "name");

  const { data, error } = await supabase
    .from("training_varianten")
    .update({ name })
    .eq("id", e.varianteId)
    .select("id")
    .maybeSingle();
  if (error) return bezeichnungsSchreibFehler(error);
  if (!data) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.variante, { feld: "variante_id" });
  return ok({ trainingId, name });
}

/**
 * Eine Variante entfernen (#202, #209, #263). Ihre Fassungen fallen mit ihr
 * (Kaskade an `training_exercises.variante_id`), die Gruppen-DEFINITIONEN
 * bleiben — sie gehören dem Training und gelten für alle Varianten. Bleibt
 * genau eine übrig, löst die RPC sie auf (Vorgabename, Position 0).
 *
 * Die Bildpfade werden VOR dem Löschen gelesen: Danach gibt es die Zeilen nicht
 * mehr, und ihre Dateien blieben als Waisen im Storage liegen. Entfernt wird
 * nur, was der Fassung selbst gehört (`eigeneBildPfade`) — und erst nach der
 * geglückten RPC.
 *
 * Die letzte Variante bleibt (Epic EK 6). Das entscheidet die RPC vor dem
 * Löschen (`LETZTE_VARIANTE` → `regel`).
 */
export async function entferneVariante(
  supabase: SupabaseClient,
  userId: string,
  e: { varianteId: string },
): Promise<
  KernErgebnis<{
    trainingId: string;
    name: string;
    uebungenEntfernt: number;
    /** Blieb genau eine übrig? Dann heisst sie wieder `VARIANTE_VORGABENAME`. */
    aufgeloest: boolean;
    /** Die Varianten danach, in ihrer Reihenfolge. */
    verbleibend: Variante[];
  }>
> {
  const geladen = await ladeVarianteZumBearbeiten(supabase, userId, e.varianteId);
  if (!geladen.ok) return geladen;
  const { variante } = geladen.wert;

  const { data: fassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select("id, bild_url")
    .eq("variante_id", e.varianteId);
  if (leseFehler) return ausDbFehler(leseFehler);

  const { data: trainingId, error } = await supabase.rpc("entferne_variante", {
    p_variante: e.varianteId,
  });
  if (error) return { ...ausDbFehler(error), feld: "variante_id" };
  if (!trainingId)
    return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.variante, { feld: "variante_id" });

  await entferneStorageObjekte(supabase, eigeneBildPfade(fassungen ?? []));

  // Die Löschung ist geschehen — ein Lesefehler danach darf keinen
  // Fehlschlag vortäuschen. Er fällt dann auf «nichts bekannt» zurück.
  const danach = await variantenVon(supabase, trainingId as string);
  if (!danach.ok) console.error(`[varianten] Nachlesen nach dem Entfernen: ${danach.meldung}`);
  const verbleibend = danach.ok ? danach.wert : [];

  return ok({
    trainingId: trainingId as string,
    name: variante.name,
    uebungenEntfernt: (fassungen ?? []).length,
    aufgeloest: verbleibend.length === 1,
    verbleibend,
  });
}

/**
 * Die Reihenfolge der Varianten in einem Zug festlegen (#263). Die vorderste
 * zeigt KiFu beim Öffnen (#201 AK 7).
 *
 * Verlangt ist die VOLLSTÄNDIGE Folge — eine Teilfolge liesse offen, wohin die
 * übrigen gehören. Die Vorprüfung hier nennt doppelte, fehlende und fremde
 * Varianten mit Namen (Muster `setzeUebungsfolge`); die RPC
 * `setze_variantenfolge` prüft dasselbe unter Sperre des Trainings noch einmal
 * und schreibt atomar — was zwischen Vorprüfung und Schreiben dazukommt, weist
 * sie als unvollständig ab.
 */
export async function setzeVariantenfolge(
  supabase: SupabaseClient,
  userId: string,
  e: { trainingId: string; varianteIds: readonly string[] },
): Promise<KernErgebnis<{ trainingId: string; folge: Variante[] }>> {
  const zugriff = await ladeTrainingZumBearbeiten(supabase, userId, e.trainingId);
  if (!zugriff.ok) return zugriff;
  const alle = await variantenVon(supabase, e.trainingId);
  if (!alle.ok) return alle;

  const nachId = new Map(alle.wert.map((v) => [v.id, v]));
  // Name UND Kennung: Die Kennung ist, was der Assistent zurückschickt; der
  // Name, woran er erkennt, welche gemeint ist.
  const genannt = (id: string) => (nachId.has(id) ? `„${nachId.get(id)!.name}" (${id})` : id);

  const ids = e.varianteIds;
  const doppelt = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (doppelt.length > 0)
    return fehlschlag(
      "regel",
      `${VARIANTENFOLGE_MELDUNG.VARIANTENFOLGE_DOPPELT} Mehrfach: ${doppelt.map(genannt).join(", ")}.`,
      { feld: "variante_ids" },
    );
  const fehlen = alle.wert.filter((v) => !ids.includes(v.id));
  const fremd = ids.filter((id) => !nachId.has(id));
  if (fehlen.length > 0 || fremd.length > 0) {
    const teile: string[] = [VARIANTENFOLGE_MELDUNG.VARIANTENFOLGE_UNVOLLSTAENDIG];
    if (fehlen.length > 0) teile.push(`Es fehlen: ${fehlen.map((v) => genannt(v.id)).join(", ")}.`);
    if (fremd.length > 0) teile.push(`Nicht in diesem Training: ${fremd.join(", ")}.`);
    return fehlschlag("regel", teile.join(" "), {
      feld: "variante_ids",
      zulaessig: alle.wert.map((v) => v.id),
    });
  }

  const { error } = await supabase.rpc("setze_variantenfolge", {
    p_training: e.trainingId,
    p_ids: [...ids],
  });
  if (error) return ausDbFehler(error);

  return ok({ trainingId: e.trainingId, folge: ids.map((id) => nachId.get(id)!) });
}
