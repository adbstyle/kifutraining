"use server";

import { meldeUeberLink, type LinkAbmeldeErgebnis, type LinkAbmeldung } from "@/lib/privater-link";

/** Über den privaten Link ab- oder wieder anmelden (#436 AK 8) — ohne
 *  Anmeldung: Das Geheimnis im Link ist die Berechtigung. Kein
 *  `revalidiereTeam`: Die Seiten der Mitglieder lesen bei jedem Aufruf neu. */
export async function meldeUeberLinkAktion(token: string, e: LinkAbmeldung): Promise<LinkAbmeldeErgebnis> {
  return meldeUeberLink(token, e);
}
