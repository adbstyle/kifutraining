"use server";

// Erlauben, Ablehnen und Widerrufen eines KI-Zugangs (Story #142).
//
// Die Zustimmung selbst führt Supabase Auth als OAuth-2.1-Server; hier liegt
// nur, was Supabase nicht kennt oder nicht prüft: der eigene Name des Zugangs
// (AK 3, PC 2) und die Grenze von höchstens fünf Zugängen je Konto (AK 11).
//
// Die Actions liefern einen Ergebnis-Typ statt selbst umzuleiten: Die
// Rücksprung-Adresse eines KI-Clients kann ein eigenes Schema tragen
// (`claude://…`), das `redirect()` nicht bedient — der Browser navigiert darum
// selbst mit `window.location.assign`. So kann die Seite ausserdem Feldfehler
// am Namensfeld zeigen, statt die Anfrage zu verlieren.
//
// Fehlertexte sind immer eigene Sätze, nie `error.message`: Die Meldungen von
// Supabase Auth sind englisch und verraten Interna.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  MELDUNG_ANFRAGE_UNBEKANNT,
  MELDUNG_ZUGAENGE_GRENZE,
  eigenerZugangsname,
  grenzeErreicht,
  istAnfrageKennung,
  zugangsnameProblem,
} from "@/lib/mcp/regeln";
import { istUuid } from "@/lib/mcp/bausteine";

export type ZustimmungErgebnis =
  | { status: "weiter"; url: string }
  | { status: "grenze"; meldung: string }
  | { status: "fehler"; meldung: string; feld?: "name" };

export type WiderrufErgebnis = { ok: true } | { ok: false; error: string };

const MELDUNG_ABGEMELDET = "Du bist nicht mehr angemeldet. Bitte melde dich erneut an und starte das Verbinden neu.";
const MELDUNG_NICHT_ERLAUBT =
  "Der Zugang liess sich gerade nicht erlauben. Bitte versuche es erneut oder starte das Verbinden neu.";
const MELDUNG_NICHT_ABGELEHNT =
  "Die Ablehnung liess sich gerade nicht übermitteln. Bitte versuche es erneut.";
const MELDUNG_NICHT_WIDERRUFEN = "Der Zugang liess sich nicht widerrufen. Bitte erneut versuchen.";

type Db = Awaited<ReturnType<typeof createClient>>;
type NamensSchluessel = { user_id: string; client_id: string };

/** Den eigenen Namen eines Zugangs setzen (`name`) oder entfernen (`null`).
 *  Eine Stelle für Schritt 6 und das Zurücksetzen in Schritt 7 — beide
 *  müssen dieselbe Regel befolgen: eine Zeile gibt es nur mit eigenem Namen. */
async function schreibeName(sb: Db, schluessel: NamensSchluessel, name: string | null) {
  return name
    ? sb.from("ki_zugang_namen").upsert({ ...schluessel, name }, { onConflict: "user_id,client_id" })
    : sb.from("ki_zugang_namen").delete().match(schluessel);
}

/** Erlauben (AK 1, AK 3, AK 11, PC 1, PC 4). */
export async function erlaubeZugang(
  authorizationId: string,
  nameRoh: string,
): Promise<ZustimmungErgebnis> {
  // Die Action ist von aussen direkt aufrufbar: der Name EINMAL normalisiert,
  // danach gilt nur noch dieser Wert.
  const name = typeof nameRoh === "string" ? nameRoh : "";

  // 1 — Kennung
  if (!istAnfrageKennung(authorizationId)) {
    return { status: "fehler", meldung: MELDUNG_ANFRAGE_UNBEKANNT };
  }

  // 2 — Nur angemeldet (AK 4, PC 1): Die Zustimmung bindet den Zugang an
  // genau das Konto dieser Session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", meldung: MELDUNG_ABGEMELDET };

  // 3 — Die Anfrage nochmals bei Supabase holen: Der Client-Name und die
  // Client-ID dürfen nicht aus dem Formular stammen, sonst liesse sich der
  // Name eines fremden Clients überschreiben.
  const { data: details, error: detailsFehler } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (detailsFehler || !details) {
    console.error("[ki-zugang] getAuthorizationDetails", detailsFehler);
    return { status: "fehler", meldung: MELDUNG_ANFRAGE_UNBEKANNT };
  }
  // Schon zugestimmt (etwa in einem zweiten Tab): nichts mehr zu tun.
  if (!("authorization_id" in details)) return { status: "weiter", url: details.redirect_url };

  // 4 — Namensregel (AK 3). Leer ist kein Fehler, dann gilt der Client-Name.
  const problem = zugangsnameProblem(name);
  if (problem) return { status: "fehler", meldung: problem, feld: "name" };

  // 5 — Grenze (AK 11). Auch hier und nicht nur auf der Seite: Die Action ist
  // von aussen direkt aufrufbar. Ein Client, der schon einen Zugang hat, zählt
  // nicht mit — erneutes Erlauben ersetzt nur.
  const { data: grants, error: grantsFehler } = await supabase.auth.oauth.listGrants();
  if (grantsFehler || !grants) {
    console.error("[ki-zugang] listGrants", grantsFehler);
    return { status: "fehler", meldung: MELDUNG_NICHT_ERLAUBT };
  }
  if (grenzeErreicht(grants, details.client.id)) {
    return { status: "grenze", meldung: MELDUNG_ZUGAENGE_GRENZE };
  }

  // 6 — Eigener Name (PC 2): Eine Zeile gibt es nur, wenn er vom Client-Namen
  // abweicht; ohne eigenen Namen wird ein Rest aus einer früheren Zustimmung
  // entfernt, sonst zeigte das Konto einen Namen, den niemand gewählt hat.
  // Der bisherige Stand wird gemerkt, damit ein Scheitern in Schritt 7 nichts
  // verändert zurücklässt. Der Client-Name kann fehlen (Supabase lässt leere
  // Felder weg).
  const eigener = eigenerZugangsname(name, details.client.name ?? "");
  const schluessel = { user_id: user.id, client_id: details.client.id };
  const { data: vorher } = await supabase
    .from("ki_zugang_namen")
    .select("name")
    .match(schluessel)
    .maybeSingle();
  const vorherName: string | null = vorher?.name ?? null;

  if (eigener !== vorherName) {
    const { error } = await schreibeName(supabase, schluessel, eigener);
    if (error) {
      console.error("[ki-zugang] Name speichern", error);
      return { status: "fehler", meldung: MELDUNG_NICHT_ERLAUBT };
    }
  }

  // 7 — Zustimmen. `skipBrowserRedirect`: auf dem Server gibt es keinen
  // Browser; die Adresse geht an den Client zurück (siehe Kopf).
  const { data: zustimmung, error: zustimmungsFehler } =
    await supabase.auth.oauth.approveAuthorization(authorizationId, {
      skipBrowserRedirect: true,
    });
  if (zustimmungsFehler || !zustimmung) {
    console.error("[ki-zugang] approveAuthorization", zustimmungsFehler);
    // Den Namen wieder auf den Stand vor dem Versuch bringen: Ohne Zustimmung
    // gehört zu dieser Client-ID kein neuer Name.
    if (eigener !== vorherName) await schreibeName(supabase, schluessel, vorherName);
    return { status: "fehler", meldung: MELDUNG_NICHT_ERLAUBT };
  }

  revalidatePath("/konto");
  // 8 — Zurück zum Client, der damit ohne weiteres Zutun verbunden ist (PC 4).
  return { status: "weiter", url: zustimmung.redirect_url };
}

/** Ablehnen (AK 1, PC 3): Der Client erfährt es über `access_denied` in der
 *  Rücksprung-Adresse, die Supabase liefert. Ablehnen geht auch bei
 *  erreichter Grenze — gerade dann (AK 4: «wo er weiterhin ablehnen kann»). */
export async function lehneZugangAb(authorizationId: string): Promise<ZustimmungErgebnis> {
  if (!istAnfrageKennung(authorizationId)) {
    return { status: "fehler", meldung: MELDUNG_ANFRAGE_UNBEKANNT };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "fehler", meldung: MELDUNG_ABGEMELDET };

  const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId, {
    skipBrowserRedirect: true,
  });
  if (error || !data) {
    console.error("[ki-zugang] denyAuthorization", error);
    return { status: "fehler", meldung: MELDUNG_NICHT_ABGELEHNT };
  }
  return { status: "weiter", url: data.redirect_url };
}

/** Einen Zugang widerrufen (AK 6, PC 6). Supabase beendet dabei die Sessions
 *  dieses Clients und macht seine Refresh-Tokens ungültig; ein noch laufendes
 *  Access-Token scheitert am nächsten Aufruf, weil der Endpoint jedes Token
 *  gegen Supabase Auth prüft. Die übrigen Zugänge bleiben unberührt. */
export async function widerrufeZugang(clientId: string): Promise<WiderrufErgebnis> {
  if (!istUuid(clientId)) {
    return { ok: false, error: MELDUNG_NICHT_WIDERRUFEN };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: MELDUNG_ABGEMELDET };

  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });
  if (error) {
    console.error("[ki-zugang] revokeGrant", error);
    return { ok: false, error: MELDUNG_NICHT_WIDERRUFEN };
  }

  // Best effort: Der Name gehört zum widerrufenen Zugang. Bleibt er liegen,
  // schadet er nicht — ein erneutes Erlauben überschreibt oder entfernt ihn.
  const { error: nameFehler } = await supabase
    .from("ki_zugang_namen")
    .delete()
    .match({ user_id: user.id, client_id: clientId });
  if (nameFehler) console.error("[ki-zugang] Name entfernen", nameFehler);

  revalidatePath("/konto");
  return { ok: true };
}
