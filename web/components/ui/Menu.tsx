"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Die fokussierbaren Einträge des Menüs in DOM-Reihenfolge. Über das DOM
 *  statt über Refs, damit die Reihenfolge auch dann stimmt, wenn `items`
 *  zwischen zwei Renders wechselt. */
function eintraege(wurzel: HTMLElement | null) {
  return Array.from(
    wurzel?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
  );
}

export interface MenuItemDef {
  label: string;
  icon?: LucideIcon;
  trailing?: string;
  danger?: boolean;
  onSelect?: () => void;
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
}: {
  open: boolean;
  onClose: () => void;
  items: MenuItemDef[];
  className?: string;
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
    const i = liste.indexOf(document.activeElement as HTMLButtonElement);
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

  return (
    <div
      ref={ref}
      role="menu"
      onKeyDown={onNavKey}
      className={cn(
        "absolute z-50 mt-1 min-w-48 rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08",
        className,
      )}
    >
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <button
            key={i}
            role="menuitem"
            type="button"
            onClick={() => {
              item.onSelect?.();
              schliessenMitFokus();
            }}
            /* Die Zeile trägt die Zustands-Ebene selbst (Hover, Tastaturfokus);
               ein eigener Ring bliebe im Panel ohnehin am Rand hängen, darum
               outline-none. Destruktives steht in Error-Schrift neben seinem
               Zeichen — 3.62:1 auf 08dp, Materials Baseline, bewusst gehalten:
               Die Farbe wiederholt hier nur, was Icon und Wortlaut sagen. */
            className={cn(
              "state type-body-medium flex w-full items-center gap-3 px-3 py-2 text-left focus-visible:outline-none",
              item.danger ? "text-error" : "text-on-surface",
            )}
          >
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
              <span className="type-label-small text-on-surface-mittel">
                {item.trailing}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
