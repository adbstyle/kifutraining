"use client";

import { useState } from "react";
import { MitteilungenDialog, MitteilungenKarte } from "@/components/privat/Mitteilungen";
import { MITTEILUNGEN_TEXT, type MitteilungenStand } from "@/lib/push";

/* «Mitteilungen aufs Mobile» am privaten Link (#483): die Karte oben in der
   Glocken-Ansicht in jedem Stand, ohne das eigene Gerät. Der Schalter der
   ersten Karte öffnet den Dialog vor dem Einschalten; «Einschalten» schaltet
   hier nur die Karte um. Erfundener Name. */
const STAENDE: { titel: string; stand: MitteilungenStand; meldung?: { art: "error"; text: string } }[] = [
  { titel: "Aus", stand: "aus" },
  { titel: "Eingeschaltet", stand: "an" },
  { titel: "iPhone im Safari-Tab", stand: "ios_browser" },
  { titel: "Abgelehnt", stand: "abgelehnt" },
  { titel: "Browser ohne Mitteilungen", stand: "nicht_moeglich" },
  { titel: "Grenze erreicht", stand: "aus", meldung: { art: "error", text: MITTEILUNGEN_TEXT.grenze("Lena") } },
];

export function MitteilungenDemo() {
  const [an, setAn] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <div className="flex max-w-md flex-col gap-6">
      {STAENDE.map(({ titel, stand, meldung }, i) => (
        <div key={titel}>
          <p className="type-label-small mb-2 text-on-surface-mittel">{titel}</p>
          <MitteilungenKarte
            vorname="Lena"
            stand={i === 0 ? (an ? "an" : "aus") : stand}
            meldung={meldung}
            onSchalten={(x) => (i === 0 ? (x ? setDialog(true) : setAn(false)) : undefined)}
            onSoGehts={() => undefined}
          />
        </div>
      ))}
      <MitteilungenDialog
        open={dialog}
        vorname="Lena"
        onAbbrechen={() => setDialog(false)}
        onEinschalten={() => {
          setDialog(false);
          setAn(true);
        }}
      />
    </div>
  );
}
