"use client";

import { Fragment, useEffect, useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Zaehler } from "./Badge";
import { chipTextOutlined, chipTextSelected } from "./Chip";
import { Checkbox } from "./Checkbox";
import { usePanelAnker } from "./use-panel-anker";
import { gruppenIdVon, gruppenKopf, gruppenKopfKlasse } from "./gruppen";
import { SearchField } from "./SearchField";
import { TextField } from "./TextField";
import type { SelectOption } from "./Select";
import { useDebouncedWert } from "@/lib/use-debounce";

/* Filterknopf (Epic #363): ein 36-px-Knopf mit dem Namen des Filters, der ein
   Panel öffnet — nach dem Vorbild der Filter in Jira. Er nennt, WONACH
   gefiltert wird, und zählt, wie viele Werte gewählt sind; WELCHE, sieht man
   im geöffneten Panel. So bleibt eine Filterleiste eine Zeile aus Wörtern,
   statt sich in Feldern mit abgeschnittenen Wertlisten zu stapeln.

   Er trägt Schrift und Kleid des Filter-Chips: normal gesetzt; grenzt er ein,
   steht er in Primary umrandet wie ein gewählter Chip und trägt die Zahl als
   `Zaehler`. Das Panel ist breiter als der Knopf, wo der Inhalt es braucht, und rückt am rechten Rand nach links (`usePanelAnker`). Es ist
   kein Menü und keine Listbox, sondern eine Gruppe gewöhnlicher Bedien-
   elemente — Kontrollkästchen, ein Zahlenfeld —, darum gelten deren eigene
   Tasten; dazu wandern ↑/↓ zwischen ihnen, und Esc schliesst mit dem Fokus
   zurück auf den Knopf. Die Wirkung tritt sofort ein, das Panel bleibt
   offen. */
export function FilterKnopf({
  label,
  badge,
  badgeLabel,
  maxHoehe = 440,
  panelClassName,
  className,
  children,
}: {
  label: string;
  /** Was hinter dem Namen steht, solange der Filter eingrenzt — die Zahl der
   *  gewählten Werte oder der gesetzte Wert. Fehlt er, grenzt der Filter
   *  nicht ein, und der Knopf steht ruhig. */
  badge?: string | number;
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

  const aktiv = badge !== undefined && badge !== "";

  return (
    <div
      ref={wurzelRef}
      className={cn("relative", className)}
      // Wandert der Fokus nachweislich nach draussen (Tab hinaus), geht das
      // Panel zu. Ohne Ziel (`relatedTarget` leer) bleibt es offen: Safari
      // und Firefox auf dem Mac geben einem angeklickten Kontrollkästchen
      // keinen Fokus, der Fokus fällt beim Drücken ins Leere — schlösse das
      // Panel dann, käme der Klick nie an. Klicks daneben schliesst ohnehin
      // `usePanelAnker`.
      onBlur={(e) => {
        if (offen && e.relatedTarget && !wurzelRef.current?.contains(e.relatedTarget as Node)) {
          setOffen(false);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={offen}
        aria-controls={offen ? panelId : undefined}
        aria-label={aktiv && badgeLabel ? `${label}, ${badgeLabel}` : undefined}
        onClick={() => (offen ? setOffen(false) : oeffnen())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !offen) {
            e.preventDefault();
            oeffnen();
          }
        }}
        // In der Schrift und im Kleid des Filter-Chips, der in derselben Leiste
        // steht: normal gesetzt, gewählt in Primary — nur eckig, weil er ein Panel
        // öffnet statt bloss umzuschalten.
        className={cn(
          "state focus-ring type-body-medium inline-flex h-9 items-center gap-2 rounded-flaeche kontur bg-transparent px-3 transition-colors",
          aktiv ? chipTextSelected : chipTextOutlined,
        )}
      >
        {label}
        {aktiv && <Zaehler>{badge}</Zaehler>}
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
  const gruppenId = (gruppe: string) => gruppenIdVon(basisId, gruppe);

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
      badge={anzahl || undefined}
      badgeLabel={`${anzahl} gewählt`}
      // Breiter als der Knopf, so breit wie der längste Wert es braucht —
      // höchstens 34 rem (der längste Übungstyp misst 484 px) und nie über das
      // Fenster hinaus.
      panelClassName="w-max min-w-56 max-w-[min(34rem,calc(100vw-1rem))]"
      className={className}
    >
      {options.map((o, i) => {
        const kopf = gruppenKopf(options, i);
        return (
          <Fragment key={o.value}>
            {kopf && (
              <p id={gruppenId(kopf)} className={gruppenKopfKlasse}>
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

/* Zahlenfilter: der Filterknopf für eine Zahl («Verfügbare Kinder»). Der
   Knopf nennt die übernommene Zahl, eingegeben wird sie im Panel — mit
   Tipppause (300 ms), wie die Suche. Er zeigt den Wert, den der Aufrufer als
   `gesetzt` meldet, nicht den gerade getippten: Er sagt, was die Übersicht
   tatsächlich einschränkt. */
export function ZahlFilter({
  label,
  feldLabel,
  einheit,
  hinweis,
  gesetzt,
  onCommit,
  min = 1,
}: {
  label: string;
  /** Name des Zahlenfelds im Panel. */
  feldLabel: string;
  /** Wofür die Zahl steht, für die Vorlesehilfe am Knopf («12 Kinder»). */
  einheit: string;
  hinweis?: string;
  gesetzt?: number;
  onCommit: (wert: string) => void;
  min?: number;
}) {
  const [wert, aendern] = useDebouncedWert(gesetzt?.toString() ?? "", onCommit);
  return (
    <FilterKnopf
      label={label}
      badge={gesetzt}
      badgeLabel={gesetzt !== undefined ? `${gesetzt} ${einheit}` : undefined}
      panelClassName="w-64 px-3 py-2"
    >
      <TextField
        label={feldLabel}
        type="number"
        inputMode="numeric"
        min={min}
        umrandet
        value={wert}
        onChange={(e) => aendern(e.target.value)}
        supportingText={hinweis}
      />
    </FilterKnopf>
  );
}

/* Die Suche einer Filterleiste: ohne sichtbaren Namen — ihr Ort und ihr
   Platzhalter sagen, wofür sie da ist —, dafür umrandet, denn neben den
   umrandeten Filterknöpfen stünde sonst ein Feld, das man nicht sieht. Wirkt
   nach einer Tipppause (300 ms); das Kreuz zum Leeren läuft über denselben
   Weg. */
export function FilterSuche({
  label,
  initial,
  onCommit,
  className = "w-full sm:w-72",
}: {
  label: string;
  initial: string;
  onCommit: (wert: string) => void;
  className?: string;
}) {
  const [wert, aendern] = useDebouncedWert(initial, onCommit);
  return (
    <SearchField
      label={label}
      labelVersteckt
      umrandet
      placeholder={label}
      value={wert}
      onChange={(e) => aendern(e.target.value)}
      className={className}
    />
  );
}
