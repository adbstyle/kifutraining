import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "./Card";

/* ── Eigenschaften ────────────────────────────────────────────
   Eine benannte Liste aus Bezeichnung und Wert — die Einordnung einer Übung
   in der Spalte rechts (Epic #350), angelehnt an das Details-Panel von Jira.
   Neu, weil kein bestehender Baustein Bezeichnung und Wert paarweise führt:
   `FormAbschnitt` gliedert Formulare, die Eckdatenzeile der Karte reiht
   Werte ohne Bezeichnung.

   Semantik: eine Beschreibungsliste (`dl`), je Zeile `dt` und `dd`. Die
   Bezeichnung steht links in fester Spalte, der Wert rechts und bricht in
   seiner Spalte um — ein langer Wert schiebt die nächste Zeile hinunter, nie
   die Bezeichnung zur Seite. `EigenschaftBreit` (etwa eine Section Message) läuft über
   beide Spalten.

   Die Bezeichnung steht in gedämpfter Lesetype, nicht in der Versal-Type der
   Labels: Versalien mit Sperrung brauchen für «Hauptteilkategorie» mehr
   Breite, als eine schmale Spalte neben dem Wert lässt. Auf Papier stehen
   Bezeichnung und Wert untereinander — die Spalte ist dort schmaler.

   Die Fläche ist eine `Card`: Die Liste liegt eine Stufe über dem Grund und
   setzt sich so vom Lesetext daneben ab, ohne eigene Kontur. */
export function Eigenschaften({
  titel,
  children,
  className,
}: {
  /** Überschrift der Liste — zugleich der Name des Abschnitts für Vorlesehilfen. */
  titel: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card role="region" aria-label={titel} className={cn("p-4", className)}>
      <h2 className="type-title-small text-on-surface">{titel}</h2>
      <dl className="mt-4 grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 print:grid-cols-1 print:gap-y-0">
        {children}
      </dl>
    </Card>
  );
}

/** Eine Zeile der Liste: Bezeichnung und Wert. */
export function Eigenschaft({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  /** Für Zeilen, die nur an einer Stelle anders aussehen (etwa im Druck). */
  className?: string;
}) {
  return (
    <div className={cn("contents", className)}>
      <dt className="type-body-medium text-on-surface-mittel print:mt-2.5 print:type-body-small">
        {label}
      </dt>
      <dd className="type-body-medium min-w-0 text-on-surface">{children}</dd>
    </div>
  );
}

/** Eine Zeile ohne Wert: Die Angabe ist vorgesehen, aber nicht erfasst (#352).
 *  Gedämpft wie die Bezeichnung, damit sie sich von erfassten Werten abhebt,
 *  ohne nach einem Fehler auszusehen — fehlen darf sie. Nie auf Papier: Das
 *  Blatt geht an Co-Trainer und Eltern, für sie zählt, was erfasst ist. */
export function EigenschaftFehlt({ label }: { label: string }) {
  return (
    <div className="contents print:hidden">
      <dt className="type-body-medium text-on-surface-mittel">{label}</dt>
      <dd className="type-body-medium min-w-0 text-on-surface-mittel">Nicht erfasst</dd>
    </div>
  );
}

/** Ein Eintrag über beide Spalten — für das, was zu einer Zeile gehört, aber
 *  keine sichtbare Bezeichnung braucht (der Hinweis auf geändertes Material).
 *  Die Bezeichnung bleibt für Vorlesehilfen da: Eine Beschreibungsliste kennt
 *  keinen Wert ohne Begriff. */
export function EigenschaftBreit({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("contents", className)}>
      <dt className="sr-only">{label}</dt>
      <dd className="col-span-2 min-w-0 print:col-span-1">{children}</dd>
    </div>
  );
}
