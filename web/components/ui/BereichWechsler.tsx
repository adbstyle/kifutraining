"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { AB_LG } from "@/lib/breite";
import { SCHMAL_KLASSEN, type SchmalAb } from "./seitenleiste-schmal";

/* ── Typen ──────────────────────────────────────────────────── */

/** Ein Bereich, den der Wechsler anbietet: eines der eigenen Teams oder der
 *  Verein. */
export interface BereichOption {
  /** Stabile Kennung (`team:<id>`, `verein`); `aktiv` und `onWahl` sprechen sie. */
  schluessel: string;
  /** Wohin die Wahl führt — ein echter Link, damit die Warnung vor
   *  ungesicherten Angaben (#246) auch hier greift. */
  href: string;
  /** Der Name des Bereichs: «Da Junioren», «FC Wyler». */
  label: string;
  /** Die kleine Zeile darüber im Knopf: «FC Wyler · Team», «Verein». */
  kopf: string;
  /** Die Zeile unter dem Namen in der Liste: «Trainer:in», «Teams und
   *  Spieler:innen des Vereins». */
  untertitel: string;
  icon: LucideIcon;
  /** Ein Strich davor — trennt die Teams vom Verein. */
  trenner?: boolean;
}

export interface BereichWechslerProps {
  optionen: BereichOption[];
  /** Schlüssel des offenen Bereichs. */
  aktiv: string;
  /** Der Bereich wurde gewählt (Cookie merken); die Navigation übernimmt der Link. */
  onWahl: (schluessel: string) => void;
}

/* ── Wechsler ───────────────────────────────────────────────────
   Wählt den Bereich: eines der eigenen Teams oder den Verein. Steht oben in
   der Seitenleiste, unter der Marke. Der Knopf zeigt zwei Zeilen (Art und
   Name) und ein Auf-Ab-Zeichen; die Liste klappt darunter auf. Gibt es nur
   einen Bereich, ist es eine Anzeige ohne Liste — es gäbe nichts zu wählen.

   Die Liste steht `fixed` und rechnet ihre Lage beim Öffnen aus dem Knopf
   (wie «Darstellung»): Die Leiste schneidet ihren Inhalt ab, schmal ragte sie
   sonst nicht hinaus. Ändert sich das Fenster oder scrollt etwas darunter,
   geht sie zu. Schmal bleibt vom Knopf das Zeichen des Bereichs; der Name
   steht für Vorlesehilfen weiter da und beim Überfahren als Hinweis daneben.

   Die Einträge sind Links, keine Knöpfe: Wer ungesicherte Angaben auf der
   Seite hat, wird vor dem Wechsel gewarnt wie bei jedem Link der Leiste.

   Tastatur (ARIA-Menu-Muster): beim Öffnen steht der Fokus auf dem offenen
   Bereich, ↑/↓ laufen zyklisch, Home/End springen an die Enden, Escape schliesst
   und gibt den Fokus zurück, Tab schliesst. */
export function BereichWechsler({
  optionen,
  aktiv,
  onWahl,
  schmalAb,
  navRef,
  onNavigiert,
}: BereichWechslerProps & {
  schmalAb: SchmalAb | null;
  navRef: RefObject<HTMLElement | null>;
  onNavigiert: () => void;
}) {
  const knopfRef = useRef<HTMLButtonElement>(null);
  const listeRef = useRef<HTMLDivElement>(null);
  const listeId = useId();
  const [lage, setLage] = useState<CSSProperties | null>(null);
  const k = schmalAb ? SCHMAL_KLASSEN[schmalAb] : null;
  const aktuell = optionen.find((o) => o.schluessel === aktiv) ?? optionen[0];

  const zu = () => setLage(null);

  useEffect(() => {
    if (!lage) return;
    function beiScroll(e: Event) {
      // Die Liste darf selbst scrollen.
      if (listeRef.current?.contains(e.target as Node)) return;
      zu();
    }
    function beiMaus(e: MouseEvent) {
      const ziel = e.target as Node;
      if (listeRef.current?.contains(ziel) || knopfRef.current?.contains(ziel)) return;
      zu();
    }
    window.addEventListener("resize", zu);
    window.addEventListener("scroll", beiScroll, true);
    document.addEventListener("mousedown", beiMaus);
    return () => {
      window.removeEventListener("resize", zu);
      window.removeEventListener("scroll", beiScroll, true);
      document.removeEventListener("mousedown", beiMaus);
    };
  }, [lage]);

  // Beim Öffnen auf den offenen Bereich (sonst den ersten).
  useEffect(() => {
    if (!lage) return;
    const eintraege = listeRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
    const ziel = Array.from(eintraege ?? []).find((el) => el.getAttribute("aria-checked") === "true") ?? eintraege?.[0];
    ziel?.focus();
  }, [lage]);

  if (!aktuell) return null;
  const Icon = aktuell.icon;

  function oeffnen() {
    const r = knopfRef.current?.getBoundingClientRect();
    if (!r) return;
    const schmal = schmalAb === "immer" || (schmalAb === "lg" && window.matchMedia(AB_LG).matches);
    const kante = navRef.current?.getBoundingClientRect().right ?? r.right;
    setLage(
      schmal
        ? { left: kante + 8, top: r.top, minWidth: 256 }
        : { left: r.left, top: r.bottom + 4, width: r.width },
    );
  }

  function onListeKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const liste = Array.from(listeRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []);
    if (e.key === "Escape") {
      e.preventDefault();
      zu();
      knopfRef.current?.focus();
      return;
    }
    if (e.key === "Tab") return zu();
    const i = liste.indexOf(document.activeElement as HTMLElement);
    let ziel: number;
    if (e.key === "ArrowDown") ziel = i < 0 ? 0 : (i + 1) % liste.length;
    else if (e.key === "ArrowUp") ziel = i < 0 ? liste.length - 1 : (i - 1 + liste.length) % liste.length;
    else if (e.key === "Home") ziel = 0;
    else if (e.key === "End") ziel = liste.length - 1;
    else return;
    e.preventDefault();
    liste[ziel]?.focus();
  }

  const inhalt = (
    <>
      <Icon size={20} strokeWidth={2} aria-hidden className="shrink-0 text-primary" />
      <span className={cn("flex min-w-0 flex-1 flex-col text-left", k?.textWeg)}>
        <span className="type-body-small truncate text-on-surface-mittel">
          <span className="sr-only">Bereich: </span>
          {aktuell.kopf}
        </span>
        <span className="type-title-small truncate">{aktuell.label}</span>
      </span>
    </>
  );

  const rahmen = cn(
    "flex h-14 w-full items-center gap-3 rounded-flaeche border border-linie bg-elev-00 px-3 text-on-surface",
    k?.mitte,
    k?.anmelden,
  );

  return (
    <div className="shrink-0 px-4 pb-2">
      {optionen.length === 1 ? (
        <div data-hinweis={`${aktuell.kopf}: ${aktuell.label}`} className={rahmen}>
          {inhalt}
        </div>
      ) : (
        <>
          <button
            ref={knopfRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={!!lage}
            aria-controls={lage ? listeId : undefined}
            data-hinweis={`${aktuell.kopf}: ${aktuell.label}`}
            onClick={() => (lage ? zu() : oeffnen())}
            className={cn(rahmen, "state focus-ring-inset cursor-pointer")}
          >
            <span className="sr-only">Bereich wählen. </span>
            {inhalt}
            <ChevronsUpDown size={16} strokeWidth={2} aria-hidden className={cn("shrink-0 text-on-surface-mittel", k?.nurBreit)} />
          </button>
          {lage && (
            <div
              ref={listeRef}
              id={listeId}
              role="menu"
              aria-label="Bereich wählen"
              onKeyDown={onListeKey}
              style={lage}
              className="fixed z-50 max-h-[70dvh] overflow-y-auto rounded-flaeche border border-linie bg-elev-08 py-1 shadow-dp-08"
            >
              {optionen.map((o) => {
                const OIcon = o.icon;
                const gewaehlt = o.schluessel === aktiv;
                return (
                  <div key={o.schluessel}>
                    {o.trenner && <div role="separator" className="my-1 h-px bg-linie" />}
                    <Link
                      href={o.href}
                      role="menuitemradio"
                      aria-checked={gewaehlt}
                      onClick={() => {
                        onWahl(o.schluessel);
                        zu();
                        onNavigiert();
                      }}
                      className="state focus-visible:outline-none flex min-h-12 items-center gap-3 px-3 py-1.5 text-on-surface"
                    >
                      <OIcon size={18} strokeWidth={2} aria-hidden className="shrink-0 text-on-surface-mittel" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="type-body-medium truncate">{o.label}</span>
                        <span className="type-body-small text-on-surface-mittel">{o.untertitel}</span>
                      </span>
                      {gewaehlt && <Check size={16} strokeWidth={2.5} aria-hidden className="shrink-0 text-primary" />}
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
