// Der zentrale Kopier-Baustein für Trainings (Team-Epic, Kopie-Modell).
//
// Geteilt wird nie, kopiert immer: ins Team stellen, zu mir übernehmen, ein
// öffentliches Training bzw. eine Vorlage übernehmen und je Termin ansetzen —
// alle vier gehen durch `kopiereTraining`. Das Veröffentlichen gehört nicht
// dazu: Es schaltet dasselbe Training sichtbar und kopiert nichts.
//
// Damit gibt es genau eine Stelle, die weiss, was zu einer vollständigen,
// entkoppelten Kopie gehört — und genau eine Stelle, die aufräumt, wenn
// unterwegs etwas schiefgeht.
//
// Die Fassungs-Bausteine (`kopiereBild`, `inhaltFelder`, `kopiereDiagrammVon`)
// stammen aus dem Bibliotheks-Epic und werden hier wiederverwendet.
import {
  FASSUNG_INHALT_FELDER,
  FASSUNG_ZUORDNUNG_FELDER,
  entferneStorageObjekte,
  inhaltFelder,
  kopiereBild,
  kopiereDiagrammVon,
  teamOrdner,
  userOrdner,
  type BildOrdner,
} from "@/lib/fassung";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Wohin kopiert wird. Der Diskriminator bestimmt Eigentum, Sichtbarkeit und
 *  den Storage-Ordner der Bildkopien in einem Zug.
 *
 *  Für Vorlagen gibt es bewusst KEINE eigene Art: eine Vorlage entsteht als
 *  persönliche Kopie und wird erst danach freigegeben. Grund ist die RLS —
 *  Fassungen lassen sich nur in ein privates Training einfügen, weil eine
 *  öffentliche Vorlage eingefroren ist. */
export type KopieZiel =
  /** Zu mir übernehmen, eine Vorlage übernehmen, Vorlage vorbereiten. */
  | { art: "persoenlich"; ownerId: string }
  /** Ins Team stellen bzw. je Termin ansetzen — Eigentum des Teams. */
  | { art: "team"; teamId: string };

export type KopieErgebnis =
  | { ok: true; neueId: string }
  | { ok: false; error: string };

/** Die Felder einer Fassung, die in die Kopie übergehen: die Zuordnung
 *  (Einordnung, Reihenfolge, Dauer, Notiz), dazu Inhalt, Bild und Diagramm.
 *
 *  Beide Feldmengen kommen aus denselben Konstanten wie das Kopieren selbst
 *  (`FASSUNG_ZUORDNUNG_FELDER`, `FASSUNG_INHALT_FELDER`). Eine handgepflegte
 *  Zweitliste liess hier zuvor `spielfeld_laenge_m`, `spielfeld_breite_m` und
 *  `uebungstyp` still wegfallen: gelesen wurde nicht, was kopiert wird, und die
 *  Kopie verlor die Angaben wortlos. Die `notiz` (#152) wäre der nächste
 *  Kandidat dafür gewesen. */
const FASSUNG_SELECT = [
  "id",
  ...FASSUNG_ZUORDNUNG_FELDER,
  ...FASSUNG_INHALT_FELDER,
  "bild_url",
  "diagramm",
].join(", ");

type QuellFassung = {
  id: string;
  /** Die Variante des Hauptteils in der QUELLE; `null` ausserhalb. Sie muss
   *  beim Kopieren auf die Variante der Kopie umgeschrieben werden (#205). */
  variante_id: string | null;
  bild_url: string | null;
  diagramm: unknown;
} & Record<string, unknown>;

/** Die Zuordnungsfelder einer Quelle übernehmen — das Gegenstück zu
 *  `inhaltFelder`, aus demselben Grund: eine Quelle für die Feldmenge, damit
 *  ein neues Zuordnungsfeld nicht gelesen-aber-nicht-geschrieben endet. */
function zuordnungFelder(quelle: QuellFassung): Record<string, unknown> {
  return Object.fromEntries(FASSUNG_ZUORDNUNG_FELDER.map((f) => [f, quelle[f]]));
}

/** Eigentum, Sichtbarkeit und Bild-Ordner des Ziels — an einer Stelle, damit
 *  eine neue Kopier-Art nicht an zwei Orten nachgezogen werden muss. */
function zielFelder(ziel: KopieZiel): {
  spalten: { owner_id: string | null; team_id: string | null; visibility: "public" | "private" };
  ordner: BildOrdner;
} {
  switch (ziel.art) {
    case "team":
      return {
        spalten: { owner_id: null, team_id: ziel.teamId, visibility: "private" },
        ordner: teamOrdner(ziel.teamId),
      };
    case "persoenlich":
      return {
        spalten: { owner_id: ziel.ownerId, team_id: null, visibility: "private" },
        ordner: userOrdner(ziel.ownerId),
      };
  }
}

/** Kopiert ein ganzes Training samt aller Übungs-Fassungen mit eigenen Bild-
 *  und Diagrammkopien, samt seinen Gruppen und deren Verteilung im Hauptteil
 *  und samt allen Varianten des Hauptteils (#205).
 *
 *  Die Kopie ist dasselbe Training an einem anderen Ort: Wer sie öffnet, findet
 *  dieselben Gruppen, dieselben Wechsel und dieselben Notizen vor und muss die
 *  Verteilung nicht ein zweites Mal eintragen (#155 AK 1).
 *
 *  Die Kopie hält nicht fest, woraus sie entstanden ist: Sie ist ab dem ersten
 *  Moment eigenständig und frei änderbar, und ein Vermerk darauf, dass sie
 *  einmal aus etwas anderem hervorging, sagte darüber nichts Brauchbares.
 *
 *  Bei einem Fehler werden bereits kopierte Bilder und die halbe Kopie wieder
 *  entfernt — es bleibt nie eine Teilkopie zurück. */
export async function kopiereTraining(
  supabase: SupabaseClient,
  quelleId: string,
  ziel: KopieZiel,
): Promise<KopieErgebnis> {
  const { spalten, ordner } = zielFelder(ziel);

  // Quelle lesen — die RLS lässt nur durch, was der Handelnde sehen darf.
  const { data: quelle } = await supabase
    .from("trainings")
    .select("id, name, altersstufe, stufen")
    .eq("id", quelleId)
    .maybeSingle();
  if (!quelle) return { ok: false, error: "Das Training ist nicht (mehr) verfügbar." };

  const { data: quellFassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select(FASSUNG_SELECT)
    .eq("training_id", quelleId);
  // Übersetzt statt roh: Auch ein Lesefehler landet als Meldung beim Trainer,
  // und ein Postgres-Text nennt dort Tabellen statt eines Wegs (Issue #41).
  if (leseFehler) return { ok: false, error: fehlerMeldung(leseFehler.message) };

  // Die Varianten des Hauptteils, in der Reihenfolge des Originals (#205 AK 1).
  // Vor dem Insert des Ziels gelesen: Scheitert die Abfrage, entsteht gar keine
  // halbe Kopie.
  const { data: quellVarianten, error: variantenLeseFehler } = await supabase
    .from("training_varianten")
    .select("id, name, position")
    .eq("training_id", quelleId)
    .order("position")
    .order("id");
  if (variantenLeseFehler)
    return { ok: false, error: fehlerMeldung(variantenLeseFehler.message) };

  const { data: neu, error: insertFehler } = await supabase
    .from("trainings")
    .insert({
      name: quelle.name,
      // Die Altersstufe wandert mit: Sie steht ab dem Anlegen fest, auch für
      // eine Kopie — Trainingsteile, Gliederung und Übungsbestand der Kopie
      // sind dieselben wie die des Originals (Story 1, Übungswelten).
      altersstufe: quelle.altersstufe,
      stufen: quelle.stufen ?? [],
      ...spalten,
    })
    .select("id")
    .single();
  // Übersetzt statt roh: Stammt die Quelle noch aus der Zeit vor der
  // Kategorie-Pflicht, weist der Trigger `trainings_stufe_pflicht` die Kopie mit
  // dem Marker `STUFE_FEHLT` ab — den läse sonst der Trainer.
  if (insertFehler || !neu)
    return {
      ok: false,
      error: insertFehler
        ? fehlerMeldung(insertFehler.message)
        : "Kopieren fehlgeschlagen.",
    };

  // Ab hier kann eine Teilkopie entstehen: jeder weitere Fehlerpfad räumt die
  // bereits erzeugten Bilddateien und das Ziel-Training wieder ab.
  const kopierteBilder: string[] = [];
  const abbrechen = async (fehler: string): Promise<KopieErgebnis> => {
    await entferneStorageObjekte(supabase, kopierteBilder);
    await supabase.from("trainings").delete().eq("id", neu.id);
    return { ok: false, error: fehler };
  };

  // Die Varianten zuerst: Jede Hauptteil-Fassung zeigt auf eine, und der
  // Trigger `te_variante_ausrichten` weist eine Fassung ab, deren Variante
  // nicht zum Ziel-Training gehört.
  //
  // Das Ziel-Training hat bereits eine Variante — der Trigger
  // `trainings_erste_variante` legt sie beim Insert an. Sie wird zur ersten
  // Quell-Variante umgeschrieben, statt sie zu löschen und neu anzulegen: Ein
  // Training ohne Variante gibt es zwischendurch nicht (`tv_letzte_bleibt`).
  //
  // Die Positionen werden neu von 0 an durchnummeriert. Die Quelle kann Lücken
  // haben (`entferne_variante` schliesst sie nicht), und die Kopie soll nicht
  // erben, was in der Quelle bloss Geschichte ist — die REIHENFOLGE wandert
  // mit, nicht die Zahl.
  const varianteMap = new Map<string, string>();
  const varianten = quellVarianten ?? [];
  if (varianten.length > 0) {
    const { data: auto, error: autoFehler } = await supabase
      .from("training_varianten")
      .select("id")
      .eq("training_id", neu.id)
      .maybeSingle();
    if (autoFehler) return abbrechen(fehlerMeldung(autoFehler.message));
    if (!auto) return abbrechen("Die Varianten des Hauptteils liessen sich nicht kopieren.");

    const { error } = await supabase
      .from("training_varianten")
      .update({ name: varianten[0].name, position: 0 })
      .eq("id", auto.id);
    if (error) return abbrechen(fehlerMeldung(error.message));
    varianteMap.set(varianten[0].id, auto.id);

    const weitere = varianten.slice(1).map((v, i) => ({
      id: crypto.randomUUID(),
      training_id: neu.id,
      name: v.name,
      position: i + 1,
    }));
    weitere.forEach((z, i) => varianteMap.set(varianten[i + 1].id, z.id));
    if (weitere.length > 0) {
      const { error: weitereFehler } = await supabase
        .from("training_varianten")
        .insert(weitere);
      if (weitereFehler) return abbrechen(fehlerMeldung(weitereFehler.message));
    }
  }

  // Gruppen als Nächstes, dann die Fassungen, dann die Zuweisungen: Diese Reihenfolge
  // ist Pflicht, weil `teg_guard` bei jeder Zuweisung nachschlägt, ob Gruppe und
  // Fassung zum selben Training gehören und die Fassung im Hauptteil liegt —
  // beide Seiten müssen dafür schon in der Kopie stehen.
  const { data: quellGruppen, error: gruppenLeseFehler } = await supabase
    .from("training_gruppen")
    .select("id, name, position")
    .eq("training_id", quelleId)
    // Dieselbe Ordnung wie in der Anzeige (`mapTraining`): die vom Trainer
    // gesetzte Position, die ID entscheidet den Gleichstand.
    .order("position")
    .order("id");
  if (gruppenLeseFehler) return abbrechen(fehlerMeldung(gruppenLeseFehler.message));

  // Von der alten auf die neue Gruppen-ID: die Zuweisungen weiter unten reden
  // noch in den IDs der Quelle.
  const gruppenMap = new Map<string, string>();
  const gruppen = quellGruppen ?? [];
  if (gruppen.length > 0) {
    const neueIds = gruppen.map(() => crypto.randomUUID());
    gruppen.forEach((g, i) => gruppenMap.set(g.id, neueIds[i]));

    // Die Position wandert mit (#209): Sie IST die Anzeigereihenfolge, und der
    // Trigger `tg_position_setzen` lässt eine mitgegebene Angabe stehen. Bis
    // #209 musste die Ordnung über `created_at` und sortierte neue UUIDs
    // nachgebaut werden — das entfällt.
    const { error } = await supabase.from("training_gruppen").insert(
      gruppen.map((g, i) => ({
        id: neueIds[i],
        training_id: neu.id,
        name: g.name,
        position: g.position,
      })),
    );
    if (error) return abbrechen(fehlerMeldung(error.message));
  }

  // Die IDs entstehen vorab: sie benennen die Bildkopien, die vor dem Insert
  // liegen müssen (der Pfad steht dann bereits in bild_url).
  const fassungen = (quellFassungen ?? []) as unknown as QuellFassung[];
  const bilder = await Promise.all(
    fassungen.map(async (f) => {
      const neueId = crypto.randomUUID();
      return { quelle: f, neueId, bild: await kopiereBild(supabase, f.bild_url, ordner, neueId) };
    }),
  );

  for (const { bild } of bilder) if (bild.pfad) kopierteBilder.push(bild.pfad);
  const bildFehler = bilder.find((b) => b.bild.error);
  if (bildFehler) return abbrechen(bildFehler.bild.error!);

  // Jede Hauptteil-Fassung muss ihre Variante in der Kopie wiederfinden. Fehlt
  // eine, hat sich die Quelle zwischen den beiden Abfragen geändert — dann
  // bewusst der Abbruch statt eines stillen Rückfalls auf die erste Variante
  // (dieselbe Haltung wie bei der Gruppenverteilung weiter unten): Eine Kopie,
  // in der Übungen in der falschen Zusammenstellung stehen, sähe vollständig
  // aus und wäre es nicht.
  const ohneVariante = bilder.find(
    ({ quelle: f }) => f.variante_id && !varianteMap.has(f.variante_id),
  );
  if (ohneVariante)
    return abbrechen("Die Varianten des Hauptteils liessen sich nicht vollständig kopieren.");

  if (bilder.length > 0) {
    const { error } = await supabase.from("training_exercises").insert(
      bilder.map(({ quelle: f, neueId, bild }) => ({
        id: neueId,
        training_id: neu.id,
        ...zuordnungFelder(f),
        // NACH dem Spread: `variante_id` steht in den Zuordnungsfeldern und
        // bezeichnete sonst eine Variante des QUELL-Trainings. `null` ist der
        // richtige Wert ausserhalb des Hauptteils — dort trägt schon die
        // Quelle keine.
        variante_id: f.variante_id ? (varianteMap.get(f.variante_id) ?? null) : null,
        // `altersstufe` steht bewusst nicht in den Zuordnungsfeldern: Der
        // Trigger `te_altersstufe_erben` setzt sie aus dem Ziel-Training.
        ...inhaltFelder(f),
        bild_url: bild.url,
        diagramm: kopiereDiagrammVon(f.diagramm),
      })),
    );
    if (error) return abbrechen(fehlerMeldung(error.message));
  }

  // Zuletzt die Verteilung: Gruppen und Fassungen der Kopie stehen jetzt, und
  // ohne Gruppen kann es keine Zuweisung geben — dann entfällt auch die Abfrage.
  if (gruppenMap.size > 0 && bilder.length > 0) {
    const { data: quellZuweisungen, error: zuweisungLeseFehler } = await supabase
      .from("training_exercise_gruppen")
      .select("training_exercise_id, gruppe_id, position")
      .in(
        "training_exercise_id",
        fassungen.map((f) => f.id),
      );
    if (zuweisungLeseFehler) return abbrechen(fehlerMeldung(zuweisungLeseFehler.message));

    const fassungMap = new Map(bilder.map(({ quelle: f, neueId }) => [f.id, neueId]));
    const zeilen: { training_exercise_id: string; gruppe_id: string; position: number }[] = [];
    for (const z of quellZuweisungen ?? []) {
      const fassung = fassungMap.get(z.training_exercise_id);
      const gruppe = gruppenMap.get(z.gruppe_id);
      // Beide Seiten müssen abgebildet sein: Zuweisung, Fassung und Gruppe
      // hängen an denselben Lese-Policies (`teg_select`/`tg_select`), eine
      // Lücke kann es also nur bei einer nebenläufigen Änderung an der Quelle
      // geben. Eine Zuweisung an einer Fassung ausserhalb des Hauptteils ist
      // ohnehin konstruktiv ausgeschlossen (`te_gruppen_raeumen`). Trotzdem
      // bewusst der Abbruch statt eines stillen Filters: Eine Kopie mit halber
      // Verteilung sähe vollständig aus und wäre es nicht.
      if (!fassung || !gruppe)
        return abbrechen("Die Gruppenverteilung liess sich nicht vollständig kopieren.");
      // `position` ist der Wechsel — sie wandert unverändert mit, sonst liefe
      // die Kopie in einer anderen Reihenfolge durch als das Original.
      zeilen.push({ training_exercise_id: fassung, gruppe_id: gruppe, position: z.position });
    }

    if (zeilen.length > 0) {
      // Ein Insert für alle Zuweisungen: weniger Runden, und ein Fehler trifft
      // die Kopie als Ganzes statt sie halb gefüllt stehen zu lassen.
      const { error } = await supabase.from("training_exercise_gruppen").insert(zeilen);
      // Übersetzt statt roh: `teg_guard` meldet sich mit den Markern
      // `GRUPPE_NUR_HAUPTTEIL`/`GRUPPE_FREMDES_TRAINING`.
      if (error) return abbrechen(fehlerMeldung(error.message));
    }
  }

  return { ok: true, neueId: neu.id };
}
