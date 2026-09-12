import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { feldLabelBase, feldLabelSchwebend } from "./TextField";

export interface DateTimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* Datums- und Zeitfeld (Team-Epic Story 7).
   Das Label liegt auf der Kontur wie am TextField, aber es SCHWEBT nicht: Ein
   natives date/time-Input zeigt immer seine Platzhalter-Maske („tt.mm.jjjj"),
   es gäbe also keine Ruhelage im Feld und die Animation liefe nie. Es steht
   von Anfang an oben — wie bei der Einfachauswahl, die aus demselben Grund
   immer einen Wert hat.

   Das native Steuerelement ist Absicht: Datumsauswahl, Tastatureingabe und
   Lokalisierung kommen vom Betriebssystem und funktionieren mobil wie am
   Desktop besser als jede eigene Nachbildung. Kontur, Höhe und Fokus folgen
   dem TextField.

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
      <div className="relative">
        <input
          id={fid}
          ref={ref}
          type={type}
          className={cn(
            "peer type-body-large h-14 w-full rounded-flaeche kontur bg-transparent px-4 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2",
            error ? "border-error" : "border-kante focus:border-primary",
          )}
          {...props}
        />
        <label
          htmlFor={fid}
          className={cn(
            feldLabelBase,
            feldLabelSchwebend,
            "left-3",
            error
              ? "text-error"
              : "text-on-surface-mittel peer-focus:text-primary",
          )}
        >
          {label}
        </label>
      </div>
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
