// Webadressen in einem Freitext erkennen (#556 AK 5) — für Texte ohne
// Formatierung, in denen eine Adresse trotzdem anklickbar sein soll.
//
// Erkannt wird, was mit «http://», «https://» oder «www.» beginnt, bis zum
// nächsten Leerraum. Satzzeichen am Ende («… unter www.fc.ch.») gehören nicht
// zur Adresse, eine schliessende Klammer nur, wenn die Adresse eine öffnet.
// Andere Schemata (javascript:, mailto:) bleiben Text.
//
// REIN: keine Server-Importe — `check:kern` lädt diese Datei mit tsx.

export type TextTeil = { art: "text"; text: string } | { art: "link"; text: string; href: string };

const ADRESSE = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const SATZENDE = /[.,;:!?»«"'’)\]]+$/;

/** Teilt einen Text in Text und Webadressen; die Teile ergeben zusammen wieder
 *  den ganzen Text. */
export function textMitLinks(text: string): TextTeil[] {
  const teile: TextTeil[] = [];
  let rest = 0;
  for (const m of text.matchAll(ADRESSE)) {
    let adresse = m[0];
    let ende = adresse.match(SATZENDE)?.[0] ?? "";
    // Eine Klammer, die die Adresse selbst öffnet, bleibt an ihr (Wikipedia).
    if (ende.startsWith(")") && adresse.includes("(")) ende = ende.slice(1);
    adresse = adresse.slice(0, adresse.length - ende.length);
    if (!/\.[a-z]{2,}/i.test(adresse.replace(/^https?:\/\//i, ""))) continue;
    if (m.index! > rest) teile.push({ art: "text", text: text.slice(rest, m.index) });
    const href = /^www\./i.test(adresse) ? `https://${adresse}` : adresse;
    teile.push({ art: "link", text: adresse, href });
    rest = m.index! + adresse.length;
  }
  if (rest < text.length) teile.push({ art: "text", text: text.slice(rest) });
  return teile;
}
