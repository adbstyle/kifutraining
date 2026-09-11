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
   Vier Typen nach M3: Assist · Filter · Input · Suggestion.

   Die drei Klassenbündel sind exportiert (wie `iconButtonClasses`), weil ein
   Chip nicht immer eine Schaltfläche ist: Auf den Server-Seiten trägt ein LINK
   die Chip-Optik (`VariantenLinks` — jede Variante hat dort eine eigene
   Adresse). Ein <a> als <button> zu verkleiden wäre falsch, die Optik ein
   zweites Mal abzuschreiben ebenso — sie liefe auseinander, sobald die
   --chip-Tokens sich ändern. */
export const chipBase =
  "focus-ring type-label-medium inline-flex items-center gap-1.5 rounded-(--chip-shape) border-[1.5px] px-3 py-1.5 transition-colors";
export const chipOutlined =
  "border-(--chip-outline) bg-transparent text-(--chip-label) hover:bg-on-surface/8 hover:text-on-surface";
export const chipSelected =
  "border-transparent bg-(--chip-selected-container) text-(--chip-selected-label)";
const chipElevated =
  "border-transparent bg-(--chip-elevated-container) text-on-surface shadow-e3 hover:shadow-e4";

/* ── Chip-Optik für NUTZERTEXT ────────────────────────────────
   Dieselbe Pille, aber normal gesetzt statt mono/versal: `type-label-medium`
   verfälscht, was die Trainerin selbst geschrieben hat («21 Kinder, zwei
   Trainer» in Versalien liest sich als Rubrik, nicht als ihre Bezeichnung).
   Dieselbe Regel, aus der schon `ChipMenu` `type-body-medium` trägt.

   Auch exportiert — die Server-Seiten (`VariantenLinks`) tragen die Optik auf
   einem <a>, und der geteilte Chip (`ChipMenu`) baut sie auf zwei Hälften auf.
   Höhe fest auf h-9, damit Chip, geteilter Chip und leiser Knopf in einer
   Leiste auf derselben Linie sitzen. */
export const chipTextBase =
  "focus-ring type-body-medium inline-flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 normal-case transition-colors";
export const chipTextOutlined =
  "border-outline text-on-surface hover:bg-on-surface/8";
export const chipTextSelected =
  "border-transparent bg-(--chip-selected-container) text-(--chip-selected-label)";

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

/* ── Choice-Chip-Gruppe (Einfachauswahl, offen) ───────────────
   Dasselbe, was die SegmentedControl leistet — genau EIN Wert aus einer
   offen liegenden Menge —, aber für Werte, die in keine Segmentleiste
   passen: «Spielformen und unterstützende Übungen» ist als Segment
   unlesbar, als umbrechender Chip nicht. Darum Radiogroup-Semantik
   (role=radiogroup / role=radio, aria-checked) statt der tab-artigen
   Segmentleiste, mit Pfeiltasten-Navigation und wanderndem Tabstopp.

   Optik: die bestehenden --chip-Tokens, ausgewählt wie der Filter-Chip.
   Kein Häkchen — es ist eine Einfachauswahl, nicht ein Ein/Aus-Zustand,
   und der Umriss-Wechsel trägt die Aussage bereits.

   Bewusst hook-frei: Chip.tsx wird auch von Server-Komponenten importiert
   (KategorieChip). Der Fokus wandert darum über das DOM statt über Refs. */
export function ChoiceChip({
  selected = false,
  tabStop = false,
  onSelect,
  look = "label",
  children,
  className,
}: {
  selected?: boolean;
  /** Trägt den Tabstopp, solange NICHTS gewählt ist — sonst wäre eine leere
   *  Gruppe per Tastatur unerreichbar. Der Aufrufer setzt ihn auf dem ersten
   *  Chip. */
  tabStop?: boolean;
  onSelect?: () => void;
  /** `label` (Vorgabe): mono/versal, für Werte aus dem Vokabular.
   *  `nutzertext`: normal gesetzt, für Beschriftungen, die der Trainer selbst
   *  vergibt — Versalien verfälschten sie (dieselbe Regel wie in ChipMenu.tsx).
   *  Bewusst eine Prop statt `className`: `cn` merged nicht, eine Typo-Klasse
   *  von aussen liesse sich also nicht überschreiben. */
  look?: "label" | "nutzertext";
  children: React.ReactNode;
  className?: string;
}) {
  /** Pfeiltasten bewegen die Auswahl im Gruppen-Container und nehmen den
   *  Fokus mit — so wie es die Radiogroup-Konvention verlangt. */
  function handleKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    const richtung =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
    if (richtung === 0) return;
    const gruppe = e.currentTarget.parentElement;
    if (!gruppe) return;
    const chips = Array.from(
      gruppe.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const i = chips.indexOf(e.currentTarget);
    if (i < 0) return;
    e.preventDefault();
    const ziel = chips[(i + richtung + chips.length) % chips.length];
    ziel.focus();
    ziel.click();
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected || tabStop ? 0 : -1}
      onClick={onSelect}
      onKeyDown={handleKey}
      className={cn(
        look === "nutzertext" ? chipTextBase : chipBase,
        look === "nutzertext"
          ? selected
            ? chipTextSelected
            : chipTextOutlined
          : selected
            ? chipSelected
            : chipOutlined,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Der Container der Choice-Chips. Umbricht — das ist sein ganzer Zweck
 *  gegenüber der horizontal scrollenden SegmentedControl. */
export function ChoiceChipGroup({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {children}
    </div>
  );
}

/* Assist-Chip — schlägt eine Aktion vor (führendes Icon + Label).
   `elevated`: weicher M3-Schatten statt Outline.

   Öffnet die vorgeschlagene Aktion ein Menü, braucht der Chip einen Namen
   dafür (`ariaLabel`, wenn dasselbe Label mehrfach auf der Seite steht), die
   Ankündigung `aria-haspopup`/`aria-expanded` und eine Ref: das `Menu` verankert
   sich am Trigger und gibt ihm den Fokus zurück. */
export function AssistChip({
  ref,
  icon: Icon,
  onClick,
  children,
  ariaLabel,
  ariaHasPopup,
  ariaExpanded,
  elevated = false,
  className,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  icon?: LucideIcon;
  onClick?: () => void;
  children: React.ReactNode;
  /** a11y-Name, wenn das blosse Label zu wenig sagt. Beginnt mit dem sichtbaren
   *  Text, damit Sprachsteuerung ihn weiter trifft. */
  ariaLabel?: string;
  ariaHasPopup?: "menu";
  ariaExpanded?: boolean;
  elevated?: boolean;
  className?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaHasPopup ? ariaExpanded : undefined}
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
