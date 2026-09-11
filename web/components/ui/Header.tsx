"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  ChevronDown,
  Menu as MenuIcon,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ButtonLink, Button } from "./Button";
import { IconButton } from "./IconButton";
import { Menu } from "./Menu";
import type { MenuItemDef } from "./Menu";

/* ── Typen ──────────────────────────────────────────────────── */

export interface HeaderMenuItem {
  label: string;
  href: string;
  /** Sekundärzeile (Mega-Menü-Stil). */
  description?: string;
  icon?: LucideIcon;
}

export interface HeaderNavItem {
  label: string;
  /** Direkt-Link. Mit `items` stattdessen ein aufklappbares Flyout. */
  href?: string;
  current?: boolean;
  items?: HeaderMenuItem[];
}

export interface HeaderAccount {
  name: string;
  email?: string;
  /** Sonst aus dem Namen abgeleitet. */
  initials?: string;
  items: MenuItemDef[];
}

export interface HeaderProps {
  /** Wortmarke/Logo links. Default: „KiFu". */
  brand?: React.ReactNode;
  brandHref?: string;
  nav: HeaderNavItem[];
  /** Such-Trigger (z. B. Command-Palette öffnen). Ohne `onSearch` keine Suche. */
  onSearch?: () => void;
  /** Tastenkürzel-Hinweis im Such-Trigger; löst global aus (⌘/Ctrl+K). */
  searchShortcut?: string;
  /** Notifications-Zähler (Glocke + Badge). 0/undefined = keine Glocke. */
  notifications?: number;
  account?: HeaderAccount;
  cta?: { label: string; href?: string; onClick?: () => void; icon?: LucideIcon };
  className?: string;
}

/* Initialen aus einem Namen (max. 2 Zeichen). */
function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* ── Header ─────────────────────────────────────────────────────────
   Top-Navigation im KiFu-„Taktik-Editorial"-Stil. Klebt oben (sticky),
   Kreide-Linie als untere Kante, dezenter Blur. Primär-Links als mono-
   Labels mit Signal-Unterstrich (aktiv) und aufklappbarem Flyout; Such-
   Trigger mit ⌘K (global), Notifications-Glocke mit Badge, Avatar-Konto-
   Menü, CTA. Unter `lg` kollabiert alles in einen Hamburger → Drawer.
   Gespeist aus System-Rollen/Component-Tokens (--menu-*, --field-*). */
export function Header({
  brand = "KiFu",
  brandHref = "/",
  nav,
  onSearch,
  searchShortcut = "⌘K",
  notifications,
  account,
  cta,
  className,
}: HeaderProps) {
  const reactId = useId();
  const [openNav, setOpenNav] = useState<number | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<number | null>(null);

  const navRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  // Globales Tastenkürzel ⌘/Ctrl+K → Suche.
  useEffect(() => {
    if (!onSearch) return;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSearch?.();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSearch]);

  // Flyouts: Outside-Click + Escape schliessen.
  useEffect(() => {
    if (openNav === null) return;
    function onDoc(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenNav(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenNav(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [openNav]);

  // Drawer: Escape schliesst; Body-Scroll sperren solange offen.
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  const Brand = (
    <Link
      href={brandHref}
      className="focus-ring type-headline-small shrink-0 rounded-[3px] text-on-surface transition-colors hover:text-primary"
    >
      {brand}
    </Link>
  );

  const searchTrigger = onSearch && (
    <button
      type="button"
      onClick={onSearch}
      className="focus-ring type-body-medium group hidden h-10 min-w-0 shrink items-center gap-2 rounded-(--field-shape) border-[1.5px] border-(--field-outline) bg-surface px-3 text-(--field-label) transition-colors hover:border-on-surface/30 hover:text-on-surface md:flex md:w-44 lg:w-56"
    >
      <Search size={16} strokeWidth={2} aria-hidden className="shrink-0" />
      <span className="flex-1 truncate text-left">Suchen …</span>
      <kbd className="type-label-small shrink-0 rounded-[3px] border border-outline-variant px-1.5 py-0.5 text-on-surface-variant">
        {searchShortcut}
      </kbd>
    </button>
  );

  return (
    <>
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-outline-variant bg-surface/85 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-4 sm:px-6">
        {Brand}

        {/* Primär-Navigation — ab lg */}
        <nav ref={navRef} aria-label="Hauptnavigation" className="ml-2 hidden shrink-0 items-center lg:flex">
          {nav.map((item, i) => {
            const isOpen = openNav === i;
            if (!item.items) {
              return (
                <Link
                  key={item.label}
                  href={item.href ?? "#"}
                  aria-current={item.current ? "page" : undefined}
                  className={cn(
                    "focus-ring type-label-medium relative flex h-16 items-center px-3 transition-colors",
                    item.current
                      ? "text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {item.label}
                  {item.current && (
                    <span aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] bg-primary" />
                  )}
                </Link>
              );
            }
            return (
              <div key={item.label} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setOpenNav(isOpen ? null : i)}
                  className={cn(
                    "focus-ring type-label-medium relative flex h-16 items-center gap-1 px-3 transition-colors",
                    item.current || isOpen
                      ? "text-on-surface"
                      : "text-on-surface-variant hover:text-on-surface",
                  )}
                >
                  {item.label}
                  <ChevronDown
                    size={15}
                    strokeWidth={2.5}
                    aria-hidden
                    className={cn("transition-transform", isOpen && "rotate-180")}
                  />
                  {item.current && (
                    <span aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] bg-primary" />
                  )}
                </button>

                {isOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-(--menu-shape) border border-outline-variant bg-(--menu-container) p-1.5 shadow-e4"
                  >
                    {item.items.map((sub) => {
                      const SubIcon = sub.icon;
                      return (
                        <Link
                          // Der Name und nicht das Ziel: Zwei Unterpunkte
                          // dürfen auf dieselbe Adresse zeigen («Alle
                          // Übungen» und «Favoriten» tun es), gleich heissen
                          // dürfen sie in einem Menü nie.
                          key={sub.label}
                          href={sub.href}
                          role="menuitem"
                          onClick={() => setOpenNav(null)}
                          className="focus-ring group flex items-start gap-3 rounded-[3px] p-2.5 transition-colors hover:bg-on-surface/8"
                        >
                          {SubIcon && (
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[3px] border border-outline-variant bg-surface text-on-surface-variant transition-colors group-hover:border-primary/40 group-hover:text-primary">
                              <SubIcon size={18} strokeWidth={2} aria-hidden />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="type-title-small block text-on-surface">
                              {sub.label}
                            </span>
                            {sub.description && (
                              <span className="type-body-small block text-on-surface-variant">
                                {sub.description}
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rechte Zone */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {searchTrigger}

          {/* Such-Icon nur Mobil (statt der breiten Leiste) */}
          {onSearch && (
            <span className="md:hidden">
              <IconButton icon={Search} label="Suchen" onClick={onSearch} />
            </span>
          )}

          {typeof notifications === "number" && notifications > 0 && (
            <div className="relative hidden shrink-0 sm:block">
              <IconButton icon={Bell} label={`${notifications} neue Benachrichtigungen`} />
              <span
                aria-hidden
                className="pointer-events-none absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold leading-none text-on-primary"
              >
                {notifications > 9 ? "9+" : notifications}
              </span>
            </div>
          )}

          {cta && (
            <span className="hidden shrink-0 whitespace-nowrap sm:inline-flex">
              {cta.href ? (
                <ButtonLink href={cta.href} variant="filled" size="sm">
                  {cta.icon && <cta.icon size={18} strokeWidth={2.5} aria-hidden />}
                  {cta.label}
                </ButtonLink>
              ) : (
                <Button variant="filled" size="sm" onClick={cta.onClick}>
                  {cta.icon && <cta.icon size={18} strokeWidth={2.5} aria-hidden />}
                  {cta.label}
                </Button>
              )}
            </span>
          )}

          {/* Avatar-Konto-Menü — ab sm */}
          {account && (
            <div className="relative hidden shrink-0 sm:block">
              <button
                ref={avatarRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                aria-label={`Konto: ${account.name}`}
                onClick={() => setAccountOpen((o) => !o)}
                className="focus-ring type-label-medium grid h-10 w-10 place-items-center rounded-full bg-(--chip-selected-container) text-(--chip-selected-label) transition-[outline-color] hover:outline hover:outline-2 hover:outline-primary/40"
              >
                {account.initials ?? initialsOf(account.name)}
              </button>
              <Menu
                open={accountOpen}
                onClose={() => setAccountOpen(false)}
                triggerRef={avatarRef}
                items={account.items}
                className="right-0"
              />
            </div>
          )}

          {/* Hamburger — unter lg */}
          <span className="lg:hidden">
            <IconButton
              icon={MenuIcon}
              label="Navigation öffnen"
              onClick={() => setDrawerOpen(true)}
            />
          </span>
        </div>
      </div>
      </header>

      {/* ── Mobile-Drawer ───────────────────────────────────────
          `overflow-hidden`: der geschlossene Panel ist via translate-x-full
          rechts ausserhalb des Viewports geparkt. Ohne Clipping ist dieser
          Off-Canvas-Bereich auf Touch-Geräten per Visual-Viewport-Pan
          erreichbar (Leerraum rechts, Inhalt links abgeschnitten). Clipping
          am Overlay verbirgt ihn, lässt die Slide-in-Animation aber intakt.
          Bewusst hier statt global (overflow-x:hidden am body bräche sticky). */}
      {/* `inert` (geschlossen): nimmt das gesamte Overlay aus Tab-Reihenfolge,
          A11y-Baum UND Pointer-Events. aria-hidden allein hätte die fokussier-
          baren Bedienelemente (Schliessen, Links, CTA) in der Tab-Reihenfolge
          gelassen — Tastatur-Nutzer wären in den unsichtbaren Drawer getabbt. */}
      <div className="fixed inset-0 z-50 overflow-hidden lg:hidden" inert={!drawerOpen}>
        {/* Scrim */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Navigation schliessen"
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 bg-scrim/60 transition-opacity duration-200",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Panel */}
        <div
          role="dialog"
          aria-label="Navigation"
          className={cn(
            "absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col border-l border-outline-variant bg-surface-container-high shadow-e5 transition-transform duration-200 ease-out",
            drawerOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-outline-variant px-4">
            <span className="type-headline-small text-on-surface">{brand}</span>
            <IconButton
              icon={X}
              label="Navigation schliessen"
              onClick={() => setDrawerOpen(false)}
            />
          </div>

          <div className="flex-1 overflow-auto p-3">
            {onSearch && (
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  onSearch();
                }}
                className="focus-ring type-body-medium mb-3 flex h-11 w-full items-center gap-2 rounded-(--field-shape) border-[1.5px] border-(--field-outline) bg-surface px-3 text-(--field-label)"
              >
                <Search size={18} strokeWidth={2} aria-hidden />
                Suchen …
                <kbd className="type-label-small ml-auto rounded-[3px] border border-outline-variant px-1.5 py-0.5 text-on-surface-variant">
                  {searchShortcut}
                </kbd>
              </button>
            )}

            <nav aria-label="Hauptnavigation" className="flex flex-col">
              {nav.map((item, i) => {
                if (!item.items) {
                  return (
                    <Link
                      key={item.label}
                      href={item.href ?? "#"}
                      aria-current={item.current ? "page" : undefined}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "focus-ring type-label-large flex h-12 items-center rounded-[3px] px-3 transition-colors",
                        item.current
                          ? "bg-(--nav-indicator) text-(--nav-item-active-label)"
                          : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                }
                const sectionOpen = openSection === i;
                return (
                  <div key={item.label}>
                    <button
                      type="button"
                      aria-expanded={sectionOpen}
                      onClick={() => setOpenSection(sectionOpen ? null : i)}
                      className={cn(
                        "focus-ring type-label-large flex h-12 w-full items-center justify-between rounded-[3px] px-3 transition-colors",
                        item.current
                          ? "text-on-surface"
                          : "text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
                      )}
                    >
                      {item.label}
                      <ChevronDown
                        size={18}
                        strokeWidth={2.5}
                        aria-hidden
                        className={cn("transition-transform", sectionOpen && "rotate-180")}
                      />
                    </button>
                    {sectionOpen && (
                      <div className="mb-1 ml-3 flex flex-col border-l border-outline-variant pl-3">
                        {item.items.map((sub) => {
                          const SubIcon = sub.icon;
                          return (
                            <Link
                              // Siehe Desktop-Menü: der Name ist eindeutig,
                              // das Ziel nicht.
                              key={sub.label}
                              href={sub.href}
                              onClick={() => setDrawerOpen(false)}
                              className="focus-ring type-body-medium flex items-center gap-2.5 rounded-[3px] px-2 py-2.5 text-on-surface-variant transition-colors hover:bg-on-surface/8 hover:text-on-surface"
                            >
                              {SubIcon && (
                                <SubIcon size={18} strokeWidth={2} aria-hidden className="shrink-0" />
                              )}
                              {sub.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Drawer-Footer: Konto + CTA */}
          {(account || cta) && (
            <div className="shrink-0 border-t border-outline-variant p-3">
              {account && (
                <div className="mb-3 flex items-center gap-3 px-1">
                  <span className="type-label-medium grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--chip-selected-container) text-(--chip-selected-label)">
                    {account.initials ?? initialsOf(account.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="type-title-small block truncate text-on-surface">
                      {account.name}
                    </span>
                    {account.email && (
                      <span className="type-body-small block truncate text-on-surface-variant">
                        {account.email}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {account?.items.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.label}
                    type="button"
                    onClick={() => {
                      it.onSelect?.();
                      setDrawerOpen(false);
                    }}
                    className={cn(
                      "focus-ring type-body-medium flex w-full items-center gap-3 rounded-[3px] px-3 py-2.5 text-left transition-colors hover:bg-on-surface/8",
                      it.danger ? "text-error" : "text-on-surface",
                    )}
                  >
                    {Icon && <Icon size={18} strokeWidth={2} aria-hidden />}
                    {it.label}
                  </button>
                );
              })}
              {cta &&
                (cta.href ? (
                  <ButtonLink
                    href={cta.href}
                    variant="filled"
                    onClick={() => setDrawerOpen(false)}
                    className="mt-2 w-full"
                  >
                    {cta.icon && <cta.icon size={18} strokeWidth={2.5} aria-hidden />}
                    {cta.label}
                  </ButtonLink>
                ) : (
                  <Button
                    variant="filled"
                    onClick={() => {
                      cta.onClick?.();
                      setDrawerOpen(false);
                    }}
                    className="mt-2 w-full"
                  >
                    {cta.icon && <cta.icon size={18} strokeWidth={2.5} aria-hidden />}
                    {cta.label}
                  </Button>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
