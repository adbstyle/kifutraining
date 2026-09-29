"use server";

import { getVorlagen, type VorlageItem } from "@/lib/queries/exercises";

/** Der Vorlagen-Fundus für die Zeichenfläche der Maske (#246, #247): eigene
 *  und Manual-Diagramme, beim Bearbeiten ohne die Übung selbst. Erst geholt,
 *  wenn die Fläche angezeigt wird — auf einem schmalen Bildschirm, wo sie
 *  fehlt, nie. */
export async function ladeVorlagen(ausserUebung?: string): Promise<VorlageItem[]> {
  return getVorlagen(ausserUebung);
}
