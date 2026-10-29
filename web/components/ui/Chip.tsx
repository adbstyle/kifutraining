import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* ── Chips ────────────────────────────────────────────────────
   Eine Pille für jeden Chip: Assist · Filter · Einfachauswahl, dazu die
   Varianten-Links und der geteilte Chip. Ungewählt umrandet die Kante,
   gewählt umrandet Primary, und `state` trägt Überfahren, Fokus und Druck —
   die Zustands-Ebene färbt sich in der Farbe des Chip-Inhalts ein und passt
   so auf jede Lage.

   Schrift `type-body-medium`, normal gesetzt — nie versal (PO 2026-10-29).
   Die Label-Typo verfälschte Nutzertext («21 Kinder, zwei Trainer» in
   Versalien liest sich als Rubrik, nicht als Bezeichnung der Trainerin), und
   ein Chip steht in Leisten neben Suchfeld, Auswahl und Knöpfen: Dort liest
   er sich als Wort («Meine Termine»), nicht als Rubrik, und bleibt leiser als
   der halbfette Knopf daneben, der die Handlung trägt.

   Exportiert — die Server-Seiten (`VariantenLinks`) tragen die Optik auf
   einem <a>, und der geteilte Chip (`ChipMenu`) baut sie auf zwei Hälften auf.
   Höhe fest gesetzt statt über die Polsterung: Aus der Polsterung folgten
   krumme Masse, und der Chip stünde neben dem Knopf um ein, zwei Pixel
   versetzt. Ein Mass für jeden Chip (36 px, Epic #363) — dasselbe wie Knopf,
   Feld und Filterknopf, darum fluchtet er in jeder Leiste ohne eigene Stufe.

   ZWEI Bündel, weil der geteilte Chip die Pille anders füllt: `chipTextHuelle`
   ist der Umriss — Schrift, Höhe, Rundung, Rahmen —, den er als Gruppe um
   seine beiden Hälften legt (dort `items-stretch`, damit jede die volle
   Trefferhöhe bekommt, und die Polsterung sitzt je Hälfte). Die Zustands-Ebene
   gehört dort nicht an die Gruppe, sondern an jede Hälfte einzeln — sonst
   leuchtete der ganze Chip auf, wenn nur eine Hälfte überfahren wird. Alles
   Einteilige nimmt `chipTextBase`: dieselbe Hülle plus `state`, Fokusring,
   Ausrichtung und Polsterung. So ändert sich die Pille an EINER Stelle. */
export const chipTextHuelle =
  "type-body-medium inline-flex h-9 rounded-full kontur normal-case transition-colors";
export const chipTextBase = `${chipTextHuelle} state focus-ring items-center gap-1.5 px-3`;
export const chipTextOutlined = "border-kante text-on-surface";
/* Gewählt: umrandet und beschriftet in Primary, ohne Fläche (Epic #363) —
   für jeden gewählten Chip und den Filterknopf. Ohne Grund steht die
   Primary-Schrift auf dem dunklen Grund am klarsten; eine getönte Fläche
   nahm ihr Kontrast, und gefüllt kehrte sie
   den Nutzertext in schwarze Schrift — der Name, den die Trainerin vergeben
   hat, soll auch gewählt wie ihr Name aussehen. */
export const chipTextSelected = "border-primary text-primary";

/* Filter-Chip (toggelbar) — gewählt: Kontur und Schrift in Primary, ohne
   Fläche und ohne Häkchen (`chipTextSelected`). Ein Filter steht neben Suchfeld, Auswahl und Knöpfen; gefüllt
   wäre er lauter als die Handlung daneben, und der Farbwechsel von Kontur
   und Schrift sagt «an» bereits — für Screenreader `aria-pressed`.
   Optionales führendes Icon, gewählt wie ungewählt. */
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
      className={cn(
        chipTextBase,
        selected ? chipTextSelected : chipTextOutlined,
        className,
      )}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}

/* ── Choice-Chip-Gruppe (Einfachauswahl, offen) ───────────────
   Genau EIN Wert aus einer offen liegenden Menge — für Werte, die in keiner
   einzeiligen Leiste Platz hätten und darum UMBRECHEN müssen: Varianten-
   bezeichnungen dürfen vierzig Zeichen lang sein, und eine seitlich
   scrollende Reihe zeigte sie nicht mehr nebeneinander. Radiogroup-Semantik
   (role=radiogroup / role=radio, aria-checked) — es ist ein Eingabefeld und
   keine Ansicht —, mit Pfeiltasten-Navigation und wanderndem Tabstopp.

   Optik: dieselben Chip-Bündel, ausgewählt umrandet in Primary wie der
   Filter. Kein Häkchen — es ist eine Einfachauswahl, nicht ein
   Ein/Aus-Zustand, und der Wechsel der Kontur trägt die Aussage bereits.

   Bewusst hook-frei: Chip.tsx wird auch von Server-Komponenten importiert.
   Der Fokus wandert darum über das DOM statt über Refs. */
export function ChoiceChip({
  selected = false,
  tabStop = false,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  /** Trägt den Tabstopp, solange NICHTS gewählt ist — sonst wäre eine leere
   *  Gruppe per Tastatur unerreichbar. Der Aufrufer setzt ihn auf dem ersten
   *  Chip. */
  tabStop?: boolean;
  onSelect?: () => void;
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
        chipTextBase,
        selected ? chipTextSelected : chipTextOutlined,
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Der Container der Choice-Chips. Umbricht — das ist sein ganzer Zweck. */
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
      className={cn(chipTextBase, chipTextOutlined, className)}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}
