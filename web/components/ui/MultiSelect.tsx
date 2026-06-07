"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label: string;
  options: SelectOption[];
  /** Kontrolliert (Liste der Werte). Ohne `value` unkontrolliert (interner
      State, seed = defaultValue ?? []). */
  value?: string[];
  defaultValue?: string[];
  onChange?: (values: string[]) => void;
  /** Pro gewähltem Wert ein gleichnamiges Hidden-Input — native Form-
      Serialisierung via `FormData.getAll(name)`. */
  name?: string;
  /** Suchfeld im Panel-Kopf (Default). `false`: reine Klick-/Tastatur-Liste. */
  searchable?: boolean;
  /** Footer mit „Zurücksetzen" / „Alle auswählen" (Default). */
  actions?: boolean;
  placeholder?: string;
  supportingText?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* M3 Multi-Select — Feld-Trigger mit inline entfernbaren Tags öffnet ein
   Panel mit Suchfeld (Kopf), Optionsliste (eckige KiFu-Checkbox) und Aktions-
   Footer (Zurücksetzen / Alle auswählen). Trigger trägt
   den --field-*-Kontrakt (wie Text-Field), das Panel den --menu-*-Kontrakt.
   Combobox-/Listbox-Semantik (aria-multiselectable) mit voller Tastatur-
   steuerung (↑/↓, Home/End, Enter toggelt, Esc schliesst). Panel bleibt nach
   Auswahl offen. „Alle auswählen" respektiert den aktiven Suchfilter. */
export function MultiSelect({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  searchable = true,
  actions = true,
  placeholder,
  supportingText,
  error,
  disabled,
  id,
  className,
}: MultiSelectProps) {
  const reactId = useId();
  const fid = id ?? `ms-${reactId}`;
  const listId = `${fid}-list`;
  const optId = (i: number) => `${fid}-opt-${i}`;

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Nur Tastatur-Navigation soll die aktive Option ins Sichtfeld scrollen.
  // Hover setzt `active` ebenfalls — würde das scrollen, springt die Liste
  // bei jeder Mausbewegung (scrollIntoView auf der überlaufenden Liste).
  const kbdNav = useRef(false);

  // Sichtbare (gefilterte) Optionen. Ohne Suche bleibt die volle Liste.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  // Tags in Auswahl-Reihenfolge; Label-Lookup über die Optionen.
  const selectedOptions = current
    .map((v) => options.find((o) => o.value === v))
    .filter((o): o is SelectOption => Boolean(o));

  function emit(next: string[]) {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  }

  function toggle(value: string) {
    emit(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  function remove(value: string) {
    emit(current.filter((v) => v !== value));
  }

  // Footer-Aktionen. „Alle auswählen" vereinigt die aktuelle Auswahl mit den
  // sichtbaren (gefilterten) Optionen; „Zurücksetzen" leert die Auswahl.
  function selectAllVisible() {
    emit(Array.from(new Set([...current, ...filtered.map((o) => o.value)])));
    refocus();
  }
  function reset() {
    emit([]);
    refocus();
  }

  function refocus() {
    (searchable ? searchRef : triggerRef).current?.focus();
  }

  function openPanel() {
    if (disabled) return;
    setOpen(true);
  }
  function closePanel() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  // Beim Öffnen: Aktiv-Index zurücksetzen, Fokus ins Suchfeld (sonst Trigger).
  useEffect(() => {
    if (!open) return;
    setActive(0);
    if (searchable) searchRef.current?.focus();
  }, [open, searchable]);

  // Filter ändert sich -> Aktiv-Index an den Anfang.
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Aktive Option ins Sichtfeld scrollen — nur nach Tastatur-Navigation,
  // nicht bei Hover (sonst scrollt die Liste bei jeder Mausbewegung).
  useEffect(() => {
    if (!open || !kbdNav.current) return;
    document.getElementById(optId(active))?.scrollIntoView({ block: "nearest" });
    kbdNav.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  // Outside-Click schliesst und setzt die Suche zurück.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Listen-Navigation — geteilt von Suchfeld (searchable) und Trigger (sonst).
  function onNavKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) return openPanel();
        kbdNav.current = true;
        setActive((a) => Math.min(filtered.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (!open) return openPanel();
        kbdNav.current = true;
        setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        if (!open) return;
        e.preventDefault();
        kbdNav.current = true;
        setActive(0);
        break;
      case "End":
        if (!open) return;
        e.preventDefault();
        kbdNav.current = true;
        setActive(filtered.length - 1);
        break;
      case "Enter":
        if (!open) return openPanel();
        e.preventDefault();
        if (filtered[active]) toggle(filtered[active].value);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          closePanel();
        }
        break;
    }
  }

  // Trigger-Tasten: ohne Suche treibt der Trigger die Liste (onNavKey); mit
  // Suche öffnet er nur (Down/Enter/Space) und schliesst auf Esc.
  function onTriggerKey(e: React.KeyboardEvent) {
    if (!searchable) return onNavKey(e);
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPanel();
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      closePanel();
    }
  }

  const showPlaceholder = selectedOptions.length === 0;

  return (
    <div className={className}>
      <span id={`${fid}-label`} className="type-label-small mb-2 block text-(--field-label)">
        {label}
      </span>

      <div ref={rootRef} className="relative">
        {/* Trigger = Feld-Kontrakt, wächst mehrzeilig mit den Tags. Ohne Suche
            ist er die Combobox (treibt die Liste), mit Suche ein Button, der
            das Panel öffnet (Fokus springt dann ins Suchfeld). */}
        <div
          id={fid}
          ref={triggerRef}
          role={searchable ? "button" : "combobox"}
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${fid}-label`}
          aria-activedescendant={
            !searchable && open && filtered[active] ? optId(active) : undefined
          }
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKey}
          className={cn(
            "focus-ring flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-(--field-shape) border-[1.5px] bg-surface px-2 py-1.5",
            error ? "border-(--field-error)" : "border-(--field-outline)",
            open && !error && "border-(--field-focus)",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          {showPlaceholder ? (
            <span className="type-body-large px-1 text-(--field-label)">
              {placeholder ?? "Auswählen …"}
            </span>
          ) : (
            selectedOptions.map((o) => (
              <span
                key={o.value}
                className="type-label-small inline-flex items-center gap-1 rounded-(--chip-shape) bg-(--chip-selected-container) py-0.5 pl-2.5 pr-1 text-(--chip-selected-label)"
              >
                {o.label}
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(o.value);
                  }}
                  aria-label={`${o.label} entfernen`}
                  className="focus-ring inline-flex h-4 w-4 items-center justify-center rounded-full text-(--chip-selected-label)/70 transition-colors hover:bg-on-surface/12 hover:text-(--chip-selected-label)"
                >
                  <X size={13} strokeWidth={2.5} aria-hidden />
                </button>
              </span>
            ))
          )}

          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "ml-auto mr-1 shrink-0 self-center text-on-surface-variant transition-transform",
              open && "rotate-180",
            )}
          />
        </div>

        {open && (
          <div className="absolute z-50 mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-(--menu-shape) border border-outline-variant bg-(--menu-container) shadow-e4">
            {searchable && (
              <div className="flex shrink-0 items-center gap-2 border-b border-outline-variant px-3">
                <Search
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className="shrink-0 text-on-surface-variant"
                />
                <input
                  ref={searchRef}
                  type="text"
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={filtered[active] ? optId(active) : undefined}
                  aria-label={`${label} durchsuchen`}
                  value={query}
                  placeholder="Suchen …"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onNavKey}
                  className="type-body-medium h-10 w-full bg-transparent text-(--field-text) outline-none placeholder:text-(--field-label)"
                />
              </div>
            )}

            <ul
              id={listId}
              ref={listRef}
              role="listbox"
              aria-multiselectable
              aria-labelledby={`${fid}-label`}
              className="flex-1 overflow-auto py-1"
            >
              {filtered.length === 0 && (
                <li className="type-body-medium px-3 py-2 text-on-surface-variant">
                  Keine Treffer
                </li>
              )}
              {filtered.map((o, i) => {
                const isSelected = current.includes(o.value);
                const isActive = i === active;
                return (
                  <li
                    key={o.value}
                    id={optId(i)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => {
                      kbdNav.current = false;
                      setActive(i);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      toggle(o.value);
                      refocus();
                    }}
                    className={cn(
                      "type-body-medium flex cursor-pointer items-center gap-3 px-3 py-2 text-(--menu-label)",
                      isActive && "bg-on-surface/8",
                    )}
                  >
                    {/* Eckige KiFu-Checkbox: Signal-Fill + Chalk-Haken bei Auswahl. */}
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border-[1.5px] transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-(--field-outline)",
                      )}
                    >
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  </li>
                );
              })}
            </ul>

            {actions && (
              <div className="flex shrink-0 items-center justify-between border-t border-outline-variant px-2 py-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={current.length === 0}
                  className="focus-ring type-label-medium rounded-(--button-shape) px-3 py-1.5 text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:pointer-events-none disabled:opacity-40"
                >
                  Zurücksetzen
                </button>
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="focus-ring type-label-medium rounded-(--button-shape) px-3 py-1.5 text-(--button-text-label) transition-colors hover:bg-primary/8"
                >
                  Alle auswählen
                </button>
              </div>
            )}
          </div>
        )}

        {name &&
          current.map((v) => (
            <input key={v} type="hidden" name={name} value={v} />
          ))}
      </div>

      {supportingText && (
        <p
          className={cn(
            "type-body-small mt-1 px-1",
            error ? "text-error" : "text-(--field-label)",
          )}
        >
          {supportingText}
        </p>
      )}
    </div>
  );
}
