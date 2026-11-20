import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PUSH_ANZAHL_JE_RUNDE,
  PUSH_TIMEOUT_MS,
  mitteilungInhalt,
  pushErgebnis,
  type Mitteilung,
  type PushAuftrag,
  type PushErgebnis,
} from "@/lib/push";

/**
 * Mitteilungen zustellen (Epic #482, Story #483) — der Abarbeiter der Route
 * /api/push/abarbeiten, ohne `next/*` und ohne web-push: Den Sender setzt der
 * Aufrufer ein (die Route web-push, die Prüfung check:kern-db einen Stub).
 *
 * Ablauf je Runde: Aufträge holen (`push_auftraege_holen`, vergeben mit
 * `skip locked`), allen Geräten gleichzeitig zustellen (`allSettled`, je
 * Gerät höchstens `PUSH_TIMEOUT_MS`), das Ergebnis melden
 * (`push_auftraege_melden`: zugestellt → weg, 404/410 → Abo weg, sonst ein
 * Versuch mehr). Weiter, solange volle Runden kommen und Zeit bleibt.
 *
 * Berechtigt ist die Route über das Geheimnis aus Vault, das pg_net als
 * Bearer mitschickt; die Datenebene prüft es selbst. Kein Service-Role-
 * Schlüssel zur Laufzeit.
 */

/** Stellt einem Gerät zu; liefert den HTTP-Status des Diensts oder `null`
 *  (Netz, Zeit). Wirft nie — tut er es doch, gilt es als Fehler. */
export type PushSender = (abo: { endpoint: string; p256dh: string; auth: string }, mitteilung: Mitteilung) => Promise<number | null>;

export type PushZugang = {
  holen: (anzahl: number) => Promise<PushAuftrag[] | null>;
  melden: (ergebnisse: { id: string; ergebnis: PushErgebnis }[]) => Promise<boolean>;
};

/** Holen und Melden über die RPCs, mit dem Geheimnis (Route) — oder ohne,
 *  mit dem Service-Role-Client der Prüfung. `schluessel`: das Kürzel des
 *  VAPID-Public-Keys dieser Umgebung (PC 5). */
export function pushZugang(supabase: SupabaseClient, geheimnis: string | null, schluessel: string): PushZugang {
  return {
    holen: async (anzahl) => {
      const { data, error } = await supabase.rpc("push_auftraege_holen", {
        p_geheimnis: geheimnis,
        p_schluessel: schluessel,
        p_anzahl: anzahl,
      });
      if (error) {
        console.error("[push] holen:", error.message);
        return null;
      }
      return Array.isArray(data) ? (data as PushAuftrag[]) : null;
    },
    melden: async (ergebnisse) => {
      const { data, error } = await supabase.rpc("push_auftraege_melden", { p_geheimnis: geheimnis, p_ergebnisse: ergebnisse });
      if (error) console.error("[push] melden:", error.message);
      return !error && typeof data === "number";
    },
  };
}

/** Was eine Abarbeitung ergab. `berechtigt: false`: Das Holen gab nichts
 *  heraus (falsches Geheimnis oder Fehler der Datenebene). */
export type PushBilanz = { berechtigt: boolean; runden: number; zugestellt: number; weg: number; fehler: number };

function mitZeitlimit(p: Promise<number | null>, ms: number): Promise<number | null> {
  let uhr: ReturnType<typeof setTimeout> | undefined;
  const ablauf = new Promise<null>((r) => {
    uhr = setTimeout(() => r(null), ms);
  });
  return Promise.race([p, ablauf]).finally(() => clearTimeout(uhr));
}

/** Holt, stellt zu und meldet, bis eine Runde nicht voll ist oder
 *  `zeitbudgetMs` verbraucht ist. */
export async function arbeitePushAb({
  zugang,
  senden,
  anzahl = PUSH_ANZAHL_JE_RUNDE,
  zeitbudgetMs = 20_000,
  timeoutMs = PUSH_TIMEOUT_MS,
  jetzt = () => Date.now(),
}: {
  zugang: PushZugang;
  senden: PushSender;
  anzahl?: number;
  zeitbudgetMs?: number;
  timeoutMs?: number;
  jetzt?: () => number;
}): Promise<PushBilanz> {
  const start = jetzt();
  const bilanz: PushBilanz = { berechtigt: false, runden: 0, zugestellt: 0, weg: 0, fehler: 0 };
  for (;;) {
    const auftraege = await zugang.holen(anzahl);
    if (auftraege === null) return bilanz;
    bilanz.berechtigt = true;
    if (auftraege.length === 0) return bilanz;
    bilanz.runden += 1;
    const antworten = await Promise.allSettled(
      auftraege.map((a) => mitZeitlimit(senden(a, mitteilungInhalt({ vorname: a.vorname, link: a.link, eintrag: a.eintrag })), timeoutMs)),
    );
    const ergebnisse = auftraege.map((a, i) => {
      const r = antworten[i];
      const ergebnis = pushErgebnis(r.status === "fulfilled" ? r.value : null);
      bilanz[ergebnis] += 1;
      return { id: a.id, ergebnis };
    });
    await zugang.melden(ergebnisse);
    if (auftraege.length < anzahl || jetzt() - start > zeitbudgetMs) return bilanz;
  }
}
