"use client";

import { useEffect, useRef } from "react";

/* Der Fokus folgt einer Zeile, die die Gruppe wechselt (#599). Wechselt eine
   Spieler:in mit ihrem Status die Gruppe, entsteht ihre Zeile neu, und der
   Fokus fiele auf die Seite zurück. `merke(id)` beim Wechsel; ist nichts mehr
   im Gang und hat niemand sonst den Fokus, geht er an das erste Bedienelement
   der Zeile mit `data-fokus-ziel={id}`. */
export function useFokusFolgt(bereit: boolean): (id: string) => void {
  const ziel = useRef<string | null>(null);
  useEffect(() => {
    const id = ziel.current;
    if (!bereit || id === null) return;
    ziel.current = null;
    const aktiv = document.activeElement;
    if (aktiv !== null && aktiv !== document.body) return;
    document
      .querySelector(`[data-fokus-ziel="${CSS.escape(id)}"]`)
      ?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled])")
      ?.focus();
  });
  return (id: string) => {
    ziel.current = id;
  };
}
