"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, SectionMessage } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { LEERE_ANGABEN, SpielerFelder, type SpielerAngaben, type SpielerFehler } from "@/components/spieler/SpielerFelder";
import { aendereSpielerImVereinAktion, legeSpielerImVereinAnAktion } from "@/lib/actions/verein";
import type { VereinSpieler } from "@/lib/kern/verein";
import { SPIELER_TEXT, bereinigeName } from "@/lib/spieler";
import { spielerErfassenEinleitung, zielWeg } from "@/lib/verein";

/* Erfassen und Ändern einer Spieler:in im Spielerbestand des Vereins (Story
   #582 AK 2–7, 15): ein Dialog mit den vier Feldern des Team-Orts
   (`SpielerFelder`). Erfassen legt sie ohne Team an; danach schliesst der
   Dialog, und die Snackbar sagt, wer erfasst ist. Eine Abweisung — gleiche
   Angaben schon im Verein, Grenze des Vereins, gelöscht — steht als Meldung im
   Dialog; nur die Prüfung eines Feldes («Bitte einen Vornamen …») steht am
   Feld. Ist die Spieler:in inzwischen gelöscht, lädt die Liste neu. */

const FELD_TEXTE: string[] = Object.values(SPIELER_TEXT);

const ausSpieler = (s: VereinSpieler | null): SpielerAngaben =>
  s ? { vorname: s.vorname, nachname: s.nachname, jahrgang: String(s.jahrgang), jsNummer: s.js ?? "" } : LEERE_ANGABEN;

export function VereinSpielerFormular({
  offen,
  vereinId,
  vereinName,
  onClose,
}: {
  /** `null`: zu; sonst die Spieler:in, die geändert wird, oder `{ spieler: null }` zum Erfassen. */
  offen: { spieler: VereinSpieler | null } | null;
  vereinId: string;
  vereinName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [wert, setWert] = useState<SpielerAngaben>(LEERE_ANGABEN);
  const [fehler, setFehler] = useState<SpielerFehler | null>(null);
  // Beim Öffnen die Angaben der Spieler:in setzen (Zustand an die Eigenschaft
  // anpassen, wie React es für diesen Fall vorsieht).
  const [zuletzt, setZuletzt] = useState(offen);
  if (offen !== zuletzt) {
    setZuletzt(offen);
    if (offen) {
      setWert(ausSpieler(offen.spieler));
      setFehler(null);
    }
  }

  const spieler = offen?.spieler ?? null;

  function speichern() {
    if (!offen || pending) return;
    const name = `${bereinigeName(wert.vorname)} ${bereinigeName(wert.nachname)}`;
    startTransition(async () => {
      const r = spieler ? await aendereSpielerImVereinAktion(spieler.id, wert) : await legeSpielerImVereinAnAktion(vereinId, vereinName, wert);
      if (!r.ok) {
        setFehler({ feld: r.feld, text: r.error });
        // Gelöscht, solange der Dialog offen war: Die Liste lädt neu.
        if (zielWeg(r.feld)) router.refresh();
        return;
      }
      onClose();
      router.refresh();
      melde(spieler ? `${name} geändert.` : `${name} ist erfasst.`);
    });
  }

  const amFeld = fehler !== null && FELD_TEXTE.includes(fehler.text);

  return (
    <Dialog
      open={offen !== null}
      onClose={() => !pending && onClose()}
      title={spieler ? "Spieler:in ändern" : "Spieler:in erfassen"}
      actions={
        <>
          <Button type="button" variant="outlined" onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" form={formId} variant="filled" disabled={pending}>
            {spieler ? "Speichern" : "Erfassen"}
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
          speichern();
        }}
      >
        {!spieler && <p>{spielerErfassenEinleitung(vereinName)}</p>}
        {fehler && !amFeld && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
        <SpielerFelder
          wert={wert}
          onAendern={(k, text) => {
            setWert((w) => ({ ...w, [k]: text }));
            setFehler(null);
          }}
          fehler={amFeld ? fehler : null}
        />
      </form>
    </Dialog>
  );
}
