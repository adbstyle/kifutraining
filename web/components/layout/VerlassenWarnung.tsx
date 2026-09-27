"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog } from "@/components/ui";

/** Eine zurückgehaltene Navigation: was «Verlassen» ausführt und was
 *  «Weiter bearbeiten» rückgängig macht (nur beim Browser-Zurück nötig). */
type Ausstehend = { weiter: () => void; bleiben?: () => void };

/** Kennzeichen des Wächter-Eintrags im Verlaufs-Zustand. Der übrige Zustand
 *  bleibt der von Next, damit der Router den Eintrag als seinen erkennt. */
const WAECHTER = "__verlassenWarnung";

const aufWaechter = () => !!window.history.state?.[WAECHTER];

function legeWaechter() {
  window.history.pushState({ ...window.history.state, [WAECHTER]: true }, "", window.location.href);
}

/** Die aktive Warnung, solange eine Seite ungesicherte Angaben hält — im
 *  Browser gibt es höchstens eine. Navigationen ohne Link (das Kontomenü
 *  springt per `router.push`, Abmelden ruft eine Server Action) fragen hier
 *  nach, weil sie am Klick-Abfangen vorbeilaufen. */
let waechter: ((weiter: () => void) => void) | null = null;

/** Eine Navigation erst ausführen, wenn keine Warnung aktiv ist oder der USER
 *  das Verlassen bestätigt. Für Navigationen, die kein Link sind. */
export function nachVerlassenFrage(weiter: () => void) {
  if (waechter) waechter(weiter);
  else weiter();
}

/**
 * Warnt vor dem Verlassen einer Seite mit ungesicherten Angaben (#246 AK 7).
 *
 * Drei Wege führen hinaus, und jeder braucht seinen eigenen Griff:
 * - Neuladen, Schliessen, eine fremde Adresse: `beforeunload`. Den Wortlaut
 *   bestimmt dort der Browser, nicht die App.
 * - Ein Link in der App: Next navigiert, ohne die Seite zu entladen. Der Klick
 *   wird darum in der Capture-Phase am Dokument abgefangen — vor Reacts
 *   Wurzel-Listener, der sonst den Router anstösst — und erst nach der
 *   Bestätigung per Router nachgeholt.
 * - Browser-Zurück: Ein `popstate` lässt sich nicht aufhalten — die Adresse
 *   ist schon gewechselt, und der Router hat sich vor jedem späteren Listener
 *   angemeldet (auch ein Capture-Listener am `window` läuft erst nach ihm).
 *   Darum legt die Warnung beim Scharfwerden einen Wächter-Eintrag mit
 *   derselben Adresse in den Verlauf. Zurück landet so zuerst auf der Seite
 *   selbst, die stehen bleibt; «Verlassen» geht den eigentlichen Schritt
 *   zurück, «Weiter bearbeiten» legt den Wächter neu.
 *
 * Wer nach dem Verlassen per Link zurückkommt, trifft den Wächter nicht mehr
 * an: Der Link ersetzt ihn. Die Weiterleitung nach dem Speichern tut dasselbe
 * (`createExercise` leitet mit `replace` weiter).
 */
export function VerlassenWarnung({
  aktiv,
  titel,
  text,
}: {
  /** Hält die Seite gerade ungesicherte Angaben? */
  aktiv: boolean;
  titel: string;
  text: string;
}) {
  const router = useRouter();
  const [ausstehend, setAusstehend] = useState<Ausstehend | null>(null);
  // Nach «Verlassen» ist der nächste Schritt zurück gewollt.
  const gehtZurueck = useRef(false);

  useEffect(() => {
    if (!aktiv) return;

    const vorEntladen = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Ältere Browser zeigen die Abfrage nur mit gesetztem returnValue.
      e.returnValue = "";
    };

    const klick = (e: MouseEvent) => {
      // Neuer Tab, Download oder Sprung auf fremde Seiten verlassen diese
      // Seite nicht bzw. laufen über `beforeunload`.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const ziel = new URL(a.href, window.location.href);
      if (ziel.origin !== window.location.origin) return;
      if (ziel.pathname === window.location.pathname && ziel.search === window.location.search)
        return;
      e.preventDefault();
      e.stopPropagation();
      const href = ziel.pathname + ziel.search + ziel.hash;
      // Der Wächter-Eintrag hat nach dem Verlassen ausgedient: Der Link tritt
      // an seine Stelle, Zurück führt dann auf die Seite, wie sie vorher war.
      setAusstehend({ weiter: () => (aufWaechter() ? router.replace(href) : router.push(href)) });
    };

    // Zurück vom Wächter auf die Seite selbst: Der Router zeigt dieselbe
    // Seite, sie bleibt stehen — jetzt wird gefragt.
    const zurueck = () => {
      if (gehtZurueck.current || aufWaechter()) return;
      setAusstehend({
        weiter: () => {
          gehtZurueck.current = true;
          window.history.back();
        },
        // Escape schliesst den Dialog mit `cancel` UND `close`, beide rufen
        // «Weiter bearbeiten» — der Wächter darf trotzdem nur einmal liegen.
        bleiben: () => {
          if (!aufWaechter()) legeWaechter();
        },
      });
    };

    // Ein Wächter pro Aufenthalt: Scheitert das Speichern, wird die Warnung
    // erneut scharf und findet ihn schon vor.
    if (!aufWaechter()) legeWaechter();
    waechter = (weiter) => setAusstehend({ weiter });
    window.addEventListener("beforeunload", vorEntladen);
    document.addEventListener("click", klick, true);
    window.addEventListener("popstate", zurueck);
    return () => {
      waechter = null;
      window.removeEventListener("beforeunload", vorEntladen);
      document.removeEventListener("click", klick, true);
      window.removeEventListener("popstate", zurueck);
    };
  }, [aktiv, router]);

  function bleiben() {
    ausstehend?.bleiben?.();
    setAusstehend(null);
  }

  function verlassen() {
    const weiter = ausstehend?.weiter;
    setAusstehend(null);
    weiter?.();
  }

  return (
    <Dialog
      open={!!ausstehend}
      onClose={bleiben}
      title={titel}
      actions={
        <>
          <Button type="button" variant="text" onClick={bleiben}>
            Weiter bearbeiten
          </Button>
          <Button type="button" variant="danger" onClick={verlassen}>
            Verlassen
          </Button>
        </>
      }
    >
      {text}
    </Dialog>
  );
}
