"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { schreibeUebungInAdresse } from "@/lib/offene-uebung";
import { UebungImTraining } from "./UebungImTraining";
import { UebungsName } from "./UebungsName";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

type OffeneUebung = {
  offenId: string | null;
  oeffne: (id: string) => void;
  schliesse: () => void;
};

const Kontext = createContext<OffeneUebung | null>(null);

function useOffeneUebung(): OffeneUebung {
  const k = useContext(Kontext);
  if (!k) throw new Error("Braucht die AnsichtFlaeche um die Trainingsansicht.");
  return k;
}

/**
 * Die geöffnete Übung in der Ansicht eines Trainings (Epic #369, Story #371).
 *
 * Die Ansicht ist eine Server-Seite — auch für Betrachter ohne Konto. Was
 * offen ist, hält dieser Rahmen im Browser; Zeilen und Spalte lesen es hier.
 * Der Startwert kommt aus der Adresse (AK 10), danach zieht die Adresse ohne
 * Navigation mit, wie beim Zusammenstellen.
 *
 * Die Seite setzt den Rahmen je Variante neu auf (`key`): Ein Wechsel der
 * Variante schliesst die geöffnete Übung (Epic EK 14) — auch eine ausserhalb
 * des Hauptteils, denn der Wechsel ist eine Navigation zu einer neuen Adresse
 * ohne Übung.
 *
 * `uebungParam`: was die Adresse meinte. Konnte die Seite die Übung nicht
 * zeigen (`anfangsOffen` leer), verliert die Adresse die Angabe (AK 11).
 */
export function AnsichtFlaeche({
  anfangsOffen,
  uebungParam,
  children,
}: {
  anfangsOffen: string | null;
  uebungParam?: string;
  children: ReactNode;
}) {
  const [offenId, setOffenId] = useState(anfangsOffen);
  useEffect(() => {
    if (!anfangsOffen && uebungParam) schreibeUebungInAdresse(null);
  }, [anfangsOffen, uebungParam]);

  const oeffne = (id: string) => {
    const naechste = id === offenId ? null : id;
    setOffenId(naechste);
    schreibeUebungInAdresse(naechste);
  };
  const schliesse = () => {
    setOffenId(null);
    schreibeUebungInAdresse(null);
  };

  return <Kontext.Provider value={{ offenId, oeffne, schliesse }}>{children}</Kontext.Provider>;
}

/** Die Spalte der Ansicht: die geöffnete Übung oder die Eigenschaften. */
export function AnsichtSpalte({
  uebungen,
  altersstufe,
  eigenschaften,
}: {
  /** Die angezeigten Übungen — nur sie lassen sich öffnen. */
  uebungen: TrainingExerciseItem[];
  altersstufe: Altersstufe;
  eigenschaften: ReactNode;
}) {
  const { offenId, schliesse } = useOffeneUebung();
  const offen = offenId ? uebungen.find((u) => u.id === offenId) : undefined;
  if (!offen) return eigenschaften;
  return (
    <UebungImTraining
      item={offen}
      altersstufe={altersstufe}
      dauer={offen.durationMin}
      notiz={offen.notiz}
      durchlauf={offen.gruppen}
      onSchliessen={schliesse}
    />
  );
}

/** Eine Zeile der Übungen in der Ansicht — breit mit Markierung, wenn ihre
 *  Übung geöffnet ist (AK 5). */
export function AnsichtZeile({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const { offenId } = useOffeneUebung();
  return (
    <li
      className={cn(
        "rounded-flaeche border border-transparent",
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
  const { offenId, oeffne } = useOffeneUebung();
  return <UebungsName name={name} offen={offenId === id} onOeffnen={() => oeffne(id)} />;
}
