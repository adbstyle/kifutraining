"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";
import { FEEDBACK_TITEL, FeedbackFlaeche, FeedbackGespraech } from "@/components/feedback/FeedbackGespraech";
import { useFeedbackGespraech, type FeedbackAktionen } from "@/components/feedback/useFeedbackGespraech";
import { Button } from "@/components/ui";
import { feedbackLinkAblegenAktion, feedbackLinkNachrichtAktion } from "@/lib/actions/feedback-link";

/** Wohin mit Dringendem — die Person bekommt keine Antwort über KiFu (#544 AK 7). */
const DRINGEND = "Bei Dringendem wende dich an die Trainer:innen des Teams.";

/* «Fragen und Feedback» am privaten Link (Story #544): ein Textlink am Ende
   der Seite — Spielervertretungen haben keine Seitenleiste. Er öffnet
   denselben Dialog wie bei Trainer:innen, hier bildschirmfüllend. */
export function FeedbackLink({ token }: { token: string }) {
  const [offen, setOffen] = useState(false);
  // Jedes Öffnen beginnt ein neues Gespräch.
  const [lauf, setLauf] = useState(0);
  const knopf = useRef<HTMLButtonElement>(null);
  const schliessen = () => {
    setOffen(false);
    setLauf((l) => l + 1);
    knopf.current?.focus();
  };
  return (
    <div className="px-4 pt-2">
      <Button ref={knopf} variant="link" onClick={() => setOffen(true)} className="type-body-medium">
        <MessageSquare size={16} strokeWidth={2} aria-hidden />
        {FEEDBACK_TITEL}
      </Button>
      {offen && <Gespraech key={lauf} token={token} onSchliessen={schliessen} />}
    </div>
  );
}

function Gespraech({ token, onSchliessen }: { token: string; onSchliessen: () => void }) {
  const aktionen = useMemo<FeedbackAktionen>(
    () => ({
      nachricht: (e) => feedbackLinkNachrichtAktion(token, e),
      ablegen: (e) => feedbackLinkAblegenAktion(token, e),
    }),
    [token],
  );
  const g = useFeedbackGespraech(aktionen);

  // Der Dialog liegt über der Seite: Escape schliesst, die Seite scrollt nicht mit.
  useEffect(() => {
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
    <FeedbackFlaeche form="vollbild" onSchliessen={onSchliessen}>
      {/* Die Seite meldet der Server selbst — ohne das Geheimnis im Pfad (PC 3). */}
      <FeedbackGespraech g={g} seite={() => "/"} onSchliessen={onSchliessen} dringend={DRINGEND} />
    </FeedbackFlaeche>
  );
}
