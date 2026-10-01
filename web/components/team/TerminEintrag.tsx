"use client";

import { cn } from "@/lib/cn";

/** Wie ein Termin im Monatsüberblick steht (#329 AK 5–7). */
export type EintragZustand = "training" | "noch-nicht" | "ohne" | "ausgefallen";

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
  const text =
    zustand === "ausgefallen" ? "Ausgefallen"
    : zustand === "training" ? name
    : zustand === "noch-nicht" ? "Noch kein Training"
    : "Ohne Training";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "focus-ring mt-1 block min-h-6 w-full break-words rounded-plakette px-1 text-left type-body-small",
        zustand === "ausgefallen" && "text-on-surface-mittel line-through",
        zustand === "training" && "bg-elev-08 text-on-surface",
        zustand === "noch-nicht" && "kontur border-error text-error",
        zustand === "ohne" && "text-on-surface-mittel",
      )}
    >
      {beginn ? `${beginn} ` : <span className="text-error">Zeit fehlt </span>}
      {text}
    </button>
  );
}
