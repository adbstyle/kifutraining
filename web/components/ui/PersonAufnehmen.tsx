"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { SectionMessage } from "./SectionMessage";
import { TextField } from "./TextField";

/** Das Ergebnis eines Schritts: die Person samt Anzeigename — oder der fertige
 *  Satz, der sagt, warum es nicht weitergeht. Die Sätze stehen in
 *  `PERSON_MELDUNG` (lib/verein.ts), damit Team- und Vereinsweg gleich
 *  sprechen. */
export type PersonSchritt = { ok: true; anzeigeName: string } | { ok: false; meldung: string };

/* Eine Person aufnehmen — ins Trainerteam oder in die Vereinsverwaltung (#581,
   AP §7.5). Ein Dialog in zwei Stufen, den Team-Ort und Vereins-Ort teilen:

   1. Adresse eingeben und lesen, was die Aufnahme für die Person bedeutet
      (`tragweite`) → «Suchen».
   2. Den Anzeigenamen samt Adresse prüfen → «Aufnehmen».

   Bewusst zweistufig: Die Vorschau verhindert, dass jemand versehentlich eine
   fremde Person aufnimmt — eine dokumentierte Ausnahme von der
   Anti-Enumeration-Linie, die darum bremst (Epic #518). «Zurück» führt mit der
   Adresse wieder ins Feld, falls die Vorschau die falsche Person zeigt.

   Der Baustein kennt weder Team noch Verein: Er bekommt Suche und Aufnahme als
   Funktionen und bleibt so dort, wo er gebraucht wird, derselbe Ablauf. Ist
   die Person aufgenommen, schliesst er sich und meldet es mit dem
   Anzeigenamen; das Neuladen der Liste und die Snackbar sind Sache der
   Stelle. */
export function PersonAufnehmen({
  offen,
  onClose,
  titel,
  einleitung,
  tragweite,
  suche,
  aufnahme,
  onAufgenommen,
}: {
  offen: boolean;
  onClose: () => void;
  /** Z. B. «Trainer:in aufnehmen» oder «Person in die Verwaltung aufnehmen». */
  titel: string;
  /** Ein Satz über dem Feld: wer aufgenommen werden kann. */
  einleitung: string;
  /** Absätze unter «Was das für die Person bedeutet». */
  tragweite: string[];
  suche: (email: string) => Promise<PersonSchritt>;
  aufnahme: (email: string) => Promise<PersonSchritt>;
  onAufgenommen: (anzeigeName: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState<string | undefined>();
  // Gefunden: der Anzeigename der Person, die man nun bestätigt.
  const [vorschau, setVorschau] = useState<string | null>(null);
  const formId = useId();
  const aufnehmenKnopf = useRef<HTMLButtonElement>(null);

  // Nach der Suche verschwindet das Feld mit dem Fokus; er geht auf
  // «Aufnehmen», sobald der Knopf nach der Anfrage bedienbar ist.
  useEffect(() => {
    if (vorschau && !pending) aufnehmenKnopf.current?.focus();
  }, [vorschau, pending]);

  function schliessen() {
    if (pending) return;
    setEmail("");
    setFehler(undefined);
    setVorschau(null);
    onClose();
  }

  function suchen() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await suche(email);
      if (res.ok) setVorschau(res.anzeigeName);
      else setFehler(res.meldung);
    });
  }

  function aufnehmen() {
    startTransition(async () => {
      const res = await aufnahme(email);
      if (!res.ok) {
        setVorschau(null);
        setFehler(res.meldung);
        return;
      }
      setEmail("");
      setFehler(undefined);
      setVorschau(null);
      onClose();
      onAufgenommen(res.anzeigeName);
    });
  }

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title={vorschau ? `${titel}?` : titel}
      actions={
        <>
          {vorschau ? (
            <Button type="button" variant="outlined" onClick={() => setVorschau(null)} disabled={pending}>
              Zurück
            </Button>
          ) : (
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
          )}
          {vorschau ? (
            <Button ref={aufnehmenKnopf} variant="filled" onClick={aufnehmen} disabled={pending}>
              Aufnehmen
            </Button>
          ) : (
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              Suchen
            </Button>
          )}
        </>
      }
    >
      {vorschau ? (
        <p>
          <strong className="text-on-surface">{vorschau}</strong>{" "}
          <span className="break-all">({email.trim()})</span> wurde gefunden. Prüfe, dass es das richtige Konto ist.
        </p>
      ) : (
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            suchen();
          }}
        >
          <p>{einleitung}</p>
          <TextField
            label="E-Mail-Adresse"
            type="email"
            autoFocus
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFehler(undefined);
            }}
            error={!!fehler}
            supportingText={fehler}
          />
          <SectionMessage appearance="information">
            <strong className="font-semibold">Was das für die Person bedeutet</strong>
            {tragweite.map((absatz) => (
              <span key={absatz} className="mt-1 block">
                {absatz}
              </span>
            ))}
          </SectionMessage>
        </form>
      )}
    </Dialog>
  );
}
