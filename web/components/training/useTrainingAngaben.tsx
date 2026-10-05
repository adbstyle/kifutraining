"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { renameTraining, setTrainingStufen, setTrainingZiel } from "@/lib/actions/trainings";
import type { Variante } from "@/lib/varianten";

/* Name, Ziel und Alterskategorien eines Trainings speichern — beim
   Zusammenstellen wie in der Ansicht dieselbe Regel (#250, Story 10, #12,
   #375). Jede Angabe speichert für sich, ohne das Training als Ganzes zu
   sichern: optimistisch, und scheitert es, springt sie zurück und die
   Snackbar sagt, warum. Danach frischt die Seite auf, damit alles, was die
   Angabe mitliest, sie zeigt.

   Der Wert liegt lokal über dem Serverstand: Bis das Auffrischen zurück ist,
   stünde im Feld sonst wieder der alte. */

export function useNameSpeichern(trainingId: string, gespeichert: string) {
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  const [name, setName] = useState(gespeichert);

  function speichere(naechster: string) {
    const vorher = name;
    setName(naechster);
    startTransition(async () => {
      const r = await renameTraining(trainingId, naechster);
      if (!r.ok) {
        setName(vorher);
        melde(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    });
  }

  return { name, speichere };
}

export function useZielSpeichern(trainingId: string, gespeichert: string | null) {
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  const [ziel, setZiel] = useState(gespeichert ?? "");

  /** Beim Verlassen des Felds — nur, wenn sich etwas geändert hat. Mit
   *  `neu` speichert es einen Wert, der nicht erst im Feld stand (die
   *  bearbeitbare Eigenschaft hält ihren Entwurf selbst). */
  function speichere(neu?: string) {
    const wert = neu ?? ziel;
    if (wert.trim() === (gespeichert ?? "")) return;
    setZiel(wert);
    startTransition(async () => {
      const r = await setTrainingZiel(trainingId, wert);
      if (!r.ok) {
        setZiel(gespeichert ?? "");
        melde(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    });
  }

  return { ziel, setZiel, speichere };
}

/** Eine Übung, die nach dem Wechsel der Alterskategorien keine von ihnen mehr
 *  abdeckt — mit ihrer Variante, denn der Abgleich umfasst alle (#201 AK 11). */
export type AbweichendeUebung = { id: string; name: string; varianteId: string | null };

export function useStufenAendern(trainingId: string, gespeichert: string[]) {
  const router = useRouter();
  const melde = useSnackbar();
  const [, startTransition] = useTransition();
  const [stufen, setStufen] = useState(gespeichert);
  // Was danach nicht mehr passt — die Seite entscheidet, was sie damit anbietet.
  const [abweichend, setAbweichend] = useState<AbweichendeUebung[] | null>(null);

  // Bei offener Liste wählt man oft mehrmals rasch hintereinander. Die
  // Aufträge laufen darum nacheinander und nicht gleichzeitig — sonst könnte
  // der Server einen älteren Stand zuletzt schreiben —, und was der Trainer
  // sieht, entscheidet allein die Antwort auf den letzten. Scheitert ein
  // Auftrag, gilt wieder der zuletzt bestätigte Stand, nicht der vor dem
  // Klick (der war womöglich selbst noch unbestätigt).
  const warteschlange = useRef<Promise<void>>(Promise.resolve());
  const letzter = useRef(0);
  const bestaetigt = useRef(gespeichert);

  function aendere(naechste: string[]) {
    setStufen(naechste);
    const auftrag = ++letzter.current;
    warteschlange.current = warteschlange.current.then(async () => {
      const r = await setTrainingStufen(trainingId, naechste);
      if (r.ok) bestaetigt.current = naechste;
      if (auftrag !== letzter.current) return;
      startTransition(() => router.refresh());
      if (!r.ok) {
        setStufen(bestaetigt.current);
        melde(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      if (r.mismatched && r.mismatched.length > 0) setAbweichend(r.mismatched);
    });
  }

  return { stufen, aendere, abweichend, setAbweichend };
}

/** Die Übungen, die nicht mehr zu den Alterskategorien passen. Bei mehreren
 *  Varianten trägt jede Hauptteil-Übung ihre Variante — ohne Zusatz wäre nicht
 *  zu unterscheiden, ob sie in der gezeigten Variante steht oder ausserhalb
 *  des Hauptteils (#201 AK 11). */
export function AbweichendeUebungenListe({
  liste,
  varianten,
}: {
  liste: readonly AbweichendeUebung[];
  varianten: readonly Variante[];
}) {
  return (
    <ul className="flex flex-col gap-1">
      {liste.map((m) => {
        const variante =
          varianten.length > 1 ? varianten.find((v) => v.id === m.varianteId)?.name : undefined;
        return (
          <li key={m.id} className="type-body-medium text-on-surface">
            · {m.name}
            {variante && <span className="text-on-surface-mittel"> (Variante „{variante}")</span>}
          </li>
        );
      })}
    </ul>
  );
}
