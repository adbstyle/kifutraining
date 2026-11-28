"use client";

import { CalendarDays } from "lucide-react";
import { Breadcrumbs, Button, OverflowMenu, SectionMessage } from "@/components/ui";
import { KopfAktionen, KopfKnopfText } from "@/components/layout/KopfAktionen";

/* Demonstriert die Kopfzeile einer Seite mit Aktionen (#706): letzte
   Brotkrume = Name der Seite, rechts `KopfAktionen` — Hauptaktion gefüllt,
   Zweitaktionen in Kontur links von ihr, ein Menü ⋮ rechts aussen; die
   Kurzform für schmale Fenster und die gesperrte Hauptaktion mit dem Satz
   darunter. Client-Boundary wegen des Menüs. */
const KRUMEN = [
  { label: "FC Wyler", href: "#" },
  { label: "Teams", href: "#" },
  { label: "FC Wyler FF-11", href: "#" },
];

function Zeile({ seite, aktionen }: { seite: string; aktionen: React.ReactNode }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-flaeche bg-elev-00 px-4 kontur border-kante">
      <Breadcrumbs items={[...KRUMEN, { label: seite }]} />
      <div className="ml-auto flex shrink-0 items-center">{aktionen}</div>
    </div>
  );
}

export function SeitenKopfDemo() {
  return (
    <div className="space-y-6">
      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Hauptaktion und Menü (Trainingsplan)</p>
        <Zeile
          seite="Trainingsplan"
          aktionen={
            <KopfAktionen
              haupt={
                <Button variant="filled">
                  <KopfKnopfText label="Termin erstellen" kurz="Erstellen" />
                </Button>
              }
              menue={
                <OverflowMenu
                  label="Weitere Aktionen zum Trainingsplan"
                  items={[{ label: "Kalender abonnieren", icon: CalendarDays, onSelect: () => {} }]}
                />
              }
            />
          }
        />
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Hauptaktion und Zweitaktion in Kontur</p>
        <Zeile
          seite="Spieler:innen"
          aktionen={
            <KopfAktionen
              zweit={<Button variant="outlined">Importieren</Button>}
              haupt={
                <Button variant="filled">
                  <KopfKnopfText label="Spieler:in hinzufügen" kurz="Hinzufügen" />
                </Button>
              }
            />
          }
        />
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">
          Schmal (unter sm): die Kurzform, der volle Name bleibt für Vorlesehilfen
        </p>
        <div className="flex max-w-sm min-h-16 items-center gap-3 rounded-flaeche bg-elev-00 px-4 kontur border-kante">
          <Breadcrumbs items={[{ label: "FC Wyler FF-11", href: "#" }, { label: "Spieler:innen" }]} />
          <div className="ml-auto flex shrink-0 items-center">
            <Button variant="filled">
              <span aria-hidden>Hinzufügen</span>
              <span className="sr-only">Spieler:in hinzufügen</span>
            </Button>
          </div>
        </div>
      </div>

      <div>
        <p className="type-label-small mb-2 text-on-surface-mittel">Gesperrt an einer Grenze: sichtbar, mit dem Grund darunter</p>
        <div className="space-y-4">
          <Zeile
            seite="Spieler:innen"
            aktionen={
              <KopfAktionen
                haupt={
                  <Button variant="filled" disabled aria-describedby="styleguide-gesperrt">
                    <KopfKnopfText label="Spieler:in hinzufügen" kurz="Hinzufügen" />
                  </Button>
                }
              />
            }
          />
          <div id="styleguide-gesperrt">
            <SectionMessage>
              Im Verein ist kein Platz für weitere Spieler:innen. Zuerst muss die Vereinsverwaltung Platz schaffen.
            </SectionMessage>
          </div>
        </div>
      </div>
    </div>
  );
}
