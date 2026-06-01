import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

// Schwebendes Label (KiFu-Label-Stil: mono/uppercase). Float via :placeholder-shown
// (Input trägt placeholder=" "). Ruhend vertikal in der Feldmitte (top-1/2).
const labelBase =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 bg-surface px-1 font-mono text-xs uppercase tracking-wider transition-all duration-150 peer-focus:top-0 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[10px]";

/* M3 Text-Field (outlined) mit schwebendem Label, Supporting-Text und
   Error-State. Gespeist aus --field-*-Component-Tokens. Kein Hook -> direkt in
   Server Components nutzbar; `id` optional (sonst aus dem Label abgeleitet). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, supportingText, error = false, id, className, ...props }, ref) => {
    const fid = id ?? `tf-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    return (
      <div className={className}>
        {/* Eigener relative-Wrapper nur um Input + Label -> Label mittet im Feld. */}
        <div className="relative">
          <input
            id={fid}
            ref={ref}
            placeholder=" "
            className={cn(
              "peer type-body-large h-14 w-full rounded-(--field-shape) border-[1.5px] bg-transparent px-4 text-(--field-text) outline-none transition-[border-color] duration-150 focus:border-2",
              error
                ? "border-(--field-error)"
                : "border-(--field-outline) focus:border-(--field-focus)",
            )}
            {...props}
          />
          <label
            htmlFor={fid}
            className={cn(
              labelBase,
              error
                ? "text-(--field-error)"
                : "text-(--field-label) peer-focus:text-(--field-focus)",
            )}
          >
            {label}
          </label>
        </div>
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
  },
);
TextField.displayName = "TextField";
