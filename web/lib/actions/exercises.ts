"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userSlug } from "@/lib/slug";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { FAHRPLAN_TEILE } from "@/lib/labels";
import {
  trainingsteilSlugs,
  feldtypSlugs,
  erscheinungsformSlugs,
  hauptteilkategorieSlugs,
  kategorienSlugs,
} from "@/lib/vocab";

export type ExerciseFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Listen-Seiten, die nach Mutationen neu validiert werden. */
function revalidateLists() {
  revalidatePath("/");
}

function lines(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Komma-getrennte Mehrfachwerte (Chips schreiben ein einzelnes Hidden-Feld). */
function csv(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}


type ParseResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

/** Formular -> Übungs-Datensatz (ohne owner/visibility/slug) + Validierung.
 *  Wird von Erstellen UND Bearbeiten genutzt. */
function parseExercise(form: FormData): ParseResult {
  const errors: Record<string, string> = {};
  const name = clean(form.get("name"));
  const trainingsteil = clean(form.get("trainingsteil"));
  const kategorien = csv(form.get("kat"));

  if (!name) errors.name = "Bitte einen Namen angeben.";
  if (!trainingsteilSlugs.includes(trainingsteil as never))
    errors.trainingsteil = "Bitte einen Trainingsteil wählen.";
  if (kategorien.length === 0)
    errors.kat = "Bitte mindestens eine Alterskategorie wählen.";
  if (kategorien.some((k) => !kategorienSlugs.includes(k as never)))
    errors.kat = "Ungültige Alterskategorie.";

  const istFahrplan = FAHRPLAN_TEILE.has(trainingsteil);
  let methodischer_fahrplan: Record<string, unknown> | null = null;
  let aufbau: string | null = null;

  if (istFahrplan) {
    const offen = clean(form.get("offen_starten"));
    const ueben = lines(form.get("ueben"));
    const wett = clean(form.get("wetteifern"));
    if (!offen) errors.offen_starten = "Bitte beschreiben, wie die Übung offen startet.";
    if (ueben.length === 0)
      errors.ueben = "Bitte mindestens einen Übungsschritt angeben.";
    if (!wett) errors.wetteifern = "Bitte den Wett-eifern-Teil beschreiben.";
    methodischer_fahrplan = { offen_starten: offen, ueben, wetteifern: wett };
  } else if (trainingsteil) {
    aufbau = clean(form.get("aufbau"));
    if (!aufbau) errors.aufbau = "Bitte den Aufbau beschreiben.";
  }

  // Erscheinungsform nur bei Einleitung/Hauptteil
  const erscheinungsform = istFahrplan
    ? csv(form.get("form")).filter((f) => erscheinungsformSlugs.includes(f as never))
    : [];

  // Hauptteilkategorie ist genau bei Hauptteil-Übungen Pflicht (Enabler #21,
  // AC2); andere Trainingsteile tragen keine (Postcondition 2).
  const istHauptteil = trainingsteil === "hauptteil";
  const hauptteilkategorie = istHauptteil ? clean(form.get("hauptteilkategorie")) : null;
  if (istHauptteil && !hauptteilkategorieSlugs.includes(hauptteilkategorie as never))
    errors.hauptteilkategorie = "Bitte eine Hauptteilkategorie wählen.";

  const feldtyp = clean(form.get("feldtyp"));
  const min = clean(form.get("anzahl_min"));
  const max = clean(form.get("anzahl_max"));
  const anzahl_kinder =
    min || max
      ? { min: min ? Number(min) : null, max: max ? Number(max) : null }
      : null;
  if (min && max && Number(max) < Number(min))
    errors.anzahl_max = "Die Maximalanzahl darf nicht kleiner als die Mindestanzahl sein.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    row: {
      name,
      trainingsteil,
      kategorien,
      feldtyp: feldtyp && feldtypSlugs.includes(feldtyp as never) ? feldtyp : null,
      erscheinungsform,
      hauptteilkategorie,
      anzahl_kinder,
      material: lines(form.get("material")),
      methodischer_fahrplan,
      aufbau,
      varianten: lines(form.get("varianten")),
    },
  };
}

/** Storage-Objekt best-effort entfernen (no-op bei null). Eine Stelle für alle
 *  Lösch-/Rollback-Pfade, damit das Pfad-Handling nicht dupliziert wird. */
async function removeStorageObject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null,
) {
  if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

/** Optionales Feld-Diagramm validieren + in den Storage laden. Gibt public URL
 *  UND den geschriebenen Storage-Pfad zurück — letzteren brauchen die Aufrufer
 *  für Rollback/Cleanup, statt ihn fehleranfällig selbst zu rekonstruieren. */
async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  exerciseId: string,
  file: File,
): Promise<{ url?: string; path?: string; error?: string }> {
  // Server-seitige Trust-Boundary: prüft Format/Grösse VOR dem Storage-Write
  // und damit vor jedem DB-Insert/-Update (EK7). Einzige Server-Prüfstelle.
  const invalid = storedImageError(file.type, file.size);
  if (invalid) return { error: invalid };

  const path = `user/${ownerId}/${exerciseId}.${STORED_IMAGE_TYPES[file.type]}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (error) return { error: error.message };
  return {
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl,
    path,
  };
}

export async function createExercise(
  _prev: ExerciseFormState,
  form: FormData,
): Promise<ExerciseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const parsed = parseExercise(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const file = form.get("bild");
  const hasImage = file instanceof File && file.size > 0;

  // Id vorab erzeugen: Bild VOR dem Insert hochladen, danach EIN Insert mit
  // bild_url. Kein zweistufiges insert->update (kein Halb-Zustand, kein
  // Update-Fenster). Schlägt der Insert nach dem Upload fehl, bleibt höchstens
  // ein Bild-Waise zurück (Cron-Cleanup, Architektur §11).
  const id = crypto.randomUUID();
  const slug = userSlug(String(parsed.row.name));

  let bildUrl: string | null = null;
  let bildPfad: string | null = null;
  if (hasImage) {
    const { url, path, error: imgErr } = await uploadImage(supabase, user.id, id, file);
    if (imgErr) return { status: "error", errors: { bild: imgErr } };
    bildUrl = url ?? null;
    bildPfad = path ?? null;
  }

  const { data: inserted, error } = await supabase
    .from("exercises")
    .insert({
      ...parsed.row,
      id,
      slug,
      source: "user",
      owner_id: user.id,
      visibility: "private", // Entwurf (EK8)
      bild_url: bildUrl,
    })
    .select("slug")
    .single();

  if (error || !inserted) {
    await removeStorageObject(supabase, bildPfad);
    return { status: "error", message: error?.message ?? "Speichern fehlgeschlagen." };
  }

  revalidateLists();
  redirect(`/uebung/${inserted.slug}?created=1`);
}

/** Eigene Übung bearbeiten (Story 7 EK1). RLS stellt sicher, dass nur eigene
 *  Nutzer-Übungen aktualisiert werden. */
export async function updateExercise(
  id: string,
  _prev: ExerciseFormState,
  form: FormData,
): Promise<ExerciseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const parsed = parseExercise(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const file = form.get("bild");
  const hasImage = file instanceof File && file.size > 0;

  const update: Record<string, unknown> = { ...parsed.row };
  let altPfad: string | null = null;
  let neuPfad: string | null = null;
  if (hasImage) {
    // Alten Bildpfad merken: Erzeugt der Upload einen anderen Pfad (z. B.
    // Formatwechsel .png -> .webp), wird die alte Datei sonst zur Waise.
    const { data: alt } = await supabase
      .from("exercises")
      .select("bild_url")
      .eq("id", id)
      .eq("owner_id", user.id)
      .eq("source", "user")
      .maybeSingle();
    altPfad = bildUrlToPath(alt?.bild_url);

    const { url, path, error: imgErr } = await uploadImage(supabase, user.id, id, file);
    if (imgErr) return { status: "error", errors: { bild: imgErr } };
    update.bild_url = url ?? null;
    neuPfad = path ?? null;
  }

  const { data: updated, error } = await supabase
    .from("exercises")
    .update(update)
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();

  if (error || !updated) {
    // Upload war erfolgreich, DB-Update nicht: das neu hochgeladene Bild wieder
    // entfernen — ausser es hat den weiterhin referenzierten alten Pfad
    // überschrieben (gleicher Pfad), dann zeigt die DB korrekt darauf.
    if (neuPfad && neuPfad !== altPfad) await removeStorageObject(supabase, neuPfad);
    return { status: "error", message: error?.message ?? "Speichern fehlgeschlagen." };
  }

  // Erfolg: alte Bilddatei entfernen, wenn der Upload einen anderen Pfad erzeugt
  // hat (bei gleichem Pfad hat upsert sie bereits überschrieben).
  if (altPfad && altPfad !== neuPfad) await removeStorageObject(supabase, altPfad);

  revalidateLists();
  revalidatePath(`/uebung/${updated.slug}`);
  redirect(`/uebung/${updated.slug}?updated=1`);
}

/** Sichtbarkeit zwischen public/private umschalten (Story 7 EK2). */
export async function setVisibility(
  id: string,
  visibility: "public" | "private",
  _form: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from("exercises")
    .update({ visibility })
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();
  revalidateLists();
  if (data) revalidatePath(`/uebung/${data.slug}`);
}

/** Eigene Übung löschen (Story 7 EK3/EK4) inkl. Feld-Diagramm aus dem Storage. */
export async function deleteExercise(id: string, _form: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Bild-Pfad vor dem Löschen merken (Postcondition: Diagramm mit entfernen).
  const { data: ex } = await supabase
    .from("exercises")
    .select("bild_url")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .maybeSingle();

  // Erst die Zeile löschen (RLS-geprüft); nur bei Erfolg das Storage-Objekt
  // entfernen, damit kein Bild verschwindet, solange die Übung noch existiert.
  const { error } = await supabase
    .from("exercises")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user");
  if (error) return;

  await removeStorageObject(supabase, bildUrlToPath(ex?.bild_url));

  revalidateLists();
  redirect("/?mine=1&deleted=1");
}
