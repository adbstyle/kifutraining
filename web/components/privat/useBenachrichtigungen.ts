"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  benachrichtigungCookie,
  leseGesehenStand,
  mitGesehen,
  wertAusCookieString,
} from "@/lib/benachrichtigung-gesehen";
import { neuZahl, type LinkBenachrichtigungen } from "@/lib/benachrichtigung";

const PARAMETER = "ansicht";
const ANSICHT = "benachrichtigungen";

/* Der Zustand der Benachrichtigungen am privaten Link (#642): Ist die Ansicht
   offen, wie viele sind noch nicht angezeigt, und was heisst «neu» in der
   offenen Ansicht.

   OFFEN steht in der Adresse (`?ansicht=benachrichtigungen`): Die Rück-Taste
   des Telefons führt aus der Ansicht zurück zu den Terminen, und ein Neuladen
   bleibt dort. Der Server kennt die Adresse und rendert dieselbe Ansicht wie
   der Browser.

   GESEHEN rechnet der Server aus dem Cookie (`gesehenBis`) und der Browser
   aus denselben Props — beim ersten Rendern zeigt der Browser nichts, was nur
   er weiss (Hydration). Geschrieben wird das Cookie nur im Browser, in
   `useEffect`: (a) Erstanzeige — kennt das Gerät den Link nicht, gilt alles
   Bisherige als gesehen; (b) die Ansicht wurde gezeigt — bis zur neuesten
   gezeigten Benachrichtigung, bei leerer Liste bis `jetzt`. Es sinkt nie.

   «NEU» in der offenen Ansicht hält den Stand vom Öffnen fest (`neuSeit`),
   damit die Einträge nicht verschwinden, kaum dass man sie sieht — auch nicht
   über `router.refresh()`. */
export function useBenachrichtigungen({
  daten,
  gesehenBis,
  schluessel,
}: {
  daten: LinkBenachrichtigungen | null;
  gesehenBis: number | null;
  schluessel: string;
}) {
  const parameter = useSearchParams().get(PARAMETER);
  const offen = daten !== null && parameter === ANSICHT;
  // Was der Browser selbst geschrieben hat; der Server liest es erst beim nächsten Laden.
  const [lokal, setLokal] = useState<number | null>(null);
  const gesehen = lokal === null ? gesehenBis : Math.max(lokal, gesehenBis ?? -1);
  const [neuSeit, setNeuSeit] = useState<number | null>(offen ? gesehen : null);
  const [warOffen, setWarOffen] = useState(offen);
  if (offen !== warOffen) {
    setWarOffen(offen);
    if (offen) setNeuSeit(gesehen);
  }
  // Hier geöffnet (pushState): Schliessen geht zurück statt eine zweite Adresse zu stapeln.
  const hierGeoeffnet = useRef(false);

  const merke = useCallback(
    (ms: number) => {
      const wert = wertAusCookieString(document.cookie);
      const neu = mitGesehen(wert, schluessel, ms);
      document.cookie = benachrichtigungCookie(neu);
      setLokal(leseGesehenStand(neu, schluessel));
    },
    [schluessel],
  );

  // (a) Erstanzeige: Das Gerät kennt den Link nicht.
  const jetzt = daten?.jetzt;
  useEffect(() => {
    if (jetzt === undefined) return;
    if (leseGesehenStand(wertAusCookieString(document.cookie), schluessel) === null) merke(jetzt);
  }, [jetzt, schluessel, merke]);

  // (b) Die Ansicht wird gezeigt.
  const neuesteGezeigt = daten ? (daten.eintraege[0]?.erstellt ?? daten.jetzt) : null;
  useEffect(() => {
    if (offen && neuesteGezeigt !== null) merke(neuesteGezeigt);
  }, [offen, neuesteGezeigt, merke]);

  const oeffnen = useCallback(() => {
    hierGeoeffnet.current = true;
    const url = new URL(window.location.href);
    url.searchParams.set(PARAMETER, ANSICHT);
    window.history.pushState(null, "", url);
  }, []);

  const schliessen = useCallback(() => {
    if (hierGeoeffnet.current) {
      hierGeoeffnet.current = false;
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(PARAMETER);
    window.history.replaceState(null, "", url);
  }, []);

  return {
    offen,
    /** Wie viele dieses Gerät noch nicht angezeigt hat; 0 ohne Daten. */
    neu: daten ? neuZahl(daten.eintraege, gesehen) : 0,
    /** Was in der offenen Ansicht als neu gilt. */
    neuSeit,
    oeffnen,
    schliessen,
  };
}
