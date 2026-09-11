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
import { sichtbareZuordnungen } from "@/lib/varianten";

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

/** Was fehlt, aus Sicht des Trainers. Ergänzt den Satz «Es fehlt …».
 *  Nur modulintern: Nach aussen geht der Text durch `bedingungText()`, weil er
 *  seit #204 die Variante nennen kann. */
const BEDINGUNG_FEHLT: Record<Bedingung, string> = {
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

/** Die Variante aus einer DB-Fehlermeldung, oder `null` wenn die verletzte
 *  Bedingung keine Variante betrifft (#204).
 *
 *  Die Datenebene schreibt `'<bedingung> VARIANTE <uuid>'` — die Bedingung
 *  bleibt das erste Wort, die Variante steht als eigenes Wortpaar dahinter.
 *  Hier interessiert nur die ID; der Name dazu liegt allein in der Oberfläche,
 *  die das Training kennt.
 *
 *  SQL-Zwilling: `training_fehlende_bedingungen()`. */
export function varianteAusFehler(message: string): string | null {
  if (!message.includes(BEDINGUNG_MARKER)) return null;
  const teil = message.split(`${BEDINGUNG_MARKER}:`).pop()?.trim() ?? "";
  const [, marker, id] = teil.split(/\s+/);
  return marker === "VARIANTE" && id ? id : null;
}

/** Was fehlt, aus Sicht des Trainers — mit der Variante, wenn es eine zu
 *  nennen gibt (#204 AK 2). Ergänzt den Satz «Es fehlt …».
 *
 *  Ob der Name mitkommt, entscheidet der Aufrufer: Bei genau einer Variante ist
 *  sie kein Gesprächsgegenstand (#201 PC 5) — dann übergibt er keinen Namen. */
export function bedingungText(bedingung: Bedingung, varianteName?: string): string {
  const fehlt = BEDINGUNG_FEHLT[bedingung];
  return varianteName ? `${fehlt} in der Variante „${varianteName}"` : fehlt;
}

/** Die Meldung für eine Änderung, die ein öffentliches Training unter die
 *  Bedingungen gebracht hätte. Nennt den Weg, nicht nur die Absage (AK 7).
 *
 *  Betrifft die Bedingung eine Variante, bleibt die Meldung bewusst allgemein
 *  («in jeder Variante») statt die eine zu nennen: Diese Übersetzung steht
 *  jeder Action zur Verfügung, die einen rohen DB-Fehler bekommt — auch denen,
 *  die nur die Fehlermeldung kennen und nicht das Training mit seinen
 *  Variantennamen. Wer den Kontext hat (`veroeffentlicheTraining`), liefert
 *  stattdessen `FehlendeBedingung[]` und die Oberfläche nennt Variante und
 *  Block. */
function bedingungsMeldung(bedingung: Bedingung, jeVariante: boolean): string {
  const was = jeVariante
    ? `in jeder Variante ${BEDINGUNG_FEHLT[bedingung]}`
    : BEDINGUNG_FEHLT[bedingung];
  return satzUm(was);
}

/** Dieselbe Meldung für den Aufrufer, der das Training kennt und die Variante
 *  darum benennen kann (#204 AK 3): «Ein öffentliches Training braucht
 *  mindestens eine Übung im freien Spiel in der Variante „21 Kinder". Setze es
 *  zuerst auf Entwurf, wenn du es so ändern willst.»
 *
 *  Ohne `varianteName` ist sie wortgleich mit der allgemeinen Fassung — der
 *  Editor übergibt ihn nur, wenn das Training mehr als eine Variante führt
 *  (Epic EK 7). */
export function bedingungsMeldungFuer(
  bedingung: Bedingung,
  varianteName?: string,
): string {
  return satzUm(bedingungText(bedingung, varianteName));
}

/** Der gemeinsame Satzbau beider Meldungen — er steht einmal, damit die beiden
 *  Wege nicht in zwei Formulierungen desselben auseinanderlaufen. */
function satzUm(was: string): string {
  return (
    `Ein öffentliches Training braucht ${was}. ` +
    "Setze es zuerst auf Entwurf, wenn du es so ändern willst."
  );
}

/** Verletzte ein DB-Fehler eine Bedingung? Dann die Meldung dazu, sonst `null`.
 *  Für jede Action, die ein Training oder seine Fassungen ändert.
 *
 *  Bewusste Asymmetrie (#204): Die Datenebene nennt nur die ERSTE verletzte
 *  Variante (`v_missing[1]` in `training_pruefe_oeffentlich`) — ein `raise`
 *  trägt genau eine Aussage. Die Live-Vorschau im Editor zeigt dagegen alle
 *  verletzten Varianten, weil sie den ganzen Stand vor sich hat. */
function bedingungsFehler(message: string): string | null {
  const bedingung = bedingungAusFehler(message);
  if (!bedingung) return null;
  return bedingungsMeldung(bedingung, varianteAusFehler(message) !== null);
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

/** Eine noch nicht erfüllte Bedingung — mit der Variante, wenn sie eine
 *  Variante betrifft (#204). Trainingsweite Bedingungen tragen `null`.
 *
 *  Die Trennung steht im Typ, nicht in einer Konvention: Die Hauptteil-Bedingung
 *  kann mehrfach auftreten (einmal je Variante), die anderen genau einmal. */
export type FehlendeBedingung = { bedingung: Bedingung; varianteId: string | null };

/** Die Hauptteil-Bedingung je Altersstufe — die einzige, die je Variante gilt
 *  (#204 AK 1). Im Kinderfussball liegt das freie Spiel im Hauptteil, im
 *  Juniorenfussball sind es die Spielformen; beide Einordnungen tragen
 *  Varianten (`istHauptteil()`).
 *
 *  SQL-Zwilling: die Varianten-Schleife in `training_fehlende_bedingungen()`. */
const HAUPTTEIL_BEDINGUNG: Record<Altersstufe, Bedingung> = {
  kinderfussball: "freies_spiel",
  juniorenfussball: "jun-spielformen",
};

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
 *  soll nicht veröffentlichbar sein (Story 1, Übungswelten).
 *
 *  Die Hauptteil-Bedingung wird je Variante geprüft (#204 AK 1): Wer eine
 *  Alternative übernimmt, soll keinen Hauptteil bekommen, dem der Pflichtblock
 *  fehlt. `fassungen` sind darum ALLE Fassungen des Trainings, nicht nur die der
 *  angezeigten Variante — welche zu welcher Variante gehören, entscheidet
 *  `sichtbareZuordnungen`, dieselbe Regel wie in der Anzeige.
 *
 *  Reihenfolge wie in SQL: erst die trainingsweiten Bedingungen, dann die
 *  Varianten in Anzeigereihenfolge. Der DB-Fehler nennt den ersten Eintrag —
 *  es soll derselbe sein, den die Vorschau oben zeigt.
 *
 *  Genannt wird die Variante erst ab der zweiten: Führt das Training nur eine,
 *  verhält es sich überall wie vor diesem Epic (Epic EK 7). */
export function fehlendeBedingungenAus(
  altersstufe: Altersstufe,
  stufen: readonly string[],
  fassungen: readonly {
    trainingsteil: string;
    hauptteilkategorie?: string | null;
    varianteId: string | null;
  }[],
  varianten: readonly { id: string }[],
): FehlendeBedingung[] {
  const missing: FehlendeBedingung[] = [];
  if (stufen.length === 0) missing.push({ bedingung: "stufe", varianteId: null });
  if (altersstufe === "kinderfussball") {
    if (!fassungen.some((f) => f.trainingsteil === "einleitung"))
      missing.push({ bedingung: "einleitung", varianteId: null });
  } else {
    // Die Spielformen stehen nicht in dieser Schleife: Sie liegen im Hauptteil
    // und werden unten je Variante geprüft.
    for (const block of JUNIOREN_PFLICHT_BLOECKE) {
      if (block === "jun-spielformen") continue;
      if (!fassungen.some((f) => f.trainingsteil === block))
        missing.push({ bedingung: block, varianteId: null });
    }
  }

  const hauptteil = HAUPTTEIL_BEDINGUNG[altersstufe];
  const erfuellt = (f: { trainingsteil: string; hauptteilkategorie?: string | null }) =>
    altersstufe === "kinderfussball"
      ? f.hauptteilkategorie === FREIES_SPIEL
      : f.trainingsteil === "jun-spielformen";

  // Ohne Variante bliebe die Hauptteil-Bedingung ungeprüft — nach Lage der
  // Daten unmöglich (jedes Training führt mindestens eine, Epic EK 6), aber ein
  // leerer Embed darf nicht zu «alles erfüllt» führen. Dann wird einmal über
  // alle Fassungen geprüft, ohne Variante zu nennen.
  if (varianten.length === 0) {
    if (!fassungen.some(erfuellt)) missing.push({ bedingung: hauptteil, varianteId: null });
    return missing;
  }

  // Bei genau EINER Variante bleibt `varianteId` leer: Ihre Bezeichnung hat der
  // Trainer nie vergeben und sieht sie nirgends (#201 PC 5 / Epic EK 7) — sie in
  // der Meldung zu nennen, erfände einen Gegenstand. Zwilling: die
  // `v_variantenzahl`-Schranke in `training_fehlende_bedingungen()`.
  const nennen = varianten.length > 1;
  for (const v of varianten) {
    if (!sichtbareZuordnungen(fassungen, v.id).some(erfuellt))
      missing.push({ bedingung: hauptteil, varianteId: nennen ? v.id : null });
  }
  return missing;
}
