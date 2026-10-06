"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { gesehenCookie, spaeter } from "@/lib/versionen-gesehen";

/* Neue Releases (#410), über die einzelne Seite hinaus: Die Seitenleiste
   fragt, ob etwas neu ist, die Seite «Versionen» meldet, was sie angezeigt
   hat. Wohnt im `(app)`-Layout wie TeamKontext und SnackbarKontext.

   Den Anfang liefert der Server (neuester Release, Cookie). Weil das Layout
   bei einer Client-Navigation nicht neu rendert, fragt der Kontext beim
   Seitenwechsel höchstens einmal pro Minute nach, wann der neueste Release
   erschien — so ändert sich die Markierung beim nächsten Seitenwechsel, nie
   in einer offenen Seite. */

const NACHFRAGE_ABSTAND_MS = 60 * 1000;

interface VersionenWert {
  /** Ist ein Release erschienen, den dieser Browser nicht gesehen hat? */
  neu: boolean;
  /** Die Seite «Versionen» hat Releases bis zu diesem Zeitpunkt angezeigt. */
  merkeGesehen: (iso: string) => void;
}

const VersionenKontext = createContext<VersionenWert>({ neu: false, merkeGesehen: () => {} });

export function VersionenProvider({
  anfangsNeueste,
  anfangsGesehen,
  children,
}: {
  anfangsNeueste: string | null;
  anfangsGesehen: string | null;
  children: React.ReactNode;
}) {
  const [neueste, setzeNeueste] = useState(anfangsNeueste);
  const [gesehen, setzeGesehen] = useState(anfangsGesehen);
  const gesehenRef = useRef(anfangsGesehen);
  const pfad = usePathname();
  const zuletztGefragt = useRef(Date.now());

  const merkeGesehen = useCallback((iso: string) => {
    const bisher = gesehenRef.current;
    if (bisher && !spaeter(iso, bisher)) return;
    gesehenRef.current = iso;
    document.cookie = gesehenCookie(iso);
    setzeGesehen(iso);
  }, []);

  // Erster Besuch (kein Cookie): Was bis jetzt erschienen ist, gilt als bekannt.
  useEffect(() => {
    if (neueste && !gesehen) merkeGesehen(neueste);
  }, [neueste, gesehen, merkeGesehen]);

  useEffect(() => {
    if (Date.now() - zuletztGefragt.current < NACHFRAGE_ABSTAND_MS) return;
    zuletztGefragt.current = Date.now();
    fetch("/api/versionen")
      .then((a) => (a.ok ? a.json() : null))
      .then((d: { neueste: string | null } | null) => d?.neueste && setzeNeueste(d.neueste))
      .catch(() => {});
  }, [pfad]);

  return (
    <VersionenKontext.Provider value={{ neu: spaeter(neueste, gesehen), merkeGesehen }}>
      {children}
    </VersionenKontext.Provider>
  );
}

export function useVersionen(): VersionenWert {
  return useContext(VersionenKontext);
}
