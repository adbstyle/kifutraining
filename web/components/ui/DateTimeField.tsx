import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface DateTimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* Datums- und Zeitfeld (Team-Epic Story 7).
   Bewusst KEIN schwebendes Label wie beim TextField: native date/time-Inputs
   zeigen immer eine Platzhalter-Maske („tt.mm.jjjj"), das Label schwebte also
   sofort und dauerhaft — die Animation wäre reine Irritation. Stattdessen ein
   fest darüberstehendes Label im selben mono/uppercase-Stil.

   Das native Steuerelement ist Absicht: Datumsauswahl, Tastatureingabe und
   Lokalisierung kommen vom Betriebssystem und funktionieren mobil wie am
   Desktop besser als jede eigene Nachbildung. Kontur, Höhe und Fokus folgen
   dem TextField. Das feststehende Label trägt `type-label-small` wie die
   Beschriftungen über Select und MultiSelect — `type-plakette` gehört dem
   schwebenden Label, das sich beim Stanzen der Kontur kleiner macht.

   Eigene Komponente (statt einer bloss aufgerufenen Funktion), damit `useId`
   ein regulärer Hook-Aufruf in einem eigenen Render bleibt. */
const DateTimeBase = forwardRef<
  HTMLInputElement,
  DateTimeFieldProps & { type: "date" | "time" }
>(({ label, supportingText, error = false, id, className, type, ...props }, ref) => {
  // Feld-id aus React statt aus dem Label-Text: Dialoge halten ihre Felder auch
  // im geschlossenen Zustand im DOM (natives <dialog>), zwei gleichzeitig
  // gemountete Dialoge mit gleichem Label ergäben sonst dieselbe id — Label-Klick
  // und Screenreader träfen das Feld im falschen Dialog.
  const reactId = useId();
  const fid = id ?? `dtf-${type}-${reactId}`;
  return (
    <div className={className}>
      <label
        htmlFor={fid}
        className={cn(
          "type-label-small mb-1 block px-1",
          error ? "text-error" : "text-on-surface-mittel",
        )}
      >
        {label}
      </label>
      <input
        id={fid}
        ref={ref}
        type={type}
        className={cn(
          "type-body-large h-14 w-full rounded-flaeche kontur bg-transparent px-4 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2",
          error ? "border-error" : "border-kante focus:border-primary",
        )}
        {...props}
      />
      {supportingText && (
        <p
          className={cn(
            "type-body-small mt-1 px-4",
            error ? "text-error" : "text-on-surface-mittel",
          )}
        >
          {supportingText}
        </p>
      )}
    </div>
  );
});
DateTimeBase.displayName = "DateTimeBase";

export const DateField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) => (
  <DateTimeBase {...props} type="date" ref={ref} />
));
DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) => (
  <DateTimeBase {...props} type="time" ref={ref} />
));
TimeField.displayName = "TimeField";
