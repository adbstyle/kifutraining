"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AB_XL } from "@/lib/breite";

/**
 * Die eigene Bearbeitungsseite einer Übung im Training gibt es breit nicht
 * mehr: Dort wird die Übung in der Spalte neben den übrigen bearbeitet (Epic
 * #369 EK 5). Eine ältere Adresse — ein Lesezeichen, ein Link, der Rückweg
 * aus dem Feld-Diagramm — führt breit darum in die Spalte (#373 PC 3), schmal
 * bleibt sie die Maske.
 *
 * Entschieden wird einmal, beim Öffnen. Bis dahin verbirgt der Rahmen die
 * Maske breit, damit sie nicht kurz aufblitzt; danach zeigt er sie in jeder
 * Breite. Wer die Maske schmal geöffnet hat und das Fenster später breit
 * zieht, behält sie samt seinen Eingaben — ein Umleiten in dem Moment
 * verwürfe sie ohne Rückfrage.
 */
export function InSpalteWeiterleiten({ ziel, children }: { ziel: string; children: ReactNode }) {
  const router = useRouter();
  const [geprueft, setGeprueft] = useState(false);
  useEffect(() => {
    if (window.matchMedia(AB_XL).matches) router.replace(ziel);
    else setGeprueft(true);
  }, [router, ziel]);
  return <div className={geprueft ? "contents" : "contents xl:hidden"}>{children}</div>;
}
