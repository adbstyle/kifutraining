"use client";

import { useCallback, useState, useTransition } from "react";
import type { NachrichtEingabe, NachrichtErgebnis } from "@/lib/feedback/dialog";
import {
  ZUSAMMENFASSUNG_VERLANGEN,
  dialogStand,
  type Nachricht,
  type Zusammenfassung,
} from "@/lib/feedback/regeln";

/** Die Server Actions eines Zugangs — Konto (#542) oder privater Link (#544). */
export type FeedbackAktionen = {
  nachricht: (e: NachrichtEingabe) => Promise<NachrichtErgebnis>;
  ablegen: (e: {
    dialog: string;
    zusammenfassung: Zusammenfassung;
    verlauf: Nachricht[];
    seite: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

type Phase = "gespraech" | "gesendet" | "beendet";

/**
 * Der Zustand eines Feedback-Gesprächs im Browser: Verlauf, Zusammenfassung,
 * Zähler. Den Verlauf hält allein der Browser — die Datenbank zählt nur und
 * speichert erst, was die Person bestätigt (PO 5). Wer den Hook neu aufsetzt
 * (Dialog geschlossen, Seite neu geladen), hat das Gespräch abgebrochen.
 */
export function useFeedbackGespraech(aktionen: FeedbackAktionen) {
  const [phase, setPhase] = useState<Phase>("gespraech");
  const [dialog, setDialog] = useState<string | null>(null);
  const [verlauf, setVerlauf] = useState<Nachricht[]>([]);
  const [zusammenfassung, setZusammenfassung] = useState<Zusammenfassung | null>(null);
  const [nachricht, setNachricht] = useState(0);
  const [vorschlagBei, setVorschlagBei] = useState<number | null>(null);
  // Ein Fehler, der den Dialog beendet (Ausfall, Tageslimit), oder einer beim
  // Speichern, nach dem ein neuer Versuch geht.
  const [fehler, setFehler] = useState<string | null>(null);
  const [wartet, starte] = useTransition();
  // Die Nachricht der Person steht sofort im Verlauf, die Antwort folgt.
  const [unterwegs, setUnterwegs] = useState<string | null>(null);

  const stand = dialogStand(nachricht, vorschlagBei);

  const senden = useCallback(
    (text: string, seite: string) => {
      if (wartet || !stand.offen || phase !== "gespraech") return;
      setUnterwegs(text);
      setFehler(null);
      starte(async () => {
        const r = await aktionen.nachricht({ dialog, verlauf, text, zusammenfassung, seite }).catch(() => null);
        setUnterwegs(null);
        if (!r) {
          setPhase("beendet");
          setFehler("Feedback ist gerade nicht möglich. Versuch es später nochmals.");
          return;
        }
        if (!r.ok) {
          setFehler(r.error);
          if (r.ende) setPhase("beendet");
          return;
        }
        setDialog(r.dialog);
        setVerlauf((v) => [...v, { von: "person", text }, { von: "ki", text: r.antwort }]);
        setZusammenfassung(r.zusammenfassung);
        setNachricht(r.nachricht);
        setVorschlagBei(r.vorschlagBei);
      });
    },
    [aktionen, dialog, phase, stand.offen, verlauf, wartet, zusammenfassung],
  );

  const bestaetigen = useCallback(
    (seite: string) => {
      if (!dialog || !zusammenfassung || wartet) return;
      setFehler(null);
      starte(async () => {
        const r = await aktionen
          .ablegen({ dialog, zusammenfassung, verlauf, seite })
          .catch(() => ({ ok: false as const, error: "Dein Feedback liess sich nicht speichern. Versuch es nochmals." }));
        if (r.ok) setPhase("gesendet");
        else setFehler(r.error);
      });
    },
    [aktionen, dialog, verlauf, wartet, zusammenfassung],
  );

  return {
    phase,
    verlauf,
    unterwegs,
    zusammenfassung,
    stand,
    fehler,
    wartet,
    /** Erst nach der ersten Antwort lässt sich eine Zusammenfassung verlangen. */
    kannZusammenfassen: verlauf.length > 0 && zusammenfassung === null && stand.offen,
    senden,
    zusammenfassen: (seite: string) => senden(ZUSAMMENFASSUNG_VERLANGEN, seite),
    bestaetigen,
  };
}

export type FeedbackGespraech = ReturnType<typeof useFeedbackGespraech>;
