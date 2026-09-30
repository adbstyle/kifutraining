"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { userSlug } from "@/lib/slug";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import { alsAltersstufe, istAltersstufe } from "@/lib/altersstufe";
import { materialBasisAusDiagramm } from "@/lib/material";
import { bildQuelleZurZeichnung } from "@/lib/diagramm";
import { diagrammAusFormular } from "@/lib/diagramm-pruefung";
import { fehlerMeldung } from "@/lib/training-bedingungen";
import { entferneStorageObjekt } from "@/lib/fassung";
import { kopiereUebungNach } from "@/lib/kern/uebungen";

export type ExerciseFormState = {
  status: "idle" | "error";
  errors?: Record<string, string>;
  message?: string;
};

/** Listen-Seiten, die nach Mutationen neu validiert werden. */
function revalidateLists() {
  revalidatePath("/");
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
  const altersstufe = alsAltersstufe(String(form.get("altersstufe") ?? "").trim());

  const parsed = parseUebungsInhalt(form, { altersstufe });
  if (!parsed.ok) return { status: "error", errors: parsed.errors };

  const gezeichnet = diagrammAusFormular(form);
  if (gezeichnet && "fehler" in gezeichnet) return { status: "error", message: gezeichnet.fehler };
  const diagramm = gezeichnet ?? null;

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
      // Übung und Diagramm entstehen gemeinsam (#246 PC 1). Das Diagramm wird
      // das Bild der Übung (PC 3), ein zugleich hochgeladenes Foto bleibt als
      // Umschalt-Option erhalten (PC 4) — dieselbe Automatik wie beim ersten
      // Element im Editor.
      diagramm,
      bild_quelle: diagramm ? "diagramm" : null,
      // Hat der Trainer den Vorschlag aus seiner Zeichnung übernommen oder
      // sein Material beibehalten, gilt er als Basis (Epic #266) — gerechnet
      // aus dem Diagramm, das hier gespeichert wird, nie aus dem Formular.
      material_basis:
        form.get("material_basis_bestaetigen") === "1" ? materialBasisAusDiagramm(diagramm) : null,
    })
    .select("slug")
    .single();

  if (error || !inserted) {
    await entferneStorageObjekt(supabase, bildPfad);
    // Übersetzt statt roh: Werte, die nicht zur Altersstufe der Übung passen,
    // kommen als Constraint-Meldung an, und die versteht niemand.
    return {
      status: "error",
      message: error ? fehlerMeldung(error.message) : "Speichern fehlgeschlagen.",
    };
  }

  revalidateLists();
  // Ersetzen statt anhängen: Der aktuelle Eintrag ist der Wächter der
  // Verlassen-Warnung (#246 AK 7). Bliebe er stehen, bräuchte Zurück von der
  // neuen Übung einen Schritt mehr.
  redirect(`/uebung/${inserted.slug}?created=1`, RedirectType.replace);
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
    .select("altersstufe, bild_url, bild_quelle, diagramm")
    .eq("id", id)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .maybeSingle();
  if (!bestand) return { status: "error", message: "Übung nicht gefunden." };
  const gespeichert = alsAltersstufe(bestand.altersstufe);

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

  // Die gespeicherte Zeichnung kommt mit: unverändert zurückgeschickt, wird
  // sie nicht neu beanstandet (Altbestand).
  const gezeichnet = diagrammAusFormular(form, bestand.diagramm);
  if (gezeichnet && "fehler" in gezeichnet) return { status: "error", message: gezeichnet.fehler };

  const file = form.get("bild");
  const hasImage = file instanceof File && file.size > 0;

  const update: Record<string, unknown> = { ...parsed.row };
  // Die Zeichnung geht mit den übrigen Angaben in einem Vorgang (#247 PC 1);
  // die Bildwahl folgt ihr wie beim Erfassen.
  if (gezeichnet !== undefined) {
    update.diagramm = gezeichnet;
    update.bild_quelle = bildQuelleZurZeichnung(
      bestand.bild_quelle as "foto" | "diagramm" | null,
      gezeichnet,
      form.get("diagramm_aus_vorlage") === "1",
    );
  }
  // Hat der Trainer den Material-Vorschlag übernommen oder sein Material
  // beibehalten, gilt der Vorschlag der gespeicherten Zeichnung als Basis
  // (Epic #266) — gerechnet auf dem Server, nie aus dem Formular.
  if (form.get("material_basis_bestaetigen") === "1")
    update.material_basis = materialBasisAusDiagramm(
      gezeichnet !== undefined ? gezeichnet : bestand.diagramm,
    );
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
    if (neuPfad && neuPfad !== altPfad) await entferneStorageObjekt(supabase, neuPfad);
    return {
      status: "error",
      message: error ? fehlerMeldung(error.message) : "Speichern fehlgeschlagen.",
    };
  }

  // Erfolg: alte Bilddatei entfernen, wenn der Upload einen anderen Pfad erzeugt
  // hat (bei gleichem Pfad hat upsert sie bereits überschrieben).
  if (altPfad && altPfad !== neuPfad) await entferneStorageObjekt(supabase, altPfad);

  revalidateLists();
  revalidatePath(`/uebung/${updated.slug}`);
  // Ersetzen statt anhängen, wie nach dem Erfassen: Der aktuelle Eintrag ist
  // der Wächter der Verlassen-Warnung (#247 AK 8).
  redirect(`/uebung/${updated.slug}?updated=1`, RedirectType.replace);
}

/** Eine sichtbare Übung in den eigenen Bestand kopieren — die eigene (#171)
 *  ebenso wie eine kuratierte oder fremde (Story 7, Übungswelten). Die Regeln
 *  stehen im Fachkern (`kopiereUebungNach`), den auch das KI-Werkzeug
 *  «uebung_kopieren» nutzt (#317 NFR 1). */
export async function kopiereUebung(
  exerciseId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const kopie = await kopiereUebungNach(supabase, user.id, { kennung: exerciseId });
  if (!kopie.ok) return { ok: false, error: kopie.meldung };
  revalidateLists();
  return { ok: true, slug: kopie.wert.slug };
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

  await entferneStorageObjekt(supabase, bildUrlToPath(ex?.bild_url));

  revalidateLists();
  redirect("/?mine=1&deleted=1");
}
