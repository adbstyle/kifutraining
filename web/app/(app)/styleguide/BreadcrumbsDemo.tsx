"use client";

import { Breadcrumbs } from "@/components/ui";
import { Home } from "lucide-react";

/* Demonstriert Breadcrumbs (Lucide-Icons als Props ⇒ Client-Boundary). */
export function BreadcrumbsDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Standard (ChevronRight)
        </p>
        <Breadcrumbs
          items={[
            { label: "Übungspool", href: "#" },
            { label: "Hauptteil", href: "#" },
            { label: "Schiessbude" },
          ]}
        />
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Mit Wurzel-Zeichen &amp; Schrägstrich als Separator
        </p>
        <Breadcrumbs
          separator={<span className="type-label-medium">/</span>}
          items={[
            { label: "Start", href: "#", icon: Home },
            { label: "Trainings", href: "#" },
            { label: "Mein 4-gegen-4" },
          ]}
        />
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Kollabiert (maxItems=4) — „…" klappt den Pfad auf
        </p>
        <Breadcrumbs
          maxItems={4}
          items={[
            { label: "Start", href: "#", icon: Home },
            { label: "Übungspool", href: "#" },
            { label: "Kleinfeld", href: "#" },
            { label: "Hauptteil", href: "#" },
            { label: "Abschluss", href: "#" },
            { label: "Schiessbude" },
          ]}
        />
      </div>
    </div>
  );
}
