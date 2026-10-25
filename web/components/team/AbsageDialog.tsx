"use client";

import { useEffect, useId, useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { tagOhneJahr } from "@/lib/monat";
import { trainerName, type TerminTrainer } from "@/lib/trainer";

/* Die Verantwortliche sagt ab (#520 AK 4, 19, PC 1; Tafel «Absage»). Sind
   andere Eingeladene dabei, übernimmt zuerst eine von ihnen — gewählt im
   selben Schritt. Ist niemand sonst dabei, darf sie trotzdem absagen: Der
   Termin steht dann ohne Verantwortliche:n da und fällt im Plan auf.
   «Jemanden einladen» führt zum Reiter «Trainer:innen». */
export function AbsageDialog({
  frage,
  ich,
  pending,
  onClose,
  onAbsagen,
  onEinladen,
}: {
  /** `null`: geschlossen. `wer` ist die Verantwortliche, die absagt. */
  frage: { datum: string; art: "training" | "spiel"; wer: TerminTrainer; andere: readonly TerminTrainer[] } | null;
  ich: string;
  pending?: boolean;
  onClose: () => void;
  /** `uebernimmt`: wer übernimmt; ohne, wenn niemand sonst dabei ist. */
  onAbsagen: (uebernimmt?: string) => void;
  onEinladen: () => void;
}) {
  const [wahl, setWahl] = useState<string | null>(null);
  const legende = useId();
  useEffect(() => {
    setWahl(frage?.andere[0]?.userId ?? null);
  }, [frage]);
  const termin = `${frage?.art === "spiel" ? "das Spiel" : "das Training"} vom ${frage ? tagOhneJahr(frage.datum) : ""}`;
  const name = (t: TerminTrainer) => (t.userId === ich ? `${trainerName(t)} (du)` : trainerName(t));
  const selbst = frage?.wer.userId === ich;

  if (frage && frage.andere.length === 0)
    return (
      <Dialog
        open
        onClose={onClose}
        title="Niemand sonst ist dabei"
        actions={
          <>
            <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
            <Button variant="outlined" onClick={onEinladen}>Jemanden einladen</Button>
            <Button variant="filled" disabled={pending} onClick={() => onAbsagen()}>Trotzdem absagen</Button>
          </>
        }
      >
        <p>
          {selbst ? "Du bist" : `${trainerName(frage.wer)} ist`} für {termin} verantwortlich, und alle anderen Eingeladenen haben
          abgesagt.
        </p>
        <p className="mt-3">
          {selbst ? "Sagst du" : "Sagt sie"} ab, ist niemand verantwortlich und niemand dabei. Der Termin fällt im Trainingsplan
          auf, bis jemand zusagt oder eingeladen wird.
        </p>
      </Dialog>
    );

  return (
    <Dialog
      open={frage !== null}
      onClose={onClose}
      title="Wer übernimmt?"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>Abbrechen</Button>
          <Button variant="filled" disabled={pending || !wahl} onClick={() => wahl && onAbsagen(wahl)}>
            Übergeben und absagen
          </Button>
        </>
      }
    >
      {frage && (
        <div className="flex flex-col gap-3">
          <p>
            {selbst ? "Du bist" : `${trainerName(frage.wer)} ist`} für {termin} verantwortlich. Bevor{" "}
            {selbst ? "du absagst" : "sie absagt"}, übernimmt jemand, der dabei ist.
          </p>
          <fieldset>
            <legend id={legende} className="type-label-small pb-1 text-on-surface-mittel">
              Verantwortung geben an
            </legend>
            <div role="radiogroup" aria-labelledby={legende}>
              {frage.andere.map((t) => (
                <label key={t.eintragId} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-linie py-1 last:border-b-0">
                  <input
                    type="radio"
                    name="uebernimmt"
                    className="focus-ring size-[18px] accent-primary"
                    checked={wahl === t.userId}
                    onChange={() => setWahl(t.userId)}
                  />
                  <span className="flex-1 text-on-surface">{name(t)}</span>
                  <span className="type-body-small text-on-surface-mittel">dabei</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </Dialog>
  );
}
