"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { darstellungCookie, type Darstellung } from "@/lib/darstellung";

/* Gewählte Darstellung (#567): Die Seitenleiste zeigt und ändert sie, die
   Marke darunter setzt sie durch. Wohnt im `(app)`-Layout wie
   VersionenKontext; den Anfang liefert der Server aus dem Cookie.

   Umschalten tauscht nur die Marke und schreibt das Cookie — keine
   Navigation, kein Neuladen. Darum bleibt alles Ungespeicherte auf der
   Seite stehen. */

interface DarstellungWert {
  darstellung: Darstellung;
  waehle: (darstellung: Darstellung) => void;
}

const DarstellungKontext = createContext<DarstellungWert>({
  darstellung: "geraet",
  waehle: () => {},
});

/** Die Marke, nach der `globals.css` das `color-scheme` wählt
 *  (`:root:has([data-darstellung=…])`). «Wie das Gerät» setzt keine: Dann
 *  gilt die Vorgabe auf `:root`. Ohne Hooks, damit auch Server-Layouts sie
 *  setzen können (Anmeldeseiten). */
export function DarstellungsMarke({ darstellung }: { darstellung: Darstellung }) {
  return darstellung === "geraet" ? null : <span hidden data-darstellung={darstellung} />;
}

export function DarstellungProvider({
  anfang,
  children,
}: {
  anfang: Darstellung;
  children: React.ReactNode;
}) {
  const [darstellung, setzeDarstellung] = useState(anfang);
  // Das Layout bleibt beim Ab- und Anmelden stehen, rendert aber neu: Dann
  // gilt, was der Server jetzt liefert (anonym immer hell, #569).
  const [vorgabe, setzeVorgabe] = useState(anfang);
  if (anfang !== vorgabe) {
    setzeVorgabe(anfang);
    setzeDarstellung(anfang);
  }
  const waehle = useCallback((neu: Darstellung) => {
    document.cookie = darstellungCookie(neu);
    setzeDarstellung(neu);
  }, []);

  return (
    <DarstellungKontext.Provider value={{ darstellung, waehle }}>
      <DarstellungsMarke darstellung={darstellung} />
      {children}
    </DarstellungKontext.Provider>
  );
}

export function useDarstellung(): DarstellungWert {
  return useContext(DarstellungKontext);
}
