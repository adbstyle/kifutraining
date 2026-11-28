import { cn } from "@/lib/cn";

/* Liegende Balken (Meldezeitpunkte, #703, Variante M2): je Reihe eine
   Beschriftung, ein Balken und die Zahl als Text. Mehrere Diagramme
   nebeneinander teilen einen Massstab (`max`), damit ihre Balken vergleichbar
   bleiben — etwa drei Karten mit denselben fünf Zeitfenstern.

   Neu im Kit, weil keine bestehende Form Anzahlen nebeneinander vergleicht:
   Der `Teilnahmebalken` teilt eine Summe in Anteile, der Bestand zählt auf
   eine Grenze zu. Domänenfrei: Die Reihen und ihr Massstab kommen vom
   Aufrufer.

   - Eine echte Liste (`<ol>` mit Namen); jede Reihe nennt Beschriftung und
     Zahl als Text, der Balken ist `aria-hidden` und ergänzt nur.
   - Eine Farbe für alle Balken (`bg-primary`), statt wie im Prototyp
     heller werdender Stufen: Die hellen Stufen hielten den Kontrast 3:1 für
     Grafik auf der Fläche nicht; die Reihenfolge tragen die Beschriftungen.
   - Eine leere Reihe hat keinen Balken, ihre 0 steht gedämpft; eine volle
     mindestens 3 px, damit 1 neben einer grossen Zahl nicht verschwindet. */
export function LiegenderBalken({
  reihen,
  max,
  label,
  className,
}: {
  reihen: readonly { label: string; anzahl: number }[];
  /** Der Massstab: diese Anzahl füllt die ganze Breite. Ohne: die grösste
   *  Reihe. */
  max?: number;
  /** Der Name der Liste für Vorlesehilfen. */
  label: string;
  className?: string;
}) {
  const voll = Math.max(1, max ?? Math.max(0, ...reihen.map((r) => r.anzahl)));
  return (
    <ol aria-label={label} className={cn("flex flex-col gap-1", className)}>
      {reihen.map((r) => (
        <li key={r.label} className="grid min-h-7 grid-cols-[8rem_minmax(0,1fr)] items-center gap-2 type-body-small">
          <span className="text-on-surface-mittel">{r.label}</span>
          <span className="flex min-w-0 items-center gap-1.5">
            {r.anzahl > 0 && (
              <span
                aria-hidden
                className="block h-3.5 shrink-0 rounded-r-klein bg-primary"
                style={{ width: `max(3px, calc((100% - 2.25rem) * ${Math.min(1, r.anzahl / voll).toFixed(3)}))` }}
              />
            )}
            <span
              className={cn(
                "min-w-5 tabular-nums",
                r.anzahl > 0 ? "font-semibold text-on-surface" : "text-on-surface-mittel",
              )}
            >
              {r.anzahl}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
