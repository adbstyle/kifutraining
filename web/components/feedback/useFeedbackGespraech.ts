"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import type { AblageEingabe, AblageErgebnis, NachrichtEingabe, NachrichtErgebnis } from "@/lib/feedback/dialog";
import {
  MELDUNG_NICHT_MOEGLICH,
  MELDUNG_SPEICHERN,
  ZUSAMMENFASSUNG_VERLANGEN,
  dialogStand,
  type Nachricht,
  type Zusammenfassung,
} from "@/lib/feedback/regeln";

/** Die Server Actions eines Zugangs — Konto (#542) oder privater Link (#544). */
export type FeedbackAktionen = {
  nachricht: (e: NachrichtEingabe) => Promise<NachrichtErgebnis>;
  ablegen: (e: AblageEingabe) => Promise<AblageErgebnis>;
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

  function senden(text: string, seite: string) {
    if (wartet || !stand.offen || phase !== "gespraech") return;
    setUnterwegs(text);
    setFehler(null);
    starte(async () => {
      const r: NachrichtErgebnis = await aktionen
        .nachricht({ dialog, verlauf, text, zusammenfassung, seite })
        .catch(() => ({ ok: false, error: MELDUNG_NICHT_MOEGLICH, ende: true }));
      setUnterwegs(null);
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
      // Am Limit ohne Zusammenfassung ginge es nicht weiter.
      if (!r.zusammenfassung && !dialogStand(r.nachricht, r.vorschlagBei).offen) {
        setFehler(MELDUNG_NICHT_MOEGLICH);
        setPhase("beendet");
      }
    });
  }

  function bestaetigen(seite: string) {
    if (!dialog || !zusammenfassung || wartet) return;
    setFehler(null);
    starte(async () => {
      const r: AblageErgebnis = await aktionen
        .ablegen({ dialog, zusammenfassung, verlauf, seite })
        .catch(() => ({ ok: false, error: MELDUNG_SPEICHERN }));
      if (r.ok) return setPhase("gesendet");
      setFehler(r.error);
      // Ein Link, der nicht mehr gilt, beendet den Dialog; sonst geht ein
      // neuer Versuch (#542 AK 18).
      if (r.ende) setPhase("beendet");
    });
  }

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

export type GespraechZustand = ReturnType<typeof useFeedbackGespraech>;

/**
 * Offen oder zu, für die beiden Auslöser (Seitenleiste, Link am privaten
 * Link). Schliessen bricht ab: `lauf` gibt dem Gespräch einen neuen Schlüssel,
 * das nächste Öffnen beginnt von vorn. Der Fokus geht zurück auf den Auslöser
 * — oder, lag der im Drawer, der beim Öffnen zugeht, auf dessen Menüknopf.
 */
export function useFeedbackOffen() {
  const [offen, setOffen] = useState(false);
  const [lauf, setLauf] = useState(0);
  const ausloeser = useRef<HTMLElement | null>(null);
  const oeffnen = useCallback(() => {
    const aktiv = document.activeElement as HTMLElement | null;
    // Der Menüknopf, nicht der Umschalter der schmalen Leiste: Beide tragen
    // dasselbe aria-controls, sichtbar ist nur der, der den Drawer öffnet.
    const menue = [...document.querySelectorAll<HTMLElement>('[aria-controls="seitenleiste"]')].find((el) =>
      el.checkVisibility(),
    );
    ausloeser.current = aktiv?.closest('[aria-modal="true"]') ? (menue ?? null) : aktiv;
    setOffen(true);
  }, []);
  const schliessen = useCallback(() => {
    setOffen(false);
    setLauf((l) => l + 1);
    // Erst nach dem Schliessen: Bis dahin ist die Seite dahinter noch inert.
    setTimeout(() => ausloeser.current?.focus(), 0);
  }, []);
  return { offen, lauf, oeffnen, schliessen };
}
