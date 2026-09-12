"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { feldLabelBase, feldLabelSchwebend } from "./TextField";

export interface SelectOption {
  value: string;
  label: string;
  /** Optionale Gruppenzugehörigkeit. Optionen derselben Gruppe stehen
      zusammen; die Gruppe bekommt eine nicht wählbare Überschrift. Nötig, wo
      ein Feld Werte aus zwei Welten anbietet — etwa der Trainingsteil-Filter
      des Katalogs, der über beide Altersstufen sucht. Die Reihenfolge der Optionen
      bleibt wie übergeben — gruppiert wird nur die Beschriftung. */
  group?: string;
}

export interface SelectProps {
  label: string;
  options: SelectOption[];
  /** Kontrolliert. Ohne `value` ist die Komponente unkontrolliert (interner State, seed = defaultValue). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Optionales Hidden-Input, damit das Feld an nativer Form-Serialisierung teilnimmt. */
  name?: string;
  supportingText?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* M2 Single-Select — kein natives <select>. Der Trigger ist gebaut wie ein
   Feld (Kontur in `kante`, offener Grund), das aufgeklappte Panel wie ein
   Menü (08dp, Haarlinie, Schatten, ✓ auf der aktuellen Auswahl).
   Listbox-Semantik + vollständige Tastatursteuerung.

   Das Label schwebt wie beim TextField auf der Kontur — und zwar immer: Ein
   Single-Select hat stets einen Wert (und sei es der Leerfall «— kein Feldtyp —»),
   also gibt es keine Ruhelage, in der das Label im Feld stünde. Ein Label ÜBER
   dem Feld, wie es hier früher stand, war der einzige Ort im Kit, an dem eine
   Beschriftung ausserhalb der Kontur lag. */
export function Select({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  supportingText,
  error,
  disabled,
  id,
  className,
}: SelectProps) {
  const reactId = useId();
  const fid = id ?? `sel-${reactId}`;
  const listId = `${fid}-list`;
  const optId = (i: number) => `${fid}-opt-${i}`;
  // Id der Gruppen-Kopfzeile. Die Kopfzeile ist `role="presentation"` und damit
  // strukturell unsichtbar — ohne Verweis erführe eine Screenreader-Nutzerin
  // nie, zu welcher Gruppe ein Wert gehört. Jede Option zeigt darum per
  // `aria-describedby` auf sie: vorgelesen wird «<Wert>, <Gruppe>».
  const gruppenId = (gruppe: string) =>
    `${fid}-gruppe-${gruppe.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = isControlled ? value : internal;
  // Ein Wert, der nicht in den Optionen steht, hat KEINE Auswahl — nicht die
  // erste. Sonst behauptete das Feld einen Zustand, den der Datensatz nicht
  // hat, und ein unbedachtes Speichern schriebe ihn fest.
  const foundIndex = options.findIndex((o) => o.value === current);
  const selectedIndex = foundIndex === -1 ? 0 : foundIndex;
  const selected = foundIndex === -1 ? undefined : options[foundIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  // Nur Tastatur-Navigation scrollt die aktive Option ins Sichtfeld — Hover
  // setzt `active` ebenfalls und würde die überlaufende Liste sonst bei jeder
  // Mausbewegung verschieben.
  const kbdNav = useRef(false);

  function commit(i: number) {
    const opt = options[i];
    if (!opt) return;
    if (!isControlled) setInternal(opt.value);
    onChange?.(opt.value);
    setOpen(false);
    btnRef.current?.focus();
  }

  // Beim Öffnen: Aktiv-Index auf die aktuelle Auswahl, Fokus in die Listbox.
  // `kbdNav` setzen, damit die gewählte Option einmalig ins Sichtfeld scrollt.
  useEffect(() => {
    if (!open) return;
    kbdNav.current = true;
    setActive(selectedIndex);
    listRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Aktive Option ins Sichtfeld scrollen — nur nach Tastatur-Navigation.
  useEffect(() => {
    if (!open || !kbdNav.current) return;
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    kbdNav.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  // Outside-Click schliesst.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        kbdNav.current = true;
        setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        kbdNav.current = true;
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        kbdNav.current = true;
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        kbdNav.current = true;
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div className={className}>
      <div ref={rootRef} className="relative">
        <button
          id={fid}
          ref={btnRef}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKey}
          className={cn(
            "focus-ring type-body-large flex h-12 w-full items-center justify-between gap-2 rounded-flaeche kontur bg-transparent px-4 text-left text-on-surface",
            // Offen zieht der Trigger die Kontur auf Primary — er gehört
            // dann zum Panel darunter und soll das auch zeigen.
            error ? "border-error" : open ? "border-primary" : "border-kante",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "shrink-0 text-on-surface-mittel transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        <label
          htmlFor={fid}
          className={cn(
            feldLabelBase,
            feldLabelSchwebend,
            "left-3",
            error ? "text-error" : open ? "text-primary" : "text-on-surface-mittel",
          )}
        >
          {label}
        </label>

        {open && (
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={optId(active)}
            onKeyDown={onListKey}
            className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08 focus:outline-none"
          >
            {options.map((o, i) => {
              const isSelected = i === selectedIndex;
              const isActive = i === active;
              // Gruppen-Überschrift, sobald eine neue Gruppe beginnt.
              const kopf = o.group && o.group !== options[i - 1]?.group ? o.group : null;
              return (
                <Fragment key={o.value}>
                {kopf && (
                  <li
                    id={gruppenId(kopf)}
                    role="presentation"
                    className="px-3 pb-1 pt-2 type-label-small text-on-surface-mittel"
                  >
                    {kopf}
                  </li>
                )}
                <li
                  id={optId(i)}
                  role="option"
                  aria-selected={isSelected}
                  aria-describedby={o.group ? gruppenId(o.group) : undefined}
                  onMouseEnter={() => {
                    kbdNav.current = false;
                    setActive(i);
                  }}
                  onClick={() => commit(i)}
                  className={cn(
                    // Der echte Fokus liegt auf der Listbox, nicht auf der
                    // Zeile — die Tastatur-Aktivzeile leiht sich darum die
                    // Fokus-Deckung der Zustands-Ebene (`state-aktiv`),
                    // während Hover aus `state` selbst kommt.
                    "state type-body-medium flex cursor-pointer items-center gap-3 px-3 py-2 text-on-surface",
                    isActive && "state-aktiv",
                  )}
                >
                  <span className="grid w-[18px] shrink-0 place-items-center text-on-surface-mittel">
                    {isSelected && <Check size={18} strokeWidth={2} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}

        {name && <input type="hidden" name={name} value={current} />}
      </div>
      {supportingText && (
        <p className={cn("type-body-small mt-1 px-4", error ? "text-error" : "text-on-surface-mittel")}>
          {supportingText}
        </p>
      )}
    </div>
  );
}
