"use client";

import { createContext } from "react";
import { cn } from "@/lib/cn";
import { nebenLeiste } from "./Seitenleiste";

/* Der Platz am unteren Rand, unten in der Mitte: Dort stehen die Snackbar
   (`SnackbarProvider`) und die Auswahlleiste (`AuswahlLeiste`). Beide teilen
   die Lage — mittig über dem Inhalt, nicht über der Seitenleiste, unten
   mindestens ein Rem frei bzw. die sichere Zone von Geräten mit Home-Leiste.

   Wer dort eine Leiste stellt, meldet ihre Höhe über `FussleisteKontext` an
   den SnackbarProvider. Der stapelt die Snackbar darüber und hält am Ende der
   Seite so viel frei, dass die letzte Zeile nicht unter der Leiste liegt. */

/** Lage und Verhalten des Platzes, ohne `bottom` und Ebene. `m-0`: Ein
 *  `space-y-*` rundum verschöbe sonst den festen Platz. */
export const unterRand = cn(
  "pointer-events-none fixed right-0 m-0 flex justify-center px-4 print:hidden",
  nebenLeiste,
);

/** Der Abstand zum unteren Bildrand, für `bottom` und das Freihalten. */
export const UNTER_RAND_ABSTAND = "max(1rem, env(safe-area-inset-bottom))";

/** Eine Leiste meldet unter ihrer Kennung ihre Höhe samt Abstand nach oben;
 *  `null` meldet sie ab. Ohne Provider (ausserhalb der App) `null`. */
export type MeldeFussleiste = (id: string, hoehe: number | null) => void;
export const FussleisteKontext = createContext<MeldeFussleiste | null>(null);
