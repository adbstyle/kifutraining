"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp } from "lucide-react";
import { Button, Dialog, Disclosure, Lozenge, SectionMessage, Select, Tabelle, TabellenZeile } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { importiereInVereinAktion, pruefeVereinImportAktion } from "@/lib/actions/verein";
import { spielerName } from "@/lib/spieler";
import {
  IMPORT_ANGABEN,
  IMPORT_TEXT,
  beispielVon,
  erkenneSpalten,
  erwartetVon,
  importErgebnisText,
  importJsPlakette,
  importMehrfachText,
  importNeuText,
  importNichtsZuTunText,
  importUebernehmbar,
  importUeberGrenzeText,
  importZeilen,
  importZeilenStimmen,
  leseDatei,
  zuordnungVollstaendig,
  type CsvTabelle,
  type ImportAngabe,
  type ImportEintrag,
  type ImportHinweis,
  type ImportTeam,
  type ImportVorschau,
  type Zuordnung,
} from "@/lib/spieler-import";
import { OHNE_TEAM_WERT } from "@/lib/verein-spielerliste";
import { SpielerTeams } from "./VereinSpielerTeile";

/* Spieler:innen des Vereins aus einer CSV-Datei übernehmen (Epic Vereine
   #575, Story #585; Vorgänger am Team-Ort: Story #455). Ein Dialog in zwei
   Stufen: schmal die Datei wählen, dann breit die Vorschau mit der
   Zuordnung der Spalten. Gelesen wird hier im Browser; an den Server gehen
   nur Vorname, Nachname, Jahrgang und J+S-Nummer je Zeile.

   Die Datenebene ordnet die Zeilen über den ganzen Verein ein (neu, neue
   J+S-Nummer, unverändert, mehrfach im Verein geführt) und übernimmt beim
   Bestätigen nur, wenn ihre Einordnung noch der Vorschau entspricht. Sonst
   ist nichts geschehen: Die neue Vorschau ersetzt die alte, ein Hinweisband
   sagt es (`veraltet`, AK 9) — es verschwindet mit der nächsten Vorschau, die
   man selbst auslöst. Neue kommen ohne Team in den Bestand; danach nennt die
   Snackbar es und bietet «Zuordnen» an: die Eingrenzung «Ohne Team».

   Der Dialog steht nur, solange er offen ist (die Liste mountet ihn bedingt):
   Datei, Vorschau und Hinweisband beginnen jedes Mal von vorn, auch wenn die
   Eingrenzung der Liste wechselt.

   Bausteine des Kits: Dialog, Button, SectionMessage, Select, Lozenge,
   Tabelle, Disclosure; die Teams als `SpielerTeams` der Liste. Neu im Kit ist
   nichts: Die Gruppen der Vorschau und die Namenszelle stehen lokal, und eine
   Tabelle mit vielen Zeilen scrollt in einem Bereich von höchstens 18 rem,
   damit «Übernehmen» bei 1000 Zeilen erreichbar bleibt (der Bereich ist
   fokussierbar und benannt, damit die Tastatur ihn scrollt). */

type Geladen = { name: string; tabelle: CsvTabelle; zuordnung: Zuordnung };

const OHNE_JS = "ohne";

export function VereinSpielerImport({
  vereinId,
  vereinName,
  pfad,
  onClose,
}: {
  vereinId: string;
  vereinName: string;
  /** Die Adresse der Liste, für die Aktion «Zuordnen» der Snackbar. */
  pfad: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  // Die Vorschau liest nur; schliessen lässt sich der Dialog nur während der
  // Übernahme nicht.
  const [laedt, startVorschau] = useTransition();
  const [pending, startTransition] = useTransition();
  const [geladen, setGeladen] = useState<Geladen | null>(null);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  // Die Übernahme hat nichts geändert, weil der Bestand die Vorschau überholt hat.
  const [veraltet, setVeraltet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  // Verwirft die Antwort einer Dateiwahl, Vorschau oder Übernahme, die ein
  // neuerer Lauf schon überholt hat.
  const lauf = useRef(0);

  // Die Zeilen der Datei nach der Zuordnung — dieselben für Vorschau und Übernahme.
  const [zeilen, setZeilen] = useState<{ eintraege: ImportEintrag[]; hinweise: ImportHinweis[] }>({ eintraege: [], hinweise: [] });

  function schliessen() {
    if (pending) return;
    lauf.current++;
    onClose();
  }

  /** Datei und Zuordnung übernehmen und die Vorschau dazu holen. */
  function laden(g: Geladen) {
    const nr = ++lauf.current;
    setGeladen(g);
    setVorschau(null);
    setVeraltet(false);
    setFehler(null);
    if (!zuordnungVollstaendig(g.zuordnung)) return setZeilen({ eintraege: [], hinweise: [] });
    const z = importZeilen(g.tabelle, g.zuordnung);
    setZeilen(z);
    const { eintraege } = z;
    startVorschau(async () => {
      const r = await pruefeVereinImportAktion(vereinId, eintraege);
      if (nr !== lauf.current) return;
      if (!r.ok) return setFehler(r.error);
      setVorschau(r.vorschau);
    });
  }

  async function dateiGewaehlt(f: File) {
    // Zwei schnelle Dateiwahlen: Die spätere gewinnt, auch wenn die frühere
    // langsamer gelesen wird.
    const nr = ++lauf.current;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (nr !== lauf.current) return;
    const r = leseDatei(f.name, bytes);
    if (!r.ok) {
      lauf.current++;
      setGeladen(null);
      setVorschau(null);
      setVeraltet(false);
      setDateiFehler(r.text);
      return;
    }
    const g = { name: f.name, tabelle: r.tabelle, zuordnung: erkenneSpalten(r.tabelle.kopf) };
    setDateiFehler(null);
    laden(g);
  }

  /** Eine Spalte gilt höchstens für eine Angabe (#455 AK 11). */
  function zuordnen(angabe: ImportAngabe, wert: string) {
    if (!geladen) return;
    const spalte = wert === OHNE_JS ? null : Number(wert);
    const z: Zuordnung = { ...geladen.zuordnung };
    for (const a of Object.keys(z) as ImportAngabe[]) if (spalte !== null && z[a] === spalte) z[a] = null;
    z[angabe] = spalte;
    laden({ ...geladen, zuordnung: z });
  }

  function uebernehmen() {
    if (!vorschau || pending || laedt) return;
    const nr = ++lauf.current;
    setFehler(null);
    startTransition(async () => {
      const r = await importiereInVereinAktion(vereinId, zeilen.eintraege, erwartetVon(vorschau));
      // Ein Erfolg der Übernahme meldet immer das Ergebnis, auch wenn ein neuerer
      // Lauf ihn überholt hat: geschrieben ist geschrieben. Verworfen werden nur
      // Fehler und `veraltet` einer überholten Antwort.
      if (r.ok && r.ausgang.status === "uebernommen") {
        lauf.current++;
        onClose();
        router.refresh();
        const { neu, js } = r.ausgang;
        melde(
          importErgebnisText({ neu, js }),
          neu > 0 ? { label: "Zuordnen", onAction: () => router.push(`${pfad}?team=${OHNE_TEAM_WERT}`, { scroll: false }) } : undefined,
        );
        return;
      }
      if (nr !== lauf.current) return;
      // Ein Fehler sperrt nicht: «Übernehmen» bleibt für einen zweiten Versuch.
      if (!r.ok) return setFehler(r.error);
      if (r.ausgang.status === "veraltet") {
        // Nichts übernommen: die neue Vorschau steht an Stelle der alten.
        setVorschau(r.ausgang.vorschau);
        setVeraltet(true);
        setFehler(null);
      }
    });
  }

  const anzahlNeu = vorschau?.neu.length ?? 0;
  const anzahlJs = vorschau?.js.length ?? 0;
  // Der Kern prüft die Zeilennummern schon; passt eine nicht, zeigt der Dialog
  // keine Vorschau statt einer falschen (und stürzt nicht ab).
  const stimmig = vorschau !== null && importZeilenStimmen(vorschau, zeilen.eintraege.map((e) => e.zeile));
  const kann = vorschau !== null && stimmig && importUebernehmbar(vorschau) && !pending && !laedt;
  const nachZeile = new Map(zeilen.eintraege.map((e) => [e.zeile, e]));
  const eintragVon = (zeile: number): ImportEintrag | undefined => nachZeile.get(zeile);

  const dateiFeld = (
    <input
      ref={datei}
      type="file"
      accept=".csv,text/csv"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void dateiGewaehlt(f);
      }}
    />
  );

  return (
    <Dialog
      open
      onClose={schliessen}
      breit={geladen !== null}
      title="Spieler:innen importieren"
      actions={
        <>
          <Button type="button" variant="outlined" onClick={schliessen} disabled={pending}>
            Abbrechen
          </Button>
          {geladen && (
            <Button type="button" variant="filled" onClick={uebernehmen} disabled={!kann}>
              {anzahlJs === 0 && anzahlNeu > 0 ? `${anzahlNeu} übernehmen` : "Übernehmen"}
            </Button>
          )}
        </>
      }
    >
      {dateiFeld}
      {!geladen ? (
        <div className="flex flex-col gap-4">
          {dateiFehler && <SectionMessage appearance="error">{dateiFehler}</SectionMessage>}
          <p>
            Wähle eine CSV-Datei mit den Spieler:innen des Vereins. Du siehst zuerst eine Vorschau; übernommen wird erst,
            wenn du bestätigst.
          </p>
          <p>{IMPORT_TEXT.einleitung(vereinName)}</p>
          <div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outlined" onClick={() => datei.current?.click()}>
                <FileUp size={18} aria-hidden />
                {dateiFehler ? "Andere Datei wählen" : "Datei wählen"}
              </Button>
            </div>
            <p className="type-body-small mt-1.5">
              CSV mit Semikolon oder Komma, zum Beispiel aus ClubCorner. Nur Vorname, Nachname, Jahrgang und J+S-Nummer
              verlassen dein Gerät; Elternkontakte, Geburtsdatum und alle übrigen Spalten nicht.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <FileText size={16} aria-hidden className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-on-surface">
              {geladen.name}{" "}
              <span className="text-on-surface-mittel">
                · {geladen.tabelle.zeilen.length} {geladen.tabelle.zeilen.length === 1 ? "Zeile" : "Zeilen"}
              </span>
            </span>
            <Button type="button" variant="quiet" onClick={() => datei.current?.click()} disabled={pending}>
              Andere Datei
            </Button>
          </div>

          {veraltet && <SectionMessage appearance="warning">{IMPORT_TEXT.veraltet}</SectionMessage>}
          {fehler && (
            <SectionMessage
              appearance="error"
              actions={
                // Die Vorschau scheiterte: ein neuer Versuch mit derselben Datei
                // (nach einer gescheiterten Übernahme ist «Übernehmen» der Weg).
                !vorschau && !laedt ? (
                  <Button type="button" variant="link" onClick={() => laden(geladen)}>
                    Erneut versuchen
                  </Button>
                ) : undefined
              }
            >
              {fehler}
            </SectionMessage>
          )}
          {vorschau && !stimmig && <SectionMessage appearance="error">{IMPORT_TEXT.unstimmig}</SectionMessage>}
          <Spalten geladen={geladen} onZuordnen={zuordnen} gesperrt={pending} />
          {!zuordnungVollstaendig(geladen.zuordnung) ? (
            <p className="kontur rounded-flaeche border-dashed border-kante px-6 py-8 text-center">
              Sobald Vorname, Nachname und Geburtsdatum je einer Spalte zugeordnet sind, zeigt KiFu hier, wer neu
              dazukommt.
            </p>
          ) : (
            vorschau &&
            stimmig && (
              <Vorschau
                vorschau={vorschau}
                vereinName={vereinName}
                hinweise={zeilen.hinweise}
                eintragVon={eintragVon}
                leer={zeilen.eintraege.length === 0}
              />
            )
          )}
        </div>
      )}
    </Dialog>
  );
}

function Spalten({
  geladen,
  onZuordnen,
  gesperrt,
}: {
  geladen: Geladen;
  onZuordnen: (a: ImportAngabe, wert: string) => void;
  /** Während der Übernahme: Die Zeilen dürfen sich nicht mehr ändern. */
  gesperrt: boolean;
}) {
  const { tabelle, zuordnung } = geladen;
  const optionen = tabelle.kopf.map((kopf, i) => {
    const bsp = beispielVon(tabelle, i);
    const name = kopf || `Spalte ${i + 1}`;
    return { value: String(i), label: bsp ? `${name} · ${bsp}` : name };
  });
  return (
    <section className="flex flex-col gap-3">
      <h3 className="type-title-small text-on-surface">Spalten</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {IMPORT_ANGABEN.map(({ angabe, label }) => {
          const spalte = zuordnung[angabe];
          const pflicht = angabe !== "jsNummer";
          const fehlt = pflicht && spalte === null;
          return (
            <Select
              key={angabe}
              label={label}
              // Abweichung vom Select-Grundsatz (keine «kein …»-Option): Eine
              // erkannte J+S-Spalte muss sich wieder abwählen lassen (#455 AK 12).
              options={pflicht ? optionen : [...optionen, { value: OHNE_JS, label: "Ohne J+S-Nummer" }]}
              value={spalte === null ? (pflicht ? "" : OHNE_JS) : String(spalte)}
              onChange={(w) => onZuordnen(angabe, w)}
              disabled={gesperrt}
              error={fehlt}
              supportingText={fehlt ? `Ohne ${label} lässt sich niemand übernehmen.` : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

function Vorschau({
  vorschau,
  vereinName,
  hinweise: alle,
  eintragVon,
  leer,
}: {
  vorschau: ImportVorschau;
  vereinName: string;
  hinweise: ImportHinweis[];
  /** Nur mit stimmiger Vorschau gerendert; eine unbekannte Zeile fiele still weg. */
  eintragVon: (zeile: number) => ImportEintrag | undefined;
  /** Keine Zeile der Datei taugt. */
  leer: boolean;
}) {
  // Eine Zeile, die eine spätere derselben Spieler:in überstimmt, nennt die
  // Vorschau nicht (#455 AK 21) — auch nicht ihre J+S-Nummer.
  const genommen = new Set([
    ...vorschau.neu,
    ...[...vorschau.js, ...vorschau.gleich, ...vorschau.mehrfach].map((z) => z.zeile),
  ]);
  const hinweise = alle.filter((h) => h.ausgelassen || genommen.has(h.zeile));
  const ausgelassen = hinweise.filter((h) => h.ausgelassen).length;
  const mehrfach = vorschau.mehrfach.flatMap((m) => {
    const e = eintragVon(m.zeile);
    return e ? [{ zeile: m.zeile, name: spielerName(e), jahrgang: e.jahrgang, teams: m.teams }] : [];
  });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {vorschau.neu.length > 0 && <Lozenge appearance="information">{vorschau.neu.length} neu</Lozenge>}
        {vorschau.js.length > 0 && <Lozenge appearance="warning">{importJsPlakette(vorschau.js.length)}</Lozenge>}
        {vorschau.gleich.length > 0 && <Lozenge>{vorschau.gleich.length} unverändert</Lozenge>}
        {mehrfach.length > 0 && <Lozenge appearance="warning">{mehrfach.length} mehrfach im Verein geführt</Lozenge>}
        {ausgelassen > 0 && <Lozenge appearance="danger">{ausgelassen} ausgelassen</Lozenge>}
      </div>

      {vorschau.ueber > 0 ? (
        <SectionMessage appearance="error">{importUeberGrenzeText(vorschau)}</SectionMessage>
      ) : (
        vorschau.neu.length > 0 && (
          <SectionMessage appearance="information">{importNeuText(vorschau.neu.length, vorschau.bestand, vereinName)}</SectionMessage>
        )
      )}

      {vorschau.neu.length > 0 && (
        <Gruppe titel="Neu im Verein" lozenge={<Lozenge appearance="information">Neu</Lozenge>}>
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem]" kopf={["Name", "Jahrgang", "J+S-Nr."]}>
            {vorschau.neu.map((z) => {
              const e = eintragVon(z);
              if (!e) return null;
              return (
                <TabellenZeile key={z}>
                  <Name e={e} zusatz={[e.jahrgang, e.jsNummer && `J+S ${e.jsNummer}`]} />
                  <span className="hidden sm:block">{e.jahrgang}</span>
                  <Js wert={e.jsNummer} />
                </TabellenZeile>
              );
            })}
          </Tabelle>
        </Gruppe>
      )}

      {vorschau.js.length > 0 && (
        <Gruppe titel="Neue J+S-Nummer" lozenge={<Lozenge appearance="warning">J+S</Lozenge>}>
          <Tabelle
            spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)_10rem]"
            kopf={["Name", "Jahrgang", "Teams", "J+S-Nr. bisher → neu"]}
          >
            {vorschau.js.map(({ zeile, alt, teams }) => {
              const e = eintragVon(zeile);
              if (!e) return null;
              const wechsel = `${alt ?? "–"} → ${e.jsNummer}`;
              return (
                <TabellenZeile key={zeile}>
                  <Name e={e} zusatz={[e.jahrgang, `J+S ${wechsel}`]} teams={teams} />
                  <span className="hidden sm:block">{e.jahrgang}</span>
                  <TeamsZelle teams={teams} />
                  <span className="hidden truncate sm:block">
                    <span className={alt ? undefined : "text-on-surface-tief"}>{alt ?? "–"}</span> →{" "}
                    <span className="text-on-surface">{e.jsNummer}</span>
                  </span>
                </TabellenZeile>
              );
            })}
          </Tabelle>
        </Gruppe>
      )}

      {mehrfach.length > 0 && (
        <Gruppe
          titel="Mehrfach im Verein geführt"
          lozenge={<Lozenge appearance="warning">Mehrfach</Lozenge>}
          hinweis={<SectionMessage appearance="warning">{importMehrfachText(mehrfach)}</SectionMessage>}
        >
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)]" kopf={["Name", "Jahrgang", "Teams"]}>
            {mehrfach.map(({ zeile, teams }) => {
              const e = eintragVon(zeile);
              if (!e) return null;
              return (
                <TabellenZeile key={zeile}>
                  <Name e={e} zusatz={[e.jahrgang]} teams={teams} />
                  <span className="hidden sm:block">{e.jahrgang}</span>
                  <TeamsZelle teams={teams} />
                </TabellenZeile>
              );
            })}
          </Tabelle>
        </Gruppe>
      )}

      {hinweise.length > 0 && (
        <Gruppe titel="Ausgelassen oder ohne J+S-Nummer" lozenge={<Lozenge appearance="danger">Hinweise</Lozenge>}>
          <Tabelle spalten="sm:grid-cols-[4.5rem_minmax(0,1fr)]" kopf={["Zeile", "Hinweis"]}>
            {hinweise.map((h) => (
              <TabellenZeile key={h.zeile}>
                <span className="hidden sm:block">{h.zeile}</span>
                <span className="min-w-0 flex-1">
                  <span className="sm:hidden">Zeile {h.zeile}: </span>
                  {h.name && <span className="text-on-surface">{h.name}: </span>}
                  {h.text}
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>
        </Gruppe>
      )}

      {vorschau.gleich.length > 0 && (
        <Disclosure title="Unverändert" count={vorschau.gleich.length}>
          <Scroll titel="Unverändert">
            <Tabelle
              spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)_7rem]"
              kopf={["Name", "Jahrgang", "Teams", "J+S-Nr."]}
            >
              {vorschau.gleich.map(({ zeile, teams }) => {
                const e = eintragVon(zeile);
                if (!e) return null;
                return (
                  <TabellenZeile key={zeile}>
                    <Name e={e} zusatz={[e.jahrgang]} teams={teams} />
                    <span className="hidden sm:block">{e.jahrgang}</span>
                    <TeamsZelle teams={teams} />
                    <Js wert={e.jsNummer} />
                  </TabellenZeile>
                );
              })}
            </Tabelle>
          </Scroll>
        </Disclosure>
      )}

      {vorschau.neu.length + vorschau.js.length === 0 && (
        <p>{leer ? "Keine Zeile der Datei lässt sich übernehmen." : importNichtsZuTunText(vorschau.mehrfach.length)}</p>
      )}
    </div>
  );
}

/** Eine Gruppe der Vorschau; ihre Tabelle scrollt ab einer gewissen Höhe. */
function Gruppe({
  titel,
  lozenge,
  hinweis,
  children,
}: {
  titel: string;
  lozenge: React.ReactNode;
  /** Steht über der Tabelle und scrollt nicht mit. */
  hinweis?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="type-title-small flex items-center gap-2 text-on-surface">
        {lozenge}
        {titel}
      </h3>
      {hinweis}
      <Scroll titel={titel}>{children}</Scroll>
    </section>
  );
}

/** Höchstens 18 rem hoch, dann scrollt der Bereich — fokussierbar und benannt,
 *  damit die Tastatur ihn bedient. Bei 1000 Zeilen bliebe «Übernehmen» sonst
 *  weit unten. */
function Scroll({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={titel} tabIndex={0} className="focus-ring flex max-h-72 flex-col gap-2 overflow-y-auto rounded-flaeche">
      {children}
    </div>
  );
}

/** Der Name, schmal mit den Angaben (und Teams) darunter (Muster der Spielerliste). */
function Name({ e, zusatz, teams }: { e: ImportEintrag; zusatz: (string | number | null | false)[]; teams?: ImportTeam[] }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-on-surface">{spielerName(e)}</span>
      <span className="type-body-small block sm:hidden">{zusatz.filter(Boolean).join(" · ")}</span>
      {teams && (
        <span className="mt-1 block sm:hidden">
          <SpielerTeams teams={teams} />
        </span>
      )}
    </span>
  );
}

/** Die Teams der bestehenden Spieler:in ab sm als eigene Spalte, «ohne Team» als Warnung. */
function TeamsZelle({ teams }: { teams: ImportTeam[] }) {
  return (
    <span className="hidden min-w-0 sm:block">
      <SpielerTeams teams={teams} />
    </span>
  );
}

function Js({ wert }: { wert: string | null }) {
  return <span className={`hidden truncate sm:block ${wert ? "" : "text-on-surface-tief"}`}>{wert ?? "–"}</span>;
}
