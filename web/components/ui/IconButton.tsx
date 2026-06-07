import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";
type IconBtnVariant = "standard" | "overlay";

const sizes: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-9 w-9", icon: 20 }, // dicht
  md: { box: "h-11 w-11", icon: 24 }, // default, Touch-freundlich
};

/** Gemeinsame Shell-Klassen — geteilt von IconButton und IconButtonLink, damit
 *  ein navigierender Icon-Button (als <a>/<Link>) dieselbe Optik trägt. */
export function iconButtonClasses(
  size: Size = "md",
  variant: IconBtnVariant = "standard",
  active?: boolean,
  className?: string,
): string {
  return cn(
    "focus-ring inline-flex items-center justify-center rounded-full transition-colors",
    "disabled:opacity-40 disabled:pointer-events-none",
    sizes[size].box,
    active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
    variant === "overlay"
      ? "bg-surface-container-low/85 shadow-e1 backdrop-blur-sm hover:bg-surface-container-low"
      : active
        ? "bg-primary/10 hover:bg-primary/15 active:bg-primary/20"
        : "hover:bg-on-surface/8 active:bg-on-surface/10",
    className,
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  size?: Size;
  /** aktiver/ausgewählter Zustand → Toggle-Semantik (aria-pressed) + primary-Farbe + State-Layer */
  active?: boolean;
  /**
   * `standard` (default): transparenter Container, State-Layer beim Hover.
   * `overlay`: lesbarer Scrim (Surface-Container + Blur + Elevation) für die
   * Platzierung über Bildern/Diagrammen, z. B. auf der Übungskarte.
   */
  variant?: "standard" | "overlay";
  /** Pass-Through an das Lucide-Icon (z. B. `fill` für den Favoriten-Herz). */
  iconProps?: Partial<ComponentProps<LucideIcon>>;
}

/* IconButton nach M3: outlined Icon (Lucide) + State-Layer statt Fill.
   Default-Icon-Farbe on-surface-variant, aktiv primary.
   `active` aktiviert Toggle-Semantik (aria-pressed); ohne `active` = reiner Aktions-Button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon: Icon, label, size = "md", active, variant = "standard", iconProps, className, ...props },
    ref,
  ) => {
    const s = sizes[size];
    const isToggle = active !== undefined;
    return (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={isToggle ? active : undefined}
        className={iconButtonClasses(size, variant, active, className)}
        {...props}
      >
        <Icon size={s.icon} strokeWidth={2} aria-hidden {...iconProps} />
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export type IconButtonLinkProps = ComponentProps<typeof Link> & {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  size?: Size;
  variant?: IconBtnVariant;
  iconProps?: Partial<ComponentProps<LucideIcon>>;
};

/* Wie IconButton, aber als Navigations-Link (Next <Link>) — verhindert das
   ungültige <a><button>-Nesting bei „Icon-Button, der navigiert". */
export function IconButtonLink({
  icon: Icon,
  label,
  size = "md",
  variant = "standard",
  iconProps,
  className,
  ...props
}: IconButtonLinkProps) {
  return (
    <Link
      aria-label={label}
      className={iconButtonClasses(size, variant, undefined, className)}
      {...props}
    >
      <Icon size={sizes[size].icon} strokeWidth={2} aria-hidden {...iconProps} />
    </Link>
  );
}
