import { APP_ABLEGEN_SPEICHER } from "@/lib/app-ablegen";
import { BENACHRICHTIGUNG_COOKIE } from "@/lib/benachrichtigung-gesehen";
import { BEREICH_COOKIE } from "@/lib/bereich";
import { DARSTELLUNG_COOKIE } from "@/lib/darstellung";
import { LEISTE_COOKIE } from "@/lib/seitenleiste";
import { SPALTE_COOKIE } from "@/lib/spalte";
import { VERZEICHNIS_COOKIE } from "@/lib/verzeichnis";
import { GESEHEN_COOKIE } from "@/lib/versionen-gesehen";
import { SERVICE_WORKER_PFAD } from "@/lib/push";

/* Alles, was KiFu im Browser ablegt (#409) — die eine Liste, aus der die
   Seite «Cookies» liest. Wer eine neue Speicherung einführt, trägt sie hier
   ein; die Namen kommen, wo es sie als Konstante gibt, von dort, damit Seite
   und Code nicht auseinanderlaufen. Etwas anderes speichert KiFu nicht:
   keine Werbung, keine Auswertung, nichts für Dritte. */

export interface Speicherung {
  /** Name im Browser; `…` steht für den Teil, der von der Umgebung abhängt. */
  name: string;
  titel: string;
  zweck: string;
  /** Wie lange sie bleibt. */
  dauer: string;
  /** Was ohne sie nicht mehr geht. */
  ohne: string;
}

export const SPEICHERUNGEN: Speicherung[] = [
  {
    // Supabase Auth: `sb-<Projekt>-auth-token`, bei grossen Sitzungen auf
    // mehrere Cookies (`.0`, `.1`) verteilt; beim Registrieren und beim
    // Zurücksetzen des Passworts dazu `…-code-verifier` (PKCE). Die Cookies
    // von @supabase/ssr gelten 400 Tage.
    name: "sb-…-auth-token, sb-…-auth-token-code-verifier",
    titel: "Anmeldung",
    zweck: "Hält dich angemeldet, damit du deine Übungen, Trainings und Teams siehst. Beim Registrieren und beim Zurücksetzen des Passworts sichert ein zweites Cookie den Bestätigungslink ab.",
    dauer: "Bis du dich abmeldest, längstens gut ein Jahr.",
    ohne: "Du kannst dich nicht anmelden und siehst darum keine Übungen und Trainings. Der private Link für Spieler:innen und Eltern funktioniert weiterhin.",
  },
  {
    name: LEISTE_COOKIE,
    titel: "Breite der Seitenleiste",
    zweck: "Merkt sich, ob du die Seitenleiste breit oder schmal gewählt hast.",
    dauer: "Ein Jahr.",
    ohne: "Die Seitenleiste steht bei jedem Besuch wieder breit.",
  },
  {
    name: BEREICH_COOKIE,
    titel: "Gewählter Bereich",
    zweck: "Merkt sich, ob du zuletzt eines deiner Teams oder den Verein gewählt hast, damit die Seitenleiste auf Seiten ohne Bereich (Übungen, Trainings, Konto) wieder dort steht.",
    dauer: "Ein Jahr.",
    ohne: "Die Seitenleiste öffnet jedes Mal den ersten deiner Bereiche.",
  },
  {
    name: SPALTE_COOKIE,
    titel: "Breite der Spalte",
    zweck: "Merkt sich, wie breit du die Spalte neben einer Übung oder einem Training gezogen hast.",
    dauer: "Ein Jahr.",
    ohne: "Die Spalte steht bei jedem Besuch wieder in der üblichen Breite.",
  },
  {
    name: VERZEICHNIS_COOKIE,
    titel: "Breite des Verzeichnisses",
    zweck: "Merkt sich, wie breit du das Verzeichnis neben den Versionen und im Styleguide gezogen hast.",
    dauer: "Ein Jahr.",
    ohne: "Das Verzeichnis steht bei jedem Besuch wieder in der üblichen Breite.",
  },
  {
    name: DARSTELLUNG_COOKIE,
    titel: "Darstellung",
    zweck: "Merkt sich, ob du KiFu hell oder dunkel gewählt hast, auch für die Anmeldeseiten. Solange KiFu wie das Gerät erscheint, wird nichts gespeichert.",
    dauer: "Ein Jahr, oder bis du wieder «Wie das Gerät» wählst.",
    ohne: "KiFu folgt der Einstellung des Geräts.",
  },
  {
    name: GESEHEN_COOKIE,
    titel: "Gesehene Versionen",
    zweck: "Merkt sich, bis zu welcher Version du die Seite «Versionen» gesehen hast, damit die Seitenleiste neue Versionen markiert.",
    dauer: "Ein Jahr.",
    ohne: "Die Seitenleiste markiert keine neuen Versionen.",
  },
  {
    name: BENACHRICHTIGUNG_COOKIE,
    titel: "Gesehene Benachrichtigungen",
    zweck: "Auf der Seite hinter dem privaten Link einer Spieler:in: merkt sich, bis wann dieses Gerät die Benachrichtigungen angezeigt hat, damit nur neue als neu zählen. Je Link ein Eintrag, nur ein Kürzel des Links, nie der Link selbst; gilt nur für die privaten Links.",
    dauer: "Ein Jahr.",
    ohne: "Die Seite kann nicht zeigen, was auf diesem Gerät neu ist.",
  },
  {
    // Kein Cookie, sondern der lokale Speicher des Browsers: Der Server
    // braucht es nie (#650).
    name: APP_ABLEGEN_SPEICHER,
    titel: "Hinweis «als App ablegen»",
    zweck: "Auf der Seite hinter dem privaten Link einer Spieler:in, im lokalen Speicher des Browsers: zählt die Besuche dieses Geräts und merkt sich, wann du den Hinweis «als App ablegen» geschlossen hast. Je Link ein Eintrag, nur ein Kürzel des Links, nie der Link selbst.",
    dauer: "Bis du die Daten der Website im Browser löschst.",
    ohne: "Der Hinweis erscheint nicht; der Knopf unter den Terminen bleibt.",
  },
  {
    // Kein Cookie: ein Service Worker je Link und seine Anmeldung beim
    // Mitteilungsdienst (#483). Nur wer Mitteilungen einschaltet, bekommt sie.
    name: `Service Worker ${SERVICE_WORKER_PFAD} mit Anmeldung beim Mitteilungsdienst`,
    titel: "Mitteilungen aufs Mobile",
    zweck: "Auf der Seite hinter dem privaten Link einer Spieler:in, erst wenn du Mitteilungen einschaltest: ein kleines Programm des Browsers zeigt die Mitteilungen an und öffnet beim Antippen die Benachrichtigungen. Es meldet dieses Gerät beim Mitteilungsdienst des Herstellers an; KiFu bewahrt dessen Adresse zusammen mit dem Link auf. Es speichert keine Seiten und liest nichts mit.",
    dauer: "Bis du die Mitteilungen ausschaltest, das Team den Link erneuert oder du die Daten der Website im Browser löschst.",
    ohne: "Dieses Gerät erhält keine Mitteilungen; Neues siehst du am Link unter «Benachrichtigungen».",
  },
];
