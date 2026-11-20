"use server";

import { oeffentlicherOrigin } from "@/lib/origin";
import {
  holeAbo,
  meldeSpielUeberLink,
  pushStand,
  schaltePushAus,
  schaltePushEin,
  meldeUeberLink,
  widerrufeAbo,
  type AboHolenErgebnis,
  type AboWiderrufErgebnis,
  type LinkAbmeldeErgebnis,
  type LinkAbmeldung,
  type LinkMeldeErgebnis,
  type LinkMeldung,
  type PushSchaltErgebnis,
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

/** Die Abo-Adresse zum privaten Link holen (#507 AK 1, 5). */
export async function holeAboUeberLinkAktion(token: string): Promise<AboHolenErgebnis> {
  return holeAbo(token, await oeffentlicherOrigin());
}

/** Das Abo über den privaten Link widerrufen (#509 AK 1). */
export async function widerrufeAboUeberLinkAktion(token: string): Promise<AboWiderrufErgebnis> {
  return widerrufeAbo(token);
}

/** Mitteilungen aufs Mobile einschalten (#483 AK 1): die Anmeldung des Browsers. */
export async function schaltePushEinAktion(token: string, abo: unknown): Promise<PushSchaltErgebnis> {
  return schaltePushEin(token, abo);
}

/** Mitteilungen auf diesem Gerät ausschalten (#483 AK 7). */
export async function schaltePushAusAktion(token: string, endpoint: unknown): Promise<PushSchaltErgebnis> {
  return schaltePushAus(token, endpoint);
}

/** Ob dieses Gerät eingeschaltet ist (#483 AK 6). */
export async function pushStandAktion(token: string, endpoint: unknown): Promise<"an" | "aus" | "ungueltig" | null> {
  return pushStand(token, endpoint);
}
