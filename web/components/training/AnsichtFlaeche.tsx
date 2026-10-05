"use client";

import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { UebungsName } from "./UebungsName";
import { InBibliothekButton } from "./InBibliothekButton";
import { OffeneUebungSpalte, VerwerfenRueckfrage } from "./OffeneUebungSpalte";
import { useOffeneUebung, type OffeneUebung } from "./useOffeneUebung";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

const Kontext = createContext<OffeneUebung | null>(null);

function useAnsichtFlaeche(): OffeneUebung {
  const k = useContext(Kontext);
  if (!k) throw new Error("Braucht die AnsichtFlaeche um die Trainingsansicht.");
  return k;
}

/**
 * Die geöffnete Übung in der Ansicht eines Trainings (Epic #369, Stories
 * #371/#374) — dieselbe Regel wie beim Zusammenstellen (`useOffeneUebung`).
 *
 * Die Ansicht ist eine Server-Seite, auch für Betrachter ohne Konto. Was
 * offen ist, hält dieser Rahmen im Browser; Zeilen und Spalte lesen es hier.
 * Wer das Training bearbeiten darf, bearbeitet die geöffnete Übung hier wie
 * beim Zusammenstellen (#374). Ein Link aus der Seite heraus, auch auf eine
 * andere Variante, fragt über die Verlassen-Warnung der Maske selbst.
 *
 * Die Seite setzt den Rahmen je Variante neu auf (`key`): Ein Wechsel der
 * Variante schliesst die geöffnete Übung (Epic EK 14) — auch eine ausserhalb
 * des Hauptteils, denn der Wechsel ist eine Navigation zu einer neuen Adresse
 * ohne Übung.
 */
export function AnsichtFlaeche({
  anfangsOffenId,
  anfangsBearbeiten,
  uebungParam,
  bearbeitbar,
  uebungen,
  children,
}: {
  anfangsOffenId: string | null;
  anfangsBearbeiten: boolean;
  uebungParam?: string;
  bearbeitbar: boolean;
  /** Die angezeigten Übungen — für den Namen in der Rückfrage. */
  uebungen: readonly TrainingExerciseItem[];
  children: ReactNode;
}) {
  const steuerung = useOffeneUebung({
    anfangsOffenId,
    anfangsBearbeiten,
    uebungParam,
    bearbeitbar,
  });
  const offen = uebungen.find((u) => u.id === steuerung.offenId);

  return (
    <Kontext.Provider value={steuerung}>
      {children}
      <VerwerfenRueckfrage steuerung={steuerung} name={offen?.name} />
    </Kontext.Provider>
  );
}

/** Die Spalte der Ansicht: die geöffnete Übung — für Berechtigte auch zum
 *  Bearbeiten — oder die Eigenschaften. */
export function AnsichtSpalte({
  uebungen,
  altersstufe,
  variante,
  kopierbar,
  eigenschaften,
}: {
  /** Die angezeigten Übungen — nur sie lassen sich öffnen. */
  uebungen: TrainingExerciseItem[];
  altersstufe: Altersstufe;
  /** Die angezeigte Variante des Hauptteils. */
  variante: string | undefined;
  /** In die eigene Bibliothek kopieren — nur mit Konto (Story 7). */
  kopierbar: boolean;
  eigenschaften: ReactNode;
}) {
  const steuerung = useAnsichtFlaeche();
  const offen = uebungen.find((u) => u.id === steuerung.offenId);
  return (
    <OffeneUebungSpalte
      steuerung={steuerung}
      offen={offen}
      altersstufe={altersstufe}
      variante={variante}
      durchlauf={offen?.gruppen ?? []}
      aktionen={
        kopierbar && offen && <InBibliothekButton fassungId={offen.id} name={offen.name} />
      }
      eigenschaften={eigenschaften}
    />
  );
}

/** Eine Zeile der Übungen in der Ansicht — breit hellt sie auf, öffnet
 *  (`UebungsName`) und ist markiert, wenn ihre Übung geöffnet ist (#371 AK 5). */
export function AnsichtZeile({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { offenId } = useAnsichtFlaeche();
  return (
    <li
      className={cn(
        "relative rounded-flaeche border border-transparent xl:state",
        offenId === id && "xl:border-primary",
        className,
      )}
    >
      {children}
    </li>
  );
}

/** Der Name einer Übung in der Ansicht — breit der Knopf zum Öffnen. */
export function AnsichtUebungsName({ id, name }: { id: string; name: string }) {
  const { offenId, oeffne } = useAnsichtFlaeche();
  return <UebungsName name={name} offen={offenId === id} onOeffnen={() => oeffne(id)} />;
}
