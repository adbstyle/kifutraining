"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button, ChipMenu, type MenuItemDef } from "@/components/ui";
import { zeitKurz } from "@/lib/gruppen";

/** Fokus-Ziel «der Hinzufügen-Knopf». Keine Gruppen-ID kann so heissen —
 *  Gruppen-IDs sind UUIDs (Muster `DurchlaufZeile`). */
const HINZU = " hinzu";

/** Die Kurzform für «lässt sich nicht sagen», aus derselben Quelle wie die
 *  Anzeige — abgeschrieben liefe der Vergleich beim nächsten Wortwechsel
 *  auseinander. */
const OHNE_SUMME = zeitKurz();

/**
 * Die Gruppenleiste der Hauptteil-Karte (#209 AK 1/3/4).
 *
 * Eine Chip-Reihe statt des aufklappbaren Feld-Abschnitts von #149: Gruppe und
 * Variante sind für den Trainer dieselbe Art von Sache — eine benannte Grösse,
 * die er anlegt, umbenennt, ordnet und entfernt. Zwei Bauformen dafür zu lernen
 * (Chip-Reihe hier, Feldliste dort) ist eine Zumutung ohne Gegenwert. Jetzt
 * trägt jede Gruppe ihren Chip, und alles Weitere hängt an seinem Menü.
 *
 * Das Personen-Zeichen steht IMMER, auch ohne eine einzige Gruppe (AK 1): Es
 * sagt, wovon diese Zeile handelt — ein Knopf allein sagte es nicht, und die
 * Leiste darüber (Varianten) sähe sonst gleich aus.
 *
 * Der Chip nennt die zugewiesene Zeit als gedämpften Zusatz (Story #151): Sie
 * ist eine Auskunft, keine Handlung, und darf dem Namen nicht die Schau
 * stehlen. Ein Konflikt der Verteilung färbt Rahmen und Zeichen bernstein
 * (#150) — den Klartext dazu trägt der Kartenfuss, denn ein Konflikt hängt nie
 * an einer Gruppe allein.
 */
export function GruppenLeiste({
  gruppen,
  zeit,
  zeitZusatz,
  warnung,
  onHinzufuegen,
  onBearbeiten,
  onVerschieben,
  onEntfernen,
}: {
  /** Die Gruppen in der vom Trainer gesetzten Reihenfolge (AK 4). */
  gruppen: { id: string; name: string }[];
  /** Die Zeitsumme einer Gruppe in Kurzform (`zeitKurz`) — «40 min» oder «—». */
  zeit: (gruppeId: string) => string;
  /** Woraufhin die Summe gilt, wenn sie nur einen Teil des Trainings meint:
   *  «in dieser Variante» (#201 AK 9). Nur für den a11y-Namen — sichtbar
   *  ergäbe der Zusatz an jedem Chip eine Zeile voller Wiederholungen. */
  zeitZusatz?: string;
  /** Der Konflikt-Kurztext zu einer Gruppe, sonst `undefined` (#150). */
  warnung: (gruppeId: string) => string | undefined;
  onHinzufuegen: () => void;
  onBearbeiten: (gruppe: { id: string; name: string }) => void;
  onVerschieben: (gruppeId: string, dir: -1 | 1) => void;
  onEntfernen: (gruppe: { id: string; name: string }) => void;
}) {
  // Was der Screenreader nach einer Änderung hört. Die Chips sagen es nicht:
  // Nach dem Verschieben liegt der Fokus zwar auf dem Chip, sein Name wird aber
  // nicht erneut vorgelesen.
  const [meldung, setMeldung] = useState("");
  // Welcher Chip nach dem nächsten Rendern den Fokus bekommt. Das Menü gibt ihn
  // an seinen Trigger zurück, BEVOR React die Leiste neu ordnet — der Chip
  // wandert danach im DOM und verlöre ihn dabei. Ref statt State: es ist kein
  // Anzeigezustand, und ein zusätzliches Rendern brächte nichts.
  const fokusZiel = useRef<string | null>(null);
  // Dasselbe für das Entfernen, aber an eine Bedingung geknüpft: Zwischen Klick
  // und Wegfall kann eine Rückfrage stehen (AK 3), und die will den Fokus für
  // sich. Darum wird erst zugegriffen, wenn die Gruppe wirklich weg ist.
  const wegZiel = useRef<{ id: string; ziel: string } | null>(null);
  const chips = useRef(new Map<string, HTMLButtonElement | null>());
  const hinzuKnopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const weg = wegZiel.current;
    // Solange die Gruppe noch steht, ist die Rückfrage offen (oder wurde
    // abgebrochen) — dann gilt hier nichts, und der Fokus nach einer
    // Verschiebung kommt trotzdem zu seinem Recht.
    if (weg && !gruppen.some((g) => g.id === weg.id)) {
      wegZiel.current = null;
      (weg.ziel === HINZU ? hinzuKnopf.current : chips.current.get(weg.ziel))?.focus();
      return;
    }
    const ziel = fokusZiel.current;
    if (!ziel) return;
    fokusZiel.current = null;
    chips.current.get(ziel)?.focus();
  });

  function schiebe(i: number, dir: -1 | 1) {
    const gruppe = gruppen[i];
    // Eine abgebrochene Rückfrage lässt ihr Ziel stehen; es zeigte nach dem
    // Umsortieren auf die falsche Stelle.
    wegZiel.current = null;
    fokusZiel.current = gruppe.id;
    setMeldung(`„${gruppe.name}" steht jetzt an ${i + dir + 1}. Stelle.`);
    onVerschieben(gruppe.id, dir);
  }

  function entferne(i: number) {
    const gruppe = gruppen[i];
    // Der Fokus darf nicht ins Nichts fallen: Er geht an die Gruppe, die an die
    // Stelle nachrückt, sonst an die davor — und war es die letzte, an den
    // Hinzufügen-Knopf (Muster `DurchlaufZeile`).
    const rest = gruppen.filter((_, j) => j !== i);
    wegZiel.current = { id: gruppe.id, ziel: rest[i]?.id ?? rest[i - 1]?.id ?? HINZU };
    onEntfernen(gruppe);
  }

  return (
    // Das Zeichen benennt die Leiste für die Sehenden; `role="group"` samt Name
    // tut dasselbe für alle anderen (wie `VariantenWahl` es hält).
    <div
      role="group"
      aria-label="Gruppen"
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <Users
        size={18}
        strokeWidth={2}
        aria-hidden
        className="shrink-0 text-on-surface-variant"
      />

      {gruppen.map((g, i) => {
        const grund = warnung(g.id);
        const summe = zeit(g.id);
        // Der Zusatz hängt nur an einer wirklichen Summe: An «zugewiesen —»
        // schränkte er eine Aussage ein, die es gar nicht gibt (`zeitText`
        // hält es genauso).
        const gilt = zeitZusatz && summe !== OHNE_SUMME ? ` ${zeitZusatz}` : "";

        const eintraege: MenuItemDef[] = [
          { label: "Bearbeiten", icon: Pencil, onSelect: () => onBearbeiten(g) },
        ];
        // Nicht Anwendbares wird WEGGELASSEN, nicht ausgegraut: An der ersten
        // Gruppe gibt es kein «nach vorne», und ein totes Menü-Element zu
        // zeigen hiesse, es erst lesen und dann verwerfen zu lassen (AK 3).
        if (i > 0)
          eintraege.push({
            label: "Nach vorne",
            icon: ChevronLeft,
            onSelect: () => schiebe(i, -1),
          });
        if (i < gruppen.length - 1)
          eintraege.push({
            label: "Nach hinten",
            icon: ChevronRight,
            onSelect: () => schiebe(i, 1),
          });
        eintraege.push({
          label: "Entfernen",
          icon: Trash2,
          danger: true,
          onSelect: () => entferne(i),
        });

        return (
          <ChipMenu
            key={g.id}
            ref={(el) => {
              chips.current.set(g.id, el);
              return () => {
                chips.current.delete(g.id);
              };
            }}
            label={g.name}
            // Der sichtbare Name zuerst — Sprachsteuerung trifft ihn weiter —,
            // dann die Zeitsumme und, wenn es etwas zu melden gibt, der Grund
            // der Warnfarbe.
            ariaLabel={`${g.name}, zugewiesen ${summe}${gilt}${grund ? `, ${grund}` : ""}`}
            tone={grund ? "warning" : "neutral"}
            leading={
              grund ? (
                <TriangleAlert
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-warning"
                  aria-hidden
                />
              ) : undefined
            }
            trailing={<span className="text-on-surface-variant">· {summe}</span>}
            items={eintraege}
          />
        );
      })}

      {/* Leise statt mono/versal: Der Knopf steht neben Chips, die Nutzertext
          tragen — in Versalien zerfiele die Leiste in zwei Stimmen (AK 2). */}
      <Button ref={hinzuKnopf} variant="quiet" onClick={onHinzufuegen}>
        <Plus size={16} strokeWidth={2} aria-hidden />
        Gruppe hinzufügen
      </Button>

      {/* Was sich geändert hat, hörbar: Der Fokus liegt nach dem Verschieben
          auf dem Chip, sein Name wird dabei aber nicht erneut vorgelesen. */}
      <span className="sr-only" role="status">
        {meldung}
      </span>
    </div>
  );
}
