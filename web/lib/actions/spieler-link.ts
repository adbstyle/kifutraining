"use server";

import {
  meldeSpielUeberLink,
  meldeUeberLink,
  type LinkAbmeldeErgebnis,
  type LinkAbmeldung,
  type LinkMeldeErgebnis,
  type LinkMeldung,
} from "@/lib/privater-link";

/** Über den privaten Link ab- oder wieder anmelden (#436 AK 8) — ohne
 *  Anmeldung: Das Geheimnis im Link ist die Berechtigung. Kein
 *  `revalidiereTeam`: Die Seiten der Mitglieder lesen bei jedem Aufruf neu. */
export async function meldeUeberLinkAktion(token: string, e: LinkAbmeldung): Promise<LinkAbmeldeErgebnis> {
  return meldeUeberLink(token, e);
}

/** Für ein Spiel über den privaten Link an- oder abmelden (#463 AK 3, 9). */
export async function meldeSpielUeberLinkAktion(token: string, e: LinkMeldung): Promise<LinkMeldeErgebnis> {
  return meldeSpielUeberLink(token, e);
}
