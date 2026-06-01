import { cn } from "@/lib/cn";

type Tone = "manual" | "entwurf" | "oeffentlich" | "neutral";

const tones: Record<Tone, string> = {
  // Manual-Bestand: solide Kreide-Plakette (inverse-surface) — maximal "offiziell"
  manual: "bg-inverse-surface text-inverse-on-surface",
  // Eigener Entwurf (privat)
  entwurf: "border-[1.5px] border-outline text-on-surface-variant",
  // Eigene öffentliche Übung — signal-bright als bewusster heller Akzent
  oeffentlich: "bg-primary/15 text-signal-bright border-[1.5px] border-primary/40",
  neutral: "border-[1.5px] border-outline text-on-surface-variant",
};

const defaultLabel: Record<Tone, string> = {
  manual: "Offiziell",
  entwurf: "Entwurf",
  oeffentlich: "Öffentlich",
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
