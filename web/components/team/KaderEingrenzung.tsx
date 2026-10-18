import type { ReactNode } from "react";
import { SearchX } from "lucide-react";
import { Badge, Button, FilterChip, Leerzustand } from "@/components/ui";
import { KADER_TEXT } from "@/lib/kader";
import { cn } from "@/lib/cn";

/* Die Eingrenzung einer Liste auf einen Kader (#452 AK 8, 9; #447) — in der
   Spielerliste und im Reiter «Spieler:innen» am Termin dieselbe: Chips mit
   der Zahl als Badge, einer zur Zeit (PO 2026-10-18), ein zweiter Klick hebt
   die Eingrenzung auf. Trifft sie niemanden, steht statt der Liste das
   Leerfeld mit «Eingrenzung aufheben». */

export type EingrenzungsChip = { schluessel: string; name: string; anzahl: number };

export function KaderChips({
  chips,
  gewaehlt,
  onWahl,
  label,
  className,
}: {
  chips: EingrenzungsChip[];
  /** Der Schlüssel des gewählten Chips; `null`: keine Eingrenzung. */
  gewaehlt: string | null;
  onWahl: (schluessel: string | null) => void;
  /** Der Name der Gruppe für die Vorlesehilfe. */
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((c) => {
        const an = gewaehlt === c.schluessel;
        return (
          <FilterChip key={c.schluessel} selected={an} onClick={() => onWahl(an ? null : c.schluessel)}>
            {c.name}
            {/* Neutral in Ruhe, Primary am gewählten Chip; vorgelesen in Worten. */}
            <Badge appearance={an ? "primary" : "neutral"}>{c.anzahl}</Badge>
            <span className="sr-only">, {c.anzahl === 1 ? "1 Spieler:in" : `${c.anzahl} Spieler:innen`}</span>
          </FilterChip>
        );
      })}
    </div>
  );
}

/** Das Leerfeld, wenn die Eingrenzung niemanden trifft. */
export function EingrenzungLeer({
  titel,
  children,
  onAufheben,
}: {
  titel: string;
  children: ReactNode;
  onAufheben: () => void;
}) {
  return (
    <Leerzustand
      icon={SearchX}
      titel={titel}
      dicht
      aktion={
        <Button variant="text" onClick={onAufheben}>
          {KADER_TEXT.eingrenzungAufheben}
        </Button>
      }
    >
      {children}
    </Leerzustand>
  );
}
