"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Clock } from "lucide-react";
import { TextField } from "@/components/ui";
import { DAUER_SCHRITT } from "@/lib/training";

/** Was einer Eingabe im Weg steht. Knapp gehalten, weil er unter einem 112px
 *  schmalen Feld steht — ein ganzer Satz stünde dort über vier Zeilen und
 *  schöbe die halbe Übungszeile auseinander. */
const UNGUELTIG = "Ganze Zahl ab 0.";

/**
 * Die Dauer einer Zuordnung als Zahlenfeld (Story #151).
 *
 * Vorher stand hier ein Stepper in Fünferschritten. Er war ein Werkzeug für
 * grobe Planungsgrössen; seit die Übungen eines Wechsels gleich lang sein
 * müssen, ist die Dauer eine Rechengrösse — 12 min will man eintippen und nicht
 * in zwei Klicks anfahren. Zulässig ist jede ganze Zahl ab 0 (PO-Entscheid
 * 2026-09-08); die Pfeiltasten des Felds gehen in Einerschritten.
 *
 * Gespeichert wird beim Verlassen des Felds und mit Enter, nicht bei jedem
 * Tastendruck: «1», «12», «120» wären sonst drei Speichervorgänge, von denen
 * zwei nie gemeint waren.
 *
 * Eine ungültige Eingabe bleibt am Feld stehen, statt zurückgesetzt zu werden:
 * Sie ist der Stand, den der Trainer berichtigen will. Gespeichert wird sie
 * nicht — die Server Action lehnte sie ohnehin ab, und die Meldung stünde dann
 * unten am Seitenrand statt an dem Feld, in das er gerade geschrieben hat.
 *
 * Bewusste Abweichung vom Entwurf: Das Feld zeigt den Wert OHNE Einheit. Ein
 * natives Zahlenfeld kann kein Suffix im Feld tragen; die Einheit steht darum
 * im Platzhalter, im Feldnamen («Dauer in Minuten») und im Uhr-Icon.
 */
export function DauerFeld({
  value,
  warnung,
  onChange,
}: {
  /** Die erfasste Dauer in Minuten, `null` ohne Dauer. */
  value: number | null;
  /** Steht diese Dauer in einem ungleich langen Wechsel? Färbt den Rahmen
   *  bernstein (Story #150 `dauerWarnung`) — ein Befund, kein Fehler. */
  warnung?: boolean;
  /** Der neue Wert; `null` heisst «ohne Dauer». Persistiert der Aufrufer. */
  onChange: (next: number | null) => void;
}) {
  const [entwurf, setEntwurf] = useState(() => (value == null ? "" : String(value)));
  const [fehler, setFehler] = useState(false);
  // Der Wert, der zuletzt zum Speichern hinausging. Ohne diese Schranke
  // speichert Enter einmal und das anschliessende Verlassen des Felds ein
  // zweites Mal. Ref statt State: sie muss beim nächsten Aufruf schon gelten,
  // nicht erst beim nächsten Rendern.
  const gesendet = useRef<number | null | undefined>(undefined);
  // Der zuletzt von aussen gesehene Wert. Ändert er sich — nach einer
  // Rücknahme durch den Server oder durch frische Serverdaten —, gilt er und
  // nicht mehr, was im Feld steht.
  const [gesehen, setGesehen] = useState(value);
  if (value !== gesehen) {
    setGesehen(value);
    setEntwurf(value == null ? "" : String(value));
    setFehler(false);
    gesendet.current = undefined;
  }

  function speichere() {
    const roh = entwurf.trim();
    // Ein leeres Feld ist keine Fehleingabe, sondern die Angabe «ohne Dauer».
    const naechster = roh === "" ? null : Number(roh);
    if (naechster !== null && (!Number.isInteger(naechster) || naechster < 0)) {
      setFehler(true);
      return;
    }
    setFehler(false);
    // Ein unveränderter Wert ist kein Speichervorgang — sonst schriebe jedes
    // Vorbeitabben in die Datenbank —, und derselbe Wert kein zweiter Auftrag.
    if (naechster === value || naechster === gesendet.current) return;
    gesendet.current = naechster;
    onChange(naechster);
  }

  function beiTaste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Kein Absenden eines umgebenden Formulars — das Feld speichert selbst.
    e.preventDefault();
    speichere();
  }

  return (
    <TextField
      dense
      type="number"
      inputMode="numeric"
      min={0}
      step={DAUER_SCHRITT}
      label="Dauer in Minuten"
      placeholder="min"
      leadingIcon={Clock}
      className="w-28 shrink-0"
      value={entwurf}
      autoComplete="off"
      onChange={(e) => {
        setEntwurf(e.target.value);
        // Wer weiterschreibt, hebt die Schranke auf: Derselbe Wert darf danach
        // erneut hinaus — etwa, wenn der Server ihn zwischenzeitlich zurücknahm.
        gesendet.current = undefined;
        if (fehler) setFehler(false);
      }}
      onBlur={speichere}
      onKeyDown={beiTaste}
      error={fehler}
      warning={!fehler && !!warnung}
      supportingText={fehler ? UNGUELTIG : undefined}
    />
  );
}
