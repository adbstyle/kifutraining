"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus, UserRound } from "lucide-react";
import { Button, Dialog, IconButton, Snackbar, TextField, Tooltip } from "@/components/ui";
import { entferneMitglied, nimmMitgliedAuf, sucheTrainer } from "@/lib/actions/teams";
import type { TeamMitglied } from "@/lib/queries/teams";

/* Mitgliederliste mit Aufnahme über eine Vorschau (Story 4).
   Gezeigt werden ausschliesslich Anzeigenamen — E-Mail-Adressen bekommt hier
   niemand zu sehen, auch nicht die eigene Eingabe anderer. Die Aufnahme läuft
   bewusst zweistufig: erst nachsehen, wer sich hinter der Adresse verbirgt,
   dann bestätigen. */
export function MitgliederListe({
  teamId,
  mitglieder,
  eigeneUserId,
}: {
  teamId: string;
  mitglieder: TeamMitglied[];
  eigeneUserId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [entfernen, setEntfernen] = useState<TeamMitglied | null>(null);

  function suchen() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await sucheTrainer(teamId, email);
      if (res.status === "gefunden") setVorschau(res.anzeigeName);
      else if (res.status === "bereits_mitglied")
        setFehler("Diese Person ist bereits im Team.");
      else setFehler(res.error);
    });
  }

  function aufnehmen() {
    startTransition(async () => {
      const res = await nimmMitgliedAuf(teamId, email);
      setVorschau(null);
      if (res.ok) {
        setEmail("");
        router.refresh();
        setNotice(`${res.anzeigeName} ist jetzt im Team.`);
      } else {
        setFehler(res.error);
      }
    });
  }

  function entfernenAusfuehren(mitglied: TeamMitglied) {
    startTransition(async () => {
      const res = await entferneMitglied(teamId, mitglied.userId);
      setEntfernen(null);
      if (res.status === "fehler") {
        setNotice(res.error);
        return;
      }
      router.refresh();
      setNotice(`${mitglied.anzeigeName} ist nicht mehr im Team.`);
    });
  }

  return (
    <>
      <ul className="flex flex-col gap-2">
        {mitglieder.map((m) => (
          <li
            key={m.userId}
            className="flex items-center gap-3 rounded-flaeche bg-elev-01 px-4 py-3"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elev-08 text-on-surface">
              <UserRound size={18} strokeWidth={2} aria-hidden />
            </span>
            <span className="type-body-large min-w-0 flex-1 truncate text-on-surface">
              {m.anzeigeName}
              {m.userId === eigeneUserId && (
                <span className="type-label-small ml-2 text-on-surface-mittel">(du)</span>
              )}
            </span>
            {/* Sich selbst entfernt man über „Team verlassen" — dort hängt der
                Hinweis, was der Austritt bedeutet. */}
            {m.userId !== eigeneUserId && (
              <Tooltip label="Aus dem Team entfernen">
                <IconButton
                  icon={UserMinus}
                  label={`${m.anzeigeName} aus dem Team entfernen`}
                  onClick={() => setEntfernen(m)}
                />
              </Tooltip>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        onSubmit={(e) => {
          e.preventDefault();
          suchen();
        }}
      >
        <TextField
          label="E-Mail-Adresse"
          type="email"
          className="flex-1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!!fehler}
          supportingText={fehler ?? "Die Person braucht bereits ein bestätigtes KiFu-Konto."}
        />
        <Button type="submit" variant="tonal" disabled={pending} className="sm:mt-1.5">
          <UserPlus size={18} strokeWidth={2} aria-hidden />
          Suchen
        </Button>
      </form>

      <Dialog
        open={vorschau != null}
        onClose={() => setVorschau(null)}
        title="Ins Team aufnehmen?"
        actions={
          <>
            <Button variant="text" onClick={() => setVorschau(null)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={aufnehmen} disabled={pending}>
              Aufnehmen
            </Button>
          </>
        }
      >
        <p>
          <strong className="text-on-surface">{vorschau}</strong> wurde gefunden.
          Als Mitglied sieht und bearbeitet diese Person alle Trainings und
          Termine des Teams.
        </p>
      </Dialog>

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title="Aus dem Team entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => entfernen && entfernenAusfuehren(entfernen)}
              disabled={pending}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          <strong className="text-on-surface">{entfernen?.anzeigeName}</strong>{" "}
          sieht die Trainings und Termine dieses Teams danach nicht mehr.
          Persönliche Trainings dieser Person bleiben unberührt.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
