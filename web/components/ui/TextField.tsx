import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  supportingText?: string;
  error?: boolean;
  /** Führendes Icon (Lucide) im Feld — z. B. Lupe für Suche. Input und Label
      rücken automatisch ein, damit nichts mit dem Icon überlappt. */
  leadingIcon?: LucideIcon;
}

// Schwebendes Label (KiFu-Label-Stil: mono/uppercase). Float via :placeholder-shown
// (Input trägt placeholder=" "). Ruhend vertikal in der Feldmitte (top-1/2).
const labelBase =
  "pointer-events-none absolute top-1/2 -translate-y-1/2 bg-surface px-1 font-mono text-xs uppercase tracking-wider transition-all duration-150 peer-focus:top-0 peer-focus:text-[10px] peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:text-[10px]";

// Horizontale Lage des Labels. Ohne Icon konstant bei left-3 (Text bündig mit
// dem Input-px-4). Mit Icon ruht das Label rechts neben dem Icon (left-10) und
// springt im schwebenden Zustand zurück auf left-3 — dort sitzt es auf der
// oberen Kante oberhalb des Icons, kollidiert also nicht.
const labelLeftRest = "left-3";
const labelLeftIcon =
  "left-10 peer-focus:left-3 peer-[:not(:placeholder-shown)]:left-3";

/* M3 Text-Field (outlined) mit schwebendem Label, optionalem führenden Icon,
   Supporting-Text und Error-State. Gespeist aus --field-*-Component-Tokens.
   `id` optional (sonst von React vergeben). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    { label, supportingText, error = false, leadingIcon: Icon, id, className, ...props },
    ref,
  ) => {
    // Feld-id aus React statt aus dem Label-Text: Dialoge halten ihre Felder auch
    // im geschlossenen Zustand im DOM (natives <dialog>), zwei gleichzeitig
    // gemountete Dialoge mit gleichem Label ergäben sonst dieselbe id — Label-Klick
    // und Screenreader träfen das Feld im falschen Dialog.
    const reactId = useId();
    const fid = id ?? `tf-${reactId}`;

    return (
      <div className={className}>
        {/* Eigener relative-Wrapper nur um Icon + Input + Label -> alles mittet im Feld. */}
        <div className="relative">
          {Icon && (
            <Icon
              size={18}
              strokeWidth={2}
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
          )}
          <input
            id={fid}
            ref={ref}
            placeholder=" "
            className={cn(
              "peer type-body-large h-14 w-full rounded-(--field-shape) border-[1.5px] bg-transparent px-4 text-(--field-text) outline-none transition-[border-color] duration-150 focus:border-2",
              Icon && "pl-11",
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
              Icon ? labelLeftIcon : labelLeftRest,
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
