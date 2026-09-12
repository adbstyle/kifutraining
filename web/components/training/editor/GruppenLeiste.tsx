"use client";

import { Plus, TriangleAlert, Users } from "lucide-react";
import { Button, ChipMenu } from "@/components/ui";
import { zeitKurz, zeitText, type Zeitsumme } from "@/lib/gruppen";
import { ordnungsEintraege, useChipFokus } from "./useChipFokus";

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
 * stehlen. Ein Konflikt der Verteilung färbt Rahmen und Zeichen rot (#150) —
 * denselben Ton wie eine Fehleingabe, denn eine dritte Signalfarbe für
 * «gemeldet, aber erlaubt» wäre eine Vokabel mehr, ohne mehr zu sagen;
 * unterschieden sind die beiden im Verhalten, nicht im Bild (der Befund
 * sperrt nichts). Den Klartext dazu trägt der Kartenfuss, denn ein Konflikt
 * hängt nie an einer Gruppe allein.
 *
 * Fokusführung, Ansage und die Menüeinträge des Ordnens teilt sie sich mit der
 * Variantenleiste (`useChipFokus`); hier bleiben das Bild und die Zeitsumme.
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
  /** Die Zeitsumme einer Gruppe, wie `zeitJeGruppe` sie führt — `undefined`
   *  heisst «keine Zuweisung». Die beiden Schreibweisen macht die Leiste
   *  selbst: `zeitKurz` für das Auge, `zeitText` für den a11y-Namen. */
  zeit: (gruppeId: string) => Zeitsumme | undefined;
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
  const fokus = useChipFokus({
    ids: gruppen.map((g) => g.id),
    onVerschieben,
    // Der Hook ordnet den Fokus und kennt dafür nur IDs; die Rückfrage des
    // Editors braucht die Gruppe samt ihrem Namen.
    onEntfernen: (id) => {
      const gruppe = gruppen.find((g) => g.id === id);
      if (gruppe) onEntfernen(gruppe);
    },
  });

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
        className="shrink-0 text-on-surface-mittel"
      />

      {gruppen.map((g, i) => {
        const grund = warnung(g.id);
        const summe = zeit(g.id);

        return (
          <ChipMenu
            key={g.id}
            ref={fokus.chipRef(g.id)}
            label={g.name}
            // Der sichtbare Name zuerst — Sprachsteuerung trifft ihn weiter —,
            // dann die Zeitsumme als ganzer Satz und, wenn es etwas zu melden
            // gibt, der Grund der roten Kontur.
            ariaLabel={`${g.name}, ${zeitText(summe, zeitZusatz)}${grund ? `, ${grund}` : ""}`}
            tone={grund ? "befund" : "neutral"}
            leading={
              grund ? (
                <TriangleAlert
                  size={14}
                  strokeWidth={2}
                  className="shrink-0 text-error"
                  aria-hidden
                />
              ) : undefined
            }
            trailing={
              <span className="text-on-surface-mittel">· {zeitKurz(summe)}</span>
            }
            items={ordnungsEintraege({
              erster: i === 0,
              letzter: i === gruppen.length - 1,
              onBearbeiten: () => onBearbeiten(g),
              onVorne: () => fokus.schiebe(g.id, -1, g.name),
              onHinten: () => fokus.schiebe(g.id, 1, g.name),
              onEntfernen: () => fokus.entferne(g.id),
            })}
          />
        );
      })}

      {/* Leise statt mono/versal: Der Knopf steht neben Chips, die Nutzertext
          tragen — in Versalien zerfiele die Leiste in zwei Stimmen (AK 2). */}
      <Button ref={fokus.hinzuRef} variant="quiet" onClick={onHinzufuegen}>
        <Plus size={16} strokeWidth={2} aria-hidden />
        Gruppe hinzufügen
      </Button>

      {/* Was sich geändert hat, hörbar: Der Fokus liegt nach dem Verschieben
          auf dem Chip, sein Name wird dabei aber nicht erneut vorgelesen. */}
      <span className="sr-only" role="status">
        {fokus.meldung}
      </span>
    </div>
  );
}
