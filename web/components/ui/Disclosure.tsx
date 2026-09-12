"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type DisclosureProps = {
  title: string;
  /** Anzahl der Einträge; bleibt auch im zugeklappten Zustand sichtbar. */
  count?: number;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
};

/** Ein Abschnitt, der zugeklappt beginnt und sich bei Bedarf öffnet.
 *
 *  Für lange Listen, die vollständig erreichbar bleiben sollen, ohne die Seite
 *  zu beherrschen. Die Anzahl steht am Kopf, damit man weiss, was einen
 *  erwartet, bevor man öffnet.
 *
 *  Der Inhalt wird nur gerendert, solange er offen ist — bei mehreren hundert
 *  Einträgen ist das der Unterschied zwischen einer knappen und einer schweren
 *  Seite. Die Hülle bleibt stehen, damit `aria-controls` immer auf ein
 *  vorhandenes Element zeigt.
 *
 *  Der Knopf sitzt in der Überschrift, wie es das Disclosure-Muster vorsieht:
 *  So springt man mit der Überschriften-Navigation eines Screenreaders auf den
 *  Abschnitt und erfährt an Ort und Stelle, dass er sich öffnen lässt.
 *
 *  Ohne Höhen-Übergang, wie das Akkordeon in der mobilen Navigation: Das Kit
 *  bewegt nirgends Flächen, nur Farben und den Pfeil.
 *
 *  `defaultOpen` wirkt nur beim Einhängen. Soll sich der Anfangszustand später
 *  ändern, weil sich die Lage geändert hat, hängt die aufrufende Stelle ein
 *  `key` an diese Bedingung. */
export function Disclosure({
  title,
  count,
  defaultOpen = false,
  className,
  children,
}: DisclosureProps) {
  const [offen, setOffen] = useState(defaultOpen);
  const inhaltId = useId();

  return (
    <section className={className}>
      <h3>
        <button
          type="button"
          aria-expanded={offen}
          aria-controls={inhaltId}
          onClick={() => setOffen((o) => !o)}
          className="state focus-ring type-title-small flex w-full items-center justify-between gap-3 rounded-flaeche py-2 text-on-surface transition-colors"
        >
          <span className="flex items-baseline gap-2">
            {title}
            {count != null && (
              <span className="type-label-small text-on-surface-mittel">{count}</span>
            )}
          </span>
          <ChevronDown
            size={18}
            strokeWidth={2.5}
            aria-hidden
            className={cn("shrink-0 transition-transform", offen && "rotate-180")}
          />
        </button>
      </h3>
      <div id={inhaltId} hidden={!offen} className="mt-2">
        {offen && children}
      </div>
    </section>
  );
}
