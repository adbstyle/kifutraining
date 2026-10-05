import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SeitenKopf } from "./SeitenKopf";
import { ZweiSpalten } from "./ZweiSpalten";

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
 * gehört der zweiten Spalte (`spalte`, etwa die Einordnung einer Übung).
 * Jede Seite hat Brotkrumen — darum ist `krumen` Pflicht.
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
  spalteNurBreit = false,
  spaltenName,
  spalteBeiseite,
  geteilt = false,
  children,
}: {
  breite: keyof typeof BREITE;
  krumen: BreadcrumbItem[] | null;
  aktionen?: ReactNode;
  /** Der Pfad steht auch auf dem Papier (Trainingsansicht). */
  kopfImDruck?: boolean;
  /** Auf Papier die volle Breite ohne Rand — für die Druckansicht. */
  druckVoll?: boolean;
  /** Die zweite Spalte rechts neben dem Inhalt (Epic #350, `ZweiSpalten`):
   *  ab `xl` daneben, schmaler nach dem Inhalt, auf Papier daneben. Setzt
   *  `geteilt` mit. */
  spalte?: ReactNode;
  /** Die Spalte nur nebeneinander, nie gestapelt und nie auf Papier
   *  (`ZweiSpalten` `nurBreit`) — das Training (#370). */
  spalteNurBreit?: boolean;
  /** Wie der Griff die Spalte nennt (`ZweiSpalten` `spaltenName`). */
  spaltenName?: string;
  /** Ist die Spalte ergänzender Inhalt (`ZweiSpalten` `beiseite`)? */
  spalteBeiseite?: boolean;
  /** Ab `xl` eine geteilte Fläche: Die Seite füllt Breite und Höhe des
   *  Fensters und scrollt nicht selbst — das tun die Spalten darin
   *  (`ZweiSpalten`). Die Maske setzt es selbst, weil ihr Formular die Spalten
   *  trägt; es wächst dann als einziges Kind auf die freie Höhe. `breite` gilt
   *  darunter. */
  geteilt?: boolean;
  children: ReactNode;
}) {
  const flaeche = geteilt || !!spalte;
  return (
    <main
      className={cn(
        "px-4 py-8 sm:px-6 sm:py-10 lg:pt-0",
        BREITE[breite],
        druckVoll && "print:max-w-none print:px-0 print:py-0",
        flaeche && "xl:flex xl:h-dvh xl:max-w-none xl:flex-col xl:pb-0 print:block print:h-auto",
      )}
    >
      {krumen && (
        // Ab `lg` ist die Kopfzeile 64 px hoch, die Brotkrumen in ihrer Mitte —
        // auf einer Linie mit der Marke der Seitenleiste —, und der Inhalt
        // beginnt direkt darunter. Schmaler läuft sie mit und hält Abstand.
        <SeitenKopf krumen={krumen} aktionen={aktionen} imDruck={kopfImDruck} className="mb-6 lg:mb-0" />
      )}
      {spalte ? (
        <ZweiSpalten
          spalte={spalte}
          druckDaneben={!spalteNurBreit}
          nurBreit={spalteNurBreit}
          spaltenName={spaltenName}
          beiseite={spalteBeiseite}
          className="xl:min-h-0 xl:flex-1">
          {children}
        </ZweiSpalten>
      ) : (
        children
      )}
    </main>
  );
}
