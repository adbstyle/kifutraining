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
// (Input trägt placeholder=" "). Gespeist aus --field-*-Component-Tokens.
const labelBase =
  "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider transition-all duration-150 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:text-[10px]";

/* M3 Text-Field — outlined (Default) & filled, mit schwebendem Label,
   Supporting-Text und Error-State. Kein Hook -> direkt in Server Components
   nutzbar; `id` optional (sonst aus dem Label abgeleitet). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, variant = "outlined", supportingText, error = false, id, className, ...props },
    ref,
  ) => {
    const fid = id ?? `tf-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const outlined = variant === "outlined";

    return (
      <div className={cn("relative", className)}>
        <input
          id={fid}
          ref={ref}
          placeholder=" "
          className={cn(
            "peer type-body-large h-14 w-full px-4 text-(--field-text) outline-none transition-colors",
            outlined
              ? "rounded-(--field-shape) border-[1.5px] bg-transparent focus:border-2"
              : "rounded-t-(--field-shape) border-b-[1.5px] bg-(--field-container) pt-3 focus:border-b-2",
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
