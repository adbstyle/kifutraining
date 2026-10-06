"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MARKEN_TEXT, MiniMonat, type Marke } from "@/components/ui";
import { monatVon } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
import { terminZustand, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Der Monat neben den Terminen (#404). Er folgt der Liste, die Liste aber
   nicht ihm — wie der kleine Monat im Google Kalender (PO 8):

   - Er zeigt den Monat des obersten sichtbaren Termins (AK 3), gemessen an
     den Elementen mit `data-datum` in `liste` unter der klebenden
     Kopfzeile. Ist keiner sichtbar, bleibt der zuletzt gezeigte (PC 4); beim
     Öffnen gilt dann der heutige (PC 3).
   - Blättern und «Heute» wechseln nur den Monat, die Liste bleibt stehen
     (PC 1); der gewählte Monat gilt, bis die Seite scrollt (PC 2).
   - Erst ein gewählter Termin bewegt die Liste (`onWahl`, AK 10). Danach
     zeigt der Monat den des gewählten Termins, bis der USER selbst scrollt —
     auch wenn die Liste ihn am Seitenende nicht zuoberst bringen kann. Das
     Scrollen, das der Sprung selbst auslöst, zählt dafür nicht.

   Die Marken eines Tages stehen in der Reihenfolge der Liste (PC 6). Bei
   «Meine Termine» trägt er nur die eigenen; Tage, an denen nur Termine
   anderer liegen, sind belegt (AK 13, 14). Der gezeigte Monat steht nicht in
   der Adresse (OoS 6). */
export function PlanMonat({
  termine,
  heute,
  belegt,
  meine,
  anfang,
  liste,
  onWahl,
}: {
  termine: readonly TerminZeile[];
  heute: string;
  /** Tage mit Terminen, die die Eingrenzung ausblendet. */
  belegt: readonly string[];
  meine: boolean;
  /** Der Monat beim ersten Rendern — derselbe auf Server und Browser. */
  anfang: string;
  liste: RefObject<HTMLElement | null>;
  onWahl: (id: string) => void;
}) {
  const [sichtbar, setSichtbar] = useState(anfang);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  /** Bis wann Scrollen vom Sprung stammt (`performance.now()`). */
  const sprungBis = useRef(0);

  useEffect(() => {
    /** Der Monat des obersten Termins, der unter der Kopfzeile zu sehen ist. */
    function messen(): boolean {
      const kopf = document.querySelector("[data-kopf-klebt]")?.getBoundingClientRect().bottom ?? 0;
      const oben = Math.max(kopf, 0);
      for (const el of liste.current?.querySelectorAll<HTMLElement>("[data-datum]") ?? []) {
        const r = el.getBoundingClientRect();
        if (r.bottom > oben && r.top < window.innerHeight) {
          setSichtbar(monatVon(el.dataset.datum!));
          return true;
        }
      }
      return false;
    }
    if (!messen()) setSichtbar(monatVon(heute));

    let rahmen = 0;
    const spaeter = () => {
      if (!rahmen) rahmen = requestAnimationFrame(() => { rahmen = 0; messen(); });
    };
    const beimScrollen = () => {
      if (performance.now() > sprungBis.current) setGewaehlt(null);
      spaeter();
    };
    // Auf- und Zuklappen des Rückblicks und neu geladene Termine verschieben
    // die Liste, ohne dass gescrollt wird.
    const groesse = new ResizeObserver(spaeter);
    if (liste.current) groesse.observe(liste.current);
    window.addEventListener("scroll", beimScrollen, { passive: true });
    window.addEventListener("resize", spaeter);
    return () => {
      cancelAnimationFrame(rahmen);
      groesse.disconnect();
      window.removeEventListener("scroll", beimScrollen);
      window.removeEventListener("resize", spaeter);
    };
  }, [liste, heute]);

  const jeTag = useMemo(() => {
    const m = new Map<string, Marke[]>();
    for (const { tage } of nachMonatUndTag(termine))
      for (const tag of tage)
        m.set(
          tag.datum,
          tag.termine.map((t) => {
            const z = terminZustand(t, heute);
            const was = z === "training" ? t.training!.name : MARKEN_TEXT[z];
            return { id: t.id, zustand: z, label: `${t.beginn} ${was}` };
          }),
        );
    return m;
  }, [termine, heute]);
  const belegteTage = useMemo(() => new Set(belegt), [belegt]);

  function waehle(id: string) {
    const t = termine.find((x) => x.id === id);
    if (t) setGewaehlt(monatVon(t.datum));
    sprungBis.current = performance.now() + 500;
    onWahl(id);
  }

  return (
    <MiniMonat
      monat={gewaehlt ?? sichtbar}
      heute={heute}
      marken={(tag) => jeTag.get(tag) ?? []}
      belegt={(tag) => belegteTage.has(tag)}
      onWahl={waehle}
      onMonat={setGewaehlt}
      hinweis={meine ? "Nur deine Termine" : undefined}
    />
  );
}
