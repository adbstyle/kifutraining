"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Link2, Pencil, Plus, Shirt, X } from "lucide-react";
import {
  AuswahlLeiste,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  MultiSelect,
  SectionMessage,
  Tabelle,
  TabellenZeile,
  TextField,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { aendereSpielerAktion, entferneSpielerAktion, nimmSpielerAufAktion } from "@/lib/actions/spieler";
import { aendereZuteilungAktion } from "@/lib/actions/kader";
import { probeFolgenAktion, schalteProbeAktion } from "@/lib/actions/probe";
import { PROBE_TEXT, probeAusschaltenText, probeEinschaltenText, probeFolgenSumme, probeVerfallFolge, probeVerfallTitel, type ProbeFolgen } from "@/lib/probe";
import { KADER_TEXT, kaderVon, type Kader } from "@/lib/kader";
import { JAHRGANG_STELLEN, JS_MAX, nurZiffern, spielerName, type Spieler, type SpielerFeld } from "@/lib/spieler";
import { SpielerLinkDialog } from "./SpielerLinkDialog";
import { Selbstabholung } from "./Selbstabholung";
import { SpielerImport } from "./SpielerImport";
import { KaderLozenges } from "./KaderLozenge";
import { KaderZuteilen, type ZuteilungAenderung } from "./KaderZuteilen";
import { EingrenzungLeer, KaderChips } from "./KaderEingrenzung";
import { useVerfallRueckfrage } from "./VerfallBestaetigung";
import { ProbeLozenge } from "./ProbeLozenge";

/* Die Spielerliste eines Teams (Epic #433, Story #434): Vorname, Nachname,
   Jahrgang und optional die J+S-Nummer je Spieler:in. Das Plus öffnet einen
   Dialog mit den Feldern untereinander (PO 2026-10-17); «Abbrechen» schliesst
   ihn, ohne zu speichern. «Hinzufügen» und Enter nehmen auf, danach bleibt
   er für die nächste offen und sagt, wer eben dazukam — die Snackbar läge
   unter dem Dialog. Ändern öffnet denselben Dialog mit den Angaben der
   Spieler:in und schliesst nach dem Speichern, Entfernen fragt nach.
   Das Kettenglied zeigt ihren privaten Link (#436); ob er über die
   Selbstabholung bezogen wurde (#438 AK 21), sagt ein grüner Punkt daran;
   «nicht bezogen» steht nur im Link-Dialog — in der Liste wäre es bei fast
   allen der lauteste Eindruck (PO 2026-10-18). Der
   Abschnitt «Selbstabholung» steht zuoberst (#438). Das Datei-Symbol neben
   dem Plus übernimmt eine ganze Mannschaft aus einer CSV-Datei (#455).

   Führt das Team Kader (#452), zeigt die Liste je Spieler:in ihre Kader
   (AK 7), grenzt sich über die Chips darüber auf einen Kader oder auf
   «Ohne Kader» ein (AK 8, 9; ein Chip zur Zeit, PO 2026-10-18) und teilt
   über die Auswahl mehreren in einem Schritt zu (AK 6). Der Dialog führt die
   Kader einer Spieler:in als Mehrfachauswahl (AK 5). Nimmt eine Änderung
   Spieler:innen aus Terminen, für die sie abgemeldet waren, fragt sie vorher
   nach (#453 AK 10).

   Probetraining (#555): Eine Probe-Spieler:in trägt die Plakette «Probe 1/4»
   neben dem Namen. Den Probe-Modus schaltet die Checkbox im Dialog «Spieler:in
   ändern» — gesperrt, solange das Team keine Anzahl festgelegt hat. Was das
   Einschalten verfallen liesse, steht vor dem Speichern als Warnung im Dialog;
   was das Ausschalten bewirkt, als Information. */

type Form = { vorname: string; nachname: string; jahrgang: string; jsNummer: string; kaderIds: string[]; probe: boolean };
const LEER: Form = { vorname: "", nachname: "", jahrgang: "", jsNummer: "", kaderIds: [], probe: false };

/** Die Eingrenzung auf Spieler:innen ohne Kader; sonst die id eines Kaders. */
const OHNE = "ohne";


export function SpielerListe({
  teamId,
  spieler,
  kader,
  abholung,
  probeAnzahl,
}: {
  teamId: string;
  spieler: Spieler[];
  /** Die Kader des Teams (#452), nach Namen. */
  kader: Kader[];
  /** Die Selbstabholung des Teams (#438); `url` fehlt, solange es keine Adresse gibt. */
  abholung: { url: string | null; aktiv: boolean };
  /** Die Anzahl Probetrainings des Teams (#555); `null`, solange keine festgelegt ist. */
  probeAnzahl: number | null;
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
  const [importOffen, setImportOffen] = useState(false);
  // Wer eben aufgenommen wurde — im noch offenen Dialog.
  const [aufgenommen, setAufgenommen] = useState<string | null>(null);
  const erstesFeld = useRef<HTMLInputElement>(null);
  const formId = useId();
  // Die id des Kaders, auf den die Liste eingegrenzt ist, `OHNE` oder `null`.
  const [gewaehlteEingrenzung, setEingrenzung] = useState<string | null>(null);
  // Fällt der eingegrenzte Kader weg (eben entfernt), gilt wieder die ganze Liste.
  const eingegrenzterKader = kader.find((k) => k.id === gewaehlteEingrenzung);
  const eingrenzung = gewaehlteEingrenzung === OHNE || eingegrenzterKader ? gewaehlteEingrenzung : null;
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [zuteilenOffen, setZuteilenOffen] = useState(false);
  const verfall = useVerfallRueckfrage(pending);
  // Was das Einschalten des Probe-Modus verfallen liesse (#555 AK 5), sobald die Checkbox an ist.
  const [probeFolgen, setProbeFolgen] = useState<ProbeFolgen | null>(null);
  const [probeFehler, setProbeFehler] = useState<string | null>(null);

  const mitKadern = kader.length > 0;
  const sichtbar = useMemo(() => {
    if (eingrenzung === null) return spieler;
    if (eingrenzung === OHNE) return spieler.filter((s) => s.kaderIds.length === 0);
    return spieler.filter((s) => s.kaderIds.includes(eingrenzung));
  }, [spieler, eingrenzung]);
  // Nur, wer noch da und sichtbar ist, bleibt ausgewählt.
  const gewaehlt = auswahl.filter((id) => sichtbar.some((s) => s.id === id));
  const ohneKader = spieler.filter((s) => s.kaderIds.length === 0).length;

  /** Eine Zuteilung ausführen; liesse sie Abmeldungen verfallen, erst
   *  nachfragen (#453 AK 10, 12). */
  function zuteilen(spielerIds: string[], a: ZuteilungAenderung, danach: () => void, bestaetigt: number | false = false) {
    if (a.dazu.length === 0 && a.weg.length === 0) return danach();
    startTransition(async () => {
      const r = await aendereZuteilungAktion(teamId, { spielerIds, ...a }, bestaetigt);
      if (verfall.nachKader(r, bestaetigt, (n) => zuteilen(spielerIds, a, danach, n))) return;
      if (!r.ok) return melde(r.error);
      danach();
    });
  }

  function oeffnen(s?: Spieler) {
    setFehler(null);
    setAufgenommen(null);
    setProbeFolgen(null);
    setProbeFehler(null);
    setOffen({ id: s?.id ?? null });
    setForm(
      s
        ? {
            vorname: s.vorname,
            nachname: s.nachname,
            jahrgang: String(s.jahrgang),
            jsNummer: s.jsNummer ?? "",
            kaderIds: s.kaderIds,
            probe: s.probe !== null,
          }
        : LEER,
    );
  }

  /** Die Checkbox «Im Probetraining»: beim Einschalten erst holen, was
   *  verfiele (AK 5, 16) — die Warnung steht vor dem Speichern. */
  function probeSchalten(id: string, an: boolean) {
    setForm((f) => ({ ...f, probe: an }));
    setProbeFehler(null);
    setProbeFolgen(null);
    if (!an || spieler.find((s) => s.id === id)?.probe) return;
    startTransition(async () => {
      const r = await probeFolgenAktion(id);
      if (!r.ok) return setProbeFehler(r.error);
      setProbeFolgen(r.folgen);
    });
  }

  function schliessen() {
    setOffen(null);
    setForm(LEER);
    setFehler(null);
    setAufgenommen(null);
    setProbeFolgen(null);
    setProbeFehler(null);
  }

  function speichern() {
    if (!offen || pending) return;
    const eingabe = { vorname: form.vorname, nachname: form.nachname, jahrgang: form.jahrgang, jsNummer: form.jsNummer };
    const name = `${form.vorname.trim()} ${form.nachname.trim()}`;
    startTransition(async () => {
      if (offen.id) {
        const id = offen.id;
        const r = await aendereSpielerAktion(id, eingabe);
        if (!r.ok) return setFehler({ feld: r.feld, text: r.error });
        const vorher = spieler.find((s) => s.id === id);
        // Der Probe-Modus (#555): mit der Zahl, die die Warnung zeigte; stimmt
        // sie nicht mehr, steht der neue Stand im offenen Dialog.
        if (vorher && form.probe !== (vorher.probe !== null)) {
          const p = await schalteProbeAktion(teamId, id, form.probe, form.probe && probeFolgen ? probeFolgenSumme(probeFolgen) : null);
          if (!p.ok) {
            router.refresh();
            const f = await probeFolgenAktion(id);
            if (f.ok) setProbeFolgen(f.folgen);
            return setProbeFehler(p.error);
          }
        }
        const bisher = vorher?.kaderIds ?? [];
        zuteilen([id], kaderAenderung(bisher, form.kaderIds), () => {
          schliessen();
          router.refresh();
          melde(`${name} geändert.`);
        });
        return;
      }
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

  const feld = (k: Exclude<keyof Form, "kaderIds" | "probe">) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [k]: k === "jahrgang" ? nurZiffern(e.target.value) : e.target.value }));
      setFehler(null);
      setAufgenommen(null);
    },
  });
  const fehlerAn = (f: SpielerFeld) => fehler && (fehler.feld ?? "vorname") === f ? fehler.text : undefined;

  const bezogen = spieler.filter((s) => s.linkBezogen).length;
  const namenVon = (s: Spieler) => kaderVon(s.id, kader).map((k) => k.name);
  const gewaehlteNamen = kader.filter((k) => form.kaderIds.includes(k.id)).map((k) => k.name);
  const wer = form.vorname.trim() || "Die Spieler:in";
  const kaderHinweis =
    gewaehlteNamen.length === 0
      ? `${wer} sieht nur Termine ohne Kader.`
      : `${wer} sieht Termine ohne Kader und die Termine von ${aufzaehlung(gewaehlteNamen)}.`;
  const probeVorher = !!offen?.id && !!spieler.find((s) => s.id === offen.id)?.probe;
  const mitProbe = spieler.some((s) => s.probe);
  const spalten = mitKadern
    ? "sm:grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_7rem_minmax(0,1fr)_7.5rem]"
    : "sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_7.5rem]";
  const kopf = mitKadern
    ? ["", "Name", "Jahrgang", "J+S-Nr.", "Kader", ""]
    : ["Name", "Jahrgang", "J+S-Nr.", ""];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Shirt size={20} strokeWidth={2} aria-hidden />
          <span>
            Spieler:innen
            <span className="type-label-small ml-2 text-on-surface-mittel">
              {spieler.length}
              {spieler.length > 0 && ` · ${bezogen} ${bezogen === 1 ? "Link" : "Links"} bezogen`}
            </span>
          </span>
        </h2>
        <span className="flex gap-1">
          <Tooltip label="Aus Datei importieren">
            <IconButton icon={FileUp} label="Spieler:innen aus Datei importieren" aria-haspopup="dialog" onClick={() => setImportOffen(true)} />
          </Tooltip>
          <Tooltip label="Spieler:in hinzufügen" ende>
            <IconButton icon={Plus} label="Spieler:in hinzufügen" aria-haspopup="dialog" onClick={() => oeffnen()} />
          </Tooltip>
        </span>
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
              {!offen?.id ? "Hinzufügen" : form.probe && !probeVorher ? PROBE_TEXT.einschalten : "Speichern"}
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
          {mitKadern && (
            <MultiSelect
              label="Kader (optional)"
              options={kader.map((k) => ({ value: k.id, label: k.name }))}
              value={form.kaderIds}
              onChange={(kaderIds) => setForm((f) => ({ ...f, kaderIds }))}
              searchable={kader.length > 8}
              actions={false}
              supportingText={kaderHinweis}
            />
          )}
          {offen?.id && (
            <ProbeFeld
              vorname={form.vorname.trim() || "Die Spieler:in"}
              anzahl={probeAnzahl}
              an={form.probe}
              vorher={probeVorher}
              folgen={probeFolgen}
              fehler={probeFehler}
              disabled={pending}
              onChange={(an) => offen.id && probeSchalten(offen.id, an)}
            />
          )}
        </form>
      </Dialog>

      {spieler.length > 0 && mitKadern && (
        <KaderChips
          label="Spielerliste eingrenzen"
          className="mt-5"
          chips={[
            ...kader.map((k) => ({ schluessel: k.id, name: k.name, anzahl: k.spielerIds.length })),
            { schluessel: OHNE, name: KADER_TEXT.ohneKader, anzahl: ohneKader },
          ]}
          gewaehlt={eingrenzung}
          onWahl={setEingrenzung}
        />
      )}

      {/* Grenzt ein Chip auf niemanden ein, steht statt des leeren Tabellenkopfs
          das Leerfeld — mit dem Weg zurück zur ganzen Liste. */}
      {spieler.length > 0 && eingrenzung !== null && sichtbar.length === 0 ? (
        <div className="mt-4">
          <EingrenzungLeer
            titel={eingegrenzterKader ? KADER_TEXT.leerKader(eingegrenzterKader.name) : KADER_TEXT.leerOhne}
            onAufheben={() => setEingrenzung(null)}
          >
            {eingegrenzterKader ? KADER_TEXT.leerKaderText : KADER_TEXT.leerOhneText}
          </EingrenzungLeer>
        </div>
      ) : spieler.length > 0 ? (
        <Tabelle className="mt-4" spalten={spalten} kopf={kopf}>
          {sichtbar.map((s) => (
            <TabellenZeile key={s.id}>
              {mitKadern && (
                <Checkbox
                  label={<span className="sr-only">{`${spielerName(s)} auswählen`}</span>}
                  checked={gewaehlt.includes(s.id)}
                  onChange={(e) => {
                    const an = e.target.checked;
                    setAuswahl((a) => (an ? [...a.filter((id) => id !== s.id), s.id] : a.filter((id) => id !== s.id)));
                  }}
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="type-body-medium truncate text-on-surface">{spielerName(s)}</span>
                  {s.probe && <ProbeLozenge stand={s.probe} />}
                </span>
                {/* Schmal stehen Jahrgang, J+S-Nummer und Kader unter dem Namen. */}
                <span className="type-body-small block text-on-surface-mittel sm:hidden">
                  {[s.jahrgang, s.jsNummer && `J+S ${s.jsNummer}`].filter(Boolean).join(" · ")}
                </span>
                <KaderLozenges namen={namenVon(s)} className="mt-1 sm:hidden" />
              </span>
              <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
              <span className={`type-body-medium hidden truncate sm:block ${s.jsNummer ? "text-on-surface-mittel" : "text-on-surface-tief"}`}>
                {s.jsNummer ?? "–"}
              </span>
              {mitKadern && (
                <span className="hidden min-w-0 sm:block">
                  {s.kaderIds.length > 0 ? (
                    <KaderLozenges namen={namenVon(s)} />
                  ) : (
                    <span className="type-body-medium text-on-surface-tief">–</span>
                  )}
                </span>
              )}
              <span className="flex justify-end gap-1">
                <Tooltip label={s.linkBezogen ? "Privater Link · bezogen" : "Privater Link"}>
                  <IconButton
                    icon={Link2}
                    label={`Privater Link für ${spielerName(s)}${s.linkBezogen ? ", bezogen" : ""}`}
                    punkt={s.linkBezogen ? "success" : undefined}
                    onClick={() => setLink(s)}
                  />
                </Tooltip>
                <Tooltip label="Ändern">
                  <IconButton icon={Pencil} label={`${spielerName(s)} ändern`} onClick={() => oeffnen(s)} />
                </Tooltip>
                <Tooltip label="Entfernen" ende>
                  <IconButton icon={X} label={`${spielerName(s)} entfernen`} onClick={() => setEntfernen(s)} />
                </Tooltip>
              </span>
            </TabellenZeile>
          ))}
        </Tabelle>
      ) : (
        <p className="type-body-medium mt-4 text-on-surface-mittel">
          Noch niemand auf der Liste. Solange sie leer ist, planst du mit der erwarteten Spielerzahl. Eine ganze
          Mannschaft übernimmst du aus einer CSV-Datei.
        </p>
      )}

      {mitProbe && <p className="type-body-small mt-3 max-w-2xl text-on-surface-mittel">{PROBE_TEXT.listeHinweis}</p>}

      {/* Schwebt unten am Platz der Snackbar, solange jemand ausgewählt ist;
          im DOM nach der Liste, damit Tab aus der Zeile vorwärts zu ihr führt. */}
      <AuswahlLeiste offen={gewaehlt.length > 0} titel={`${gewaehlt.length} ausgewählt`} onAufheben={() => setAuswahl([])}>
        <Button variant="filled" aria-haspopup="dialog" onClick={() => setZuteilenOffen(true)}>
          Kader zuteilen
        </Button>
      </AuswahlLeiste>

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

      <KaderZuteilen
        offen={zuteilenOffen}
        kader={kader}
        auswahl={gewaehlt}
        pending={pending}
        onClose={() => setZuteilenOffen(false)}
        onUebernehmen={(a) =>
          zuteilen(gewaehlt, a, () => {
            setZuteilenOffen(false);
            setAuswahl([]);
            router.refresh();
            melde(gewaehlt.length === 1 ? "Kader der Spieler:in geändert." : `Kader von ${gewaehlt.length} Spieler:innen geändert.`);
          })
        }
      />

      {verfall.dialog}

      <SpielerImport teamId={teamId} offen={importOffen} onClose={() => setImportOffen(false)} />

      <SpielerLinkDialog spieler={link} abholungAktiv={abholung.aktiv} onClose={() => setLink(null)} />
    </>
  );
}

/** Was sich an den Kadern einer Spieler:in ändert. */
function kaderAenderung(bisher: readonly string[], neu: readonly string[]): ZuteilungAenderung {
  return { dazu: neu.filter((k) => !bisher.includes(k)), weg: bisher.filter((k) => !neu.includes(k)) };
}

/** «A», «A und B», «A, B und C». */
function aufzaehlung(namen: string[]): string {
  return namen.length <= 1 ? (namen[0] ?? "") : `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

/** Die Checkbox «Im Probetraining» im Dialog «Spieler:in ändern» (#555 AK 3–5,
 *  16, 18, 19): darunter, was der Probe-Modus bedeutet; ohne Anzahl gesperrt
 *  mit dem Weg dahin; beim Einschalten die Warnung, was verfällt, beim
 *  Ausschalten, was danach gilt. */
function ProbeFeld({
  vorname,
  anzahl,
  an,
  vorher,
  folgen,
  fehler,
  disabled,
  onChange,
}: {
  vorname: string;
  anzahl: number | null;
  an: boolean;
  vorher: boolean;
  folgen: ProbeFolgen | null;
  fehler: string | null;
  disabled: boolean;
  onChange: (an: boolean) => void;
}) {
  const gesperrt = anzahl === null && !vorher;
  const verfaellt = an && !vorher && folgen && probeFolgenSumme(folgen) > 0 ? folgen : null;
  return (
    <>
      <hr className="my-1 border-kante" />
      <Checkbox
        className="items-start"
        checked={an}
        disabled={gesperrt || disabled}
        onChange={(e) => onChange(e.target.checked)}
        label={
          <span className="flex flex-col gap-0.5">
            <span>{PROBE_TEXT.checkbox}</span>
            <span className="type-body-small text-on-surface-mittel">
              {gesperrt ? PROBE_TEXT.anzahlFehlt : probeEinschaltenText(vorname, anzahl)}
            </span>
          </span>
        }
      />
      {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
      {!fehler && verfaellt && (
        <SectionMessage appearance="warning">
          <strong className="type-title-small block">{probeVerfallTitel(verfaellt)}</strong>
          {probeVerfallFolge(vorname)}
        </SectionMessage>
      )}
      {!an && vorher && <SectionMessage appearance="information">{probeAusschaltenText(vorname)}</SectionMessage>}
    </>
  );
}
