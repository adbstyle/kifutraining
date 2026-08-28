"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
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
  /** Label nur für Screenreader (visuell ausgeblendet) — z. B. wenn der
      Placeholder (Empty-State) bereits als Beschriftung dient. */
  hideLabel?: boolean;
  placeholder?: string;
  supportingText?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* M3 Multi-Select — einzeiliger Feld-Trigger mit inline entfernbaren Tags
   öffnet ein Panel mit Suchfeld (Kopf), Optionsliste (eckige KiFu-Checkbox)
   und Aktions-Footer (Zurücksetzen / Alle auswählen). Trigger trägt den
   --field-*-Kontrakt (wie Text-Field), das Panel den --menu-*-Kontrakt.
   Der Trigger bleibt auf eine Zeile begrenzt: passen nicht alle Tags in die
   Zelle, werden die überzähligen zu einem Zähler-Badge (+N) gebündelt — die
   sichtbare Anzahl wird per Messung (verstecktes Mess-Layer + ResizeObserver)
   an die Feldbreite angepasst. Combobox-/Listbox-Semantik
   (aria-multiselectable) mit voller Tastatursteuerung (↑/↓, Home/End, Enter
   toggelt, Esc schliesst). Panel bleibt nach Auswahl offen. „Alle auswählen"
   respektiert den aktiven Suchfilter. */
export function MultiSelect({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  searchable = true,
  actions = true,
  hideLabel,
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
  // Einzeiliger Trigger: `contentRef` ist die clippende Tag-Zeile, `measureRef`
  // ein unsichtbares Layer, das alle Tags in voller Breite hält. Daraus wird
  // berechnet, wie viele Tags reinpassen (Rest → „+N"-Badge).
  const contentRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
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

  // Wie viele Tags in eine Zeile passen. Start = alle (Layout-Effekt korrigiert
  // vor dem ersten Paint). Stabiler Mess-Trigger via Schlüssel statt Array-ID.
  const selectedKey = current.join("|");
  const [visibleCount, setVisibleCount] = useState(selectedOptions.length);
  const visibleOptions = selectedOptions.slice(0, visibleCount);
  const hiddenOptions = selectedOptions.slice(visibleCount);
  const hiddenCount = hiddenOptions.length;

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

  // Sichtbare Tag-Anzahl an die Feldbreite anpassen. Misst die natürlichen
  // Tag-Breiten im versteckten Layer und füllt die Zeile, bis nur noch Platz
  // fürs „+N"-Badge bliebe. Reagiert via ResizeObserver auf Breitenänderungen.
  useLayoutEffect(() => {
    const content = contentRef.current;
    const measure = measureRef.current;
    if (!content || !measure) return;

    const GAP = 6; // gap-1.5
    const BADGE_RESERVE = 46; // Platz fürs „+N"-Badge inkl. Gap

    function recompute() {
      const chips = Array.from(measure!.children) as HTMLElement[];
      const n = chips.length;
      if (n === 0) {
        setVisibleCount(0);
        return;
      }
      const avail = content!.clientWidth;
      const widths = chips.map((c) => c.offsetWidth);
      const totalAll = widths.reduce((a, b) => a + b, 0) + GAP * (n - 1);
      if (totalAll <= avail) {
        setVisibleCount(n);
        return;
      }
      // Nicht alles passt → Platz fürs Badge reservieren und auffüllen.
      let used = 0;
      let count = 0;
      for (let i = 0; i < n; i++) {
        const w = widths[i] + (count > 0 ? GAP : 0);
        if (used + w + GAP + BADGE_RESERVE <= avail) {
          used += w;
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(count);
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(content);
    return () => ro.disconnect();
    // selectedKey: Neuberechnung bei geänderter Auswahl; options: Label-Wechsel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, options]);

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

  // Ein entfernbarer Tag. `measuring`: Variante fürs Mess-Layer (gleiche Breite,
  // ohne Handler) — `shrink-0` hält die natürliche Breite in der clippenden Zeile.
  function renderChip(o: SelectOption, measuring = false) {
    return (
      <span
        key={o.value}
        className="type-label-small inline-flex shrink-0 items-center gap-1 rounded-(--chip-shape) bg-(--chip-selected-container) py-0.5 pl-2.5 pr-1 text-(--chip-selected-label)"
      >
        {o.label}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || measuring}
          onClick={
            measuring
              ? undefined
              : (e) => {
                  e.stopPropagation();
                  remove(o.value);
                }
          }
          aria-label={`${o.label} entfernen`}
          className="focus-ring inline-flex h-4 w-4 items-center justify-center rounded-full text-(--chip-selected-label)/70 transition-colors hover:bg-on-surface/12 hover:text-(--chip-selected-label)"
        >
          <X size={13} strokeWidth={2.5} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <div className={className}>
      <span
        id={`${fid}-label`}
        className={cn(
          "type-label-small mb-2 block text-(--field-label)",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </span>

      <div ref={rootRef} className="relative">
        {/* Trigger = Feld-Kontrakt, auf eine Zeile begrenzt. Ohne Suche ist er
            die Combobox (treibt die Liste), mit Suche ein Button, der das Panel
            öffnet (Fokus springt dann ins Suchfeld). Die Tag-Zeile clippt;
            überzählige Tags bündelt das „+N"-Badge. */}
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
            "focus-ring flex h-12 w-full items-center gap-1.5 rounded-(--field-shape) border-[1.5px] bg-surface px-2",
            error ? "border-(--field-error)" : "border-(--field-outline)",
            open && !error && "border-(--field-focus)",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          <div
            ref={contentRef}
            className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
          >
            {showPlaceholder ? (
              <span className="type-body-large truncate px-1 text-(--field-label)">
                {placeholder ?? "Auswählen …"}
              </span>
            ) : (
              <>
                {visibleOptions.map((o) => renderChip(o))}
                {hiddenCount > 0 && (
                  <span
                    aria-label={`${hiddenCount} weitere ausgewählt`}
                    title={hiddenOptions.map((o) => o.label).join(", ")}
                    className="type-label-small inline-flex shrink-0 items-center rounded-(--chip-shape) bg-(--chip-selected-container) px-2 py-0.5 font-medium tabular-nums text-(--chip-selected-label)/80"
                  >
                    +{hiddenCount}
                  </span>
                )}
              </>
            )}
          </div>

          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "mr-1 shrink-0 self-center text-on-surface-variant transition-transform",
              open && "rotate-180",
            )}
          />

          {/* Mess-Layer: alle Tags in voller Breite, unsichtbar & layout-neutral. */}
          <div
            ref={measureRef}
            aria-hidden
            className="pointer-events-none invisible absolute left-0 top-0 flex flex-nowrap items-center gap-1.5 whitespace-nowrap"
          >
            {selectedOptions.map((o) => renderChip(o, true))}
          </div>
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
                // Gruppen-Überschrift, sobald eine neue Gruppe beginnt — nötig,
                // wo eine Dimension Werte aus zwei Welten führt (Epic #71).
                const kopf = o.group && o.group !== filtered[i - 1]?.group ? o.group : null;
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
                  </Fragment>
                );
              })}
            </ul>

            {actions && (
              // Icon-only-Footer: spart Platz in schmalen Panels (kein Umbruch
              // langer Labels). `label` liefert den a11y-Namen (aria-label),
              // `title` den Hover-Hinweis — bewusst kein <Tooltip>, da das Panel
              // (overflow-hidden) den CSS-Tooltip ohne Portal abschneiden würde.
              // „Alle auswählen" bleibt primary getönt (CTA).
              <div className="flex shrink-0 items-center justify-between border-t border-outline-variant px-2 py-1.5">
                <IconButton
                  icon={RotateCcw}
                  label="Zurücksetzen"
                  title="Zurücksetzen"
                  size="sm"
                  onClick={reset}
                  disabled={current.length === 0}
                />
                <IconButton
                  icon={CheckCheck}
                  label="Alle auswählen"
                  title="Alle auswählen"
                  size="sm"
                  onClick={selectAllVisible}
                  iconProps={{ className: "text-primary" }}
                />
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
