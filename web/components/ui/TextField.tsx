import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
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
  /** Führendes Icon (Lucide) im Feld — z. B. Lupe für Suche. Input und Label
      rücken automatisch ein, damit nichts mit dem Icon überlappt. */
  leadingIcon?: LucideIcon;
  /** Dichte Variante für Filterzeilen und dichte Listenzeilen: h-12 statt h-14
      (Höhe des MultiSelect-Triggers, damit alles in einer Zeile fluchtet),
      getönte Fläche (02dp), KEIN schwebendes Label — `label` wird zum
      `aria-label`, sichtbar beschriftet der `placeholder`. */
  dense?: boolean;
}

// Schwebendes Label (Label-Stil: mono/versal). Float via :placeholder-shown
// (Input trägt placeholder=" "). Ruhend vertikal in der Feldmitte (top-1/2) in
// `type-label-small`, geschwebt in `type-plakette` — auf der Kontur ist das
// Label nur noch eine Beschriftung und darf auf 10 px schrumpfen.
//
// Beim Schweben stanzt es die Kontur aus und braucht dafür die Farbe der
// Fläche DAHINTER: `--feld-grund` ist die Stellschraube. Vorbelegt mit dem
// Grund (00dp); jede Fläche, die Felder trägt, erklärt ihre Stufe selbst —
// Card (01), Unterblock (02), Übungszeile (01), Dialog (24) setzen
// `[--feld-grund:var(--color-elev-NN)]`. So kann ein Feld nirgends ein
// falsches Rechteck stanzen, ohne dass der Aufrufer daran denken müsste.
const labelBase =
  "pointer-events-none absolute top-1/2 -translate-y-1/2 type-label-small bg-(--feld-grund,var(--color-elev-00)) px-1 transition-all duration-150 peer-focus:top-0 peer-focus:type-plakette peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:type-plakette";

// Horizontale Lage des Labels. Ohne Icon konstant bei left-3 (Text bündig mit
// dem Input-px-4). Mit Icon ruht das Label rechts neben dem Icon (left-10) und
// springt im schwebenden Zustand zurück auf left-3 — dort sitzt es auf der
// oberen Kante oberhalb des Icons, kollidiert also nicht.
const labelLeftRest = "left-3";
const labelLeftIcon =
  "left-10 peer-focus:left-3 peer-[:not(:placeholder-shown)]:left-3";

/* M2 Text-Field (outlined) mit schwebendem Label, optionalem führenden Icon,
   Supporting-Text und Error-State. Die Kontur trägt das Feld (1.5 px in
   `kante`), die Fläche bleibt der Grund — gefüllt wäre ein Feld eine Fläche
   mehr, die nichts bedeutet. `id` optional (sonst von React vergeben).

   `dense` ist die zweite Bauform: ein flaches, getöntes Feld auf Höhe des
   MultiSelect-Triggers (h-12), wie es die Filterzeilen brauchen. Dort trägt der
   Placeholder die Beschriftung (Empty-State als Label), ein schwebendes Label
   hätte daneben keinen Platz — es ist darum abgeschaltet und wandert als
   `aria-label` an den Input. */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      supportingText,
      error = false,
      befund = false,
      leadingIcon: Icon,
      dense = false,
      id,
      className,
      ...props
    },
    ref,
  ) => {
    // Feld-id aus React statt aus dem Label-Text: Dialoge halten ihre Felder auch
    // im geschlossenen Zustand im DOM (natives <dialog>), zwei gleichzeitig
    // gemountete Dialoge mit gleichem Label ergäben sonst dieselbe id — Label-Klick
    // und Screenreader träfen das Feld im falschen Dialog.
    const reactId = useId();
    const fid = id ?? `tf-${reactId}`;
    // Supporting-Text (auch der Fehlertext) muss am Input hängen, sonst liest
    // ihn kein Screenreader vor; `error` zusätzlich als aria-invalid, weil der
    // rote Rahmen allein nur sehend wahrnehmbar ist. Gilt für beide Bauformen.
    const hinweisId = supportingText ? `${fid}-hinweis` : undefined;

    // Zwei Bauformen, je eine Zeile Klassen — dicht (h-12, getönt, Klassen 1:1
    // aus den bisherigen Filterzeilen) und hoch (h-14, schwebendes Label).
    const feld = dense
      ? cn(
          "focus-ring type-body-medium h-12 w-full rounded-flaeche kontur bg-elev-02 text-on-surface placeholder:text-on-surface-mittel",
          Icon ? "pl-10 pr-3" : "px-3",
          error || befund ? "border-error" : "border-kante",
        )
      : cn(
          "peer type-body-large h-14 w-full rounded-flaeche kontur bg-transparent px-4 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2",
          Icon && "pl-11",
          // Rangfolge der Rahmenfarbe: error > befund > focus. Der Fokus
          // färbt nur den ruhigen Rahmen um; einen Befund überschriebe er
          // sonst genau in dem Moment, in dem hingeschaut wird (die dichte
          // Bauform hält es mit ihrem focus-ring schon immer so). Sichtbar
          // bleibt der Fokus über den dickeren Rahmen (focus:border-2).
          error || befund
            ? "border-error"
            : "border-kante focus:border-primary",
        );

    return (
      <div className={className}>
        {/* Eigener relative-Wrapper nur um Icon + Input + Label -> alles mittet im Feld. */}
        <div className="relative">
          {Icon && (
            <Icon
              size={18}
              strokeWidth={2}
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-1/2 -translate-y-1/2 text-on-surface-mittel",
                dense ? "left-3" : "left-4",
              )}
            />
          )}
          <input
            id={fid}
            ref={ref}
            /* Dicht: der Placeholder gehört der Aufruferin und bleibt sichtbar,
               die Float-Mechanik (placeholder=" " + :placeholder-shown) ist aus
               und das Label wird zum a11y-Namen. Beides steht VOR {...props},
               damit eine eigene Angabe der Aufruferin gewinnt. */
            {...(dense ? { "aria-label": label } : { placeholder: " " })}
            aria-invalid={error || undefined}
            aria-describedby={hinweisId}
            className={feld}
            {...props}
          />
          {!dense && (
            <label
              htmlFor={fid}
              className={cn(
                labelBase,
                Icon ? labelLeftIcon : labelLeftRest,
                // Nur `error` färbt Label und Hinweis: Der Befund meldet sich
                // am Rahmen und in seinem eigenen Hinweistext, die Beschriftung
                // des Felds bleibt davon unberührt.
                error
                  ? "text-error"
                  : "text-on-surface-mittel peer-focus:text-primary",
              )}
            >
              {label}
            </label>
          )}
        </div>
        {supportingText && (
          <p
            id={hinweisId}
            className={cn(
              "type-body-small mt-1",
              // Dicht fluchtet der Supporting-Text mit dem Feldrand (px-3),
              // nicht mit dem breiteren Innenabstand des hohen Felds.
              dense ? "px-1" : "px-4",
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
TextField.displayName = "TextField";
