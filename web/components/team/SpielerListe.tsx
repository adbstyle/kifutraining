"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Pencil, Plus, X } from "lucide-react";
import { Button, Dialog, IconButton, SectionMessage, TextField, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { aendereSpielerAktion, entferneSpielerAktion, nimmSpielerAufAktion } from "@/lib/actions/spieler";
import { JAHRGANG_STELLEN, JS_MAX, nurZiffern, spielerName, type Spieler, type SpielerFeld } from "@/lib/spieler";
import { SpielerLinkDialog } from "./SpielerLinkDialog";
import { Selbstabholung } from "./Selbstabholung";
import { BezogenLozenge } from "./BezogenLozenge";

/* Die Spielerliste eines Teams (Epic #433, Story #434): Vorname, Nachname,
   Jahrgang und optional die J+S-Nummer je Spieler:in. Das Plus öffnet einen
   Dialog mit den Feldern untereinander (PO 2026-10-17); «Abbrechen» schliesst
   ihn, ohne zu speichern. «Hinzufügen» und Enter nehmen auf, danach bleibt
   er für die nächste offen und sagt, wer eben dazukam — die Snackbar läge
   unter dem Dialog. Ändern öffnet denselben Dialog mit den Angaben der
   Spieler:in und schliesst nach dem Speichern, Entfernen fragt nach.
   Das Kettenglied zeigt ihren privaten Link (#436); ob er über die
   Selbstabholung bezogen wurde, sagt die Spalte «Link» (#438 AK 21). Der
   Abschnitt «Selbstabholung» steht zuoberst (#438). */

type Form = { vorname: string; nachname: string; jahrgang: string; jsNummer: string };
const LEER: Form = { vorname: "", nachname: "", jahrgang: "", jsNummer: "" };

export function SpielerListe({
  teamId,
  spieler,
  abholung,
}: {
  teamId: string;
  spieler: Spieler[];
  /** Die Selbstabholung des Teams (#438); `url` fehlt, solange es keine Adresse gibt. */
  abholung: { url: string | null; aktiv: boolean };
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // `null`: zu; sonst neu (`id` leer) oder die geänderte Spieler:in.
  const [offen, setOffen] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<Form>(LEER);
  const [fehler, setFehler] = useState<{ feld?: SpielerFeld; text: string } | null>(null);
  const [entfernen, setEntfernen] = useState<Spieler | null>(null);
  const [link, setLink] = useState<Spieler | null>(null);
  // Wer eben aufgenommen wurde — im noch offenen Dialog.
  const [aufgenommen, setAufgenommen] = useState<string | null>(null);
  const erstesFeld = useRef<HTMLInputElement>(null);
  const formId = useId();

  function oeffnen(s?: Spieler) {
    setFehler(null);
    setAufgenommen(null);
    setOffen({ id: s?.id ?? null });
    setForm(s ? { vorname: s.vorname, nachname: s.nachname, jahrgang: String(s.jahrgang), jsNummer: s.jsNummer ?? "" } : LEER);
  }

  function schliessen() {
    setOffen(null);
    setForm(LEER);
    setFehler(null);
    setAufgenommen(null);
  }

  function speichern() {
    if (!offen || pending) return;
    const eingabe = { vorname: form.vorname, nachname: form.nachname, jahrgang: form.jahrgang, jsNummer: form.jsNummer };
    const name = `${form.vorname.trim()} ${form.nachname.trim()}`;
    startTransition(async () => {
      if (offen.id) {
        const r = await aendereSpielerAktion(offen.id, eingabe);
        if (!r.ok) return setFehler({ feld: r.feld, text: r.error });
        schliessen();
        router.refresh();
        melde(`${name} geändert.`);
        return;
      }
      const r = await nimmSpielerAufAktion(teamId, eingabe);
      if (!r.ok) return setFehler({ feld: r.feld, text: r.error });
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

  function entfernenAusfuehren(s: Spieler) {
    startTransition(async () => {
      const r = await entferneSpielerAktion(s.id);
      setEntfernen(null);
      if (!r.ok) return melde(r.error);
      if (offen?.id === s.id) schliessen();
      router.refresh();
      melde(`${spielerName(s)} ist nicht mehr auf der Liste.`);
    });
  }

  const feld = (k: keyof Form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [k]: k === "jahrgang" ? nurZiffern(e.target.value) : e.target.value }));
      setFehler(null);
      setAufgenommen(null);
    },
  });
  const fehlerAn = (f: SpielerFeld) => fehler && (fehler.feld ?? "vorname") === f ? fehler.text : undefined;

  const bezogen = spieler.filter((s) => s.linkBezogen).length;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="type-title-large text-on-surface">
          Spieler:innen
          <span className="type-label-small ml-2 text-on-surface-mittel">
            {spieler.length}
            {spieler.length > 0 && ` · ${bezogen} ${bezogen === 1 ? "Link" : "Links"} bezogen`}
          </span>
        </h2>
        <Tooltip label="Spieler:in hinzufügen" ende>
          <IconButton icon={Plus} label="Spieler:in hinzufügen" aria-haspopup="dialog" onClick={() => oeffnen()} />
        </Tooltip>
      </div>

      <div className="mt-4">
        <Selbstabholung teamId={teamId} start={abholung} />
      </div>

      <Dialog
        open={offen !== null}
        onClose={() => !pending && schliessen()}
        title={offen?.id ? "Spieler:in ändern" : "Spieler:in hinzufügen"}
        actions={
          <>
            <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
              Abbrechen
            </Button>
            <Button type="submit" form={formId} variant="filled" disabled={pending}>
              {offen?.id ? "Speichern" : "Hinzufügen"}
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
          {aufgenommen && <SectionMessage appearance="success">{aufgenommen}</SectionMessage>}
          <TextField ref={erstesFeld} label="Vorname" autoComplete="off" autoFocus {...feld("vorname")} error={!!fehlerAn("vorname")} supportingText={fehlerAn("vorname")} />
          <TextField label="Nachname" autoComplete="off" {...feld("nachname")} error={!!fehlerAn("nachname")} supportingText={fehlerAn("nachname")} />
          <TextField label="Jahrgang" inputMode="numeric" maxLength={JAHRGANG_STELLEN} autoComplete="off" {...feld("jahrgang")} error={!!fehlerAn("jahrgang")} supportingText={fehlerAn("jahrgang")} />
          <TextField label="J+S-Nummer (optional)" autoComplete="off" maxLength={JS_MAX} {...feld("jsNummer")} error={!!fehlerAn("js_nummer")} supportingText={fehlerAn("js_nummer")} />
        </form>
      </Dialog>

      {spieler.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-flaeche bg-elev-01">
          <div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_4.5rem_7rem_7.5rem_7.5rem] gap-3 border-b border-linie px-4 py-2 type-label-small text-on-surface-mittel sm:grid">
            <span>Name</span>
            <span>Jahrgang</span>
            <span>J+S-Nr.</span>
            <span>Link</span>
            <span />
          </div>
          <ul className="divide-y divide-linie">
            {spieler.map((s) => (
              <li key={s.id} className="state flex items-center gap-3 py-1 pl-4 pr-2 sm:grid sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_7.5rem_7.5rem]">
                <span className="min-w-0 flex-1">
                  <span className="type-body-medium block truncate text-on-surface">{spielerName(s)}</span>
                  {/* Schmal stehen Jahrgang und J+S-Nummer unter dem Namen. */}
                  <span className="type-body-small block text-on-surface-mittel sm:hidden">
                    {[s.jahrgang, s.jsNummer && `J+S ${s.jsNummer}`, s.linkBezogen && "Link bezogen"].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
                <span className={`type-body-medium hidden truncate sm:block ${s.jsNummer ? "text-on-surface-mittel" : "text-on-surface-tief"}`}>
                  {s.jsNummer ?? "–"}
                </span>
                <span className="hidden sm:block">
                  <BezogenLozenge bezogen={s.linkBezogen} />
                </span>
                <span className="flex justify-end gap-1">
                  <Tooltip label="Privater Link">
                    <IconButton icon={Link2} label={`Privater Link für ${spielerName(s)}`} onClick={() => setLink(s)} />
                  </Tooltip>
                  <Tooltip label="Ändern">
                    <IconButton icon={Pencil} label={`${spielerName(s)} ändern`} onClick={() => oeffnen(s)} />
                  </Tooltip>
                  <Tooltip label="Entfernen" ende>
                    <IconButton icon={X} label={`${spielerName(s)} entfernen`} onClick={() => setEntfernen(s)} />
                  </Tooltip>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="type-body-medium mt-4 text-on-surface-mittel">
          Noch niemand auf der Liste. Solange sie leer ist, planst du mit der erwarteten Spielerzahl.
        </p>
      )}

      <Dialog
        open={entfernen != null}
        onClose={() => setEntfernen(null)}
        title={`${entfernen ? spielerName(entfernen) : ""} entfernen?`}
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
        <p>
          Ihr privater Link gilt danach nicht mehr, und die Selbstabholung findet sie nicht mehr. An
          vergangenen Terminen steht sie nur noch ohne Namen, die Spielerzahl dort bleibt. An anstehenden
          Terminen zählt sie nicht mehr.
        </p>
      </Dialog>

      <SpielerLinkDialog spieler={link} abholungAktiv={abholung.aktiv} onClose={() => setLink(null)} />
    </>
  );
}
