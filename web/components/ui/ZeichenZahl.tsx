import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/* Eine knappe Angabe mit Zeichen davor — eine Zahl wie «34/36» oder ein Wort
   wie «Kleinfeld» (Epic #518, Tafeln «Als Nächstes» und «Trainingsplan»).
   Mehrere stehen auf einer Linie und ersetzen Abschnitte mit Überschriften:
   Das Zeichen sagt, wovon die Rede ist, der Satz in `label` sagt es ganz —
   für die Vorlesehilfe als Name, beim Überfahren als Tooltip. Ungefärbt: Die
   Bewertung trägt die Lozenge des Termins, nicht die Zahl. */
export function ZeichenZahl({
  icon: Icon,
  label,
  children,
  klein = false,
  className,
}: {
  icon: LucideIcon;
  /** Der ganze Satz, etwa «Kader: 34 von 36 angemeldet». */
  label: string;
  children: React.ReactNode;
  /** In der Terminzeile: Schrift und Zeichen eine Stufe kleiner. */
  klein?: boolean;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 tabular-nums",
        klein ? "type-body-small" : "type-body-medium",
        className,
      )}
    >
      <Icon size={klein ? 14 : 16} strokeWidth={2} aria-hidden className="shrink-0" />
      <span aria-hidden>{children}</span>
    </span>
  );
}
