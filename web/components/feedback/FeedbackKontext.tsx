"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { feedbackAblegenAktion, feedbackNachrichtAktion } from "@/lib/actions/feedback";
import { AB_LG } from "@/lib/breite";
import { FeedbackFlaeche, FeedbackGespraech } from "./FeedbackGespraech";
import { useFeedbackGespraech, type FeedbackAktionen } from "./useFeedbackGespraech";

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
  const [offen, setOffen] = useState(false);
  // Jedes Öffnen beginnt ein neues Gespräch.
  const [lauf, setLauf] = useState(0);
  const ausloeser = useRef<HTMLElement | null>(null);

  const oeffnen = useCallback(() => {
    ausloeser.current = document.activeElement as HTMLElement | null;
    setOffen(true);
  }, []);
  const schliessen = useCallback(() => {
    setOffen(false);
    setLauf((l) => l + 1);
    ausloeser.current?.focus();
  }, []);

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
  const pfad = usePathname();
  const pfadRef = useRef(pfad);
  pfadRef.current = pfad;

  // Unter lg liegt der Dialog über der Seite: Escape schliesst, und die
  // Seite dahinter scrollt nicht mit. Am Desktop steht er daneben und lässt
  // die Seite in Ruhe.
  useEffect(() => {
    const mq = window.matchMedia(AB_LG);
    if (mq.matches) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onSchliessen();
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = vorher;
      document.removeEventListener("keydown", onKey);
    };
  }, [onSchliessen]);

  return (
    <FeedbackFlaeche form="panel" onSchliessen={onSchliessen}>
      <FeedbackGespraech g={g} seite={() => pfadRef.current} onSchliessen={onSchliessen} />
    </FeedbackFlaeche>
  );
}

export function useFeedback(): FeedbackZustand | null {
  return useContext(FeedbackKontext);
}
