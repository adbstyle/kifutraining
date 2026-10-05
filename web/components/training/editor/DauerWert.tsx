"use client";

import { Clock } from "lucide-react";
import { InlineWert } from "@/components/ui";
import { DAUER_SCHRITT, formatDuration } from "@/lib/training";

/** Was einer Eingabe im Weg steht. Knapp gehalten, weil er unter einem
 *  schmalen Zahlenfeld steht. */
const UNGUELTIG = "Ganze Zahl ab 0.";

/** Der rote Wert ist nur sehend wahrnehmbar. Dieser Satz sagt dasselbe für
 *  Screenreader; er hängt als Beschreibung am Wert. */
const WARNUNG_HINWEIS = "Ungleiche Dauer im selben Wechsel.";

/**
 * Die Dauer einer Übung im Training — als dritte Zeile unter Name und
 * Kategorien, direkt bearbeitbar wie das Ziel in den Eigenschaften (PO
 * 2026-10-05, `InlineWert`). Ruhend steht «15 min», ohne Dauer gedämpft
 * «Dauer hinzufügen»; ein Klick macht daraus das Zahlenfeld mit ✓ und ✕.
 *
 * Zulässig ist jede ganze Zahl ab 0 (Story #151, PO 2026-09-08); ein leeres
 * Feld heisst «ohne Dauer». Eine ungültige Eingabe bleibt mit ihrer Meldung
 * stehen und wird nicht gespeichert — sie ist der Stand, den der Trainer
 * berichtigen will. Was das Zahlenfeld nicht als Zahl lesen kann («12min»),
 * gilt als ungültig und nicht als «leer»: Sonst verschwände die erfasste
 * Dauer lautlos.
 *
 * `warnung`: Steht die Dauer in einem ungleich langen Wechsel (Story #150),
 * trägt der Wert die Farbe der Befunde — ein Hinweis, kein Fehler: Er bleibt
 * gespeichert und speicherbar.
 */
export function DauerWert({
  value,
  warnung = false,
  onChange,
}: {
  /** Die erfasste Dauer in Minuten, `null` ohne Dauer. */
  value: number | null;
  warnung?: boolean;
  /** Der neue Wert; `null` heisst «ohne Dauer». Persistiert der Aufrufer. */
  onChange: (next: number | null) => void;
}) {
  return (
    <InlineWert
      art="zahl"
      label="Dauer in Minuten"
      wert={value == null ? "" : String(value)}
      anzeige={
        <>
          <Clock size={14} strokeWidth={2} aria-hidden className="shrink-0" />
          {value == null ? "" : formatDuration(value)}
        </>
      }
      leerText="Dauer hinzufügen"
      schritt={DAUER_SCHRITT}
      breit={false}
      befund={warnung}
      befundText={WARNUNG_HINWEIS}
      pruefe={(entwurf, lesbar) => {
        if (!lesbar) return UNGUELTIG;
        if (entwurf === "") return null;
        const n = Number(entwurf);
        return Number.isInteger(n) && n >= 0 ? null : UNGUELTIG;
      }}
      onSpeichern={(neu) => onChange(neu === "" ? null : Number(neu))}
    />
  );
}
