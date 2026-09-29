import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ALTERSSTUFEN, istAltersstufe } from "@/lib/altersstufe";
import { userSlug } from "@/lib/slug";
import { ausDbFehler, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";
import {
  NICHTS_ANGELEGT,
  UEBUNG_STUFEN_KI,
  abgelehnt,
  pruefeUebungsInhalt,
  type UebungInhalt,
} from "@/lib/kern/uebung-inhalt";

/**
 * Eine eigene Übung anlegen (Story #143).
 *
 * Der Weg des KI-Werkzeugs «uebung_anlegen». Die Regeln sind die des
 * Formulars (`parseUebungsInhalt`, über lib/kern/uebung-inhalt.ts), die Übung
 * entsteht wie dort: als privater Entwurf des Aufrufers (#143 PC 1), mit
 * sprechendem Slug samt Zufalls-Suffix. Ein Bild und ein Feld-Diagramm kommen
 * über diesen Weg nicht mit.
 *
 * Verletzt die Übung Regeln, entsteht nichts (PC 4), und die Antwort nennt
 * jede einzeln (AK 6).
 */
export async function legeUebungAn(
  supabase: SupabaseClient,
  userId: string,
  e: UebungInhalt & { altersstufe: string },
): Promise<KernErgebnis<{ id: string; slug: string; sichtbarkeit: "entwurf" }>> {
  // Die Altersstufe ist Pflicht und hat keinen Rückfall — wie beim Anlegen
  // eines Trainings: Sie bindet die Übung an ihr Lehrmittel.
  const altersstufe = e.altersstufe.trim();
  if (!istAltersstufe(altersstufe))
    return fehlschlag("eingabe", "Bitte die Altersstufe wählen.", {
      feld: "altersstufe",
      zulaessig: ALTERSSTUFEN,
      hinweis: NICHTS_ANGELEGT,
    });
  if (!UEBUNG_STUFEN_KI.includes(altersstufe))
    return fehlschlag(
      "regel",
      `Übungen der Altersstufe ${altersstufeLabels[altersstufe]} lassen sich über den KI-Zugang noch nicht anlegen.`,
      { feld: "altersstufe", zulaessig: UEBUNG_STUFEN_KI, hinweis: NICHTS_ANGELEGT },
    );

  // Alle Verstösse in einer Antwort, damit der Assistent in einem Zug
  // korrigiert (#143 AK 6).
  const p = pruefeUebungsInhalt(e, { altersstufe });
  if (!p.ok) return abgelehnt(p.funde, NICHTS_ANGELEGT);

  const { data, error } = await supabase
    .from("exercises")
    .insert({
      ...p.row,
      slug: userSlug(String(p.row.name)),
      source: "user",
      owner_id: userId,
      visibility: "private",
    })
    .select("id, slug")
    .single();
  if (error) return ausDbFehler(error);
  return ok({ id: data.id as string, slug: data.slug as string, sichtbarkeit: "entwurf" });
}
