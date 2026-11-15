"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, NamenBestaetigen, namenStimmen } from "@/components/ui";
import { loescheVereinAktion } from "@/lib/actions/verein";
import { VEREIN_LOESCHEN_TEXT, vereinLoeschenFolgen, vereinLoeschenTitel, zielWeg } from "@/lib/verein";

/* Den Verein löschen (Epic Vereine #575, Story #587 AK 10, 11): der Dialog der
   Gefahrenzone von «Verein › Verwaltung», nach dem Muster von «Team auflösen»
   (#480). Er nennt, was verschwindet — Teams, Spieler:innen auch ohne Team,
   Links, Abos und Abholadressen — und was aus den Personen wird, und verlangt
   den Vereinsnamen. Den Namen und die Zahlen liefert die Seite; ändert sich der
   Name inzwischen, bleibt der Dialog offen, nennt den aktuellen und lädt die
   Seite neu. Danach leitet die Action selbst nach `/teams`.

   Eine laufende Anfrage sperrt Eingabe und Knöpfe, ein zweiter Versuch nach
   einem Fehler geht. */
export function VereinLoeschen({
  offen,
  onClose,
  vereinId,
  vereinName,
  anzahlTeams,
  anzahlSpieler,
  spielerOhneTeam,
  anzahlPersonen,
}: {
  offen: boolean;
  onClose: () => void;
  vereinId: string;
  vereinName: string;
  anzahlTeams: number;
  anzahlSpieler: number;
  spielerOhneTeam: number;
  anzahlPersonen: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const passt = namenStimmen(eingabe, vereinName);
  const folgen = vereinLoeschenFolgen({ teams: anzahlTeams, spieler: anzahlSpieler, ohneTeam: spielerOhneTeam, personen: anzahlPersonen });

  const [zuletztOffen, setZuletztOffen] = useState(false);
  if (offen !== zuletztOffen) {
    setZuletztOffen(offen);
    if (offen) {
      setEingabe("");
      setFehler(null);
    }
  }

  function ausfuehren() {
    if (!passt || pending) return;
    setFehler(null);
    startTransition(async () => {
      // Gelingt es, leitet die Action selbst nach /teams um.
      const r = await loescheVereinAktion(vereinId, eingabe);
      setFehler(r.error);
      // Der Name hat sich geändert: die Seite nachladen, damit der verlangte
      // Name im Dialog der aktuelle ist. Ist der Verein weg, leitet sie um.
      if (r.feld === "vereinsname" || zielWeg(r.feld)) router.refresh();
    });
  }

  const schliessen = () => !pending && onClose();
  const formId = "verein-loeschen";

  return (
    <Dialog
      open={offen}
      onClose={schliessen}
      title={vereinLoeschenTitel(vereinName)}
      actions={
        <>
          <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={!passt || pending}>
            {VEREIN_LOESCHEN_TEXT.knopf}
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
          ausfuehren();
        }}
      >
        {folgen.geloescht.length > 0 ? (
          <>
            <p>{VEREIN_LOESCHEN_TEXT.einleitung}</p>
            <ul className="list-disc space-y-1 pl-5">
              {folgen.geloescht.map((zeile) => (
                <li key={zeile}>{zeile}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>{VEREIN_LOESCHEN_TEXT.leer}</p>
        )}
        <p>{folgen.personen}</p>
        <p className="font-medium text-on-surface">{VEREIN_LOESCHEN_TEXT.endgueltig}</p>
        <NamenBestaetigen
          name={vereinName}
          wert={eingabe}
          onChange={setEingabe}
          label={VEREIN_LOESCHEN_TEXT.feld}
          fehler={fehler}
          gesperrt={pending}
        />
      </form>
    </Dialog>
  );
}
