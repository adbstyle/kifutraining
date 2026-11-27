"use client";

import { Fragment, useEffect, useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "./Lozenge";
import { chipOutlined, chipSelected } from "./Chip";
import { Checkbox } from "./Checkbox";
import { usePanelAnker } from "./use-panel-anker";
import { gruppenIdVon, gruppenKopf, gruppenKopfKlasse } from "./gruppen";
import { SearchField } from "./SearchField";
import { TextField } from "./TextField";
import { DateField } from "./DateTimeField";
import { Radio } from "./Radio";
import type { SelectOption } from "./Select";
import { useDebouncedWert } from "@/lib/use-debounce";

/* Filterknopf (Epic #363): ein 36-px-Knopf mit dem Namen des Filters, der ein
   Panel öffnet — nach dem Vorbild der Filter in Jira. Er nennt, WONACH
   gefiltert wird, und zählt, wie viele Werte gewählt sind; WELCHE, sieht man
   im geöffneten Panel. So bleibt eine Filterleiste eine Zeile aus Wörtern,
   statt sich in Feldern mit abgeschnittenen Wertlisten zu stapeln.

   Er trägt Schrift und Kleid des Filter-Chips: normal gesetzt; grenzt er ein,
   steht er in Primary umrandet wie ein gewählter Chip und trägt die Zahl als
   `Badge`. Das Panel ist breiter als der Knopf, wo der Inhalt es braucht, und rückt am rechten Rand nach links (`usePanelAnker`). Es ist
   kein Menü und keine Listbox, sondern eine Gruppe gewöhnlicher Bedien-
   elemente — Kontrollkästchen, ein Zahlenfeld —, darum gelten deren eigene
   Tasten; dazu wandern ↑/↓ zwischen ihnen, und Esc schliesst mit dem Fokus
   zurück auf den Knopf. Die Wirkung tritt sofort ein, das Panel bleibt
   offen. */
export function FilterKnopf({
  label,
  badge,
  badgeLabel,
  wert,
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
  /** Für einen Filter mit genau einem Wert (Zeitraum, #700): Solange er
   *  eingrenzt, nennt der Knopf den Wert im Text («Zeitraum: Letzte 30
   *  Tage», nach dem Vorbild von Jira, PO 2026-11-27) statt einer Zahl;
   *  `badge` entfällt dann. */
  wert?: string | null;
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
    // Im Zahlen- und im Datumsfeld gehören die Pfeile dem Feld (sie zählen
    // die Zahl bzw. den Tag).
    if ((e.target as HTMLElement).matches('input[type="number"], input[type="date"]')) return;
    const alle = bedienbare(panelRef.current);
    const i = alle.indexOf(document.activeElement as HTMLElement);
    const naechster = e.key === "ArrowDown" ? alle[i + 1] ?? alle[0] : alle[i - 1] ?? alle[alle.length - 1];
    if (naechster) {
      e.preventDefault();
      naechster.focus();
    }
  }

  const mitWert = wert !== undefined && wert !== null && wert !== "";
  const aktiv = mitWert || (badge !== undefined && badge !== "");

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
        aria-label={!mitWert && aktiv && badgeLabel ? `${label}, ${badgeLabel}` : undefined}
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
          aktiv ? chipSelected : chipOutlined,
        )}
      >
        {mitWert ? `${label}: ${wert}` : label}
        {aktiv && !mitWert && <Badge>{badge}</Badge>}
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

/* Zahlenfilter: der Filterknopf für eine Zahl («Verfügbare Spieler:innen»). Der
   Knopf nennt die übernommene Zahl, eingegeben wird sie im Panel — mit
   Tipppause (300 ms), wie die Suche. Er zeigt den Wert, den der Aufrufer als
   `gesetzt` meldet, nicht den gerade getippten: Er sagt, was die Übersicht
   tatsächlich einschränkt. */
export function ZahlFilter({
  label,
  feldLabel,
  einheit,
  einheitEins = einheit,
  hinweis,
  gesetzt,
  onCommit,
  min = 1,
}: {
  label: string;
  /** Name des Zahlenfelds im Panel. */
  feldLabel: string;
  /** Wofür die Zahl steht, für die Vorlesehilfe am Knopf («12 Spieler:innen»). */
  einheit: string;
  /** Einzahl der Einheit für den Wert 1 («1 Spieler:in»); ohne Angabe gilt `einheit`. */
  einheitEins?: string;
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
      badgeLabel={gesetzt !== undefined ? `${gesetzt} ${gesetzt === 1 ? einheitEins : einheit}` : undefined}
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
   Weg. `bereinige`: wie die Seite den übernommenen Wert bereinigt zurückgibt
   (`initial`) — dieselbe Funktion, mit der `useAdressFilter().setzeWert` ihn
   in die Adresse schreibt; so überschreibt das Echo der eigenen Eingabe das
   Feld nie. */
export function FilterSuche({
  label,
  initial,
  onCommit,
  bereinige,
  className = "w-full sm:w-72",
}: {
  label: string;
  initial: string;
  onCommit: (wert: string) => void;
  bereinige?: (wert: string) => string;
  className?: string;
}) {
  const [wert, aendern] = useDebouncedWert(initial, onCommit, bereinige);
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

/* Zeitraumfilter (#700): der Filterknopf für einen Zeitraum aus zwei Tagen.
   Der Knopf nennt den gesetzten Zeitraum im Text (`wert`, «Zeitraum: Letzte
   30 Tage») statt einer Zahl — ein Zeitraum ist genau ein Wert, eine «1»
   sagte nichts. Im Panel oben die Kurzwahl als Einfachauswahl (sie setzt den
   Von-Tag und lässt den Bis-Tag offen), darunter Von und Bis frei; wer einen
   Tag von Hand ändert, verlässt die Kurzwahl. Beide Tage zählen mit, ein
   leerer lässt die Seite offen. Die Wirkung tritt sofort ein, das Panel
   bleibt offen — wie bei den übrigen Filterknöpfen. */
export function ZeitraumFilter({
  label,
  wert,
  von,
  bis,
  bisHoechstens,
  kurzwahl,
  texte,
  onChange,
}: {
  label: string;
  /** Was der Knopf nennt, solange ein Zeitraum gilt; `null` ohne. */
  wert: string | null;
  von: string | null;
  bis: string | null;
  /** Der späteste wählbare Tag (heute am Trainingsort). */
  bisHoechstens: string;
  /** Die Kurzwahl mit ihrem Von-Tag; `aktiv` die passende. */
  kurzwahl: readonly { id: string; label: string; von: string; aktiv: boolean }[];
  texte: { kurzwahl: string; vonBis: string; von: string; bis: string };
  onChange: (zeitraum: { von: string; bis: string }) => void;
}) {
  const kopfId = useId();
  // Die Tage stehen im Feld, bevor sie gelten: Ein natives Datumsfeld meldet
  // beim Tippen des Jahres jeden Zwischenstand (0002, 0020, 0202 …). In die
  // Adresse geht ein Tag, sobald er vollständig ist; ein leeres Feld hebt die
  // Seite beim Verlassen auf. Ein Stand von aussen
  // (Kurzwahl, Zurücksetzen, Zurück im Browser) ersetzt die Felder.
  const [tage, setTage] = useState({ von: von ?? "", bis: bis ?? "" });
  const [vonAussen, setVonAussen] = useState(`${von}|${bis}`);
  if (`${von}|${bis}` !== vonAussen) {
    setVonAussen(`${von}|${bis}`);
    setTage({ von: von ?? "", bis: bis ?? "" });
  }
  const fertig = (tag: string) => tag === "" || (/^\d{4}-\d{2}-\d{2}$/.test(tag) && tag >= "1900-01-01");
  function uebernehmen(t: { von: string; bis: string }) {
    if (fertig(t.von) && fertig(t.bis) && (t.von !== (von ?? "") || t.bis !== (bis ?? ""))) onChange(t);
  }
  function tippen(feld: "von" | "bis", wert: string) {
    const t = { ...tage, [feld]: wert };
    setTage(t);
    // Ein geleertes Feld gilt erst beim Verlassen — beim Tippen leert der
    // Browser auch Zwischenstände.
    if (wert !== "") uebernehmen(t);
  }
  return (
    <FilterKnopf label={label} wert={wert} panelClassName="w-72 pb-3">
      <p id={kopfId} className={gruppenKopfKlasse}>
        {texte.kurzwahl}
      </p>
      <div role="radiogroup" aria-labelledby={kopfId} className="flex flex-col">
        {kurzwahl.map((k) => (
          <Radio
            key={k.id}
            name={`${kopfId}-kurzwahl`}
            label={k.label}
            checked={k.aktiv}
            onChange={() => onChange({ von: k.von, bis: "" })}
            className="state w-full px-3 py-1.5"
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col gap-3 border-t border-linie px-3 pt-3">
        <p className="type-label-medium text-on-surface-mittel">{texte.vonBis}</p>
        <DateField
          label={texte.von}
          value={tage.von}
          max={tage.bis || bisHoechstens}
          onChange={(e) => tippen("von", e.target.value)}
          onBlur={() => uebernehmen(tage)}
        />
        <DateField
          label={texte.bis}
          value={tage.bis}
          min={tage.von || undefined}
          max={bisHoechstens}
          onChange={(e) => tippen("bis", e.target.value)}
          onBlur={() => uebernehmen(tage)}
        />
      </div>
    </FilterKnopf>
  );
}
