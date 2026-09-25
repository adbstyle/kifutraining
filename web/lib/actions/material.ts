"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { materialBasisAusDiagramm } from "@/lib/material";

/** Auf der Übungsseite auf eine Diagrammänderung antworten (Story #269): den
 *  neuen Vorschlag übernehmen oder das bisherige Material beibehalten. Beide
 *  setzen die Basis auf den heutigen Vorschlag — gerechnet aus dem
 *  gespeicherten Diagramm, nicht aus dem, was die Seite zeigte. Die freie
 *  Ergänzung bleibt in beiden Fällen unberührt (PC 3).
 *
 *  Nur an eigenen Nutzer-Übungen; die Filter auf `owner_id` und `source` und
 *  die RLS lassen nichts anderes durch. */
async function antworte(exerciseId: string, uebernehmen: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: ex } = await supabase
    .from("exercises")
    .select("slug, diagramm")
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user")
    .maybeSingle();
  if (!ex) return;

  const vorschlag = materialBasisAusDiagramm(ex.diagramm);
  await supabase
    .from("exercises")
    .update(
      uebernehmen
        ? { material_liste: vorschlag, material_basis: vorschlag }
        : { material_basis: vorschlag },
    )
    .eq("id", exerciseId)
    .eq("owner_id", user.id)
    .eq("source", "user");

  revalidatePath(`/uebung/${ex.slug}`);
  revalidatePath(`/uebung/${ex.slug}/edit`);
}

export async function uebernehmeMaterialVorschlag(exerciseId: string): Promise<void> {
  await antworte(exerciseId, true);
}

export async function behalteMaterial(exerciseId: string): Promise<void> {
  await antworte(exerciseId, false);
}
