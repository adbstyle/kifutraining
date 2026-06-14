import { cn } from "@/lib/cn";

type Tone = "manual" | "entwurf" | "oeffentlich" | "neutral";

const tones: Record<Tone, string> = {
  // Manual-Bestand: solide Kreide-Plakette (inverse-surface) — maximal "offiziell"
  manual: "bg-inverse-surface text-inverse-on-surface",
  // Eigener Entwurf (privat): solides Dunkelgrün — deckend & lesbar auch über Bildern
  entwurf: "bg-surface-container-high text-on-surface border-[1.5px] border-outline-variant",
  // Eigene öffentliche/Community-Übung: solides Dunkelorange (primary-container) als deckender Akzent
  oeffentlich: "bg-primary-container text-on-primary-container",
  neutral: "border-[1.5px] border-outline text-on-surface-variant",
};

const defaultLabel: Record<Tone, string> = {
  manual: "Kifu-Manual",
  entwurf: "Entwurf",
  oeffentlich: "Community",
  neutral: "",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] leading-none",
        tones[tone],
        className,
      )}
    >
      {children ?? defaultLabel[tone]}
    </span>
  );
}

/* Herkunfts-/Status-Plakette: Manual-Bestand vs. eigene öffentliche/Entwurf-Übung.
   Eine Quelle für Karte und Detailansicht. */
export function HerkunftBadge({
  herkunft,
  visibility,
}: {
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
}) {
  if (herkunft === "manual") return <Badge tone="manual" />;
  if (visibility === "public") return <Badge tone="oeffentlich" />;
  return <Badge tone="entwurf">✎ Entwurf</Badge>;
}
