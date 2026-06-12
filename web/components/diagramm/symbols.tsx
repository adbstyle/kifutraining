import type { ReactNode } from "react";
import { FARBEN, type FarbSlug, type SymbolTyp, DREHBARE_TYPEN } from "@/lib/diagramm";

/**
 * Zentrales Symbol-Register (Decision Record Spike #48, Gate 3).
 *
 * VERTRAG: Jedes Symbol zeichnet zentriert um (0,0) — der Anker ist der
 * Symbol-Mittelpunkt und entspricht dem gespeicherten (x, y) des Elements;
 * Rotation dreht um den Anker. Eine neue Symbol-Version darf Form und Stil
 * ändern, aber NIE den Anker verschieben — sonst wandern bestehende
 * Diagramme (#55 AK4). `breite`/`hoehe` beschreiben die Begrenzung für
 * Auswahl-Rahmen und Treffer-Fläche.
 */
export type SymbolDef = {
  label: string;
  breite: number;
  hoehe: number;
  drehbar: boolean;
  faerbbar: boolean;
  defaultFarbe?: FarbSlug;
  render: (farbe: string) => ReactNode;
};

export const SYMBOLE: Partial<Record<SymbolTyp, SymbolDef>> = {
  pylone: {
    label: "Pylone",
    breite: 34,
    hoehe: 34,
    drehbar: DREHBARE_TYPEN.has("pylone"),
    faerbbar: true,
    defaultFarbe: "rot",
    render: (farbe) => (
      <>
        {/* Markierkegel in Aufsicht: Basisring + Spitze */}
        <circle r={16} fill={farbe} stroke="rgba(0,0,0,.25)" strokeWidth={1.5} />
        <circle r={7} fill="#ffffff" opacity={0.85} />
        <circle r={3} fill={farbe} />
      </>
    ),
  },
};

/** Neutraler Platzhalter für unbekannte/fehlerhafte Symbol-Typen: das
 *  Diagramm bleibt intakt und editierbar, Daten werden nie angefasst (#55 AK5). */
export const FALLBACK_SYMBOL: SymbolDef = {
  label: "Unbekanntes Element",
  breite: 34,
  hoehe: 34,
  drehbar: false,
  faerbbar: false,
  render: () => (
    <>
      <circle r={15} fill="rgba(255,255,255,.6)" stroke="#616161" strokeWidth={2} strokeDasharray="4 3" />
      <text y={5} textAnchor="middle" fontSize={16} fill="#616161">?</text>
    </>
  ),
};

export function symbolDef(typ: string): SymbolDef {
  return SYMBOLE[typ as SymbolTyp] ?? FALLBACK_SYMBOL;
}

/** Hex-Farbe eines Elements mit Registry-Default. */
export function symbolFarbe(typ: string, farbe?: FarbSlug): string {
  const def = symbolDef(typ);
  const slug = farbe ?? def.defaultFarbe;
  return slug ? FARBEN[slug] : FARBEN.rot;
}
