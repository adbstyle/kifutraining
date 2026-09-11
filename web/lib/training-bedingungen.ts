// Die Bedingungen, die ein öffentliches Training erfüllen muss — und ihre
// Übersetzung in Klartext (Story A).
//
// Sie gelten nicht nur beim Öffentlich-Schalten, sondern solange ein Training
// öffentlich ist. Durchgesetzt werden sie in der Datenbank; diese Datei hält
// die Prüfung für die Vorab-Meldung und die Übersetzung des DB-Fehlers, damit
// beide Seiten dieselbe Regel nennen statt zweier Formulierungen davon.

import { JUNIOREN_PFLICHT_BLOECKE } from "@/lib/junioren";
import { FREIES_SPIEL, type Altersstufe } from "@/lib/altersstufe";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/uebung-form";

/** Marker, mit dem die Datenebene eine verletzte Bedingung meldet. */
const BEDINGUNG_MARKER = "TRAINING_UNVOLLSTAENDIG";

/** Die Bedingungen — in der Reihenfolge, in der die Datenebene sie prüft.
 *  Die Alterskategorie gilt in beiden Altersstufen, die beiden folgenden im
 *  Kinderfussball, die letzten vier im Juniorenfussball (Story 7, Story 1).
 *  Der Abschluss ist seit Story #127 keine Bedingung mehr — er trägt nur noch
 *  einen Hinweis. */
export type Bedingung =
  | "stufe"
  | "einleitung"
  | "freies_spiel"
  | "jun-aufwaermen"
  | "jun-spielform-trainingsziel"
  | "jun-explosivitaet"
  | "jun-spielformen";

/** Was fehlt, aus Sicht des Trainers. Ergänzt den Satz «Es fehlt …». */
export const BEDINGUNG_FEHLT: Record<Bedingung, string> = {
  stufe: "mindestens eine Alterskategorie",
  einleitung: "mindestens eine Übung in der Einleitung",
  freies_spiel: "mindestens eine Übung im freien Spiel",
  "jun-aufwaermen": "mindestens eine Übung im Aufwärmen",
  "jun-spielform-trainingsziel":
    "mindestens eine Übung in der Spielform zum Trainingsziel",
  "jun-explosivitaet": "mindestens eine Übung in der Explosivität",
  "jun-spielformen":
    "mindestens eine Übung in den Spielformen und unterstützenden Übungen",
};

function istBedingung(wert: string): wert is Bedingung {
  return wert in BEDINGUNG_FEHLT;
}

/** Die verletzte Bedingung aus einer DB-Fehlermeldung, oder `null` wenn der
 *  Fehler ein anderer war. */
export function bedingungAusFehler(message: string): Bedingung | null {
  if (!message.includes(BEDINGUNG_MARKER)) return null;
  const teil = message.split(`${BEDINGUNG_MARKER}:`).pop()?.trim() ?? "";
  // Der Marker steht am Ende der Meldung, kann aber von Kontextzeilen gefolgt
  // sein — nur das erste Wort ist die Bedingung.
  const wort = teil.split(/\s/)[0] ?? "";
  return istBedingung(wort) ? wort : null;
}

/** Die Meldung für eine Änderung, die ein öffentliches Training unter die
 *  Bedingungen gebracht hätte. Nennt den Weg, nicht nur die Absage (AK 7). */
function bedingungsMeldung(bedingung: Bedingung): string {
  return (
    `Ein öffentliches Training braucht ${BEDINGUNG_FEHLT[bedingung]}. ` +
    "Setze es zuerst auf Entwurf, wenn du es so ändern willst."
  );
}

/** Verletzte ein DB-Fehler eine Bedingung? Dann die Meldung dazu, sonst `null`.
 *  Für jede Action, die ein Training oder seine Fassungen ändert. */
function bedingungsFehler(message: string): string | null {
  const bedingung = bedingungAusFehler(message);
  return bedingung ? bedingungsMeldung(bedingung) : null;
}

/** Marker der Datenebene für den Versuch, die Altersstufe eines bestehenden
 *  Trainings zu ändern (Trigger `trainings_altersstufe_unveraenderlich`). */
const ALTERSSTUFE_FEST = "ALTERSSTUFE_UNVERAENDERLICH";

/** Marker der Datenebene für ein neues Training ohne Alterskategorie
 *  (Trigger `trainings_stufe_pflicht`). */
const STUFE_FEHLT = "STUFE_FEHLT";

/** Die Wertebereichs-CHECKs der Altersstufe (Story 1, Übungswelten) und ihre
 *  Klartext-Erklärung. Postgres meldet sie als
 *  `violates check constraint "<name>"` — die Applikation erkennt sie am
 *  Namen. Ein Nutzer sieht sie nur, wenn er die Oberfläche umgeht oder die
 *  Oberfläche der Regel noch nicht folgt; letzteres räumen die Stories 2 und 3
 *  auf. */
const ALTERSSTUFE_CHECKS: [string, string][] = [
  [
    "ex_kategorien_je_altersstufe",
    "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung.",
  ],
  [
    "te_kategorien_je_altersstufe",
    "Diese Alterskategorie gehört nicht zur Altersstufe dieses Trainings.",
  ],
  [
    "training_stufen_je_altersstufe",
    "Diese Alterskategorie gehört nicht zur Altersstufe dieses Trainings. " +
      "Lege für die andere Altersstufe ein neues Training an.",
  ],
  [
    "trainingsteil_je_altersstufe",
    "Dieser Trainingsteil gehört nicht zur Altersstufe dieser Übung.",
  ],
  [
    "ex_feldtyp_nur_kifu",
    "Der Feldtyp ist eine Angabe des Manuals Fussball Kinder. " +
      "Eine Junioren-Übung trägt stattdessen eine Spielfeldgrösse.",
  ],
  // Die drei Spielfeld-Regeln (Story 3). Sie heissen auf beiden Tabellen
  // gleich, bloss mit dem Präfix `ex_` bzw. `te_` — der Namensrest genügt
  // darum als Erkennungsmerkmal für beide. Die Meldungen sind wortgleich mit
  // denen aus `parseUebungsInhalt`, dem Spiegel derselben Regeln.
  [
    "spielfeld_paarweise",
    "Bitte Länge und Breite angeben oder beides leer lassen.",
  ],
  [
    "spielfeld_bereich",
    `Länge und Breite in ganzen Metern, zwischen ${SPIELFELD_MIN} und ${SPIELFELD_MAX}.`,
  ],
  [
    "spielfeld_nur_junioren",
    "Die Spielfeldgrösse ist eine Angabe des Manuals Fussball Jugendliche. " +
      "Eine Kinderfussball-Übung trägt stattdessen einen Feldtyp.",
  ],
  [
    "ex_uebungstyp_nur_junioren",
    "Der Übungstyp ist eine Angabe des Manuals Fussball Jugendliche und gilt " +
      "im Aufwärmen, in der Spielform zum Trainingsziel, in der Explosivität, " +
      "in den Spielformen und im Spiel. Ordne die Übung in einen dieser Blöcke " +
      "ein oder lass den Übungstyp leer.",
  ],
  [
    "erscheinungsform_je_altersstufe",
    "Diese Erscheinungsform gehört zum Manual der anderen Altersstufe.",
  ],
  [
    "ablauf_je_einordnung",
    "Der Ablauf ist für diese Einordnung nicht in der richtigen Form erfasst. " +
      "Der methodische Fahrplan gilt im Kinderfussball, der Beschreibungstext " +
      "im Juniorenfussball.",
  ],
  [
    "dauer_nicht_auffangen",
    "Eine Übung im Auffangen trägt keine Dauer — das Auffangen zählt nicht " +
      "zur Trainingszeit.",
  ],
];

/** Die Meldungen zu den Altersstufen- und Schema-Regeln (Epic #71,
 *  Epic Übungswelten). Sie nennen wie die Bedingungs-Meldungen den Weg, nicht
 *  nur die Absage. */
function schemaMeldung(message: string): string | null {
  if (message.includes(ALTERSSTUFE_FEST))
    return (
      "Die Altersstufe eines Trainings steht ab dem Anlegen fest. " +
      "Lege für die andere Altersstufe ein neues Training an."
    );
  if (message.includes(STUFE_FEHLT))
    return "Bitte mindestens eine Alterskategorie wählen.";
  for (const [name, klartext] of ALTERSSTUFE_CHECKS)
    if (message.includes(name)) return klartext;
  return null;
}

/** Die Marker, mit denen der Trigger `teg_guard` eine unzulässige
 *  Gruppen-Zuweisung meldet (Story #150), und ihr Klartext. Beide Fälle sieht
 *  ein Trainer nur, wenn er die Oberfläche umgeht — sie bietet Gruppen allein
 *  im Hauptteil an und kennt nur die Gruppen des eigenen Trainings. */
const GRUPPEN_MARKER: [string, string][] = [
  ["GRUPPE_NUR_HAUPTTEIL", "Gruppen lassen sich nur im Hauptteil verteilen."],
  ["GRUPPE_FREMDES_TRAINING", "Diese Gruppe gehört zu einem anderen Training."],
];

/** Die Meldung zu einer abgewiesenen Gruppen-Zuweisung, sonst `null`. */
function gruppenMeldung(message: string): string | null {
  for (const [marker, klartext] of GRUPPEN_MARKER)
    if (message.includes(marker)) return klartext;
  return null;
}

/** Die Marker der Varianten-Datenebene (#201) und ihr Klartext.
 *
 *  - `VARIANTE_FREMDES_TRAINING` (Trigger `te_variante_ausrichten`, RPC
 *    `lege_variante_an`): eine Fassung soll in die Variante eines anderen
 *    Trainings. Über die Oberfläche unerreichbar — ausser ein Kopierpfad
 *    vergässe, `variante_id` auf die Kopie umzuschreiben; genau dafür ist der
 *    Marker da, statt still die Quell-ID zu übernehmen.
 *  - `LETZTE_VARIANTE` (Constraint-Trigger `tv_letzte_bleibt`, RPC
 *    `entferne_variante`): ein Training führt jederzeit mindestens einen
 *    Hauptteil (Epic EK 6). Der Knopf ist dann abgeschaltet; die Meldung
 *    trifft, wer eine veraltete Ansicht offen hält.
 *  - `VARIANTE_KOPIE_UNVOLLSTAENDIG` (RPC `lege_variante_an`): die Anwendung
 *    hat weniger Fassungen angemeldet, als die Quelle führt — etwa weil jemand
 *    parallel eine Übung ergänzt hat. Lieber keine Variante als eine, der
 *    Übungen fehlen. */
const VARIANTEN_MARKER: [string, string][] = [
  ["VARIANTE_FREMDES_TRAINING", "Diese Variante gehört zu einem anderen Training."],
  ["LETZTE_VARIANTE", "Die letzte Variante des Hauptteils lässt sich nicht entfernen."],
  [
    "VARIANTE_KOPIE_UNVOLLSTAENDIG",
    "Die Variante liess sich nicht vollständig kopieren. " +
      "Lade das Training neu und versuche es noch einmal.",
  ],
];

/** Die Meldung zu einer abgewiesenen Varianten-Änderung, sonst `null`. */
function variantenMeldung(message: string): string | null {
  for (const [marker, klartext] of VARIANTEN_MARKER)
    if (message.includes(marker)) return klartext;
  return null;
}

/** Der Marker, mit dem Postgres eine von der RLS abgewiesene Änderung meldet
 *  («new row violates row-level security policy for table …»). */
const RLS_VERLETZUNG = "row-level security";

/** Die letzte Auskunft, wenn keine Regel den Fehler erklärt. Ein roher
 *  Postgres-Text ist an der Oberfläche keine Meldung: Er nennt Tabellen und
 *  Constraints statt eines Wegs, und der USER kann mit ihm nichts anfangen. */
const ALLGEMEIN = "Das liess sich nicht speichern. Bitte versuche es noch einmal.";

/** Die Meldung zu einer von der RLS abgewiesenen Änderung, sonst `null`. Sie
 *  trifft, wer an einem fremden Training arbeitet — etwa weil er das Team
 *  inzwischen verlassen hat oder eine veraltete Ansicht offen hält. */
function berechtigungsMeldung(message: string): string | null {
  return message.includes(RLS_VERLETZUNG)
    ? "Keine Berechtigung für diese Änderung."
    : null;
}

/** Die Meldung zu einem DB-Fehler: die Erklärung, wenn eine Regel greift,
 *  sonst eine allgemeine Auskunft. Für jede Action, deren DB-Fehler an der
 *  Oberfläche landet — der Originaltext tut das NIE.
 *
 *  Die Übersetzung steht bewusst an einem Ort: Jede Action, die den rohen
 *  `error.message` durchreichte, war eine Stelle, an der ein Constraint-Name
 *  vor dem Trainer landen konnte.
 *
 *  Verschwinden darf der Originaltext deswegen nicht (Issue #41): Greift keine
 *  fachliche Regel, ist der Fehler unerwartet — dann gehört er ins Protokoll,
 *  sonst bliebe er unsichtbar. Der Aufruf steht immer serverseitig (Server
 *  Actions), die Zeile landet also in den Runtime-Logs und nie beim Trainer.
 *  Eine von der RLS abgewiesene Änderung wird mitprotokolliert: Sie hat zwar
 *  eine Meldung, ist aber kein erwarteter Verlauf. Was ein Marker oder ein
 *  Constraint fachlich erklärt, ist erwartet und bleibt ungeloggt. */
export function fehlerMeldung(message: string): string {
  const fachlich =
    bedingungsFehler(message) ??
    schemaMeldung(message) ??
    gruppenMeldung(message) ??
    variantenMeldung(message);
  if (fachlich) return fachlich;
  console.error(`[db] ${message}`);
  return berechtigungsMeldung(message) ?? ALLGEMEIN;
}

/** Welche Veröffentlichungs-Bedingungen erfüllt ein Training noch nicht?
 *  Die Regel hängt an seiner Altersstufe (Story 7 AC 1/2/4) und spiegelt die
 *  DB-Funktion `training_fehlende_bedingungen`, die als Trust-Boundary
 *  dasselbe prüft.
 *
 *  Synchron und bewusst hier statt bei den Server Actions: der Editor rechnet
 *  sie live aus seinem lokalen Stand, und ein "use server"-Modul darf nur
 *  async-Funktionen exportieren.
 *
 *  Mindestens eine Alterskategorie gilt in beiden Altersstufen: Seit die
 *  Altersstufe eine eigene Angabe ist, folgt sie nicht mehr aus den
 *  Kategorien — ein Junioren-Training ohne Kategorie ist damit möglich und
 *  soll nicht veröffentlichbar sein (Story 1, Übungswelten). */
export function fehlendeBedingungenAus(
  altersstufe: Altersstufe,
  stufen: readonly string[],
  fassungen: readonly { trainingsteil: string; hauptteilkategorie?: string | null }[],
): Bedingung[] {
  const missing: Bedingung[] = [];
  if (stufen.length === 0) missing.push("stufe");
  if (altersstufe === "kinderfussball") {
    if (!fassungen.some((f) => f.trainingsteil === "einleitung")) missing.push("einleitung");
    if (!fassungen.some((f) => f.hauptteilkategorie === FREIES_SPIEL))
      missing.push("freies_spiel");
  } else {
    for (const block of JUNIOREN_PFLICHT_BLOECKE) {
      if (!fassungen.some((f) => f.trainingsteil === block)) missing.push(block);
    }
  }
  return missing;
}
