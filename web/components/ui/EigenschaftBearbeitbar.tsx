"use client";

import { useState, type ReactNode } from "react";
import { Eigenschaft } from "./Eigenschaften";
import { InlineWert, WertKnopf, useFokusZurueck } from "./InlineWert";
import { MultiSelect } from "./MultiSelect";
import type { SelectOption } from "./Select";

/* ── Bearbeitbare Eigenschaft ─────────────────────────────────
   Eine Zeile der `Eigenschaften`, die man dort ändert, wo man sie liest —
   nach dem Vorbild der Details in Jira (Epic #364, zuerst in den Eigenschaften
   eines Trainings, #370).

   Ruhend sieht sie aus wie jede andere Zeile: Bezeichnung links, Wert rechts.
   Ein Klick verwandelt den Wert in das Feld, an derselben Stelle in der
   Wertspalte; die Bezeichnung bleibt links stehen und ist darum im Feld nur
   für die Vorlesehilfe da.

   Zwei Ausprägungen, je nach Art der Angabe:
   - `EigenschaftText`: Freitext mit ✓ und ✕ darunter (`InlineWert`).
   - `EigenschaftAuswahl`: Mehrfachauswahl, deren Liste beim Klick sofort
     aufgeht. Jede Wahl speichert für sich; schliesst die Liste, steht wieder
     der Wert da.

   Gespeichert wird beim Aufrufer (`onSpeichern`, `onChange`); der meldet auch,
   was nicht ging. */

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
  return (
    <Eigenschaft label={label}>
      <InlineWert
        label={label}
        wert={wert}
        leerText={leerText}
        maxLength={maxLength}
        onSpeichern={onSpeichern}
      />
    </Eigenschaft>
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
  /** Wie der Wert ruhend aussieht, etwa als Kategorie-Lozenges. */
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
    <Eigenschaft label={label}>
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
    </Eigenschaft>
  );
}
