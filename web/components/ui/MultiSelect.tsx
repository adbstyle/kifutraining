"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, RotateCcw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { bedienzeile } from "./Menu";
import { gruppenIdVon, gruppenKopf, gruppenKopfKlasse } from "./gruppen";
import { IconButton } from "./IconButton";
import { Feld, beschreibungIdVon, useFeldId } from "./feld";
import { usePanelAnker } from "./use-panel-anker";
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
  supportingText?: string;
  /** Fester Hinweis hinter einem ⓘ (siehe `Feld`). */
  info?: ReactNode;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Den Namen nur der Vorlesehilfe geben (siehe `Feld`). */
  labelVersteckt?: boolean;
  /** Mit offener Liste beginnen und den Fokus übernehmen — für eine
   *  bearbeitbare Eigenschaft, die sich per Klick in das Feld verwandelt. */
  anfangsOffen?: boolean;
  /** Die Liste hat sich geschlossen — `perTaste` bei Esc und erneutem
   *  Auslösen am Feld, sonst (Klick daneben, Hinausscrollen) nicht. */
  onListeZu?: (perTaste: boolean) => void;
}

/* Mehrfachauswahl im Formular — der Name steht über dem Feld (`Feld`), der
   Auslöser ist ein Feldkasten (`feldkasten`) und zeigt die Auswahl als
   kommaseparierte Liste, die umbricht. Dazu ein Panel mit Suchfeld (Kopf),
   Optionsliste (eckige Checkbox) und Aktions-Footer (Zurücksetzen / Alle
   auswählen), gebaut wie ein Menü (08dp, Haarlinie, Schatten). Keine Tags
   im Feld: Entfernt wird in der Liste, wo auch gewählt wird; ein Kreuzchen
   pro Wert im Feld wäre ein zweiter Ort fürs Abwählen.
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
  supportingText,
  info,
  error,
  disabled,
  id,
  className,
  labelVersteckt,
  anfangsOffen = false,
  onListeZu,
}: MultiSelectProps) {
  const fid = useFeldId(id);
  const listId = `${fid}-list`;
  const optId = (i: number) => `${fid}-opt-${i}`;
  const gruppenId = (gruppe: string) => gruppenIdVon(fid, gruppe);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string[]>(defaultValue ?? []);
  const current = isControlled ? value : internal;

  const [open, setOpen] = useState(anfangsOffen);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Aufklappen, Grösse, Klick daneben und Zuklappen beim Hinausscrollen —
  // geteilt mit dem Filterknopf (siehe `usePanelAnker`).
  const { wurzelRef, triggerRef, panelRef, messe, panelStil, panelLage } =
    usePanelAnker<HTMLDivElement>({
      offen: open,
      onSchliessen: () => {
        setOpen(false);
        setQuery("");
        onListeZu?.(false);
      },
    });
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
    messe();
    setOpen(true);
  }
  function closePanel() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
    onListeZu?.(true);
  }

  // Mit offener Liste begonnen: messen und den Fokus übernehmen, wie ein
  // Öffnen per Klick es täte.
  useEffect(() => {
    if (!anfangsOffen) return;
    messe();
    if (!searchable) triggerRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // `min-w-0`: In einem Grid- oder Flex-Elternteil darf das Feld schmaler
    // werden als ein langer Wert — der bricht dann um, statt das Raster zu
    // sprengen.
    <Feld
      id={fid}
      label={label}
      labelVersteckt={labelVersteckt}
      hinweis={supportingText}
      info={info}
      error={error}
      leer={showPlaceholder}
      className={cn("min-w-0", className)}
      // Der Auslöser ist ein <div> und lässt sich nicht beschriften; ein
      // Klick auf den Namen öffnet ihn darum von Hand, wie ein Label es täte.
      onLabelClick={() => {
        triggerRef.current?.focus();
        openPanel();
      }}
    >
      <div ref={wurzelRef} className="relative">
        {/* Ohne Suche ist der Auslöser die Combobox (treibt die Liste), mit
            Suche ein Button, der das Panel öffnet (Fokus springt dann ins
            Suchfeld). Die gewählten Werte stehen durch Komma getrennt im Feld
            und brechen um, statt abgeschnitten zu werden (Epic #363) — keine
            Tags: Entfernt wird in der Liste, wo auch gewählt wird. */}
        <div
          id={fid}
          ref={triggerRef}
          role={searchable ? "button" : "combobox"}
          tabIndex={disabled ? -1 : 0}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${fid}-label`}
          aria-describedby={beschreibungIdVon(fid, supportingText, info)}
          aria-invalid={error || undefined}
          aria-activedescendant={
            !searchable && open && filtered[active] ? optId(active) : undefined
          }
          onClick={() => {
            if (disabled) return;
            if (!open) messe();
            else onListeZu?.(true);
            setOpen((o) => !o);
          }}
          onKeyDown={onTriggerKey}
          className={cn(
            // Offen trägt der Auslöser die Kontur in Primary (`aria-expanded`
            // im Feldkasten) — er gehört dann zum Panel darunter.
            "feldkasten type-body-large flex min-h-9 w-full items-center gap-2 px-3 py-1",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          <span className={cn("min-w-0 flex-1 break-words text-left", showPlaceholder && "feld-leertext text-on-surface-mittel")}>
            {showPlaceholder ? label : anzeigeText}
          </span>

          <ChevronDown
            size={18}
            strokeWidth={2}
            aria-hidden
            className={cn(
              "feld-chevron shrink-0 text-on-surface-mittel transition-transform",
              open && "rotate-180",
            )}
          />
        </div>

        {open && (
          <div
            ref={panelRef}
            style={panelStil}
            className={cn(
              "absolute z-50 flex w-full flex-col overflow-hidden rounded-flaeche border border-linie bg-elev-08 shadow-dp-08",
              panelLage,
            )}
          >
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
                  className="type-body-medium h-9 w-full bg-transparent text-on-surface outline-none placeholder:text-on-surface-mittel"
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
                const kopf = gruppenKopf(filtered, i);
                return (
                  <Fragment key={o.value}>
                  {kopf && (
                    <li
                      id={gruppenId(kopf)}
                      role="presentation"
                      className={gruppenKopfKlasse}
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
                      bedienzeile,
                      "cursor-pointer text-on-surface",
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
                    <span className="min-w-0 flex-1 break-words">{o.label}</span>
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
                  onClick={reset}
                  disabled={current.length === 0}
                />
                <IconButton
                  icon={CheckCheck}
                  label="Alle auswählen"
                  title="Alle auswählen"
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
    </Feld>
  );
}
