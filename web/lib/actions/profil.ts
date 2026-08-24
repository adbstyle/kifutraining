"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Grenzen des Anzeigenamens — dieselben wie der DB-CHECK auf `profiles`,
 *  hier nur für eine verständliche Meldung statt eines Constraint-Fehlers. */
const MAX_LAENGE = 40;

export type AnzeigenameResult =
  | { ok: true; anzeigeName: string }
  | { ok: false; error: string };

/** Den eigenen Anzeigenamen setzen oder ändern (Team-Epic Story 2).
 *
 *  Einmal gewählt lässt er sich nicht mehr entfernen, nur ersetzen: an
 *  veröffentlichten Vorlagen und in Mitgliederlisten stünde sonst plötzlich
 *  wieder eine Zufallsbezeichnung. Darum gibt es hier bewusst keinen
 *  Lösch-Pfad. */
export async function setzeAnzeigename(name: string): Promise<AnzeigenameResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Bitte einen Anzeigenamen angeben." };
  if (trimmed.length > MAX_LAENGE)
    return {
      ok: false,
      error: `Der Anzeigename darf höchstens ${MAX_LAENGE} Zeichen lang sein.`,
    };

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, display_name: trimmed, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };

  // Der Name erscheint an Vorlagen und in Team-Listen — beide Bereiche neu
  // validieren, damit die Änderung sofort überall sichtbar ist.
  revalidatePath("/konto");
  revalidatePath("/trainings");
  revalidatePath("/teams");
  return { ok: true, anzeigeName: trimmed };
}
