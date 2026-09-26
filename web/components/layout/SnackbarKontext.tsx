"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
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
 * - **Die neuere zur selben Sache gilt.** Jede Stelle, die `useSnackbar()`
 *   ruft, meldet unter eigener Kennung; meldet sie erneut, ersetzt die neue
 *   Meldung ihre ältere an deren Platz in der Reihe. Ein gescheiterter Versuch
 *   steht darum nicht mehr da, wenn der nächste gelingt. Denselben Text, der
 *   schon ansteht, reiht der Platz kein zweites Mal ein — fünf gescheiterte
 *   Favoriten sind eine Meldung, nicht dreissig Sekunden.
 * - **Sie geht von selbst** nach `ANZEIGEDAUER_MS`, hält aber an, solange der
 *   Zeiger darauf liegt oder der Fokus darin steht. Wegklicken geht immer.
 * - **Sie gehört zur Ansicht.** Jede Meldung merkt sich den Pfad, auf dem sie
 *   entstand; wechselt der Pfad, fällt alles Fremde weg. Eine Rückmeldung für
 *   die Zielansicht meldet deshalb erst die Zielansicht selbst (`Flash`).
 *   Wechselt nur die Suche (`?variante=` im Editor), bleibt die Meldung.
 * - **Sie unterbricht nicht.** Die Vorlesehilfe liest sie eingereiht vor. Die
 *   Live-Region steht dafür dauerhaft im Dokument, sonst verschluckten manche
 *   Vorlesehilfen die erste Meldung — und sie trägt nur den Text: Stünden die
 *   Knöpfe darin, läse die Vorlesehilfe «Schliessen» zu jeder Meldung mit.
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
type Eintrag = { id: number; text: string; aktion?: Aktion; pfad: string; quelle: string };
type Melde = (text: string, aktion?: Aktion) => void;
type Einreihen = (text: string, aktion: Aktion | undefined, quelle: string) => void;

const SnackbarKontext = createContext<Einreihen | null>(null);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const pfad = usePathname();
  const [reihe, setReihe] = useState<Eintrag[]>([]);
  const [zeigerDarauf, setZeigerDarauf] = useState(false);
  const pfadJetzt = useRef(pfad);
  const naechsteId = useRef(0);

  // Im Layout-Effekt, nicht im gewöhnlichen: Die Zielansicht meldet ihre
  // Bestätigung in einem gewöhnlichen Effekt, und der läuft erst danach — sie
  // trägt also schon den neuen Pfad und fällt hier nicht mit weg.
  useIsomorpherEffekt(() => {
    pfadJetzt.current = pfad;
    setReihe((r) => (r.every((e) => e.pfad === pfad) ? r : r.filter((e) => e.pfad === pfad)));
  }, [pfad]);

  // Leer hat der Platz keine Fläche, über der der Zeiger liegen könnte — und
  // ein Verlassen, das niemand mehr meldet, darf die nächste nicht anhalten.
  useEffect(() => {
    if (reihe.length === 0) setZeigerDarauf(false);
  }, [reihe.length]);

  const einreihen = useCallback<Einreihen>((text, aktion, quelle) => {
    const neu = { id: naechsteId.current++, text, aktion, pfad: pfadJetzt.current, quelle };
    setReihe((r) => {
      if (r.some((e) => e.quelle !== quelle && e.text === text)) return r;
      let ersetzt = false;
      const naechste = r.flatMap((e) => {
        if (e.quelle !== quelle) return [e];
        if (ersetzt) return [];
        ersetzt = true;
        return [neu];
      });
      return ersetzt ? naechste : [...r, neu];
    });
  }, []);

  const schliessen = useCallback((id: number) => {
    setReihe((r) => r.filter((e) => e.id !== id));
  }, []);

  const sichtbar = reihe[0];

  return (
    <SnackbarKontext.Provider value={einreihen}>
      {children}
      {/* Unten bleibt mindestens ein Rem frei, auf Geräten mit Home-Leiste
          deren sichere Zone. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4 print:hidden">
        {/* Der Zeiger wird hier gemessen, nicht an der einzelnen Snackbar:
            Schliesst der Trainer eine per X, rückt die nächste unter den
            ruhenden Zeiger, ohne dass ein neues Betreten gemeldet würde. */}
        <div
          className="pointer-events-auto max-w-full"
          onPointerEnter={() => setZeigerDarauf(true)}
          onPointerLeave={() => setZeigerDarauf(false)}
        >
          {sichtbar && (
            <SichtbareSnackbar
              key={sichtbar.id}
              eintrag={sichtbar}
              zeigerDarauf={zeigerDarauf}
              onSchliessen={schliessen}
            />
          )}
        </div>
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {sichtbar && <span key={sichtbar.id}>{sichtbar.text}</span>}
      </div>
    </SnackbarKontext.Provider>
  );
}

/** Meldet eine Rückmeldung an den Platz am unteren Rand. Jeder Aufruf des
 *  Hooks ist eine eigene Stelle: Ihre neuere Meldung ersetzt ihre ältere. */
export function useSnackbar(): Melde {
  const einreihen = useContext(SnackbarKontext);
  if (!einreihen) throw new Error("useSnackbar braucht den SnackbarProvider im Root-Layout.");
  const quelle = useId();
  return useCallback<Melde>((text, aktion) => einreihen(text, aktion, quelle), [einreihen, quelle]);
}

function SichtbareSnackbar({
  eintrag,
  zeigerDarauf,
  onSchliessen,
}: {
  eintrag: Eintrag;
  zeigerDarauf: boolean;
  onSchliessen: (id: number) => void;
}) {
  const [fokusDarin, setFokusDarin] = useState(false);
  const rest = useRef(ANZEIGEDAUER_MS);
  const flaeche = useRef<HTMLDivElement>(null);
  const fokusVorher = useRef<HTMLElement | null>(null);

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

  // Wer per Tastatur hineinkam und hier schliesst, landet sonst am
  // Dokumentanfang: Der Fokus geht dorthin zurück, woher er kam.
  function schliessen() {
    const zurueck = fokusVorher.current;
    if (flaeche.current?.contains(document.activeElement) && zurueck?.isConnected) zurueck.focus();
    onSchliessen(eintrag.id);
  }

  return (
    <div
      ref={flaeche}
      onFocus={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          fokusVorher.current = e.relatedTarget instanceof HTMLElement ? e.relatedTarget : null;
        }
        setFokusDarin(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFokusDarin(false);
      }}
    >
      <Snackbar
        message={eintrag.text}
        actionLabel={eintrag.aktion?.label}
        onAction={() => {
          eintrag.aktion?.onAction();
          schliessen();
        }}
        onClose={schliessen}
      />
    </div>
  );
}
