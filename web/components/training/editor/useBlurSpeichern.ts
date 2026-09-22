"use client";

import { useRef, useState } from "react";

/**
 * Ein Feld, das beim Verlassen speichert — die Mechanik dahinter, einmal.
 *
 * Zwei Felder im Editor arbeiten so: die Notiz an einer Übung (#152) und der
 * Name des Trainings im Kopf (#250). Beide brauchen dieselben drei Schranken,
 * und jede einzelne davon ist ein Fehler, den man sonst zweimal macht:
 *
 * 1. Der EINGETIPPTE Text lebt lokal, damit das Feld beim Tippen nicht auf den
 *    Serverstand zurückspringt.
 * 2. Ein unveränderter Text ist kein Speichervorgang — sonst schriebe jedes
 *    Vorbeitabben in die Datenbank —, und derselbe Text kein zweiter Auftrag.
 *    Das merkt sich ein Ref und nicht ein State: Die Schranke muss schon beim
 *    nächsten Aufruf gelten, nicht erst beim nächsten Rendern.
 * 3. Ändert sich der Wert von AUSSEN — nach einer Rücknahme durch den Server
 *    oder durch frische Serverdaten —, gilt er und nicht mehr, was im Feld
 *    steht.
 *
 * Was ein gültiger Wert ist, bleibt beim Aufrufer (`pruefe`): Die Notiz darf
 * leer sein und heisst dann «keine Notiz», ein Trainingsname darf es nicht.
 * Geteilt wird die Technik, nicht die Regel — dieselbe Trennung wie zwischen
 * `BezeichnungDialog` und `bezeichnungProblem`.
 *
 * Beim Verlassen steht am Ende immer der getrimmte Wert im Feld: Was gilt, ist
 * auch das, was zu sehen ist.
 *
 * Ein abgewiesener Wert fällt auf den zuletzt gesehenen zurück und meldet sich
 * über `onFehler`. Der Fokus bleibt dabei nicht am Feld hängen (#250 Entscheid
 * 3): Wer das Feld verlässt, will weiter — Tastatur und Vorlesehilfe dürfen
 * dabei nicht festgehalten werden.
 */
export function useBlurSpeichern({
  wert,
  pruefe,
  speichere,
  onFehler,
}: {
  /** Der zuletzt bestätigte Wert — die Wahrheit, wenn das Feld nichts Gültiges
   *  hergibt. */
  wert: string;
  /** Was dem getrimmten Wert im Weg steht; `null` heisst gültig. Ohne Angabe
   *  ist jeder Wert gültig. */
  pruefe?: (getrimmt: string) => string | null;
  /** Speichert den getrimmten Wert. Persistiert der Aufrufer. */
  speichere: (getrimmt: string) => void;
  /** Die Meldung zu einem abgewiesenen Wert. */
  onFehler?: (meldung: string) => void;
}): {
  entwurf: string;
  setEntwurf: (next: string) => void;
  beiVerlassen: () => void;
} {
  const [entwurf, setEntwurfIntern] = useState(wert);
  const gesendet = useRef<string | undefined>(undefined);
  const [gesehen, setGesehen] = useState(wert);

  if (wert !== gesehen) {
    setGesehen(wert);
    setEntwurfIntern(wert);
    gesendet.current = undefined;
  }

  function setEntwurf(next: string) {
    setEntwurfIntern(next);
    // Wer weiterschreibt, hebt die Schranke auf: Derselbe Text darf danach
    // erneut hinaus — etwa, wenn der Server ihn zwischenzeitlich zurücknahm.
    gesendet.current = undefined;
  }

  function beiVerlassen() {
    const getrimmt = entwurf.trim();
    const problem = pruefe?.(getrimmt) ?? null;
    if (problem) {
      setEntwurfIntern(wert);
      gesendet.current = undefined;
      onFehler?.(problem);
      return;
    }
    // Der getrimmte Wert ist der, der gilt — also steht er auch im Feld. Ohne
    // diese Zeile bliebe eine Eingabe, die sich vom gespeicherten Wert NUR in
    // umgebenden Leerzeichen unterscheidet, für immer so stehen: Gespeichert
    // wird sie zu Recht nicht, und weil `wert` sich dabei nicht ändert, greift
    // auch die Rücknahme oben nie.
    setEntwurfIntern(getrimmt);
    if (getrimmt === wert || getrimmt === gesendet.current) return;
    gesendet.current = getrimmt;
    speichere(getrimmt);
  }

  return { entwurf, setEntwurf, beiVerlassen };
}
