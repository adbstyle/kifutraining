import { useId } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { InfoKnopf } from "./InfoKnopf";

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
   DateTimeField, Select und MultiSelect bauen ihr Feld in diesen Rahmen. Jedes
   Feld trägt seinen eigenen Namen — auch zwei zusammengehörige Werte wie
   Länge und Breite stehen als zwei Felder untereinander, nicht unter einem
   gemeinsamen Namen (PO 2026-10-04). */

/** Der Feldname als Klassen — für die seltenen Orte, an denen ein Name ohne
 *  Rahmen steht (eine feste Angabe an der Stelle eines Felds). */
/* Name und Hinweis stehen bündig mit dem Text im Feld (`px-3.5` = Polster
   des Feldkastens plus seine Kontur), und Name und Wert lesen sich als ein
   Eintrag wie in Jira, nicht als Beschriftung über einem Kasten. Der Name
   steht dafür auf einer Zeile so hoch wie seine Schrift (12 statt 18 px).
   Seinen Abstand zum Feld regelt `.feld-rahmen > .feld-name` in globals.css:
   im Fokus zur Kontur, ruhend zur Schrift des Werts, beide Male gleich. */
export function feldNameKlasse(error?: boolean): string {
  return cn("type-body-small block px-3.5 leading-3", farbe(error));
}

/** Hinweis oder Fehler unter einem Feld. */
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

/** Die ids von Hinweis (unter dem Feld) und Info (hinter dem ⓘ) — der
 *  Aufrufer hängt sie per `aria-describedby` an sein Eingabe-Element, sonst
 *  liest sie kein Screenreader vor. */
export function beschreibungIdVon(id: string, hinweis?: ReactNode, info?: ReactNode): string | undefined {
  const ids = [hinweis ? `${id}-hinweis` : null, info ? `${id}-info` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function Feld({
  id,
  label,
  labelVersteckt = false,
  leer = false,
  hinweis,
  info,
  aktion,
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
  /** Fehler und Hinweise, die sich mit der Eingabe ändern — sichtbar unter
   *  dem Feld. */
  hinweis?: ReactNode;
  /** Ein fester Hinweis, der das Feld erklärt — hinter einem ⓘ rechts im
   *  Feld (`InfoKnopf`), damit er das Formular nicht dauernd füllt. Das ⓘ
   *  zeigt sich nur beim Überfahren (siehe `.feld-info` in globals.css). */
  info?: ReactNode;
  /** Ein Knopf, der mit dem Feld zusammen eine Handlung bildet (Speichern,
   *  Suchen) — in derselben Zeile wie der Feldkasten, damit beide auf einer
   *  Linie stehen, ob der Name darüber steht oder (leer) ausgeblendet ist. */
  aktion?: ReactNode;
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
      <div className={cn(!!aktion && "flex items-end gap-3")}>
        {/* Name und Feldkasten — die «Angabe». Das ⓘ steht in ihr rechts,
            senkrecht mittig: zwischen Name und Wert, bei leerem Feld (Name
            im Feld) mittig im Kasten. Sein Platz bleibt frei, auch wenn es
            nicht zu sehen ist, damit der Wert nicht darunter läuft. */}
        <div className={cn("relative", !!aktion && "min-w-0 flex-1", !!info && "pr-10")}>
          <label
            id={`${id}-label`}
            htmlFor={id}
            onClick={onLabelClick}
            className={labelVersteckt ? "sr-only" : cn("feld-name", feldNameKlasse(error))}
          >
            {label}
          </label>
          {children}
          {info && (
            <>
              <div className="feld-info absolute top-1/2 right-0 -translate-y-1/2">
                <InfoKnopf label={label}>{info}</InfoKnopf>
              </div>
              <span id={`${id}-info`} className="sr-only">
                {info}
              </span>
            </>
          )}
        </div>
        {/* Unten bündig: Der Knopf steht auf einer Linie mit dem Kasten, ob
            der Name darüber steht oder (leer) ausgeblendet ist. */}
        {aktion && <div className="shrink-0">{aktion}</div>}
      </div>
      {hinweis && (
        <p id={`${id}-hinweis`} className={hinweisKlasse(error)}>
          {hinweis}
        </p>
      )}
    </div>
  );
}
