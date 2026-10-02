"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SPALTE_MAX, SPALTE_MIN, begrenzeSpalte } from "@/lib/spalte";
import { useSeitenleiste } from "./AppRahmen";

/** Ein Tastendruck verschiebt die Grenze um so viel. */
const SCHRITT = 16;

/**
 * Inhalt links, eine zweite Spalte rechts daneben (Epic #350) — die
 * Einordnung einer Übung auf ihrer Seite und in ihrer Maske.
 *
 * Ab `xl` ist die Fläche geteilt: Beide Spalten füllen die Breite und die
 * Höhe bis zum unteren Rand, und jede scrollt für sich; die Seite selbst
 * scrollt nicht. Dafür braucht der Aufrufer eine Fläche fester Höhe
 * (`Seitenrahmen` mit `geteilt`). Die Spalte rechts wächst bis 26 rem mit dem
 * Fenster; zwischen beiden liegt ein Griff, mit dem der Trainer sie breiter
 * oder schmaler zieht — mit der Maus oder per Pfeiltaste, Doppelklick stellt
 * die Vorgabe wieder her. Die Wahl gilt für alle zweispaltigen Seiten
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
 * `beiseite`: Die Spalte ist ergänzender Inhalt (`aside`, Übungsseite). In der
 * Maske trägt sie Pflichtfelder und ist darum ein gewöhnlicher Block — eine
 * Vorlesehilfe soll sie nicht als Nebensache ankündigen.
 */
export function ZweiSpalten({
  spalte,
  spalteZuerst = false,
  druckDaneben = false,
  beiseite = true,
  children,
  className,
}: {
  spalte: ReactNode;
  spalteZuerst?: boolean;
  druckDaneben?: boolean;
  beiseite?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { spalte: gespeichert, setzeSpalte } = useSeitenleiste();
  // Während des Ziehens folgt die Breite nur hier; gespeichert wird beim
  // Loslassen, damit nicht jede Mausbewegung ein Cookie schreibt.
  const [ziehend, setZiehend] = useState<number | null>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  const rechtsRef = useRef<HTMLElement>(null);
  const breite = ziehend ?? gespeichert;

  const flaechenBreite = () => flaeche.current?.getBoundingClientRect().width ?? 0;
  const ausZeiger = (clientX: number) => {
    const rect = flaeche.current!.getBoundingClientRect();
    return begrenzeSpalte(rect.right - clientX, rect.width);
  };

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
      ref={rechtsRef as React.RefObject<HTMLDivElement>}
      className={cn(
        "min-w-0 max-w-4xl xl:col-start-3 xl:row-start-1 xl:max-w-none xl:-mr-1 xl:pl-1 xl:pr-1",
        druckDaneben && "print:col-start-2 print:row-start-1",
        scroll,
      )}
    >
      {spalte}
    </Spalte>
  );
  const griff = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite der Einordnung"
      aria-valuemin={SPALTE_MIN}
      aria-valuemax={SPALTE_MAX}
      aria-valuenow={breite ?? undefined}
      tabIndex={0}
      title="Ziehen, um die Breite zu ändern — Doppelklick stellt sie zurück"
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setZiehend(ausZeiger(e.clientX));
      }}
      onPointerMove={(e) => {
        if (ziehend !== null) setZiehend(ausZeiger(e.clientX));
      }}
      onPointerUp={() => {
        if (ziehend !== null) setzeSpalte(ziehend);
        setZiehend(null);
      }}
      onPointerCancel={() => setZiehend(null)}
      onDoubleClick={() => setzeSpalte(null)}
      onKeyDown={(e) => {
        const aktuell = breite ?? rechtsRef.current?.getBoundingClientRect().width ?? SPALTE_MIN;
        const ziel =
          e.key === "ArrowLeft" ? aktuell + SCHRITT
          : e.key === "ArrowRight" ? aktuell - SCHRITT
          : e.key === "Home" ? SPALTE_MAX
          : e.key === "End" ? SPALTE_MIN
          : null;
        if (ziel === null) return;
        e.preventDefault();
        setzeSpalte(begrenzeSpalte(ziel, flaechenBreite()));
      }}
      className="group focus-ring relative hidden cursor-col-resize touch-none select-none rounded-full xl:col-start-2 xl:row-start-1 xl:block print:hidden"
    >
      {/* Die Linie: ruhig in der Trennfarbe, beim Zeigen, Fokus und Ziehen
          in Primary — die Fläche des Griffs ist breiter als die Linie. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linie transition-[width,background-color] group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary",
          ziehend !== null && "w-0.5 bg-primary",
        )}
      />
    </div>
  );

  return (
    <div
      ref={flaeche}
      style={breite !== null ? ({ "--spalte-breite": `${breite}px` } as CSSProperties) : undefined}
      className={cn(
        "flex flex-col gap-10",
        // Inhalt · Griff · Spalte. Ohne gezogene Breite wächst die Spalte von
        // 20 bis 26 rem mit dem Fenster; nie mehr als die halbe Fläche.
        "xl:grid xl:grid-cols-[minmax(0,1fr)_0.75rem_min(var(--spalte-breite,clamp(20rem,22vw,26rem)),50%)] xl:grid-rows-[minmax(0,1fr)] xl:gap-x-4 xl:gap-y-0",
        ziehend !== null && "cursor-col-resize select-none",
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
