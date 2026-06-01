import type { Metadata } from "next";
import {
  Button,
  Badge,
  KategorieChip,
  FilterChip,
  Card,
  ExerciseCard,
  IconButton,
} from "@/components/ui";
import { SegmentedDemo } from "./SegmentedDemo";
import { kategorienSlugs } from "@/lib/vocab";
import {
  Search,
  SlidersHorizontal,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Globe,
  BookOpen,
  Trash2,
  User,
} from "lucide-react";

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
    <section className="border-t border-outline-variant py-10">
      <h2 className="type-headline-small flex items-baseline gap-3 text-on-surface">
        <span className="type-label-medium text-primary">{n}</span>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

const surfaceLadder: [string, string][] = [
  ["surface", "bg-surface"],
  ["surface-container-lowest", "bg-surface-container-lowest"],
  ["surface-container-low", "bg-surface-container-low"],
  ["surface-container", "bg-surface-container"],
  ["surface-container-high", "bg-surface-container-high"],
  ["surface-container-highest", "bg-surface-container-highest"],
];

const extraSurfaces: [string, string][] = [
  ["surface-dim", "bg-surface-dim"],
  ["surface-bright", "bg-surface-bright"],
];

const accentRoles: [string, string][] = [
  ["primary", "bg-primary"],
  ["primary-container", "bg-primary-container"],
  ["secondary", "bg-secondary"],
  ["secondary-container", "bg-secondary-container"],
  ["error", "bg-error"],
  ["error-container", "bg-error-container"],
  ["outline", "bg-outline"],
];

const typeScale: [string, string][] = [
  ["type-display-large", "Display Large · Anton 57"],
  ["type-display-medium", "Display Medium · Anton 45"],
  ["type-display-small", "Display Small · Anton 36"],
  ["type-headline-large", "Headline Large · Anton 32"],
  ["type-headline-medium", "Headline Medium · Anton 28"],
  ["type-headline-small", "Headline Small · Anton 24"],
  ["type-title-large", "Title Large · Source Serif 600 · 22"],
  ["type-title-medium", "Title Medium · Source Serif 600 · 16"],
  ["type-title-small", "Title Small · Source Serif 600 · 14"],
  ["type-body-large", "Body Large · Source Serif · 16"],
  ["type-body-medium", "Body Medium · Source Serif · 14"],
  ["type-body-small", "Body Small · Source Serif · 12"],
  ["type-label-large", "Label Large · Space Mono · 14"],
  ["type-label-medium", "Label Medium · Space Mono · 12"],
  ["type-label-small", "Label Small · Space Mono · 11"],
];

// [Level, Flächen-Klassen (inkl. Border bei L1/L2), Schatten-Klasse]
const elevations: [string, string, string][] = [
  ["0", "bg-surface", ""],
  ["1", "bg-surface-container-low border border-outline", ""],
  ["2", "bg-surface-container border border-outline", ""],
  ["3", "bg-surface-container-high", "shadow-e3"],
  ["4", "bg-surface-container-highest", "shadow-e4"],
  ["5", "bg-surface-container-highest", "shadow-e5"],
];

const spacingSteps: [string, string][] = [
  ["1", "4px"],
  ["2", "8px"],
  ["3", "12px"],
  ["4", "16px"],
  ["6", "24px"],
  ["8", "32px"],
  ["12", "48px"],
  ["16", "64px"],
];

const sizeClasses: [string, string, string][] = [
  ["compact", "< 600", "Margin 16 · 4 Spalten"],
  ["medium", "600–840", "Margin 24 · 8 Spalten"],
  ["expanded", "840–1200", "Margin 24 · 12 Spalten"],
  ["large", "1200–1600", "zentriert, Max-Width"],
  ["extra-large", "> 1600", "zentriert, Max-Width"],
];

const iconSet = [
  Search,
  SlidersHorizontal,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Globe,
  BookOpen,
  Trash2,
  User,
];

const fahrplan: [string, string, string][] = [
  ["①", "Offen starten", "Die Kinder dribbeln auf die Abschlusszone zu und schliessen ab."],
  ["②", "Üben", "Mit linkem und rechtem Fuss kontrolliert führen und in die freie Ecke zielen."],
  ["③", "Wett-eifern", "Wie viele Treffer gelingen mit links, wie viele mit rechts?"],
];

export default function Styleguide() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12">
      <header className="mb-4">
        <p className="type-label-medium text-primary">KiFu · Designsystem</p>
        <h1 className="type-display-large mt-2 text-on-surface">Taktik-Editorial</h1>
        <p className="type-body-large mt-4 max-w-xl text-on-surface-variant">
          Chalk-Lines auf Rasen-Dunkelgrün. Ein warmer Signalton. Hoher Kontrast
          für den Spielfeldrand. Die geteilte UI-Basis für Übungspool und
          Trainingsplaner.
        </p>
      </header>

      <Section n="01" title="Color Roles">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Semantische M3-Rollen über der KiFu-Palette. Surface-Leiter =
          Elevation-Leiter. Signal ist der einzige warme Hue.
        </p>
        <p className="type-label-small mb-2 text-on-surface-variant">Surface-Leiter</p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {surfaceLadder.map(([name, bg]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
            </div>
          ))}
        </div>
        <p className="type-label-small mb-2 text-on-surface-variant">Weitere Surface-Rollen</p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {extraSurfaces.map(([name, bg]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
            </div>
          ))}
        </div>
        <p className="type-label-small mb-2 text-on-surface-variant">Akzent &amp; Rollen</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {accentRoles.map(([name, bg]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="type-label-small text-on-surface-variant">Alterskategorien:</span>
          {kategorienSlugs.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </div>
      </Section>

      <Section n="02" title="Typografie — M3 Type-Scale">
        <div className="space-y-3">
          {typeScale.map(([cls, label]) => (
            <div key={cls} className="border-b border-outline-variant pb-3">
              <p className={`${cls} text-on-surface`}>{label}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="03" title="Elevation">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Höhe über Surface-Container; Schatten erst ab Level 3. Der CTA-Schatten
          ist eine eigene Signatur (siehe Buttons), kein Elevation-Level.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {elevations.map(([lvl, bg, shadow]) => (
            <div
              key={lvl}
              className={`flex h-20 items-center justify-center rounded-[4px] ${bg} ${shadow}`}
            >
              <span className="type-label-medium text-on-surface">L{lvl}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Spacing — 4-dp-Grid">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Kanonische Schritte: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Keine
          willkürlichen Pixelwerte.
        </p>
        <div className="space-y-2">
          {spacingSteps.map(([step, px]) => (
            <div key={step} className="flex items-center gap-3">
              <span className="type-label-small w-16 text-on-surface-variant">{px}</span>
              <div className="h-4 bg-primary" style={{ width: px }} />
              <span className="type-label-small text-on-surface-variant">space-{step}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="05" title="Iconography — Lucide">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Open-Source Lucide, outlined, Strich 2px. „Selected" über Farbe +
          State-Layer (statt Fill). Größen 20 / 24 / 40.
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-5 text-on-surface-variant">
          {iconSet.map((Icon, i) => (
            <Icon key={i} size={24} strokeWidth={2} aria-hidden />
          ))}
        </div>
        <div className="mb-6 flex items-end gap-6 text-on-surface-variant">
          {[20, 24, 40].map((sz) => (
            <div key={sz} className="flex flex-col items-center gap-1">
              <Search size={sz} strokeWidth={2} aria-hidden />
              <span className="type-label-small">{sz}px</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <IconButton icon={Search} label="Suchen" />
          <IconButton icon={SlidersHorizontal} label="Filter" active />
          <IconButton icon={Plus} label="Hinzufügen" size="sm" />
          <span className="type-label-small text-on-surface-variant">
            default · aktiv (State-Layer) · sm
          </span>
        </div>
      </Section>

      <Section n="06" title="Layout &amp; Structure">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          M3 Window Size Classes &amp; Body-Margins. Content-Max-Width für
          Lesbarkeit; Spalten-Grid 4 / 8 / 12.
        </p>
        <div className="space-y-2">
          {sizeClasses.map(([cls, range, note]) => (
            <div
              key={cls}
              className="flex flex-wrap items-baseline gap-3 border-b border-outline-variant pb-2"
            >
              <span className="type-title-small w-28 text-on-surface">{cls}</span>
              <span className="type-label-medium text-primary">{range}</span>
              <span className="type-body-small text-on-surface-variant">{note}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="07" title="Buttons">
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

      <Section n="08" title="Badges &amp; Chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="manual" />
          <Badge tone="oeffentlich" />
          <Badge tone="entwurf">✎ Entwurf</Badge>
          <FilterChip selected>Aktiv</FilterChip>
          <FilterChip>Inaktiv</FilterChip>
        </div>
      </Section>

      <Section n="09" title="Filter (interaktiv)">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Freie Filterung: jede Dimension ist unabhängig und immer sichtbar.
          Dimensionen werden mit UND verknüpft, Werte innerhalb einer Dimension
          mit ODER. Sinnlose Kombinationen liefern eine leere Ergebnismenge (mit
          Hinweis) — keine Filter werden ausgeblendet.
        </p>
        <SegmentedDemo />
      </Section>

      <Section n="10" title="Übungskarten">
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

      <Section n="11" title="Methodischer Fahrplan (Signatur-Komponente)">
        <Card className="max-w-xl p-6">
          {fahrplan.map(([num, title, text], i) => (
            <div
              key={title}
              className={i > 0 ? "mt-5 border-t border-outline-variant pt-5" : ""}
            >
              <p className="type-headline-small flex items-center gap-2 text-primary">
                <span>{num}</span>
                {title}
              </p>
              <p className="type-body-medium mt-1 text-on-surface-variant">{text}</p>
            </div>
          ))}
        </Card>
      </Section>
    </main>
  );
}
