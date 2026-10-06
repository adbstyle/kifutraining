import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Emphase-Stufen (filled → text) + destruktiv + leise. Die Werte stehen direkt
// als Rollen hier — je Variante eine Höhenstufe oder eine Kontur, keine
// Zwischenschicht aus Component-Tokens mehr: Wer den Knopf liest, sieht, auf
// welcher Höhe er sitzt, ohne in globals.css nachschlagen zu müssen.
//
// Schrift: Jeder Knopf steht normal gesetzt in `type-title-small` (Geist 600,
// 14/20) — nicht versal. Dieselbe Schrift tragen die Reiter (TabNav); neben
// Chips und Feldern liest sich ein Knopf so als Wort und nicht als Rubrik.
//
// Höhe: Jeder Knopf ist 36 px hoch (Epic #363) — es gibt nur noch dieses
// eine Mass, darum auch keine `size`-Prop. Auf dem Platz wie am Schreibtisch.
//
// `quiet` ist die knappe Bauform des `text`-Knopfes für Handlungen, die am
// Rand einer Chip-Leiste mitlaufen («+ Variante hinzufügen»): dieselbe Farbe
// und Schrift, nur mit knapperer Polsterung.
type Variant = "filled" | "tonal" | "outlined" | "text" | "danger" | "quiet";

// `state` gehört in die Basis und nicht an die Varianten: Die Zustands-Ebene
// färbt sich in der Farbe des Inhalts ein und gilt darum für jede Variante
// gleich — vom gefüllten bis zum blossen Textknopf. Damit entfällt jede eigene
// Überfahr-Fläche je Variante; ein Versatz nach unten beim Drücken ebenso, die
// Ebene meldet den Druck bereits.
const base =
  "state focus-ring type-title-small inline-flex h-9 items-center justify-center rounded-flaeche transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";


// Nur noch Farbe und Fläche — Schrift, Höhe und Zustand stehen in `base`,
// Polsterung und Icon-Abstand in `buttonClasses`.
const variants: Record<Variant, string> = {
  // Höchste Emphase: die einzige Variante, die den Akzent als FLÄCHE trägt.
  filled: "bg-primary text-on-primary",
  // Mittlere Emphase — eine Höhenstufe statt einer Akzentfläche.
  tonal: "bg-elev-08 text-on-surface",
  // Mittlere Emphase — nur Kontur, die Fläche bleibt der Grund.
  outlined: "bg-transparent text-on-surface kontur border-kante",
  // Niedrigste Emphase — nichts als Schrift im Akzent.
  text: "bg-transparent text-primary",
  // Destruktiv: Error umrandet und beschriftet, füllt aber nie — eine rote
  // Fläche wäre lauter als die Handlung, die sie auslöst.
  // Die Kontur trägt Error VOLL, nicht gedämpft: Der destruktive Knopf steht
  // fast immer im Dialog (24dp), und dort kam eine 40-%-Kontur auf 1.91:1 —
  // unter den 3:1 für grafische Objekte, praktisch unsichtbar. Volles Error
  // trägt auch dort 4.56:1, und der Rahmen ist hier das einzige, was den
  // Knopf als Fläche überhaupt begrenzt.
  danger: "bg-transparent text-error kontur border-error",
  // Die dichte Bauform von `text` — dieselbe Farbe, siehe oben.
  quiet: "bg-transparent text-primary",
};

/** Gemeinsame Button-Klassen — geteilt von Button und ButtonLink, damit ein
 *  navigierender Button als <a>/<Link> dieselbe Optik trägt (kein <a><button>). */
export function buttonClasses(variant: Variant = "filled", className?: string): string {
  // `quiet` rückt Zeichen und Rand näher an den Text.
  return cn(base, variants[variant], variant === "quiet" ? "gap-1.5 px-2" : "gap-2 px-4", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "filled", className, ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, className)} {...props} />
  ),
);
Button.displayName = "Button";

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
};

/** Wie Button, aber als Navigations-Link (Next <Link>). Verhindert das
 *  ungültige <a><button>-Nesting bei „Button, der navigiert". */
export function ButtonLink({ variant = "filled", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}
