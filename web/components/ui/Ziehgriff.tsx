"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Ein Tastendruck verschiebt die Grenze um so viel. */
const SCHRITT = 16;

/**
 * Der Griff zwischen zwei Spalten einer geteilten Fläche: eine ruhige Linie
 * in der Trennfarbe, beim Zeigen, Fokus und Ziehen in Primary. Gezogen wird
 * mit der Maus oder per Pfeiltaste (Home/End: schmalste bzw. breiteste),
 * Doppelklick stellt die Vorgabe wieder her. Er trägt die Rolle `separator`
 * mit Wert und Grenzen für die Vorlesehilfe.
 *
 * Der Griff kennt nur die Spalte, die er verbreitert (`seite`: links oder
 * rechts von ihm); Grenzen und Speichern bleiben beim Aufrufer. Während des
 * Ziehens meldet er jede Breite (`onZiehen`), gespeichert wird beim Loslassen
 * (`onSetzen`) — so schreibt nicht jede Mausbewegung ein Cookie.
 */
export function Ziehgriff({
  name,
  seite,
  min,
  max,
  wert,
  messen,
  begrenzen,
  onZiehen,
  onSetzen,
  className,
}: {
  /** Wie die Vorlesehilfe den Griff nennt, z. B. «Breite der Einordnung». */
  name: string;
  /** Wo die Spalte liegt, deren Breite er ändert. */
  seite: "links" | "rechts";
  min: number;
  max: number;
  /** Die Breite der Spalte, soweit bekannt (Vorlesehilfe, Pfeiltasten). */
  wert: number | null;
  /** Misst die Breite, wo `wert` fehlt — nur beim Zugbeginn und bei
   *  Pfeiltasten aufgerufen, nie im Render. */
  messen?: () => number | null;
  /** Holt eine Breite in die Grenzen (auch die der Fläche). */
  begrenzen: (px: number) => number;
  /** Laufende Breite während des Ziehens; `null` am Ende. */
  onZiehen: (px: number | null) => void;
  /** Gewählte Breite; `null` = zurück zur Vorgabe. */
  onSetzen: (px: number | null) => void;
  className?: string;
}) {
  const start = useRef<{ x: number; breite: number } | null>(null);
  const [gezogen, setGezogen] = useState<number | null>(null);
  // Zum Zeiger hin wächst die Spalte: links von ihm nach rechts ziehen.
  const richtung = seite === "links" ? 1 : -1;

  const breite = () => wert ?? messen?.() ?? null;

  const beenden = (setzen: boolean) => {
    if (setzen && gezogen !== null) onSetzen(gezogen);
    start.current = null;
    setGezogen(null);
    onZiehen(null);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={name}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={gezogen ?? wert ?? undefined}
      tabIndex={0}
      title="Ziehen, um die Breite zu ändern - Doppelklick stellt sie zurück"
      onPointerDown={(e) => {
        const anfang = breite();
        if (anfang === null) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { x: e.clientX, breite: anfang };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        // Die neue Breite ist die alte plus die Strecke — so bleibt die Linie
        // unter dem Zeiger, und ein Klick ohne Bewegung ändert nichts.
        const px = begrenzen(start.current.breite + richtung * (e.clientX - start.current.x));
        setGezogen(px);
        onZiehen(px);
      }}
      onPointerUp={() => beenden(true)}
      onPointerCancel={() => beenden(false)}
      onDoubleClick={() => onSetzen(null)}
      onKeyDown={(e) => {
        const jetzt = breite() ?? min;
        const ziel =
          e.key === "ArrowRight" ? jetzt + richtung * SCHRITT
          : e.key === "ArrowLeft" ? jetzt - richtung * SCHRITT
          : e.key === "Home" ? min
          : e.key === "End" ? max
          : null;
        if (ziel === null) return;
        e.preventDefault();
        onSetzen(begrenzen(ziel));
      }}
      className={cn(
        "group focus-ring relative cursor-col-resize touch-none select-none rounded-full print:hidden",
        className,
      )}
    >
      {/* Die Fläche des Griffs ist breiter als die Linie darin. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-linie transition-[width,background-color] group-hover:w-0.5 group-hover:bg-primary group-focus-visible:w-0.5 group-focus-visible:bg-primary",
          gezogen !== null && "w-0.5 bg-primary",
        )}
      />
    </div>
  );
}
