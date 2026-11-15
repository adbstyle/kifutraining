"use client";

import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from "react";
import { BestandAnzeige, Button, Dialog, SectionMessage } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ladeBestandAktion } from "@/lib/actions/konto-bestand";
import {
  bestandSatz,
  grenzeAusAbweisung,
  istVoll,
  type KontoAbweisung,
  type KontoArt,
  type KontoGrenze,
} from "@/lib/konto-grenzen";

/** Ob für das Konto Grenzen gelten (#588): Die Seite kennt die Lage schon
 *  (`getMeineGrenzen`) und gibt sie den Einstiegen darunter mit. Ohne Angabe
 *  fragt die Stufe den Stand (der sichere Weg). */
const MitGrenzen = createContext(true);

/** Gibt den Einstiegen Kopieren, Übernehmen und «In die Bibliothek» darunter
 *  mit, ob für das Konto Grenzen gelten. Ein Konto in einem Verein
 *  (`mitGrenzen={false}`) führt dann mit einem Klick aus, ohne Zusatz-Rundreise.
 *  Ist die mitgegebene Lage veraltet, entscheidet die Datenebene, und ihre
 *  Abweisung erscheint als bleibende Meldung. */
export function KontoGrenzenLage({ mitGrenzen, children }: { mitGrenzen: boolean; children: ReactNode }) {
  return <MitGrenzen.Provider value={mitGrenzen}>{children}</MitGrenzen.Provider>;
}

/** Was `ausfuehren` liefert: `null` im Erfolg, sonst die Meldung und, bei einer
 *  Abweisung an der Grenze, deren Merkmal aus der Action. */
export type StufenFehler = { error: string; grenze?: KontoAbweisung } | null;

const UNERWARTET = "Das liess sich gerade nicht ausführen. Bitte versuche es noch einmal.";

/**
 * Die Stufe vor Kopieren, Übernehmen und «In die Bibliothek» für Konten ohne
 * Verein (Story #588 AK 5, 6).
 *
 * Diese Wege waren Ein-Klick-Aktionen. Für ein Konto in einem Verein bleiben
 * sie es, genau wie vorher: `starte` führt sofort aus, ihr Fehler geht in die
 * Snackbar. Nur ein Konto ohne Verein fragt zuerst den Stand frisch (nicht den
 * Zähler einer älteren Seite) und sieht einen Dialog:
 *  - frei: «Du besitzt 12 von 50 Übungen.», dazu der Knopf der Aktion;
 *  - voll (auch über der Grenze): die Meldung der vollen Grenze mit dem Weg zur
 *    eigenen Übersicht und nur «Schliessen» — bevor die Person etwas tut;
 *  - die Datenebene weist trotz freier Anzeige an der Grenze ab (Rennen,
 *    veraltete Lage): dieselbe Form wie «voll». Erkannt am Merkmal `grenze`
 *    der Action, nie am Text. Andere Fehler bleiben im Dialog stehen, ein
 *    zweiter Versuch ist möglich.
 *
 * Gesperrt: Die Aktion läuft in einer Transition wie vorher. Im Erfolg bleibt
 * der Auslöser gesperrt, bis Weiterleitung oder Neuladen fertig sind — ein
 * schneller zweiter Klick erzeugt keine zweite Kopie. Der Auslöser sperrt mit
 * `aria-disabled` (`laeuft`), nicht `disabled`, damit er den Fokus behält; der
 * native Dialog gibt ihn beim Schliessen an ihn zurück.
 */
export function useBestandStufe({
  art,
  titel,
  aktion,
  hinweis,
  ausfuehren,
}: {
  art: KontoArt;
  /** Der Dialogtitel, etwa «Übung kopieren». */
  titel: string;
  /** Der Knopf der Aktion, etwa «Kopieren». */
  aktion: string;
  /** Ein Satz nach dem Stand, was entsteht. */
  hinweis: string;
  /** Tut die Aktion samt Weiterleitung oder Meldung im Erfolg. */
  ausfuehren: () => Promise<StufenFehler>;
}): { starte: () => void; laeuft: boolean; dialog: ReactNode } {
  const mitGrenzen = useContext(MitGrenzen);
  const melde = useSnackbar();
  const [fuehrtAus, startAusfuehren] = useTransition();
  const [fragt, setFragt] = useState(false);
  const [offen, setOffen] = useState<{ grenze: KontoGrenze | null; fehler: string | null; abgewiesen: boolean } | null>(
    null,
  );
  // Jede Anfrage und jedes Schliessen zählt hoch: Eine Antwort mit alter Zahl
  // hat sich überholt und wird verworfen.
  const lauf = useRef(0);
  // Sofort gesetzt, noch vor dem nächsten Rendern: Ein zweiter Klick im selben
  // Augenblick findet ihn schon.
  const belegt = useRef(false);
  const laeuft = fragt || fuehrtAus;

  function schliessen() {
    if (belegt.current || fuehrtAus) return;
    lauf.current++;
    setOffen(null);
  }

  function ausfuehrenGesichert(nr: number, imDialog: boolean) {
    belegt.current = true;
    startAusfuehren(async () => {
      let r: StufenFehler;
      try {
        r = await ausfuehren();
      } catch {
        r = { error: UNERWARTET };
      }
      // Im Erfolg bleibt die Transition offen, bis die Zielseite steht; so
      // lange sperrt `fuehrtAus` den Auslöser weiter.
      belegt.current = false;
      if (nr !== lauf.current) return;
      if (r === null) {
        setOffen(null);
        return;
      }
      if (r.grenze) setOffen({ grenze: grenzeAusAbweisung(r.grenze), fehler: null, abgewiesen: true });
      else if (imDialog) {
        const fehler = r.error;
        setOffen((o) => ({ grenze: o?.grenze ?? null, fehler, abgewiesen: false }));
      } else melde(r.error);
    });
  }

  function starte() {
    if (belegt.current || laeuft || offen) return;
    const nr = ++lauf.current;
    // Ein Konto in einem Verein: wie vorher ein Klick, ohne Zusatz-Rundreise.
    if (!mitGrenzen) {
      ausfuehrenGesichert(nr, false);
      return;
    }
    belegt.current = true;
    setFragt(true);
    void (async () => {
      const stand = await ladeBestandAktion(art).catch(() => null);
      belegt.current = false;
      setFragt(false);
      if (nr !== lauf.current) return;
      // Inzwischen in einem Verein, oder ein Stand, der sich nicht lesen
      // liess: sofort ausführen. Die Datenebene entscheidet.
      if (!stand?.ok || stand.grenze === null) {
        ausfuehrenGesichert(nr, false);
        return;
      }
      setOffen({ grenze: stand.grenze, fehler: null, abgewiesen: false });
    })();
  }

  const grenze = offen?.grenze ?? null;
  const voll = grenze !== null && (offen?.abgewiesen || (istVoll(grenze) && offen?.fehler == null));

  const dialog = (
    <Dialog
      open={offen !== null}
      onClose={schliessen}
      title={titel}
      actions={
        voll ? (
          <Button type="button" variant="outlined" onClick={schliessen}>
            Schliessen
          </Button>
        ) : (
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={laeuft}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="filled"
              disabled={laeuft}
              onClick={() => {
                if (belegt.current || laeuft) return;
                ausfuehrenGesichert(++lauf.current, true);
              }}
            >
              {laeuft ? "Einen Moment…" : aktion}
            </Button>
          </>
        )
      }
    >
      {offen && (
        <div className="flex flex-col gap-3">
          {voll && grenze ? (
            <BestandAnzeige art={art} grenze={grenze} variante="meldung" />
          ) : offen.fehler ? (
            <SectionMessage appearance="error">{offen.fehler}</SectionMessage>
          ) : (
            grenze && (
              <p>
                {bestandSatz(art, grenze)} {hinweis}
              </p>
            )
          )}
        </div>
      )}
    </Dialog>
  );

  return { starte, laeuft, dialog };
}
