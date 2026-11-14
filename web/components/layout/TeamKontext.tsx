"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useIsomorpherEffekt } from "@/lib/use-isomorpher-effekt";

/**
 * Welchem Team das geöffnete Training gehört (oder keinem) — quer über die
 * Navigation hinweg festgehalten.
 *
 * Warum das nicht der Server allein erledigt: Die Hauptnavigation sitzt im
 * (app)-Layout, und ein Layout rendert Next.js bei einer Client-Navigation
 * nicht neu (Partial Rendering). Wer im Trainingsplan auf eine Einheit klickt,
 * bekäme also weiterhin den Zustand des letzten harten Ladens zu sehen —
 * „Trainings" aktiv statt des Teams, genau das, was #156 abschaffen soll. Seit
 * dem Bereich-Wechsler (#581) braucht die Leiste dazu das Team selbst, nicht
 * nur das Ja oder Nein.
 *
 * Ein Root-`template.tsx` löst es nicht: Es baut den Rahmen zwar bei jeder
 * Navigation neu auf, holt ihn aber aus dem Router-Cache und rendert die
 * Server-Komponente darin nicht erneut (nachgemessen — die Abfrage in `AppNav`
 * lief bei der Client-Navigation kein zweites Mal).
 *
 * Darum zwei Wege für dieselbe Angabe, jeder für den Abschnitt, den nur er
 * bedienen kann:
 *
 * - **Erstaufbau** — `AppNav` schlägt die Zugehörigkeit serverseitig nach
 *   (Pfad aus dem Middleware-Header) und liefert sie fertig aus. Nur so steht
 *   schon im ersten HTML der richtige Zustand; nichts blitzt auf (NFR 1).
 * - **Danach** — das Layout unter `/training/[id]` meldet sie hier an. Das
 *   Layout liegt unterhalb der Navigation und wird bei jeder Navigation neu
 *   gerendert; die Meldung läuft im Layout-Effekt, also noch vor dem Zeichnen.
 *
 * Gemeldet schlägt Server: Sobald irgendeine Seite etwas gemeldet hat, ist der
 * Server-Wert der ältere von beiden.
 */
type TeamKontextWert = {
  /** `null`, solange keine Seite etwas gemeldet hat — dann gilt der Server.
   *  Gemeldet ist die Kennung des Teams oder `{ team: null }` (kein Team). */
  gemeldet: { team: string | null } | null;
  melden: (team: string | null) => void;
};

const TeamKontext = createContext<TeamKontextWert | null>(null);

export function TeamKontextProvider({ children }: { children: React.ReactNode }) {
  const [gemeldet, setGemeldet] = useState<{ team: string | null } | null>(null);
  // `melden` bleibt dieselbe Funktion: Der Melder hängt mit seinem Effekt
  // daran, eine neue liesse ihn bei jeder Meldung erneut laufen.
  const melden = useCallback((team: string | null) => setGemeldet({ team }), []);
  const wert = useMemo(() => ({ gemeldet, melden }), [gemeldet, melden]);
  return <TeamKontext.Provider value={wert}>{children}</TeamKontext.Provider>;
}

/** Der geltende Zustand: das zuletzt Gemeldete, sonst der Wert vom Server. */
export function useTeamBereich(vomServer: string | null): string | null {
  const gemeldet = useContext(TeamKontext)?.gemeldet;
  return gemeldet ? gemeldet.team : vomServer;
}

/**
 * Meldet den Team-Kontext des geöffneten Trainings an die Navigation und
 * nimmt ihn beim Verlassen zurück. Rendert nichts.
 *
 * Der Layout-Effekt läuft vor dem Zeichnen, die Navigation steht also schon
 * beim ersten Bild der neuen Seite richtig. Beim Wechsel von einem Training
 * zum nächsten bleibt die Komponente stehen und nur der Effekt läuft neu:
 * erst das Zurücknehmen, dann die neue Meldung — beides im selben Durchgang.
 */
export function TeamBereichMelder({ teamId }: { teamId: string | null }) {
  const melden = useContext(TeamKontext)?.melden;
  useIsomorpherEffekt(() => {
    if (!melden) return;
    melden(teamId);
    // Zurück auf «kein Team», nicht auf «nichts gemeldet»: Wer das Training
    // verlässt, ist nicht mehr im Team-Bereich — und der Server-Wert, auf den
    // das zurückfiele, gehört zur zuletzt hart geladenen Adresse.
    return () => melden(null);
  }, [melden, teamId]);
  return null;
}
