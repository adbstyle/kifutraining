import { forwardRef } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Feld, beschreibungIdVon, useFeldId } from "./feld";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  /** Fester Hinweis hinter einem ⓘ (siehe `Feld`). */
  info?: ReactNode;
  error?: boolean;
  /** Den Namen nur der Vorlesehilfe geben (siehe `Feld`) — wo er schon
   *  daneben steht, etwa in einer bearbeitbaren Eigenschaft. */
  labelVersteckt?: boolean;
}

/* Text-Area (mehrzeilig) — natives <textarea>: Enter = Zeilenumbruch. Name über
   dem Feld und Feldkasten wie beim TextField (`Feld`, `feldkasten`). Leer ist
   sie zwei Zeilen hoch, damit man ihr ansieht, dass hier mehr als ein Wort
   hineingehört (Epic #363); sie wächst mit dem Inhalt (CSS field-sizing) bis
   rund zehn Zeilen, danach scrollt sie. Leer steht der Name als Platzhalter
   im Feld (siehe `Feld`). */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, supportingText, info, error = false, labelVersteckt, id, className, ...props }, ref) => {
    const fid = useFeldId(id);
    return (
      <Feld
        id={fid}
        label={label}
        labelVersteckt={labelVersteckt}
        hinweis={supportingText}
        info={info}
        error={error}
        className={className}
      >
        <textarea
          id={fid}
          ref={ref}
          placeholder={label}
          aria-invalid={error || undefined}
          aria-describedby={beschreibungIdVon(fid, supportingText, info)}
          // min-h-16 = zwei Zeilen à 24 px plus Polster und Kontur. Oben nur
          // 4 px: Die erste Zeile beginnt so auf derselben Höhe wie der Wert
          // eines einzeiligen Felds, und der Name hält ruhend zu ihr denselben
          // Abstand wie dort (`.feld-rahmen .feld-name`).
          // Mit ⓘ rechts 40 px frei: Es liegt beim Überfahren über dem Kasten (`Feld`).
          className={cn(
            "feldkasten type-body-large field-sizing-content block min-h-16 max-h-[17rem] w-full resize-none overflow-y-auto px-3 pt-1 pb-1.5",
            !!info && "pr-10",
          )}
          {...props}
        />
      </Feld>
    );
  },
);
TextArea.displayName = "TextArea";
