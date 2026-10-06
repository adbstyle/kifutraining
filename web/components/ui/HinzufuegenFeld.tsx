"use client";

import { useId } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InfoKnopf } from "./InfoKnopf";

/* «… hinzufügen» in einer wiederholbaren Liste von Feldern (nach dem Vorbild
   von «Add subtask» in Jira, PO 2026-10-06): kein Textknopf, sondern eine
   Zeile, die aussieht wie ein leeres Feld — gleiche Höhe (36 px), gleicher
   Einzug und gleiche Schrift wie der Name im leeren Feldkasten, ruhend ohne
   Fläche, beim Überfahren dieselbe leise Aufhellung wie eine Angabe
   (`.hinzufuegen-feld` in globals.css). Ohne Zeichen (PO 2026-10-06): Der
   Text «… hinzufügen» sagt schon, was ein Klick tut, und steht so genau dort,
   wo in einem leeren Feld sein Name stünde.

   `info` ist der fachliche Hinweis zur ganzen Liste — was ein Eintrag ist —
   hinter einem ⓘ rechts in der Zeile, sichtbar nur beim Überfahren wie bei
   einem Feld (Styleguide, Formularfelder › Hinweise); die Vorlesehilfe hört
   ihn mit dem Knopf. */
export function HinzufuegenFeld({
  children,
  info,
  className,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: string;
  /** Fester fachlicher Hinweis hinter dem ⓘ. */
  info?: ReactNode;
}) {
  const infoId = useId();
  return (
    <div className={cn("hinzufuegen-zeile relative", className)}>
      <button
        type="button"
        aria-describedby={info ? infoId : undefined}
        className={cn(
          "hinzufuegen-feld focus-ring type-body-large flex h-9 w-full items-center rounded-flaeche",
          "px-3.5 text-left text-on-surface-mittel",
          "disabled:cursor-not-allowed disabled:opacity-50",
          info ? "pr-11" : undefined,
        )}
        {...props}
      >
        {children}
      </button>
      {info && (
        <>
          <div className="feld-info absolute inset-y-0 right-0 flex items-center">
            <InfoKnopf label={children}>{info}</InfoKnopf>
          </div>
          <span id={infoId} className="sr-only">
            {info}
          </span>
        </>
      )}
    </div>
  );
}
