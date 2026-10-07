import type { LucideIcon } from "lucide-react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LozengeAppearance } from "@/lib/farben";
import { HERKUNFT_LABEL, herkunftArt, kategorieStufe, type HerkunftArt } from "@/lib/labels";
import type { KategorieSlug } from "@/lib/vocab";

/* ── Lozenge ──────────────────────────────────────────────────
   Atlassians «Lozenge», wie Jira sie zeigt — bei uns die Plakette: ein
   kurzer Status oder eine Eigenschaft, auf einen Blick erkennbar (Herkunft,
   Sichtbarkeit, Altersstufe, Termin ohne Training). Sie ist KEIN
   Bedienelement; was man antippt, ist ein Chip.

   Anatomie wie `@atlaskit/lozenge` (neue Fassung): 20 px hoch, 4 px Radius,
   2 px Polsterung oben und unten, 4 px seitlich, `type-lozenge` (12/16,
   normal gesetzt), höchstens 200 px breit, Überlänge endet mit «…». Die
   Fläche ist die zarte Tönung (`lozenge-*` = ADS `background.<x>.subtler`),
   die Schrift die kräftige (`on-lozenge-*` = ADS `text.<x>.bolder`).

   Die Darstellungen tragen Atlassians Namen und Bedeutungen:
   - `neutral` — benennt bloss: Herkunft, Entwurf, Altersstufe, eingeplant,
     ausgefallen, ohne Training.
   - `information` — gilt nach aussen: öffentlich, Community.
   - `discovery` — etwas Zusätzliches: mehrere Varianten, eine neue Version.
   - `success` / `warning` / `danger` — erledigt / braucht Aufmerksamkeit /
     blockiert (im Kit, derzeit ohne Ort; ein Termin ohne Training trägt die
     Tönung seines Kalenderblatts, `BlattLozenge`).
   - `accent-*` — Kategorien ohne Wertung; bei uns die Alterskategorien.
   Die Akzente teilen Atlassians Palette mit den Bedeutungen (`accent-blue`
   hat die Werte von `information`, `accent-purple` die von `discovery`,
   `accent-orange` die von `warning`) — wie in Jira. Auseinander hält sie die
   Form: Eine Alterskategorie ist immer ein einzelner Buchstabe, jede andere
   Lozenge ein Wort.
   Die Farben stehen wörtlich aus Atlassians Dark-Theme (lib/farben.ts),
   im Druck aus dem Light-Theme — die Rollen wechseln im `@media print`. */
/** Die Form jeder Lozenge, ohne Farbe — auch für `BlattLozenge`. */
export const LOZENGE_FORM = "type-lozenge inline-flex h-5 max-w-[200px] shrink-0 items-center gap-1 rounded-flaeche px-1 py-0.5";

const darstellungen: Record<LozengeAppearance, string> = {
  neutral: "bg-lozenge-neutral text-on-lozenge-neutral",
  success: "bg-lozenge-success text-on-lozenge-success",
  warning: "bg-lozenge-warning text-on-lozenge-warning",
  danger: "bg-lozenge-danger text-on-lozenge-danger",
  information: "bg-lozenge-information text-on-lozenge-information",
  discovery: "bg-lozenge-discovery text-on-lozenge-discovery",
  "accent-blue": "bg-lozenge-accent-blue text-on-lozenge-accent-blue",
  "accent-yellow": "bg-lozenge-accent-yellow text-on-lozenge-accent-yellow",
  "accent-orange": "bg-lozenge-accent-orange text-on-lozenge-accent-orange",
  "accent-green": "bg-lozenge-accent-green text-on-lozenge-accent-green",
  "accent-magenta": "bg-lozenge-accent-magenta text-on-lozenge-accent-magenta",
  "accent-purple": "bg-lozenge-accent-purple text-on-lozenge-accent-purple",
  "accent-gray": "bg-lozenge-accent-gray text-on-lozenge-accent-gray",
};

export function Lozenge({
  appearance = "neutral",
  aufBild = false,
  iconBefore: Icon,
  title,
  children,
  className,
}: {
  appearance?: LozengeAppearance;
  /** Liegt über einem Bild (Übungskarte). Die neutrale Fläche ist
   *  halbtransparent und hinge dort am Foto darunter — darum steht sie dann im
   *  deckenden Grau (`accent-gray`), das am Schirm gleich aussieht und über
   *  jedem Bild trägt. Alle übrigen Darstellungen sind ohnehin deckend. */
  aufBild?: boolean;
  /** Zeichen vor dem Text (ADS `iconBefore`), 12 px in der Schriftfarbe. */
  iconBefore?: LucideIcon;
  /** Ausgeschriebene Bedeutung, wo der Text abkürzt (Alterskategorie «G»). */
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const darstellung = aufBild && appearance === "neutral" ? "accent-gray" : appearance;
  return (
    <span
      title={title}
      className={cn(
        LOZENGE_FORM,
        darstellungen[darstellung],
        className,
      )}
    >
      {Icon && <Icon size={12} strokeWidth={2.5} className="shrink-0" aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/* Herkunft einer Übung (Manual-Bestand, eigene öffentliche, eigener Entwurf)
   — eine Quelle für Karte, Detailansicht und Übungsauswahl. Kifu-Manual und
   Entwurf sind neutral: Sie sagen, woher etwas stammt oder in welchem
   Zwischenstand es liegt. Community ist `information`: Es gilt nach aussen.
   Der Entwurf trägt zusätzlich den Stift, damit er sich vom Manual-Bestand
   nicht nur im Wort unterscheidet. Die Zuordnung steht einmal hier und gilt
   auch für die Sichtbarkeit eines Trainings. */
const herkunftDarstellung: Record<HerkunftArt, { appearance: LozengeAppearance; icon?: LucideIcon }> = {
  manual: { appearance: "neutral" },
  entwurf: { appearance: "neutral", icon: Pencil },
  oeffentlich: { appearance: "information" },
};

function HerkunftArtLozenge({ art, label, aufBild }: { art: HerkunftArt; label: string; aufBild?: boolean }) {
  const { appearance, icon } = herkunftDarstellung[art];
  return (
    <Lozenge appearance={appearance} iconBefore={icon} aufBild={aufBild}>
      {label}
    </Lozenge>
  );
}

export function HerkunftLozenge({
  herkunft,
  visibility,
  aufBild,
}: {
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
  /** Siehe `Lozenge`: über dem Bild der Übungskarte. */
  aufBild?: boolean;
}) {
  const art = herkunftArt(herkunft, visibility);
  return <HerkunftArtLozenge art={art} label={HERKUNFT_LABEL[art]} aufBild={aufBild} />;
}

/* Sichtbarkeit eines persönlichen Trainings — dieselbe Zuordnung wie bei der
   Übung, nur heisst die öffentliche Fassung hier «Öffentlich»: Ein Training
   stammt nie aus dem Manual, darum gibt es nichts, wovon «Community» es
   abgrenzen müsste. Für Trainingskarte, Eigenschaften und Trainingskopf. */
export function SichtbarkeitLozenge({ oeffentlich }: { oeffentlich: boolean }) {
  return oeffentlich ? (
    <HerkunftArtLozenge art="oeffentlich" label="Öffentlich" />
  ) : (
    <HerkunftArtLozenge art="entwurf" label={HERKUNFT_LABEL.entwurf} />
  );
}

/* ── Alterskategorie (G bis A) ────────────────────────────────
   Je Stufe ein fest lernbarer Atlassian-Akzent — wie Jira Kategorien ohne
   Wertung färbt. Der Buchstabe unterscheidet mit (a11y: nie nur über Farbe),
   der Titel nennt die Stufe ausgeschrieben. Die Farbtöne der Stufen
   folgen dem gewohnten Kreis von Blau (G) bis Grau (A). */
const kategorieAkzent: Record<KategorieSlug, LozengeAppearance> = {
  G: "accent-blue",
  F: "accent-yellow",
  E: "accent-orange",
  D: "accent-green",
  C: "accent-magenta",
  B: "accent-purple",
  A: "accent-gray",
};

export function KategorieLozenge({ k }: { k: KategorieSlug }) {
  return (
    // Mindestens so breit wie hoch: Ein einzelner Buchstabe stünde sonst als
    // schmaler Streifen da.
    <Lozenge appearance={kategorieAkzent[k]} title={kategorieStufe[k]} className="min-w-5 justify-center">
      {k}
    </Lozenge>
  );
}

/* ── Badge ────────────────────────────────────────────────────
   Atlassians «Badge» — bei uns der Zähler: eine Zahl an einem Knopf, die
   zählt, was dessen Handlung gerade bewirkt (gewählte Werte am Filterknopf,
   Übernahmen einer Übung in dieser Sitzung). Anatomie wie `@atlaskit/badge`:
   2 px Radius, 4 px seitlich, mindestens 24 px breit, `type-lozenge`.
   Gefüllt in Primary — ADS' Markenfarbe ist bei uns das Lila —, weil er als
   Teil des Knopfes gelesen wird, nicht als eigene Aussage über den Inhalt
   wie die Lozenge. Für die Vorlesehilfe stumm: Der Knopf, an dem er hängt,
   sagt die Zahl in seinem Namen in Worten. */
export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "type-lozenge inline-flex h-4 min-w-6 shrink-0 items-center justify-center rounded-klein bg-primary px-1 text-on-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}
