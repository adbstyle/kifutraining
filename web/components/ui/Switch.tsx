import type { InputHTMLAttributes } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* Ein Schalter für eine Ja/Nein-Angabe, die sofort wirkt — angemeldet oder
   abgemeldet an einem Termin (Epic #433). Neu neben der `Checkbox`: Die
   Checkbox gehört in ein Formular, das man erst speichert; der Schalter
   speichert beim Umlegen (Atlassian: «Toggle» nur für sofort wirkende
   Änderungen). Darunter liegt ein echtes `<input type="checkbox"
   role="switch">` — Tastatur, Fokus und Vorlesehilfe kommen vom Browser.
   Es braucht eine eigene Breite und Höhe: `inset-0` allein spannt es auf
   iOS nicht auf, dort behält eine Checkbox auch mit `appearance-none` ihre
   Eigengrösse von rund 16 px (die Bahn schrumpfte zum Punkt oben links).

   Nach dem Vorbild von Proton (PO 2026-10-25): Die Bahn ist nur eine Kontur
   ohne Fläche, die Farbe trägt allein der Knopf. An: Knopf rechts in Primary
   mit Haken; aus: Knopf links im gedämpften Weiss mit Kreuz. Beide Lagen
   tragen ein Zeichen, damit der Zustand nicht an der Farbe allein hängt. Rot
   gibt es am Schalter nicht, auch nicht in langen Listen — ein Fehlen, das
   auffallen soll, zeigen Lozenge und Kalenderblatt. Diese Form löst die gefüllte
   (an Lila, aus Rot) ab.

   `ton="ruhig"` (Epic #490, #498; Form seit PO 2026-10-30): für «angemeldet»
   und «da» von Spieler:innen an Trainings — am privaten Link und in der
   Spielerliste am Termin — und für die Selbstabholung, deren Aus kein Fehlen
   bedeutet. Die frühere Form `neutral` (kleiner Knopf ohne Zeichen) entfällt
   (PO 2026-10-30). Der Schalter zeigt den Stand, ohne ihn zu
   bewerten: dieselbe Form wie Primary, aber der Knopf bleibt in beiden Lagen
   grau — an rechts mit Haken, aus links mit Kreuz. Den Stand tragen Lage und
   Zeichen, nicht die Farbe. */
export function Switch({
  className,
  disabled,
  ton = "primary",
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  /** Primary nach Proton oder ruhig: dieselbe Form, Knopf immer grau (Spieler:innen an Trainings). */
  ton?: "primary" | "ruhig";
}) {
  const primary = ton === "primary";
  return (
    <span className={cn("relative inline-flex h-8 w-[52px] shrink-0 items-center", disabled && "opacity-40", className)}>
      <input
        type="checkbox"
        role="switch"
        disabled={disabled}
        className="peer focus-ring kontur absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full border-kante bg-transparent disabled:cursor-not-allowed"
        {...rest}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-[3px] size-[26px] rounded-full bg-on-surface-mittel transition-[left,background-color] motion-reduce:transition-none peer-checked:left-[23px]",
          primary && "peer-checked:bg-primary",
        )}
      />
      <X aria-hidden size={14} strokeWidth={3} className="pointer-events-none absolute left-[9px] text-elev-01 peer-checked:hidden" />
      <Check
        aria-hidden
        size={14}
        strokeWidth={3}
        className={cn(
          "pointer-events-none absolute left-[29px] hidden peer-checked:block",
          primary ? "text-on-primary" : "text-elev-01",
        )}
      />
    </span>
  );
}
