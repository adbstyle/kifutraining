"use client";

import { useEffect, useRef } from "react";

/* Fokus und Sichtbarkeit der ausgewählten Zeile der Trainingsübersicht (#630
   NFR 1, 2). Rendert nichts; die Zeilen-Links tragen `data-training-zeile`.

   - Ausgewählt (beim Laden per Link oder nach einem Wechsel): Die Zeile
     kommt ins Bild, falls sie es nicht schon ist — die Tabelle wechselt beim
     Öffnen in ihre eigene Scrollfläche, ein geteilter Link zeigt sonst eine
     Zeile weit unten nicht. Steht sie schon im Bild (der Klick), bewegt sich
     nichts. Der Fokus geht nach einem Wechsel auf die Überschrift des Detail
     (`data-detail-titel`), damit man dort weiterliest. Beim Laden per Link
     rührt er sich nicht.
   - Geschlossen: Der Fokus geht auf den Link der zuvor ausgewählten Zeile
     zurück, sonst fiele er mit dem Detail ins Leere. */
export function TabellenAuswahl({
  ausgewaehlt,
  attribut = "data-training-zeile",
}: {
  ausgewaehlt?: string;
  /** Das Attribut der Zeilen-Links mit der Kennung (Spielerliste: `data-spieler-zeile`, #700). */
  attribut?: string;
}) {
  // `undefined` bis zum ersten Lauf: Erst danach ist eine Änderung ein Wechsel.
  const vorher = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const zuvor = vorher.current;
    const jetzt = ausgewaehlt ?? null;
    vorher.current = jetzt;
    if (zuvor === jetzt) return;

    const id = jetzt ?? zuvor;
    const link = id ? document.querySelector<HTMLElement>(`[${attribut}="${CSS.escape(id)}"]`) : null;
    if (!link) return;
    if (!imBild(link)) link.scrollIntoView({ block: "center" });
    // Beim Laden (geteilter Link, Zurück aus dem Editor) bleibt der Fokus am
    // Seitenanfang: Wer vorliest, beginnt bei Brotkrume und Überschrift.
    if (zuvor === undefined) return;
    if (jetzt === null) {
      link.focus({ preventScroll: true });
    } else {
      const titel = document.querySelector<HTMLElement>("[data-detail-titel]");
      (titel ?? link).focus({ preventScroll: true });
    }
  }, [ausgewaehlt, attribut]);

  return null;
}

/** Steht das Element ganz im Bild — im Fenster und in jeder scrollenden
 *  Fläche darüber? */
function imBild(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) return false;
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (p.scrollHeight <= p.clientHeight) continue;
    const oy = getComputedStyle(p).overflowY;
    if (oy !== "auto" && oy !== "scroll") continue;
    const f = p.getBoundingClientRect();
    if (r.top < f.top || r.bottom > f.bottom) return false;
  }
  return true;
}
