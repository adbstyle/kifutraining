"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export interface BreadcrumbItem {
  label: string;
  /** Weggelassen ⇒ aktuelle Seite (kein Link, trägt aria-current). */
  href?: string;
  /** Optionales führendes Icon (z. B. Home auf der Wurzel). */
  icon?: LucideIcon;
}

/* ── M3 Breadcrumbs ───────────────────────────────────────────────────
   Sekundäre Pfad-Navigation. Datengetrieben wie NavigationRail/Menu: ein
   `items`-Array, das letzte Item ohne `href` ist die aktuelle Seite.
   Lange Pfade kollabieren (maxItems) zu einem aufklappbaren „…"-Button.
   Separator als ChevronRight (kanonisches Icon), per `separator` ersetzbar.
   Gespeist aus --breadcrumb-*-Component-Tokens. */
export function Breadcrumbs({
  items,
  separator,
  maxItems = 8,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 1,
  className,
}: {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  maxItems?: number;
  itemsBeforeCollapse?: number;
  itemsAfterCollapse?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const sep = separator ?? (
    <ChevronRight size={16} strokeWidth={2} aria-hidden />
  );

  const collapsible =
    items.length > maxItems &&
    itemsBeforeCollapse + itemsAfterCollapse < items.length;
  const collapsed = collapsible && !expanded;

  // Im kollabierten Zustand bleiben nur Kopf + Schwanz sichtbar; dazwischen
  // sitzt ein aufklappbarer „…"-Button (eigenes <li>, vor dem Schwanz).
  const head = collapsed ? items.slice(0, itemsBeforeCollapse) : items;
  const tail = collapsed ? items.slice(items.length - itemsAfterCollapse) : [];
  const visible = [...head, ...tail];
  const ellipsisBefore = collapsed ? head.length : -1;

  const SepEl = (
    <span
      aria-hidden
      className="flex shrink-0 select-none items-center text-(--breadcrumb-separator)"
    >
      {sep}
    </span>
  );

  return (
    <nav aria-label="Brotkrumen" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {visible.map((item, i) => {
          const isLast = i === visible.length - 1;
          const Icon = item.icon;
          const isCurrent = isLast && !item.href;
          const content = (
            <>
              {Icon && (
                <Icon size={16} strokeWidth={2} className="shrink-0" aria-hidden />
              )}
              <span className="truncate">{item.label}</span>
            </>
          );

          return (
            <li key={i} className="flex min-w-0 items-center gap-x-2">
              {/* Eingeklappter Mittelteil vor dem Schwanz */}
              {i === ellipsisBefore && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    aria-label="Ausgeblendeten Pfad anzeigen"
                    className="focus-ring inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-[3px] text-(--breadcrumb-label) transition-colors hover:bg-on-surface/8 hover:text-(--breadcrumb-label-hover)"
                  >
                    <MoreHorizontal size={16} strokeWidth={2} aria-hidden />
                  </button>
                  {SepEl}
                </>
              )}

              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="focus-ring type-body-medium flex min-w-0 items-center gap-1.5 rounded-[2px] text-(--breadcrumb-label) underline decoration-transparent decoration-1 underline-offset-[3px] transition-colors hover:text-(--breadcrumb-label-hover) hover:decoration-current"
                >
                  {content}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5",
                    isCurrent
                      ? "type-title-small text-(--breadcrumb-current)"
                      : "type-body-medium text-(--breadcrumb-label)",
                  )}
                >
                  {content}
                </span>
              )}

              {/* Separator nach jedem Item ausser dem letzten */}
              {!isLast && SepEl}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
