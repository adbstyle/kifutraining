/* Die Bereiche der Team-Verwaltung (#656): vier Reiter, jeder mit eigener
 * Adresse unter `/team/<id>/verwaltung`. Die Spielerliste bleibt auf der
 * bisherigen Adresse, damit Lesezeichen und Verweise (Spieler-Reiter am
 * Termin) weiter dorthin führen (#656 PC 1).
 *
 * Rein, ohne next/*: Die Reiter (components/team/TeamBereicheNav.tsx) und
 * check:kern lesen dieselben Angaben. */

export type TeamBereich = "spieler" | "kader" | "link" | "trainer";

export const TEAM_BEREICHE: readonly { schluessel: TeamBereich; label: string; pfad: string }[] = [
  { schluessel: "spieler", label: "Spieler:innen", pfad: "" },
  { schluessel: "kader", label: "Kader & Schnuppern", pfad: "/kader" },
  { schluessel: "link", label: "Privater Link", pfad: "/link" },
  { schluessel: "trainer", label: "Trainer:innen", pfad: "/trainer" },
];

/** Die Schlüssel der Eingrenzung der Spielerliste (#601). Die Reiter tragen
 *  sie weiter, damit die Eingrenzung beim Wechsel zwischen den Bereichen
 *  stehen bleibt; alle übrigen Parameter fallen weg. */
export const FILTER_SCHLUESSEL = ["q", "kader", "jahrgang", "link"] as const;

/** Die Grundadresse der Team-Verwaltung — zugleich der Bereich Spieler:innen. */
export function teamVerwaltungPfad(teamId: string): string {
  return `/team/${teamId}/verwaltung`;
}

/** Der Bereich, in dem die Adresse liegt; `null` ausserhalb der Team-Verwaltung. */
export function teamBereichAusPfad(pfad: string, teamId: string): TeamBereich | null {
  const basis = teamVerwaltungPfad(teamId);
  const rest = pfad.replace(/\/+$/, "");
  if (rest === basis) return "spieler";
  return TEAM_BEREICHE.find((b) => b.pfad !== "" && rest === `${basis}${b.pfad}`)?.schluessel ?? null;
}

/** Die Adresse eines Bereichs, mit der Eingrenzung aus `suche` (nur die
 *  Schlüssel aus `FILTER_SCHLUESSEL`, in deren Reihenfolge). */
export function teamBereichHref(teamId: string, bereich: TeamBereich, suche?: URLSearchParams): string {
  const b = TEAM_BEREICHE.find((x) => x.schluessel === bereich)!;
  const behalten = new URLSearchParams();
  for (const k of FILTER_SCHLUESSEL) for (const w of suche?.getAll(k) ?? []) behalten.append(k, w);
  const query = behalten.toString();
  return `${teamVerwaltungPfad(teamId)}${b.pfad}${query ? `?${query}` : ""}`;
}
