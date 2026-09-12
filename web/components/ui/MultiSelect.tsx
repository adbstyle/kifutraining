"use client";

import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import {
  feldLabelBase,
  feldLabelRuhend,
  feldLabelSchwebend,
} from "./TextField";
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
  /** Der Leerfall in Worten — «Alle Stufen» statt eines leeren Felds. Er steht
      im ruhenden Label; sobald etwas gewählt ist, schwebt an dessen Stelle
      `label` auf die Kontur. Voreingestellt «Auswählen …». */
  placeholder?: string;
  supportingText?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* M2 Multi-Select — einzeiliger Feld-Trigger, der die Auswahl als
   kommaseparierte Liste zeigt, und ein Panel mit Suchfeld (Kopf), Optionsliste
   (eckige Checkbox) und Aktions-Footer (Zurücksetzen / Alle auswählen). Der
   Trigger ist gebaut wie ein Feld (Kontur in `kante`, offener Grund), das
   Panel wie ein Menü (08dp, Haarlinie, Schatten).
   Der Trigger trägt den Wert wie die Einzelauswahl: eine Zeile Text, am Ende
   abgeschnitten (`truncate`) — keine Tags, kein Zähler. Was nicht mehr in die
   Zeile passt, steht in der Liste darunter, und dort wird auch entfernt; ein
   Kreuzchen pro Wert im Feld wäre ein zweiter Ort fürs Abwählen.
   Combobox-/Listbox-Semantik (aria-multiselectable) mit voller
   Tastatursteuerung (↑/↓, Home/End, Enter toggelt, Esc schliesst). Panel
   bleibt nach Auswahl offen. „Alle auswählen" respektiert den aktiven
   Suchfilter. */
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
  // Id der Gruppen-Kopfzeile. Die Kopfzeile ist `role="presentation"` und damit
  // strukturell unsichtbar — ohne Verweis erführe eine Screenreader-Nutzerin
  // nie, zu welcher Gruppe ein Wert gehört. Jede Option zeigt darum per
  // `aria-describedby` auf sie: vorgelesen wird «<Wert>, <Gruppe>».
  const gruppenId = (gruppe: string) =>
    `${fid}-gruppe-${gruppe.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`;

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

  // Die gewählten Werte in der Reihenfolge der Optionsliste, nicht in der des
  // Anklickens: Eine Textzeile soll bei gleicher Auswahl gleich lauten, sonst
  // liest sich dasselbe Feld nach jedem Ab- und Wiederanwählen anders.
  const selectedOptions = options.filter((o) => current.includes(o.value));
  const anzeigeText = selectedOptions.map((o) => o.label).join(", ");

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
  // Das Label schwebt, sobald etwas gewählt ist — und auch, solange das Panel
  // offen steht: Dann liegt die Aufmerksamkeit auf der Liste, und der Leerfall
  // im Feld wäre eine Aussage über einen Zustand, der sich gerade ändert.
  const schwebt = !showPlaceholder || open;

  return (
    <div className={className}>
      {/* Der barrierefreie Name des Triggers und der Liste. Er bleibt konstant
          `label` («Trainingsteil»), während das sichtbare Label je nach Zustand
          zwei verschiedene Sätze zeigt — der Vorlesehilfe darf ein Feld nicht
          umbenannt werden, bloss weil jemand etwas ausgewählt hat. */}
      <span id={`${fid}-label`} className="sr-only">
        {label}
      </span>

      <div ref={rootRef} className="relative">
        {/* Trigger = Feld-Kontrakt, auf eine Zeile begrenzt. Ohne Suche ist er
            die Combobox (treibt die Liste), mit Suche ein Button, der das Panel
            öffnet (Fokus springt dann ins Suchfeld). Der Wert steht als eine
            Zeile Text und wird am Ende abgeschnitten. */}
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
            "focus-ring type-body-large flex h-12 w-full items-center gap-2 rounded-flaeche kontur bg-transparent px-4 text-on-surface",
            error ? "border-error" : "border-kante",
            // Offen zieht der Trigger die Kontur auf Primary — er gehört dann
            // zum Panel darunter und soll das auch zeigen.
            open && !error && "border-primary",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          {/* Der Leerfall steht nicht hier drin, sondern im Label darüber —
              sonst stünden im selben Feld zwei Beschriftungen übereinander.
              Bleibt die Wertzeile: die gewählten Werte durch Komma getrennt,
              eine Zeile, am Ende abgeschnitten — wie die Einzelauswahl ihren
              einen Wert zeigt. */}
          <span className="min-w-0 flex-1 truncate text-left">
            {anzeigeText}
          </span>

          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "shrink-0 text-on-surface-mittel transition-transform",
              open && "rotate-180",
            )}
          />
        </div>

        {/* Das Label wie am TextField, nur von Hand geschaltet: Ein Trigger
            ohne <input> kennt kein `:placeholder-shown`. Ruhend zeigt es den
            Leerfall («Alle Stufen») dort, wo gleich der Wert steht; sobald
            etwas gewählt ist — oder das Panel offen ist und die Wahl also
            gerade läuft —, schwebt an dessen Stelle der Name der Dimension auf
            die Kontur. `aria-hidden`, weil der Name des Felds aus dem
            sr-only-Label oben kommt und sich nicht ändern darf. */}
        <span
          aria-hidden
          className={cn(
            feldLabelBase,
            "left-3",
            schwebt ? feldLabelSchwebend : feldLabelRuhend,
            error
              ? "text-error"
              : schwebt && open
                ? "text-primary"
                : "text-on-surface-mittel",
          )}
        >
          {schwebt ? label : (placeholder ?? "Auswählen …")}
        </span>

        {open && (
          <div className="absolute z-50 mt-1 flex max-h-80 w-full flex-col overflow-hidden rounded-flaeche border border-linie bg-elev-08 shadow-dp-08">
            {searchable && (
              <div className="flex shrink-0 items-center gap-2 border-b border-linie px-3">
                <Search
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className="shrink-0 text-on-surface-mittel"
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
                  className="type-body-medium h-10 w-full bg-transparent text-on-surface outline-none placeholder:text-on-surface-mittel"
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
                <li className="type-body-medium px-3 py-2 text-on-surface-mittel">
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
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      toggle(o.value);
                      refocus();
                    }}
                    className={cn(
                      // Der echte Fokus liegt im Suchfeld bzw. auf dem
                      // Trigger, nicht auf der Zeile — die Tastatur-Aktivzeile
                      // leiht sich darum die Fokus-Deckung der Zustands-Ebene
                      // (`state-aktiv`), Hover kommt aus `state` selbst.
                      "state type-body-medium flex cursor-pointer items-center gap-3 px-3 py-2 text-on-surface",
                      isActive && "state-aktiv",
                    )}
                  >
                    {/* Eckige Checkbox: gewählt füllt sie Primary und trägt den
                        Haken in on-primary. Hier IST die Fläche die Aussage —
                        ein Kästchen ohne Füllung wäre nur ein zweiter Rahmen. */}
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-plakette kontur transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-on-primary"
                          : "border-kante",
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
              <div className="flex shrink-0 items-center justify-between border-t border-linie px-2 py-1.5">
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
            error ? "text-error" : "text-on-surface-mittel",
          )}
        >
          {supportingText}
        </p>
      )}
    </div>
  );
}
