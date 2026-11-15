"use client";

import { useEffect, useRef, useState } from "react";

/* Getippter Wert mit verzögerter Übernahme. Getrennt vom Feld gehalten, weil
   die Verzögerung keine Eigenschaft des Feldes ist, sondern des Vorgangs
   dahinter: die Filterzeilen schreiben erst nach der Tipppause in die URL und
   lösen damit eine neue Server-Abfrage aus — sonst je Tastendruck eine.

   Rückgabe: der anzuzeigende Wert und der Setzer fürs onChange.

   `bereinige` sagt, wie der übernommene Wert von aussen zurückkommt — so,
   wie die Seite ihn bereinigt (der Katalog trimmt, die Vereinsliste
   bereinigt wie die Datenebene; ohne Angabe kommt er unverändert zurück).
   Daran erkennt der Hook das Echo der eigenen Übernahme: «Lea » geht als
   «Lea» in die Adresse und kommt so zurück; das ist kein Wert von aussen,
   und das Feld behält, was getippt ist (auch das Leerzeichen, hinter dem
   gleich weitergetippt wird).

     const [wert, aendern] = useDebouncedWert(filters.q ?? "", (v) => setScalar("q", v), (v) => v.trim());
     <TextField value={wert} onChange={(e) => aendern(e.target.value)} … /> */
export function useDebouncedWert(
  initial: string,
  onCommit: (wert: string) => void,
  bereinige: (wert: string) => string = (v) => v,
  ms = 300,
): [string, (wert: string) => void] {
  const [wert, setWert] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Das erwartete Echo der letzten Übernahme (bereinigt); `null`, wenn keines aussteht. */
  const echo = useRef<string | null>(null);
  /** Der Wert von aussen, wie er gerade steht — für den Timer, der später feuert. */
  const aussen = useRef(initial);

  // Änderungen von aussen (Zurücksetzen, Zurück-Navigation) spiegeln — und dabei
  // einen noch laufenden Timer abräumen: sonst schriebe er kurz darauf den
  // überholten Tippstand zurück (z. B. „Zurücksetzen" innerhalb der Tipppause).
  // Ausgenommen ist das Echo der eigenen Übernahme: Es überschreibt nie, was
  // im Feld steht, ob schon weitergetippt wird oder nicht.
  useEffect(() => {
    aussen.current = initial;
    if (echo.current !== null && initial === echo.current) {
      echo.current = null;
      return;
    }
    echo.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setWert(initial);
  }, [initial]);

  // Beim Unmount den laufenden Timer verwerfen — sonst schriebe er in die URL,
  // nachdem die Zeile längst weg ist.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function aendern(neu: string) {
    setWert(neu);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      // Bereinigt gleich wie das, was schon draussen steht: Es kommt kein
      // neuer Wert zurück, also wird auch kein Echo erwartet.
      const zurueck = bereinige(neu);
      echo.current = zurueck === aussen.current ? null : zurueck;
      onCommit(neu);
    }, ms);
  }

  return [wert, aendern];
}
