import type { Metadata } from "next";
import {
  Button,
  ButtonLink,
  ButtonGroup,
  segmentClasses,
  Badge,
  Card,
  ExerciseCard,
  IconButton,
  IconButtonLink,
  KategorieChip,
  TabNav,
  Tooltip,
  TextField,
  HeadlineField,
  SearchField,
  PasswordField,
  TextArea,
  DateField,
  TimeField,
  Select,
  MethodischerFahrplan,
  Freitext,
  MaterialListe,
  Eigenschaften,
  Eigenschaft,
  EigenschaftFehlt,
  Disclosure,
  Leerzustand,
  Banner,
} from "@/components/ui";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { uebungEckdaten } from "@/lib/eckdaten";
import { ChipsDemo } from "./ChipsDemo";
import { ChoiceChipDemo } from "./ChoiceChipDemo";
import { AuswahlListeDemo } from "./AuswahlListeDemo";
import { MenuDemo } from "./MenuDemo";
import { MultiSelectDemo } from "./MultiSelectDemo";
import { FilterKnopfDemo } from "./FilterKnopfDemo";
import { WochentagWahlDemo } from "./WochentagWahlDemo";
import { CheckboxDemo } from "./CheckboxDemo";
import { SeitenleisteDemo } from "./SeitenleisteDemo";
import { OverlaysDemo } from "./OverlaysDemo";
import { BreadcrumbsDemo } from "./BreadcrumbsDemo";
import { OverflowMenuDemo } from "./OverflowMenuDemo";
import { ChipMenuDemo } from "./ChipMenuDemo";
import { MaterialDemo } from "./MaterialDemo";
import { MonatsrasterDemo } from "./MonatsrasterDemo";
import { AnsichtWahl } from "@/components/team/AnsichtWahl";
import { VariantenWahlDemo } from "./VariantenWahlDemo";
import { VariantenLinks } from "@/components/training/VariantenLinks";
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
  SearchX,
  MailCheck,
  ListPlus,
  RefreshCw,
  CalendarOff,
  CalendarX2,
  CalendarPlus,
  List,
  CalendarDays,
} from "lucide-react";
import { DiagrammView, GlyphVorschau } from "@/components/diagramm/DiagrammView";
import { ROTATIONEN, SPIELER_POSEN, type DiagrammElement } from "@/lib/diagramm";
import { cn } from "@/lib/cn";
import { kategorieStufe } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";
import {
  GRUND,
  ELEV,
  KAT,
  PRIMARY,
  ON_PRIMARY,
  SECONDARY,
  ERROR,
  ON_ERROR,
  SCHRIFT,
  LINIE,
  KANTE,
  UMKEHR,
  ZUSTAND,
  DRUCK,
  elev,
  elevName,
  hex8,
  kontrast,
  rgbAbstand,
  ueberlagern,
  type KatSchluessel,
} from "@/lib/farben";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

export const metadata: Metadata = {
  title: "Styleguide — KiFu Designsystem",
  robots: { index: false },
};

/* Kontrastwerte stehen auf dieser Seite NIE als getippte Zahl: Sie werden zur
   Renderzeit aus `lib/farben.ts` gerechnet. Eine Zahl, die man von Hand
   nachträgt, ist beim nächsten Farbwechsel falsch, ohne dass es auffällt. */
const v = (wert: number) => `${wert.toFixed(2)}:1`;

/** Weiss mit Deckung über eine Fläche gelegt — so entsteht der Wert, gegen den
 *  sich Schrift und Striche überhaupt rechnen lassen. */
const weissAuf = (deckung: number, grund: string) =>
  ueberlagern("#ffffff", deckung, grund);

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
    <section className="border-t border-linie py-10">
      <h2 className="type-headline-small flex items-baseline gap-3 text-on-surface">
        <span className="type-label-medium text-primary">{n}</span>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* Ein Farbfeld zeigt die LEBENDE Klasse (bg-*) und daneben die gerechnete
   Zahl aus `lib/farben.ts`. Laufen CSS und TS-Zwilling auseinander, sieht man
   es hier sofort: Die Fläche stimmt dann nicht mehr zum Hex daneben. */
function Farbfeld({
  name,
  flaeche,
  wert,
  notiz,
  schrift,
}: {
  name: string;
  flaeche: string;
  wert: string;
  notiz: string;
  /* Pflichtangabe: Die Beschriftung liegt auf der Probe selbst, und die Proben
     reichen von Schwarz bis Weiss — eine Voreinstellung wäre auf der Hälfte
     von ihnen unlesbar. */
  schrift: string;
}) {
  return (
    <div className="rounded-flaeche kontur border-kante p-3">
      <div
        className={cn(
          "mb-2 flex h-14 w-full items-end rounded-plakette p-2",
          flaeche,
          schrift,
        )}
      >
        <span className="type-plakette">{wert}</span>
      </div>
      <p className="type-label-small text-on-surface">{name}</p>
      <p className="type-body-small text-on-surface-mittel">{notiz}</p>
    </div>
  );
}

/* Eine Zustands-Ebene, stehend abgebildet: dieselbe Rechnung wie `@utility
   state`, nur mit fest gesetzter Deckung — und wie dort ÜBER dem Text. */
function Zustandsfeld({
  label,
  deckung,
  notiz,
  farbe,
  primary = false,
}: {
  label: string;
  deckung: number;
  notiz: string;
  farbe: string;
  primary?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-flaeche kontur px-4 py-3",
        primary ? "border-primary/50 text-primary" : "border-kante text-on-surface",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="type-title-small">{label}</span>
        <span className="type-label-small opacity-75">{notiz}</span>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: hex8(farbe, deckung) }}
      />
    </div>
  );
}

// ── Daten der Doku-Tafeln ──────────────────────────────────────────────────

const akzentRollen: [string, string, string, string, string][] = [
  [
    "primary",
    "bg-primary",
    PRIMARY.toUpperCase(),
    `Der eine Akzent. ${v(kontrast(PRIMARY, GRUND))} auf dem Grund — hell genug, um selbst Text zu sein.`,
    "text-on-primary",
  ],
  [
    "on-primary",
    "bg-on-primary",
    ON_PRIMARY.toUpperCase(),
    `Schrift auf gefüllter Akzentfläche: Schwarz, ${v(kontrast(ON_PRIMARY, PRIMARY))}.`,
    "text-on-surface",
  ],
  [
    "secondary",
    "bg-secondary",
    SECONDARY.toUpperCase(),
    "Geführt, nirgends angewandt — die Rolle bleibt besetzt, damit die Palette vollständig ist.",
    "text-on-secondary",
  ],
  [
    "error",
    "bg-error",
    ERROR.toUpperCase(),
    `Fehleingabe und Befund, fast immer als Schrift. ${v(kontrast(ERROR, GRUND))} auf dem Grund, ${v(kontrast(ERROR, elev(24)))} noch im Dialog.`,
    "text-on-error",
  ],
  [
    "on-error",
    "bg-on-error",
    ON_ERROR.toUpperCase(),
    `Schrift auf gefüllter Fehlerfläche, ${v(kontrast(ON_ERROR, ERROR))} — vorgesehen, im Bild selten.`,
    "text-on-surface",
  ],
];

const schriftRollen: [string, string, string, string, string][] = [
  [
    "on-surface",
    "bg-on-surface",
    "100 %",
    `${v(kontrast("#ffffff", GRUND))} auf dem Grund — Titel, Werte, alles Wesentliche.`,
    "text-elev-00",
  ],
  [
    "on-surface-mittel",
    "bg-on-surface-mittel",
    "74 %",
    `${v(kontrast(weissAuf(SCHRIFT.mittel, GRUND), GRUND))} auf dem Grund — Beschriftungen und Beiwerk.`,
    "text-elev-00",
  ],
  [
    "on-surface-tief",
    "bg-on-surface-tief",
    "38 %",
    `${v(kontrast(weissAuf(SCHRIFT.tief, GRUND), GRUND))} — NUR Deaktiviertes, wo der Kontrast bewusst preisgegeben ist.`,
    "text-on-surface",
  ],
];

const strichRollen: [string, string, string, string, string][] = [
  [
    "linie",
    "bg-linie",
    "12 % · 1 px",
    `Trenner und Haarlinie. ${v(kontrast(weissAuf(LINIE, GRUND), GRUND))} — sie teilt, sie umreisst nicht.`,
    "text-on-surface",
  ],
  [
    "kante",
    "bg-kante",
    "28 % · 1.5 px",
    `Kontur von Feld, Chip und Knopf. ${v(kontrast(weissAuf(KANTE, GRUND), GRUND))} — 1 px verschwände im Dunkeln.`,
    "text-on-surface",
  ],
];

const kategorien: KategorieSlug[] = ["G", "F", "E", "D", "C", "B", "A"];

const typeScale: [string, string, string][] = [
  ["type-display-large", "Display Large", "Geist 600 · 57/60 · −.02 em"],
  ["type-display-medium", "Display Medium", "Geist 600 · 45/50 · −.02 em"],
  ["type-display-small", "Display Small", "Geist 600 · 36/42 · −.02 em"],
  ["type-headline-large", "Headline Large", "Geist 600 · 32/38 · −.015 em"],
  ["type-headline-medium", "Headline Medium", "Geist 600 · 28/34 · −.015 em"],
  ["type-headline-small", "Headline Small", "Geist 600 · 24/30 · −.01 em"],
  ["type-title-large", "Title Large", "Geist 600 · 22/28 · −.01 em"],
  ["type-title-medium", "Title Medium", "Geist 600 · 16/24 · −.005 em"],
  ["type-title-small", "Title Small", "Geist 600 · 14/20"],
  ["type-body-large", "Body Large", "Geist 400 · 16/24"],
  ["type-body-medium", "Body Medium", "Geist 400 · 14/21"],
  ["type-body-small", "Body Small", "Geist 400 · 12/18 · +.005 em"],
  ["type-label-large", "Label Large", "Geist 600 · 14/20 · +.08 em · versal"],
  ["type-label-medium", "Label Medium", "Geist 600 · 12/16 · +.09 em · versal"],
  ["type-label-small", "Label Small", "Geist 500 · 11/16 · +.09 em · versal"],
  ["type-plakette", "Plakette", "Geist 700 · 10/14 · +.10 em · versal"],
];

/* Literale Klassennamen, damit Tailwind sie findet — aus einer Schleife
   zusammengesetzte Klassen entstehen im Build nie. */
const elevKlasse: Record<number, string> = {
  0: "bg-elev-00",
  1: "bg-elev-01",
  2: "bg-elev-02",
  3: "bg-elev-03",
  4: "bg-elev-04",
  6: "bg-elev-06",
  8: "bg-elev-08",
  12: "bg-elev-12",
  16: "bg-elev-16",
  24: "bg-elev-24",
};

const elevVerwendung: Record<number, string> = {
  0: "Seitengrund, Feldfläche im Grund",
  1: "Karte, Teil-Karte, Übungszeile, Seitenleiste",
  2: "Block im Teil, dichtes Feld, Platzhalter",
  3: "— frei —",
  4: "Kopfzeile unter lg (deckend, kein Blur)",
  6: "Elevated-Knopf und -Chip, Overlay-Icon-Knopf",
  8: "Menü, Select-Panel, Tonal-Knopf, Entwurf-Plakette, Drawer, aktives Segment, offener Navigationseintrag",
  12: "Avatar, offener Navigationseintrag im Drawer",
  16: "— frei —",
  24: "Dialog, Tooltip",
};

const schattenStufen: [string, string, string][] = [
  ["shadow-dp-04", "dp-04", "Elevated-Knopf — er liegt auf, er deckt nichts zu."],
  ["shadow-dp-06", "dp-06", "Snackbar — sie schwebt über dem Inhalt."],
  ["shadow-dp-08", "dp-08", "Menü, Select-Panel, Drawer, Tooltip."],
  ["shadow-dp-24", "dp-24", "Dialog — das Einzige, was die Seite anhält."],
];

const zustaende: [string, number, string][] = [
  ["Überfahren", ZUSTAND.hover, "hover"],
  ["Fokus", ZUSTAND.focus, "focus-visible · dazu der Ring"],
  ["Gedrückt", ZUSTAND.pressed, "active"],
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

const radien: [string, string, string][] = [
  ["rounded-plakette", "2 px", "Plakette, Kategorie-Chip — die kleinste beschriftete Fläche."],
  ["rounded-flaeche", "4 px", "Karte, Feld, Knopf, Menü, Snackbar, Auswahl-Panel."],
  ["rounded-dialog", "6 px", "Nur der Dialog: die grösste Fläche verträgt mehr Rundung."],
  ["rounded-full", "voll", "Chips und runde Knöpfe — alles, was man antippt und loslässt."],
];

const hoehen: [string, string][] = [
  ["h-[22px] · 22 px", "Plakette und Kategorie-Chip — die kleinste beschriftete Fläche."],
  [
    "h-9 · 36 px",
    "Das eine Mass alles Bedienbaren (Epic #363): Feldkasten, Knopf, Icon-Knopf, Glied der Knopfgruppe, jeder Chip samt geteiltem Chip und Menühälfte, Reiter, Zeile in Menü und Auswahlpanel, Kontrollkästchen, Eintrag der Seitenleiste, Werkzeug im Diagramm-Editor — auf dem Platz wie am Schreibtisch. Weil alles gleich hoch ist, fluchtet jede Leiste von selbst.",
  ],
  ["h-12 · 48 px", "Kopfzeile mit Menüknopf unter lg."],
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

/* Beispieltexte für die drei Stufen des methodischen Fahrplans; die
   Stufennamen führt die Komponente selbst. */
const fahrplan = [
  "Die Kinder dribbeln auf die Abschlusszone zu und schliessen ab.",
  "Mit linkem und rechtem Fuss kontrolliert führen und in die freie Ecke zielen.",
  "Wie viele Treffer gelingen mit links, wie viele mit rechts?",
];

/* Der Druckblock lässt sich am Bildschirm nicht zeigen, indem man ihn
   anwendet — er gilt nur im Druck. Darum stehen seine Werte hier als
   Inline-Farbe aus `lib/farben.ts`, nicht als Klasse. */
const druckProben: [string, string, string][] = [
  ["elev-00", DRUCK["elev-00"], "Papier"],
  ["elev-01", DRUCK["elev-01"], "Karte"],
  ["elev-02", DRUCK["elev-02"], "Block"],
  ["elev-08", DRUCK["elev-08"], "Menü"],
  ["elev-24", DRUCK["elev-24"], "Dialog"],
  ["primary", DRUCK.primary, `${v(kontrast(DRUCK.primary, DRUCK["elev-00"]))} auf Papier`],
  ["error", DRUCK.error, `${v(kontrast(DRUCK.error, DRUCK["elev-00"]))} auf Papier`],
  ["on-surface", DRUCK["on-surface"], `${v(kontrast(DRUCK["on-surface"], DRUCK["elev-00"]))} auf Papier`],
];

export default function Styleguide() {
  return (
    <Seitenrahmen breite="5xl" krumen={[{ label: "Styleguide" }]}>
      <header className="mb-4">
        <p className="type-label-medium text-primary">KiFu · Designsystem</p>
        <h1 className="type-display-large mt-2 text-on-surface">Material 2 Dark</h1>
        <p className="type-body-large mt-4 max-w-2xl text-on-surface-mittel">
          Eine einzige Fläche trägt die ganze Anwendung: {GRUND} — Materials
          Dunkelgrau mit so viel Grün, dass der Platz im Bild bleibt. Höhe
          entsteht nicht durch eine zweite Farbe, sondern durch ein weisses
          Overlay auf eben dieser Fläche. Akzent ist ein Lila, das im Dunkeln
          hell genug ist, um selbst Text zu sein; Schwarz steht darauf, nicht
          Weiss. Farbe umrandet und beschriftet — sie füllt nur dort, wo eine
          Fläche wirklich gemeint ist.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-2 text-on-surface">Übernommen</p>
            <ul className="type-body-medium flex list-disc flex-col gap-1 pl-5 text-on-surface-mittel">
              <li>Das Farbsystem: fünf Rollen mit ihren On-Farben, Schrift als Weiss in Deckungen.</li>
              <li>Die Höhe als gerechnete Overlay-Leiter über einem einzigen Grund.</li>
              <li>Die Zustands-Deckungen (4 / 12 / 10 %) in der Farbe des Inhalts.</li>
              <li>Die Typo-Rollen: Display, Headline, Title, Body, Label.</li>
            </ul>
          </div>
          <div className="rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-2 text-on-surface">Nicht übernommen</p>
            <ul className="type-body-medium flex list-disc flex-col gap-1 pl-5 text-on-surface-mittel">
              <li>
                <strong>Ripple und Bewegung.</strong> Die Zustands-Ebene blendet
                auf und ab, sie läuft nicht vom Klickpunkt aus. Das Kit animiert
                keine Höhen und nur eine Fläche: die Breite der Seitenleiste
                beim Umschalten (siehe 13).
              </li>
              <li>
                <strong>Primary Variant.</strong> Das dunkle Zweit-Lila der
                Baseline stammt aus dem hellen Thema; auf dem Grund käme es auf{" "}
                {v(kontrast("#3700b3", GRUND))}. Eine Rolle mit genau einem
                möglichen Ort lädt zum Missgriff ein — das System kennt ein Lila.
              </li>
              <li>
                <strong>Eine eigene Farbe für den nicht blockierenden Hinweis.</strong>{" "}
                Material kennt nur Error. Der Befund trägt darum dieselbe Farbe
                wie die Fehleingabe und unterscheidet sich im Verhalten (siehe 14).
              </li>
            </ul>
          </div>
        </div>
      </header>

      <Section n="01" title="Farbrollen">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Material vergibt <strong>Rollen</strong>, keine Bedeutungen: Es gibt
          einen Akzent, eine Fehlerfarbe und Schrift in Deckungen — was davon
          wofür steht, entscheidet die Anwendung. Die Flächen unten sind die
          lebenden Klassen, die Zahlen daneben rechnet{" "}
          <code>lib/farben.ts</code> beim Rendern nach. Weichen sie
          voneinander ab, ist das hier zu sehen.
        </p>
        <p className="type-label-small mb-2 text-on-surface-mittel">Akzente</p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {akzentRollen.map(([name, bg, wert, notiz, schrift]) => (
            <Farbfeld
              key={name}
              name={name}
              flaeche={bg}
              wert={wert}
              notiz={notiz}
              schrift={schrift}
            />
          ))}
        </div>

        <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
          <strong>Error liegt eine Stufe über Materials Baseline.</strong> Die
          Baseline (<code>#cf6679</code>) ist als <em>Fläche</em> gedacht: Als
          Schrift trägt sie nur auf dem Grund und fällt im Dialog auf{" "}
          {v(kontrast("#cf6679", elev(24)))} — die Anwendung setzt Error aber
          fast nie als Fläche, sondern als Schrift auf der Karte, in der
          Menüzeile und im Dialog. Der hellere Ton trägt auf{" "}
          <strong>jeder</strong> Höhenstufe über 4.5:1, am engsten auf 24dp
          mit {v(kontrast(ERROR, elev(24)))}, und die gefüllte Fehlerfläche
          behält ihre schwarze Aufschrift ({v(kontrast(ON_ERROR, ERROR))}).
          Nachgerechnet wird das seither auf jeder Stufe und zusätzlich als
          Kontur (<code>scripts/pruefe-farben.ts</code>), nicht mehr nur auf
          dem Grund — dort lag die Lücke, durch die die Baseline kam. Näher
          rückt Error damit an <code>kat-c</code> (Abstand{" "}
          {rgbAbstand(ERROR, KAT.c).toFixed(0)} im RGB-Würfel): Getrennt hält
          die beiden nicht die Farbe, sondern die Form — eine Plakette mit
          einem Buchstaben gegen einen Feldrahmen mit einem Satz darunter.
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Schrift — Weiss in drei Deckungen
        </p>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {schriftRollen.map(([name, bg, anteil, notiz, schrift]) => (
            <Farbfeld key={name} name={name} flaeche={bg} wert={anteil} notiz={notiz} schrift={schrift} />
          ))}
        </div>
        <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
          Unterschieden wird über die Deckung, nicht über eine zweite Farbe: So
          trägt jede Höhenstufe dieselbe Schrift, ohne dass sie pro Fläche neu
          gemischt werden müsste. Halbtransparente Schrift lässt sich nicht
          direkt rechnen — die Zahlen oben stehen für den{" "}
          <em>Kompositwert</em> auf dem Grund ({weissAuf(SCHRIFT.mittel, GRUND)}{" "}
          bei 74 %).
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">Striche</p>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {strichRollen.map(([name, bg, anteil, notiz, schrift]) => (
            <Farbfeld key={name} name={name} flaeche={bg} wert={anteil} notiz={notiz} schrift={schrift} />
          ))}
        </div>
        <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
          Die Kante umreisst, sie behauptet nichts: Wo eine Kontur selbst etwas
          aussagt — Fehler, Befund, Auswahl —, trägt sie{" "}
          <code>border-error</code> oder <code>border-primary</code> statt der
          Kante, und dann steht die Aussage auch im Text daneben.
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Alterskategorien — sieben lernbare Farben, als Plakette gerendert
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {kategorien.map((k) => {
            const hex = KAT[k.toLowerCase() as KatSchluessel];
            return (
              <div key={k} className="rounded-flaeche kontur border-kante p-3">
                <div className="mb-2 flex h-10 items-center justify-center">
                  <KategorieChip k={k} />
                </div>
                <p className="type-label-small text-on-surface">kat-{k.toLowerCase()}</p>
                <p className="type-body-small text-on-surface-mittel">{kategorieStufe[k]}</p>
                <p className="type-body-small text-on-surface-mittel">
                  {hex.toUpperCase()} · {v(kontrast(hex, GRUND))}
                </p>
              </div>
            );
          })}
        </div>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          Sie stehen als <strong>Kontur und Schrift</strong>, nie als Fläche:
          Gefüllt wären sieben Werte nebeneinander ein Flickenteppich und
          konkurrierten mit jedem gefüllten Knopf daneben. Der Buchstabe trägt
          die Unterscheidung ohnehin mit (a11y: nie nur über Farbe). Einzige
          Ausnahme ist der Druck, wo eine helle Kontur auf Papier verschwände —
          siehe 25.
        </p>
        <p className="type-body-medium max-w-2xl text-on-surface-mittel">
          <strong>Warum kat-e neu {KAT.e.toUpperCase()} ist.</strong> Bisher war
          die Stufe ein Lila (#C084FC) — im RGB-Würfel{" "}
          {Math.round(rgbAbstand("#c084fc", PRIMARY))} Einheiten von Primary{" "}
          {PRIMARY.toUpperCase()} entfernt, also praktisch dieselbe Farbe. Eine
          Kategorie-Plakette hätte damit ausgesehen wie ein aktiver Zustand. Das
          neue Orange liegt {Math.round(rgbAbstand(KAT.e, PRIMARY))} Einheiten entfernt,
          trägt {v(kontrast(KAT.e, GRUND))} auf dem Grund und bleibt von den
          Nachbarstufen unterscheidbar (kat-f: {Math.round(rgbAbstand(KAT.e, KAT.f))},
          kat-c: {Math.round(rgbAbstand(KAT.e, KAT.c))}).
        </p>
      </Section>

      <Section n="02" title="Typografie">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Eine Familie für alles.</strong> Geist trägt Display, Titel,
          Fliesstext, Label und Plakette; unterschieden werden die Rollen über
          Gewicht, Versalien und Sperrung, nicht über eine zweite Schrift. Was
          in Kolonnen fluchten muss — Dauern, Zählungen, Positionsnummern —,
          hält <code>font-variant-numeric: tabular-nums</code> auf jeder
          Label-Stufe bündig; dafür braucht es keine Monospace mehr.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Display, Headline und Titel stehen in normaler Schreibung und im
          selben Gewicht (600): Die Rangfolge trägt die Grösse, nicht die
          Wucht (Epic #363). Eine Neo-Grotesk in Gemischtschreibung will eng
          stehen, darum laufen die grossen Stufen mit leicht negativem
          Tracking — je grösser, desto enger. Namen, die Trainer:innen selbst
          erfassen, erscheinen so in jeder Überschrift genau so, wie sie sie
          geschrieben haben.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Label gehen den umgekehrten Weg: Sie allein stehen versal, klein und
          mit 8–10 % weit gesperrt, und trennen sich so von jeder Überschrift.
          Bei 400 verlöre die kleinste Stufe auf dem dunklen Grund ihre
          Stämme — darum steht Label Small auf 500.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Regel: Nutzertext nie in Label-Typografie.</strong> Die{" "}
          <code>type-label-*</code>-Stufen sind gesperrt, halbfett und{" "}
          <em>versal</em> —
          sie verändern, was dasteht. Für Beschriftungen, die wir selbst
          schreiben, ist das gewollt; ein Gruppenname wie „Grosse" käme daraus
          als „GROSSE" zurück und wäre nicht mehr das, was die Trainerin
          eingetippt hat. Alles, was aus der Datenbank kommt, gehört darum in{" "}
          <code>type-body-*</code>.
        </p>
        <div className="space-y-3">
          {typeScale.map(([cls, label, meta]) => (
            <div
              key={cls}
              className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-linie pb-3"
            >
              <p className={cn(cls, "text-on-surface")}>{label}</p>
              <span className="type-body-small text-on-surface-mittel">{meta}</span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mt-5 max-w-2xl text-on-surface-mittel">
          <code>type-plakette</code> ist die jüngste Stufe: die kleinste
          beschriftbare Fläche (Badge, Kategorie-Plakette, Zähler an der
          Glocke). Unter 10 px wird auch die weit gesperrte Versal unleserlich —
          darunter geht nichts mehr. Sie ist die einzige Label-Stufe, die bei
          700 bleibt: bei 600 fiele sie in dieser Grösse gegen ihre eigene
          Kontur ab.
        </p>
      </Section>

      <Section n="03" title="Höhe">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Im Dunkeln trägt nicht der Schatten die Höhe, sondern die Helligkeit:
          Jede Stufe legt ein weisses Overlay über denselben Grund. Die Werte
          stehen als literale Hex im <code>@theme</code> — ausgerechnet statt
          zur Laufzeit gemischt, damit die Prüfung sie lesen kann; die
          Herleitung steht daneben in <code>lib/farben.ts</code>.
        </p>
        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse">
            <thead>
              <tr className="border-b border-linie text-left">
                <th className="type-label-small py-2 pr-4 font-normal text-on-surface-mittel">Stufe</th>
                <th className="type-label-small py-2 pr-4 font-normal text-on-surface-mittel">Overlay</th>
                <th className="type-label-small py-2 pr-4 font-normal text-on-surface-mittel">Hex</th>
                <th className="type-label-small py-2 pr-4 font-normal text-on-surface-mittel">Fläche</th>
                <th className="type-label-small py-2 font-normal text-on-surface-mittel">Verwendung</th>
              </tr>
            </thead>
            <tbody>
              {ELEV.map((s) => {
                const frei = elevVerwendung[s.dp].startsWith("—");
                return (
                  <tr key={s.dp} className="border-b border-linie">
                    <td className="type-label-medium py-2 pr-4 text-on-surface">
                      {elevName(s.dp).replace("elev-", "")}dp
                    </td>
                    <td className="type-body-small py-2 pr-4 text-on-surface-mittel">{s.overlay} %</td>
                    <td className="type-body-small py-2 pr-4 text-on-surface-mittel">
                      {s.hex.toUpperCase()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={cn(
                          "block h-7 w-20 rounded-plakette border border-linie",
                          elevKlasse[s.dp],
                        )}
                      />
                    </td>
                    <td
                      className={cn(
                        "type-body-small py-2",
                        frei ? "text-on-surface-tief" : "text-on-surface-mittel",
                      )}
                    >
                      {elevVerwendung[s.dp]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Zwei Stufen — 03 und 16 dp — sind <strong>frei</strong>. Sie
          stehen in der Leiter, weil Material sie führt und weil eine Lücke
          später schwerer nachzutragen wäre als eine ungenutzte Stufe; angewandt
          wird keine von beiden. Wer eine braucht, trägt hier ein, wofür.
        </p>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          <strong>Die Höhe trägt die Fläche, der Schatten nur, was schwebt.</strong>{" "}
          Karte, Block und Seitenleiste bekommen keinen Schatten — sie liegen im
          Bild, sie stehen nicht darüber. Vier Schatten gibt es, und jeder
          gehört zu genau einer Sorte schwebender Fläche:
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {schattenStufen.map(([cls, label, zweck]) => (
            <div key={cls} className={cn("rounded-flaeche bg-elev-08 p-3", cls)}>
              <p className="type-label-medium text-on-surface">{label}</p>
              <p className="type-body-small mt-1 text-on-surface-mittel">{zweck}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Zustände">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Jede bedienbare Fläche legt beim Überfahren, Fokussieren und Drücken
          eine Ebene auf — <strong>in der Farbe ihres eigenen Inhalts</strong>,
          mit fest vorgegebener Deckung. Die Ebene steckt im Basis-Bündel der
          Bausteine (<code>state</code> in Button, Chip, Icon-Knopf, Menüzeile,
          Navigationszeile), nicht an den Aufrufstellen: Darum kennt das Kit kein
          einziges <code>hover:bg-*</code>. Sie gehört zudem auf das{" "}
          <strong>fokussierbare</strong> Element: Deckt ein Link eine ganze
          Karte, trägt der Link die Ebene und nicht das{" "}
          <code>&lt;div&gt;</code> darum — sonst bliebe sie beim Tabben und beim
          Drücken stumm. <strong>Drei Zustände, nicht Materials vier:</strong>{" "}
          «gezogen» fehlt, weil das Einzige, was hier gezogen wird,
          Diagramm-Elemente sind — und die leben im SVG, nicht im DOM
          (siehe 20).
        </p>
        <div className="mb-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="type-label-small mb-2 text-on-surface-mittel">
              Inhalt weiss — auf neutraler Fläche
            </p>
            <div className="flex flex-col gap-2">
              <Zustandsfeld label="Ruhe" deckung={0} notiz="—" farbe="#ffffff" />
              {zustaende.map(([label, deckung, notiz]) => (
                <Zustandsfeld
                  key={label}
                  label={label}
                  deckung={deckung}
                  notiz={`${Math.round(deckung * 100)} % · ${notiz}`}
                  farbe="#ffffff"
                />
              ))}
            </div>
          </div>
          <div>
            <p className="type-label-small mb-2 text-on-surface-mittel">
              Inhalt in Primary — dieselben Deckungen
            </p>
            <div className="flex flex-col gap-2">
              <Zustandsfeld label="Ruhe" deckung={0} notiz="—" farbe={PRIMARY} primary />
              {zustaende.map(([label, deckung, notiz]) => (
                <Zustandsfeld
                  key={label}
                  label={label}
                  deckung={deckung}
                  notiz={`${Math.round(deckung * 100)} % · ${notiz}`}
                  farbe={PRIMARY}
                  primary
                />
              ))}
            </div>
          </div>
        </div>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Am lebenden Objekt — überfahren, mit Tab fokussieren, gedrückt halten
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outlined">Neutrale Fläche</Button>
          <Button variant="text">Inhalt in Primary</Button>
          <Button variant="filled">Gefüllt — die Ebene wird schwarz</Button>
          <IconButton icon={SlidersHorizontal} label="Filter" active />
          <span className="type-label-small text-on-surface-mittel">
            aktiver Icon-Knopf: <code>state-primary</code>
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-1 text-on-surface">
              Warum die Ebene ÜBER dem Text liegt
            </p>
            <p className="type-body-medium text-on-surface-mittel">
              Das klingt verkehrt und ist der Grund, warum sie nie schadet: Die
              Overlay-Farbe <em>ist</em> die Textfarbe. Sie hellt Fläche und
              Schrift im selben Ton auf und kann den Kontrast des Textes damit
              rechnerisch nicht senken. Und weil nichts untergeschoben werden
              muss, erspart sie jede z-index-Buchhaltung im Inhalt —{" "}
              <code>::after</code> mit <code>pointer-events: none</code> genügt.
            </p>
          </div>
          <div className="rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-1 text-on-surface">
              Warum der Fokus-Ring bleibt (bewusste Abweichung)
            </p>
            <p className="type-body-medium text-on-surface-mittel">
              Material macht den Tastaturfokus allein über die 12-%-Ebene plus
              voll ausgefahrene Kontur sichtbar. Auf einer Fläche, die ohnehin
              eine Kontur trägt, ist der Sprung von 0 auf 12 % kein verlässlicher
              Unterschied — und in Forced-Colors-Modi wird die Ebene gar nicht
              gezeichnet. Der 2-px-Ring in Primary mit Offset bleibt darum
              (<code>focus-ring</code>, als <code>outline</code> statt als
              Schatten: Er folgt dem Radius und kollidiert nicht mit dem
              Schatten schwebender Flächen). Die Ebene kommt dazu, sie ersetzt
              ihn nicht. Die <strong>Kontur rührt er nicht an</strong>: Sie sagt
              an vielen Stellen schon etwas anderes — Fehler, Befund, Auswahl,
              offenes Panel —, und eine Utility, die <code>border-color</code>{" "}
              setzte, schlüge jede dieser Farbklassen am Element.
            </p>
          </div>
        </div>
      </Section>

      <Section n="05" title="Masse, Radien, Konturen">
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Abstände — Vielfache von 4
        </p>
        <div className="mb-8 space-y-2">
          {spacingSteps.map(([step, px]) => (
            <div key={step} className="flex items-center gap-3">
              <span className="type-label-small w-16 text-on-surface-mittel">{px}</span>
              <div className="h-4 bg-primary" style={{ width: px }} />
              <span className="type-label-small text-on-surface-mittel">space-{step}</span>
            </div>
          ))}
        </div>

        <p className="type-label-small mb-2 text-on-surface-mittel">Ecken</p>
        <div className="mb-4 flex flex-wrap gap-6">
          {radien.map(([cls, mass, zweck]) => (
            <div key={cls} className="flex w-52 flex-col gap-2">
              <span className={cn("h-11 w-full kontur border-kante", cls)} />
              <span className="type-label-small text-on-surface">
                {cls} · {mass}
              </span>
              <span className="type-body-small text-on-surface-mittel">{zweck}</span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-8 max-w-2xl text-on-surface-mittel">
          Eckig für alles, was Inhalt hält; voll gerundet für alles, was man
          antippt und wieder loslässt. Mehr Werte gibt es nicht — 3 px, 5 px und
          8 px sind aus dem System gefallen, und ein{" "}
          <code>rounded-</code>-Wert in eckigen Klammern ist ein Fehler, kein
          Sonderfall.
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Kontur — <code>kontur</code>, 1.5 px
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <span className="rounded-flaeche border border-kante px-4 py-2 type-body-medium text-on-surface-mittel">
            1 px — verschwindet
          </span>
          <span className="rounded-flaeche kontur border-kante px-4 py-2 type-body-medium text-on-surface">
            1.5 px — trägt
          </span>
          <span className="rounded-flaeche border border-linie px-4 py-2 type-body-medium text-on-surface-mittel">
            1 px Linie — trennt, umreisst nicht
          </span>
        </div>
        <p className="type-body-medium mb-8 max-w-2xl text-on-surface-mittel">
          <code>kontur</code> setzt nur Breite und Stil; die Farbe kommt separat
          (<code>border-kante</code>, <code>border-primary</code>,{" "}
          <code>border-error</code>). Im Dunkeln verschwindet eine 1-px-Kontur
          gegen den Grund — die Haarlinie bei 12 % bleibt trotzdem 1 px, weil
          sie trennt und nicht umreisst.
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Höhen und Trefferflächen
        </p>
        <div className="space-y-2">
          {hoehen.map(([mass, zweck]) => (
            <div
              key={mass}
              className="flex flex-wrap items-baseline gap-3 border-b border-linie pb-2"
            >
              <span className="type-label-medium w-32 text-on-surface">{mass}</span>
              <span className="type-body-small text-on-surface-mittel">{zweck}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="06" title="Zeichen — Lucide">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Open-Source Lucide, umrissen, Strichstärke 2, runde Enden. „Gewählt"
          zeigt sich über Farbe und Zustands-Ebene, nicht über eine Füllung.
          Grössen 14 · 16 · 18 · 20 · 24 — 14 und 16 stehen neben Text, 18 und
          20 in Knöpfen, 24 allein.
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-5 text-on-surface-mittel">
          {iconSet.map((Icon, i) => (
            <Icon key={i} size={24} strokeWidth={2} aria-hidden />
          ))}
        </div>
        <div className="flex items-end gap-6 text-on-surface-mittel">
          {[14, 16, 18, 20, 24].map((sz) => (
            <div key={sz} className="flex flex-col items-center gap-1">
              <Search size={sz} strokeWidth={2} aria-hidden />
              <span className="type-label-small">{sz}px</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="07" title="Layout">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Fenstergrössen und Seitenränder; Max-Width für die Lesbarkeit,
          Spalten-Raster 4 / 8 / 12.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Lange Formulare gliedert <code>FormAbschnitt</code>: eine Überschrift
          in <code>type-title-medium</code>, gedämpft — dieselbe, die die
          Abschnitte der Übungs-Detailseite tragen, damit Maske und Ansicht
          gleich gegliedert sind. Die Übungsmaske teilt sich darum wie die
          Detailseite in Inhalt und Einordnung (<code>ZweiSpalten</code>); die
          Einordnung steht schmal VOR dem Inhalt, weil sie bestimmt, welche
          Felder er verlangt, und stellt Zusammengehöriges ab <code>sm</code>{" "}
          paarweise nebeneinander, in der schmalen Spalte ab <code>xl</code>{" "}
          untereinander. Ein Feld
          ohne eigenes Label (Dateifeld, Material-Gruppe) bekommt die Id der
          Überschrift für <code>aria-labelledby</code>, statt den Namen doppelt
          zu zeigen.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Jede Seite steht in einem <code>Seitenrahmen</code>: linksbündig
          neben der Seitenleiste, Übersichten über die ganze Fläche
          (<code>voll</code>, Kachelraster mit so vielen Spalten, wie Platz
          ist), Formulare und Lesetext in ihrer Lesebreite (<code>xl</code>{" "}
          bis <code>5xl</code>). Nicht zentriert, denn rechts steht, wo eine
          Seite eine hat, die zweite Spalte (<code>spalte</code>, etwa die
          Einordnung einer Übung, siehe 28, <code>ZweiSpalten</code>). Ab{" "}
          <code>xl</code> ist die Seite dann geteilt (<code>geteilt</code>):
          beide Spalten füllen Breite und Höhe des Fensters und scrollen je
          für sich; die rechte wächst von 20 bis 26 rem mit und lässt sich am
          Griff dazwischen ziehen (<code>role=&quot;separator&quot;</code>,
          Pfeiltasten, Doppelklick = Vorgabe; Cookie <code>kifu-spalte</code>).
          Schmaler steht sie nach dem Inhalt (in der Maske davor), der Inhalt in
          seiner Lesebreite; auf Papier daneben. Zuoberst die Kopfzeile mit dem
          Umschalter der Seitenleiste, den Brotkrumen und rechts den Aktionen
          der Seite — sie klebt ab <code>lg</code> beim Scrollen oben (ausser
          in der Durchführung), 64 px hoch mit den Brotkrumen auf der Linie
          der Marke. Einen Innenabstand bekommt sie nie, er zählte zur Höhe
          und schöbe die Brotkrumen aus der Mitte; darunter beginnt ab{" "}
          <code>lg</code> direkt der Inhalt, schmaler mit einem Rand von 24 px.
          Brotkrumen sind Pflicht, auch auf den
          Einstiegsseiten. Ab <code>lg</code> gehen 280 oder 72 px an die
          Seitenleiste (siehe 13); die Fenstergrössen unten meinen das ganze
          Fenster.
        </p>
        <div className="space-y-2">
          {sizeClasses.map(([cls, range, note]) => (
            <div
              key={cls}
              className="flex flex-wrap items-baseline gap-3 border-b border-linie pb-2"
            >
              <span className="type-title-small w-28 text-on-surface">{cls}</span>
              <span className="type-label-medium text-primary">{range}</span>
              <span className="type-body-small text-on-surface-mittel">{note}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n="08" title="Knöpfe">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Sieben Varianten, eine Regel: <strong>Gefüllt trägt Schwarz.</strong>{" "}
          <code>filled</code> ist Primary-Fläche, <code>tonal</code> eine
          Höhenstufe (08dp), <code>elevated</code> dieselbe Idee eine Stufe
          tiefer (06dp) mit Schatten und Primary-Schrift — im Bild bisher nicht
          angewandt, die Rolle bleibt besetzt —, <code>outlined</code> Kontur
          auf der Kante, <code>text</code> nur Schrift, <code>danger</code>{" "}
          Kontur und Schrift in Error; dazu der leise Knopf (<code>quiet</code>)
          weiter unten, der als einziger nicht über die Emphase leiser wird,
          sondern über die Schrift. Alle tragen{" "}
          <code>state</code> in der Basis und <code>rounded-flaeche</code>; es
          gibt kein <code>hover:bg-*</code> und kein Verschieben beim Drücken —
          die Zustands-Ebene färbt sich in der Farbe des Knopfinhalts ein und
          passt damit auf jede Stufe.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button variant="filled">Training erstellen</Button>
          <Button variant="tonal">Duplizieren</Button>
          <Button variant="elevated">Teilen</Button>
          <Button variant="outlined">Filter zurücksetzen</Button>
          <Button variant="text">Abbrechen</Button>
          <Button variant="danger">Übung löschen</Button>
        </div>
        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Leiser Knopf (<code>variant=&quot;quiet&quot;</code>) — eine Stufe unter{" "}
          <code>text</code>
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Alle Knöpfe stehen normal gesetzt in <code>type-title-small</code>{" "}
          (Geist 600, 14/20), nicht versal — wie die Reiter — und sind 36 px
          hoch; eine Grössen-Prop gibt es nicht mehr. Der leise Knopf ist die{" "}
          <strong>knappe Bauform</strong> des <code>text</code>-Knopfes:
          dieselbe Farbe und Schrift, nur mit knapperer Polsterung. Er gilt
          für Handlungen, die <strong>am Rand mitlaufen</strong>: ein Knopf in
          einer Leiste aus Chips, auf deren Linie er sitzen soll. Er gilt{" "}
          <strong>nicht</strong> für
          Knöpfe, die einen Vorgang abschliessen oder abbrechen —
          Dialog-Knöpfe, Formularfüsse und alles, was neben einem{" "}
          <code>filled</code> steht, bleibt <code>text</code>.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="quiet">
            <Plus size={16} strokeWidth={2} aria-hidden />
            Variante hinzufügen
          </Button>
          <Button variant="text">Abbrechen</Button>
          <span className="type-label-small text-on-surface-mittel">
            quiet · text
          </span>
        </div>

        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Button-Link (navigiert als &lt;a&gt; — kein &lt;a&gt;&lt;button&gt;-Nesting)
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <ButtonLink href="#" variant="filled">Neue Übung</ButtonLink>
          <ButtonLink href="#" variant="tonal">Bearbeiten</ButtonLink>
        </div>
        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Verbundene Knopfgruppe
        </p>
        <ButtonGroup ariaLabel="Ansicht wählen">
          <Button variant="outlined">Liste</Button>
          <Button variant="outlined">Raster</Button>
          <Button variant="outlined">Karte</Button>
        </ButtonGroup>
        <p className="type-body-medium mb-3 mt-4 max-w-2xl text-on-surface-mittel">
          Nur mit Zeichen (<code>segmentClasses</code>), für den Wechsel der
          Darstellung — etwa Liste/Monat im Trainingsplan. 36 px im Quadrat,
          ohne Tooltip; der Name steht im zugänglichen Namen
          (<code>aria-label</code>).
          Gewählt trägt ein Glied die Auswahl-Optik der Chips: Kontur und
          Zeichen in Primary, die Fläche Primary/12 — leiser als ein gefüllter
          Knopf daneben, der die Handlung trägt.
        </p>
        <ButtonGroup ariaLabel="Ansicht">
          <button type="button" aria-label="Liste" aria-pressed={false} className={segmentClasses(false)}>
            <List size={18} aria-hidden />
          </button>
          <button type="button" aria-label="Monat" aria-pressed className={segmentClasses(true)}>
            <CalendarDays size={18} aria-hidden />
          </button>
        </ButtonGroup>

        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Icon-Knöpfe — Zeichen plus Zustands-Ebene, aktiv in Primary
        </p>
        <div className="flex items-center gap-4">
          <IconButton icon={Search} label="Suchen" />
          <IconButton icon={SlidersHorizontal} label="Filter" active />
          <IconButton icon={Plus} label="Hinzufügen" />
          <IconButton icon={Plus} label="Hinzufügen" variant="overlay" />
          <span className="type-label-small text-on-surface-mittel">
            ruhig · aktiv (<code>state-primary</code>) · sm · overlay (06dp über Bild)
          </span>
        </div>

        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Icon-Knopf als Link (<code>IconButtonLink</code>) + Tooltip (24dp)
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          <code>IconButtonLink</code> ist die Navigations-Variante (rendert ein{" "}
          <code>&lt;a&gt;</code> statt <code>&lt;button&gt;</code>, gleiche Optik).
          <code>Tooltip</code> umschliesst einen Trigger ohne Text und macht ihn
          lesbar — Pflicht, sobald das Zeichen allein mehrdeutig ist (Globus =
          öffentlich vs. Schloss = privat). CSS-only, <code>aria-hidden</code>
          (der Name kommt schon vom <code>aria-label</code> des Triggers). Er
          steht auf 24dp wie der Dialog: Was über allem schwebt, trägt die
          oberste Stufe. Verborgen ist er <code>display: none</code>, damit er
          am Rand die Seite nie verbreitert. Mit <code>ende</code> steht er
          bündig zur rechten Kante des Triggers statt mittig — für Trigger am
          rechten Rand; das Überlaufmenü (⋮) trägt ihn immer so, wie sein
          Menü.
        </p>
        <div className="flex items-center gap-4">
          <Tooltip label="Bearbeiten">
            <IconButtonLink href="#" icon={Pencil} label="Bearbeiten" />
          </Tooltip>
          <Tooltip label="Öffentlich schalten">
            <IconButton icon={Globe} label="Öffentlich schalten" />
          </Tooltip>
          <Tooltip label="Auf privat setzen">
            <IconButton icon={Lock} label="Auf privat setzen" />
          </Tooltip>
          <Tooltip label="Rechtsbündig (ende)" ende>
            <IconButton icon={Pencil} label="Rechtsbündig" />
          </Tooltip>
          <span className="type-label-small text-on-surface-mittel">
            (hovern oder per Tab fokussieren)
          </span>
        </div>

        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Ansichts-Umschalter (<code>TabNav</code>)
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Mehrere Sichten auf denselben Gegenstand — etwa ein Team mit
          Trainingsplan, Trainings und Verwaltung. Bewusst Links statt
          Schaltflächen: jede Ansicht hat ihre eigene Adresse, ist damit
          weitergebbar, und der Zurück-Schritt des Browsers funktioniert.
          Deshalb auch kein Auswahl-Baustein aus 10 oder 16 — die sind
          Eingabefelder für eine Auswahl, kein Navigationsmittel, und ihr Wert
          lebt im Formularzustand. Die Leiste trennt sich nach
          unten mit <code>border-linie</code>, die offene Ansicht trägt einen
          2 px starken Strich in Primary. Die Reiter stehen in{" "}
          <code>type-title-small</code>, normal gesetzt.
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

        <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
          Überlaufmenü (<code>OverflowMenu</code>) — der Ort für Destruktives
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Reihen aus Icon-Knöpfen enden mit einem ⋮. Dort liegt, was nicht offen
          stehen soll — allen voran Löschen und Entfernen: ein Klick daneben darf
          nichts Unwiderrufliches auslösen, darum zweistufig (⋮ → Eintrag →
          Bestätigungsdialog). Deshalb hat <code>IconButton</code> bewusst
          <strong> keine</strong> danger-Variante. Trigger-Zustand und -Ref
          stecken in der Komponente: ein geteilter Ref zeigte stets auf den
          zuletzt gerenderten Trigger, und der Outside-Click-Handler erkennt
          dann den eigenen Trigger nicht mehr — das Menü togglet doppelt und
          öffnet sofort wieder. In Listen gehört der Gegenstand ins{" "}
          <code>label</code> („Weitere Aktionen zu …"); der Tooltip bleibt kurz.
        </p>
        <OverflowMenuDemo />

        <div className="mt-6 rounded-flaeche bg-elev-01 p-4">
          <p className="type-label-large mb-1 text-on-surface">
            Ausnahme: Favoriten-Knopf (Füllung)
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            Ist ein <code>IconButton</code> (gleiche Grösse, Zustands-Ebene,
            Fokus-Ring, Primary im aktiven Zustand). Einzige Abweichung von der
            Zeichen-Regel „gewählt = Ebene statt Füllung": Das Favoriten-Herz
            wird im aktiven Zustand <strong>gefüllt</strong> — der etablierte,
            sofort lesbare Favoriten-Code. Optimistisch (sofortiges Umschalten,
            Rücksetzen plus Snackbar bei Fehler).
          </p>
          <div className="flex items-center gap-4">
            <FavoriteButton exerciseId="00000000-0000-0000-0000-000000000000" initial={false} />
            <FavoriteButton exerciseId="00000000-0000-0000-0000-000000000000" initial />
            <span className="type-label-small text-on-surface-mittel">
              inaktiv (Umriss) · aktiv (gefüllt, Primary)
            </span>
          </div>
        </div>
      </Section>

      <Section n="09" title="Plaketten &amp; Chips">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Gefüllt heisst still, umrandet heisst gilt.</strong> Eine
          Plakette meldet entweder bloss, woher etwas stammt oder in welchem
          Zwischenstand es liegt — dann trägt sie eine Höhenstufe oder die Kante
          mit gedämpfter Schrift (<code>manual</code>, <code>entwurf</code>,{" "}
          <code>neutral</code>). Oder sie meldet eine Eigenschaft, die nach
          aussen wirkt — öffentlich sichtbar, mehrere Varianten vorhanden —,
          dann steht sie umrandet in Primary (<code>oeffentlich</code>,{" "}
          <code>varianten</code>). Keine der beiden Formen füllt mit
          Akzentfarbe; das bleibt dem gefüllten Knopf vorbehalten, der etwas
          auslöst. Anatomie: <code>rounded-plakette</code>, 22 px hoch,{" "}
          <code>type-plakette</code> — dasselbe Mass trägt die
          Kategorie-Plakette darunter, sonst stünden zwei Plaketten
          nebeneinander verschieden hoch.
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Badge tone="manual" />
          <Badge tone="entwurf">✎ Entwurf</Badge>
          <Badge tone="oeffentlich" />
          <Badge tone="varianten">2 Varianten</Badge>
          <Badge tone="neutral">Kinderfussball</Badge>
          <Badge tone="befund">
            <CalendarX2 size={12} strokeWidth={2.5} aria-hidden />
            Noch kein Training
          </Badge>
          <Badge tone="neutral">
            <CalendarOff size={12} strokeWidth={2.5} aria-hidden />
            Ausgefallen
          </Badge>
          <span className="type-label-small text-on-surface-mittel">
            manual · entwurf · oeffentlich · varianten · neutral · befund
          </span>
        </div>
        <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
          Befund: eine offene Lücke, die jemand schliessen muss — etwa ein
          anstehender Termin ohne Training.
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">
          Alterskategorien — dieselbe Regel, eigene Farbtabelle
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {kategorien.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </div>
        <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
          Nur Kontur und Schrift (<code>border-current</code>), die Fläche
          bleibt der Grund darunter — deshalb tragen sie auf der Karte wie im
          Katalog dasselbe Bild. Im <strong>Druck</strong> kippen sie in die
          gefüllte Form mit dunkler Schrift: Auf Papier ist eine helle Kontur
          kaum zu sehen. Die Tabelle steht einmal in <code>Chip.tsx</code>{" "}
          (<code>katPlakette</code>) und gilt überall, wo eine Kategorie{" "}
          <em>angezeigt</em> wird. Wo eine <em>gewählt</em> wird, gilt sie seit
          dem 2026-09-13 nicht mehr: Die Alterskategorien stehen am Training,
          am Team und an der Übung in einer Mehrfachauswahl (17), und die führt
          Text, keine Plaketten. Die Farbe sagt, welche Kategorie man vor sich
          hat — beim Auswählen steht deren Name ohnehin ausgeschrieben da
          (PO-Entscheid).
        </p>

        <p className="type-label-small mb-2 text-on-surface-mittel">Chips</p>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          Ungewählt steht jeder Chip auf der Kante. <strong>Gewählt gibt es
          zweimal.</strong> Getönt (<code>chipTextSelected</code> —
          Primary-Kontur, Primary-Schrift, 12 % Fläche, kein Häkchen) sind der{" "}
          <strong>Filter</strong> und der Chip, der{" "}
          <strong>Nutzertext</strong> trägt — eine Variante, ein Gruppenname.
          Dieselbe Tönung trägt das gewählte Glied der verbundenen
          Knopfgruppe (08). Ein Filter steht neben Suchfeld, Auswahl und
          Knöpfen; gefüllt wäre er lauter als die Handlung daneben, und der
          Farbwechsel sagt «an» bereits. Eine gefüllte Fläche schriee zudem den
          Namen an, den die Trainerin selbst vergeben hat. Gefüllt
          (<code>chipSelected</code> — Primary-Fläche, schwarze Schrift) bleibt
          allein die offene Einfachauswahl (10). Im geteilten Chip folgt der
          Trennstrich dem Zustand (<code>border-primary/50</code> gewählt,{" "}
          <code>border-kante</code> sonst). Der schwebende Assist-Chip
          (<code>elevated</code> — 06dp plus <code>shadow-dp-04</code> statt
          einer Kontur) ist wie der gleichnamige Knopf aus 08 im Bild bisher
          nicht angewandt; die Rolle bleibt besetzt, damit die Chip-Leiter
          vollständig ist.
        </p>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          <strong>Schrift.</strong> Der <strong>Filter</strong> steht normal
          gesetzt in <code>type-body-medium</code>, wie der Nutzertext-Chip —
          er sitzt in Leisten neben Suchfeld, Auswahl und Knöpfen und liest
          sich dort als Wort («Meine Termine»), nicht als Rubrik, und bleibt
          leiser als der halbfette Knopf daneben, der die Handlung trägt.
          Assist, Suggestion, Input und die offene Einfachauswahl bleiben
          versal in <code>type-label-medium</code>.
        </p>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          <strong>Eine Höhe.</strong> Jeder Chip ist 36 px hoch, im Fliesstext
          wie in einer Filterleiste — dasselbe Mass wie Knopf, Feld und
          Filterknopf, darum fluchtet er überall ohne eigene Stufe.
        </p>
        <ChipsDemo />
      </Section>

      <Section n="10" title="Offene Einfachauswahl">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Genau <strong>ein</strong> Wert aus einer Menge, die offen liegt —
          kein aufklappendes Menü. <strong>Ein</strong> Baustein:{" "}
          <code>ChoiceChipGroup</code>, mit Pfeiltasten-Navigation und
          wanderndem Tabstopp.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Die offene Einfachauswahl ist seit dem 2026-09-13 der{" "}
          <strong>Sonderfall</strong>, nicht die Regel: Formulare führen ihre
          Einfachauswahl in der Einfachauswahl mit Panel (16), ihre
          Mehrfachauswahl in der Mehrfachauswahl (17) — siehe den Kasten unten.
          Offen bleibt, was in kein Menü gehört: die{" "}
          <strong>Variantenwahl</strong> (24), deren Werte der Trainer selbst
          benannt hat. Hier stand bis dahin eine zweite Bauform,{" "}
          <code>SegmentedControl</code> — eine tab-artige Leiste für kurze
          Werte, die Altersstufe und Trainingsteil trug. Mit deren Umzug ins
          Auswahlmenü hatte sie keine Anwendung mehr; sie ist aus dem Kit
          entfernt, statt als Angebot ohne Gebrauch stehen zu bleiben.
        </p>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          <code>ChoiceChipGroup</code> — lange Werte, umbrechend
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Radiogroup-Semantik (<code>role=radiogroup</code> /{" "}
          <code>role=radio</code>, <code>aria-checked</code>) — es ist ein
          Eingabefeld, keine Ansicht, und darum keine Tabs. Optik aus den
          Chip-Bündeln, ausgewählt wie der Filter-Chip, aber{" "}
          <strong>ohne Häkchen</strong>: Einfachauswahl ist kein
          Ein/Aus-Zustand, und der Umriss-Wechsel trägt die Aussage bereits.
          Die Chips <strong>umbrechen</strong> — das ist ihr eigentlicher
          Vorzug: Eine Reihe, die stattdessen seitlich scrollte, zeigte dem
          Nutzer seine Optionen nicht mehr nebeneinander. In Gebrauch ist der
          Baustein bei der <strong>Variantenwahl</strong> (24), deren
          Bezeichnungen bis vierzig Zeichen lang sein dürfen.
        </p>
        <ChoiceChipDemo />

        <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
          <code>AuswahlListe</code> — Einträge mit Titel und Untertitel
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Dieselbe Radiogroup-Semantik wie die Chip-Gruppe, aber senkrecht und
          mit zwei Zeilen je Eintrag — für Trainings und Termine, die zu lang
          für Chips sind; ein <code>listbox</code> mit verschachtelten Knöpfen
          wäre kein gültiges ARIA. Pfeil hoch/runter wählt und bewegt den
          Fokus, und ein <strong>Häkchen</strong> zeigt die Wahl zusätzlich zur
          Fläche an.
        </p>
        <AuswahlListeDemo />

        <div className="mt-6 rounded-flaeche bg-elev-01 p-4">
          <p className="type-label-large mb-1 text-on-surface">
            Warum das Übungsformular nichts mehr offen legt
          </p>
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Altersstufe und Einordnung lagen zwischen dem 2026-08-30 und dem
            2026-09-13 offen, mit einem guten Grund: Beide entscheiden über die
            halbe Maske darunter, und diese Tragweite sollte man sehen, ohne
            erst zu klicken. Das Argument gilt weiter — es verliert nur gegen
            ein stärkeres. Ein Formular mit sieben Auswahlfeldern, von denen
            zwei eine Segmentleiste sind, eins eine Chip-Reihe, zwei ein
            Auswahlmenü und zwei ein Chip-Bündel, sieht nicht nach Gewichtung
            aus, sondern nach Zufall: Der Trainer liest keine Rangordnung ab,
            er lernt vier Bedienweisen für dieselbe Handlung. Seit dem
            2026-09-13 führt die Maske darum jede Einfachauswahl als 16 und jede
            Mehrfachauswahl als 17 (PO-Vorgabe). Die Tragweite trägt jetzt der
            Hilfstext unter dem Feld, nicht seine Bauform.
          </p>
        </div>

        <div className="mt-4 rounded-flaeche bg-elev-01 p-4">
          <p className="type-label-large mb-1 text-on-surface">
            <code>AltersstufeField</code> — eine Wahl, zwei Domänen
          </p>
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Übung und Training wählen dieselbe Altersstufe und teilen sich darum
            denselben Baustein im Kit — auch wenn er seit dem 2026-09-13 keine
            offene Wahl mehr ist. Er hat drei Zustände: <strong>Wahl</strong>{" "}
            (ein <code>Select</code>, siehe 16), <strong>fest</strong> (neutrale{" "}
            <code>Badge</code> plus Erklärsatz) und <strong>ungewählt</strong>{" "}
            (<code>wert = null</code>). Der letzte ist der Ausgangszustand am
            Training: Die Wahl bindet dort lebenslang und darf nicht durch eine
            Voreinstellung durchrutschen — also steht dort der Leerfall als
            erste Option in der Liste, und nur dort. An der Übung ist sie
            vorbelegt, weil eine Übung umwandelbar bleibt; einmal gesetzt,
            lässt sich die Stufe nicht auf «keine» zurückstellen. Die Plakette
            ist bewusst neutral: Die Altersstufe ist keine Alterskategorie und
            borgt deren gelernte Farbcodierung nicht. Der feste Zustand nimmt
            über <code>aktion</code> ein Bedienelement neben der Plakette auf —
            dort hängt das Überführen einer eigenen Übung in die andere
            Altersstufe. Es gehört nicht ins Auswahlfeld: An einer
            gespeicherten Übung ist der Stufenwechsel kein Feld, sondern ein
            eigener, zu bestätigender Vorgang.
          </p>
        </div>
      </Section>

      <Section n="11" title="Übungskarten">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Die Karte ist eine Höhenstufe (<code>bg-elev-01</code>,{" "}
          <code>rounded-flaeche</code>) und trägt <strong>keinen Rand</strong>:
          Höhe und Kontur nebeneinander sagten dasselbe zweimal. Das Bild ist das
          einzige satte Farbfeld auf der Karte; an seinem <strong>Kopf</strong>{" "}
          liegt ein Verlauf aus <code>scrim</code> (<code>top-0 h-16</code>) —
          er schützt, was dort steht: die Herkunfts-Plakette links und den
          Favoriten-Knopf rechts. Den Titel trägt die Kartenfläche unter dem
          Bild; er braucht den Verlauf nicht. Darunter stehen die{" "}
          <strong>Eckdaten</strong> in <code>type-body-medium</code>, getrennt
          durch «·»: Alterskategorien als Buchstaben (aufsteigend G bis A),
          die feinste Einordnung, das Feld und die Spieler:innen — genug, um
          ohne Öffnen zu sehen, ob eine Übung zu Mannschaft und Platz passt.
          Das Feld ist die Spielfeldgrösse, wo eine erfasst ist, sonst der
          Feldtyp; die Spielerzahl kürzt «Sp.» ab und wird voll vorgelesen.
          Was eine Übung nicht trägt, fällt ohne Platzhalter weg. Die Zeile
          hat höchstens zwei Zeilen (<code>line-clamp-2</code>) und endet
          sonst in Auslassungspunkten. Die Zeile setzt{" "}
          <code>uebungEckdaten</code> zusammen — im Katalog wie in diesen
          Beispielen. Überfahren färbt die ganze Karte über{" "}
          <code>state</code> — kein eigener Hover-Ton, und die Ebene sitzt auf
          dem Link, der die Karte deckt.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* actionSlot demonstriert die Slot-Verdrahtung: das UI-Kit bleibt
              domänenfrei, der Favoriten-Knopf kommt aus dem Feature-Layer. */}
          <ExerciseCard
            ex={{
              slug: "schiessbude",
              name: "Schiessbude",
              eckdaten: uebungEckdaten({
                altersstufe: "kinderfussball",
                trainingsteil: "ausklang",
                hauptteilkategorie: null,
                feldtyp: "kleinfeld",
                spielfeld_laenge_m: null,
                spielfeld_breite_m: null,
                kategorien: ["E", "G", "F"],
                anzahl_kinder: { min: 6, max: 10 },
              }),
              herkunft: "manual",
            }}
            actionSlot={
              <FavoriteButton
                exerciseId="00000000-0000-0000-0000-000000000000"
                initial={false}
                variant="overlay"
              />
            }
          />
          <ExerciseCard
            ex={{
              slug: "mein-4-gegen-4",
              name: "Mein 4-gegen-4",
              eckdaten: uebungEckdaten({
                altersstufe: "kinderfussball",
                trainingsteil: "hauptteil",
                hauptteilkategorie: "fussball-spielen-lernen",
                feldtyp: "freies_feld",
                spielfeld_laenge_m: 20,
                spielfeld_breite_m: 15,
                kategorien: ["F", "E"],
                anzahl_kinder: { min: 8, max: 8 },
              }),
              herkunft: "user",
              visibility: "private",
            }}
          />
          <ExerciseCard
            ex={{
              slug: "toblerone",
              name: "Toblerone",
              eckdaten: uebungEckdaten({
                altersstufe: "juniorenfussball",
                trainingsteil: "jun-spielformen",
                hauptteilkategorie: null,
                feldtyp: null,
                spielfeld_laenge_m: 40,
                spielfeld_breite_m: 30,
                kategorien: ["D", "C", "B", "A"],
                anzahl_kinder: { min: 10 },
              }),
              herkunft: "user",
              visibility: "public",
            }}
          />
        </div>
      </Section>

      <Section n="12" title="Methodischer Fahrplan (Signatur-Komponente)">
        <Card className="max-w-xl p-6">
          <MethodischerFahrplan
            fahrplan={{
              offen_starten: fahrplan[0],
              ueben: [`- ${fahrplan[1]}`],
              wetteifern: fahrplan[2],
            }}
          />
        </Card>
        <p className="type-body-medium mb-3 mt-8 max-w-2xl text-on-surface-mittel">
          <strong>Freitext</strong> — <code>Freitext</code>: Ablauf, Fahrplan-Stufen
          und Varianten einer Übung (Story #282). Kein Markdown: Zeilenumbrüche bleiben, wie
          sie erfasst sind; nur Zeilen mit «- »/«* » werden Aufzählung, Zeilen
          mit «1. » nummerierte Liste. Dieselben Regeln gelten für die drei
          Stufen des methodischen Fahrplans. Jede andere Zeile, auch eine
          Leerzeile, beendet eine Liste.
        </p>
        <Card className="max-w-xl p-6">
          <Freitext
            text={
              "4 gegen 4 mit je 2 Zielspieler:innen pro Team.\nAlle bleiben in ihren Zonen.\n- Zeitdruck: Ball muss nach 4 Sekunden die Zone verlassen\n- Nur Direktpässe\n\nWertung:\n1. Vertikaler Ball ins Ziel: 1 Punkt\n2. Tor nach vertikalem Ball: 3 Punkte"
            }
          />
        </Card>
      </Section>

      <Section n="13" title="Navigation">
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          <strong>Seitenleiste</strong> am linken Rand, auf{" "}
          <code>bg-elev-01</code> mit <code>border-linie</code> zum Inhalt. Sie
          ist Rahmen, keine schwebende Fläche, und trägt darum keinen Schatten.
          Oben die Marke (Fussball im Primary-Quadrat, zugleich das Favicon), darunter die Einträge in
          Gruppen, unten die Konto-Karte: Avatar, Anzeigename und E-Mail
          führen als Ganzes ins Konto. Abmelden steht im Konto, nicht in der
          Leiste. Der offene Eintrag steht eine Stufe höher als sein Grund
          (08dp auf 01dp) und trägt sein Zeichen in Primary; aufklappbare
          Einträge (Teams) haben einen eigenen Pfeil, damit der Name selbst
          zur Übersicht führen kann.
        </p>
        <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
          <strong>Breit oder schmal</strong> — 280 px mit Namen, 72 px nur mit
          Zeichen. Umgeschaltet wird <strong>nur von Hand</strong>, über den
          Knopf vor den Brotkrumen; beim Überfahren öffnet sich nichts, sonst
          schöbe sich die Leiste über das, was man gerade ansteuern wollte.
          Schmal zeigt jeder Eintrag seinen Namen beim Überfahren und
          Fokussieren als Hinweis daneben (Tooltip-Fläche, 24dp). Die Wahl
          merkt sich der Browser in einem Cookie, so steht die Leiste schon
          beim Laden in der richtigen Breite. Die Breite gleitet beim
          Umschalten — die einzige Fläche im Kit, die ihre Breite ändert,
          weil der Inhalt daneben mitwandert und das Auge ihm folgen soll.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Unter <code>lg</code> wird die Leiste zum <strong>Drawer von
          links</strong> auf 08dp, geöffnet über eine schmale Kopfzeile
          (04dp, deckend) mit Hamburger. Scrim, Escape und Scroll-Sperre wie
          bei jedem Overlay; dort ist die Leiste immer breit, die aktive Zeile
          steht auf 12dp.
        </p>
        <SeitenleisteDemo />
      </Section>

      <Section n="14" title="Textfelder, Text-Area, Datum &amp; Zeit">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Der Name steht über dem Feld, jederzeit</strong> (Epic #363):
          leer, ausgefüllt, im Fokus, im Fehler. Ein ausgefülltes Formular
          bleibt so lesbar, ohne dass man ins Feld klickt. Er steht klein und
          gedämpft in der Lesetype (<code>type-body-small</code>), nicht in der
          Versal-Type der Label — er benennt, er ruft nicht. Darunter folgt der
          Feldkasten, darunter Hinweis oder Fehler in derselben kleinen Schrift.
          Der Rahmen dafür ist <code>Feld</code>; mehrere Felder unter einem
          gemeinsamen Namen («Spielfeldgrösse» über Länge × Breite) nimmt{" "}
          <code>FeldGruppe</code>, im selben Stil.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Der Feldkasten ist ruhend leer:</strong> keine Kontur, keine
          Fläche (Utility <code>feldkasten</code>). Ein Formular liest sich so
          als Text statt als Stapel von Kästen. Beim Überfahren hellt eine
          leise Ebene in der Schriftfarbe auf (6 %), im Fokus trägt die Kontur
          Primary, bei Fehler und Befund Error. Die Stärke bleibt dabei immer
          1.5 px — nur die Farbe wechselt, nichts springt beim Hineinklicken.
          36 px hoch wie jedes Bedienelement, der Wert in{" "}
          <code>type-body-large</code>. Ein Platzhalter steht gedämpft im Feld
          und sagt, was hinein soll. Wo ein Feld keinen sichtbaren Namen trägt
          — die Suche in der Filterleiste —, gibt <code>umrandet</code> ihm auch
          ruhend die Kante, sonst fehlte es dort schlicht.
        </p>
        <div className="grid max-w-md gap-6">
          <TextField label="Übungsname" supportingText="Pflichtfeld" />
          <SearchField label="Suche" />
          <TextField
            label="Anzahl Spieler:innen"
            type="number"
            defaultValue="1"
            error
            supportingText="Bitte eine Zahl ≥ 2 eingeben."
          />
          <PasswordField
            label="Passwort"
            autoComplete="off"
            supportingText="Mit Auge-Zeichen ein- und ausblendbar."
          />
          <TextArea
            label="Aufbau / Beschreibung"
            supportingText="Leer zwei Zeilen hoch — wächst bis 10 Zeilen, dann scrollen."
          />
          <TextArea
            label="Weiteres Material"
            placeholder="Mit Platzhalter: Er steht im Feld und bricht um, wo er nicht in eine Zeile passt."
          />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Suchfeld (<code>SearchField</code>)
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Dasselbe Feld, dessen Zeichen aber <strong>rechts</strong> steht — an
          demselben Platz, an dem das Passwortfeld sein Auge trägt. Das ist die
          Hausregel: <strong>links steht Schmuck, rechts steht
          Bedienbares.</strong> Und das Zeichen am Suchfeld ist beides
          nacheinander — solange nichts eingegeben ist, sagt die Lupe, wofür das
          Feld da ist; sobald etwas dasteht, tritt an ihre Stelle ein Kreuz, das
          die Suche mit einem Klick leert und den Cursor zurück ins Feld setzt.
          Das Kreuz meldet sich über dasselbe <code>onChange</code> wie eine
          Tastatureingabe — es gibt keinen zweiten Rückkanal, den ein Aufrufer
          vergessen könnte, und eine verzögerte Suche verzögert auch das Leeren.
          In der Filterleiste steht es ohne sichtbaren Namen (
          <code>labelVersteckt</code>), dafür umrandet und mit Platzhalter.
        </p>
        <div className="grid max-w-md gap-6">
          <SearchField label="Übungen durchsuchen" />
          <SearchField
            label="Übungen durchsuchen"
            labelVersteckt
            umrandet
            placeholder="Übungen durchsuchen"
            defaultValue="Passspiel"
          />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Kopf-Feld (<code>HeadlineField</code>)
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Für den Fall, in dem ein vom Trainer vergebener Name dort geändert
          wird, wo er steht — der Trainingsname im Editor-Kopf und der Name in
          der Übungsmaske. Es trägt die
          Schrift der Überschrift (<code>type-headline-medium</code>), damit der
          Kopf seine Gliederung behält, und zeigt sich in{" "}
          <strong>drei Lagen</strong>: Ruhend sieht man eine Überschrift und
          kein Feld — keine Kontur, keine Fläche. Beim Zeigen legt sich eine
          Fläche darunter (<code>bg-elev-04</code>), und die ist die ganze
          Ankündigung: Hier lässt sich etwas eintragen. Erst im Fokus kommt die
          Kontur in Primary. Die Stufe 04 ist mit Absicht kein Nachbar der
          Karte, auf der das Feld gewöhnlich liegt (01): Eine Stufe darüber wäre
          rechnerisch eine Fläche und am Bildschirm keine.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Es folgt derselben Idee wie der Feldkasten — ruhend nichts, beim
          Zeigen eine Fläche, im Fokus die Kontur —, nur in der Schrift der
          Überschrift und ohne Namen darüber. Die Konturstärke bleibt zwischen
          Ruhe und Fokus gleich und wechselt nur die Farbe — ein Sprung verschöbe
          bei 28 px Schrift die ganze Zeile sichtbar.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Kein Name darüber:</strong> Der Wert <em>ist</em> bereits
          die Überschrift, ein Label daneben benennte dieselbe Sache ein zweites
          Mal. Den Namen trägt darum <code>aria-label</code> — Pflicht, nicht
          Kür. Und weil ein <code>&lt;input&gt;</code> keine Überschrift ist,
          gehört daneben eine echte, nur vorgelesene (<code>sr-only</code>),
          sonst verlöre die Seite ihre Gliederung.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Schrift der Überschrift, die es ersetzt:</strong>{" "}
          <code>schrift=&quot;headline&quot;</code> (Vorgabe, Trainingsname) oder{" "}
          <code>schrift=&quot;title&quot;</code> für den Namen einer Übung — ihre
          Seite führt ihn in <code>type-title-large</code>.
        </p>
        <div className="grid max-w-md gap-6">
          <HeadlineField
            aria-label="Name des Trainings"
            defaultValue="Passspiel im Quadrat"
          />
          {/* Leer zeigt es seinen Platzhalter gedämpft, sonst wäre es in Ruhe
              nicht da; `error` stellt die Kontur auch in Ruhe in Fehlerfarbe. */}
          <HeadlineField aria-label="Name der Übung" placeholder="Name der Übung" schrift="title" />
          <HeadlineField aria-label="Name der Übung" placeholder="Name der Übung" schrift="title" error />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Zahlenfelder
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Zahlenfelder</strong> (<code>type=&quot;number&quot;</code>)
          zählen nie von selbst: keine Pfeile im Feld, und weder Pfeiltasten
          noch Mausrad ändern den Wert. Eine Zahl wird getippt; ein Scrollen
          über dem fokussierten Feld verstellte sie sonst unbemerkt.
        </p>
        <div className="grid max-w-md gap-6">
          <TextField label="Verfügbare Kinder" type="number" min={1} />
          <TextField
            label="Verfügbare Kinder"
            type="number"
            min={1}
            error
            supportingText="Bitte eine Zahl ≥ 1 eingeben."
          />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Befund am Feld (<code>befund</code>) und gemischter Supporting-Text
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Zwei Ergänzungen aus der Gruppenverteilung (Story #151).{" "}
          <code>befund</code> färbt den Rahmen in Error: Der Wert ist
          gespeichert und richtig erfasst, geht aber mit anderen nicht auf —
          etwa eine Dauer in einem Wechsel, dessen Übungen ungleich lang sind.{" "}
          <strong>Befund und Fehleingabe tragen dieselbe Farbe; sie
          unterscheiden sich in <code>aria-invalid</code> und im Verhalten, nicht
          im Bild.</strong> Material kennt nur eine Fehlerrolle, und eine achte
          Farbe neben sieben Alterskategorien wäre nicht mehr unterscheidbar
          gewesen — die frühere eigene Farbe lag bei{" "}
          {v(kontrast("#f0b429", KAT.f))} zu kat-f, also praktisch deckungsgleich.
          Was bleibt, ist der Unterschied im Verhalten: Ein <code>error</code>{" "}
          weist die Eingabe ab und meldet sich der Vorlesehilfe als ungültig, ein{" "}
          <code>befund</code> lässt speichern und trägt seinen Satz im
          Supporting-Text. Am Rahmen gilt die Rangfolge <code>error</code> &gt;{" "}
          <code>befund</code> &gt; Fokus: Der Fokus färbt nur den ruhigen Rahmen
          um und zeigt sich im Fehler über einen halben Pixel nach innen, damit
          ein Befund nicht ausgerechnet beim Hinschauen verschwindet. Weil der Rahmen allein nur
          sehend wahrnehmbar ist, gehört zu <code>befund</code> ein Hinweis für
          Screenreader (am Dauerfeld ein <code>sr-only</code>-Satz per{" "}
          <code>aria-describedby</code>).
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <code>supportingText</code> nimmt seit derselben Story einen{" "}
          <code>ReactNode</code>, weil unter einem Feld zwei Aussagen in einer
          Zeile stehen können — so trägt die Gruppenzeile die Zeitsumme (eine
          Auskunft) und dahinter den Konflikt (ein Befund). Nur der zweite Teil
          ist eingefärbt — die ganze Zeile zu färben liesse nicht mehr erkennen,
          was daran gemeldet ist.
        </p>
        <div className="grid max-w-md gap-6">
          <TextField
            label="Minuten"
            aria-label="Dauer in Minuten"
            type="number"
            min={0}
            defaultValue="15"
            className="w-28"
            befund
          />
          <TextField
            label="Bezeichnung"
            defaultValue="Gruppe 1"
            supportingText={
              <>
                Zugewiesen 40 min
                <span className="text-error">
                  {" "}
                  · Steht im 1. Wechsel an zwei Übungen.
                </span>
              </>
            }
          />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Datum &amp; Uhrzeit
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Für Trainings-Termine, mit Name und Feldkasten wie jedes Feld. Das
          native Steuerelement ist Absicht —
          Datumsauswahl, Tastatureingabe und Lokalisierung kommen vom
          Betriebssystem.
        </p>
        <div className="grid max-w-md gap-6 sm:grid-cols-2">
          <DateField label="Datum" />
          <TimeField label="Beginn (optional)" />
        </div>

        <h3 className="mb-2 mt-8 type-title-medium text-on-surface">
          Checkbox
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Für eine Ja/Nein-Angabe in einem Formular, die weitere Felder
          zuschaltet oder eine Folge hat — «Wiederholender Termin» im
          Termin-Dialog, «Foto entfernen» im Übungsformular. Neu ist sie, weil
          beide Stellen sonst ein unverkleidetes Browser-Kästchen trügen. Sie
          trägt dasselbe eckige Kästchen wie die Optionen der Mehrfachauswahl
          (17): gewählt gefüllt in Primary, Haken in on-primary. Darunter liegt
          ein echtes <code>&lt;input type=&quot;checkbox&quot;&gt;</code>;
          das Label gehört zur Klickfläche. Ein Filter ist sie nicht — der
          bleibt ein <code>FilterChip</code> (9).
        </p>
        <CheckboxDemo />
      </Section>

      <Section n="15" title="Menü">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Verankertes Dropdown (Klick daneben oder Escape schliesst) auf{" "}
          <code>bg-elev-08</code>, mit <code>border-linie</code>,{" "}
          <code>rounded-flaeche</code> und <code>shadow-dp-08</code>: Es
          schwebt, also trägt es beides — Höhe und Schatten. Jede Zeile trägt{" "}
          <code>state</code>, Destruktives steht zuunterst und trägt Error als
          Schrift, nie als Fläche.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Error trägt hier als Fliesstext: Das Panel liegt auf 08dp, und dort
          kommt die Rolle auf {v(kontrast(ERROR, elev(8)))}. Mit Materials
          Baseline war das eine bewusste Abweichung ({v(kontrast("#cf6679", elev(8)))}
          {" "}— unter den 4.5:1); seit Error eine Stufe heller ist (siehe 01),
          ist es keine mehr. Die Zeile trägt die Farbe trotzdem nicht allein:
          Sie steht abgesetzt am Fuss, hat ihr eigenes Zeichen, und der Vorgang
          ist zweistufig (Eintrag → Bestätigungsdialog). Das Rot verstärkt eine
          Aussage, die auch ohne es ankommt.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Tastatur:</strong> Beim Öffnen springt der Fokus auf den
          ersten Eintrag, <kbd>↑</kbd>/<kbd>↓</kbd> laufen zyklisch,{" "}
          <kbd>Home</kbd>/<kbd>End</kbd> an die Enden. Den Fokus an den Trigger
          zurück geben nur <kbd>Esc</kbd> und eine getroffene Auswahl — ein
          Klick daneben <strong>nicht</strong>: dort will die Nutzerin gerade
          woanders hin, ein Rücksprung risse ihr den Fokus vom eben geklickten
          Element weg. Voraussetzung ist, dass der Trigger als{" "}
          <code>triggerRef</code> übergeben wird.
        </p>
        <MenuDemo />
      </Section>

      <Section n="16" title="Einfachauswahl mit Panel">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Auswahl <strong>eines</strong> Werts — kein natives{" "}
          <code>&lt;select&gt;</code>. Der Auslöser ist ein Feldkasten wie am
          Textfeld (14), mit dem Namen darüber; das aufgeklappte Panel ist ein Menü
          (08dp, Haarlinie, <code>shadow-dp-08</code>, Häkchen auf der Auswahl).
          Die Zeile, auf der die Tastatur gerade steht, trägt{" "}
          <code>state-aktiv</code> — dieselbe Deckung wie der Fokus, aber ohne
          echten <code>:focus-visible</code>, denn der liegt auf dem Trigger.
          Listbox-Semantik mit voller Tastatursteuerung (↑/↓, Home/End, Enter,
          Esc). Offen trägt der Auslöser die Kontur in Primary — er gehört dann
          zum Panel darunter. Der gewählte Wert steht ganz im Feld und bricht
          um, statt abgeschnitten zu werden: Eine Einordnung ist oft ein Satz.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Leerwert und Platzhalter sind zweierlei</strong>, und das Feld
          zeigt sie verschieden. «— kein Feldtyp —» ist ein <em>Wert</em>: Die
          Übung hat keinen, das ist die Antwort, und sie steht als Option in der
          Liste und danach als Wert im Feld. «Einordnung wählen …» ist{" "}
          <em>keine Antwort</em>, sondern das Fehlen einer: Dafür gibt es{" "}
          <code>placeholder</code>, der gedämpft im Feld steht — genau wie an der
          Mehrfachauswahl (17). Ein Feld hat das eine oder das andere, nie
          beides; wer «noch nichts gewählt» als Option in die Liste schriebe,
          liesse es aussehen wie eine getroffene Wahl.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <code>group</code> stellt einer Option eine nicht wählbare Kopfzeile
          voran, sobald die Gruppe wechselt — wie bei der Mehrfachauswahl (17)
          und mit derselben Pflicht: Die Optionen müssen gruppensortiert
          übergeben werden, sonst erscheint dieselbe Kopfzeile mehrfach. Das
          trägt die <strong>Einordnung einer Junioren-Übung</strong>: Gewählt
          wird einer der sieben Blöcke, der Trainingsteil steht als Kopfzeile
          darüber — so bleibt sichtbar, wozu ein Block gehört, ohne dass das
          Formular eine zweite Bedienebene aufmachen muss. Im Kinderfussball
          fällt die Gruppierung weg; dort ist der Trainingsteil selbst die
          Einordnung, vier flache Werte. Im Übungsformular laufen ausserdem
          Altersstufe, Hauptteilkategorie, Feldtyp und Übungstyp über diesen
          Baustein — jede Einfachauswahl der Maske, ohne Ausnahme
          (PO-Vorgabe 2026-09-13, siehe 10).
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
            supportingText="Öffnet ein eigenes Panel statt des Betriebssystem-Dropdowns."
          />
          <Select
            label="Sichtbarkeit"
            defaultValue="all"
            options={[
              { value: "all", label: "Alle" },
              { value: "public", label: "Community" },
              { value: "private", label: "Privat" },
            ]}
            supportingText="Jede Option ist ein Wert — kein Platzhalter nötig."
          />
          <Select
            label="Trainingsteil"
            defaultValue=""
            placeholder="Einordnung wählen …"
            options={[
              { value: "auffangen", label: "Auffangen" },
              { value: "einleitung", label: "Einleitung" },
              { value: "hauptteil", label: "Hauptteil" },
              { value: "ausklang", label: "Ausklang" },
            ]}
            supportingText="Noch nichts gewählt: Der Platzhalter steht gedämpft im Feld."
          />
        </div>
      </Section>

      <Section n="17" title="Mehrfachauswahl">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Auswahl <strong>mehrerer</strong> Werte im Formular: ein Feldkasten
          mit dem Namen darüber, der die gewählten Werte als kommagetrennte
          Zeile zeigt und umbricht, wo sie nicht in eine Zeile passen (Epic
          #363). Er öffnet ein Panel mit Suchfeld im Kopf, Optionsliste (eckige
          Checkbox, <code>rounded-plakette</code>) und Aktions-Fuss
          (<code>Zurücksetzen</code> / <code>Alle auswählen</code>, respektiert
          den aktiven Filter). Keine Tags im Feld: Entfernt wird in der Liste,
          wo auch gewählt wird; ein Kreuzchen pro Wert im Feld wäre ein zweiter
          Ort dafür. Die Werte stehen in der Reihenfolge der Optionsliste,
          nicht in der des Anklickens: Dieselbe Auswahl soll immer gleich
          lauten. Ist nichts gewählt, steht der <code>placeholder</code>{" "}
          gedämpft im Feld. Combobox- und Listbox-Semantik
          (<code>aria-multiselectable</code>) mit voller Tastatursteuerung (↑/↓,
          Home/End, Enter toggelt, Esc schliesst). <code>searchable</code> /{" "}
          <code>actions</code> einzeln abschaltbar für kurze feste Listen.{" "}
          <code>group</code> stellt einer Option eine nicht wählbare Kopfzeile
          voran, sobald die Gruppe wechselt — für Dimensionen, deren Werte aus
          zwei Welten stammen (in der Anwendung: die Altersstufe, siehe{" "}
          <code>lib/filter-optionen.ts</code>). Weil die Kopfzeile positional
          entsteht, müssen die Optionen gruppensortiert übergeben werden, sonst
          erscheint dieselbe Kopfzeile mehrfach. Eine einzige Gruppe ist
          ausdrücklich erlaubt und der Normalfall dort, wo eine Dimension ganz
          zu einer Welt gehört; die Beschriftung sagt dann, zu welcher. Die
          Kopfzeile ist nicht nur optisch: Jede Option verweist per{" "}
          <code>aria-describedby</code> auf sie, damit die Zugehörigkeit auch
          vorgelesen wird («Wert, Gruppe») — sonst hörte man eine lange Liste
          ohne jede Gliederung.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Der Baustein trägt beide Mehrfachauswahlen des Übungsformulars —{" "}
          <strong>Alterskategorie</strong> und{" "}
          <strong>Erscheinungsform</strong> — und nicht mehr nur die
          Filterzeilen. Im Formular unterscheiden sich die beiden in der
          Ausstattung: Die Alterskategorie schaltet <code>searchable</code> und{" "}
          <code>actions</code> ab (drei bis vier kurze Werte liest man
          schneller, als man sie filtert), die Erscheinungsform behält beides
          (der Junioren-Katalog führt elf Werte, und jeder ist ein ganzer Satz).
          Der <code>placeholder</code> sagt den Leerfall einer Eingabe
          («Alterskategorie wählen …»): Im Formular heisst nichts gewählt{" "}
          <em>nichts</em>.
        </p>
        <MultiSelectDemo />

        <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
          <code>WochentagWahl</code> — sieben feste Werte, sichtbar
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Für die sieben festen Wochentage einer Terminserie; alle Werte stehen
          sichtbar nebeneinander. Neu ist der Baustein, weil die
          Mehrfachauswahl ein Panel öffnet — bei sieben kurzen Werten, die man
          auf einen Blick vergleichen will, wäre das ein Klick zu viel. Jeder
          Wert ist ein <code>FilterChip</code> (Ein/Aus, <code>aria-pressed</code>,
          gewählt getönt); das Kürzel steht sichtbar, der volle
          Wochentag für Screenreader. Montag zuerst, die Wahl bleibt sortiert.
          Ein Fehler steht unter den Chips.
        </p>
        <WochentagWahlDemo />
      </Section>

      <Section n="18" title="Dialog &amp; Snackbar">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Der <strong>Dialog</strong> steht auf nativem{" "}
          <code>&lt;dialog&gt;</code> (Fokus-Falle, Escape, Scrim) und trägt die
          oberste Stufe: <code>bg-elev-24</code>,{" "}
          <code>rounded-dialog</code> — der einzige Ort mit 6 px —,{" "}
          <code>shadow-dp-24</code> und ein Scrim bei 60 %. Die{" "}
          <strong>Snackbar</strong> ist die eine <strong>umgekehrte</strong>{" "}
          Fläche der Anwendung (<code>umkehr</code>): Weiss zu{" "}
          {Math.round(UMKEHR.deckung * 100)} % über dem Grund, darauf der Grund
          als Schrift ({v(kontrast(UMKEHR.schrift, UMKEHR.flaeche))}) und das
          dunkle Violett als Aktion ({v(kontrast(UMKEHR.akzent, UMKEHR.flaeche))}).
          Sie meldet am Bildrand und geht von selbst, also muss sie beim ersten
          Hinsehen auffallen. Auf <code>elev-06</code> hob sie sich nur{" "}
          {v(kontrast(elev(6), elev(0)))} vom Grund ab und blieb unbemerkt; hell
          steht sie bei {v(kontrast(UMKEHR.flaeche, elev(0)))}. So meint Material
          sie auch. Innerhalb der Fläche gelten die Rollen umgekehrt — Primary
          ist dort das dunkle Violett —, damit Textknopf, Zustands-Ebene und
          Fokus-Ring ohne Sonderklassen tragen. Beim Erscheinen fährt sie kurz
          von unten ein; bei reduzierter Bewegung blendet sie nur ein.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Bewusste Abweichung:</strong> Die Textknöpfe im Dialog bleiben
          Primary und kommen auf 24dp damit auf{" "}
          {v(kontrast(PRIMARY, elev(24)))} — knapp unter 4.5:1. Materials
          eigene Baseline tut dasselbe, und die Alternative wäre schlechter:
          Weisse Knopfschrift wäre von der Fliesstextzeile darüber nicht mehr zu
          unterscheiden. Die Knöpfe sind gross gesetzt, stehen abgesetzt am Fuss
          und tragen den Ring; wer sie nicht als Knöpfe liest, verliert nichts,
          denn der Dialog nennt seine Handlung auch im Text.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Die Snackbar meldet einen <strong>Vorgang</strong>, der Banner (22)
          einen <strong>Zustand</strong>. Darum hat sie genau einen Platz: unten
          in der Mitte, für die ganze Anwendung. Niemand rendert sie selbst —
          gemeldet wird über <code>useSnackbar()</code>, und der Platz im
          App-Rahmen zeigt immer nur <strong>eine</strong>. Weitere warten;
          ihre Zeit läuft erst, wenn sie erscheinen. Jeder Aufruf des Hooks ist
          eine eigene Stelle: Meldet sie erneut, ersetzt die neue Meldung ihre
          ältere, und ein Text, der schon ansteht, kommt nicht zweimal in die
          Reihe. Nach 6 s geht sie von
          selbst, solange nicht der Zeiger auf ihr liegt oder der Fokus in ihr
          steht; das X schliesst sie sofort und gibt den Fokus dorthin zurück,
          woher er kam.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Sie ist <strong>tonlos</strong>: Ob etwas gescheitert ist, sagt der
          Text, nicht die Farbe. Die Vorlesehilfe liest sie eingereiht vor, auch
          einen Fehler, und nur den Text, nicht die Knöpfe — unterbrechen darf
          nur ein Banner. Sie gehört zur
          Ansicht, in der sie entstand, und fällt beim Wechsel weg; wer eine
          Bestätigung für die Zielansicht braucht, schickt sie über die Adresse
          mit (<code>Flash</code>). Höchstens eine Aktion — Rückgängig, Erneut
          versuchen —, nie ein blosses «OK». Und sie liegt unter jedem Dialog:
          Scheitert ein Vorgang und bleibt der Dialog offen, steht der Grund als
          Banner im Dialog.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Ein <strong>Link zum Kopieren</strong> (Kalender-Abo,{" "}
          <code>AboDialog</code>) ist kein neuer Baustein, sondern eine
          Zeile aus dem Kit: ein <code>TextField</code> mit{" "}
          <code>readOnly</code> und ein tonaler <code>Button</code> daneben.
          Das Feld wählt beim Fokus alles aus, damit sich der Link auch von
          Hand kopieren lässt. Das Ergebnis des Knopfes erscheint{" "}
          <strong>im Dialog</strong>, nicht in der Snackbar — die liegt unter
          ihm: Gelingt es, zeigt der Knopf kurz «Kopiert» (mit Häkchen, dazu
          eine Live-Region für die Vorlesehilfe); scheitert es, steht ein
          Fehler-Banner im Dialog, und das Feld ist markiert. Ist der Link ein
          Geheimnis, geht die Warnung
          als Banner im Dialog voran.
        </p>
        <OverlaysDemo />
      </Section>

      <Section n="19" title="Breadcrumbs">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Sekundäre Pfad-Navigation, datengetrieben (<code>items</code>); das
          letzte Item ohne <code>href</code> ist die aktuelle Seite
          (<code>aria-current</code>) und trägt das Gewicht
          (<code>type-title-small</code>), die übrigen stehen in gedämpfter
          Schrift und tragen die Zustands-Ebene. Separator standardmässig{" "}
          <code>ChevronRight</code>, per <code>separator</code> ersetzbar. Lange
          Pfade kollabieren ab <code>maxItems</code> zu einem aufklappbaren
          „…"-Knopf.
        </p>
        <BreadcrumbsDemo />
      </Section>

      <Section n="20" title="Feld-Diagramm">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Spielfeld-Diagramme (Epic #47) werden als SVG aus der gespeicherten
          Struktur und dem zentralen Symbol-Register gerendert —{" "}
          <code>DiagrammView</code> ist die eine Anzeige-Komponente für Karte,
          Detailseite, Trainings, Druck und mobil; <code>UebungsBild</code>{" "}
          schaltet zwischen Diagramm, Foto und Platzhalter. Gezeichnet wird in
          der Maske der Übung: Die Zeichenfläche (<code>DiagrammZeichnen</code>)
          sitzt ohne Autosave als <code>DiagrammFeld</code> unter der
          Zuordnung, beim Erfassen wie beim Bearbeiten. Dort wacht{" "}
          <code>VerlassenWarnung</code> über ungesicherte Angaben — ein
          Bestätigungs-Dialog aus dem Kit für Links (auch die der Seitenleiste) und
          Browser-Zurück, die Abfrage des Browsers für Neuladen und Schliessen.
          Symbol-Geometrie ist im Register verankert (Anker = Mittelpunkt),
          damit zentrale Symbol-Updates bestehende Diagramme nie verschieben.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Das Diagramm ist Gegenstand, nicht Oberfläche</strong> — es
          folgt weiterhin nicht der Palette der Anwendung. Es hat aber eine
          <strong> eigene</strong>, und die kennt mehr als einen Satz: dieselbe gespeicherte Zeichnung erscheint am Bildschirm auf
          einem Nachtrasen und kommt auf Papier weiss aus dem Drucker. Die
          Rollen heissen <code>--diagramm-*</code> und stehen bewusst neben dem{" "}
          <code>@theme</code>-Block, ohne <code>--color-</code>-Präfix: Tailwind
          macht aus jeder Farbrolle des Themes eine Utility, und{" "}
          <code>bg-rasen</code> auf einem Knopf wäre genau die Vermischung, die
          dieser Absatz seit je verhindert. Auf die Tokens der Anwendung gelegt
          ist nur das Drumherum des Editors: die Leisten (
          <code>bg-elev-08</code>, <code>shadow-dp-08</code>) und die aktive
          Werkzeug-Kachel (<code>border-primary</code>). Einen Rahmen um die
          Zeichenfläche gibt es dort nicht mehr — das Feld zeichnet seine Kante
          selbst (<code>--diagramm-feldkante</code>), und ein zweiter Strich
          davor legte nur eine Linie auf die andere.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Zwei Sätze, ein Bestand: Gespeichert wird nur der Farb-Slug, was er
          zeigt, entscheidet das Medium. Am Bildschirm liegt der Rasen
          tief im entsättigten Grün des App-Grunds, die Bewegungspfeile werden
          hell und die Elementfarben sind angehoben — die Manual-Palette kam auf dem dunklen
          Grund bei Rot auf 2.6:1 und bei Blau auf 2.2:1, zwei Mannschaften, die
          sich nicht mehr unterscheiden liessen. Auf Papier kehrt sich fast
          alles um: weisse Fläche mit 6-%-Raster, schwarze Pfeile wie in der
          Zeichenerklärung des Manuals, und alles, was am Bildschirm hell
          gezeichnet ist, kippt ins Graue, weil Weiss auf Papier nicht
          existiert. Einzige Ausnahme ist der Ball — er bleibt weiss und bekommt
          eine kräftigere Kontur, sonst wäre er ein grauer Fleck unter lauter
          grauen Flecken. Die Werte stehen in <code>app/globals.css</code>, die
          Rollennamen in <code>lib/diagramm-farben.ts</code>;{" "}
          <code>npm run check:diagramm-farben</code> rechnet beide Sätze nach
          (3:1 nach WCAG 1.4.11 — auf dem Rasen steht kein Text) und verbietet
          im Zeichencode jeden rohen Farbwert.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
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
              className="flex flex-col items-center gap-1 rounded-flaeche border border-linie p-1"
            >
              <GlyphVorschau element={el} groesse={56} />
              <span className="type-label-small text-on-surface-mittel">
                {el.art === "symbol" && el.typ !== "spieler"
                  ? el.typ
                  : el.art === "symbol"
                    ? el.pose
                    : ""}
              </span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
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
              className="flex flex-col items-center gap-1 rounded-flaeche border border-linie p-1"
            >
              <GlyphVorschau
                element={{ id: `mt-${rot}`, art: "symbol", typ: "minitor", x: 0, y: 0, rotation: rot }}
                groesse={56}
                rand={0.3}
              />
              <span className="type-label-small text-on-surface-mittel">{rot}°</span>
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Element-Optionen (Drehen, Farbe, Linienstil, Kopieren, Entfernen)
          erscheinen auf der Zeichenfläche als kontextuelle Bedienleiste, die am
          ausgewählten Element schwebt — ein bewusst neues Muster (#65): Das
          Kit kennt nur an DOM-Trigger verankerte Overlays (<code>Menu</code>,{" "}
          <code>Select</code>), aber kein Panel an einer Position innerhalb
          einer Canvas. Die Leiste liegt als absolutes Overlay über der Fläche
          (08dp, <code>shadow-dp-08</code>), nicht im Dokumentfluss — so
          verschiebt das Ein- und Ausblenden die Fläche nie. Sie weicht
          oberhalb/unterhalb des Elements aus, tritt während eines Drags zurück
          und verschwindet beim Abwählen. Textboxen werden per Doppelklick
          direkt am Element bearbeitet.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Mehrere Elemente werden per <strong>Auswahlrahmen</strong> (Aufziehen
          auf der freien Fläche, erfasst vollständig umschlossene Elemente) oder
          additivem <strong>Umschalt-/Cmd-Klick</strong> ausgewählt (#67). Bei
          mehr als einem Element tritt an die Stelle der Eigenschaften-Leiste
          eine schlanke <strong>Mehrfach-Leiste</strong> (Anzahl, Kopieren,
          Löschen), verankert an der gemeinsamen Box; verschoben wird die Gruppe
          per Drag. Das Ziehen meldet die Zeichnung selbst — ein gezogenes
          Element ist SVG und hat kein <code>::after</code>, auf das sich eine
          Zustands-Ebene legen liesse. Darum kennt das Kit drei Zustände und
          nicht Materials vier (siehe 04).
        </p>
        <div className="relative aspect-[16/10] max-w-xl overflow-hidden rounded-flaeche border border-linie">
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
        <p className="type-body-medium mb-4 mt-8 max-w-2xl text-on-surface-mittel">
          Die Werkzeug-Palette des Editors zeigt jedes Element als{" "}
          <code>GlyphVorschau</code> — dieselbe <code>ElementGrafik</code> wie
          auf dem Feld, in eine Kachel auf dem Feldgrün eingepasst (WYSIWYG;
          weisse Glyphen brauchen den grünen Grund). Die Kacheln sind
          gruppenweise aneinandergereiht, der Name kommt nur über Tooltip und{" "}
          <code>aria-label</code> (kein sichtbarer Text). Wiederverwendbar auch
          für die Diagramm-Bibliothek.
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
              className="flex size-9 items-center justify-center overflow-hidden rounded-flaeche border border-linie"
            >
              <GlyphVorschau element={el} groesse={28} />
            </div>
          ))}
        </div>
        <p className="type-body-medium mb-4 mt-8 max-w-2xl text-on-surface-mittel">
          Das <strong>Überziehleibchen</strong> ist ein färbbares, drehbares
          Symbol: ein zusammengelegtes Tuch mit gerader Oberkante und Wellensaum.
          In den Manual-Vorlagen wird es in der Hand gehalten („Trikottausch",
          „Spiel mit dem Feuer") — es lässt sich aber ebenso am Boden oder als
          Stapel platzieren. Die unruhige Silhouette grenzt es bewusst vom{" "}
          <strong>Markierungsteller</strong> ab (Ellipse mit Loch), der in dieser
          Grösse sonst kaum zu unterscheiden wäre:
        </p>
        <div className="relative aspect-[16/10] max-w-xl overflow-hidden rounded-flaeche border border-linie">
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
        <p className="type-body-medium mb-4 mt-8 max-w-2xl text-on-surface-mittel">
          Gezeichnet wird in der Maske der Übung, beim Erfassen wie beim
          Bearbeiten, in der Bibliothek wie im Training: <code>DiagrammFeld</code>{" "}
          zeigt im Abschnitt «Feld-Diagramm» die Zeichenfläche{" "}
          (<code>DiagrammZeichnen</code>), und die Zeichnung geht mit dem
          Speichern der Übung mit. Eine eigene Editor-Seite gibt es nicht. Unter{" "}
          <code>sm</code> steht an ihrer Stelle die bisherige Zeichnung mit dem
          Hinweis, dass Zeichnen mehr Platz braucht.
        </p>
      </Section>

      <Section n="21" title="Disclosure">
        <p className="type-body-medium max-w-2xl text-on-surface-mittel">
          Ein Abschnitt, der zugeklappt beginnt. Gedacht für lange Listen, die
          vollständig erreichbar bleiben sollen, ohne die Seite zu beherrschen —
          im Team-Trainingsplan liegt der Rückblick darin, der über die Jahre auf
          mehrere hundert Einheiten anwächst. Die Anzahl steht am Kopf, damit man
          weiss, was einen erwartet, bevor man öffnet.
        </p>
        <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">
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
                <Card key={d} className="type-body-medium p-3 text-on-surface-mittel">
                  {d}
                </Card>
              ))}
            </div>
          </Disclosure>
          <Disclosure title="Von Beginn an offen" count={1} defaultOpen>
            <Card className="type-body-medium p-3 text-on-surface-mittel">
              Mit <code>defaultOpen</code>, wenn der Abschnitt das Einzige ist,
              was die Seite noch zu zeigen hat.
            </Card>
          </Disclosure>
        </div>
      </Section>

      <Section n="22" title="Leerzustand, Hinweiszeile &amp; Banner">
        <p className="type-body-medium max-w-2xl text-on-surface-mittel">
          Ein leerer Abschnitt sagt zuerst nur, dass er leer ist —{" "}
          <code>type-body-small</code>, <code>text-on-surface-mittel</code>, kein
          Zeichen. Hat die Anwendung fachlich etwas dazu zu sagen (im
          Trainings-Editor: dieser Block gehört ins Training), tritt die
          Hinweiszeile an die Stelle dieser neutralen Zeile —{" "}
          <strong>nie beides</strong>. Dieselbe Sachlage erscheint nur einmal und
          nur in einem Schriftschnitt.
        </p>
        <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">
          Die Hinweiszeile trägt darum denselben Schnitt wie der Leerzustand und
          ordnet sich der Struktur unter: schwächer als Titel und Inhaltszeilen.
          Das Merkmal ist das <code>Info</code>-Zeichen (15 px,{" "}
          <code>text-primary</code>, <code>aria-hidden</code>) — es bleibt ohne
          Farbwahrnehmung erkennbar. Der Text nennt den Grund, die Position den
          betroffenen Abschnitt; er blockiert nichts. Zählende Meldungen einer
          ganzen Karte (<em>„Ungewöhnlich viele Übungen …"</em>) bleiben davon
          unberührt und stehen weiter als <code>type-label-medium</code> am
          Kartenfuss.
        </p>
        <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">
          <strong>Fläche für Blöcke einer dichten Karte:</strong> Trägt eine Karte
          mehrere gleichrangige Blöcke — die Unterkategorien des
          Kinderfussball-Hauptteils, die Blöcke des Junioren-Einstiegs —, steht
          jeder auf einer eigenen Fläche: <code>bg-elev-02</code>,{" "}
          <code>rounded-flaeche</code>, <code>p-3</code>. Also eine Stufe die
          Leiter hoch gegenüber der Karte, während die Inhaltszeilen darin auf{" "}
          <code>bg-elev-01</code> bleiben und sich dadurch als Inhalt{" "}
          <em>im</em> Block lesen. <strong>Nicht dieselbe Stufe wie die
          Karte:</strong> Bei gleicher Fläche verschwimmen Block und Karte, und
          ein leerer Block — beim Planen die wichtigste Auskunft — wäre bloss
          eine Zeile Text im Nichts. Ein Teil mit nur einem Block bekommt{" "}
          <em>keine</em> Fläche: Sie wiederholte dort bloss die Karte.
        </p>
        <div className="mt-6 max-w-xl">
          <Card className="p-4">
            <h2 className="type-title-medium text-on-surface">Hauptteil</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="rounded-flaeche bg-elev-02 p-3">
                <h3 className="type-title-small text-on-surface">
                  Vielseitigkeit erleben
                </h3>
                <p className="mt-2 type-body-small text-on-surface-mittel">
                  Noch keine Übung zugeordnet.
                </p>
              </div>
              <div className="rounded-flaeche bg-elev-02 p-3">
                <h3 className="type-title-small text-on-surface">Fussball spielen</h3>
                <p className="mt-2 flex items-start gap-2 type-body-small text-on-surface-mittel">
                  <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                  Das freie Spiel ist noch leer — im Kinderfussball gehört es in
                  jedes Training.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <h3 className="mb-2 mt-10 type-title-medium text-on-surface">
          Seiten-Leerfeld (<code>Leerzustand</code>)
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Ist nicht ein Block leer, sondern eine ganze <strong>Liste</strong> —
          der Katalog ohne Treffer, die Team-Übersicht vor dem ersten Team —,
          dann steht an ihrer Stelle ein Feld mit <strong>gestrichelter</strong>{" "}
          Kontur, Zeichen, Titel und einem Satz zum Weiterkommen. Die
          gestrichelte Linie ist die ganze Aussage: Eine durchgezogene Kontur
          umreisst etwas, das da ist; die gestrichelte sagt, dass hier etwas
          hingehört und noch fehlt. Die Fläche bleibt der Grund — ein eigener
          Ton machte aus dem Fehlenden eine Karte.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Abgrenzung zur Block-Leerzeile oben:</strong> Die steht{" "}
          <em>innerhalb</em> eines Blocks, ist blosser Text und bekommt weder
          Rahmen noch Zeichen — ein Rahmen im Rahmen zöge einen zweiten Strich
          um etwas, das der Block schon abgrenzt. Das Leerfeld hier füllt
          umgekehrt eine ganze Seite oder einen ganzen Abschnitt.{" "}
          <code>dicht</code> nimmt die Polsterung zurück, wo es unter einer
          Überschrift im Abschnitt steht statt allein auf der Seite; das Zeichen
          entfällt dort meist mit.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Leerzustand
            icon={SearchX}
            titel="Keine Übung gefunden"
            aktion={<Button variant="text">Filter zurücksetzen</Button>}
          >
            Keine Übung erfüllt alle gesetzten Filter. Entferne einzelne Filter
            oder setze sie zurück.
          </Leerzustand>
          <Leerzustand icon={CalendarPlus} titel="Noch keine Termine" dicht>
            Lege die Trainingszeiten des Teams als Termine fest. Welches
            Training dort stattfindet, ordnest du danach zu.
          </Leerzustand>
        </div>

        <h3 className="mb-2 mt-10 type-title-medium text-on-surface">
          Banner (<code>Banner</code>)
        </h3>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Die dritte Sorte Zeile, nach Material 2: keine Auskunft über den
          Bestand, sondern eine <strong>Nachricht an den Nutzer</strong> — das
          Speichern ist gescheitert, die Mail ist unterwegs, das Feld-Diagramm
          zeigt anderes Material. Ohne Knöpfe meldet der Banner bloss; mit ein
          oder zwei Knöpfen verlangt er eine Antwort und bleibt stehen, bis eine
          gewählt ist. <strong>Ein</strong> Baustein für beides — die frühere
          umrandete Meldung ist in ihm aufgegangen, damit dieselbe Sache nicht in
          zwei Sprachen erscheint.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Keine Box:</strong> ein 5-%-Overlay (<code>on-surface/5</code>)
          und darunter eine Haarlinie (<code>linie</code>). Das Overlay statt
          einer festen Stufe hebt den Banner immer eine Stufe über das, worauf
          er liegt — auf dem Grund genau <code>elev-01</code>, im Dialog über
          dessen 24dp statt als dunkles Loch darin. Text{" "}
          <code>type-body-medium</code> in <code>on-surface</code>: Primary
          gehört den Handlungen, und ein Fehler bleibt als Schrift auf jeder
          Fläche lesbar.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Den <strong>Ton trägt das Zeichen</strong> — zwei Töne, nicht mehr:{" "}
          <code>fehler</code> (<code>CircleAlert</code> in Error) meldet, dass
          etwas nicht ging, <code>hinweis</code> (<code>Info</code> in Primary,
          Vorgabe) alles andere. Das Zeichen lässt sich überschreiben, die
          Farbe bleibt die des Tons. Es steht links in Materials 40-px-Spalte,
          aber <strong>ohne</strong> den gefüllten Kreis: füllen darf nur der
          auslösende Knopf (siehe 01). Die Knöpfe (<code>text</code>,{" "}
          <code>sm</code>) stehen rechtsbündig,{" "}
          <strong>abweisend links, bestätigend rechts</strong>; reicht die
          Breite, stehen Text und Knöpfe in einer Zeile, sonst brechen die
          Knöpfe darunter. Die Vorlesehilfe erfährt den Ton über{" "}
          <code>role</code>: ein Fehler ohne Knöpfe unterbricht (
          <code>alert</code>), alles andere reiht sich ein (<code>status</code>
          ).
        </p>
        <div className="grid max-w-2xl gap-6">
          <Banner tone="fehler">
            Das Training konnte nicht gespeichert werden. Bitte versuche es noch
            einmal.
          </Banner>
          <Banner icon={MailCheck}>
            Bestätigungsmail erneut an <strong>trainerin@example.ch</strong>{" "}
            gesendet.
          </Banner>
          <Banner
            icon={RefreshCw}
            actions={
              <>
                <Button type="button" variant="text">
                  Material beibehalten
                </Button>
                <Button type="button" variant="text">
                  Neuen Vorschlag übernehmen
                </Button>
              </>
            }
          >
            Das Feld-Diagramm zeigt inzwischen anderes Material: Hürden: 0 → 1.
          </Banner>
          <Banner
            icon={ListPlus}
            actions={
              <Button type="button" variant="text">
                Vorschlag übernehmen
              </Button>
            }
          >
            Das Feld-Diagramm zeigt: 2 Minitore.
          </Banner>
        </div>
      </Section>

      <Section n="23" title="Chip mit Menü">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Ein Chip, der ein Menü öffnet — für Werte, die man an ihrem Ort
          umsortieren oder herausnehmen können muss.{" "}
          <strong>Warum die bestehenden Chips nicht reichen:</strong> Der{" "}
          <code>InputChip</code> kennt nur ein Entfernen-X — 16 px, kein
          Touch-Ziel — und kann „nach vorne schieben" gar nicht ausdrücken; der{" "}
          <code>AssistChip</code> löst genau eine Aktion aus, nicht mehrere zur
          Wahl. Beide tragen ausserdem <code>type-label-medium</code>, also
          mono und versal: ein Gruppenname stünde dort verfälscht (siehe Regel
          in 02). Der Chip mit Menü trägt darum{" "}
          <code>type-body-medium</code> und ist <strong>ein</strong>{" "}
          Bedienelement mit <strong>einem</strong> Tabstopp — kein Chip plus
          angehängter Knopf.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Geteilte Bauform (<code>onSelect</code>).</strong> Sobald an
          demselben Wert <strong>zwei</strong> Aufgaben hängen — „zeig mir
          diese Variante" und „benenne, verschiebe, entferne sie" —, wird der
          Chip in der Mitte geteilt: links wählen, rechts das Menü. Ein
          Menüeintrag „Anzeigen" allein reichte nicht, denn Wechseln ist die
          häufigste Handlung der Leiste und darf nicht zwei Klicks kosten. Die
          Menühälfte ist <strong>36 px</strong> breit wie jeder Icon-Knopf —
          ein eigenes Bedienelement, nicht ein angehängtes 16px-Chevron. Der Umriss gehört
          trotzdem der Gruppe: eine Reihe von Varianten, nicht eine Reihe von
          Knopfpaaren; der Trennstrich darin folgt dem Zustand.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Warum hier keine Radiogroup mehr</strong> (anders als bei der
          Variantenwahl in 24): Eine Radiogroup verlangt genau EIN fokussierbares
          Element je Wert und übernimmt die Pfeiltasten. Hier sind es zwei
          Elemente, und die Pfeiltasten gehören dem geöffneten Menü. Die Wahl
          sagt darum <code>aria-pressed</code> an der linken Hälfte; durch die
          Leiste tabbt man.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <code>tone=&quot;befund&quot;</code> färbt Kontur und Chevron in
          Error, nie die Fläche — dieselbe Regel und dieselbe Farbe wie am Feld
          (14): Der Wert ist gespeichert, er geht bloss mit anderen nicht auf.
        </p>
        <ChipMenuDemo />
      </Section>

      <Section n="24" title="Variantenwahl">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Zwischen den <strong>Varianten des Hauptteils</strong> eines Trainings
          wechseln (Epic „Hauptteil-Varianten"). Kein neuer Baustein, sondern
          eine Anwendung der <code>ChoiceChipGroup</code> aus 10 — hier steht,
          warum gerade sie:
        </p>
        <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
          <li>
            Die Werte sind <strong>Nutzertext</strong> — bis vierzig Zeichen,
            vom Trainer vergeben. Eine Reihe, die damit seitlich scrollte,
            zeigte ihm seine Varianten nicht mehr nebeneinander; Chips
            umbrechen stattdessen. Aus demselben Grund steht die gewählte
            Variante umrandet und nicht gefüllt (siehe 09).
          </li>
          <li>
            Es ist <strong>ein Element von n</strong> und keine Ansicht:
            Radiogroup-Semantik, nicht die tab-artige Leiste.
          </li>
          <li>
            Bei <strong>einer</strong> Variante rendert sie <strong>nichts</strong>.
            Ein Training ohne zweite Variante sieht aus wie vorher — eine
            Einfachauswahl mit einem einzigen Wert wäre eine Frage ohne
            Alternative. Die Schranke sitzt im Baustein, nicht bei den
            Aufrufern.
          </li>
        </ul>
        <VariantenWahlDemo />
        <div className="mt-6 rounded-flaeche bg-elev-01 p-4">
          <p className="type-label-large mb-1 text-on-surface">
            Zwei Bedienelemente, eine Zeile
          </p>
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Im Editor steht die Wahl zusammen mit „Variante hinzufügen" in einer
            eigenen Zeile unter dem Kartenkopf des Hauptteils — nicht IM Kopf:
            Dort stehen Überschrift und Dauer-Summe, und eine umbrechende
            Chip-Reihe daneben risse die Kopfzeile auseinander. Über der
            Gruppenleiste, weil die Variante die grössere Klammer ist: Sie
            entscheidet, welche Übungen darunter stehen; die Gruppen gelten für
            alle Varianten.
          </p>
        </div>

        <p className="type-body-medium mb-5 mt-8 max-w-2xl text-on-surface-mittel">
          <strong>Auf Server-Seiten: dieselbe Optik, aber Links.</strong> Ansehen
          und Drucken halten keinen Zustand — die angezeigte Variante steht im
          Suchparameter, jede Variante hat damit eine eigene{" "}
          <strong>Adresse</strong>. <code>VariantenLinks</code> rendert darum{" "}
          <code>&lt;nav&gt;</code> mit Links und <code>aria-current=&quot;page&quot;</code>,
          leiht sich aber die Nutzertext-Pille aus 10 (<code>chipTextBase</code>,{" "}
          <code>chipTextOutlined</code>, <code>chipTextSelected</code>): gleiche
          Sache, gleiches Bild. Kein wandernder Tabstopp — durch Links tabbt man,
          Pfeiltasten gehören der Radiogroup. Nicht <code>TabNav</code> (08): Die
          wechselt die <em>Sicht</em> auf einen Gegenstand; hier bleibt die Sicht
          dieselbe und der <em>Inhalt</em> wechselt. Weil Nutzertext versal
          verfälscht stünde, kennt <code>ChoiceChip</code> seit dem Chip-Umbau
          ein <code>look=&quot;nutzertext&quot;</code> mit
          denselben Bündeln: dieselbe Pille, aber normal gesetzt und h-9 hoch,
          damit sie neben dem geteilten Chip aus 23 und dem leisen Knopf aus 08
          auf einer Linie sitzt.
        </p>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          drei Varianten als Links — die offene trägt <code>aria-current</code>
        </p>
        <VariantenLinks
          varianten={[
            { id: "a", name: "Standard" },
            { id: "b", name: "21 Kinder, zwei Trainer" },
            { id: "c", name: "Halle" },
          ]}
          aktiv="a"
          hrefFuer={(v) => `#variante-${v}`}
        />
      </Section>

      <Section n="25" title="Druck">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Was auf Papier geht, kommt aus derselben Anwendung — nur legt ein
          einziger Block (<code>@media print :root</code>) die Rollen um. Die
          Höhenleiter kippt: Aus dem aufgehellten Dunkel wird ein abgedunkeltes
          Weiss, die Reihenfolge der Stufen bleibt, sodass gestapelte Karten sich
          weiter voneinander abheben. Einen Sonderfall für den Druck kennt genau{" "}
          <strong>ein</strong> Baustein: Die Kategorie-Plakette kippt von Kontur
          auf Fläche (<code>print:bg-kat-X</code>). Alle übrigen benutzen
          unverändert dieselben Tokens — auch die Schrift auf jener Fläche, denn{" "}
          <code>text-on-surface</code> ist im Druck bereits die Tinte.
        </p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {druckProben.map(([name, hex, notiz]) => (
            <div key={name} className="rounded-flaeche kontur border-kante p-3">
              <div
                className="mb-2 flex h-14 w-full items-end rounded-plakette border border-linie p-2"
                style={{ backgroundColor: hex, color: DRUCK["on-surface"] }}
              >
                <span className="type-plakette">{hex.toUpperCase()}</span>
              </div>
              <p className="type-label-small text-on-surface">{name}</p>
              <p className="type-body-small text-on-surface-mittel">{notiz}</p>
            </div>
          ))}
        </div>
        <ul className="type-body-medium flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
          <li>
            <strong>Primary wird dunkel.</strong> {PRIMARY.toUpperCase()} kommt
            auf Papier nur auf {v(kontrast(PRIMARY, DRUCK["elev-00"]))} und trüge dort
            keinen Text mehr; {DRUCK.primary.toUpperCase()} trägt{" "}
            {v(kontrast(DRUCK.primary, DRUCK["elev-00"]))}. Error macht denselben
            Schritt.
          </li>
          <li>
            <strong>Die Alterskategorien kippen in die gefüllte Form</strong>{" "}
            (<code>print:bg-kat-X</code>, dunkle Schrift, keine Kontur): Eine
            helle Kontur auf Weiss ist kaum zu sehen. Zwei Werte bekommen dafür
            eigene Druckfarben — kat-a stünde als Fläche bei{" "}
            {v(kontrast(KAT.a, DRUCK["elev-00"]))} gegen das Papier und verschwände,
            kat-f bei {v(kontrast(KAT.f, DRUCK["elev-00"]))}. Die übrigen fünf bleiben
            wie am Schirm.
          </li>
          <li>
            <strong>Schrift und Striche werden Tinte statt Deckung:</strong>{" "}
            on-surface {DRUCK["on-surface"].toUpperCase()}, mittel{" "}
            {DRUCK["on-surface-mittel"].toUpperCase()}, kante{" "}
            {DRUCK.kante.toUpperCase()}, linie {DRUCK.linie.toUpperCase()} —
            halbtransparentes Weiss hätte auf Papier keinen Sinn.
          </li>
          <li>
            <code>print-color-adjust: exact</code> bleibt gesetzt, damit
            Diagramme und Kategorien wirklich so kommen, wie sie gesetzt sind;
            App-Chrome ist über <code>print:hidden</code> ausgeblendet.
          </li>
          <li>
            <strong>Das Feld-Diagramm hat einen eigenen Druck-Satz</strong>{" "}
            (Abschnitt 20): weisse Fläche statt Rasengrün, schwarze Pfeile,
            gedämpfte Elementfarben. Der grüne Rasen deckte 1600×1000 und kam
            auf geschätzt 125 % Farbauftrag — das Blatt allein trug damit fast
            den ganzen Verbrauch; weiss mit Raster liegt bei rund 3 %.
          </li>
        </ul>
      </Section>

      <Section n="26" title="Material">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Das Material einer Übung (Epic „Material aus dem Feld-Diagramm") steht
          <strong> zweigeteilt</strong>: oben die gezählte Liste aus dem
          Diagramm-Vorrat nach Art, Farbe und Menge, darunter die freie
          Ergänzung für alles, was das Diagramm nicht kennt. Die Gliederung ist
          fachlich: nur die Liste wird in der Gesamtliste eines Trainings
          verrechnet.
        </p>
        <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
          <li>
            <strong>Erfassen</strong> — kein Repeat-Baustein im Kit, darum ein
            eigenes Feld aus bestehenden Teilen: je Zeile <code>Select</code>{" "}
            für Art und (nur bei färbbarem Material) Farbe, <code>TextField</code>{" "}
            für die Menge, <code>IconButton</code> zum Entfernen. Hinzufügen ist
            eine Randhandlung, darum <code>quiet</code> (siehe 08).
          </li>
          <li>
            <strong>Vorschlag</strong> — das Angebot des Diagramms steht als{" "}
            <code>Banner</code> über der Liste: es verlangt eine Antwort
            (übernehmen, bei einer Änderung auch beibehalten), siehe 22.
          </li>
          <li>
            <strong>Lesen</strong> — <code>MaterialListe</code>: ein Posten pro
            Zeile, die Ergänzung als «Weiteres» abgesetzt. Präsentational, auf
            Übungsseite, im Training und im Druck derselbe.
          </li>
        </ul>
        <MaterialDemo />
        <div className="mt-8 max-w-md">
          <p className="type-label-small mb-2 text-on-surface-mittel">MaterialListe</p>
          <div className="type-body-medium text-on-surface">
            <MaterialListe
              liste={[
                { art: "minitor", farbe: null, menge: 2 },
                { art: "pylone", farbe: "orange", menge: 4 },
                { art: "leibchen", farbe: "rot", menge: 6 },
                { art: "leibchen", farbe: "blau", menge: 6 },
              ]}
              ergaenzung={["Pfeife", "Stoppuhr"]}
            />
          </div>
        </div>
      </Section>

      <Section n="27" title="Monatsraster">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Ein Monat als Raster Montag bis Sonntag; der Inhalt eines Tages kommt
          vom Aufrufer. Neu ist der Baustein, weil keiner der bestehenden ein
          Kalenderraster kennt: Liste, Karte und Tabs zeigen Dinge nacheinander,
          nicht nach Datum verteilt. <code>Monatsraster</code> kennt nur den
          Kalender — Wochen, Randtage der Nachbarmonate (gedämpft), den heutigen
          Tag (Kontur in Primary) und auf Wunsch die leere Woche
          (gestrichelte Kontur wie beim <code>Leerzustand</code>, dazu als Text
          für Screenreader). Was ein Tag zeigt, bestimmt <code>renderTag</code>.
        </p>
        <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
          <li>
            <strong>Tabelle statt Gitter</strong> — <code>role=&quot;table&quot;</code>{" "}
            mit Zeilen, Spaltenköpfen und Zellen. Ein <code>grid</code> verspräche
            Pfeiltasten-Navigation, die es nicht gibt; die Knöpfe in den Tagen
            liegen in der normalen Tab-Reihenfolge. Jeder Tag trägt sein
            ausgeschriebenes Datum für Screenreader, «heute» als{" "}
            <code>aria-current</code>.
          </li>
          <li>
            <strong>Schmal</strong> — das Raster scrollt waagrecht im eigenen
            Behälter, nie die Seite.
          </li>
          <li>
            <strong>Randtage</strong> — liegen auf dem Grund (<code>elev-00</code>)
            statt auf der Tagesfläche (<code>elev-01</code>), die Tageszahl ist
            leiser. Nicht über <code>opacity</code> gedämpft: Das risse die
            Schrift der Einträge unter 4.5:1.
          </li>
          <li>
            <strong>Termineintrag</strong> (<code>TerminEintrag</code>) — Beginn
            oder «Zeit fehlt», dazu der Zustand als Wort, nie nur als Farbe:
            Training (Name auf <code>elev-08</code>), «Noch kein Training»
            (Fehlerkontur, nur anstehend), «Ohne Training» (leise, vergangen),
            «Ausgefallen» (durchgestrichen). Gerechnet: Fehler-Schrift{" "}
            {v(kontrast(ERROR, elev(1)))} auf der Tagesfläche und{" "}
            {v(kontrast(ERROR, GRUND))} in der Randwoche; leise Schrift{" "}
            {v(kontrast(weissAuf(SCHRIFT.mittel, elev(1)), elev(1)))} bzw.{" "}
            {v(kontrast(weissAuf(SCHRIFT.mittel, GRUND), GRUND))}. «Ausgefallen»
            trägt bewusst die leise und nicht die tiefe Schrift (
            {v(kontrast(weissAuf(SCHRIFT.tief, elev(1)), elev(1)))}): Es ist
            wesentlicher Inhalt, nicht Deaktiviertes.
          </li>
        </ul>
        <MonatsrasterDemo />
        <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
          <code>AnsichtWahl</code> — Liste oder Monat als Links
        </p>
        <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
          Zwei Links statt einer <code>ChoiceChipGroup</code>: Die Ansicht lebt
          in der Adresse (<code>?ansicht=monat</code>), ist damit weitergebbar
          und der Zurück-Schritt des Browsers geht — und die Eingrenzung
          «Meine Termine» reist in derselben Adresse mit (#329 PC 4). Ein Chip
          hielte die Wahl im Zustand und verlöre beides. Die Optik ist die des
          Knopfes: <code>tonal</code> für die offene, <code>text</code> für die
          andere Ansicht, <code>aria-current</code> trägt die Wahl auch ohne
          Fläche. Der Filter daneben bleibt ein <code>FilterChip</code>, weil er
          ein Ein/Aus ist und keine Ansicht.
        </p>
        <AnsichtWahl ansicht="monat" hrefListe="#" hrefMonat="#" />
      </Section>

      <Section n="28" title="Eigenschaften">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Bezeichnung und Wert paarweise — die Einordnung einer Übung in der
          Spalte rechts (Epic #350), angelehnt an das Details-Panel von Jira.
          Neu, weil kein Baustein Bezeichnung und Wert zusammen führt:{" "}
          <code>FormAbschnitt</code> gliedert Formulare, die Eckdatenzeile der
          Karte reiht Werte ohne Bezeichnung.
        </p>
        <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
          <li>
            <strong>Beschreibungsliste</strong> — <code>dl</code> mit{" "}
            <code>dt</code>/<code>dd</code>. Die Bezeichnung steht in fester
            Spalte (8.5 rem), der Wert bricht in seiner um. Ein Wert darf ein
            Baustein sein: Plakette, Chips, <code>MaterialListe</code>.
          </li>
          <li>
            <strong>Gedämpfte Lesetype statt Versalien</strong> — gesperrte
            Versalien bräuchten für «Hauptteilkategorie» mehr Breite, als neben
            dem Wert bleibt.
          </li>
          <li>
            <strong>Über beide Spalten</strong> — <code>EigenschaftBreit</code>{" "}
            für das, was zu einer Zeile gehört, aber keine sichtbare
            Bezeichnung braucht (der Material-Hinweis). Die Bezeichnung bleibt
            für Vorlesehilfen.
          </li>
          <li>
            <strong>Nicht erfasst</strong> — <code>EigenschaftFehlt</code>{" "}
            zeigt eine vorgesehene, aber leere Angabe (nur der Eigentümerin,
            #352): der Wert gedämpft wie die Bezeichnung, damit er sich vom
            Erfassten abhebt, ohne nach einem Fehler auszusehen. Nie auf Papier.
          </li>
          <li>
            <strong>Fläche</strong> — eine <code>Card</code>; auf Papier stehen
            Bezeichnung und Wert untereinander, weil die Spalte dort schmaler
            ist.
          </li>
        </ul>
        <div className="max-w-[22rem]">
          <Eigenschaften titel="Einordnung">
            <Eigenschaft label="Altersstufe">Kinderfussball</Eigenschaft>
            <Eigenschaft label="Alterskategorien">
              <span className="flex flex-wrap gap-1.5">
                <KategorieChip k="F" />
                <KategorieChip k="E" />
              </span>
            </Eigenschaft>
            <Eigenschaft label="Trainingsteil">Hauptteil</Eigenschaft>
            <Eigenschaft label="Hauptteilkategorie">Fussball spielen lernen</Eigenschaft>
            <EigenschaftFehlt label="Erscheinungsform" />
            <Eigenschaft label="Anzahl Spieler:innen">9–11</Eigenschaft>
            <Eigenschaft label="Material">
              <MaterialListe
                liste={[
                  { art: "minitor", farbe: null, menge: 2 },
                  { art: "pylone", farbe: "orange", menge: 4 },
                ]}
                ergaenzung={["Pfeife"]}
              />
            </Eigenschaft>
          </Eigenschaften>
        </div>
      </Section>

      <Section n="29" title="Filterknopf">
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          <strong>Ein Filter ist ein Knopf mit seinem Namen</strong> (Epic
          #363, nach dem Vorbild der Filter in Jira). Er nennt, <em>wonach</em>{" "}
          gefiltert wird, und zählt, wie viele Werte gewählt sind;{" "}
          <em>welche</em>, sieht man im geöffneten Panel. So bleibt eine
          Filterleiste eine Zeile aus Wörtern — auf dem Handy umbrechend, aber
          nie ein Stapel aus Feldern mit abgeschnittenen Wertlisten. Neu ist
          der Baustein, weil die Mehrfachauswahl (17) ein Formularfeld ist: Sie
          zeigt ihre Werte, weil sie dort die Eingabe <em>sind</em>; im Filter
          sind sie nur ein Zustand der Übersicht.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Grenzt er ein, steht er getönt (Knopf-Variante <code>aktiv</code>,
          dasselbe Kleid wie ein gewählter Chip) und trägt die Zahl als
          Plakette — vorgelesen wird «Alterskategorie, 2 gewählt». Das Panel
          ist breiter als der Knopf, wo der Inhalt es braucht (bis 34 rem; der
          längste Übungstyp misst 484 px), und rückt am rechten Rand nach links
          (<code>usePanelAnker</code>, geteilt mit der Mehrfachauswahl). Es ist
          kein Menü und keine Listbox, sondern eine Gruppe gewöhnlicher
          Bedienelemente: Kontrollkästchen im <code>AuswahlFilter</code>, ein
          Zahlenfeld bei «Verfügbare Kinder». ↑/↓ wandern zwischen ihnen, Esc
          schliesst und gibt den Fokus an den Knopf zurück. Eine Wahl wirkt
          sofort, das Panel bleibt offen; Zahl und Suche wirken nach einer
          Tipppause.
        </p>
        <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
          Die Suche steht in der Leiste ohne sichtbaren Namen, dafür umrandet
          und mit Platzhalter (14) — ohne Kante stünde neben den umrandeten
          Knöpfen ein Feld, das man nicht sieht. Schalter wie «Meine Übungen»
          bleiben <code>FilterChip</code> (9): Sie haben kein Panel, nur an
          und aus.
        </p>
        <FilterKnopfDemo />
      </Section>
    </Seitenrahmen>
  );
}
