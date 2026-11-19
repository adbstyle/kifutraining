import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "./Lozenge";
import { ZeichenPunkt, type ZeichenPunktTon } from "./ZeichenPunkt";

type IconBtnVariant = "standard" | "overlay";

/* Ein Mass für alle Icon-Knöpfe (Epic #363): 36 px im Quadrat, Zeichen 20 px —
   gleich hoch wie Knopf, Chip und Feld, damit jede Leiste eine Linie bleibt. */
const BOX = "h-9 w-9";
const ICON = 20;

/** Gemeinsame Shell-Klassen — geteilt von IconButton und IconButtonLink, damit
 *  ein navigierender Icon-Button (als <a>/<Link>) dieselbe Optik trägt. */
function iconButtonClasses(
  variant: IconBtnVariant = "standard",
  active?: boolean,
  className?: string,
  primary?: boolean,
): string {
  return cn(
    // `state` trägt Überfahren, Fokus und Druck — in der Farbe des Zeichens.
    // Beim aktiven Knopf färbt `state-primary` die Ebene mit ein, damit der
    // eingeschaltete Zustand auch in Ruhe leicht angehoben steht, ohne eine
    // eigene Fläche zu bekommen.
    // Eckig mit gerundeten Kanten wie Knopf und Feld (Epic #363), kein Kreis.
    "state focus-ring inline-flex items-center justify-center rounded-flaeche transition-colors",
    "disabled:opacity-40 disabled:pointer-events-none",
    // Gesperrt, aber fokussierbar (`aria-disabled`, etwa während eine Kopie
    // läuft): sieht aus wie gesperrt, der Aufrufer fängt den Klick ab.
    "aria-disabled:opacity-40 aria-disabled:cursor-default",
    BOX,
    // `primary`: die Hauptaktion einer Zeile (etwa Kopieren im KopierFeld,
    // PO 2026-10-24) — gefüllt wie der Knopf `filled`, Primary-Fläche mit
    // dunklem Zeichen, ohne Umschalt-Bedeutung.
    active ? "text-primary state-primary" : primary ? "bg-primary text-on-primary" : "text-on-surface-mittel",
    // Über Bild oder Diagramm braucht das Zeichen einen eigenen Grund: eine
    // knapp deckende Höhenstufe plus Weichzeichner — kein Schatten, denn der
    // Knopf liegt AUF dem Bild und schwebt nicht darüber.
    variant === "overlay" && "bg-elev-06/85 backdrop-blur-sm",
    className,
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  /** aktiver/ausgewählter Zustand → Toggle-Semantik (aria-pressed) + Primary-Farbe
   *  samt eingefärbter Zustands-Ebene */
  active?: boolean;
  /**
   * `standard` (default): kein eigener Grund, die Zustands-Ebene genügt.
   * `overlay`: eigener, knapp deckender Grund (Höhenstufe 06 + Weichzeichner)
   * für die Platzierung über Bildern/Diagrammen, z. B. auf der Übungskarte.
   */
  variant?: "standard" | "overlay";
  /** Pass-Through an das Lucide-Icon (z. B. `fill` für den Favoriten-Herz). */
  iconProps?: Partial<ComponentProps<LucideIcon>>;
  /** Ein Punkt am Zeichen (`ZeichenPunkt`), etwa ob der private Link bezogen
   *  ist. Stumm — was er meldet, gehört in `label`. */
  punkt?: ZeichenPunktTon;
  /** Hauptaktion: gefüllt in Primary wie `Button variant="filled"` — kein Umschalter. */
  primary?: boolean;
  /** Eine Zahl am Zeichen (`Badge` oben rechts), etwa die neuen Benachrichtigungen;
   *  ab 10 «9+», bei 0 nichts. Stumm — die Zahl gehört in `label`. */
  zahl?: number;
}

/* Icon-Knopf: gezeichnetes Icon (Lucide) + Zustands-Ebene statt Füllung.
   Ruhefarbe on-surface-mittel, aktiv Primary.
   `active` aktiviert Toggle-Semantik (aria-pressed); ohne `active` = reiner Aktions-Button. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon: Icon, label, active, variant = "standard", iconProps, punkt, primary, zahl, className, ...props },
    ref,
  ) => {
    const isToggle = active !== undefined;
    return (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={isToggle ? active : undefined}
        className={iconButtonClasses(variant, active, className, primary)}
        {...props}
      >
        {punkt || (zahl ?? 0) > 0 ? (
          <span className="relative">
            <Icon size={ICON} strokeWidth={2} aria-hidden {...iconProps} />
            {punkt && <ZeichenPunkt ton={punkt} />}
            {zahl !== undefined && zahl > 0 && (
              <Badge className="absolute -right-2 -top-2 ring-2 ring-[var(--zeichen-grund,var(--color-elev-01))]">{zahl > 9 ? "9+" : zahl}</Badge>
            )}
          </span>
        ) : (
          <Icon size={ICON} strokeWidth={2} aria-hidden {...iconProps} />
        )}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";

export type IconButtonLinkProps = ComponentProps<typeof Link> & {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  variant?: IconBtnVariant;
  iconProps?: Partial<ComponentProps<LucideIcon>>;
};

/* Wie IconButton, aber als Navigations-Link (Next <Link>) — verhindert das
   ungültige <a><button>-Nesting bei „Icon-Button, der navigiert". */
export function IconButtonLink({
  icon: Icon,
  label,
  variant = "standard",
  iconProps,
  className,
  ...props
}: IconButtonLinkProps) {
  return (
    <Link
      aria-label={label}
      className={iconButtonClasses(variant, undefined, className)}
      {...props}
    >
      <Icon size={ICON} strokeWidth={2} aria-hidden {...iconProps} />
    </Link>
  );
}
