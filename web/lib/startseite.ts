/* Die festen Angaben der Startseite (#670). REIN: keine Server-Importe —
   `check:kern` lädt die Datei und prüft die Angaben gegen den Bestand.

   Die Aussagen der Startseite werden nicht bei jedem Release geprüft, sondern
   bei Bedarf nachgeführt (Epic #668 OoS 8); die Zahl der Manual-Übungen ist
   fester Text (#670 OoS 1). Der Wächter in scripts/pruefe-kern.ts hält sie am
   Bestand unter data/uebungen. */

import type { AdressParameter } from "@/lib/adresse";
import { UEBUNGEN_PFAD } from "@/lib/navigation";
import { NUR_MIT_KONTO_PARAMETER, abfrageAus, sichererRuecksprung } from "@/lib/weiterleitung";

/** Die Parameter, die der Übungskatalog liest (#674). Eine Adresse «/?…» mit
 *  einem davon war ein geteilter Katalog und führt dorthin. Der Hinweis nach
 *  «Konto löschen» (`account_deleted`) ist kein Filter und bleibt auf «/». */
export const KATALOG_PARAMETER = ["teil", "kat", "feld", "form", "typ", "kinder", "q", "fav", "mine", "anzahl", "deleted", "hkat"] as const;

/** Wohin eine Adresse «/?…» mit Katalog-Filtern führt: zum Katalog, samt
 *  aller Parameter in derselben Reihenfolge. Ohne Filter `null` (die
 *  Startseite gilt). */
export function katalogWeiterleitung(sp: AdressParameter): string | null {
  if (!KATALOG_PARAMETER.some((k) => sp[k] !== undefined)) return null;
  return `${UEBUNGEN_PFAD}${abfrageAus(sp)}`;
}

/** Kam die Besucher:in über einen Verweis auf eine Übung, ein Training oder
 *  den Katalog, den es nur mit Konto gibt (#669 PC 1)? Dann das sichere Ziel
 *  dieses Verweises — für den Hinweis «nur mit Konto» und die Anmeldung, die
 *  dorthin zurückführt (PC 2). Sonst `null`. */
export function nurMitKontoZiel(sp: AdressParameter): string | null {
  if (sp[NUR_MIT_KONTO_PARAMETER] === undefined) return null;
  const roh = Array.isArray(sp.redirect) ? sp.redirect[0] : sp.redirect;
  return sichererRuecksprung(roh, UEBUNGEN_PFAD);
}

/** Der Text des Hinweises (#669 AK 2). */
export const NUR_MIT_KONTO_TEXT =
  "Dieser Inhalt ist nur mit Konto sichtbar. Melde dich an oder erstelle kostenlos ein Konto, um Übungen und Trainings der Community zu sehen.";

/** Wie viele Übungen aus dem Manual Kinderfussball KiFu mitbringt (AK 4).
 *  Zwilling: die Dateien unter data/uebungen/*.yaml. */
export const MANUAL_UEBUNGEN_ANZAHL = 75;

/** Die fest ausgewählten Beispiele (AK 4, Entscheid 2; acht wie im
 *  Gestaltungsentwurf): je zwei aus Auffangen und Einleitung, drei aus dem
 *  Hauptteil, eine aus dem Ausklang — alle aus dem Manual und mit
 *  Feld-Diagramm (data/diagramme/<slug>.json). Die Reihenfolge ist die der
 *  Anzeige, nach Teil des Trainings. Zwilling: die fest eingebaute Liste in
 *  `startseite_beispiele()` (Migration `nur_mit_konto`, #669) — ohne Konto
 *  ist sonst keine Übung lesbar; der Wächter vergleicht beide Listen. */
export const STARTSEITE_BEISPIELE = [
  "freies-kleinfeldspiel",
  "fangis",
  "autorennen",
  "dribbler",
  "dribbling-1-1-frontal-auf-ein-tor",
  "passen-und-ballkontrolle-tigerball-durch-das-tor",
  "torabschluss-zielschuss",
  "penalty-koenig-in",
] as const;

/** Der SFV erscheint auf der Startseite nur mit diesem Hinweis (AK 5,
 *  Epic #668 EK 12) — die Seite nennt ihn nirgends sonst. */
export const SFV_HINWEIS =
  "Eigene Fassungen nach dem Manual Kinderfussball des SFV, nicht vom SFV geprüft.";

/** Der geplante Preis (AK 7): heute gratis, nach Einführung des Preismodells
 *  pro Team und Monat; ein Konto ohne Verein bleibt gratis. Durchgesetzt wird
 *  nichts (Epic #668 OoS 2). */
export const GEPLANTER_PREIS_CHF = 5;

/** Das Repository (Open Source, AK 9). */
export const REPO_URL = "https://github.com/adbstyle/kifutraining";

/** Die Bestätigung nach «Konto löschen» (#670 PC 2): Die Action leitet mit
 *  `?account_deleted=1` auf die Startseite. */
export const KONTO_GELOESCHT_PARAMETER = "account_deleted";
export const KONTO_GELOESCHT_TEXT = "Konto gelöscht. Deine Übungen und Trainings in der Community bleiben anonym erhalten.";

/** Die Namen in den Bildern der Startseite (AK 14): alle erfunden, wie im
 *  Gestaltungsentwurf (dort «FC Seefeld», hier «FC Seewil»: einen FC Seefeld
 *  gibt es in Zürich). */
export const BEISPIEL_NAMEN = {
  verein: "FC Seewil",
  gegner: ["SC Bergtal", "FC Talwil"],
  heimfeld: "Sportplatz Moos",
  auswaerts: "Sportanlage Talwil",
  spieler: ["Lena Meier", "Noah Keller", "Mia Suter", "Ole Brunner", "Ava Brunner", "Elias Frei", "Leo Weber"],
} as const;
