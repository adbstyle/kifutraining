import { cn } from "@/lib/cn";

type Tone = "manual" | "entwurf" | "oeffentlich" | "neutral" | "varianten";

/* Gefüllt heisst still, umrandet heisst gilt.
   Eine Plakette meldet entweder bloss, woher etwas stammt oder in welchem
   Zwischenstand es liegt — dann trägt sie eine Höhenstufe oder die Kante und
   gedämpfte Schrift, sie soll gelesen und wieder vergessen werden. Oder sie
   meldet eine Eigenschaft, die nach aussen wirkt: öffentlich sichtbar, mehrere
   Varianten vorhanden — dann steht sie umrandet in Primary. Keine der beiden
   Formen füllt mit Akzentfarbe; das bleibt dem gefüllten Knopf vorbehalten,
   der etwas auslöst. */
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
};

/* Nur die Töne, deren Aufschrift IMMER dieselbe ist, führen hier eine Vorgabe.
   `neutral` und `varianten` beschriften sich aus ihren Daten (Altersstufe,
   Anzahl) — ein leerer Eintrag täuschte eine Vorgabe vor, die es nicht gibt.
   Darum `Partial`: Fehlt der Ton hier, verlangt die Plakette ihren Text. */
const defaultLabel: Partial<Record<Tone, string>> = {
  manual: "Kifu-Manual",
  entwurf: "Entwurf",
  oeffentlich: "Community",
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
  if (herkunft === "manual") return <Badge tone="manual" />;
  if (visibility === "public") return <Badge tone="oeffentlich" />;
  return <Badge tone="entwurf">✎ Entwurf</Badge>;
}
