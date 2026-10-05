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

const traegtMarke = (state: unknown) =>
  !!(state as Record<string, unknown> | null)?.[WAECHTER];

/** Wie lange ein «Verlassen» per Zurück auf das `popstate` wartet. Bleibt es
 *  aus, gab es keinen Eintrag davor (neuer Tab) — die Seite bleibt. */
const ZURUECK_FRIST_MS = 500;

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
 *
 * `amOrt`: Die Angaben werden gesichert oder verworfen, ohne dass die Seite
 * wechselt — die Übung in der Spalte eines Trainings (#372). Dort ersetzt
 * keine Weiterleitung den Wächter; er nimmt seinen Eintrag darum selbst
 * zurück, sobald er nicht mehr gebraucht wird. Sonst führte das nächste
 * Zurück bloss auf dieselbe Seite und schiene nichts zu tun.
 */
export function VerlassenWarnung({
  aktiv,
  titel,
  text,
  amOrt = false,
}: {
  /** Hält die Seite gerade ungesicherte Angaben? */
  aktiv: boolean;
  amOrt?: boolean;
  titel: string;
  text: string;
}) {
  const router = useRouter();
  const [ausstehend, setAusstehend] = useState<Ausstehend | null>(null);
  // Nach «Verlassen» ist der nächste Schritt zurück gewollt …
  const gehtZurueck = useRef(false);
  // … und keine zweite Abfrage des Browsers, falls er das Dokument verlässt.
  const freigegeben = useRef(false);
  // Steht die Seite gerade auf ihrem Wächter? Die Marke im Verlaufs-Zustand
  // allein genügt nicht: Next ersetzt den Zustand des aktuellen Eintrags bei
  // eigenen Router-Updates und kann sie dabei verlieren.
  const aufWaechterRef = useRef(false);
  const zurueckFrist = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!aktiv) return;

    const aufWaechter = () => aufWaechterRef.current || traegtMarke(window.history.state);
    const legeWaechter = () => {
      const state = { ...window.history.state, [WAECHTER]: true };
      window.history.pushState(state, "", window.location.href);
      aufWaechterRef.current = true;
    };

    const vorEntladen = (e: BeforeUnloadEvent) => {
      if (freigegeben.current) return;
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
    // Seite, sie bleibt stehen — jetzt wird gefragt. Führt das Ereignis
    // dagegen vorwärts auf den Wächter, ist nichts zu tun.
    const zurueck = (e: PopStateEvent) => {
      if (gehtZurueck.current) {
        if (zurueckFrist.current) clearTimeout(zurueckFrist.current);
        return;
      }
      aufWaechterRef.current = traegtMarke(e.state);
      if (aufWaechterRef.current) return;
      setAusstehend({
        weiter: () => {
          gehtZurueck.current = true;
          window.history.back();
          // Ohne Eintrag davor tut `back()` nichts: Die Warnung bleibt dann
          // scharf, statt still abgeschaltet zu sein.
          zurueckFrist.current = setTimeout(() => {
            gehtZurueck.current = false;
            freigegeben.current = false;
            legeWaechter();
          }, ZURUECK_FRIST_MS);
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
    window.addEventListener("beforeunload", vorEntladen);
    document.addEventListener("click", klick, true);
    window.addEventListener("popstate", zurueck);
    return () => {
      if (zurueckFrist.current) clearTimeout(zurueckFrist.current);
      window.removeEventListener("beforeunload", vorEntladen);
      document.removeEventListener("click", klick, true);
      window.removeEventListener("popstate", zurueck);
      // Am Ort gesichert oder verworfen, und der Wächter ist noch der
      // aktuelle Eintrag: einen Schritt zurück auf den Eintrag darunter —
      // dieselbe Seite — und dort die Adresse übernehmen, die gerade gilt
      // (sie kann sich beim Schliessen schon geändert haben).
      if (amOrt && !freigegeben.current && !gehtZurueck.current && aufWaechter()) {
        const ziel = window.location.href;
        aufWaechterRef.current = false;
        // Über den Router und nicht über `replaceState`: Er stellt nach dem
        // Zurück den Eintrag darunter wieder her und schriebe dessen alte
        // Adresse sonst über die neue. Seine Schritte laufen der Reihe nach.
        const angekommen = () => {
          window.removeEventListener("popstate", angekommen);
          const url = new URL(ziel);
          if (window.location.href !== ziel) router.replace(url.pathname + url.search, { scroll: false });
        };
        window.addEventListener("popstate", angekommen);
        window.history.back();
      }
    };
  }, [aktiv, router, amOrt]);

  function bleiben() {
    ausstehend?.bleiben?.();
    setAusstehend(null);
  }

  function verlassen() {
    const weiter = ausstehend?.weiter;
    setAusstehend(null);
    freigegeben.current = true;
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
