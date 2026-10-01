import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SeitenKopf } from "./SeitenKopf";

/* Literale Klassen — Tailwind findet nur, was ausgeschrieben im Quelltext steht.
   `voll`: Übersichten (Kachelraster, Kalender) nutzen die ganze Fläche. */
const BREITE = {
  voll: "",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

/**
 * Der Rahmen einer Seite: linksbündig neben der Seitenleiste, in der Breite,
 * die zur Seite passt — Übersichten über die ganze Fläche, Formulare und
 * Lesetext in ihrer Lesebreite —, und zuoberst die Kopfzeile (Umschalter der
 * Seitenleiste, Brotkrumen, Aktionen). Nicht zentriert: Die Fläche rechts
 * gehört der zweiten Spalte (`spalte`, etwa die Einordnung einer Übung). Jede Seite hat Brotkrumen — darum ist `krumen` Pflicht.
 * `null` nur dort, wo die Seite die Kopfzeile selbst setzt, weil ihre
 * Aktionen Zustand brauchen, der erst tiefer entsteht (Trainings-Editor).
 */
export function Seitenrahmen({
  breite,
  krumen,
  aktionen,
  kopfImDruck,
  druckVoll,
  spalte,
  children,
}: {
  breite: keyof typeof BREITE;
  krumen: BreadcrumbItem[] | null;
  aktionen?: ReactNode;
  /** Der Pfad steht auch auf dem Papier (Trainingsansicht). */
  kopfImDruck?: boolean;
  /** Auf Papier die volle Breite ohne Rand — für die Druckansicht. */
  druckVoll?: boolean;
  /** Die zweite Spalte rechts neben dem Inhalt (Epic #350). Ab `xl` steht sie
   *  daneben, schmaler steht sie nach dem Inhalt — im Quelltext folgt sie ihm
   *  ohnehin, so lesen Tastatur und Vorlesehilfe überall in derselben
   *  Reihenfolge. Auf Papier bleibt sie daneben, schmaler als am Schirm.
   *  `breite` gilt dann für beide Spalten zusammen; der Inhalt behält seine
   *  Lesebreite (`max-w-4xl`). */
  spalte?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main
      className={cn(
        "px-4 py-8 sm:px-6 sm:py-10 lg:pt-0",
        BREITE[breite],
        druckVoll && "print:max-w-none print:px-0 print:py-0",
      )}
    >
      {krumen && (
        <SeitenKopf krumen={krumen} aktionen={aktionen} imDruck={kopfImDruck} className="mb-6" />
      )}
      {spalte ? (
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-10 print:grid print:grid-cols-[minmax(0,1fr)_14rem] print:items-start print:gap-6">
          <div className="min-w-0 max-w-4xl">{children}</div>
          <aside className="mt-10 max-w-4xl xl:mt-0 print:mt-0">{spalte}</aside>
        </div>
      ) : (
        children
      )}
    </main>
  );
}
