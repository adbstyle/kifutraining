"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/* Filterzustand in der Adresse — die gemeinsame Mechanik der Filterleisten
   (Übungskatalog, Trainings-Übersicht). Die Adresse ist die Quelle der
   Wahrheit: Jede Änderung schreibt dorthin und löst eine neue Server-Abfrage
   aus. Was eine Leiste zeigt und wann sie «Zurücksetzen» anbietet, bleibt bei
   ihr; hier steht nur, WIE ein Wert in die Adresse kommt.

   Mehrfachwerte stehen kommagetrennt in EINEM Parameter (`?kat=E,F`), wie die
   Server-Seiten sie lesen. Leere Werte fallen ganz weg — und mit dem letzten
   Parameter auch das `?`, sonst endete die Adresse auf `pfad?`.

     const filter = useAdressFilter();
     <AuswahlFilter value={kat} onChange={(v) => filter.setzeListe("kat", v)} />
     <FilterChip selected={mine} onClick={() => filter.schalte("mine", !mine)} /> */
export function useAdressFilter() {
  const router = useRouter();
  const pathname = usePathname();
  // Koppelt die Leiste an jeden Adresswechsel (auch Browser-Zurück), damit
  // sie mit den neuen Props neu rendert.
  useSearchParams();

  // Beim Ändern die LIVE-Adresse lesen, nicht einen Snapshot aus dem Render —
  // sonst gingen bei schnellen Klicks hintereinander Filter verloren.
  function schreiben(aendern: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(window.location.search);
    aendern(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return {
    /** Mehrfachwerte, kommagetrennt; eine leere Liste entfernt den Parameter. */
    setzeListe: (key: string, werte: string[]) =>
      schreiben((p) => {
        if (werte.length) p.set(key, werte.join(","));
        else p.delete(key);
      }),
    /** Ein getippter Wert, getrimmt; leer entfernt den Parameter. */
    setzeWert: (key: string, wert: string) =>
      schreiben((p) => {
        const v = wert.trim();
        if (v) p.set(key, v);
        else p.delete(key);
      }),
    /** Ein Schalter: an = `key=1`, aus = kein Parameter. */
    schalte: (key: string, an: boolean) =>
      schreiben((p) => {
        if (an) p.set(key, "1");
        else p.delete(key);
      }),
    /** Alle Filter weg — die nackte Seite. */
    zuruecksetzen: () => router.push(pathname, { scroll: false }),
  };
}
