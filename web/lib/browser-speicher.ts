import { LEISTE_COOKIE } from "@/lib/seitenleiste";
import { SPALTE_COOKIE } from "@/lib/spalte";
import { GESEHEN_COOKIE } from "@/lib/versionen-gesehen";

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
    // mehrere Cookies (`.0`, `.1`) verteilt.
    name: "sb-…-auth-token",
    titel: "Anmeldung",
    zweck: "Hält dich angemeldet, damit du deine Übungen, Trainings und Teams siehst.",
    dauer: "Bis du dich abmeldest.",
    ohne: "Du kannst dich nicht anmelden. Übungen und öffentliche Trainings kannst du weiterhin ansehen, durchführen und drucken.",
  },
  {
    name: LEISTE_COOKIE,
    titel: "Breite der Seitenleiste",
    zweck: "Merkt sich, ob du die Seitenleiste breit oder schmal gewählt hast.",
    dauer: "Ein Jahr.",
    ohne: "Die Seitenleiste steht bei jedem Besuch wieder breit.",
  },
  {
    name: SPALTE_COOKIE,
    titel: "Breite der Spalte",
    zweck: "Merkt sich, wie breit du die Spalte neben einer Übung oder einem Training gezogen hast.",
    dauer: "Ein Jahr.",
    ohne: "Die Spalte steht bei jedem Besuch wieder in der üblichen Breite.",
  },
  {
    name: GESEHEN_COOKIE,
    titel: "Gesehene Versionen",
    zweck: "Merkt sich, bis zu welcher Version du die Seite «Versionen» gesehen hast, damit die Seitenleiste neue Versionen markiert.",
    dauer: "Ein Jahr.",
    ohne: "Die Seitenleiste markiert keine neuen Versionen.",
  },
];
