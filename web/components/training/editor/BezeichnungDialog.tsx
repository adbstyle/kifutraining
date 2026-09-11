"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button, Dialog, TextField } from "@/components/ui";

/**
 * Ein Feld, ein Knopf: der Dialog für eine vom Trainer vergebene Bezeichnung
 * (#209 AK 2/6).
 *
 * Drei Fälle nutzen ihn — Gruppe anlegen, Gruppe umbenennen, Variante
 * umbenennen —, und sie unterscheiden sich nur im Wortlaut und darin, wohin
 * gespeichert wird. Ein Baustein statt dreier fast gleicher: Die Regel
 * (`bezeichnungProblem`) ist für Gruppe und Variante ohnehin dieselbe, und die
 * Tücken sind es auch — Zurücksetzen beim Öffnen, Enter als Abschluss, die
 * Laufschranke gegen den zweiten Klick.
 *
 * ZWEI Prüfungen, wie im Bestand (`VarianteAnlegenDialog`): `pruefe` ist die
 * frühe, sprechende Antwort aus dem lokalen Bestand, `speichere` die Antwort
 * der Datenbank — sie bleibt die Trust-Boundary und sieht als einzige zwei
 * gleichzeitige Anlagen. Beide Meldungen landen am FELD und nicht in der
 * Snackbar am Seitenrand: Dort stünden sie weit weg von der Eingabe, die sie
 * betreffen (AK 2/6).
 *
 * Der Dialog schliesst sich nicht selbst — er ruft `onClose`. Wer ihn öffnet,
 * hält den Zustand, und nur dort ist bekannt, was danach geschieht (Snackbar,
 * Fokus).
 */
export function BezeichnungDialog({
  open,
  onClose,
  titel,
  hinweis,
  feldLabel = "Bezeichnung",
  wert = "",
  max,
  hilfetext,
  aktion = "Speichern",
  pruefe,
  speichere,
  onFertig,
}: {
  open: boolean;
  onClose: () => void;
  titel: string;
  /** Einleitungssatz über dem Feld — sagt, was die Bezeichnung benennt. */
  hinweis?: ReactNode;
  /** Sichtbare Beschriftung des Felds. */
  feldLabel?: string;
  /** Vorbelegung. Leer heisst „anlegen": Dann ist der unveränderte Wert kein
   *  gültiger Abschluss, sondern eine leere Eingabe. */
  wert?: string;
  /** Längstmögliche Bezeichnung — begrenzt das Feld und steht im Hilfetext. */
  max: number;
  /** Was unter dem Feld steht, solange es nichts zu melden gibt. */
  hilfetext?: string;
  /** Beschriftung des bestätigenden Knopfs („Anlegen", „Speichern"). */
  aktion?: string;
  /** Die lokale Vorabprüfung: `null`, wenn nichts im Weg steht. */
  pruefe: (name: string) => string | null;
  /** Speichert und meldet zurück, was die Datenbank dagegen hatte — `null`
   *  heisst geglückt. */
  speichere: (name: string) => Promise<string | null>;
  /** Nach geglücktem Speichern, mit der gespeicherten Bezeichnung. */
  onFertig?: (name: string) => void;
}) {
  const [entwurf, setEntwurf] = useState(wert);
  const [fehler, setFehler] = useState<string | undefined>();
  const [laeuft, startTransition] = useTransition();
  // Ein zweiter Klick, während der erste unterwegs ist, legte zwei Gruppen an —
  // `useTransition` allein hält ihn nicht auf, weil der Aufruf in der Action
  // steckt und nicht im Rendern (Muster `VarianteAnlegenDialog`).
  const unterwegs = useRef(false);

  // Beim Öffnen zurücksetzen: Der Dialog überlebt im Baum (natives <dialog>),
  // und ein abgebrochener Versuch soll den nächsten nicht vorbelegen.
  useEffect(() => {
    if (!open) return;
    setEntwurf(wert);
    setFehler(undefined);
  }, [open, wert]);

  function absenden() {
    if (unterwegs.current) return;
    const name = entwurf.trim();
    // Beim Umbenennen ist der unveränderte Name kein Speichervorgang: Der
    // Trainer hat den Dialog geöffnet und es sich anders überlegt — das ist ein
    // Schliessen und kein Schreibzugriff auf die Datenbank.
    if (wert.trim() !== "" && name === wert.trim()) {
      onClose();
      return;
    }
    const problem = pruefe(name);
    if (problem) {
      setFehler(problem);
      return;
    }
    unterwegs.current = true;
    startTransition(async () => {
      try {
        const meldung = await speichere(name);
        if (meldung) {
          setFehler(meldung);
          return;
        }
        onFertig?.(name);
        onClose();
      } finally {
        unterwegs.current = false;
      }
    });
  }

  function beiTaste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Der Dialog hat kein Formular; Enter ist trotzdem der erwartete Abschluss
    // einer einzeiligen Eingabe.
    e.preventDefault();
    absenden();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={titel}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="filled" onClick={absenden} disabled={laeuft}>
            {aktion}
          </Button>
        </>
      }
    >
      {hinweis && <p className="mb-4">{hinweis}</p>}
      <TextField
        label={feldLabel}
        value={entwurf}
        maxLength={max}
        autoComplete="off"
        autoFocus
        onChange={(e) => {
          setEntwurf(e.target.value);
          // Der Fehler gehört zum abgelehnten Stand; wer weiterschreibt, hat
          // ihn beantwortet.
          if (fehler) setFehler(undefined);
        }}
        onKeyDown={beiTaste}
        error={!!fehler}
        supportingText={fehler ?? hilfetext}
      />
    </Dialog>
  );
}
