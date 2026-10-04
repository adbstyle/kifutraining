import { forwardRef } from "react";
import type { ReactNode, TextareaHTMLAttributes } from "react";
import { Feld, beschreibungIdVon, useFeldId } from "./feld";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  /** Fester Hinweis hinter einem ⓘ (siehe `Feld`). */
  info?: ReactNode;
  error?: boolean;
}

/* Text-Area (mehrzeilig) — natives <textarea>: Enter = Zeilenumbruch. Name über
   dem Feld und Feldkasten wie beim TextField (`Feld`, `feldkasten`). Leer ist
   sie zwei Zeilen hoch, damit man ihr ansieht, dass hier mehr als ein Wort
   hineingehört (Epic #363); sie wächst mit dem Inhalt (CSS field-sizing) bis
   rund zehn Zeilen, danach scrollt sie. Leer steht der Name als Platzhalter
   im Feld (siehe `Feld`). */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, supportingText, info, error = false, id, className, ...props }, ref) => {
    const fid = useFeldId(id);
    return (
      <Feld id={fid} label={label} hinweis={supportingText} info={info} error={error} className={className}>
        <textarea
          id={fid}
          ref={ref}
          placeholder={label}
          aria-invalid={error || undefined}
          aria-describedby={beschreibungIdVon(fid, supportingText, info)}
          // min-h-16 = zwei Zeilen à 24 px plus Polster und Kontur. Oben nur
          // 4 px: Die erste Zeile beginnt so auf derselben Höhe wie der Wert
          // eines einzeiligen Felds, und der Name hält ruhend zu ihr denselben
          // Abstand wie dort (`.feld-rahmen > .feld-name`).
          className="feldkasten type-body-large field-sizing-content block min-h-16 max-h-[17rem] w-full resize-none overflow-y-auto px-3 pt-1 pb-1.5"
          {...props}
        />
      </Feld>
    );
  },
);
TextArea.displayName = "TextArea";
