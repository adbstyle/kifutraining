"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  /** Optionale Gruppenzugehörigkeit. Optionen derselben Gruppe stehen
      zusammen; die Gruppe bekommt eine nicht wählbare Überschrift. Nötig, wo
      ein Feld Werte aus zwei Welten anbietet (z. B. die Heimat einer Übung:
      Kinderfussball oder Juniorenfussball). Die Reihenfolge der Optionen
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
  /** Label nur für Screenreader (visuell ausgeblendet) — z. B. wenn der
      Empty-State des Felds bereits als Beschriftung dient. */
  hideLabel?: boolean;
  supportingText?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* M3 Single-Select — kein natives <select>. Der Trigger trägt den Feld-Token-
   Kontrakt (wie TextField/SelectField-Feldrahmen), das aufgeklappte Panel den
   Menu-Token-Kontrakt (gerundet, dunkle Surface, Hover, ✓ auf der aktiven
   Auswahl). Listbox-Semantik + vollständige Tastatursteuerung. */
export function Select({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  hideLabel,
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
      <label
        htmlFor={fid}
        className={cn(
          "type-label-small mb-2 block text-(--field-label)",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>
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
            "focus-ring type-body-large flex h-12 w-full items-center justify-between gap-2 rounded-(--field-shape) border-[1.5px] bg-surface px-3 text-left text-(--field-text)",
            error ? "border-error" : "border-(--field-outline)",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{selected?.label}</span>
          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "shrink-0 text-on-surface-variant transition-transform",
              open && "rotate-180",
            )}
          />
        </button>

        {open && (
          <ul
            id={listId}
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={optId(active)}
            onKeyDown={onListKey}
            className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-(--menu-shape) border border-outline-variant bg-(--menu-container) py-1 shadow-e4 focus:outline-none"
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
                    role="presentation"
                    className="px-3 pb-1 pt-2 type-label-small text-on-surface-variant"
                  >
                    {kopf}
                  </li>
                )}
                <li
                  id={optId(i)}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => {
                    kbdNav.current = false;
                    setActive(i);
                  }}
                  onClick={() => commit(i)}
                  className={cn(
                    "type-body-medium flex cursor-pointer items-center gap-3 px-3 py-2 text-(--menu-label)",
                    isActive && "bg-on-surface/8",
                  )}
                >
                  <span className="grid w-[18px] shrink-0 place-items-center text-(--menu-leading)">
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
        <p className={cn("type-body-small mt-1 px-1", error ? "text-error" : "text-(--field-label)")}>
          {supportingText}
        </p>
      )}
    </div>
  );
}
