import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* M3 Text-Area (outlined, mehrzeilig) — natives <textarea>: Enter = Zeilenumbruch.
   Wächst mit dem Inhalt (CSS field-sizing) bis max. ~10 Zeilen, danach scrollt es.
   Schwebendes Label (top-aligned), Supporting-Text + Error-State. Gespeist aus
   --field-*-Component-Tokens. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { label, supportingText, error = false, id, className, rows = 3, ...props },
    ref,
  ) => {
    // Feld-id aus React statt aus dem Label-Text: Dialoge halten ihre Felder auch
    // im geschlossenen Zustand im DOM (natives <dialog>), zwei gleichzeitig
    // gemountete Dialoge mit gleichem Label ergäben sonst dieselbe id — Label-Klick
    // und Screenreader träfen das Feld im falschen Dialog.
    const reactId = useId();
    const fid = id ?? `ta-${reactId}`;

    return (
      <div className={className}>
        <div className="relative">
          <textarea
            id={fid}
            ref={ref}
            rows={rows}
            placeholder=" "
            className={cn(
              // field-sizing-content: wächst mit Inhalt; min ~3 Zeilen, max-h-[17rem] ≈ 10 Zeilen + Padding, dann Scroll.
              "peer type-body-large field-sizing-content block min-h-[6.5rem] max-h-[17rem] w-full resize-none overflow-y-auto rounded-(--field-shape) border-[1.5px] bg-transparent px-4 pb-3 pt-5 text-(--field-text) outline-none transition-[border-color] duration-150 focus:border-2",
              error
                ? "border-(--field-error)"
                : "border-(--field-outline) focus:border-(--field-focus)",
            )}
            {...props}
          />
          <label
            htmlFor={fid}
            className={cn(
              "pointer-events-none absolute left-3 top-4 bg-surface px-1 font-mono text-xs uppercase tracking-wider transition-all duration-150",
              "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:text-[10px]",
              "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:text-[10px]",
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
TextArea.displayName = "TextArea";
