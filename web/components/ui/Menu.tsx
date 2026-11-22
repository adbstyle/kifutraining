"use client";

import { Fragment, useEffect, useId, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* Eine Zeile in Menü und Auswahlpanel: 36 px wie jedes Bedienelement
   (Epic #363). `min-h` statt fester Höhe, damit ein langer Wert umbrechen
   darf, statt abgeschnitten zu werden — einzeilig hält die Mindesthöhe sie
   genau auf 36 px. Geteilt von Menu, Select und MultiSelect, damit
   das Mass an EINER Stelle steht. */
export const bedienzeile = "state type-body-medium flex min-h-9 items-center gap-3 px-3 py-1.5";

/** Die fokussierbaren Einträge des Menüs in DOM-Reihenfolge. Über das DOM
 *  statt über Refs, damit die Reihenfolge auch dann stimmt, wenn `items`
 *  zwischen zwei Renders wechselt. */
function eintraege(wurzel: HTMLElement | null) {
  return Array.from(wurzel?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
}

export interface MenuItemDef {
  label: string;
  icon?: LucideIcon;
  /** Rechts in der Zeile: ein Kürzel oder, bei der `LozengeAuswahl`, der Pfeil
   *  mit dem Ziel-Zustand. */
  trailing?: ReactNode;
  danger?: boolean;
  /** Ein Strich davor: Seltenes steht nach einem Trenner (Epic #490). */
  trenner?: boolean;
  /** Ein leiser Satz unter der Zeile, etwa wohin ein Rückgängig führt. */
  hinweis?: string;
  /** Eine von mehreren Möglichkeiten (#567, Darstellung): Gesetzt wird die
   *  Zeile zur Auswahl (`menuitemradio`), die gewählte trägt den Haken. */
  gewaehlt?: boolean;
  /** Ein Ziel statt einer Aktion (#661, Konto-Menü): Die Zeile wird ein Link
   *  (`menuitem`), damit die Warnung vor ungesicherten Angaben (#246) sie
   *  abfängt wie jeden Link der Leiste. `onSelect` läuft trotzdem mit. */
  href?: string;
  /** Eine leise Überschrift über mehreren Zeilen (#661, «Darstellung» im
   *  Konto-Menü): Aufeinanderfolgende Zeilen mit demselben Wert bilden eine
   *  Gruppe (`role="group"`), die Überschrift ist ihr Name. */
  gruppe?: string;
  onSelect?: () => void;
}

/** Aufeinanderfolgende Zeilen mit derselben `gruppe` zusammen; jede Zeile
 *  behält ihren Index (Kennung ihres Hinweises). */
function abschnitte(items: MenuItemDef[]) {
  const liste: { gruppe?: string; zeilen: { item: MenuItemDef; i: number }[] }[] = [];
  items.forEach((item, i) => {
    const letzter = liste[liste.length - 1];
    if (letzter && item.gruppe !== undefined && letzter.gruppe === item.gruppe) {
      letzter.zeilen.push({ item, i });
    } else {
      liste.push({ gruppe: item.gruppe, zeilen: [{ item, i }] });
    }
  });
  return liste;
}

/* M2 Menu — verankertes Dropdown. In einen `relative` Wrapper neben den
   Trigger setzen. Schliesst bei Outside-Click und Escape. Das Panel schwebt:
   08dp, Haarlinie als Abschluss, Schatten darunter.

   `triggerRef`: Ref auf das öffnende Trigger-Element. Wird der Trigger als
   Toggle benutzt (öffnet UND schliesst per Klick), MUSS er hier übergeben
   werden — sonst schliesst der Outside-Click-Handler (mousedown) das Menü,
   bevor der Trigger-Klick es togglet, und es öffnet sich sofort wieder. Mit
   triggerRef ignoriert der Handler Klicks auf den Trigger und überlässt ihm
   das Schliessen.

   Tastatur (ARIA-Menu-Muster): beim Öffnen wandert der Fokus auf den ersten
   Eintrag, ↑/↓ laufen zyklisch durch die Einträge, Home/End springen an die
   Enden. Den Fokus an den Trigger zurück geben nur Escape und eine getroffene
   Auswahl — ein Klick daneben NICHT: dort will die Nutzerin gerade woanders
   hin, ein Rücksprung risse ihr den Fokus vom eben geklickten Element weg. */
export function Menu({
  open,
  onClose,
  items,
  className,
  triggerRef,
  label,
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItemDef[];
  className?: string;
  triggerRef?: RefObject<HTMLElement | null>;
  /** Name des Menüs für die Vorlesehilfe, wo der Auslöser ihn nicht schon nennt. */
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  /** Schliessen mit Fokus-Rückgabe an den Trigger. Ohne `triggerRef` (Menü
   *  ohne Toggle-Trigger) bleibt es beim blossen Schliessen. */
  function schliessenMitFokus() {
    onClose();
    triggerRef?.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      // Klicks auf den Trigger nicht als „aussen" werten — der Trigger
      // schliesst selbst (Toggle), sonst Doppel-Toggle + sofortiges Wieder-Öffnen.
      if (triggerRef?.current?.contains(target)) return;
      // Bewusst ohne Fokus-Rückgabe: der Klick galt einem anderen Element.
      onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      onClose();
      triggerRef?.current?.focus();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, triggerRef]);

  // Beim Öffnen auf den ersten Eintrag. Leeres Menü: nichts zu fokussieren.
  useEffect(() => {
    if (!open) return;
    eintraege(ref.current)[0]?.focus();
  }, [open]);

  /** ↑/↓ zyklisch, Home/End an die Enden. Liegt der Fokus (noch) auf keinem
   *  Eintrag, beginnt ↓ oben und ↑ unten. */
  function onNavKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const liste = eintraege(ref.current);
    if (liste.length === 0) return;
    const i = liste.indexOf(document.activeElement as HTMLElement);
    const richtung = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;

    let ziel: number;
    if (richtung !== 0) {
      ziel =
        i < 0
          ? richtung === 1
            ? 0
            : liste.length - 1
          : (i + richtung + liste.length) % liste.length;
    } else if (e.key === "Home") {
      ziel = 0;
    } else if (e.key === "End") {
      ziel = liste.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    liste[ziel].focus();
  }

  // Ohne Einträge gibt es nichts zu zeigen — ein leeres Panel wäre nur eine
  // leere Fläche mit Rahmen und Schatten. Trigger sagen dazu passend kein
  // `aria-expanded="true"` (siehe ChipMenu).
  if (!open || items.length === 0) return null;

  function zeile({ item, i }: { item: MenuItemDef; i: number }) {
    const Icon = item.icon;
    const auswahl = () => {
      item.onSelect?.();
      schliessenMitFokus();
    };
    /* Die Zeile trägt die Zustands-Ebene selbst (Hover, Tastaturfokus);
       ein eigener Ring bliebe im Panel ohnehin am Rand hängen, darum
       outline-none. Destruktives steht in Error-Schrift neben seinem
       Zeichen — und trägt dort als Fliesstext: Das Panel liegt auf
       08dp, wo Error 5.22:1 erreicht. Keine Abweichung mehr, seit der
       Ton eine Stufe heller ist; die Zahl rechnet der Styleguide
       (15 «Menü») nach. Icon und Wortlaut sagen die Zerstörung
       trotzdem mit — Farbe allein trägt hier nie. */
    const klassen = cn(
      bedienzeile,
      "w-full text-left focus-visible:outline-none",
      item.danger ? "text-error" : "text-on-surface",
    );
    const inhalt = (
      <>
        {Icon && (
          <Icon
            size={18}
            strokeWidth={2}
            className={item.danger ? undefined : "text-on-surface-mittel"}
            aria-hidden
          />
        )}
        <span className="flex-1">{item.label}</span>
        {item.trailing && (
          <span className="type-label-small text-on-surface-mittel">{item.trailing}</span>
        )}
        {item.gewaehlt && (
          <Check size={16} strokeWidth={2.5} className="text-primary" aria-hidden />
        )}
      </>
    );
    const beschrieben = item.hinweis ? `${menuId}-${i}` : undefined;
    return (
      <Fragment key={i}>
        {item.trenner && <div role="separator" className="my-1 h-px bg-linie" />}
        {item.href ? (
          <Link
            href={item.href}
            role="menuitem"
            aria-describedby={beschrieben}
            onClick={auswahl}
            className={klassen}
          >
            {inhalt}
          </Link>
        ) : (
          <button
            role={item.gewaehlt === undefined ? "menuitem" : "menuitemradio"}
            aria-checked={item.gewaehlt}
            aria-describedby={beschrieben}
            type="button"
            onClick={auswahl}
            className={klassen}
          >
            {inhalt}
          </button>
        )}
        {item.hinweis && (
          <p id={beschrieben} className="px-3 pb-2 type-body-small text-on-surface-mittel">
            {item.hinweis}
          </p>
        )}
      </Fragment>
    );
  }

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onNavKey}
      className={cn(
        "absolute z-50 mt-1 min-w-48 rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08",
        className,
      )}
    >
      {abschnitte(items).map((a) => {
        const [erste, ...rest] = a.zeilen;
        if (a.gruppe === undefined) return <Fragment key={`a-${erste.i}`}>{a.zeilen.map(zeile)}</Fragment>;
        return (
          <Fragment key={`gruppe-${erste.i}`}>
            {erste.item.trenner && <div role="separator" className="my-1 h-px bg-linie" />}
            {/* Die Überschrift ist der Name der Gruppe; sichtbar steht sie
                einmal, vorgelesen über aria-label — nicht doppelt. */}
            <div role="group" aria-label={a.gruppe}>
              <p aria-hidden className="px-3 pt-2 pb-1 type-label-small text-on-surface-mittel">
                {a.gruppe}
              </p>
              {[{ ...erste, item: { ...erste.item, trenner: false } }, ...rest].map(zeile)}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
