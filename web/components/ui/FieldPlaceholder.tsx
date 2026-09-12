import { cn } from "@/lib/cn";

/* Ersatzdarstellung für Übungen ohne Feld-Diagramm (NFR: Platzhalter statt
   Lücke): eine schraffierte Fläche auf 02dp mit einer leisen Spielfeldskizze.
   Die Skizze zeichnet in `on-surface` und bleibt damit auf jeder Höhenstufe
   dieselbe — sie ist eine Andeutung, kein Bild. */
export function FieldPlaceholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center bg-elev-02 schraffur",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 160 100"
        className="h-full w-full max-h-[70%] max-w-[80%] opacity-30"
        fill="none"
        stroke="var(--color-on-surface)"
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
