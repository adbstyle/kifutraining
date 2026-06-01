import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "type-label-large inline-flex items-center justify-center gap-2 rounded-[3px] transition-[background-color,transform,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  // Signatur: orange Plakatknopf mit hartem Schlagschatten (KiFu-Marke, kein M3-Elevation-Layer)
  primary:
    "bg-primary text-on-primary hover:bg-signal-bright active:translate-y-px shadow-[0_3px_0_0_var(--color-signal-dark)] active:shadow-[0_1px_0_0_var(--color-signal-dark)]",
  secondary:
    "bg-transparent text-on-surface border-[1.5px] border-outline hover:bg-on-surface/8 active:translate-y-px",
  ghost:
    "bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8",
  danger:
    "bg-transparent text-error border-[1.5px] border-error/40 hover:bg-error/10 hover:text-on-error-container",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-5",
  lg: "h-14 px-7", // Spielfeldrand-Grösse (Touch ≥ 56px)
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  ),
);
Button.displayName = "Button";
