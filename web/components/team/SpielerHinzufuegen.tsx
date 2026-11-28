"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, MultiSelect, SectionMessage } from "@/components/ui";
import { KopfKnopfText } from "@/components/layout/KopfAktionen";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { nimmSpielerAufAktion } from "@/lib/actions/spieler";
import { aendereZuteilungAktion } from "@/lib/actions/kader";
import type { Kader } from "@/lib/kader";
import { kaderHinweisText, SPIELER_GESPERRT_ID, type SpielerSperre } from "@/lib/spieler";
import { SpielerFelder, istFeldFehler, type SpielerAngaben, type SpielerFehler } from "@/components/spieler/SpielerFelder";

/* «Spieler:in hinzufügen» (#706): die Hauptaktion der Spieler:innen eines
   Teams, in der Kopfzeile jedes Reiters gleich (AK 2, 3). Sie legt eine neue
   Person an — der Begriff ist im Team und im Verein derselbe.

   Der Dialog führt die Felder untereinander (PO 2026-10-17); «Abbrechen»
   schliesst ihn, ohne zu speichern. «Hinzufügen» und Enter nehmen auf, danach
   bleibt er für die nächste offen und sagt, wer eben dazukam — die Snackbar
   läge unter dem Dialog. Führt das Team Kader (#452), wählt man sie gleich mit
   (AK 5).

   Gesperrt, solange die Spielerliste des Teams oder der Spielerbestand des
   Vereins voll ist (AK 7, `sperre`): Der Knopf bleibt sichtbar und verweist
   auf den Satz mit dem Grund unter der Kopfzeile (`SPIELER_GESPERRT_ID`,
   gesetzt im Rahmen der Spieler:innen). Das Rennen deckt die Datenebene. */

type Form = SpielerAngaben & { kaderIds: string[] };
const LEER: Form = { vorname: "", nachname: "", jahrgang: "", jsNummer: "", kaderIds: [] };

export function SpielerHinzufuegen({
  teamId,
  kader,
  sperre,
}: {
  teamId: string;
  /** Die Kader des Teams (#452), nach Namen. */
  kader: Kader[];
  sperre: SpielerSperre | null;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [offen, setOffen] = useState(false);
  const [form, setForm] = useState<Form>(LEER);
  const [fehler, setFehler] = useState<SpielerFehler | null>(null);
  // Wer eben aufgenommen wurde — im noch offenen Dialog.
  const [aufgenommen, setAufgenommen] = useState<string | null>(null);
  const erstesFeld = useRef<HTMLInputElement>(null);
  const formId = useId();

  function oeffnen() {
    setForm(LEER);
    setFehler(null);
    setAufgenommen(null);
    setOffen(true);
  }

  function schliessen() {
    if (pending) return;
    setOffen(false);
  }

  function hinzufuegen() {
    if (pending) return;
    const eingabe = { vorname: form.vorname, nachname: form.nachname, jahrgang: form.jahrgang, jsNummer: form.jsNummer };
    const name = `${form.vorname.trim()} ${form.nachname.trim()}`;
    startTransition(async () => {
      const r = await nimmSpielerAufAktion(teamId, eingabe);
      if (!r.ok) return setFehler({ feld: r.feld, text: r.error });
      // Wer neu dazukommt, verliert keinen Termin: Zuteilen lässt nichts verfallen.
      if (form.kaderIds.length > 0) {
        const z = await aendereZuteilungAktion(teamId, { spielerIds: [r.spielerId], dazu: form.kaderIds, weg: [] });
        if (!z.ok) melde(z.error);
      }
      setForm(LEER);
      setFehler(null);
      router.refresh();
      erstesFeld.current?.focus();
      setAufgenommen(
        r.ersetzt > 0
          ? `${name} ist auf der Liste. Die Spielerzahl kommt jetzt aus ihr; ${r.ersetzt === 1 ? "eine erwartete Zahl gilt" : `${r.ersetzt} erwartete Zahlen gelten`} nicht mehr.`
          : `${name} ist auf der Liste.`,
      );
    });
  }

  const aendern = (k: keyof SpielerAngaben, text: string) => {
    setForm((f) => ({ ...f, [k]: text }));
    setFehler(null);
    setAufgenommen(null);
  };
  const gewaehlteNamen = kader.filter((k) => form.kaderIds.includes(k.id)).map((k) => k.name);

  return (
    <>
      <Button
        variant="filled"
        aria-haspopup="dialog"
        disabled={sperre !== null}
        aria-describedby={sperre ? SPIELER_GESPERRT_ID : undefined}
        onClick={oeffnen}
      >
        <KopfKnopfText label="Spieler:in hinzufügen" kurz="Hinzufügen" />
      </Button>

      <Dialog
        open={offen}
        onClose={schliessen}
        title="Spieler:in hinzufügen"
        actions={
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              Hinzufügen
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
            hinzufuegen();
          }}
        >
          {aufgenommen && <SectionMessage appearance="success">{aufgenommen}</SectionMessage>}
          {fehler && !istFeldFehler(fehler) && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
          <SpielerFelder wert={form} onAendern={aendern} fehler={fehler} erstesFeld={erstesFeld} />
          {kader.length > 0 && (
            <MultiSelect
              label="Kader (optional)"
              options={kader.map((k) => ({ value: k.id, label: k.name }))}
              value={form.kaderIds}
              onChange={(kaderIds) => setForm((f) => ({ ...f, kaderIds }))}
              searchable={kader.length > 8}
              actions={false}
              supportingText={kaderHinweisText(form.vorname, gewaehlteNamen)}
            />
          )}
        </form>
      </Dialog>
    </>
  );
}
