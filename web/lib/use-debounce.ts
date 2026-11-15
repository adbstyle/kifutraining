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
  /** Was im Feld steht — für den Vergleich, wenn ein Wert von aussen kommt. */
  const wertRef = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Das Echo der letzten Übernahme (bereinigt); `null`, wenn keines aussteht. */
  const echo = useRef<string | null>(null);

  // Ein Wert von aussen (Zurücksetzen, Zurück-Navigation, Echo):
  // 1. Das Echo der letzten Übernahme, während schon weitergetippt wird:
  //    Feld und Timer bleiben stehen, der Timer übernimmt gleich selbst.
  // 2. Sagt das Feld bereinigt schon dasselbe, bleibt es, wie es ist (etwa
  //    «Lea » beim Echo «Lea»: das Leerzeichen, hinter dem gleich
  //    weitergetippt wird).
  // 3. Sonst gilt der Wert von aussen, und ein laufender Timer wird
  //    abgeräumt — er schriebe sonst den überholten Tippstand zurück (z. B.
  //    «Zurücksetzen» innerhalb der Tipppause).
  // Ein liegengebliebenes Echo (seine Navigation wurde von einer anderen
  // verworfen) verschluckt so keine echte Änderung: Ohne laufenden Timer
  // entscheidet allein der Vergleich mit dem Feld.
  useEffect(() => {
    const eigenesEcho = echo.current !== null && initial === echo.current;
    echo.current = null;
    if (eigenesEcho && timer.current) return;
    if (bereinige(wertRef.current) === initial) return;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    wertRef.current = initial;
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
    wertRef.current = neu;
    setWert(neu);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      echo.current = bereinige(neu);
      onCommit(neu);
    }, ms);
  }

  return [wert, aendern];
}
