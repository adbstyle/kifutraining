"use client";

import { useEffect, useMemo, useState } from "react";
import { AuswahlListe, Button, ChoiceChip, ChoiceChipGroup, Dialog, SectionMessage } from "@/components/ui";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import type { TerminZeile } from "@/lib/queries/termine";

/* Einem Training aus dem Team-Bestand einen Termin wählen (#323 AK 2, 7, 8).
   Jeder Termin des Teams steht zur Wahl — auch vergangene (AK 13) — ausser
   dem, den das Training schon trägt. Bei jedem steht, ob und welches
   Training er trägt. Gehört das Training schon einem ANSTEHENDEN Termin,
   muss zwischen Kopie und Verschieben gewählt werden; bei einem
   vergangenen entsteht immer eine Kopie.

   `training` ist der schmale Ausschnitt, den der Dialog braucht: Ein
   persönliches Training (#328 AK 2) hat keinen Termin und keine Team-Zeile.
   Mit `hinweis` steht ein Satz über der Liste — dort sagt das persönliche
   Training, dass eine Kopie entsteht (#328 AK 6). */
export function TerminWahlDialog({
  training,
  termine,
  heute,
  pending,
  fehler,
  hinweis,
  onClose,
  onWahl,
}: {
  training: { id: string; name: string; termin: { id: string; datum: string } | null } | null;
  /** Anstehende aufsteigend, dann vergangene absteigend (`teilePlan`). */
  termine: TerminZeile[];
  heute: string;
  pending?: boolean;
  /** Die Meldung des Servers; der Dialog bleibt dann offen. */
  fehler?: string;
  /** Ein Satz über der Liste, etwa «Es entsteht eine Kopie im Team». */
  hinweis?: string;
  onClose: () => void;
  onWahl: (w: { termin: TerminZeile; art?: "kopie" | "verschieben" }) => void;
}) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [art, setArt] = useState<"kopie" | "verschieben" | null>(null);
  useEffect(() => { setGewaehlt(null); setArt(null); }, [training]);

  const liste = useMemo(
    // Ein ausgefallener Termin trägt auf keinem Weg ein Training (#327 AK 9).
    () => termine.filter((t) => t.id !== training?.termin?.id && !t.ausgefallen),
    [termine, training],
  );
  const wahl = liste.find((t) => t.id === gewaehlt) ?? null;
  const eigenAnstehend = training?.termin ? training.termin.datum >= heute : false;
  const bereit = wahl !== null && (!eigenAnstehend || art !== null);

  return (
    <Dialog
      open={training !== null}
      onClose={onClose}
      title="Termin zuordnen"
      actions={
        <>
          <Button variant="text" onClick={onClose}>Abbrechen</Button>
          <Button
            variant="filled"
            disabled={!bereit || pending}
            onClick={() =>
              wahl && onWahl({
                termin: wahl,
                art: training?.termin ? (eigenAnstehend ? art! : "kopie") : undefined,
              })
            }
          >
            Zuordnen
          </Button>
        </>
      }
    >
      {fehler && <SectionMessage appearance="error" className="mb-4">{fehler}</SectionMessage>}
      {hinweis && <p className="mb-3">{hinweis}</p>}
      {liste.length === 0 ? (
        <p>
          {termine.some((t) => t.id !== training?.termin?.id)
            ? "Alle weiteren Termine sind ausgefallen. Lege einen neuen im Trainingsplan fest."
            : "Das Team hat noch keinen weiteren Termin. Lege ihn im Trainingsplan fest."}
        </p>
      ) : (
        <AuswahlListe
          ariaLabel="Termine des Teams"
          items={liste.map((t) => {
            return {
              id: t.id,
              titel: `${datumKurz(t.datum)} · ${zeitText(t.beginn, t.ende)} Uhr`,
              untertitel: t.training ? `Trägt «${t.training.name}»` : "Ohne Training",
              gedaempft: t.datum < heute,
            };
          })}
          wert={gewaehlt}
          onWahl={setGewaehlt}
        />
      )}
      {training?.termin && eigenAnstehend && (
        <div className="mt-4">
          <p className="mb-2">
            «{training.name}» ist schon für {datumKurz(training.termin.datum)} eingeplant.
          </p>
          <ChoiceChipGroup ariaLabel="Kopieren oder verschieben">
            <ChoiceChip tabStop selected={art === "kopie"} onSelect={() => setArt("kopie")} look="nutzertext">
              Kopie für den gewählten Termin
            </ChoiceChip>
            <ChoiceChip selected={art === "verschieben"} onSelect={() => setArt("verschieben")} look="nutzertext">
              Auf ihn verschieben
            </ChoiceChip>
          </ChoiceChipGroup>
        </div>
      )}
      {training?.termin && !eigenAnstehend && (
        <p className="mt-4">
          «{training.name}» gehört zum vergangenen Termin {datumKurz(training.termin.datum)}. Für
          den gewählten entsteht eine eigenständige Kopie.
        </p>
      )}
    </Dialog>
  );
}
