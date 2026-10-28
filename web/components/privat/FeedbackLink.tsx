"use client";

import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import { FEEDBACK_TITEL, FeedbackFlaeche, FeedbackGespraech } from "@/components/feedback/FeedbackGespraech";
import {
  useFeedbackGespraech,
  useFeedbackOffen,
  type FeedbackAktionen,
} from "@/components/feedback/useFeedbackGespraech";
import { Button } from "@/components/ui";
import { feedbackLinkAblegenAktion, feedbackLinkNachrichtAktion } from "@/lib/actions/feedback-link";

/** Wohin mit Dringendem — die Person bekommt keine Antwort über KiFu (#544 AK 7). */
const DRINGEND = "Bei Dringendem wende dich an die Trainer:innen des Teams.";

/* «Fragen und Feedback» am privaten Link (Story #544): ein Textlink am Ende
   der Seite — Spielervertretungen haben keine Seitenleiste. Er öffnet
   denselben Dialog wie bei Trainer:innen, hier bildschirmfüllend. */
export function FeedbackLink({ token }: { token: string }) {
  const { offen, lauf, oeffnen, schliessen } = useFeedbackOffen();
  return (
    <div className="px-4 pt-2">
      <Button variant="link" onClick={oeffnen} className="type-body-medium">
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
  return (
    <FeedbackFlaeche form="vollbild" onSchliessen={onSchliessen}>
      {/* Die Seite setzt der Server selbst — ohne das Geheimnis im Pfad (PC 3). */}
      <FeedbackGespraech g={g} seite="/" onSchliessen={onSchliessen} dringend={DRINGEND} />
    </FeedbackFlaeche>
  );
}
