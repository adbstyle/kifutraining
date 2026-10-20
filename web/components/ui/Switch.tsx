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

   Beide Lagen tragen ein Zeichen im Knopf, damit der Zustand nicht an der
   Farbe allein hängt: an in Primary mit Haken, aus im Rot des abgemeldeten
   Kalenderblatts mit Kreuz (PO 2026-10-16). `neutral`: grau und ohne Zeichen
   — für einen Termin, an dem es nichts zu wählen gibt (ausgefallen), und für
   die Aus-Lage eines Schalters, dessen Aus kein Fehlen bedeutet (die
   Selbstabholung, #438). */
export function Switch({
  className,
  disabled,
  neutral = false,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & {
  /** Ohne Bedeutung von an/aus: grau, ohne Zeichen. */
  neutral?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex h-8 w-[52px] shrink-0 items-center", disabled && "opacity-40", className)}>
      <input
        type="checkbox"
        role="switch"
        disabled={disabled}
        className={cn(
          "peer focus-ring absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full border-2 transition-colors disabled:cursor-not-allowed",
          neutral
            ? "border-kante bg-transparent"
            : "border-on-lozenge-danger bg-lozenge-danger checked:border-primary checked:bg-primary",
        )}
        {...rest}
      />
      {neutral ? (
        <span aria-hidden className="pointer-events-none absolute left-2 h-4 w-4 rounded-full bg-on-surface-mittel" />
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-on-lozenge-danger text-lozenge-danger transition-[left] peer-checked:left-6 peer-checked:bg-on-primary peer-checked:text-primary"
          />
          <X aria-hidden size={16} strokeWidth={3} className="pointer-events-none absolute left-2 text-lozenge-danger peer-checked:hidden" />
          <Check aria-hidden size={16} strokeWidth={3} className="pointer-events-none absolute left-7 hidden text-primary peer-checked:block" />
        </>
      )}
    </span>
  );
}
