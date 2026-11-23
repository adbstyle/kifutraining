/* Impressum und Datenschutzerklärung (#672). REIN: keine Server-Importe —
   `check:kern` lädt die Datei und prüft die Angaben.

   Beides ist ein ENTWURF aus dem Ist-Zustand (Entscheid 2): Die Rechtsberatung
   prüft die Texte vor der Veröffentlichung auf Produktion, bis dahin trägt
   jede Seite sichtbar ENTWURF_HINWEIS. Die Trägerschaft ist noch nicht
   gegründet (Entscheid 1); ihr Name, die Postadresse und die E-Mail-Adresse
   sind darum Platzhalter, die hier an EINER Stelle nachgetragen werden. */

/** Die Adressen der beiden Seiten. Zwilling: FREIGEGEBEN und SITEMAP_PFADE in
 *  lib/auffindbar.ts (Suchmaschinen dürfen sie lesen, AK 8). */
export const IMPRESSUM_PFAD = "/impressum";
export const DATENSCHUTZ_PFAD = "/datenschutz";

/** Die Links auf beide Seiten, in dieser Reihenfolge überall gleich:
 *  Fusszeile der Startseite, Anmeldeseiten, privater Link (AK 1). */
export const RECHTLICHE_LINKS = [
  { href: IMPRESSUM_PFAD, label: "Impressum" },
  { href: DATENSCHUTZ_PFAD, label: "Datenschutz" },
] as const;

/** Sichtbar auf jeder der beiden Seiten, bis die Rechtsberatung den Text
 *  geprüft hat. */
export const ENTWURF_HINWEIS = "Entwurf – rechtlich noch nicht geprüft.";

/** Stand des Entwurfs, oben auf beiden Seiten. */
export const RECHTLICHES_STAND = "November 2026";

/** Die Trägerschaft von KiFu (Entscheid 1: Verein oder Organisation, noch
 *  nicht gegründet). Platzhalter, klar als solche erkennbar. */
export const TRAEGERSCHAFT = "Trägerschaft in Gründung";

/** Die Postadresse der Trägerschaft — Platzhalter bis zur Gründung (PC 1). */
export const POSTADRESSE_PLATZHALTER = ["[Postadresse folgt mit der Gründung]"] as const;

/** Die E-Mail-Adresse für Anfragen (AK 2, 6; Entscheid 3). Im Repository
 *  steht keine bestehende Kontaktadresse; bis die PO sie nennt, zeigen die
 *  Seiten KONTAKT_PLATZHALTER statt eines Links. */
export const KONTAKT_EMAIL: string | null = null;
export const KONTAKT_PLATZHALTER = "[E-Mail-Adresse folgt]";

/** Die Vereinbarung zur Auftragsbearbeitung (#675, ENTWURF wie Impressum und
 *  Datenschutz): Seite für alle, Zustimmung beim Gründen eines Vereins. */
export const VEREINBARUNG_PFAD = "/vereinbarung";
export const VEREINBARUNG_TITEL = "Vereinbarung zur Auftragsbearbeitung";

/** Die geltende Fassung der Vereinbarung. Zwilling: `vereinbarung_fassung()`
 *  (Migration vereinbarung_auftragsbearbeitung); `check:kern-db` vergleicht
 *  beide. Eine neue Fassung ändert beide Stellen in einem Zug — die
 *  Verwaltung sieht dann im Bereich «Verein» den Hinweis (AK 4). */
export const VEREINBARUNG_FASSUNG = "2026-11-entwurf";

/* Die Fristen der Datenschutzerklärung (AK 3) stehen nicht hier, sondern
   kommen aus ihren Quellen: AUFBEWAHRUNG_MONATE (lib/feedback/regeln.ts) und
   BENACHRICHTIGUNG_TAGE (lib/benachrichtigung.ts), je mit SQL-Zwilling. */
