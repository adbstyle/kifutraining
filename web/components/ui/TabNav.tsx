import Link from "next/link";
import { cn } from "@/lib/cn";

export interface TabNavItem {
  label: string;
  href: string;
  current?: boolean;
}

/* Ansichts-Umschalter innerhalb eines Gegenstands — dieselbe Sache, mehrere
   Sichten darauf (etwa ein Team mit Plan, Trainings und Verwaltung).

   Bewusst Links und keine Schaltflächen: jede Ansicht hat ihre eigene Adresse,
   ist damit weitergebbar und der Zurück-Schritt des Browsers funktioniert.
   Deshalb auch nicht `SegmentedControl` — die ist ein Eingabefeld für eine
   Auswahl, kein Navigationsmittel, und ihre Auswahl lebt im Formularzustand.

   Die Optik folgt der Hauptnavigation (Label plus Unterstreichung), damit
   „hier wechselt man den Ort" überall dasselbe Bild ergibt. `aria-current`
   macht die offene Ansicht auch ohne die Farbe erkennbar. */
export function TabNav({
  items,
  ariaLabel,
  className,
}: {
  items: TabNavItem[];
  /** Benennt, wozwischen gewechselt wird — z. B. „Ansichten des Teams". */
  ariaLabel: string;
  className?: string;
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("border-b border-outline-variant", className)}
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "focus-ring type-label-large relative flex h-11 items-center gap-2 whitespace-nowrap px-3 transition-colors",
                item.current
                  ? "text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {item.label}
              {item.current && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-[2px] bg-primary"
                />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
