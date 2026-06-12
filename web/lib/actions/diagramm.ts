"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDiagramm, type DiagrammData } from "@/lib/diagramm";

/** Obergrenze als Server-Sanity-Check — weit über dem fachlichen Rahmen
 *  von ~50 Elementen (NFR Epic #47), schützt nur vor entarteten Payloads. */
const MAX_ELEMENTE = 300;

export type SaveDiagrammResult = { ok: true } | { ok: false; error: string };

/** Autosave des Diagramm-Editors (#49 AK6). RLS lässt nur eigene
 *  User-Übungen durch; parseDiagramm ist die Server-Trust-Boundary. */
export async function saveDiagramm(
  exerciseId: string,
  data: DiagrammData,
): Promise<SaveDiagrammResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const diagramm = parseDiagramm(data);
  if (!diagramm || diagramm.elemente.length > MAX_ELEMENTE)
    return { ok: false, error: "Ungültiges Diagramm." };

  // Beim ersten Diagramm wird es das aktive Anzeige-Bild (#56 AK3:
  // Diagramm bevorzugt, bis der USER umschaltet).
  const { data: updated, error } = await supabase
    .from("exercises")
    .update({ diagramm })
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug, bild_quelle")
    .single();
  if (error || !updated)
    return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen." };

  if (!updated.bild_quelle && diagramm.elemente.length > 0) {
    await supabase
      .from("exercises")
      .update({ bild_quelle: "diagramm" })
      .eq("id", exerciseId)
      .eq("owner_id", user.id);
  }

  revalidatePath(`/uebung/${updated.slug}`);
  revalidatePath("/");
  return { ok: true };
}

/** Aktives Anzeige-Bild umschalten, wenn Foto UND Diagramm existieren (#56 AK2). */
export async function setBildQuelle(
  exerciseId: string,
  quelle: "foto" | "diagramm",
  _form: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { data } = await supabase
    .from("exercises")
    .update({ bild_quelle: quelle })
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();
  if (data) {
    revalidatePath(`/uebung/${data.slug}`);
    revalidatePath(`/uebung/${data.slug}/edit`);
    revalidatePath("/");
  }
}
