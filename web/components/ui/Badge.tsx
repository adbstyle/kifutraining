import { cn } from "@/lib/cn";

type Tone = "manual" | "entwurf" | "oeffentlich" | "neutral";

const tones: Record<Tone, string> = {
  // Manual-Bestand: solide Kreide-Plakette — maximal erkennbar als "offiziell"
  manual: "bg-chalk text-rasen-950",
  // Eigener Entwurf (privat)
  entwurf: "chalk-border text-chalk-dim",
  // Eigene öffentliche Übung
  oeffentlich: "bg-signal/15 text-signal-bright border-[1.5px] border-signal/40",
  neutral: "chalk-border text-chalk-dim",
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
