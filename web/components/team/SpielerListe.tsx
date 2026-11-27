"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { SPIELER_AUSWAHL_PARAM, TEILNAHME_PARAMETER } from "@/lib/teilnahme";
import { Bell, BellOff, Link2, Pencil, Plus, Shirt, UserMinus } from "lucide-react";
import {
  AuswahlLeiste,
  Button,
  Checkbox,
  Dialog,
  IconButton,
  InfoKnopf,
  MultiSelect,
  SectionMessage,
  Tabelle,
  TabellenZeile,
  Tooltip,
} from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { aendereSpielerAktion, ladeSpielerTeamsAktion, nimmSpielerAufAktion, nimmSpielerAusTeamAktion } from "@/lib/actions/spieler";
import { aendereZuteilungAktion } from "@/lib/actions/kader";
import { probeFolgenAktion, schalteProbeAktion } from "@/lib/actions/probe";
import { PROBE_TEXT, probeAusschaltenText, probeEinschaltenText, probeFolgenSumme, probeVerfallFolge, probeVerfallTitel, type ProbeFolgen } from "@/lib/probe";
import { kaderVon, type Kader } from "@/lib/kader";
import {
  HERAUSNEHMEN_TEXT,
  herausnehmenSaetze,
  herausnehmenTitel,
  linkKnopfText,
  spielerName,
  TEAM_SPIELER_FILTER,
  teamSpielerAnzahlText,
  verbleibendeTeams,
  type Spieler,
  type SpielerTeams,
} from "@/lib/spieler";
import { SpielerFelder, istFeldFehler, type SpielerAngaben, type SpielerFehler } from "@/components/spieler/SpielerFelder";
import { SpielerLinkDialog } from "./SpielerLinkDialog";
import { LINK_STAND_PUNKT } from "./LinkStandLozenge";
import { KaderLozenges } from "./KaderLozenge";
import { TeamLozenges } from "./TeamLozenges";
import { KaderZuteilen, type ZuteilungAenderung } from "./KaderZuteilen";
import { EingrenzungLeer } from "./KaderEingrenzung";
import { TeamSpielerFilter } from "./TeamSpielerFilter";
import { useVerfallRueckfrage } from "./VerfallBestaetigung";
import { SchnupperLozenge } from "@/components/spieler/SchnupperLozenge";
import { TabellenAuswahl } from "@/components/training/TabellenAuswahl";
import { MITTEILUNGEN_SPALTE } from "@/lib/push";
import { useAdressFilter } from "@/lib/use-adress-filter";
import {
  filtereSpieler,
  jahrgaengeDerListe,
  sichtbareAuswahl,
  teamEingrenzungGesetzt,
  type TeamEingrenzung,
} from "@/lib/team-spielerliste";

/* Die Spielerliste eines Teams (Epic #433, Story #434): Vorname, Nachname,
   Jahrgang und optional die J+S-Nummer je Spieler:in. Das Plus öffnet einen
   Dialog mit den Feldern untereinander (PO 2026-10-17); «Abbrechen» schliesst
   ihn, ohne zu speichern. «Hinzufügen» und Enter nehmen auf, danach bleibt
   er für die nächste offen und sagt, wer eben dazukam — die Snackbar läge
   unter dem Dialog. Ändern öffnet denselben Dialog mit den Angaben der
   Spieler:in und schliesst nach dem Speichern. «Aus dem Team nehmen» fragt
   nach (#579): Die Spieler:in wird nicht gelöscht und bleibt samt Link im
   Verein; der Dialog nennt die Teams, in denen sie bleibt, oder dass sie
   danach keinem Team mehr angehört. Die Spalte «Auch in» nennt ihre weiteren
   Teams (#579 AK 9). Die Spalte «Mobile» zeigt mit Glocke bzw.
   durchgestrichener Glocke, ob nach dem letzten bekannten Stand mindestens ein
   Gerät Mitteilungen für sie eingeschaltet hat (#483 AK 11), mit dem festen
   Hinweis hinter ⓘ, dass das kein Ankommen sichert. Löschen gibt es im Team nicht — das macht nur die
   Vereinsverwaltung.
   Das Kettenglied zeigt ihren privaten Link (#436); seinen Stand (#657 AK 4)
   ein Punkt daran: grün abgeholt (über die Selbstabholung, #438 AK 21), blau
   zugestellt. Offen bleibt unmarkiert und steht nur im Link-Dialog — in der
   Liste wäre es bei fast allen der lauteste Eindruck (PO 2026-10-18). Die
   Zahlen je Stand stehen im Bereich «Privater Link», nicht im Kopf. Die Selbstabholung (#438)
   steht im Bereich «Privater Link» der Team-Verwaltung (#656). Einen Import aus einer
   CSV-Datei gibt es hier nicht mehr: Ihn macht die Vereinsverwaltung im
   Spielerbestand des Vereins (Story #585).

   Führt das Team Kader (#452), zeigt die Liste je Spieler:in ihre Kader
   (AK 7) und teilt über die Auswahl mehreren in einem Schritt zu (AK 6). Der
   Dialog führt die Kader einer Spieler:in als Mehrfachauswahl (AK 5). Nimmt
   eine Änderung Spieler:innen aus Terminen, für die sie abgemeldet waren,
   fragt sie vorher nach (#453 AK 10).

   Eingrenzen (#601): Die Filterleiste über der Liste grenzt nach Name oder
   J+S-Nummer, Kadern samt «Ohne Kader», Jahrgängen und dem Stand des Links
   ein (hebt «ein Chip zur Zeit» aus #452 AK 8, 9 auf; am Termin bleibt es
   bei einem Kader). Der Zustand steht in der Adresse, die Seite liest und
   bereinigt ihn (`eingrenzung`), die Liste filtert im Browser. Der Kopf
   zählt dann «12 von 35»; trifft die Eingrenzung niemanden, steht das
   Leerfeld mit «Zurücksetzen». Zugeteilt wird nur, wer ausgewählt ist und
   sichtbar bleibt (AK 10).

   Schnuppertraining (#555, #584): Eine schnuppernde Spieler:in trägt die
   Plakette «Schnuppern 1/4» neben dem Namen. Das Schnuppern schaltet die
   Checkbox im Dialog «Spieler:in ändern» — gesperrt, solange das Team keine
   Anzahl festgelegt hat. Was das
   Einschalten verfallen liesse, steht vor dem Speichern als Warnung im Dialog;
   was das Ausschalten bewirkt, als Information. */

type Form = { vorname: string; nachname: string; jahrgang: string; jsNummer: string; kaderIds: string[]; probe: boolean };
const LEER: Form = { vorname: "", nachname: "", jahrgang: "", jsNummer: "", kaderIds: [], probe: false };

export function SpielerListe({
  teamId,
  teamName,
  vereinName,
  spieler,
  kader,
  probeAnzahl,
  eingrenzung,
  ausgewaehlt = null,
}: {
  teamId: string;
  teamName: string;
  /** Der Name des Vereins; `null`, wenn das Konto keinem angehört. */
  vereinName: string | null;
  spieler: Spieler[];
  /** Die Kader des Teams (#452), nach Namen. */
  kader: Kader[];
  /** Die Anzahl Schnuppertrainings des Teams (#555); `null`, solange keine festgelegt ist. */
  probeAnzahl: number | null;
  /** Suche und Eingrenzung aus der Adresse, bereinigt (#601). */
  eingrenzung: TeamEingrenzung;
  /** Die Spieler:in, deren Teilnahme daneben offen ist (#700). */
  ausgewaehlt?: string | null;
}) {
  const router = useRouter();
  const adresse = useSearchParams();
  // Dieselbe Adresse mit dieser Spieler:in in der Spalte daneben.
  const teilnahmeHref = (id: string) => {
    const p = new URLSearchParams(adresse.toString());
    p.set(SPIELER_AUSWAHL_PARAM, id);
    return `?${p.toString()}`;
  };
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // `null`: zu; sonst neu (`id` leer) oder die geänderte Spieler:in.
  // `probe`: ihr Schnuppern beim Öffnen — dagegen zählt, was sich ändert.
  const [offen, setOffen] = useState<{ id: string | null; probe: boolean } | null>(null);
  const [form, setForm] = useState<Form>(LEER);
  const [fehler, setFehler] = useState<SpielerFehler | null>(null);
  // Wer aus dem Team genommen werden soll, samt den Teams und dem Stand, die
  // die Bestätigung nennt; `hinweis`: Die Lage hat sich inzwischen geändert.
  const [herausnehmen, setHerausnehmen] = useState<{ spieler: Spieler; teams: SpielerTeams; hinweis?: string; fehler?: string } | null>(null);
  const [link, setLink] = useState<Spieler | null>(null);
  // Wer eben aufgenommen wurde — im noch offenen Dialog.
  const [aufgenommen, setAufgenommen] = useState<string | null>(null);
  const erstesFeld = useRef<HTMLInputElement>(null);
  const formId = useId();
  // Die Teilnahme daneben (#700) und ihr Zeitraum gehören nicht zur
  // Eingrenzung der Liste: «Zurücksetzen» lässt sie stehen.
  const filter = useAdressFilter({ behalte: TEILNAHME_PARAMETER });
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [zuteilenOffen, setZuteilenOffen] = useState(false);
  const verfall = useVerfallRueckfrage(pending);
  // Was das Einschalten des Schnupperns verfallen liesse (#555 AK 5), sobald die Checkbox an ist.
  const [probeFolgen, setProbeFolgen] = useState<ProbeFolgen | null>(null);
  const [probeFehler, setProbeFehler] = useState<string | null>(null);

  const mitKadern = kader.length > 0;
  const eingegrenzt = teamEingrenzungGesetzt(eingrenzung);
  const sichtbar = useMemo(() => filtereSpieler(spieler, eingrenzung), [spieler, eingrenzung]);
  const jahrgaenge = useMemo(() => jahrgaengeDerListe(spieler), [spieler]);
  // Nur, wer noch da und sichtbar ist, bleibt ausgewählt (#601 AK 10).
  const gewaehlt = sichtbareAuswahl(auswahl, sichtbar);

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
    setOffen({ id: s?.id ?? null, probe: !!s?.probe });
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

  /** Die Checkbox «Schnuppert»: beim Einschalten erst holen, was
   *  verfiele (AK 5, 16) — die Warnung steht vor dem Speichern. */
  function probeSchalten(id: string, an: boolean) {
    setForm((f) => ({ ...f, probe: an }));
    setProbeFehler(null);
    setProbeFolgen(null);
    if (!an || offen?.probe) return;
    startTransition(async () => {
      const r = await probeFolgenAktion(teamId, id);
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
        const probeWechsel = form.probe !== offen.probe;
        // Einschalten nur mit der Zahl, die die Warnung zeigte (#555 AK 5):
        // Fehlt sie noch, erst holen — verfällt etwas, steht die Warnung da,
        // und erst der nächste Klick schaltet.
        let folgen = probeFolgen;
        if (probeWechsel && form.probe && !folgen) {
          const f = await probeFolgenAktion(teamId, id);
          if (!f.ok) return setProbeFehler(f.error);
          folgen = f.folgen;
          setProbeFehler(null);
          setProbeFolgen(folgen);
          if (probeFolgenSumme(folgen) > 0) return;
        }
        const r = await aendereSpielerAktion(teamId, id, eingabe);
        if (!r.ok) {
          // Inzwischen aus dem Team genommen oder von der Verwaltung gelöscht
          // (#582): Die Meldung steht über den Feldern, die Liste lädt neu.
          if (r.feld === "spieler_id") router.refresh();
          return setFehler({ feld: r.feld, text: r.error });
        }
        const vorher = spieler.find((s) => s.id === id);
        // Stimmt die Zahl nicht mehr, steht der neue Stand im offenen Dialog.
        if (probeWechsel) {
          const p = await schalteProbeAktion(teamId, id, form.probe, form.probe && folgen ? probeFolgenSumme(folgen) : null);
          if (!p.ok) {
            router.refresh();
            const f = await probeFolgenAktion(teamId, id);
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

  /** Die Bestätigung öffnen: erst die Teams der Spieler:in lesen. */
  function herausnehmenOeffnen(s: Spieler) {
    startTransition(async () => {
      const r = await ladeSpielerTeamsAktion(teamId, s.id);
      if (!r.ok) {
        router.refresh();
        return melde(r.error);
      }
      setHerausnehmen({ spieler: s, teams: { teams: r.teams, stand: r.stand, schnuppert: r.schnuppert } });
    });
  }

  function herausnehmenAusfuehren() {
    if (!herausnehmen) return;
    const { spieler: s, teams } = herausnehmen;
    startTransition(async () => {
      const r = await nimmSpielerAusTeamAktion(teamId, s.id, teams.stand);
      if (r.ok) {
        setHerausnehmen(null);
        if (offen?.id === s.id) schliessen();
        router.refresh();
        return melde(`${spielerName(s)} ist nicht mehr im Team ${teamName}.`);
      }
      // Ein Fehler (etwa gleichzeitig herausgenommen): die Liste neu, nur die
      // Meldung im Dialog, kein früherer Hinweis.
      if (!r.geaendert) {
        router.refresh();
        return setHerausnehmen({ spieler: s, teams, fehler: r.error });
      }
      // Die Lage hat sich geändert, nichts wurde geschrieben: der neue Stand.
      const neu = await ladeSpielerTeamsAktion(teamId, s.id);
      if (!neu.ok) {
        router.refresh();
        return setHerausnehmen({ spieler: s, teams, fehler: neu.error });
      }
      setHerausnehmen({ spieler: s, teams: { teams: neu.teams, stand: neu.stand, schnuppert: neu.schnuppert }, hinweis: HERAUSNEHMEN_TEXT.geaendert });
    });
  }

  const aendern = (k: keyof SpielerAngaben, text: string) => {
    setForm((f) => ({ ...f, [k]: text }));
    setFehler(null);
    setAufgenommen(null);
  };

  const namenVon = (s: Spieler) => kaderVon(s.id, kader).map((k) => k.name);
  const gewaehlteNamen = kader.filter((k) => form.kaderIds.includes(k.id)).map((k) => k.name);
  const wer = form.vorname.trim() || "Die Spieler:in";
  // Welche Termine für sie gelten — ohne Aussage darüber, was der Link zeigt (#663).
  const kaderHinweis =
    gewaehlteNamen.length === 0
      ? `${wer} ist nur bei Terminen ohne Kader dabei.`
      : `${wer} ist bei Terminen ohne Kader und bei den Terminen von ${aufzaehlung(gewaehlteNamen)} dabei.`;
  const probeVorher = !!offen?.probe;
  const mitProbe = spieler.some((s) => s.probe);
  const spalten = mitKadern
    ? "@2xl/tabelle:grid-cols-[1.5rem_minmax(0,2fr)_4.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_5rem_7.5rem]"
    : "@2xl/tabelle:grid-cols-[minmax(0,2fr)_4.5rem_7rem_minmax(0,1fr)_5rem_7.5rem]";
  // Die Spalte «Mobile» (#483 AK 11) mit ihrem festen Hinweis hinter ⓘ.
  const mobileKopf = (
    <span className="-my-2 flex items-center gap-0.5">
      <span aria-hidden>{MITTEILUNGEN_SPALTE.kopf}</span>
      <InfoKnopf label={`Spalte ${MITTEILUNGEN_SPALTE.kopf}`}>{MITTEILUNGEN_SPALTE.hinweis}</InfoKnopf>
    </span>
  );
  const kopf = mitKadern
    ? ["", "Name", "Jahrgang", "J+S-Nr.", "Kader", "Auch in", mobileKopf, ""]
    : ["Name", "Jahrgang", "J+S-Nr.", "Auch in", mobileKopf, ""];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 type-title-large text-on-surface">
          <Shirt size={20} strokeWidth={2} aria-hidden />
          <span>
            Spieler:innen
            <span className="type-label-small ml-2 text-on-surface-mittel">
              {teamSpielerAnzahlText(sichtbar.length, spieler.length, eingegrenzt)}
            </span>
          </span>
        </h2>
        <Tooltip label="Spieler:in hinzufügen" ende>
          <IconButton icon={Plus} label="Spieler:in hinzufügen" aria-haspopup="dialog" onClick={() => oeffnen()} />
        </Tooltip>
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
          {fehler && !istFeldFehler(fehler) && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
          <SpielerFelder wert={form} onAendern={aendern} fehler={fehler} erstesFeld={erstesFeld} />
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
              mehrereTeams={(spieler.find((x) => x.id === offen.id)?.weitereTeams.length ?? 0) > 0}
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

      {spieler.length > 0 && <TeamSpielerFilter eingrenzung={eingrenzung} kader={kader} jahrgaenge={jahrgaenge} />}

      {/* Trifft die Eingrenzung niemanden, steht statt des leeren Tabellenkopfs
          das Leerfeld — mit dem Weg zurück zur ganzen Liste (#601 AK 7, 8). */}
      {spieler.length > 0 && sichtbar.length === 0 ? (
        <div className="mt-4">
          <EingrenzungLeer
            titel={TEAM_SPIELER_FILTER.leerTitel}
            aufhebenText={TEAM_SPIELER_FILTER.zuruecksetzen}
            onAufheben={filter.zuruecksetzen}
          >
            {TEAM_SPIELER_FILTER.leerText}
          </EingrenzungLeer>
        </div>
      ) : spieler.length > 0 ? (
        <>
        {/* Der Hinweis zur Spalte «Mobile» für die Vorlesehilfe (das Panel hinter ⓘ ist nur fürs Auge). */}
        <p className="sr-only">{MITTEILUNGEN_SPALTE.hinweis}</p>
        {/* Fokus und Sichtbarkeit beim Öffnen und Schliessen der Teilnahme (#700). */}
        <TabellenAuswahl ausgewaehlt={ausgewaehlt ?? undefined} attribut="data-spieler-zeile" />
        <Tabelle className="mt-4" spalten={spalten} kopf={kopf} rasterAb="behaelter">
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
                  {/* Der Name öffnet die Teilnahme der Spieler:in daneben
                      (#700); Eingrenzung und Zeitraum bleiben in der Adresse. */}
                  <Link
                    href={teilnahmeHref(s.id)}
                    scroll={false}
                    aria-current={s.id === ausgewaehlt ? "true" : undefined}
                    data-spieler-zeile={s.id}
                    className={cn(
                      "focus-ring truncate rounded-klein type-body-medium hover:underline",
                      s.id === ausgewaehlt ? "text-primary" : "text-on-surface",
                    )}
                  >
                    {spielerName(s)}
                  </Link>
                  {s.probe && (
                    <span className="hidden shrink-0 @2xl/tabelle:inline-flex">
                      <SchnupperLozenge stand={s.probe} />
                    </span>
                  )}
                </span>
                {/* Schmal stehen Jahrgang, J+S-Nummer, Schnuppern und Kader unter dem Namen: Der Name bleibt lesbar. */}
                <span className="type-body-small block text-on-surface-mittel @2xl/tabelle:hidden">
                  {[s.jahrgang, s.jsNummer && `J+S ${s.jsNummer}`].filter(Boolean).join(" · ")}
                </span>
                {s.probe && (
                  <span className="mt-1 flex @2xl/tabelle:hidden">
                    <SchnupperLozenge stand={s.probe} />
                  </span>
                )}
                <KaderLozenges namen={namenVon(s)} className="mt-1 @2xl/tabelle:hidden" />
                <TeamLozenges namen={s.weitereTeams} className="mt-1 @2xl/tabelle:hidden" />
              </span>
              <span className="type-body-medium hidden text-on-surface-mittel @2xl/tabelle:block">{s.jahrgang}</span>
              <span className={`type-body-medium hidden truncate @2xl/tabelle:block ${s.jsNummer ? "text-on-surface-mittel" : "text-on-surface-tief"}`}>
                {s.jsNummer ?? "–"}
              </span>
              {mitKadern && (
                <span className="hidden min-w-0 @2xl/tabelle:block">
                  {s.kaderIds.length > 0 ? (
                    <KaderLozenges namen={namenVon(s)} />
                  ) : (
                    <span className="type-body-medium text-on-surface-tief">–</span>
                  )}
                </span>
              )}
              <span className="hidden min-w-0 @2xl/tabelle:block">
                {s.weitereTeams.length > 0 ? (
                  <TeamLozenges namen={s.weitereTeams} />
                ) : (
                  <span className="type-body-medium text-on-surface-tief">–</span>
                )}
              </span>
              {/* Nur ein Zeichen, keine Primärfarbe (PO): eingeschaltet in Schriftfarbe, sonst gedämpft. */}
              <span
                role="img"
                aria-label={`${spielerName(s)}: ${s.mitteilungen ? MITTEILUNGEN_SPALTE.an : MITTEILUNGEN_SPALTE.aus}`}
                className={`flex shrink-0 items-center ${s.mitteilungen ? "text-on-surface" : "text-on-surface-mittel"}`}
              >
                {s.mitteilungen ? <Bell size={18} strokeWidth={2} aria-hidden /> : <BellOff size={18} strokeWidth={2} aria-hidden />}
              </span>
              <span className="flex justify-end gap-1">
                {/* Der Link gehört der Spieler:in und geht in jedem ihrer Teams (#583 AK 14). */}
                <Tooltip label={linkKnopfText(spielerName(s), s.linkStand).tooltip}>
                  <IconButton
                    icon={Link2}
                    label={linkKnopfText(spielerName(s), s.linkStand).label}
                    punkt={LINK_STAND_PUNKT[s.linkStand]}
                    onClick={() => setLink(s)}
                  />
                </Tooltip>
                <Tooltip label="Ändern">
                  <IconButton icon={Pencil} label={`${spielerName(s)} ändern`} onClick={() => oeffnen(s)} />
                </Tooltip>
                <Tooltip label="Aus dem Team nehmen" ende>
                  <IconButton
                    icon={UserMinus}
                    label={`${spielerName(s)} aus dem Team nehmen`}
                    aria-haspopup="dialog"
                    disabled={pending}
                    onClick={() => herausnehmenOeffnen(s)}
                  />
                </Tooltip>
              </span>
            </TabellenZeile>
          ))}
        </Tabelle>
        </>
      ) : (
        <p className="type-body-medium mt-4 text-on-surface-mittel">
          Noch niemand auf der Liste. Solange sie leer ist, planst du mit der erwarteten Spielerzahl.
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
        open={herausnehmen !== null}
        onClose={() => !pending && setHerausnehmen(null)}
        title={herausnehmen ? herausnehmenTitel({ ...herausnehmen.spieler, team: teamName }) : ""}
        actions={
          <>
            <Button variant="outlined" onClick={() => setHerausnehmen(null)} disabled={pending}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={herausnehmenAusfuehren} disabled={pending}>
              {HERAUSNEHMEN_TEXT.aktion}
            </Button>
          </>
        }
      >
        {herausnehmen && <HerausnehmenText {...herausnehmen} team={teamName} verein={vereinName} />}
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

      <SpielerLinkDialog teamId={teamId} spieler={link} onClose={() => setLink(null)} />
    </>
  );
}

/** Der Inhalt der Bestätigung (#579 AK 13–16): nicht gelöscht, bleibt im
 *  Verein, was verfällt — mit weiteren Teams oder als letztes Team. */
function HerausnehmenText({
  spieler,
  teams,
  team,
  verein,
  hinweis,
  fehler,
}: {
  spieler: Spieler;
  teams: SpielerTeams;
  team: string;
  verein: string | null;
  hinweis?: string;
  fehler?: string;
}) {
  const s = herausnehmenSaetze({
    vorname: spieler.vorname,
    nachname: spieler.nachname,
    team,
    verein,
    verbleibend: verbleibendeTeams(teams.teams),
    // Aus `spieler_teams` (dieses Team), nicht aus der Liste: eine Quelle.
    probe: teams.schnuppert,
  });
  return (
    <div className="flex flex-col gap-3">
      {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
      {hinweis && <SectionMessage appearance="information">{hinweis}</SectionMessage>}
      {s.absaetze.map((a) => (
        <p key={a}>{a}</p>
      ))}
      <SectionMessage appearance="warning">{s.warnung}</SectionMessage>
      <p>{s.zusatz}</p>
    </div>
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

/** Die Checkbox «Schnuppert» im Dialog «Spieler:in ändern» (#555 AK 3–5,
 *  16, 18, 19; #584 AK 6, 7): darunter, was das Schnuppern bedeutet, und vor
 *  dem Einschalten, dass sie sich dann keinem weiteren Team zuordnen lässt; ohne Anzahl gesperrt
 *  mit dem Weg dahin; beim Einschalten die Warnung, was verfällt, beim
 *  Ausschalten, was danach gilt. Wer weiteren Teams zugeordnet ist, schnuppert
 *  nicht (Vereine AP §5.3): statt der Checkbox nur der Hinweis. */
function ProbeFeld({
  vorname,
  anzahl,
  mehrereTeams,
  an,
  vorher,
  folgen,
  fehler,
  disabled,
  onChange,
}: {
  vorname: string;
  anzahl: number | null;
  mehrereTeams: boolean;
  an: boolean;
  vorher: boolean;
  folgen: ProbeFolgen | null;
  fehler: string | null;
  disabled: boolean;
  onChange: (an: boolean) => void;
}) {
  const gesperrt = anzahl === null && !vorher;
  const verfaellt = an && !vorher && folgen && probeFolgenSumme(folgen) > 0 ? folgen : null;
  if (mehrereTeams && !vorher)
    return (
      <>
        <hr className="my-1 border-kante" />
        <p className="type-body-small text-on-surface-mittel">{PROBE_TEXT.mehrereTeams}</p>
      </>
    );
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
            {/* AK 7: beim Einschalten; schnuppert sie schon, sagt es nichts Neues,
                und beim Ausschalten widerspräche es dem Hinweis darunter. */}
            {!gesperrt && !vorher && <span className="type-body-small text-on-surface-mittel">{PROBE_TEXT.keinWeiteresTeam}</span>}
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
