"use client";

import { cn } from "@/lib/cn";

/** Wie ein Termin im Monatsüberblick steht (#329 AK 5–7). */
export type EintragZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

/** Der Text, den der Zustand zeigt — für die Anzeige und den zugänglichen Namen. */
export function eintragText(zustand: EintragZustand, name?: string): string {
  return zustand === "ausgefallen" ? "Ausgefallen"
    : zustand === "training" ? (name ?? "")
    : zustand === "noch-nicht" ? "Noch kein Training"
    : "Ohne Training";
}

/* Ein Termin im Monatsraster: Beginn (oder «Zeit fehlt») und, was er trägt.
   Der Zustand steht immer als WORT da und nie nur als Farbe: das Training mit
   seinem Namen, «Noch kein Training» (anstehend, Fehlerkontur), «Ohne
   Training» (vergangen, leise), «Ausgefallen» (durchgestrichen). Alle Schriften
   bleiben bei 4.5:1 und besser — auch «Ausgefallen», das wesentlicher Inhalt
   ist und darum nicht die tiefe Schrift der Deaktivierung trägt. */
export function TerminEintrag({
  beginn,
  zustand,
  name,
  label,
  onClick,
}: {
  beginn: string | null;
  zustand: EintragZustand;
  /** Der Name des Trainings; nur bei `training`. */
  name?: string;
  /** Der zugängliche Name des Knopfes (Datum, Zeit, Zustand). */
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "focus-ring mt-1 block min-h-6 w-full break-words hyphens-auto rounded-plakette px-1 text-left type-body-small",
        zustand === "ausgefallen" && "text-on-surface-mittel line-through",
        zustand === "training" && "bg-elev-08 text-on-surface",
        zustand === "noch-nicht" && "kontur border-error text-error",
        zustand === "ohne" && "text-on-surface-mittel",
      )}
    >
      {beginn ? `${beginn} ` : <span className="text-error">Zeit fehlt </span>}
      {eintragText(zustand, name)}
    </button>
  );
}
