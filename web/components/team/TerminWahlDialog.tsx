"use client";

import { useEffect, useMemo, useState } from "react";
import { AuswahlListe, Button, Dialog, SectionMessage } from "@/components/ui";
import { trainingOhneTermin, zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Training einen Termin wählen (#323 AK 2, 7, 8; #328 AK 2): aus dem
   Bestand des Teams oder vom eigenen persönlichen Training aus. Jeder Termin
   des Teams steht zur Wahl — auch vergangene (AK 13) — ausser ausgefallenen.
   Der gewählte Termin bekommt still eine eigene Kopie, ein Termin-Training;
   das Training selbst bleibt, wo es ist (PO 2026-10-06). Trägt der Termin
   schon ein Training, sagt seine Zeile, was mit ihm geschieht.

   `training` ist der schmale Ausschnitt, den der Dialog braucht. */
export function TerminWahlDialog({
  training,
  termine,
  heute,
  pending,
  fehler,
  onClose,
  onWahl,
}: {
  training: { id: string; name: string } | null;
  /** Anstehende aufsteigend, dann vergangene absteigend (`teilePlan`). */
  termine: TerminZeile[];
  heute: string;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  onClose: () => void;
  onWahl: (termin: TerminZeile) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  useEffect(() => setGewaehlt(null), [training]);

  // Einem ausgefallenen Termin lässt sich kein Training zuordnen (#327 AK 9).
  const liste = useMemo(() => termine.filter((t) => !t.ausgefallen), [termine]);
  const wahl = liste.find((t) => t.id === gewaehlt) ?? null;

  return (
    <Dialog
      open={training !== null}
      onClose={onClose}
      title="Termin zuordnen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={!wahl || pending} onClick={() => wahl && onWahl(wahl)}>
            Zuordnen
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      {liste.length === 0 ? (
        <p>
          {termine.length > 0
            ? "Alle Termine sind ausgefallen. Lege einen neuen im Trainingsplan fest."
            : "Das Team hat noch keinen Termin. Lege ihn im Trainingsplan fest."}
        </p>
      ) : (
        <AuswahlListe
          ariaLabel="Termine des Teams"
          items={liste.map((t) => ({
            id: t.id,
            titel: `${datumKurz(t.datum)} · ${zeitText(t.beginn, t.ende)} Uhr`,
            untertitel: t.training ? `Trägt «${t.training.name}» - ${trainingOhneTermin(t.training.terminTraining)}` : "Ohne Training",
            gedaempft: t.datum < heute,
          }))}
          wert={gewaehlt}
          onWahl={setGewaehlt}
        />
      )}
    </Dialog>
  );
}
