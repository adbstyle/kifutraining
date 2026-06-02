import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
  supportingText?: string;
}

/* M3-nahes Select (outlined), passend zu TextField/TextArea: gleiches Feld-Token-
   Kontrakt, eckige KiFu-Form. Kein schwebendes Label (natives Select zeigt immer
   einen Wert) -> Label darüber. Gespeist aus --field-*-Component-Tokens. */
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, options, supportingText, id, className, ...props }, ref) => {
    const fid = id ?? `sf-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return (
      <div className={className}>
        <label htmlFor={fid} className="type-label-small mb-2 block text-(--field-label)">
          {label}
        </label>
        <div className="relative">
          <select
            id={fid}
            ref={ref}
            className="focus-ring type-body-large h-12 w-full appearance-none rounded-(--field-shape) border-[1.5px] border-(--field-outline) bg-surface px-3 pr-10 text-(--field-text)"
            {...props}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
        </div>
        {supportingText && (
          <p className="type-body-small mt-1 px-1 text-(--field-label)">{supportingText}</p>
        )}
      </div>
    );
  },
);
SelectField.displayName = "SelectField";
