"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { bedienzeile } from "./Menu";
import { gruppenIdVon, gruppenKopf, gruppenKopfKlasse } from "./gruppen";
import { Feld, beschreibungIdVon, useFeldId } from "./feld";

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
  /** Fester Hinweis hinter einem ⓘ (siehe `Feld`). */
  info?: ReactNode;
  /** Den festen Hinweis auf Touch-Geräten unter dem Feld zeigen (siehe `Feld`). */
  infoAufTouch?: boolean;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/* Einfachauswahl — kein natives <select>. Der Name steht über dem Feld
   (`Feld`), der Auslöser ist ein Feldkasten wie das TextField (`feldkasten`:
   ruhend ohne Kontur, offen in Primary), das aufgeklappte Panel ein Menü
   (08dp, Haarlinie, Schatten, ✓ auf der aktuellen Auswahl).
   Listbox-Semantik + vollständige Tastatursteuerung.

   Der gewählte Wert steht ganz im Feld und bricht um, statt abgeschnitten zu
   werden — eine Einordnung ist oft ein ganzer Satz (Epic #363).

   Leer ist ein Feld, dessen Wert in keiner Option steht: Dann steht der Name
   gedämpft im Feld, wie bei jedem leeren Feld (`Feld`). Ein optionales Feld
   bietet darum keine Option «— kein … —» an — leer heisst schon «nicht
   angegeben», und eine solche Option sähe aus wie eine getroffene Wahl. */
export function Select({
  label,
  options,
  value,
  defaultValue,
  onChange,
  name,
  supportingText,
  info,
  infoAufTouch,
  error,
  disabled,
  id,
  className,
}: SelectProps) {
  const fid = useFeldId(id);
  const listId = `${fid}-list`;
  const optId = (i: number) => `${fid}-opt-${i}`;
  const gruppenId = (gruppe: string) => gruppenIdVon(fid, gruppe);

  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = isControlled ? value : internal;
  // Ein Wert, der nicht in den Optionen steht, hat KEINE Auswahl — nicht die
  // erste. Sonst behauptete das Feld einen Zustand, den der Datensatz nicht
  // hat, und ein unbedachtes Speichern schriebe ihn fest.
  //
  // `foundIndex === -1` ist bei einem leeren Feld der Normalfall, nicht die
  // Ausnahme: Ein Feld, das noch nichts gewählt hat, findet keinen Treffer.
  // Darum zwei Grössen, die auseinanderzuhalten sind — `foundIndex` sagt, WAS
  // gewählt ist (nichts, wenn -1), `startIndex` nur, wo die Tastatur zu laufen
  // beginnt, wenn die Liste aufgeht. Wer den Startpunkt zum Häkchen macht,
  // markiert die erste Option als gewählt, während das Feld leer dasteht.
  const foundIndex = options.findIndex((o) => o.value === current);
  const startIndex = foundIndex === -1 ? 0 : foundIndex;
  const selected = foundIndex === -1 ? undefined : options[foundIndex];

  const [open, setOpen] = useState(false);

  const leer = foundIndex === -1;
  const [active, setActive] = useState(startIndex);

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
    setActive(startIndex);
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
    <Feld id={fid} label={label} leer={leer} hinweis={supportingText} info={info} infoAufTouch={infoAufTouch} error={error} className={className}>
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
          aria-labelledby={`${fid}-label`}
          aria-describedby={beschreibungIdVon(fid, supportingText, info)}
          aria-invalid={error || undefined}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKey}
          className={cn(
            // Offen trägt der Auslöser die Kontur in Primary (`aria-expanded`
            // im Feldkasten) — er gehört dann zum Panel darunter.
            "feldkasten type-body-large flex min-h-9 w-full items-center justify-between gap-2 px-3 py-1 text-left",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className={cn("min-w-0 flex-1 break-words", leer && "feld-leertext text-on-surface-mittel")}>
            {leer ? label : selected?.label}
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
            className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08 focus:outline-none"
          >
            {options.map((o, i) => {
              // Das Häkchen hängt an `foundIndex`, nicht am Startpunkt der
              // Tastatur: Ohne Treffer ist KEINE Option gewählt.
              const isSelected = i === foundIndex;
              const isActive = i === active;
              // Gruppen-Überschrift, sobald eine neue Gruppe beginnt.
              const kopf = gruppenKopf(options, i);
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
                  onClick={() => commit(i)}
                  className={cn(
                    // Der echte Fokus liegt auf der Listbox, nicht auf der
                    // Zeile — die Tastatur-Aktivzeile leiht sich darum die
                    // Fokus-Deckung der Zustands-Ebene (`state-aktiv`),
                    // während Hover aus `state` selbst kommt.
                    bedienzeile,
                    "cursor-pointer text-on-surface",
                    isActive && "state-aktiv",
                  )}
                >
                  <span className="grid w-[18px] shrink-0 place-items-center text-on-surface-mittel">
                    {isSelected && <Check size={18} strokeWidth={2} aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 break-words">{o.label}</span>
                </li>
                </Fragment>
              );
            })}
          </ul>
        )}

        {name && <input type="hidden" name={name} value={current} />}
      </div>
    </Feld>
  );
}
