"use client";

import { forwardRef, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  TextField,
  feldTrailingKnopf,
  feldTrailingPadding,
  feldTrailingSlot,
  type TextFieldProps,
} from "./TextField";

export interface SearchFieldProps
  extends Omit<TextFieldProps, "type" | "leadingIcon"> {
  /** Beschriftung des Leeren-Knopfs. Voreingestellt «Suche leeren»; wo mehrere
   *  Suchen auf einer Seite stehen, sagt eine eigene Fassung welche. */
  clearLabel?: string;
}

/** Wert eines Inputs so setzen, dass React es mitbekommt.
 *
 *  `el.value = ""` allein schreibt am Value-Tracker vorbei, den React auf dem
 *  DOM-Knoten führt: Das folgende `input`-Ereignis gilt ihm als unverändert und
 *  erreicht kein `onChange`. Ein gesteuertes Feld schriebe seinen alten Wert
 *  darum sofort zurück. Über den nativen Setter des Prototyps gesetzt, sieht
 *  React den Wechsel und meldet ihn wie eine Tastatureingabe weiter — der
 *  Aufrufer braucht keinen zweiten Weg neben seinem `onChange`. */
function setzeWert(el: HTMLInputElement, wert: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(el, wert);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Suchfeld — ein TextField, dessen Zeichen rechts steht.
 *
 * Warum rechts und nicht links: Das Zeichen am Suchfeld hat zwei Aufgaben, und
 * die zweite ist eine Schaltfläche. Solange nichts eingegeben ist, sagt die
 * Lupe, wofür das Feld da ist; sobald etwas dasteht, tritt an ihre Stelle ein
 * Kreuz, das die Suche mit einem Klick leert. Beides an derselben Stelle, und
 * zwar an der, an der das Passwortfeld schon sein Auge trägt: Bedienbares
 * gehört im Kit rechts ins Feld, links steht nur Schmuck. Nebenbei bekommt das
 * schwebende Label seinen ruhigen Platz an der linken Kante zurück.
 *
 * Steuerung: `value` (gesteuert) und `defaultValue` (ungesteuert) verhalten
 * sich wie am Input. Das Kreuz meldet sich in beiden Fällen über `onChange`
 * mit leerem Wert — es gibt keinen zweiten Rückkanal, den ein Aufrufer
 * vergessen könnte.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      className,
      dense,
      clearLabel = "Suche leeren",
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    // Ungesteuerte Felder tragen ihren Wert im DOM; das Kreuz muss trotzdem
    // erscheinen und verschwinden, also führt der Baustein hier selbst mit.
    const [eigenerWert, setEigenerWert] = useState(() => String(defaultValue ?? ""));
    const gesteuert = value !== undefined;
    const text = gesteuert ? String(value ?? "") : eigenerWert;
    const hatText = text.length > 0;

    function refSetzen(el: HTMLInputElement | null) {
      innerRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    }

    function leeren() {
      const el = innerRef.current;
      if (!el) return;
      setzeWert(el, "");
      // Nach dem Leeren steht der Cursor im Feld: Wer die Suche verwirft, will
      // meist gleich eine neue tippen — und der Fokus darf nicht auf einem
      // Knopf hängen bleiben, der im selben Moment verschwindet.
      el.focus();
    }

    return (
      <div className={className}>
        <div className="relative">
          <TextField
            ref={refSetzen}
            dense={dense}
            type="search"
            /* Der eigene Leeren-Knopf ersetzt den, den WebKit für
               `type="search"` selbst zeichnet — zwei Kreuze nebeneinander
               wären eine Wahl ohne Unterschied. */
            className={cn(
              feldTrailingPadding,
              "[&_input::-webkit-search-cancel-button]:appearance-none",
            )}
            {...(gesteuert ? { value } : { defaultValue })}
            onChange={(e) => {
              if (!gesteuert) setEigenerWert(e.target.value);
              onChange?.(e);
            }}
            {...props}
          />
          <span className={feldTrailingSlot(dense)}>
            {hatText ? (
              <button
                type="button"
                onClick={leeren}
                aria-label={clearLabel}
                className={feldTrailingKnopf}
              >
                <X size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : (
              /* Die Lupe ist reine Auskunft — kein Knopf, keine Zustands-Ebene,
                 und für die Vorlesehilfe nicht vorhanden: Das Feld heisst
                 bereits «suchen». */
              <span
                aria-hidden
                className="pointer-events-none flex h-full items-center px-2 text-on-surface-mittel"
              >
                <Search size={18} strokeWidth={2} />
              </span>
            )}
          </span>
        </div>
      </div>
    );
  },
);
SearchField.displayName = "SearchField";
