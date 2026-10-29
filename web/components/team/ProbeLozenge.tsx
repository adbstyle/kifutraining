import { Lozenge } from "@/components/ui";
import { probeKurz, probeLang, type ProbeStand } from "@/lib/probe";

/** Eine Probe-Spieler:in als Plakette (#555): «Probe 1/4» — besuchte von der
 *  Anzahl, in `discovery` (etwas Zusätzliches, PO 2026-10-29). Wie viele sie
 *  angemeldet hat, steht am jeweiligen Training, nicht hier. */
export function ProbeLozenge({ stand, className }: { stand: ProbeStand | null; className?: string }) {
  return (
    <Lozenge appearance="discovery" className={className} title={probeLang(stand)}>
      <span aria-hidden>{probeKurz(stand)}</span>
      <span className="sr-only">{probeLang(stand)}</span>
    </Lozenge>
  );
}
