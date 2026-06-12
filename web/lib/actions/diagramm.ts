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

  // bild_quelle konsistent zum Diagramm-Inhalt mitführen (#56 AK3): beim
  // ersten Element wird das Diagramm das aktive Bild; wird es geleert,
  // fällt die Wahl zurück (sonst zeigte der Umschalter "Diagramm" an,
  // während die Weiche längst das Foto rendert). Ein einziger Update —
  // kein Fenster zwischen zwei Statements.
  const { data: aktuell } = await supabase
    .from("exercises")
    .select("bild_quelle")
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .maybeSingle();
  if (!aktuell) return { ok: false, error: "Übung nicht gefunden." };

  const leer = diagramm.elemente.length === 0;
  const bild_quelle = leer
    ? aktuell.bild_quelle === "diagramm"
      ? null
      : aktuell.bild_quelle
    : (aktuell.bild_quelle ?? "diagramm");

  const { data: updated, error } = await supabase
    .from("exercises")
    .update({ diagramm, bild_quelle })
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();
  if (error || !updated)
    return { ok: false, error: error?.message ?? "Speichern fehlgeschlagen." };

  revalidatePath(`/uebung/${updated.slug}`);
  revalidatePath(`/uebung/${updated.slug}/edit`);
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
