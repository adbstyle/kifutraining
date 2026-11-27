"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing } from "lucide-react";
import { Button, KopierFeld, SectionMessage } from "@/components/ui";
import {
  ANGEBOT_ALTER_SPEICHER,
  ANGEBOT_SPEICHER,
  ANGEBOT_TEXT,
  angebotFuer,
  angebotJetzt,
  mitAbgelehnt,
  mitGezeigt,
  type AngebotArt,
} from "@/lib/angebot";
import type { MitteilungenStand } from "@/lib/push";
import type { AblageLage } from "./AppAblegen";

/* Das Angebot am privaten Link (#698): im Moment des Nutzens Mitteilungen
   einschalten und die Seite als App ablegen. Die Regeln stehen rein in
   lib/angebot.ts; hier der Speicher des Browsers und die Karte.

   Ein Anlass (`ausloesen`) setzt den Ort: die Kennung eines Termins — nach
   einer Ab- oder Anmeldung oder bei einem noch nicht gesehenen Ausfall
   steht die Karte unter ihm — oder «oben» in der abgelegten App. Höchstens
   ein Angebot je Besuch; es bleibt, bis man es ablehnt, die Mitteilungen
   einschaltet oder die Seite verlässt. */

export const OBEN = "oben";

/** Lesen und Schreiben im lokalen Speicher; gesperrt (privates Surfen,
 *  Einstellungen) gilt er als leer und bleibt ungeschrieben — das Angebot
 *  kommt dann höchstens einmal je Seitenaufruf. */
function lies(): string | null {
  try {
    return window.localStorage.getItem(ANGEBOT_SPEICHER);
  } catch {
    return null;
  }
}
function schreibe(wert: string) {
  try {
    window.localStorage.setItem(ANGEBOT_SPEICHER, wert);
  } catch {
    // Ohne Speicher merkt sich dieses Gerät nichts.
  }
}

export function useAngebot({ schluessel, lage, mitteilungen }: { schluessel: string; lage: AblageLage | null; mitteilungen: MitteilungenStand }) {
  const [angebot, setAngebot] = useState<{ ort: string; art: AngebotArt } | null>(null);
  // Schon ein Angebot auf diesem Seitenaufruf: kein zweites (AK 1).
  const gezeigt = useRef(false);
  // Der Anlass nach dem Melden kommt erst nach der Antwort des Servers: Er
  // liest Gerät und Stand von dann, nicht vom Klick.
  const aktuell = useRef({ lage, mitteilungen });
  useEffect(() => {
    aktuell.current = { lage, mitteilungen };
  }, [lage, mitteilungen]);

  // Der Hinweis zum Ablegen (#650) zählt nicht mehr (PC 2): sein Speicher geht.
  useEffect(() => {
    try {
      window.localStorage.removeItem(ANGEBOT_ALTER_SPEICHER);
    } catch {
      // gesperrt: nichts zu entfernen
    }
  }, []);

  const ausloesen = useCallback(
    (ort: string) => {
      const { lage, mitteilungen } = aktuell.current;
      if (gezeigt.current || !lage) return;
      const jetzt = Date.now();
      const wert = lies();
      const art = angebotJetzt({ geraet: lage.geraet, mitteilungen, stand: angebotFuer(wert, schluessel), jetzt });
      if (!art) return;
      gezeigt.current = true;
      schreibe(mitGezeigt(wert, schluessel, jetzt));
      setAngebot({ ort, art });
    },
    [schluessel],
  );

  /** «Nicht jetzt», eine nicht erteilte Erlaubnis oder Ausschalten (AK 2). */
  const ablehnen = useCallback(() => {
    schreibe(mitAbgelehnt(lies(), schluessel, Date.now()));
    setAngebot(null);
  }, [schluessel]);

  return {
    /** Wo das Angebot steht und was es anbietet; `null` ohne Angebot. Sind
     *  die Mitteilungen inzwischen an, ist es erledigt. */
    angebot: angebot && mitteilungen !== "an" ? angebot : null,
    ausloesen,
    ablehnen,
  };
}

/** Die Karte (AK 1, 3–6). Rein darstellend — der Styleguide zeigt sie je Art. */
export function AngebotKarte({
  art,
  vorname,
  pfad,
  einrichten = false,
  onAnnehmen,
  onAblehnen,
}: {
  art: AngebotArt;
  vorname: string;
  /** Der Pfad des privaten Links, zum Kopieren im Browser einer App (AK 6). */
  pfad: string;
  /** Android: Der Browser kann zugleich ablegen (AK 4). */
  einrichten?: boolean;
  /** Einschalten bzw. Anleitung öffnen. */
  onAnnehmen: () => void;
  onAblehnen: () => void;
}) {
  // Die ganze Adresse kennt erst der Browser.
  const [adresse, setAdresse] = useState(pfad);
  useEffect(() => setAdresse(new URL(pfad, window.location.origin).href), [pfad]);
  const text =
    art === "einschalten"
      ? einrichten
        ? ANGEBOT_TEXT.einrichten(vorname)
        : ANGEBOT_TEXT.einschalten(vorname)
      : art === "ablegen_ios"
        ? ANGEBOT_TEXT.ablegenIos(vorname)
        : art === "in_app"
          ? ANGEBOT_TEXT.inApp
          : ANGEBOT_TEXT.gesperrt(vorname);
  const annehmen =
    art === "einschalten" ? (
      <Button type="button" variant="link" onClick={onAnnehmen}>
        {einrichten ? ANGEBOT_TEXT.knopfEinrichten : ANGEBOT_TEXT.knopfEinschalten}
      </Button>
    ) : art === "ablegen_ios" ? (
      <Button type="button" variant="link" onClick={onAnnehmen}>
        {ANGEBOT_TEXT.knopfSoGehts}
      </Button>
    ) : null;
  return (
    <SectionMessage
      icon={BellRing}
      actions={
        <>
          <Button type="button" variant="link" onClick={onAblehnen}>
            {ANGEBOT_TEXT.nichtJetzt}
          </Button>
          {annehmen}
        </>
      }
    >
      <strong className="block font-semibold">{ANGEBOT_TEXT.titel}</strong>
      {text}
      {art === "in_app" && <KopierFeld label={ANGEBOT_TEXT.linkLabel} value={adresse} className="mt-3" />}
    </SectionMessage>
  );
}
