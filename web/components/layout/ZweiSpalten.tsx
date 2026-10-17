"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { SPALTE_MAX, SPALTE_MIN, begrenzeSpalte } from "@/lib/spalte";
import { Ziehgriff } from "@/components/ui";
import { useSeitenleiste } from "./AppRahmen";

/**
 * Der Griff einer geteilten Fläche samt Breite: die gespeicherte Wahl
 * (Cookie über `useSeitenleiste`), die laufende beim Ziehen und die
 * tatsächlich gemessene Spur (Vorlesehilfe, Pfeiltasten). Die Spalte ist die
 * dritte Spur des Rasters von `flaeche` (Inhalt · Griff · Spalte). Geteilt von
 * `ZweiSpalten` und dem Trainingsplan mit geöffnetem Termin (`PlanGeteilt`).
 */
export function useSpaltenGriff(flaeche: RefObject<HTMLDivElement | null>, spaltenName: string) {
  const { spalte: gespeichert, setzeSpalte } = useSeitenleiste();
  // Während des Ziehens folgt die Breite nur hier; gespeichert wird beim
  // Loslassen, damit nicht jede Mausbewegung ein Cookie schreibt.
  const [ziehend, setZiehend] = useState<number | null>(null);
  const [gemessen, setGemessen] = useState<number | null>(null);
  const breite = ziehend ?? gespeichert;

  /** Die Breite der Spur, die die Spalte belegt — aus dem Raster selbst,
   *  unabhängig von Innenabständen und Rändern der Spalte. */
  const spurBreite = () => {
    const el = flaeche.current;
    if (!el) return null;
    const px = parseFloat(getComputedStyle(el).gridTemplateColumns.split(" ")[2] ?? "");
    return Number.isFinite(px) ? Math.round(px) : null;
  };

  useEffect(() => {
    const el = flaeche.current;
    if (!el) return;
    const messen = () => setGemessen(spurBreite());
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(el);
    return () => beobachter.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breite]);

  const griff = (className: string) => (
    <Ziehgriff
      name={`Breite der ${spaltenName}`}
      seite="rechts"
      min={SPALTE_MIN}
      max={SPALTE_MAX}
      wert={breite ?? gemessen}
      messen={spurBreite}
      begrenzen={(px) => begrenzeSpalte(px, flaeche.current?.getBoundingClientRect().width ?? 0)}
      onZiehen={setZiehend}
      onSetzen={setzeSpalte}
      className={className}
    />
  );
  /** Die gezogene oder gespeicherte Breite als Variable des Rasters. */
  const stil = breite !== null ? ({ "--spalte-breite": `${breite}px` } as CSSProperties) : undefined;
  return { griff, stil, ziehend: ziehend !== null };
}

/**
 * Inhalt links, eine zweite Spalte rechts daneben — die Einordnung einer
 * Übung auf ihrer Seite und in ihrer Maske (Epic #350), die Eigenschaften
 * eines Trainings oder seine geöffnete Übung neben seinen Übungen (Epic #369).
 *
 * Ab `xl` ist die Fläche geteilt: Beide Spalten füllen die Breite und die
 * Höhe bis zum unteren Rand, und jede scrollt für sich; die Seite selbst
 * scrollt nicht. Dafür braucht der Aufrufer eine Fläche fester Höhe
 * (`Seitenrahmen` mit `geteilt`). Die Spalte rechts wächst bis 26 rem mit dem
 * Fenster; zwischen beiden liegt ein Griff, mit dem der Trainer sie breiter
 * oder schmaler zieht — mit der Maus oder per Pfeiltaste (Home/End: schmalste
 * bzw. breiteste), Doppelklick stellt die Vorgabe wieder her. Die Wahl gilt für alle zweispaltigen Seiten
 * (Cookie, siehe `lib/spalte.ts`).
 *
 * Darunter stehen beide untereinander, der Inhalt in seiner Lesebreite
 * (`max-w-4xl`), und die Seite scrollt wie jede andere.
 *
 * `spalteZuerst`: Gestapelt steht die Spalte VOR dem Inhalt — in der Maske,
 * wo die Einordnung bestimmt, welche Felder der Inhalt verlangt (#353 AK 6).
 * Sonst folgt sie ihm (Übungsseite). Der Quelltext folgt in beiden Fällen der
 * gestapelten Reihenfolge, so lesen Tastatur und Vorlesehilfe überall gleich.
 *
 * `druckDaneben`: Auf Papier bleibt die Spalte daneben, schmaler als am
 * Schirm (Übungsblatt).
 *
 * `nurBreit`: Die Spalte gibt es nur nebeneinander — gestapelt und auf Papier
 * fehlt sie, und der Inhalt steht allein (Training, #370: schmal bleibt der
 * bisherige Aufbau). Eine Ausnahme kennt sie: Trägt eine Maske darin
 * ungesicherte Angaben (`data-ungesichert`), bleibt die Spalte auch gestapelt
 * stehen, damit sich die Angaben noch sichern lassen, wenn das Fenster
 * während des Bearbeitens schmal wird (#372 AK 5). Die Weiche ist CSS — die
 * Spalte muss dafür nichts über ihren Inhalt wissen.
 *
 * `beiseite`: Die Spalte ist ergänzender Inhalt (`aside`, Übungsseite). In der
 * Maske trägt sie Pflichtfelder und ist darum ein gewöhnlicher Block — eine
 * Vorlesehilfe soll sie nicht als Nebensache ankündigen.
 */
export function ZweiSpalten({
  spalte,
  spalteZuerst = false,
  druckDaneben = false,
  nurBreit = false,
  spaltenName = "Einordnung",
  beiseite = true,
  children,
  className,
}: {
  spalte: ReactNode;
  spalteZuerst?: boolean;
  druckDaneben?: boolean;
  nurBreit?: boolean;
  /** Wie der Griff die Spalte nennt («Breite der …»). */
  spaltenName?: string;
  beiseite?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const flaeche = useRef<HTMLDivElement>(null);
  const { griff: zeichneGriff, stil, ziehend } = useSpaltenGriff(flaeche, spaltenName);

  const scroll = "xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pb-10 print:h-auto print:overflow-visible print:pb-0";
  const inhalt = (
    <div
      className={cn(
        "min-w-0 max-w-4xl xl:col-start-1 xl:row-start-1 xl:max-w-none",
        // Platz für Fokusringe am Rand der Scrollfläche, ohne die Flucht zu verschieben.
        "xl:-ml-1 xl:pl-1 xl:pr-1",
        scroll,
      )}
    >
      {children}
    </div>
  );
  const Spalte = beiseite ? "aside" : "div";
  const rechts = (
    <Spalte
      className={cn(
        "min-w-0 max-w-4xl xl:col-start-3 xl:row-start-1 xl:max-w-none xl:-mr-1 xl:pl-1 xl:pr-1",
        druckDaneben && "print:col-start-2 print:row-start-1",
        nurBreit && "hidden xl:block has-[[data-ungesichert]]:block print:hidden!",
        scroll,
      )}
    >
      {spalte}
    </Spalte>
  );
  const griff = zeichneGriff("hidden xl:col-start-2 xl:row-start-1 xl:block");

  return (
    <div
      ref={flaeche}
      style={stil}
      className={cn(
        "flex flex-col gap-10",
        // Inhalt · Griff · Spalte. Ohne gezogene Breite wächst die Spalte von
        // 20 bis 26 rem mit dem Fenster; nie mehr als die halbe Fläche.
        "xl:grid xl:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--spalte-breite,clamp(20rem,22vw,26rem)),50%)] xl:grid-rows-[minmax(0,1fr)] xl:gap-x-4 xl:gap-y-0",
        ziehend && "cursor-col-resize select-none",
        druckDaneben &&
          "print:grid print:grid-cols-[minmax(0,1fr)_14rem] print:items-start print:gap-6",
        className,
      )}
    >
      {spalteZuerst ? (
        <>
          {rechts}
          {griff}
          {inhalt}
        </>
      ) : (
        <>
          {inhalt}
          {griff}
          {rechts}
        </>
      )}
    </div>
  );
}
