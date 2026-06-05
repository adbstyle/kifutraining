"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userSlug } from "@/lib/slug";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { IMAGE_TYPES, imageError } from "@/lib/image";
import { FAHRPLAN_TEILE } from "@/lib/labels";
import {
  trainingsteilSlugs,
  feldtypSlugs,
  erscheinungsformSlugs,
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
  revalidatePath("/meine-uebungen");
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
    if (!offen) errors.offen_starten = "Pflichtfeld für Einleitung/Hauptteil.";
    if (ueben.length === 0)
      errors.ueben = "Mindestens ein Übungsschritt nötig.";
    if (!wett) errors.wetteifern = "Pflichtfeld für Einleitung/Hauptteil.";
    methodischer_fahrplan = { offen_starten: offen, ueben, wetteifern: wett };
  } else if (trainingsteil) {
    aufbau = clean(form.get("aufbau"));
    if (!aufbau) errors.aufbau = "Bitte den Aufbau beschreiben.";
  }

  // Erscheinungsform nur bei Einleitung/Hauptteil
  const erscheinungsform = istFahrplan
    ? csv(form.get("form")).filter((f) => erscheinungsformSlugs.includes(f as never))
    : [];

  const feldtyp = clean(form.get("feldtyp"));
  const min = clean(form.get("anzahl_min"));
  const empf = clean(form.get("anzahl_empfohlen"));
  const anzahl_kinder =
    min || empf
      ? { min: min ? Number(min) : null, empfohlen: empf ? Number(empf) : null }
      : null;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    row: {
      name,
      trainingsteil,
      kategorien,
      feldtyp: feldtyp && feldtypSlugs.includes(feldtyp as never) ? feldtyp : null,
      erscheinungsform,
      spielform: clean(form.get("spielform")) || null,
      anzahl_kinder,
      material: lines(form.get("material")),
      methodischer_fahrplan,
      aufbau,
      varianten: lines(form.get("varianten")),
    },
  };
}

/** Optionales Feld-Diagramm validieren + in den Storage laden -> public URL. */
async function uploadImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  exerciseId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const invalid = imageError(file.type, file.size);
  if (invalid) return { error: invalid };

  const path = `user/${ownerId}/${exerciseId}.${IMAGE_TYPES[file.type]}`;
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (error) return { error: error.message };
  return {
    url: supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl,
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

  // Bild vor dem Insert prüfen, damit bei Formatfehler nichts angelegt wird (EK7).
  const file = form.get("bild");
  const hasImage = file instanceof File && file.size > 0;
  if (hasImage) {
    const invalid = imageError(file.type, file.size);
    if (invalid) return { status: "error", errors: { bild: invalid } };
  }

  // Id vorab erzeugen: Bild VOR dem Insert hochladen, danach EIN Insert mit
  // bild_url. Kein zweistufiges insert->update (kein Halb-Zustand, kein
  // Update-Fenster). Schlägt der Insert nach dem Upload fehl, bleibt höchstens
  // ein Bild-Waise zurück (Cron-Cleanup, Architektur §11).
  const id = crypto.randomUUID();
  const slug = userSlug(String(parsed.row.name));

  let bildUrl: string | null = null;
  if (hasImage) {
    const { url, error: imgErr } = await uploadImage(supabase, user.id, id, file);
    if (imgErr) return { status: "error", errors: { bild: imgErr } };
    bildUrl = url ?? null;
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
    if (bildUrl) {
      await supabase.storage.from(STORAGE_BUCKET).remove([`user/${user.id}/${id}.${IMAGE_TYPES[(file as File).type]}`]);
    }
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
  if (hasImage) {
    const invalid = imageError(file.type, file.size);
    if (invalid) return { status: "error", errors: { bild: invalid } };
  }

  const update: Record<string, unknown> = { ...parsed.row };
  if (hasImage) {
    const { url, error: imgErr } = await uploadImage(supabase, user.id, id, file);
    if (imgErr) return { status: "error", errors: { bild: imgErr } };
    update.bild_url = url;
  }

  const { data: updated, error } = await supabase
    .from("exercises")
    .update(update)
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();

  if (error || !updated)
    return { status: "error", message: error?.message ?? "Speichern fehlgeschlagen." };

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

  const path = bildUrlToPath(ex?.bild_url);
  if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);

  revalidateLists();
  redirect("/meine-uebungen?deleted=1");
}
