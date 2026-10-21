"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Was gerade geändert wird, steht sofort so da; scheitert es, gilt wieder der
 * Stand vom Server — die Mechanik dahinter, einmal.
 *
 * Fünf Handgriffe arbeiten so: am Spiel melden, nicht aufbieten und
 * nachtragen (SpielReiter), am privaten Link ab- und anmelden und ein Spiel
 * melden (ElternAnsicht). Alle brauchen dieselben Schritte:
 *
 * 1. Den neuen Wert je Kennung lokal setzen, bevor der Server antwortet.
 * 2. Die Aktion in einer Transition ausführen; scheitert sie, den lokalen
 *    Wert verwerfen und dem Aufrufer die Antwort geben (Snackbar oder
 *    Hinweis an der Karte).
 * 3. Danach die Seite neu laden. Mit den neuen Daten (`daten`) verfallen
 *    alle lokalen Werte — dann gilt, was der Server sagt.
 */
export function useLokalerStand<W>(daten: unknown) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lokal, setLokal] = useState<Record<string, W>>({});
  useEffect(() => setLokal({}), [daten]);

  /** Steht für `id` ein lokaler Wert da? */
  const hat = (id: string | null): id is string => id !== null && id in lokal;

  return {
    pending,
    hat,
    /** Der lokale Wert für `id`, sonst `stand`. */
    wert: (id: string | null, stand: W): W => (hat(id) ? lokal[id] : stand),
    /** Setzt `id` sofort auf `neu` und führt `aktion` aus; scheitert sie,
     *  gilt wieder der Stand und `beiFehler` erhält die Antwort. */
    aendere<R extends { ok: boolean }>(
      id: string,
      neu: W,
      aktion: () => Promise<R>,
      beiFehler: (r: Extract<R, { ok: false }>) => void,
    ) {
      setLokal((l) => ({ ...l, [id]: neu }));
      startTransition(async () => {
        const r = await aktion();
        if (!r.ok) {
          setLokal((l) => {
            const { [id]: _weg, ...rest } = l;
            return rest;
          });
          beiFehler(r as Extract<R, { ok: false }>);
        }
        router.refresh();
      });
    },
  };
}
