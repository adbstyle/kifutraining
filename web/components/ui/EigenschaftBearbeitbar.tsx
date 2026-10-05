"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";
import { MultiSelect } from "./MultiSelect";
import { TextArea } from "./TextArea";
import type { SelectOption } from "./Select";

/* ── Bearbeitbare Eigenschaft ─────────────────────────────────
   Eine Zeile der `Eigenschaften`, die man dort ändert, wo man sie liest —
   nach dem Vorbild der Details in Jira (Epic #364, zuerst in den Eigenschaften
   eines Trainings, #370).

   Ruhend sieht sie aus wie jede andere Zeile: Bezeichnung links, Wert rechts.
   Dass sie sich ändern lässt, zeigt der Wert erst beim Überfahren und im
   Fokus — er ist ein Knopf mit Zustands-Ebene. Fehlt der Wert, steht an
   seiner Stelle gedämpft, was zu tun ist («Ziel hinzufügen»). Ein Klick
   verwandelt den Wert in das Feld, an derselben Stelle in der Wertspalte; die
   Bezeichnung bleibt links stehen und ist darum im Feld nur für die
   Vorlesehilfe da.

   Zwei Ausprägungen, je nach Art der Angabe:
   - `EigenschaftText`: Freitext mit ✓ und ✕ darunter. Enter oder ✓ speichert,
     Esc oder ✕ verwirft; wer daneben klickt, speichert ebenfalls — wie Jira.
     Shift+Enter bricht die Zeile um.
   - `EigenschaftAuswahl`: Mehrfachauswahl, deren Liste beim Klick sofort
     aufgeht. Jede Wahl speichert für sich; schliesst die Liste, steht wieder
     der Wert da.

   Gespeichert wird beim Aufrufer (`onSpeichern`, `onChange`); der meldet auch,
   was nicht ging. */

/** Ob der Fokus nach dem Bearbeiten an den Wert zurückgeht: ja nach Esc,
 *  ✓, ✕ und Enter — die Tastatur soll nicht im Nichts landen —, nein nach einem
 *  Klick daneben, der den Fokus selbst woanders hingetragen hat. */
function useFokusZurueck(offen: boolean) {
  const knopf = useRef<HTMLButtonElement>(null);
  const zurueck = useRef(false);
  useEffect(() => {
    if (!offen && zurueck.current) knopf.current?.focus();
    zurueck.current = false;
  }, [offen]);
  return { knopf, merke: () => (zurueck.current = true) };
}

/** Der Wert als Knopf, der die Zeile zum Bearbeiten öffnet. */
function WertKnopf({
  label,
  leer,
  onClick,
  knopf,
  children,
}: {
  label: string;
  leer: boolean;
  onClick: () => void;
  knopf: React.RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  return (
    <button
      ref={knopf}
      type="button"
      onClick={onClick}
      aria-label={`${label} bearbeiten`}
      // Die Fläche ragt links und rechts über die Wertspalte hinaus, damit
      // der Text selbst mit den übrigen Werten fluchtet.
      className={cn(
        "state focus-ring -mx-2 -my-1 block w-[calc(100%+1rem)] cursor-pointer rounded-flaeche px-2 py-1 text-left",
        leer && "text-on-surface-mittel",
      )}
    >
      {children}
    </button>
  );
}

function Zeile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="type-body-medium text-on-surface-mittel">{label}</dt>
      <dd className="type-body-medium min-w-0 text-on-surface">{children}</dd>
    </div>
  );
}

export function EigenschaftText({
  label,
  wert,
  leerText,
  maxLength,
  onSpeichern,
}: {
  label: string;
  wert: string;
  /** Was ohne Wert an seiner Stelle steht, etwa «Ziel hinzufügen». */
  leerText: string;
  maxLength?: number;
  /** Mit dem getrimmten neuen Wert; nur, wenn er sich geändert hat. */
  onSpeichern: (neu: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [entwurf, setEntwurf] = useState(wert);
  const rahmen = useRef<HTMLDivElement>(null);
  const fokus = useFokusZurueck(offen);

  function oeffne() {
    setEntwurf(wert);
    setOffen(true);
  }

  /** Schliessen per Taste oder Knopf — der Fokus geht an den Wert zurück. */
  function schliesse(sichern: boolean) {
    fokus.merke();
    if (sichern) speichere();
    else setOffen(false);
  }

  function speichere() {
    setOffen(false);
    const neu = entwurf.trim();
    if (neu !== wert.trim()) onSpeichern(neu);
  }

  if (!offen)
    return (
      <Zeile label={label}>
        <WertKnopf label={label} leer={!wert.trim()} onClick={oeffne} knopf={fokus.knopf}>
          <span className="whitespace-pre-line">{wert.trim() || leerText}</span>
        </WertKnopf>
      </Zeile>
    );

  return (
    <Zeile label={label}>
      <div
        ref={rahmen}
        className="relative"
        // Wer daneben klickt oder mit Tab hinausgeht, speichert — der Fokus
        // wechselt dabei nicht auf ✓ oder ✕, die selbst zum Rahmen gehören.
        onBlur={(e) => {
          if (!rahmen.current?.contains(e.relatedTarget as Node | null)) speichere();
        }}
      >
        <TextArea
          label={label}
          labelVersteckt
          autoFocus
          rows={2}
          maxLength={maxLength}
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              schliesse(true);
            } else if (e.key === "Escape") {
              e.preventDefault();
              schliesse(false);
            }
          }}
        />
        {/* ✓ und ✕ liegen auf einer eigenen Fläche unter dem Feld, rechts —
            sie überdecken die nächste Zeile, statt sie wegzuschieben. */}
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
    </Zeile>
  );
}

export function EigenschaftAuswahl({
  label,
  options,
  wert,
  anzeige,
  leerText,
  onChange,
  zusatz,
}: {
  label: string;
  options: SelectOption[];
  wert: string[];
  /** Wie der Wert ruhend aussieht, etwa als Kategorie-Plaketten. */
  anzeige: ReactNode;
  leerText: string;
  /** Bei jeder Wahl — gespeichert wird sofort. */
  onChange: (next: string[]) => void;
  /** Was zur Angabe gehört, aber nicht in die Zeile — etwa ein Dialog, der
   *  nach dem Speichern nachfragt. Steht in der Wertzelle, denn eine
   *  Beschreibungsliste nimmt nur Bezeichnung und Wert auf. */
  zusatz?: ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const fokus = useFokusZurueck(offen);

  return (
    <Zeile label={label}>
      {offen ? (
        <MultiSelect
          label={label}
          labelVersteckt
          options={options}
          value={wert}
          onChange={onChange}
          searchable={false}
          actions={false}
          anfangsOffen
          onListeZu={(perTaste) => {
            if (perTaste) fokus.merke();
            setOffen(false);
          }}
        />
      ) : (
        <WertKnopf
          label={label}
          leer={wert.length === 0}
          onClick={() => setOffen(true)}
          knopf={fokus.knopf}
        >
          {wert.length > 0 ? anzeige : leerText}
        </WertKnopf>
      )}
      {zusatz}
    </Zeile>
  );
}
