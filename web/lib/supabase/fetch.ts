/**
 * Der `fetch`, mit dem alle Supabase-Clients sprechen — mit genau einem
 * zweiten Versuch.
 *
 * WARUM: Die Supabase-Gateway bricht Anfragen bei rund fünf Sekunden hart ab
 * und antwortet mit 504. Gemessen an den Prod-Logs vom 2026-09-13: 14 Fälle in
 * 17 Stunden, `origin_time` durchweg zwischen 5014 und 5445 ms — keine
 * Streuung, eine Schranke. Betroffen waren mehrere Dienste gleichzeitig
 * (`/rest/v1/…` wie `/auth/v1/…`), und die Ausfälle häuften sich, wenn das
 * Projekt still war: In einer Stunde mit zwei Anfragen scheiterte eine, in
 * einer Stunde mit 615 Anfragen vier. Das ist die Signatur eines Kaltstarts,
 * nicht einer überlasteten Datenbank — die Übungstabelle hat 119 Zeilen.
 *
 * Ein zweiter Versuch überbrückt genau das. Die Fehlerseiten bleiben, was sie
 * sind: das Netz für den Fall, dass auch er nicht trägt.
 *
 * NUR GET UND HEAD. Das ist die wichtigste Grenze hier: Ein 504 heisst
 * „keine Antwort erhalten", nicht „nichts passiert". Ein abgebrochenes
 * `POST` kann sehr wohl geschrieben haben — ein zweiter Versuch legte das
 * Training ein zweites Mal an. Lesen darf man beliebig oft wiederholen,
 * Schreiben nicht, und diese Unterscheidung ist nicht verhandelbar.
 *
 * NUR 502/503/504 UND NETZFEHLER. Ein 500 kommt aus der Anwendung selbst und
 * käme beim zweiten Mal genauso wieder; ein 4xx ist eine Absage, keine
 * Störung. Wiederholt wird nur, was nach „unterwegs verloren" aussieht.
 *
 * DER ZWEITE VERSUCH IST BEFRISTET. Ohne Frist stünden im schlimmsten Fall
 * zwei volle Gateway-Timeouts hintereinander — gut zehn Sekunden, mehr als
 * eine Vercel-Funktion an Laufzeit hat. Dann verlöre der Trainer die
 * bedienbare Fehlerseite und bekäme die harte Zeitüberschreitung der
 * Plattform: Der Reparaturversuch hätte die Lage verschlimmert. Die Frist
 * hält das Ganze im Rahmen. Sie gilt bewusst NUR für den zweiten Versuch —
 * der erste bleibt unbefristet, weil eine angemeldete Abfrage laut
 * Rollen-Einstellung bis zu acht Sekunden dauern darf und ein knapper
 * Abbruch sie fälschlich abschnitte.
 */

/** Pause vor dem zweiten Versuch. Kurz: Es geht um einen Kaltstart, nicht um
 *  eine überlastete Datenbank, die Erholung braucht. */
const PAUSE_MS = 300;

/** Obergrenze für den zweiten Versuch — siehe Kopfkommentar. */
const FRIST_MS = 3000;

/** Antwortcodes, die nach „unterwegs verloren" aussehen. */
const WIEDERHOLBAR = new Set([502, 503, 504]);

function istLesend(input: RequestInfo | URL, init?: RequestInit): boolean {
  const methode = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  return methode === "GET" || methode === "HEAD";
}

/** Die Adresse für die Protokollzeile — ohne Query, damit kein Suchbegriff
 *  und kein Token im Log landet. */
function kurzeAdresse(input: RequestInfo | URL): string {
  const roh = input instanceof Request ? input.url : String(input);
  try {
    const u = new URL(roh);
    return `${u.origin}${u.pathname}`;
  } catch {
    return roh;
  }
}

export const fetchMitZweitemVersuch: typeof fetch = async (input, init) => {
  const lesend = istLesend(input, init);
  let grund: string;

  try {
    const antwort = await fetch(input, init);
    if (!lesend || !WIEDERHOLBAR.has(antwort.status)) return antwort;
    // Der Körper der verworfenen Antwort wird BEWUSST nicht geschlossen.
    // Naheliegend wäre `await antwort.body?.cancel()`, damit die Verbindung
    // frei wird — im Server-Component-Kontext blockiert das aber: Next
    // ersetzt das globale `fetch` und liest den Körper parallel für seinen
    // eigenen Cache. Das Abbrechen wartet dann auf einen Leser, der selbst
    // wartet, und der zweite Versuch kommt nie zustande. Nachgemessen: Ohne
    // diese Zeile lief `/trainings` in die Zeitüberschreitung, und beim
    // Gegenstück kam die Wiederholung überhaupt nicht am Server an.
    grund = `antwortete ${antwort.status}`;
  } catch (fehler) {
    // Netzfehler: `fetch` wirft, es gibt keine Antwort. Auch hier gilt die
    // Grenze — die Anfrage kann den Server erreicht haben.
    if (!lesend) throw fehler;
    grund = fehler instanceof Error ? `brach ab (${fehler.message})` : "brach ab";
  }

  console.warn(`[supabase] ${kurzeAdresse(input)} ${grund} — zweiter Versuch`);
  await new Promise((weiter) => setTimeout(weiter, PAUSE_MS));

  // Ein erneutes `fetch` mit demselben `input` ist unbedenklich, weil nur GET
  // und HEAD hier ankommen: Sie tragen keinen Körper, der beim ersten Versuch
  // schon verbraucht worden wäre.
  const frist = AbortSignal.timeout(FRIST_MS);
  return fetch(input, {
    ...init,
    signal: init?.signal ? AbortSignal.any([init.signal, frist]) : frist,
  });
};
