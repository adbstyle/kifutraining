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
  stempleHerkunft,
  kopiereBild,
  userOrdner,
  kopiereDiagrammVon,
  entferneStorageObjekt,
  inhaltFelder,
  istEigeneFassungsDatei,
} from "@/lib/fassung";
import { revalidiereTraining } from "@/lib/revalidate";
import { userSlug } from "@/lib/slug";
import { bildOrdnerFuer, type Bearbeitungsziel } from "@/lib/training-zugriff";

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
      "id, training_id, trainingsteil, hauptteilkategorie, position, bild_url, bild_quelle, diagramm, trainings ( owner_id, team_id, visibility )",
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!data) return null;
  const training = data.trainings as unknown as {
    owner_id: string | null;
    team_id: string | null;
    visibility: string;
  } | null;
  if (!training) return null;

  // Bearbeitbar ist das eigene PRIVATE Training oder eines des eigenen Teams
  // (Story 6). Eine veröffentlichte Vorlage ist eingefroren, auch für ihren
  // Urheber (Story 14). Team-Trainings kommen ohnehin nur bei Mitgliedern aus
  // der Abfrage zurück — dafür sorgt die SELECT-Policy.
  const ziel: Bearbeitungsziel | null = training.team_id
    ? { art: "team", teamId: training.team_id }
    : training.owner_id === userId && training.visibility === "private"
      ? { art: "persoenlich", ownerId: userId }
      : null;
  return ziel ? { ...data, ziel } : null;
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

  // Trainingsteil und Kategorie hat parseUebungsInhalt bereits gegen das
  // Vokabular geprüft — hier nur noch als Werte gebraucht.
  const trainingsteil = String(inhalt.trainingsteil);
  const hkat = (inhalt.hauptteilkategorie as string | null) ?? null;

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
    return { status: "error", message: error.message };
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
  redirect(`/training/${fassung.training_id}/edit?bearbeitet=1`);
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

  // Fassungen tragen kein `source` — der vollständige Herkunfts-Stempel ist
  // hier die einzige legale Eingabe für stempleHerkunft (die sonst wirft).
  // Sauber abweisen statt mit rohem Fehler abzubrechen.
  if (!(f.herkunft_name && f.herkunft_typ && f.herkunft_datum))
    return {
      ok: false,
      error:
        "Diese Übung trägt noch keine Herkunftsangabe und kann im Moment nicht übernommen werden. Bitte später erneut versuchen.",
    };

  // ID vorab: sie benennt die Bildkopie, die vor dem Insert liegen muss.
  const uebungId = crypto.randomUUID();
  const bild = await kopiereBild(supabase, f.bild_url, userOrdner(user.id), uebungId);
  if (bild.error) return { ok: false, error: bild.error };

  const { data: angelegt, error } = await supabase
    .from("exercises")
    .insert({
      id: uebungId,
      slug: userSlug(f.name!),
      trainingsteil: f.trainingsteil,
      hauptteilkategorie: f.hauptteilkategorie,
      ...inhaltFelder(f),
      bild_url: bild.url,
      diagramm: kopiereDiagrammVon(f.diagramm),
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
    await entferneStorageObjekt(supabase, bild.pfad);
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
