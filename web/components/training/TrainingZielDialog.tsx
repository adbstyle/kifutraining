"use client";

import { useEffect, useState } from "react";
import { Button, ChoiceChip, ChoiceChipGroup, Dialog } from "@/components/ui";
import type { TeamUebersicht } from "@/lib/queries/teams";

/** Wohin die Kopie geht. Dieselbe Form, die `uebernimmTraining` erwartet —
 *  `teamName` steht nur für die Rückmeldung daneben. */
export type KopieZielWahl =
  | { art: "persoenlich" }
  | { art: "team"; teamId: string; teamName: string };

/* Wohin die Kopie eines Trainings geht — ein Dialog für beide Wege (#249
   AK 11/12).

   Übernehmen und Ins-Team-Stellen stellen dieselbe Frage: Wer soll die neue
   Kopie besitzen? Bis zu dieser Story beantworteten sie sie verschieden —
   Übernehmen über ein Menü ohne Rückfrage, Ins-Team-Stellen über ein Menü und
   danach einen Bestätigungsdialog. Beide hingen an einem eigenen Knopf; aus
   dem Überlaufmenü heraus ginge das nicht mehr, denn ein Menü im Menü kennt
   das Kit nicht (und sollte es auch nicht).

   Darum: eine Stufe, ein Dialog. Die Ziele stehen als Einfachauswahl da —
   dieselben `ChoiceChip`, mit denen auch die Variante des Hauptteils gewählt
   wird —, darunter der Satz, der sagt, was gleich geschieht, und ein Knopf.
   Die Teamnamen tragen `look="nutzertext"`: Sie sind vom Trainer vergeben, und
   Versalien verfälschten sie.

   Kein Kit-Baustein, sondern ein Bauteil der Trainings-Domäne: «Ich selbst
   oder eines meiner Teams» ist das Eigentumsmodell aus `training-zugriff.ts`,
   kein wiederverwendbares Bedienmuster. */
export function TrainingZielDialog({
  open,
  onClose,
  modus,
  teams,
  pending,
  onBestaetigen,
}: {
  open: boolean;
  onClose: () => void;
  /** Steuert Titel, Wortlaut und ob «Für mich» überhaupt ein Ziel ist. Beim
   *  Ins-Team-Stellen ist es keines — das Training liegt ja schon bei einem
   *  selbst. */
  modus: "uebernehmen" | "ins_team_stellen";
  teams: readonly TeamUebersicht[];
  pending: boolean;
  onBestaetigen: (ziel: KopieZielWahl) => void;
}) {
  const uebernehmen = modus === "uebernehmen";
  const [gewaehlt, setGewaehlt] = useState<string>(uebernehmen ? "" : (teams[0]?.id ?? ""));

  // Beim Öffnen wieder auf die Vorgabe: Ein Dialog, der die Wahl vom letzten
  // Mal noch trägt, lässt beim flüchtigen Blick das Falsche bestätigt aussehen.
  // Vorbelegt ist, was ohne Nachdenken gilt — beim Übernehmen man selbst, beim
  // Ins-Team-Stellen das erste (und oft einzige) Team.
  useEffect(() => {
    if (open) setGewaehlt(uebernehmen ? "" : (teams[0]?.id ?? ""));
  }, [open, uebernehmen, teams]);

  const zielTeam = teams.find((t) => t.id === gewaehlt);
  const ziel: KopieZielWahl | null = zielTeam
    ? { art: "team", teamId: zielTeam.id, teamName: zielTeam.name }
    : uebernehmen
      ? { art: "persoenlich" }
      : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={uebernehmen ? "Training übernehmen?" : "Kopie ins Team stellen?"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant="filled"
            disabled={pending || ziel === null}
            onClick={() => ziel && onBestaetigen(ziel)}
          >
            {uebernehmen ? "Übernehmen" : "Ins Team stellen"}
          </Button>
        </>
      }
    >
      <ChoiceChipGroup
        ariaLabel={uebernehmen ? "Wohin übernehmen" : "In welches Team stellen"}
        className="mb-4"
      >
        {uebernehmen && (
          <ChoiceChip
            selected={gewaehlt === ""}
            tabStop={gewaehlt === ""}
            onSelect={() => setGewaehlt("")}
          >
            Für mich
          </ChoiceChip>
        )}
        {teams.map((t, i) => (
          <ChoiceChip
            key={t.id}
            look="nutzertext"
            selected={gewaehlt === t.id}
            tabStop={gewaehlt === "" && !uebernehmen && i === 0}
            onSelect={() => setGewaehlt(t.id)}
          >
            {t.name}
          </ChoiceChip>
        ))}
      </ChoiceChipGroup>

      {/* Was «Kopie» hier heisst, steht ausdrücklich da: «stellen» und
          «übernehmen» klingen beide nach Verschieben. */}
      {zielTeam ? (
        <>
          <p>
            Das Team{" "}
            <strong className="text-on-surface">{zielTeam.name}</strong> bekommt
            eine eigenständige Kopie dieses Trainings. Jedes Mitglied darf sie
            bearbeiten und terminieren.
          </p>
          <p className="mt-3">
            {uebernehmen
              ? "Das Training, aus dem sie hervorgeht, bleibt unverändert — spätere Änderungen wirken in keine Richtung."
              : "Dein Training bleibt unverändert bei dir — spätere Änderungen wirken in keine Richtung."}
          </p>
        </>
      ) : (
        <p>
          Du bekommst eine eigenständige, private Kopie dieses Trainings und
          kannst sie frei bearbeiten. Das Original bleibt unberührt — spätere
          Änderungen wirken in keine Richtung.
        </p>
      )}
    </Dialog>
  );
}
