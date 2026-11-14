"use client";

import { useId } from "react";
import { SectionMessage } from "./SectionMessage";
import { TextField } from "./TextField";

/** Stimmt die Eingabe mit dem verlangten Namen überein? Genau, mit Gross- und
 *  Kleinschreibung; Leerzeichen am Rand und die Unicode-Normalform zählen nicht
 *  (#480 AK 6, 7). Dieselbe Regel wiederholt die Datenebene beim Ausführen —
 *  die Oberfläche gibt den Knopf nur frei, entscheidet aber nichts. */
export function namenStimmen(eingabe: string, name: string): boolean {
  return eingabe.trim().normalize("NFC") === name.normalize("NFC");
}

/* Die Bestätigung einer unwiderruflichen Handlung durch Eingabe des Namens
   (#480): ein Absatz, der den verlangten Namen nennt, das Feld und die
   Meldung des Servers. Gedacht für den Inhalt eines Dialogs — Titel, Folgenliste
   und den Knopf, der erst bei `namenStimmen` frei wird, stellt die Stelle, die
   den Baustein verwendet.

   Die Eingabe verfälscht nichts von selbst: keine Autokorrektur, keine
   automatische Grossschreibung, keine Rechtschreibprüfung (NFR 1). Einfügen
   bleibt erlaubt (AK 8). Die Vorlesehilfe hört den verlangten Namen mit dem
   Feld (`aria-describedby`) und erfährt über eine Live-Region, wann die
   Eingabe stimmt (NFR 3). Das Feld steht im Formular des Dialogs, damit Enter
   die Handlung auslöst, sobald der Knopf frei ist. */
export function NamenBestaetigen({
  name,
  wert,
  onChange,
  label,
  fehler,
}: {
  /** Der Name, der einzugeben ist. */
  name: string;
  wert: string;
  onChange: (wert: string) => void;
  /** Beschriftung des Felds, z. B. «Teamname». */
  label: string;
  /** Meldung vom Server, z. B. weil der Name sich inzwischen geändert hat. */
  fehler?: string | null;
}) {
  const anleitungId = useId();
  const passt = namenStimmen(wert, name);

  return (
    <div className="flex flex-col gap-3">
      {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
      <p id={anleitungId}>
        Gib zur Bestätigung den Namen «<span className="select-all font-medium text-on-surface">{name}</span>» ein.
      </p>
      <TextField
        label={label}
        value={wert}
        onChange={(e) => onChange(e.target.value)}
        enterKeyHint="go"
        aria-describedby={anleitungId}
        autoFocus
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        // Passwort-Manager halten das Feld sonst für ein Login-Feld.
        data-1p-ignore
        data-lpignore="true"
      />
      {/* Dauerhaft im DOM, damit die Vorlesehilfe die Änderung ansagt. */}
      <span className="sr-only" role="status">
        {passt ? "Der Name stimmt. Die Handlung ist freigegeben." : ""}
      </span>
    </div>
  );
}
