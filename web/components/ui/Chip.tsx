import { Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";

/* ── Alterskategorie-Badge (G bis A) ──────────────────────────
   Je Stufe ein eigenes Badge in fester, lernbarer Farbe — deckend
   gefüllt, dunkle Tafel-Tinte (rasen-950) als Schrift. Teilt die
   Formensprache des Herkunfts-Badges (gleiche Höhe/Padding/Typo),
   bleibt aber ein Domänen-Element ausserhalb der M3-Chip-Tokens.
   Immer mit Buchstabe, nie nur über Farbe (a11y). */
const katColor: Record<KategorieSlug, string> = {
  G: "bg-kat-g text-rasen-950",
  F: "bg-kat-f text-rasen-950",
  E: "bg-kat-e text-rasen-950",
  D: "bg-kat-d text-rasen-950",
  C: "bg-kat-c text-rasen-950",
  B: "bg-kat-b text-rasen-950",
  A: "bg-kat-a text-rasen-950",
};

export function KategorieChip({ k }: { k: KategorieSlug }) {
  return (
    <span
      title={kategorieStufe[k]}
      className={cn(
        "inline-flex items-center justify-center rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase leading-none",
        katColor[k],
      )}
    >
      {k}
    </span>
  );
}

/* ── M3-Chips ─────────────────────────────────────────────────
   Gemeinsame Basis + --chip-*-Component-Tokens (siehe globals.css).
   Vier Typen nach M3: Assist · Filter · Input · Suggestion. */
const chipBase =
  "focus-ring type-label-medium inline-flex items-center gap-1.5 rounded-(--chip-shape) border-[1.5px] px-3 py-1.5 transition-colors";
const chipOutlined =
  "border-(--chip-outline) bg-transparent text-(--chip-label) hover:bg-on-surface/8 hover:text-on-surface";
const chipSelected =
  "border-transparent bg-(--chip-selected-container) text-(--chip-selected-label)";
const chipElevated =
  "border-transparent bg-(--chip-elevated-container) text-on-surface shadow-e3 hover:shadow-e4";

/* Filter-Chip (toggelbar) — selected: secondary-container + Check (M3).
   Optionales führendes Icon, wenn nicht selektiert. */
export function FilterChip({
  selected = false,
  onClick,
  children,
  icon: Icon,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(chipBase, selected ? chipSelected : chipOutlined, className)}
    >
      {selected ? (
        <Check size={14} strokeWidth={2.5} aria-hidden />
      ) : (
        Icon && <Icon size={16} strokeWidth={2} aria-hidden />
      )}
      {children}
    </button>
  );
}

/* Assist-Chip — schlägt eine Aktion vor (führendes Icon + Label).
   `elevated`: weicher M3-Schatten statt Outline. */
export function AssistChip({
  icon: Icon,
  onClick,
  children,
  elevated = false,
  className,
}: {
  icon?: LucideIcon;
  onClick?: () => void;
  children: React.ReactNode;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(chipBase, elevated ? chipElevated : chipOutlined, className)}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}

/* Suggestion-Chip — dynamisch generierter Vorschlag (nur Label). */
export function SuggestionChip({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(chipBase, chipOutlined, className)}
    >
      {children}
    </button>
  );
}

/* Input-Chip — repräsentiert eine diskrete Eingabe/ein Tag.
   Optionales führendes Icon + Entfernen-Button (X). Container ist kein Button. */
export function InputChip({
  icon: Icon,
  onRemove,
  children,
  className,
}: {
  icon?: LucideIcon;
  onRemove?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(chipBase, chipOutlined, "pr-2", className)}>
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Entfernen"
          className="focus-ring -mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/12 hover:text-on-surface"
        >
          <X size={14} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}
