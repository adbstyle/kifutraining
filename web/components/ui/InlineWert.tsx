"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { TextArea } from "./TextArea";
import { TextField } from "./TextField";

/* ── Wert direkt bearbeiten ───────────────────────────────────
   Ein Wert, den man dort ändert, wo man ihn liest — nach dem Vorbild von Jira
   (Epic #364). Ruhend ist er Text; dass er sich ändern lässt, zeigt er erst
   beim Überfahren und im Fokus, denn er ist ein Knopf mit Zustands-Ebene.
   Fehlt er, steht gedämpft, was zu tun ist («Ziel hinzufügen»). Ein Klick
   macht ihn an derselben Stelle zum Feld, mit ✓ und ✕ darunter: Enter oder ✓
   speichert, Esc oder ✕ verwirft, wer daneben klickt, speichert ebenfalls.

   Was nicht gilt (`pruefe`), bleibt mit seiner Meldung am Feld stehen und wird
   nicht gespeichert — es ist der Stand, den man berichtigen will.

   Zwei Arten: `text` (mehrzeilig, Shift+Enter bricht um) und `zahl` (ein
   Zahlenfeld; was es nicht als Zahl lesen kann, meldet es als ungültig, statt
   es als «leer» zu speichern). Gespeichert wird beim Aufrufer (`onSpeichern`),
   der auch meldet, was der Server ablehnt. Als Zeile der `Eigenschaften`
   trägt ihn `EigenschaftText`; frei steht er etwa als Dauer an einer Übung im
   Training. */

/** Ob der Fokus nach dem Bearbeiten an den Wert zurückgeht: ja nach Esc,
 *  ✓, ✕ und Enter — die Tastatur soll nicht im Nichts landen —, nein nach einem
 *  Klick daneben, der den Fokus selbst woanders hingetragen hat. */
export function useFokusZurueck(offen: boolean) {
  const knopf = useRef<HTMLButtonElement>(null);
  const zurueck = useRef(false);
  useEffect(() => {
    if (!offen && zurueck.current) knopf.current?.focus();
    zurueck.current = false;
  }, [offen]);
  return { knopf, merke: () => (zurueck.current = true) };
}

/** Der Wert als Knopf, der ihn zum Bearbeiten öffnet. `breit`: Er füllt seine
 *  Spalte (in den Eigenschaften); sonst ist er so breit wie sein Inhalt. Die
 *  Fläche ragt über den Text hinaus, damit dieser selbst mit den übrigen
 *  Werten fluchtet. */
export function WertKnopf({
  label,
  leer,
  onClick,
  knopf,
  breit = true,
  befund = false,
  beschreibung,
  children,
}: {
  label: string;
  leer: boolean;
  onClick: () => void;
  knopf: React.RefObject<HTMLButtonElement | null>;
  breit?: boolean;
  /** Id eines Texts, der den Wert für die Vorlesehilfe näher beschreibt. */
  beschreibung?: string;
  /** Ein Hinweis auf den gespeicherten Wert (etwa eine ungleiche Dauer im
   *  Wechsel) — in der Farbe der Befunde. */
  befund?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      ref={knopf}
      type="button"
      onClick={onClick}
      aria-label={`${label} bearbeiten`}
      aria-describedby={beschreibung}
      className={cn(
        "state focus-ring -mx-2 -my-1 cursor-pointer rounded-flaeche px-2 py-1 text-left",
        breit ? "block w-[calc(100%+1rem)]" : "inline-flex items-center gap-1.5",
        leer && "text-on-surface-mittel",
        befund && "text-error",
      )}
    >
      {children}
    </button>
  );
}

export function InlineWert({
  label,
  wert,
  anzeige,
  leerText,
  art = "text",
  maxLength,
  schritt = 1,
  pruefe,
  befund = false,
  befundText,
  breit = true,
  onSpeichern,
}: {
  /** Name der Angabe — sichtbar steht er daneben, im Feld für die Vorlesehilfe. */
  label: string;
  /** Der gespeicherte Wert als Text, leer ohne Wert. */
  wert: string;
  /** Wie der Wert ruhend aussieht; ohne Angabe der Text selbst. */
  anzeige?: ReactNode;
  leerText: string;
  art?: "text" | "zahl";
  maxLength?: number;
  /** Bei `zahl`: die Schrittweite der Pfeiltasten. */
  schritt?: number;
  /** Was am Entwurf nicht gilt, sonst `null`. `lesbar` ist bei `zahl` falsch,
   *  wenn das Feld die Eingabe nicht als Zahl lesen kann. */
  pruefe?: (entwurf: string, lesbar: boolean) => string | null;
  befund?: boolean;
  /** Der Befund in Worten, für die Vorlesehilfe. */
  befundText?: string;
  breit?: boolean;
  /** Mit dem getrimmten neuen Wert; nur, wenn er sich geändert hat. */
  onSpeichern: (neu: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState(wert);
  const [fehler, setFehler] = useState<string | null>(null);
  const rahmen = useRef<HTMLDivElement>(null);
  const zahlFeld = useRef<HTMLInputElement>(null);
  const fokus = useFokusZurueck(offen);
  const befundId = useId();

  function oeffne() {
    setEntwurf(wert);
    setFehler(null);
    setOffen(true);
  }

  /** Speichern; `false`, wenn der Entwurf nicht gilt und das Feld offen bleibt. */
  function speichere(): boolean {
    const v = zahlFeld.current?.validity;
    const lesbar = !(v && (v.badInput || v.stepMismatch || v.rangeUnderflow));
    const neu = entwurf.trim();
    const problem = pruefe?.(neu, lesbar) ?? null;
    if (problem) {
      setFehler(problem);
      return false;
    }
    setOffen(false);
    if (neu !== wert.trim()) onSpeichern(neu);
    return true;
  }

  /** Schliessen per Taste oder Knopf — der Fokus geht an den Wert zurück. */
  function schliesse(sichern: boolean) {
    if (sichern && !speichere()) return;
    fokus.merke();
    setOffen(false);
  }

  if (!offen) {
    const leer = !wert.trim();
    return (
      <>
        <WertKnopf
          label={label}
          leer={leer}
          onClick={oeffne}
          knopf={fokus.knopf}
          breit={breit}
          befund={!leer && befund}
          beschreibung={befund && befundText ? befundId : undefined}
        >
          {leer ? leerText : (anzeige ?? <span className="whitespace-pre-line">{wert.trim()}</span>)}
        </WertKnopf>
        {befund && befundText && (
          <span id={befundId} className="sr-only">
            {befundText}
          </span>
        )}
      </>
    );
  }

  const tasten = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      schliesse(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      schliesse(false);
    }
  };

  return (
    <div
      ref={rahmen}
      className={cn("relative", !breit && "inline-block")}
      // Wer daneben klickt oder mit Tab hinausgeht, speichert — der Fokus
      // wechselt dabei nicht auf ✓ oder ✕, die selbst zum Rahmen gehören. Gilt
      // der Entwurf nicht, bleibt er mit seiner Meldung stehen.
      onBlur={(e) => {
        if (!rahmen.current?.contains(e.relatedTarget as Node | null)) speichere();
      }}
    >
      {art === "zahl" ? (
        <TextField
          ref={zahlFeld}
          type="number"
          inputMode="numeric"
          min={0}
          step={schritt}
          label={label}
          labelVersteckt
          autoFocus
          autoComplete="off"
          className="w-28"
          value={entwurf}
          onChange={(e) => {
            setEntwurf(e.target.value);
            if (fehler) setFehler(null);
          }}
          onKeyDown={tasten}
          error={!!fehler}
          supportingText={fehler ?? undefined}
        />
      ) : (
        <TextArea
          label={label}
          labelVersteckt
          autoFocus
          rows={2}
          maxLength={maxLength}
          value={entwurf}
          onChange={(e) => {
            setEntwurf(e.target.value);
            if (fehler) setFehler(null);
          }}
          onKeyDown={tasten}
          error={!!fehler}
          supportingText={fehler ?? undefined}
        />
      )}
      {/* ✓ und ✕ liegen auf einer eigenen Fläche unter dem Feld, rechts —
          sie überdecken, was darunter steht, statt es wegzuschieben. */}
      <div
        // Das Drücken holt den Fokus nicht aus dem Feld: Sonst speicherte
        // das Verlassen schon, bevor ✕ verwerfen kann (Safari gibt Knöpfen
        // beim Klick keinen Fokus, `relatedTarget` wäre leer).
        onMouseDown={(e) => e.preventDefault()}
        className="absolute right-0 top-full z-10 mt-1 flex gap-1 rounded-flaeche bg-elev-08 p-0.5 shadow-dp-08"
      >
        <IconButton icon={Check} label="Speichern" onClick={() => schliesse(true)} />
        <IconButton icon={X} label="Abbrechen" onClick={() => schliesse(false)} />
      </div>
    </div>
  );
}
