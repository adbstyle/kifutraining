import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// M3-Emphase-Stufen (filled → text) + destruktiv + leise. Werte kommen aus den
// --button-*-Component-Tokens in globals.css (zeigen auf die System-Rollen).
//
// Warum eine sechste Stufe (`quiet`): Versalien sind für eine Randhandlung zu
// laut. «+ Variante hinzufügen» steht in einer Leiste NEBEN Chips, die
// Nutzertext tragen und darum normal gesetzt sind — ein mono-versaler Knopf
// daneben schriee, und die Leiste zerfiele in zwei Stimmen. `quiet` behält die
// Signalfarbe des `text`-Knopfes (es ist dieselbe Emphase-Ebene), lässt aber
// die Versalien fallen: so liest sich die Leiste als EINE Zeile.
type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text" | "danger" | "quiet";
type Size = "sm" | "md" | "lg";

const base =
  "focus-ring inline-flex items-center justify-center rounded-(--button-shape) transition-[background-color,box-shadow,transform,color] duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";

/** Schrift und Icon-Abstand einer Variante. Eigener Slot und nicht in `base`,
 *  weil `cn` ein reiner Joiner ist (kein tailwind-merge): In den fertigen
 *  String darf genau EINE Typo-Klasse gelangen, eine Basis-Klasse liesse sich
 *  nicht überschreiben. `quiet` ist als einzige eine Schrift-Stufe — siehe
 *  oben —, alle übrigen tragen die M3-Button-Typo. */
function typo(variant: Variant): string {
  return variant === "quiet" ? "type-title-small gap-1.5" : "type-label-large gap-2";
}

// Nur noch Farbe und Fläche — Schrift kommt aus `typo`, Höhe und Polsterung
// aus `sizes` bzw. dem `quiet`-Mass.
const variants: Record<Variant, string> = {
  // Höchste Emphase — M3 Filled: flächig, Hover via State-Layer (kein Schatten,
  // keine Helligkeitsänderung). Press-Nudge wie bei allen Varianten.
  filled:
    "bg-(--button-filled-container) text-(--button-filled-label) hover:bg-(--button-filled-container-hover) active:translate-y-px",
  // Mittlere Emphase — tonale Fläche
  tonal:
    "bg-(--button-tonal-container) text-(--button-tonal-label) hover:bg-(--button-tonal-container-hover) active:translate-y-px",
  // Mittlere Emphase mit weichem M3-Schatten (Kontrast zum harten Filled-Schatten)
  elevated:
    "bg-(--button-elevated-container) text-(--button-elevated-label) shadow-e3 hover:bg-(--button-elevated-container-hover) hover:shadow-e4 active:translate-y-px",
  // Mittlere Emphase — nur Rand, State-Layer auf transparentem Grund
  outlined:
    "bg-transparent text-(--button-outlined-label) border-[1.5px] border-(--button-outlined-outline) hover:bg-on-surface/8 active:translate-y-px",
  // Niedrigste Emphase
  text: "bg-transparent text-(--button-text-label) hover:bg-on-surface/8",
  // Destruktiv — Error-Rolle
  danger:
    "bg-transparent text-(--button-danger-label) border-[1.5px] border-(--button-danger-outline) hover:bg-error/10",
  // Eine Stufe UNTER `text` — für Handlungen, die am Rand mitlaufen. Nicht
  // leiser in der Farbe (die Signalfarbe bleibt, es ist dieselbe Emphase),
  // sondern in der Schrift: Source Serif 600 statt mono-versal.
  quiet: "bg-transparent text-(--button-text-label) hover:bg-on-surface/8",
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
