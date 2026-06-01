import { cn } from "@/lib/cn";

/* Ersatzdarstellung für Übungen ohne Feld-Diagramm:
   eine gezeichnete Kreide-Spielfeldskizze (NFR: Platzhalter statt Lücke). */
export function FieldPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-rasen-850 chalk-hatch",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 160 100"
        className="h-full w-full max-h-[70%] max-w-[80%] opacity-30"
        fill="none"
        stroke="var(--color-chalk)"
        strokeWidth="1.5"
      >
        <rect x="6" y="6" width="148" height="88" rx="2" />
        <line x1="80" y1="6" x2="80" y2="94" />
        <circle cx="80" cy="50" r="16" />
        <rect x="6" y="28" width="22" height="44" />
        <rect x="132" y="28" width="22" height="44" />
      </svg>
    </div>
  );
}
