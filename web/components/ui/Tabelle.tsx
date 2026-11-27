"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Eine Liste als Tabelle (Spielerliste, Mitglieder; PO 2026-10-17): Fläche
   elev-01, darüber eine Kopfzeile mit den Spaltennamen, die Zeilen durch
   Linien getrennt, die Aktionen rechts als Symbolknöpfe. Ab sm stehen die
   Spalten im Raster `spalten` (eine `sm:grid-cols-[…]`-Klasse), schmal ordnet
   jede Zeile ihren Inhalt selbst — meist die Angaben unter dem Namen.

   Die Kopfzeile ist nur fürs Auge (ihre Namen aria-hidden): Vorgelesen wird
   eine Liste, deren Knöpfe ihre Zeile im Namen tragen. Ein Spaltenname kann
   statt Text ein Element sein, etwa mit einem ⓘ für einen festen Hinweis zur
   Spalte (#483); das bleibt bedienbar und vorlesbar. Kopf und Zeilen teilen Raster und
   Ränder, damit die Spalten genau übereinander stehen. */

/* Ab wann das Raster gilt: `fenster` ab der Fensterbreite sm; `behaelter`
   ab einer Breite der Tabelle selbst von 42 rem (Container-Abfrage) — für
   eine Liste, die neben einem Detail schmal wird (Spielerliste mit der
   Teilnahme daneben, #700). Die Zeilen nennen ihre Klassen dann mit
   `@2xl/tabelle:` statt `sm:`. Literale Klassen: Tailwind findet nur, was
   ausgeschrieben dasteht. */
const RASTER = {
  fenster: { huelle: "", raster: "sm:grid" },
  behaelter: { huelle: "@container/tabelle", raster: "@2xl/tabelle:grid" },
} as const;

const Spalten = createContext({ spalten: "", raster: RASTER.fenster.raster as string });

export function Tabelle({
  spalten,
  kopf,
  rasterAb = "fenster",
  className,
  children,
}: {
  /** Das Raster ab sm, z. B. `sm:grid-cols-[minmax(0,1fr)_3rem]` (bei
   *  `rasterAb="behaelter"` mit `@2xl/tabelle:` statt `sm:`). */
  spalten: string;
  /** Die Spaltennamen; leer für die Spalte der Aktionen. Ein Element statt
   *  Text bleibt für die Vorlesehilfe sichtbar (z. B. mit `InfoKnopf`). */
  kopf: ReactNode[];
  /** Ab der Fensterbreite (Standard) oder ab der eigenen Breite. */
  rasterAb?: keyof typeof RASTER;
  className?: string;
  children: ReactNode;
}) {
  const { huelle, raster } = RASTER[rasterAb];
  return (
    <div className={cn("overflow-hidden rounded-flaeche bg-elev-01", huelle, className)}>
      <div
        className={cn(
          "hidden gap-3 border-b border-linie py-2 pl-4 pr-2 type-label-small text-on-surface-mittel",
          raster,
          spalten,
        )}
      >
        {kopf.map((name, i) =>
          typeof name === "string" ? (
            <span key={i} aria-hidden>
              {name}
            </span>
          ) : (
            <span key={i}>{name}</span>
          ),
        )}
      </div>
      <ul className="divide-y divide-linie">
        <Spalten.Provider value={{ spalten, raster }}>{children}</Spalten.Provider>
      </ul>
    </div>
  );
}

export function TabellenZeile({ children }: { children: ReactNode }) {
  const { spalten, raster } = useContext(Spalten);
  return <li className={cn("state flex min-h-12 items-center gap-3 py-1 pl-4 pr-2", raster, spalten)}>{children}</li>;
}
