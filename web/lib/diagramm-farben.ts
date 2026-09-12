/**
 * Die Rollen des Feld-Diagramms — Namen, keine Werte.
 *
 * Warum diese Datei keinen einzigen Farbwert enthält, obwohl `lib/farben.ts`
 * für die Oberfläche genau das tut:
 *
 * - **Dort wird gerechnet, hier wird gesetzt.** Die Höhenleiter der Oberfläche
 *   ist definitionsgemäss weisses Overlay über dem Grund; `farben.ts` hält die
 *   Herleitung neben dem Ergebnis, damit ein vertippter Hex-Wert auffällt.
 *   Diagramm-Farben werden nicht hergeleitet — sie werden pro Satz gesetzt.
 *   Ein Zwilling brächte keine Prüfung, nur eine zweite Stelle, die driftet.
 * - **Es werden mehr als zwei Sätze.** Heute Bildschirm und Druck, später ein
 *   Light-Modus. Jeder Satz ist ein Block in `app/globals.css`; die Namen hier
 *   bleiben dieselben, egal wie viele Sätze dazukommen.
 * - **Ein Tippfehler ist sonst unsichtbar.** `var(--diagramm-rasn)` löst still
 *   zu `unset` auf: die Fläche wird schwarz, nichts meldet sich. Der Union-Typ
 *   macht daraus einen Compile-Fehler — `dv()` ist deshalb die einzige Stelle,
 *   die im Code einen Diagramm-Farbwert erzeugen darf.
 *
 * Die Werte stehen in `app/globals.css` (`:root` für den Bildschirm,
 * `@media print :root` für das Papier), geprüft von
 * `scripts/pruefe-diagramm-farben.ts`.
 */

/**
 * Farbrollen, nach dem Gegenstand benannt, den sie zeichnen — nie nach ihrer
 * heutigen Bildschirmfarbe. Ausgenommen ist die wählbare Palette: ihre sieben
 * Rollen heissen wie die gespeicherten Slugs (siehe `FARBEN` in
 * `lib/diagramm.ts`) und meinen deshalb einen Namen, keine Farbe — «schwarz»
 * zeigt auf dem Nachtrasen Graphit und «weiss» auf Papier Dunkelgrau.
 *
 * Zwei Vorkommen teilen sich genau dann eine Rolle, wenn sie dasselbe
 * bedeuten UND in jedem Satz denselben Wert tragen. Was heute zufällig
 * gleich aussieht, aber im Druck auseinandergeht, bekommt zwei Rollen —
 * darum stehen `geraet`, `figur-stutzen` und `figur-band` nebeneinander,
 * obwohl alle drei am Bildschirm `#fafafa` sind.
 */
export const DIAGRAMM_FARBROLLEN = [
  // ── Das Feld ──────────────────────────────────────────────────────────
  "rasen",
  "rasen-streifen",
  /** Umriss der Spielfläche — am Bildschirm unsichtbar, auf Papier die
   *  einzige Begrenzung, die das weisse Feld vom weissen Blatt trennt. */
  "feldkante",

  // ── Die wählbare Palette: ein Eintrag je Slug aus `FARBEN` ────────────
  "rot",
  "blau",
  "gelb",
  "gruen",
  "orange",
  "weiss",
  "schwarz",

  // ── Bewegung ──────────────────────────────────────────────────────────
  /** Laufweg, Pass und Dribbling samt Pfeilspitze — im Manual (Abb. 24)
   *  schwarz; auf dem Nachtrasen trägt Schwarz nicht mehr. */
  "bewegung",

  // ── Textbox ───────────────────────────────────────────────────────────
  "textbox-grund",
  "textbox-rand",
  "textbox-schrift",

  // ── Geräte ────────────────────────────────────────────────────────────
  /** Tor-Rahmen und Hürden-Pfosten: das helle Gestänge. */
  "geraet",
  "tornetz",
  "minitor-netz",
  "minitor-schnur",
  "stange-stab",
  "huerde-latte",

  // ── Bälle ─────────────────────────────────────────────────────────────
  /** Der Ballkörper bleibt in jedem Satz hell — auf Papier trägt ihn die
   *  Kontur, nicht die Fläche. */
  "ball-koerper",
  /** Kontur und Fünfecke des Fussballs. */
  "ball-zeichnung",
  "handball",
  "handball-naht",
  "tennisball",
  "tennisball-naht",

  // ── Plastik der Symbole ───────────────────────────────────────────────
  "symbol-kontur",
  /** Weicher schwarzer Schleier über einer farbigen Fläche: die schattierte
   *  Flanke der Pylone, die Kragennaht auf dem Trikot. */
  "schatten",
  "symbol-glanz",
  "leibchen-glanz",
  "teller-loch",

  // ── Unbekanntes Symbol (Fallback) ─────────────────────────────────────
  "fallback-grund",
  "fallback-strich",

  // ── Figuren ───────────────────────────────────────────────────────────
  // Haut- und Haartöne sind durchnummeriert, nicht benannt: `figurVariante()`
  // greift sie über einen Hash der Element-id als Feld ab. Die Reihenfolge
  // ist damit Teil des Vertrags — wer sie umsortiert, gibt bestehenden
  // Figuren ein anderes Gesicht.
  "figur-haut-1",
  "figur-haut-2",
  "figur-haut-3",
  "figur-haut-4",
  "figur-haut-5",
  "figur-haar-1",
  "figur-haar-2",
  "figur-haar-3",
  "figur-haar-4",
  "figur-haar-5",
  "figur-haar-6",
  /** Augen und Mund. */
  "figur-tinte",
  "figur-rouge",
  "figur-hose",
  "figur-stutzen",
  "figur-schuh",
  "figur-band",
  "figur-zopfband",
  "torwart-trikot",
  "torwart-hose",
  /** Handschuh und Kappenrand sind heute derselbe helle Ton, bleiben aber
   *  getrennt: der eine liegt auf dem Neon-Trikot des Torhüters, der andere
   *  auf der dunklen Kappe des Trainers — zwei Nachbarn, die in einem
   *  weiteren Satz auseinandergehen können. */
  "torwart-handschuh",
  "torwart-handschuh-rand",
  "trainer-hose",
  "trainer-arm",
  "trainer-kappe",
  "trainer-kappe-rand",
] as const;

/**
 * Rollen, die keine Farbe tragen. Sie stehen hier, weil sie sich zwischen den
 * Sätzen genauso unterscheiden wie eine Farbe — und weil eine Zahl, die im
 * Komponentencode steht, sich nicht per Media Query umschalten lässt.
 */
export const DIAGRAMM_MASSROLLEN = [
  /** Strichstärke der Ball-Kontur: auf Papier kräftiger, damit der Ball
   *  zwischen lauter Grautönen erkennbar bleibt. */
  "ball-strich",
  /** Deckung einer gefüllten Zone. Den Umriss zeichnet die volle Farbe —
   *  die Füllung sagt nur, wohin die Zone reicht, und darf auf Papier
   *  deshalb deutlich leiser sein. */
  "form-deckung",
] as const;

export type DiagrammFarbrolle = (typeof DIAGRAMM_FARBROLLEN)[number];
export type DiagrammMassrolle = (typeof DIAGRAMM_MASSROLLEN)[number];
export type DiagrammRolle = DiagrammFarbrolle | DiagrammMassrolle;

/**
 * Die Referenz auf eine Diagramm-Rolle, wie sie ins SVG gehört.
 *
 * `var()` löst der Browser beim Zeichnen auf — deshalb rendert dieselbe
 * Server Component Bildschirm und Druck, ohne je zu wissen, welches Medium
 * gerade gilt.
 */
export function dv(rolle: DiagrammRolle): string {
  return `var(--diagramm-${rolle})`;
}
