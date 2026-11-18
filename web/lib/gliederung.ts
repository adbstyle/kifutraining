/* Gegliederter Text (#598): die Infos zum Team. Anders als `freitext.ts`
   (bewusst kein Markdown) kennt er wenige Markdown-Kürzel, die die
   Werkzeugleiste im Bearbeiten-Dialog einfügt (AK 2):
     - eine Zeile mit «# », «## » oder «### » → Zwischentitel
     - eine Zeile mit «- » oder «* » → Aufzählungspunkt
     - eine Zeile mit «1. » (beliebige Zahl) → nummerierter Punkt
     - «**fett**» im Text → hervorgehoben
   Eine Leerzeile trennt Absätze; ein Zeilenumbruch im Absatz bleibt.
   Webadressen werden anklickbar (`text-links.ts`, AK 8); Links mit eigenem
   Linktext, Bilder, Tabellen und HTML gibt es nicht (OoS 1) — alles Übrige
   steht als Text da.

   REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx. */

export type GliederungInline = { art: "text" | "fett"; text: string };

export type GliederungBlock =
  | { art: "titel"; text: GliederungInline[] }
  | { art: "absatz"; zeilen: GliederungInline[][] }
  | { art: "aufzaehlung"; punkte: GliederungInline[][] }
  | { art: "nummeriert"; punkte: GliederungInline[][]; start: number };

const TITEL = /^[ \t]*#{1,3}[ \t]+(.*)$/;
const AUFZAEHLUNG = /^[ \t]*[-*][ \t]+(.*)$/;
const NUMMERIERT = /^[ \t]*(\d+)\.[ \t]+(.*)$/;
const FETT = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;

/** Hervorhebungen in einer Zeile: «**…**» wird fett, ein einzelnes «**»
 *  bleibt als Text stehen. */
export function gliederungInline(zeile: string): GliederungInline[] {
  const teile: GliederungInline[] = [];
  let rest = 0;
  for (const m of zeile.matchAll(FETT)) {
    if (m.index! > rest) teile.push({ art: "text", text: zeile.slice(rest, m.index) });
    teile.push({ art: "fett", text: m[1] });
    rest = m.index! + m[0].length;
  }
  if (rest < zeile.length) teile.push({ art: "text", text: zeile.slice(rest) });
  return teile;
}

export function gliederungBloecke(text: string | null | undefined): GliederungBlock[] {
  const bloecke: GliederungBlock[] = [];
  let absatz: string[] = [];
  const absatzAbschliessen = () => {
    if (absatz.length) bloecke.push({ art: "absatz", zeilen: absatz.map(gliederungInline) });
    absatz = [];
  };

  for (const roh of (text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const zeile = roh.trimEnd();
    const titel = TITEL.exec(zeile);
    const punkt = titel ? null : AUFZAEHLUNG.exec(zeile);
    const nummer = titel || punkt ? null : NUMMERIERT.exec(zeile);
    if (!zeile.trim()) {
      absatzAbschliessen();
      // Eine Leerzeile beendet auch eine Liste.
      bloecke.push({ art: "absatz", zeilen: [] });
      continue;
    }
    if (titel) {
      absatzAbschliessen();
      bloecke.push({ art: "titel", text: gliederungInline(titel[1].trim()) });
      continue;
    }
    if (punkt || nummer) {
      absatzAbschliessen();
      const letzter = bloecke[bloecke.length - 1];
      if (punkt) {
        if (letzter?.art === "aufzaehlung") letzter.punkte.push(gliederungInline(punkt[1]));
        else bloecke.push({ art: "aufzaehlung", punkte: [gliederungInline(punkt[1])] });
      } else if (nummer) {
        if (letzter?.art === "nummeriert") letzter.punkte.push(gliederungInline(nummer[2]));
        else bloecke.push({ art: "nummeriert", punkte: [gliederungInline(nummer[2])], start: Number(nummer[1]) });
      }
      continue;
    }
    // Eine Textzeile direkt nach einer Liste beginnt einen neuen Absatz.
    absatz.push(zeile);
  }
  absatzAbschliessen();
  // Die Platzhalter der Leerzeilen haben ihre Arbeit getan.
  return bloecke.filter((b) => b.art !== "absatz" || b.zeilen.length > 0);
}

/** Der Text ohne Kürzel — für eine einzeilige Vorschau. */
export function gliederungAlsText(text: string | null | undefined): string {
  return gliederungBloecke(text)
    .map((b) => {
      const zeile = (z: GliederungInline[]) => z.map((t) => t.text).join("");
      if (b.art === "titel") return zeile(b.text);
      if (b.art === "absatz") return b.zeilen.map(zeile).join(" ");
      return b.punkte.map(zeile).join(" · ");
    })
    .join(" · ");
}

// ── Werkzeugleiste (AK 2) ──────────────────────────────────────────────────
// Rein: Text und Auswahl hinein, Text und neue Auswahl heraus. Die Leiste im
// Dialog setzt das Ergebnis ins Textfeld.

export type Auswahl = { text: string; start: number; ende: number };

export type Gliederung = "titel" | "fett" | "aufzaehlung" | "nummeriert";

/** Die ganzen Zeilen, die die Auswahl berührt. */
function zeilenDerAuswahl(a: Auswahl): { von: number; bis: number } {
  const von = a.text.lastIndexOf("\n", Math.max(0, a.start - 1)) + 1;
  const ende = a.ende > a.start && a.text[a.ende - 1] === "\n" ? a.ende - 1 : a.ende;
  const nl = a.text.indexOf("\n", ende);
  return { von: a.start === 0 ? 0 : von, bis: nl === -1 ? a.text.length : nl };
}

const PRAEFIX: Record<Exclude<Gliederung, "fett">, RegExp> = {
  titel: /^#{1,3}[ \t]+/,
  aufzaehlung: /^[-*][ \t]+/,
  nummeriert: /^\d+\.[ \t]+/,
};
const JEDES_PRAEFIX = /^(?:#{1,3}|[-*]|\d+\.)[ \t]+/;

/** Wendet eine Gliederung auf die Auswahl an. Zeilenformate schalten um:
 *  Tragen alle berührten Zeilen schon das Kürzel, fällt es weg, sonst ersetzt
 *  es ein anderes. Fett umschliesst die Auswahl (ohne Auswahl: Platzhalter). */
export function gliedere(a: Auswahl, art: Gliederung): Auswahl {
  if (art === "fett") {
    const markiert = a.text.slice(a.start, a.ende);
    const davor = a.text.slice(0, a.start);
    const danach = a.text.slice(a.ende);
    // Nur aufheben, wenn die Auswahl genau in einem fetten Stück steht: Davor
    // auf der Zeile steht eine ungerade Zahl «**» (sonst gehörten sie zu
    // Nachbarn wie in «**x** y **z**»).
    const zeileDavor = davor.slice(davor.lastIndexOf("\n") + 1);
    const innen = (zeileDavor.match(/\*\*/g) ?? []).length % 2 === 1;
    if (innen && zeileDavor.endsWith("**") && danach.startsWith("**") && !markiert.includes("\n")) {
      return { text: davor.slice(0, -2) + markiert + danach.slice(2), start: a.start - 2, ende: a.ende - 2 };
    }
    // Fett gilt je Zeile: Über mehrere Zeilen wird jede für sich umschlossen.
    const inhalt = (markiert || "fett")
      .split("\n")
      .map((z) => (z.trim() ? `**${z}**` : z))
      .join("\n");
    const start = markiert.includes("\n") ? a.start : a.start + 2;
    const ende = markiert.includes("\n") ? a.start + inhalt.length : a.start + inhalt.length - 2;
    return { text: davor + inhalt + danach, start, ende };
  }
  const { von, bis } = zeilenDerAuswahl(a);
  const zeilen = a.text.slice(von, bis).split("\n");
  // Eine leere Zeile allein bekommt das Kürzel (so beginnt man eine Liste);
  // in einer Auswahl über mehrere Zeilen bleiben leere Zeilen leer.
  const mitInhalt = zeilen.some((z) => z.trim());
  const alle = mitInhalt && zeilen.every((z) => !z.trim() || PRAEFIX[art].test(z));
  let n = 0;
  const neu = zeilen.map((z) => {
    if (!z.trim() && mitInhalt) return z;
    const ohne = z.replace(JEDES_PRAEFIX, "");
    if (alle) return ohne;
    n += 1;
    return (art === "titel" ? "## " : art === "aufzaehlung" ? "- " : `${n}. `) + ohne;
  });
  const block = neu.join("\n");
  const text = a.text.slice(0, von) + block + a.text.slice(bis);
  return { text, start: von, ende: von + block.length };
}
