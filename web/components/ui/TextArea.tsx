import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextAreaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* M2 Text-Area (outlined, mehrzeilig) — natives <textarea>: Enter = Zeilenumbruch.
   Wächst mit dem Inhalt (CSS field-sizing) bis max. ~10 Zeilen, danach scrollt es.
   Schwebendes Label (top-aligned), Supporting-Text + Error-State. Kontur und
   Label folgen dem TextField, inklusive `--feld-grund`: Das schwebende Label
   stanzt die Kontur aus und braucht die Farbe der Fläche dahinter — der
   Grund (00dp) als Vorgabe; Card, Unterblock, Übungszeile und Dialog setzen
   ihre Stufe selbst (`[--feld-grund:var(--color-elev-NN)]`). */
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
              "peer type-body-large field-sizing-content block min-h-[6.5rem] max-h-[17rem] w-full resize-none overflow-y-auto rounded-flaeche kontur bg-transparent px-4 pb-3 pt-5 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2",
              error ? "border-error" : "border-kante focus:border-primary",
            )}
            {...props}
          />
          <label
            htmlFor={fid}
            className={cn(
              // Wie beim TextField (siehe `feldLabelBase` dort): ruhend in der
              // Schrift des Werts, geschwebt als Marke auf der Kontur. Nur die
              // Ruhelage ist eine andere — nicht die Feldmitte, sondern die
              // erste Zeile (top-5 = pt-5 des Felds), weil das Feld mehrzeilig
              // ist und der Wert oben anfängt.
              "pointer-events-none absolute left-3 top-5 type-body-large bg-(--feld-grund,var(--color-elev-00)) px-1 transition-all duration-150",
              "peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:type-body-small",
              "peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:type-body-small",
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
  },
);
TextArea.displayName = "TextArea";
