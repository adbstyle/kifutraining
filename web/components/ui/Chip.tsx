import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";

/* ── Alterskategorie-Chip (G / F / E) ─────────────────────────
   Feste, lernbare Farbe je Stufe — immer mit Buchstabe, nie nur
   über Farbe (a11y). */
const katColor: Record<KategorieSlug, string> = {
  G: "text-kat-g border-kat-g/50 bg-kat-g/10",
  F: "text-kat-f border-kat-f/50 bg-kat-f/10",
  E: "text-kat-e border-kat-e/50 bg-kat-e/10",
};

export function KategorieChip({ k }: { k: KategorieSlug }) {
  return (
    <span
      title={kategorieStufe[k]}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-[2px] border font-mono text-[11px] font-bold leading-none",
        katColor[k],
      )}
    >
      {k}
    </span>
  );
}

/* ── Filter-Chip (toggelbar) ──────────────────────────────────
   Präsentational: Eltern-Komponente steuert `selected`/`onClick`.
   Wird im Katalog-Filter UND im Plan-Picker verwendet. */
export function FilterChip({
  selected = false,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-rasen-950",
        selected
          ? "bg-signal text-rasen-950 font-bold"
          : "chalk-border text-chalk-dim hover:text-chalk hover:bg-chalk/10",
        className,
      )}
    >
      {children}
    </button>
  );
}
