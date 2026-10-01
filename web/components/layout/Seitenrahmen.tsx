import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SeitenKopf } from "./SeitenKopf";

/* Literale Klassen — Tailwind findet nur, was ausgeschrieben im Quelltext steht. */
const BREITE = {
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

/**
 * Der Rahmen einer Seite: zentrierter Inhalt in der Breite, die zur Seite
 * passt, und zuoberst die Kopfzeile (Umschalter der Seitenleiste, Brotkrumen,
 * Aktionen). Jede Seite hat Brotkrumen — darum ist `krumen` Pflicht.
 * `null` nur dort, wo die Seite die Kopfzeile selbst setzt, weil ihre
 * Aktionen Zustand brauchen, der erst tiefer entsteht (Trainings-Editor).
 */
export function Seitenrahmen({
  breite,
  krumen,
  aktionen,
  kopfImDruck,
  druckVoll,
  children,
}: {
  breite: keyof typeof BREITE;
  krumen: BreadcrumbItem[] | null;
  aktionen?: ReactNode;
  /** Der Pfad steht auch auf dem Papier (Trainingsansicht). */
  kopfImDruck?: boolean;
  /** Auf Papier die volle Breite ohne Rand — für die Druckansicht. */
  druckVoll?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:pt-0",
        BREITE[breite],
        druckVoll && "print:max-w-none print:px-0 print:py-0",
      )}
    >
      {krumen && (
        <SeitenKopf krumen={krumen} aktionen={aktionen} imDruck={kopfImDruck} className="mb-6" />
      )}
      {children}
    </main>
  );
}
