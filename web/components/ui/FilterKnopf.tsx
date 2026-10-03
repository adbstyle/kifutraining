"use client";

import { Fragment, useEffect, useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClasses } from "./Button";
import { Checkbox } from "./Checkbox";
import { usePanelAnker } from "./use-panel-anker";
import type { SelectOption } from "./Select";

/* Filterknopf (Epic #363): ein 36-px-Knopf mit dem Namen des Filters, der ein
   Panel öffnet — nach dem Vorbild der Filter in Jira. Er nennt, WONACH
   gefiltert wird, und zählt, wie viele Werte gewählt sind; WELCHE, sieht man
   im geöffneten Panel. So bleibt eine Filterleiste eine Zeile aus Wörtern,
   statt sich in Feldern mit abgeschnittenen Wertlisten zu stapeln.

   Grenzt er ein, steht er getönt (`aktiv`, wie ein gewählter Chip) und trägt
   die Zahl als Plakette. Das Panel ist breiter als der Knopf, wo der Inhalt
   es braucht, und rückt am rechten Rand nach links (`usePanelAnker`). Es ist
   kein Menü und keine Listbox, sondern eine Gruppe gewöhnlicher Bedien-
   elemente — Kontrollkästchen, ein Zahlenfeld —, darum gelten deren eigene
   Tasten; dazu wandern ↑/↓ zwischen ihnen, und Esc schliesst mit dem Fokus
   zurück auf den Knopf. Die Wirkung tritt sofort ein, das Panel bleibt
   offen. */
export function FilterKnopf({
  label,
  aktiv,
  badge,
  badgeLabel,
  maxHoehe = 440,
  panelClassName,
  className,
  children,
}: {
  label: string;
  /** Grenzt der Filter gerade ein? Dann steht der Knopf getönt. */
  aktiv: boolean;
  /** Was hinter dem Namen steht, solange der Filter eingrenzt — die Zahl der
   *  gewählten Werte oder der gesetzte Wert. */
  badge?: ReactNode;
  /** Dasselbe in Worten für die Vorlesehilfe («2 gewählt»). */
  badgeLabel?: string;
  maxHoehe?: number;
  /** Breite des Panels. */
  panelClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const panelId = useId();
  const { wurzelRef, triggerRef, panelRef, messe, panelStil, panelLage } =
    usePanelAnker<HTMLButtonElement>({ offen, onSchliessen: () => setOffen(false), maxHoehe });

  function oeffnen() {
    messe();
    setOffen(true);
  }
  function schliessenMitFokus() {
    setOffen(false);
    triggerRef.current?.focus();
  }

  // Beim Aufklappen steht der Fokus auf dem ersten Bedienelement im Panel.
  useEffect(() => {
    if (offen) bedienbare(panelRef.current)[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  function aufPanelTaste(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      schliessenMitFokus();
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    // Im Zahlenfeld gehören die Pfeile dem Feld (es zählt sie ohnehin nicht).
    if ((e.target as HTMLElement).matches('input[type="number"]')) return;
    const alle = bedienbare(panelRef.current);
    const i = alle.indexOf(document.activeElement as HTMLElement);
    const naechster = e.key === "ArrowDown" ? alle[i + 1] ?? alle[0] : alle[i - 1] ?? alle[alle.length - 1];
    if (naechster) {
      e.preventDefault();
      naechster.focus();
    }
  }

  const zeigtBadge = aktiv && badge !== undefined && badge !== null && badge !== "";

  return (
    <div
      ref={wurzelRef}
      className={cn("relative", className)}
      // Verlässt der Fokus Knopf und Panel (Tab hinaus), geht das Panel zu.
      onBlur={(e) => {
        if (offen && !wurzelRef.current?.contains(e.relatedTarget as Node)) setOffen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={offen}
        aria-controls={offen ? panelId : undefined}
        aria-label={zeigtBadge && badgeLabel ? `${label}, ${badgeLabel}` : undefined}
        onClick={() => (offen ? setOffen(false) : oeffnen())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !offen) {
            e.preventDefault();
            oeffnen();
          }
        }}
        className={buttonClasses(aktiv ? "aktiv" : "outlined")}
      >
        {label}
        {zeigtBadge && (
          <span
            aria-hidden={badgeLabel ? true : undefined}
            className="type-plakette inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-on-primary"
          >
            {badge}
          </span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden
          className={cn("shrink-0 transition-transform motion-reduce:transition-none", offen && "rotate-180")}
        />
      </button>

      {offen && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={label}
          style={panelStil}
          onKeyDown={aufPanelTaste}
          className={cn(
            "absolute z-50 overflow-y-auto rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08",
            panelLage,
            panelClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function bedienbare(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll<HTMLElement>("input:not([disabled]), button:not([disabled])"));
}

/* Auswahlfilter: der Filterknopf für eine Dimension mit festen Werten
   (Alterskategorie, Feldtyp, Übungstyp …). Im Panel steht je Wert ein
   Kontrollkästchen; lange Werte brechen um und bleiben ganz lesbar.
   Werte aus zwei Welten (Kinder- und Juniorenfussball) stehen unter je einer
   Kopfzeile — die Optionen müssen dafür gruppensortiert übergeben werden, und
   jedes Kästchen verweist auf seine Gruppe, damit sie mitvorgelesen wird. */
export function AuswahlFilter({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (werte: string[]) => void;
  className?: string;
}) {
  const basisId = useId();
  const gruppenId = (gruppe: string) =>
    `${basisId}-${gruppe.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}`;

  // Die Wahl wirkt über die Adresse, und die kommt erst mit der nächsten
  // Antwort des Servers zurück. Wer schnell hintereinander wählt, baute sonst
  // auf dem alten Stand auf und verlöre die vorige Wahl. Darum führt der
  // Filter seine Auswahl selbst nach und gleicht sie an, sobald von aussen
  // ein anderer Stand kommt (Zurücksetzen, Zurück-Navigation).
  const [gewaehlt, setGewaehlt] = useState(value);
  const [vonAussen, setVonAussen] = useState(value.join(","));
  if (value.join(",") !== vonAussen) {
    setVonAussen(value.join(","));
    setGewaehlt(value);
  }

  function umschalten(wert: string) {
    // In der Reihenfolge der Optionen, nicht in der des Anklickens: Dieselbe
    // Auswahl soll in der Adresse immer gleich lauten.
    const neu = gewaehlt.includes(wert) ? gewaehlt.filter((v) => v !== wert) : [...gewaehlt, wert];
    const geordnet = options.map((o) => o.value).filter((v) => neu.includes(v));
    setGewaehlt(geordnet);
    onChange(geordnet);
  }

  const anzahl = gewaehlt.length;

  return (
    <FilterKnopf
      label={label}
      aktiv={anzahl > 0}
      badge={anzahl}
      badgeLabel={`${anzahl} gewählt`}
      // Breiter als der Knopf, so breit wie der längste Wert es braucht —
      // höchstens 34 rem (der längste Übungstyp misst 484 px) und nie über das
      // Fenster hinaus.
      panelClassName="w-max min-w-56 max-w-[min(34rem,calc(100vw-1rem))]"
      className={className}
    >
      {options.map((o, i) => {
        const kopf = o.group && o.group !== options[i - 1]?.group ? o.group : null;
        return (
          <Fragment key={o.value}>
            {kopf && (
              <p id={gruppenId(kopf)} className="px-3 pb-1 pt-2 type-label-small text-on-surface-mittel">
                {kopf}
              </p>
            )}
            <Checkbox
              label={o.label}
              checked={gewaehlt.includes(o.value)}
              onChange={() => umschalten(o.value)}
              aria-describedby={o.group ? gruppenId(o.group) : undefined}
              className="state w-full px-3 py-1.5"
            />
          </Fragment>
        );
      })}
    </FilterKnopf>
  );
}
