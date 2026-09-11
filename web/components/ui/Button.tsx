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
// Warum eine sechste Stufe (`quiet`): Versalien sind für eine Randhandlung zu
// laut. «+ Variante hinzufügen» steht in einer Leiste NEBEN Chips, die
// Nutzertext tragen und darum normal gesetzt sind — ein mono-versaler Knopf
// daneben schriee, und die Leiste zerfiele in zwei Stimmen. `quiet` behält die
// Primary-Farbe des `text`-Knopfes (es ist dieselbe Emphase-Ebene), lässt aber
// die Versalien fallen: so liest sich die Leiste als EINE Zeile.
type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

// `state` gehört in die Basis und nicht an die Varianten: Die Zustands-Ebene
// färbt sich in der Farbe des Inhalts ein und gilt darum für jede Variante
// gleich — vom gefüllten bis zum blossen Textknopf. Damit entfällt jede eigene
// Überfahr-Fläche je Variante; ein Versatz nach unten beim Drücken ebenso, die
// Ebene meldet den Druck bereits.
const base =
  "state focus-ring inline-flex items-center justify-center rounded-flaeche transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";

/** Schrift und Icon-Abstand einer Variante. Eigener Slot und nicht in `base`,
 *  weil `cn` ein reiner Joiner ist (kein tailwind-merge): In den fertigen
 *  String darf genau EINE Typo-Klasse gelangen, eine Basis-Klasse liesse sich
 *  nicht überschreiben. `quiet` ist als einzige eine Schrift-Stufe — siehe
 *  oben —, alle übrigen tragen die Label-Typo des Knopfes. */
function typo(variant: Variant): string {
  return variant === "quiet" ? "type-title-small gap-1.5" : "type-label-large gap-2";
}

// Nur noch Farbe und Fläche — Schrift kommt aus `typo`, Höhe und Polsterung
// aus `sizes` bzw. dem `quiet`-Mass, der Zustand aus `state` in `base`.
const variants: Record<Variant, string> = {
  // Höchste Emphase: die einzige Variante, die den Akzent als FLÄCHE trägt.
  filled: "bg-primary text-on-primary",
  // Mittlere Emphase — eine Höhenstufe statt einer Akzentfläche.
  tonal: "bg-elev-08 text-on-surface",
  // Wie tonal, aber schwebend: eine Stufe darunter im Grund, dafür ein
  // Schatten, der sie vom Untergrund abhebt — und die Schrift im Akzent.
  elevated: "bg-elev-06 text-primary shadow-dp-04",
  // Mittlere Emphase — nur Kontur, die Fläche bleibt der Grund.
  outlined: "bg-transparent text-on-surface kontur border-kante",
  // Niedrigste Emphase — nichts als Schrift im Akzent.
  text: "bg-transparent text-primary",
  // Destruktiv: Error umrandet und beschriftet, füllt aber nie — eine rote
  // Fläche wäre lauter als die Handlung, die sie auslöst.
  danger: "bg-transparent text-error kontur border-error/40",
  // Eine Stufe UNTER `text` — für Handlungen, die am Rand mitlaufen. Nicht
  // leiser in der Farbe (Primary bleibt, es ist dieselbe Emphase), sondern in
  // der Schrift: normal gesetzt statt mono-versal.
  quiet: "bg-transparent text-primary",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-5",
  lg: "h-14 px-7", // Spielfeldrand-Grösse (Touch ≥ 56px)
};

/** Gemeinsame Button-Klassen — geteilt von Button und ButtonLink, damit ein
 *  navigierender Button als <a>/<Link> dieselbe Optik trägt (kein <a><button>). */
export function buttonClasses(
  variant: Variant = "filled",
  size: Size = "md",
  className?: string,
): string {
  return cn(
    base,
    typo(variant),
    variants[variant],
    // `quiet` ist eine SCHRIFT-Stufe, keine Emphase-Stufe mit eigener Grössen-
    // leiter: Es gibt ihn nur in einer Höhe, darum ignoriert er `size`.
    variant === "quiet" ? "h-9 px-2" : sizes[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "filled", size = "md", className, ...props }, ref) => (
    <button ref={ref} className={buttonClasses(variant, size, className)} {...props} />
  ),
);
Button.displayName = "Button";

export type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

/** Wie Button, aber als Navigations-Link (Next <Link>). Verhindert das
 *  ungültige <a><button>-Nesting bei „Button, der navigiert". */
export function ButtonLink({ variant = "filled", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
