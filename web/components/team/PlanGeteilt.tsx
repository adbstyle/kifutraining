"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSpaltenGriff } from "@/components/layout/ZweiSpalten";
import { cn } from "@/lib/cn";

/* Trainingsplan und geöffneter Termin nebeneinander (#435), ab `lg` wie die
   geteilte Fläche eines Trainings (`ZweiSpalten`, Epic #369): Beide Spalten
   reichen bis zum unteren Rand des Fensters und scrollen für sich, die Seite
   selbst nicht; dazwischen der Griff, mit dem man den Termin breiter oder
   schmaler zieht (`useSpaltenGriff`, dieselbe Breite wie die zweispaltigen
   Seiten).

   Anders als dort steht der Plan unter Kopfzeile und Reitern des Teams, die
   für alle Ansichten gleich bleiben (Team-Layout). Darum misst die Fläche,
   wie viel Höhe unter ihr bleibt, und gibt sie als Variable weiter; ob sie
   gilt, entscheidet allein das CSS (`lg:`), auf Papier nie. Bis gemessen ist,
   steht eine Schätzung da, damit beim ersten Laden nichts springt.
   Schmaler als `lg` steht nur der Termin (der Plan blendet seine Liste aus). */
export function PlanGeteilt({ links, rechts, listeRef }: { links: ReactNode; rechts: ReactNode; listeRef: React.Ref<HTMLDivElement> }) {
  const flaeche = useRef<HTMLDivElement>(null);
  const { griff, stil, ziehend } = useSpaltenGriff(flaeche, "Terminspalte");
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

  const scroll = "lg:h-full lg:overflow-y-auto lg:overscroll-contain print:h-auto print:overflow-visible";
  return (
    <div
      ref={flaeche}
      style={{ ...stil, ...(hoehe !== null && { "--plan-hoehe": `${hoehe}px` }) } as CSSProperties}
      className={cn(
        // Plan · Griff · Termin. Ohne gezogene Breite wächst der Termin von
        // 26 bis 32 rem mit dem Fenster; nie mehr als die halbe Fläche.
        "lg:grid lg:h-[var(--plan-hoehe,calc(100dvh-11rem))] lg:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--spalte-breite,clamp(26rem,30vw,32rem)),50%)] lg:grid-rows-[minmax(0,1fr)] lg:gap-x-4 print:block print:h-auto",
        ziehend && "cursor-col-resize select-none",
      )}
    >
      {/* Platz für Fokusringe am Rand der Scrollfläche. */}
      <div ref={listeRef} className={cn("min-w-0 max-lg:hidden lg:-ml-1 lg:pb-10 lg:pl-1 lg:pr-1", scroll)}>
        {links}
      </div>
      {griff("hidden lg:block print:hidden")}
      <div className={cn("min-w-0 rounded-flaeche bg-elev-02 p-4 print:hidden", scroll)}>{rechts}</div>
    </div>
  );
}
