import { Lozenge } from "@/components/ui";
import { probeKurz, probeLang, type SchnupperZahl } from "@/lib/probe";

/** Eine schnuppernde Spieler:in als Plakette (#555, #584): «Schnuppern 1/4» —
 *  besuchte von der Anzahl, in `discovery` (etwas Zusätzliches, PO 2026-10-29).
 *  Wie viele sie angemeldet hat, steht am jeweiligen Training, nicht hier;
 *  darum genügen `anzahl` und `besucht` (auch die Verwaltung kennt nur diese). */
export function SchnupperLozenge({ stand }: { stand: SchnupperZahl }) {
  return (
    <Lozenge appearance="discovery" title={probeLang(stand)}>
      <span aria-hidden>{probeKurz(stand)}</span>
      <span className="sr-only">{probeLang(stand)}</span>
    </Lozenge>
  );
}
