import "server-only";

// Die KI-Zugänge des angemeldeten Kontos für die Konto-Seite (Story #142 AK 5).
//
// Quelle der Wahrheit sind die Zustimmungen bei Supabase Auth (`listGrants`):
// Was dort nicht steht, ist kein Zugang, auch wenn noch ein Name dazu in
// `ki_zugang_namen` liegt. Die Namenstabelle liefert nur, was der Trainer
// selbst vergeben hat (PC 2).

import { createClient } from "@/lib/supabase/server";
import { zugangsAnzeigename } from "@/lib/mcp/regeln";
import { kalendertagAmTrainingsort } from "@/lib/zeit";

export type KiZugang = {
  clientId: string;
  /** Was die Liste zeigt: eigener Name, sonst der des Clients (PC 2). */
  name: string;
  /** Der Name, den der Client selbst nennt — ungeprüft. */
  clientName: string;
  /** `true`, wenn der Trainer beim Erlauben einen eigenen Namen vergeben hat. */
  eigenerName: boolean;
  /** Tag der Erlaubnis als `YYYY-MM-DD`, für `datumKurz`. */
  erlaubtAm: string;
};

/** Die Zugänge, neueste zuerst — oder `null`, wenn sie sich nicht abrufen
 *  lassen (etwa weil der OAuth-Server in dieser Umgebung nicht eingeschaltet
 *  ist). Die Seite zeigt dann eine Meldung statt einer leeren Liste, die
 *  fälschlich «keine Zugänge» behaupten würde. */
export async function getMeineZugaenge(): Promise<KiZugang[] | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: grants, error } = await supabase.auth.oauth.listGrants();
  if (error || !grants) {
    console.error("[ki-zugang] listGrants", error);
    return null;
  }
  if (grants.length === 0) return [];

  // Fehlt die Namenstabelle oder scheitert die Abfrage, bleibt die Liste
  // trotzdem vollständig — dann eben mit den Client-Namen.
  const { data: namen, error: namenFehler } = await supabase
    .from("ki_zugang_namen")
    .select("client_id, name")
    .eq("user_id", user.id);
  if (namenFehler) console.error("[ki-zugang] Namen lesen", namenFehler);
  const eigene = new Map<string, string>(
    ((namen ?? []) as { client_id: string; name: string }[]).map((n) => [n.client_id, n.name]),
  );

  return [...grants]
    // Als Zeitpunkt vergleichen, nicht als Text: die Nachkommastellen der
    // Sekunden sind nicht immer gleich lang.
    .sort((a, b) => Date.parse(b.granted_at) - Date.parse(a.granted_at))
    .map((g) => {
      const eigener = eigene.get(g.client.id) ?? null;
      const clientName = zugangsAnzeigename(null, g.client.name ?? "");
      return {
        clientId: g.client.id,
        name: eigener ?? clientName,
        clientName,
        eigenerName: eigener !== null,
        // Kalendertag in der Schweiz wie bei den Terminen; ein unlesbarer
        // Zeitstempel fällt auf seinen Datumsteil zurück.
        erlaubtAm:
          kalendertagAmTrainingsort(new Date(g.granted_at)) || g.granted_at.slice(0, 10),
      };
    });
}
