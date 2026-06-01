import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "outlined" | "filled";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  variant?: Variant;
  supportingText?: string;
  error?: boolean;
}

// Schwebendes Label (KiFu-Label-Stil: mono/uppercase). Float via :placeholder-shown
// (Input trägt placeholder=" "). Ruhend vertikal in der Feldmitte (top-1/2).
const labelBase =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider transition-all duration-150 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:text-[10px]";

/* M3 Text-Field — outlined (Default) & filled, mit schwebendem Label,
   Supporting-Text und Error-State. Gespeist aus --field-*-Component-Tokens.
   Filled-Focus bewusst NICHT M3 (dicke Unterkante), sondern KiFu-Primary-Ring.
   Kein Hook -> direkt in Server Components nutzbar; `id` optional. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, variant = "outlined", supportingText, error = false, id, className, ...props },
    ref,
  ) => {
    const fid = id ?? `tf-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const outlined = variant === "outlined";

    return (
      <div className={className}>
        {/* Eigener relative-Wrapper nur um Input + Label -> Label mittet im Feld,
            nicht im Block inkl. Supporting-Text. */}
        <div className="relative">
          <input
            id={fid}
            ref={ref}
            placeholder=" "
            className={cn(
              "peer type-body-large h-14 w-full px-4 text-(--field-text) outline-none transition-[border-color,box-shadow] duration-150",
              outlined
                ? cn(
                    "rounded-(--field-shape) border-[1.5px] bg-transparent focus:border-2",
                    error
                      ? "border-(--field-error)"
                      : "border-(--field-outline) focus:border-(--field-focus)",
                  )
                : cn(
                    // Filled-Focus: KiFu-Primary-Ring ums Feld (NICHT M3 dicke Unterkante).
                    "rounded-t-(--field-shape) border-b-[1.5px] bg-(--field-container) pt-3",
                    error
                      ? "border-(--field-error) focus:shadow-[0_0_0_2px_var(--color-error)]"
                      : "border-(--field-outline) focus:shadow-[0_0_0_2px_var(--color-primary)]",
                  ),
            )}
            {...props}
          />
          <label
            htmlFor={fid}
            className={cn(
              labelBase,
              outlined
                ? "bg-surface px-1 peer-focus:top-0 peer-[:not(:placeholder-shown)]:top-0"
                : "peer-focus:top-3 peer-focus:translate-y-0 peer-[:not(:placeholder-shown)]:top-3 peer-[:not(:placeholder-shown)]:translate-y-0",
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
