import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { Feld, hinweisIdVon, useFeldId } from "./feld";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  supportingText?: string;
  error?: boolean;
}

/* Text-Area (mehrzeilig) — natives <textarea>: Enter = Zeilenumbruch. Name über
   dem Feld und Feldkasten wie beim TextField (`Feld`, `feldkasten`). Leer ist
   sie zwei Zeilen hoch, damit man ihr ansieht, dass hier mehr als ein Wort
   hineingehört (Epic #363); sie wächst mit dem Inhalt (CSS field-sizing) bis
   rund zehn Zeilen, danach scrollt sie. Ein Platzhalter steht im Feld und
   bricht um, wo er nicht in eine Zeile passt. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, supportingText, error = false, id, className, ...props }, ref) => {
    const fid = useFeldId(id);
    return (
      <Feld id={fid} label={label} hinweis={supportingText} error={error} className={className}>
        <textarea
          id={fid}
          ref={ref}
          aria-invalid={error || undefined}
          aria-describedby={hinweisIdVon(fid, supportingText)}
          // min-h-16 = zwei Zeilen à 24 px plus Polster und Kontur.
          className="feldkasten type-body-large field-sizing-content block min-h-16 max-h-[17rem] w-full resize-none overflow-y-auto px-3 py-1.5"
          {...props}
        />
      </Feld>
    );
  },
);
TextArea.displayName = "TextArea";
