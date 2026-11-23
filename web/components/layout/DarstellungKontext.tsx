"use client";

import { createContext, useCallback, useContext, useState, useSyncExternalStore } from "react";
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
  /** Kann dieser Browser umschalten? Ohne `light-dark()` (Safari vor 17.5)
   *  gilt fest der helle Ersatz aus globals.css — eine Wahl bewirkte nichts. */
  umschaltbar: boolean;
}

const DarstellungKontext = createContext<DarstellungWert>({
  darstellung: "geraet",
  waehle: () => {},
  umschaltbar: false,
});

const nieAenderung = () => () => {};
const kannLightDark = () => CSS.supports("color", "light-dark(#000, #fff)");
/** Auf dem Server wird angenommen, dass es geht — so fehlt die Zeile im
 *  ersten HTML nicht und verschwindet nur dort, wo es nicht geht. */
const amServer = () => true;

/** Die Marke, nach der `globals.css` das `color-scheme` wählt
 *  (`:root:has([data-darstellung=…])`). «Wie das Gerät» setzt keine: Dann
 *  gilt die Vorgabe auf `:root`. Ohne Hooks, damit auch Server-Layouts sie
 *  setzen können (Anmeldeseiten). */
export function DarstellungsMarke({ darstellung }: { darstellung: Darstellung }) {
  return darstellung === "geraet" ? null : <span hidden data-darstellung={darstellung} />;
}

export function DarstellungProvider({
  wahl: wahlVomServer,
  anonym,
  children,
}: {
  /** Die gespeicherte Wahl aus dem Cookie. */
  wahl: Darstellung;
  /** Ohne Anmeldung tritt KiFu nach aussen immer hell auf (#569). */
  anonym: boolean;
  children: React.ReactNode;
}) {
  const [wahl, setzeWahl] = useState(wahlVomServer);
  // Das Layout bleibt beim Ab- und Anmelden stehen, rendert aber neu. Nur
  // dann gilt wieder das Cookie: Bei jedem anderen Neurendern (Server Action,
  // revalidatePath) könnte der Server noch das Cookie von vor dem Umschalten
  // gelesen haben und die eben getroffene Wahl zurückdrehen.
  const [warAnonym, setzeWarAnonym] = useState(anonym);
  if (anonym !== warAnonym) {
    setzeWarAnonym(anonym);
    setzeWahl(wahlVomServer);
  }
  const waehle = useCallback((neu: Darstellung) => {
    document.cookie = darstellungCookie(neu);
    setzeWahl(neu);
  }, []);
  const darstellung = anonym ? "hell" : wahl;
  const umschaltbar = useSyncExternalStore(nieAenderung, kannLightDark, amServer);

  return (
    <DarstellungKontext.Provider value={{ darstellung, waehle, umschaltbar }}>
      <DarstellungsMarke darstellung={darstellung} />
      {children}
    </DarstellungKontext.Provider>
  );
}

export function useDarstellung(): DarstellungWert {
  return useContext(DarstellungKontext);
}
