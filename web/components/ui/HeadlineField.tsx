import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface HeadlineFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Pflicht: Das Feld trägt keine sichtbare Beschriftung, also muss der Name
   *  von hier kommen. Ohne ihn hörte eine Vorlesehilfe bloss «Eingabefeld». */
  "aria-label": string;
  /** Fehlerzustand: Die Kontur steht dann auch in Ruhe, in der Fehlerfarbe —
   *  ein leeres Pflichtfeld wäre sonst unsichtbar. */
  error?: boolean;
  /** Die Schrift der Überschrift, die das Feld ersetzt: `headline` (Vorgabe,
   *  Trainingsname) oder `title` (Name einer Übung, wie auf ihrer Seite). */
  schrift?: "headline" | "title";
}

/* Kopf-Feld — die Überschrift selbst ist das Eingabefeld.
 *
 * Gebaut für den Fall, in dem ein vom Trainer vergebener Name dort geändert
 * wird, wo er steht (#250): Der Kopf soll seine Gliederung behalten, also
 * trägt das Feld die Schrift der Überschrift (`type-headline-medium`) und
 * nicht die eines gewöhnlichen Werts.
 *
 * DREI LAGEN, und nur die mittlere ist neu im Haus:
 *
 * RUHEND sieht man eine Überschrift und kein Feld — keine Kontur, keine
 * Fläche. Der Kopf soll ein Kopf bleiben; eine Kontur in Ruhe machte aus der
 * Überschrift ein Formularfeld und zöge die Aufmerksamkeit auf ein
 * Bedienelement, das man selten braucht.
 *
 * BEIM ZEIGEN legt sich eine Fläche darunter. Sie ist die ganze Ankündigung:
 * Hier lässt sich etwas eintragen. Dass eine Fläche das sagt und nicht eine
 * Kontur, ist der Unterschied zu `TextField` — dort steht das Feld in einem
 * Formular und ist als Feld angekündigt, hier steht es in einem Kopf und muss
 * sich erst zu erkennen geben.
 *
 * Die Stufe 04 ist mit Absicht kein Nachbar der Karte, auf der das Feld
 * gewöhnlich liegt (01): Eine Stufe darüber wäre rechnerisch eine Fläche und
 * am Bildschirm keine. Vier Stufen Abstand sind noch leise und trotzdem zu
 * sehen — auf dem Grund (00) wie auf einer Karte.
 *
 * IM FOKUS trägt es die Kontur in Primary, wie jedes andere Feld des Hauses.
 * Die Stärke bleibt dabei dieselbe wie in Ruhe (nur die Farbe wechselt von
 * durchsichtig auf Primary) — ein Sprung von 1.5 auf 2 px verschöbe bei
 * 28 px Schrift die ganze Zeile sichtbar.
 *
 * KEIN Feldname darüber: Der Wert IST bereits die Überschrift, ein Name
 * daneben benennte dieselbe Sache ein zweites Mal. Den Namen trägt darum
 * `aria-label`. Und weil ein `<input>` keine Überschrift ist, gehört daneben
 * eine echte — sonst verlöre die Seite ihre Gliederung.
 *
 * Die Überschriften stehen in normaler Schreibung (Epic #363), darum sieht
 * der Trainer seinen Namen beim Tippen genau so, wie er ihn schreibt — und
 * wie ihn die Ansichtsseite danach zeigt.
 *
 * Keine Höhe in `h-*`: Das Feld wächst mit seiner Schrift und bleibt so in
 * jeder Zoomstufe so hoch wie die Überschrift, die es ersetzt. Der
 * Innenabstand steht als negativer Aussenabstand daneben, damit der Text
 * genau dort beginnt, wo die Überschrift begänne.
 *
 * PLATZHALTER in gedämpfter Farbe: Ist der Name geleert, wäre ein ruhendes
 * Feld ohne Wert sonst schlicht nicht da. Wo ein Name erst entsteht (Neue
 * Übung, Neues Training), steht statt des Kopf-Felds ein `TextField` mit
 * `schrift="title"`.
 *
 * Verwendung:
 *   <HeadlineField aria-label="Name des Trainings" value={…} onChange={…} onBlur={…} /> */
export const HeadlineField = forwardRef<HTMLInputElement, HeadlineFieldProps>(
  ({ className, error = false, schrift = "headline", ...props }, ref) => (
    <input
      ref={ref}
      type="text"
      aria-invalid={error || undefined}
      className={cn(
        schrift === "title" ? "type-title-large" : "type-headline-medium",
        "-mx-2 w-[calc(100%+1rem)] rounded-flaeche kontur bg-transparent px-2 py-1 text-on-surface outline-none",
        "placeholder:text-on-surface-mittel",
        "transition-colors duration-150",
        "hover:bg-elev-04 focus:bg-transparent",
        error ? "border-error" : "border-transparent focus:border-primary",
        className,
      )}
      {...props}
    />
  ),
);
HeadlineField.displayName = "HeadlineField";
