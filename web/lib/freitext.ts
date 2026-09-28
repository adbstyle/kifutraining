/* Freitext mit einfachen Listen (Story #282) — für den Ablauf (`aufbau`), die
   drei Stufen des methodischen Fahrplans und die Varianten einer Übung.

   Bewusst kein Markdown: Zeilenumbrüche und Leerzeilen bleiben, wie sie
   erfasst sind (AK 4). Formatiert wird ausschliesslich (AK 10):
     - eine Zeile, die mit «- » oder «* » beginnt → Aufzählungspunkt
     - eine Zeile, die mit «1. » (beliebige Zahl) beginnt → nummerierter Punkt
   Aufeinanderfolgende Punkte derselben Art bilden eine Liste; jede andere
   Zeile — auch eine Leerzeile — beendet sie. Alles Übrige ist Text.

   Die Datenbank kennt dieselben Listenzeichen: `freitext_suchtext` (Migration
   `varianten_freitext`) nimmt sie für die Suche heraus (AK 9). Wer hier ein
   Zeichen ergänzt, zieht es dort nach. */

export type FreitextBlock =
  | { art: "text"; text: string }
  | { art: "aufzaehlung"; punkte: string[] }
  | { art: "nummeriert"; punkte: string[]; start: number };

const AUFZAEHLUNG = /^[ \t]*[-*][ \t]+(.*)$/;
const NUMMERIERT = /^[ \t]*(\d+)\.[ \t]+(.*)$/;

/** Ist diese Zeile ein Listenpunkt (Aufzählung oder nummeriert)? */
function istListenzeile(zeile: string): boolean {
  return AUFZAEHLUNG.test(zeile) || NUMMERIERT.test(zeile);
}

/** Ein Freitext als Zeilen, wie die Stufe «Üben» des Fahrplans sie speichert:
 *  Leerzeilen im Innern bleiben (sie beenden eine Liste), Leerzeilen am Rand
 *  und Leerraum am Zeilenende fallen weg. Ohne Inhalt ein leeres Array. */
export function freitextZeilen(text: string | null | undefined): string[] {
  const zeilen = (text ?? "").replace(/\r\n?/g, "\n").split("\n").map((z) => z.trimEnd());
  while (zeilen.length && !zeilen[0].trim()) zeilen.shift();
  while (zeilen.length && !zeilen[zeilen.length - 1].trim()) zeilen.pop();
  return zeilen;
}

/** Einzelne Schritte als Aufzählungszeilen — für Quellen, die «Üben» als Liste
 *  von Schritten führen (die YAML-Daten des Manuals). Eine Zeile, die schon
 *  ein Listenzeichen trägt, bleibt, wie sie ist; der Seed ist so idempotent.
 *  Zwilling der Bestandsmigration `fahrplan_freitext`. */
export function alsAufzaehlung(schritte: readonly string[]): string[] {
  return schritte.map((s) => (istListenzeile(s) || !s.trim() ? s : `- ${s}`));
}

export function freitextBloecke(text: string | null | undefined): FreitextBlock[] {
  const bloecke: FreitextBlock[] = [];
  let zeilen: string[] = [];

  // Textzeilen sammeln sich, bis eine Liste beginnt. Leerzeilen am Rand eines
  // Textblocks trägt der Abstand zwischen den Blöcken, darin bleiben sie.
  const textAbschliessen = () => {
    while (zeilen.length && !zeilen[0].trim()) zeilen.shift();
    while (zeilen.length && !zeilen[zeilen.length - 1].trim()) zeilen.pop();
    if (zeilen.length) bloecke.push({ art: "text", text: zeilen.join("\n") });
    zeilen = [];
  };

  for (const zeile of (text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const punkt = AUFZAEHLUNG.exec(zeile);
    const nummer = punkt ? null : NUMMERIERT.exec(zeile);
    if (!punkt && !nummer) {
      zeilen.push(zeile);
      continue;
    }
    // Eine Liste setzt sich nur unmittelbar fort: dazwischen stand weder Text
    // noch eine Leerzeile (beide sammeln sich in `zeilen`).
    const fortsetzbar = zeilen.length === 0;
    textAbschliessen();
    const letzter = bloecke[bloecke.length - 1];
    if (punkt) {
      if (fortsetzbar && letzter?.art === "aufzaehlung") letzter.punkte.push(punkt[1]);
      else bloecke.push({ art: "aufzaehlung", punkte: [punkt[1]] });
    } else if (nummer) {
      if (fortsetzbar && letzter?.art === "nummeriert") letzter.punkte.push(nummer[2]);
      else bloecke.push({ art: "nummeriert", punkte: [nummer[2]], start: Number(nummer[1]) });
    }
  }
  textAbschliessen();
  return bloecke;
}
