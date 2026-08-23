"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import { parseDiagramm, kopiereDiagramm, MAX_ELEMENTE, type DiagrammData } from "@/lib/diagramm";
import { fassungBildPfad, fassungUnvollstaendig, dateiendung, stempleHerkunft } from "@/lib/fassung";
import { userSlug } from "@/lib/slug";
import { TRAININGSTEIL_SLUGS } from "@/lib/training";
import { hauptteilkategorieSlugs, type TrainingsteilSlug } from "@/lib/vocab";

export type SaveFassungResult = { ok: true } | { ok: false; error: string };

/** Alle Ansichten eines Trainings nach einer Änderung an einer Fassung neu
 *  validieren — eine Quelle für alle Fassungs-Mutationen. */
function revalidiereTraining(trainingId: string, fassungId?: string) {
  revalidatePath(`/training/${trainingId}/edit`);
  revalidatePath(`/training/${trainingId}`);
  revalidatePath(`/training/${trainingId}/durchfuehren`);
  revalidatePath(`/training/${trainingId}/druck`);
  if (fassungId) {
    revalidatePath(`/training/${trainingId}/uebung/${fassungId}/edit`);
    revalidatePath(`/training/${trainingId}/uebung/${fassungId}/diagramm`);
  }
}

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
      "id, training_id, trainingsteil, hauptteilkategorie, position, bild_url, bild_quelle, diagramm, trainings ( owner_id )",
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!data) return null;
  const owner = (data.trainings as unknown as { owner_id: string | null } | null)?.owner_id;
  return owner === userId ? data : null;
}

/** Die nächste freie Position im Zielabschnitt. Eine umgeordnete Fassung reiht
 *  sich am Ende ein (Story 5 AK 7). */
async function naechstePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  trainingsteil: string,
  hauptteilkategorie: string | null,
  eigeneId: string,
): Promise<number> {
  let q = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil)
    .neq("id", eigeneId);
  q = hauptteilkategorie ? q.eq("hauptteilkategorie", hauptteilkategorie) : q;
  const { data } = await q.order("position", { ascending: false }).limit(1).maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** Eine Fassung im Training bearbeiten (Story 5).
 *
 *  Es gelten dieselben Inhalts- und Vollständigkeitsregeln wie für eine
 *  Bibliotheks-Übung (NFR 1) — deshalb dieselbe Parse-Funktion. Geschrieben wird
 *  ausschliesslich an dieser Fassung; die Vorlage und andere Fassungen bleiben
 *  unberührt. Die Herkunftsangabe wird nie mitgeschrieben (der DB-Trigger
 *  sichert das zusätzlich ab). */
export async function updateFassung(
  fassungId: string,
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

  const parsed = parseUebungsInhalt(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const inhalt = parsed.row;

  const trainingsteil = String(inhalt.trainingsteil);
  if (!TRAININGSTEIL_SLUGS.includes(trainingsteil as TrainingsteilSlug))
    return { status: "error", errors: { trainingsteil: "Bitte einen Trainingsteil wählen." } };
  const hkat = (inhalt.hauptteilkategorie as string | null) ?? null;
  if (hkat && !hauptteilkategorieSlugs.includes(hkat as never))
    return { status: "error", errors: { hauptteilkategorie: "Ungültige Kategorie." } };

  const update: Record<string, unknown> = { ...inhalt };

  // Einordnungswechsel: die Fassung wandert ans Ende ihres neuen Abschnitts.
  // Die Kategorie ausserhalb des Hauptteils leert der DB-Trigger.
  const wechsel =
    trainingsteil !== fassung.trainingsteil || hkat !== fassung.hauptteilkategorie;
  if (wechsel) {
    update.position = await naechstePosition(
      supabase,
      fassung.training_id,
      trainingsteil,
      trainingsteil === "hauptteil" ? hkat : null,
      fassungId,
    );
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
    neuPfad = `user/${user.id}/${fassungId}.${STORED_IMAGE_TYPES[datei.type]}`;
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

  // Sichtbarkeit vorher merken: leert ein Einordnungswechsel die Einleitung
  // oder den Hauptteil, setzt die bestehende DB-Regel das Training auf privat
  // (Story 5 PC 3). Der USER erfährt das über den Hinweis im Editor.
  const { data: vorher } = await supabase
    .from("trainings")
    .select("visibility")
    .eq("id", fassung.training_id)
    .maybeSingle();

  const { error } = await supabase
    .from("training_exercises")
    .update(update)
    .eq("id", fassungId);

  if (error) {
    // Ein soeben hochgeladenes Bild wieder entfernen — ausser es hat den
    // weiterhin referenzierten alten Pfad überschrieben.
    if (neuPfad && neuPfad !== altPfad)
      await supabase.storage.from(STORAGE_BUCKET).remove([neuPfad]);
    return { status: "error", message: error.message };
  }

  // Erfolg: die alte Datei entfernen, wenn sie nicht mehr referenziert wird.
  if (altPfad && altPfad !== neuPfad && (neuesBild || entfernen))
    await supabase.storage.from(STORAGE_BUCKET).remove([altPfad]);

  const { data: nachher } = await supabase
    .from("trainings")
    .select("visibility")
    .eq("id", fassung.training_id)
    .maybeSingle();
  const wurdePrivat =
    vorher?.visibility === "public" && nachher?.visibility === "private";

  revalidiereTraining(fassung.training_id, fassungId);
  redirect(
    `/training/${fassung.training_id}/edit?bearbeitet=1${wurdePrivat ? "&privat=1" : ""}`,
  );
}

/** Eine Fassung als eigene, zunächst private Vorlage in die Bibliothek
 *  übernehmen (Story 7).
 *
 *  Zulässig ist jede für den USER sichtbare Fassung — auch aus einem fremden
 *  öffentlichen Training. Es entsteht eine gewöhnliche Trainer-Übung mit eigener
 *  Bild- und Diagrammkopie; eine Verknüpfung zur Fassung gibt es nicht, spätere
 *  Änderungen wirken in keine Richtung. Die Herkunft der Fassung wird
 *  unverändert übertragen, sodass die ursprüngliche Quelle auch an späteren
 *  Fassungen dieser Vorlage stehen bleibt. */
export async function uebernehmeInBibliothek(
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
    .select(
      `name, trainingsteil, hauptteilkategorie, kategorien, erscheinungsform, feldtyp,
       anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten,
       bild_url, bild_quelle, diagramm, herkunft_name, herkunft_typ, herkunft_datum`,
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!f) return { ok: false, error: "Diese Übung ist nicht mehr verfügbar." };

  const mangel = fassungUnvollstaendig(f);
  if (mangel) return { ok: false, error: mangel };

  // ID vorab: sie benennt die Bildkopie, die vor dem Insert liegen muss.
  const uebungId = crypto.randomUUID();
  const quellPfad = bildUrlToPath(f.bild_url);
  let bildUrl: string | null = null;
  let zielPfad: string | null = null;
  if (quellPfad) {
    zielPfad = `user/${user.id}/${uebungId}.${dateiendung(quellPfad)}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).copy(quellPfad, zielPfad);
    if (error) return { ok: false, error: `Bildkopie fehlgeschlagen: ${error.message}` };
    bildUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(zielPfad).data.publicUrl;
  }

  const quellDiagramm = parseDiagramm(f.diagramm);
  const { data: angelegt, error } = await supabase
    .from("exercises")
    .insert({
      id: uebungId,
      slug: userSlug(f.name!),
      name: f.name,
      trainingsteil: f.trainingsteil,
      hauptteilkategorie: f.hauptteilkategorie,
      kategorien: f.kategorien,
      erscheinungsform: f.erscheinungsform,
      feldtyp: f.feldtyp,
      anzahl_kinder: f.anzahl_kinder,
      material: f.material,
      methodischer_fahrplan: f.methodischer_fahrplan,
      aufbau: f.aufbau,
      varianten: f.varianten,
      bild_url: bildUrl,
      bild_quelle: f.bild_quelle,
      diagramm:
        quellDiagramm && quellDiagramm.elemente.length > 0
          ? kopiereDiagramm(quellDiagramm)
          : null,
      source: "user",
      owner_id: user.id,
      // Zunächst privat (PO-Entscheid): veröffentlicht wird bewusst separat.
      visibility: "private",
      // Herkunft unverändert weitergeben — die ursprüngliche Quelle bleibt.
      ...stempleHerkunft(f, user.id),
    })
    .select("slug")
    .single();

  if (error || !angelegt) {
    if (zielPfad) await supabase.storage.from(STORAGE_BUCKET).remove([zielPfad]);
    return { ok: false, error: error?.message ?? "Übernehmen fehlgeschlagen." };
  }

  revalidatePath("/");
  return { ok: true, slug: angelegt.slug };
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
