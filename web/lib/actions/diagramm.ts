"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDiagramm, kopiereDiagramm, MAX_ELEMENTE, type DiagrammData } from "@/lib/diagramm";

export type SaveDiagrammResult = { ok: true } | { ok: false; error: string };

/** Alle Stellen, an denen das aktive Bild einer Übung erscheint, nach einer
 *  Diagramm-Mutation neu validieren — eine Quelle für beide Actions. */
function revalidiereUebung(slug: string) {
  revalidatePath(`/uebung/${slug}`);
  revalidatePath(`/uebung/${slug}/edit`);
  revalidatePath("/");
}

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

  revalidiereUebung(updated.slug);
  return { ok: true };
}

/** Ein bestehendes Diagramm als Vorlage in die eigene Übung kopieren (#61).
 *  Die Quelle wird als unabhängige Kopie (frische IDs) angelegt und nie
 *  verändert; ein vorhandenes Diagramm der Zielübung wird ersetzt (die
 *  Bestätigung erfolgt im UI). Erlaubte Quellen: eigene Diagramme und
 *  KiFu-Manual-Diagramme — fremde Trainer-Diagramme sind ausgeschlossen. */
export async function kopiereVorlage(
  zielId: string,
  quellId: string,
): Promise<SaveDiagrammResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // Quelle lesen (RLS lässt nur sichtbare Übungen durch) und Bestand prüfen:
  // ausschliesslich Manual oder eigene Übungen sind als Vorlage zulässig.
  const { data: quelle } = await supabase
    .from("exercises")
    .select("name, diagramm, source, owner_id")
    .eq("id", quellId)
    .maybeSingle();
  if (!quelle) return { ok: false, error: "Vorlage nicht gefunden." };
  if (quelle.source !== "manual" && quelle.owner_id !== user.id)
    return { ok: false, error: "Diese Vorlage ist nicht verfügbar." };

  const data = parseDiagramm(quelle.diagramm);
  if (!data || data.elemente.length === 0)
    return { ok: false, error: "Die Vorlage enthält kein Diagramm." };

  // Zielübung muss eine eigene User-Übung sein. Anders als saveDiagramm wird
  // bild_quelle hier bewusst fest auf "diagramm" gesetzt (kein vorgelagerter
  // Read): das kopierte Diagramm wird immer das aktive Anzeige-Bild (#61
  // PC4), ein vorhandenes Foto (bild_url) bleibt als Umschalt-Option erhalten.
  const { data: updated, error } = await supabase
    .from("exercises")
    .update({
      diagramm: kopiereDiagramm(data),
      bild_quelle: "diagramm",
    })
    .eq("id", zielId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .select("slug")
    .single();
  if (error || !updated)
    return { ok: false, error: error?.message ?? "Kopieren fehlgeschlagen." };

  revalidiereUebung(updated.slug);
  return { ok: true };
}
