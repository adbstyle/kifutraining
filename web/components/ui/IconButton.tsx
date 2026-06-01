import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";

const sizes: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-9 w-9", icon: 20 }, // dicht
  md: { box: "h-11 w-11", icon: 24 }, // default, Touch-freundlich
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  size?: Size;
  /** aktiver/ausgewählter Zustand → Toggle-Semantik (aria-pressed) + primary-Farbe + State-Layer */
  active?: boolean;
}

/* IconButton nach M3: outlined Icon (Lucide) + State-Layer statt Fill.
   Default-Icon-Farbe on-surface-variant, aktiv primary.
   `active` aktiviert Toggle-Semantik (aria-pressed); ohne `active` = reiner Aktions-Button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, size = "md", active, className, ...props }, ref) => {
    const s = sizes[size];
    const isToggle = active !== undefined;
    return (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={isToggle ? active : undefined}
        className={cn(
          "focus-ring inline-flex items-center justify-center rounded-full transition-colors",
          "disabled:opacity-40 disabled:pointer-events-none",
          s.box,
          active
            ? "text-primary bg-primary/10 hover:bg-primary/15 active:bg-primary/20"
            : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10",
          className,
        )}
        {...props}
      >
        <Icon size={s.icon} strokeWidth={2} aria-hidden />
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
