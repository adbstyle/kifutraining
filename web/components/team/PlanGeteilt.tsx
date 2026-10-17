"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Ziehgriff } from "@/components/ui";
import { useSeitenleiste } from "@/components/layout/AppRahmen";
import { cn } from "@/lib/cn";
import { SPALTE_MAX, SPALTE_MIN, begrenzeSpalte } from "@/lib/spalte";

/* Trainingsplan und geöffneter Termin nebeneinander (#435), ab `lg` wie die
   geteilte Fläche eines Trainings (`ZweiSpalten`, Epic #369): Beide Spalten
   reichen bis zum unteren Rand des Fensters und scrollen für sich, die Seite
   selbst nicht; dazwischen der Griff, mit dem man den Termin breiter oder
   schmaler zieht. Die gezogene Breite ist dieselbe wie auf den
   zweispaltigen Seiten (Cookie, `lib/spalte.ts`).

   Anders als dort steht der Plan unter Kopfzeile und Reitern des Teams, die
   für alle Ansichten gleich bleiben (Team-Layout). Darum misst die Fläche
   selbst, wie viel Höhe unter ihr bleibt, statt die ganze Seite zu teilen.
   Schmaler als `lg` steht nur der Termin (der Plan blendet seine Liste aus). */
export function PlanGeteilt({ links, rechts, listeRef }: { links: ReactNode; rechts: ReactNode; listeRef: React.Ref<HTMLDivElement> }) {
  const { spalte: gespeichert, setzeSpalte } = useSeitenleiste();
  const [ziehend, setZiehend] = useState<number | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const [hoehe, setHoehe] = useState<number | null>(null);
  const [gemessen, setGemessen] = useState<number | null>(null);
  const breite = ziehend ?? gespeichert;

  /** Die Breite der Spur des Termins — aus dem Raster selbst. */
  const spurBreite = () => {
    const el = flaeche.current;
    if (!el) return null;
    const px = parseFloat(getComputedStyle(el).gridTemplateColumns.split(" ")[2] ?? "");
    return Number.isFinite(px) ? Math.round(px) : null;
  };

  // Die Höhe bis zum unteren Rand des Fensters, abzüglich des unteren Rands
  // der Seite — nur ab `lg`, wo beide nebeneinander stehen.
  useEffect(() => {
    const breit = window.matchMedia("(min-width: 64rem)");
    const messen = () => {
      const el = flaeche.current;
      if (!el || !breit.matches) return setHoehe(null);
      const oben = el.getBoundingClientRect().top + window.scrollY;
      const main = el.closest("main");
      const unten = main ? parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0;
      setHoehe(Math.max(320, Math.floor(window.innerHeight - oben - unten)));
      setGemessen(spurBreite());
    };
    messen();
    window.addEventListener("resize", messen);
    breit.addEventListener("change", messen);
    return () => {
      window.removeEventListener("resize", messen);
      breit.removeEventListener("change", messen);
    };
  }, []);
  useEffect(() => setGemessen(spurBreite()), [breite]);

  const scroll = "lg:h-full lg:overflow-y-auto lg:overscroll-contain";
  return (
    <div
      ref={flaeche}
      style={
        {
          ...(breite !== null && { "--spalte-breite": `${breite}px` }),
          ...(hoehe !== null && { height: `${hoehe}px` }),
        } as CSSProperties
      }
      className={cn(
        // Plan · Griff · Termin. Ohne gezogene Breite wächst der Termin von
        // 26 bis 32 rem mit dem Fenster; nie mehr als die halbe Fläche.
        "lg:grid lg:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--spalte-breite,clamp(26rem,30vw,32rem)),50%)] lg:grid-rows-[minmax(0,1fr)] lg:gap-x-4",
        ziehend !== null && "cursor-col-resize select-none",
      )}
    >
      {/* Platz für Fokusringe am Rand der Scrollfläche. */}
      <div ref={listeRef} className={cn("min-w-0 max-lg:hidden lg:-ml-1 lg:pb-10 lg:pl-1 lg:pr-1", scroll)}>
        {links}
      </div>
      <Ziehgriff
        name="Breite des Termins"
        seite="rechts"
        min={SPALTE_MIN}
        max={SPALTE_MAX}
        wert={breite ?? gemessen}
        messen={spurBreite}
        begrenzen={(px) => begrenzeSpalte(px, flaeche.current?.getBoundingClientRect().width ?? 0)}
        onZiehen={setZiehend}
        onSetzen={setzeSpalte}
        className="hidden lg:block"
      />
      <div className={cn("min-w-0 rounded-flaeche bg-elev-02 p-4 print:hidden", scroll)}>{rechts}</div>
    </div>
  );
}
