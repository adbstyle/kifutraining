/* Welcher Navigationseintrag gerade offen ist — rein aus Adresse und
   Team-Kontext abgeleitet, ohne React. */

import type { Bereich } from "@/lib/bereich";

export type AktiveBereiche = {
  uebungen: boolean;
  trainings: boolean;
};

/**
 * Eigene Inhalte haben keinen eigenen Eintrag (#660): `?mine=1` grenzt die
 * Bibliothek nur ein, „Übungen" bzw. „Trainings" bleibt aktiv.
 *
 * @param pfad    `usePathname()`
 * @param imTeamBereich  Das geöffnete Training gehört einem Team (#156). Es
 *                liegt unter `/training/…`, gehört aber zu „Teams" und in
 *                keine Trainingsübersicht.
 */
export function aktiveBereiche(pfad: string, imTeamBereich: boolean): AktiveBereiche {
  return {
    // Katalog und Detailseiten.
    uebungen: pfad === "/" || pfad.startsWith("/uebung"),
    // Pool, Editor, Einzel-, Durchführungs- und Druckansicht — `/training`
    // deckt als Präfix auch `/trainings` ab.
    trainings: pfad.startsWith("/training") && !imTeamBereich,
  };
}

const TEAM_PFAD = /^\/team\/([0-9a-f-]{36})(\/|$)/i;

/** Der Bereich, in dem die Adresse liegt: `/team/<id>/…` und ein geöffnetes
 *  Team-Training (`teamImTraining`: das Team, dem es gehört) → dieses Team,
 *  `/verein/…` → der Verein. Sonst `null`: Auf Seiten ohne Bereich
 *  (Bibliotheken, `/teams`, `/konto`) bleibt der gemerkte (lib/bereich.ts). */
export function bereichAusPfad(pfad: string, teamImTraining: string | null): Bereich | null {
  const team = pfad.match(TEAM_PFAD)?.[1];
  if (team) return { art: "team", id: team };
  if (pfad === "/verein" || pfad.startsWith("/verein/")) return { art: "verein" };
  if (teamImTraining && pfad.startsWith("/training/")) return { art: "team", id: teamImTraining };
  return null;
}
