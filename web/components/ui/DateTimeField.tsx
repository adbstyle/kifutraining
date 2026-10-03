import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { Feld, hinweisIdVon, useFeldId } from "./feld";

export interface DateTimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* Datums- und Zeitfeld (Team-Epic Story 7). Name über dem Feld und Feldkasten
   wie beim TextField (`Feld`, `feldkasten`), 36 px hoch.

   Das native Steuerelement ist Absicht: Datumsauswahl, Tastatureingabe und
   Lokalisierung kommen vom Betriebssystem und funktionieren mobil wie am
   Desktop besser als jede eigene Nachbildung.

   Eigene Komponente (statt einer bloss aufgerufenen Funktion), damit `useId`
   ein regulärer Hook-Aufruf in einem eigenen Render bleibt. */
const DateTimeBase = forwardRef<
  HTMLInputElement,
  DateTimeFieldProps & { type: "date" | "time" }
>(({ label, supportingText, error = false, id, className, type, ...props }, ref) => {
  const fid = useFeldId(id);
  return (
    <Feld id={fid} label={label} hinweis={supportingText} error={error} className={className}>
      <input
        id={fid}
        ref={ref}
        type={type}
        aria-invalid={error || undefined}
        aria-describedby={hinweisIdVon(fid, supportingText)}
        className="feldkasten type-body-large h-9 w-full px-3"
        {...props}
      />
    </Feld>
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
