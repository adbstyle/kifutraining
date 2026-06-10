"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FavoriteResult = { ok: boolean };

/**
 * Übung favorisieren oder Favorit entfernen (Story "Übungen favorisieren").
 * Reine RLS-Mutation auf `exercise_favorites` — kein RPC nötig. Der Client
 * kennt den aktuellen Zustand und gibt den Zielzustand vor (analog setVisibility).
 *
 * Gibt {ok:false} zurück, statt zu werfen, damit die optimistische UI den
 * vorherigen Zustand wiederherstellen und einen Hinweis zeigen kann
 * (AC10, Postcondition 4).
 */
export async function setFavorite(
  exerciseId: string,
  favorite: boolean,
): Promise<FavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  if (favorite) {
    // Idempotent: erneutes Favorisieren ändert nichts (PK verhindert Duplikate).
    // RLS-WITH-CHECK stellt sicher, dass nur sichtbare Übungen favorisiert werden.
    const { error } = await supabase
      .from("exercise_favorites")
      .upsert(
        { user_id: user.id, exercise_id: exerciseId },
        { onConflict: "user_id,exercise_id" },
      );
    if (error) return { ok: false };
  } else {
    const { error } = await supabase
      .from("exercise_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId);
    if (error) return { ok: false };
  }

  // Katalog-Liste neu validieren, damit der Favoriten-Filter konsistent bleibt.
  revalidatePath("/");
  return { ok: true };
}
