"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, FileUp } from "lucide-react";
import { Button, Dialog, Disclosure, Lozenge, SectionMessage, Select, Tabelle, TabellenZeile } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { importiereSpielerAktion, pruefeSpielerImportAktion } from "@/lib/actions/spieler";
import { spielerName } from "@/lib/spieler";
import {
  IMPORT_ANGABEN,
  IMPORT_TEXT,
  beispielVon,
  erkenneSpalten,
  erwartetVon,
  importErgebnisText,
  importZeilen,
  importZuGross,
  leseDatei,
  zuordnungVollstaendig,
  type CsvTabelle,
  type ImportAngabe,
  type ImportEintrag,
  type ImportHinweis,
  type ImportVorschau,
  type Zuordnung,
} from "@/lib/spieler-import";

/* Spieler:innen aus einer CSV-Datei übernehmen (Story #455, Leinwand
   «KiFu CSV-Import Spielerliste»). Ein Dialog in zwei Stufen: schmal die
   Datei wählen, dann breit die Vorschau mit der Zuordnung der Spalten.
   Gelesen wird hier im Browser; an den Server gehen nur Vorname, Nachname,
   Jahrgang und J+S-Nummer je Zeile. Die Datenebene ordnet die Zeilen ein
   (neu, neue J+S-Nummer, unverändert) und übernimmt beim Bestätigen nur,
   wenn ihre Einordnung noch der Vorschau entspricht — sonst steht allein
   die Meldung da, wie bei einer zu grossen Liste (PO 2026-10-17). */

type Geladen = { name: string; tabelle: CsvTabelle; zuordnung: Zuordnung };

const OHNE_JS = "ohne";

export function SpielerImport({ teamId, offen, onClose }: { teamId: string; offen: boolean; onClose: () => void }) {
  const router = useRouter();
  const melde = useSnackbar();
  // Die Vorschau liest nur; schliessen lässt sich der Dialog nur während der
  // Übernahme nicht.
  const [laedt, startVorschau] = useTransition();
  const [pending, startTransition] = useTransition();
  const [geladen, setGeladen] = useState<Geladen | null>(null);
  const [dateiFehler, setDateiFehler] = useState<string | null>(null);
  const [vorschau, setVorschau] = useState<ImportVorschau | null>(null);
  // Ein Fehler, nach dem nur eine neue Datei weiterhilft (Liste geändert).
  const [gesperrt, setGesperrt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  // Verwirft die Antwort einer Vorschau, die eine neuere schon überholt hat.
  const lauf = useRef(0);

  // Die Zeilen der Datei nach der Zuordnung — dieselben für Vorschau und Übernahme.
  const [zeilen, setZeilen] = useState<{ eintraege: ImportEintrag[]; hinweise: ImportHinweis[] }>({ eintraege: [], hinweise: [] });

  function schliessen() {
    if (pending) return;
    lauf.current++;
    setGeladen(null);
    setZeilen({ eintraege: [], hinweise: [] });
    setDateiFehler(null);
    setVorschau(null);
    setGesperrt(null);
    setFehler(null);
    onClose();
  }

  /** Datei und Zuordnung übernehmen und die Vorschau dazu holen. */
  function laden(g: Geladen) {
    const nr = ++lauf.current;
    setGeladen(g);
    setVorschau(null);
    setFehler(null);
    if (!zuordnungVollstaendig(g.zuordnung)) return setZeilen({ eintraege: [], hinweise: [] });
    const z = importZeilen(g.tabelle, g.zuordnung);
    setZeilen(z);
    const { eintraege } = z;
    startVorschau(async () => {
      const r = await pruefeSpielerImportAktion(teamId, eintraege);
      if (nr !== lauf.current) return;
      if (!r.ok) return setFehler(r.error);
      setVorschau(r.vorschau);
    });
  }

  async function dateiGewaehlt(f: File) {
    const r = leseDatei(f.name, new Uint8Array(await f.arrayBuffer()));
    setGesperrt(null);
    if (!r.ok) {
      lauf.current++;
      setGeladen(null);
      setVorschau(null);
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
    startTransition(async () => {
      const r = await importiereSpielerAktion(teamId, zeilen.eintraege, erwartetVon(vorschau));
      if (!r.ok) {
        if (r.geaendert) setGesperrt(r.error);
        else setFehler(r.error);
        return;
      }
      lauf.current++;
      setGeladen(null);
      setVorschau(null);
      onClose();
      router.refresh();
      melde(importErgebnisText(r));
    });
  }

  const zuGross = vorschau !== null && importZuGross(vorschau);
  const meldung = gesperrt ?? (zuGross ? IMPORT_TEXT.zuGross : null);
  const anzahlNeu = vorschau?.neu.length ?? 0;
  const anzahlJs = vorschau?.js.length ?? 0;
  const kann = vorschau !== null && meldung === null && !fehler && !pending && !laedt && anzahlNeu + anzahlJs > 0;
  const nachZeile = new Map(zeilen.eintraege.map((e) => [e.zeile, e]));
  const eintragVon = (zeile: number) => nachZeile.get(zeile)!;

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
      open={offen}
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
          <p>Wähle eine CSV-Datei mit deinen Spieler:innen. Du siehst zuerst eine Vorschau; übernommen wird erst, wenn du bestätigst.</p>
          <div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outlined" onClick={() => datei.current?.click()}>
                <FileUp size={18} aria-hidden />
                {dateiFehler ? "Andere Datei wählen" : "Datei wählen"}
              </Button>
            </div>
            <p className="type-body-small mt-1.5">
              CSV mit Semikolon oder Komma. Nur Vorname, Nachname, Jahrgang und J+S-Nummer verlassen dein Gerät;
              Elternkontakte, Geburtsdatum und alle übrigen Spalten nicht.
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

          {meldung ? (
            <SectionMessage appearance="error">{meldung}</SectionMessage>
          ) : (
            <>
              {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
              <Spalten geladen={geladen} onZuordnen={zuordnen} />
              {!zuordnungVollstaendig(geladen.zuordnung) ? (
                <p className="kontur rounded-flaeche border-dashed border-kante px-6 py-8 text-center">
                  Sobald Vorname, Nachname und Geburtsdatum je einer Spalte zugeordnet sind, zeigt KiFu hier, wer neu
                  dazukommt.
                </p>
              ) : (
                vorschau && (
                  <Vorschau vorschau={vorschau} hinweise={zeilen.hinweise} eintragVon={eintragVon} leer={zeilen.eintraege.length === 0} />
                )
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

function Spalten({ geladen, onZuordnen }: { geladen: Geladen; onZuordnen: (a: ImportAngabe, wert: string) => void }) {
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
  hinweise: alle,
  eintragVon,
  leer,
}: {
  vorschau: ImportVorschau;
  hinweise: ImportHinweis[];
  eintragVon: (zeile: number) => ImportEintrag;
  /** Keine Zeile der Datei taugt. */
  leer: boolean;
}) {
  // Eine Zeile, die eine spätere derselben Spieler:in überstimmt, nennt die
  // Vorschau nicht (#455 AK 21) — auch nicht ihre J+S-Nummer.
  const genommen = new Set([...vorschau.neu, ...vorschau.js.map((j) => j.zeile), ...vorschau.gleich]);
  const hinweise = alle.filter((h) => h.ausgelassen || genommen.has(h.zeile));
  const ausgelassen = hinweise.filter((h) => h.ausgelassen).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {vorschau.neu.length > 0 && <Lozenge appearance="information">{vorschau.neu.length} neu</Lozenge>}
        {vorschau.js.length > 0 && <Lozenge appearance="warning">{vorschau.js.length} J+S-Nummer ändert sich</Lozenge>}
        {vorschau.gleich.length > 0 && <Lozenge>{vorschau.gleich.length} unverändert</Lozenge>}
        {ausgelassen > 0 && <Lozenge appearance="danger">{ausgelassen} ausgelassen</Lozenge>}
      </div>

      {vorschau.neu.length > 0 && (
        <Gruppe titel="Kommen auf die Liste" lozenge={<Lozenge appearance="information">Neu</Lozenge>}>
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem]" kopf={["Name", "Jahrgang", "J+S-Nr."]}>
            {vorschau.neu.map((z) => {
              const e = eintragVon(z);
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
        <Gruppe titel="Erhalten eine neue J+S-Nummer" lozenge={<Lozenge appearance="warning">J+S</Lozenge>}>
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_12rem]" kopf={["Name", "Jahrgang", "J+S-Nr. bisher → neu"]}>
            {vorschau.js.map(({ zeile, alt }) => {
              const e = eintragVon(zeile);
              const wechsel = `${alt ?? "–"} → ${e.jsNummer}`;
              return (
                <TabellenZeile key={zeile}>
                  <Name e={e} zusatz={[e.jahrgang, `J+S ${wechsel}`]} />
                  <span className="hidden sm:block">{e.jahrgang}</span>
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
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem]" kopf={["Name", "Jahrgang", "J+S-Nr."]}>
            {vorschau.gleich.map((z) => {
              const e = eintragVon(z);
              return (
                <TabellenZeile key={z}>
                  <Name e={e} zusatz={[e.jahrgang]} />
                  <span className="hidden sm:block">{e.jahrgang}</span>
                  <Js wert={e.jsNummer} />
                </TabellenZeile>
              );
            })}
          </Tabelle>
        </Disclosure>
      )}

      {vorschau.neu.length + vorschau.js.length === 0 && (
        <p>{leer ? "Keine Zeile der Datei lässt sich übernehmen." : "Alle stehen schon so auf der Liste; es gibt nichts zu übernehmen."}</p>
      )}
    </div>
  );
}

function Gruppe({ titel, lozenge, children }: { titel: string; lozenge: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="type-title-small flex items-center gap-2 text-on-surface">
        {lozenge}
        {titel}
      </h3>
      {children}
    </section>
  );
}

/** Der Name, schmal mit den Angaben darunter (Muster der Spielerliste). */
function Name({ e, zusatz }: { e: ImportEintrag; zusatz: (string | number | null | false)[] }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-on-surface">{spielerName(e)}</span>
      <span className="type-body-small block sm:hidden">{zusatz.filter(Boolean).join(" · ")}</span>
    </span>
  );
}

function Js({ wert }: { wert: string | null }) {
  return <span className={`hidden truncate sm:block ${wert ? "" : "text-on-surface-tief"}`}>{wert ?? "–"}</span>;
}
