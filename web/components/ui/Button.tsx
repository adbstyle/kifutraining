import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// M3-Emphase-Stufen (filled → text) + destruktiv. Werte kommen aus den
// --button-*-Component-Tokens in globals.css (zeigen auf die System-Rollen).
type Variant = "filled" | "tonal" | "elevated" | "outlined" | "text" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "focus-ring type-label-large inline-flex items-center justify-center gap-2 rounded-(--button-shape) transition-[background-color,box-shadow,transform,color] duration-150 disabled:opacity-40 disabled:pointer-events-none select-none";

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
  text:
    "bg-transparent text-(--button-text-label) hover:bg-on-surface/8",
  // Destruktiv — Error-Rolle
  danger:
    "bg-transparent text-(--button-danger-label) border-[1.5px] border-(--button-danger-outline) hover:bg-error/10",
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
  return cn(base, variants[variant], sizes[size], className);
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
