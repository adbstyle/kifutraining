"use client";

import { useEffect, useRef, useState } from "react";

/* Getippter Wert mit verzögerter Übernahme. Getrennt vom Feld gehalten, weil
   die Verzögerung keine Eigenschaft des Feldes ist, sondern des Vorgangs
   dahinter: die Filterzeilen schreiben erst nach der Tipppause in die URL und
   lösen damit eine neue Server-Abfrage aus — sonst je Tastendruck eine.

   Rückgabe: der anzuzeigende Wert und der Setzer fürs onChange.

     const [wert, aendern] = useDebouncedWert(filters.q ?? "", (v) => setScalar("q", v));
     <TextField dense value={wert} onChange={(e) => aendern(e.target.value)} … /> */
export function useDebouncedWert(
  initial: string,
  onCommit: (wert: string) => void,
  ms = 300,
): [string, (wert: string) => void] {
  const [wert, setWert] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Der zuletzt nach aussen übernommene Wert — nur um sein Echo zu erkennen. */
  const gesendet = useRef<string | null>(null);

  // Änderungen von aussen (Zurücksetzen, Zurück-Navigation) spiegeln — und dabei
  // einen noch laufenden Timer abräumen: sonst schriebe er kurz darauf den
  // überholten Tippstand zurück (z. B. „Zurücksetzen" innerhalb der Tipppause).
  // Ausgenommen ist das Echo der eigenen Übernahme: trägt der Wert von aussen
  // genau das, was wir zuletzt geschickt haben, während schon weitergetippt
  // wird, bleiben der neue Tippstand und sein Timer stehen.
  useEffect(() => {
    if (timer.current && initial === gesendet.current) return;
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
      gesendet.current = neu;
      onCommit(neu);
    }, ms);
  }

  return [wert, aendern];
}
