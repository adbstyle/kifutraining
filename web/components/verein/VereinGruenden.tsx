"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Dialog, SectionMessage, TextField } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { gruendeVereinAktion } from "@/lib/actions/verein";
import { VEREIN_GRUENDEN_TEXT, vereinsNameProblem, zielWeg } from "@/lib/verein";

/* «Verein gründen» auf dem Einstieg für Konten ohne Verein (Epic Vereine #575,
   Story #587 AK 1–4): ein Knopf mit Dialog. Der Dialog verlangt den Namen und
   zwei Bestätigungen — die Person darf für den Verein handeln, und der Verein
   verantwortet die Daten seiner Spieler:innen —, bevor der Knopf frei wird.
   Die Datenebene prüft beides beim Ausführen selbst.

   Eine laufende Anfrage sperrt Eingaben und Knöpfe; nach einem Fehler geht ein
   zweiter Versuch. Gelingt das Gründen, leitet die Action selbst in den
   Bereich «Verein» um. Gehört die Person inzwischen einem Verein an
   (`feld: "verein_id"`), ist die Seite überholt: Der Satz steht auch in der
   Snackbar, denn mit dem Neuladen verschwindet der Dialog. */
export function VereinGruenden() {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState("");
  const [berechtigt, setBerechtigt] = useState(false);
  const [verantwortlich, setVerantwortlich] = useState(false);
  const [fehler, setFehler] = useState<{ amFeld: boolean; text: string } | null>(null);
  const formId = useId();
  const frei = berechtigt && verantwortlich;

  function oeffnen() {
    setName("");
    setBerechtigt(false);
    setVerantwortlich(false);
    setFehler(null);
    setOffen(true);
  }

  function schliessen() {
    if (!pending) setOffen(false);
  }

  function gruenden() {
    if (pending || !frei) return;
    const problem = vereinsNameProblem(name);
    if (problem) return setFehler({ amFeld: true, text: problem });
    setFehler(null);
    startTransition(async () => {
      // Gelingt es, leitet die Action selbst in den Bereich «Verein» um.
      const r = await gruendeVereinAktion(name, true);
      setFehler({ amFeld: r.art === "eingabe" && r.feld === "name", text: r.error });
      if (zielWeg(r.feld)) {
        melde(r.error);
        router.refresh();
      }
    });
  }

  return (
    <>
      <Button variant="filled" aria-haspopup="dialog" onClick={oeffnen}>
        {VEREIN_GRUENDEN_TEXT.knopf}
      </Button>

      <Dialog
        open={offen}
        onClose={schliessen}
        title={VEREIN_GRUENDEN_TEXT.titel}
        actions={
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={!frei || pending}>
              {VEREIN_GRUENDEN_TEXT.knopf}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            gruenden();
          }}
        >
          {fehler && !fehler.amFeld && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
          <TextField
            label={VEREIN_GRUENDEN_TEXT.feld}
            info={VEREIN_GRUENDEN_TEXT.info}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            autoFocus
            disabled={pending}
            error={!!fehler?.amFeld}
            supportingText={fehler?.amFeld ? fehler.text : undefined}
          />
          <div className="flex flex-col gap-1">
            <Checkbox
              label={VEREIN_GRUENDEN_TEXT.haken1}
              checked={berechtigt}
              onChange={(e) => setBerechtigt(e.target.checked)}
              disabled={pending}
            />
            <Checkbox
              label={VEREIN_GRUENDEN_TEXT.haken2}
              checked={verantwortlich}
              onChange={(e) => setVerantwortlich(e.target.checked)}
              disabled={pending}
            />
          </div>
          <p>{VEREIN_GRUENDEN_TEXT.erste}</p>
        </form>
      </Dialog>
    </>
  );
}
