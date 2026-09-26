/* Freitext mit einfachen Listen (Story #282) — für den Ablauf (`aufbau`) und
   die Varianten einer Übung.

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

/** Hinweis unter den Eingabefeldern — hier, damit er mit den Regeln oben
 *  nicht auseinanderläuft (AK 5). */
export const FREITEXT_HINWEIS =
  "Eine Zeile mit «- » beginnen für eine Aufzählung, mit «1. » für eine nummerierte Liste.";

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
