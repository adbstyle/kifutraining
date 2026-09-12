import { Check, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";

/* ── Alterskategorie-Plakette (G bis A) ──────────────────────
   Je Stufe eine eigene, fest lernbare Farbe — als KONTUR und Schrift,
   nicht als Fläche: Die Farbe trägt die Stufe, sie füllt sie nicht.
   Gefüllt stünden sieben Werte nebeneinander als Flickenteppich und
   konkurrierten mit jedem gefüllten Knopf daneben; als Umriss bleiben
   sie leise, und der Buchstabe unterscheidet ohnehin mit (a11y: nie
   nur über Farbe).
   Einzige Ausnahme ist der DRUCK: Auf Papier ist eine helle Kontur
   kaum zu sehen — kat-a (#cfd8dc) verschwände auf Weiss ganz. Dort
   kippt die Plakette darum in die gefüllte Form mit dunkler Schrift.
   Die Schrift bleibt dabei `text-on-surface`: Im Druck-`:root` ist diese
   Rolle bereits die Tinte, ein getippter Hex wäre eine dritte Stelle,
   an der dieselbe Farbe steht.

   Exportiert, weil `components/training/StufenField.tsx` dieselbe
   Plakette in seinen Auswahl-Kacheln trägt: EINE Tabelle für beide
   Orte statt zweier, die auseinanderlaufen. */
export const katPlakette: Record<KategorieSlug, string> = {
  G: "kontur border-current text-kat-g bg-transparent print:bg-kat-g print:text-on-surface print:border-transparent",
  F: "kontur border-current text-kat-f bg-transparent print:bg-kat-f print:text-on-surface print:border-transparent",
  E: "kontur border-current text-kat-e bg-transparent print:bg-kat-e print:text-on-surface print:border-transparent",
  D: "kontur border-current text-kat-d bg-transparent print:bg-kat-d print:text-on-surface print:border-transparent",
  C: "kontur border-current text-kat-c bg-transparent print:bg-kat-c print:text-on-surface print:border-transparent",
  B: "kontur border-current text-kat-b bg-transparent print:bg-kat-b print:text-on-surface print:border-transparent",
  A: "kontur border-current text-kat-a bg-transparent print:bg-kat-a print:text-on-surface print:border-transparent",
};

export function KategorieChip({ k }: { k: KategorieSlug }) {
  return (
    <span
      title={kategorieStufe[k]}
      className={cn(
        // 22 px wie die `Badge` — beide sind Plaketten, und der Styleguide
        // nennt für sie EIN Mass.
        "type-plakette inline-flex h-[22px] items-center justify-center rounded-plakette px-2",
        katPlakette[k],
      )}
    >
      {k}
    </span>
  );
}

/* ── Chips ────────────────────────────────────────────────────
   Eine gemeinsame Basis, vier Typen: Assist · Filter · Input · Suggestion.
   Die Rollen stehen direkt in den Bündeln — gewählt füllt Primary, ungewählt
   umrandet die Kante, und `state` in der Basis trägt Überfahren, Fokus und
   Druck. Darum trägt kein Bündel mehr eine eigene Überfahr-Fläche: Die
   Zustands-Ebene färbt sich in der Farbe des Chip-Inhalts ein und passt so
   auf jede Variante.

   Die drei Bündel bleiben modul-lokal: Jeder Chip mit Vokabular-Beschriftung
   ist in dieser Datei gebaut, und ein Bündel nach aussen zu geben lüde dazu
   ein, die Chip-Optik anderswo neu zusammenzusetzen. Exportiert sind nur die
   Nutzertext-Bündel weiter unten — die tragen auch Links und den geteilten
   Chip, die hier nicht wohnen.

   Höhe fest gesetzt statt über die Polsterung: Aus `py-1.5` folgten 31 px, und
   der Chip stünde neben jedem anderen 32-px-Element um einen Pixel versetzt. */
const chipBase =
  "state focus-ring type-label-medium inline-flex items-center gap-1.5 rounded-full kontur px-3 transition-colors";

/* Die Höhe ist ein eigener Slot und steht NICHT in `chipBase` — `cn` ist ein
   reiner Joiner (kein tailwind-merge), eine Basis-Höhe liesse sich von aussen
   also nicht überschreiben: Wer `className="h-12"` mitgäbe, überliesse die
   Entscheidung der Reihenfolge im erzeugten CSS. Genau die Falle, um die es
   schon bei `look` geht. Darum eine geführte Prop.

   `normal` (32 px) ist das Grundmass des Label-Chips: Es gilt im Fliesstext
   und in jeder Chip-Reihe. `leiste` (48 px) ist das Mass der dichten Felder —
   ein Chip in einer FILTERLEISTE steht neben Suchfeld und Auswahlfeld und muss
   mit ihnen fluchten, sonst zerfällt die Zeile optisch in zwei Bänder.
   Nur der Filter-Chip kennt die Prop, weil nur er in solchen Leisten steht;
   die übrigen Typen tragen das Grundmass. */
const chipHoehen = { normal: "h-8", leiste: "h-12" } as const;
/* Modul-lokal wie die Bündel: Die Aufrufstellen schreiben das Wort
   («leiste»), niemand ausserhalb braucht den Typ zu benennen. */
type ChipGroesse = keyof typeof chipHoehen;
const chipOutlined = "border-kante bg-transparent text-on-surface";
const chipSelected = "border-transparent bg-primary text-on-primary";
/* Schwebender Chip: eine Höhenstufe plus Schatten statt einer Kontur — er
   liegt über der Fläche, statt in sie eingeschrieben zu sein. */
const chipElevated = "border-transparent bg-elev-06 text-on-surface shadow-dp-04";

/* ── Chip-Optik für NUTZERTEXT ────────────────────────────────
   Dieselbe Pille, aber normal gesetzt statt mono/versal: `type-label-medium`
   verfälscht, was die Trainerin selbst geschrieben hat («21 Kinder, zwei
   Trainer» in Versalien liest sich als Rubrik, nicht als ihre Bezeichnung).
   Dieselbe Regel, aus der schon `ChipMenu` `type-body-medium` trägt.

   Auch exportiert — die Server-Seiten (`VariantenLinks`) tragen die Optik auf
   einem <a>, und der geteilte Chip (`ChipMenu`) baut sie auf zwei Hälften auf.
   Höhe fest auf h-9, damit Chip, geteilter Chip und leiser Knopf in einer
   Leiste auf derselben Linie sitzen.

   ZWEI Bündel, weil der geteilte Chip die Pille anders füllt: `chipTextHuelle`
   ist der Umriss — Schrift, Höhe, Rundung, Rahmen —, den er als Gruppe um
   seine beiden Hälften legt (dort `items-stretch`, damit jede die volle
   Trefferhöhe bekommt, und die Polsterung sitzt je Hälfte). Die Zustands-Ebene
   gehört dort nicht an die Gruppe, sondern an jede Hälfte einzeln — sonst
   leuchtete der ganze Chip auf, wenn nur eine Hälfte überfahren wird. Alles
   Einteilige nimmt `chipTextBase`: dieselbe Hülle plus `state`, Fokusring,
   Ausrichtung und Polsterung. So ändert sich die Nutzertext-Pille an EINER
   Stelle. */
export const chipTextHuelle =
  "type-body-medium inline-flex h-9 rounded-full kontur normal-case transition-colors";
export const chipTextBase = `${chipTextHuelle} state focus-ring items-center gap-1.5 px-3`;
export const chipTextOutlined = "border-kante text-on-surface";
/* Gewählter Nutzertext-Chip: umrandet und beschriftet in Primary, dazu ein
   sehr leiser Grund. Nicht gefüllt wie der Filter-Chip — eine gefüllte Pille
   kehrte den Nutzertext in schwarze Schrift, und der Name, den die Trainerin
   vergeben hat, soll auch gewählt wie ihr Name aussehen. */
export const chipTextSelected = "border-primary bg-primary/12 text-primary";

/* Filter-Chip (toggelbar) — gewählt: gefüllt in Primary, mit Häkchen.
   Optionales führendes Icon, wenn nicht selektiert. */
export function FilterChip({
  selected = false,
  onClick,
  children,
  icon: Icon,
  groesse = "normal",
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: LucideIcon;
  /** `normal` (Vorgabe, 32 px) im Fliesstext und in Chip-Reihen; `leiste`
   *  (48 px) in einer Filterleiste, wo der Chip mit den dichten Feldern
   *  fluchtet. Bewusst eine Prop statt `className` — siehe `chipHoehen`. */
  groesse?: ChipGroesse;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        chipBase,
        chipHoehen[groesse],
        selected ? chipSelected : chipOutlined,
        className,
      )}
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

   Optik: dieselben Chip-Bündel, ausgewählt wie der Filter-Chip.
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
        // Der Nutzertext-Chip trägt seine Höhe (h-9) in der eigenen Hülle —
        // er fluchtet mit dem leisen Knopf, nicht mit dem Label-Chip.
        look === "nutzertext" ? chipTextBase : `${chipBase} ${chipHoehen.normal}`,
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
   `elevated`: Höhenstufe plus Schatten statt Kontur.

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
      className={cn(
        chipBase,
        chipHoehen.normal,
        elevated ? chipElevated : chipOutlined,
        className,
      )}
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
      className={cn(chipBase, chipHoehen.normal, chipOutlined, className)}
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
    <span className={cn(chipBase, chipHoehen.normal, chipOutlined, "pr-2", className)}>
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Entfernen"
          className="state focus-ring -mr-1 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-on-surface-mittel transition-colors"
        >
          <X size={14} strokeWidth={2.5} aria-hidden />
        </button>
      )}
    </span>
  );
}
