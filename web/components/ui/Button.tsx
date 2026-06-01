import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-[0.08em] rounded-[3px] transition-[background-color,transform,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-rasen-950 disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  // Orange Plakatknopf mit hartem Schlagschatten (taktisch, klickbar)
  primary:
    "bg-signal text-rasen-950 hover:bg-signal-bright active:translate-y-px shadow-[0_3px_0_0_var(--color-signal-dark)] active:shadow-[0_1px_0_0_var(--color-signal-dark)]",
  secondary:
    "bg-transparent text-chalk chalk-border hover:bg-chalk/10 active:translate-y-px",
  ghost: "bg-transparent text-chalk-dim hover:text-chalk hover:bg-chalk/5",
  danger:
    "bg-transparent text-red-300 border-[1.5px] border-red-400/40 hover:bg-red-500/10 hover:text-red-200",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[11px]",
  md: "h-11 px-5 text-xs",
  lg: "h-14 px-7 text-sm", // Spielfeldrand-Grösse (Touch ≥ 56px)
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
