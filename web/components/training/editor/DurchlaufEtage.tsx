"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { AssistChip, ChipMenu, Menu, type MenuItemDef } from "@/components/ui";

/** Fokus-Ziel «der Hinzufügen-Chip». Kein Gruppen-Schlüssel kann so heissen —
 *  Gruppen-IDs sind UUIDs. */
const HINZU = " hinzu";

/**
 * Der Durchlauf einer Übung im Hauptteil (Story #150) — das zweite Geschoss
 * der Übungszeile.
 *
 * Die Chips sind eine FOLGE, keine Auswahl: Der erste Chip ist der 1. Wechsel,
 * der zweite der 2. — und dieser Wechsel meint über alle Übungen des
 * Hauptteils dasselbe Zeitfenster, im Juniorenfussball über beide Blöcke
 * hinweg (AK 11). Darum die Listen-Semantik samt Pfeil-Trennern und nicht ein
 * Feld mit Mehrfachauswahl.
 *
 * Ohne Zuweisung steht hier «Alle gemeinsam» (AK 7). Das ist ein WERT, kein
 * Mangel: kein Icon, keine Signalfarbe, kein Aufruf zum Handeln — die ganze
 * Trainingsgruppe macht die Übung zusammen, und das ist der Normalfall.
 *
 * Verschieben und Entfernen sitzen im Menü des Chips selbst. Ein Chevron-Paar
 * plus X an jedem Chip wäre bei vier Gruppen ein Dutzend 16px-Ziele in einer
 * Zeile; Drag-and-Drop hätte kein Tastatur-Äquivalent (verworfen im Design).
 */
export function DurchlaufEtage({
  uebungName,
  folge,
  gruppen,
  wechselGesamt,
  warnung,
  onFolge,
}: {
  /** Für die a11y-Namen: derselbe Chip steht an jeder Übung des Hauptteils. */
  uebungName: string;
  /** Die zugewiesenen Gruppen als IDs, in Wechselreihenfolge. */
  folge: string[];
  /** Alle Gruppen des Trainings — Bezeichnungen und der Vorrat zum Hinzufügen. */
  gruppen: { id: string; name: string }[];
  /** Wie viele Wechsel der ganze Hauptteil hat (`wechselZahl`). Der Durchlauf
   *  dieser Übung kann kürzer sein; «Wechsel 2 von 4» sagt genau das. */
  wechselGesamt: number;
  /** Der Konflikt-Grund an einer zugewiesenen Gruppe, sonst `undefined`. */
  warnung: (gruppeId: string) => string | undefined;
  /** Die neue Folge — Zuweisen, Umsortieren und Entfernen sind dasselbe. */
  onFolge: (next: string[]) => void;
}) {
  const [hinzuOffen, setHinzuOffen] = useState(false);
  // Was der Screenreader nach einer Änderung hört. Die Chips selbst sagen es
  // nicht: Nach dem Verschieben liegt der Fokus zwar auf dem Chip, sein Name
  // wird aber nicht erneut vorgelesen.
  const [meldung, setMeldung] = useState("");
  // Welcher Chip nach dem nächsten Rendern den Fokus bekommt. Das Menü gibt ihn
  // an den Trigger zurück, BEVOR React die Liste neu ordnet — der Chip wandert
  // danach im DOM und verliert ihn dabei. Ref statt State: es ist kein
  // Anzeigezustand, und ein zusätzliches Rendern brächte nichts.
  const fokusZiel = useRef<string | null>(null);
  const chips = useRef(new Map<string, HTMLButtonElement | null>());
  const hinzuChip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ziel = fokusZiel.current;
    if (!ziel) return;
    fokusZiel.current = null;
    (ziel === HINZU ? hinzuChip.current : chips.current.get(ziel))?.focus();
  });

  const nachId = new Map(gruppen.map((g) => [g.id, g]));
  const zugewiesen = folge.map((id) => nachId.get(id)).filter((g) => g != null);
  const offen = gruppen.filter((g) => !folge.includes(g.id));

  /** Eine neue Folge setzen und ansagen, wo die bewegte Gruppe nun steht. */
  function setze(next: string[], name: string, wechsel: number | null) {
    setMeldung(
      wechsel == null
        ? `${name} ist nicht mehr an dieser Übung.`
        : `${name} ist jetzt im ${wechsel}. Wechsel.`,
    );
    onFolge(next);
  }

  function schiebe(i: number, richtung: -1 | 1) {
    const next = [...folge];
    [next[i], next[i + richtung]] = [next[i + richtung], next[i]];
    const gruppe = zugewiesen[i];
    fokusZiel.current = gruppe.id;
    setze(next, gruppe.name, i + richtung + 1);
  }

  function nimm(i: number) {
    const next = folge.filter((_, j) => j !== i);
    const gruppe = zugewiesen[i];
    // Der Fokus darf nicht ins Nichts fallen: Er geht an den Chip, der an die
    // Stelle nachrückt, sonst an den davor — und ist die Zeile leer, an den
    // Hinzufügen-Chip.
    fokusZiel.current = next[i] ?? next[i - 1] ?? HINZU;
    setze(next, gruppe.name, null);
  }

  function fuegeHinzu(gruppe: { id: string; name: string }) {
    // Der Fokus bleibt am Hinzufügen-Chip, solange es dort noch etwas zu holen
    // gibt — mehrere Gruppen hintereinander zuzuweisen ist der Normalfall. Mit
    // der letzten verschwindet der Chip, und der Fokus geht an die neue Gruppe.
    if (offen.length <= 1) fokusZiel.current = gruppe.id;
    setze([...folge, gruppe.id], gruppe.name, folge.length + 1);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-[78px] shrink-0 type-label-small text-on-surface-variant">
        Durchlauf
      </span>

      {zugewiesen.length === 0 ? (
        <span className="type-body-medium text-on-surface-variant">Alle gemeinsam</span>
      ) : (
        <ol className="flex flex-wrap items-center gap-1.5">
          {zugewiesen.map((g, i) => {
            const grund = warnung(g.id);
            const eintraege: MenuItemDef[] = [];
            // Nicht Anwendbares wird WEGGELASSEN, nicht ausgegraut: Am ersten
            // Chip gibt es kein «nach vorne», und ein totes Menü-Element zu
            // zeigen hiesse, es erst lesen und dann verwerfen zu lassen.
            if (i > 0)
              eintraege.push({
                label: "Nach vorne",
                icon: ChevronLeft,
                onSelect: () => schiebe(i, -1),
              });
            if (i < zugewiesen.length - 1)
              eintraege.push({
                label: "Nach hinten",
                icon: ChevronRight,
                onSelect: () => schiebe(i, 1),
              });
            eintraege.push({
              label: "Aus dieser Übung nehmen",
              icon: X,
              onSelect: () => nimm(i),
            });

            return (
              <li key={g.id} className="flex items-center gap-1.5">
                <ChipMenu
                  ref={(el) => {
                    chips.current.set(g.id, el);
                    return () => {
                      chips.current.delete(g.id);
                    };
                  }}
                  label={g.name}
                  // Der sichtbare Name zuerst — Sprachsteuerung trifft ihn
                  // weiter —, dann die Stellung in der Folge und, wenn es
                  // etwas zu melden gibt, der Grund der Warnfarbe.
                  ariaLabel={`${g.name}, Wechsel ${i + 1} von ${wechselGesamt}${
                    grund ? `, ${grund}` : ""
                  }`}
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
                  items={eintraege}
                />
                {i < zugewiesen.length - 1 && (
                  <span aria-hidden className="inline-flex text-on-surface-variant">
                    <ArrowRight size={14} strokeWidth={2} />
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Sind alle Gruppen zugewiesen, gibt es nichts mehr hinzuzufügen — der
          Chip verschwindet, statt ein leeres Menü zu öffnen. */}
      {offen.length > 0 && (
        <div className="relative ml-auto">
          <AssistChip
            ref={hinzuChip}
            icon={Plus}
            ariaLabel={`Gruppe hinzufügen zu ${uebungName}`}
            ariaHasPopup="menu"
            ariaExpanded={hinzuOffen}
            onClick={() => setHinzuOffen((o) => !o)}
          >
            Gruppe hinzufügen
          </AssistChip>
          <Menu
            open={hinzuOffen}
            onClose={() => setHinzuOffen(false)}
            triggerRef={hinzuChip}
            className="right-0"
            items={offen.map((g) => ({
              label: g.name,
              // Die Zeitsumme der Gruppe steht hier ab Story #151 als
              // `trailing` — am Ort der Entscheidung.
              onSelect: () => fuegeHinzu(g),
            }))}
          />
        </div>
      )}

      {/* Was sich geändert hat, hörbar: Der Fokus liegt nach dem Verschieben auf
          dem Chip, sein Name wird dabei aber nicht erneut vorgelesen. */}
      <span className="sr-only" role="status">
        {meldung}
      </span>
    </div>
  );
}
