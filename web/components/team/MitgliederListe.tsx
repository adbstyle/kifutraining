"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserRound, X } from "lucide-react";
import {
  Button,
  Dialog,
  IconButton,
  Lozenge,
  PersonAufnehmen,
  Tabelle,
  TabellenZeile,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { entferneMitglied, nimmMitgliedAuf, sucheTrainer } from "@/lib/actions/teams";
import type { TeamMitglied } from "@/lib/queries/teams";

/* Die Mitglieder eines Teams (Story 4) — gebaut wie die Spielerliste (PO
   2026-10-17): Kopf mit Zahl und «+», darunter eine Tabelle mit Name und
   E-Mail-Adresse, damit erkennbar ist, wer hinter einer automatischen
   Kennung oder einem Kürzel steckt (#425), und «X» zum Entfernen.

   Wer zur Vereinsverwaltung gehört, trägt die Plakette «Vereinsverwaltung»
   (#581 AK 15) und lässt sich wie jedes andere Mitglied entfernen (AK 16).
   Aufgenommen wird über `PersonAufnehmen` — hier als Mitglied des Teams; die
   Verwaltung nimmt im Bereich «Verein» auf. Geht das letzte Mitglied, bleibt
   das Team bestehen. */
export function MitgliederListe({
  teamId,
  mitglieder,
  eigeneUserId,
  vereinName,
}: {
  teamId: string;
  mitglieder: TeamMitglied[];
  eigeneUserId: string;
  /** Für die Tragweite der Aufnahme; ohne Verein «dem Verein». */
  vereinName: string | null;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [aufnahme, setAufnahme] = useState(false);
  const [entfernen, setEntfernen] = useState<TeamMitglied | null>(null);

  function entfernenAusfuehren(mitglied: TeamMitglied) {
    startTransition(async () => {
      const res = await entferneMitglied(teamId, mitglied.userId);
      setEntfernen(null);
      if (res.status === "fehler") {
        melde(res.error);
        return;
      }
      router.refresh();
      melde(`${mitglied.anzeigeName} ist nicht mehr im Team.`);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <UserRound size={20} strokeWidth={2} aria-hidden />
          <span>
            Mitglieder
            <span className="type-label-small ml-2 text-on-surface-mittel">{mitglieder.length}</span>
          </span>
        </h2>
        <Tooltip label="Trainer:in aufnehmen" ende>
          <IconButton icon={Plus} label="Trainer:in aufnehmen" aria-haspopup="dialog" onClick={() => setAufnahme(true)} />
        </Tooltip>
      </div>
      <p className="type-body-medium mt-2 text-on-surface-mittel">
        Alle Mitglieder sind gleichberechtigt: Jede und jeder darf Trainings und Termine planen, die Spielerliste
        führen und Mitglieder aufnehmen und entfernen. Umbenennen und Auflösen macht die Vereinsverwaltung im
        Bereich «Verein».
      </p>

      <Tabelle className="mt-4" spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]" kopf={["Name", "E-Mail-Adresse", ""]}>
        {mitglieder.map((m) => (
          <TabellenZeile key={m.userId}>
              <span className="min-w-0 flex-1">
                <span className="type-body-medium block truncate text-on-surface">
                  {m.anzeigeName}
                  {m.userId === eigeneUserId && <span className="type-label-small ml-2 text-on-surface-mittel">(du)</span>}
                  {m.istVerwaltung && (
                    <Lozenge appearance="neutral" className="ml-2 align-middle">
                      Vereinsverwaltung
                    </Lozenge>
                  )}
                </span>
                {/* Schmal steht die Adresse unter dem Namen. */}
                <span className="type-body-small block break-all text-on-surface-mittel sm:hidden">{m.email}</span>
              </span>
              {/* Umbrechen statt kürzen: Abgeschnitten fehlte gerade der Teil
                  der Adresse, der zwei Mitglieder unterscheidet. */}
              <span className="type-body-medium hidden break-all text-on-surface-mittel sm:block">{m.email}</span>
              <span className="flex justify-end">
                {/* Sich selbst entfernt man über «Team verlassen» — dort hängt der
                    Hinweis, was der Austritt bedeutet. */}
                {m.userId !== eigeneUserId && (
                  <Tooltip label="Aus dem Team entfernen" ende>
                    <IconButton icon={X} label={`${m.anzeigeName} (${m.email}) aus dem Team entfernen`} onClick={() => setEntfernen(m)} />
                  </Tooltip>
                )}
              </span>
            </TabellenZeile>
          ))}
      </Tabelle>

      <PersonAufnehmen
        offen={aufnahme}
        onClose={() => setAufnahme(false)}
        titel="Trainer:in aufnehmen"
        einleitung="Die Person braucht ein Konto bei KiFu. Sie ist sofort im Team, ohne Einladung."
        tragweite={[
          `Sie gehört damit zum ${vereinName ?? "Verein"}. Solange sie dabei ist, kann sie keinem anderen Verein beitreten und keinen gründen. Die Vereinsverwaltung und das Trainerteam sehen ihre E-Mail-Adresse. Prüfe, dass es das richtige Konto ist.`,
        ]}
        suche={(email) => sucheTrainer(teamId, email)}
        aufnahme={(email) => nimmMitgliedAuf(teamId, email)}
        onAufgenommen={(anzeigeName) => {
          router.refresh();
          melde(`${anzeigeName} ist jetzt im Team.`);
        }}
      />

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title="Aus dem Team entfernen?"
        actions={
          <>
            <Button variant="outlined" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => entfernen && entfernenAusfuehren(entfernen)} disabled={pending}>
              Entfernen
            </Button>
          </>
        }
      >
        {/* Mit Adresse: Bei Gleichnamigen oder automatischen Kennungen sagt
            erst sie, wen man entfernt (#425). */}
        <p>
          <strong className="text-on-surface">{entfernen?.anzeigeName}</strong>{" "}
          <span className="break-all">({entfernen?.email})</span> sieht die Trainings und Termine dieses Teams danach
          nicht mehr. Persönliche Trainings dieser Person bleiben unberührt.
        </p>
      </Dialog>
    </>
  );
}
