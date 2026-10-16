"use server";

import { headers } from "next/headers";
import { anschlussSchluessel, holeLinkAb, type AbholEingabe, type AbholErgebnis } from "@/lib/abholung";
import { oeffentlicherOrigin } from "@/lib/origin";
import { spielerLinkUrl } from "@/lib/spieler";

/** Wie `AbholErgebnis`, statt des Geheimnisses die Adresse des Links. */
export type AbholAntwort = Exclude<AbholErgebnis, { status: "ok" }> | { status: "ok"; url: string; name: string };

/** Den privaten Link einer Spieler:in über die Abholadresse abholen (#438
 *  AK 8) — ohne Anmeldung: Die Adresse ist die Berechtigung. */
export async function holeLinkAbAktion(token: string, e: AbholEingabe): Promise<AbholAntwort> {
  const r = await holeLinkAb(token, anschlussSchluessel(await headers()), e);
  if (r.status !== "ok") return r;
  return { status: "ok", url: spielerLinkUrl(await oeffentlicherOrigin(), r.token), name: r.name };
}
