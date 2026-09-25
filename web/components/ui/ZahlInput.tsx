"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

/* Das Eingabeelement eines Zahlenfelds (`TextField type="number"`): Es zählt
   nie von selbst — weder Pfeiltasten noch Mausrad ändern den Wert; getippt
   wird die Zahl. Ein versehentliches Scrollen über dem fokussierten Feld
   verstellte sie sonst unbemerkt.

   Ein eigener Client-Baustein, weil die Handler Browser-Code sind: TextField
   selbst bleibt auf Server-Seiten nutzbar (etwa im Styleguide). Die Pfeile im
   Feld blendet TextField per CSS aus. */
export const ZahlInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ onKeyDown, onWheel, ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
        onKeyDown?.(e);
      }}
      onWheel={(e) => {
        // Nur ein fokussiertes Zahlenfeld zählt beim Scrollen; ohne Fokus
        // scrollt die Seite ungestört weiter.
        if (document.activeElement === e.currentTarget) e.currentTarget.blur();
        onWheel?.(e);
      }}
    />
  ),
);
ZahlInput.displayName = "ZahlInput";
