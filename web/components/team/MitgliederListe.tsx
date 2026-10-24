"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Dialog, IconButton, Tabelle, TabellenZeile, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { entferneMitglied, nimmMitgliedAuf, sucheTrainer } from "@/lib/actions/teams";
import type { TeamMitglied } from "@/lib/queries/teams";

/* Die Mitglieder eines Teams (Story 4) — gebaut wie die Spielerliste (PO
   2026-10-17): Kopf mit Zahl und «+», darunter eine Tabelle mit Name und
   E-Mail-Adresse, damit erkennbar ist, wer hinter einer automatischen
   Kennung oder einem Kürzel steckt (#425), und «X» zum Entfernen.

   Aufgenommen wird im Dialog, bewusst zweistufig: erst nachsehen, wer sich
   hinter der Adresse verbirgt, dann im selben Dialog bestätigen. «Zurück»
   führt mit der Adresse wieder ins Feld, falls die Vorschau die falsche
   Person zeigt. */
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
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [aufnahme, setAufnahme] = useState(false);
  const [email, setEmail] = useState("");
  const [fehler, setFehler] = useState<string | undefined>();
  // Gefunden: der Anzeigename der Person, die man nun bestätigt.
  const [vorschau, setVorschau] = useState<string | null>(null);
  const [entfernen, setEntfernen] = useState<TeamMitglied | null>(null);
  const formId = useId();
  const aufnehmenKnopf = useRef<HTMLButtonElement>(null);

  // Nach der Suche verschwindet das Feld mit dem Fokus; er geht auf
  // «Aufnehmen», sobald der Knopf nach der Anfrage bedienbar ist.
  useEffect(() => {
    if (vorschau && !pending) aufnehmenKnopf.current?.focus();
  }, [vorschau, pending]);

  function aufnahmeSchliessen() {
    setAufnahme(false);
    setEmail("");
    setFehler(undefined);
    setVorschau(null);
  }

  function suchen() {
    setFehler(undefined);
    startTransition(async () => {
      const res = await sucheTrainer(teamId, email);
      if (res.status === "gefunden") setVorschau(res.anzeigeName);
      else if (res.status === "bereits_mitglied") setFehler("Diese Person ist bereits im Team.");
      else setFehler(res.error);
    });
  }

  function aufnehmen() {
    startTransition(async () => {
      const res = await nimmMitgliedAuf(teamId, email);
      if (!res.ok) {
        setVorschau(null);
        setFehler(res.error);
        return;
      }
      aufnahmeSchliessen();
      router.refresh();
      melde(`${res.anzeigeName} ist jetzt im Team.`);
    });
  }

  function entfernenAusfuehren(mitglied: TeamMitglied) {
    startTransition(async () => {
      const res = await entferneMitglied(teamId, mitglied.userId);
      setEntfernen(null);
      if (res.status === "fehler") {
        melde(res.error);
        return;
      }
      if (res.status === "team_weg") {
        router.push("/teams?weg=1");
        return;
      }
      router.refresh();
      melde(`${mitglied.anzeigeName} ist nicht mehr im Team.`);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title-large text-on-surface">
          Mitglieder
          <span className="type-label-small ml-2 text-on-surface-mittel">{mitglieder.length}</span>
        </h2>
        <Tooltip label="Mitglied hinzufügen" ende>
          <IconButton icon={Plus} label="Mitglied hinzufügen" aria-haspopup="dialog" onClick={() => setAufnahme(true)} />
        </Tooltip>
      </div>
      <p className="type-body-medium mt-2 text-on-surface-mittel">
        Alle Mitglieder sind gleichberechtigt: Jede und jeder darf das Team umbenennen, Trainings und Termine planen,
        die Spielerliste führen, Mitglieder aufnehmen und entfernen und das Team auflösen.
      </p>

      <Tabelle className="mt-4" spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]" kopf={["Name", "E-Mail-Adresse", ""]}>
        {mitglieder.map((m) => (
          <TabellenZeile key={m.userId}>
              <span className="min-w-0 flex-1">
                <span className="type-body-medium block truncate text-on-surface">
                  {m.anzeigeName}
                  {m.userId === eigeneUserId && <span className="type-label-small ml-2 text-on-surface-mittel">(du)</span>}
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

      <Dialog
        open={aufnahme}
        onClose={() => !pending && aufnahmeSchliessen()}
        title={vorschau ? "Ins Team aufnehmen?" : "Mitglied hinzufügen"}
        actions={
          <>
            {vorschau ? (
              <Button type="button" variant="outlined" onClick={() => setVorschau(null)} disabled={pending}>
                Zurück
              </Button>
            ) : (
              <Button type="button" variant="outlined" onClick={aufnahmeSchliessen} disabled={pending}>
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
            <strong className="text-on-surface">{vorschau}</strong> <span className="break-all">({email.trim()})</span> wurde
            gefunden. Als Mitglied sieht und bearbeitet diese Person alle Trainings und Termine des Teams.
          </p>
        ) : (
          <form
            id={formId}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              suchen();
            }}
          >
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
              info="Die Person braucht bereits ein bestätigtes KiFu-Konto."
            />
          </form>
        )}
      </Dialog>

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
