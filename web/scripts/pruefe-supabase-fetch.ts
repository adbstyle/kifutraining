// Prüft den zweiten Versuch der Supabase-Clients (web/lib/supabase/fetch.ts)
// gegen einen echten lokalen Server. Ohne DB und ohne Netz nach draussen;
// läuft im PR-Check neben den übrigen `check:*`.
//
// Der Wert dieser Prüfung liegt an EINER Stelle: Wiederholt wird nur Lesen.
// Ein 504 heisst „keine Antwort erhalten", nicht „nichts passiert" — ein
// abgebrochenes POST kann sehr wohl geschrieben haben, und ein zweiter Versuch
// legte das Training ein zweites Mal an. Diese Grenze ist mit blossem Auge
// nicht nachprüfbar: Ob wiederholt wurde, sieht man nur am Server. Genau das
// zählt der Wächter hier.
//
//   npm run check:supabase-fetch
import assert from "node:assert/strict";
import http from "node:http";
import { fetchMitZweitemVersuch } from "../lib/supabase/fetch";

let gelaufen = 0;
let gescheitert = 0;
async function pruefe(was: string, fn: () => Promise<void>) {
  try {
    await fn();
    gelaufen++;
    console.log(`✓ ${was}`);
  } catch (fehler) {
    gescheitert++;
    console.error(`✗ ${was}`);
    console.error(`  ${fehler instanceof Error ? fehler.message : String(fehler)}`);
  }
}

/** Ein Server, der mit `status` antwortet und mitzählt, wie oft er gefragt
 *  wurde. `status = 0` heisst: Verbindung hart schliessen — der Netzfehler. */
async function server(status: number) {
  let aufrufe = 0;
  const s = http.createServer((req, res) => {
    aufrufe++;
    if (status === 0) return res.socket?.destroy();
    res.writeHead(status, { "Content-Type": "text/html" });
    res.end("<html>504 Gateway Time-out</html>");
  });
  await new Promise<void>((fertig) => s.listen(0, fertig));
  const port = (s.address() as { port: number }).port;
  return {
    url: `http://127.0.0.1:${port}/rest/v1/trainings`,
    get aufrufe() {
      return aufrufe;
    },
    zu: () => new Promise<void>((fertig) => s.close(() => fertig())),
  };
}

/** Wie oft der Server bei dieser Anfrage tatsächlich angesprochen wurde. */
async function aufrufeBei(status: number, init?: RequestInit): Promise<number> {
  const srv = await server(status);
  try {
    await fetchMitZweitemVersuch(srv.url, init).catch(() => undefined);
    return srv.aufrufe;
  } finally {
    await srv.zu();
  }
}

await pruefe("Lesen wird bei 502/503/504 genau einmal wiederholt", async () => {
  for (const status of [502, 503, 504]) {
    assert.equal(await aufrufeBei(status), 2, `Status ${status}`);
  }
});

await pruefe("Lesen wird bei einem Netzfehler wiederholt", async () => {
  assert.equal(await aufrufeBei(0), 2);
});

await pruefe("SCHREIBEN wird NIE wiederholt — auch nicht bei 504", async () => {
  // Die Regel, an der alles hängt: Ein zweiter Versuch legte den Datensatz
  // ein zweites Mal an.
  for (const methode of ["POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(await aufrufeBei(504, { method: methode }), 1, methode);
    assert.equal(await aufrufeBei(0, { method: methode }), 1, `${methode} bei Netzfehler`);
  }
});

await pruefe("Ein 500 oder 4xx wird nicht wiederholt", async () => {
  // 500 kommt aus der Anwendung und käme genauso wieder; 4xx ist eine Absage,
  // keine Störung.
  for (const status of [400, 401, 404, 409, 500]) {
    assert.equal(await aufrufeBei(status), 1, `Status ${status}`);
  }
});

await pruefe("Eine erfolgreiche Antwort geht unverändert durch", async () => {
  const srv = await server(200);
  try {
    const antwort = await fetchMitZweitemVersuch(srv.url);
    assert.equal(antwort.status, 200);
    assert.equal(srv.aufrufe, 1);
  } finally {
    await srv.zu();
  }
});

console.log(
  `\n${gelaufen} Prüfungen bestanden` + (gescheitert > 0 ? `, ${gescheitert} gescheitert.` : "."),
);
if (gescheitert > 0) process.exit(1);
