import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { ZahlInput } from "./ZahlInput";
import { Feld, hinweisIdVon, useFeldId } from "./feld";
import { cn } from "@/lib/cn";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Der Hinweis unter dem Feld. `ReactNode`, damit ein Teil davon anders
      gefärbt sein kann als der Rest — Anlass war die Gruppenzeile (Story #151),
      die Zeitsumme und Konflikt in einer Zeile trug, nur den Konflikt gefärbt. */
  supportingText?: ReactNode;
  error?: boolean;
  /** Ein BEFUND am Feld, keine Fehleingabe — der Wert ist gespeichert und
      richtig erfasst, geht aber mit anderen nicht auf (Story #151: ungleich
      lange Übungen im selben Wechsel). Befund und Fehleingabe tragen dieselbe
      Farbe; sie unterscheiden sich in `aria-invalid` und im Verhalten, nicht
      im Bild — eine eigene dritte Farbe hätte niemand gelernt, und sie stünde
      neben Error nur für «auch schlimm». Rangfolge am Rahmen:
      error > befund > focus — was sich nicht speichern lässt, verdrängt den
      Hinweis auf etwas Gespeichertes, und beide überdauern den Fokus. */
  befund?: boolean;
  /** Name nur für die Vorlesehilfe — für Felder, deren Zweck Platzhalter und
      Ort schon sagen (die Suche in der Filterleiste). */
  labelVersteckt?: boolean;
  /** Kontur auch in Ruhe. Für Felder ohne sichtbaren Namen, die neben
      umrandeten Knöpfen stehen — ohne Kante wären sie dort schlicht nicht da. */
  umrandet?: boolean;
  /** Ein bedienbares Zeichen am rechten Feldrand — das Auge im Passwortfeld,
      das Kreuz im Suchfeld. Bedienbares steht im Kit rechts im Feld. */
  trailing?: ReactNode;
}

/** Das Zeichen am rechten Feldrand selbst: ein Knopf auf voller Feldhöhe. Die
 *  Aufrufer legen ihn in `trailing`; der Slot dafür gehört dem Feld. */
export const feldTrailingKnopf =
  "state focus-ring flex h-full items-center rounded-flaeche px-2 text-on-surface-mittel";

/* Text-Feld (Epic #363): der Name steht über dem Feld (`Feld`), der Feldkasten
   ist 36 px hoch und ruhend ohne Kontur und Fläche, beim Überfahren leise
   aufgehellt, im Fokus Primary, im Fehler Error (`feldkasten` in globals.css).
   Leer steht der Name als Platzhalter im Feld (siehe `Feld`); ein eigener
   `placeholder` ersetzt ihn nur dort, wo kein Name sichtbar ist (Suche in der
   Filterleiste). `id` optional (sonst von React vergeben). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      supportingText,
      error = false,
      befund = false,
      labelVersteckt = false,
      umrandet = false,
      trailing,
      id,
      className,
      ...props
    },
    ref,
  ) => {
    // Zahlenfelder zählen nie von selbst: keine Pfeile im Feld (Klassen
    // unten), und weder Pfeiltasten noch Mausrad ändern den Wert (`ZahlInput`).
    const zahl = props.type === "number";
    const Eingabe = zahl ? ZahlInput : "input";
    const fid = useFeldId(id);

    return (
      <Feld
        id={fid}
        label={label}
        labelVersteckt={labelVersteckt}
        hinweis={supportingText}
        error={error}
        className={className}
      >
        <div className="relative">
          <Eingabe
            id={fid}
            ref={ref}
            // `error` zusätzlich als aria-invalid, weil der rote Rahmen allein
            // nur sehend wahrnehmbar ist; der Befund ist keine Fehleingabe.
            // Der Name ist der Platzhalter: Leer steht er im Feld, und
            // `:placeholder-shown` sagt dem Rahmen, dass das Feld leer ist.
            placeholder={label}
            aria-invalid={error || undefined}
            aria-describedby={hinweisIdVon(fid, supportingText)}
            data-befund={befund || undefined}
            data-umrandet={umrandet || undefined}
            className={cn(
              "feldkasten type-body-large h-9 w-full px-3",
              trailing ? "pr-10" : undefined,
              // Das Suchfeld trägt sein eigenes Kreuz; das von WebKit für
              // `type="search"` gezeichnete wäre ein zweites ohne Unterschied.
              props.type === "search" && "[&::-webkit-search-cancel-button]:appearance-none",
              zahl &&
                "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            )}
            {...props}
          />
          {trailing && <span className="absolute inset-y-0 right-0 flex">{trailing}</span>}
        </div>
      </Feld>
    );
  },
);
TextField.displayName = "TextField";
