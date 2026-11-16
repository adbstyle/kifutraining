"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSpaltenGriff } from "@/components/layout/ZweiSpalten";
import { cn } from "@/lib/cn";

/* Eine Liste und das Detail des ausgewählten Eintrags nebeneinander — im
   Team der Trainingsplan mit dem geöffneten Termin (#435), in der
   Trainingsübersicht die Tabelle mit dem ausgewählten Training (#630). Ab
   `lg` wie die geteilte Fläche eines Trainings (`ZweiSpalten`, Epic #369):
   Beide Spalten reichen bis zum unteren Rand des Fensters und scrollen für
   sich, die Seite selbst nicht; dazwischen der Griff, mit dem man das Detail
   breiter oder schmaler zieht (`useSpaltenGriff`, dieselbe Breite wie die
   zweispaltigen Seiten).

   Anders als dort steht die Liste unter Kopfzeile, Reitern oder Filtern, die
   für alle Ansichten gleich bleiben. Darum misst die Fläche, wie viel Höhe
   unter ihr bleibt, und gibt sie als Variable weiter; ob sie gilt,
   entscheidet allein das CSS (`lg:`), auf Papier nie. Bis gemessen ist, steht
   eine Schätzung da, damit beim ersten Laden nichts springt.
   Schmaler als `lg` steht nur das Detail: Es ersetzt die Liste, bis man es
   schliesst.

   Ohne Detail (`rechts` leer) steht die Liste allein im Fluss der Seite. Wer
   die Fläche dann trotzdem rendert, behält beim Öffnen und Schliessen
   dieselben Elemente der Liste — samt Fokus-Gedächtnis und Zustand darin
   (Trainingsübersicht). */
export function ListeMitDetail({
  links,
  rechts,
  listeRef,
  spaltenName,
}: {
  links: ReactNode;
  /** Das Detail; leer (`null`, `false`) = nur die Liste. */
  rechts: ReactNode;
  listeRef?: React.Ref<HTMLDivElement>;
  /** Der Name der Detailspalte für den Griff (Vorlesehilfe), etwa
   *  «Terminspalte». */
  spaltenName: string;
}) {
  const flaeche = useRef<HTMLDivElement>(null);
  const { griff, stil, ziehend } = useSpaltenGriff(flaeche, spaltenName);
  const [hoehe, setHoehe] = useState<number | null>(null);

  // Die Höhe bis zum unteren Rand des Fensters, abzüglich des unteren Rands
  // der Seite. Neu gemessen, wenn das Fenster oder die Seite darüber ihre
  // Grösse ändert (etwa ein Hinweis, der erscheint).
  useLayoutEffect(() => {
    const el = flaeche.current;
    const main = el?.closest("main");
    if (!el) return;
    const messen = () => {
      const oben = el.getBoundingClientRect().top + window.scrollY;
      const unten = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      setHoehe(Math.max(320, Math.floor(window.innerHeight - oben - unten)));
    };
    messen();
    window.addEventListener("resize", messen);
    const beobachter = new ResizeObserver(messen);
    if (main) beobachter.observe(main);
    return () => {
      window.removeEventListener("resize", messen);
      beobachter.disconnect();
    };
  }, []);

  const geteilt = rechts !== null && rechts !== undefined && rechts !== false;
  const scroll = "lg:h-full lg:overflow-y-auto lg:overscroll-contain print:h-auto print:overflow-visible";
  return (
    <div
      ref={flaeche}
      style={{ ...stil, ...(hoehe !== null && { "--plan-hoehe": `${hoehe}px` }) } as CSSProperties}
      className={cn(
        geteilt &&
        // Liste · Griff · Detail. Ohne gezogene Breite wächst das Detail von
        // 26 bis 32 rem mit dem Fenster; nie mehr als die halbe Fläche.
        "lg:grid lg:h-[var(--plan-hoehe,calc(100dvh-11rem))] lg:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--spalte-breite,clamp(26rem,30vw,32rem)),50%)] lg:grid-rows-[minmax(0,1fr)] lg:gap-x-4 print:block print:h-auto",
        ziehend && "cursor-col-resize select-none",
      )}
    >
      {/* Platz für Fokusringe am Rand der Scrollfläche. */}
      <div ref={listeRef} className={cn("min-w-0", geteilt && "max-lg:hidden lg:-ml-1 lg:pb-10 lg:pl-1 lg:pr-1", geteilt && scroll)}>
        {links}
      </div>
      {geteilt && griff("hidden lg:block print:hidden")}
      {geteilt && <div className={cn("min-w-0 rounded-flaeche bg-elev-02 p-4 print:hidden", scroll)}>{rechts}</div>}
    </div>
  );
}
