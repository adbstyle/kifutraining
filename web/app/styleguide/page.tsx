import type { Metadata } from "next";
import {
  Button,
  ButtonLink,
  ButtonGroup,
  Badge,
  Card,
  ExerciseCard,
  IconButton,
  IconButtonLink,
  TabNav,
  Tooltip,
  TextField,
  PasswordField,
  TextArea,
  DateField,
  TimeField,
  Select,
  MethodischerFahrplan,
  Disclosure,
} from "@/components/ui";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { SegmentedDemo } from "./SegmentedDemo";
import { ChipsDemo } from "./ChipsDemo";
import { ChoiceChipDemo } from "./ChoiceChipDemo";
import { MenuDemo } from "./MenuDemo";
import { MultiSelectDemo } from "./MultiSelectDemo";
import { HeaderNavDemo } from "./HeaderNavDemo";
import { OverlaysDemo } from "./OverlaysDemo";
import { BreadcrumbsDemo } from "./BreadcrumbsDemo";
import { OverflowMenuDemo } from "./OverflowMenuDemo";
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
  Pencil,
  Info,
} from "lucide-react";
import { DiagrammView, GlyphVorschau } from "@/components/diagramm/DiagrammView";
import { DiagrammVorschau } from "@/components/diagramm/DiagrammVorschau";
import { ROTATIONEN, SPIELER_POSEN, type DiagrammElement } from "@/lib/diagramm";

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

// Alterskategorien als Palette-Farben (Token + Stufe) — die kanonische
// Quelle für die Kategorie-Farben; keine neuen Hues erfinden.
// G/F/E gehören zum Kinderfussball, D/C/B/A zum Juniorenfussball (Epic #71).
// Sieben Werte lassen sich nicht mehr allein über die Farbe unterscheiden:
// jedes Badge trägt darum immer den Buchstaben (siehe KategorieChip).
const kategorieColors: [string, string, string][] = [
  ["kat-g", "bg-kat-g", "G-Junior:innen"],
  ["kat-f", "bg-kat-f", "F-Junior:innen"],
  ["kat-e", "bg-kat-e", "E-Junior:innen"],
  ["kat-d", "bg-kat-d", "D-Junior:innen"],
  ["kat-c", "bg-kat-c", "C-Junior:innen"],
  ["kat-b", "bg-kat-b", "B-Junior:innen"],
  ["kat-a", "bg-kat-a", "A-Junior:innen"],
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
          Trainings.
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
        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">Alterskategorien</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {kategorieColors.map(([name, bg, stufe]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
              <p className="type-label-small text-on-surface-variant">{stufe}</p>
            </div>
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
          Höhe über Surface-Container; Schatten erst ab Level 3.
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
          State-Layer (statt Fill). Größen 20 / 24 / 40. Interaktiv → siehe
          Icon-Buttons unter „Buttons".
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-5 text-on-surface-variant">
          {iconSet.map((Icon, i) => (
            <Icon key={i} size={24} strokeWidth={2} aria-hidden />
          ))}
        </div>
        <div className="flex items-end gap-6 text-on-surface-variant">
          {[20, 24, 40].map((sz) => (
            <div key={sz} className="flex flex-col items-center gap-1">
              <Search size={sz} strokeWidth={2} aria-hidden />
              <span className="type-label-small">{sz}px</span>
            </div>
          ))}
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

      <Section n="07" title="Buttons (M3-Styles) &amp; Button-Group">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          M3-Emphase-Stufen über <code>--button-*</code>-Component-Tokens. Filled
          ist flächig mit M3-State-Layer beim Hover, Elevated trägt den weichen
          M3-Schatten. Shape bleibt KiFu-eckig (3px).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="filled">Training erstellen</Button>
          <Button variant="tonal">Duplizieren</Button>
          <Button variant="elevated">Teilen</Button>
          <Button variant="outlined">Filter zurücksetzen</Button>
          <Button variant="text">Abbrechen</Button>
          <Button variant="danger">Übung löschen</Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Button size="sm">Klein</Button>
          <Button size="md">Mittel</Button>
          <Button size="lg">Gross · Spielfeldrand</Button>
        </div>
        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Button-Link (navigiert als &lt;a&gt; — kein &lt;a&gt;&lt;button&gt;-Nesting)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <ButtonLink href="#" variant="filled">Neue Übung</ButtonLink>
          <ButtonLink href="#" variant="tonal" size="sm">Bearbeiten</ButtonLink>
        </div>
        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Connected Button-Group (verbundene Aktionen)
        </p>
        <ButtonGroup ariaLabel="Ansicht wählen">
          <Button variant="outlined">Liste</Button>
          <Button variant="outlined">Raster</Button>
          <Button variant="outlined">Karte</Button>
        </ButtonGroup>

        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Icon-Buttons (M3 — outlined Icon + State-Layer, primary im aktiven Zustand)
        </p>
        <div className="flex items-center gap-4">
          <IconButton icon={Search} label="Suchen" />
          <IconButton icon={SlidersHorizontal} label="Filter" active />
          <IconButton icon={Plus} label="Hinzufügen" size="sm" />
          <IconButton icon={Plus} label="Hinzufügen" variant="overlay" />
          <span className="type-label-small text-on-surface-variant">
            default · aktiv (State-Layer) · sm · overlay (über Bild)
          </span>
        </div>

        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Icon-Button als Link (<code>IconButtonLink</code>) + Tooltip (Hover/Fokus)
        </p>
        <p className="type-body-medium mb-3 max-w-xl text-on-surface-variant">
          <code>IconButtonLink</code> ist die Navigations-Variante (rendert ein
          <code>&lt;a&gt;</code> statt <code>&lt;button&gt;</code>, gleiche Optik).
          <code>Tooltip</code> umschliesst einen icon-only Trigger und macht ihn
          lesbar — Pflicht, sobald das Icon allein mehrdeutig ist (z. B. Globus =
          öffentlich vs. Schloss = privat). CSS-only, <code>aria-hidden</code>
          (der Name kommt schon vom <code>aria-label</code> des Triggers).
        </p>
        <div className="flex items-center gap-4">
          <Tooltip label="Bearbeiten">
            <IconButtonLink href="#" icon={Pencil} label="Bearbeiten" size="sm" />
          </Tooltip>
          <Tooltip label="Öffentlich schalten">
            <IconButton icon={Globe} label="Öffentlich schalten" size="sm" />
          </Tooltip>
          <Tooltip label="Auf privat setzen">
            <IconButton icon={Lock} label="Auf privat setzen" size="sm" />
          </Tooltip>
          <span className="type-label-small text-on-surface-variant">
            (hovern oder per Tab fokussieren)
          </span>
        </div>

        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Ansichts-Umschalter (<code>TabNav</code>)
        </p>
        <p className="type-body-medium mb-3 max-w-xl text-on-surface-variant">
          Mehrere Sichten auf denselben Gegenstand — etwa ein Team mit
          Trainingsplan, Trainings und Verwaltung. Bewusst Links statt
          Schaltflächen: jede Ansicht hat ihre eigene Adresse, ist damit
          weitergebbar, und der Zurück-Schritt des Browsers funktioniert.
          Deshalb nicht <code>SegmentedControl</code> — die ist ein Eingabefeld
          für eine Auswahl, kein Navigationsmittel. Die Optik folgt der
          Hauptnavigation, damit „hier wechselt man den Ort" überall dasselbe
          Bild ergibt.
        </p>
        <TabNav
          ariaLabel="Beispiel-Ansichten"
          className="mb-6 max-w-md"
          items={[
            { label: "Trainingsplan", href: "#", current: true },
            { label: "Trainings", href: "#" },
            { label: "Team", href: "#" },
          ]}
        />

        <p className="type-label-small mb-2 mt-6 text-on-surface-variant">
          Überlaufmenü (<code>OverflowMenu</code>) — der Ort für Destruktives
        </p>
        <p className="type-body-medium mb-3 max-w-xl text-on-surface-variant">
          Icon-only Aktionsreihen enden mit einem ⋮. Dort liegt, was nicht offen
          stehen soll — allen voran Löschen und Entfernen: ein Klick daneben darf
          nichts Unwiderrufliches auslösen, darum zweistufig (⋮ → Eintrag →
          Bestätigungsdialog). Deshalb hat <code>IconButton</code> bewusst
          <strong> keine</strong> danger-Variante. Trigger-Zustand und -Ref
          stecken in der Komponente: ein geteilter Ref zeigte stets auf den
          zuletzt gerenderten Trigger, und der Outside-Click-Handler erkennt
          dann den eigenen Trigger nicht mehr — das Menü togglet doppelt und
          öffnet sofort wieder. In Listen gehört der Gegenstand ins
          <code>label</code> („Weitere Aktionen zu …"); der Tooltip bleibt kurz.
        </p>
        <OverflowMenuDemo />

        <div className="mt-6 rounded-[4px] border border-outline-variant bg-surface-container-low p-4">
          <p className="type-label-large mb-1 text-on-surface">
            Ausnahme: Favoriten-Button (Fill)
          </p>
          <p className="type-body-medium mb-4 max-w-xl text-on-surface-variant">
            Ist ein <code>IconButton</code> (gleiche Größe, State-Layer,
            Focus-Ring, primary im aktiven Zustand). Einzige Abweichung von der
            Iconography-Regel „Selected = State-Layer statt Fill": Das
            Favoriten-Herz wird im aktiven Zustand <strong>gefüllt</strong> — der
            etablierte, sofort lesbare Favoriten-Code. Optimistisch (sofortiges
            Umschalten, Rücksetzen + Snackbar bei Fehler).
          </p>
          <div className="flex items-center gap-4">
            <FavoriteButton exerciseId="00000000-0000-0000-0000-000000000000" initial={false} />
            <FavoriteButton exerciseId="00000000-0000-0000-0000-000000000000" initial />
            <span className="type-label-small text-on-surface-variant">
              inaktiv (Outline) · aktiv (gefüllt, primary)
            </span>
          </div>
        </div>
      </Section>

      <Section n="08" title="Badges &amp; Chips (M3)">
        <p className="type-label-small mb-2 text-on-surface-variant">Badges</p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Badge tone="manual" />
          <Badge tone="oeffentlich" />
          <Badge tone="entwurf">✎ Entwurf</Badge>
        </div>

        <ChipsDemo />
      </Section>

      <Section n="09" title="Offene Einfachauswahl">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Genau <strong>ein</strong> Wert aus einer Menge, die offen liegt —
          kein aufklappendes Menü. Zwei Bausteine für dieselbe Aufgabe, die
          Wahl entscheidet die <strong>Länge der Werte</strong>:{" "}
          <code>SegmentedControl</code> für kurze Beschriftungen (Trainingsteil,
          Altersstufe), <code>ChoiceChipGroup</code> für lange, die umbrechen
          müssen. Beides trägt Pfeiltasten-Navigation und einen wandernden
          Tabstopp.
        </p>
        <p className="type-label-small mb-2 text-on-surface-variant">
          <code>SegmentedControl</code> — kurze Werte, eine Zeile
        </p>
        <p className="type-body-medium mb-3 max-w-xl text-on-surface-variant">
          Tab-artig (<code>role=tablist</code>), aktives Segment ={" "}
          <code>primary</code>. Auf Mobile horizontal scrollbar. Ab etwa vier
          Wörtern pro Segment kippt das: die Leiste scrollt, und der Nutzer
          sieht seine Optionen nicht mehr nebeneinander — dann Chips.
        </p>
        <SegmentedDemo />

        <p className="type-label-small mb-2 mt-8 text-on-surface-variant">
          <code>ChoiceChipGroup</code> — lange Werte, umbrechend
        </p>
        <p className="type-body-medium mb-3 max-w-xl text-on-surface-variant">
          Radiogroup-Semantik (<code>role=radiogroup</code> /{" "}
          <code>role=radio</code>, <code>aria-checked</code>) statt der
          tab-artigen Leiste — es ist ein Eingabefeld, keine Ansicht. Optik aus
          den <code>--chip-*</code>-Tokens, ausgewählt wie der Filter-Chip, aber
          <strong> ohne Häkchen</strong>: Einfachauswahl ist kein Ein/Aus-Zustand,
          und der Umriss-Wechsel trägt die Aussage bereits. Anlass war der
          Junioren-Block «Spielformen und unterstützende Übungen» — als Segment
          unlesbar, als Chip nicht.
        </p>
        <ChoiceChipDemo />

        <div className="mt-6 rounded-[4px] border border-outline-variant bg-surface-container-low p-4">
          <p className="type-label-large mb-1 text-on-surface">
            Warum die Einordnung einer Übung wieder offen liegt
          </p>
          <p className="type-body-medium max-w-xl text-on-surface-variant">
            Sie war eine Zeit lang ein <code>Select</code>, weil sieben Werte aus
            zwei Lehrmitteln in einer Liste standen und keine Segmentleiste sie
            trug. Mit der Trennung der Altersstufen ist dieser Grund entfallen:
            Es sind nie mehr als vier Kinderfussball-Trainingsteile oder drei
            Junioren-Trainingsteile mit ihren Blöcken. Und weil die Einordnung
            über die halbe Maske darunter entscheidet, gehört sie sichtbar statt
            eingeklappt (PO-Vorgabe 2026-08-30). Im Juniorenschema stehen beide
            Bausteine übereinander: Segmentleiste für den Trainingsteil, Chips
            für seine Blöcke — so bleibt sichtbar, wozu ein Block gehört.
          </p>
        </div>

        <div className="mt-4 rounded-[4px] border border-outline-variant bg-surface-container-low p-4">
          <p className="type-label-large mb-1 text-on-surface">
            <code>AltersstufeField</code> — eine Wahl, zwei Domänen
          </p>
          <p className="type-body-medium max-w-xl text-on-surface-variant">
            Übung und Training wählen dieselbe Altersstufe und teilen sich darum
            denselben Baustein im Kit. Er hat drei Zustände: <strong>offene
            Wahl</strong> (Segmentleiste), <strong>fest</strong> (neutraler{" "}
            <code>Badge</code> plus Erklärsatz) und <strong>ungewählt</strong>{" "}
            (<code>wert = null</code>). Der letzte ist der Ausgangszustand am
            Training: Die Wahl bindet dort lebenslang und darf nicht durch eine
            Voreinstellung durchrutschen — an der Übung ist sie vorbelegt, weil
            eine Übung umwandelbar bleibt. Der Badge ist bewusst neutral: Die
            Altersstufe ist keine Alterskategorie und borgt deren gelernte
            Farbcodierung nicht. Der feste Zustand nimmt über{" "}
            <code>aktion</code> ein Bedienelement neben dem Badge auf — dort
            hängt das Überführen einer eigenen Übung in die andere Altersstufe.
            Es gehört nicht in die Segmentleiste: An einer gespeicherten Übung
            ist der Stufenwechsel kein Feld, sondern ein eigener, zu
            bestätigender Vorgang.
          </p>
        </div>
      </Section>

      <Section n="10" title="Übungskarten">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* actionSlot demonstriert die Slot-Verdrahtung: das UI-Kit bleibt
              domänenfrei, der Favoriten-Button kommt aus dem Feature-Layer. */}
          <ExerciseCard
            ex={{
              slug: "schiessbude",
              name: "Schiessbude",
              trainingsteilLabel: "Ausklang",
              kategorien: ["G", "F", "E"],
              herkunft: "manual",
            }}
            actionSlot={
              <FavoriteButton
                exerciseId="00000000-0000-0000-0000-000000000000"
                initial={false}
                size="sm"
                variant="overlay"
              />
            }
          />
          <ExerciseCard
            ex={{
              slug: "mein-4-gegen-4",
              name: "Mein 4-gegen-4",
              trainingsteilLabel: "Hauptteil",
              hauptteilkategorieLabel: "Fussball spielen lernen",
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
              kategorien: ["G"],
              herkunft: "user",
              visibility: "public",
            }}
          />
        </div>
      </Section>

      <Section n="11" title="Methodischer Fahrplan (Signatur-Komponente)">
        <Card className="max-w-xl p-6">
          <MethodischerFahrplan
            fahrplan={{
              offen_starten: fahrplan[0][2],
              ueben: [fahrplan[1][2]],
              wetteifern: fahrplan[2][2],
            }}
          />
        </Card>
      </Section>

      <Section n="12" title="Navigation">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          <strong>Header-Navigation</strong> — horizontale Top-Bar als Alternative
          zur Rail. Klebt oben (sticky, Kreide-Linie + Blur). Primär-Links als
          mono-Labels mit Signal-Unterstrich (aktiv) und aufklappbarem{" "}
          <strong>Flyout</strong> (Icon + Titel + Beschreibung). Rechts:
          Such-Trigger mit <code>⌘K</code> (global), Notifications-Glocke mit
          Zähler, Avatar-<strong>Konto-Menü</strong> (über <code>Menu</code>) und
          CTA. Unter <code>lg</code> kollabiert alles in einen Hamburger →{" "}
          <strong>Drawer</strong> (Scrim, Escape, Akkordeon für Flyout-Gruppen).
          Datengetrieben über <code>nav</code>/<code>account</code>/<code>cta</code>.
        </p>
        <HeaderNavDemo />
      </Section>

      <Section n="13" title="Text-Fields, Text-Area &amp; Datum/Zeit">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Outlined mit schwebendem Label (KiFu: mono/uppercase), optionalem
          führenden Icon (<code>leadingIcon</code> — Label rückt ein, sodass es
          das Icon nie überlagert), Supporting-Text und Error-State. Die
          Text-Area ist mehrzeilig (Enter = Umbruch), wächst bis ~10 Zeilen und
          scrollt danach. Gespeist aus <code>--field-*</code>-Component-Tokens.
        </p>
        <div className="grid max-w-md gap-6">
          <TextField label="Übungsname" supportingText="Pflichtfeld" />
          <TextField label="Suche" type="search" leadingIcon={Search} />
          <TextField
            label="Anzahl Kinder"
            type="number"
            defaultValue="1"
            error
            supportingText="Bitte eine Zahl ≥ 2 eingeben."
          />
          <PasswordField
            label="Passwort"
            autoComplete="off"
            supportingText="Mit Auge-Icon ein-/ausblendbar."
          />
          <TextArea
            label="Aufbau / Beschreibung"
            supportingText="Mehrzeilig — wächst bis 10 Zeilen, dann scrollen."
          />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Datum &amp; Uhrzeit
        </h3>
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Für Trainings-Termine. Bewusst <strong>ohne</strong> schwebendes
          Label: native <code>date</code>/<code>time</code>-Felder zeigen immer
          eine Platzhalter-Maske, das Label schwebte also sofort und dauerhaft.
          Stattdessen ein fest darüberstehendes Label im selben
          mono/uppercase-Stil. Das native Steuerelement ist Absicht —
          Datumsauswahl, Tastatureingabe und Lokalisierung kommen vom
          Betriebssystem.
        </p>
        <div className="grid max-w-md gap-6 sm:grid-cols-2">
          <DateField label="Datum" />
          <TimeField label="Beginn (optional)" />
        </div>
      </Section>

      <Section n="14" title="Menu">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Verankertes Dropdown (Outside-Click/Escape schliesst). Items mit
          führendem Icon, optionalem Trailing-Text und destruktiver Variante.
          Gespeist aus <code>--menu-*</code>-Component-Tokens.
        </p>
        <MenuDemo />
      </Section>

      <Section n="15" title="Single-Select">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Auswahl <strong>eines</strong> Werts — kein natives{" "}
          <code>&lt;select&gt;</code>. Der Trigger trägt den Feld-Token-Kontrakt
          (wie Text-Field), das aufgeklappte Panel den <code>--menu-*</code>
          -Kontrakt (gerundet, dunkle Surface, Hover, ✓ auf der Auswahl). Listbox-
          Semantik mit voller Tastatursteuerung (↑/↓, Home/End, Enter, Esc).
        </p>
        <div className="grid max-w-md gap-6">
          <Select
            label="Feldtyp"
            defaultValue="kleinfeld"
            options={[
              { value: "", label: "— kein Feldtyp —" },
              { value: "kleinfeld", label: "Kleinfeld" },
              { value: "grossfeld", label: "Grossfeld" },
              { value: "freies_feld", label: "Freies Feld" },
            ]}
            supportingText="Öffnet ein Menu-Panel statt des OS-Dropdowns."
          />
          {/* hideLabel: Label sr-only, der Empty-State (erste Option) beschriftet
              das Feld — für dichte Filterzeilen mit Feldern Seite an Seite. */}
          <Select
            label="Sichtbarkeit"
            hideLabel
            options={[
              { value: "all", label: "Alle" },
              { value: "public", label: "Community" },
              { value: "private", label: "Privat" },
            ]}
            supportingText="hideLabel: Label sr-only, Empty-State dient als Beschriftung."
          />
        </div>
      </Section>

      <Section n="16" title="Multi-Select">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Auswahl <strong>mehrerer</strong> Werte: einzeiliger Feld-Trigger mit
          inline entfernbaren Tags (<code>--chip-selected-*</code>) öffnet ein
          Panel mit Suchfeld im Kopf, Optionsliste (eckige KiFu-Checkbox 3px) und
          Aktions-Footer (<code>Zurücksetzen</code> /{" "}
          <code>Alle auswählen</code>, respektiert den aktiven Filter). Passen
          nicht alle Tags in die Zelle, bündelt ein <code>+N</code>-Badge die
          überzähligen — die sichtbare Anzahl wird per Messung an die Feldbreite
          angepasst (mit der Breite mit-/abnehmend). Trigger trägt den
          Feld-Token-Kontrakt (wie Text-Field), das Panel den{" "}
          <code>--menu-*</code>-Kontrakt. Combobox-/Listbox-Semantik
          (<code>aria-multiselectable</code>) mit voller Tastatursteuerung (↑/↓,
          Home/End, Enter toggelt, Esc schliesst). <code>searchable</code> /{" "}
          <code>actions</code> einzeln abschaltbar für kurze feste Listen.{" "}
          <code>group</code> stellt einer Option eine nicht wählbare Kopfzeile
          voran, sobald die Gruppe wechselt — für Dimensionen, deren Werte aus
          zwei Welten stammen (in der Applikation: die Altersstufe, siehe{" "}
          <code>lib/filter-optionen.ts</code>). Weil die Kopfzeile positional
          entsteht, müssen die Optionen gruppensortiert übergeben werden, sonst
          erscheint dieselbe Kopfzeile mehrfach. Eine einzige Gruppe ist
          ausdrücklich erlaubt und der Normalfall dort, wo eine Dimension ganz
          zu einer Welt gehört; die Beschriftung sagt dann, zu welcher.
        </p>
        <MultiSelectDemo />
      </Section>

      <Section n="17" title="Dialog &amp; Snackbar">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Dialog auf nativem <code>&lt;dialog&gt;</code> (Fokus-Trap, Escape,
          Scrim). Snackbar in M3-Inverse-Farben mit Aktion + Auto-Dismiss.
          Gespeist aus <code>--dialog-*</code> / <code>--snackbar-*</code>-Tokens.
          Die Snackbar kennt zwei Platzierungen: <code>inline</code> folgt dem
          Dokumentfluss und passt, solange der auslösende Knopf daneben liegt;{" "}
          <code>fixed</code> heftet sie an den unteren Rand des Sichtfelds. Auf
          langen Seiten ist <code>fixed</code> Pflicht — hängt die Meldung im
          Fluss am Seitenende, steht sie unter dem gesamten Inhalt und erreicht
          niemanden, der oben geklickt hat.
        </p>
        <OverlaysDemo />
      </Section>

      <Section n="18" title="Breadcrumbs">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Sekundäre Pfad-Navigation. Datengetrieben (<code>items</code>); das
          letzte Item ohne <code>href</code> ist die aktuelle Seite
          (<code>aria-current</code>) und trägt das Gewicht (
          <code>title-small</code>). Separator standardmässig{" "}
          <code>ChevronRight</code>, per <code>separator</code> ersetzbar. Lange
          Pfade kollabieren ab <code>maxItems</code> zu einem aufklappbaren
          „…"-Button. Gespeist aus <code>--breadcrumb-*</code>-Component-Tokens.
        </p>
        <BreadcrumbsDemo />
      </Section>
      <Section n="19" title="Feld-Diagramm">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Spielfeld-Diagramme (Epic #47) werden als SVG aus der gespeicherten
          Struktur und dem zentralen Symbol-Register gerendert —{" "}
          <code>DiagrammView</code> ist die eine Anzeige-Komponente für Karte,
          Detailseite, Trainings, Druck und mobil; <code>UebungsBild</code>{" "}
          schaltet zwischen Diagramm, Foto und Platzhalter. Der interaktive
          Editor (<code>DiagrammEditor</code>) lebt auf{" "}
          <code>/uebung/[slug]/diagramm</code> und braucht eine eigene Übung.
          Symbol-Geometrie ist im Register verankert (Anker = Mittelpunkt),
          damit zentrale Symbol-Updates bestehende Diagramme nie verschieben.
        </p>
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Spieler und Torwart sind Cartoon-Kinder, der <strong>Trainer</strong>{" "}
          eine erwachsene Figur (Kappe, lange Ärmel, lange Hose, rund 38 %
          grösser — so zeichnet ihn das Manual): das Trikot trägt die Team-Farbe
          (ein konfigurierbarer Fill), Frisur und Hautton werden pro Element
          deterministisch variiert. Der Spieler hat eine wählbare{" "}
          <strong>Pose</strong>, beide Figuren statt Rotation eine{" "}
          <strong>Blickrichtung</strong> (links/rechts, Spiegeln). Die beiden{" "}
          <code>-hinten</code>-Posen zeigen dieselbe Haltung von hinten — damit
          lässt sich ein Kind darstellen, das vom Betrachter weg (im Diagramm
          „nach oben") schaut, etwa eine wartende Kolonne. Nur die Frontal-Posen
          haben diese Variante; die übrigen zeigen die Figur ohnehin im Profil.
          Torwart und Trainer haben je eine feste Standfigur ohne Pose. Alle Posen
          als <code>GlyphVorschau</code>:
        </p>
        <div className="mb-6 flex flex-wrap items-end gap-2">
          {(
            [
              ...SPIELER_POSEN.map((pose) => ({
                id: `po-${pose}`,
                art: "symbol",
                typ: "spieler",
                x: 0,
                y: 0,
                pose,
                farbe: "rot",
              })),
              { id: "po-torwart", art: "symbol", typ: "torwart", x: 0, y: 0 },
              { id: "po-trainer", art: "symbol", typ: "trainer", x: 0, y: 0, farbe: "orange" },
            ] as DiagrammElement[]
          ).map((el) => (
            <div
              key={el.id}
              className="flex flex-col items-center gap-1 rounded-[6px] border border-outline-variant p-1"
            >
              <GlyphVorschau element={el} groesse={56} />
              <span className="type-label-small text-on-surface-variant">
                {el.art === "symbol" && el.typ !== "spieler"
                  ? el.typ
                  : el.art === "symbol"
                    ? el.pose
                    : ""}
              </span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Das <strong>Minitor</strong> ist <em>perspektivisch</em>: statt sich
          flach zu drehen, zeigt es je Orientierung eine eigene 2.5D-Ansicht im
          Manual-Look (Front, Dreiviertel, Seite, Rück). Der äussere{" "}
          <code>rotate()</code> entfällt — das Symbol bekommt den Winkel über{" "}
          <code>opts.rotation</code> und wählt das passende Sprite (Spiegelung
          für 225°/270°/315°). Die acht Schritte als <code>GlyphVorschau</code>:
        </p>
        <div className="mb-6 flex flex-wrap items-end gap-2">
          {ROTATIONEN.map((rot) => (
            <div
              key={rot}
              className="flex flex-col items-center gap-1 rounded-[6px] border border-outline-variant p-1"
            >
              <GlyphVorschau
                element={{ id: `mt-${rot}`, art: "symbol", typ: "minitor", x: 0, y: 0, rotation: rot }}
                groesse={56}
                rand={0.3}
              />
              <span className="type-label-small text-on-surface-variant">{rot}°</span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Element-Optionen (Drehen, Farbe, Linienstil, Kopieren, Entfernen)
          erscheinen im Editor als kontextuelle Bedienleiste, die am
          ausgewählten Element schwebt — ein bewusst neues Muster (#65): Das
          Kit kennt nur an DOM-Trigger verankerte Overlays (<code>Menu</code>,{" "}
          <code>Select</code>), aber kein Panel an einer Position innerhalb
          einer Canvas. Die Leiste liegt als absolutes Overlay über der Fläche
          (Surface-Container, <code>shadow-e4</code>), nicht im Dokumentfluss —
          so verschiebt das Ein- und Ausblenden die Fläche nie. Sie weicht
          oberhalb/unterhalb des Elements aus, tritt während eines Drags zurück
          und verschwindet beim Abwählen. Textboxen werden per Doppelklick
          direkt am Element bearbeitet.
        </p>
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Mehrere Elemente werden per <strong>Auswahlrahmen</strong> (Aufziehen
          auf der freien Fläche, erfasst vollständig umschlossene Elemente) oder
          additivem <strong>Umschalt-/Cmd-Klick</strong> ausgewählt (#67). Bei
          mehr als einem Element tritt an die Stelle der Eigenschaften-Leiste
          eine schlanke <strong>Mehrfach-Leiste</strong> (Anzahl, Kopieren,
          Löschen), verankert an der gemeinsamen Box; verschoben wird die Gruppe
          per Drag. Auswahlrahmen, additiver Klick und Lasso sind ebenfalls neue
          Canvas-Muster ausserhalb des DOM-Trigger-Modells des Kits.
        </p>
        <div className="relative aspect-[16/10] max-w-xl overflow-hidden rounded-[6px] border border-outline-variant">
          <DiagrammView
            title="Feld-Diagramm: Beispiel"
            diagramm={{
              version: 1,
              elemente: [
                { id: "z1", art: "form", form: "rechteck", x: 950, y: 250, breite: 420, hoehe: 480, farbe: "blau", gefuellt: true },
                { id: "t1", art: "symbol", typ: "tor", x: 1380, y: 500, rotation: 270 },
                { id: "m1", art: "symbol", typ: "minitor", x: 240, y: 200, rotation: 90 },
                { id: "p1", art: "symbol", typ: "pylone", x: 480, y: 700, farbe: "rot" },
                { id: "p2", art: "symbol", typ: "pylone", x: 620, y: 760, farbe: "gelb" },
                { id: "s1", art: "symbol", typ: "spieler", x: 380, y: 420, pose: "dribbeln", farbe: "rot" },
                { id: "s2", art: "symbol", typ: "spieler", x: 1050, y: 480, pose: "schiessen", spiegeln: true, farbe: "blau" },
                { id: "tw", art: "symbol", typ: "torwart", x: 1280, y: 500 },
                { id: "b1", art: "symbol", typ: "fussball", x: 470, y: 460 },
                { id: "lw", art: "pfad", typ: "laufweg", punkte: [{ x: 380, y: 480 }, { x: 700, y: 620 }, { x: 950, y: 540 }] },
                { id: "pa", art: "pfad", typ: "pass", punkte: [{ x: 500, y: 450 }, { x: 1000, y: 470 }] },
                { id: "tx", art: "text", x: 1160, y: 130, text: "Abschlusszone" },
              ],
            }}
          />
        </div>
        <p className="type-body-medium mb-4 mt-8 max-w-xl text-on-surface-variant">
          Die Werkzeug-Palette des Editors zeigt jedes Element als{" "}
          <code>GlyphVorschau</code> — dieselbe <code>ElementGrafik</code> wie
          auf dem Feld, in eine Kachel auf Rasen-Grün eingepasst (WYSIWYG; weisse
          Glyphen brauchen den grünen Grund). Die Kacheln sind gruppenweise
          aneinandergereiht, der Name kommt nur über Tooltip + <code>aria-label</code>{" "}
          (kein sichtbarer Text). Wiederverwendbar auch für die Diagramm-Bibliothek.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "g-tor", art: "symbol", typ: "tor", x: 0, y: 0 },
              { id: "g-pylone", art: "symbol", typ: "pylone", x: 0, y: 0, farbe: "rot" },
              { id: "g-leibchen", art: "symbol", typ: "leibchen", x: 0, y: 0, farbe: "rot" },
              { id: "g-spieler", art: "symbol", typ: "spieler", x: 0, y: 0, farbe: "blau" },
              { id: "g-fussball", art: "symbol", typ: "fussball", x: 0, y: 0 },
              { id: "g-laufweg", art: "pfad", typ: "laufweg", punkte: [{ x: 8, y: 88 }, { x: 64, y: 6 }] },
              { id: "g-dribbling", art: "pfad", typ: "dribbling", punkte: [{ x: 8, y: 88 }, { x: 64, y: 6 }] },
              { id: "g-pass", art: "pfad", typ: "pass", punkte: [{ x: 8, y: 88 }, { x: 64, y: 6 }] },
              { id: "g-form", art: "form", form: "rechteck", x: 4, y: 18, breite: 92, hoehe: 60, gefuellt: true },
              { id: "g-text", art: "text", x: 0, y: 0, text: "T" },
            ] as DiagrammElement[]
          ).map((el) => (
            <div
              key={el.id}
              className="flex size-12 items-center justify-center overflow-hidden rounded-[6px] border border-outline-variant"
            >
              <GlyphVorschau element={el} groesse={40} />
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-4 mt-8 max-w-xl text-on-surface-variant">
          Das <strong>Überziehleibchen</strong> ist ein färbbares, drehbares
          Symbol: ein zusammengelegtes Tuch mit gerader Oberkante und Wellensaum.
          In den Manual-Vorlagen wird es in der Hand gehalten („Trikottausch",
          „Spiel mit dem Feuer") — es lässt sich aber ebenso am Boden oder als
          Stapel platzieren. Die unruhige Silhouette grenzt es bewusst vom{" "}
          <strong>Markierungsteller</strong> ab (Ellipse mit Loch), der in dieser
          Grösse sonst kaum zu unterscheiden wäre:
        </p>
        <div className="relative aspect-[16/10] max-w-xl overflow-hidden rounded-[6px] border border-outline-variant">
          <DiagrammView
            title="Leibchen in allen Farben, daneben der Teller zum Vergleich"
            diagramm={{
              version: 1,
              elemente: [
                { id: "lb-rot", art: "symbol", typ: "leibchen", x: 130, y: 250, farbe: "rot" },
                { id: "lb-blau", art: "symbol", typ: "leibchen", x: 330, y: 250, farbe: "blau" },
                { id: "lb-gelb", art: "symbol", typ: "leibchen", x: 530, y: 250, farbe: "gelb" },
                { id: "lb-gruen", art: "symbol", typ: "leibchen", x: 730, y: 250, farbe: "gruen" },
                { id: "lb-orange", art: "symbol", typ: "leibchen", x: 930, y: 250, farbe: "orange" },
                { id: "lb-weiss", art: "symbol", typ: "leibchen", x: 1130, y: 250, farbe: "weiss" },
                { id: "lb-schwarz", art: "symbol", typ: "leibchen", x: 1330, y: 250, farbe: "schwarz" },
                { id: "lb-r45", art: "symbol", typ: "leibchen", x: 230, y: 620, farbe: "rot", rotation: 45 },
                { id: "lb-r315", art: "symbol", typ: "leibchen", x: 530, y: 620, farbe: "blau", rotation: 315 },
                { id: "lb-r90", art: "symbol", typ: "leibchen", x: 830, y: 620, farbe: "gelb", rotation: 90 },
                { id: "lb-teller", art: "symbol", typ: "teller", x: 1230, y: 620, farbe: "gelb" },
              ],
            }}
          />
        </div>
        <p className="type-body-medium mb-4 mt-8 max-w-xl text-on-surface-variant">
          <code>DiagrammVorschau</code> ist der Einstieg in den Editor auf der
          Bearbeiten-Seite: Die ganze Fläche ist ein Link auf{" "}
          <code>/uebung/[slug]/diagramm</code>. Existiert ein Diagramm, zeigt sie
          dessen Vorschau (immer das Diagramm, nie das Foto); sonst einen
          Empty-State, der zum Zeichnen auffordert. Der sichtbare Button ist reine
          Optik (kein <code>&lt;button&gt;</code> in <code>&lt;a&gt;</code>) — der
          Link trägt Klick und <code>aria-label</code>.
        </p>
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <DiagrammVorschau
            href="/uebung/beispiel/diagramm"
            name="Abschlussspiel"
            diagramm={{
              version: 1,
              elemente: [
                { id: "sv-tor", art: "symbol", typ: "tor", x: 1380, y: 500, rotation: 270 },
                { id: "sv-py1", art: "symbol", typ: "pylone", x: 480, y: 360, farbe: "rot" },
                { id: "sv-py2", art: "symbol", typ: "pylone", x: 480, y: 640, farbe: "gelb" },
                { id: "sv-sp", art: "symbol", typ: "spieler", x: 520, y: 500, pose: "dribbeln", farbe: "blau" },
                { id: "sv-ba", art: "symbol", typ: "fussball", x: 600, y: 520 },
                { id: "sv-lw", art: "pfad", typ: "laufweg", punkte: [{ x: 560, y: 520 }, { x: 950, y: 500 }, { x: 1260, y: 500 }] },
              ],
            }}
          />
          <DiagrammVorschau
            href="/uebung/beispiel/diagramm"
            name="Leeres Beispiel"
            diagramm={null}
          />
        </div>
      </Section>

      <Section n="20" title="Disclosure">
        <p className="type-body-medium max-w-xl text-on-surface-variant">
          Ein Abschnitt, der zugeklappt beginnt. Gedacht für lange Listen, die
          vollständig erreichbar bleiben sollen, ohne die Seite zu beherrschen —
          im Team-Trainingsplan liegt der Rückblick darin, der über die Jahre auf
          mehrere hundert Einheiten anwächst. Die Anzahl steht am Kopf, damit man
          weiss, was einen erwartet, bevor man öffnet.
        </p>
        <p className="type-body-medium mt-4 max-w-xl text-on-surface-variant">
          Der Knopf sitzt in der Überschrift, wie es das Disclosure-Muster
          vorsieht: So springt man mit der Überschriften-Navigation eines
          Screenreaders auf den Abschnitt und erfährt dort, dass er sich öffnen
          lässt. Der Inhalt wird nur gerendert, solange er offen ist; die Hülle
          bleibt stehen, damit <code>aria-controls</code> immer greift. Wie beim
          Akkordeon im mobilen Drawer bewegt sich nur der Pfeil, nicht die
          Fläche — das Kit animiert nirgends Höhen.
        </p>
        <div className="mt-6 grid max-w-xl gap-6">
          <Disclosure title="Vergangen" count={3}>
            <div className="flex flex-col gap-2">
              {["Mo, 04.05.2026", "Mi, 29.04.2026", "Mo, 27.04.2026"].map((d) => (
                <Card key={d} className="type-body-medium p-3 text-on-surface-variant">
                  {d}
                </Card>
              ))}
            </div>
          </Disclosure>
          <Disclosure title="Von Beginn an offen" count={1} defaultOpen>
            <Card className="type-body-medium p-3 text-on-surface-variant">
              Mit <code>defaultOpen</code>, wenn der Abschnitt das Einzige ist,
              was die Seite noch zu zeigen hat.
            </Card>
          </Disclosure>
        </div>
      </Section>

      <Section n="21" title="Leerzustand &amp; Hinweiszeile">
        <p className="type-body-medium max-w-xl text-on-surface-variant">
          Ein leerer Abschnitt sagt zuerst nur, dass er leer ist —{" "}
          <code>type-body-small</code>, <code>text-on-surface-variant</code>, kein
          Icon. Hat die Anwendung fachlich etwas dazu zu sagen (im Trainings-Editor:
          dieser Block gehört ins Training), tritt die Hinweiszeile an die Stelle
          dieser neutralen Zeile — <strong>nie beides</strong>. Dieselbe Sachlage
          erscheint nur einmal und nur in einem Schriftschnitt.
        </p>
        <p className="type-body-medium mt-4 max-w-xl text-on-surface-variant">
          Die Hinweiszeile trägt darum denselben Schnitt wie der Leerzustand und
          ordnet sich der Struktur unter: schwächer als Titel und Inhaltszeilen.
          Das Signal ist das <code>Info</code>-Icon (15 px,{" "}
          <code>text-signal</code>, <code>aria-hidden</code>) — es bleibt ohne
          Farbwahrnehmung erkennbar. Der Text nennt den Grund, die Position den
          betroffenen Abschnitt; er blockiert nichts. Zählende Meldungen einer
          ganzen Karte (
          <em>„Ungewöhnlich viele Übungen …"</em>) bleiben davon unberührt und
          stehen weiter als <code>type-label-medium</code> am Kartenfuss.
        </p>
        <div className="mt-6 grid max-w-xl gap-4">
          <Card className="p-4">
            <h3 className="type-title-small text-on-surface">Vielseitigkeit erleben</h3>
            <p className="mt-2 type-body-small text-on-surface-variant">
              Noch keine Übung zugeordnet.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="type-title-small text-on-surface">Fussball spielen</h3>
            <p className="mt-2 flex items-start gap-2 type-body-small text-on-surface-variant">
              <Info size={15} className="mt-0.5 shrink-0 text-signal" aria-hidden />
              Das freie Spiel ist noch leer — im Kinderfussball gehört es in jedes
              Training.
            </p>
          </Card>
        </div>
      </Section>

    </main>
  );
}
