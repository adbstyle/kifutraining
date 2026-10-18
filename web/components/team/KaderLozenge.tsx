import { Lozenge } from "@/components/ui";

/** Wie ein entfernter Kader an einem begonnenen Termin heisst (#453 PC 4). */
export const EHEMALIGER_KADER = "Ehemaliger Kader";

/** Ein Kader als Plakette (#447): neutral und ohne Symbol, nur sein Name —
 *  in der Spielerliste, im Trainingsplan, am Termin und am privaten Link
 *  (PO 2026-10-18). Ein Kader trägt keine Farbe (#452 OoS 1). Ohne Namen:
 *  der ehemalige Kader eines begonnenen Termins, gedämpft. */
export function KaderLozenge({ name, className }: { name: string | null; className?: string }) {
  return (
    <Lozenge appearance="neutral" className={className} title={name ?? EHEMALIGER_KADER}>
      {name ?? <span className="text-on-surface-mittel">{EHEMALIGER_KADER}</span>}
    </Lozenge>
  );
}

/** Mehrere Kader nebeneinander, umbrechend. */
export function KaderLozenges({ namen, className }: { namen: readonly (string | null)[]; className?: string }) {
  if (namen.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className ?? ""}`}>
      {namen.map((n, i) => (
        <KaderLozenge key={`${n ?? "ehemalig"}-${i}`} name={n} />
      ))}
    </span>
  );
}
