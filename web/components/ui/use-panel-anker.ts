"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/* Ein Panel, das an seinem Auslöser hängt — die Mehrfachauswahl im Formular
   und der Filterknopf (Epic #363) teilen sich hier, wie es aufklappt, wie gross
   es werden darf und wann es zugeht.

   Die Masse in px. `PANEL_MAX_HOEHE` ist die Vorgabe, `PANEL_MIN_HOEHE` die
   Untergrenze, unter die keine Messung drücken darf — etwa zwei Zeilen plus
   Kopf und Fuss. `PANEL_ABSTAND` ist der Spalt zwischen Auslöser und Panel,
   nach oben wie nach unten; `RAND` der Abstand, den ein Panel seitlich zur
   Kante hält, gegen die es gemessen wird. */
const PANEL_MAX_HOEHE = 320;
const PANEL_MIN_HOEHE = 160;
const PANEL_ABSTAND = 4;
const RAND = 8;

type Grenze = { top: number; bottom: number; left: number; right: number };

/** Der nächste Vorfahre, der überhaupt abschneidet (`overflow` ≠ `visible`),
 *  sonst das Sichtfeld. Im Übungs-Picker etwa steht der Auslöser in einem
 *  nativen <dialog>; der schrumpft auf seinen Inhalt und trägt aus der
 *  Browser-Vorgabe `overflow: auto`. */
function grenzeVon(el: HTMLElement): { grenze: Grenze; element: HTMLElement | null } {
  let grenze: Grenze = { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (getComputedStyle(p).overflow !== "visible") {
      const r = p.getBoundingClientRect();
      grenze = {
        top: Math.max(grenze.top, r.top),
        bottom: Math.min(grenze.bottom, r.bottom),
        left: Math.max(grenze.left, r.left),
        right: Math.min(grenze.right, r.right),
      };
      return { grenze, element: p };
    }
  }
  return { grenze, element: null };
}

export function usePanelAnker<T extends HTMLElement>({
  offen,
  onSchliessen,
  maxHoehe = PANEL_MAX_HOEHE,
}: {
  offen: boolean;
  /** Klick daneben, und der Auslöser scrollt ganz aus dem Bild. Ohne
   *  Fokusrückgabe: Sonst risse das Zuklappen die Seite an eine Stelle
   *  zurück, von der der Nutzer gerade weggeht. */
  onSchliessen: () => void;
  maxHoehe?: number;
}) {
  const wurzelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const grenzRef = useRef<HTMLElement | null>(null);
  // Wohin das Panel aufklappt und wie hoch es werden darf — gemessen, nicht
  // gesetzt. Bis zur ersten Messung gilt die Vorgabe: nach unten, volle Höhe.
  const [lage, setLage] = useState({ oben: false, maxHoehe, versatz: 0 });
  const schliessenRef = useRef(onSchliessen);
  schliessenRef.current = onSchliessen;

  /* Wie viel Raum das Panel wirklich hat — und auf welcher Seite. Nötig, weil
     eine feste Höhe nur dort stimmt, wo unter dem Auslöser auch genug Platz
     liegt; im Dialog schnitt er sonst die untere Hälfte des Panels ab,
     mitsamt seinem Aktions-Fuss. Die Seite mit mehr Raum gewinnt; die Höhe
     ist der kleinere Wert aus Vorgabe und dem, was dort hinpasst. Die Liste
     im Panel scrollt ohnehin — ein knapperes Panel zeigt also weniger auf
     einmal, verliert aber nichts.

     Seitlich: Ein Panel, das breiter ist als sein Auslöser (Filterknopf),
     rückt nach links, bis es in die Grenze passt — am rechten Rand der Leiste
     liefe es sonst aus dem Bild.

     Gibt zurück, ob der Auslöser noch im sichtbaren Bereich liegt. */
  function messe(): boolean {
    const t = triggerRef.current;
    if (!t) return true;
    const feld = t.getBoundingClientRect();
    const { grenze, element } = grenzeVon(t);
    grenzRef.current = element;

    const unten = grenze.bottom - feld.bottom - PANEL_ABSTAND;
    const oben = feld.top - grenze.top - PANEL_ABSTAND;
    const nachOben = unten < Math.min(maxHoehe, oben);

    const breite = panelRef.current?.offsetWidth ?? 0;
    const ueberRechts = feld.left + breite - (grenze.right - RAND);
    const versatz = ueberRechts > 0 ? -Math.min(ueberRechts, feld.left - grenze.left - RAND) : 0;

    setLage({
      oben: nachOben,
      // Nie unter die Untergrenze: Lieber ragt das Panel ein Stück hinaus, als
      // dass es auf einen unbedienbaren Spalt zusammenfällt.
      maxHoehe: Math.max(PANEL_MIN_HOEHE, Math.min(maxHoehe, nachOben ? oben : unten)),
      versatz,
    });

    return feld.bottom > grenze.top && feld.top < grenze.bottom;
  }

  // Die seitliche Lage braucht die Breite des Panels — die gibt es erst, wenn
  // es im DOM steht. Darum gleich nach dem Aufklappen ein zweites Mal messen,
  // vor dem ersten Bild.
  useLayoutEffect(() => {
    if (offen) messe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  // Die Messung beim Öffnen ist eine Momentaufnahme — sie veraltet, sobald
  // sich darunter etwas verschiebt. Solange das Panel offen ist, wird sie
  // darum an den Wegen nachgezogen, auf denen sich seine Geometrie überhaupt
  // ändern kann:
  //
  // 1. `scroll` am Dokument, in der Capture-Phase — das Ereignis steigt nicht
  //    auf, wenn ein Kasten im Inneren scrollt statt der Seite.
  // 2. Grösse des Vorfahren, gegen den gemessen wurde, und des Panels selbst
  //    (`ResizeObserver`). Im Übungs-Picker bleibt das Panel nach einer Wahl
  //    offen, und genau diese Wahl kürzt die Trefferliste unter ihm — der
  //    Dialog schrumpft, die Kante wandert nach oben.
  // 3. `resize` am Fenster — Fenstergrösse wie Drehung des Geräts.
  //
  // Scrollt der Auslöser ganz aus dem Bild, wird zugeklappt statt
  // nachgemessen: Das Panel hängt an ihm und ist mit ihm draussen.
  //
  // Gemessen wird höchstens einmal pro Bild: `scroll` feuert dicht, und die
  // Messung liest Layout.
  useEffect(() => {
    if (!offen) return;
    let bild = 0;
    const nachmessen = () => {
      if (bild) return;
      bild = requestAnimationFrame(() => {
        bild = 0;
        if (!messe()) schliessenRef.current();
      });
    };
    document.addEventListener("scroll", nachmessen, true);
    window.addEventListener("resize", nachmessen);
    const beobachter = new ResizeObserver(nachmessen);
    if (grenzRef.current) beobachter.observe(grenzRef.current);
    if (panelRef.current) beobachter.observe(panelRef.current);
    return () => {
      if (bild) cancelAnimationFrame(bild);
      document.removeEventListener("scroll", nachmessen, true);
      window.removeEventListener("resize", nachmessen);
      beobachter.disconnect();
    };
    // `messe` liest nur Refs und ruft `setLage` — beide über Renders hinweg
    // stabil, eine veraltete Closure kann hier nichts Falsches tun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  // Klick daneben schliesst.
  useEffect(() => {
    if (!offen) return;
    function onDoc(e: MouseEvent) {
      if (wurzelRef.current && !wurzelRef.current.contains(e.target as Node)) {
        schliessenRef.current();
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [offen]);

  const panelStil: CSSProperties = { maxHeight: lage.maxHoehe, left: lage.versatz };
  const panelLage = lage.oben ? "bottom-full mb-1" : "top-full mt-1";

  return { wurzelRef, triggerRef, panelRef, messe, panelStil, panelLage };
}
