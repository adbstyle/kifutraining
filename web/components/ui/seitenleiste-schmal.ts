/* Schmale Form der Seitenleiste: eingebettet auf jeder Breite, sonst erst ab
   `lg` — darunter zeigt der Drawer immer alles. Ausgeschriebene Literale,
   damit Tailwind sie findet. Geteilt von Seitenleiste und BereichWechsler,
   damit beide dieselbe Schwelle meinen. */
export const SCHMAL_KLASSEN = {
  lg: {
    textWeg: "lg:sr-only",
    nurBreit: "lg:hidden",
    mitte: "lg:justify-center",
    linie: "lg:block",
    konto: "lg:justify-center lg:p-0",
    anmelden: "lg:px-0",
  },
  immer: {
    textWeg: "sr-only",
    nurBreit: "hidden",
    mitte: "justify-center",
    linie: "block!",
    konto: "justify-center p-0!",
    anmelden: "px-0!",
  },
} as const;
export type SchmalAb = keyof typeof SCHMAL_KLASSEN;
