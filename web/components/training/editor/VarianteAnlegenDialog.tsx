"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { Button, Dialog, TextField } from "@/components/ui";
import { legeVarianteAn } from "@/lib/actions/varianten";
import {
  VARIANTE_NAME_MAX,
  varianteNameProblem,
  type Variante,
} from "@/lib/varianten";

/**
 * Eine weitere Variante des Hauptteils anlegen (#201 AK 1/2).
 *
 * Beim Anlegen der ZWEITEN Variante fragt der Dialog nach ZWEI Bezeichnungen:
 * Bis dahin trug der Hauptteil einen Vorgabenamen, den der Trainer nie gesehen
 * hat — ab jetzt steht er als Chip in der Leiste und muss sagen, wofür diese
 * Fassung gedacht war (AK 2). Ab der dritten Variante ist der Bestand benannt,
 * dann genügt das eine Feld.
 *
 * Geprüft wird vor dem Abschicken, damit die Meldung am Feld steht und nicht
 * am Seitenrand — und beide Eingaben auch GEGENEINANDER: Der Unique-Index der
 * Datenbank sähe diese Kollision erst, wenn die halbe Umbenennung schon stünde.
 * Die Datenbank prüft trotzdem noch einmal; sie ist die Trust-Boundary.
 */
export function VarianteAnlegenDialog({
  open,
  onClose,
  trainingId,
  aktive,
  varianten,
  onAngelegt,
}: {
  open: boolean;
  onClose: () => void;
  trainingId: string;
  /** Die angezeigte Variante — sie wird kopiert (PC 1) und ist im Zwei-Feld-Fall
   *  diejenige, die ihre Bezeichnung bekommt. */
  aktive: Variante;
  /** Alle Varianten des Trainings — Grundlage der Kollisionsprüfung. */
  varianten: readonly Variante[];
  /** Angelegt: die neue Variante wird zur angezeigten, und der Editor frischt
   *  die Serverdaten auf. */
  onAngelegt: (varianteId: string, name: string) => void;
}) {
  // Die erste Variante trägt ihren Vorgabenamen nur in der Datenbank. Sichtbar
  // wird er jetzt — darum steht er als Vorschlag im Feld, überschreibbar.
  const zweiFelder = varianten.length < 2;
  const [neu, setNeu] = useState("");
  const [quelle, setQuelle] = useState(aktive.name);
  const [fehlerNeu, setFehlerNeu] = useState<string | undefined>();
  const [fehlerQuelle, setFehlerQuelle] = useState<string | undefined>();
  const [laeuft, startTransition] = useTransition();
  // Ein zweiter Klick auf «Anlegen», während der erste unterwegs ist, legte
  // zwei Varianten an — `useTransition` allein hält ihn nicht auf, weil der
  // Aufruf in der Action und nicht im Rendern steckt (Muster `GruppenZeile`).
  const unterwegs = useRef(false);

  // Beim Öffnen zurücksetzen: Der Dialog überlebt im Baum, und ein
  // abgebrochener Versuch soll den nächsten nicht vorbelegen.
  useEffect(() => {
    if (!open) return;
    setNeu("");
    setQuelle(aktive.name);
    setFehlerNeu(undefined);
    setFehlerQuelle(undefined);
  }, [open, aktive.name]);

  function anlegen() {
    if (unterwegs.current) return;
    const nameNeu = neu.trim();
    const nameQuelle = zweiFelder ? quelle.trim() : undefined;

    // Erst die Quelle: Sie darf ihren bisherigen Namen behalten, darum zählt
    // ihre eigene Zeile nicht als vergeben.
    const problemQuelle =
      nameQuelle === undefined
        ? null
        : varianteNameProblem(nameQuelle, varianten, aktive.id);
    // Die neue Bezeichnung gegen den Bestand, WIE ER NACH DER UMBENENNUNG
    // aussieht — sonst liesse sich beiden Feldern derselbe Name geben.
    const nachher = varianten.map((v) =>
      v.id === aktive.id && nameQuelle !== undefined ? { ...v, name: nameQuelle } : v,
    );
    const problemNeu = varianteNameProblem(nameNeu, nachher);
    setFehlerQuelle(problemQuelle ?? undefined);
    setFehlerNeu(problemNeu ?? undefined);
    if (problemQuelle || problemNeu) return;

    unterwegs.current = true;
    startTransition(async () => {
      try {
        const r = await legeVarianteAn(trainingId, aktive.id, nameNeu, nameQuelle);
        if (r.ok) {
          onAngelegt(r.varianteId, nameNeu);
          return;
        }
        // Die Meldung gehört an das Feld, das sie betrifft. Zuordnen lässt sie
        // sich nur beim Namenskonflikt sicher — und der kommt aus der
        // Datenbank immer für die neue Bezeichnung: die Umbenennung der Quelle
        // hätte die Vorabprüfung oben schon abgefangen.
        setFehlerNeu(r.error);
      } finally {
        unterwegs.current = false;
      }
    });
  }

  function beiTaste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Der Dialog hat kein Formular; Enter ist trotzdem der erwartete Abschluss
    // einer Eingabe.
    e.preventDefault();
    anlegen();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Variante hinzufügen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="filled" onClick={anlegen} disabled={laeuft}>
            Anlegen
          </Button>
        </>
      }
    >
      <p className="mb-4">
        Die neue Variante beginnt als Kopie von „{aktive.name}" — mit allen
        Übungen, Dauern, Notizen und der Gruppenverteilung. Danach sind beide
        unabhängig.
      </p>
      <div className="flex flex-col gap-4">
        {zweiFelder && (
          <TextField
            label="Bezeichnung des bisherigen Hauptteils"
            value={quelle}
            maxLength={VARIANTE_NAME_MAX}
            autoComplete="off"
            onChange={(e) => {
              setQuelle(e.target.value);
              if (fehlerQuelle) setFehlerQuelle(undefined);
            }}
            onKeyDown={beiTaste}
            error={!!fehlerQuelle}
            supportingText={
              fehlerQuelle ??
              "Unter diesem Namen steht der bisherige Hauptteil künftig in der Leiste."
            }
          />
        )}
        <TextField
          label="Bezeichnung der neuen Variante"
          value={neu}
          maxLength={VARIANTE_NAME_MAX}
          autoComplete="off"
          autoFocus
          onChange={(e) => {
            setNeu(e.target.value);
            if (fehlerNeu) setFehlerNeu(undefined);
          }}
          onKeyDown={beiTaste}
          error={!!fehlerNeu}
          supportingText={
            fehlerNeu ??
            `Woran du sie erkennst, etwa „21 Kinder". Höchstens ${VARIANTE_NAME_MAX} Zeichen.`
          }
        />
      </div>
    </Dialog>
  );
}
