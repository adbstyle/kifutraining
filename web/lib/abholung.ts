import "server-only";
import { createHmac } from "node:crypto";
import { createAnonClient } from "@/lib/supabase/anon";
import { env } from "@/lib/env";
import { istLinkToken, jahrgangAus, spielerName } from "@/lib/spieler";

/**
 * Die Abholseite eines Teams (Epic #433, Story #438) — ohne Konto und ohne
 * Sitzung. Die Abholadresse ist die Berechtigung; die RPCs `abholung_*`
 * prüfen sie als SECURITY DEFINER. Ausgeschaltet, erneuert oder unbekannt
 * sind nicht zu unterscheiden (AK 18).
 *
 * Die Sperre nach Fehlversuchen (AK 15) trifft den Anschluss: Der Server
 * bildet aus der IP-Adresse mit einem geheimen Wert je Umgebung einen
 * Schlüssel; die Adresse selbst erreicht die Datenbank nie. Fehlt der Wert,
 * nimmt die Seite keine Eingabe an (lieber zu als ungeschützt).
 */

export type AbholAnsicht = { gueltig: true; team: string } | { gueltig: false };

export async function ladeAbholAnsicht(token: string): Promise<AbholAnsicht> {
  if (!istLinkToken(token)) return { gueltig: false };
  const { data, error } = await createAnonClient().rpc("abholung_ansicht", { p_token: token });
  if (error || !data) return { gueltig: false };
  return data as AbholAnsicht;
}

/** Der Anschluss einer Adresse: IPv4 ganz, IPv6 sein /64-Präfix — ein
 *  Anschluss verfügt meist über ein ganzes /64 und könnte sonst mit jeder
 *  Adresse daraus neu raten. */
export function anschlussVon(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [vorne, hinten = ""] = ip.toLowerCase().split("::");
  const a = vorne ? vorne.split(":") : [];
  const b = ip.includes("::") && hinten ? hinten.split(":") : [];
  const voll = ip.includes("::") ? [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b] : a;
  return `${voll.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

/** Der Schlüssel des Anschlusses für die Sperre — oder `null`, wenn der
 *  geheime Wert fehlt. Hinter Vercel trägt `x-real-ip` den Aufrufer;
 *  lokal fehlt er, dann gilt ein fester Platzhalter. */
export function anschlussSchluessel(h: Headers): string | null {
  const geheim = env.abholSchluessel();
  if (!geheim) return null;
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "lokal";
  return createHmac("sha256", geheim).update(anschlussVon(ip)).digest("hex");
}

export type AbholEingabe = { vorname: string; nachname: string; jahrgang: string };

export type AbholErgebnis =
  | { status: "ok"; token: string; name: string }
  | { status: "passt_nicht" | "gesperrt" | "ungueltig" | "fehlt" | "fehler" };

/** Eine Eingabe abgleichen (AK 8, 9, 13, 15). */
export async function holeLinkAb(token: string, schluessel: string | null, e: AbholEingabe): Promise<AbholErgebnis> {
  if (!istLinkToken(token)) return { status: "ungueltig" };
  if (!schluessel) return { status: "fehler" };
  const jahrgang = jahrgangAus(e.jahrgang);
  if (!e.vorname.trim() || !e.nachname.trim() || jahrgang === null) return { status: "fehlt" };
  const { data, error } = await createAnonClient().rpc("abholung_abholen", {
    p_token: token,
    p_schluessel: schluessel,
    p_vorname: e.vorname.slice(0, 200),
    p_nachname: e.nachname.slice(0, 200),
    p_jahrgang: jahrgang,
  });
  if (error || !data) return { status: "fehler" };
  const r = data as { status: string; token?: string; spieler?: { vorname: string; nachname: string } };
  if (r.status === "ok" && r.token && r.spieler) return { status: "ok", token: r.token, name: spielerName(r.spieler) };
  if (r.status === "passt_nicht" || r.status === "gesperrt" || r.status === "ungueltig") return { status: r.status };
  return { status: "fehler" };
}
