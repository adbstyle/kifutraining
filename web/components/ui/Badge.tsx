import { cn } from "@/lib/cn";
import { HERKUNFT_LABEL, herkunftArt } from "@/lib/labels";

type Tone = "manual" | "entwurf" | "oeffentlich" | "neutral" | "varianten" | "befund";

/* Gefüllt heisst still, umrandet heisst gilt.
   Eine Plakette meldet entweder bloss, woher etwas stammt oder in welchem
   Zwischenstand es liegt — dann trägt sie eine Höhenstufe oder die Kante und
   gedämpfte Schrift, sie soll gelesen und wieder vergessen werden. Oder sie
   meldet eine Eigenschaft, die nach aussen wirkt: öffentlich sichtbar, mehrere
   Varianten vorhanden — dann steht sie umrandet in Primary. Keine der beiden
   Formen füllt mit Akzentfarbe; das bleibt dem gefüllten Knopf vorbehalten,
   der etwas auslöst — und dem `Zaehler` unten, der an einem solchen hängt. */
const tones: Record<Tone, string> = {
  // Manual-Bestand: eine Herkunftsangabe, mehr nicht — Kontur und gedämpfte
  // Schrift, damit sie neben dem Titel der Übung nicht mitspricht.
  manual: "kontur border-kante text-on-surface-mittel",
  // Eigener Entwurf (privat): eine Höhenstufe statt einer Kontur — deckend und
  // darum auch über einem Bild lesbar, aber ohne Farbe, denn ein Entwurf ist
  // ein Zwischenstand und keine Eigenschaft.
  entwurf: "bg-elev-08 text-on-surface-mittel",
  // Öffentlich: gilt nach aussen, also umrandet in Primary.
  oeffentlich: "kontur border-primary text-primary",
  neutral: "kontur border-kante text-on-surface-mittel",
  // Varianten-Zahl (TrainingCard, TeamTrainingsListe): wie `oeffentlich` —
  // sie sagt etwas über den Inhalt aus, das man beim Öffnen erwarten darf.
  varianten: "kontur border-primary text-primary",
  // Etwas ist offen, das jemand erledigen muss — noch kein Training am
  // anstehenden Termin (Team-Kalender #322 AK 16). Derselbe Ton wie der
  // Befund am ChipMenu: Rahmen und Schrift in Error, keine Fläche. Er meldet
  // eine Lücke, keinen Fehler; darum umrandet statt gefüllt.
  befund: "kontur border-error text-error",
};

/* Nur die Töne, deren Aufschrift IMMER dieselbe ist, führen hier eine Vorgabe.
   `neutral` und `varianten` beschriften sich aus ihren Daten (Altersstufe,
   Anzahl) — ein leerer Eintrag täuschte eine Vorgabe vor, die es nicht gibt.
   Darum `Partial`: Fehlt der Ton hier, verlangt die Plakette ihren Text.
   Die Aufschriften selbst stehen in `HERKUNFT_LABEL` (lib/labels.ts): dieselben
   Wörter gibt das KI-Werkzeug «uebungen_suchen» aus (#142). */
const defaultLabel: Partial<Record<Tone, string>> = {
  manual: HERKUNFT_LABEL.manual,
  entwurf: HERKUNFT_LABEL.entwurf,
  oeffentlich: HERKUNFT_LABEL.oeffentlich,
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "type-plakette inline-flex h-[22px] items-center gap-1 rounded-plakette px-2",
        tones[tone],
        className,
      )}
    >
      {children ?? defaultLabel[tone] ?? null}
    </span>
  );
}

/* Herkunfts-/Status-Plakette: Manual-Bestand vs. eigene öffentliche/Entwurf-Übung.
   Eine Quelle für Karte und Detailansicht. */
export function HerkunftBadge({
  herkunft,
  visibility,
}: {
  herkunft: "manual" | "user";
  visibility?: "public" | "private";
}) {
  const art = herkunftArt(herkunft, visibility);
  // Der Entwurf trägt auf der Plakette zusätzlich den Stift.
  if (art === "entwurf") return <Badge tone="entwurf">✎ {HERKUNFT_LABEL.entwurf}</Badge>;
  return <Badge tone={art} />;
}

/* Zähler: die eine gefüllte Plakette des Kits. Er hängt an einem Knopf und
   zählt, was dessen Handlung gerade bewirkt — die gewählten Werte am
   Filterknopf, die Übernahmen einer Übung in dieser Sitzung. Gefüllt, weil er
   als Teil des Knopfes gelesen wird, nicht als eigene Aussage über den Inhalt
   wie die Plaketten oben. Für die Vorlesehilfe stumm: Der Knopf, an dem er
   hängt, sagt die Zahl in seinem Namen in Worten. */
export function Zaehler({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "type-plakette inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-on-primary",
        className,
      )}
    >
      {children}
    </span>
  );
}
