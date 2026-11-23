import { Button, KategorieLozenge, Lozenge, SectionMessage } from "@/components/ui";
import { THEMEN, kontrast, ueberlagern, type Erscheinungsbild } from "@/lib/farben";
import { kategorienSlugs } from "@/lib/vocab";

/* Die beiden Erscheinungsbilder nebeneinander, mit den lebenden Klassen und
   echten Bausteinen. Jede Tafel setzt nur `color-scheme` — dieselbe
   Eigenschaft, über die auch die Anwendung umschaltet; `light-dark()` in den
   Tokens tut den Rest. Die Zahlen rechnet `lib/farben.ts` beim Rendern nach:
   Läuft das CSS dem Zwilling davon, passen Fläche und Wert nicht mehr. */

const v = (wert: number) => `${wert.toFixed(2)}:1`;

const STUFEN = [
  { dp: 0, klasse: "bg-elev-00", rolle: "Grund" },
  { dp: 1, klasse: "bg-elev-01", rolle: "Karte" },
  { dp: 2, klasse: "bg-elev-02", rolle: "In der Karte" },
  { dp: 8, klasse: "bg-elev-08 shadow-dp-08", rolle: "Menü" },
  { dp: 24, klasse: "bg-elev-24 shadow-dp-24", rolle: "Dialog" },
] as const;

function stufe(t: Erscheinungsbild, dp: number): string {
  return t.elev.find((s) => s.dp === dp)?.hex ?? "";
}

function Tafel({ t }: { t: Erscheinungsbild }) {
  const grund = stufe(t, 0);
  const karte = stufe(t, 1);
  const mittel = ueberlagern(t.schrift, t.deckung.mittel, karte);
  return (
    <div
      style={{ colorScheme: t.name === "hell" ? "light" : "dark" }}
      className="rounded-dialog kontur border-linie bg-elev-00 p-5 text-on-surface"
    >
      <p className="type-label-medium mb-4 text-on-surface-mittel">
        {t.name === "hell" ? "Hell" : "Dunkel"}
      </p>

      <div className="mb-5 grid grid-cols-5 gap-2">
        {STUFEN.map((s) => (
          <div key={s.dp} className={`rounded-flaeche p-2 ${s.klasse}`}>
            <span className="type-label-small block">{`elev-${String(s.dp).padStart(2, "0")}`}</span>
            <span className="type-body-small block text-on-surface-mittel">{s.rolle}</span>
            <span className="type-body-small block text-on-surface-mittel">{stufe(t, s.dp)}</span>
          </div>
        ))}
      </div>

      <div className="mb-5 rounded-flaeche bg-elev-01 p-4">
        <p className="type-title-medium">Training · Di 18:00</p>
        <p className="type-body-medium text-on-surface-mittel">13 von 16 dabei, 3 abgemeldet</p>
        <p className="type-body-medium text-primary">Training zusammenstellen</p>
        <p className="type-body-medium text-error">Gib einen Beginn ein.</p>
        <p className="type-body-medium text-on-surface-tief">Deaktiviert</p>
        <div className="mt-3 rounded-flaeche bg-elev-02 p-3">
          <p className="type-body-medium">Übungszeile in der Karte</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="type-body-medium rounded-flaeche betont px-3 py-1.5">Aktive Zeile</span>
        <span className="rounded-flaeche bg-elev-01 p-1.5">
          <span className="type-body-medium block rounded-klein betont px-2 py-1">Betont in der Karte</span>
        </span>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button>Gefüllt</Button>
        <Button variant="outlined">Umrandet</Button>
        <Button variant="text">Text</Button>
        <Button variant="danger">Löschen</Button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {kategorienSlugs.map((k) => (
          <KategorieLozenge key={k} k={k} />
        ))}
        <Lozenge appearance="success">angemeldet</Lozenge>
        <Lozenge appearance="warning">Kein Training</Lozenge>
        <Lozenge appearance="danger">abgemeldet</Lozenge>
      </div>

      <div className="mb-5 grid gap-2">
        <SectionMessage>Die Meldefrist läuft morgen ab.</SectionMessage>
        <SectionMessage appearance="error">Das Training liess sich nicht speichern.</SectionMessage>
      </div>

      <div className="umkehr mb-5 flex items-center justify-between rounded-flaeche px-4 py-3 shadow-dp-06">
        <span className="type-body-medium">Training gespeichert</span>
        <span className="type-title-small text-primary">Rückgängig</span>
      </div>

      <dl className="type-body-small grid grid-cols-2 gap-x-4 gap-y-1 text-on-surface-mittel">
        <dt>Schrift auf Grund</dt>
        <dd>{v(kontrast(t.schrift, grund))}</dd>
        <dt>Mittlere Schrift auf Karte</dt>
        <dd>{v(kontrast(mittel, karte))}</dd>
        <dt>Primary auf Karte</dt>
        <dd>{v(kontrast(t.primary, karte))}</dd>
        <dt>Error auf Karte</dt>
        <dd>{v(kontrast(t.error, karte))}</dd>
        <dt>Aufschrift auf Primary</dt>
        <dd>{v(kontrast(t.onPrimary, t.primary))}</dd>
        <dt>Umgekehrte Fläche: Schrift</dt>
        <dd>{v(kontrast(t.umkehr.schrift, t.umkehr.flaeche))}</dd>
      </dl>
    </div>
  );
}

export function ErscheinungsbildDemo() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {THEMEN.map((t) => (
        <Tafel key={t.name} t={t} />
      ))}
    </div>
  );
}
