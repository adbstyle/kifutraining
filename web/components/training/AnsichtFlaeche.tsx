"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button, Dialog, IconButton, Tooltip } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { cn } from "@/lib/cn";
import { schreibeUebungInAdresse } from "@/lib/offene-uebung";
import { UebungImTraining } from "./UebungImTraining";
import { UebungsName } from "./UebungsName";
import { FassungInSpalte } from "./FassungInSpalte";
import type { Altersstufe } from "@/lib/altersstufe";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";

type OffeneUebung = {
  offenId: string | null;
  bearbeiten: boolean;
  /** Darf der Betrachter das Training bearbeiten (#374 AK 7)? */
  bearbeitbar: boolean;
  oeffne: (id: string, zumBearbeiten?: boolean) => void;
  schliesse: () => void;
  zeige: (id: string | null, zumBearbeiten: boolean) => void;
  setUngesichert: (ungesichert: boolean) => void;
};

const Kontext = createContext<OffeneUebung | null>(null);

function useOffeneUebung(): OffeneUebung {
  const k = useContext(Kontext);
  if (!k) throw new Error("Braucht die AnsichtFlaeche um die Trainingsansicht.");
  return k;
}

/**
 * Die geöffnete Übung in der Ansicht eines Trainings (Epic #369, Stories
 * #371/#374).
 *
 * Die Ansicht ist eine Server-Seite — auch für Betrachter ohne Konto. Was
 * offen ist, hält dieser Rahmen im Browser; Zeilen und Spalte lesen es hier.
 * Der Startwert kommt aus der Adresse (#371 AK 10), danach zieht die Adresse
 * ohne Navigation mit, wie beim Zusammenstellen.
 *
 * Wer das Training bearbeiten darf, bearbeitet die geöffnete Übung hier wie
 * beim Zusammenstellen (#374) — mit derselben Rückfrage, bevor ein Vorgang
 * ungesicherte Änderungen verlässt (AK 5). Ein Link aus der Seite heraus,
 * auch auf eine andere Variante, fragt über die Warnung der Maske selbst.
 *
 * Die Seite setzt den Rahmen je Variante neu auf (`key`): Ein Wechsel der
 * Variante schliesst die geöffnete Übung (Epic EK 14) — auch eine ausserhalb
 * des Hauptteils, denn der Wechsel ist eine Navigation zu einer neuen Adresse
 * ohne Übung.
 *
 * `uebungParam`: was die Adresse meinte. Konnte die Seite die Übung nicht
 * zeigen (`anfangsOffen` leer), verliert die Adresse die Angabe (#371 AK 11).
 */
export function AnsichtFlaeche({
  anfangsOffen,
  anfangsBearbeiten,
  uebungParam,
  bearbeitbar,
  children,
}: {
  anfangsOffen: string | null;
  anfangsBearbeiten: boolean;
  uebungParam?: string;
  bearbeitbar: boolean;
  children: ReactNode;
}) {
  const [offenId, setOffenId] = useState(anfangsOffen);
  const [bearbeiten, setBearbeiten] = useState(bearbeitbar && !!anfangsOffen && anfangsBearbeiten);
  const [ungesichert, setUngesichert] = useState(false);
  const [rueckfrage, setRueckfrage] = useState<(() => void) | null>(null);
  useEffect(() => {
    if (!anfangsOffen && uebungParam) schreibeUebungInAdresse(null);
  }, [anfangsOffen, uebungParam]);

  function nachRueckfrage(vorgang: () => void) {
    if (bearbeiten && ungesichert) setRueckfrage(() => vorgang);
    else vorgang();
  }

  function zeige(id: string | null, zumBearbeiten: boolean) {
    setOffenId(id);
    setBearbeiten(!!id && zumBearbeiten && bearbeitbar);
    setUngesichert(false);
    schreibeUebungInAdresse(id, zumBearbeiten && bearbeitbar);
  }

  function oeffne(id: string, zumBearbeiten = false) {
    if (id === offenId && zumBearbeiten === bearbeiten) {
      if (!zumBearbeiten) schliesse();
      return;
    }
    nachRueckfrage(() => zeige(id, zumBearbeiten));
  }

  function schliesse() {
    nachRueckfrage(() => zeige(null, false));
  }

  return (
    <Kontext.Provider
      value={{ offenId, bearbeiten, bearbeitbar, oeffne, schliesse, zeige, setUngesichert }}
    >
      {children}
      {/* Dieselbe Rückfrage wie beim Zusammenstellen (#374 AK 5). */}
      <Dialog
        open={rueckfrage != null}
        onClose={() => setRueckfrage(null)}
        title="Änderungen verwerfen?"
        actions={
          <>
            <Button variant="text" onClick={() => setRueckfrage(null)}>
              Weiter bearbeiten
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const vorgang = rueckfrage;
                setRueckfrage(null);
                setUngesichert(false);
                vorgang?.();
              }}
            >
              Verwerfen
            </Button>
          </>
        }
      >
        <p>
          Deine Änderungen an der Übung sind noch nicht gesichert. Wenn du weitermachst, gehen sie
          verloren.
        </p>
      </Dialog>
    </Kontext.Provider>
  );
}

/** Die Spalte der Ansicht: die geöffnete Übung — für Berechtigte auch zum
 *  Bearbeiten — oder die Eigenschaften. */
export function AnsichtSpalte({
  uebungen,
  altersstufe,
  variante,
  eigenschaften,
}: {
  /** Die angezeigten Übungen — nur sie lassen sich öffnen. */
  uebungen: TrainingExerciseItem[];
  altersstufe: Altersstufe;
  /** Die angezeigte Variante des Hauptteils — Ziel einer Übung, die beim
   *  Sichern von ausserhalb in den Hauptteil wandert. */
  variante: string | undefined;
  eigenschaften: ReactNode;
}) {
  const { offenId, bearbeiten, bearbeitbar, oeffne, schliesse, zeige, setUngesichert } =
    useOffeneUebung();
  const router = useRouter();
  const melde = useSnackbar();
  const offen = offenId ? uebungen.find((u) => u.id === offenId) : undefined;
  if (!offen) return eigenschaften;

  if (bearbeiten)
    return (
      <FassungInSpalte
        key={offen.id}
        item={offen}
        altersstufe={altersstufe}
        variante={variante}
        onUngesichert={setUngesichert}
        onGesichert={() => {
          // Die Übung bleibt geöffnet, auch an einem neuen Platz (PC 2), und
          // die Seite zeigt Lesenden den neuen Stand (PC 5).
          zeige(offen.id, false);
          router.refresh();
          melde("Übung gesichert.");
        }}
        onVerwerfen={() => zeige(offen.id, false)}
        onSchliessen={schliesse}
      />
    );

  return (
    <UebungImTraining
      item={offen}
      altersstufe={altersstufe}
      dauer={offen.durationMin}
      notiz={offen.notiz}
      durchlauf={offen.gruppen}
      aktionen={
        bearbeitbar && (
          <Tooltip label="Übung bearbeiten">
            <IconButton
              icon={Pencil}
              label={`${offen.name} bearbeiten`}
              onClick={() => oeffne(offen.id, true)}
            />
          </Tooltip>
        )
      }
      onSchliessen={schliesse}
    />
  );
}

/** Eine Zeile der Übungen in der Ansicht — breit mit Markierung, wenn ihre
 *  Übung geöffnet ist (#371 AK 5). */
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
        // Breit hellt die ganze Zeile auf und öffnet (`UebungsName`).
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
  const { offenId, oeffne } = useOffeneUebung();
  return <UebungsName name={name} offen={offenId === id} onOeffnen={() => oeffne(id)} />;
}
