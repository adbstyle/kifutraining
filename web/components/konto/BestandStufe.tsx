"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Dialog, SectionMessage } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { ladeBestandAktion } from "@/lib/actions/konto-bestand";
import {
  bestandSatz,
  bestandVollMeldung,
  istKontoGrenzeMeldung,
  istVoll,
  type KontoArt,
  type KontoGrenze,
} from "@/lib/konto-grenzen";

/**
 * Die Stufe vor Kopieren, Übernehmen und «In die Bibliothek» für Konten ohne
 * Verein (Story #588 AK 5, 6).
 *
 * Diese Wege waren Ein-Klick-Aktionen. Für ein Konto in einem Verein bleiben
 * sie es: `starte` fragt zuerst den Stand frisch (nicht den Zähler einer
 * älteren Seite), und gilt keine Grenze (`grenze: null`), läuft die Aktion
 * sofort, ihr Fehler geht wie bisher in die Snackbar. Nur ein Konto ohne Verein
 * sieht einen Dialog:
 *  - frei: «Du besitzt 12 von 50 Übungen.», dazu der Knopf der Aktion;
 *  - voll (auch über der Grenze): die Meldung, dass nichts mehr frei ist, und
 *    nur «Schliessen» — bevor die Person etwas tut;
 *  - die Datenebene weist trotz freier Anzeige ab (Rennen, überholter Stand):
 *    die Auskunft bleibt als Meldung im Dialog stehen, und ein zweiter
 *    Versuch ist möglich.
 *
 * Die Anzeige entscheidet nie: Die Datenebene weist ab, und kein Knopf bleibt
 * wegen eines Stands gesperrt, den die Person nicht gelesen hat. Während einer
 * Anfrage sperren Knöpfe und Escape, ein zweiter Klick startet keine zweite
 * Anfrage, und eine Antwort, die nach dem Schliessen eintrifft, ändert nichts.
 *
 * `ausfuehren` tut die Aktion samt Weiterleitung oder Meldung im Erfolg und
 * liefert nur den Fehlertext, oder `null`.
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
  ausfuehren: () => Promise<string | null>;
}): { starte: () => void; laeuft: boolean; dialog: ReactNode } {
  const melde = useSnackbar();
  const [laeuft, setLaeuft] = useState(false);
  const [offen, setOffen] = useState<{ grenze: KontoGrenze | null; fehler: string | null } | null>(null);
  // Jede Anfrage und jedes Schliessen zählt hoch: Eine Antwort mit alter Zahl
  // hat sich überholt und wird verworfen.
  const lauf = useRef(0);
  const belegt = useRef(false);

  function schliessen() {
    if (belegt.current && offen) return;
    lauf.current++;
    setOffen(null);
  }

  async function ausfuehrenGesichert(nr: number, imDialog: boolean) {
    belegt.current = true;
    setLaeuft(true);
    let fehler: string | null;
    try {
      fehler = await ausfuehren();
    } catch {
      fehler = "Das liess sich gerade nicht ausführen. Bitte versuche es noch einmal.";
    }
    belegt.current = false;
    setLaeuft(false);
    if (nr !== lauf.current) return;
    if (fehler === null) {
      setOffen(null);
      return;
    }
    // Die Abweisung der Grenze hat drei Sätze: Für die Snackbar zu lang, sie
    // bleibt stehen (AK 6). Alles andere meldet die Snackbar wie bisher.
    if (imDialog || istKontoGrenzeMeldung(fehler)) setOffen((o) => ({ grenze: o?.grenze ?? null, fehler }));
    else melde(fehler);
  }

  function starte() {
    if (belegt.current || offen) return;
    const nr = ++lauf.current;
    belegt.current = true;
    setLaeuft(true);
    void (async () => {
      const stand = await ladeBestandAktion(art).catch(() => null);
      if (nr !== lauf.current) {
        belegt.current = false;
        setLaeuft(false);
        return;
      }
      // Ein Konto in einem Verein, oder ein Stand, der sich nicht lesen liess:
      // sofort ausführen. Die Datenebene entscheidet.
      if (!stand?.ok || stand.grenze === null) {
        belegt.current = false;
        await ausfuehrenGesichert(nr, false);
        return;
      }
      belegt.current = false;
      setLaeuft(false);
      setOffen({ grenze: stand.grenze, fehler: null });
    })();
  }

  const grenze = offen?.grenze ?? null;
  const voll = grenze !== null && istVoll(grenze) && offen?.fehler == null;

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
                if (belegt.current) return;
                void ausfuehrenGesichert(++lauf.current, true);
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
            <SectionMessage appearance="warning">
              <p className="font-medium">{bestandVollMeldung(art, grenze).titel}</p>
              <p className="mt-1">{bestandVollMeldung(art, grenze).text}</p>
            </SectionMessage>
          ) : (
            <>
              {offen.fehler ? (
                <SectionMessage appearance="error">{offen.fehler}</SectionMessage>
              ) : (
                grenze && (
                  <p>
                    {bestandSatz(art, grenze)} {hinweis}
                  </p>
                )
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );

  return { starte, laeuft, dialog };
}
