import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Der Rahmen jedes Formularfelds (Epic #363): der Name ÜBER dem Feld, darunter
   der Feldkasten, darunter Hinweis oder Fehler. Der Name steht jederzeit da —
   leer, ausgefüllt, im Fokus, im Fehler —, damit ein ausgefülltes Formular
   lesbar bleibt, ohne dass man ins Feld klickt. Er trägt die Lesetype klein
   und gedämpft (`type-body-small`), nicht die Versal-Type der Label: Er
   benennt nur, er ruft nicht.

   Hier und nur hier steht der Stil des Feldnamens. TextField, TextArea,
   DateTimeField, Select und MultiSelect bauen ihr Feld in diesen Rahmen; eine
   Gruppe zusammengehöriger Felder («Spielfeldgrösse» über Länge × Breite)
   nimmt `FeldGruppe` und trägt ihren Namen im selben Stil. */

/** Der Feldname als Klassen — für die seltenen Orte, an denen ein Name ohne
 *  Rahmen steht (eine feste Angabe an der Stelle eines Felds). */
export function feldNameKlasse(error?: boolean): string {
  return cn("type-body-small mb-1 block", error ? "text-error" : "text-on-surface-mittel");
}

/** Feld-id aus React statt aus dem Label-Text: Dialoge halten ihre Felder auch
 *  geschlossen im DOM (natives <dialog>), zwei gleichzeitig gemountete Dialoge
 *  mit gleichem Label ergäben sonst dieselbe id — Label-Klick und Screenreader
 *  träfen das Feld im falschen Dialog. */
export function useFeldId(id?: string): string {
  const reactId = useId();
  return id ?? `feld-${reactId}`;
}

/** Die id des Hinweises unter dem Feld — der Aufrufer hängt sie per
 *  `aria-describedby` an sein Eingabe-Element, sonst liest ihn kein
 *  Screenreader vor. */
export function hinweisIdVon(id: string, hinweis?: ReactNode): string | undefined {
  return hinweis ? `${id}-hinweis` : undefined;
}

export function Feld({
  id,
  label,
  labelVersteckt = false,
  hinweis,
  error = false,
  className,
  children,
}: {
  /** Id des Eingabe-Elements; der Name hängt als `${id}-label` daran. */
  id: string;
  label: string;
  /** Echtes Label, aber nur für die Vorlesehilfe — für Felder, deren Zweck
   *  ihr Platzhalter und ihr Ort schon sagen (Suche in der Filterleiste). */
  labelVersteckt?: boolean;
  hinweis?: ReactNode;
  error?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label
        id={`${id}-label`}
        htmlFor={id}
        className={labelVersteckt ? "sr-only" : feldNameKlasse(error)}
      >
        {label}
      </label>
      {children}
      {hinweis && (
        <p
          id={hinweisIdVon(id, hinweis)}
          className={cn("type-body-small mt-1", error ? "text-error" : "text-on-surface-mittel")}
        >
          {hinweis}
        </p>
      )}
    </div>
  );
}

/** Mehrere Felder unter einem gemeinsamen Namen — Länge × Breite, Minimum bis
 *  Maximum, die Zeilen der Materialliste. Die Gruppe ist für die Vorlesehilfe
 *  eine eigene Einheit (`role="group"`), jedes Feld darin behält seinen Namen. */
export function FeldGruppe({
  name,
  error = false,
  className,
  children,
}: {
  name: ReactNode;
  error?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={className}>
      <p id={id} className={feldNameKlasse(error)}>
        {name}
      </p>
      {children}
    </div>
  );
}
