import { forwardRef } from "react";
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
   Desktop besser als jede eigene Nachbildung. Gespeist aus denselben
   --field-*-Component-Tokens wie das TextField. */
function DateTimeBase(
  { label, supportingText, error = false, id, className, type, ...props }:
    DateTimeFieldProps & { type: "date" | "time" },
  ref: React.Ref<HTMLInputElement>,
) {
  const fid = id ?? `dtf-${type}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={className}>
      <label
        htmlFor={fid}
        className={cn(
          "mb-1 block px-1 font-mono text-[10px] uppercase tracking-wider",
          error ? "text-(--field-error)" : "text-(--field-label)",
        )}
      >
        {label}
      </label>
      <input
        id={fid}
        ref={ref}
        type={type}
        className={cn(
          "type-body-large h-14 w-full rounded-(--field-shape) border-[1.5px] bg-transparent px-4 text-(--field-text) outline-none transition-[border-color] duration-150 focus:border-2",
          error
            ? "border-(--field-error)"
            : "border-(--field-outline) focus:border-(--field-focus)",
        )}
        {...props}
      />
      {supportingText && (
        <p
          className={cn(
            "type-body-small mt-1 px-4",
            error ? "text-(--field-error)" : "text-(--field-label)",
          )}
        >
          {supportingText}
        </p>
      )}
    </div>
  );
}

export const DateField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) =>
  DateTimeBase({ ...props, type: "date" }, ref),
);
DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) =>
  DateTimeBase({ ...props, type: "time" }, ref),
);
TimeField.displayName = "TimeField";
