"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { schreibeUebungInAdresse } from "@/lib/offene-uebung";

/** Was Zeilen, Spalte und Rückfrage von der geöffneten Übung wissen müssen. */
export type OffeneUebung = ReturnType<typeof useOffeneUebung>;

/**
 * Die geöffnete Übung eines Trainings (Epic #369) — beim Zusammenstellen wie
 * in der Ansicht dieselbe Regel, darum an einer Stelle.
 *
 * Offen ist höchstens eine Übung, zum Ansehen (#371) oder zum Bearbeiten
 * (#372/#374). Die Adresse zieht ohne Navigation mit (#371 AK 10); meinte sie
 * eine Übung, die die Seite nicht zeigen kann, verliert sie die Angabe
 * (AK 11).
 *
 * Hält die Maske ungesicherte Angaben, läuft jeder Vorgang, der die Übung
 * verlässt oder trifft, erst nach Rückfrage (`nachRueckfrage`, #372 AK 4):
 * bei der Übung bleiben oder verwerfen — ein «Sichern und weiter» gibt es
 * bewusst nicht (PO 2026-10-04). Verwerfen kehrt zuerst ins Detail zurück und
 * führt den Vorgang danach aus: Auch einer, der die Übung offen lässt
 * (Umsortieren, ein abgebrochener Dialog), trifft so keine Maske mehr an, die
 * Eingaben zeigt, die als verworfen gelten.
 *
 * `bearbeitbar`: Ohne Bearbeitungsrecht öffnet nichts zum Bearbeiten, auch
 * keine Adresse mit `bearbeiten` (#374 AK 7).
 */
export function useOffeneUebung({
  anfangsOffenId,
  anfangsBearbeiten,
  uebungParam,
  bearbeitbar,
  beimSichern,
}: {
  anfangsOffenId: string | null;
  anfangsBearbeiten: boolean;
  /** Was die Adresse beim Laden meinte. */
  uebungParam?: string;
  bearbeitbar: boolean;
  /** Was die Seite nach dem Sichern selbst nachführt — beim Zusammenstellen
   *  die lokalen Überlagerungen der Übung, die der Server inzwischen anders
   *  kennt (eine Dauer, die im Auffangen entfällt, ein geräumter Durchlauf). */
  beimSichern?: (id: string) => void;
}) {
  const router = useRouter();
  const melde = useSnackbar();
  const [offenId, setOffenId] = useState(anfangsOffenId);
  const [bearbeiten, setBearbeiten] = useState(bearbeitbar && !!anfangsOffenId && anfangsBearbeiten);
  const [ungesichert, setUngesichert] = useState(false);
  const [rueckfrage, setRueckfrage] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!anfangsOffenId && uebungParam) schreibeUebungInAdresse(null);
    // Nur beim Laden: Danach schreibt `zeige` die Adresse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Ohne Rückfrage zeigen — für die Fälle, in denen nichts zu fragen ist. */
  function zeige(id: string | null, zumBearbeiten = false) {
    const offenZumBearbeiten = !!id && zumBearbeiten && bearbeitbar;
    setOffenId(id);
    setBearbeiten(offenZumBearbeiten);
    setUngesichert(false);
    schreibeUebungInAdresse(id, offenZumBearbeiten);
  }

  function nachRueckfrage(vorgang: () => void) {
    if (bearbeiten && ungesichert) setRueckfrage(() => vorgang);
    else vorgang();
  }

  /** Eine Übung öffnen; die geöffnete noch einmal zum Ansehen gewählt
   *  schliesst sie. */
  function oeffne(id: string, zumBearbeiten = false) {
    if (id === offenId && zumBearbeiten === bearbeiten) {
      if (!zumBearbeiten) schliesse();
      return;
    }
    nachRueckfrage(() => zeige(id, zumBearbeiten));
  }

  function schliesse() {
    nachRueckfrage(() => zeige(null));
  }

  /** Gesichert (#372 PC 1/2, #374 PC 2): Die Übung bleibt geöffnet — auch an
   *  einem neuen Platz, denn sie behält ihre ID — und zeigt ihren neuen Stand
   *  im Detail. Aufgefrischt wird alles, was sie mitrechnet (PC 6). */
  function gesichert() {
    if (offenId) beimSichern?.(offenId);
    zeige(offenId);
    router.refresh();
    melde("Übung gesichert.");
  }

  return {
    offenId,
    bearbeiten,
    bearbeitbar,
    setUngesichert,
    /** Hält die Maske ungesicherte Angaben? */
    ungesichert: bearbeiten && ungesichert,
    zeige,
    oeffne,
    schliesse,
    nachRueckfrage,
    gesichert,
    /** Die laufende Rückfrage — offen, solange ein Vorgang wartet. */
    rueckfrage: {
      offen: rueckfrage != null,
      bleiben: () => setRueckfrage(null),
      verwerfen: () => {
        const vorgang = rueckfrage;
        setRueckfrage(null);
        zeige(offenId);
        vorgang?.();
      },
    },
  };
}
