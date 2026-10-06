"use client";

import { forwardRef, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Calendar, Clock } from "lucide-react";
import { Feld, beschreibungIdVon, useFeldId } from "./feld";

export interface DateTimeFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  supportingText?: string;
  /** Fester Hinweis hinter einem ⓘ (siehe `Feld`). */
  info?: ReactNode;
  error?: boolean;
}

/* Datums- und Zeitfeld (Team-Epic Story 7). Name über dem Feld und Feldkasten
   wie beim TextField (`Feld`, `feldkasten`), 36 px hoch.

   Das native Steuerelement ist Absicht: Datumsauswahl, Tastatureingabe und
   Lokalisierung kommen vom Betriebssystem und funktionieren mobil wie am
   Desktop besser als jede eigene Nachbildung.

   Leer zeigt es sich wie jedes leere Feld (nach dem Vorbild von «Start date»
   in Jira, PO 2026-10-06): kein Name darüber und keine Eingabemaske
   («dd/mm/yyyy», «--:--»), sondern das Kalender- bzw. Uhr-Zeichen und der
   Name gedämpft im Feld. Ein natives Datumsfeld kennt keinen Platzhalter und
   kein `:placeholder-shown`; darum legt das Feld seinen Namen selbst darüber
   (`.zeitfeld-leer` in globals.css) und meldet `leer` an `Feld`. Sobald man
   hineinklickt oder ein Wert drinsteht, erscheint das native Steuerelement
   wie bisher. Ob es leer ist, sagt bei einem kontrollierten Feld `value`,
   sonst die letzte Eingabe.

   Eigene Komponente (statt einer bloss aufgerufenen Funktion), damit `useId`
   ein regulärer Hook-Aufruf in einem eigenen Render bleibt. */
const DateTimeBase = forwardRef<
  HTMLInputElement,
  DateTimeFieldProps & { type: "date" | "time" }
>(({ label, supportingText, info, error = false, id, className, type, onChange, ...props }, ref) => {
  const fid = useFeldId(id);
  const [eingabeLeer, setEingabeLeer] = useState(!props.defaultValue);
  const leer = props.value !== undefined ? !props.value : eingabeLeer;
  const Zeichen = type === "date" ? Calendar : Clock;
  return (
    <Feld id={fid} label={label} leer={leer} hinweis={supportingText} info={info} error={error} className={className}>
      <div className="relative">
        <input
          id={fid}
          ref={ref}
          type={type}
          aria-invalid={error || undefined}
          aria-describedby={beschreibungIdVon(fid, supportingText, info)}
          data-leer={leer || undefined}
          className="zeitfeld feldkasten type-body-large h-9 w-full px-3"
          onChange={(e) => {
            setEingabeLeer(!e.target.value);
            onChange?.(e);
          }}
          {...props}
        />
        {/* Name und Zeichen im leeren Feld — nur Bild, die Vorlesehilfe hört
            den Namen über das Label; Klicks gehen durch auf das Feld. */}
        <span
          aria-hidden
          className="zeitfeld-leer type-body-large pointer-events-none absolute inset-y-0 left-0 items-center gap-2 px-3.5 text-on-surface-mittel"
        >
          <Zeichen size={18} strokeWidth={2} className="shrink-0" />
          {label}
        </span>
      </div>
    </Feld>
  );
});
DateTimeBase.displayName = "DateTimeBase";

export const DateField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) => (
  <DateTimeBase {...props} type="date" ref={ref} />
));
DateField.displayName = "DateField";

export const TimeField = forwardRef<HTMLInputElement, DateTimeFieldProps>((props, ref) => (
  <DateTimeBase {...props} type="time" ref={ref} />
));
TimeField.displayName = "TimeField";
