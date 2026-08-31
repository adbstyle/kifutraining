"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userSlug } from "@/lib/slug";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import { istAltersstufe } from "@/lib/altersstufe";
import { fehlerMeldung } from "@/lib/training-bedingungen";

export type ExerciseFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Listen-Seiten, die nach Mutationen neu validiert werden. */
function revalidateLists() {
  revalidatePath("/");
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

  // Beim Erfassen wählt der Trainer die Altersstufe selbst (Story 3 AK 1) —
  // das ist die EINZIGE Stelle, an der sie aus dem Formular kommt. Danach ist
  // sie fest; das Überführen in die andere Stufe ist ein eigener,
  // ausdrücklicher Weg (Story 4). Ein unbekannter Wert fällt auf den
  // Kinderfussball zurück (Story 1 AC 8), und die Einordnungs-Prüfung in
  // parseUebungsInhalt meldet den daraus folgenden Widerspruch.
  const gewaehlt = String(form.get("altersstufe") ?? "").trim();
  const altersstufe = istAltersstufe(gewaehlt) ? gewaehlt : "kinderfussball";

  const parsed = parseUebungsInhalt(form, { altersstufe });
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
    // Übersetzt statt roh: Werte, die nicht zur Altersstufe der Übung passen,
    // kommen als Constraint-Meldung an, und die versteht niemand.
    return {
      status: "error",
      message: error ? fehlerMeldung(error.message) : "Speichern fehlgeschlagen.",
    };
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

  // Die gespeicherte Altersstufe entscheidet, welche Werte gelten — nie das
  // Formular allein: sonst liesse sich eine Übung durch einen untergeschobenen
  // Wert in die andere Altersstufe heben (Story 1 AC 9).
  // Der alte Bildpfad kommt gleich mit: Erzeugt der Upload einen anderen Pfad
  // (z. B. Formatwechsel .png -> .webp), wird die alte Datei sonst zur Waise.
  const { data: bestand } = await supabase
    .from("exercises")
    .select("altersstufe, bild_url")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .maybeSingle();
  if (!bestand) return { status: "error", message: "Übung nicht gefunden." };
  const gespeichert = istAltersstufe(bestand.altersstufe)
    ? bestand.altersstufe
    : "kinderfussball";

  // Überführen in die andere Altersstufe (Story 4): der EINZIGE Weg, an dem
  // eine bestehende Übung ihre Altersstufe verlässt — und er verlangt die
  // ausdrückliche Quittung des Trainers (AK 2). Fehlt sie, gilt die
  // gespeicherte Stufe, und ein mitgeschickter Wert bleibt wirkungslos. Die
  // Filter auf `owner_id` und `source` oben sind zugleich der Guard gegen das
  // Umwandeln einer kuratierten oder fremden Übung (AK 5): sie findet die Zeile
  // gar nicht erst. Der Rest des Formulars wird anschliessend gegen die NEUE
  // Altersstufe geprüft — Werte, die es dort nicht gibt, fallen weg (PC 4).
  const gewuenscht = String(form.get("altersstufe") ?? "").trim();
  const bestaetigt = String(form.get("umwandlung_bestaetigt") ?? "") === "1";
  const altersstufe =
    bestaetigt && istAltersstufe(gewuenscht) ? gewuenscht : gespeichert;

  const parsed = parseUebungsInhalt(form, { altersstufe });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const file = form.get("bild");
  const hasImage = file instanceof File && file.size > 0;

  const update: Record<string, unknown> = { ...parsed.row };
  let altPfad: string | null = null;
  let neuPfad: string | null = null;
  if (hasImage) {
    altPfad = bildUrlToPath(bestand.bild_url);

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
    return {
      status: "error",
      message: error ? fehlerMeldung(error.message) : "Speichern fehlgeschlagen.",
    };
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
