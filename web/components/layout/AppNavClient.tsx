"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  UserRound,
  LogIn,
  LogOut,
  Plus,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { NavigationRail, BottomNav, IconButton, ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";
import { NAV_EXPANDED_COOKIE } from "@/lib/nav";

type Dest = { value: string; label: string; icon: LucideIcon };

// Zwei Ziele: Katalog + Konto bzw. Anmelden (kein Home, kein „Meine Übungen"
// in der Hauptnavigation — die eigenen Übungen sind über das Konto erreichbar).
const AUTHED: Dest[] = [
  { value: "/", label: "Übungen", icon: LayoutGrid },
  { value: "/konto", label: "Konto", icon: UserRound },
];

const ANON: Dest[] = [
  { value: "/", label: "Übungen", icon: LayoutGrid },
  { value: "/login", label: "Anmelden", icon: LogIn },
];

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Aktives Ziel = längster passender Routen-Präfix; „/" nur exakt, damit
 *  Detailseiten (z. B. /uebung/x, /meine-uebungen) sauber auf „Übungen"
 *  zurückfallen. */
function activeValue(pathname: string, items: Dest[]): string {
  const hits = items
    .filter((i) => (i.value === "/" ? pathname === "/" : pathname.startsWith(i.value)))
    .sort((a, b) => b.value.length - a.value.length);
  return hits[0]?.value ?? "/";
}

export function AppNavClient({
  isAuthenticated,
  signOutAction,
  initialExpanded = true,
}: {
  isAuthenticated: boolean;
  signOutAction: () => void;
  /** Aufklappzustand vom Server (aus dem Cookie) — verhindert Flackern. */
  initialExpanded?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = isAuthenticated ? AUTHED : ANON;
  const active = activeValue(pathname, items);

  // Aufklappzustand der Rail (Desktop), im Cookie gemerkt.
  const [expanded, setExpanded] = useState(initialExpanded);
  function toggleExpanded() {
    setExpanded((e) => {
      const next = !e;
      document.cookie = `${NAV_EXPANDED_COOKIE}=${next ? "1" : "0"}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      return next;
    });
  }

  return (
    <>
      {/* Desktop/Tablet: vertikale Navigation Rail, ein-/ausklappbar */}
      <NavigationRail
        items={items}
        value={active}
        onChange={(href) => router.push(href)}
        expanded={expanded}
        ariaLabel="Hauptnavigation"
        className="sticky top-0 hidden h-dvh shrink-0 md:flex"
        header={
          <div
            className={cn(
              "flex w-full items-center",
              expanded ? "gap-1" : "justify-center",
            )}
          >
            <IconButton
              icon={Menu}
              label={expanded ? "Navigation einklappen" : "Navigation ausklappen"}
              onClick={toggleExpanded}
            />
            <Link
              href="/"
              aria-hidden={!expanded}
              tabIndex={expanded ? 0 : -1}
              className={cn(
                "focus-ring type-headline-small overflow-hidden whitespace-nowrap rounded-[3px] text-on-surface transition-[max-width,opacity] duration-300 ease-in-out hover:text-primary",
                expanded ? "max-w-32 opacity-100" : "max-w-0 opacity-0",
              )}
            >
              KiFu
            </Link>
          </div>
        }
        footer={
          isAuthenticated ? (
            <form action={signOutAction} className="w-full">
              <button
                type="submit"
                className={cn(
                  "focus-ring type-label-large flex h-14 items-center rounded-full text-on-surface-variant transition-[gap,padding,width] duration-300 ease-in-out hover:bg-on-surface/8 hover:text-on-surface",
                  expanded ? "w-full justify-start gap-3 px-4" : "w-14 justify-center px-0",
                )}
              >
                <LogOut size={24} strokeWidth={2} className="shrink-0" aria-hidden />
                <span
                  className={cn(
                    "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                    expanded ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
                  )}
                >
                  Abmelden
                </span>
              </button>
            </form>
          ) : undefined
        }
      />

      {/* Mobil: untere Navigationsleiste */}
      <BottomNav
        items={items}
        value={active}
        onChange={(href) => router.push(href)}
        ariaLabel="Hauptnavigation"
        className="fixed inset-x-0 bottom-0 z-30 md:hidden"
      />

      {/* Primär-Aktion: schwebender FAB über dem Inhalt (alle Breakpoints).
          Auf Mobil oberhalb der Bottom-Nav, ab md unten rechts.
          M3-FAB: weiche Resting-Elevation (Level 3), hebt beim Hover auf Level 4. */}
      {isAuthenticated && (
        <ButtonLink
          href="/neu"
          variant="filled"
          aria-label="Neue Übung erstellen"
          className="fixed right-5 bottom-24 z-40 h-14 w-14 rounded-2xl !px-0 shadow-e3 hover:shadow-e4 md:right-8 md:bottom-8"
        >
          <Plus size={26} strokeWidth={2.5} aria-hidden />
        </ButtonLink>
      )}
    </>
  );
}
