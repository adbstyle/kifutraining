"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ab hier teilt sich die Fläche — Tailwinds `xl`, wie `ZweiSpalten`. */
const AB_XL = "(min-width: 80rem)";

/**
 * Die eigene Bearbeitungsseite einer Übung im Training gibt es breit nicht
 * mehr: Dort wird die Übung in der Spalte neben den übrigen bearbeitet (Epic
 * #369 EK 5). Eine ältere Adresse — ein Lesezeichen, ein Link, der Rückweg
 * aus dem Feld-Diagramm — führt breit darum in die Spalte (#373 PC 3), schmal
 * bleibt sie die Maske.
 *
 * Die Breite kennt erst der Browser; bis er entschieden hat, blendet die Seite
 * ihre Maske breit aus (`xl:hidden`), damit sie nicht kurz aufblitzt.
 */
export function InSpalteWeiterleiten({ ziel }: { ziel: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.matchMedia(AB_XL).matches) router.replace(ziel);
  }, [router, ziel]);
  return null;
}
