/* Die Sichten auf die Spieler:innen eines Teams (#704): ein eigener Punkt
 * «Spieler:innen» in der Seitenleiste, darunter Reiter mit je eigener Adresse
 * unter `/team/<id>/spieler`. Die Seitenleiste wählt, was man ansieht, die
 * Reiter zeigen dessen Sichten. «Team» (`/team/<id>/trainer`) hat keine
 * Reiter mehr; es zeigt, was das Team selbst betrifft (#704 AK 4).
 *
 * Die bisherigen Adressen unter `/team/<id>/verwaltung` leiten samt
 * Suchparametern auf die neuen weiter (next.config.ts, #704 AK 6).
 *
 * Rein, ohne next/*: Die Reiter (components/team/SpielerBereicheNav.tsx), die
 * Seitenleiste und check:kern lesen dieselben Angaben. */

/** Die Namen der Seiten eines Teams (#706): dieselben wie in der Seitenleiste
 *  (AppNavClient, von check:kern abgeglichen). Auf jeder Seite steht der Name
 *  als letzte Brotkrume (components/team/TeamSeite.tsx); unter
 *  «Spieler:innen» bleibt es in jedem Reiter bei «Spieler:innen» — den Reiter
 *  zeigt die Reiterleiste. */
export const TEAM_SEITEN = {
  plan: "Trainingsplan",
  spieler: "Spieler:innen",
  trainings: "Trainings",
  team: "Team",
} as const;

export type SpielerBereich = "liste" | "teilnahme" | "meldezeitpunkte" | "kader" | "link";

export const SPIELER_BEREICHE: readonly { schluessel: SpielerBereich; label: string; pfad: string }[] = [
  { schluessel: "liste", label: "Liste", pfad: "" },
  { schluessel: "teilnahme", label: "Teilnahme", pfad: "/teilnahme" },
  { schluessel: "meldezeitpunkte", label: "Meldezeitpunkte", pfad: "/meldezeitpunkte" },
  { schluessel: "kader", label: "Kader & Schnuppern", pfad: "/kader" },
  { schluessel: "link", label: "Privater Link", pfad: "/link" },
];

/** Die Schlüssel der Eingrenzung der Spielerliste (#601). */
export const FILTER_SCHLUESSEL = ["q", "kader", "jahrgang", "link"] as const;

/** Was die Reiter beim Wechsel weitertragen (#704 AK 5): die Eingrenzung und
 *  der Zeitraum (`von`, `bis`), in dieser Folge. Die gewählte Spieler:in
 *  (`spieler`) und die Sortierung reisen nie: Schmal ersetzt das Detail die
 *  Liste, ein mitreisendes `spieler` liesse den Wechsel wirkungslos scheinen. */
export const REISENDE_SCHLUESSEL = [...FILTER_SCHLUESSEL, "von", "bis"] as const;

/** Die Grundadresse der Spieler:innen eines Teams — zugleich der Reiter «Liste». */
export function teamSpielerPfad(teamId: string): string {
  return `/team/${teamId}/spieler`;
}

/** Die Adresse der Seite «Team»: Mitglieder, Teamangaben, Gefahrenzone. */
export function teamSeitePfad(teamId: string): string {
  return `/team/${teamId}/trainer`;
}

/** Der Reiter, in dem die Adresse liegt; `null` ausserhalb der Spieler:innen. */
export function teamBereichAusPfad(pfad: string, teamId: string): SpielerBereich | null {
  const basis = teamSpielerPfad(teamId);
  const rest = pfad.replace(/\/+$/, "");
  return SPIELER_BEREICHE.find((b) => rest === `${basis}${b.pfad}`)?.schluessel ?? null;
}

/** Die Adresse eines Reiters, mit Eingrenzung und Zeitraum aus `suche` (nur
 *  die Schlüssel aus `REISENDE_SCHLUESSEL`, in deren Reihenfolge). */
export function teamBereichHref(teamId: string, bereich: SpielerBereich, suche?: URLSearchParams): string {
  const b = SPIELER_BEREICHE.find((x) => x.schluessel === bereich)!;
  const behalten = new URLSearchParams();
  for (const k of REISENDE_SCHLUESSEL) for (const w of suche?.getAll(k) ?? []) behalten.append(k, w);
  const query = behalten.toString();
  return `${teamSpielerPfad(teamId)}${b.pfad}${query ? `?${query}` : ""}`;
}
