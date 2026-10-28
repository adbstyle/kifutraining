"use client";

import { createContext, useContext } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { feedbackAblegenAktion, feedbackNachrichtAktion } from "@/lib/actions/feedback";
import { FeedbackFlaeche, FeedbackGespraech } from "./FeedbackGespraech";
import { useFeedbackGespraech, useFeedbackOffen, type FeedbackAktionen } from "./useFeedbackGespraech";

/** Breite der Spalte am Desktop; Snackbar und Auswahlleiste rücken um sie
 *  nach links (`unterRand`). */
const BREITE = "24rem";

const AKTIONEN: FeedbackAktionen = { nachricht: feedbackNachrichtAktion, ablegen: feedbackAblegenAktion };

type FeedbackZustand = { offen: boolean; oeffnen: () => void };
const FeedbackKontext = createContext<FeedbackZustand | null>(null);

/**
 * «Fragen und Feedback» für angemeldete Trainer:innen (Story #542): von jeder
 * Seite aus zu öffnen, am Desktop eine Spalte rechts, darunter bildschirm-
 * füllend. Wohnt im (app)-Layout und überdauert so jeden Seitenwechsel — der
 * Dialog bricht nicht ab, wenn die Person nachschaut (PO 21). Schliessen
 * bricht ab: Das Gespräch beginnt beim nächsten Öffnen von vorn.
 *
 * Rendert seine Kinder unverändert in den Flex-Rahmen und hängt die Spalte
 * dahinter an. Die Breite steht als `--feedback-breite` an einem
 * `display: contents`-Wrapper, damit der feste Platz am unteren Rand sie erbt.
 */
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const { offen, lauf, oeffnen, schliessen } = useFeedbackOffen();
  const stil = { "--feedback-breite": offen ? BREITE : "0px" } as CSSProperties;
  return (
    <FeedbackKontext.Provider value={{ offen, oeffnen }}>
      <div className="contents" style={stil}>
        {children}
        {offen && <Spalte key={lauf} onSchliessen={schliessen} />}
      </div>
    </FeedbackKontext.Provider>
  );
}

function Spalte({ onSchliessen }: { onSchliessen: () => void }) {
  const g = useFeedbackGespraech(AKTIONEN);
  return (
    <FeedbackFlaeche form="panel" onSchliessen={onSchliessen}>
      <FeedbackGespraech g={g} seite={usePathname()} onSchliessen={onSchliessen} />
    </FeedbackFlaeche>
  );
}

export function useFeedback(): FeedbackZustand {
  const zustand = useContext(FeedbackKontext);
  if (!zustand) throw new Error("useFeedback braucht den FeedbackProvider im (app)-Layout.");
  return zustand;
}
