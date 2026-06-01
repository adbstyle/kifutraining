import type { Metadata } from "next";
import {
  Button,
  Badge,
  KategorieChip,
  FilterChip,
  Card,
  ExerciseCard,
} from "@/components/ui";
import { SegmentedDemo } from "./SegmentedDemo";
import { kategorienSlugs } from "@/lib/vocab";

export const metadata: Metadata = {
  title: "Styleguide — KiFu Designsystem",
  robots: { index: false },
};

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-chalk/15 py-10">
      <h2 className="flex items-baseline gap-3 text-2xl text-chalk">
        <span className="font-mono text-sm text-signal">{n}</span>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const swatches = [
  ["rasen-950", "#0a1f15"],
  ["rasen-900", "#0f2a1d"],
  ["rasen-800", "#163a29"],
  ["rasen-700", "#1e4d37"],
  ["chalk", "#f4f1e8"],
  ["chalk-dim", "#b9bcae"],
  ["signal", "#ff5722"],
  ["signal-bright", "#ff6e40"],
];

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      {/* Header */}
      <header className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-signal">
          KiFu · Designsystem
        </p>
        <h1 className="mt-2 text-6xl text-chalk sm:text-7xl">
          Taktik-Editorial
        </h1>
        <p className="mt-4 max-w-xl font-body text-lg text-chalk-dim">
          Chalk-Lines auf Rasen-Dunkelgrün. Ein warmer Signalton. Hoher
          Kontrast für den Spielfeldrand. Die geteilte UI-Basis für Übungspool
          und Trainingsplaner.
        </p>
      </header>

      <Section n="01" title="Farben">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(([name, hex]) => (
            <div key={name} className="chalk-border rounded-[4px] p-3">
              <div
                className="mb-2 h-14 w-full rounded-[2px] border border-chalk/10"
                style={{ background: hex }}
              />
              <p className="font-mono text-[11px] text-chalk">{name}</p>
              <p className="font-mono text-[10px] text-chalk-faint">{hex}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="font-mono text-xs text-chalk-faint">
            Alterskategorien:
          </span>
          {kategorienSlugs.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </div>
      </Section>

      <Section n="02" title="Typografie">
        <div className="space-y-4">
          <p className="font-display text-6xl text-chalk">Hauptteil 30′</p>
          <p className="font-display text-3xl text-chalk-dim">
            Display · Anton (kondensiert)
          </p>
          <p className="max-w-prose font-body text-lg text-chalk">
            Body · Source Serif — ruhig und gut lesbar für Übungsbeschreibungen
            und den methodischen Fahrplan am Schreibtisch wie am Feldrand.
          </p>
          <p className="font-mono text-sm uppercase tracking-wider text-signal">
            Mono · Space Mono — Labels, Dauern, Kategorien
          </p>
        </div>
      </Section>

      <Section n="03" title="Buttons">
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="primary">Plan erstellen</Button>
          <Button variant="secondary">Filter zurücksetzen</Button>
          <Button variant="ghost">Abbrechen</Button>
          <Button variant="danger">Übung löschen</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button size="sm">Klein</Button>
          <Button size="md">Mittel</Button>
          <Button size="lg">Gross · Spielfeldrand</Button>
        </div>
      </Section>

      <Section n="04" title="Badges & Chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="manual" />
          <Badge tone="oeffentlich" />
          <Badge tone="entwurf">✎ Entwurf</Badge>
          <FilterChip selected>Aktiv</FilterChip>
          <FilterChip>Inaktiv</FilterChip>
        </div>
      </Section>

      <Section n="05" title="Filter (interaktiv)">
        <p className="mb-5 max-w-xl font-body text-chalk-dim">
          Freie Filterung: jede Dimension ist unabhängig und immer sichtbar.
          Dimensionen werden mit UND verknüpft, Werte innerhalb einer Dimension
          mit ODER. Sinnlose Kombinationen liefern eine leere Ergebnismenge (mit
          Hinweis) — keine Filter werden ausgeblendet.
        </p>
        <SegmentedDemo />
      </Section>

      <Section n="06" title="Übungskarten">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ExerciseCard
            ex={{
              slug: "schiessbude",
              name: "Schiessbude",
              trainingsteilLabel: "Ausklang",
              feldtypLabel: "Kleinfeld",
              kategorien: ["G", "F", "E"],
              herkunft: "manual",
            }}
          />
          <ExerciseCard
            ex={{
              slug: "mein-4-gegen-4",
              name: "Mein 4-gegen-4",
              trainingsteilLabel: "Hauptteil",
              feldtypLabel: "Grossfeld",
              kategorien: ["F", "E"],
              herkunft: "user",
              visibility: "private",
            }}
          />
          <ExerciseCard
            ex={{
              slug: "toblerone",
              name: "Toblerone",
              trainingsteilLabel: "Einleitung",
              feldtypLabel: null,
              kategorien: ["G"],
              herkunft: "user",
              visibility: "public",
            }}
          />
        </div>
      </Section>

      <Section n="07" title="Methodischer Fahrplan (Signatur-Komponente)">
        <Card className="max-w-xl p-6">
          {[
            ["①", "Offen starten", "Die Kinder dribbeln auf die Abschlusszone zu und schliessen ab."],
            ["②", "Üben", "Mit linkem und rechtem Fuss kontrolliert führen und in die freie Ecke zielen."],
            ["③", "Wett-eifern", "Wie viele Treffer gelingen mit links, wie viele mit rechts?"],
          ].map(([num, title, text], i) => (
            <div
              key={title}
              className={i > 0 ? "mt-5 border-t border-chalk/15 pt-5" : ""}
            >
              <p className="flex items-center gap-2 font-display text-xl text-signal-bright">
                <span>{num}</span>
                {title}
              </p>
              <p className="mt-1 font-body text-chalk-dim">{text}</p>
            </div>
          ))}
        </Card>
      </Section>
    </main>
  );
}
