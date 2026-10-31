import { cn } from "@/lib/cn";
import { treffpunktAnzeige, type Treffpunkt } from "@/lib/spiel";

/* Die Treffpunkte eines Spiels (#465 AK 8, 10; PC 1; Design PO 2026-10-21):
   je Zeile Anreiseart, Zeit und Ort in drei Spalten, frühester zuerst. Die
   Zeit trägt das Datum nur, wenn der Treffpunkt nicht am Spieltag liegt;
   vor Ort nennt den aktuellen Ort des Spiels oder, solange es keinen hat,
   nur die Zeit. Geteilt von den Angaben eines Spiels (Mitglieder) und der
   Spielkarte am privaten Link. */
export function TreffpunktListe({
  treffpunkte,
  spieltag,
  spielOrt,
  className,
}: {
  treffpunkte: readonly Treffpunkt[];
  /** Das Datum des Spiels `YYYY-MM-DD`. */
  spieltag: string;
  spielOrt: string | null;
  className?: string;
}) {
  if (treffpunkte.length === 0) return null;
  return (
    <ul className={cn("grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-3 gap-y-1", className)}>
      {treffpunkte.map((t) => {
        const a = treffpunktAnzeige(t, spieltag, spielOrt);
        return (
          <li key={t.anreise} className="col-span-3 grid grid-cols-subgrid">
            <span>{a.anreise}</span>
            <span className="tabular-nums">{a.zeit}</span>
            <span className="min-w-0 break-words">{a.ort}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* Der Treffpunkt eines Trainings (#561; Design PO 2026-10-29): eine Zeile im
   selben Raster wie die Treffpunkte eines Spiels — statt der Anreiseart steht
   «Treffpunkt», danach Uhrzeit und Ort. Er liegt immer am Trainingstag, darum
   ohne Datum. Geteilt vom Trainingsplan, den Eckdaten (dort ohne das Wort,
   das schon die Angabe nennt) und der Trainingskarte am privaten Link. */
export function TrainingsTreffpunkt({
  treffpunkt,
  bezeichnung = true,
  className,
}: {
  treffpunkt: { zeit: string; ort: string } | null;
  bezeichnung?: boolean;
  className?: string;
}) {
  if (!treffpunkt) return null;
  return (
    <span
      className={cn(
        "grid gap-x-3",
        bezeichnung ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]",
        className,
      )}
    >
      {bezeichnung && <span>Treffpunkt</span>}
      <span className="tabular-nums">{treffpunkt.zeit}</span>
      <span className="min-w-0 break-words">{treffpunkt.ort}</span>
    </span>
  );
}
