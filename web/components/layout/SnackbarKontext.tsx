"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { Snackbar } from "@/components/ui";
import { useIsomorpherEffekt } from "@/lib/use-isomorpher-effekt";

/**
 * Der eine Platz für Rückmeldungen zu Vorgängen — unten in der Mitte, für die
 * ganze Anwendung (Story #234).
 *
 * Material 2 trennt zwei Bausteine: Der Banner meldet einen Zustand und bleibt
 * stehen, bis er erledigt ist; die Snackbar meldet einen Vorgang und geht von
 * selbst. Diese Datei ist die Snackbar-Seite davon:
 *
 * - **Eine zur Zeit.** Weitere warten in der Reihe; ihre Anzeigedauer beginnt
 *   erst, wenn sie erscheinen — so läuft keine im Verborgenen ab.
 * - **Sie geht von selbst** nach `ANZEIGEDAUER_MS`, hält aber an, solange der
 *   Zeiger darauf liegt oder der Fokus darin steht. Wegklicken geht immer.
 * - **Sie gehört zur Ansicht.** Jede Meldung merkt sich den Pfad, auf dem sie
 *   entstand; wechselt der Pfad, fällt alles Fremde weg. Eine Rückmeldung für
 *   die Zielansicht meldet deshalb erst die Zielansicht selbst (`Flash`).
 *   Wechselt nur die Suche (`?variante=` im Editor), bleibt die Meldung.
 * - **Sie unterbricht nicht.** Die Vorlesehilfe liest sie eingereiht vor; die
 *   Live-Region steht dafür dauerhaft im Dokument, sonst verschluckten manche
 *   Vorlesehilfen die erste Meldung.
 *
 * Sie liegt unter Dialogen (z-40 gegen deren z-50), wie Material es verlangt —
 * ein Fehler, der einen offenen Dialog zurücklässt, gehört als Banner in den
 * Dialog, nicht hierher.
 *
 * Er rechnet mit keiner festen Fussleiste. Die einzige, die es gibt — Zurück
 * und Weiter beim Durchführen —, liegt auf einer Ansicht, die nichts meldet;
 * Fremdes fällt beim Wechsel dorthin weg. Meldet sie eines Tages selbst etwas,
 * muss der Platz dort über die Leiste rücken, sonst verdeckt er sie.
 */

/** Material 2 nennt 4–10 s; 6 s reichen für die längste Meldung (#234). */
const ANZEIGEDAUER_MS = 6000;

type Aktion = { label: string; onAction: () => void };
type Eintrag = { id: number; text: string; aktion?: Aktion; pfad: string };
type Melde = (text: string, aktion?: Aktion) => void;

const SnackbarKontext = createContext<Melde | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const pfad = usePathname();
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const pfadJetzt = useRef(pfad);
  const naechsteId = useRef(0);

  // Im Layout-Effekt, nicht im gewöhnlichen: Die Zielansicht meldet ihre
  // Bestätigung in einem gewöhnlichen Effekt, und der läuft erst danach — sie
  // trägt also schon den neuen Pfad und fällt hier nicht mit weg.
  useIsomorpherEffekt(() => {
    pfadJetzt.current = pfad;
    setReihe((r) => (r.every((e) => e.pfad === pfad) ? r : r.filter((e) => e.pfad === pfad)));
  }, [pfad]);

  const melde = useCallback<Melde>((text, aktion) => {
    const id = naechsteId.current++;
    setReihe((r) => [...r, { id, text, aktion, pfad: pfadJetzt.current }]);
  }, []);

  const schliessen = useCallback((id: number) => {
    setReihe((r) => r.filter((e) => e.id !== id));
  }, []);

  const sichtbar = reihe[0];

  return (
    <SnackbarKontext.Provider value={melde}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden"
      >
        {sichtbar && <SichtbareSnackbar key={sichtbar.id} eintrag={sichtbar} onSchliessen={schliessen} />}
      </div>
    </SnackbarKontext.Provider>
  );
}

/** Meldet eine Rückmeldung an den Platz am unteren Rand. */
export function useSnackbar(): Melde {
  const melde = useContext(SnackbarKontext);
  if (!melde) throw new Error("useSnackbar braucht den SnackbarProvider im Root-Layout.");
  return melde;
}

function SichtbareSnackbar({
  eintrag,
  onSchliessen,
}: {
  eintrag: Eintrag;
  onSchliessen: (id: number) => void;
}) {
  const [zeigerDarauf, setZeigerDarauf] = useState(false);
  const [fokusDarin, setFokusDarin] = useState(false);
  const rest = useRef(ANZEIGEDAUER_MS);

  // Pausieren heisst: den Timer abräumen und sich merken, wie viel noch übrig
  // war. Beim Weiterlaufen startet er mit genau diesem Rest.
  useEffect(() => {
    if (zeigerDarauf || fokusDarin) return;
    const start = Date.now();
    const timer = setTimeout(() => onSchliessen(eintrag.id), rest.current);
    return () => {
      clearTimeout(timer);
      rest.current -= Date.now() - start;
    };
  }, [zeigerDarauf, fokusDarin, eintrag.id, onSchliessen]);

  return (
    <div
      className="pointer-events-auto max-w-full"
      onPointerEnter={() => setZeigerDarauf(true)}
      onPointerLeave={() => setZeigerDarauf(false)}
      onFocus={() => setFokusDarin(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFokusDarin(false);
      }}
    >
      <Snackbar
        message={eintrag.text}
        actionLabel={eintrag.aktion?.label}
        onAction={() => {
          eintrag.aktion?.onAction();
          onSchliessen(eintrag.id);
        }}
        onClose={() => onSchliessen(eintrag.id)}
      />
    </div>
  );
}
