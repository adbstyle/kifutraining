import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ReleaseText } from "@/components/versionen/ReleaseText";
import {
  Button,
  ButtonLink,
  Badge,
  Lozenge,
  SecondaryLozenge,
  ZeichenZahl,
  HerkunftLozenge,
  SichtbarkeitLozenge,
  TreffpunktListe,
  Card,
  ExerciseCard,
  FormAbschnitt,
  Feldgruppe,
  ExternerLink,
  PrintButton,
  IconButton,
  IconButtonLink,
  ZeichenPunkt,
  Kalenderblatt,
  KategorieLozenge,
  TabNav,
  Tooltip,
  TextField,
  HeadlineField,
  SearchField,
  PasswordField,
  TextArea,
  DateField,
  HinzufuegenFeld,
  TimeField,
  Select,
  MethodischerFahrplan,
  Freitext,
  KuerzbarerText,
  MaterialListe,
  Eigenschaften,
  Eigenschaft,
  EigenschaftFehlt,
  EigenschaftBreit,
  Disclosure,
  Leerzustand,
  SectionMessage,
  Verzeichnis,
  VerzeichnisFlaeche,
  type VerzeichnisBereich,
  KopierFeld,
  Tabelle,
  TabellenZeile,
  Gefahrenzone,
} from "@/components/ui";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { uebungEckdaten } from "@/lib/eckdaten";
import { ChipsDemo } from "./ChipsDemo";
import { ChoiceChipDemo } from "./ChoiceChipDemo";
import { AuswahlListeDemo } from "./AuswahlListeDemo";
import { MenuDemo } from "./MenuDemo";
import { MultiSelectDemo } from "./MultiSelectDemo";
import { FilterKnopfDemo } from "./FilterKnopfDemo";
import { OeffnenZeileDemo } from "./OeffnenZeileDemo";
import { EigenschaftBearbeitbarDemo } from "./EigenschaftBearbeitbarDemo";
import { WochentagWahlDemo } from "./WochentagWahlDemo";
import { CheckboxDemo } from "./CheckboxDemo";
import { SwitchDemo } from "./SwitchDemo";
import { SeitenleisteDemo } from "./SeitenleisteDemo";
import { OverlaysDemo } from "./OverlaysDemo";
import { FeedbackDemo } from "./FeedbackDemo";
import { TabelleAuswahlDemo } from "./TabelleAuswahlDemo";
import { BreadcrumbsDemo } from "./BreadcrumbsDemo";
import { OverflowMenuDemo } from "./OverflowMenuDemo";
import { ChipMenuDemo } from "./ChipMenuDemo";
import { MaterialDemo } from "./MaterialDemo";
import { FelderDemo } from "./FelderDemo";
import { MiniMonatDemo } from "./MiniMonatDemo";
import { LozengeAuswahlDemo } from "./LozengeAuswahlDemo";
import { VariantenWahlDemo } from "./VariantenWahlDemo";
import { ErscheinungsbildDemo } from "./ErscheinungsbildDemo";
import { VariantenLinks } from "@/components/training/VariantenLinks";
import { TrainingCard } from "@/components/training/TrainingCard";
import { AnmeldeHinweis } from "@/components/training/AnmeldeHinweis";
import {
  Search,
  SlidersHorizontal,
  Copy,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Check,
  Lock,
  Globe,
  BookOpen,
  Trash2,
  Pencil,
  Info,
  SearchX,
  MailCheck,
  Layers,
  RefreshCw,
  CalendarOff,
  CalendarPlus,
  Link2,
  Tag,
  Shield,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  UserPen,
  Users,
  Group,
  Shirt,
  CalendarDays,
  Repeat,
  ClipboardList,
  LayoutGrid,
  ListChecks,
  MapPin,
  Clock,
  LandPlot,
  History,
  type LucideIcon,
} from "lucide-react";
import { DiagrammView, GlyphVorschau } from "@/components/diagramm/DiagrammView";
import { ROTATIONEN, SPIELER_POSEN, type DiagrammElement } from "@/lib/diagramm";
import { cn } from "@/lib/cn";
import type { KategorieSlug } from "@/lib/vocab";
import {
  GRUND,
  ELEV,
  PRIMARY,
  ON_PRIMARY,
  ERROR,
  DANGER,
  ON_DANGER,
  SCHRIFT,
  LINIE,
  KANTE,
  UMKEHR,
  ZUSTAND,
  DRUCK,
  LOZENGE,
  SECTION,
  deckend,
  elev,
  elevName,
  hex8,
  kontrast,
  ueberlagern,
  type LozengeAppearance,
} from "@/lib/farben";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { KaderLozenge } from "@/components/team/KaderLozenge";
import { ProbeLozenge } from "@/components/team/ProbeLozenge";
import { VERZEICHNIS_COOKIE, leseVerzeichnis } from "@/lib/verzeichnis";

export const metadata: Metadata = {
  title: "Styleguide - KiFu Designsystem",
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

/** Ein Release-Text nach docs/releases/ für den Abschnitt «Release-Text». */
const BEISPIEL_RELEASE = `Du siehst jetzt, welche Version läuft und was neu ist.

### Neu

- **Versionen**: Die Seitenleiste zeigt die laufende Version und führt zu allen Versionen. (#408)

### Technisch

- Die Versionen kommen einmal pro halbe Stunde von GitHub.
- **Noch ungeprüft:** die Markierung auf einem echten Telefon.`;

/* Die Gliederung des Styleguides: Obertitel wie bei Material («Foundations»,
   «Styles»), die Komponenten unter Untertiteln wie bei Atlassian («Forms and
   inputs», «Messaging»). Eine Quelle für das Verzeichnis, die Köpfe der
   Abschnitte und die Verweise im Text — die Seite steht in derselben
   Reihenfolge. */
const GLIEDERUNG = [
  {
    titel: "Grundlagen",
    text: "Worauf alles Weitere baut: was das System ausmacht und woher es stammt, wie Bedienelemente auf Zeiger und Tastatur antworten, wie Seiten aufgeteilt sind und was auf Papier gilt.",
    gruppen: [
      {
        eintraege: [
          { id: "grundsatz", titel: "Grundsatz und Herkunft" },
          { id: "zustaende", titel: "Zustände" },
          { id: "layout", titel: "Layout" },
          { id: "druck", titel: "Druck" },
        ],
      },
    ],
  },
  {
    titel: "Stile",
    text: "Wie KiFu aussieht: Farbe, Schrift, Höhe, Form und Zeichen.",
    gruppen: [
      {
        eintraege: [
          { id: "erscheinungsbild", titel: "Hell und Dunkel" },
          { id: "farbrollen", titel: "Farbrollen" },
          { id: "typografie", titel: "Typografie" },
          { id: "hoehe", titel: "Höhe" },
          { id: "form", titel: "Masse, Radien, Konturen" },
          { id: "zeichen", titel: "Zeichen - Lucide" },
        ],
      },
    ],
  },
  {
    titel: "Komponenten",
    text: "Die Bausteine aus components/ui, geordnet nach ihrer Aufgabe - zuletzt die fachlichen, die nur KiFu kennt.",
    gruppen: [
      {
        titel: "Formulare und Eingabe",
        eintraege: [
          { id: "knoepfe", titel: "Knöpfe" },
          { id: "textfelder", titel: "Textfelder, Text-Area, Datum & Zeit" },
          { id: "feldgruppe", titel: "Feldgruppe" },
          { id: "externer-link", titel: "Externer Link" },
          { id: "offene-einfachauswahl", titel: "Offene Einfachauswahl" },
          { id: "einfachauswahl-panel", titel: "Einfachauswahl mit Panel" },
          { id: "mehrfachauswahl", titel: "Mehrfachauswahl" },
          { id: "variantenwahl", titel: "Variantenwahl" },
          { id: "filterknopf", titel: "Filterknopf" },
          { id: "menue", titel: "Menü" },
          { id: "chip-menue", titel: "Chip mit Menü" },
        ],
      },
      {
        titel: "Plaketten",
        eintraege: [{ id: "plaketten", titel: "Lozenge, Badge & Chips" }],
      },
      {
        titel: "Meldungen",
        eintraege: [
          { id: "meldungen", titel: "Leerzustand, Hinweiszeile & Section Message" },
          { id: "dialog-snackbar", titel: "Dialog & Snackbar" },
          { id: "feedback-dialog", titel: "Fragen und Feedback" },
        ],
      },
      {
        titel: "Navigation",
        eintraege: [
          { id: "navigation", titel: "Seitenleiste & Tabs" },
          { id: "breadcrumbs", titel: "Breadcrumbs" },
          { id: "verzeichnis", titel: "Verzeichnis" },
        ],
      },
      {
        titel: "Layout und Struktur",
        eintraege: [
          { id: "liste-detail", titel: "Liste mit Detail daneben" },
          { id: "disclosure", titel: "Disclosure" },
          { id: "gefahrenzone", titel: "Gefahrenzone" },
        ],
      },
      {
        titel: "Text und Daten",
        eintraege: [
          { id: "tabelle", titel: "Tabelle" },
          { id: "eigenschaften", titel: "Eigenschaften" },
          { id: "release-text", titel: "Release-Text" },
        ],
      },
      {
        titel: "Training und Termine",
        eintraege: [
          { id: "karten", titel: "Übungs- und Trainingskarten" },
          { id: "fahrplan", titel: "Methodischer Fahrplan" },
          { id: "feld-diagramm", titel: "Feld-Diagramm" },
          { id: "material", titel: "Material" },
          { id: "kalenderblatt", titel: "Kalenderblatt" },
          { id: "mini-monat", titel: "Mini-Monat" },
          { id: "platz-spielerzahl", titel: "Platz und Spielerzahl eines Termins" },
        ],
      },
    ],
  },
] as const satisfies readonly (VerzeichnisBereich & { text: string })[];

type Bereich = (typeof GLIEDERUNG)[number];
type Gruppe = Bereich["gruppen"][number];
type AbschnittId = Gruppe["eintraege"][number]["id"];

const ABSCHNITTE = new Map<AbschnittId, { titel: string; gruppe?: string }>(
  GLIEDERUNG.flatMap((b) =>
    b.gruppen.flatMap((g: Gruppe) =>
      g.eintraege.map((e) => [e.id, { titel: e.titel, gruppe: "titel" in g ? g.titel : undefined }] as const),
    ),
  ),
);

/** Kopf eines Obertitels: gross, mit einem Satz dazu, was er umfasst. */
function BereichKopf({ titel }: { titel: Bereich["titel"] }) {
  const bereich = GLIEDERUNG.find((b) => b.titel === titel)!;
  return (
    <header className="pt-12 pb-6 first:pt-0">
      <h2 className="type-display-small text-on-surface">{bereich.titel}</h2>
      <p className="type-body-large mt-3 max-w-2xl text-on-surface-mittel">{bereich.text}</p>
    </header>
  );
}

/* Ein Sprung hält ab lg global 6rem Abstand zur klebenden Kopfzeile
   (globals.css). Ein Abschnitt rückt so weit höher, dass sein Untertitel auf
   der Höhe des Verzeichnisses steht (top-16): 4.5rem = 6rem - 4rem + die
   Polsterung oben (2.5rem).

   `dunkel`: Der Abschnitt legt lebende Flächen neben Zahlen, die
   `lib/farben.ts` für das dunkle Erscheinungsbild rechnet. Damit Fläche und
   Wert auch im Hellen zusammenpassen, steht sein Inhalt fest auf einer
   dunklen Tafel; das helle Gegenstück zeigt «Hell und Dunkel». */
function Section({
  id,
  dunkel = false,
  children,
}: {
  id: AbschnittId;
  dunkel?: boolean;
  children: React.ReactNode;
}) {
  const { titel, gruppe } = ABSCHNITTE.get(id)!;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titel`}
      className="border-t border-linie py-10 lg:scroll-mt-[-4.5rem]"
    >
      {gruppe && <p className="type-label-medium mb-1 text-primary">{gruppe}</p>}
      <h3 id={`${id}-titel`} className="type-headline-small text-on-surface">
        {titel}
      </h3>
      {dunkel ? (
        <div
          style={{ colorScheme: "dark" }}
          className="mt-6 rounded-dialog kontur border-linie bg-elev-00 p-5 text-on-surface"
        >
          <p className="type-label-medium mb-4 text-on-surface-mittel">Dunkel</p>
          {children}
        </div>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </section>
  );
}

/** Verweis auf einen anderen Abschnitt, mit dessen Namen. */
function Siehe({ id }: { id: AbschnittId }) {
  return (
    <a href={`#${id}`} className="text-primary underline">
      {ABSCHNITTE.get(id)!.titel}
    </a>
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
          "mb-2 flex h-14 w-full items-end rounded-klein p-2",
          flaeche,
          schrift,
        )}
      >
        <span className="type-label-small">{wert}</span>
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
    `Der eine Akzent. ${v(kontrast(PRIMARY, GRUND))} auf dem Grund - hell genug, um selbst Text zu sein.`,
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
    "error",
    "bg-error",
    ERROR.toUpperCase(),
    `Fehleingabe und Befund, als Schrift und Kontur. ${v(kontrast(ERROR, GRUND))} auf dem Grund, ${v(kontrast(ERROR, elev(24)))} noch im Dialog.`,
    "text-elev-00",
  ],
  [
    "danger",
    "bg-danger",
    DANGER.toUpperCase(),
    `Fläche des destruktiven Knopfs - dunkler als Error, weil sie Weiss trägt: ${v(kontrast(ON_DANGER, DANGER))} (auf Error nur ${v(kontrast("#ffffff", ERROR))}).`,
    "text-on-danger",
  ],
];

const schriftRollen: [string, string, string, string, string][] = [
  [
    "on-surface",
    "bg-on-surface",
    "100 %",
    `${v(kontrast("#ffffff", GRUND))} auf dem Grund - Titel, Werte, alles Wesentliche.`,
    "text-elev-00",
  ],
  [
    "on-surface-mittel",
    "bg-on-surface-mittel",
    "74 %",
    `${v(kontrast(weissAuf(SCHRIFT.mittel, GRUND), GRUND))} auf dem Grund - Beschriftungen und Beiwerk.`,
    "text-elev-00",
  ],
  [
    "on-surface-tief",
    "bg-on-surface-tief",
    "38 %",
    `${v(kontrast(weissAuf(SCHRIFT.tief, GRUND), GRUND))} - NUR Deaktiviertes, wo der Kontrast bewusst preisgegeben ist.`,
    "text-on-surface",
  ],
];

const strichRollen: [string, string, string, string, string][] = [
  [
    "linie",
    "bg-linie",
    "12 % · 1 px",
    `Trenner und Haarlinie. ${v(kontrast(weissAuf(LINIE, GRUND), GRUND))} - sie teilt, sie umreisst nicht.`,
    "text-on-surface",
  ],
  [
    "kante",
    "bg-kante",
    "28 % · 1.5 px",
    `Kontur von Feld, Chip und Knopf. ${v(kontrast(weissAuf(KANTE, GRUND), GRUND))} - 1 px verschwände im Dunkeln.`,
    "text-on-surface",
  ],
];

const kategorien: KategorieSlug[] = ["G", "F", "E", "D", "C", "B", "A"];

/* Die Lozenge-Darstellungen in Atlassians Reihenfolge; die Bedeutung steht
   daneben, wie die Komponente sie führt. */
const lozengeBedeutung: [LozengeAppearance, string][] = [
  ["neutral", "Herkunft, Entwurf, Altersstufe, Termin ausgefallen"],
  ["information", "gilt nach aussen: öffentlich, Community"],
  ["discovery", "etwas Zusätzliches: mehrere Varianten, neue Version"],
  ["warning", "braucht Aufmerksamkeit: Termin ohne Training"],
  ["success", "erledigt - im Kit, derzeit ohne Ort"],
  ["danger", "blockiert - im Kit, derzeit ohne Ort"],
];

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
  ["type-lozenge", "Lozenge und Badge", "Geist 400 · 12/16 · Atlassian body.small"],
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
  3: "- frei -",
  4: "Kopfzeile unter lg (deckend, kein Blur)",
  6: "Overlay-Icon-Knopf",
  8: "Menü, Select-Panel, Tonal-Knopf, Drawer, aktives Segment, offener Navigationseintrag",
  12: "Avatar, offener Navigationseintrag im Drawer",
  16: "- frei -",
  24: "Dialog, Tooltip",
};

const schattenStufen: [string, string, string][] = [
  ["shadow-dp-06", "dp-06", "Snackbar - sie schwebt über dem Inhalt."],
  ["shadow-dp-08", "dp-08", "Menü, Select-Panel, Drawer, Tooltip."],
  ["shadow-dp-24", "dp-24", "Dialog - das Einzige, was die Seite anhält."],
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
  ["rounded-klein", "2 px", "Kontrollkästchen, Badge, Fokusfläche eines Textlinks - die kleinste Rundung."],
  ["rounded-flaeche", "4 px", "Karte, Feld, Knopf, Menü, Snackbar, Auswahl-Panel, Lozenge."],
  ["rounded-dialog", "6 px", "Dialog und Section Message: die grössten Flächen vertragen mehr Rundung."],
  ["rounded-full", "voll", "Chips - Werte und Schalter, die man antippt und wieder loslässt."],
];

const hoehen: [string, string][] = [
  ["h-4 · 16 px", "Badge - die Zahl am Knopf (Atlassian)."],
  ["h-5 · 20 px", "Lozenge, auch als Alterskategorie (Atlassian)."],
  [
    "h-9 · 36 px",
    "Das eine Mass alles Bedienbaren (Epic #363): Feldkasten, Knopf, Icon-Knopf, jeder Chip samt geteiltem Chip und Menühälfte, Reiter, Zeile in Menü und Auswahlpanel, Kontrollkästchen, Eintrag der Seitenleiste, Werkzeug im Diagramm-Editor - auf dem Platz wie am Schreibtisch. Weil alles gleich hoch ist, fluchtet jede Leiste von selbst.",
  ],
  ["h-12 · 48 px", "Kopfzeile mit Menüknopf unter lg."],
];

/* Die Stufen, an denen sich das Layout tatsächlich ändert - Tailwinds
   Breakpoints, ohne eigene. `md` und `2xl` nutzt die Anwendung nicht. */
const fensterStufen: [string, string, string][] = [
  ["schmal", "< 640", "Rand 16 px, Seitenleiste als Drawer hinter der 48-px-Zeile mit dem Menüknopf"],
  ["sm", "ab 640", "Rand 24 px"],
  ["lg", "ab 1024", "Seitenleiste daneben (280 oder 72 px), Kopfzeile 64 px und klebend"],
  ["xl", "ab 1280", "geteilte Fläche: zweite Spalte neben dem Inhalt (Seitenrahmen geteilt)"],
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
  UserRound,
];

/* Eine Entität, ein Zeichen (PO 2026-10-25, Designsystem «Ikonografie»):
   Wer ein Zeichen für eine dieser Sachen braucht, nimmt dieses und kein
   anderes - und ein Zeichen meint keine zweite Sache. Was davon heute noch
   abweicht, nennt die Zeile selbst. */
const zeichenJeSache: [LucideIcon[], string, string][] = [
  [[Shield], "Shield", "Team"],
  [[UserRound], "UserRound", "Mitglied"],
  [[Users, UserRoundCheck, UserRoundX], "Users · UserRoundCheck · UserRoundX", "Trainer:innen am Termin - davor der eigene Stand: nicht eingeladen, dabei, abgesagt"],
  [[UserPen], "UserPen", "Verantwortung für einen Termin (wer vorbereitet und leitet)"],
  [[Group], "Group", "Gruppe im Hauptteil eines Trainings"],
  [[Shirt], "Shirt", "Spieler:in, Spielerliste, Spielerzahl"],
  [[Tag], "Tag", "Kader - nur in Überschriften, die Kader-Lozenges bleiben ohne Zeichen"],
  [[Link2], "Link2", "Spielervertretung (der private Link)"],
  [[CalendarDays, CalendarPlus, CalendarOff], "CalendarDays · CalendarPlus · CalendarOff", "Termin"],
  [[Repeat], "Repeat", "Terminserie"],
  [[ClipboardList], "ClipboardList", "Training, auch «Meine Trainings»"],
  [[LayoutGrid], "LayoutGrid", "Übung, auch «Meine Übungen»"],
  [[ListChecks], "ListChecks", "nur die Zahl der Übungen in einem Training"],
  [[Layers, MapPin, Clock, LandPlot], "Layers · MapPin · Clock · LandPlot", "Variante · Ort · Zeit · Platz"],
  [[History], "History", "Version (Versionszeile und Release-History)"],
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

export default async function Styleguide() {
  const jar = await cookies();
  return (
    <Seitenrahmen breite="6xl" krumen={[{ label: "Styleguide" }]}>
      <h1 className="sr-only">Styleguide</h1>

      <VerzeichnisFlaeche
        anfangsBreite={leseVerzeichnis(jar.get(VERZEICHNIS_COOKIE)?.value)}
        verzeichnis={<Verzeichnis name="Styleguide" bereiche={GLIEDERUNG} />}
      >
        <BereichKopf titel="Grundlagen" />

        <Section id="grundsatz">
          <p className="type-body-large mb-6 max-w-2xl text-on-surface-mittel">
            KiFu folgt <strong>Material 2</strong>, in zwei Erscheinungsbildern mit denselben
            Rollen (<Siehe id="erscheinungsbild" />). Im Dunkeln trägt eine einzige Fläche die
            ganze Anwendung: {GRUND} - Materials Dunkelgrau mit so viel Grün, dass der Platz im
            Bild bleibt. Höhe entsteht dort nicht durch eine zweite Farbe, sondern durch ein weisses
            Overlay auf eben dieser Fläche (<Siehe id="hoehe" />). Im Hellen tragen Fläche und
            Schatten die Höhe. Akzent ist das Violett der Marke, im Dunkeln so hell, dass es selbst
            Text sein kann (<Siehe id="farbrollen" />). Farbe umrandet und beschriftet - sie füllt nur dort, wo
            eine Fläche wirklich gemeint ist. Ausgenommen sind die drei Bausteine von Atlassian
            (unten): Lozenge und Section Message tragen eine getönte Fläche, die Badge eine
            gefüllte.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-flaeche bg-elev-01 p-4">
              <p className="type-label-large mb-2 text-on-surface">Übernommen</p>
              <ul className="type-body-medium flex list-disc flex-col gap-1 pl-5 text-on-surface-mittel">
                <li>Das Farbsystem: Rollen mit ihren On-Farben, Schrift als Weiss in Deckungen.</li>
                <li>Die Höhe als gerechnete Overlay-Leiter über einem einzigen Grund.</li>
                <li>Die Zustands-Deckungen (4 / 12 / 10 %) in der Farbe des Inhalts; überfahren in einer schon überfahrenen Fläche 8 %.</li>
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
                  beim Umschalten (siehe <Siehe id="navigation" />).
                </li>
                <li>
                  <strong>Primary Variant.</strong> Das dunkle Zweit-Violett der
                  Baseline stammt aus dem hellen Thema; auf dem Grund käme es auf{" "}
                  {v(kontrast("#3700b3", GRUND))}. Eine Rolle mit genau einem
                  möglichen Ort lädt zum Missgriff ein - das System kennt je
                  Erscheinungsbild ein Violett.
                </li>
                <li>
                  <strong>Secondary.</strong> Der zweite Akzent der Baseline
                  konkurrierte neben Primary nur, ohne etwas zu benennen - das
                  System kennt einen Akzent.
                </li>
                <li>
                  <strong>Eine eigene Farbe für den nicht blockierenden Hinweis am Feld.</strong>{" "}
                  Material kennt nur Error. Der Befund trägt darum dieselbe Farbe
                  wie die Fehleingabe und unterscheidet sich im Verhalten (siehe <Siehe id="textfelder" />).
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-4 rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-2 text-on-surface">Von Atlassian (wie Jira)</p>
            <p className="type-body-medium text-on-surface-mittel">
              Drei Bausteine folgen nicht Material, sondern dem Atlassian Design
              System - Anatomie, Namen und Farben wie in Jira: die{" "}
              <strong>Lozenge</strong> (unsere Plakette) und die{" "}
              <strong>Badge</strong> (der Zähler am Knopf), beide unter <Siehe id="plaketten" />, und die{" "}
              <strong>Section Message</strong> (die Meldung im Fluss der Seite,{" "}
              <Siehe id="meldungen" />). Ihre Farben stehen wörtlich aus <code>@atlaskit/tokens</code>{" "}
              - am Schirm das Dark-, im Druck das Light-Theme - und werden in{" "}
              <code>lib/farben.ts</code> gegen unseren Grund nachgerechnet.
            </p>
          </div>
        </Section>

        <Section id="zustaende" dunkel>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Jede bedienbare Fläche legt beim Überfahren, Fokussieren und Drücken
            eine Ebene auf - <strong>in der Farbe ihres eigenen Inhalts</strong>,
            mit fest vorgegebener Deckung. Die Ebene steckt im Basis-Bündel der
            Bausteine (<code>state</code> in Button, Chip, Icon-Knopf, Menüzeile,
            Navigationszeile), nicht an den Aufrufstellen: Darum kennt das Kit kein
            einziges <code>hover:bg-*</code>. Sie gehört zudem auf das{" "}
            <strong>fokussierbare</strong> Element: Deckt ein Link eine ganze
            Karte, trägt der Link die Ebene und nicht das{" "}
            <code>&lt;div&gt;</code> darum - sonst bliebe sie beim Tabben und beim
            Drücken stumm. <strong>Drei Zustände, nicht Materials vier:</strong>{" "}
            «gezogen» fehlt, weil das Einzige, was hier gezogen wird,
            Diagramm-Elemente sind - und die leben im SVG, nicht im DOM
            (siehe <Siehe id="feld-diagramm" />). <strong>Ebene in Ebene:</strong> Liegt eine bedienbare
            Fläche in einer anderen («Training hinzufügen» in der Terminzeile),
            ist beim Überfahren auch die äussere aufgehellt; die innere trägt
            darum 8 % statt 4 % (<code>--state-hover-innen</code>). Menü und
            Auswahlliste schweben auf eigenem Grund und bleiben bei 4 %.
          </p>
          <div className="mb-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="type-label-small mb-2 text-on-surface-mittel">
                Inhalt weiss - auf neutraler Fläche
              </p>
              <div className="flex flex-col gap-2">
                <Zustandsfeld label="Ruhe" deckung={0} notiz="-" farbe="#ffffff" />
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
                Inhalt in Primary - dieselben Deckungen
              </p>
              <div className="flex flex-col gap-2">
                <Zustandsfeld label="Ruhe" deckung={0} notiz="-" farbe={PRIMARY} primary />
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
            Am lebenden Objekt - überfahren, mit Tab fokussieren, gedrückt halten
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Button variant="outlined">Neutrale Fläche</Button>
            <Button variant="text">Inhalt in Primary</Button>
            <Button variant="filled">Gefüllt - die Ebene wird schwarz</Button>
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
                muss, erspart sie jede z-index-Buchhaltung im Inhalt -{" "}
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
                Unterschied - und in Forced-Colors-Modi wird die Ebene gar nicht
                gezeichnet. Der 2-px-Ring in Primary mit Offset bleibt darum
                (<code>focus-ring</code>, als <code>outline</code> statt als
                Schatten: Er folgt dem Radius und kollidiert nicht mit dem
                Schatten schwebender Flächen). Die Ebene kommt dazu, sie ersetzt
                ihn nicht. Die <strong>Kontur rührt er nicht an</strong>: Sie sagt
                an vielen Stellen schon etwas anderes - Fehler, Befund, Auswahl,
                offenes Panel -, und eine Utility, die <code>border-color</code>{" "}
                setzte, schlüge jede dieser Farbklassen am Element.
              </p>
            </div>
          </div>
        </Section>

        <Section id="layout">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Fenstergrössen und Seitenränder: vier Stufen, an denen sich das
            Layout ändert (Tabelle unten). Ein Spaltenraster gibt es nicht - die
            Lesebreite setzt der <code>Seitenrahmen</code>, Übersichten reihen
            Kacheln, so viele die Breite fasst
            (<code>repeat(auto-fill, minmax(16rem, 1fr))</code>). Lange
            Übersichten zeigen zuerst eine Seite, im Übungskatalog 24 Kacheln:
            darunter, zentriert, eine Zählzeile «24 von 81 Übungen» in{" "}
            <code>type-label-small</code> (Live-Region, damit das Nachladen
            angesagt wird) und ein <code>ButtonLink</code> «Weitere anzeigen»
            in <code>outlined</code> mit <code>scroll={"{false}"}</code>. Er
            hebt <code>?anzahl=</code> um eine Seite an; die Adresse bleibt
            teilbar, und ein Filterwechsel beginnt wieder bei der ersten Seite.
            Dasselbe Muster wie «… ältere Versionen anzeigen» unter
            «Versionen».
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Lange Formulare gliedert <code>FormAbschnitt</code>: eine Überschrift
            in <code>type-title-medium</code>, gedämpft - dieselbe, die die
            Abschnitte der Übungs-Detailseite tragen, damit Maske und Ansicht
            gleich gegliedert sind. Die Übungsmaske teilt sich darum wie die
            Detailseite in Inhalt und Einordnung (<code>ZweiSpalten</code>); die
            Einordnung steht schmal VOR dem Inhalt, weil sie bestimmt, welche
            Felder er verlangt. Ihre Felder stehen in jeder Breite
            untereinander, eins pro Zeile - eine Spalte liest sich von oben nach
            unten, ohne dass das Auge zwischen Nachbarn springt (PO 2026-10-04).
            Auch zusammengehörige Werte stehen als eigene Felder mit eigenem
            Namen untereinander - «Spielfeldlänge», «Spielfeldbreite» statt
            eines gemeinsamen Namens über zwei Teilnamen. Ein Feld
            ohne eigenes Label (Dateifeld, Material-Gruppe) bekommt die Id der
            Überschrift für <code>aria-labelledby</code>, statt den Namen doppelt
            zu zeigen.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            In einem Dialog die kleinere Form (<code>imDialog</code>, Epic #518): eine Linie darüber, die Überschrift in{" "}
            <code>type-label-medium</code> und darunter ein Satz, wozu der Abschnitt dient (<code>untertitel</code>) -
            so muss nicht jedes Feld darunter sich selbst erklären. «Termin erstellen» gliedert so Spieler:innen und
            Trainer:innen.
          </p>
          <div className="mb-8 grid max-w-md gap-8">
            <FormAbschnitt titel="Trainer:innen" untertitel="Wer eingeladen ist, gilt als dabei, bis sie oder er absagt." imDialog>
              <TextField label="Eingeladen" />
            </FormAbschnitt>
            <FormAbschnitt titel="Durchführung">
              <TextField label="Ablauf" />
            </FormAbschnitt>
            <FormAbschnitt titel="Foto" fehler>
              <p className="type-body-small text-error">
                Das Foto ist grösser als erlaubt. Mit <code>fehler</code> zeigt die
                Überschrift den Fehler eines Felds ohne eigenes Label an.
              </p>
            </FormAbschnitt>
          </div>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Jedes Formular mit Eingabefeldern trägt <code>noValidate</code></strong>: Fehler
            meldet die App, nicht der Browser. Dessen eigene Prüfung (Pflicht,
            Mindestlänge, Zahlengrenzen, E-Mail-Form) hielte das Absenden an und
            zeigte eine Sprechblase in der Sprache des Browsers, in seinem
            Aussehen - und die deutsche Meldung der App unter dem Feld käme nie
            zum Zug. Die Regeln selbst prüft der Server ohnehin. Die Attribute
            bleiben stehen: <code>required</code> und <code>min</code>/
            <code>max</code> sagen der Vorlesehilfe, was das Feld verlangt
            (PO 2026-10-04).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Jede Seite steht in einem <code>Seitenrahmen</code>: linksbündig
            neben der Seitenleiste, Übersichten über die ganze Fläche
            (<code>voll</code>, Kachelraster mit so vielen Spalten, wie Platz
            ist), Formulare und Lesetext in ihrer Lesebreite (<code>xl</code>{" "}
            bis <code>5xl</code>). Nicht zentriert, denn rechts steht, wo eine
            Seite eine hat, die zweite Spalte (<code>spalte</code>, etwa die
            Einordnung einer Übung, siehe <Siehe id="eigenschaften" />, <code>ZweiSpalten</code>). Ab{" "}
            <code>xl</code> ist die Seite dann geteilt (<code>geteilt</code>):
            beide Spalten füllen Breite und Höhe des Fensters und scrollen je
            für sich; die rechte wächst von 20 bis 26 rem mit und lässt sich am
            Griff dazwischen ziehen (Kit-Baustein <code>Ziehgriff</code>:{" "}
            <code>role=&quot;separator&quot;</code>, Pfeiltasten, Pos1/Ende, Doppelklick =
            Vorgabe; Cookie <code>kifu-spalte</code>). Derselbe Griff trennt unter
            «Versionen» und hier das Verzeichnis von den Texten (<Siehe id="verzeichnis" />).
            Schmaler steht sie nach dem Inhalt (in der Maske davor), der Inhalt in
            seiner Lesebreite; auf Papier daneben. Zuoberst die Kopfzeile mit dem
            Umschalter der Seitenleiste, den Brotkrumen und rechts den Aktionen
            der Seite - sie klebt ab <code>lg</code> beim Scrollen oben (ausser
            in der Durchführung), 64 px hoch mit den Brotkrumen auf der Linie
            der Marke. Einen Innenabstand bekommt sie nie, er zählte zur Höhe
            und schöbe die Brotkrumen aus der Mitte; darunter beginnt ab{" "}
            <code>lg</code> direkt der Inhalt, schmaler mit einem Rand von 24 px.
            Brotkrumen sind Pflicht, auch auf den
            Einstiegsseiten. Ab <code>lg</code> gehen 280 oder 72 px an die
            Seitenleiste (siehe <Siehe id="navigation" />); die Stufen unten meinen das ganze
            Fenster.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Das Training teilt sich ebenso, aber <strong>nur breit</strong>{" "}
            (<code>nurBreit</code>, Epic #369): Links stehen die Übungen, rechts
            die Eigenschaften des Trainings oder die geöffnete Übung (siehe <Siehe id="liste-detail" />).
            Schmal und auf Papier fehlt die Spalte, und die Seite behält ihren
            bisherigen Aufbau - dort gibt es nichts daneben zu öffnen. Eine
            Ausnahme: Trägt eine Maske in der Spalte ungesicherte Angaben
            (<code>data-ungesichert</code>), bleibt sie auch gestapelt stehen,
            damit sie sich noch sichern lässt, wenn das Fenster schmal wird. Der
            Griff nennt, was die Spalte zeigt (<code>spaltenName</code>), und
            eine Spalte mit Eingabefeldern ist kein <code>aside</code>{" "}
            (<code>beiseite</code>): Eine Vorlesehilfe soll sie nicht als
            Nebensache ankündigen.
          </p>
          <div className="space-y-2">
            {fensterStufen.map(([cls, range, note]) => (
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

        <Section id="druck">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Was auf Papier geht, kommt aus derselben Anwendung - nur legt ein
            einziger Block (<code>@media print :root</code>) die Rollen um. Die
            Höhenleiter kippt: Aus dem aufgehellten Dunkel wird ein abgedunkeltes
            Weiss, die Reihenfolge der Stufen bleibt, sodass gestapelte Karten sich
            weiter voneinander abheben. Einen Sonderfall im Klassenstring kennt kein
            Baustein: Alle benutzen am Schirm wie auf Papier dieselben Tokens.
            Lozenge und Section Message wechseln dabei in Atlassians helles Theme
            - dieselben Rollen, die Werte aus <code>atlassian-light</code>.
          </p>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {druckProben.map(([name, hex, notiz]) => (
              <div key={name} className="rounded-flaeche kontur border-kante p-3">
                <div
                  className="mb-2 flex h-14 w-full items-end rounded-klein border border-linie p-2"
                  style={{
                    backgroundColor: hex,
                    color: kontrast(DRUCK["on-surface"], hex) >= 4.5 ? DRUCK["on-surface"] : DRUCK["elev-00"],
                  }}
                >
                  <span className="type-label-small">{hex.toUpperCase()}</span>
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
              <strong>Lozenges und Section Messages werden hell</strong>: zarte
              Tönung mit dunkler Schrift, wie Jira im hellen Theme. Am häufigsten
              gedruckt sind die Alterskategorien in der Druckansicht des
              Trainings; <code>scripts/pruefe-farben.ts</code> rechnet jede
              Darstellung auf Papier nach.
            </li>
            <li>
              <strong>Schrift und Striche werden Tinte statt Deckung:</strong>{" "}
              on-surface {DRUCK["on-surface"].toUpperCase()}, mittel{" "}
              {DRUCK["on-surface-mittel"].toUpperCase()}, kante{" "}
              {DRUCK.kante.toUpperCase()}, linie {DRUCK.linie.toUpperCase()} -
              halbtransparentes Weiss hätte auf Papier keinen Sinn.
            </li>
            <li>
              <code>print-color-adjust: exact</code> bleibt gesetzt, damit
              Diagramme und Kategorien wirklich so kommen, wie sie gesetzt sind;
              App-Chrome ist über <code>print:hidden</code> ausgeblendet.
            </li>
            <li>
              <strong>Das Feld-Diagramm hat einen eigenen Druck-Satz</strong>{" "}
              (<Siehe id="feld-diagramm" />): weisse Fläche statt Rasengrün, schwarze Pfeile,
              gedämpfte Elementfarben. Der grüne Rasen deckte 1600×1000 und kam
              auf geschätzt 125 % Farbauftrag - das Blatt allein trug damit fast
              den ganzen Verbrauch; weiss mit Raster liegt bei rund 3 %.
            </li>
          </ul>
        </Section>

        <BereichKopf titel="Stile" />

        <Section id="erscheinungsbild">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            KiFu hat zwei Erscheinungsbilder mit denselben Rollen (Epic #563). Jede Farbe steht im
            CSS als <code>light-dark(hell, dunkel)</code>; welches gilt, entscheidet allein{" "}
            <code>color-scheme</code>. Hell trägt die Höhe über Fläche und Schatten: ein leises
            Rasengrau als Grund, weisse Karten, getönt was in einer Karte liegt, weiss alles
            Schwebende. Dunkel bleibt der Nachtgrund mit weissem Overlay. Akzent ist in beiden das
            Violett der Marke, im Dunkeln eine hellere Stufe. Beide Tafeln unten sind die lebenden
            Klassen und echten Bausteine; geprüft gegen WCAG 2.2 AA in{" "}
            <code>npm run check:farben</code>.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Betonung an Ort ist keine Höhe.</strong> Im Hellen ist alles über dem Grund
            weiss - eine höhere Stufe hebt dort nichts ab. Was an seinem Platz hervortritt (aktive
            Zeile in Leiste und Verzeichnis, vergangenes Kalenderblatt, ausgefallener Tag, Avatar,
            Code), trägt darum <code>betont</code>: die Schrift zu 8 % über der Fläche darunter. Das
            hebt auf jeder Stufe und in beiden Erscheinungsbildern ab und entspricht im Dunkeln
            ziemlich genau der früheren Menüstufe. Schatten bleiben dem Schwebenden vorbehalten:
            Eine hervorgehobene Karte (der nächste Termin) hebt sich über ihre Kontur ab, die im
            Hellen 3:1 trägt - im Dunkeln steht sie dazu eine Stufe höher.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Browser ohne <code>light-dark()</code> (Safari vor 17.5, also iOS 16 und frühe 17er)
            bekommen fest das Helle: ein Ersatz-Block mit den hellen Hälften, geschrieben von{" "}
            <code>gen:farb-ersatz</code> und geprüft von <code>check:farben</code>. Die Zeile
            «Darstellung» fehlt dort in der Seitenleiste - umschalten liesse sich nichts.
          </p>
          <ErscheinungsbildDemo />
        </Section>

        <Section id="farbrollen" dunkel>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Material vergibt <strong>Rollen</strong>, keine Bedeutungen: Es gibt
            einen Akzent, eine Fehlerfarbe und Schrift in Deckungen - was davon
            wofür steht, entscheidet die Anwendung. Die Flächen unten sind die
            lebenden Klassen, die Zahlen daneben rechnet{" "}
            <code>lib/farben.ts</code> beim Rendern nach. Weichen sie
            voneinander ab, ist das hier zu sehen.
          </p>
          <p className="type-label-small mb-2 text-on-surface-mittel">Akzente</p>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
            {v(kontrast("#cf6679", elev(24)))} - die Anwendung setzt Error aber
            fast nie als Fläche, sondern als Schrift auf der Karte, in der
            Menüzeile und im Dialog. Der hellere Ton trägt auf{" "}
            <strong>jeder</strong> Höhenstufe über 4.5:1, am engsten auf 24dp
            mit {v(kontrast(ERROR, elev(24)))}. Gefüllt wird Rot nur im
            destruktiven Knopf, und dort mit eigener Rolle (<code>danger</code>,
            weisse Schrift {v(kontrast(ON_DANGER, DANGER))}).
            Nachgerechnet wird das seither auf jeder Stufe und zusätzlich als
            Kontur (<code>scripts/pruefe-farben.ts</code>), nicht mehr nur auf
            dem Grund - dort lag die Lücke, durch die die Baseline kam.
          </p>

          <p className="type-label-small mb-2 text-on-surface-mittel">
            Schrift - Weiss in drei Deckungen
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
            direkt rechnen - die Zahlen oben stehen für den{" "}
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
            aussagt - Fehler, Befund, Auswahl -, trägt sie{" "}
            <code>border-error</code> oder <code>border-primary</code> statt der
            Kante, und dann steht die Aussage auch im Text daneben.
          </p>

          <p className="type-label-small mb-2 text-on-surface-mittel">
            Atlassian - Lozenge und Section Message
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            Je Darstellung ein Paar aus Atlassians Dark-Theme (hier gezeigt; im
            Hellen gilt das Gegenstück aus dem Light-Theme): Die Lozenge trägt
            die zarte Tönung (<code>lozenge-*</code> = ADS{" "}
            <code>background.&lt;x&gt;.subtler</code>) mit kräftiger Schrift (
            <code>on-lozenge-*</code> = <code>text.&lt;x&gt;.bolder</code>), die
            Section Message eine noch leisere Fläche (<code>section-*</code> ={" "}
            <code>background.&lt;x&gt;</code>) mit farbigem Zeichen (
            <code>icon-*</code>). Die Zahlen sind die Schrift auf ihrer Fläche,
            die neutrale Lozenge (halbtransparent) über dem Grund gemischt.
          </p>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {lozengeBedeutung.map(([darstellung, bedeutung]) => {
              const { flaeche, schrift } = LOZENGE[darstellung];
              return (
                <div key={darstellung} className="rounded-flaeche kontur border-kante p-3">
                  <div className="mb-2 flex h-10 items-center">
                    <Lozenge appearance={darstellung}>{darstellung}</Lozenge>
                  </div>
                  <p className="type-label-small text-on-surface">lozenge-{darstellung}</p>
                  <p className="type-body-small text-on-surface-mittel">{bedeutung}</p>
                  <p className="type-body-small text-on-surface-mittel">
                    {v(kontrast(schrift, deckend(flaeche, GRUND)))}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            Section Message (Schrift / Zeichen auf der Fläche):{" "}
            {Object.entries(SECTION)
              .map(([rolle, { flaeche, icon }]) => `${rolle} ${v(kontrast("#ffffff", flaeche))} / ${v(kontrast(icon, flaeche))}`)
              .join(" · ")}
            .
          </p>
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            <strong>Die Alterskategorien sind Accent-Lozenges.</strong> Wie Jira
            Kategorien ohne Wertung färbt, trägt jede Stufe einen festen
            Atlassian-Akzent - G blau, F gelb, E orange, D grün, C magenta, B
            lila, A grau (<Siehe id="plaketten" />). Die Akzente teilen die Palette mit den Bedeutungen -
            G hat die Farbe von <code>information</code>, B die von{" "}
            <code>discovery</code>, E die von <code>warning</code>, wie in Jira.
            Auseinander hält sie die Form: Die Kategorie ist immer ein einzelner
            Buchstabe, jede andere Lozenge ein Wort (a11y: nie nur über Farbe).
          </p>
        </Section>

        <Section id="typografie">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Eine Familie für alles.</strong> Geist trägt Display, Titel,
            Fliesstext, Label und Lozenge; unterschieden werden die Rollen über
            Gewicht, Versalien und Sperrung, nicht über eine zweite Schrift. Was
            in Kolonnen fluchten muss - Dauern, Zählungen, Positionsnummern -,
            hält <code>font-variant-numeric: tabular-nums</code> auf jeder
            Label-Stufe bündig; dafür braucht es keine Monospace mehr.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Display, Headline und Titel stehen in normaler Schreibung und im
            selben Gewicht (600): Die Rangfolge trägt die Grösse, nicht die
            Wucht (Epic #363). Eine Neo-Grotesk in Gemischtschreibung will eng
            stehen, darum laufen die grossen Stufen mit leicht negativem
            Tracking - je grösser, desto enger. Namen, die Trainer:innen selbst
            erfassen, erscheinen so in jeder Überschrift genau so, wie sie sie
            geschrieben haben.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Label gehen den umgekehrten Weg: Sie allein stehen versal, klein und
            mit 8–10 % weit gesperrt, und trennen sich so von jeder Überschrift.
            Bei 400 verlöre die kleinste Stufe auf dem dunklen Grund ihre
            Stämme - darum steht Label Small auf 500.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Regel: Nutzertext nie in Label-Typografie.</strong> Die{" "}
            <code>type-label-*</code>-Stufen sind gesperrt, halbfett und{" "}
            <em>versal</em> -
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
            <code>type-lozenge</code> stammt von Atlassian (
            <code>font.body.small</code>): 12/16, normal gesetzt, für Lozenge
            und Badge. Keine Versalien - die Lozenge sagt, was ist, sie ist keine
            Rubrik. Eine Zeile niedriger als <code>type-body-small</code>, damit
            die Lozenge mit 2 px Polsterung genau 20 px misst.
          </p>
        </Section>

        <Section id="hoehe" dunkel>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Im Dunkeln trägt nicht der Schatten die Höhe, sondern die Helligkeit:
            Jede Stufe legt ein weisses Overlay über denselben Grund. Die Werte
            stehen als literale Hex im <code>@theme</code> - ausgerechnet statt
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
                  const frei = elevVerwendung[s.dp].startsWith("-");
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
                            "block h-7 w-20 rounded-klein border border-linie",
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
            Zwei Stufen - 03 und 16 dp - sind <strong>frei</strong>. Sie
            stehen in der Leiter, weil Material sie führt und weil eine Lücke
            später schwerer nachzutragen wäre als eine ungenutzte Stufe; angewandt
            wird keine von beiden. Wer eine braucht, trägt hier ein, wofür.
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Die Höhe trägt die Fläche, der Schatten nur, was schwebt.</strong>{" "}
            Karte, Block und Seitenleiste bekommen keinen Schatten - sie liegen im
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

        <Section id="form">
          <p className="type-label-small mb-2 text-on-surface-mittel">
            Abstände - Vielfache von 4
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
            Eckig mit gerundeten Kanten für alles, was Inhalt hält oder eine
            Handlung auslöst - Karte, Feld, Knopf, Icon-Knopf, Filterknopf; voll
            gerundet nur der Chip, ein Wert oder Schalter, den man antippt und
            wieder loslässt (Epic #363: Icon-Knöpfe sind kein Kreis mehr). Mehr Werte gibt es nicht - 3 px, 5 px und
            8 px sind aus dem System gefallen, und ein{" "}
            <code>rounded-</code>-Wert in eckigen Klammern ist ein Fehler, kein
            Sonderfall.
          </p>

          <p className="type-label-small mb-2 text-on-surface-mittel">
            Kontur - <code>kontur</code>, 1.5 px
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <span className="rounded-flaeche border border-kante px-4 py-2 type-body-medium text-on-surface-mittel">
              1 px - verschwindet
            </span>
            <span className="rounded-flaeche kontur border-kante px-4 py-2 type-body-medium text-on-surface">
              1.5 px - trägt
            </span>
            <span className="rounded-flaeche border border-linie px-4 py-2 type-body-medium text-on-surface-mittel">
              1 px Linie - trennt, umreisst nicht
            </span>
          </div>
          <p className="type-body-medium mb-8 max-w-2xl text-on-surface-mittel">
            <code>kontur</code> setzt nur Breite und Stil; die Farbe kommt separat
            (<code>border-kante</code>, <code>border-primary</code>,{" "}
            <code>border-error</code>). Im Dunkeln verschwindet eine 1-px-Kontur
            gegen den Grund - die Haarlinie bei 12 % bleibt trotzdem 1 px, weil
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

        <Section id="zeichen">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Open-Source Lucide, umrissen, Strichstärke 2, runde Enden. „Gewählt"
            zeigt sich über Farbe und Zustands-Ebene, nicht über eine Füllung.
            Grössen 14 · 16 · 18 · 20 · 24 - 14 und 16 stehen neben Text, 18 und
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

          <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
            Eine Sache, ein Zeichen
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            Jede Sache der Anwendung hat genau ein Zeichen, und ein Zeichen
            meint keine zweite Sache - so erkennt man auf dem Platz, wovon
            eine Zeile spricht, bevor man sie liest. Wo die Anwendung davon
            noch abweicht, steht es in der Zeile. Teams, Mitglieder,
            Spieler:innen und Kader tragen ihr Zeichen auch vor der
            Überschrift ihres Abschnitts - 20 px in der Farbe der Überschrift,
            gebaut wie bei der Gefahrenzone.
          </p>
          <div className="space-y-2">
            {zeichenJeSache.map(([zeichen, namen, sache]) => (
              <div key={namen} className="flex flex-wrap items-center gap-3 border-b border-linie pb-2">
                <span className="flex w-24 shrink-0 gap-2 text-on-surface-mittel">
                  {zeichen.map((Zeichen, i) => (
                    <Zeichen key={i} size={18} strokeWidth={2} aria-hidden />
                  ))}
                </span>
                <code className="type-body-small w-72 text-on-surface">{namen}</code>
                <span className="type-body-small min-w-0 flex-1 text-on-surface-mittel">{sache}</span>
              </div>
            ))}
          </div>
        </Section>

        <BereichKopf titel="Komponenten" />

        <Section id="knoepfe">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Sechs Varianten (und der umgekehrte Knopf weiter unten), eine Regel: <strong>Gefüllt trägt
            die Schrift, die auf dem Violett am stärksten ist</strong> - im Dunkeln Schwarz, im Hellen
            Weiss; Rot trägt immer Weiss. <code>filled</code> ist Primary-Fläche, <code>outlined</code> Kontur
            auf der Kante - der <strong>Secondary Button</strong>, wenn von ihm die
            Rede ist, <code>text</code> nur Schrift, <code>danger</code>{" "}
            gefüllt in <code>danger</code> mit weisser Schrift - Löschen soll
            man nicht übersehen (PO 2026-10-06). Das helle Error-Rot des Dunkeln
            trüge Weiss nicht, darum hat die Fläche ihre eigene, dunklere Rolle. Steht
            Destruktives als Nebenaktion neben dem Hauptweg eines Dialogs, trägt es{" "}
            <code>dangerOutlined</code>, den <strong>Error-Secondary-Button</strong>: die Bauform von <code>outlined</code> mit
            Kontur und Schrift in Error - die Rückfrage danach bleibt{" "}
            <code>danger</code> (PO 2026-10-24); dazu der leise Knopf (<code>quiet</code>)
            weiter unten, der als einziger nicht über die Emphase leiser wird,
            sondern über die Schrift. Alle tragen{" "}
            <code>state</code> in der Basis und <code>rounded-flaeche</code>; es
            gibt kein <code>hover:bg-*</code> und kein Verschieben beim Drücken -
            die Zustands-Ebene färbt sich in der Farbe des Knopfinhalts ein und
            passt damit auf jede Stufe.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="filled">Training erstellen</Button>
            <Button variant="outlined">Filter zurücksetzen</Button>
            <Button variant="text">Abbrechen</Button>
            <Button variant="danger">Übung löschen</Button>
            <Button variant="dangerOutlined">Abo widerrufen</Button>
          </div>
          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Link (<code>variant=&quot;link&quot;</code>) - im Fliesstext
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Kein Knopf, sondern ein klassischer Link (PO 2026-10-25): Primary,
            unterstrichen, beim Überfahren dicker unterstrichen. Er hat keine
            Höhe, keine Polsterung und keine Zustands-Ebene und setzt keine
            eigene Schrift - er erbt den Schnitt des Texts, in dem er steht. Er
            gilt für Handlungen, die <strong>im Inhalt mitlaufen</strong>: die
            Aktionen einer Section Message (<Siehe id="meldungen" />), der
            Weg aus einem Leerzustand, eine Zeilenaktion wie «Der Serie folgen».
            Wechselt er die Seite, steht er als <code>ButtonLink</code>, sonst
            bleibt er ein <code>&lt;button&gt;</code>.
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface">
            Ort weicht von der Serie ab.{" "}
            <Button variant="link">Der Serie folgen</Button>
          </p>
          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Leiser Knopf (<code>variant=&quot;quiet&quot;</code>) - eine Stufe unter{" "}
            <code>text</code>
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Alle Knöpfe stehen normal gesetzt in <code>type-title-small</code>{" "}
            (Geist 600, 14/20), nicht versal - wie die Reiter - und sind 36 px
            hoch; eine Grössen-Prop gibt es nicht mehr. Der leise Knopf ist die{" "}
            <strong>knappe Bauform</strong> des <code>text</code>-Knopfes:
            dieselbe Farbe und Schrift, nur mit knapperer Polsterung. Er gilt
            für Handlungen, die <strong>am Rand mitlaufen</strong>: ein Knopf in
            einer Leiste aus Chips, auf deren Linie er sitzen soll. Er gilt{" "}
            <strong>nicht</strong> für
            Knöpfe, die einen Vorgang abschliessen oder abbrechen -
            Formularfüsse und alles, was neben einem <code>filled</code> steht,
            bleibt <code>text</code>. Im Fuss eines Dialogs steht der Ausweg
            («Abbrechen», «Schliessen», «Verstanden») immer als Secondary Button
            (<code>outlined</code>) - auch als einzige Aktion.
          </p>
          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Umgekehrter Knopf (<code>variant=&quot;umkehr&quot;</code>) - auf einer Fläche im Fehlerton
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Die umgekehrte Fläche der Snackbar mit der Farbe des Grunds als
            Schrift. Neu, weil auf einer Fläche im Fehlerton <code>filled</code>{" "}
            (Violett auf Rot) zu laut wäre und <code>outlined</code> unterginge: die eine
            Handlung «Wieder anmelden» am abgemeldeten nächsten Termin hinter dem
            privaten Link (Epic #433). Sonst bleibt es bei den Varianten oben.
          </p>
          <div className="flex flex-wrap items-center gap-3 rounded-flaeche kontur border-kante bg-section-danger/60 p-4">
            <span className="type-body-medium text-on-surface">Lena Meier ist abgemeldet.</span>
            <Button variant="umkehr">Wieder anmelden</Button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
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
            Button-Link (navigiert als &lt;a&gt; - kein &lt;a&gt;&lt;button&gt;-Nesting)
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <ButtonLink href="#" variant="filled">Neue Übung</ButtonLink>
            <ButtonLink href="#" variant="outlined">Bearbeiten</ButtonLink>
          </div>

          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Icon-Knöpfe - Zeichen plus Zustands-Ebene, aktiv in Primary; die
            Hauptaktion einer Zeile (<code>primary</code>, etwa Kopieren im{" "}
            <code>KopierFeld</code>) ist gefüllt wie <code>filled</code>: Primary-Fläche, dunkles Zeichen
          </p>
          <div className="flex items-center gap-4">
            <IconButton icon={Search} label="Suchen" />
            <IconButton icon={SlidersHorizontal} label="Filter" active />
            <IconButton icon={Plus} label="Hinzufügen" />
            <IconButton icon={Plus} label="Hinzufügen" variant="overlay" />
            <IconButton icon={Copy} label="Kopieren" primary />
            <span className="type-label-small text-on-surface-mittel">
              ruhig · aktiv (<code>state-primary</code>) · overlay (06dp über Bild) · Hauptaktion (<code>primary</code>)
            </span>
          </div>

          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Punkt am Zeichen (<code>ZeichenPunkt</code>, <code>punkt</code>) - wie die Benachrichtigung an einem App-Symbol
          </p>
          <div className="flex items-center gap-4">
            <span className="relative inline-flex h-9 w-9 items-center justify-center text-on-surface-mittel">
              <span className="relative">
                <Tag size={18} strokeWidth={2} aria-hidden />
                <ZeichenPunkt ton="primary" />
              </span>
            </span>
            <IconButton icon={Link2} label="Privater Link, bezogen" punkt="success" />
            <span className="type-label-small text-on-surface-mittel">
              primary: Neues (Version, schmale Leiste) · success: ein erreichter Zustand (Link bezogen). Nur das
              Bemerkenswerte trägt einen Punkt, der Normalfall keinen - sonst wird die Liste laut. Stumm - was er
              meldet, steht im Namen des Knopfs.
            </span>
          </div>

          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Icon-Knopf als Link (<code>IconButtonLink</code>) + Tooltip (24dp)
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <code>IconButtonLink</code> ist die Navigations-Variante (rendert ein{" "}
            <code>&lt;a&gt;</code> statt <code>&lt;button&gt;</code>, gleiche Optik).
            <code>Tooltip</code> umschliesst einen Trigger ohne Text und macht ihn
            lesbar - Pflicht, sobald das Zeichen allein mehrdeutig ist (Globus =
            öffentlich vs. Schloss = privat). CSS-only, <code>aria-hidden</code>
            (der Name kommt schon vom <code>aria-label</code> des Triggers). Er
            steht auf 24dp wie der Dialog: Was über allem schwebt, trägt die
            oberste Stufe. Verborgen ist er <code>display: none</code>, damit er
            am Rand die Seite nie verbreitert. Mit <code>ende</code> steht er
            bündig zur rechten Kante des Triggers statt mittig - für Trigger am
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
            Drucken (<code>PrintButton</code>)
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Öffnet den Druckdialog des Browsers. Auf der Druckansicht eines
            Trainings ist Drucken der Zweck der Seite - dort steht er beschriftet
            und gefüllt; auf der Übungsseite ist er eine Aktion unter mehreren
            und reiht sich als Icon-Knopf ein (<code>variant=&quot;icon&quot;</code>).
            Im Druck blendet ihn der Aufrufer aus.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <PrintButton />
            <PrintButton variant="icon" />
          </div>

          <p className="type-label-small mb-2 mt-6 text-on-surface-mittel">
            Ansichts-Umschalter (<code>TabNav</code>)
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Mehrere Sichten auf denselben Gegenstand - etwa ein Team mit
            Trainingsplan, Trainings und Verwaltung. Bewusst Links statt
            Schaltflächen: jede Ansicht hat ihre eigene Adresse, ist damit
            weitergebbar, und der Zurück-Schritt des Browsers funktioniert.
            Deshalb auch kein Auswahl-Baustein (<Siehe id="offene-einfachauswahl" />,{" "}
            <Siehe id="einfachauswahl-panel" />) - die sind
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
            Überlaufmenü (<code>OverflowMenu</code>) - der Ort für Destruktives
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Reihen aus Icon-Knöpfen enden mit einem ⋮. Dort liegt, was nicht offen
            stehen soll - allen voran Löschen und Entfernen: ein Klick daneben darf
            nichts Unwiderrufliches auslösen, darum zweistufig (⋮ → Eintrag →
            Bestätigungsdialog). Deshalb hat <code>IconButton</code> bewusst
            <strong> keine</strong> danger-Variante. Trigger-Zustand und -Ref
            stecken in der Komponente: ein geteilter Ref zeigte stets auf den
            zuletzt gerenderten Trigger, und der Outside-Click-Handler erkennt
            dann den eigenen Trigger nicht mehr - das Menü togglet doppelt und
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
              wird im aktiven Zustand <strong>gefüllt</strong> - der etablierte,
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

        <Section id="textfelder">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Leer steht der Name im Feld, sonst darüber</strong> (Epic
            #363, nach dem Vorbild von Jira). Ein leeres Feld zeigt nur seinen
            Namen, gedämpft an der Stelle des Werts - kein zweiter Satz wie
            «… wählen», ein Formular mit vielen leeren Feldern bleibt eine ruhige
            Liste von Namen. Klickt man hinein oder steht ein Wert drin, springt
            der Name in eine eigene Zeile darüber, und das Feld wird um diese
            Zeile höher - eine von Anfang an freigehaltene Zeile wäre zu
            grosszügig. Im Fehler steht der Name immer darüber. Er steht dort klein und gedämpft in der Lesetype (
            <code>type-body-small</code>), nicht in der Versal-Type der Label - er
            benennt, er ruft nicht. Darunter folgt der Feldkasten, darunter
            Hinweis oder Fehler in derselben kleinen Schrift.
            Der Rahmen dafür ist <code>Feld</code>. Jedes Feld trägt genau einen
            Namen: Zwei zusammengehörige Werte (Länge und Breite, Mindest- und
            Höchstanzahl) sind zwei Felder untereinander, nicht ein gemeinsamer
            Name über zwei Teilnamen - zwei Namensstufen brächen die ruhige
            Liste aus Namen und Werten (PO 2026-10-04). Bildet ein Knopf mit
            dem Feld eine Handlung (Mitglied suchen),
            steht er in <code>aktion</code>: in derselben Zeile wie der
            Feldkasten, auf einer Linie mit ihm - ob der Name darüber steht oder
            das leere Feld ihn ausblendet.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Der Feldkasten ist ruhend leer:</strong> keine Kontur, keine
            Fläche (Utility <code>feldkasten</code>). Ein Formular liest sich so
            als Text statt als Stapel von Kästen. Beim Überfahren hellt die ganze
            Angabe auf, Name und Kasten zusammen, mit einer leisen Ebene in der
            Schriftfarbe (6 %), die ringsum 6 px über den Kasten hinausragt -
            gerade ein leeres Feld gibt sich so deutlich als Feld zu erkennen,
            ohne dass sich etwas verschiebt. Im Fokus trägt die Kontur Primary,
            bei Fehler und Befund Error. Die Stärke bleibt dabei immer
            1.5 px - nur die Farbe wechselt, der Kasten verschiebt sich beim
            Hineinklicken nicht. <strong>Der Name hält immer 6 px</strong> zu
            dem, was unter ihm sichtbar ist: im Fokus zur Kontur, ruhend - wo
            die Kontur fehlt - zur Schrift des Werts. Beim Hineinklicken springt
            er darum um 12 px hoch, ohne Übergang und ohne das Formular zu
            verschieben (nach dem Vorbild von Jira).
            36 px hoch wie jedes Bedienelement, der Wert in{" "}
            <code>type-body-large</code>. Wo ein Feld keinen sichtbaren Namen trägt
            - die Suche in der Filterleiste -, gibt <code>umrandet</code> ihm auch
            ruhend die Kante, sonst fehlte es dort schlicht.{" "}
            <strong>Auf Touch-Geräten</strong> gibt es kein Überfahren: Ein leeres
            Feld kündigt sich dort allein über seinen Namen im Feld an. Das ist
            gewollt (PO-Entscheid 2026-10-03, Variante «ohne Kontur») - jedes
            Feld zeigt entweder seinen Namen oder einen Wert.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Hinweise:</strong> Was ein Feld nur erklärt («Höchstens 200
            Zeichen»), steht nach dem Vorbild von Jira hinter einem ⓘ rechts
            im Feld (<code>info</code>, Baustein <code>InfoKnopf</code>): beim
            Zeigen ein Tooltip, ein Klick öffnet ein kleines Panel. Das ⓘ zeigt
            sich <strong>nur beim Überfahren</strong> der Angabe - nicht ruhend,
            nicht während man im Feld arbeitet, und auf Touch-Geräten gar nicht
            (PO 2026-10-04). Muss man den Hinweis auch dort lesen, bevor man
            weitermacht - dass die Altersstufe eines Trainings lebenslang bindet
            oder dass die Eltern den Grund eines Ausfalls sehen -,
            zeigt <code>infoAufTouch</code> ihn auf Touch-Geräten als Hinweis
            unter dem Feld. Das ⓘ steht senkrecht mittig auf der ganzen Angabe,
            zwischen Name und Wert. Die Tastatur erreicht es weiterhin und macht
            es dabei sichtbar; die Vorlesehilfe hört den Hinweis ohnehin mit dem
            Feld. Fehler und Hinweise, die
            sich mit der Eingabe ändern, bleiben sichtbar unter dem Feld (
            <code>supportingText</code>) - die muss man sehen, ohne zu klicken.
            Ein fester Hinweis steht also <strong>nie dauernd unter einem
            Feld</strong>, auch nicht in eigenen Bausteinen. Betrifft ein Hinweis
            mehrere Felder, wird er auf sie aufgeteilt: Jedes Feld sagt hinter
            seinem ⓘ, was für es gilt - kein Sammelhinweis über einer Gruppe
            (PO 2026-10-06).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Grosser Wert (<code>schrift=&quot;title&quot;</code>):</strong>{" "}
            Für den Namen, mit dem etwas erst angelegt wird - zuoberst in
            «Neues Training» und «Neue Übung», nach dem Vorbild der Zusammenfassung in Jira. Der
            Wert steht in <code>type-title-large</code>, das Feld ist 44 px hoch;
            Name, Fläche beim Überfahren und das Verhalten leer und gefüllt
            bleiben die eines gewöhnlichen Felds. Wo ein bestehender Name dort
            geändert wird, wo er steht, gilt weiter das Kopf-Feld.
          </p>
          <div className="grid max-w-md gap-6">
            <TextField label="Name des Trainings" schrift="title" />
            <TextField label="Name des Trainings" schrift="title" defaultValue="Passspiel im Quadrat" />
            <TextField
              label="Übungsname"
              info="Ein fester Hinweis steht hinter dem ⓘ, nicht dauernd unter dem Feld."
            />
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
              supportingText="Leer zwei Zeilen hoch - wächst bis 10 Zeilen, dann scrollen."
            />
            <TextArea
              label="Weiteres Material"
              supportingText="Leer steht der Name im Feld; der Hinweis darunter bleibt."
            />
          </div>

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Suchfeld (<code>SearchField</code>)
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Dasselbe Feld, dessen Zeichen aber <strong>rechts</strong> steht - an
            demselben Platz, an dem das Passwortfeld sein Auge trägt. Das ist die
            Hausregel: <strong>links steht Schmuck, rechts steht
            Bedienbares.</strong> Und das Zeichen am Suchfeld ist beides
            nacheinander - solange nichts eingegeben ist, sagt die Lupe, wofür das
            Feld da ist; sobald etwas dasteht, tritt an ihre Stelle ein Kreuz, das
            die Suche mit einem Klick leert und den Cursor zurück ins Feld setzt.
            Das Kreuz meldet sich über dasselbe <code>onChange</code> wie eine
            Tastatureingabe - es gibt keinen zweiten Rückkanal, den ein Aufrufer
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

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Kopf-Feld (<code>HeadlineField</code>)
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Für den Fall, in dem ein vom Trainer vergebener Name dort geändert
            wird, wo er steht - der Trainingsname im Editor-Kopf und der Name beim
            Bearbeiten einer Übung. Es trägt die
            Schrift der Überschrift (<code>type-headline-medium</code>), damit der
            Kopf seine Gliederung behält, und zeigt sich in{" "}
            <strong>drei Lagen</strong>: Ruhend sieht man eine Überschrift und
            kein Feld - keine Kontur, keine Fläche. Beim Zeigen legt sich eine
            Fläche darunter (<code>bg-elev-04</code>), und die ist die ganze
            Ankündigung: Hier lässt sich etwas eintragen. Erst im Fokus kommt die
            Kontur in Primary. Die Stufe 04 ist mit Absicht kein Nachbar der
            Karte, auf der das Feld gewöhnlich liegt (01): Eine Stufe darüber wäre
            rechnerisch eine Fläche und am Bildschirm keine.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Es folgt derselben Idee wie der Feldkasten - ruhend nichts, beim
            Zeigen eine Fläche, im Fokus die Kontur -, nur in der Schrift der
            Überschrift und ohne Namen darüber. Die Konturstärke bleibt zwischen
            Ruhe und Fokus gleich und wechselt nur die Farbe - ein Sprung verschöbe
            bei 28 px Schrift die ganze Zeile sichtbar.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Kein Name darüber:</strong> Der Wert <em>ist</em> bereits
            die Überschrift, ein Label daneben benennte dieselbe Sache ein zweites
            Mal. Den Namen trägt darum <code>aria-label</code> - Pflicht, nicht
            Kür. Und weil ein <code>&lt;input&gt;</code> keine Überschrift ist,
            gehört daneben eine echte, nur vorgelesene (<code>sr-only</code>),
            sonst verlöre die Seite ihre Gliederung.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Schrift der Überschrift, die es ersetzt:</strong>{" "}
            <code>schrift=&quot;headline&quot;</code> (Vorgabe, Trainingsname) oder{" "}
            <code>schrift=&quot;title&quot;</code> für den Namen einer Übung - ihre
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

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Zahlenfelder
          </h4>
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

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Befund am Feld (<code>befund</code>) und gemischter Supporting-Text
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Zwei Ergänzungen aus der Gruppenverteilung (Story #151).{" "}
            <code>befund</code> färbt den Rahmen in Error: Der Wert ist
            gespeichert und richtig erfasst, geht aber mit anderen nicht auf -
            etwa eine Dauer in einem Wechsel, dessen Übungen ungleich lang sind.{" "}
            <strong>Befund und Fehleingabe tragen dieselbe Farbe; sie
            unterscheiden sich in <code>aria-invalid</code> und im Verhalten, nicht
            im Bild.</strong> Material kennt nur eine Fehlerrolle; Atlassians
            Warnfarbe (<code>warning</code>) gehört der Lozenge und der Section
            Message, nicht dem Feld. Was bleibt, ist der Unterschied im Verhalten: Ein <code>error</code>{" "}
            weist die Eingabe ab und meldet sich der Vorlesehilfe als ungültig, ein{" "}
            <code>befund</code> lässt speichern und trägt seinen Satz im
            Supporting-Text. Am Rahmen gilt die Rangfolge <code>error</code> &gt;{" "}
            <code>befund</code> &gt; Fokus: Der Fokus färbt nur den ruhigen Rahmen
            um und zeigt sich im Fehler über einen halben Pixel nach innen, damit
            ein Befund nicht ausgerechnet beim Hinschauen verschwindet. Weil der Rahmen allein nur
            sehend wahrnehmbar ist, gehört zu <code>befund</code> ein Hinweis für
            Screenreader (an der Dauer einer Übung ein <code>sr-only</code>-Satz per{" "}
            <code>aria-describedby</code>).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <code>supportingText</code> nimmt seit derselben Story einen{" "}
            <code>ReactNode</code>, weil unter einem Feld zwei Aussagen in einer
            Zeile stehen können - so trägt die Gruppenzeile die Zeitsumme (eine
            Auskunft) und dahinter den Konflikt (ein Befund). Nur der zweite Teil
            ist eingefärbt - die ganze Zeile zu färben liesse nicht mehr erkennen,
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

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Hinzufügen in Feldgestalt
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Wo ein Formular eine Liste gleichartiger Einträge führt - Felder
            eines Termins, Material einer Übung -, steht unter der Liste kein
            Textknopf, sondern <code>HinzufuegenFeld</code>: eine Zeile in der
            Gestalt eines leeren Felds, nach dem Vorbild von «Add subtask» in
            Jira (PO 2026-10-06). Gleiche Höhe, gleicher Einzug und gleiche
            Schrift wie der Name im leeren Feldkasten, ruhend ohne Fläche, beim
            Überfahren dieselbe leise Aufhellung; ohne Zeichen - der Text sagt,
            was ein Klick tut (PO 2026-10-06). Ein
            fachlicher Hinweis zur ganzen Liste - was ein Eintrag ist - steht
            über <code>info</code> hinter dem ⓘ rechts in der Zeile, wie bei
            einem Feld nur beim Überfahren sichtbar.
          </p>
          <div className="grid max-w-md gap-6">
            <HinzufuegenFeld info="Was ein Eintrag dieser Liste ist und was nicht hierher gehört.">
              Eintrag hinzufügen
            </HinzufuegenFeld>
          </div>

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Datum &amp; Uhrzeit
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Für Trainings-Termine, mit Name und Feldkasten wie jedes Feld. Das
            native Steuerelement ist Absicht -
            Datumsauswahl, Tastatureingabe und Lokalisierung kommen vom
            Betriebssystem. Damit der Browser sie dunkel zeichnet - auch das
            Kalender- und Uhr-Zeichen im Feld -, erklärt sich die Anwendung als
            dunkel (<code>color-scheme: dark</code> auf <code>:root</code> und
            im Wurzel-Layout); der Druck schaltet auf hell um.{" "}
            <strong>Leer</strong> zeigt es sich wie jedes leere Feld (nach dem
            Vorbild von «Start date» in Jira, PO 2026-10-06): keine Maske
            («dd/mm/yyyy», «--:--») und kein Name darüber, sondern das Kalender-
            bzw. Uhr-Zeichen und der Name gedämpft im Feld. Ein Klick oder ein
            Wert bringt das native Steuerelement zurück.
          </p>
          <div className="grid max-w-md gap-6 sm:grid-cols-2">
            <DateField label="Datum" />
            <TimeField label="Beginn" />
          </div>

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Checkbox
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Für eine Ja/Nein-Angabe in einem Formular, die weitere Felder
            zuschaltet oder eine Folge hat - «Wiederholender Termin» im
            Termin-Dialog, «Foto entfernen» im Übungsformular. Neu ist sie, weil
            beide Stellen sonst ein unverkleidetes Browser-Kästchen trügen. Sie
            trägt dasselbe eckige Kästchen wie die Optionen der Mehrfachauswahl
            (<Siehe id="mehrfachauswahl" />): gewählt gefüllt in Primary, Haken in on-primary. Darunter liegt
            ein echtes <code>&lt;input type=&quot;checkbox&quot;&gt;</code>;
            das Label gehört zur Klickfläche. Zwischen Feldern eines Formulars
            steht sie auf der Linie der Feldnamen, eingerückt wie sie (
            <code>px-3.5</code>), damit alles linksbündig liest (PO 2026-10-06).
            Ein Filter ist sie nicht - der bleibt ein <code>FilterChip</code> (<Siehe id="plaketten" />).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Teilweise</strong> (<code>teilweise</code>, #452): Für eine
            Auswahl gilt die Angabe nur zum Teil - beim Zuteilen von Kadern
            gehört nur ein Teil der gewählten Spieler:innen einem Kader an. Das
            Kästchen ist gefüllt wie gewählt, trägt aber einen Strich statt des
            Hakens, und der Browser meldet «gemischt». Ein Klick macht daraus
            «gewählt»; zurück zum Strich geht es erst beim neuen Öffnen.
          </p>
          <CheckboxDemo />

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Schalter
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Für eine Ja/Nein-Angabe, die beim Umlegen sofort gilt - eine
            Spieler:in an einem Termin angemeldet oder abgemeldet (Epic #433).
            Neu neben der Checkbox, weil diese in ein Formular gehört, das man
            erst speichert; ein Schalter speichert selbst (Atlassian: Toggle
            nur für sofort wirkende Änderungen). Eine Form nach dem Vorbild von
            Proton: Die Bahn ist nur eine Kontur (<code>kontur</code> in{" "}
            <code>kante</code>) ohne Fläche, die Farbe trägt allein der Knopf
            (26 px). An steht er rechts in <code>primary</code> mit Haken in{" "}
            <code>on-primary</code>, aus links in <code>on-surface-mittel</code>{" "}
            mit Kreuz in <code>elev-01</code> - beide Lagen tragen ein Zeichen,
            damit der Zustand nicht an der Farbe allein hängt. Rot gibt es am
            Schalter nicht, auch nicht in langen Listen: Ein Fehlen, das
            auffallen soll, zeigen Lozenge und Kalenderblatt. Gesperrt, wenn es
            nichts mehr zu ändern gibt (der Termin hat begonnen);{" "}
            <code>neutral</code> mit kleinem grauem Knopf ohne Zeichen, wenn es
            nichts zu wählen gibt (er fällt aus) - und für die Aus-Lage eines
            Schalters, dessen Aus kein Fehlen bedeutet (die Selbstabholung eines
            Teams). <code>ton=&quot;ruhig&quot;</code> (Epic #490, Form seit PO 2026-10-30) für «angemeldet» und
            «da» von Spieler:innen an Trainings, am privaten Link und in der Spielerliste am Termin: Der Schalter zeigt
            den Stand, ohne ihn zu bewerten - dieselbe Form wie Primary, aber der Knopf bleibt in beiden Lagen grau:
            an rechts mit Haken, aus links mit Kreuz. Den Stand tragen Lage und Zeichen, nicht die Farbe. Primary mit
            dem violetten Knopf bleibt für «dabei» der Trainer:innen. Darunter liegt ein echtes{" "}
            <code>&lt;input type=&quot;checkbox&quot; role=&quot;switch&quot;&gt;</code>.
          </p>
          <SwitchDemo />

          <h4 className="mb-2 mt-8 type-title-medium text-on-surface">
            Kopierfeld
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein Geheimnis zum Weitergeben - privater Link einer Spieler:in,
            Abholadresse eines Teams (Epic #433): der Wert in einem Kasten mit Kontur,
            so hoch wie die Knöpfe daneben, ohne sichtbaren Namen und nicht
            bedienbar (kein Fokus), rechts davon der Kopier-Knopf (<code>KopierFeld</code>). Neu, weil
            drei Stellen dasselbe brauchten: Zwischenablage, Haken als Antwort,
            Live-Region für die Vorlesehilfe und ohne Zwischenablage den Handweg
            (Feld markiert, Hinweis darüber). Weitere Knöpfe derselben Zeile,
            etwa ein Menü mit «erneuern», kommen über <code>danach</code>.
          </p>
          <div className="max-w-md">
            <KopierFeld label="Privater Link" value="https://ki-fu.ch/abmelden/5764a2e8a97f4895aea125a811bda390" />
          </div>
        </Section>

        <Section id="feldgruppe">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Felder, die voneinander abhängen, in einem Rahmen mit gemeinsamer Legende
            (<code>Feldgruppe</code>). Neu, weil kein Baustein Felder umrandet
            zusammenfasst: Anlass waren Ort und Kartenlink eines Termins (#533) - der
            Link gehört zum Ort und fällt mit ihm weg. Der Rahmen zeigt das Paar auf
            einen Blick, stärker als eine Abschnittsüberschrift, die nur trennt
            (<code>FormAbschnitt</code>, siehe <Siehe id="layout" />). Nur für Felder,
            die zusammengehören, nicht für lose verwandte. Die Legende sitzt auf der
            Kontur in <code>type-label-medium</code>, die Kontur ist die eines Felds
            (<code>kante</code>); die Vorlesehilfe liest die Felder als eine Gruppe.
            Ein abhängiges Feld bleibt sichtbar und ist gesperrt, solange es nicht
            gilt - es erscheint nicht erst später (PO 2026-10-27).
          </p>
          <div className="max-w-md">
            <Feldgruppe legende="Ort">
              <TextField label="Ort (optional)" defaultValue="Turnhalle Wankdorf I & II, Morgartenstrasse 2b, Bern" />
              <TextField label="Kartenlink (optional)" defaultValue="https://maps.app.goo.gl/MRWFZj3ZQtsYGBFi9" />
            </Feldgruppe>
          </div>
        </Section>

        <Section id="externer-link">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein Verweis, der KiFu verlässt (<code>ExternerLink</code>): wie ein Link im
            Fliesstext - Primary, unterstrichen - und am Textende das Zeichen «extern»,
            damit man vor dem Antippen sieht, dass sich etwas ausserhalb öffnet. Öffnet
            in einem neuen Tab und gibt weder die Herkunftsseite noch das Fenster preis.
            Neu, weil <code>ButtonLink</code> nur innerhalb der Anwendung führt. Mit
            <code> einzeilig</code> kürzt ein langer Text mit «…», das Zeichen bleibt
            stehen - so steht der Ort mit Kartenlink auf der Karte der Eltern (#533).
          </p>
          <div className="flex max-w-xs flex-col items-start gap-3 type-body-medium">
            <ExternerLink href="https://maps.app.goo.gl/MRWFZj3ZQtsYGBFi9">Auf der Karte öffnen</ExternerLink>
            <ExternerLink href="https://maps.app.goo.gl/MRWFZj3ZQtsYGBFi9" einzeilig>
              Turnhalle Wankdorf I &amp; II, Morgartenstrasse 2b, Bern
            </ExternerLink>
          </div>
        </Section>

        <Section id="offene-einfachauswahl">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Genau <strong>ein</strong> Wert aus einer Menge, die offen liegt -
            kein aufklappendes Menü. <strong>Ein</strong> Baustein:{" "}
            <code>ChoiceChipGroup</code>, mit Pfeiltasten-Navigation und
            wanderndem Tabstopp.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die offene Einfachauswahl ist seit dem 2026-09-13 der{" "}
            <strong>Sonderfall</strong>, nicht die Regel: Formulare führen ihre
            Einfachauswahl in der <Siehe id="einfachauswahl-panel" />, ihre
            Mehrfachauswahl in der <Siehe id="mehrfachauswahl" /> - siehe den Kasten unten.
            Offen bleibt, was in kein Menü gehört: die{" "}
            <strong><Siehe id="variantenwahl" /></strong>, deren Werte der Trainer selbst
            benannt hat.
          </p>
          <p className="type-label-small mb-2 text-on-surface-mittel">
            <code>ChoiceChipGroup</code> - lange Werte, umbrechend
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Radiogroup-Semantik (<code>role=radiogroup</code> /{" "}
            <code>role=radio</code>, <code>aria-checked</code>) - es ist ein
            Eingabefeld, keine Ansicht, und darum keine Tabs. Optik aus den
            Chip-Bündeln, ausgewählt gefüllt in Primary
            (<code>chipSelected</code>) und <strong>ohne Häkchen</strong>:
            Einfachauswahl ist kein Ein/Aus-Zustand, und der Flächenwechsel trägt
            die Aussage bereits. Mit <code>look=&quot;nutzertext&quot;</code>
            steht die Wahl dagegen umrandet wie ein Filter (<Siehe id="plaketten" />).
            Die Chips <strong>umbrechen</strong> - das ist ihr eigentlicher
            Vorzug: Eine Reihe, die stattdessen seitlich scrollte, zeigte dem
            Nutzer seine Optionen nicht mehr nebeneinander. In Gebrauch ist der
            Baustein bei der <strong><Siehe id="variantenwahl" /></strong>, deren
            Bezeichnungen bis vierzig Zeichen lang sein dürfen.
          </p>
          <ChoiceChipDemo />

          <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
            <code>AuswahlListe</code> - Einträge mit Titel und Untertitel
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Dieselbe Radiogroup-Semantik wie die Chip-Gruppe, aber senkrecht und
            mit zwei Zeilen je Eintrag - für Trainings und Termine, die zu lang
            für Chips sind; ein <code>listbox</code> mit verschachtelten Knöpfen
            wäre kein gültiges ARIA. Pfeil hoch/runter wählt und bewegt den
            Fokus. Gewählt trägt der Eintrag eine Kontur in Primary und ein{" "}
            <strong>Häkchen</strong>, aber keine Fläche: Die Liste steht im
            Dialog auf 24dp, und jede tiefere Stufe läge dort eingesunken statt
            hervorgehoben. Die Schrift bleibt neutral - Primary trüge auf 24dp
            keine zwei Zeilen Lesetext.
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
              erst zu klicken. Das Argument gilt weiter - es verliert nur gegen
              ein stärkeres. Ein Formular mit sieben Auswahlfeldern, von denen
              zwei eine Segmentleiste sind, eins eine Chip-Reihe, zwei ein
              Auswahlmenü und zwei ein Chip-Bündel, sieht nicht nach Gewichtung
              aus, sondern nach Zufall: Der Trainer liest keine Rangordnung ab,
              er lernt vier Bedienweisen für dieselbe Handlung. Seit dem
              2026-09-13 führt die Maske darum jede Einfachauswahl als{" "}
              <Siehe id="einfachauswahl-panel" /> und jede Mehrfachauswahl als{" "}
              <Siehe id="mehrfachauswahl" /> (PO-Vorgabe). Die Tragweite trägt jetzt der
              Hilfstext unter dem Feld, nicht seine Bauform.
            </p>
          </div>

          <div className="mt-4 rounded-flaeche bg-elev-01 p-4">
            <p className="type-label-large mb-1 text-on-surface">
              <code>AltersstufeField</code> - eine Wahl, zwei Domänen
            </p>
            <p className="type-body-medium max-w-2xl text-on-surface-mittel">
              Übung und Training wählen dieselbe Altersstufe und teilen sich darum
              denselben Baustein im Kit - auch wenn er seit dem 2026-09-13 keine
              offene Wahl mehr ist. Er hat drei Zustände: <strong>Wahl</strong>{" "}
              (ein <code>Select</code>, siehe <Siehe id="einfachauswahl-panel" />), <strong>fest</strong> (neutrale{" "}
              <code>Lozenge</code> plus Erklärsatz) und <strong>ungewählt</strong>{" "}
              (<code>wert = null</code>). Der letzte ist der Ausgangszustand am
              Training: Die Wahl bindet dort lebenslang und darf nicht durch eine
              Voreinstellung durchrutschen - also steht dort der Leerfall als
              erste Option in der Liste, und nur dort. An der Übung ist sie
              vorbelegt, weil eine Übung umwandelbar bleibt; einmal gesetzt,
              lässt sich die Stufe nicht auf «keine» zurückstellen. Die Lozenge
              ist bewusst neutral: Die Altersstufe ist keine Alterskategorie und
              borgt deren Akzentfarben nicht. Der feste Zustand nimmt
              über <code>aktion</code> ein Bedienelement neben der Lozenge auf -
              dort hängt das Überführen einer eigenen Übung in die andere
              Altersstufe. Es gehört nicht ins Auswahlfeld: An einer
              gespeicherten Übung ist der Stufenwechsel kein Feld, sondern ein
              eigener, zu bestätigender Vorgang.
            </p>
          </div>
        </Section>

        <Section id="einfachauswahl-panel">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Auswahl <strong>eines</strong> Werts - kein natives{" "}
            <code>&lt;select&gt;</code>. Der Auslöser ist ein Feldkasten wie am
            Textfeld (<Siehe id="textfelder" />), mit dem Namen darüber; das aufgeklappte Panel ist ein Menü
            (08dp, Haarlinie, <code>shadow-dp-08</code>, Häkchen auf der Auswahl).
            Die Zeile, auf der die Tastatur gerade steht, trägt{" "}
            <code>state-aktiv</code> - dieselbe Deckung wie der Fokus, aber ohne
            echten <code>:focus-visible</code>, denn der liegt auf dem Trigger.
            Listbox-Semantik mit voller Tastatursteuerung (↑/↓, Home/End, Enter,
            Esc). Offen trägt der Auslöser die Kontur in Primary - er gehört dann
            zum Panel darunter. Den Pfeil zeigt das Feld nur, solange man darin
            arbeitet (Fokus oder offene Liste): Ruhend zeigt das Formular Namen
            und Werte, keine Bedienelemente - sobald man hineingeht, sagt der
            Pfeil, dass hier gewählt wird (nach dem Vorbild von Jira). Der gewählte Wert steht ganz im Feld und bricht
            um, statt abgeschnitten zu werden: Eine Einordnung ist oft ein Satz.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Keine Option «- kein … -»</strong>: Ist nichts gewählt, ist
            das Feld leer und zeigt nur seinen Namen (<Siehe id="textfelder" />) - bei einem optionalen
            Feld heisst das schon «nicht angegeben». Eine Option für «keiner»
            sähe aus wie eine getroffene Wahl und verdoppelte, was das leere Feld
            sagt. Wo «keiner» fachlich doch eine Antwort ist, gehört sie als
            eigener Wert ins Vokabular (beim Feldtyp etwa «Freies Feld»).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <code>group</code> stellt einer Option eine nicht wählbare Kopfzeile
            voran, sobald die Gruppe wechselt - wie bei der <Siehe id="mehrfachauswahl" />{" "}
            und mit derselben Pflicht: Die Optionen müssen gruppensortiert
            übergeben werden, sonst erscheint dieselbe Kopfzeile mehrfach. Das
            trägt die <strong>Einordnung einer Junioren-Übung</strong>: Gewählt
            wird einer der sieben Blöcke, der Trainingsteil steht als Kopfzeile
            darüber - so bleibt sichtbar, wozu ein Block gehört, ohne dass das
            Formular eine zweite Bedienebene aufmachen muss. Im Kinderfussball
            fällt die Gruppierung weg; dort ist der Trainingsteil selbst die
            Einordnung, vier flache Werte. Im Übungsformular laufen ausserdem
            Altersstufe, Hauptteilkategorie, Feldtyp und Übungstyp über diesen
            Baustein - jede Einfachauswahl der Maske, ohne Ausnahme
            (PO-Vorgabe 2026-09-13, siehe <Siehe id="offene-einfachauswahl" />).
          </p>
          <div className="grid max-w-md gap-6">
            <Select
              label="Feldtyp"
              defaultValue="kleinfeld"
              options={[
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
              supportingText="Jede Option ist ein Wert - kein Platzhalter nötig."
            />
            <Select
              label="Trainingsteil"
              defaultValue=""
              options={[
                { value: "auffangen", label: "Auffangen" },
                { value: "einleitung", label: "Einleitung" },
                { value: "hauptteil", label: "Hauptteil" },
                { value: "ausklang", label: "Ausklang" },
              ]}
              supportingText="Noch nichts gewählt: Der Name steht gedämpft im Feld."
            />
          </div>
        </Section>

        <Section id="mehrfachauswahl">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Auswahl <strong>mehrerer</strong> Werte im Formular: ein Feldkasten
            mit dem Namen darüber, der die gewählten Werte als kommagetrennte
            Zeile zeigt und umbricht, wo sie nicht in eine Zeile passen (Epic
            #363). Er öffnet ein Panel mit Suchfeld im Kopf, Optionsliste (eckige
            Checkbox, <code>rounded-klein</code>) und Aktions-Fuss
            (<code>Zurücksetzen</code> / <code>Alle auswählen</code>, respektiert
            den aktiven Filter). Keine Tags im Feld: Entfernt wird in der Liste,
            wo auch gewählt wird; ein Kreuzchen pro Wert im Feld wäre ein zweiter
            Ort dafür. Die Werte stehen in der Reihenfolge der Optionsliste,
            nicht in der des Anklickens: Dieselbe Auswahl soll immer gleich
            lauten. Ist nichts gewählt, ist das Feld leer und zeigt seinen Namen
            (<Siehe id="textfelder" />). Combobox- und Listbox-Semantik
            (<code>aria-multiselectable</code>) mit voller Tastatursteuerung (↑/↓,
            Home/End, Enter toggelt, Esc schliesst). <code>searchable</code> /{" "}
            <code>actions</code> einzeln abschaltbar für kurze feste Listen.{" "}
            <code>group</code> stellt einer Option eine nicht wählbare Kopfzeile
            voran, sobald die Gruppe wechselt - für Dimensionen, deren Werte aus
            zwei Welten stammen (in der Anwendung: die Altersstufe, siehe{" "}
            <code>lib/filter-optionen.ts</code>). Weil die Kopfzeile positional
            entsteht, müssen die Optionen gruppensortiert übergeben werden, sonst
            erscheint dieselbe Kopfzeile mehrfach. Eine einzige Gruppe ist
            ausdrücklich erlaubt und der Normalfall dort, wo eine Dimension ganz
            zu einer Welt gehört; die Beschriftung sagt dann, zu welcher. Die
            Kopfzeile ist nicht nur optisch: Jede Option verweist per{" "}
            <code>aria-describedby</code> auf sie, damit die Zugehörigkeit auch
            vorgelesen wird («Wert, Gruppe») - sonst hörte man eine lange Liste
            ohne jede Gliederung. <code>zusatz</code> setzt unter den Namen einer
            Option eine gedämpfte zweite Zeile - nötig, wo der Name allein eine
            Option nicht erkennen lässt (in der Anwendung: die Eingeladenen
            eines Termins, deren Anzeigename gleich lauten oder eine
            automatische Kennung sein kann, darunter die E-Mail-Adresse). Die
            Zeile bricht an jeder Stelle um statt zu kürzen, weil gerade der
            abgeschnittene Teil zwei Optionen unterscheiden kann; die Suche
            findet auch sie, im Feld steht nur der Name.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Der Baustein trägt beide Mehrfachauswahlen des Übungsformulars -{" "}
            <strong>Alterskategorie</strong> und{" "}
            <strong>Erscheinungsform</strong>; die Filterleisten führen ihre
            Dimensionen dagegen als <Siehe id="filterknopf" />. Im Formular unterscheiden sich die beiden in der
            Ausstattung: Die Alterskategorie schaltet <code>searchable</code> und{" "}
            <code>actions</code> ab (drei bis vier kurze Werte liest man
            schneller, als man sie filtert), die Erscheinungsform behält beides
            (der Junioren-Katalog führt elf Werte, und jeder ist ein ganzer Satz).
            Im Formular heisst nichts gewählt <em>nichts</em>, im Filter{" "}
            <em>alles</em> - darum ist der Filter ein eigener Baustein (<Siehe id="filterknopf" />).
          </p>
          <MultiSelectDemo />

          <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
            <code>WochentagWahl</code> - sieben feste Werte, sichtbar
          </p>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            Für die sieben festen Wochentage einer Terminserie; alle Werte stehen
            sichtbar nebeneinander. Neu ist der Baustein, weil die
            Mehrfachauswahl ein Panel öffnet - bei sieben kurzen Werten, die man
            auf einen Blick vergleichen will, wäre das ein Klick zu viel. Jeder
            Wert ist ein <code>FilterChip</code> (Ein/Aus, <code>aria-pressed</code>,
            gewählt in Primary umrandet); das Kürzel steht sichtbar, der volle
            Wochentag für Screenreader. Montag zuerst, die Wahl bleibt sortiert.
            Ein Fehler steht unter den Chips.
          </p>
          <WochentagWahlDemo />
        </Section>

        <Section id="variantenwahl">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Zwischen den <strong>Varianten des Hauptteils</strong> eines Trainings
            wechseln (Epic „Hauptteil-Varianten"). Kein neuer Baustein, sondern
            eine Anwendung der <code>ChoiceChipGroup</code> (<Siehe id="offene-einfachauswahl" />) - hier steht,
            warum gerade sie:
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
            <li>
              Die Werte sind <strong>Nutzertext</strong> - bis vierzig Zeichen,
              vom Trainer vergeben. Eine Reihe, die damit seitlich scrollte,
              zeigte ihm seine Varianten nicht mehr nebeneinander; Chips
              umbrechen stattdessen. Aus demselben Grund steht die gewählte
              Variante umrandet und nicht gefüllt (siehe <Siehe id="plaketten" />).
            </li>
            <li>
              Es ist <strong>ein Element von n</strong> und keine Ansicht:
              Radiogroup-Semantik, nicht die tab-artige Leiste.
            </li>
            <li>
              Bei <strong>einer</strong> Variante rendert sie <strong>nichts</strong>.
              Ein Training ohne zweite Variante sieht aus wie vorher - eine
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
              eigenen Zeile unter dem Kartenkopf des Hauptteils - nicht IM Kopf:
              Dort stehen Überschrift und Dauer-Summe, und eine umbrechende
              Chip-Reihe daneben risse die Kopfzeile auseinander. Über der
              Gruppenleiste, weil die Variante die grössere Klammer ist: Sie
              entscheidet, welche Übungen darunter stehen; die Gruppen gelten für
              alle Varianten.
            </p>
          </div>

          <p className="type-body-medium mb-5 mt-8 max-w-2xl text-on-surface-mittel">
            <strong>Auf Server-Seiten: dieselbe Optik, aber Links.</strong> Ansehen
            und Drucken halten keinen Zustand - die angezeigte Variante steht im
            Suchparameter, jede Variante hat damit eine eigene{" "}
            <strong>Adresse</strong>. <code>VariantenLinks</code> rendert darum{" "}
            <code>&lt;nav&gt;</code> mit Links und <code>aria-current=&quot;page&quot;</code>,
            leiht sich aber die Nutzertext-Pille der <Siehe id="offene-einfachauswahl" /> (<code>chipTextBase</code>,{" "}
            <code>chipTextOutlined</code>, <code>chipTextSelected</code>): gleiche
            Sache, gleiches Bild. Kein wandernder Tabstopp - durch Links tabbt man,
            Pfeiltasten gehören der Radiogroup. Nicht <code>TabNav</code> (<Siehe id="knoepfe" />): Die
            wechselt die <em>Sicht</em> auf einen Gegenstand; hier bleibt die Sicht
            dieselbe und der <em>Inhalt</em> wechselt. Weil Nutzertext versal
            verfälscht stünde, kennt <code>ChoiceChip</code> seit dem Chip-Umbau
            ein <code>look=&quot;nutzertext&quot;</code> mit
            denselben Bündeln: dieselbe Pille, aber normal gesetzt und h-9 hoch,
            damit sie neben dem geteilten <Siehe id="chip-menue" /> und dem leisen Knopf (<Siehe id="knoepfe" />)
            auf einer Linie sitzt.
          </p>
          <p className="type-label-small mb-2 text-on-surface-mittel">
            drei Varianten als Links - die offene trägt <code>aria-current</code>
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

        <Section id="filterknopf">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Ein Filter ist ein Knopf mit seinem Namen</strong> (Epic
            #363, nach dem Vorbild der Filter in Jira). Er nennt, <em>wonach</em>{" "}
            gefiltert wird, und zählt, wie viele Werte gewählt sind;{" "}
            <em>welche</em>, sieht man im geöffneten Panel. So bleibt eine
            Filterleiste eine Zeile aus Wörtern - auf dem Handy umbrechend, aber
            nie ein Stapel aus Feldern mit abgeschnittenen Wertlisten. Neu ist
            der Baustein, weil die <Siehe id="mehrfachauswahl" /> ein Formularfeld ist: Sie
            zeigt ihre Werte, weil sie dort die Eingabe <em>sind</em>; im Filter
            sind sie nur ein Zustand der Übersicht.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Er trägt <strong>Schrift und Kleid des Filter-Chips</strong> (<Siehe id="plaketten" />), der
            in derselben Leiste steht - normal gesetzt in{" "}
            <code>type-body-medium</code>, leiser als ein halbfetter Knopf, denn
            er grenzt ein, statt etwas auszulösen; nur eckig statt rund, weil er
            ein Panel öffnet statt bloss umzuschalten. Grenzt er ein, steht er in
            Primary umrandet wie ein gewählter Chip und trägt die Zahl als{" "}
            <code>Badge</code> (<Siehe id="plaketten" />) - vorgelesen wird «Alterskategorie, 2
            gewählt». Das Panel
            ist breiter als der Knopf, wo der Inhalt es braucht (bis 34 rem; der
            längste Übungstyp misst 484 px), und rückt am rechten Rand nach links
            (<code>usePanelAnker</code>, geteilt mit der Mehrfachauswahl). Es ist
            kein Menü und keine Listbox, sondern eine Gruppe gewöhnlicher
            Bedienelemente: Kontrollkästchen im <code>AuswahlFilter</code>, ein
            Zahlenfeld im <code>ZahlFilter</code> («Verfügbare Kinder»). ↑/↓ wandern zwischen ihnen, Esc
            schliesst und gibt den Fokus an den Knopf zurück. Eine Wahl wirkt
            sofort, das Panel bleibt offen; Zahl und Suche wirken nach einer
            Tipppause.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Suche der Leiste (<code>FilterSuche</code>) steht ohne
            sichtbaren Namen, dafür umrandet und mit Platzhalter (<Siehe id="textfelder" />) - ohne Kante stünde neben den umrandeten
            Knöpfen ein Feld, das man nicht sieht. Schalter wie «Meine Übungen»
            bleiben <code>FilterChip</code> (<Siehe id="plaketten" />): Sie haben kein Panel, nur an
            und aus.
          </p>
          <FilterKnopfDemo />
        </Section>

        <Section id="menue">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Verankertes Dropdown (Klick daneben oder Escape schliesst) auf{" "}
            <code>bg-elev-08</code>, mit <code>border-linie</code>,{" "}
            <code>rounded-flaeche</code> und <code>shadow-dp-08</code>: Es
            schwebt, also trägt es beides - Höhe und Schatten. Jede Zeile trägt{" "}
            <code>state</code>, Destruktives steht zuunterst und trägt Error als
            Schrift, nie als Fläche. Steht das Menü für eine Wahl unter wenigen
            Möglichkeiten (Darstellung, #567), tragen die Einträge{" "}
            <code>gewaehlt</code>: Sie werden zu <code>menuitemradio</code>, die
            gewählte zeigt rechts den Haken in Primary. Ein Satz, der für alle
            Einträge gilt, steht als <code>fuss</code> leise darunter.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Error trägt hier als Fliesstext: Das Panel liegt auf 08dp, und dort
            kommt die Rolle auf {v(kontrast(ERROR, elev(8)))}. Mit Materials
            Baseline war das eine bewusste Abweichung ({v(kontrast("#cf6679", elev(8)))}
            {" "}- unter den 4.5:1); seit Error eine Stufe heller ist (siehe <Siehe id="farbrollen" />),
            ist es keine mehr. Die Zeile trägt die Farbe trotzdem nicht allein:
            Sie steht abgesetzt am Fuss, hat ihr eigenes Zeichen, und der Vorgang
            ist zweistufig (Eintrag → Bestätigungsdialog). Das Rot verstärkt eine
            Aussage, die auch ohne es ankommt.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Trenner, Hinweis, Ziel</strong> (Epic #490, für die <code>LozengeAuswahl</code>):{" "}
            <code>trenner</code> setzt einen Strich vor einen Eintrag - Seltenes steht danach;{" "}
            <code>hinweis</code> setzt einen leisen Satz unter die Zeile, mit ihr verknüpft
            (<code>aria-describedby</code>), etwa wohin ein Rückgängig führt; <code>trailing</code> nimmt
            neben einem Kürzel auch ein Element, etwa Pfeil und Ziel-Lozenge eines Wechsels.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Tastatur:</strong> Beim Öffnen springt der Fokus auf den
            ersten Eintrag, <kbd>↑</kbd>/<kbd>↓</kbd> laufen zyklisch,{" "}
            <kbd>Home</kbd>/<kbd>End</kbd> an die Enden. Den Fokus an den Trigger
            zurück geben nur <kbd>Esc</kbd> und eine getroffene Auswahl - ein
            Klick daneben <strong>nicht</strong>: dort will die Nutzerin gerade
            woanders hin, ein Rücksprung risse ihr den Fokus vom eben geklickten
            Element weg. Voraussetzung ist, dass der Trigger als{" "}
            <code>triggerRef</code> übergeben wird.
          </p>
          <MenuDemo />
        </Section>

        <Section id="chip-menue">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein Chip, der ein Menü öffnet - für Werte, die man an ihrem Ort
            umsortieren oder herausnehmen können muss.{" "}
            <strong>Warum der Assist-Chip nicht reicht:</strong> Der{" "}
            <code>AssistChip</code> löst genau eine Aktion aus, nicht mehrere zur
            Wahl. Er trägt ausserdem <code>type-label-medium</code>, also
            versal: ein Gruppenname stünde dort verfälscht (siehe Regel
            unter <Siehe id="typografie" />). Der Chip mit Menü trägt darum{" "}
            <code>type-body-medium</code> und ist <strong>ein</strong>{" "}
            Bedienelement mit <strong>einem</strong> Tabstopp - kein Chip plus
            angehängter Knopf.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Geteilte Bauform (<code>onSelect</code>).</strong> Sobald an
            demselben Wert <strong>zwei</strong> Aufgaben hängen - „zeig mir
            diese Variante" und „benenne, verschiebe, entferne sie" -, wird der
            Chip in der Mitte geteilt: links wählen, rechts das Menü. Ein
            Menüeintrag „Anzeigen" allein reichte nicht, denn Wechseln ist die
            häufigste Handlung der Leiste und darf nicht zwei Klicks kosten. Die
            Menühälfte ist <strong>36 px</strong> breit wie jeder Icon-Knopf -
            ein eigenes Bedienelement, nicht ein angehängtes 16px-Chevron. Der Umriss gehört
            trotzdem der Gruppe: eine Reihe von Varianten, nicht eine Reihe von
            Knopfpaaren; der Trennstrich darin folgt dem Zustand.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Warum hier keine Radiogroup mehr</strong> (anders als bei der{" "}
            <Siehe id="variantenwahl" />): Eine Radiogroup verlangt genau EIN fokussierbares
            Element je Wert und übernimmt die Pfeiltasten. Hier sind es zwei
            Elemente, und die Pfeiltasten gehören dem geöffneten Menü. Die Wahl
            sagt darum <code>aria-pressed</code> an der linken Hälfte; durch die
            Leiste tabbt man.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <code>tone=&quot;befund&quot;</code> färbt Kontur und Chevron in
            Error, nie die Fläche - dieselbe Regel und dieselbe Farbe wie am Feld
            (<Siehe id="textfelder" />): Der Wert ist gespeichert, er geht bloss mit anderen nicht auf.
          </p>
          <ChipMenuDemo />
        </Section>

        <Section id="plaketten">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Lozenge</strong> heisst die Plakette wie bei Atlassian: ein
            kurzer Status oder eine Eigenschaft, auf einen Blick erkennbar - kein
            Bedienelement. Anatomie wie <code>@atlaskit/lozenge</code>: 20 px
            hoch, <code>rounded-flaeche</code> (4 px), 2 px Polsterung oben und
            unten, 4 px seitlich, <code>type-lozenge</code>, höchstens 200 px
            breit, Überlänge endet mit «…». Ein Zeichen davor (
            <code>iconBefore</code>) steht 12 px gross in der Schriftfarbe.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Darstellung (<code>appearance</code>) trägt Atlassians Namen und
            Bedeutung: <code>neutral</code> sagt, woher etwas stammt oder in
            welchem Zwischenstand es liegt (Kifu-Manual, Entwurf, Altersstufe,
            ausgefallen), <code>information</code>, was nach aussen gilt
            (Community, Öffentlich), <code>discovery</code> etwas Zusätzliches
            (mehrere Varianten, «Neu» an der Version), <code>warning</code> eine Lücke, die jemand
            schliessen muss (Termin ohne Training). <code>success</code> und{" "}
            <code>danger</code> stehen im Kit bereit. Herkunft und Sichtbarkeit
            stehen fertig als <code>HerkunftLozenge</code> und{" "}
            <code>SichtbarkeitLozenge</code>; der Entwurf trägt den Stift, damit
            er sich vom Manual-Bestand nicht nur im Wort unterscheidet. Ein Spiel
            trägt keine eigene Lozenge; es zeigt sich an Name und Status (Epic #490).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Über einem Bild</strong> (<code>aufBild</code>, etwa die
            Herkunft auf der Übungskarte): Die neutrale Fläche ist
            halbtransparent und hinge dort am Foto darunter. Mit{" "}
            <code>aufBild</code> steht sie im deckenden <code>accent-gray</code>,
            das am Schirm gleich aussieht und über jedem Bild trägt; alle
            übrigen Darstellungen sind ohnehin deckend.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {lozengeBedeutung.map(([darstellung]) => (
              <Lozenge key={darstellung} appearance={darstellung}>
                {darstellung}
              </Lozenge>
            ))}
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <HerkunftLozenge herkunft="manual" />
            <HerkunftLozenge herkunft="user" visibility="private" />
            <HerkunftLozenge herkunft="user" visibility="public" />
            <SichtbarkeitLozenge oeffentlich />
            <Lozenge appearance="discovery" iconBefore={Layers}>
              2 Varianten
            </Lozenge>
            <Lozenge>Kinderfussball</Lozenge>
            <Lozenge iconBefore={CalendarOff}>Ausgefallen</Lozenge>
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>Status in einem Wort</strong> (<code>terminStatus</code>, <code>spielStatus</code>,{" "}
            <code>meldeStatus</code>, Epic #490): über dem Namen eines Termins und an jeder Spieler:in eines Spiels. Die
            Farbe unterstreicht nur das Wort; Zahlen bleiben ungefärbt. Training: Vorbereitet grün, Nicht vorbereitet
            grau. Spiel gegen seinen Richtwert: Zu wenig und Zu viel rot, Knapp (genau die Mindestzahl) gelb, Genügend
            grün; ohne Richtwert keiner. Fällt aus grau. Spieler:in: Ohne Meldung gelb, nach der Meldefrist
            Meldefrist verpasst rot, Angemeldet grün, Abgemeldet und Nicht aufgeboten rot.
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Lozenge appearance="success">Vorbereitet</Lozenge>
            <Lozenge>Nicht vorbereitet</Lozenge>
            <Lozenge appearance="danger">Zu wenig</Lozenge>
            <Lozenge appearance="warning">Knapp</Lozenge>
            <Lozenge appearance="success">Genügend</Lozenge>
            <Lozenge appearance="danger">Zu viel</Lozenge>
            <Lozenge>Fällt aus</Lozenge>
            <Lozenge appearance="danger">Meldefrist verpasst</Lozenge>
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>SecondaryLozenge</strong> (Epic #518, PO 2026-10-25): dieselbe Form, nur die Kontur - wie
            Atlassians «Tag» und die Secondary Buttons. Sie steht NEBEN dem Status, nie an seiner Stelle: Den Status
            trägt höchstens eine gefüllte Lozenge. Kontur in der Füllfarbe der gefüllten Lozenge - die Zeichenfarbe war neben dem Status zu laut. Ohne Text nur das
            Zeichen; der Satz steht dann für Vorlesehilfe und Tooltip (<code>label</code>). Im Trainingsplan meldet sie
            Trainer-Lücken: Niemand verantwortlich gelb.
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1">
              <Lozenge>Nicht vorbereitet</Lozenge>
              <SecondaryLozenge appearance="warning" iconBefore={UserPen} label="Niemand verantwortlich" />
            </span>
            <SecondaryLozenge appearance="warning" iconBefore={UserPen}>Niemand verantwortlich</SecondaryLozenge>
            <SecondaryLozenge>Neutral</SecondaryLozenge>
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>ZeichenZahl</strong> (Epic #518): eine knappe Angabe mit Zeichen davor - mehrere auf einer Linie
            ersetzen Abschnitte mit Überschriften (Karte «Als Nächstes», Terminzeile). Ungefärbt; der ganze Satz ist
            ihr Name für die Vorlesehilfe und steht beim Überfahren da. <code>klein</code> in der Terminzeile.
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-5 text-on-surface">
            <ZeichenZahl icon={Shirt} label="Spieler:innen: 34 von 36 angemeldet · 2 abgemeldet">34/36</ZeichenZahl>
            <ZeichenZahl icon={UserRoundCheck} label="Trainer:innen: 3 von 3 dabei · Anna verantwortlich · du bist dabei">3/3</ZeichenZahl>
            <ZeichenZahl icon={LandPlot} label="Platz: 40 × 30 m · Kunstrasen">40 × 30 m · Kunstrasen</ZeichenZahl>
            <ZeichenZahl icon={Users} label="Trainer:innen: 2 von 2 dabei · du bist nicht eingeladen" klein>2/2</ZeichenZahl>
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>LozengeAuswahl</strong> (Epic #490): eine Lozenge, die zugleich der Knopf für ein Menü ist - wie
            Jiras Status-Lozenge. Neu, weil der Status einer Spieler:in dort geändert werden soll, wo er steht; sie
            ersetzt den Status-Chip mit Punkt. Sie sieht aus wie die Lozenge und ist genauso klein, dazu ein kleiner
            Chevron; die Trefferfläche ist unsichtbar auf mindestens 24 × 24 px vergrössert. Das Menü bietet nur die
            möglichen Wechsel, nie den aktuellen Zustand: links die Handlung, rechts Pfeil und Ziel-Lozenge, Seltenes
            nach einem Trenner, wenn nötig ein Hinweis darunter. Ohne Wechsel ist sie eine gewöhnliche Lozenge.
            Barrierefrei wie das Menü: Name «Status Person: Zustand», ↑/↓ und Escape.
          </p>
          <div className="mb-6">
            <LozengeAuswahlDemo />
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>Treffpunkte</strong> (<code>TreffpunktListe</code>, #465): die Treffpunkte eines Spiels in drei
            Spalten - Anreiseart, Zeit, Ort -, frühester zuerst. Das Datum steht nur bei einem Treffpunkt, der nicht am
            Spieltag liegt; vor Ort nennt den aktuellen Ort des Spiels. Kein eigener Baustein für die Liste der
            Eigenschaften, weil die Zeilen an Zeit und Ort ausgerichtet sein müssen.
          </p>
          <TreffpunktListe
            className="type-body-medium mb-6 max-w-md text-on-surface"
            spieltag="2026-10-31"
            spielOrt="Sportanlage Bodenweid, Bern"
            treffpunkte={[
              { anreise: "car", zeitpunkt: "2026-10-30T18:00", ort: "Clubhaus, Vorplatz" },
              { anreise: "oev", zeitpunkt: "2026-10-31T08:20", ort: "Bahnhof Bern, Treffpunkt" },
              { anreise: "vor_ort", zeitpunkt: "2026-10-31T09:15", ort: null },
            ]}
          />
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>Kader</strong> (<code>KaderLozenge</code>, Epic #447): ein
            Teil des Teams, den die Trainer:innen selbst benennen - in der
            Spielerliste, im Trainingsplan, am Termin und am privaten Link.
            Neutral und ohne Zeichen, nur der Name (PO 2026-10-18): Ein Kader
            trägt keine Farbe, und ein Zeichen machte aus jeder Zeile mit drei
            Kadern ein Muster. Ein entfernter Kader steht an begonnenen Terminen
            gedämpft als «Ehemaliger Kader».
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <KaderLozenge name="Stärkeklasse 1" />
            <KaderLozenge name="Torhüterinnen" />
            <KaderLozenge name={null} />
          </div>
          <p className="type-body-medium mb-3 max-w-2xl text-on-surface-mittel">
            <strong>Probe</strong> (<code>ProbeLozenge</code>, #555): eine
            Spieler:in im Probe-Modus, neben dem Namen in der Spielerliste und in
            der Karte «Probetraining». <code>discovery</code> - etwas Zusätzliches,
            kein Status. Die Zahl nennt besuchte Probetrainings von der Anzahl
            des Teams (PO 2026-10-29); angemeldete stehen am jeweiligen Training.
            Derselbe Ton trägt am privaten Link den Balken der Probetrainings:
            besucht gefüllt, angemeldet umrandet.
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <ProbeLozenge stand={{ anzahl: 4, besucht: 1, angemeldet: 2, moeglich: 1 }} />
            <ProbeLozenge stand={{ anzahl: 4, besucht: 3, angemeldet: 0, moeglich: 1 }} />
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-flaeche bg-[linear-gradient(135deg,#f5f5f0,#9aa79c)] p-3">
            <HerkunftLozenge herkunft="manual" aufBild />
            <HerkunftLozenge herkunft="user" visibility="private" aufBild />
            <HerkunftLozenge herkunft="user" visibility="public" aufBild />
            <span className="type-label-small text-on-umkehr">aufBild - über einem hellen Foto</span>
          </div>

          <p className="type-label-small mb-2 text-on-surface-mittel">
            Alterskategorien - Accent-Lozenges
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {kategorien.map((k) => (
              <KategorieLozenge key={k} k={k} />
            ))}
          </div>
          <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
            Wie Jira Kategorien ohne Wertung färbt, trägt jede Stufe einen festen
            Atlassian-Akzent (<code>accent-blue</code> bis{" "}
            <code>accent-gray</code>); der Titel nennt die Stufe ausgeschrieben.
            Die Zuordnung steht einmal in <code>KategorieLozenge</code> und gilt
            überall, wo eine Kategorie <em>angezeigt</em> wird - auch im Druck,
            wo die Rollen ins helle Theme wechseln. Wo eine <em>gewählt</em>{" "}
            wird, gilt sie seit dem 2026-09-13 nicht mehr: Die Alterskategorien
            stehen am Training, am Team und an der Übung in einer{" "}
            <Siehe id="mehrfachauswahl" />, und die führt Text, keine Lozenges
            (PO-Entscheid).
          </p>

          <p className="type-label-small mb-2 text-on-surface-mittel">Badge</p>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge>2</Badge>
            <Badge>12</Badge>
            <Badge>3×</Badge>
            <Badge appearance="neutral">14</Badge>
          </div>
          <p className="type-body-medium mb-6 max-w-2xl text-on-surface-mittel">
            <strong>Badge</strong> heisst der Zähler wie bei Atlassian: eine Zahl
            an einem Knopf, die zählt, was dessen Handlung bewirkt (gewählte Werte
            am Filterknopf, Übernahmen in der Übungsauswahl, die Spieler:innen,
            auf die ein Kader-Chip eingrenzt). Anatomie wie{" "}
            <code>@atlaskit/badge</code>: <code>rounded-klein</code>, 4 px
            seitlich, mindestens 24 px breit, <code>type-lozenge</code>. Gefüllt
            in Primary - Atlassians Markenfarbe ist bei uns das Violett -, weil sie
            als Teil des Knopfes gelesen wird, nicht als eigene Aussage über den
            Inhalt. Für die Vorlesehilfe stumm: Der Knopf sagt die Zahl in Worten.{" "}
            <code>appearance=&quot;neutral&quot;</code> (hell, <code>umkehr</code>) trägt ein Filter-Chip in Ruhe;
            gewählt wird seine Zahl Primary wie Kontur und Schrift.
          </p>

          <p className="type-label-small mb-2 text-on-surface-mittel">Chips</p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            Ungewählt steht jeder Chip auf der Kante. <strong>Gewählt gibt es
            zweimal.</strong> Umrandet (<code>chipTextSelected</code> -
            Primary-Kontur, Primary-Schrift, keine Fläche, kein Häkchen) sind der{" "}
            <strong>Filter</strong> und der Chip, der{" "}
            <strong>Nutzertext</strong> trägt - eine Variante, ein Gruppenname.
            Dasselbe trägt der eingrenzende <Siehe id="filterknopf" />. Ohne Fläche steht die
            Primary-Schrift auf dem dunklen Grund am klarsten (Epic #363); eine
            getönte Fläche nahm ihr Kontrast. Ein Filter steht neben Suchfeld, Auswahl und
            Knöpfen; gefüllt wäre er lauter als die Handlung daneben, und der
            Farbwechsel sagt «an» bereits. Eine gefüllte Fläche schriee zudem den
            Namen an, den die Trainerin selbst vergeben hat. Gefüllt
            (<code>chipSelected</code> - Primary-Fläche, schwarze Schrift) bleibt
            allein die <Siehe id="offene-einfachauswahl" />. Im geteilten Chip folgt der
            Trennstrich dem Zustand (<code>border-primary/50</code> gewählt,{" "}
            <code>border-kante</code> sonst).
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Schrift.</strong> Der <strong>Filter</strong> steht normal
            gesetzt in <code>type-body-medium</code>, wie der Nutzertext-Chip -
            er sitzt in Leisten neben Suchfeld, Auswahl und Knöpfen und liest
            sich dort als Wort («Meine Termine»), nicht als Rubrik, und bleibt
            leiser als der halbfette Knopf daneben, der die Handlung trägt.
            Der Assist-Chip und die offene Einfachauswahl bleiben versal in{" "}
            <code>type-label-medium</code>.
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Eine Höhe.</strong> Jeder Chip ist 36 px hoch, im Fliesstext
            wie in einer Filterleiste - dasselbe Mass wie Knopf, Feld und
            Filterknopf, darum fluchtet er überall ohne eigene Stufe.
          </p>
          <ChipsDemo />
        </Section>

        <Section id="meldungen">
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Ein leerer Abschnitt sagt zuerst nur, dass er leer ist -{" "}
            <code>type-body-small</code>, <code>text-on-surface-mittel</code>, kein
            Zeichen. Hat die Anwendung fachlich etwas dazu zu sagen (im
            Trainings-Editor: dieser Block gehört ins Training), tritt die
            Hinweiszeile an die Stelle dieser neutralen Zeile -{" "}
            <strong>nie beides</strong>. Dieselbe Sachlage erscheint nur einmal und
            nur in einem Schriftschnitt.
          </p>
          <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">
            Die Hinweiszeile trägt darum denselben Schnitt wie der Leerzustand und
            ordnet sich der Struktur unter: schwächer als Titel und Inhaltszeilen.
            Das Merkmal ist das <code>Info</code>-Zeichen (15 px,{" "}
            <code>text-primary</code>, <code>aria-hidden</code>) - es bleibt ohne
            Farbwahrnehmung erkennbar. Der Text nennt den Grund, die Position den
            betroffenen Abschnitt; er blockiert nichts. Zählende Meldungen einer
            ganzen Karte (<em>„Ungewöhnlich viele Übungen …"</em>) bleiben davon
            unberührt und stehen weiter als <code>type-label-medium</code> am
            Kartenfuss.
          </p>
          <p className="type-body-medium mt-4 max-w-2xl text-on-surface-mittel">
            <strong>Fläche für Blöcke einer dichten Karte:</strong> Trägt eine Karte
            mehrere gleichrangige Blöcke - die Unterkategorien des
            Kinderfussball-Hauptteils, die Blöcke des Junioren-Einstiegs -, steht
            jeder auf einer eigenen Fläche: <code>bg-elev-02</code>,{" "}
            <code>rounded-flaeche</code>, <code>p-3</code>. Also eine Stufe die
            Leiter hoch gegenüber der Karte, während die Inhaltszeilen darin auf{" "}
            <code>bg-elev-01</code> bleiben und sich dadurch als Inhalt{" "}
            <em>im</em> Block lesen. <strong>Nicht dieselbe Stufe wie die
            Karte:</strong> Bei gleicher Fläche verschwimmen Block und Karte, und
            ein leerer Block - beim Planen die wichtigste Auskunft - wäre bloss
            eine Zeile Text im Nichts. Ein Teil mit nur einem Block bekommt{" "}
            <em>keine</em> Fläche: Sie wiederholte dort bloss die Karte.
          </p>
          <div className="mt-6 max-w-xl">
            <Card className="p-4">
              <h2 className="type-title-medium text-on-surface">Hauptteil</h2>
              <div className="mt-4 flex flex-col gap-4">
                <div className="rounded-flaeche bg-elev-02 p-3">
                  <h4 className="type-title-small text-on-surface">
                    Vielseitigkeit erleben
                  </h4>
                  <p className="mt-2 type-body-small text-on-surface-mittel">
                    Noch keine Übung zugeordnet.
                  </p>
                </div>
                <div className="rounded-flaeche bg-elev-02 p-3">
                  <h4 className="type-title-small text-on-surface">Fussball spielen</h4>
                  <p className="mt-2 flex items-start gap-2 type-body-small text-on-surface-mittel">
                    <Info size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                    Das freie Spiel ist noch leer - im Kinderfussball gehört es in
                    jedes Training.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <h4 className="mb-2 mt-10 type-title-medium text-on-surface">
            Seiten-Leerfeld (<code>Leerzustand</code>)
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ist nicht ein Block leer, sondern eine ganze <strong>Liste</strong> -
            der Katalog ohne Treffer, die Team-Übersicht vor dem ersten Team -,
            dann steht an ihrer Stelle ein Feld mit <strong>gestrichelter</strong>{" "}
            Kontur, Zeichen, Titel und einem Satz zum Weiterkommen. Die
            gestrichelte Linie ist die ganze Aussage: Eine durchgezogene Kontur
            umreisst etwas, das da ist; die gestrichelte sagt, dass hier etwas
            hingehört und noch fehlt. Die Fläche bleibt der Grund - ein eigener
            Ton machte aus dem Fehlenden eine Karte.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Abgrenzung zur Block-Leerzeile oben:</strong> Die steht{" "}
            <em>innerhalb</em> eines Blocks, ist blosser Text und bekommt weder
            Rahmen noch Zeichen - ein Rahmen im Rahmen zöge einen zweiten Strich
            um etwas, das der Block schon abgrenzt. Das Leerfeld hier füllt
            umgekehrt eine ganze Seite oder einen ganzen Abschnitt.{" "}
            <code>dicht</code> nimmt die Polsterung zurück, wo es unter einer
            Überschrift im Abschnitt steht statt allein auf der Seite; das Zeichen
            entfällt dort meist mit. Ist das Leerfeld die ganze Seite - nicht
            gefunden, Training nicht verfügbar -, macht{" "}
            <code>ueberschrift=&quot;h1&quot;</code> den Titel zur Überschrift
            der Seite: dieselbe Schrift, aber die Vorlesehilfe findet die Seite
            gegliedert.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <Leerzustand
              icon={SearchX}
              titel="Keine Übung gefunden"
              aktion={<Button variant="link">Filter zurücksetzen</Button>}
            >
              Keine Übung erfüllt alle gesetzten Filter. Entferne einzelne Filter
              oder setze sie zurück.
            </Leerzustand>
            <Leerzustand icon={CalendarPlus} titel="Noch keine Termine" dicht>
              Lege die Trainingszeiten des Teams als Termine fest. Welches
              Training dort stattfindet, ordnest du danach zu.
            </Leerzustand>
          </div>

          <h4 className="mb-2 mt-10 type-title-medium text-on-surface">
            Section Message (<code>SectionMessage</code>)
          </h4>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die dritte Sorte Zeile: keine Auskunft über den Bestand, sondern eine{" "}
            <strong>Nachricht an den Nutzer</strong> - das Speichern ist
            gescheitert, die Mail ist unterwegs, das Feld-Diagramm zeigt anderes
            Material. Ohne Aktion meldet sie bloss; mit ein oder zwei Aktionen
            verlangt sie eine Antwort und bleibt stehen, bis eine gewählt ist.
            Baustein und Name stammen von Atlassian wie in Jira. Nicht Atlassians{" "}
            <em>Banner</em>: Der ist ein kräftig gefüllter, einzeiliger Streifen
            über die ganze Seite für seitenweite Ankündigungen - eine solche gibt
            es in KiFu nicht.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Anatomie wie <code>@atlaskit/section-message</code>: eine getönte
            Fläche ohne Kontur (<code>section-*</code>), 16 px Polsterung,{" "}
            <code>rounded-dialog</code>, das Zeichen 16 px (im 24-px-Feld) in{" "}
            <code>icon-*</code> links, 16 px zum Text. Der Text steht in{" "}
            <code>type-body-medium</code> und <code>on-surface</code>; den Ton
            tragen Fläche und Zeichen. Die Aktionen stehen wie bei Atlassian{" "}
            <strong>unter</strong> dem Text, als Links (<code>link</code>, PO
            2026-10-25) in seinem Schriftschnitt; sie fluchten mit ihm, abweisend
            zuerst.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Darstellungen tragen Atlassians Namen: <code>error</code> meldet,
            dass etwas nicht ging, <code>information</code> (Vorgabe) alles
            andere; <code>warning</code>, <code>success</code> und{" "}
            <code>discovery</code> stehen im Kit bereit. Das Zeichen lässt sich
            überschreiben, die Farbe bleibt die der Darstellung. Die Vorlesehilfe
            erfährt den Ton über <code>role</code>: ein Fehler ohne Aktion
            unterbricht (<code>alert</code>), alles andere reiht sich ein (
            <code>status</code>).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Im Dialog</strong> steht ein gescheiterter Vorgang als{" "}
            <code>error</code> zuoberst, vor dem Inhalt, mit{" "}
            <code>mb-4</code> Abstand; der Dialog bleibt offen. Was nur ein Feld
            betrifft, bleibt dagegen Fehlertext am Feld (<Siehe id="textfelder" />).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Am Fuss der öffentlichen Trainings-Seiten steht für Besucher ohne
            Konto der <code>AnmeldeHinweis</code>: eine Meldung mit eigenem
            Zeichen und dem Weg zum Konto als Aktion. Auf Papier fehlt er.
          </p>
          <div className="grid max-w-2xl gap-4">
            <SectionMessage appearance="error">
              Das Training konnte nicht gespeichert werden. Bitte versuche es noch
              einmal.
            </SectionMessage>
            <SectionMessage icon={MailCheck}>
              Bestätigungsmail erneut an <strong>trainerin@example.ch</strong>{" "}
              gesendet.
            </SectionMessage>
            <SectionMessage
              icon={RefreshCw}
              actions={
                <>
                  <Button type="button" variant="link">
                    Material beibehalten
                  </Button>
                  <Button type="button" variant="link">
                    Neuen Vorschlag übernehmen
                  </Button>
                </>
              }
            >
              Das Feld-Diagramm zeigt inzwischen anderes Material: Hürden: 0 → 1.
            </SectionMessage>
            <AnmeldeHinweis />
            <SectionMessage appearance="warning">
              warning - im Kit, derzeit ohne Ort.
            </SectionMessage>
            <SectionMessage appearance="success">
              success - etwa nach dem Widerrufen des Abos am privaten Link.
            </SectionMessage>
            <SectionMessage appearance="discovery">
              discovery - im Kit, derzeit ohne Ort.
            </SectionMessage>
          </div>
        </Section>

        <Section id="dialog-snackbar">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Der <strong>Dialog</strong> steht auf nativem{" "}
            <code>&lt;dialog&gt;</code> (Fokus-Falle, Escape, Scrim) und trägt die
            oberste Stufe: <code>bg-elev-24</code>,{" "}
            <code>rounded-dialog</code> - der einzige Ort mit 6 px -,{" "}
            <code>shadow-dp-24</code> und ein Scrim bei 60 %. Sein Titel steht
            in <code>type-title-large</code> wie der Name einer Übung -
            ein Dialog ist ein Arbeitsschritt, kein Plakat. Er ist{" "}
            <strong>28 rem</strong> breit; Formulare mit vielen Angaben - die
            Termin-Dialoge mit Feldern und Spielerzahl - nehmen{" "}
            <code>breit</code> (40 rem), schmal bleibt er bis zum Rand minus
            2 rem (PO 2026-10-06). Die{" "}
            <strong>Snackbar</strong> ist die eine <strong>umgekehrte</strong>{" "}
            Fläche der Anwendung (<code>umkehr</code>): Weiss zu{" "}
            {Math.round(UMKEHR.deckung * 100)} % über dem Grund, darauf der Grund
            als Schrift ({v(kontrast(UMKEHR.schrift, UMKEHR.flaeche))}) und das
            dunkle Violett als Aktion ({v(kontrast(UMKEHR.akzent, UMKEHR.flaeche))}).
            Sie meldet am Bildrand und geht von selbst, also muss sie beim ersten
            Hinsehen auffallen. Auf <code>elev-06</code> hob sie sich nur{" "}
            {v(kontrast(elev(6), elev(0)))} vom Grund ab und blieb unbemerkt; hell
            steht sie bei {v(kontrast(UMKEHR.flaeche, elev(0)))}. So meint Material
            sie auch. Innerhalb der Fläche gelten die Rollen umgekehrt - Primary
            ist dort das dunkle Violett -, damit Textknopf, Zustands-Ebene und
            Fokus-Ring ohne Sonderklassen tragen. Beim Erscheinen fährt sie kurz
            von unten ein; bei reduzierter Bewegung blendet sie nur ein.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Im Fuss eines Dialogs steht kein Textknopf: Der Ausweg ist ein
            Secondary Button (<code>outlined</code>), seine Schrift ist{" "}
            <code>on-surface</code>. Links im Inhalt eines Dialogs («Der Serie
            folgen», «Übung erfassen») bleiben Primary und kommen auf 24dp auf{" "}
            {v(kontrast(PRIMARY, elev(24)))}. Weisse Linkschrift wäre von der
            Fliesstextzeile daneben nicht mehr zu unterscheiden; die Links sind
            zudem unterstrichen und tragen den Ring.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Snackbar meldet einen <strong>Vorgang</strong>, die Section
            Message einen <strong>Zustand</strong>. Darum hat sie genau einen Platz: unten
            in der Mitte, für die ganze Anwendung. Niemand rendert sie selbst -
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
            einen Fehler, und nur den Text, nicht die Knöpfe - unterbrechen darf
            nur eine Section Message. Sie gehört zur
            Ansicht, in der sie entstand, und fällt beim Wechsel weg; wer eine
            Bestätigung für die Zielansicht braucht, schickt sie über die Adresse
            mit (<code>Flash</code>). Höchstens eine Aktion - Rückgängig, Erneut
            versuchen -, nie ein blosses «OK». Und sie liegt unter jedem Dialog:
            Scheitert ein Vorgang und bleibt der Dialog offen, steht der Grund als
            Section Message im Dialog.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein <strong>Link zum Kopieren</strong> (Kalender-Abo,{" "}
            <code>AboDialog</code>) ist kein neuer Baustein, sondern eine
            Zeile aus dem Kit: ein <code>TextField</code> mit{" "}
            <code>readOnly</code> und ein Secondary Button daneben.
            Das Feld wählt beim Fokus alles aus, damit sich der Link auch von
            Hand kopieren lässt. Das Ergebnis des Knopfes erscheint{" "}
            <strong>im Dialog</strong>, nicht in der Snackbar - die liegt unter
            ihm: Gelingt es, zeigt der Knopf kurz «Kopiert» (mit Häkchen, dazu
            eine Live-Region für die Vorlesehilfe); scheitert es, steht eine
            Section Message <code>error</code> im Dialog, und das Feld ist markiert. Ist der Link ein
            Geheimnis, geht die Warnung
            als Section Message im Dialog voran. Neuere Stellen (privater Link,
            Abholadresse, Abo am privaten Link) nehmen dafür das{" "}
            <code>KopierFeld</code>.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Das <strong>Kalender-Abo am privaten Link</strong> (<code>AboKnopf</code>)
            sitzt als <code>IconButton</code> mit Tooltip gleich hinter dem Namen der
            Spieler:in: Es ist ihr Kalender, und die Seite hat weder Seitenleiste
            noch Menü, in dem er sonst stünde. Die Rückfrage vor dem
            Widerrufen ist ein Schritt <strong>im selben Dialog</strong> statt eines
            zweiten: Auf dem Telefon stapelten sich sonst zwei Dialoge, und nach dem
            Widerrufen geht es dort gleich mit «Neue Abo-Adresse holen» weiter. Der
            Fokus springt bei jedem Schritt auf einen Knopf des Schritts: «Schliessen»,
            «Abbrechen», «Neue Abo-Adresse holen». Anders als beim privaten Link
            warnt der Dialog nicht vor dem Weitergeben: Die Abo-Adresse zeigt nur
            an, und einen Datenschutzhinweis gibt es dort bewusst nicht (PO, Epic
            Kalender-Abo für Spielervertretungen).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die <strong>Auswahlleiste</strong> (<code>AuswahlLeiste</code>) trägt
            die Handlungen für mehrere ausgewählte Zeilen einer Liste. Sie schwebt
            unten in der Mitte am Platz der Snackbar, solange etwas ausgewählt
            ist - in einer langen Liste bleibt sie so in Reichweite, statt über
            der Liste aus dem Bild zu scrollen. Ihre Fläche ist dunkel (
            <code>elev-08</code>, Schatten 06dp): Sie ist Werkzeug, keine Meldung,
            und bleibt neben der hellen Snackbar als etwas anderes lesbar. Eine
            Snackbar rückt über sie, und die Seite hält unten ihre Höhe frei -
            beides regelt der Platz am unteren Rand (<code>unterRand</code>,{" "}
            <code>FussleisteKontext</code>). Sie liegt unter Snackbar und Dialog.
            Im DOM steht sie nach der Liste, damit Tab aus einer Zeile vorwärts
            zu ihr führt; geht sie mit dem Fokus darin zu, kehrt er zurück, woher
            er kam. Vorgeführt bei der Tabelle (› Tabelle, Mehrfachauswahl).
          </p>
          <OverlaysDemo />
        </Section>

        <Section id="feedback-dialog">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Fragen und Feedback</strong> (Epic #541) ist ein Gespräch mit
            einem KI-Modell, kein Dialog im Sinn oben: Am Desktop steht es als
            Spalte rechts neben dem Inhalt (24 rem, Fläche 01dp mit Haarlinie wie
            die Seitenleiste, ohne Schatten) und bleibt beim Seitenwechsel offen,
            damit die Person die Seite, um die es geht, daneben anschauen kann.
            Unter <code>lg</code> und am privaten Link füllt es den Bildschirm.
            Geöffnet wird es aus der Seitenleiste über einen Knopf, nicht einen
            Link - es wechselt die Seite nicht. Am privaten Link, der keine
            Seitenleiste hat, steht der Knopf als Link mit Zeichen in einer
            schmalen Leiste (<code>elev-00</code>, Haarlinie oben), die beim
            Scrollen am unteren Bildschirmrand klebt und bei einer kurzen Seite
            am unteren Rand steht - so ist er auch in einer langen Terminliste
            erreichbar.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Der Chat folgt der Regel «Farbe füllt nur, wo eine Fläche gemeint
            ist»: Die KI schreibt auf den Grund, die eigenen Nachrichten stehen
            rechts auf <code>elev-02</code>, keine farbigen Sprechblasen. Die
            Zusammenfassung ist eine <code>Card</code> mit Bezeichnung und Wert
            untereinander; darunter «Bestätigen und senden» und der Ausweg
            «Verwerfen» als Secondary Button. Unter dem Feld steht der Zähler
            der Nachrichten, rechts die Zeichen - das Feld nimmt wie jedes in
            KiFu nicht mehr als die Grenze an. Fehler stehen als Section Message
            im Gespräch, nicht in der Snackbar: Die gehört zur Seite und fiele
            beim Wechsel weg.
          </p>
          <FeedbackDemo />
        </Section>

        <Section id="navigation">
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Seitenleiste</strong> am linken Rand, auf{" "}
            <code>bg-elev-01</code> mit <code>border-linie</code> zum Inhalt. Sie
            ist Rahmen, keine schwebende Fläche, und trägt darum keinen Schatten.
            Oben die Marke (die Bildmarke F mit Punkt, dieselbe Datei wie das Favicon, und der Name), darunter die Einträge in
            Gruppen, unten «Fragen und Feedback» (nur angemeldet; ein Knopf, kein Link - er öffnet
            den Dialog neben der Seite, siehe <Siehe id="feedback-dialog" />), «Darstellung», die
            Versionszeile und die Konto-Karte: Avatar, Anzeigename
            und E-Mail führen als Ganzes ins Konto. Die Versionszeile (Zeichen und Nummer, ruhiger als
            ein Eintrag) führt zur Release-History; schmal bleibt das Zeichen. Diese Seite führt die
            Leiste nicht (PO 2026-10-30): Sie ist Werkzeug fürs Entwickeln, nicht für Nutzer:innen,
            und bleibt unter <code>/styleguide</code> erreichbar. Ist ein Release
            erschienen, den dieser Browser noch nicht gesehen hat, trägt die Versionszeile die Plakette «Neu»
            (<code>discovery</code>: etwas Zusätzliches) - schmal stattdessen einen Punkt in Primary
            am Zeichen, die einzige Punkt-Markierung im Kit. Sie drängt sich nicht auf und
            verschwindet, sobald die Versionen angezeigt wurden. Abmelden steht im Konto, nicht in der
            Leiste. Der offene Eintrag ist betont (<code>betont</code>, die Schrift
            zu 8 % über der Leiste) und trägt sein Zeichen in Primary; aufklappbare
            Einträge (Teams) haben einen eigenen Pfeil, damit der Name selbst
            zur Übersicht führen kann.
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Darstellung</strong> (#567) steht angemeldet zwischen «Fragen und Feedback» und
            der Version: das Zeichen der aktuellen Wahl (Bildschirm, Sonne, Mond), breit dazu ihr
            Name. Die Zeile öffnet ein Menü mit «Wie das Gerät», «Hell» und «Dunkel»; die gewählte
            Zeile trägt den Haken (<code>menuitemradio</code>), am Fuss steht, dass die Wahl in diesem
            Browser gilt. Breit klappt es über der Zeile auf, schmal rechts neben der Leiste - es steht
            darum <code>fixed</code> und ragt aus der Leiste hinaus. Umgeschaltet wird sofort und ohne
            Neuladen; Ungespeichertes auf der Seite bleibt stehen.
          </p>
          <p className="type-body-medium mb-4 max-w-2xl text-on-surface-mittel">
            <strong>Breit oder schmal</strong> - 280 px mit Namen, 72 px nur mit
            Zeichen. Umgeschaltet wird <strong>nur von Hand</strong>, über den
            Knopf vor den Brotkrumen; beim Überfahren öffnet sich nichts, sonst
            schöbe sich die Leiste über das, was man gerade ansteuern wollte.
            Schmal zeigt jeder Eintrag seinen Namen beim Überfahren und
            Fokussieren als Hinweis daneben (Tooltip-Fläche, 24dp). Die Wahl
            merkt sich der Browser in einem Cookie, so steht die Leiste schon
            beim Laden in der richtigen Breite. Die Breite gleitet beim
            Umschalten - die einzige Fläche im Kit, die ihre Breite ändert,
            weil der Inhalt daneben mitwandert und das Auge ihm folgen soll.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Unter <code>lg</code> wird die Leiste zum <strong>Drawer von
            links</strong> auf 08dp, geöffnet über eine schmale Kopfzeile
            (04dp, deckend) mit Hamburger. Scrim, Escape und Scroll-Sperre wie
            bei jedem Overlay; dort ist die Leiste immer breit, die aktive Zeile
            ebenso betont.
          </p>
          <SeitenleisteDemo />
        </Section>

        <Section id="breadcrumbs">
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

        <Section id="verzeichnis">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Lange Seiten zum Nachschlagen tragen ab <code>lg</code> links ein Inhaltsverzeichnis{" "}
            (<code>Verzeichnis</code> in <code>VerzeichnisFlaeche</code>): «Versionen» und diese
            Seite - das Verzeichnis links ist das Beispiel. Es klebt unter der Kopfzeile, scrollt
            für sich und führt mit jedem Eintrag zu einem Abschnitt. Der Abschnitt, der oben im
            Fenster steht, trägt seine Zeile betont (<code>aria-current=&quot;location&quot;</code>);
            das Verzeichnis scrollt so, dass sie sichtbar bleibt.
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-1 pl-5 text-on-surface-mittel">
            <li>
              <strong>Obertitel</strong> wie die Bereiche bei Material (<code>type-title-small</code>,
              Pfeil davor): Sie klappen auf und zu. Steht der aktuelle Abschnitt in einem
              zugeklappten Bereich, trägt dessen Titel den Akzent.
            </li>
            <li>
              <strong>Untertitel</strong> wie die Gruppen der Komponenten bei Atlassian
              (<code>type-body-small</code> in <code>on-surface</code>: kleiner als die Einträge, aber heller als ihr ruhiges Mittel - versal waren sie kaum zu unterscheiden):
              Sie benennen nur, was folgt, und
              klappen nicht. Auf der Seite stehen sie als Zeile in Primary über dem Abschnitt.
            </li>
            <li>
              <strong>Einträge</strong> in <code>type-body-medium</code>, ruhig in{" "}
              <code>on-surface-mittel</code>; mit <code>zusatz</code> eine kleine Zeile darüber, bei
              «Versionen» die Nummer (aktiv in Primary). Ohne Obertitel und Untertitel bleibt das
              Verzeichnis eine flache Liste - so bei «Versionen».
            </li>
            <li>
              <strong>Breite</strong> am selben Griff wie die Spalte der geteilten Fläche
              (<code>Ziehgriff</code>, siehe <Siehe id="layout" />), zwischen 11 und 30 rem, nie mehr
              als die halbe Fläche. Gemerkt wird eine Breite für alle solchen Seiten (Cookie{" "}
              <code>kifu-verzeichnis</code>). Schmal fehlt das Verzeichnis.
            </li>
          </ul>
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Die Gliederung dieser Seite steht einmal in <code>GLIEDERUNG</code>: Verzeichnis,
            Abschnittsköpfe und Verweise im Text (<code>Siehe</code>) lesen dieselbe Quelle.
            Abschnitte verweisen mit Namen aufeinander, nicht mit Nummern - so bleibt ein Verweis
            richtig, wenn ein Abschnitt dazukommt.
          </p>
        </Section>

        <Section id="liste-detail">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Übungen eines Trainings öffnen ihr Detail in der Spalte daneben,
            statt auf eine eigene Seite zu führen (Epic #369) - der Trainer
            behält die Zusammenstellung im Blick. Breit ist darum{" "}
            <strong>die ganze Zeile die Fläche, die öffnet</strong>, und hellt
            beim Überfahren auf wie eine Trainingskachel der Übersicht (<Siehe id="karten" />): Die
            Zustands-Ebene (<code>state</code>, <Siehe id="zustaende" />) liegt auf der Zeile, der Knopf
            dazu ist der Name (<code>UebungsName</code>), dessen Fläche über die
            Zeile reicht. Was die Zeile sonst trägt - Umsortieren, Entfernen,
            Dauer, Notiz -, liegt mit <code>relative</code> darüber und bleibt
            für sich bedienbar. Was man erst nach dem Ansehen tut, steht dagegen
            im Detail: Bearbeiten und «In meine Bibliothek kopieren» gibt es
            breit nur dort, schmal weiter an der Zeile.
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
            <li>
              <strong>Geöffnet</strong> - die Zeile trägt eine Kontur in
              Primary, der Name ist Primary und <code>aria-current</code>. Ein
              zweiter Klick schliesst.
            </li>
            <li>
              <strong>Schmal</strong> - der Name steht als Text, die Zeile öffnet
              nichts; die Weiche ist CSS, so stimmt schon das erste HTML.
            </li>
            <li>
              <strong>Bearbeiten in der Spalte</strong> - die Maske steht in der
              Reihenfolge des Detail untereinander; «Sichern», «Verwerfen»
              (ohne Änderung «Abbrechen») und Schliessen kleben auf dem Grund
              (<code>bg-elev-00</code>) am oberen Rand, während die Spalte
              darunter scrollt. Wer die Übung mit ungesicherten Änderungen
              verlässt, wird gefragt: weiter bearbeiten oder verwerfen - ein
              «Sichern und weiter» gibt es nicht.
            </li>
          </ul>
          <OeffnenZeileDemo />
        </Section>

        <Section id="disclosure">
          <p className="type-body-medium max-w-2xl text-on-surface-mittel">
            Ein Abschnitt, der zugeklappt beginnt. Gedacht für lange Listen, die
            vollständig erreichbar bleiben sollen, ohne die Seite zu beherrschen -
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
            Fläche - das Kit animiert nirgends Höhen.
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

        <Section id="gefahrenzone">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Der Bereich am Ende einer Verwaltungsseite für Handlungen, die sich
            nicht zurücknehmen lassen und andere mittreffen - in der
            Teamverwaltung Verlassen und Auflösen (#480). Eine Karte auf{" "}
            <code>elev-01</code> wie jede andere, aber mit voller Kontur und
            Überschrift in Error: {v(kontrast(ERROR, elev(1)))} als Schrift, als
            Kontur mindestens 3:1 auf jeder Stufe und im Druck. Getönt wird die
            Fläche nicht - <code>section-danger</code> heisst «etwas ist
            schiefgegangen» (<Siehe id="meldungen" />), die Gefahrenzone dagegen
            «hier ist Vorsicht geboten». Eine Kontur mit Alpha bräche die 3:1;
            darum volles <code>border-error</code>.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Löscht eine Handlung dort für alle, bestätigt man sie durch die{" "}
            <strong>Eingabe des Namens</strong>: Der Dialog nennt, was verloren
            geht, und den einzugebenden Namen; der <code>danger</code>-Knopf ist
            erst frei, wenn die Eingabe genau stimmt (Gross- und Kleinschreibung
            zählen, Leerzeichen am Rand nicht). Das Feld schaltet Autokorrektur,
            automatische Grossschreibung und Rechtschreibprüfung ab, Einfügen
            bleibt erlaubt. Die Vorlesehilfe hört den Namen über{" "}
            <code>aria-describedby</code> mit dem Feld und die Freigabe über eine
            Live-Region. Andere Löschungen bleiben bei der gewöhnlichen Rückfrage
            - die Eingabe ist dem vorbehalten, was mehrere Menschen trifft.
          </p>
          <Gefahrenzone
            className="max-w-xl"
            beschreibung="Verlassen betrifft nur dich - ausser du bist das letzte Mitglied. Auflösen löscht das Team samt allen Inhalten für alle Mitglieder."
          >
            <div className="flex flex-wrap gap-2">
              <Button variant="outlined">Team verlassen</Button>
              <Button variant="danger">Team auflösen</Button>
            </div>
          </Gefahrenzone>
        </Section>

        <Section id="tabelle">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Eine Liste mit mehreren Angaben je Eintrag - die Spielerliste und die
            Mitglieder eines Teams (PO 2026-10-17). Neu als Baustein (
            <code>Tabelle</code>, <code>TabellenZeile</code>), weil sie an zwei
            Orten gleich stehen soll: Fläche <code>elev-01</code>, eine Kopfzeile
            mit den Spaltennamen in Label Small, Zeilen durch Linien getrennt, die
            Aktionen rechts als Symbolknöpfe - das Kreuz entfernt nach Rückfrage.
            Hinzugefügt wird über das Plus im Kopf des Abschnitts, im Dialog.
            Kopf und Zeilen teilen Raster und Ränder, damit die Spalten genau
            übereinander stehen. Schmal fällt die Kopfzeile weg, und jede Zeile
            stellt ihre Angaben unter den Namen. Die Kopfzeile ist nur fürs Auge;
            vorgelesen wird eine Liste, deren Knöpfe ihre Zeile im Namen tragen.
          </p>
          <Tabelle spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem]" kopf={["Name", "E-Mail-Adresse", ""]}>
            {[
              ["Mia Muster", "mia@example.ch"],
              ["Leo Beispiel", "leo@example.ch"],
            ].map(([name, mail]) => (
              <TabellenZeile key={name}>
                <span className="min-w-0 flex-1">
                  <span className="type-body-medium block truncate text-on-surface">{name}</span>
                  <span className="type-body-small block text-on-surface-mittel sm:hidden">{mail}</span>
                </span>
                <span className="type-body-medium hidden text-on-surface-mittel sm:block">{mail}</span>
                <span className="flex justify-end">
                  <IconButton icon={X} label={`${name} entfernen`} />
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>

          <p className="type-label-small mb-2 mt-8 text-on-surface-mittel">
            Mit Mehrfachauswahl und Auswahlleiste
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Lässt sich für mehrere Einträge zugleich etwas tun (Kader zuteilen in
            der Spielerliste), steht vorne in jeder Zeile ein Kästchen
            (<code>Checkbox</code>, Name nur für die Vorlesehilfe) in einer
            eigenen schmalen Spalte ohne Kopf. Sobald etwas gewählt ist, schwebt
            unten die <code>AuswahlLeiste</code> mit der Zahl, den Handlungen und
            «Auswahl aufheben» - am Platz der Snackbar, die dann über ihr steht.
            Wer die Liste eingrenzt, behält nur sichtbare Einträge in der Auswahl.
          </p>
          <TabelleAuswahlDemo />
        </Section>

        <Section id="eigenschaften">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Bezeichnung und Wert paarweise - die Einordnung einer Übung in der
            Spalte rechts (Epic #350), angelehnt an das Details-Panel von Jira.
            Neu, weil kein Baustein Bezeichnung und Wert zusammen führt:{" "}
            <code>FormAbschnitt</code> gliedert Formulare, die Eckdatenzeile der
            Karte reiht Werte ohne Bezeichnung.
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
            <li>
              <strong>Beschreibungsliste</strong> - <code>dl</code> mit{" "}
              <code>dt</code>/<code>dd</code>. Die Bezeichnung steht in fester
              Spalte (8.5 rem), der Wert bricht in seiner um. Ein Wert darf ein
              Baustein sein: Lozenge, Chips, <code>MaterialListe</code>.
            </li>
            <li>
              <strong>Gedämpfte Lesetype statt Versalien</strong> - gesperrte
              Versalien bräuchten für «Hauptteilkategorie» mehr Breite, als neben
              dem Wert bleibt.
            </li>
            <li>
              <strong>Über beide Spalten</strong> - <code>EigenschaftBreit</code>{" "}
              für das, was zu einer Zeile gehört, aber keine sichtbare
              Bezeichnung braucht (der Material-Hinweis). Die Bezeichnung bleibt
              für Vorlesehilfen.
            </li>
            <li>
              <strong>Bearbeitbar</strong> - wo eine Angabe in der Liste selbst
              geändert wird (Ziel und Alterskategorien eines Trainings), sieht
              die Zeile ruhend aus wie jede andere; nach dem Vorbild von Jira
              zeigt erst der Wert beim Überfahren und im Fokus, dass er ein
              Knopf ist (Zustands-Ebene). Ein Klick macht ihn an derselben
              Stelle zum Feld, die Bezeichnung bleibt links. Fehlt der Wert,
              steht gedämpft, was zu tun ist («Ziel hinzufügen»).{" "}
              <code>EigenschaftText</code>: Freitext mit ✓ und ✕ darunter -
              Enter oder ✓ speichert, Esc oder ✕ verwirft, ein Klick daneben
              speichert. <code>EigenschaftAuswahl</code>: Die Liste geht beim
              Klick sofort auf, jede Wahl speichert für sich. Nach Esc, ✓, ✕
              und Enter steht der Fokus wieder auf dem Wert. Ohne Zeile steht
              derselbe Baustein frei als <code>InlineWert</code> - als Text oder
              als Zahl, etwa die Dauer an einer Übung im Training; was nicht
              gilt, bleibt mit seiner Meldung am Feld stehen.
            </li>
            <li>
              <strong>Nicht erfasst</strong> - <code>EigenschaftFehlt</code>{" "}
              zeigt eine vorgesehene, aber leere Angabe (nur der Eigentümerin,
              #352): der Wert gedämpft wie die Bezeichnung, damit er sich vom
              Erfassten abhebt, ohne nach einem Fehler auszusehen. Nie auf Papier.
            </li>
            <li>
              <strong>Fläche</strong> - eine <code>Card</code>; auf Papier stehen
              Bezeichnung und Wert untereinander, weil die Spalte dort schmaler
              ist.
            </li>
          </ul>
          <div className="mb-6">
            <EigenschaftBearbeitbarDemo />
          </div>
          <div className="max-w-[22rem]">
            <Eigenschaften titel="Einordnung">
              <Eigenschaft label="Altersstufe">Kinderfussball</Eigenschaft>
              <Eigenschaft label="Alterskategorien">
                <span className="flex flex-wrap gap-1.5">
                  <KategorieLozenge k="F" />
                  <KategorieLozenge k="E" />
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
              <EigenschaftBreit label="Hinweis zum Material">
                <span className="type-body-small text-on-surface-mittel">
                  Über beide Spalten, die Bezeichnung nur für die Vorlesehilfe.
                </span>
              </EigenschaftBreit>
            </Eigenschaften>
          </div>
        </Section>

        <Section id="release-text">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein Eintrag unter «Versionen» (#408): das Thema des Releases als Titel in{" "}
            <code>type-title-large</code> (ohne «KiFu X.Y.Z -», das die Metazeile schon sagt), darunter
            eine Metazeile in <code>type-body-small</code> (Version, Tag der Veröffentlichung,
            «Auf GitHub ansehen»), dann der Text, wie er auf GitHub steht. Er ist Markdown und
            erscheint mit seiner Gliederung in der Schrift der Anwendung: Überschriften eine Stufe
            unter dem Titel (<code>type-title-medium</code>), Listen wie im Freitext, Fettes,
            Links in Primary, Code betont. Eingebettetes HTML und Bilder fallen weg. Einträge
            trennt eine Haarlinie. Ab <code>lg</code> steht links das{" "}
            <Siehe id="verzeichnis" />, flach: je Version Nummer und Thema. Die Texte der neuesten
            30 Versionen stehen gleich da,
            die älteren erst nach «… ältere Versionen anzeigen» (<code>?alle=1</code>); das
            Verzeichnis nennt alle und führt bei einer älteren dorthin. Das Markdown ist eine Ausnahme: Was Trainer:innen selbst
            schreiben, bleibt Freitext ohne Markdown.
          </p>
          <article className="flex max-w-3xl flex-col gap-3">
            <header className="flex flex-col gap-1">
              <h4 className="type-title-large text-on-surface">Neuigkeiten in der Seitenleiste</h4>
              <p className="type-body-small flex flex-wrap items-center gap-x-2 text-on-surface-mittel">
                <span>Version 1.28.0</span>
                <span aria-hidden>·</span>
                <span>Mi., 07.10.2026</span>
                <span aria-hidden>·</span>
                <a href="#release" className="text-primary underline">Auf GitHub ansehen</a>
              </p>
            </header>
            <ReleaseText text={BEISPIEL_RELEASE} />
          </article>
        </Section>

        <Section id="karten">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Die Karte ist eine Höhenstufe (<code>bg-elev-01</code>,{" "}
            <code>rounded-flaeche</code>) und trägt <strong>keinen Rand</strong>:
            Höhe und Kontur nebeneinander sagten dasselbe zweimal. Das Bild ist das
            einzige satte Farbfeld auf der Karte; an seinem <strong>Kopf</strong>{" "}
            liegt ein Verlauf aus <code>scrim</code> (<code>top-0 h-16</code>) -
            er schützt, was dort steht: die Herkunfts-Lozenge links und den
            Favoriten-Knopf rechts. Den Titel trägt die Kartenfläche unter dem
            Bild; er braucht den Verlauf nicht. Darunter stehen die{" "}
            <strong>Eckdaten</strong> in <code>type-body-medium</code>, getrennt
            durch «·»: Alterskategorien als Buchstaben (aufsteigend G bis A),
            die feinste Einordnung, das Feld und die Spieler:innen - genug, um
            ohne Öffnen zu sehen, ob eine Übung zu Mannschaft und Platz passt.
            Das Feld ist die Spielfeldgrösse, wo eine erfasst ist, sonst der
            Feldtyp; die Spielerzahl kürzt «Sp.» ab und wird voll vorgelesen.
            Was eine Übung nicht trägt, fällt ohne Platzhalter weg. Die Zeile
            hat höchstens zwei Zeilen (<code>line-clamp-2</code>) und endet
            sonst in Auslassungspunkten. Die Zeile setzt{" "}
            <code>uebungEckdaten</code> zusammen - im Katalog wie in diesen
            Beispielen. Überfahren färbt die ganze Karte über{" "}
            <code>state</code> - kein eigener Hover-Ton, und die Ebene sitzt auf
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

          <p className="type-body-medium mb-5 mt-8 max-w-2xl text-on-surface-mittel">
            Die <strong>Trainingskachel</strong> (<code>TrainingCard</code>) folgt
            derselben Regel: Höhenstufe ohne Rand, die Zustands-Ebene auf dem
            Link, der die ganze Kachel deckt. Ein Bild hat sie nicht; oben stehen
            die Alterskategorien - nur ohne Kategorie die Altersstufe -, ab zwei
            Varianten die <code>discovery</code>-Lozenge und am eigenen Eintrag,
            ob er ein Entwurf oder öffentlich ist. Darunter der Name, die
            Kennzahlen der ersten Variante (Übungen, Gesamtdauer) und zuunterst
            Urheber oder Änderungsdatum.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TrainingCard
              href="#"
              zeigeUrheber={false}
              training={{
                id: "t1",
                name: "Passspiel im Quadrat",
                visibility: "private",
                istEigen: true,
                altersstufe: "kinderfussball",
                stufen: ["F", "E"],
                updatedAt: "2026-10-01T18:00:00Z",
                exerciseCount: 6,
                totalDuration: 75,
                hasAnyDuration: true,
                variantenZahl: 1,
                urheber: null,
              }}
            />
            <TrainingCard
              href="#"
              zeigeUrheber={false}
              training={{
                id: "t2",
                name: "Halle oder Rasen",
                visibility: "public",
                istEigen: true,
                altersstufe: "kinderfussball",
                stufen: ["G", "F"],
                updatedAt: "2026-09-28T18:00:00Z",
                exerciseCount: 8,
                totalDuration: 90,
                hasAnyDuration: true,
                variantenZahl: 2,
                urheber: null,
              }}
            />
            <TrainingCard
              href="#"
              training={{
                id: "t3",
                name: "Abschluss unter Druck",
                visibility: "public",
                istEigen: false,
                altersstufe: "juniorenfussball",
                stufen: ["C", "B"],
                updatedAt: "2026-09-20T18:00:00Z",
                exerciseCount: 5,
                totalDuration: 0,
                hasAnyDuration: false,
                variantenZahl: 1,
                urheber: "Trainerin Muster",
              }}
            />
          </div>
        </Section>

        <Section id="fahrplan">
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
            <strong>Freitext</strong> - <code>Freitext</code>: Ablauf, Fahrplan-Stufen
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
          <p className="type-body-medium mb-3 mt-8 max-w-2xl text-on-surface-mittel">
            <strong>Kürzbarer Text</strong> - <code>KuerzbarerText</code>: ein längerer
            Freitext ohne Formatierung, gekürzt auf wenige Zeilen (Vorgabe drei) mit
            «Ganz lesen» als Link darunter - das Info-Schreiben in der Karte
            «Probetraining» und am privaten Link (#556). Der Link steht nur, wenn der
            Text wirklich länger ist (gemessen); aufgeklappt heisst er «Weniger
            anzeigen». Zeilenumbrüche bleiben, Webadressen (http, https, www.) werden
            zu externen Links (<code>ExternerLink</code>). Neu, weil{" "}
            <code>Freitext</code> immer ganz steht und <code>line-clamp</code> allein
            nicht aufklappt.
          </p>
          <Card className="max-w-xl p-6">
            <KuerzbarerText
              className="type-body-medium text-on-surface"
              text={
                "Schön, dass du bei uns reinschaust!\n\nWir trainieren auf der Allmend, Feld 3. Komm 10 Minuten vor Beginn, in Sportkleidung, mit Fussballschuhen, Schienbeinschonern und einer Trinkflasche.\n\nMelde dich unten für die Trainings an, bei denen du mitmachen willst.\nMehr zum Verein: www.fc-beispiel.ch"
              }
            />
          </Card>
        </Section>

        <Section id="feld-diagramm">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Spielfeld-Diagramme (Epic #47) werden als SVG aus der gespeicherten
            Struktur und dem zentralen Symbol-Register gerendert -{" "}
            <code>DiagrammView</code> ist die eine Anzeige-Komponente für Karte,
            Detailseite, Trainings, Druck und mobil; <code>UebungsBild</code>{" "}
            schaltet zwischen Diagramm, Foto und Platzhalter. Gezeichnet wird in
            der Maske der Übung: Die Zeichenfläche (<code>DiagrammZeichnen</code>)
            sitzt ohne Autosave als <code>DiagrammFeld</code> unter der
            Zuordnung, beim Erfassen wie beim Bearbeiten. Dort wacht{" "}
            <code>VerlassenWarnung</code> über ungesicherte Angaben - ein
            Bestätigungs-Dialog aus dem Kit für Links (auch die der Seitenleiste) und
            Browser-Zurück, die Abfrage des Browsers für Neuladen und Schliessen.
            Symbol-Geometrie ist im Register verankert (Anker = Mittelpunkt),
            damit zentrale Symbol-Updates bestehende Diagramme nie verschieben.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            <strong>Das Diagramm ist Gegenstand, nicht Oberfläche</strong> - es
            folgt weiterhin nicht der Palette der Anwendung. Es hat aber eine
            <strong> eigene</strong>, und die kennt mehr als einen Satz: dieselbe gespeicherte Zeichnung erscheint im Dunkeln auf
            einem Nachtrasen, im Hellen auf einem blassen Rasen und kommt auf Papier weiss aus dem Drucker. Die
            Rollen heissen <code>--diagramm-*</code> und stehen bewusst neben dem{" "}
            <code>@theme</code>-Block, ohne <code>--color-</code>-Präfix: Tailwind
            macht aus jeder Farbrolle des Themes eine Utility, und{" "}
            <code>bg-rasen</code> auf einem Knopf wäre genau die Vermischung, die
            dieser Absatz seit je verhindert. Auf die Tokens der Anwendung gelegt
            ist nur das Drumherum des Editors: die Leisten (
            <code>bg-elev-08</code>, <code>shadow-dp-08</code>) und die aktive
            Werkzeug-Kachel (<code>border-primary</code>). Einen Rahmen um die
            Zeichenfläche gibt es dort nicht mehr - das Feld zeichnet seine Kante
            selbst (<code>--diagramm-feldkante</code>), und ein zweiter Strich
            davor legte nur eine Linie auf die andere.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Drei Sätze, ein Bestand: Gespeichert wird nur der Farb-Slug, was er
            zeigt, entscheiden Medium und Erscheinungsbild. Im Dunkeln liegt der Rasen
            tief im entsättigten Grün des App-Grunds, die Bewegungspfeile werden
            hell und die Elementfarben sind angehoben - die Manual-Palette kam auf dem dunklen
            Grund bei Rot auf 2.6:1 und bei Blau auf 2.2:1, zwei Mannschaften, die
            sich nicht mehr unterscheiden liessen. Auf Papier kehrt sich fast
            alles um: weisse Fläche mit 6-%-Raster, schwarze Pfeile wie in der
            Zeichenerklärung des Manuals, und alles, was am Bildschirm hell
            gezeichnet ist, kippt ins Graue, weil Weiss auf Papier nicht
            existiert. Einzige Ausnahme ist der Ball - er bleibt weiss und bekommt
            eine kräftigere Kontur, sonst wäre er ein grauer Fleck unter lauter
            grauen Flecken. Im Hellen (Epic #563) liegt der Rasen als blasses,
            frisches Grün auf der Seite, und es gilt dieselbe Umkehrung wie auf
            Papier: kräftige Palette, schwarze Pfeile, «weiss» wird Graphit und bleibt
            so von «schwarz» unterscheidbar; den Rand des Felds zieht wieder die
            Feldkante. Hell und Dunkel stehen wie die Oberfläche als{" "}
            <code>light-dark()</code>; die Auswahl im Editor trägt die Schrift der
            Anwendung, damit sie auf beiden Rasen sichtbar bleibt. Die Werte stehen in{" "}
            <code>app/globals.css</code>, die
            Rollennamen in <code>lib/diagramm-farben.ts</code>;{" "}
            <code>npm run check:diagramm-farben</code> rechnet alle drei Sätze nach
            (3:1 nach WCAG 1.4.11 - auf dem Rasen steht kein Text) und verbietet
            im Zeichencode jeden rohen Farbwert.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Spieler und Torwart sind Cartoon-Kinder, der <strong>Trainer</strong>{" "}
            eine erwachsene Figur (Kappe, lange Ärmel, lange Hose, rund 38 %
            grösser - so zeichnet ihn das Manual): das Trikot trägt die Team-Farbe
            (ein konfigurierbarer Fill), Frisur und Hautton werden pro Element
            deterministisch variiert. Der Spieler hat eine wählbare{" "}
            <strong>Pose</strong>, beide Figuren statt Rotation eine{" "}
            <strong>Blickrichtung</strong> (links/rechts, Spiegeln). Die beiden{" "}
            <code>-hinten</code>-Posen zeigen dieselbe Haltung von hinten - damit
            lässt sich ein Kind darstellen, das vom Betrachter weg (im Diagramm
            „nach oben") schaut, etwa eine wartende Kolonne. Nur die Frontal-Posen
            haben diese Variante; die übrigen zeigen die Figur ohnehin im Profil.
            Torwart und Trainer haben je eine feste Standfigur ohne Pose. Die Teile
            der Figuren stehen einmal pro Seite im <code>FigurenSprite</code> des
            (app)-Layouts; eine Figur ist nur ein Verweis darauf mit ihren Farben
            als CSS-Variablen - ein Diagramm ausserhalb dieses Layouts zeigte leere
            Figuren. Alle Posen als <code>GlyphVorschau</code>:
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
            <code>rotate()</code> entfällt - das Symbol bekommt den Winkel über{" "}
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
            ausgewählten Element schwebt - ein bewusst neues Muster (#65): Das
            Kit kennt nur an DOM-Trigger verankerte Overlays (<code>Menu</code>,{" "}
            <code>Select</code>), aber kein Panel an einer Position innerhalb
            einer Canvas. Die Leiste liegt als absolutes Overlay über der Fläche
            (08dp, <code>shadow-dp-08</code>), nicht im Dokumentfluss - so
            verschiebt das Ein- und Ausblenden die Fläche nie. Sie weicht
            oberhalb/unterhalb des Elements aus, tritt während eines Drags zurück
            und verschwindet beim Abwählen. Textboxen werden per Doppelklick
            direkt am Element bearbeitet.
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Auch <strong>Bewegungspfeile</strong> lassen sich einfärben (#430),
            haben aber keine Standardfarbe aus der Palette: Ohne Farbe zeichnen
            sie in der Farbe der Zeichenerklärung. Davor steht darum ein eigener
            Knopf, der auf diese Farbe zurücksetzt. Er zeigt keinen Farbpunkt,
            sondern den Pfeil selbst als Mini-Vorschau - nach dem Muster der
            Posen-Knöpfe, denn ein Punkt in der Farbe der Zeichenerklärung wäre am
            Bildschirm neben «weiss» nicht zu unterscheiden. Kreuzen sich Pfeile,
            spart der obere den unteren mit einem durchsichtigen Rand aus (Rolle{" "}
            <code>weg-rand</code>).
          </p>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Mehrere Elemente werden per <strong>Auswahlrahmen</strong> (Aufziehen
            auf der freien Fläche, erfasst vollständig umschlossene Elemente) oder
            additivem <strong>Umschalt-/Cmd-Klick</strong> ausgewählt (#67). Bei
            mehr als einem Element tritt an die Stelle der Eigenschaften-Leiste
            eine schlanke <strong>Mehrfach-Leiste</strong> (Anzahl, Kopieren,
            Löschen), verankert an der gemeinsamen Box; verschoben wird die Gruppe
            per Drag. Das Ziehen meldet die Zeichnung selbst - ein gezogenes
            Element ist SVG und hat kein <code>::after</code>, auf das sich eine
            Zustands-Ebene legen liesse. Darum kennt das Kit drei Zustände und
            nicht Materials vier (siehe <Siehe id="zustaende" />).
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
            <code>GlyphVorschau</code> - dieselbe <code>ElementGrafik</code> wie
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
            „Spiel mit dem Feuer") - es lässt sich aber ebenso am Boden oder als
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

        <Section id="material">
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
              <strong>Erfassen</strong> - kein Repeat-Baustein im Kit, darum ein
              eigenes Feld aus bestehenden Teilen: je Zeile <code>Select</code>{" "}
              für Art und (nur bei färbbarem Material) Farbe, <code>TextField</code>{" "}
              für die Menge, <code>IconButton</code> mit <code>X</code> zum
              Entfernen (PO 2026-10-06). Hinzufügen ist{" "}
              <code>HinzufuegenFeld</code> (siehe <Siehe id="textfelder" />) mit dem fachlichen Hinweis,
              was in die Liste gehört und was unter «Weiteres Material».
            </li>
            <li>
              <strong>Vorschlag</strong> - das Angebot des Diagramms steht als{" "}
              <code>SectionMessage</code> über der Liste: es verlangt eine Antwort
              (übernehmen, bei einer Änderung auch beibehalten), siehe <Siehe id="meldungen" />.
            </li>
            <li>
              <strong>Lesen</strong> - <code>MaterialListe</code>: ein Posten pro
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

        <Section id="kalenderblatt">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein Termin wie ein Blatt vom Abreisskalender: Wochentag, grosse Tageszahl, Monat - nie das Jahr,
            das steht in der Überschrift des Monats (Epic #401). Neu, weil ein Datum als Text in einer Zeile
            (<code>datumKurz</code>) sich beim Überfliegen nicht finden lässt. Im Trainingsplan steht es links an
            jeder Terminzeile. Das Blatt sagt nur, ob ein Termin zählt (<code>stand</code>, Epic #490): ein
            bevorstehendes Spiel weiss (die umgekehrte Fläche <code>umkehr</code>), ein bevorstehendes Training
            leiser, nur hell umrandet (<code>leise</code>), damit die Spiele hervortreten; grau ab dem Folgetag; grau mit
            durchgestrichener Zahl, wenn er ausfällt - hinter dem privaten Link auch, wenn die eigene
            Spieler:in abgemeldet oder nicht aufgeboten ist. Was ein Termin trägt, sagt die Status-Lozenge
            daneben in einem Wort, nicht mehr die Tönung des Blatts. Heute hebt das Blatt nicht hervor;
            dafür steht der nächste Termin zuoberst.
          </p>
          <div className="flex items-start gap-4">
            <Kalenderblatt datum="2026-10-10" />
            <Kalenderblatt datum="2026-10-08" stand="leise" />
            <Kalenderblatt datum="2026-09-30" stand="vergangen" />
            <Kalenderblatt datum="2026-10-11" stand="gestrichen" />
          </div>
        </Section>

        <Section id="mini-monat">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Ein kleiner Monat zum Navigieren neben einer Liste (Epic #401). Neu, weil kein Baustein ein
            Kalenderraster kennt. <code>MiniMonat</code> zeigt jeden Tag wie das Kalenderblatt der Liste (Epic
            #490): mit einem Spiel weiss hinterlegt, mit nur Trainings hell umrandet, mit nur ausgefallenen
            Terminen grau und durchgestrichen; die Legende darunter nennt alle drei. Trägt ein Termin des Tages einen
            farbigen Status, sitzt oben rechts ein Punkt in dessen Farbe (<code>ZeichenPunkt</code>), je Termin einer, der
            dringlichste zuerst - rot vor gelb vor grün; höchstens zwei, das zweite halb dahinter, die übrigen als
            «+n» unten rechts. Die Zellen
            sind alle gleich hoch, und jeder Monat zeigt sechs Wochen: Beim Blättern springt die Höhe nicht (wie
            im Google und Proton Kalender). Ein Tag mit Einträgen ist ein Knopf zu seinem ersten Eintrag
            (<code>onWahl</code>), ein leerer Tag ist keiner. Blättern und «Heute» melden nur den Monat (<code>onMonat</code>): Wie im Google Kalender
            folgt der Monat der Liste, die Liste aber nicht ihm.
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
            <li>
              <strong>Vorgelesen</strong> - jeder Tag nennt seine Termine beim Namen, ein ausgefallener mit
              «fällt aus»; die Fläche trägt es also nie allein.
            </li>
            <li>
              <strong>Zielgrösse</strong> - geklickt wird der ganze Tag (36 px hoch, WCAG 2.5.8).
            </li>
            <li>
              <strong>Belegt</strong> - ein gepunkteter Ring: Dort liegt etwas, das der Monat nicht zeigt (bei
              «Meine Termine» die Termine anderer). Heute trägt die Zahl auf Primary.
            </li>
          </ul>
          <MiniMonatDemo />
        </Section>

        <Section id="platz-spielerzahl">
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Der Platz eines Termins (Epic #388): ein oder mehrere getrennte Felder,
            je mit Länge und Breite der verfügbaren Fläche, den Toren je Torart
            und dem Untergrund. <code>FelderField</code> ist neu, weil das Kit
            keinen Repeat-Baustein kennt - gebaut nach dem Muster des
            Material-Felds (<Siehe id="material" />) aus bestehenden Teilen.
          </p>
          <ul className="type-body-medium mb-5 flex max-w-2xl list-disc flex-col gap-2 pl-5 text-on-surface-mittel">
            <li>
              <strong>Ein Block je Feld</strong> - umrandet (<code>border-linie</code>),
              mit «Feld 1», «Feld 2» und dem <code>IconButton</code> mit{" "}
              <code>X</code> zum Entfernen (PO 2026-10-06, kein Papierkorb). Die
              Felder sind getrennte Flächen; der Block macht das sichtbar, wo
              eine Zeile wie beim Material sie zu einem Posten verkürzte.
              Hinzufügen ist <code>HinzufuegenFeld</code> (siehe <Siehe id="textfelder" />), sein ⓘ
              sagt, was ein Feld ist.
              Jeder Block ist eine Gruppe (<code>role=&quot;group&quot;</code>),
              benannt nach seinem Titel.
            </li>
            <li>
              <strong>Alles untereinander</strong> - Länge über Breite, die drei
              Torarten untereinander, jedes Feld mit eigenem Namen (wie die
              Spielfeldgrösse einer Übung, siehe Formularfelder). Kein
              Nebeneinander: Auf dem Handy bräche es ohnehin um, und so liest
              sich jede Angabe gleich.
            </li>
            <li>
              <strong>Leer heisst unbekannt, 0 heisst keine</strong> - steht als
              Hinweis hinter dem ⓘ jedes Felds - bei Länge und Breite «leer heisst
              unbekannt», bei jeder Torart dazu «0 heisst keine» -, weil der
              Unterschied für den KI-Assistenten zählt. Der Hinweis der Torarten
              steht auf Touch-Geräten auch unter dem Feld (<code>infoAufTouch</code>).
              Länge und Breite sind ein Paar: Ein Fehler färbt beide, der Satz
              steht unter der Breite (wie die Spielfeldgrösse einer Übung).
            </li>
            <li>
              <strong>Untergrund mit «Unbekannt»</strong> - anders als sonst bei
              einem optionalen <code>Select</code> eine eigene Wahl: Unbekannt
              ist hier eine Aussage, und nur so lässt sich ein gewählter
              Untergrund wieder zurücknehmen.
            </li>
            <li>
              <strong>Lesen</strong> - im Trainingsplan knapp in einer Zeile mit
              dem Zeichen <code>LandPlot</code> (ein Feld: Grösse und Untergrund,
              mehrere: ihre Zahl), in der Durchführen-Ansicht je Feld ausführlich,
              Unbekanntes als «unbekannt», damit es nicht wie «keine» aussieht.
              Die Torart steht vor der Zahl («Minitore: 4, 5-m-Tore: keine») -
              «2 5-m-Tore» läse sich wie «25 m».
            </li>
            <li>
              <strong>Erwartete Spielerzahl</strong> (#390) - ein gewöhnliches
              Zahlenfeld (<code>SpielerzahlField</code> = <code>TextField</code>),
              dessen Hinweis hinter dem ⓘ sagt, was die Zahl zählt (auf
              Touch-Geräten auch unter dem Feld, <code>infoAufTouch</code>); sonst
              steht unter dem Feld nur ein Fehler. Es heisst «Erwartete
              Spielerzahl» wie in der Auskunft des Assistenten. Im Trainingsplan
              steht sie knapp und ohne Zeichen rechts in der Terminzeile, in der
              Durchführen-Ansicht ausgeschrieben mit dem Zeichen{" "}
              <code>Shirt</code> (Spieler:in).
            </li>
          </ul>
          <p className="type-body-medium mb-5 max-w-2xl text-on-surface-mittel">
            Beide Bausteine bündelt <code>usePlatzAngaben</code> für die
            Termin-Dialoge: Zustand, Zurücksetzen beim Öffnen und die Prüfung mit
            den Regeln des Fachkerns.
          </p>
          <FelderDemo />
        </Section>
      </VerzeichnisFlaeche>
    </Seitenrahmen>
  );
}
