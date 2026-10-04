import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* Der Rahmen jedes Formularfelds (Epic #363, nach dem Vorbild von Jira): Ist
   das Feld leer und wird nicht bearbeitet, steht sein Name gedämpft IM Feld.
   Sobald man hineinklickt oder ein Wert drinsteht, springt der Name ÜBER das
   Feld, und das Feld wird um diese Zeile höher. So bleibt ein ausgefülltes
   Formular lesbar, ohne dass man ins Feld klickt, und ein leeres eine ruhige,
   knappe Liste von Namen. Darunter steht
   Hinweis oder Fehler. Der Name trägt darüber die Lesetype klein und gedämpft
   (`type-body-small`), nicht die Versal-Type der Label: Er benennt nur, er
   ruft nicht. Den Wechsel regelt `.feld-rahmen` in globals.css.

   Hier und nur hier steht der Stil des Feldnamens. TextField, TextArea,
   DateTimeField, Select und MultiSelect bauen ihr Feld in diesen Rahmen; eine
   Gruppe zusammengehöriger Felder («Spielfeldgrösse» über Länge × Breite)
   nimmt `FeldGruppe` und trägt ihren Namen im selben Stil. */

/** Der Feldname als Klassen — für die seltenen Orte, an denen ein Name ohne
 *  Rahmen steht (eine feste Angabe an der Stelle eines Felds). */
/* Name und Hinweis stehen bündig mit dem Text im Feld (`px-3.5` = Polster
   des Feldkastens plus seine Kontur) und ohne eigenen Abstand zum Feld: Der
   Feldkasten polstert seinen Text ohnehin, und so liest sich Name und Wert
   als ein Eintrag wie in Jira, nicht als Beschriftung über einem Kasten. */
export function feldNameKlasse(error?: boolean): string {
  return cn("type-body-small block px-3.5", farbe(error));
}

/** Hinweis oder Fehler unter einem Feld oder einer Gruppe. */
function hinweisKlasse(error?: boolean): string {
  return cn("type-body-small px-3.5", farbe(error));
}

function farbe(error?: boolean): string {
  return error ? "text-error" : "text-on-surface-mittel";
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
  leer = false,
  hinweis,
  error = false,
  className,
  onLabelClick,
  children,
}: {
  /** Id des Eingabe-Elements; der Name hängt als `${id}-label` daran. */
  id: string;
  label: string;
  /** Echtes Label, aber nur für die Vorlesehilfe — für Felder, deren Zweck
   *  ihr Platzhalter und ihr Ort schon sagen (Suche in der Filterleiste). */
  labelVersteckt?: boolean;
  /** Für Auswahlfelder: Ist noch nichts gewählt? Dann steht der Name im Feld
   *  statt darüber (siehe `.feld-rahmen` in globals.css). Text-Eingaben
   *  brauchen das nicht — dort sagt es ihr Platzhalter. */
  leer?: boolean;
  hinweis?: ReactNode;
  error?: boolean;
  className?: string;
  /** Für Eingabe-Elemente, die kein <label> beschriften kann (ein <div> als
   *  Auslöser): was ein Klick auf den Namen auslösen soll. */
  onLabelClick?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("feld-rahmen", className)}
      data-leer={leer || undefined}
      data-fehler={error || undefined}
      data-name-versteckt={labelVersteckt || undefined}
    >
      <label
        id={`${id}-label`}
        htmlFor={id}
        onClick={onLabelClick}
        className={labelVersteckt ? "sr-only" : cn("feld-name", feldNameKlasse(error))}
      >
        {label}
      </label>
      {children}
      {hinweis && (
        <p id={hinweisIdVon(id, hinweis)} className={hinweisKlasse(error)}>
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
  beschriftetVon,
  fehler,
  className,
  children,
}: {
  /** Der Name über der Gruppe. Fehlt er, nennt `beschriftetVon` die id einer
   *  Überschrift, die die Gruppe schon von aussen benennt. */
  name?: ReactNode;
  beschriftetVon?: string;
  /** Ein Fehler, der die Gruppe als Ganzes betrifft — er färbt den Namen und
   *  steht unter den Feldern. */
  fehler?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const fehlerId = `${id}-fehler`;
  return (
    <div
      role="group"
      aria-labelledby={beschriftetVon ?? id}
      aria-describedby={fehler ? fehlerId : undefined}
      className={className}
    >
      {name && !beschriftetVon && (
        <p id={id} className={feldNameKlasse(!!fehler)}>
          {name}
        </p>
      )}
      {children}
      {fehler && (
        <p id={fehlerId} className={hinweisKlasse(true)}>
          {fehler}
        </p>
      )}
    </div>
  );
}
