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
  /** Führendes Icon (Lucide) im Feld — z. B. Uhr für eine Dauer. Input und
      Label rücken automatisch ein, damit nichts mit dem Icon überlappt. */
  leadingIcon?: LucideIcon;
  /** Dichte Bauform für Filterzeilen und dichte Listenzeilen: `h-12` statt
      `h-14`, die Höhe des MultiSelect-Triggers, damit alles in einer Zeile
      fluchtet. Sie ändert NUR die Höhe — Kontur, Radius, durchsichtige Fläche,
      Schriftgrad und schwebendes Label sind dieselben. Eine dichte Bauform ist
      dasselbe Feld, enger gestellt; sähe sie anders aus, wäre sie ein zweites
      Feld, und die Filterzeile müsste erklären, warum ihre Felder nicht wie
      Felder aussehen. */
  dense?: boolean;
}

/* Das schwebende Label — zwei Zustände, und sie sagen Verschiedenes.
 *
 * RUHEND steht es IM Feld, an genau der Stelle, an der gleich der Wert stehen
 * wird. Es trägt darum die Schrift des Werts (`type-body-large`) und
 * unterscheidet sich von ihm nur in der Farbe: Was dort steht, ist noch nichts
 * Eingegebenes. In der Label-Schrift (mono/versal) sähe es aus wie eine
 * Beschriftung, die zufällig im Feld liegt — und Auswahlfelder, deren Leerfall
 * seit je ein Satz ist («Alle Stufen»), stünden in einer Zeile daneben sichtbar
 * anders da.
 *
 * GESCHWEBT sitzt es auf der Kontur und ist nur noch eine Marke am Feld. Dort
 * gilt der Label-Stil des Hauses (`type-plakette`, mono/versal, 10 px): Es
 * konkurriert nicht mehr mit dem Wert, sondern benennt ihn.
 *
 * Beim Schweben stanzt es die Kontur aus und braucht dafür die Farbe der
 * Fläche DAHINTER: `--feld-grund` ist die Stellschraube. Vorbelegt mit dem
 * Grund (00dp); jede Fläche, die Felder trägt, erklärt ihre Stufe selbst —
 * Card (01), Unterblock (02), Übungszeile (01), Dialog (24) setzen
 * `[--feld-grund:var(--color-elev-NN)]`. So kann ein Feld nirgends ein
 * falsches Rechteck stanzen, ohne dass der Aufrufer daran denken müsste.
 *
 * Die drei Bausteine sind exportiert, weil Select und MultiSelect dasselbe
 * Label tragen — sie schalten es aber selbst um (`schwebt ? … : …`), denn ein
 * Trigger ohne `<input>` kennt kein `:placeholder-shown`. */
export const feldLabelBase =
  "pointer-events-none absolute -translate-y-1/2 bg-(--feld-grund,var(--color-elev-00)) px-1 transition-all duration-150";
export const feldLabelRuhend = "top-1/2 type-body-large";
export const feldLabelSchwebend = "top-0 type-plakette";

// Für das TextField hängen die beiden Zustände am Platzhalter (`placeholder=" "`)
// und am Fokus des Nachbar-Inputs (`peer`).
const labelBase = `${feldLabelBase} ${feldLabelRuhend} peer-focus:top-0 peer-focus:type-plakette peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:type-plakette`;

// Horizontale Lage des Labels. Ohne Icon konstant bei left-3 (Text bündig mit
// dem Input-px-4). Mit Icon ruht das Label rechts neben dem Icon (left-10) und
// springt im schwebenden Zustand zurück auf left-3 — dort sitzt es auf der
// oberen Kante oberhalb des Icons, kollidiert also nicht.
const labelLeftRest = "left-3";
const labelLeftIcon =
  "left-10 peer-focus:left-3 peer-[:not(:placeholder-shown)]:left-3";

/** Der Ankerplatz für ein bedienbares Zeichen am rechten Feldrand — das Auge
 *  im Passwortfeld, das Kreuz im Suchfeld. Er hängt an der OBERKANTE der
 *  Inputzeile und ist so hoch wie sie: an der Mitte des Wrappers ausgerichtet
 *  rutschte er nach unten, sobald ein `supportingText` darunter steht.
 *  `dense` muss dieselbe Höhe nennen wie das Feld, sonst mittet das Zeichen
 *  im falschen Kasten. Aufrufer legen die Klassen auf ein `<span>` um den
 *  Knopf, damit der Knopf selbst `relative` bleiben kann (die Zustands-Ebene
 *  `state` braucht das). */
export const feldTrailingSlot = (dense?: boolean) =>
  cn("absolute right-2 top-0", dense ? "h-12" : "h-14");

/** Das Zeichen selbst: der Knopf im Slot, auf voller Slot-Höhe. */
export const feldTrailingKnopf =
  "state focus-ring flex h-full items-center rounded-flaeche px-2 text-on-surface-mittel";

/** Was der Slot rechts wegnimmt — der Input braucht so viel Innenabstand,
 *  damit der Text nicht unter dem Zeichen verschwindet. */
export const feldTrailingPadding = "[&_input]:pr-12";

/* M2 Text-Field (outlined) mit schwebendem Label, optionalem führenden Icon,
   Supporting-Text und Error-State. Die Kontur trägt das Feld (1.5 px in
   `kante`), die Fläche bleibt der Grund — gefüllt wäre ein Feld eine Fläche
   mehr, die nichts bedeutet. `id` optional (sonst von React vergeben).

   Es gibt EIN Feld in zwei Höhen: `dense` stellt `h-14` auf `h-12` und sonst
   nichts. Der Platzhalter gehört damit überall der Float-Mechanik
   (`placeholder=" "`); beschriftet wird ausschliesslich über `label`. */
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
    // rote Rahmen allein nur sehend wahrnehmbar ist.
    const hinweisId = supportingText ? `${fid}-hinweis` : undefined;

    const feld = cn(
      "peer type-body-large w-full rounded-flaeche kontur bg-transparent px-4 text-on-surface outline-none transition-[border-color] duration-150 focus:border-2",
      dense ? "h-12" : "h-14",
      Icon && "pl-11",
      // Rangfolge der Rahmenfarbe: error > befund > focus. Der Fokus färbt nur
      // den ruhigen Rahmen um; einen Befund überschriebe er sonst genau in dem
      // Moment, in dem hingeschaut wird. Sichtbar bleibt der Fokus über den
      // dickeren Rahmen (focus:border-2).
      error || befund ? "border-error" : "border-kante focus:border-primary",
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
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-mittel"
            />
          )}
          <input
            id={fid}
            ref={ref}
            /* Der Platzhalter treibt die Float-Mechanik (:placeholder-shown)
               und gehört darum dem Feld, nicht der Aufruferin. Er steht VOR
               {...props}, damit eine bewusste eigene Angabe trotzdem gewinnt —
               sie schaltet dann allerdings das Schweben ab. */
            placeholder=" "
            aria-invalid={error || undefined}
            aria-describedby={hinweisId}
            className={feld}
            {...props}
          />
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
        </div>
        {supportingText && (
          <p
            id={hinweisId}
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
TextField.displayName = "TextField";
