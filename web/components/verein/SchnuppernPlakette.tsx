import { Lozenge } from "@/components/ui";
import { probeKurz, probeLang, type SchnupperZahl } from "@/lib/probe";

/** Eine schnuppernde Spieler:in in den Vereinslisten (#584): «Schnuppern 1/4»,
 *  ohne festgelegte Anzahl nur «Schnuppern». Wortlaut und Ton (`discovery`)
 *  wie am Team-Ort (`SchnupperLozenge`); die Verwaltung kennt nur besuchte
 *  Trainings und Anzahl, darum nimmt sie nur `SchnupperZahl`. */
export function SchnuppernPlakette({ stand }: { stand: SchnupperZahl }) {
  return (
    <Lozenge appearance="discovery" title={probeLang(stand)}>
      <span aria-hidden>{probeKurz(stand)}</span>
      <span className="sr-only">{probeLang(stand)}</span>
    </Lozenge>
  );
}
