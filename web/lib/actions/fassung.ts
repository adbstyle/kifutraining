"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import { parseDiagramm, MAX_ELEMENTE, type DiagrammData } from "@/lib/diagramm";
import {
  fassungUnvollstaendig,
  istEigeneFassungsDatei,
  legeUebungsKopieAn,
  FASSUNG_KOPIE_SELECT,
} from "@/lib/fassung";
import { revalidiereTraining } from "@/lib/revalidate";
import { alsAltersstufe } from "@/lib/altersstufe";
import { teilTraegtDauer } from "@/lib/training";
import { bearbeitungszielVon, bildOrdnerFuer } from "@/lib/training-zugriff";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import { istHauptteil } from "@/lib/gruppen";
import { varianteAnhang } from "@/lib/varianten";

export type SaveFassungResult = { ok: true } | { ok: false; error: string };

/** Die Fassung samt ihrem Training laden und das Schreibrecht prüfen. Die RLS
 *  setzt es ohnehin durch; hier geht es um eine klare Meldung statt eines
 *  stillen Nulltreffers. */
async function ladeFassung(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fassungId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("training_exercises")
    .select(
      "id, training_id, trainingsteil, hauptteilkategorie, variante_id, position, bild_url, bild_quelle, diagramm, trainings ( owner_id, team_id, altersstufe )",
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!data) return null;
  const training = data.trainings as unknown as {
    owner_id: string | null;
    team_id: string | null;
    altersstufe: string | null;
  } | null;
  if (!training) return null;

  // Die Zeile ist bereits geladen — die Bearbeitungsregel kommt aus der
  // gemeinsamen Quelle, statt sie hier ein zweites Mal zu formulieren.
  const ziel = bearbeitungszielVon(training, userId);
  if (!ziel) return null;
  return {
    ...data,
    ziel,
    // Die Fassung folgt der Altersstufe ihres Trainings — sie hat keine eigene
    // (Story 1). Der Rückfall ist bloss der Typ-Guard: die Spalte ist NOT NULL.
    altersstufe: alsAltersstufe(training.altersstufe),
  };
}

/** Die nächste freie Position im Zielabschnitt. Eine umgeordnete Fassung reiht
 *  sich am Ende ein (Story 5 AK 7).
 *
 *  Im Hauptteil zählt der Abschnitt je VARIANTE (#201): Dieselbe Position
 *  existiert dort mehrfach, einmal je Zusammenstellung. Der Filter hängt an der
 *  Einordnung und nicht an `hauptteilkategorie` — die Junioren-Hauptteilblöcke
 *  tragen keine Unterkategorie und führen trotzdem Varianten. */
async function naechstePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  trainingsteil: string,
  hauptteilkategorie: string | null,
  varianteId: string | null,
  eigeneId: string,
): Promise<number> {
  let q = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil)
    .neq("id", eigeneId);
  q = hauptteilkategorie ? q.eq("hauptteilkategorie", hauptteilkategorie) : q;
  q = istHauptteil(trainingsteil) && varianteId ? q.eq("variante_id", varianteId) : q;
  const { data } = await q.order("position", { ascending: false }).limit(1).maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** Eine Fassung im Training bearbeiten (Story 5).
 *
 *  Es gelten dieselben Inhalts- und Vollständigkeitsregeln wie für eine
 *  Bibliotheks-Übung (NFR 1) — deshalb dieselbe Parse-Funktion. Geschrieben wird
 *  ausschliesslich an dieser Fassung; die Vorlage und andere Fassungen bleiben
 *  unberührt. */
export async function updateFassung(
  fassungId: string,
  /** Die Variante, aus der heraus die Fassung geöffnet wurde (#201). Sie ist
   *  gebunden, nicht aus dem Formular gelesen: Die Bearbeitungsseite ist eine
   *  Server-Seite und kennt den Suchparameter, das Formular dagegen wird an
   *  vielen Stellen gebaut. Gebraucht wird sie nur in EINEM Fall — wenn die
   *  Fassung von ausserhalb in den Hauptteil wandert und deshalb erstmals eine
   *  Variante braucht. */
  variante: string | undefined,
  _prev: ExerciseFormState,
  form: FormData,
): Promise<ExerciseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const fassung = await ladeFassung(supabase, fassungId, user.id);
  if (!fassung) return { status: "error", message: "Übung nicht gefunden." };

  // Eine Fassung wird nach den Einordnungen der Altersstufe IHRES Trainings
  // eingeordnet — dieselbe Menge, die auch eine Bibliotheks-Übung dieser Stufe
  // kennt. Eine eigene Optionsliste braucht es dafür nicht mehr: seit der
  // Trennung der Altersstufen sind Übung und Fassung an denselben sieben bzw.
  // vier Werten zuhause.
  const parsed = parseUebungsInhalt(form, { altersstufe: fassung.altersstufe });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  // Die Altersstufe der Fassung setzt der DB-Trigger `te_altersstufe_erben`
  // aus ihrem Training; die Applikation schreibt die Spalte nie selbst.
  const { altersstufe: _geerbt, ...inhalt } = parsed.row;

  // Trainingsteil und Kategorie hat parseUebungsInhalt bereits gegen das
  // Vokabular geprüft — hier nur noch als Werte gebraucht.
  const trainingsteil = String(inhalt.trainingsteil);
  const hkat = (inhalt.hauptteilkategorie as string | null) ?? null;

  const update: Record<string, unknown> = { ...inhalt };

  // Einordnungswechsel: die Fassung wandert ans Ende ihres neuen Abschnitts.
  // Die Kategorie ausserhalb des Hauptteils ist in `inhalt` bereits null —
  // einen DB-Trigger, der das erzwänge, gibt es seit dem Verweis-Abbau nicht
  // mehr, nur noch den Biconditional-CHECK.
  //
  // Die Variante gehört zum Zielabschnitt: Kommt die Fassung von AUSSERHALB in
  // den Hauptteil, braucht sie erstmals eine — die der Trainer gerade offen
  // hatte. Innerhalb des Hauptteils bleibt sie, wo sie ist (ein Wechsel
  // zwischen den Junioren-Blöcken oder den Unterkategorien verlässt die
  // Zusammenstellung nicht), und beim Verlassen nullt sie der Trigger
  // `te_variante_ausrichten`. Ohne Parameter greift dessen Regel «die erste»;
  // die Position wird dann über alle Varianten hinweg bestimmt und fällt
  // höchstens zu gross aus — nie auf eine belegte.
  const kamAusHauptteil = istHauptteil(fassung.trainingsteil);
  const gehtInHauptteil = istHauptteil(trainingsteil);
  const neueVariante =
    !kamAusHauptteil && gehtInHauptteil && variante ? variante : fassung.variante_id;
  if (!kamAusHauptteil && gehtInHauptteil && variante) update.variante_id = variante;

  const wechsel =
    trainingsteil !== fassung.trainingsteil ||
    hkat !== fassung.hauptteilkategorie ||
    neueVariante !== fassung.variante_id;
  if (wechsel) {
    update.position = await naechstePosition(
      supabase,
      fassung.training_id,
      trainingsteil,
      trainingsteil === "hauptteil" ? hkat : null,
      gehtInHauptteil ? neueVariante : null,
      fassungId,
    );
    // Wandert die Fassung in ein Auffangen, entfällt ihre Dauer — sie zählt
    // dort nicht zur Trainingszeit. Ohne dieses Leeren liefe das UPDATE in den
    // CHECK `dauer_nicht_auffangen`.
    if (!teilTraegtDauer(trainingsteil)) update.duration_min = null;
  }

  // Bild: ersetzen (neue Datei) oder entfernen (Schalter). Beides wirkt erst
  // beim Speichern; die alte Datei fällt erst nach erfolgreichem Schreiben.
  const datei = form.get("bild");
  const neuesBild = datei instanceof File && datei.size > 0;
  const entfernen = String(form.get("bild_entfernen") ?? "") === "1";
  const altPfad = bildUrlToPath(fassung.bild_url);
  let neuPfad: string | null = null;


  if (neuesBild) {
    const invalid = storedImageError(datei.type, datei.size);
    if (invalid) return { status: "error", errors: { bild: invalid } };
    // Bei Team-Trainings in den Team-Ordner, damit jedes Mitglied das Bild
    // ersetzen darf (Story 6 NFR 2). Dateiname = Fassungs-ID, wie überall.
    neuPfad = `${bildOrdnerFuer(fassung.ziel)}/${fassungId}.${STORED_IMAGE_TYPES[datei.type]}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(neuPfad, new Uint8Array(await datei.arrayBuffer()), {
        contentType: datei.type,
        upsert: true,
      });
    if (error) return { status: "error", errors: { bild: error.message } };
    update.bild_url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(neuPfad).data.publicUrl;
    update.bild_quelle = "foto";
  } else if (entfernen) {
    update.bild_url = null;
    // Ohne Foto kann die Anzeige nicht mehr darauf zeigen; ein vorhandenes
    // Diagramm wird zum aktiven Bild.
    update.bild_quelle = fassung.diagramm ? "diagramm" : null;
  }

  const { error } = await supabase
    .from("training_exercises")
    .update(update)
    .eq("id", fassungId);

  if (error) {
    // Ein soeben hochgeladenes Bild wieder entfernen — ausser es hat den
    // weiterhin referenzierten alten Pfad überschrieben.
    if (neuPfad && neuPfad !== altPfad)
      await supabase.storage.from(STORAGE_BUCKET).remove([neuPfad]);
    // Wechselt die Einordnung so, dass ein öffentliches Training seine
    // Bedingungen verlöre, weist die Datenebene ab; die Meldung nennt den Weg
    // über den Entwurfszustand (Story A AK 7).
    return { status: "error", message: fehlerMeldung(error.message) };
  }

  // Erfolg: die alte Datei entfernen, wenn sie nicht mehr referenziert wird —
  // aber nur die eigene Kopie der Fassung, nie eine fremde oder geteilte Datei.
  if (
    altPfad &&
    altPfad !== neuPfad &&
    (neuesBild || entfernen) &&
    istEigeneFassungsDatei(altPfad, fassungId)
  )
    await supabase.storage.from(STORAGE_BUCKET).remove([altPfad]);

  revalidiereTraining(fassung.training_id, fassungId);
  // Der Rückweg trägt die Variante mit: Sonst landete der Trainer nach dem
  // Speichern in der ersten Variante und suchte die eben bearbeitete Übung
  // (#201 AK 6). Massgebend ist, wo die Fassung jetzt LIEGT, nicht woher der
  // Aufruf kam — kommt sie ohne Suchparameter herein (ein Lesezeichen, ein
  // geteilter Link), führt ihre eigene Variante zurück. Ausserhalb des
  // Hauptteils ist beides leer und der Anhang entfällt.
  const zurueck = `/training/${fassung.training_id}/edit?bearbeitet=1`;
  redirect(`${zurueck}${varianteAnhang(variante ?? neueVariante ?? undefined, "&")}`);
}

/** Eine Fassung, wie sie fürs Kopieren in die Bibliothek gelesen wird
 *  (FASSUNG_KOPIE_SELECT). */
type ZuKopierendeFassung = {
  altersstufe: string | null;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  name: string | null;
  methodischer_fahrplan: {
    offen_starten?: string;
    ueben?: string[];
    wetteifern?: string | null;
  } | null;
  aufbau: string | null;
  bild_url: string | null;
  diagramm: unknown;
} & Record<string, unknown>;

/** Eine Fassung als eigene, zunächst private Vorlage in die Bibliothek
 *  kopieren (Story 7).
 *
 *  Zulässig ist jede für den USER sichtbare Fassung — auch aus einem fremden
 *  öffentlichen Training. Es entsteht eine gewöhnliche Trainer-Übung mit eigener
 *  Bild- und Diagrammkopie; eine Verknüpfung zur Fassung gibt es nicht, spätere
 *  Änderungen wirken in keine Richtung.
 *
 *  Der Name bleibt unverändert: Die Kopie-Kennzeichnung trägt nur die Kopie
 *  einer eigenen Bibliotheks-Übung (#171 OOS 5). */
export async function kopiereInBibliothek(
  fassungId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // RLS lässt Fassungen eigener und öffentlicher Trainings durch.
  const { data: f } = await supabase
    .from("training_exercises")
    .select(FASSUNG_KOPIE_SELECT)
    .eq("id", fassungId)
    .maybeSingle<ZuKopierendeFassung>();
  if (!f) return { ok: false, error: "Diese Übung ist nicht mehr verfügbar." };

  // Die Kopie behält die Altersstufe des Originals — und mit ihr Einordnung
  // und Ablaufform. Eine Rückabbildung zwischen den Schemata gibt es hier nicht
  // mehr: seit der Trennung der Altersstufen ist jeder Block, in dem eine
  // Fassung liegen kann, auch ein gültiger Ort einer Bibliotheks-Übung
  // derselben Stufe.
  const altersstufe = alsAltersstufe(f.altersstufe);

  const mangel = fassungUnvollstaendig({ ...f, altersstufe });
  if (mangel) return { ok: false, error: mangel };

  // Kopiert wird mit dem gemeinsamen Rumpf (`legeUebungsKopieAn`): Slug, Bild-
  // und Diagrammkopie, Eigentum und der private Anfangszustand sind dieselben
  // wie beim direkten Kopieren einer Bibliotheks-Übung.
  const kopie = await legeUebungsKopieAn(supabase, f, {
    ownerId: user.id,
    altersstufe,
  });
  if (!kopie.ok) return kopie;

  revalidatePath("/");
  return kopie;
}

/** Das Diagramm einer Fassung speichern — das Pendant zu `saveDiagramm` für
 *  Bibliotheks-Übungen, nur dass das Schreibrecht am Training hängt. */
export async function saveFassungDiagramm(
  fassungId: string,
  data: DiagrammData,
): Promise<SaveFassungResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const fassung = await ladeFassung(supabase, fassungId, user.id);
  if (!fassung) return { ok: false, error: "Übung nicht gefunden." };

  const diagramm = parseDiagramm(data);
  if (!diagramm || diagramm.elemente.length > MAX_ELEMENTE)
    return { ok: false, error: "Ungültiges Diagramm." };

  // bild_quelle konsistent mitführen: das erste Element macht das Diagramm zum
  // aktiven Bild; wird es geleert, fällt die Wahl zurück.
  const leer = diagramm.elemente.length === 0;
  const bild_quelle = leer
    ? fassung.bild_quelle === "diagramm"
      ? fassung.bild_url
        ? "foto"
        : null
      : fassung.bild_quelle
    : (fassung.bild_quelle ?? "diagramm");

  const { error } = await supabase
    .from("training_exercises")
    .update({ diagramm, bild_quelle })
    .eq("id", fassungId);
  if (error) return { ok: false, error: error.message };

  revalidiereTraining(fassung.training_id, fassungId);
  return { ok: true };
}
