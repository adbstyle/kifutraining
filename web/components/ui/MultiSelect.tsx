"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCheck, ChevronDown, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { bedienzeile } from "./Menu";
import { IconButton } from "./IconButton";
import { Feld, hinweisIdVon, useFeldId } from "./feld";
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

/* Die Masse des Panels in px. `PANEL_MAX_HOEHE` ist die Vorgabe (das frühere
   `max-h-80`), `PANEL_MIN_HOEHE` die Untergrenze, unter die keine Messung
   drücken darf — etwa zwei Zeilen plus Kopf und Fuss. `PANEL_ABSTAND` ist der
   Spalt zwischen Feld und Panel, nach oben wie nach unten. */
const PANEL_MAX_HOEHE = 320;
const PANEL_MIN_HOEHE = 160;
const PANEL_ABSTAND = 4;

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
  placeholder,
  supportingText,
  error,
  disabled,
  id,
  className,
}: MultiSelectProps) {
  const fid = useFeldId(id);
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
  // Wohin das Panel aufklappt und wie hoch es werden darf — gemessen, nicht
  // gesetzt (siehe `messePlatz`). Bis zur ersten Messung gilt die Vorgabe:
  // nach unten, volle Höhe.
  const [platz, setPlatz] = useState<{ oben: boolean; maxHoehe: number }>({
    oben: false,
    maxHoehe: PANEL_MAX_HOEHE,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Nur Tastatur-Navigation soll die aktive Option ins Sichtfeld scrollen.
  // Hover setzt `active` ebenfalls — würde das scrollen, springt die Liste
  // bei jeder Mausbewegung (scrollIntoView auf der überlaufenden Liste).
  const kbdNav = useRef(false);
  // Der Vorfahre, gegen den zuletzt gemessen wurde (null = das Sichtfeld).
  // Solange das Panel offen ist, wird er beobachtet — siehe den Effekt unten.
  const grenzRef = useRef<HTMLElement | null>(null);

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

  /* Wie viel Raum das Panel wirklich hat — und auf welcher Seite.

     Nötig, weil eine feste Höhe nur dort stimmt, wo unter dem Feld auch 320 px
     liegen. Im Übungs-Picker etwa steht das Feld in einem nativen <dialog>;
     der schrumpft auf seinen Inhalt und trägt aus der Browser-Vorgabe
     `overflow: auto`. Ist die Trefferliste darunter kurz oder leer — also
     genau dann, wenn jemand den Filter öffnet, um die Eingrenzung zu lockern
     —, schnitt der Dialog die untere Hälfte des Panels ab, mitsamt seinem
     Aktions-Footer.

     Gemessen wird gegen den nächsten Vorfahren, der überhaupt abschneidet
     (`overflow` ≠ `visible`), sonst gegen das Sichtfeld. Die Seite mit mehr
     Raum gewinnt; die Höhe ist der kleinere Wert aus Vorgabe und dem, was dort
     hinpasst. Die Liste im Panel scrollt ohnehin — ein knapperes Panel zeigt
     also weniger auf einmal, verliert aber nichts. */
  function messePlatz(): boolean {
    const t = triggerRef.current;
    if (!t) return true;
    const feld = t.getBoundingClientRect();

    let grenze = { top: 0, bottom: window.innerHeight };
    let grenzElement: HTMLElement | null = null;
    for (let el = t.parentElement; el; el = el.parentElement) {
      if (getComputedStyle(el).overflow !== "visible") {
        const r = el.getBoundingClientRect();
        grenze = {
          top: Math.max(grenze.top, r.top),
          bottom: Math.min(grenze.bottom, r.bottom),
        };
        grenzElement = el;
        break;
      }
    }
    grenzRef.current = grenzElement;

    const unten = grenze.bottom - feld.bottom - PANEL_ABSTAND;
    const oben = feld.top - grenze.top - PANEL_ABSTAND;
    const nachOben = unten < Math.min(PANEL_MAX_HOEHE, oben);
    setPlatz({
      oben: nachOben,
      // Nie unter die Untergrenze: Lieber ragt das Panel ein Stück hinaus, als
      // dass es auf einen unbedienbaren Spalt zusammenfällt.
      maxHoehe: Math.max(
        PANEL_MIN_HOEHE,
        Math.min(PANEL_MAX_HOEHE, nachOben ? oben : unten),
      ),
    });

    // Liegt das Feld selbst noch im sichtbaren Bereich? Ist es ganz
    // hinausgescrollt, hilft keine Messung mehr: Das Panel hängt am Feld und
    // ist mit ihm draussen. Der Aufrufer entscheidet, was dann zu tun ist.
    return feld.bottom > grenze.top && feld.top < grenze.bottom;
  }

  function openPanel() {
    if (disabled) return;
    messePlatz();
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

  // Die Messung beim Öffnen ist eine Momentaufnahme — sie veraltet, sobald
  // sich darunter etwas verschiebt. Solange das Panel offen ist, wird sie
  // darum an den drei Wegen nachgezogen, auf denen sich seine Geometrie
  // überhaupt ändern kann:
  //
  // 1. `scroll` am Dokument, in der Capture-Phase. Das Scroll-Ereignis steigt
  //    nicht auf, wenn ein Kasten im Inneren scrollt statt der Seite — beim
  //    Abwärtsfangen erwischt man beide. Der häufigste Fall überhaupt: Ein
  //    nach oben geklapptes Panel wandert beim Weiterscrollen aus dem oberen
  //    Rand, bis nur noch ein Streifen dasteht.
  // 2. Grösse des Vorfahren, gegen den gemessen wurde (`ResizeObserver`). Der
  //    scharfe Fall steht im Übungs-Picker: Das Panel bleibt nach einer Wahl
  //    bewusst offen, und genau diese Wahl kürzt die Trefferliste unter ihm —
  //    der Dialog schrumpft auf seinen Inhalt, die Kante wandert nach oben,
  //    und das eben noch passende Panel ragt hinaus.
  // 3. `resize` am Fenster — Fenstergrösse wie Drehung des Geräts.
  //
  // Scrollt das Feld ganz aus dem Bild, wird zugeklappt statt nachgemessen:
  // Das Panel hängt am Feld und ist mit ihm draussen — ein Streifen davon am
  // Rand wäre nur noch ein Rest ohne seinen Bezug. Der Fokus bleibt dabei, wo
  // er ist (kein `closePanel`), sonst risse das Zuklappen die Seite an eine
  // Stelle zurück, von der der Nutzer gerade weggescrollt ist.
  //
  // Gemessen wird höchstens einmal pro Bild: `scroll` feuert dicht, und die
  // Messung liest Layout (`getBoundingClientRect`, `getComputedStyle` über die
  // Vorfahren). Kein Rückkopplungsrisiko: Das Panel ist absolut positioniert
  // und ändert die Grösse des beobachteten Elements nicht.
  useEffect(() => {
    if (!open) return;
    let bild = 0;
    const nachmessen = () => {
      if (bild) return;
      bild = requestAnimationFrame(() => {
        bild = 0;
        if (!messePlatz()) {
          setOpen(false);
          setQuery("");
        }
      });
    };
    document.addEventListener("scroll", nachmessen, true);
    window.addEventListener("resize", nachmessen);
    const beobachter = grenzRef.current
      ? new ResizeObserver(nachmessen)
      : null;
    if (beobachter && grenzRef.current) beobachter.observe(grenzRef.current);
    return () => {
      if (bild) cancelAnimationFrame(bild);
      document.removeEventListener("scroll", nachmessen, true);
      window.removeEventListener("resize", nachmessen);
      beobachter?.disconnect();
    };
    // `messePlatz` liest nur Refs und ruft `setPlatz` — beide über Renders
    // hinweg stabil, eine veraltete Closure kann hier nichts Falsches tun.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
    // `min-w-0`: In einem Grid- oder Flex-Elternteil darf das Feld schmaler
    // werden als ein langer Wert — der bricht dann um, statt das Raster zu
    // sprengen.
    <Feld id={fid} label={label} hinweis={supportingText} error={error} className={cn("min-w-0", className)}>
      <div ref={rootRef} className="relative">
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
          aria-describedby={hinweisIdVon(fid, supportingText)}
          aria-invalid={error || undefined}
          aria-activedescendant={
            !searchable && open && filtered[active] ? optId(active) : undefined
          }
          onClick={() => {
            if (disabled) return;
            if (!open) messePlatz();
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
          <span className={cn("min-w-0 flex-1 break-words text-left", showPlaceholder && "text-on-surface-mittel")}>
            {showPlaceholder ? (placeholder ?? "Auswählen …") : anzeigeText}
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

        {open && (
          <div
            style={{ maxHeight: platz.maxHoehe }}
            className={cn(
              "absolute z-50 flex w-full flex-col overflow-hidden rounded-flaeche border border-linie bg-elev-08 shadow-dp-08",
              platz.oben ? "bottom-full mb-1" : "top-full mt-1",
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
