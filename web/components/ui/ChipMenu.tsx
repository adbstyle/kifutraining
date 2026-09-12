"use client";

import { useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { ChevronDown } from "lucide-react";
import { Menu, type MenuItemDef } from "./Menu";
import { chipTextBase, chipTextHuelle } from "./Chip";
import { cn } from "@/lib/cn";

/* Chip mit Menü — ein Chip, der auf Klick ein Menü öffnet. Gedacht für Werte,
   die man an ihrem Ort umsortieren oder entfernen können muss (Sequenz-Chips)
   und deren Beschriftung NUTZERTEXT ist.

   Warum kein bestehender Chip: `InputChip` kennt nur ein Entfernen-X (16 px,
   kein Touch-Ziel) und kann „nach vorne/nach hinten schieben" gar nicht
   ausdrücken; `AssistChip` löst genau eine Aktion aus. Beide tragen ausserdem
   `type-label-medium` — mono/versal —, was einen Gruppennamen verfälscht.
   Darum hier `type-body-medium normal-case`.

   ZWEI Bauformen, je nachdem, wie viele Aufgaben an dem Wert hängen:

   1. UNGETEILT (Vorgabe) — der Chip ist EIN Bedienelement mit EINEM Tabstopp:
      kein Chip-plus-Knopf, sondern ein Button, der das Menü trägt
      (`aria-haspopup="menu"`). So am Gruppen-Chip: dort gibt es nichts zu
      wählen, nur zu verwalten.

   2. GETEILT (`onSelect` gesetzt) — links wählen, rechts verwalten. Am
      Varianten-Chip hängen zwei Aufgaben an EINEM Wert: „zeig mir diese
      Variante" und „benenne/verschiebe/entferne sie". Ein Menüeintrag
      „Anzeigen" allein reichte nicht — Wechseln ist die häufigste Handlung der
      Leiste und darf nicht zwei Klicks kosten. Also zwei Bedienelemente,
      zwei Tabstopps, aber EIN Chip-Umriss: die Zeile bleibt eine Reihe von
      Varianten, nicht eine Reihe von Knopfpaaren.

      Darum im geteilten Fall auch KEINE Radiogroup-Semantik (`role=radio` /
      wandernder Tabstopp): Eine Radiogroup verlangt genau ein fokussierbares
      Element je Wert und übernimmt die Pfeiltasten — hier gibt es zwei, und
      Pfeiltasten gehören dem geöffneten Menü. Die Wahl sagt stattdessen
      `aria-pressed` an der linken Hälfte.

   Eigene Datei statt in `Chip.tsx`, weil Chip.tsx hook-frei bleiben muss — es
   wird auch von Server-Komponenten importiert. Trigger-State und -Ref liegen
   wie beim `OverflowMenu` je Instanz hier drin, damit mehrere Chips
   nebeneinander sich nicht in die Quere kommen.

   Verwendung:
     <ChipMenu label={gruppe.name} ariaLabel={`Gruppe ${gruppe.name}, Wechsel 2 von 3`}
               items={[{ label: "Nach vorne", icon: ChevronLeft, onSelect: … }]} />
     <ChipMenu label={variante.name} selected onSelect={() => wechseln(v.id)}
               selectAriaLabel={`Variante ${variante.name} anzeigen`}
               items={…} /> */
export function ChipMenu({
  ref,
  label,
  items,
  leading,
  trailing,
  ariaLabel,
  onSelect,
  selected = false,
  selectAriaLabel,
  menuAriaLabel,
  tone = "neutral",
  disabled,
  menuClassName,
  className,
}: {
  /** Ref auf den Chip selbst — im geteilten Fall auf die MENÜ-Hälfte. Ein Chip
   *  in einer Sequenz muss von aussen fokussierbar sein: Wer ihn per Menü
   *  verschiebt, soll ihn danach an seiner neuen Stelle unter dem Fokus
   *  behalten — und das Verschieben rendert die Liste neu, bevor der Fokus
   *  zurückkommt (React 19: `ref` ist eine gewöhnliche Prop).
   *
   *  Warum die Menü-Hälfte und nicht die ganze Gruppe: Der Fokus kam gerade
   *  aus dem Menü, und das Menü gibt ihn seinem Trigger zurück. Fokus-Rückgabe
   *  und Fokus-Nachführung nach dem Verschieben treffen so dasselbe Element —
   *  die Nutzerin bleibt an dem Knopf stehen, den sie eben bedient hat, und
   *  kann direkt weiterschieben. */
  ref?: Ref<HTMLButtonElement>;
  /** Beschriftung des Chips — in der Regel Nutzertext (z. B. ein Gruppenname). */
  label: string;
  items: MenuItemDef[];
  /** Führender Inhalt vor dem Label, meist ein Icon. Farbe bestimmt der Aufrufer. */
  leading?: ReactNode;
  /** Gedämpfter Zusatz NACH dem Label — eine Angabe zum Wert, keine Handlung
   *  (z. B. „· 24 min"). Der Aufrufer setzt die Farbe
   *  (`text-on-surface-mittel`), damit sie nicht mit dem Namen konkurriert. */
  trailing?: ReactNode;
  /** a11y-Name des ungeteilten Chips, wenn das blosse Label zu wenig sagt
   *  („Gruppe 2, Wechsel 2 von 3"). Im geteilten Fall benennen
   *  `selectAriaLabel` und `menuAriaLabel` die beiden Hälften einzeln. */
  ariaLabel?: string;
  /** Gesetzt = GETEILTER Chip: links wählt (diese Funktion), rechts öffnet das
   *  Menü. Ohne die Prop bleibt der Chip ungeteilt. */
  onSelect?: () => void;
  /** Nur geteilt: ob dieser Wert gerade der angezeigte ist (`aria-pressed`). */
  selected?: boolean;
  /** Nur geteilt: a11y-Name der linken (wählenden) Hälfte. */
  selectAriaLabel?: string;
  /** Nur geteilt: a11y-Name der rechten (öffnenden) Hälfte. Vorgabe
   *  „Menü zu „{label}"". */
  menuAriaLabel?: string;
  /** `befund`: etwas stimmt nicht, lässt sich aber speichern. Färbt nur Rahmen
   *  und Chevron — nie die Fläche.
   *
   *  Befund und Fehleingabe tragen dieselbe Farbe; sie unterscheiden sich in
   *  `aria-invalid` und im Verhalten, nicht im Bild. Eine eigene dritte Farbe
   *  fürs blosse Hinschauen gibt es bewusst nicht mehr: Sie stand ausserhalb
   *  der Rollen und musste Stück für Stück mitgepflegt werden, während der
   *  Unterschied ohnehin nicht in der Farbe liegt, sondern darin, ob sich
   *  speichern lässt. */
  tone?: "neutral" | "befund";
  disabled?: boolean;
  /** Ausrichtung/Breite des Menüs, z. B. `right-0`. */
  menuClassName?: string;
  className?: string;
}) {
  const [offen, setOffen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Ohne Einträge zeigt `Menu` nichts an — dann darf der Chip auch kein
  // geöffnetes Menü behaupten.
  const hatEintraege = items.length > 0;
  const geteilt = Boolean(onSelect);

  /** Zwei Interessenten an einem Element: das Menü braucht seinen Anker, der
   *  Aufrufer den Fokus. Beide bekommen dasselbe Element — im geteilten Fall
   *  die Menü-Hälfte.
   *
   *  Die Aufräumfunktion des Aufrufers wird durchgereicht: Eine Ref-Callback
   *  darf seit React 19 eine zurückgeben, und wer hier eine Registratur führt
   *  (`DurchlaufZeile` merkt sich die Chips je Gruppen-ID), räumte sonst nie
   *  auf. Weil diese Weitergabe selbst eine Aufräumfunktion ist, ruft React die
   *  Callback nicht mehr mit `null` — das Abhängen gehört darum vollständig
   *  hierher: die eigene Ref, eine Objekt-Ref des Aufrufers und, im Altstil
   *  ohne Aufräumfunktion, der `null`-Aufruf seiner Callback. */
  function triggerRefSetzen(el: HTMLButtonElement | null) {
    triggerRef.current = el;
    const aufraeumen = typeof ref === "function" ? ref(el) : undefined;
    if (ref && typeof ref !== "function") ref.current = el;
    return () => {
      triggerRef.current = null;
      if (typeof aufraeumen === "function") aufraeumen();
      else if (typeof ref === "function") ref(null);
      else if (ref) ref.current = null;
    };
  }

  // Der Befund schlägt die Auswahl am RAHMEN (er ist die Meldung), nie an der
  // Fläche — Farbe trägt hier, sie füllt nicht.
  const randfarbe =
    tone === "befund"
      ? "border-error"
      : selected
        ? "border-primary"
        : "border-kante";
  // Gewählt wie jeder Nutzertext-Chip (`chipTextSelected`): Primary umrandet
  // und beschriftet, dazu ein sehr leiser Grund — nicht gefüllt, sonst kippte
  // der selbst vergebene Name in schwarze Schrift.
  const flaeche = selected ? "bg-primary/12 text-primary" : "text-on-surface";

  const chevron = (
    <ChevronDown
      size={14}
      strokeWidth={2}
      aria-hidden
      className={cn("shrink-0", tone === "befund" && "text-error")}
    />
  );

  /** Was die menü-öffnende Schaltfläche ausmacht — in beiden Bauformen
   *  dasselbe, nur an verschiedenen Elementen: der Anker des Menüs, seine
   *  Ankündigung und der Schalter. Name und Klassen bleiben je Bauform. */
  const menuProps = {
    ref: triggerRefSetzen,
    type: "button" as const,
    disabled,
    "aria-haspopup": "menu" as const,
    "aria-expanded": offen && hatEintraege,
    onClick: () => setOffen((o) => !o),
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {geteilt ? (
        // Der Umriss gehört der GRUPPE, nicht den Hälften: ein Chip, in der
        // Mitte geteilt — darum dieselbe `chipTextHuelle` wie am ungeteilten,
        // nur mit `items-stretch`, damit beide Hälften die volle Trefferhöhe
        // bekommen; Fokusring und Polsterung sitzen je Hälfte. Kein
        // `overflow-hidden` — das schnitte den Fokusring ab (outline mit
        // offset).
        <div className={cn(chipTextHuelle, "items-stretch", randfarbe, flaeche)}>
          <button
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={selectAriaLabel}
            onClick={onSelect}
            className={cn(
              "state focus-ring inline-flex min-w-0 items-center gap-1.5 rounded-l-full px-3 transition-colors",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {leading}
            {label}
            {trailing}
          </button>
          {/* 44 px breit — die Menü-Hälfte ist ein eigenständiges Touch-Ziel
              und nicht ein angehängtes 16px-Chevron. Der Trennstrich ist der
              linke Rand dieser Hälfte und darum die einzige Stelle, an der
              `border-l-[1.5px]` statt der `kontur`-Utility steht: Die Utility
              setzt alle vier Seiten, hier ist nur eine gemeint — ein Strich
              MITTEN im Chip, nicht ein zweiter Umriss um die halbe Pille.
              Auf dem gewählten Chip trägt er Primary wie der Umriss, sonst
              die Kante. */}
          <button
            {...menuProps}
            aria-label={menuAriaLabel ?? `Menü zu „${label}“`}
            className={cn(
              "state focus-ring inline-flex w-11 shrink-0 items-center justify-center rounded-r-full border-l-[1.5px] transition-colors",
              selected ? "border-primary/50" : "border-kante",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {chevron}
          </button>
        </div>
      ) : (
        <button
          {...menuProps}
          aria-label={ariaLabel}
          // Dieselbe Optik-Quelle wie `ChoiceChip look="nutzertext"` und die
          // Links der Leseseiten (`chipTextBase` in Chip.tsx): ändert sich die
          // Nutzertext-Pille, ändern sich alle vier Bauformen zusammen — der
          // geteilte Chip oben inbegriffen, er trägt dieselbe Hülle.
          className={cn(
            chipTextBase,
            randfarbe,
            flaeche,
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {leading}
          {label}
          {trailing}
          {chevron}
        </button>
      )}
      <Menu
        open={offen}
        onClose={() => setOffen(false)}
        triggerRef={triggerRef}
        items={items}
        className={menuClassName}
      />
    </div>
  );
}
