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
   auffallen soll, zeigen Lozenge und Kalenderblatt. Diese eine Form löst die
   gefüllte (an Lila, aus Rot) und den Ton «ruhig» (#490, #498) ab.

   `neutral`: kleiner grauer Knopf, ohne Zeichen — für einen Termin, an dem es
   nichts zu wählen gibt (ausgefallen), und für die Aus-Lage eines Schalters,
   dessen Aus kein Fehlen bedeutet (die Selbstabholung, #438). */
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
        className="peer focus-ring kontur absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-full border-kante bg-transparent disabled:cursor-not-allowed"
        {...rest}
      />
      {neutral ? (
        <span aria-hidden className="pointer-events-none absolute left-2 size-4 rounded-full bg-on-surface-mittel peer-checked:left-7" />
      ) : (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute left-[3px] size-[26px] rounded-full bg-on-surface-mittel transition-[left,background-color] motion-reduce:transition-none peer-checked:left-[23px] peer-checked:bg-primary"
          />
          <X aria-hidden size={14} strokeWidth={3} className="pointer-events-none absolute left-[9px] text-elev-01 peer-checked:hidden" />
          <Check aria-hidden size={14} strokeWidth={3} className="pointer-events-none absolute left-[29px] hidden text-on-primary peer-checked:block" />
        </>
      )}
    </span>
  );
}
