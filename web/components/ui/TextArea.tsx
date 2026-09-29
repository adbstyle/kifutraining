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
   ihre Stufe selbst (`[--feld-grund:var(--color-elev-NN)]`).
   Mit `placeholder` sagt das leere Feld mehr, als das Label trägt: Der
   Platzhalter steht im Feld (und bricht um, wo er nicht in eine Zeile passt),
   das Label erscheint erst geschwebt — beim Fokus oder sobald etwas dasteht.
   Dasselbe Wechselspiel wie bei der Mehrfachauswahl, die ruhend ihren
   Platzhalter und geschwebt ihr Label zeigt. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      supportingText,
      error = false,
      id,
      className,
      rows = 3,
      placeholder,
      ...props
    },
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
            // Ohne eigenen Platzhalter treibt ein Leerzeichen die Float-Mechanik (:placeholder-shown).
            placeholder={placeholder ?? " "}
            className={cn(
              // field-sizing-content: wächst mit Inhalt; min ~3 Zeilen, max-h-[17rem] ≈ 10 Zeilen + Padding, dann Scroll.
              "peer type-body-large field-sizing-content block min-h-[6.5rem] max-h-[17rem] w-full resize-none overflow-y-auto rounded-flaeche kontur bg-transparent px-4 pb-3 pt-5 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2 placeholder:text-on-surface-mittel",
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
              "pointer-events-none absolute left-3 bg-(--feld-grund,var(--color-elev-00)) px-1 transition-all duration-150",
              placeholder
                ? // Immer in der Schwebelage; unsichtbar (aber vorgelesen), solange der Platzhalter spricht.
                  "top-0 -translate-y-1/2 type-body-small opacity-0 peer-focus:opacity-100 peer-[:not(:placeholder-shown)]:opacity-100"
                : "top-5 type-body-large peer-focus:top-0 peer-focus:-translate-y-1/2 peer-focus:type-body-small peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:-translate-y-1/2 peer-[:not(:placeholder-shown)]:type-body-small",
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
