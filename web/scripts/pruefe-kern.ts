// Prüft die reinen Teile des Fachkerns (Epic #190, ab Story #192): die
// Zielblock-Regel in web/lib/altersstufe.ts, die Übersetzung von
// Datenbankfehlern (web/lib/training-bedingungen.ts, web/lib/kern/ergebnis.ts),
// die Regeln des Übungsinhalts (web/lib/kern/uebung-inhalt.ts, Epic #139)
// und zwei statische Wächter über web/lib/kern und den Werkzeugsatz. Ohne DB
// und ohne Netz; läuft im PR-Check nach `check:ki-zugang`.
//
// Der Wert dieser Prüfung liegt an fünf Stellen:
//
// - «Hauptteil ohne Kategorie» ist über die Oberfläche nicht auslösbar, über
//   den KI-Client aber der Normalfall eines Fehlversuchs (Spike #191). Die
//   Meldung muss genau diesen Mangel und die zulässigen Werte nennen
//   (#192 NFR 4) — wer die Reihenfolge der Prüfungen in `zielblock`
//   vertauscht, meldet wieder «gehört nicht zum Trainingsschema».
// - `fachlicheMeldung` trennt eine verletzte Regel (`art: "regel"`) von einem
//   unerwarteten Fehler (`art: "technisch"`); `fehlerMeldung` muss dabei
//   wortgleich bleiben, sonst ändern sich Texte der Oberfläche.
// - Der Kern darf nie `"use server"` tragen: Jede Kern-Funktion nimmt die
//   userId als Parameter — als Server Action wäre sie ein öffentlicher
//   Endpunkt, bei dem der Aufrufer sie selbst angibt. Und er hängt an keinem
//   Adapter: nichts aus `next/`, `@/lib/mcp/`, `@/lib/actions/` oder dem
//   Cookie-Client — auch nicht über eine Datei, die er importiert. Redirect,
//   Cookies und Revalidieren sind Sache der Adapter.
// - Jedes Werkzeug im Werkzeugsatz hat einen eindeutigen snake_case-Namen, und
//   kein Werkzeug liegt unregistriert herum.
// - Eine Übung über den KI-Weg (#143) prüft dieselbe Regelquelle wie das
//   Formular (`parseUebungsInhalt`). Die Übersetzung darf nichts verlieren:
//   Jede Pflicht, jeder Wert, den das Formular still verwürfe, und jede
//   unförmige Zahl erscheint als eigener Verstoss mit dem Feld des Werkzeugs.
//   Für das Feld-Diagramm (#145) gilt dasselbe: Übungsmaske und KI-Weg
//   prüfen über lib/diagramm-pruefung.ts, nicht über einen zweiten Weg.
//
//   npx tsx scripts/pruefe-kern.ts
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import ts from "typescript";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { erscheinungsform_juniorenSlugs, erscheinungsformSlugs, hauptteilkategorieSlugs } from "../lib/vocab";
import {
  ALTERSSTUFEN,
  einordnungsSlugsFuer,
  kategorienFuer,
  traegtHauptteilkategorie,
  zielblock,
  type Altersstufe,
} from "../lib/altersstufe";
import {
  abgelehnt,
  geaenderteSpalten,
  inhaltAusZeile,
  pflichtangaben,
  pruefeUebungsInhalt,
  ueberlagere,
  type Fund,
  type Pruefung,
  type UebungInhalt,
  type UebungPatch,
  type UebungsZeile,
} from "../lib/kern/uebung-inhalt";
import {
  UEBUNGSFOLGE_MELDUNG,
  VARIANTENFOLGE_MELDUNG,
  fachlicheMeldung,
  fehlerMeldung,
} from "../lib/training-bedingungen";
import {
  FREMDE_UEBUNG,
  FREMDES_TRAINING,
  MELDUNG_WIEDERHOLEN,
  NICHT_GEFUNDEN,
  ausDbFehler,
} from "../lib/kern/ergebnis";
import { KEINE_PASSENDE_UEBUNG, LEER_HINWEIS, leerBestandText, zielLabel } from "../lib/training";
import { trainingAuskunft as auskunftRoh } from "../lib/kern/auskunft";
import { TrainingAuskunftStreng } from "../lib/kern/auskunft-schema";
import { zeitAbgleich } from "../lib/junioren";
import { verteilungAus } from "../lib/gruppen";
import {
  TERMIN_MELDUNG,
  KONFLIKT_MARKER,
  ausfallProblem,
  LINK_KANAL,
  TERMIN_TEXT,
  AUSFALL_ZURUECKNEHMEN_TEXT,
  ZUORDNEN_ERFOLG,
  geaenderteFelder,
  KARTENLINK_MAX,
  kartenlinkOhneOrt,
  kartenlinkProblem,
  kopieGebliebenText,
  leerZuNull,
  spielerzahlProblem,
  spielerzahlText,
  terminProblem,
  treffpunktNachBeginnText,
  treffpunktPasst,
  treffpunktProblem,
  treffpunktVorlauf,
  treffpunktZeit,
  zahlOderNull,
  zeitText,
} from "../lib/termin";
import {
  SERIE_MELDUNG,
  SERIE_TEXT,
  alsKiWochentag,
  alsWochentag,
  erlaubteReichweiten,
  maxEnddatum,
  obergrenzeVorab,
  regelAenderung,
  regelProblemVorab,
  serieProblem,
  serienTage,
  vergangeneBestaetigen,
  wochentagVon,
  wochentageText,
  type Wochentag,
} from "../lib/serie";
import {
  FELDER_TEXT,
  UNTERGRUENDE,
  feldText,
  feldName,
  felderKurz,
  felderPfad,
  felderProblem,
  gleicheFelder,
  normalisiereFelder,
  toreText,
  type Feld,
} from "../lib/termin-felder";
import { FELDER_MODELL, FelderEingabe, SPIELERZAHL_MODELL, SpielerzahlEingabe, felderAusgabe, felderSchema, spielerzahlSchema } from "../lib/termin-felder-ausgabe";
import { MASS_TEXT } from "../lib/feldmass";
import { ZEITRAUM_TEXT, kalenderblatt, monatVon, monatsName, monatsRaster, plusMonate, tagOhneJahr, tagText, zeitraumProblem } from "../lib/monat";
import { nachMonatUndTag } from "../lib/plan-gliederung";
import { eingrenzungAus, planHref, terminHref } from "../lib/team-ansicht";
import { BESETZUNG_TEXT, besetzungProblem, besetzungText, fehlenText, noetigeTrainer, verhaeltnisHinweis } from "../lib/besetzung";
import {
  TRAINER_MELDUNG,
  TRAINER_TEXT,
  absageOffen,
  mitAbsagen,
  dabeiZahl,
  hatAbgesagt,
  istDabei,
  uebernehmenKoennen,
  trainerLuecke,
  imFilter,
  nachTrainerName,
  ohneVerantwortliche,
  trainerAenderung,
  trainerStart,
  trainerVorwahl,
  trainerZahlSatz,
  type TerminTrainer,
} from "../lib/trainer";
import { aboDatei, aboPfad, aboUrl, aboTokenAus, falten, kalenderText, textEscape, type AboTermin } from "../lib/ical";
import { ABO_KALENDER_NAME, aboEintrag, aboStatus, spielerAboUrl, type AboFeedTermin } from "../lib/spieler-abo";
import { istVeraltet } from "../lib/veraltet";
import {
  BENACHRICHTIGEN_HINWEIS,
  BENACHRICHTIGEN_MODELL,
  BENACHRICHTIGEN_WERKZEUG,
  ausfallEndet,
  benachrichtigungZaehlt,
  istVerlegung,
  mitteilbarEinzeln,
  mitteilbarSerie,
  BENACHRICHTIGEN_TEXT,
  BENACHRICHTIGEN_MOBILE,
  benachrichtigenHinweis,
  BENACHRICHTIGUNG_TAGE,
  ELTERN_TEXT,
  EREIGNIS_NEGATIV,
  eintragNegativ,
  eintragWort,
  zumTermin,
  EREIGNIS_WORT,
  eintragTitel,
  eintragWann,
  eintragWo,
  eintragZusaetze,
  erhaltenText,
  gruppiere,
  wegfallText,
  knopfLabel,
  neuZahl,
  type BenachrichtigungEreignis,
  type LinkBenachrichtigung,
} from "../lib/benachrichtigung";
import {
  BENACHRICHTIGUNG_COOKIE,
  BENACHRICHTIGUNG_MAX_LINKS,
  benachrichtigungCookie,
  leseGesehenStand,
  mitGesehen,
  wertAusCookieString,
} from "../lib/benachrichtigung-gesehen";
import { SPEICHERUNGEN } from "../lib/browser-speicher";
import {
  MITTEILUNGEN_SPALTE,
  MITTEILUNGEN_TEXT,
  MITTEILUNG_TEXT_MAX,
  PUSH_ENDPUNKT,
  PUSH_MAX_GERAETE,
  PUSH_MAX_VERSUCHE,
  PUSH_TIMEOUT_MS,
  PUSH_TTL_SEKUNDEN,
  PUSH_ZEITLIMIT_MS,
  SERVICE_WORKER_PFAD,
  gleicherSchluessel,
  istPushAbo,
  istPushEndpunkt,
  mitteilungInhalt,
  pushBereich,
  pushErgebnis,
  schluesselBytes,
} from "../lib/push";
import { MITTEILUNG_ERSATZ, SERVICE_WORKER_QUELLE } from "../lib/push-service-worker";
import {
  APP_ABLEGEN_MAX_LINKS,
  APP_ABLEGEN_MITTEILUNGEN,
  APP_ABLEGEN_SPEICHER,
  APP_ABLEGEN_TEXT,
  APP_ICONS,
  BESUCH_ABSTAND_MS,
  HINWEIS_PAUSE_MS,
  KONTO_APP_METADATA,
  KONTO_MANIFEST_PFAD,
  THEME_FARBEN,
  ablageFuer,
  appName,
  erkenneGeraet,
  genitiv,
  kontoManifest,
  liesAblage,
  linkManifest,
  mitBesuch,
  mitGeschlossen,
  zeigeHinweis,
} from "../lib/app-ablegen";
import type { TrainingDetail, TrainingExerciseItem } from "../lib/queries/trainings-fuer";
import { nochNichtVorbereitet } from "../lib/queries/termine-fuer";
import { blattStand, handlungsMeldung, meldeStatus, nachMeldefrist, spielStatus, terminStatus } from "../lib/termin-status";
import { meldefristVerpasst } from "../lib/spiel";
import {
  SPIELER_MAX,
  SPIELER_MELDUNG,
  SPIELER_TEXT,
  ABHOLUNG_TEXT,
  angabenSehenText,
  HERAUSNEHMEN_TEXT,
  aufzaehlung,
  bereinigeName,
  herausnehmenFrage,
  herausnehmenSaetze,
  herausnehmenTitel,
  imTeam,
  jahrgangAus,
  LINK_TEXT,
  linkErneuernSaetze,
  LINK_ERNEUERN_MITTEILUNGEN,
  linkTeamsText,
  nachTeamname,
  nachSpielerName,
  spielerDoppeltText,
  spielerProblem,
  spielerzahlKurz,
  spielerzahlLang,
  verbleibendeTeams,
  spielerzahlVon,
  istAnwesend,
  teilnahmeStatus,
  statusNachSchalter,
  TEILNAHME_TEXT,
  verfallDialogText,
  mitAnmeldungen,
  ABMELDUNG_TEXT,
  LINK_GILT_NICHT_TITEL,
  LINK_KEINE_TERMINE_TITEL,
  abholErhaltText,
  abholSpeichertText,
  ABHOL_MITTEILUNGEN,
  feedbackDringend,
  linkGiltNichtText,
  linkKeineTermineText,
  linkKopfTitel,
  linkOhneTeamEltern,
  EHEMALIGE_SPIELERIN,
  abweisungText,
  nachTeilnehmer,
  LINK_PFAD,
  istLinkToken,
  spielerLinkUrl,
  verfallText,
  verfallBestaetigen,
  verfallenHinweis,
  ABHOL_PFAD,
  abholUrl,
  LINK_STAENDE,
  LINK_STAND_TEXT,
  linkKnopfText,
  linkStandAus,
  TEAM_SPIELER_FILTER,
  teamSpielerAnzahlText,
  zaehleLinkStaende,
  LINK_UEBERSICHT,
  type LinkStand,
} from "../lib/spieler";
import {
  BEZEICHNUNG_MAX,
  SPIEL_CHECKS,
  SPIEL_MELDUNG,
  SPIEL_TEXT,
  bezeichnungProblem,
  richtwertProblem,
  richtwertStufe,
  richtwertStufeText,
  richtwertText,
  fristAbgelaufen,
  fristWirdAbgelaufen,
  meldefristProblem,
  meldefristVorlauf,
  meldefristZeitpunkt,
  meldungAbweisungText,
  MELDUNG_TEXT,
  spielEntfernenText,
  spielVerfallText,
  AUFGEBOT_TEXT,
  NACHTRAG_TEXT,
  zaehlteBeimAnpfiff,
  TREFFPUNKT_TEXT,
  treffpunktAnzeige,
  treffpunkteNormal,
  treffpunkteZu,
} from "../lib/spiel";
import {
  KADER_MELDUNG,
  KADER_NAME_MAX,
  KADER_TEXT,
  VERFALL_MARKER,
  giltFuerAnzahl,
  giltFuerText,
  nachTerminKader,
  uebrigeText,
  kaderNameProblem,
  kaderVerfallBestaetigen,
  kaderVerfallGeaendert,
  kaderVerfallText,
  kaderVon,
  nachKaderName,
  verfallAusFehler,
  verfallAnmeldungenAusFehler,
  verfallKennzeichnungenAusFehler,
  verfallSpieleAusFehler,
  zugehoerigkeit,
} from "../lib/kader";
import {
  IMPORT_TEXT,
  dekodiere,
  erkenneSpalten,
  IMPORT_BYTES_MAX,
  IMPORT_ZEILEN_MAX,
  ausgangAus,
  erwartetVon,
  importErgebnisText,
  importErwartetForm,
  importJsPlakette,
  importMehrfachText,
  importNeuText,
  importNichtsZuTunText,
  importUebernehmbar,
  importUeberGrenzeText,
  importZeilen,
  importZeilenForm,
  importZeilenStimmen,
  jahrgangAusDatum,
  jsAus,
  leseDatei,
  vorschauAus,
  type ImportVorschau,
} from "../lib/spieler-import";
import { seitWann, terminBegonnen } from "../lib/zeit";
import {
  PROBE_MELDUNG,
  PROBE_TEXT,
  PROBE_VERFALL_MARKER,
  linkProbeKopf,
  linkProbeVoll,
  linkProbeZaehler,
  probeAnzahlProblem,
  probeAusschaltenText,
  probeEinschaltenText,
  probeFolgenAusFehler,
  probeInfoBereinigt,
  probeInfoLaenge,
  probeInfoProblem,
  PROBE_INFO_MAX,
  probeKurz,
  probeLang,
  probeVerfallBestaetigen,
  probeVerfallText,
  probeVerfallTitel,
  ueberAnzahl,
  ueberAnzahlText,
} from "../lib/probe";
import {
  PERSON_MELDUNG,
  TEAM_NUR_VERWALTUNG,
  VEREIN_MELDUNG,
  VEREIN_TEAM_NICHT_GEFUNDEN,
  KONTO_LOESCHEN_TEXT,
  TEAMS_OHNE_VEREIN_TEXT,
  VEREIN_GRUENDEN_TEXT,
  VEREIN_LOESCHEN_TEXT,
  VEREIN_UNSTIMMIG,
  VEREIN_VEREINBARUNG_TEXT,
  vereinbarungLage,
  kontoEinzigePersonInzwischenText,
  kontoEinzigePersonSaetze,
  kontoLetzteVerwaltungSaetze,
  vereinGeloeschtText,
  vereinHeisstInzwischenText,
  vereinLoeschenFolgen,
  vereinLoeschenTitel,
  VEREIN_NAME_MAX,
  VEREIN_SPIELER_MAX,
  VEREIN_TEAMS_MAX,
  linkOhneTeamText,
  spielerAendernAbgewiesenText,
  spielerErfassenAbgewiesenText,
  spielerErfassenEinleitung,
  spielerKopfTeile,
  spielerLoeschenSaetze,
  spielerLoeschenTitel,
  spielerVonText,
  SPIELER_BESTAND_LEER,
  SPIELER_BESTAND_LEER_MITGLIED,
  SPIELER_FILTER,
  SPIELER_KEINE_TREFFER,
  SPIELER_OHNE_TEAM,
  SPIELER_ZUORDNUNG_HINWEIS,
  spielerAngezeigtText,
  teamnameVergebenText,
  vereinKopfText,
  vereinsNameProblem,
  zielWeg,
  zugeordnetText,
  zuordnenAbweisungText,
  zuordnenEinleitung,
  SCHNUPPERN_ZUORDNEN_HINWEIS,
  SCHNUPPERN_ZUORDNEN_LABEL,
  SCHNUPPERN_ZUORDNEN_TEXT,
  schnuppernZugeordnetText,
  vereinHerausgenommenText,
} from "../lib/verein";
import { liesListe, liesPositiveZahl, mitAnzahl } from "../lib/adresse";
import {
  KONTO_GRENZE_HINWEIS,
  KONTO_GRENZE_SCHLUSS,
  KONTO_GRENZE_WERKZEUG,
  KONTO_MARKER,
  KONTO_TRAININGS_MAX,
  KONTO_UEBUNGEN_MAX,
  bestandSatz,
  bestandText,
  bestandVollMeldung,
  NICHTS_MEHR_FREI,
  grenzeAusAbweisung,
  grenzenOhneVerein,
  istVoll,
  kontoGrenzeAusFehler,
  kontoGrenzeMeldung,
  kontoGrenzeText,
  kontoGrenzenAus,
} from "../lib/konto-grenzen";
import {
  OHNE_TEAM_WERT,
  SPIELER_SEITE,
  bereinigeEingrenzung,
  eingrenzungGesetzt,
  bereinigteAdresse,
  bereinigeSuche,
  liesSpielerAnzahl,
  liesSpielerEingrenzung,
  teamFilterWerte,
} from "../lib/verein-spielerliste";
import { gruendungAus, kontoInfoAus, kontoLoeschAusgangAus, vereinLoeschAusgangAus, vereinbarungAus } from "../lib/verein-antwort";
import {
  BEREICH_COOKIE,
  arbeitsbereichPfad,
  bereichCookie,
  bereichPfad,
  bereichSchluessel,
  leseBereich,
  waehleBereich,
  type Bereich,
} from "../lib/bereich";
import { STARTSEITE_PFAD, UEBUNGEN_PFAD, aktiveBereiche, bereichAusPfad } from "../lib/navigation";
import {
  BEISPIEL_NAMEN,
  GEPLANTER_PREIS_CHF,
  KATALOG_PARAMETER,
  KONTO_GELOESCHT_PARAMETER,
  KONTO_GELOESCHT_TEXT,
  MANUAL_UEBUNGEN_ANZAHL,
  NUR_MIT_KONTO_TEXT,
  REPO_URL,
  SFV_HINWEIS,
  STARTSEITE_BEISPIELE,
  katalogWeiterleitung,
  nurMitKontoZiel,
} from "../lib/startseite";
import { NUR_MIT_KONTO_PRAEFIXE, abfrageAus, istNurMitKonto, nurMitKontoAdresse } from "../lib/weiterleitung";
import { HERKUNFT_LABEL } from "../lib/labels";
import {
  FREIGEGEBEN,
  PRODUKTION_ORIGIN,
  SITEMAP_PFADE,
  VORSCHAU_CLAIM,
  VORSCHAU_DIENSTE,
  VORSCHAU_NAME,
  basisOrigin,
  robotsRegeln,
} from "../lib/auffindbar";
import { DATENSCHUTZ_PFAD, ENTWURF_HINWEIS, IMPRESSUM_PFAD, KONTAKT_EMAIL, RECHTLICHE_LINKS, VEREINBARUNG_FASSUNG, VEREINBARUNG_PFAD, VEREINBARUNG_TITEL } from "../lib/rechtliches";
import { TRAGWEITE_VEROEFFENTLICHEN, ZUM_VEROEFFENTLICHEN_FEHLT } from "../lib/training-bedingungen";
import { FILTER_SCHLUESSEL, TEAM_BEREICHE, teamBereichAusPfad, teamBereichHref } from "../lib/team-bereiche";
import {
  OHNE_KADER_WERT,
  bereinigeTeamEingrenzung,
  bereinigteTeamAdresse,
  falteSuchtext,
  filtereSpieler,
  jahrgaengeDerListe,
  kaderFilterWerte,
  liesTeamEingrenzung,
  sichtbareAuswahl,
  teamEingrenzungGesetzt,
  teamSpielerHref,
} from "../lib/team-spielerliste";
import { textMitLinks } from "../lib/text-links";
import { gliedere, gliederungAlsText, gliederungBloecke } from "../lib/gliederung";
import { TEAM_INFOS_MAX, TEAM_INFOS_TEXT, standDatum, teamInfosBereinigt, teamInfosProblem, zahlCh } from "../lib/team-infos";

let gelaufen = 0;

function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

/** `fehlerMeldung` protokolliert Unerwartetes — hier ist es erwartet. */
function still<T>(fn: () => T): T {
  const orig = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = orig;
  }
}

const problem = (stufe: Altersstufe, einordnung: string, hkat?: string | null) => {
  const z = zielblock(stufe, einordnung, hkat);
  return z.ok ? null : z.problem;
};

// ── zielblock (#192 NFR 4, AK 9) ────────────────────────────────────────────
pruefe("Kinderfussball-Hauptteil ohne Kategorie: Pflichttext mit den drei Werten", () => {
  const erwartet = {
    feld: "hauptteilkategorie",
    text:
      "Im Kinderfussball-Hauptteil ist die Hauptteilkategorie Pflicht: " +
      "fussball-spielen-lernen, vielseitigkeit-erleben, fussball-spielen.",
  };
  assert.deepEqual(problem("kinderfussball", "hauptteil"), erwartet);
  assert.deepEqual(problem("kinderfussball", "hauptteil", null), erwartet);
  assert.deepEqual(problem("kinderfussball", "hauptteil", "gibt-es-nicht"), erwartet);
});

pruefe("Eine Hauptteilkategorie ausserhalb des Kinderfussball-Hauptteils wird abgewiesen", () => {
  const erwartet = {
    feld: "hauptteilkategorie",
    text: "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
  };
  assert.deepEqual(problem("juniorenfussball", "jun-spiel", "fussball-spielen"), erwartet);
  assert.deepEqual(problem("kinderfussball", "einleitung", "fussball-spielen"), erwartet);
});

pruefe("Ein stufenfremder Block nennt Schema und zulässige Einordnungen", () => {
  // Wortgleich mit der bisherigen Meldung der Oberfläche; die Liste reist
  // getrennt in `zulaessig`, der MCP-Adapter hängt sie als «Zulässig: …» an.
  assert.deepEqual(problem("kinderfussball", "jun-spiel"), {
    feld: "einordnung",
    text: "Dieser Block gehört nicht zum Trainingsschema Kinderfussball.",
    zulaessig: ["auffangen", "einleitung", "hauptteil", "ausklang"],
  });
  assert.equal(problem("juniorenfussball", "einleitung")?.feld, "einordnung");
});

pruefe("Gültige Zielblöcke liefern einen Filter", () => {
  const faelle: [Altersstufe, string, string | null][] = [
    ...einordnungsSlugsFuer("kinderfussball")
      .filter((e) => e !== "hauptteil")
      .map((e): [Altersstufe, string, null] => ["kinderfussball", e, null]),
    ...hauptteilkategorieSlugs.map((h): [Altersstufe, string, string] => ["kinderfussball", "hauptteil", h]),
    ...einordnungsSlugsFuer("juniorenfussball").map(
      (e): [Altersstufe, string, null] => ["juniorenfussball", e, null],
    ),
  ];
  for (const [stufe, einordnung, hkat] of faelle)
    assert.ok(zielblock(stufe, einordnung, hkat).ok, `${stufe}/${einordnung}/${hkat}`);
  // Die anziehende Erscheinungsform (Story #134) kommt mit.
  const z = zielblock("juniorenfussball", "jun-explosivitaet");
  assert.ok(z.ok && z.filter.erscheinungsformen?.includes("explosiv-dynamisch-agieren"));
  const h = zielblock("kinderfussball", "hauptteil", "fussball-spielen");
  assert.ok(h.ok && h.filter.hauptteilkategorie === "fussball-spielen");
});

// ── Übersetzung von Datenbankfehlern ────────────────────────────────────────
// Die Klartexte sind eingefroren: Ändert sich einer, ändert sich ein Text der
// Oberfläche — das soll eine bewusste Entscheidung sein, kein Nebeneffekt.
pruefe("fachlicheMeldung erklärt Marker, fehlerMeldung bleibt wortgleich", () => {
  const beispiele: [string, string][] = [
    ['new row for relation "trainings" violates … STUFE_FEHLT', "Bitte mindestens eine Alterskategorie wählen."],
    ["GRUPPE_NUR_HAUPTTEIL: …", "Gruppen lassen sich nur im Hauptteil verteilen."],
    ["VARIANTE_FREMDES_TRAINING: Variante x gehoert nicht zu Training y", "Diese Variante gehört zu einem anderen Training."],
    [
      "TRAINING_UNVOLLSTAENDIG: einleitung",
      "Ein Training in der Community braucht mindestens eine Übung in der Einleitung. " +
        "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
    ],
  ];
  // #193: die Marker der Übungsfolge und der bisher unübersetzte Termin-Marker.
  beispiele.push(
    ["UEBUNGSFOLGE_DOPPELT", "Eine Übung steht in der Reihenfolge mehrfach."],
    [
      "UEBUNGSFOLGE_UNVOLLSTAENDIG",
      "Die Reihenfolge muss genau die Übungen dieses Abschnitts nennen - jede einmal. " +
        "Lies das Training neu und sende die vollständige Folge.",
    ],
    ["UEBUNGSFOLGE_ABSCHNITT_LEER", "In diesem Abschnitt steht keine Übung."],
    [
      "TERMIN_TRAINING_FREMDES_TEAM",
      "Einem Termin lassen sich nur Trainings seines Teams oder deine persönlichen Trainings zuordnen.",
    ],
  );
  // #263: die Varianten-Marker, die der KI-Weg jetzt erreicht, und die der
  // neuen Variantenfolge.
  beispiele.push(
    [
      "LETZTE_VARIANTE: Training x haette keinen Hauptteil mehr",
      "Die letzte Variante des Hauptteils lässt sich nicht entfernen.",
    ],
    [
      "VARIANTE_KOPIE_UNVOLLSTAENDIG: 2 Fassungen angemeldet, 3 erwartet",
      "Die Variante liess sich nicht vollständig kopieren. " +
        "Lade das Training neu und versuche es noch einmal.",
    ],
    ["VARIANTENFOLGE_DOPPELT", "Eine Variante steht in der Reihenfolge mehrfach."],
    [
      "VARIANTENFOLGE_UNVOLLSTAENDIG",
      "Die Reihenfolge muss genau die Varianten dieses Trainings nennen - jede einmal. " +
        "Lies das Training neu und sende die vollständige Folge.",
    ],
  );
  for (const [roh, klartext] of beispiele) {
    assert.equal(fachlicheMeldung(roh), klartext, roh);
    assert.equal(fehlerMeldung(roh), klartext, roh);
  }
  assert.equal(fachlicheMeldung("irgendein Postgres-Fehler"), null);
  assert.equal(
    still(() => fehlerMeldung("irgendein Postgres-Fehler")),
    "Das liess sich nicht speichern. Bitte versuche es noch einmal.",
  );
  assert.equal(fachlicheMeldung("new row violates row-level security policy"), null);
  assert.equal(
    still(() => fehlerMeldung("new row violates row-level security policy")),
    "Keine Berechtigung für diese Änderung.",
  );
});

pruefe("ausDbFehler ordnet ein: bedingung, regel, keine_rechte, technisch", () => {
  const b = ausDbFehler({ message: "TRAINING_UNVOLLSTAENDIG: freies_spiel VARIANTE 1234" });
  assert.equal(b.art, "bedingung");
  assert.equal(b.bedingung, "freies_spiel");
  assert.equal(b.varianteId, "1234");
  assert.equal(
    b.meldung,
    "Ein Training in der Community braucht in jeder Variante mindestens eine Übung im freien Spiel. " +
      "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
  );
  assert.equal(ausDbFehler({ message: "STUFE_FEHLT" }).art, "regel");
  assert.equal(ausDbFehler({ message: "UEBUNGSFOLGE_UNVOLLSTAENDIG" }).art, "regel");
  assert.equal(ausDbFehler({ message: "VARIANTENFOLGE_UNVOLLSTAENDIG" }).art, "regel");
  assert.equal(ausDbFehler({ message: "LETZTE_VARIANTE: Training x" }).art, "regel");
  // Deadlock: Postgres hat zurückgerollt, ein zweiter Versuch genügt.
  const d = ausDbFehler({ message: "deadlock detected", code: "40P01" });
  assert.equal(d.art, "konflikt");
  assert.equal(d.wiederholbar, true);
  assert.equal(d.meldung, MELDUNG_WIEDERHOLEN);
  const rls = still(() => ausDbFehler({ message: "new row violates row-level security policy" }));
  assert.equal(rls.art, "keine_rechte");
  assert.equal(rls.meldung, "Keine Berechtigung für diese Änderung.");
  const t = still(() => ausDbFehler({ message: "connection reset" }));
  assert.equal(t.art, "technisch");
  assert.equal(t.meldung, "Das liess sich nicht speichern. Bitte versuche es noch einmal.");
});

pruefe("Standard-Texte des Kerns sind eingefroren", () => {
  assert.equal(NICHT_GEFUNDEN.training, "Training nicht gefunden.");
  assert.equal(NICHT_GEFUNDEN.fassung, "Zuordnung nicht gefunden.");
  assert.equal(NICHT_GEFUNDEN.vorlage, "Übung nicht verfügbar.");
  assert.equal(NICHT_GEFUNDEN.gruppe, "Gruppe nicht gefunden.");
  assert.equal(NICHT_GEFUNDEN.variante, "Variante nicht gefunden.");
  assert.equal(
    FREMDES_TRAINING,
    "Dieses Training gehört jemand anderem. Du kannst es ansehen und übernehmen, aber nicht ändern.",
  );
  assert.equal(NICHT_GEFUNDEN.uebung, "Diese Übung gibt es nicht oder sie ist für dein Konto nicht sichtbar.");
  assert.equal(
    FREMDE_UEBUNG,
    "Diese Übung stammt aus dem Kifu-Manual oder gehört jemand anderem. Du kannst sie ansehen und " +
      "in deinen Bestand kopieren, aber nicht ändern.",
  );
  assert.ok(MELDUNG_WIEDERHOLEN.includes("noch einmal zu versuchen"), "Wiederholen muss genannt sein (#192 NFR 5)");
});

pruefe("Leer-Texte und Ziel des Pickers sind wortgleich mit dem früheren JSX", () => {
  assert.equal(KEINE_PASSENDE_UEBUNG, "Keine passende Übung gefunden.");
  assert.equal(zielLabel("einleitung"), "Einleitung");
  assert.equal(zielLabel("jun-explosivitaet"), "Explosivität");
  assert.equal(zielLabel("hauptteil", "fussball-spielen"), "Hauptteil · Fussball spielen");
  assert.equal(
    `${leerBestandText(zielLabel("hauptteil", "fussball-spielen"), "kinderfussball")} Erfasse zuerst eine.`,
    "Für „Hauptteil · Fussball spielen\" gibt es in deinem sichtbaren Bestand noch keine " +
      "Übung der Altersstufe Kinderfussball. Erfasse zuerst eine.",
  );
});

// ── Auskunft «training_abrufen» (#193 AK 1, NFR 1) ─────────────────────────
// Die Gliederung muss dieselbe sein wie im Editor: alle Teile und Blöcke,
// auch leere, der Hauptteil einmal je Variante — sonst fehlt dem Assistenten
// genau die Lücke, die er füllen soll.

const ICH = "00000000-0000-0000-0000-00000000000a";

/** Jede Beispiel-Auskunft läuft durch das STRENGE Schema (strictObject auf
 *  allen Ebenen): Baut der Mapper ein Feld, das der Vertrag nicht kennt,
 *  scheitert es hier — im Betrieb fiele es sonst still weg. */
const trainingAuskunft: typeof auskunftRoh = (d, k) => TrainingAuskunftStreng.parse(auskunftRoh(d, k));

function fassung(id: string, teil: string, extra: Partial<TrainingExerciseItem> = {}): TrainingExerciseItem {
  return {
    id,
    trainingsteil: teil as TrainingExerciseItem["trainingsteil"],
    hauptteilkategorie: null,
    varianteId: null,
    position: 0,
    durationMin: null,
    notiz: null,
    name: `Übung ${id}`,
    kategorien: [],
    erscheinungsform: [],
    feldtyp: null,
    spielfeldLaengeM: null,
    spielfeldBreiteM: null,
    uebungstyp: null,
    anzahlKinder: null,
    material: [],
    materialListe: [],
    materialBasis: null,
    fahrplan: null,
    aufbau: null,
    bildUrl: null,
    bildQuelle: null,
    diagramm: null,
    gruppen: [],
    uebungsvarianten: null,
    ...extra,
  };
}

function training(extra: Partial<TrainingDetail>): TrainingDetail {
  return {
    id: "t1",
    name: "Probe",
    ownerId: ICH,
    visibility: "private",
    altersstufe: "kinderfussball",
    stufen: ["F"],
    ziel: null,
    team: null,
    terminDatum: null,
    terminTraining: false,
    urheber: "Ich",
    createdAt: "2026-09-23T00:00:00Z",
    updatedAt: "2026-09-23T00:00:00Z",
    exercises: [],
    gruppen: [],
    varianten: [{ id: "v1", name: "Variante 1" }],
    ...extra,
  };
}

pruefe("Auskunft: Hauptteil je Variante, leere Blöcke, Altbestand ohne Kategorie, Übungsvarianten", () => {
  const a = trainingAuskunft(
    training({
      varianten: [
        { id: "v1", name: "12 Kinder" },
        { id: "v2", name: "20 Kinder" },
      ],
      exercises: [
        fassung("e1", "einleitung", { durationMin: 10, kategorien: ["E"] }),
        fassung("f1", "hauptteil", {
          hauptteilkategorie: "fussball-spielen",
          varianteId: "v1",
          durationMin: 20,
          uebungsvarianten: "- Mit zwei Bällen",
          fahrplan: { offen_starten: "Los", ueben: ["a"], wetteifern: null },
        }),
        fassung("alt", "hauptteil", { varianteId: "v1" }),
      ],
    }),
    { userId: ICH },
  );
  // Reihenfolge des Schemas, der Hauptteil zweimal nebeneinander.
  assert.deepEqual(
    a.teile.map((t) => `${t.teil.slug}${t.variante ? `:${t.variante.id}` : ""}`),
    ["auffangen", "einleitung", "hauptteil:v1", "hauptteil:v2", "ausklang"],
  );
  const [h1, h2] = a.teile.filter((t) => t.teil.slug === "hauptteil");
  assert.equal(h1.variante?.name, "12 Kinder");
  // Alle drei Hauptteilkategorien als Block, auch leer.
  assert.deepEqual(
    h2.bloecke.map((b) => b.hauptteilkategorie?.slug),
    ["fussball-spielen-lernen", "vielseitigkeit-erleben", "fussball-spielen"],
  );
  const freiesSpielV2 = h2.bloecke.find((b) => b.hauptteilkategorie?.slug === "fussball-spielen")!;
  assert.equal(freiesSpielV2.uebungen.length, 0);
  assert.equal(freiesSpielV2.leer_hinweis, LEER_HINWEIS["fussball-spielen"]);
  const freiesSpielV1 = h1.bloecke.find((b) => b.hauptteilkategorie?.slug === "fussball-spielen")!;
  assert.equal(freiesSpielV1.leer_hinweis, undefined, "ein belegter Block trägt keinen Leer-Hinweis");
  const f1 = freiesSpielV1.uebungen[0];
  assert.equal(f1.uebungsvarianten, "- Mit zwei Bällen");
  assert.deepEqual(f1.ablauf, { art: "fahrplan", offen_starten: "Los", ueben: ["a"], wetteifern: null });
  // Der Altbestand ohne Kategorie steht in keinem Block, aber nicht still weg.
  assert.deepEqual(h1.ohne_kategorie?.map((u) => u.fassung_id), ["alt"]);
  assert.equal(h2.ohne_kategorie, undefined);
  // Die Einleitung gilt für beide Varianten und erscheint einmal.
  assert.equal(a.teile.filter((t) => t.teil.slug === "einleitung").length, 1);
  const e1 = a.teile[1].bloecke[0].uebungen[0];
  assert.equal(e1.deckt_stufen, false, "E deckt F nicht ab");
  assert.deepEqual(e1.kategorien, [{ slug: "E", label: "E-Junior:innen" }]);
  // Summen je Variante.
  assert.deepEqual(a.gesamt, [
    { variante_id: "v1", summe_min: 30, ohne_dauer: 1, richtwert: null },
    { variante_id: "v2", summe_min: 10, ohne_dauer: 0, richtwert: null },
  ]);
  // Das Kinderfussball-Manual gibt keine Zeiten vor (#199 AK 8).
  assert.ok(a.teile.every((t) => t.richtwert === null && t.bloecke.every((b) => b.richtwert === null)));
  assert.equal(a.uebungen_gesamt, 3);
  assert.equal(a.bearbeitbar, true);
  assert.deepEqual(a.bestand, { art: "persoenlich", eigen: true });
  assert.equal(a.sichtbarkeit, "entwurf");
});

pruefe("Auskunft: bei einer Variante kein «variante», fremdes öffentliches Training nicht bearbeitbar", () => {
  const a = trainingAuskunft(
    training({ ownerId: "00000000-0000-0000-0000-00000000000b", visibility: "public" }),
    { userId: ICH },
  );
  assert.ok(a.teile.every((t) => t.variante === undefined));
  assert.deepEqual(a.gesamt, [{ summe_min: 0, ohne_dauer: 0, richtwert: null }]);
  assert.equal(a.bearbeitbar, false);
  assert.deepEqual(a.bestand, { art: "persoenlich", eigen: false });
  assert.equal(a.sichtbarkeit, "oeffentlich");
});

pruefe("Auskunft Juniorenfussball: vier Teile, sieben Blöcke, Beschreibung als Ablauf", () => {
  const a = trainingAuskunft(
    training({
      altersstufe: "juniorenfussball",
      stufen: ["D"],
      team: { id: "team1", name: "Da" },
      ownerId: null,
      exercises: [fassung("s1", "jun-spiel", { varianteId: "v1", aufbau: "Frei spielen" })],
    }),
    { userId: ICH },
  );
  assert.deepEqual(a.teile.map((t) => t.teil.slug), ["auffangen", "einstieg", "hauptteil", "abschluss"]);
  assert.equal(a.teile.flatMap((t) => t.bloecke).length, 7);
  const spiel = a.teile[2].bloecke.find((b) => b.einordnung.slug === "jun-spiel")!;
  assert.deepEqual(spiel.uebungen[0].ablauf, { art: "beschreibung", text: "Frei spielen" });
  assert.equal(spiel.traegt_gruppen, true);
  const auffangen = a.teile[0].bloecke[0];
  assert.equal(auffangen.traegt_dauer, false);
  assert.equal(auffangen.leer_hinweis, undefined, "leeres Auffangen ist kein Mangel");
  assert.deepEqual(a.bestand, { art: "team", team: { id: "team1", name: "Da" } });
  assert.equal(a.bearbeitbar, true);
});

pruefe("Auskunft Juniorenfussball: Zeitrichtwerte je Teil, Block und gesamt mit Abweichung (#199 AK 8)", () => {
  const a = trainingAuskunft(
    training({
      altersstufe: "juniorenfussball",
      stufen: ["C"],
      exercises: [
        fassung("auf", "jun-auffangen"),
        fassung("w", "jun-aufwaermen", { durationMin: 15 }),
        fassung("x", "jun-explosivitaet", { durationMin: 8 }),
        fassung("sf", "jun-spielformen", { varianteId: "v1", durationMin: 20 }),
        fassung("ab", "jun-abschluss", { durationMin: 12 }),
      ],
    }),
    { userId: ICH },
  );
  const teil = (slug: string) => a.teile.find((t) => t.teil.slug === slug)!;
  const block = (slug: string) =>
    a.teile.flatMap((t) => t.bloecke).find((b) => b.einordnung.slug === slug)!;
  // Das Auffangen zählt nicht zur Trainingszeit: kein Richtwert, nirgends (PC 2).
  assert.equal(teil("auffangen").richtwert, null);
  assert.equal(block("jun-auffangen").richtwert, null);
  // Teil: Einstieg 23 min im Band 20–30.
  assert.deepEqual(teil("einstieg").richtwert, { min_min: 20, max_min: 30, abweichung_min: 0 });
  // Blöcke: Aufwärmen 15 über 10–12, Spielform leer (keine Bewertung).
  assert.deepEqual(block("jun-aufwaermen").richtwert, { min_min: 10, max_min: 12, abweichung_min: 3 });
  assert.deepEqual(block("jun-spielform-trainingsziel").richtwert, { min_min: 6, max_min: 8, abweichung_min: 0 });
  assert.deepEqual(block("jun-spielformen").richtwert, { min_min: 30, max_min: 45, abweichung_min: -10 });
  assert.deepEqual(teil("hauptteil").richtwert, { min_min: 45, max_min: 65, abweichung_min: -25 });
  // Einblockiger Teil: der Richtwert steht am Teil, nicht zweimal.
  assert.deepEqual(teil("abschluss").richtwert, { min_min: 5, max_min: 10, abweichung_min: 2 });
  assert.equal(block("jun-abschluss").richtwert, null);
  // Gesamt: 55 min gegen die vorgesehenen 90.
  assert.deepEqual(a.gesamt, [
    { summe_min: 55, ohne_dauer: 0, richtwert: { min_min: 90, max_min: 90, abweichung_min: -35 } },
  ]);
  // Dieselbe Rechnung wie der Editor und die Hinweise.
  assert.equal(block("jun-aufwaermen").richtwert?.abweichung_min, zeitAbgleich("jun-aufwaermen", 15)?.abweichungMin);
  // Ohne erfasste Dauer: Richtwert ja, Abweichung 0 (keine Bewertung, wie im Editor).
  const leer = trainingAuskunft(training({ altersstufe: "juniorenfussball", stufen: ["C"] }), { userId: ICH });
  assert.deepEqual(leer.gesamt[0].richtwert, { min_min: 90, max_min: 90, abweichung_min: 0 });
});

pruefe("nochNichtVorbereitet: anstehend und ohne Training", () => {
  const t = { id: "t", teamId: "x", art: "training" as const, spiel: null, datum: "2026-10-07", beginn: "18:30", ende: "20:00", ort: null, ortLink: null, bemerkung: null, hinweisEltern: null, treffpunkt: null, felder: null, spielerzahl: null, spielstand: null, training: null, serie: null, serienTag: null, abweichungen: [], trainer: [], mindestbesetzung: null, kader: [], ausgefallen: false, ausfallGrund: null };
  assert.equal(nochNichtVorbereitet(t, "2026-10-07"), true, "heute zählt ganz zum Anstehenden");
  assert.equal(nochNichtVorbereitet(t, "2026-10-08"), false, "vergangen");
  assert.equal(nochNichtVorbereitet({ ...t, training: { id: "a", name: "A", stufen: [], terminTraining: true } }, "2026-10-01"), false);
});

pruefe("Status eines Termins in einem Wort, Kalenderblatt weiss oder grau (#491)", () => {
  const t = { id: "t", teamId: "x", art: "training" as const, spiel: null, datum: "2026-11-03", beginn: "18:00", ende: "19:30", ort: null, ortLink: null, bemerkung: null, hinweisEltern: null, treffpunkt: null, felder: null, spielerzahl: null, spielstand: null, training: null, serie: null, serienTag: null, abweichungen: [], trainer: [], mindestbesetzung: null, kader: [], ausgefallen: false, ausfallGrund: null };
  const mitTraining = { ...t, training: { id: "a", name: "A", stufen: [], terminTraining: true } };
  assert.deepEqual(terminStatus(mitTraining, "2026-11-01"), { wort: "Vorbereitet", appearance: "success" });
  assert.deepEqual(terminStatus(t, "2026-11-01"), { wort: "Nicht vorbereitet", appearance: "neutral" });
  assert.deepEqual(terminStatus({ ...mitTraining, ausgefallen: true }, "2026-11-01"), { wort: "Fällt aus", appearance: "neutral" });
  assert.equal(terminStatus(mitTraining, "2026-11-04"), null, "vergangen ohne Status");
  assert.equal(terminStatus(mitTraining, "2026-11-03")?.wort, "Vorbereitet", "heute bevorstehend bis Tagesende");

  const spiel = { ...t, art: "spiel" as const, spiel: { bezeichnung: "Meisterschaft", richtwertMin: 9, richtwertMax: 12, meldefrist: null, vorher: null, treffpunkte: [] } };
  const stand = (angemeldet: number, anwesend?: number) => ({ gesamt: 14, angemeldet, eingefroren: anwesend !== undefined, anwesend: anwesend ?? null });
  assert.equal(terminStatus({ ...spiel, spielstand: stand(7) }, "2026-11-01")?.wort, "Zu wenig");
  assert.equal(terminStatus({ ...spiel, spielstand: stand(9) }, "2026-11-01")?.wort, "Knapp");
  assert.equal(terminStatus({ ...spiel, spielstand: stand(12) }, "2026-11-01")?.wort, "Genügend");
  assert.deepEqual(terminStatus({ ...spiel, spielstand: stand(13) }, "2026-11-01"), { wort: "Zu viel", appearance: "danger" }, "zu viel ist rot");
  assert.equal(terminStatus({ ...spiel, spielstand: stand(12, 8) }, "2026-11-03")?.wort, "Zu wenig", "ab Anpfiff zählen die Anwesenden");
  assert.equal(terminStatus({ ...spiel, spielstand: null }, "2026-11-01"), null, "ohne Spielerliste");
  assert.equal(terminStatus({ ...spiel, spiel: { ...spiel.spiel, richtwertMin: null, richtwertMax: null }, spielstand: stand(9) }, "2026-11-01"), null, "ohne Richtwert");
  assert.equal(spielStatus(30, 9, null)?.wort, "Genügend", "nur Mindestzahl: nie zu viel");
  assert.equal(spielStatus(0, null, 12)?.wort, "Genügend", "nur Höchstzahl: nie zu wenig");

  // #494: grosse Karte nach der Meldefrist bis zum Anpfiff, mit Handlung.
  const nachFrist = { ...spiel, beginn: "10:00", spielstand: stand(7), spiel: { ...spiel.spiel, meldefrist: "2026-10-29T20:00" } };
  assert.equal(nachMeldefrist(nachFrist, "2026-10-29T19:59"), false, "Frist läuft");
  assert.equal(nachMeldefrist(nachFrist, "2026-10-29T20:00"), true, "ab der Frist");
  assert.equal(nachMeldefrist(nachFrist, "2026-11-03T09:59"), true);
  assert.equal(nachMeldefrist(nachFrist, "2026-11-03T10:00"), false, "ab Anpfiff wieder Zeile");
  assert.equal(nachMeldefrist({ ...nachFrist, ausgefallen: true }, "2026-10-30T12:00"), false, "ausgefallen nie");
  assert.equal(nachMeldefrist({ ...nachFrist, spielstand: null }, "2026-10-30T12:00"), false, "ohne Spielerliste nie");
  assert.equal(nachMeldefrist({ ...nachFrist, spiel: { ...nachFrist.spiel, richtwertMin: null, richtwertMax: null } }, "2026-10-30T12:00"), false, "ohne Richtwert nie");
  assert.equal(nachMeldefrist({ ...nachFrist, spiel: { ...nachFrist.spiel, meldefrist: null } }, "2026-10-30T12:00"), false, "ohne Meldefrist nie");
  assert.deepEqual(handlungsMeldung(nachFrist), { appearance: "error", text: "Es fehlen 2 bis zur Mindestzahl 9. Spieler:innen direkt anfragen." });
  assert.equal(handlungsMeldung({ ...nachFrist, spielstand: stand(9) })?.appearance, "warning");
  assert.deepEqual(handlungsMeldung({ ...nachFrist, spielstand: stand(13) }), { appearance: "error", text: "1 über der Höchstzahl 12. Aufgebot klären." });
  assert.equal(handlungsMeldung({ ...nachFrist, spielstand: stand(11) }), null, "genügend ohne Meldung");

  assert.equal(blattStand(t, "2026-11-03"), "leise", "Training leiser als ein Spiel");
  assert.equal(blattStand(spiel, "2026-11-03"), "aktiv");
  assert.equal(blattStand(t, "2026-11-04"), "vergangen");
  assert.equal(blattStand({ ...t, ausgefallen: true }, "2026-11-04"), "gestrichen");
});

pruefe("Ausfall: Grund mit den Regeln der Bemerkung; nicht vorbereitet schliesst Ausfälle aus (#327)", () => {
  assert.equal(ausfallProblem(null), null);
  assert.equal(ausfallProblem("Platz gesperrt"), null);
  assert.equal(ausfallProblem("x".repeat(500)), null);
  assert.deepEqual(ausfallProblem("x".repeat(501)), { feld: "grund", text: TERMIN_TEXT.grundLang });
  assert.equal(TERMIN_TEXT.grundLang, "Der Grund darf höchstens 500 Zeichen lang sein.");
  assert.equal(TERMIN_MELDUNG.NICHT_AUSGEFALLEN, "Dieser Termin ist nicht ausgefallen.");
  assert.ok(!KONFLIKT_MARKER.includes("TERMIN_AUSGEFALLEN"), "eine Regel, kein Konflikt");
  const t = { id: "t", teamId: "x", art: "training" as const, spiel: null, datum: "2026-10-07", beginn: "18:00", ende: "19:30", ort: null, ortLink: null, bemerkung: null, hinweisEltern: null, treffpunkt: null, felder: null, spielerzahl: null, spielstand: null,
    training: null, serie: null, serienTag: null, abweichungen: [], trainer: [], mindestbesetzung: null, kader: [], ausgefallen: true, ausfallGrund: null };
  assert.equal(nochNichtVorbereitet(t, "2026-10-01"), false, "AK 8");
  assert.equal(nochNichtVorbereitet({ ...t, ausgefallen: false }, "2026-10-01"), true);
});

pruefe("Auskunft-Vertrag: das strenge Schema weist ein undeklariertes Feld ab", () => {
  const a = trainingAuskunft(training({}), { userId: ICH });
  assert.throws(() => TrainingAuskunftStreng.parse({ ...a, uebungszahl: 1 }));
  const teil = { ...a.teile[1], extra: true };
  assert.throws(() => TrainingAuskunftStreng.parse({ ...a, teile: [teil] }));
});

pruefe("Auskunft: Termin eines Team-Trainings mit «anstehend» am übergebenen Tag (#198)", () => {
  const team = training({ ownerId: null, team: { id: "team1", name: "Ea" } });
  const termin = {
    id: "tt1",
    teamId: "team1",
    art: "training" as const,
    spiel: null,
    datum: "2026-09-23",
    beginn: "18:30",
    ende: "20:00",
    ort: "Allmend",
    ortLink: null,
    bemerkung: null,
    hinweisEltern: null,
    treffpunkt: null,
    felder: [
      { laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0, tor_7m: null }, untergrund: "kunstrasen" as const },
      { laenge_m: null, breite_m: null, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: null },
    ],
    spielerzahl: 12,
    spielstand: null,
    training: { id: "t1", name: "Probe", stufen: ["F" as const], terminTraining: true },
    serie: null,
    serienTag: null,
    abweichungen: [],
    trainer: [],
    mindestbesetzung: null,
    kader: [],
    ausgefallen: false,
    ausfallGrund: null,
  };
  const heute = trainingAuskunft(team, { userId: ICH, termin, heute: "2026-09-23" });
  assert.deepEqual(heute.termin, {
    id: "tt1",
    datum: "2026-09-23",
    beginn: "18:30",
    ende: "20:00",
    ort: "Allmend",
    bemerkung: null,
    hinweis_eltern: null,
    // #389 AK 13, 14: die Felder mit Grösse, Toren und Untergrund; Unbekanntes
    // als null, «keine» als 0, der Untergrund als Wert.
    felder: [
      {
        laenge_m: 30,
        breite_m: 25,
        tore: { minitor: 2, tor_5m: 0, tor_7m: null },
        untergrund: { slug: "kunstrasen", label: "Kunstrasen" },
      },
      { laenge_m: null, breite_m: null, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: null },
    ],
    // #390 AK 6: die erwartete Spielerzahl, unbekannt als null.
    erwartete_spielerzahl: 12,
    spielerzahl: { quelle: "erwartet", zahl: 12, gesamt: null },
    serie_id: null,
    trainer: [],
    mindestbesetzung: null,
    noetige_trainer: null,
    ausgefallen: false,
    ausfall_grund: null,
    anstehend: true,
  });
  // #521 AK 12: die Mindestbesetzung und die nötige Zahl (12 Spieler:innen, 1 je 5 → 2).
  const mitBesetzung = trainingAuskunft(team, { userId: ICH, termin: { ...termin, mindestbesetzung: { art: "verhaeltnis", zahl: 5 } } }).termin!;
  assert.deepEqual([mitBesetzung.mindestbesetzung, mitBesetzung.noetige_trainer], [{ art: "verhaeltnis", zahl: 5 }, 2]);
  // Platz unbekannt: «felder: null», nicht eine leere Liste (AK 14).
  assert.equal(trainingAuskunft(team, { userId: ICH, termin: { ...termin, felder: null } }).termin?.felder, null);
  assert.equal(trainingAuskunft(team, { userId: ICH, termin: { ...termin, spielerzahl: null } }).termin?.erwartete_spielerzahl, null);
  TrainingAuskunftStreng.parse(heute);
  // Der heutige Tag zählt ganz zum Anstehenden — wie im Plan (`teilePlan`).
  assert.equal(trainingAuskunft(team, { userId: ICH, termin, heute: "2026-09-24" }).termin?.anstehend, false);
  assert.equal(trainingAuskunft(team, { userId: ICH, termin: null }).termin, null);
  assert.equal(trainingAuskunft(training({}), { userId: ICH }).termin, null);
  // Ein undeklariertes Feld im Termin fiele im strengen Schema auf.
  assert.throws(() => TrainingAuskunftStreng.parse({ ...heute, termin: { ...heute.termin, extra: 1 } }));
});

// ── Monat und KI-Zeitraum (#329 AK 14, #404) ─────────────────────────────────
pruefe("Monat: Raster Montag–Sonntag, Wechsel, Name (#329)", () => {
  const r = monatsRaster("2026-10");
  assert.equal(r[0][0].tag, "2026-09-28", "beginnt am Montag vor dem 1.");
  assert.equal(r[0][3].tag, "2026-10-01");
  assert.ok(r.every((w) => w.length === 7));
  assert.equal(r.at(-1)!.at(-1)!.tag, "2026-11-08", "immer sechs Wochen");
  assert.equal(plusMonate("2026-12", 1), "2027-01");
  assert.equal(plusMonate("2026-01", -1), "2025-12");
  assert.equal(monatsName("2026-10"), "Oktober 2026");
  assert.equal(monatVon("2026-10-07"), "2026-10");
});

pruefe("Monat: Raster-Grenzfälle - immer sechs Wochen, Montag-Beginn, Februar, Schaltjahr, Jahreswechsel (#329)", () => {
  const erstesUndLetztes = (m: string) => {
    const r = monatsRaster(m);
    return { wochen: r.length, erster: r[0][0].tag, letzter: r.at(-1)!.at(-1)!.tag, imMonat: r.flat().filter((t) => t.imMonat).length };
  };
  // Beginnt am Montag: keine Vorwoche, der Rest füllt hinten auf.
  assert.deepEqual(erstesUndLetztes("2026-06"), { wochen: 6, erster: "2026-06-01", letzter: "2026-07-12", imMonat: 30 });
  // Endet am Sonntag: eine Woche des Folgemonats dahinter.
  assert.deepEqual(erstesUndLetztes("2026-05"), { wochen: 6, erster: "2026-04-27", letzter: "2026-06-07", imMonat: 31 });
  // Februar, Montag bis Sonntag: vier eigene Wochen, zwei folgen.
  assert.deepEqual(erstesUndLetztes("2027-02"), { wochen: 6, erster: "2027-02-01", letzter: "2027-03-14", imMonat: 28 });
  // Schaltjahr: der 29. Februar liegt im Raster.
  assert.deepEqual(erstesUndLetztes("2028-02"), { wochen: 6, erster: "2028-01-31", letzter: "2028-03-12", imMonat: 29 });
  assert.equal(monatsRaster("2028-02").flat().some((t) => t.tag === "2028-02-29" && t.imMonat), true);
  // Der längste Fall füllt die sechs Wochen ganz: 31 Tage ab Sonntag.
  assert.deepEqual(erstesUndLetztes("2026-03"), { wochen: 6, erster: "2026-02-23", letzter: "2026-04-05", imMonat: 31 });
  // Jahreswechsel, auch mehrfach und über ein Jahr hinaus.
  assert.equal(plusMonate("2026-01", -13), "2024-12");
  assert.equal(plusMonate("2026-01", -12), "2025-01");
  assert.equal(plusMonate("2026-12", 13), "2028-01");
  assert.equal(plusMonate("2026-03", -3), "2025-12");
  assert.equal(monatsName("2028-02"), "Februar 2028");
});

pruefe("Monat: tagText schreibt den Tag aus, ohne führende Null", () => {
  assert.equal(tagText("2026-10-07"), "7. Oktober 2026");
  assert.equal(tagText("2026-12-31"), "31. Dezember 2026");
  assert.equal(tagText("2028-02-29"), "29. Februar 2028");
});

pruefe("planHref: nur die Eingrenzung reist in der Adresse mit (#405, #518 PO 12)", () => {
  assert.equal(planHref("t1", null), "/team/t1");
  assert.equal(planHref("t1", "dabei"), "/team/t1?meine=1");
  assert.equal(planHref("t1", "eingeladen"), "/team/t1?eingeladen=1");
  assert.equal(terminHref("t1", "eingeladen", "x", "trainer"), "/team/t1?eingeladen=1&termin=x&tab=trainer");
  // Alte Links mit `?meine=1` gelten als «dabei»; höchstens eine Eingrenzung, `meine` geht vor.
  assert.equal(eingrenzungAus({ meine: "1" }), "dabei");
  assert.equal(eingrenzungAus({ eingeladen: "1" }), "eingeladen");
  assert.equal(eingrenzungAus({ meine: "1", eingeladen: "1" }), "dabei");
  assert.equal(eingrenzungAus({}), null);
});

const tr = (userId: string | null, name: string | null, verantwortlich = false, abgesagtAm: string | null = null): TerminTrainer => ({
  eintragId: `e-${userId ?? name ?? "x"}`,
  userId,
  name,
  ehemalig: userId === null,
  verantwortlich,
  abgesagtAm,
});

pruefe("Trainer: Eingrenzung, Zahl und Satz aus Sicht des USERS (#519 AK 18, 19, 24)", () => {
  const liste = [tr("a", "Anna Keller", true), tr("b", "Ben Huber"), tr(null, null)];
  assert.ok(imFilter(liste, "a", "dabei"));
  assert.ok(imFilter(liste, "b", "eingeladen"));
  assert.ok(!imFilter(liste, "c", "dabei"));
  assert.ok(!imFilter(liste, "c", "eingeladen"));
  // Einträge gelöschter Konten zählen nicht als dabei.
  assert.equal(dabeiZahl(liste), 2);
  assert.equal(trainerZahlSatz(liste, "b"), "Trainer:innen: 2 von 2 dabei · Anna Keller verantwortlich · du bist dabei");
  assert.equal(trainerZahlSatz(liste, "a"), "Trainer:innen: 2 von 2 dabei · du bist verantwortlich · du bist dabei");
  assert.equal(trainerZahlSatz([], "a"), "Trainer:innen: 0 von 0 dabei · niemand verantwortlich · du bist nicht eingeladen");
  // AK 18: nur anstehend und nicht ausgefallen.
  const ohne = { trainer: [tr("b", "Ben")], datum: "2026-10-27", ausgefallen: false };
  assert.ok(ohneVerantwortliche(ohne, "2026-10-27"));
  assert.ok(!ohneVerantwortliche(ohne, "2026-10-28"));
  assert.ok(!ohneVerantwortliche({ ...ohne, ausgefallen: true }, "2026-10-26"));
  assert.ok(!ohneVerantwortliche({ ...ohne, trainer: liste }, "2026-10-26"));
  // Nach Name, gelöschte Konten zuletzt, Gleichnamige nach Kennung.
  const sortiert = nachTrainerName([tr(null, null), tr("z", "Anna"), tr("y", "Anna"), tr("x", "Ben")], (t) => t.eintragId);
  assert.deepEqual(sortiert.map((t) => t.userId), ["y", "z", "x", null]);
});

pruefe("Mindestbesetzung: nötige Zahl, Grenzen, Lücke vor «niemand verantwortlich» (#521 AK 5–10, 16)", () => {
  // AK 6, 7, 10: kaufmännisch gerundet, mindestens 1, ohne Zahl keine Bewertung.
  assert.equal(noetigeTrainer(null, 30), null);
  assert.equal(noetigeTrainer({ art: "fest", zahl: 3 }, null), 3);
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 17 }, 34), 2);
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 10 }, 25), 3, "2,5 rundet auf");
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 10 }, 24), 2);
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 12 }, 3), 1, "mindestens 1");
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 12 }, 0), 0);
  assert.equal(noetigeTrainer({ art: "verhaeltnis", zahl: 12 }, null), null);
  // AK 5: ganze Zahlen von 1 bis 99.
  assert.equal(besetzungProblem({ art: "fest", zahl: 1 }), null);
  assert.equal(besetzungProblem({ art: "fest", zahl: 99 }), null);
  for (const zahl of [0, 100, 2.5, NaN]) assert.equal(besetzungProblem({ art: "fest", zahl }), BESETZUNG_TEXT.zahl, String(zahl));
  assert.equal(besetzungProblem({ art: "anders" as never, zahl: 2 }), BESETZUNG_TEXT.art);
  // AK 14, 15: der Hinweis beim Verhältnis.
  assert.equal(verhaeltnisHinweis({ art: "verhaeltnis", zahl: 17 }, 34), "Bei 34 angemeldeten Spieler:innen sind 2 Trainer:innen nötig. Die Zahl folgt den Ab- und Anmeldungen.");
  assert.equal(verhaeltnisHinweis({ art: "verhaeltnis", zahl: 17 }, null), BESETZUNG_TEXT.ohneZahl);
  // AK 8, 16: die Lücke — zu wenige geht vor niemand verantwortlich, nur anstehend und nicht ausgefallen.
  const basis = { mindestbesetzung: { art: "fest" as const, zahl: 2 }, spielerzahl: null, spielstand: null, datum: "2026-11-01", ausgefallen: false };
  assert.deepEqual(trainerLuecke({ ...basis, trainer: [tr("b", "Ben")] }, "2026-10-30"), { art: "zuWenig", fehlen: 1 });
  assert.deepEqual(trainerLuecke({ ...basis, trainer: [tr("b", "Ben"), tr("c", "Carla")] }, "2026-10-30"), { art: "niemand" });
  assert.equal(trainerLuecke({ ...basis, trainer: [tr("a", "Anna", true), tr("c", "Carla")] }, "2026-10-30"), null);
  assert.equal(trainerLuecke({ ...basis, trainer: [] }, "2026-11-02"), null, "vergangen: keine Bewertung");
  assert.equal(trainerLuecke({ ...basis, ausgefallen: true, trainer: [] }, "2026-10-30"), null);
  // Verhältnis ohne bekannte Spielerzahl: keine Unterbesetzung, nur «niemand verantwortlich».
  assert.deepEqual(trainerLuecke({ ...basis, mindestbesetzung: { art: "verhaeltnis", zahl: 10 }, trainer: [] }, "2026-10-30"), { art: "niemand" });
  assert.equal(trainerZahlSatz([tr("a", "Anna", true)], "a", 3), "Trainer:innen: 1 von 1 dabei · nötig 3 · du bist verantwortlich · du bist dabei");
  assert.equal(fehlenText(1), "1 Trainer:in fehlt");
  assert.equal(besetzungText({ art: "verhaeltnis", zahl: 17 }), "1 Trainer:in je 17 Spieler:innen");
});

pruefe("Trainer: Absagen — dabei, Zahl, Eingrenzung, wer übernehmen kann, Verfall-Satz (#520)", () => {
  const liste = [tr("a", "Anna", true), tr("b", "Ben", false, "2026-10-20T10:00:00Z"), tr("c", "Carla"), tr(null, null)];
  assert.ok(istDabei(liste, "a") && !istDabei(liste, "b") && hatAbgesagt(liste, "b"));
  assert.equal(dabeiZahl(liste), 2, "gelöschte Konten und Abgesagte zählen nicht");
  // PC 7: eine Absage nimmt den Termin aus «dabei», nicht aus «eingeladen».
  assert.ok(!imFilter(liste, "b", "dabei") && imFilter(liste, "b", "eingeladen"));
  assert.equal(trainerZahlSatz(liste, "b"), "Trainer:innen: 2 von 3 dabei · Anna verantwortlich · du hast abgesagt", "gelöschte Konten zählen nicht");
  assert.deepEqual(uebernehmenKoennen(liste, "a").map((t) => t.userId), ["c"], "nur andere, die dabei sind");
  assert.ok(absageOffen({ ausgefallen: false }, false));
  assert.ok(!absageOffen({ ausgefallen: true }, false), "AK 3: nie an einem ausgefallenen Termin");
  assert.ok(!absageOffen({ ausgefallen: false }, true), "AK 3: nicht ab Beginn");
  assert.equal(mitAbsagen("Vorher.", 0), "Vorher.");
  assert.equal(mitAbsagen("Vorher.", 1), "Vorher. Ausserdem verfällt 1 Absage einer Trainer:in: Sie gilt wieder als dabei.");
  assert.equal(mitAbsagen("", 3), "Damit verfallen 3 Absagen von Trainer:innen: Sie gelten wieder als dabei.", "ohne Satz davor kein «Ausserdem»");
});

pruefe("Trainer: Wahl im Dialog — Vorwahl, Differenz und namenlose Einträge (#519 AK 1–9)", () => {
  assert.deepEqual(trainerVorwahl([{ userId: "a" }, { userId: "b" }], "b"), { eingeladene: ["a", "b"], anonyme: [], verantwortlich: "b" });
  const start = trainerStart([tr("a", "Anna", true), tr("b", "Ben"), tr(null, null)]);
  assert.deepEqual(start, { eingeladene: ["a", "b"], anonyme: ["e-x"], verantwortlich: "a" });
  assert.equal(trainerAenderung(start, start), null);
  // Verantwortung weitergeben und die Bisherige ausladen in einem (AK 7).
  const weiter = trainerAenderung({ eingeladene: ["b", "c"], anonyme: ["e-x"], verantwortlich: "c" }, start)!;
  assert.deepEqual(weiter.einladen, ["c"]);
  assert.deepEqual(weiter.ausladen, ["a"]);
  assert.equal(weiter.verantwortlich, "c");
  assert.deepEqual(weiter.eingeladene, ["b", "c"]);
  assert.equal(weiter.nurNamenlose, false);
  // Die Verantwortliche ausladen: keine neue Verantwortliche, nur die Eingeladenen (AK 9).
  const aus = trainerAenderung({ eingeladene: ["b"], anonyme: ["e-x"], verantwortlich: null }, start)!;
  assert.equal(aus.verantwortlich, undefined);
  assert.deepEqual(aus.ausladen, ["a"]);
  // Allein ein Eintrag ohne Namen fällt weg: nur für diesen Termin.
  const namenlos = trainerAenderung({ ...start, anonyme: [] }, start)!;
  assert.ok(namenlos.nurNamenlose);
  assert.deepEqual(namenlos.ausladenEintraege, ["e-x"]);
  assert.equal(namenlos.eingeladene, undefined);
});

pruefe("KI-Zeitraum: höchstens bis zum gleichen Kalendertag im Folgejahr (#329 AK 14, Review Focus 2)", () => {
  assert.equal(zeitraumProblem("2026-10-01", "2027-10-01"), null);
  assert.equal(zeitraumProblem("2028-02-29", "2029-02-28"), null);
  assert.deepEqual(zeitraumProblem("2028-02-29", "2029-03-01"), { feld: "bis", text: ZEITRAUM_TEXT.zuLang });
  assert.deepEqual(zeitraumProblem("2026-10-02", "2026-10-01"), { feld: "bis", text: ZEITRAUM_TEXT.bisVorVon });
  assert.deepEqual(zeitraumProblem("2026-02-30", "2026-03-01"), { feld: "von", text: TERMIN_TEXT.datum });
});

// ── Termin-Felder (#322 AK 2, 5, 6, 8–10) ────────────────────────────────────
pruefe("terminProblem: neuer Termin braucht Datum, Beginn und Ende", () => {
  const ok = { datum: "2026-10-07", beginn: "18:30", ende: "20:00" };
  assert.equal(terminProblem(ok), null);
  assert.equal(terminProblem({ ...ok, datum: "2028-02-29" }), null, "Schalttag");
  for (const datum of ["", undefined, "2026-02-30", "2027-02-29", "2026-13-01", "0000-01-01", "23.09.2026"])
    assert.deepEqual(terminProblem({ ...ok, datum: datum as string }), { feld: "datum", text: TERMIN_TEXT.datum }, `Datum ${datum}`);
  assert.deepEqual(terminProblem({ ...ok, beginn: "" }), { feld: "beginn", text: TERMIN_TEXT.zeitPflicht });
  assert.deepEqual(terminProblem({ ...ok, ende: null }), { feld: "ende", text: TERMIN_TEXT.zeitPflicht });
  for (const beginn of ["25:99", "24:00", "8:30", "18.30", "18:30:00"])
    assert.deepEqual(terminProblem({ ...ok, beginn }), { feld: "beginn", text: TERMIN_TEXT.uhrzeit }, `Beginn ${beginn}`);
  assert.deepEqual(terminProblem({ ...ok, ende: "18:30" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn }, "gleich");
  assert.deepEqual(terminProblem({ ...ok, ende: "17:00" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn }, "davor");
  assert.deepEqual(terminProblem({ ...ok, ort: "x".repeat(101) }), { feld: "ort", text: TERMIN_TEXT.ortLang });
  assert.equal(terminProblem({ ...ok, ort: "x".repeat(100) }), null);
  assert.deepEqual(terminProblem({ ...ok, bemerkung: "x".repeat(501) }), { feld: "bemerkung", text: TERMIN_TEXT.bemerkungLang });
  // #590 AK 16: der Hinweis für Eltern ebenso höchstens 500 Zeichen.
  assert.equal(terminProblem({ ...ok, hinweisEltern: "x".repeat(500) }), null);
  assert.deepEqual(terminProblem({ ...ok, hinweisEltern: "x".repeat(501) }), { feld: "hinweisEltern", text: TERMIN_TEXT.hinweisElternLang });
});

pruefe("terminProblem: Beginn und Ende sind immer Pflicht und lassen sich nicht leeren (AK 2, 8)", () => {
  assert.deepEqual(terminProblem({ datum: "2026-10-08", beginn: "18:30", ende: null, ort: "Halle" }), { feld: "ende", text: TERMIN_TEXT.zeitPflicht });
  assert.deepEqual(terminProblem({ datum: "2026-10-08", beginn: null, ende: null }), { feld: "beginn", text: TERMIN_TEXT.zeitPflicht });
  assert.equal(terminProblem({ datum: "2026-10-08", beginn: "19:00", ende: "20:30" }), null);
  assert.equal(leerZuNull("  "), null);
  assert.equal(leerZuNull(" Allmend "), "Allmend");
});

pruefe("Kartenlink: vollständige https-Adresse bis 500 Zeichen, nur mit Ort (#533 AK 4, 5)", () => {
  const ok = { datum: "2026-10-08", beginn: "18:30", ende: "20:00", ort: "Turnhalle Wankdorf" };
  assert.equal(kartenlinkProblem(null), null, "keiner");
  assert.equal(kartenlinkProblem("   "), null, "leer ist keiner");
  assert.equal(kartenlinkProblem(" https://maps.app.goo.gl/MRWFZj3ZQtsYGBFi9 "), null, "Leerraum am Rand");
  for (const falsch of ["maps.app.goo.gl/MRWF", "http://maps.app.goo.gl/x", "javascript:alert(1)", "https://", "https://a b", "ftp://x"])
    assert.deepEqual(kartenlinkProblem(falsch), { feld: "ortLink", text: TERMIN_TEXT.kartenlinkUngueltig }, falsch);
  const vorn = "https://x.ch/";
  const rand = vorn + "a".repeat(KARTENLINK_MAX - vorn.length);
  assert.equal(kartenlinkProblem(rand), null, "genau 500");
  assert.deepEqual(kartenlinkProblem(rand + "a"), { feld: "ortLink", text: TERMIN_TEXT.kartenlinkLang }, "501");
  // In Zeichen gezählt wie char_length: 500 Umlaute sind 500, nicht 1000.
  assert.equal(kartenlinkProblem(vorn + "ä".repeat(KARTENLINK_MAX - vorn.length)), null);
  assert.deepEqual(kartenlinkOhneOrt({ ort: " ", ortLink: "https://x.ch" }), { feld: "ortLink", text: TERMIN_TEXT.kartenlinkOhneOrt });
  assert.equal(kartenlinkOhneOrt({ ort: "Halle", ortLink: "https://x.ch" }), null);
  assert.equal(terminProblem({ ...ok, ortLink: "https://x.ch" }), null);
  assert.deepEqual(terminProblem({ ...ok, ort: "", ortLink: "https://x.ch" }), { feld: "ortLink", text: TERMIN_TEXT.kartenlinkOhneOrt });
  assert.deepEqual(terminProblem({ ...ok, ortLink: "x.ch" }), { feld: "ortLink", text: TERMIN_TEXT.kartenlinkUngueltig });
});

pruefe("geaenderteFelder: Ort und Kartenlink gehen als Paar (#533)", () => {
  const start = { datum: "2026-10-08", beginn: "18:30", ende: "20:00", ort: "Allmend", ortLink: "https://x.ch/a", bemerkung: "" };
  assert.equal(geaenderteFelder({ ...start }, start), null);
  assert.deepEqual(geaenderteFelder({ ...start, ortLink: "https://x.ch/b" }, start), { ort: "Allmend", ortLink: "https://x.ch/b" }, "nur der Link");
  assert.deepEqual(geaenderteFelder({ ...start, ortLink: "" }, start), { ort: "Allmend", ortLink: "" }, "Link entfernen");
  assert.deepEqual(geaenderteFelder({ ...start, ort: "Halle", ortLink: "" }, start), { ort: "Halle", ortLink: "" }, "Ort neu, Link weg");
});

pruefe("Termin-Anzeige und -Marker: derselbe Satz vorab und aus der Datenbank", () => {
  assert.equal(zeitText("18:30", "20:00"), "18:30–20:00");
  for (const [marker, satz] of Object.entries(TERMIN_MELDUNG)) {
    const f = still(() => ausDbFehler({ message: `${marker}` }));
    assert.equal(f.meldung, satz, marker);
  }
  assert.match(kopieGebliebenText("Spielformen"), /«Spielformen» ist im Team-Bestand geblieben/);
  assert.equal(NICHT_GEFUNDEN.termin, "Termin nicht gefunden.");
});

pruefe("istVeraltet: trifft «seit der Auswahl geändert» und «gibt es nicht mehr», sonst nichts (PO 17)", () => {
  // Jeder Konflikt-Marker — auch ein später ergänzter — und beide Nicht-gefunden-Sätze.
  const saetze: Record<string, string> = { ...TERMIN_MELDUNG, ...SERIE_MELDUNG };
  for (const m of KONFLIKT_MARKER) assert.ok(istVeraltet(saetze[m]), m);
  assert.ok(istVeraltet(TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN));
  assert.ok(istVeraltet(TERMIN_MELDUNG.TRAINING_NICHT_GEFUNDEN));
  // Eine Meldung mit Zusatz (Kopie geblieben) bleibt veraltet: Präfix-Vergleich.
  assert.ok(istVeraltet(`${TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT} ${kopieGebliebenText("Spielformen")}`));
  // Regeln, die ein erneuter Versuch mit anderer Wahl löst, schliessen den Dialog nicht.
  assert.ok(!istVeraltet(TERMIN_MELDUNG.TRAINING_SCHON_EINGEPLANT));
  assert.ok(!istVeraltet(TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM));
  // Serien-Konflikte: Sätze aus SERIE_MELDUNG, Marker aus KONFLIKT_MARKER (#326).
  assert.ok(KONFLIKT_MARKER.includes("SERIE_GEAENDERT") && KONFLIKT_MARKER.includes("SERIE_BELEGUNG_GEAENDERT"));
  assert.ok(istVeraltet(SERIE_MELDUNG.SERIE_GEAENDERT));
  assert.ok(istVeraltet(SERIE_MELDUNG.SERIE_BELEGUNG_GEAENDERT));
  assert.ok(!istVeraltet(SERIE_MELDUNG.REICHWEITE_FEHLT));
  assert.ok(!istVeraltet(SERIE_MELDUNG.KEINE_AENDERUNG));
  assert.ok(!istVeraltet(undefined));
  assert.ok(!istVeraltet(""));
  assert.ok(!istVeraltet(TERMIN_TEXT.datum));
});

// ── Terminserien (#324 AK 2–6, #326 AK 5; Review Focus 2, 3) ─────────────────
pruefe("Serie: Enddatum höchstens am gleichen Kalendertag des Folgejahres, 29.2. → 28.2.", () => {
  assert.equal(maxEnddatum("2026-10-07"), "2027-10-07");
  assert.equal(maxEnddatum("2028-02-29"), "2029-02-28");
  assert.equal(maxEnddatum("2027-02-28"), "2028-02-28");
  const gut = { wochentage: [2, 4] as Wochentag[], von: "2026-10-01", bis: "2027-03-31", beginn: "18:00", ende: "19:30" };
  assert.equal(serieProblem(gut), null);
  assert.equal(serieProblem({ ...gut, von: "2028-02-29", bis: "2029-02-28" }), null);
  assert.deepEqual(serieProblem({ ...gut, von: "2028-02-29", bis: "2029-03-01" }), { feld: "bis", text: SERIE_TEXT.zuLang });
  assert.deepEqual(serieProblem({ ...gut, bis: "2026-09-30" }), { feld: "bis", text: SERIE_TEXT.endeVorBeginn });
  assert.deepEqual(serieProblem({ ...gut, wochentage: [] }), { feld: "wochentage", text: SERIE_TEXT.wochentage });
  // AK 6: kein gewählter Wochentag im Zeitraum.
  assert.deepEqual(serieProblem({ ...gut, wochentage: [6], von: "2026-10-05", bis: "2026-10-09" }), { feld: "wochentage", text: SERIE_TEXT.ohneTag });
  assert.deepEqual(serieProblem({ ...gut, ende: "17:00" }), { feld: "ende", text: TERMIN_TEXT.endeNachBeginn });
  assert.deepEqual(serieProblem({ ...gut, von: "2026-02-30" }), { feld: "von", text: TERMIN_TEXT.datum });
});

pruefe("Serie: Reichweiten je nach Änderung (#326 AK 1–4)", () => {
  assert.deepEqual(erlaubteReichweiten({ datum: false, regel: false }), ["nur_dieser", "dieser_und_folgende", "alle"]);
  assert.deepEqual(erlaubteReichweiten({ datum: true, regel: false }), ["nur_dieser"]);
  assert.deepEqual(erlaubteReichweiten({ datum: false, regel: true }), ["dieser_und_folgende", "alle"]);
  assert.equal(erlaubteReichweiten({ datum: true, regel: true }), null);
  const alt = { wochentage: [4, 2] as Wochentag[], beginnDatum: "2026-10-01", endDatum: "2027-03-31" };
  assert.equal(regelAenderung(alt, { wochentage: [2, 4], von: "2026-10-01", bis: "2027-03-31" }), null, "Reihenfolge zählt nicht");
  assert.deepEqual(regelAenderung(alt, { wochentage: [2, 4], von: "2026-10-01", bis: "2027-06-30" }), { bis: "2027-06-30" }, "nur das Geänderte");
  assert.deepEqual(regelAenderung(alt, { wochentage: [2, 5], von: "2026-09-01", bis: "2027-03-31" }), { wochentage: [2, 5], von: "2026-09-01" });
  assert.equal(SERIE_TEXT.datumUndRegel, "Datum und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern.");
});

pruefe("Termin: Wortlaut der Trainer-Meldungen (#325, #519 AK 11, 23)", () => {
  assert.equal(
    TERMIN_MELDUNG.NICHT_MEHR_MITGLIED,
    "Mindestens eine gewählte Person ist nicht mehr Mitglied des Teams. Sieh dir die Mitglieder noch einmal an.",
  );
  assert.equal(TRAINER_TEXT.kennungUngueltig, "Bitte nur Mitglieder des Teams als Trainer:innen wählen.");
  assert.equal(TRAINER_MELDUNG.VERANTWORTUNG_PFLICHT, TRAINER_TEXT.verantwortlichPflicht);
  for (const [marker, satz] of Object.entries(TRAINER_MELDUNG)) assert.equal(fehlerMeldung(`x ${marker} y`), satz, marker);
});

pruefe("Serie: namenlose Verantwortliche nur für diesen Termin (#325 PC 8)", () => {
  assert.deepEqual(erlaubteReichweiten({ datum: false, regel: false, namenlose: true }), ["nur_dieser"]);
  assert.equal(erlaubteReichweiten({ datum: false, regel: true, namenlose: true }), null);
  assert.deepEqual(erlaubteReichweiten({ datum: false, regel: false, namenlose: false }), ["nur_dieser", "dieser_und_folgende", "alle"]);
  assert.equal(SERIE_TEXT.namenloseNurEinzeln, "Ehemalige Mitglieder ohne Namen lassen sich nur für diesen einen Termin entfernen.");
  assert.equal(
    SERIE_TEXT.namenloseUndRegel,
    "Ehemalige Mitglieder ohne Namen und Wochentage oder Zeitraum lassen sich nicht in einem Schritt ändern.",
  );
});

pruefe("Serie: Obergrenze vor der Wahl der Reichweite (#326 AK 5, PC 19; Review Focus 2)", () => {
  const serie = { beginnDatum: "2028-02-01" };
  // Beginn unverändert: Für «dieser und folgende» beginnt die Teilserie am Termin.
  assert.equal(obergrenzeVorab(serie, { von: "2028-02-01" }, "2028-02-29"), "2029-02-28", "29.2. → 28.2.");
  assert.equal(obergrenzeVorab(serie, { von: "2028-02-01" }, "2028-06-15"), "2029-06-15");
  // Beginn verschoben: dann zählt er, für jede Reichweite.
  assert.equal(obergrenzeVorab(serie, { von: "2028-02-29" }, "2028-06-15"), "2029-02-28");
  // Ein verlegter Termin vor dem Serienbeginn weitet nichts.
  assert.equal(obergrenzeVorab(serie, { von: "2028-02-01" }, "2028-01-20"), "2029-02-01");
  const regel = { wochentage: [2] as Wochentag[], von: "2028-02-01", bis: "2029-02-20" };
  assert.equal(regelProblemVorab(serie, regel, "2028-02-29"), null, "nur die engere Grenze («alle») verletzt");
  assert.deepEqual(regelProblemVorab(serie, { ...regel, bis: "2029-03-01" }, "2028-02-29"), { feld: "bis", text: SERIE_TEXT.zuLang });
  assert.deepEqual(regelProblemVorab(serie, { ...regel, von: "2028-02-29" }, "2028-06-15"), null, "verschobener Beginn, innerhalb");
  assert.deepEqual(regelProblemVorab(serie, { ...regel, von: "2028-02-29", bis: "2029-03-01" }, "2028-06-15"), { feld: "bis", text: SERIE_TEXT.zuLang });
  assert.deepEqual(regelProblemVorab(serie, { ...regel, wochentage: [] }, "2028-02-29"), { feld: "wochentage", text: SERIE_TEXT.wochentage });
});

pruefe("Serie: Rand der Jahre (9999) endet, kein fünfstelliges Jahr", () => {
  // Früher lief plusTage("9999-12-31", 1) in «0NaN-…» und die Schleife endete nie.
  const freitage = serienTage([5], "9998-12-31", "9999-12-31");
  assert.equal(freitage.length, 53);
  assert.equal(freitage[0], "9999-01-01", "9999-01-01 ist ein Freitag");
  assert.equal(freitage.at(-1), "9999-12-31", "auch 9999-12-31");
  assert.equal(maxEnddatum("9999-06-01"), "9999-12-31");
  assert.equal(maxEnddatum("9998-12-31"), "9999-12-31");
  assert.equal(serieProblem({ wochentage: [5], von: "9998-12-31", bis: "9999-12-31", beginn: "18:00", ende: "19:00" }), null);
  assert.deepEqual(serienTage([1], "2026-10-05", "2026-10-05"), ["2026-10-05"], "ein Tag");
});

pruefe("Serie: Tage, Wochentage", () => {
  assert.deepEqual(serienTage([2, 4], "2026-10-01", "2026-10-08"), ["2026-10-01", "2026-10-06", "2026-10-08"]);
  assert.equal(wochentagVon("2026-10-04"), 7, "Sonntag");
  assert.equal(wochentagVon("2026-10-05"), 1, "Montag");
  // Zeitumstellung am 25.10.2026 verschiebt keinen Tag.
  assert.deepEqual(serienTage([7], "2026-10-24", "2026-11-01"), ["2026-10-25", "2026-11-01"]);
  assert.equal(wochentageText([2, 4]), "Di, Do");
  assert.equal(alsWochentag("so"), 7);
  assert.equal(alsKiWochentag(1), "mo");
});

pruefe("Serien-Marker: vorab und aus der Datenbank derselbe Satz", () => {
  for (const [marker, satz] of Object.entries(SERIE_MELDUNG))
    assert.equal(still(() => ausDbFehler({ message: marker })).meldung, satz, marker);
  assert.equal(SERIE_MELDUNG.SERIE_OHNE_ZEITRAUM, TERMIN_TEXT.datum, "vorab und aus der Datenbank wortgleich");
  assert.deepEqual(serieProblem({ wochentage: [2], von: "", bis: "2026-10-31" }), { feld: "von", text: SERIE_MELDUNG.SERIE_OHNE_ZEITRAUM });
  assert.match(vergangeneBestaetigen(3), /3 vergangene Termine.*«bestaetigt: true»/);
});

pruefe("Serien-Marker: kein Marker steckt in einem anderen (includes-Suche bleibt eindeutig)", () => {
  // Alle Tabellen, die `weitereMeldung` (training-bedingungen) per includes durchsucht.
  const alle = [
    ...Object.keys(UEBUNGSFOLGE_MELDUNG),
    ...Object.keys(VARIANTENFOLGE_MELDUNG),
    ...Object.keys(TERMIN_MELDUNG),
    ...Object.keys(SERIE_MELDUNG),
    ...Object.keys(SPIELER_MELDUNG),
    ...Object.keys(KADER_MELDUNG),
    ...Object.keys(SPIEL_MELDUNG),
    ...Object.keys(TRAINER_MELDUNG),
    ...Object.keys(PROBE_MELDUNG),
    ...Object.keys(VEREIN_MELDUNG),
    // Die Grenzen eines Kontos ohne Verein (#588): Marker mit Bestand dahinter.
    ...Object.values(KONTO_MARKER),
    // Wird vor der Übersetzung abgefangen (lib/kern/kader.ts), darf aber
    // keinen Satz treffen.
    VERFALL_MARKER,
  ];
  assert.equal(new Set(alle).size, alle.length, "Marker doppelt vergeben");
  for (const a of alle)
    for (const b of alle) if (a !== b) assert.ok(!b.includes(a), `${a} steckt in ${b}`);
});

pruefe("geaenderteFelder: nur Geändertes, Beginn und Ende als Paar, nichts geändert = null (PO 17)", () => {
  const start = { datum: "2026-10-08", beginn: "18:30", ende: "20:00", ort: "Allmend", bemerkung: "" };
  assert.equal(geaenderteFelder({ ...start }, start), null, "unverändert");
  assert.equal(geaenderteFelder({ ...start, ort: " Allmend " }, start), null, "Leerraum ist keine Änderung");
  assert.deepEqual(geaenderteFelder({ ...start, ort: "Halle" }, start), { ort: "Halle", ortLink: "" }, "Ort und Kartenlink als Paar (#533)");
  assert.deepEqual(geaenderteFelder({ ...start, ort: "" }, start), { ort: "", ortLink: "" }, "leeren");
  assert.deepEqual(geaenderteFelder({ ...start, bemerkung: "Bälle" }, start), { bemerkung: "Bälle" });
  // #590: der Hinweis für Eltern für sich, leer heisst leeren.
  assert.deepEqual(geaenderteFelder({ ...start, hinweisEltern: "Pincode 4702" }, start), { hinweisEltern: "Pincode 4702" });
  assert.deepEqual(geaenderteFelder(start, { ...start, hinweisEltern: "Pincode 4702" }), { hinweisEltern: "" });
  assert.deepEqual(geaenderteFelder({ ...start, datum: "2026-10-09" }, start), { datum: "2026-10-09" });
  assert.deepEqual(geaenderteFelder({ ...start, ende: "20:30" }, start), { beginn: "18:30", ende: "20:30" }, "Paar");
  assert.deepEqual(geaenderteFelder({ ...start, beginn: "18:00" }, start), { beginn: "18:00", ende: "20:00" }, "Paar");
  assert.deepEqual(
    geaenderteFelder({ ...start, datum: "2026-10-09", ort: "Halle" }, start),
    { datum: "2026-10-09", ort: "Halle", ortLink: "" },
    "Zeit bleibt draussen",
  );
});

// ── Felder eines Termins (#389) ─────────────────────────────────────────────
const KUNSTRASEN: Feld = { laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0, tor_7m: null }, untergrund: "kunstrasen" };
const UNBEKANNT: Feld = { laenge_m: null, breite_m: null, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: null };

pruefe("Felder: gültig, ungültig und die Stelle des Fehlers (#389 AK 2–6, 9)", () => {
  assert.equal(felderProblem(null), null, "ohne Felder (AK 8)");
  assert.equal(felderProblem([KUNSTRASEN]), null);
  assert.equal(felderProblem([KUNSTRASEN, UNBEKANNT, KUNSTRASEN]), null, "mehrere, ein Feld ganz ohne Angaben (AK 5)");
  assert.equal(felderProblem([{ ...KUNSTRASEN, laenge_m: 5, breite_m: 120 }]), null, "Grenzen eingeschlossen");
  assert.equal(felderProblem([{ ...KUNSTRASEN, tore: { minitor: 0, tor_5m: 0, tor_7m: 0 } }]), null, "0 = keine (AK 6)");
  assert.equal(felderProblem([{ ...KUNSTRASEN, tore: { minitor: 1000, tor_5m: null, tor_7m: null } }]), null, "keine Obergrenze (PO 6)");
  for (const u of UNTERGRUENDE) assert.equal(felderProblem([{ ...KUNSTRASEN, untergrund: u }]), null, u);

  // AK 9: nur gemeinsam, nur ganze Meter 5 bis 120.
  assert.deepEqual(felderProblem([KUNSTRASEN, { ...UNBEKANNT, laenge_m: 30 }]), { index: 1, teil: "breite_m", text: MASS_TEXT.paarweise });
  assert.deepEqual(felderProblem([{ ...UNBEKANNT, breite_m: 30 }]), { index: 0, teil: "laenge_m", text: MASS_TEXT.paarweise });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, laenge_m: 4 }]), { index: 0, teil: "laenge_m", text: MASS_TEXT.bereich });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, breite_m: 121 }]), { index: 0, teil: "breite_m", text: MASS_TEXT.bereich });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, laenge_m: 30.5 }]), { index: 0, teil: "laenge_m", text: MASS_TEXT.bereich });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, laenge_m: Number.NaN }]), { index: 0, teil: "laenge_m", text: MASS_TEXT.bereich });
  // Wortgleich mit der Spielfeldgrösse einer Übung (PO 6 «wie bei Übungen»).
  assert.equal(MASS_TEXT.paarweise, "Bitte Länge und Breite angeben oder beides leer lassen.");
  assert.equal(MASS_TEXT.bereich, "Länge und Breite in ganzen Metern, zwischen 5 und 120.");

  const tore = (t: Partial<Feld["tore"]>) => [{ ...KUNSTRASEN, tore: { ...KUNSTRASEN.tore, ...t } }];
  assert.deepEqual(felderProblem(tore({ tor_5m: -1 })), { index: 0, teil: "tore.tor_5m", text: FELDER_TEXT.tore });
  assert.deepEqual(felderProblem(tore({ tor_7m: 1.5 })), { index: 0, teil: "tore.tor_7m", text: FELDER_TEXT.tore });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, untergrund: "sand" }]), { index: 0, teil: "untergrund", text: FELDER_TEXT.untergrund });
  // Form: nur über den KI-Weg erreichbar.
  assert.deepEqual(felderProblem([]), { index: null, teil: null, text: FELDER_TEXT.form });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, extra: 1 }]), { index: 0, teil: null, text: FELDER_TEXT.form });
  assert.deepEqual(felderProblem([{ ...KUNSTRASEN, tore: { minitor: 1 } }]), { index: 0, teil: null, text: FELDER_TEXT.form });
  assert.deepEqual(felderProblem([null]), { index: 0, teil: null, text: FELDER_TEXT.form });
  assert.equal(felderPfad({ index: 1, teil: "tore.minitor", text: "" }), "felder[1].tore.minitor");
  assert.equal(felderPfad({ index: 0, teil: null, text: "" }), "felder[0]");
  assert.equal(felderPfad({ index: null, teil: null, text: "" }), "felder");
});

pruefe("Felder: Normalform, Vergleich, geänderte Felder (#389 AK 5, 7)", () => {
  // Fehlende Angaben sind unbekannt; [] heisst ohne Felder.
  assert.deepEqual(normalisiereFelder([{ laenge_m: 30, breite_m: 25, untergrund: "halle" }]), [
    { laenge_m: 30, breite_m: 25, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: "halle" },
  ]);
  assert.deepEqual(normalisiereFelder([{ tore: { tor_5m: 2 } }]), [{ ...UNBEKANNT, tore: { minitor: null, tor_5m: 2, tor_7m: null } }]);
  assert.equal(normalisiereFelder([]), null);
  // Eine präparierte Nutzlast (keine Liste) ergibt die Fachmeldung, keinen TypeError.
  for (const roh of ["x", 3, { laenge_m: 30 }, true] as unknown[])
    assert.deepEqual(felderProblem(normalisiereFelder(roh as never)), { index: null, teil: null, text: FELDER_TEXT.form }, String(roh));
  assert.deepEqual(felderProblem(normalisiereFelder(["x"] as never)), { index: 0, teil: null, text: FELDER_TEXT.form });
  assert.equal(normalisiereFelder(undefined), null);
  // jsonb kommt mit anderer Schlüsselfolge zurück — gleich bleibt gleich.
  const umgestellt = { untergrund: "kunstrasen", tore: { tor_7m: null, tor_5m: 0, minitor: 2 }, breite_m: 25, laenge_m: 30 };
  assert.ok(gleicheFelder([umgestellt], [KUNSTRASEN]));
  assert.ok(gleicheFelder(null, []) && gleicheFelder(undefined, null));
  assert.ok(!gleicheFelder([KUNSTRASEN], [{ ...KUNSTRASEN, tore: { ...KUNSTRASEN.tore, tor_7m: 0 } }]), "unbekannt ≠ keine");

  const start = { datum: "2026-10-08", beginn: "18:30", ende: "20:00", ort: "", bemerkung: "", felder: [KUNSTRASEN] };
  assert.equal(geaenderteFelder({ ...start, felder: [umgestellt as Feld] }, start), null, "nur umgestellt: nichts senden");
  assert.deepEqual(geaenderteFelder({ ...start, felder: [KUNSTRASEN, UNBEKANNT] }, start), { felder: [KUNSTRASEN, UNBEKANNT] }, "ganze Liste");
  assert.deepEqual(geaenderteFelder({ ...start, felder: null }, start), { felder: null }, "entfernen");
  assert.deepEqual(geaenderteFelder({ ...start, felder: [{ ...KUNSTRASEN, untergrund: null }], ort: "Allmend" }, start), {
    ort: "Allmend",
    ortLink: "",
    felder: [{ ...KUNSTRASEN, untergrund: null }],
  });
  const ohne = { ...start, felder: null };
  assert.equal(geaenderteFelder({ ...ohne }, ohne), null);
});

pruefe("Felder: Anzeige knapp und ausführlich, unbekannt ≠ keine (#389 AK 10, 11)", () => {
  assert.equal(felderKurz(null), null, "ohne Felder steht nichts");
  assert.equal(felderKurz([KUNSTRASEN]), "30 × 25 m · Kunstrasen");
  assert.equal(felderKurz([UNBEKANNT]), "1 Feld");
  assert.equal(felderKurz([{ ...UNBEKANNT, untergrund: "halle" }]), "Halle");
  assert.equal(felderKurz([KUNSTRASEN, UNBEKANNT]), "2 Felder");
  assert.equal(feldText(KUNSTRASEN), "30 × 25 m · Minitore: 2, 5-m-Tore: keine · Kunstrasen");
  assert.equal(feldText(UNBEKANNT), "Grösse unbekannt · Tore unbekannt · Untergrund unbekannt");
  assert.equal(toreText({ minitor: 1, tor_5m: 2, tor_7m: 3 }), "Minitore: 1, 5-m-Tore: 2, 7-m-Tore: 3", "nie eine Zahl direkt vor «5-m»");
  assert.equal(toreText({ minitor: null, tor_5m: 0, tor_7m: null }), "5-m-Tore: keine", "unbekannte fehlen");
  assert.equal(feldName(0, 1), "Feld");
  assert.equal(feldName(1, 3), "Feld 2");
  assert.equal(toreText({ minitor: null, tor_5m: null, tor_7m: null }), null);
});

pruefe("Felder: der CHECK der Datenebene als Klartext, eine Regel (#389 AK 15)", () => {
  const db = 'new row for relation "training_termine" violates check constraint "tt_felder"';
  assert.equal(still(() => fehlerMeldung(db)), FELDER_TEXT.ungueltig);
  assert.equal(still(() => ausDbFehler({ message: db })).art, "regel");
  // Der Name trifft nur sich selbst, nicht eine längere Bezeichnung.
  assert.equal(fachlicheMeldung('violates check constraint "tt_felder_abweichend"'), null);
});

pruefe("Serie: Felder und Spielerzahl mit denselben Sätzen, jede Reichweite, folgen (#391 AK 2, 6, 10)", () => {
  // Die CHECKs der Serie sagen dasselbe wie die des Termins.
  const serie = (name: string) => `new row for relation "termin_serien" violates check constraint "${name}"`;
  assert.equal(still(() => fehlerMeldung(serie("ts_felder"))), FELDER_TEXT.ungueltig);
  assert.equal(still(() => fehlerMeldung(serie("ts_spielerzahl"))), TERMIN_TEXT.spielerzahl);
  // Felder und Spielerzahl lassen jede Reichweite zu: Sie zählen nicht als Regel und nicht als Datum.
  assert.deepEqual(erlaubteReichweiten({ datum: false, regel: false }), ["nur_dieser", "dieser_und_folgende", "alle"]);
  assert.equal(
    SERIE_MELDUNG.SERIE_ANGABEN_UNGUELTIG,
    "Wähle, welche Angaben wieder der Serie folgen sollen: Zeit, Ort, Bemerkung, Hinweis am privaten Link, Treffpunkt, Eingeladene, Verantwortung, Mindestbesetzung, Felder, Spielerzahl oder Kader.",
  );
});

pruefe("Felder: KI-Ausgabe und -Eingabe (#389 AK 12–14)", () => {
  assert.deepEqual(felderAusgabe([KUNSTRASEN, UNBEKANNT]), [
    { ...KUNSTRASEN, untergrund: { slug: "kunstrasen", label: "Kunstrasen" } },
    UNBEKANNT,
  ]);
  assert.equal(felderAusgabe(null), null);
  felderSchema(true).parse(felderAusgabe([KUNSTRASEN, UNBEKANNT]));
  // Die Eingabe lässt durch, was der Kern mit dem Satz der Oberfläche abweist
  // (AK 15) — eine halbe Zahl, ein fremder Untergrund, ein fehlender Teil.
  const roh = [{ laenge_m: 30.5, breite_m: 25, untergrund: "sand" }, { tore: { minitor: -1 } }];
  assert.deepEqual(FelderEingabe.parse(roh), roh);
  assert.deepEqual(felderProblem(normalisiereFelder(FelderEingabe.parse(roh))), {
    index: 0,
    teil: "laenge_m",
    text: MASS_TEXT.bereich,
  });
  assert.match(FELDER_MODELL, /null heisst unbekannt, 0 Tore heisst: keine/);
});

// ── Erwartete Spielerzahl (#390) ────────────────────────────────────────────
pruefe("Spielerzahl: ganze Zahl von 1 bis 200, null = unbekannt, ein Satz für Oberfläche und KI (#390 AK 3, 7)", () => {
  for (const ok of [null, 1, 12, 200]) assert.equal(spielerzahlProblem(ok), null, String(ok));
  const satz = "Die erwartete Spielerzahl ist eine ganze Zahl von 1 bis 200.";
  assert.equal(TERMIN_TEXT.spielerzahl, satz);
  for (const schlecht of [0, -3, 201, 12.5, Number.NaN, "12", undefined])
    assert.deepEqual(spielerzahlProblem(schlecht), { feld: "erwartete_spielerzahl", text: satz }, String(schlecht));
  // Das Formular: leer heisst unbekannt, sonst die getippte Zahl.
  assert.equal(zahlOderNull(""), null);
  assert.equal(zahlOderNull(" 12 "), 12);
  assert.ok(Number.isNaN(zahlOderNull("x")));
  // Die Datenebene als Rückhalt: derselbe Satz, eine Regel.
  const db = 'new row for relation "training_termine" violates check constraint "tt_spielerzahl"';
  assert.equal(still(() => fehlerMeldung(db)), satz);
  assert.equal(still(() => ausDbFehler({ message: db })).art, "regel");
});

pruefe("Spielerzahl: geändert, entfernt, Anzeige, KI-Schema (#390 AK 2, 4–6)", () => {
  const start = { datum: "2026-10-08", beginn: "18:30", ende: "20:00", ort: "", bemerkung: "", spielerzahl: 12 };
  assert.equal(geaenderteFelder({ ...start }, start), null);
  assert.deepEqual(geaenderteFelder({ ...start, spielerzahl: 14 }, start), { spielerzahl: 14 });
  assert.deepEqual(geaenderteFelder({ ...start, spielerzahl: null }, start), { spielerzahl: null }, "entfernen");
  assert.equal(geaenderteFelder({ ...start, spielerzahl: null }, { ...start, spielerzahl: undefined }), null);
  assert.equal(spielerzahlText(12), "12 Spieler:innen");
  assert.equal(spielerzahlText(1), "1 Spieler:in");
  assert.equal(spielerzahlSchema().parse(null), null);
  assert.throws(() => spielerzahlSchema().parse(12.5));
  // Die Eingabe lässt eine halbe Zahl durch — der Kern weist sie mit dem Satz der Oberfläche ab.
  assert.equal(SpielerzahlEingabe.parse(12.5), 12.5);
  assert.match(SPIELERZAHL_MODELL, /einschliesslich Torhüter:innen, ohne Trainer:innen/);
  assert.match(SPIELERZAHL_MODELL, /null heisst unbekannt/);
});

pruefe("Erfolgstexte und Nicht-gefunden-Sätze haben je eine Quelle", () => {
  assert.equal(ZUORDNEN_ERFOLG, "Training zugeordnet.");
  assert.equal(NICHT_GEFUNDEN.termin, TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN);
  assert.equal(NICHT_GEFUNDEN.training, TERMIN_MELDUNG.TRAINING_NICHT_GEFUNDEN);
});

// ── Durchlauf (#194 AK 8, PC 3, NFR 1) ──────────────────────────────────────
// Editor und Auskunft rechnen mit derselben Verteilung (`verteilungAus`); im
// Juniorenfussball zählt der Wechsel über BEIDE Hauptteil-Blöcke.

const ROT = { id: "g-rot", name: "Rot" };
const BLAU = { id: "g-blau", name: "Blau" };

pruefe("verteilungAus: nur Hauptteil, Anzeigereihenfolge, lokale Folge vor Serverstand", () => {
  const zuordnungen = [
    fassung("e1", "einleitung", { gruppen: [ROT] }),
    fassung("s1", "jun-spielformen", { durationMin: 15, gruppen: [ROT, BLAU] }),
    fassung("s2", "jun-spiel", { gruppen: [BLAU] }),
  ];
  assert.deepEqual(verteilungAus(zuordnungen), [
    { id: "s1", name: "Übung s1", einordnung: "jun-spielformen", dauer: 15, gruppen: ["g-rot", "g-blau"] },
    { id: "s2", name: "Übung s2", einordnung: "jun-spiel", dauer: null, gruppen: ["g-blau"] },
  ]);
  const lokal = verteilungAus(zuordnungen, (f) => (f.id === "s2" ? [] : undefined));
  assert.deepEqual(lokal.map((f) => f.gruppen), [["g-rot", "g-blau"], []]);
});

pruefe("Auskunft Juniorenfussball: Wechsel über beide Hauptteil-Blöcke, an_uebungen, Zeit je Gruppe", () => {
  const a = trainingAuskunft(
    training({
      altersstufe: "juniorenfussball",
      stufen: ["D"],
      gruppen: [ROT, BLAU],
      exercises: [
        fassung("s1", "jun-spielformen", { varianteId: "v1", durationMin: 15, gruppen: [ROT, BLAU] }),
        fassung("s2", "jun-spiel", { varianteId: "v1", durationMin: 15, gruppen: [BLAU, ROT] }),
        fassung("s3", "jun-spiel", { varianteId: "v1", durationMin: 10, gruppen: [] }),
      ],
    }),
    { userId: ICH },
  );
  assert.deepEqual(a.gruppen, [
    { id: "g-rot", name: "Rot", an_uebungen: 2 },
    { id: "g-blau", name: "Blau", an_uebungen: 2 },
  ]);
  assert.equal(a.durchlauf.length, 1);
  const [d] = a.durchlauf;
  assert.equal(d.variante_id, undefined, "erst ab zwei Varianten");
  assert.equal(d.wechsel_zahl, 2);
  assert.deepEqual(d.wechsel, [
    {
      nr: 1,
      belegung: [
        { gruppe_id: "g-rot", gruppe: "Rot", fassung_id: "s1", uebung: "Übung s1" },
        { gruppe_id: "g-blau", gruppe: "Blau", fassung_id: "s2", uebung: "Übung s2" },
      ],
    },
    {
      nr: 2,
      belegung: [
        { gruppe_id: "g-rot", gruppe: "Rot", fassung_id: "s2", uebung: "Übung s2" },
        { gruppe_id: "g-blau", gruppe: "Blau", fassung_id: "s1", uebung: "Übung s1" },
      ],
    },
  ]);
  assert.deepEqual(d.zeit_je_gruppe, [
    { gruppe_id: "g-rot", gruppe: "Rot", text: "Zugewiesen 30 min" },
    { gruppe_id: "g-blau", gruppe: "Blau", text: "Zugewiesen 30 min" },
  ]);
});

pruefe("Auskunft: Durchlauf je Variante, an_uebungen über alle Varianten, Gruppe ohne Zuweisung", () => {
  const a = trainingAuskunft(
    training({
      gruppen: [ROT, BLAU],
      varianten: [
        { id: "v1", name: "12 Kinder" },
        { id: "v2", name: "20 Kinder" },
      ],
      exercises: [
        fassung("h1", "hauptteil", { hauptteilkategorie: "fussball-spielen", varianteId: "v1", durationMin: 20, gruppen: [ROT] }),
        fassung("h2", "hauptteil", { hauptteilkategorie: "fussball-spielen", varianteId: "v2", gruppen: [ROT] }),
      ],
    }),
    { userId: ICH },
  );
  assert.deepEqual(a.gruppen.map((g) => g.an_uebungen), [2, 0]);
  assert.deepEqual(a.durchlauf.map((d) => [d.variante_id, d.wechsel_zahl]), [["v1", 1], ["v2", 1]]);
  assert.deepEqual(a.durchlauf[0].zeit_je_gruppe.map((z) => z.text), [
    "Zugewiesen 20 min in dieser Variante",
    "Zugewiesen -",
  ]);
  assert.deepEqual(a.durchlauf[1].zeit_je_gruppe.map((z) => z.text), ["Zugewiesen -", "Zugewiesen -"]);
  // Ohne Gruppen gibt es keinen Wechsel.
  const leer = trainingAuskunft(training({}), { userId: ICH });
  assert.deepEqual(leer.durchlauf, [{ wechsel_zahl: 0, wechsel: [], zeit_je_gruppe: [] }]);
});

// ── Übungsinhalt über den KI-Weg (#143) ─────────────────────────────────────
const KIFU: Altersstufe = "kinderfussball";
const JUN: Altersstufe = "juniorenfussball";
const pruefeInhalt = (i: UebungInhalt, stufe: Altersstufe = KIFU) =>
  pruefeUebungsInhalt(i, { altersstufe: stufe });
const funde = (p: Pruefung): Fund[] => (p.ok ? [] : p.funde);
const felder = (p: Pruefung) => funde(p).map((f) => f.feld);

/** Eine Eingabe mit genau den Pflichtangaben dieser Einordnung, ohne `ohne`. */
function nurPflicht(stufe: Altersstufe, einordnung: string, hkat: string | null, ohne?: string): UebungInhalt {
  const werte: Record<string, Partial<UebungInhalt>> = {
    name: { name: "Probe" },
    einordnung: { einordnung },
    kategorien: { kategorien: [kategorienFuer(stufe)[0]] },
    hauptteilkategorie: { hauptteilkategorie: hkat },
    offen_starten: { offenStarten: "Offen starten" },
    ueben: { ueben: "Üben" },
    wetteifern: { wetteifern: "Wetteifern" },
    aufbau: { aufbau: "Aufbau" },
  };
  return Object.assign(
    { name: "", einordnung: "", kategorien: [] },
    ...pflichtangaben(stufe, einordnung, hkat)
      .filter((f) => f !== ohne)
      .map((f) => werte[f]),
  );
}

/** Genau ein Verstoss an diesem Feld, mit dieser Meldung und Art. */
function einziger(p: Pruefung, feld: string, meldung: string, art: Fund["art"] = "regel") {
  assert.deepEqual(felder(p), [feld]);
  assert.equal(funde(p)[0].meldung, meldung);
  assert.equal(funde(p)[0].art, art);
  return funde(p)[0];
}

const EINLEITUNG = nurPflicht(KIFU, "einleitung", null);
const AUFFANGEN = nurPflicht(KIFU, "auffangen", null);
const JUN_SPIEL = nurPflicht(JUN, "jun-spiel", null);

pruefe("Übungsinhalt: eine vollständige Einleitung ergibt die Zeile des Formulars", () => {
  const p = pruefeInhalt({
    ...EINLEITUNG,
    kategorien: ["F", "E", "F"],
    ueben: ["- links", "- rechts"],
    varianten: "Mit zwei Bällen",
    erscheinungsformen: ["mutig-tore-erzielen"],
    feldtyp: "freies_feld",
    spielfeld: { laengeM: 20, breiteM: 15 },
    anzahlKinder: { min: 6, max: 8 },
    material: { liste: [{ art: "pylone", menge: 4 }, { art: "pylone", farbe: "orange", menge: 2 }], ergaenzung: ["Pfeife"] },
  });
  assert.ok(p.ok, JSON.stringify(funde(p)));
  assert.deepEqual(p.row, {
    name: "Probe",
    altersstufe: "kinderfussball",
    trainingsteil: "einleitung",
    kategorien: ["F", "E"],
    feldtyp: "freies_feld",
    spielfeld_laenge_m: 20,
    spielfeld_breite_m: 15,
    erscheinungsform: ["mutig-tore-erzielen"],
    hauptteilkategorie: null,
    anzahl_kinder: { min: 6, max: 8 },
    // Normalform: ohne Farbe die des Diagramms, gleiche Posten zusammengezählt.
    material_liste: [{ art: "pylone", farbe: "orange", menge: 6 }],
    material: ["Pfeife"],
    uebungstyp: null,
    methodischer_fahrplan: { offen_starten: "Offen starten", ueben: ["- links", "- rechts"], wetteifern: "Wetteifern" },
    aufbau: null,
    varianten_text: "Mit zwei Bällen",
  });
  // Ohne Materialliste bleibt sie aus der Zeile — dann gilt der Default;
  // `null` an einem Teil heisst beim Anlegen dasselbe wie weglassen.
  const ohne = pruefeInhalt(EINLEITUNG);
  assert.ok(ohne.ok && !("material_liste" in ohne.row));
  const leer = pruefeInhalt({ ...EINLEITUNG, material: { liste: null, ergaenzung: null } });
  assert.ok(leer.ok && !("material_liste" in leer.row) && isDeepStrictEqual(leer.row.material, []));
});

pruefe("Übungsinhalt: Pflichtvertrag - pflichtangaben genügt, jede fehlende nennt genau ihr Feld", () => {
  // Bindet die erzeugte Beschreibung (angabenText) an das echte Verhalten von
  // parseUebungsInhalt, in beiden Altersstufen (#143 AK 1, #147 AK 1).
  for (const stufe of ALTERSSTUFEN)
    for (const e of einordnungsSlugsFuer(stufe))
      for (const h of traegtHauptteilkategorie(stufe, e) ? hauptteilkategorieSlugs : [null]) {
        const wo = `${stufe}/${e}/${h}`;
        const voll = pruefeInhalt(nurPflicht(stufe, e, h), stufe);
        assert.ok(voll.ok, `${wo}: ${JSON.stringify(funde(voll))}`);
        for (const f of pflichtangaben(stufe, e, h))
          assert.deepEqual(felder(pruefeInhalt(nurPflicht(stufe, e, h, f), stufe)), [f], `${wo} ohne ${f}`);
      }
});

pruefe("Übungsinhalt: Pflichttexte wortgleich mit dem Formular, samt Werten", () => {
  einziger(pruefeInhalt({ ...EINLEITUNG, name: "  " }), "name", "Bitte einen Namen angeben.", "eingabe");
  const k = einziger(
    pruefeInhalt({ ...EINLEITUNG, kategorien: [] }),
    "kategorien",
    "Bitte mindestens eine Alterskategorie wählen.",
    "eingabe",
  );
  assert.deepEqual(k.zulaessig, ["G", "F", "E"]);
  const h = einziger(
    pruefeInhalt(nurPflicht(KIFU, "hauptteil", "fussball-spielen", "hauptteilkategorie")),
    "hauptteilkategorie",
    "Bitte eine Hauptteilkategorie wählen. Bei «fussball-spielen» steht der Ablauf in «aufbau», " +
      "sonst in «offen_starten», «ueben» und «wetteifern».",
    "eingabe",
  );
  assert.deepEqual(h.zulaessig, hauptteilkategorieSlugs);
  einziger(pruefeInhalt({ ...AUFFANGEN, aufbau: null }), "aufbau", "Bitte den Aufbau beschreiben.", "eingabe");
  einziger(
    pruefeInhalt({ ...EINLEITUNG, anzahlKinder: { min: 8, max: 6 } }),
    "anzahl_kinder.max",
    "Die Maximalanzahl darf nicht kleiner als die Mindestanzahl sein.",
    "eingabe",
  );
  einziger(
    pruefeInhalt({ ...JUN_SPIEL, spielfeld: { laengeM: 4, breiteM: 20 } }, JUN),
    "spielfeld",
    "Länge und Breite in ganzen Metern, zwischen 5 und 120.",
    "eingabe",
  );
});

pruefe("Übungsinhalt: was das Formular still verwürfe, ist ein benannter Verstoss (#143 AK 5)", () => {
  einziger(
    pruefeInhalt({ ...EINLEITUNG, hauptteilkategorie: "fussball-spielen" }),
    "hauptteilkategorie",
    "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
  );
  einziger(
    pruefeInhalt({ ...nurPflicht(KIFU, "hauptteil", "fussball-spielen"), offenStarten: "x" }),
    "offen_starten",
    "Hier gibt es keinen methodischen Fahrplan - der Ablauf steht in «aufbau».",
  );
  einziger(
    pruefeInhalt({ ...EINLEITUNG, aufbau: "x" }),
    "aufbau",
    "Hier gilt der methodische Fahrplan («offen_starten», «ueben», «wetteifern»), nicht «aufbau».",
  );
  const form = einziger(
    pruefeInhalt({ ...EINLEITUNG, erscheinungsformen: ["mutig-tore-erzielen", "schnell-umschalten"] }),
    "erscheinungsformen",
    "Diese Erscheinungsform gehört zum Manual der anderen Altersstufe. Nicht zulässig: schnell-umschalten.",
  );
  assert.deepEqual(form.zulaessig, erscheinungsformSlugs);
  einziger(
    pruefeInhalt({ ...AUFFANGEN, erscheinungsformen: ["mutig-tore-erzielen"] }),
    "erscheinungsformen",
    "Diese Einordnung trägt keine Erscheinungsform.",
  );
  einziger(pruefeInhalt({ ...JUN_SPIEL, feldtyp: "kleinfeld" }, JUN), "feldtyp", fachlicheMeldung("ex_feldtyp_nur_kifu")!);
  einziger(
    pruefeInhalt({ ...EINLEITUNG, feldtyp: "kleinfeld", spielfeld: { laengeM: 20, breiteM: 15 } }),
    "spielfeld",
    "Eine Kinderfussball-Übung trägt eine Spielfeldgrösse nur auf freiem Feld; Kleinfeld und Grossfeld haben ihre Masse.",
  );
  // Im Kinderfussball gibt es keinen Übungstyp; die Meldung der Datenebene
  // nennt die Junioren-Blöcke und gilt darum nur dort.
  einziger(
    pruefeInhalt({ ...EINLEITUNG, uebungstyp: "spielform" }),
    "uebungstyp",
    "Den Übungstyp gibt es nur im Juniorenfussball - lass «uebungstyp» weg.",
  );
  einziger(
    pruefeInhalt({ ...nurPflicht(JUN, "jun-abschluss", null), uebungstyp: "spielform" }, JUN),
    "uebungstyp",
    fachlicheMeldung("ex_uebungstyp_nur_junioren")!,
  );
  const kat = einziger(
    pruefeInhalt({ ...EINLEITUNG, kategorien: ["F", "D", "C"] }),
    "kategorien",
    "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung. Nicht zulässig: D, C.",
  );
  assert.deepEqual(kat.zulaessig, ["G", "F", "E"]);
  // Eine Einordnung der anderen Altersstufe — ohne Folgefehler am Ablauf,
  // obwohl dort Fahrplan und Beschreibung zugleich stehen.
  const e = einziger(
    pruefeInhalt({ ...EINLEITUNG, einordnung: "jun-spiel", aufbau: "x", erscheinungsformen: ["schnell-umschalten"] }),
    "einordnung",
    '„jun-spiel" ist keine Einordnung der Altersstufe Kinderfussball.',
  );
  assert.deepEqual(e.zulaessig, ["auffangen", "einleitung", "hauptteil", "ausklang"]);
  // Leerraum ist nichts Gesendetes: Er fällt auch im Formular weg.
  assert.ok(pruefeInhalt({ ...EINLEITUNG, aufbau: "  ", hauptteilkategorie: "", uebungstyp: null }).ok);
});

pruefe("Übungsinhalt: ganze Zahlen bei Anzahl und Menge, keine Farbe an Material ohne Farben", () => {
  const anzahl = "Die Anzahl Spieler:innen ist eine ganze Zahl ab 1.";
  einziger(pruefeInhalt({ ...EINLEITUNG, anzahlKinder: { min: 0 } }), "anzahl_kinder.min", anzahl, "eingabe");
  einziger(pruefeInhalt({ ...EINLEITUNG, anzahlKinder: { min: 1.5, max: 3 } }), "anzahl_kinder.min", anzahl, "eingabe");
  einziger(pruefeInhalt({ ...EINLEITUNG, anzahlKinder: { max: 2.5 } }), "anzahl_kinder.max", anzahl, "eingabe");
  const menge = "Die Menge ist eine ganze Zahl von 1 bis 999.";
  for (const m of [0, 1000, 1.5])
    einziger(
      pruefeInhalt({ ...EINLEITUNG, material: { liste: [{ art: "fussball", menge: 1 }, { art: "teller", menge: m }] } }),
      "material.liste[1].menge",
      menge,
      "eingabe",
    );
  einziger(
    pruefeInhalt({ ...EINLEITUNG, material: { liste: [{ art: "tor", farbe: "rot", menge: 2 }] } }),
    "material.liste[0].farbe",
    "Tor gibt es nicht in Farben - lass «farbe» weg.",
    "eingabe",
  );
  // Ohne Farbe gilt bei färbbarem Material die des Diagramms — kein Verstoss.
  assert.ok(pruefeInhalt({ ...EINLEITUNG, material: { liste: [{ art: "leibchen", menge: 6 }] } }).ok);
});

pruefe("Übungsinhalt Juniorenfussball: alle Angaben ok, Kinderfussball-Angaben sind Verstösse (#147 AK 4)", () => {
  const p = pruefeInhalt(
    {
      ...JUN_SPIEL,
      kategorien: ["D", "C"],
      varianten: "Mit Joker",
      erscheinungsformen: ["schnell-umschalten"],
      uebungstyp: "spielform",
      spielfeld: { laengeM: 40, breiteM: 30 },
      anzahlKinder: { min: 10, max: 14 },
      material: { liste: [{ art: "minitor", menge: 2 }], ergaenzung: ["Pfeife"] },
    },
    JUN,
  );
  assert.ok(p.ok, JSON.stringify(funde(p)));
  assert.deepEqual(p.row, {
    name: "Probe",
    altersstufe: "juniorenfussball",
    trainingsteil: "jun-spiel",
    kategorien: ["D", "C"],
    feldtyp: null,
    spielfeld_laenge_m: 40,
    spielfeld_breite_m: 30,
    erscheinungsform: ["schnell-umschalten"],
    hauptteilkategorie: null,
    anzahl_kinder: { min: 10, max: 14 },
    material_liste: [{ art: "minitor", farbe: null, menge: 2 }],
    material: ["Pfeife"],
    uebungstyp: "spielform",
    methodischer_fahrplan: null,
    aufbau: "Aufbau",
    varianten_text: "Mit Joker",
  });
  // Was nur der Kinderfussball kennt, wird genannt statt still verworfen.
  einziger(
    pruefeInhalt({ ...JUN_SPIEL, hauptteilkategorie: "fussball-spielen" }, JUN),
    "hauptteilkategorie",
    "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
  );
  einziger(
    pruefeInhalt({ ...JUN_SPIEL, offenStarten: "x" }, JUN),
    "offen_starten",
    "Hier gibt es keinen methodischen Fahrplan - der Ablauf steht in «aufbau».",
  );
  const e = einziger(
    pruefeInhalt({ ...JUN_SPIEL, einordnung: "einleitung" }, JUN),
    "einordnung",
    '„einleitung" ist keine Einordnung der Altersstufe Juniorenfussball.',
  );
  assert.deepEqual(e.zulaessig, einordnungsSlugsFuer(JUN));
  const k = einziger(
    pruefeInhalt({ ...JUN_SPIEL, kategorien: ["D", "F"] }, JUN),
    "kategorien",
    "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung. Nicht zulässig: F.",
  );
  assert.deepEqual(k.zulaessig, ["D", "C", "B", "A"]);
  const f = einziger(
    pruefeInhalt({ ...JUN_SPIEL, erscheinungsformen: ["mutig-tore-erzielen"] }, JUN),
    "erscheinungsformen",
    "Diese Erscheinungsform gehört zum Manual der anderen Altersstufe. Nicht zulässig: mutig-tore-erzielen.",
  );
  assert.deepEqual(f.zulaessig, erscheinungsform_juniorenSlugs);
  einziger(
    pruefeInhalt({ ...nurPflicht(JUN, "jun-auffangen", null), erscheinungsformen: ["schnell-umschalten"] }, JUN),
    "erscheinungsformen",
    "Diese Einordnung trägt keine Erscheinungsform.",
  );
  // Ohne Feldtyp-Bedingung: Die Spielfeldgrösse gilt in jedem Junioren-Block.
  assert.ok(pruefeInhalt({ ...nurPflicht(JUN, "jun-auffangen", null), spielfeld: { laengeM: 20, breiteM: 20 } }, JUN).ok);
});

pruefe("Übungsinhalt: alle Verstösse auf einmal (#143 AK 6)", () => {
  const p = pruefeInhalt({
    name: "",
    einordnung: "auffangen",
    kategorien: ["F", "D"],
    hauptteilkategorie: "fussball-spielen",
    offenStarten: "x",
    erscheinungsformen: ["mutig-tore-erzielen"],
    feldtyp: "kleinfeld",
    spielfeld: { laengeM: 20, breiteM: 15 },
    uebungstyp: "spielform",
    anzahlKinder: { min: 1.5 },
    material: { liste: [{ art: "tor", farbe: "rot", menge: 0 }] },
  });
  assert.deepEqual(felder(p).sort(), [
    "anzahl_kinder.min",
    "aufbau",
    "erscheinungsformen",
    "hauptteilkategorie",
    "kategorien",
    "material.liste[0].farbe",
    "material.liste[0].menge",
    "name",
    "offen_starten",
    "spielfeld",
    "uebungstyp",
  ]);
  // Ohne Hauptteilkategorie ist die Form des Ablaufs offen: Keine Befunde
  // zu Fahrplan oder Beschreibung, nur die Pflicht zur Kategorie.
  const hkat = pruefeInhalt({ name: "", einordnung: "hauptteil", kategorien: ["F"], aufbau: "x", offenStarten: "y" });
  assert.deepEqual(felder(hkat), ["name", "hauptteilkategorie"]);
});

pruefe("Übungsinhalt: abgelehnt nennt alle Verstösse ohne Art, Art aus dem schwersten", () => {
  const eingabe: Fund = { feld: "name", meldung: "Bitte einen Namen angeben.", art: "eingabe" };
  const regel: Fund = { feld: "kategorien", meldung: "m", zulaessig: ["G"], art: "regel" };
  const f = abgelehnt([eingabe, regel], "Es ist nichts angelegt worden.");
  assert.equal(f.art, "regel");
  assert.equal(
    f.meldung,
    "Die Übung entspricht den Regeln nicht. Korrigiere die unter «verstoesse» genannten Angaben und sende sie noch einmal.",
  );
  assert.equal(f.hinweis, "Es ist nichts angelegt worden.");
  assert.deepEqual(f.verstoesse, [
    { feld: "name", meldung: "Bitte einen Namen angeben." },
    { feld: "kategorien", meldung: "m", zulaessig: ["G"] },
  ]);
  assert.equal(f.feld, undefined);
  assert.equal(abgelehnt([eingabe], "h").art, "eingabe");
});

// ── Übung ändern (#144) ─────────────────────────────────────────────────────

/** Eine gespeicherte Übung, wie sie die Datenbank nach dem Anlegen führt:
 *  die Zeile des Formulars samt der Spalten, die es nicht setzt. */
function gespeichert(i: UebungInhalt, stufe: Altersstufe = KIFU): UebungsZeile & { altersstufe: string } {
  const p = pruefeInhalt(i, stufe);
  assert.ok(p.ok, JSON.stringify(funde(p)));
  return {
    ...(p.row as Omit<UebungsZeile, "material_liste" | "material_basis" | "bild_quelle" | "bild_url" | "diagramm">),
    // Ohne Liste gilt der Default der Spalte.
    material_liste: p.row.material_liste ?? [],
    material_basis: null,
    bild_quelle: null,
    bild_url: null,
    diagramm: null,
    altersstufe: stufe,
  };
}
/** Änderung wie im Kern: überlagern, dann die ganze Übung prüfen. */
function aendere(zeile: UebungsZeile & { altersstufe: string }, patch: UebungPatch) {
  const stufe = zeile.altersstufe as Altersstufe;
  const { inhalt, ausBestand } = ueberlagere(inhaltAusZeile(zeile), patch);
  return pruefeUebungsInhalt(inhalt, { altersstufe: stufe, ausBestand });
}

const VOLL_EINLEITUNG = gespeichert({
  ...EINLEITUNG,
  ueben: ["- links", "", "Dann rechts"],
  varianten: "Mit zwei Bällen",
  erscheinungsformen: ["mutig-tore-erzielen", "spiel-kreativ-gestalten"],
  feldtyp: "freies_feld",
  spielfeld: { laengeM: 20, breiteM: 15 },
  anzahlKinder: { min: 6, max: 8 },
  material: { liste: [{ art: "pylone", farbe: "rot", menge: 4 }, { art: "fussball", menge: 2 }], ergaenzung: ["Pfeife"] },
});
const VOLL_JUNIOREN = gespeichert(
  {
    ...JUN_SPIEL,
    varianten: "v",
    erscheinungsformen: ["schnell-umschalten"],
    uebungstyp: "spielform",
    spielfeld: { laengeM: 40, breiteM: 30 },
    anzahlKinder: { min: 10 },
  },
  JUN,
);

pruefe("Übung ändern: ohne Änderung dieselbe Zeile, nichts zu schreiben (beide Altersstufen)", () => {
  for (const zeile of [VOLL_EINLEITUNG, VOLL_JUNIOREN, gespeichert(nurPflicht(KIFU, "hauptteil", "fussball-spielen"))]) {
    const p = aendere(zeile, {});
    assert.ok(p.ok, JSON.stringify(funde(p)));
    assert.deepEqual(geaenderteSpalten(p.row, zeile), {}, zeile.trainingsteil);
  }
});

pruefe("Übung ändern Juniorenfussball: neuer Block nennt Übungstyp und Erscheinungsform, die er nicht trägt (#147 AK 3)", () => {
  const typ = fachlicheMeldung("ex_uebungstyp_nur_junioren")!;
  const abschluss = aendere(VOLL_JUNIOREN, { einordnung: "jun-abschluss" });
  assert.deepEqual(felder(abschluss), ["uebungstyp"]);
  assert.ok(funde(abschluss)[0].meldung.startsWith(typ), "im Juniorenfussball gilt der Text der Datenebene");
  assert.ok(funde(abschluss)[0].meldung.endsWith("setze «uebungstyp» auf null, um sie zu entfernen."));
  assert.ok(aendere(VOLL_JUNIOREN, { einordnung: "jun-abschluss", uebungstyp: null }).ok);
  assert.deepEqual(felder(aendere(VOLL_JUNIOREN, { einordnung: "jun-auffangen" })), ["erscheinungsformen", "uebungstyp"]);
});

pruefe("Übung ändern: jsonb in anderer Schlüsselfolge ist keine Änderung", () => {
  // So gibt Postgres jsonb zurück: Schlüssel nach Länge, dann Bytes.
  const zeile = {
    ...VOLL_EINLEITUNG,
    anzahl_kinder: { max: 8, min: 6 },
    methodischer_fahrplan: { ueben: ["- links", "", "Dann rechts"], wetteifern: "Wetteifern", offen_starten: "Offen starten" },
    material_liste: [
      { art: "pylone", menge: 4, farbe: "rot" },
      { art: "fussball", menge: 2, farbe: null },
    ],
  };
  const p = aendere(zeile, {});
  assert.ok(p.ok, JSON.stringify(funde(p)));
  assert.deepEqual(geaenderteSpalten(p.row, zeile), {});
});

pruefe("Übung ändern: nur das Genannte ändert sich, null leert, material je Teil", () => {
  const name = aendere(VOLL_EINLEITUNG, { name: "Neu" });
  assert.ok(name.ok);
  assert.deepEqual(geaenderteSpalten(name.row, VOLL_EINLEITUNG), { name: "Neu" });

  const leer = aendere(VOLL_EINLEITUNG, { varianten: null, erscheinungsformen: null, spielfeld: null, anzahlKinder: null });
  assert.ok(leer.ok, JSON.stringify(funde(leer)));
  assert.deepEqual(geaenderteSpalten(leer.row, VOLL_EINLEITUNG), {
    varianten_text: null,
    erscheinungsform: [],
    spielfeld_laenge_m: null,
    spielfeld_breite_m: null,
    anzahl_kinder: null,
  });

  // Die Ergänzung allein lässt die gezählte Liste stehen — und umgekehrt.
  const ergaenzung = aendere(VOLL_EINLEITUNG, { material: { ergaenzung: ["Stoppuhr"] } });
  assert.ok(ergaenzung.ok);
  assert.deepEqual(geaenderteSpalten(ergaenzung.row, VOLL_EINLEITUNG), { material: ["Stoppuhr"] });
  const liste = aendere(VOLL_EINLEITUNG, { material: { liste: [] } });
  assert.ok(liste.ok);
  assert.deepEqual(geaenderteSpalten(liste.row, VOLL_EINLEITUNG), { material_liste: [] });
  // `null` an einem Teil leert genau diesen Teil.
  const listeNull = aendere(VOLL_EINLEITUNG, { material: { liste: null } });
  assert.ok(listeNull.ok);
  assert.deepEqual(geaenderteSpalten(listeNull.row, VOLL_EINLEITUNG), { material_liste: [] });
  const ergaenzungNull = aendere(VOLL_EINLEITUNG, { material: { ergaenzung: null } });
  assert.ok(ergaenzungNull.ok);
  assert.deepEqual(geaenderteSpalten(ergaenzungNull.row, VOLL_EINLEITUNG), { material: [] });
  const beides = aendere(VOLL_EINLEITUNG, { material: null });
  assert.ok(beides.ok);
  assert.deepEqual(geaenderteSpalten(beides.row, VOLL_EINLEITUNG), { material_liste: [], material: [] });

  // Eine Änderung wird wie eine neue Übung geprüft: dieselben Verstösse.
  einziger(aendere(VOLL_EINLEITUNG, { name: " " }), "name", "Bitte einen Namen angeben.", "eingabe");
  einziger(
    aendere(VOLL_EINLEITUNG, { uebungstyp: "spielform" }),
    "uebungstyp",
    "Den Übungstyp gibt es nur im Juniorenfussball - lass «uebungstyp» weg.",
  );
});

pruefe("Übung ändern: neue Einordnung nennt stehengebliebene Angaben, statt sie still zu löschen", () => {
  const stehen = " Die Angabe steht noch in der Übung - setze";
  const p = aendere(VOLL_EINLEITUNG, { einordnung: "ausklang" });
  assert.deepEqual(felder(p), ["aufbau", "offen_starten", "ueben", "wetteifern", "erscheinungsformen"]);
  assert.equal(funde(p)[0].meldung, "Bitte den Aufbau beschreiben.");
  for (const f of funde(p).slice(1)) {
    assert.ok(f.meldung.includes(stehen), f.meldung);
    assert.ok(f.meldung.endsWith(`«${f.feld}» auf null, um sie zu entfernen.`), f.meldung);
  }
  // Mit null für die Altlasten und dem neuen Pflichtfeld geht es durch.
  const ok = aendere(VOLL_EINLEITUNG, {
    einordnung: "ausklang",
    offenStarten: null,
    ueben: null,
    wetteifern: null,
    erscheinungsformen: null,
    aufbau: "Auslaufen",
  });
  assert.ok(ok.ok, JSON.stringify(funde(ok)));
  const werte = geaenderteSpalten(ok.row, VOLL_EINLEITUNG);
  assert.deepEqual(Object.keys(werte).sort(), ["aufbau", "erscheinungsform", "methodischer_fahrplan", "trainingsteil"]);
  assert.equal(werte.methodischer_fahrplan, null);

  // Hauptteil → Einleitung: die gespeicherte Hauptteilkategorie wird genannt.
  const hkat = aendere(gespeichert(nurPflicht(KIFU, "hauptteil", "fussball-spielen-lernen")), { einordnung: "einleitung" });
  assert.deepEqual(felder(hkat), ["hauptteilkategorie"]);
  assert.ok(funde(hkat)[0].meldung.startsWith("Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil."));
  // Hauptteilkategorie wechseln: die Ablaufform wechselt mit, in beide Richtungen.
  const frei = gespeichert(nurPflicht(KIFU, "hauptteil", "fussball-spielen"));
  const zumFahrplan = aendere(frei, { hauptteilkategorie: "fussball-spielen-lernen" });
  assert.deepEqual(felder(zumFahrplan), ["offen_starten", "ueben", "wetteifern", "aufbau"]);
  assert.ok(funde(zumFahrplan)[3].meldung.includes(stehen));
  const fahrplan = gespeichert(nurPflicht(KIFU, "hauptteil", "vielseitigkeit-erleben"));
  const zumSpiel = aendere(fahrplan, { hauptteilkategorie: "fussball-spielen" });
  assert.deepEqual(felder(zumSpiel), ["aufbau", "offen_starten", "ueben", "wetteifern"]);
  assert.equal(funde(zumSpiel)[0].meldung, "Bitte das Spiel beschreiben.");
  // Feldtyp wechseln: die Meter des freien Felds bleiben stehen und werden genannt.
  const feld = aendere(VOLL_EINLEITUNG, { feldtyp: "kleinfeld" });
  assert.deepEqual(felder(feld), ["spielfeld"]);
  assert.ok(funde(feld)[0].meldung.includes(stehen));
  assert.ok(aendere(VOLL_EINLEITUNG, { feldtyp: "kleinfeld", spielfeld: null }).ok);

  // Auch eine unförmige gespeicherte Angabe nennt den Weg zum Entfernen —
  // am obersten Feld; die Pflichtangaben nie (sie lassen sich nicht leeren).
  const altAnzahl = { ...VOLL_EINLEITUNG, anzahl_kinder: { min: 0, max: 8 } };
  const nurName = aendere(altAnzahl, { name: "Neu" });
  assert.deepEqual(felder(nurName), ["anzahl_kinder.min"]);
  assert.ok(funde(nurName)[0].meldung.endsWith("setze «anzahl_kinder» auf null, um sie zu entfernen."));
  assert.ok(aendere(altAnzahl, { name: "Neu", anzahlKinder: null }).ok);
  const altKategorie = aendere({ ...VOLL_EINLEITUNG, kategorien: ["F", "D"] }, { varianten: "neu" });
  assert.deepEqual(felder(altKategorie), ["kategorien"]);
  assert.equal(
    funde(altKategorie)[0].meldung,
    "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung. Nicht zulässig: D.",
  );

  // Ein Wert, den die Änderung selbst sendet, trägt den Zusatz nicht.
  const selbst = aendere(VOLL_EINLEITUNG, { einordnung: "ausklang", aufbau: "x", offenStarten: "neu", ueben: null, wetteifern: null, erscheinungsformen: null });
  assert.deepEqual(felder(selbst), ["offen_starten"]);
  assert.ok(!funde(selbst)[0].meldung.includes(stehen));
});

// ── Statische Wächter ───────────────────────────────────────────────────────
const web = resolve(fileURLToPath(import.meta.url), "../..");
const kern = join(web, "lib/kern");

/** Kern-Dateien ohne Datenbankzugriff: Sie bleiben ohne `server-only`, damit
 *  Prüfskripte wie dieses sie mit tsx laden können (`server-only` wirft
 *  ausserhalb der react-server-Bedingung). */
const REIN = new Set(["ergebnis.ts", "folge.ts", "auskunft.ts", "auskunft-schema.ts", "uebung-inhalt.ts"]);

/** Was der Kern nicht importieren darf — direkt nicht und über eine
 *  importierte `@/lib/*`-Datei auch nicht. */
const VERBOTEN = [/^next\//, /^@\/lib\/mcp\//, /^@\/lib\/actions\//, /^@\/lib\/supabase\/server$/];
/** Was eine vom Kern importierte Datei nicht mitziehen darf: den Cookie-Client. */
const VERBOTEN_TRANSITIV = [/^next\/headers$/, /^@\/lib\/supabase\/server$/];

const importeVon = (text: string) =>
  [...text.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+["']([^"']+)["']/gm)]
    .filter((m) => !/^\s*import\s+type\b/.test(m[0]))
    .map((m) => m[1]);

function libDatei(spez: string): string | null {
  const basis = join(web, spez.replace(/^@\//, ""));
  for (const kandidat of [`${basis}.ts`, `${basis}.tsx`, join(basis, "index.ts")])
    if (existsSync(kandidat)) return kandidat;
  return null;
}

pruefe("lib/kern: kein \"use server\", keine Adapter-Importe (auch eine Ebene tief), server-only nur mit DB", () => {
  const dateien = readdirSync(kern, { recursive: true, encoding: "utf8" }).filter((d) =>
    d.endsWith(".ts"),
  );
  assert.ok(dateien.length >= 4, "lib/kern ist leer?");
  for (const d of dateien) {
    const text = readFileSync(join(kern, d), "utf8");
    assert.ok(!/^\s*["']use server["']/m.test(text), `${d}: "use server" im Kern`);
    const serverOnly = /^import\s+["']server-only["'];/m.test(text);
    if (REIN.has(d)) assert.ok(!serverOnly, `${d} ist rein und darf server-only nicht tragen`);
    else assert.ok(serverOnly, `${d} greift auf die DB zu und braucht import "server-only"`);

    for (const spez of importeVon(text)) {
      for (const v of VERBOTEN) assert.ok(!v.test(spez), `${d} importiert ${spez}`);
      if (!spez.startsWith("@/lib/") || spez.startsWith("@/lib/kern/")) continue;
      const datei = libDatei(spez);
      assert.ok(datei, `${d}: ${spez} nicht gefunden`);
      for (const tief of importeVon(readFileSync(datei, "utf8")))
        for (const v of VERBOTEN_TRANSITIV)
          assert.ok(!v.test(tief), `${d} → ${spez} importiert ${tief}`);
    }
  }
});

pruefe("Kopieren und Löschen leben im Kern: die alten Orte sind weg (#197)", () => {
  // Zwei Orte für dieselbe Choreografie hiessen zwei Wahrheiten darüber, was
  // zu einer vollständigen Kopie gehört und wann «nichts entstanden» ist.
  for (const alt of ["lib/training-kopie.ts", "lib/training-loeschen.ts"])
    assert.ok(!existsSync(join(web, alt)), `${alt} existiert wieder - gehört nach lib/kern/`);
  for (const neu of ["kopie.ts", "loeschen.ts"]) assert.ok(existsSync(join(kern, neu)), `lib/kern/${neu} fehlt`);
});

pruefe("Diagramm-Grenzen: eine Quelle für Übungsmaske und KI-Weg (#145 NFR 1)", () => {
  // Speicher-Actions und Kern prüfen über lib/diagramm-pruefung.ts. Käme der
  // alte, nachsichtige Speicherweg in lib/diagramm.ts zurück, nähme die Maske
  // wieder an, was der KI-Weg ablehnt.
  const importiert = (datei: string, name: string) =>
    new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from "@/lib/diagramm-pruefung"`).test(
      readFileSync(join(web, datei), "utf8"),
    );
  const diagramm = readFileSync(join(web, "lib/diagramm.ts"), "utf8");
  for (const alt of ["parseDiagrammZumSpeichern", "diagrammAusFormular"])
    assert.ok(!new RegExp(`export function ${alt}\\b`).test(diagramm), `lib/diagramm.ts exportiert wieder ${alt}`);
  for (const action of ["lib/actions/exercises.ts", "lib/actions/fassung.ts"])
    assert.ok(importiert(action, "diagrammAusFormular"), `${action}: diagrammAusFormular nicht aus lib/diagramm-pruefung`);
  assert.ok(importiert("lib/kern/uebung-diagramm.ts", "pruefeDiagramm"), "Kern prüft nicht über lib/diagramm-pruefung");
  assert.match(readFileSync(join(kern, "uebungen.ts"), "utf8"), /\bdiagrammZumAnlegen\(/, "legeUebungAn prüft das Diagramm nicht");
});

pruefe("Queries ohne Cookie-Client (lib/queries/*-fuer.ts): kein next/, kein react, kein server.ts", () => {
  // Der Kern liest Trainings und Übungen über diese Dateien. `react`s `cache`
  // bindet an einen Request und fehlte in einem Route Handler ebenso wie der
  // Cookie-Client — darum bleiben `getTrainingNavKontext` und die
  // Cookie-Wrapper in den Nachbardateien.
  const ordner = join(web, "lib/queries");
  const dateien = readdirSync(ordner).filter((d) => d.endsWith("-fuer.ts"));
  assert.ok(dateien.includes("trainings-fuer.ts") && dateien.includes("uebungen-fuer.ts"));
  for (const d of dateien)
    for (const spez of importeVon(readFileSync(join(ordner, d), "utf8")))
      assert.ok(
        !/^next\//.test(spez) && spez !== "react" && spez !== "@/lib/supabase/server",
        `${d} importiert ${spez}`,
      );
});

// Der Katalog-Wächter liest Quelltext statt die Werte zu importieren: Der
// Werkzeugsatz (lib/mcp/server.ts) und jedes Werkzeug tragen `server-only`,
// und das wirft unter tsx. Die Werte über die react-server-Bedingung zu laden,
// zöge den ganzen Next-Server-Graphen nach — für eine Namensprüfung zu viel.
pruefe("Werkzeugsatz: eindeutige snake_case-Namen, nichts unregistriert", () => {
  const ordner = join(web, "lib/mcp/werkzeuge");
  const nameVon = new Map<string, string>(); // Bezeichner → Werkzeugname
  for (const d of readdirSync(ordner).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(join(ordner, d), "utf8");
    for (const m of text.matchAll(
      /export const (\w+) = werkzeug\(\{\s*name:\s*"([^"]+)"/g,
    )) {
      nameVon.set(m[1], m[2]);
    }
  }
  const server = readFileSync(join(web, "lib/mcp/server.ts"), "utf8");
  const block = /export const WERKZEUGE = \[([\s\S]*?)\] as const/.exec(server)?.[1];
  assert.ok(block, "WERKZEUGE nicht gefunden");
  const registriert = block.split(",").map((s) => s.trim()).filter(Boolean);

  for (const id of registriert) assert.ok(nameVon.has(id), `${id} ist kein werkzeug({...})`);
  for (const id of nameVon.keys())
    assert.ok(registriert.includes(id), `${id} ist definiert, aber nicht in WERKZEUGE`);
  const namen = registriert.map((id) => nameVon.get(id)!);
  assert.equal(new Set(namen).size, namen.length, `doppelte Namen: ${namen.join(", ")}`);
  for (const n of namen) assert.match(n, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `${n} ist nicht snake_case`);
  // Jedes Werkzeug, das eine Kennung aus dem Trainings-Bestand annimmt,
  // erklärt «nicht_gefunden» gegen «keine_rechte» (#193 AK 14). Geprüft am
  // Quelltext: Enthält die Eingabe — inline oder als benannte Konstante —
  // `TrainingId`, `FassungId`, `GruppeId` oder `VarianteId`, muss der Block
  // `KENNUNG_FEHLER` tragen.
  // Eingabeschemas, die ein Werkzeug aus lib/mcp/uebung-eingaben.ts
  // importiert (#144): ihre Definition zählt wie eine im Werkzeug selbst.
  const uebungEingaben = readFileSync(join(web, "lib/mcp/uebung-eingaben.ts"), "utf8");
  for (const d of readdirSync(ordner).filter((f) => f.endsWith(".ts"))) {
    const text = readFileSync(join(ordner, d), "utf8");
    for (const m of text.matchAll(/export const (\w+) = werkzeug\(\{([\s\S]*?)\n\}\);/g)) {
      const block = m[2];
      const verweis = /eingabe:\s*(\w+),/.exec(block)?.[1];
      const eingabe = verweis
        ? (new RegExp(`const ${verweis} = z\\.object\\(\\{([\\s\\S]*?)\\n\\}\\);`).exec(text)?.[1] ??
          new RegExp(`export const ${verweis} = ([\\s\\S]*?)\\n\\}\\);`).exec(uebungEingaben)?.[1] ??
          "")
        : block;
      // Dasselbe für Übungen (#144 AK 4): wer `UebungKennung` annimmt, erklärt
      // «nicht_gefunden» gegen «keine_rechte».
      // «keine_rechte» liefern nur die Werkzeuge, die an eigenen Übungen
      // wirken; das Kopieren nimmt jede sichtbare (#317).
      if (/\bUebungKennung\b/.test(eingabe)) {
        assert.ok(block.includes("UEBUNG_KENNUNG_FEHLER"), `${m[1]} nimmt eine Übungs-Kennung, erklärt aber UEBUNG_KENNUNG_FEHLER nicht`);
        assert.equal(
          block.includes("UEBUNG_NUR_EIGENE_FEHLER"),
          m[1] !== "uebungKopieren",
          `${m[1]}: UEBUNG_NUR_EIGENE_FEHLER gehört genau an die Werkzeuge, die nur eigene Übungen ändern`,
        );
      }
      if (/\b(TrainingId|FassungId|GruppeId|VarianteId)\b/.test(eingabe))
        assert.ok(/\bKENNUNG_FEHLER\b/.test(block), `${m[1]} nimmt eine Kennung, erklärt aber KENNUNG_FEHLER nicht`);
      // Dasselbe für Teams und Termine (#198 AK 11; #322: auch «termin_entfernen»
      // meldet «nicht gefunden»).
      if (/\bTeamId\b/.test(eingabe))
        assert.ok(block.includes("TEAM_KENNUNG_FEHLER"), `${m[1]} nimmt team_id, erklärt aber TEAM_KENNUNG_FEHLER nicht`);
      if (/\bTerminId\b/.test(eingabe))
        assert.ok(block.includes("TERMIN_KENNUNG_FEHLER"), `${m[1]} nimmt termin_id, erklärt aber TERMIN_KENNUNG_FEHLER nicht`);
      if (/\bSpielerId\b/.test(eingabe))
        assert.ok(block.includes("SPIELER_KENNUNG_FEHLER"), `${m[1]} nimmt spieler_id, erklärt aber SPIELER_KENNUNG_FEHLER nicht`);
      if (/\bKaderId\b/.test(eingabe))
        assert.ok(block.includes("KADER_KENNUNG_FEHLER"), `${m[1]} nimmt kader_id, erklärt aber KADER_KENNUNG_FEHLER nicht`);
    }
  }

  const jeStory: Record<string, string[]> = {
    "#143": ["uebung_anlegen"],
    "#144": ["uebung_aendern", "uebung_veroeffentlichen", "uebung_auf_entwurf_setzen"],
    "#317": ["uebung_kopieren"],
    "#145": ["uebung_diagramm_setzen", "diagramm_katalog_abrufen"],
    "#146": ["uebung_diagramm_maengel_abrufen"],
    "#192":["training_anlegen", "training_uebungen_fuer_block", "training_uebung_zuordnen"],
    "#193": [
      "training_abrufen",
      "trainings_suchen",
      "training_umbenennen",
      "training_ziel_setzen",
      "training_kategorien_setzen",
      "training_uebung_entfernen",
      "training_uebungen_ordnen",
      "training_uebung_dauer_setzen",
      "training_uebung_notiz_setzen",
    ],
    "#194": [
      "gruppe_anlegen",
      "gruppe_umbenennen",
      "gruppe_entfernen",
      "training_uebung_durchlauf_setzen",
      "training_durchlauf_abrufen",
    ],
    "#195": ["training_hinweise_abrufen"],
    "#196": ["training_veroeffentlichen", "training_auf_entwurf_setzen"],
    "#197": ["training_kopieren", "training_loeschen"],
    "#198": ["teams_abrufen", "team_plan_abrufen"],
    "#322": ["termin_festlegen", "termin_aendern", "termin_entfernen"],
    "#323": ["training_zuordnen", "training_loesen"],
    "#324": ["terminserie_festlegen"],
    "#326": ["termin_der_serie_folgen"],
    "#325": ["team_mitglieder_abrufen"],
    "#519": ["termin_trainer_aendern"],
    "#520": ["termin_trainer_absagen"],
    "#327": ["termin_ausfallen_lassen", "termin_ausfall_zuruecknehmen"],
    "#329": ["team_plan_abrufen"],
    "#263": ["variante_anlegen", "variante_umbenennen", "variante_entfernen", "varianten_ordnen"],
    "#434": ["spielerliste_abrufen", "spieler_aufnehmen", "spieler_aendern"],
    "#579": ["spieler_aus_team_nehmen", "spielerliste_abrufen", "termin_spieler_abrufen", "termin_anwesenheit_setzen"],
    "#435": ["termin_spieler_abrufen", "termin_abmeldung_setzen"],
    "#436": ["spieler_link_abrufen", "spieler_link_erneuern"],
    "#438": ["selbstabholung_abrufen", "selbstabholung_schalten", "abholadresse_erneuern"],
    "#453": ["termin_festlegen", "termin_aendern", "terminserie_festlegen", "termin_der_serie_folgen", "termin_spieler_abrufen"],
    "#452": ["kader_abrufen", "kader_anlegen", "kader_umbenennen", "kader_entfernen", "kader_zuteilen", "kader_herausnehmen"],
    "#475": ["termin_spieler_abrufen", "termin_anwesenheit_setzen"],
    "#459": ["termin_festlegen", "termin_aendern", "termin_ausfallen_lassen", "termin_ausfall_zuruecknehmen", "termin_entfernen", "team_plan_abrufen"],
    "#464": ["termin_spieler_abrufen", "termin_aufgebot_setzen"],
    "#487": ["termin_spieler_abrufen", "termin_anwesenheit_setzen", "team_plan_abrufen"],
    "#556": ["schnuppertraining_abrufen", "schnuppertraining_festlegen"],
    "#598": ["team_infos_abrufen", "team_infos_festlegen"],
    "#657": ["spieler_link_zugestellt", "spielerliste_abrufen", "spieler_link_abrufen"],
    "#555": ["schnuppertraining_abrufen", "schnuppertraining_festlegen", "spieler_schnuppern_setzen", "spielerliste_abrufen", "termin_spieler_abrufen"],
    "#561": ["termin_festlegen", "termin_aendern", "terminserie_festlegen", "termin_der_serie_folgen", "team_plan_abrufen", "spieler_link_abrufen"],
    "#589": ["teams_abrufen", "spielerliste_abrufen", "spieler_aus_team_nehmen", "spieler_link_abrufen", "spieler_link_erneuern"],
    "#590": ["termin_festlegen", "termin_aendern", "terminserie_festlegen", "termin_der_serie_folgen", "team_plan_abrufen", "spieler_link_abrufen", "training_abrufen", "trainings_suchen"],
  };
  for (const [story, erwartet] of Object.entries(jeStory))
    for (const n of erwartet) assert.ok(namen.includes(n), `${n} fehlt im Werkzeugsatz (${story})`);
  // Story #579: Das Herausnehmen ersetzt das Entfernen, und gelöscht wird in
  // keinem KI-Werkzeug (Löschen aus dem Verein nur in der Anwendung).
  for (const alt of ["spieler_entfernen", "spieler_loeschen"]) assert.ok(!namen.includes(alt), `${alt} gibt es nicht mehr`);
  // Story #584: Das Schnuppertraining heisst ohne Übergang neu (OoS 3). Geprüft wird an den
  // registrierten Namen, nicht im Quelltext: `spieler_probe_setzen` bleibt der RPC-Name der Datenebene.
  for (const alt of ["probetraining_abrufen", "probetraining_festlegen", "spieler_probe_setzen"])
    assert.ok(!namen.includes(alt), `${alt} gibt es als Werkzeug nicht mehr (#584)`);
  assert.ok(!namen.some((n) => /probe/i.test(n)), "kein Werkzeugname trägt «probe» (#584 AK 3)");
});

pruefe("Alte Namen abwesend: kein spieler_entfernen, kein spieler_loeschen, kein verein_* im KI-Weg (#579, Architekturplan §5.5)", () => {
  const treffer: string[] = [];
  for (const datei of quelldateien(web))
    if (datei !== fileURLToPath(import.meta.url))
      readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
        if (/\bspieler_(entfernen|loeschen)\b/.test(zeile)) treffer.push(`${relative(web, datei)}:${i + 1}`);
      });
  assert.deepEqual(treffer, [], `alte Namen stehen noch in: ${treffer.join(", ")}`);
  // Die Vereinsverwaltung geht nie über die KI (AP §4.1): unter lib/mcp steht keine verein_*-RPC.
  const ki: string[] = [];
  for (const datei of quelldateien(join(web, "lib/mcp")))
    if (/\.rpc\(\s*["`']verein_/.test(readFileSync(datei, "utf8"))) ki.push(relative(web, datei));
  assert.deepEqual(ki, [], `verein_*-RPC im KI-Weg: ${ki.join(", ")}`);
});

pruefe("Alte Namen abwesend: Team anlegen, auflösen und umbenennen gibt es nur noch am Verein-Ort (#581, Architekturplan §5.1)", () => {
  // Treffer in supabase/migrations bleiben erlaubt (angewandte Migrationen); geprüft wird nur web/.
  // `check:kern-db` prüft den Verein-Kern selbst und ruft ihn darum auf.
  const vereinOrt = (d: string) =>
    ["lib/kern/verein.ts", "lib/actions/verein.ts", "scripts/pruefe-kern-db.ts"].includes(d) ||
    d.startsWith("app/(app)/verein/") ||
    d.startsWith("components/verein/");
  const treffer: string[] = [];
  for (const datei of quelldateien(web)) {
    if (datei === fileURLToPath(import.meta.url)) continue;
    const rel = relative(web, datei);
    readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
      const ort = `${rel}:${i + 1}`;
      // Überall verschwunden: die RPCs und Zustände des alten Auflösens.
      if (/\b(create_team|loese_team_auf|team_aufloesen_wenn_leer|aufloesung_noetig|getTeamAufloesungsInfo)\b/.test(zeile)) treffer.push(ort);
      // Der Teamname am Austritt ist weg; `p_teamname` gibt es nur noch beim Auflösen am Verein-Ort.
      if (!vereinOrt(rel) && /\bp_teamname\b/.test(zeile)) treffer.push(ort);
      // Umbenennen und Auflösen: nur am Verein-Ort, nie am Team-Ort.
      if (!vereinOrt(rel) && /\b(benenneTeamUm|loeseTeamAuf)\b/.test(zeile)) treffer.push(ort);
      if (/\bTeamAnsichten\b/.test(zeile)) treffer.push(ort);
    });
  }
  assert.deepEqual(treffer, [], `alte Namen am falschen Ort, zu räumen: ${treffer.join(", ")}`);
});

pruefe("Verein-Kern nur für die Anwendung: kein MCP-Modul importiert ihn, kein anderer Kern ruft verein_* (#581, Architekturplan §5.5)", () => {
  const treffer: string[] = [];
  for (const datei of quelldateien(join(web, "lib/mcp")))
    if (/lib\/kern\/verein["']/.test(readFileSync(datei, "utf8"))) treffer.push(relative(web, datei));
  // Auch die übrigen Kerne bleiben frei von verein_*-RPCs: Was die KI ruft, endet nicht beim Verein.
  for (const datei of quelldateien(join(web, "lib/kern")))
    if (!datei.endsWith("kern/verein.ts") && /\.rpc\(\s*["`']verein_/.test(readFileSync(datei, "utf8"))) treffer.push(relative(web, datei));
  // Und wer den Verein-Kern importiert, ist eine Action, eine Seite oder ein Skript — kein Kern.
  for (const datei of quelldateien(join(web, "lib/kern")))
    if (!datei.endsWith("kern/verein.ts") && /kern\/verein["']/.test(readFileSync(datei, "utf8"))) treffer.push(relative(web, datei));
  assert.deepEqual(treffer, [], `Verein-Kern im KI-Weg: ${treffer.join(", ")}`);
});

pruefe("Rollen nach Ort (#581, Architekturplan §4): Team-Seiten und Team-Bausteine importieren weder Verein-Actions noch Verein-Kern", () => {
  // Am Team-Ort wirkt nur die Mitgliedschaft; was die Verwaltung darf, liegt
  // im Bereich «Verein». Die Vereinslage zu lesen (lib/queries/verein) bleibt erlaubt.
  const treffer: string[] = [];
  for (const ordner of ["components/team", "app/(app)/team"])
    for (const datei of quelldateien(join(web, ordner)))
      if (/lib\/(actions|kern)\/verein["']/.test(readFileSync(datei, "utf8"))) treffer.push(relative(web, datei));
  assert.deepEqual(treffer, [], `Verein-Actions oder Verein-Kern am Team-Ort: ${treffer.join(", ")}`);
});

pruefe("Spielerbestand der Verwaltung (#582): Sätze zum Erfassen und Ändern, Doppelte mit Teams, ohne Team und gemischt (AK 4, 5)", () => {
  const e = { vorname: "  Noah ", nachname: "Keller", jahrgang: 2015 };
  const zusatz = "Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.";
  const zuordnen = "Ordne die vorhandene Spieler:in selbst einem Team zu.";
  // Erfassen mit einem, zwei, drei Teams (Namen nach Name geordnet, wie am Team-Ort).
  assert.equal(
    spielerErfassenAbgewiesenText({ teams: ["Da"], ohne_team: false }, e, "FC Wyler"),
    `Noah Keller (2015) wird im Verein «FC Wyler» schon im Team «Da» geführt. ${zuordnen} ${zusatz}`,
  );
  assert.equal(
    spielerErfassenAbgewiesenText({ teams: ["Ea", "Da"], ohne_team: false }, e, "FC Wyler"),
    `Noah Keller (2015) wird im Verein «FC Wyler» schon im Team «Da» und «Ea» geführt. ${zuordnen} ${zusatz}`,
  );
  assert.equal(
    spielerErfassenAbgewiesenText({ teams: ["Ea", "Ca", "Da"], ohne_team: false }, e, "FC Wyler"),
    `Noah Keller (2015) wird im Verein «FC Wyler» schon im Team «Ca», «Da» und «Ea» geführt. ${zuordnen} ${zusatz}`,
  );
  // Erfassen ohne Team: kein Verweis an «dein Team» (die Verwaltung ordnet selbst zu).
  const ohne = spielerErfassenAbgewiesenText({ teams: [], ohne_team: true }, e, "FC Wyler");
  assert.equal(ohne, `Noah Keller (2015) wird im Verein «FC Wyler» schon geführt, ist aber keinem Team zugeordnet. ${zuordnen} ${zusatz}`);
  // Mischfall (Altdubletten): nur die Teams.
  assert.equal(
    spielerErfassenAbgewiesenText({ teams: ["Da"], ohne_team: true }, e, "FC Wyler"),
    spielerErfassenAbgewiesenText({ teams: ["Da"], ohne_team: false }, e, "FC Wyler"),
  );
  // Ändern: Wortlaut des Team-Orts, ohne den Satz an die Trainer:in.
  assert.equal(spielerAendernAbgewiesenText({ teams: ["Da"], ohne_team: false }), "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «Da».");
  assert.equal(spielerAendernAbgewiesenText({ teams: ["Ea", "Da"], ohne_team: false }), "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «Da» und «Ea».");
  assert.equal(spielerAendernAbgewiesenText({ teams: [], ohne_team: true }), "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, die keinem Team zugeordnet ist.");
  assert.equal(spielerAendernAbgewiesenText({ teams: ["Da"], ohne_team: true }), spielerAendernAbgewiesenText({ teams: ["Da"], ohne_team: false }), "Mischfall: nur die Teams");
  assert.equal(
    spielerAendernAbgewiesenText({ teams: ["Eb", "Ea"], ohne_team: false }),
    spielerDoppeltText({ eigenes_team: false, teams: ["Eb", "Ea"], ohne_team: false }, null),
    "mit Teams derselbe Satz wie am Team-Ort",
  );
  for (const satz of [ohne, spielerAendernAbgewiesenText({ teams: [], ohne_team: true })])
    assert.ok(!/dein|Vereinsverwaltung/.test(satz), `die Verwaltung wird nicht an sich selbst verwiesen: ${satz}`);
  // Der Team-Ort und die KI behalten ihre Sätze, Wort für Wort: Die Trainer:in wird weiter an die Verwaltung verwiesen.
  const kenn = { vorname: "Noah", nachname: "Keller", jahrgang: 2015 };
  assert.equal(spielerDoppeltText({ eigenes_team: true, teams: ["Da"], ohne_team: false }, kenn), SPIELER_MELDUNG.SPIELER_DOPPELT);
  assert.equal(
    SPIELER_MELDUNG.SPIELER_DOPPELT,
    "Diese Spieler:in steht schon auf der Liste. Unterscheide zwei Gleichnamige mit einem Zusatz im Vornamen.",
  );
  assert.equal(
    spielerDoppeltText({ eigenes_team: false, teams: ["Eb", "Ea"], ohne_team: false }, kenn),
    "Noah Keller (2015) wird im Verein schon im Team «Ea» und «Eb» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  assert.equal(
    spielerDoppeltText({ eigenes_team: false, teams: [], ohne_team: true }, kenn),
    "Noah Keller (2015) wird im Verein geführt, ist aber keinem Team zugeordnet. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  assert.equal(
    spielerDoppeltText({ eigenes_team: false, teams: ["Ea"], ohne_team: false }, null),
    "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «Ea».",
  );
  assert.equal(
    spielerDoppeltText({ eigenes_team: false, teams: [], ohne_team: true }, null),
    "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, die keinem Team zugeordnet ist. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  // Grenze (AK 7): der Satz zu VEREIN_VOLL, eine Quelle für App und KI — kein eigener Satz der Verwaltung.
  assert.equal(fehlerMeldung("x VEREIN_VOLL y"), VEREIN_MELDUNG.VEREIN_VOLL);
  assert.match(spielerErfassenEinleitung("FC Wyler"), /^Die Spieler:in kommt ohne Team in den Verein «FC Wyler»\. Einem Team ordnest du sie danach zu\.$/);
});

pruefe("Spielerbestand der Verwaltung (#582): Link ohne Team, Löschen-Bestätigung, Zahlen und Leerzustand (AK 10, 13)", () => {
  // Link ohne Team: eigene Konstante, nicht in LINK_TEXT (das in die KI-Beschreibungen fliesst).
  assert.equal(
    linkOhneTeamText("Elias"),
    "Elias ist keinem Team zugeordnet. Die Spielervertretung sieht erst Termine, wenn Elias einem Team zugeordnet ist; der Link bleibt danach derselbe.",
  );
  // LINK_TEXT (Story #583): Wortlaut eingefroren, die geänderten Schlüssel bewusst neu festgehalten (erneuern, erneuertAbholen).
  // `warnung` bleibt beim Wortlaut vor Story 7: Dass der Link alle Teams zeigt, sagt im Dialog `linkTeamsText` (einmal), und die
  // KI-Beschreibung, in die `warnung` fliesst, spricht bis Story 13 von den Terminen des Teams.
  const { erneuertAbholen, ...linkStatisch } = LINK_TEXT;
  assert.deepEqual(
    linkStatisch,
    {
      warnung:
        "Wer diesen Link hat, kann diese Spieler:in für Trainings und Spiele ab- und anmelden. Für ein Spiel ist sie erst nach ihrer Meldung angemeldet. Gib ihn nur der Spieler:in selbst oder ihren Eltern.",
      erneuern:
        "Erneuern macht den bisherigen Link sofort ungültig, für alle Teams der Spieler:in. Abmeldungen bleiben. Ein Kalender-Abo dieser Spieler:in erlischt damit und ist über den neuen Link neu zu holen. Die bisherigen Benachrichtigungen enden ebenfalls. Mitteilungen aufs Mobile enden ebenfalls: Die Spielervertretung schaltet sie mit dem neuen Link neu ein und legt die App neu ab.",
      ungueltigTitel: "Dieser Link gilt nicht mehr",
      ungueltig: "Den aktuellen erhältst du über eine Abholadresse, bei den Trainer:innen oder bei der Vereinsverwaltung.",
      erneuert: "Link erneuert. Der bisherige gilt nicht mehr.",
    },
    "LINK_TEXT: Schlüssel und Wortlaut eingefroren",
  );
  assert.equal(erneuertAbholen(["A"]), "Die Spieler:in oder ihre Eltern holen den neuen Link über die Abholadresse von A ab.");
  // Löschen: ein, mehrere, kein Team.
  assert.equal(spielerLoeschenTitel("Lina Meier"), "Lina Meier aus dem Verein löschen");
  assert.deepEqual(spielerLoeschenSaetze("Lina", ["Ca"]), {
    zuordnung: "Lina ist dem Team Ca zugeordnet und verschwindet daraus.",
    link: "Der private Link und alle Meldungen von Lina entfallen endgültig.",
    vergangen: "An vergangenen Terminen erscheint Lina ohne Namen.",
  });
  assert.equal(spielerLoeschenSaetze("Lina", ["Ca", "FF-15"]).zuordnung, "Lina ist den Teams Ca und FF-15 zugeordnet und verschwindet aus allen.");
  assert.equal(spielerLoeschenSaetze("Lina", ["A", "B", "C"]).zuordnung, "Lina ist den Teams A, B und C zugeordnet und verschwindet aus allen.");
  assert.equal(spielerLoeschenSaetze("Lina", []).zuordnung, "Lina ist keinem Team zugeordnet.");
  // Kopfzeilen: Einzahl, ohne Team nur wenn es welche gibt, nie ein negativer Rest.
  assert.deepEqual(spielerKopfTeile(144, 2), ["144 Spieler:innen", "2 ohne Team", "höchstens 1000 je Verein"]);
  assert.deepEqual(spielerKopfTeile(1, 0), ["1 Spieler:in", "höchstens 1000 je Verein"]);
  assert.deepEqual(spielerKopfTeile(1001, 1), ["1001 Spieler:innen", "1 ohne Team", "höchstens 1000 je Verein"]);
  assert.equal(vereinKopfText(10, 144), "10 Teams · 144 Spieler:innen · höchstens 30 Teams");
  assert.equal(vereinKopfText(1, 1), "1 Team · 1 Spieler:in · höchstens 30 Teams");
  assert.equal(vereinKopfText(10), "10 Teams · höchstens 30 Teams", "ohne Recht keine Zahl der Spieler:innen");
  assert.equal(spielerVonText(144), "144 von 1000");
  assert.equal(spielerVonText(1000), "1000 von 1000");
  assert.equal(spielerVonText(1003), "1003 (höchstens 1000 Spieler:innen)");
  assert.equal(SPIELER_BESTAND_LEER.titel, "Noch keine Spieler:innen");
  assert.equal(SPIELER_BESTAND_LEER.text, "Der Verein führt noch keine Spieler:innen. Erfasse die erste oder nimm sie in der Spielerliste eines Teams auf.");
  // Eine gelöschte Spieler:in macht die offene Seite überholt (AK 15), wie ein aufgelöstes Team.
  for (const f of ["team_id", "verein_id", "spieler_id"]) assert.equal(zielWeg(f), true, f);
  for (const f of [undefined, "vorname", "name", "spieler_ids"]) assert.equal(zielWeg(f), false, String(f));
  assert.equal(SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN, "Spieler:in nicht gefunden.", "ohne Verweis auf ein Team, gilt auch für die Verwaltung");
});

pruefe("Link als zugestellt (#657 AK 4, PC 1–4): eine Ableitung des Stands, überall dieselben Wörter, offen unmarkiert", () => {
  // Abgeholt hat Vorrang (Zwilling: Trigger spieler_link_zugestellt_fallen, link_zugestellt_kern).
  assert.deepEqual(
    [linkStandAus(true, true), linkStandAus(true, false), linkStandAus(false, true), linkStandAus(false, false)],
    ["abgeholt", "abgeholt", "zugestellt", "offen"],
  );
  assert.deepEqual(LINK_STAENDE, ["abgeholt", "zugestellt", "offen"]);
  for (const st of LINK_STAENDE) assert.equal(LINK_STAND_TEXT.label[st], st, "PC 4: das Wort ist der Stand");
  // AK 4: offen nennt keinen Stand, die anderen im Tooltip und im Namen des Knopfs.
  assert.deepEqual(linkKnopfText("Lena Muster", "offen"), { tooltip: "Privater Link", label: "Privater Link für Lena Muster" });
  assert.deepEqual(linkKnopfText("Lena Muster", "zugestellt"), { tooltip: "Privater Link · zugestellt", label: "Privater Link für Lena Muster, zugestellt" });
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const punkt = lies("components/team/LinkStandLozenge.tsx");
  assert.match(punkt, /abgeholt: "success",\s*zugestellt: "information",\s*offen: undefined/, "Punkt: grün, blau, keiner");
  assert.match(lies("components/ui/ZeichenPunkt.tsx"), /information: "bg-icon-information"/);
  // Eine Ableitung: Die Spalte `link_zugestellt` lesen nur die beiden Kerne, und nur über linkStandAus.
  const leser: string[] = [];
  for (const ordner of ["lib", "components", "app"])
    for (const datei of quelldateien(join(web, ordner)))
      if (/\blink_zugestellt\b/.test(readFileSync(datei, "utf8"))) leser.push(relative(web, datei));
  assert.deepEqual(leser.sort(), ["lib/kern/spieler.ts", "lib/kern/verein.ts"], "link_zugestellt ausserhalb der Kerne");
  for (const d of ["lib/kern/spieler.ts", "lib/kern/verein.ts"]) assert.match(lies(d), /linkStandAus\(/, d);
  // Gesetzt wird nur über die zwei RPCs, der KI-Weg nur über den Team-Ort.
  assert.match(lies("lib/kern/spieler.ts"), /\.rpc\("spieler_link_zugestellt_setzen"/);
  assert.match(lies("lib/kern/verein.ts"), /\.rpc\("verein_spieler_link_zugestellt_setzen"/);
  const ki = lies("lib/mcp/werkzeuge/spieler.ts");
  assert.match(ki, /setzeLinkZugestellt\(/);
  assert.ok(!/ImVerein|verein_spieler_link_zugestellt/.test(ki), "KI-Werkzeug am Verein-Ort");
});

pruefe("Spielerbestand der Verwaltung (#582, #585): Löschen, Import und Verein-Weg nur am Verein-Ort (Review Focus 4)", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Der Team-Ort kennt weder das Löschen einer Spieler:in noch einen Verein-Weg.
  const treffer: string[] = [];
  for (const ordner of ["components/team", "app/(app)/team"])
    for (const datei of quelldateien(join(web, ordner)))
      readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
        if (/\b(loescheSpielerImVerein\w*|verein_spieler_\w+|VereinSpieler(Formular|LinkDialog|Loeschen|Liste|Import)|importiereInVerein\w*|pruefeVereinImport\w*)\b/.test(zeile)) treffer.push(`${relative(web, datei)}:${i + 1}`);
      });
  assert.deepEqual(treffer, [], `Verein-Weg am Team-Ort: ${treffer.join(", ")}`);
  // Die Spielerliste eines Teams bietet kein Löschen.
  assert.ok(!/loesche|Löschen["'`]/.test(lies("components/team/SpielerListe.tsx").replace(/\/\*[\s\S]*?\*\//g, "")), "Löschen gibt es im Team nicht");
  // … und keine Spieler:in ohne Team: Sie liest nur die Zuordnungen des Kontextteams (eine Zeile je Zuordnung),
  // nie `spieler` direkt. Dass auch kein Team-Weg sie erreicht, belegt supabase/tests/spielerbestand_verwaltung.sql (AK 14).
  const liste = lies("lib/kern/spieler.ts").match(/export async function ladeSpielerliste[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(liste, /\.from\("team_spieler"\)[\s\S]*?\.eq\("team_id", e\.teamId\)/, "Team-Spielerliste über die Zuordnungen des Teams");
  assert.ok(!/\.from\("spieler"\)/.test(liste), "Team-Spielerliste liest spieler direkt");
  // Der Import gehört dem Verein-Ort (#585 AK 12): Den Team-Import mit seinen Namen gibt es nirgends mehr,
  // der Dialog hängt allein an der Verwaltungsliste, und kein Team-Baustein kennt das Datei-Symbol.
  const teamImport: string[] = [];
  const dialogNutzer: string[] = [];
  const rpcImport: string[] = [];
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei === fileURLToPath(import.meta.url) || rel === "scripts/pruefe-kern-db.ts") continue;
    const text = readFileSync(datei, "utf8");
    if (/(?<![A-Za-z])(SpielerImport|importiereSpieler\w*|pruefeSpielerImport\w*|importZuGross|importGrenzText)\b/.test(text)) teamImport.push(rel);
    if (/import[^;]*\bVereinSpielerImport\b[^;]*from/.test(text)) dialogNutzer.push(rel);
    if (/\.rpc\(\s*["`']verein_spieler_importieren["`']/.test(text)) rpcImport.push(rel);
  }
  assert.deepEqual(teamImport, [], `Team-Import-Namen stehen noch in: ${teamImport.join(", ")}`);
  assert.deepEqual(dialogNutzer, ["components/verein/VereinSpielerListe.tsx"], "Import-Dialog nur in der Verwaltungsliste");
  assert.deepEqual(rpcImport, ["lib/kern/verein.ts"], "verein_spieler_importieren nur im Verein-Kern");
  assert.ok(!/FileUp/.test(lies("components/team/SpielerListe.tsx")), "kein Datei-Symbol in der Spielerliste des Teams");
  assert.ok(!/CSV/.test(lies("components/team/SpielerListe.tsx").replace(/\/\*[\s\S]*?\*\//g, "")), "kein Hinweis auf den Import an der alten Stelle (#585 OoS 2)");
  // Der Knopf steht in der Verwaltungsliste, der Dialog nur, solange er offen ist, und er schliesst beim Wechsel der Eingrenzung.
  const verwaltungsliste = lies("components/verein/VereinSpielerListe.tsx");
  assert.match(verwaltungsliste, /\{importOffen && <VereinSpielerImport /, "Dialog bedingt gemountet");
  assert.match(verwaltungsliste, /setSchluesselVorher\(schluessel\);[\s\S]*?setImportOffen\(false\)/, "Eingrenzungswechsel schliesst den Import");
  // Die Antwort `veraltet` ersetzt die Vorschau und zeigt das Band; die nächste selbst ausgelöste Vorschau löscht es.
  const dialog = lies("components/verein/VereinSpielerImport.tsx");
  assert.match(dialog, /function laden\([\s\S]*?setVeraltet\(false\)/, "Hinweisband verschwindet bei der nächsten Vorschau");
  assert.match(dialog, /status === "veraltet"[\s\S]*?setVorschau\(r\.ausgang\.vorschau\);\s*setVeraltet\(true\)/, "veraltet: neue Vorschau mit Hinweisband");
  // Das einzige Löschen einer Spieler:in im Web liegt im Verein-Kern und seiner Action.
  const loescher: string[] = [];
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei === fileURLToPath(import.meta.url) || rel === "scripts/pruefe-kern-db.ts") continue;
    if (/\.rpc\(\s*["`']verein_spieler_entfernen["`']/.test(readFileSync(datei, "utf8"))) loescher.push(rel);
    if (/from\("spieler"\)\s*\.delete\(/.test(readFileSync(datei, "utf8"))) loescher.push(rel);
  }
  assert.deepEqual(loescher, ["lib/kern/verein.ts"], "verein_spieler_entfernen nur im Verein-Kern, kein direktes Löschen");
  // Die geteilten Bausteine hängen an keiner Rolle: keine Actions, kein Kern.
  for (const datei of quelldateien(join(web, "components/spieler")))
    assert.ok(!/lib\/(actions|kern)\//.test(readFileSync(datei, "utf8")), `geteilter Baustein importiert Actions oder Kern: ${relative(web, datei)}`);
  // Ob eine Meldung am Feld oder als Band steht, entscheidet die Art des Fehlers, nicht sein Wortlaut.
  assert.ok(!/SPIELER_TEXT|FELD_TEXTE/.test(lies("components/verein/VereinSpielerFormular.tsx")), "Formular vergleicht Wortlaute");
  assert.equal((lies("lib/actions/verein.ts").match(/feld: r\.feld, art: r\.art \}/g) ?? []).length, 2, "Erfassen und Ändern geben die Art weiter");
  // Die Verein-Actions für Spieler:innen kommen aus der Datenebene, nicht aus der Liste: Teams für das Revalidieren aus der Antwort.
  assert.match(lies("lib/actions/verein.ts"), /for \(const t of r\.wert\.teams\) revalidiereTeam\(t\.id\)/);
});

pruefe("Vereinsverwaltung (#581): Zwillinge, Sätze zum Aufnehmen und Bereich der Seitenleiste", () => {
  // Zwilling des CHECK `verein_name`.
  assert.equal(VEREIN_NAME_MAX, 60);
  assert.equal(vereinsNameProblem("FC Wyler"), null);
  assert.equal(vereinsNameProblem("  FC Wyler  "), null, "Leerraum am Rand zählt nicht");
  assert.equal(vereinsNameProblem("x".repeat(60)), null);
  assert.equal(vereinsNameProblem("x".repeat(61)), `Der Vereinsname darf höchstens 60 Zeichen lang sein.`);
  assert.equal(vereinsNameProblem("   "), "Bitte einen Vereinsnamen angeben.");
  // Teamname vergeben: Netz ohne Namen, Anwendung mit dem Team (AK 21); beide aus dem Marker erklärt.
  assert.equal(VEREIN_MELDUNG.TEAMNAME_VERGEBEN, "Im Verein trägt schon ein anderes Team diesen Namen.");
  assert.equal(teamnameVergebenText("Da Junioren"), "Im Verein trägt schon das Team «Da Junioren» diesen Namen.");
  assert.equal(fehlerMeldung("x TEAMNAME_VERGEBEN y"), VEREIN_MELDUNG.TEAMNAME_VERGEBEN);
  // Personensuche: genau diese fünf Status, ein Wortlaut für Team- und Verein-Ort.
  assert.deepEqual(Object.keys(PERSON_MELDUNG).sort(), ["anderer_verein", "bereits_mitglied", "bereits_verwaltung", "gebremst", "nicht_gefunden"]);
  assert.equal(PERSON_MELDUNG.anderer_verein, VEREIN_MELDUNG.ANDERER_VEREIN, "eine Konstante, nicht zwei Texte");
  assert.equal(PERSON_MELDUNG.nicht_gefunden, "Zu dieser Adresse gibt es kein bestätigtes Konto. Die Person registriert sich zuerst selbst bei KiFu.");
  assert.equal(PERSON_MELDUNG.bereits_mitglied, "Diese Person ist bereits im Team.");
  assert.equal(PERSON_MELDUNG.bereits_verwaltung, "Diese Person gehört schon zur Vereinsverwaltung.");
  assert.equal(PERSON_MELDUNG.gebremst, "Zu viele Versuche - bitte später erneut.");

  // Bereich aus der Adresse (AP §7.1).
  const T1 = "11111111-1111-4111-8111-111111111111";
  const T2 = "22222222-2222-4222-8222-222222222222";
  assert.deepEqual(bereichAusPfad(`/team/${T1}`, null), { art: "team", id: T1 });
  assert.deepEqual(bereichAusPfad(`/team/${T1}/verwaltung`, null), { art: "team", id: T1 });
  assert.deepEqual(bereichAusPfad(`/team/${T1}/verwaltung/link`, null), { art: "team", id: T1 }, "ein Bereich der Team-Verwaltung (#656)");
  assert.deepEqual(bereichAusPfad("/verein", null), { art: "verein" });
  assert.deepEqual(bereichAusPfad("/verein/team/abc", null), { art: "verein" });
  assert.deepEqual(bereichAusPfad("/verein/verwaltung", null), { art: "verein" });
  assert.deepEqual(bereichAusPfad(`/training/${T2}`, T1), { art: "team", id: T1 }, "ein Team-Training gehört zu seinem Team");
  assert.equal(bereichAusPfad(`/training/${T2}`, null), null, "ein persönliches Training liegt in keinem Bereich");
  for (const pfad of ["/", "/trainings", "/teams", "/konto", "/konto/verbindungen", "/konto/daten", "/vereinsliste", `/teamx/${T1}`]) assert.equal(bereichAusPfad(pfad, null), null, pfad);
  assert.equal(bereichAusPfad("/trainings", T1), null, "die Trainingsübersicht liegt in keinem Bereich");

  // Cookie: lesen, schreiben, fremde Werte fallen weg.
  assert.equal(BEREICH_COOKIE, "kifu-bereich");
  assert.deepEqual(leseBereich("verein"), { art: "verein" });
  assert.deepEqual(leseBereich(`team:${T1}`), { art: "team", id: T1 });
  for (const wert of [undefined, "", "team:", "team:x", "team:../etc", "Verein", "verein;x", "team:" + T1 + "x"]) assert.equal(leseBereich(wert), null, String(wert));
  assert.equal(bereichSchluessel({ art: "team", id: T1 }), `team:${T1}`);
  assert.match(bereichCookie({ art: "verein" }), /^kifu-bereich=verein; path=\/; max-age=\d+; samesite=lax$/);

  // Welcher Bereich gilt: Adresse vor Cookie vor erstem; Fremdes und Verwaistes fällt zurück.
  const eigene: Bereich[] = [{ art: "team", id: T1 }, { art: "team", id: T2 }, { art: "verein" }];
  assert.deepEqual(waehleBereich(eigene, { art: "verein" }, { art: "team", id: T2 }), { art: "verein" });
  assert.deepEqual(waehleBereich(eigene, null, { art: "team", id: T2 }), { art: "team", id: T2 });
  assert.deepEqual(waehleBereich(eigene, null, null), { art: "team", id: T1 }, "ohne alles der erste");
  assert.deepEqual(waehleBereich(eigene, null, { art: "team", id: "99999999-9999-4999-8999-999999999999" }), { art: "team", id: T1 }, "verwaistes Team im Cookie");
  assert.deepEqual(waehleBereich(eigene, { art: "team", id: "99999999-9999-4999-8999-999999999999" }, { art: "verein" }), { art: "verein" }, "fremdes Team in der Adresse: der gemerkte");
  assert.deepEqual(waehleBereich([{ art: "verein" }], null, { art: "team", id: T1 }), { art: "verein" }, "Verwaltung ohne Team: nur der Verein");
  assert.equal(waehleBereich([], { art: "verein" }, null), null, "ohne Bereiche kein Bereich");
});

/** Alle .ts/.tsx-Dateien unter einem Ordner, ohne node_modules und .next. */
function quelldateien(wurzel: string): string[] {
  // lib/database.types.ts ist aus der lokalen DB erzeugt (gitignored) und
  // nennt jede Spalte und RPC — kein Quelltext, den die Wächter meinen.
  return readdirSync(wurzel, { recursive: true, encoding: "utf8" })
    .filter((d) => /\.tsx?$/.test(d) && !/(^|\/)(node_modules|\.next)(\/|$)/.test(d) && !/(^|\/)database\.types\.ts$/.test(d))
    .map((d) => join(wurzel, d));
}

pruefe("Kein «ansetzen» mehr in Oberfläche und KI-Texten (#323 PC 11)", () => {
  const treffer: string[] = [];
  for (const wurzel of ["app", "components", "lib/mcp", "lib/kern", "lib/actions", "lib/termin.ts", "lib/serie.ts", "lib/veraltet.ts", "lib/monat.ts", "lib/team-ansicht.ts"].map((p) => join(web, p)))
    for (const datei of existsSync(wurzel) && statSync(wurzel).isDirectory() ? quelldateien(wurzel) : existsSync(wurzel) ? [wurzel] : [])
      readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
        // Kommentare sieht niemand; geprüft wird, was Oberfläche und KI sagen.
        if (/^\s*(\*|\/\/|\/\*)/.test(zeile)) return;
        const ohneKommentar = zeile.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
        if (/ansetz|angesetzt|Ansetz|Angesetzt/.test(ohneKommentar)) treffer.push(`${relative(web, datei)}:${i + 1}`);
      });
  assert.deepEqual(treffer, [], `«ansetzen» steht noch in: ${treffer.join(", ")}`);
});

/** «Probe» in Oberflächentexten und KI-Texten (Story #584 AK 2, 3). Geprüft wird mit dem
 *  Parser, was Menschen oder ein KI-Client zu sehen bekommen: Zeichenketten, Vorlagen und
 *  JSX-Text (nicht Kommentare, Bezeichner, Importpfade, Typ-Literale) und unter `lib/mcp` die
 *  Namen der Schema-Schlüssel. Die internen Namen der Datenebene (`PROBE_INTERN`, als ganze
 *  Wörter) sind ausserhalb von `lib/mcp` erlaubt; unter `lib/mcp` nur, wo sie als Name gebraucht
 *  werden (Argument von `.rpc()`, `.from()`, `.select()` u. ä.), damit keine KI-Beschreibung sie
 *  nennt. Die alten Werkzeugnamen stehen nirgends ausser als solcher Name. Von Teams verfasste
 *  Texte stehen nie im Quelltext. */
const PROBE_INTERN =
  /\b(?:team_probetraining\w*|spieler_probe_\w+|team_probe_staende|probe_seit|probe_stand\w*|probe_voll|probe_info|PROBE_[A-Z_]+)\b|\bprobe-info\b/g;
/** Die Werkzeugnamen vor #584 (`spieler_probe_setzen` heisst die RPC weiterhin). */
const ALTE_WERKZEUGNAMEN = /\b(?:probetraining_abrufen|probetraining_festlegen|spieler_probe_setzen)\b/;
/** Methoden des Datenbank-Clients, deren Zeichenketten-Argument ein Name der Datenebene ist. */
const NAMENS_AUFRUFE = ["rpc", "from", "select", "eq", "neq", "in", "is", "order", "insert", "update", "upsert", "match", "filter"];
/** Aufrufe, deren Eingabe-Objekt die interne Eigenschaft `probe` trägt (Kern, nicht KI-Schema). */
const PROBE_KERN_AUFRUFE = ["schalteProbe"];

function probeTreffer(quelltext: string, rel: string): string[] {
  const treffer: string[] = [];
  const sf = ts.createSourceFile(rel, quelltext, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ort = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const imKi = rel.startsWith("lib/mcp/");
  const besuche = (n: ts.Node) => {
    const p = n.parent;
    if (
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)
    ) {
      const modul = (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === n;
      const dynamisch = ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword;
      const typ = ts.isLiteralTypeNode(p);
      const name =
        ts.isCallExpression(p) && p.arguments.some((a) => a === n) &&
        ts.isPropertyAccessExpression(p.expression) && NAMENS_AUFRUFE.includes(p.expression.name.text);
      const rest = imKi && !name ? n.text : n.text.replace(PROBE_INTERN, "");
      if (modul || dynamisch || typ) {
        // Importpfade und Typ-Literale sieht niemand.
      } else if (!name && ALTE_WERKZEUGNAMEN.test(n.text)) treffer.push(`${ort(n)} alter Werkzeugname «${n.text.slice(0, 60)}»`);
      else if (/probe/i.test(rest)) treffer.push(`${ort(n)} Text «${n.text.slice(0, 60)}»`);
    }
    if (imKi && (ts.isPropertyAssignment(n) || ts.isPropertySignature(n) || ts.isShorthandPropertyAssignment(n)) && /probe/i.test(n.name.getText(sf))) {
      let kernEingabe = false;
      for (let a: ts.Node | undefined = n.parent; a; a = a.parent)
        if (ts.isCallExpression(a) && ts.isIdentifier(a.expression) && PROBE_KERN_AUFRUFE.includes(a.expression.text)) kernEingabe = true;
      if (!kernEingabe) treffer.push(`${ort(n)} Schlüssel «${n.name.getText(sf)}»`);
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return treffer;
}

/** Vereinsnamen sind frei wählbar («FC Wyler», «Sportvereinigung Muster»): Ein Artikel oder eine
 *  verschmolzene Präposition direkt vor dem eingesetzten Namen («im ${verein}», «des {vereinName}»)
 *  passt nur für manche. Texte nennen den Namen nach dem Wort «Verein» in « » («im Verein «${verein}»»;
 *  AP §5.3 «Vereinsname ohne Artikel»). Gefangen wird jede Einsetzung eines Bezeichners mit `verein`
 *  im Namen (Vorlage `${…}` oder JSX `{…}`) unmittelbar hinter einem solchen Wort; Kommentare sieht niemand.
 *  Nicht gefangen: ein Bezeichner ohne «verein» im Namen, JSX über einen Zeilenumbruch und Konkatenation
 *  (`"im " + name`) — der Wächter ist ein Netz, kein Beweis. */
const ARTIKEL_VOR_VEREINSNAME =
  /\b(?:der|des|dem|den|im|in den|zum|zur|vom|beim|am|ins|für den|für das)\s+\$?\{\s*(?:\w+\??\.)*(?:verein|vereinName|vereinsname)\w*\b[^}]*\}/i;

function artikelVorVereinsnameTreffer(quelltext: string, rel: string): string[] {
  const treffer: string[] = [];
  quelltext.split("\n").forEach((zeile, i) => {
    if (/^\s*(\*|\/\/|\/\*)/.test(zeile)) return;
    const ohneKommentar = zeile.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (ARTIKEL_VOR_VEREINSNAME.test(ohneKommentar)) treffer.push(`${rel}:${i + 1}`);
  });
  return treffer;
}

pruefe("Kein Artikel vor dem Vereinsnamen in Oberfläche und KI-Texten (Phase D, AP §5.3)", () => {
  // Der Wächter schlägt an …
  for (const schlecht of [
    "const a = `wird im ${verein} schon geführt`;",
    "const a = `kommt in den ${vereinName}.`;",
    "const a = `Sie gehört zum ${verein.name}`;",
    "<p>Du verwaltest den {vereinName} danach nicht mehr.</p>",
    "<h1>Verwaltung des {l.verein}</h1>",
    "const a = `${wer} bleibt im ${l.verein ?? 'x'}`;",
  ])
    assert.equal(artikelVorVereinsnameTreffer(schlecht, "x.tsx").length, 1, schlecht);
  // … und lässt die neutrale Form, andere Namen und Kommentare durch.
  for (const gut of [
    "const a = `wird im Verein «${verein}» schon geführt`;",
    "<p>Du verwaltest den Verein «{vereinName}» danach nicht mehr.</p>",
    "const a = `Vereinsverwaltung von «${verein}»`;",
    "const a = `Der Link ist von ${vorname} im Team ${team}`;",
    "const a = `für den ${spielerName}`;",
    "// zum ${verein} gehört",
    " * im ${verein}",
  ])
    assert.deepEqual(artikelVorVereinsnameTreffer(gut, "x.tsx"), [], gut);
  const treffer: string[] = [];
  for (const wurzel of ["app", "components", "lib"].map((p) => join(web, p)))
    for (const datei of quelldateien(wurzel)) {
      const rel = relative(web, datei);
      // Generierte Typen schreibt niemand von Hand. Das generierte Produktwissen (lib/feedback/wissen.ts)
      // ist seit Phase D nicht mehr ausgenommen.
      if (rel === "lib/database.types.ts") continue;
      treffer.push(...artikelVorVereinsnameTreffer(readFileSync(datei, "utf8"), rel));
    }
  assert.deepEqual(treffer, [], `Artikel vor dem Vereinsnamen in: ${treffer.join(", ")}`);
});

pruefe("Kein «Probe» in Oberflächentexten und KI: Texte, JSX, Schema-Schlüssel (#584 AK 2, 3)", () => {
  // Der Wächter schlägt an: Text, JSX, Schlüssel im KI-Schema, `feld`; und lässt Internes durch.
  assert.equal(probeTreffer('export const a = "Probetraining";', "lib/x.ts").length, 1);
  assert.equal(probeTreffer("export const a = `${n} im Probe-Modus`;", "lib/x.ts").length, 1);
  assert.equal(probeTreffer("export const a = <p>Probe-Spieler:in</p>;", "components/x.tsx").length, 1);
  assert.equal(probeTreffer('export const a = { feld: "probe" };', "lib/kern/x.ts").length, 1);
  assert.equal(probeTreffer("export const a = z.object({ probe: z.boolean() });", "lib/mcp/werkzeuge/x.ts").length, 1);
  assert.equal(probeTreffer("export const a = { probe: z.boolean() };", "lib/kern/x.ts").length, 0, "Schlüssel zählen nur im KI-Weg");
  assert.equal(probeTreffer("export const a = s.probe; // Probetraining", "lib/mcp/werkzeuge/x.ts").length, 0, "Lesen und Kommentare bleiben");
  assert.equal(probeTreffer("schalteProbe(a, b, { teamId, probe: e.schnuppern });", "lib/mcp/werkzeuge/x.ts").length, 0, "Eingabe des Kerns");
  assert.equal(
    probeTreffer('import { x } from "@/lib/probe"; db.rpc("spieler_probe_setzen"); db.select("probe_seit, a"); const m = "PROBE_ANZAHL_FEHLT"; type G = "probe_voll";', "lib/x.ts").length,
    0,
    "interne Namen der Datenebene",
  );
  // Nur als ganzes Wort, und unter lib/mcp nur als Name eines Datenbank-Aufrufs.
  assert.equal(probeTreffer('export const a = "Ein Xprobe_voll";', "lib/x.ts").length, 1, "ohne Wortgrenze keine Ausnahme");
  assert.equal(probeTreffer('export const a = { description: "Ruft spieler_probe_setzen auf." };', "lib/mcp/werkzeuge/x.ts").length, 1, "RPC-Name in einer KI-Beschreibung");
  assert.equal(probeTreffer('export const a = z.string().describe("Ist probe_voll, geht nichts.");', "lib/mcp/werkzeuge/x.ts").length, 1, "Spaltenname in einer KI-Beschreibung");
  assert.equal(probeTreffer('db.rpc("spieler_probe_setzen"); db.from("team_probetraining").select("probe_seit");', "lib/mcp/werkzeuge/x.ts").length, 0, "als Name unter lib/mcp");
  // Die alten Werkzeugnamen nirgends, ausser als RPC-Name.
  for (const alt of ["probetraining_abrufen", "probetraining_festlegen", "spieler_probe_setzen"])
    assert.equal(probeTreffer(`export const a = "Nutze ${alt}.";`, "components/x.tsx").length, 1, alt);
  assert.equal(probeTreffer('supabase.rpc("spieler_probe_setzen", {}); db.rpc("team_probetraining_festlegen");', "lib/kern/x.ts").length, 0, "RPC-Namen im Kern");
  const treffer: string[] = [];
  for (const wurzel of ["app", "components", "lib"].map((p) => join(web, p)))
    for (const datei of quelldateien(wurzel)) {
      const rel = relative(web, datei);
      treffer.push(...probeTreffer(readFileSync(datei, "utf8"), rel));
    }
  assert.deepEqual(treffer, [], `«Probe» steht noch in Oberflächen- oder KI-Texten: ${treffer.join("; ")}`);
});

/** Was Menschen oder ein KI-Client von einer Quelldatei zu lesen bekommen: Zeichenketten,
 *  Vorlagen und JSX-Text — nicht Kommentare, Bezeichner, Importpfade, Typ-Literale und nicht
 *  Namen der Datenebene (Argument von `.rpc()`, `.select()` u. ä.). Unter `lib/mcp` dazu die
 *  Schema-Schlüssel, die der KI-Client als Feldnamen sieht. Für die Wortlaut-Wächter von #659. */
function sichtbareTexte(quelltext: string, rel: string): { ort: string; text: string; schluessel?: true }[] {
  const texte: { ort: string; text: string; schluessel?: true }[] = [];
  const sf = ts.createSourceFile(rel, quelltext, ts.ScriptTarget.Latest, true, rel.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const ort = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`;
  const besuche = (n: ts.Node) => {
    const p = n.parent;
    if (
      ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)
    ) {
      const modul = (ts.isImportDeclaration(p) || ts.isExportDeclaration(p)) && p.moduleSpecifier === n;
      const dynamisch = ts.isCallExpression(p) && p.expression.kind === ts.SyntaxKind.ImportKeyword;
      const name =
        ts.isCallExpression(p) && p.arguments.some((a) => a === n) &&
        ts.isPropertyAccessExpression(p.expression) && NAMENS_AUFRUFE.includes(p.expression.name.text);
      if (!modul && !dynamisch && !name && !ts.isLiteralTypeNode(p)) texte.push({ ort: ort(n), text: n.text });
    }
    if (rel.startsWith("lib/mcp/") && (ts.isPropertyAssignment(n) || ts.isPropertySignature(n) || ts.isShorthandPropertyAssignment(n)))
      texte.push({ ort: ort(n), text: n.name.getText(sf), schluessel: true });
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return texte;
}

/** «bezogen» heisst überall «abgeholt» (#657 PC 4, #659). Erlaubt bleibt nur der Name der
 *  Spalte `link_bezogen` (Sync-Risiko, fällt mit N1) als ganzes Wort, etwa in einer
 *  Spaltenliste; den Schlüssel `bezogen` der RPC-Antworten lesen nur Bezeichner. */
function bezogenTreffer(quelltext: string, rel: string): string[] {
  return sichtbareTexte(quelltext, rel)
    .filter((t) => /bezogen/i.test(t.schluessel ? t.text : t.text.replace(/\blink_bezogen\b/g, "")))
    .map((t) => `${t.ort} ${t.schluessel ? "Schlüssel" : "Text"} «${t.text.slice(0, 60)}»`);
}

/** Den privaten Link nutzen Spieler:innen und Eltern (#659 AK 1–3): Ein Satz, der «Eltern»
 *  nennt, nennt im selben Satz auch die Spieler:in — sonst richtet er sich nur an Eltern.
 *  Angaben am Link heissen nach dem Kanal (`LINK_KANAL`). Felder und Bausteine (`hinweis_eltern`,
 *  `hinweisEltern`, `ElternAnsicht`) sind Bezeichner und zählen nicht. Ein Satz endet an
 *  «.», «!» oder «?» vor einem Leerraum; ein über mehrere Zeichenketten verteilter Satz zählt
 *  je Zeichenkette — der Wächter ist ein Netz, kein Beweis. */
function nurElternTreffer(quelltext: string, rel: string): string[] {
  const treffer: string[] = [];
  for (const t of sichtbareTexte(quelltext, rel)) {
    if (t.schluessel) continue;
    for (const satz of t.text.split(/(?<=[.!?])\s+/))
      if (/\bEltern\b/.test(satz) && !/Spieler:in/.test(satz)) treffer.push(`${t.ort} «${satz.replace(/\s+/g, " ").trim().slice(0, 80)}»`);
  }
  return treffer;
}

/** Die Dateien der Wortlaut-Wächter: Oberfläche, Kern und KI. Ausgenommen sind die generierten
 *  Typen und `lib/feedback/`: wissen.ts ist aus docs/feedback-triage.md generiert, die übrigen
 *  Dateien (Prompt, Lage, Regeln) beschreiben das Produkt für das Feedback-Modell nach derselben
 *  Doku — alle ziehen mit der Produktdoku beim Release nach. */
function wortlautDateien(): { rel: string; text: string }[] {
  const dateien: { rel: string; text: string }[] = [];
  for (const wurzel of ["app", "components", "lib"].map((p) => join(web, p)))
    for (const datei of quelldateien(wurzel)) {
      const rel = relative(web, datei);
      if (rel === "lib/database.types.ts" || rel.startsWith("lib/feedback/")) continue;
      dateien.push({ rel, text: readFileSync(datei, "utf8") });
    }
  return dateien;
}

pruefe("Kein «bezogen» in Oberfläche und KI, nur die Spalte link_bezogen als Name (#657 PC 4, #659)", () => {
  // Der Wächter schlägt an …
  assert.equal(bezogenTreffer('export const a = "3 Links bezogen";', "components/x.tsx").length, 1);
  assert.equal(bezogenTreffer("export const a = <span>Bezogen</span>;", "components/x.tsx").length, 1);
  assert.equal(bezogenTreffer("export const a = `${n} bezogen`;", "lib/x.ts").length, 1);
  assert.equal(bezogenTreffer("export const a = z.object({ link_bezogen: z.boolean() });", "lib/mcp/werkzeuge/x.ts").length, 1, "Schlüssel im KI-Schema");
  // … und lässt Spaltennamen, Bezeichner und Kommentare durch.
  for (const gut of [
    'db.from("spieler").select("id, link_bezogen");',
    'const SPALTEN = "id, vorname, link_bezogen, kader_spieler(kader_id)";',
    "const r = data as { bezogen: boolean }; // bezogen heisst abgeholt",
    "export const b = s.link_bezogen === true;",
  ])
    assert.deepEqual(bezogenTreffer(gut, "lib/kern/x.ts"), [], gut);
  const treffer = wortlautDateien().flatMap((d) => bezogenTreffer(d.text, d.rel));
  assert.deepEqual(treffer, [], `«bezogen» steht noch in Oberflächen- oder KI-Texten: ${treffer.join("; ")}`);
});

pruefe("Angaben am privaten Link für Spieler:innen und Eltern, nie nur für Eltern (#659 AK 1–3)", () => {
  // Der Wächter schlägt an …
  for (const schlecht of [
    'export const a = "Die Eltern sehen den Hinweis.";',
    "export const a = <label>Hinweis für Eltern</label>;",
    "export const a = `Eltern melden bis ${frist}`;",
    'export const a = "Abholadresse erneuert. Teile die neue im Eltern-Chat.";',
  ])
    assert.equal(nurElternTreffer(schlecht, "components/x.tsx").length, 1, schlecht);
  // … und lässt beide Lesergruppen, Bezeichner, Zusammensetzungen und Kommentare durch.
  for (const gut of [
    'export const a = "Spieler:innen und Eltern sehen den Hinweis.";',
    'export const a = "Gib ihn nur der Spieler:in selbst oder ihren Eltern.";',
    "export const a = { hinweisEltern: t.hinweis_eltern }; // der Hinweis für Eltern",
    'import { HinweisEltern } from "./HinweisEltern";',
    'export const a = "Elternkontakte bleiben auf deinem Gerät.";',
  ])
    assert.deepEqual(nurElternTreffer(gut, "components/x.tsx"), [], gut);
  // Die Kanalbezeichnungen (kurze Labels).
  assert.deepEqual(LINK_KANAL, { hinweis: "Hinweis am privaten Link", meldefrist: "Meldefrist am privaten Link", kurz: "Am Link:" });
  const treffer = wortlautDateien().flatMap((d) => nurElternTreffer(d.text, d.rel));
  assert.deepEqual(treffer, [], `Texte nur für Eltern: ${treffer.join("; ")}`);
});

pruefe("Kalenderblatt und Tag ohne Jahr: Wochentag, Tageszahl, Monat, nie das Jahr (#402 AK 1, #403 AK 8)", () => {
  assert.deepEqual(kalenderblatt("2026-10-06"), { wochentag: "Di", tag: 6, monat: "Okt." });
  assert.deepEqual(kalenderblatt("2027-03-01"), { wochentag: "Mo", tag: 1, monat: "März" });
  assert.equal(tagOhneJahr("2026-10-06"), "Dienstag, 6. Oktober");
  assert.equal(tagOhneJahr("2026-11-01"), "Sonntag, 1. November");
});

pruefe("Plan-Gliederung: Monate und Tage in der Reihenfolge der Eingabe, im Tag der Beginn aufsteigend (#402 AK 2, 19, 20)", () => {
  const t = (id: string, datum: string, beginn: string) => ({ id, datum, beginn });
  // Anstehend kommt aufsteigend, der Rückblick absteigend und im Tag mit Beginn absteigend.
  const anstehend = nachMonatUndTag([t("b", "2026-10-06", "19:00"), t("a", "2026-10-06", "18:00"), t("c", "2026-10-08", "17:00"), t("d", "2026-11-02", "18:00")]);
  assert.deepEqual(anstehend.map((m) => m.monat), ["2026-10", "2026-11"]);
  assert.deepEqual(anstehend[0].tage.map((d) => [d.datum, d.termine.map((x) => x.id)]), [["2026-10-06", ["a", "b"]], ["2026-10-08", ["c"]]]);
  const rueckblick = nachMonatUndTag([t("x", "2026-10-05", "20:00"), t("y", "2026-10-05", "19:00"), t("z", "2026-10-05", "17:00"), t("g", "2026-10-05", "17:00"), t("w", "2026-09-30", "18:00")]);
  assert.deepEqual(rueckblick.map((m) => m.monat), ["2026-10", "2026-09"]);
  // Gleicher Beginn: die Reihenfolge der Eingabe (nach dem Anlegen) bleibt.
  assert.deepEqual(rueckblick[0].tage[0].termine.map((x) => x.id), ["z", "g", "y", "x"]);
  // Derselbe Monat in zwei Jahren bleibt getrennt.
  assert.deepEqual(nachMonatUndTag([t("1", "2026-10-01", "18:00"), t("2", "2027-10-01", "18:00")]).map((m) => m.monat), ["2026-10", "2027-10"]);
  assert.deepEqual(nachMonatUndTag([]), []);
});

const ABO_JETZT = new Date("2026-10-01T10:00:00Z");
const aboTermin = (t: Partial<AboTermin> & { id: string }): AboTermin => ({
  datum: "2026-10-07", beginn: "18:00", ende: "19:30", ort: null, geaendert: "2026-09-30T08:00:00Z", titel: "Training · FC Test", ...t,
});
const aboText = (termine: AboTermin[]) =>
  kalenderText({ kalenderName: "Training · FC Test", verweis: (id) => `https://ki-fu.ch/team/team/termin/${id}`, jetzt: ABO_JETZT, termine });

pruefe("Abo: Wanduhrzeit mit TZID, Beginn und Ende des Termins (#330 PC 2–4, Review Focus 1)", () => {
  const text = aboText([
    aboTermin({ id: "a", datum: "2027-03-28", beginn: "02:30", ende: "04:00", ort: "Halle; Nord, 2" }),
  ]);
  assert.ok(text.includes("BEGIN:VTIMEZONE\r\nTZID:Europe/Zurich"));
  assert.ok(text.includes("DTSTART;TZID=Europe/Zurich:20270328T023000\r\nDTEND;TZID=Europe/Zurich:20270328T040000"), "Wanduhrzeit, nicht UTC");
  assert.ok(text.includes("LOCATION:Halle\\; Nord\\, 2"), "Escaping");
  assert.ok(text.includes("UID:a@ki-fu.ch"));
  assert.ok(text.includes("URL:https://ki-fu.ch/team/team/termin/a"));
  assert.ok(!/DESCRIPTION:(?!https:\/\/ki-fu\.ch\/team\/team\/termin\/)/.test(text), "PC 2: nur der Verweis");
  assert.ok(text.split("\r\n").every((z) => new TextEncoder().encode(z).length <= 75), "gefaltet");
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
});

pruefe("Abo: Kopf, Zeitstempel und CRLF überall (RFC 5545, AK 2)", () => {
  const text = aboText([aboTermin({ id: "a", geaendert: "2026-09-30T08:15:30.123456+00:00" })]);
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  for (const zeile of ["PRODID:-//KiFu//Team-Kalender//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Training · FC Test", "X-WR-TIMEZONE:Europe/Zurich"])
    assert.ok(text.includes(`\r\n${zeile}\r\n`), zeile);
  assert.ok(text.includes("\r\nDTSTAMP:20261001T100000Z\r\n"), "DTSTAMP UTC aus jetzt");
  assert.ok(text.includes("\r\nLAST-MODIFIED:20260930T081530Z\r\n"), "LAST-MODIFIED UTC aus geaendert");
  assert.ok(!/(^|[^\r])\n/.test(text), "kein nacktes LF");
  assert.ok(!text.includes("\r\nLOCATION"), "kein Ort, keine LOCATION-Zeile");
  assert.equal((text.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.equal(aboDatei("tok"), "tok.ics");
  assert.equal(aboPfad("tok"), "/api/kalender/tok.ics");
});

pruefe("Abo: aboUrl - Origin und Pfad, mit und ohne Bereich", () => {
  assert.equal(aboUrl("https://ki-fu.ch", "tok"), "https://ki-fu.ch/api/kalender/tok.ics");
  assert.equal(aboUrl("http://127.0.0.1:3000", "tok", "spieler/"), "http://127.0.0.1:3000/api/kalender/spieler/tok.ics");
});

pruefe("Abo: Zeiten mit Sekunden (time-Spalte) gehen als HH:MM durch", () => {
  const mitSekunden = aboText([aboTermin({ id: "a", beginn: "18:00:00", ende: "19:30:00" })]);
  assert.ok(mitSekunden.includes("DTSTART;TZID=Europe/Zurich:20261007T180000\r\nDTEND;TZID=Europe/Zurich:20261007T193000"));
});

pruefe("Abo: Ohne Termine bleibt es ein gültiger Kalender samt Zeitzone", () => {
  const text = aboText([]);
  assert.ok(text.startsWith("BEGIN:VCALENDAR\r\n") && text.endsWith("END:VTIMEZONE\r\nEND:VCALENDAR\r\n"));
  assert.ok(!text.includes("BEGIN:VEVENT"));
});

pruefe("Abo: Semikolon, Komma, Backslash und Zeilenumbruch im Text werden maskiert", () => {
  assert.equal(textEscape("a;b,c\\d\ne\r\nf"), "a\\;b\\,c\\\\d\\ne\\nf");
  const text = kalenderText({ kalenderName: "Kids; U9, A\nB", jetzt: ABO_JETZT, termine: [aboTermin({ id: "a", titel: "Training; X, Y\nZ" })] });
  assert.ok(text.includes("\r\nSUMMARY:Training\\; X\\, Y\\nZ\r\n"));
  assert.ok(text.includes("\r\nX-WR-CALNAME:Kids\\; U9\\, A\\nB\r\n"));
});

pruefe("Abo: Faltung zählt Oktette, nicht Zeichen", () => {
  const z = "SUMMARY:" + "ä".repeat(60);
  const f = falten(z).split("\r\n");
  assert.ok(f.every((l) => new TextEncoder().encode(l).length <= 75));
  assert.equal(f.map((l, i) => (i ? l.slice(1) : l)).join(""), z);
});

pruefe("Abo: Eine lange URL-Zeile wird gefaltet und fügt sich wieder zusammen", () => {
  const origin = "https://" + "sehr-lange-adresse.".repeat(6) + "ki-fu.ch";
  const text = kalenderText({ kalenderName: "K", verweis: (id) => `${origin}/team/t/termin/${id}`, jetzt: ABO_JETZT, termine: [aboTermin({ id: "a" })] });
  const zeilen = text.split("\r\n");
  assert.ok(zeilen.every((l) => new TextEncoder().encode(l).length <= 75), "alle Zeilen ≤ 75 Oktette");
  const entfaltet = text.replace(/\r\n /g, "");
  assert.ok(entfaltet.includes(`\r\nURL:${origin}/team/t/termin/a\r\n`), "URL entfaltet vollständig");
  assert.ok(zeilen.some((l) => l.startsWith(" ")), "es wurde tatsächlich gefaltet");
});

const feedTermin = (t: Partial<AboFeedTermin> & { id: string }): AboFeedTermin => ({
  team: "FC Test", datum: "2026-10-07", beginn: "18:00", ende: "19:30", ort: "Sportplatz", art: "training", bezeichnung: null,
  begonnen: false, abgemeldet: false, meldung: null, frist_abgelaufen: false, nicht_aufgeboten: false,
  hinweis_eltern: null, treffpunkte: null, ...t,
});
const elternAbo = (termine: AboFeedTermin[]) =>
  kalenderText({ kalenderName: ABO_KALENDER_NAME, uidZusatz: "abo1", jetzt: ABO_JETZT, termine: termine.map((t) => aboEintrag(t)) });
/** Ein Feed ohne Zeilenfaltung, damit Prüfungen ganze Zeilen sehen. */
const ungefaltet = (text: string) => text.split("\r\n ").join("");

pruefe("Abos: der Kartenlink steht in der Beschreibung, nie als Verweis (#533 PC 4)", () => {
  const link = "https://maps.app.goo.gl/MRWFZj3ZQtsYGBFi9";
  const eltern = ungefaltet(elternAbo([feedTermin({ id: "a", ort_link: link })]));
  assert.ok(eltern.includes(`DESCRIPTION:Zugesagt\\n\\nKarte zum Ort: ${link}`), "Karte nach dem Status");
  assert.ok(!eltern.includes("URL:"), "kein Verweis, der den privaten Link verriete");
  assert.ok(!elternAbo([feedTermin({ id: "a" })]).includes("Karte:"), "ohne Link keine Zeile");
  const verweis = "https://ki-fu.ch/team/t/termin/a";
  const mitglieder = ungefaltet(
    kalenderText({
      kalenderName: "K",
      verweis: () => verweis,
      jetzt: ABO_JETZT,
      termine: [aboTermin({ id: "a", ortLink: link, beschreibung: "Du bist dabei." })],
    }),
  );
  assert.ok(mitglieder.includes(`DESCRIPTION:Du bist dabei.\\n\\nKarte zum Ort: ${link}\\n\\n${verweis}`), "Karte vor dem Verweis");
  assert.ok(mitglieder.includes(`URL:${verweis}`), "URL bleibt der Verweis in die Anwendung");
});

pruefe("Abo Spielervertretung: Training angemeldet = zugesagt, abgemeldet = abgesagt (#507 PC 3, AK 6)", () => {
  assert.equal(aboStatus(feedTermin({ id: "a" })), "zugesagt");
  assert.equal(aboStatus(feedTermin({ id: "a", abgemeldet: true })), "abgesagt");
  const zu = aboEintrag(feedTermin({ id: "a" }));
  assert.equal(zu.titel, "✅ Training · FC Test", "Status vorn im Titel");
  assert.equal(zu.beschreibung, "Zugesagt");
  assert.equal(zu.status, "CONFIRMED");
  assert.equal(zu.frei, false);
  const ab = aboEintrag(feedTermin({ id: "a", abgemeldet: true }));
  assert.equal(ab.titel, "❌ Training · FC Test");
  assert.equal(ab.frei, true, "abgesagt belegt keine Zeit");
});

pruefe("Abo Spielervertretung: nur Terminart, Team, Zeit, Ort, Status — kein Verweis, eigene UID (#507 PC 2, 5, 6; OoS 3)", () => {
  const text = elternAbo([feedTermin({ id: "a", ort: "Halle; Nord" })]);
  assert.ok(text.includes("\r\nX-WR-CALNAME:Trainings und Spiele\r\n"), "Kalender heisst immer gleich, das Team steht im Titel (#583 AK 10)");
  assert.ok(text.includes("\r\nUID:a.abo1@ki-fu.ch\r\n"), "UID je Abo");
  assert.ok(text.includes("DTSTART;TZID=Europe/Zurich:20261007T180000\r\nDTEND;TZID=Europe/Zurich:20261007T193000"), "Schweizer Wanduhrzeit");
  assert.ok(text.includes("\r\nLOCATION:Halle\\; Nord\r\n"));
  assert.ok(text.includes("\r\nSUMMARY:✅ Training · FC Test\r\n"));
  assert.ok(text.includes("\r\nSTATUS:CONFIRMED\r\n"));
  assert.ok(text.includes("\r\nDESCRIPTION:Zugesagt\r\n"));
  assert.ok(!text.includes("URL:") && !text.includes("http"), "kein Verweis, der den Link verriete");
  assert.ok(!text.includes("LAST-MODIFIED"), "der Stand ändert sich ohne den Termin");
  assert.ok(!text.includes("TRANSP:"), "zugesagt belegt Zeit");
  assert.ok(elternAbo([feedTermin({ id: "a", abgemeldet: true })]).includes("\r\nTRANSP:TRANSPARENT\r\n"));
});

pruefe("Link und Abo über mehrere Teams: Team je Termin, konstanter Kalendername, ohne Team leer (#583 AK 8–10)", () => {
  // AK 8, 10: Termine zweier Teams in einem Kalender; jeder Titel trägt sein Team, der Kalender heisst immer gleich.
  const text = elternAbo([feedTermin({ id: "a", team: "Da Junioren" }), feedTermin({ id: "b", team: "Ea Junioren", art: "spiel", bezeichnung: "Spiel gegen FC Au" })]);
  assert.equal(ABO_KALENDER_NAME, "Trainings und Spiele");
  assert.ok(text.includes("\r\nX-WR-CALNAME:Trainings und Spiele\r\n"));
  assert.ok(text.includes("\r\nSUMMARY:✅ Training · Da Junioren\r\n"));
  assert.ok(text.includes("\r\nSUMMARY:❔ Spiel gegen FC Au · Ea Junioren\r\n"));
  assert.equal(aboEintrag(feedTermin({ id: "a", team: "Da Junioren" })).titel, "✅ Training · Da Junioren");
  // AK 9: ohne Team ein gültiger, leerer Feed.
  const leer = elternAbo([]);
  assert.ok(leer.startsWith("BEGIN:VCALENDAR") && leer.includes("X-WR-CALNAME:Trainings und Spiele") && !leer.includes("BEGIN:VEVENT"));
});

pruefe("Eltern-Seite über mehrere Teams: Kopf, Leerzustände und Meldung zu «gilt nicht» (#583 AK 2–5, 7, 17)", () => {
  assert.equal(linkKopfTitel("Noah Keller"), "Termine für Noah Keller");
  // AK 4: die Teams haben keine Termine; AK 5: ohne Team — Vorname statt Pronomen, die Vereinsverwaltung hilft.
  assert.equal(LINK_KEINE_TERMINE_TITEL, "Keine anstehenden Termine");
  assert.equal(linkKeineTermineText("Noah"), "Die Teams von Noah haben zurzeit keine Termine für Noah.");
  assert.equal(
    linkOhneTeamEltern("Elias"),
    "Elias ist zurzeit keinem Team zugeordnet. Termine erscheinen hier, sobald Elias einem Team zugeordnet ist. Bei Fragen hilft die Vereinsverwaltung.",
  );
  // AK 7: Art und Tag bleiben in der Meldung, auch wenn der Termin aus der Liste verschwindet.
  assert.equal(LINK_GILT_NICHT_TITEL, "Nicht gespeichert");
  assert.equal(
    linkGiltNichtText("training", "2026-11-05", "Noah"),
    "Das Training vom Donnerstag, 5. November gilt nicht mehr für Noah. Die Liste zeigt jetzt die aktuellen Termine.",
  );
  assert.match(linkGiltNichtText("spiel", "2026-11-07", "Noah"), /^Das Spiel vom Samstag, 7\. November gilt nicht mehr für Noah\./);
  // Die Abweisungstexte `giltNicht` erreichen nur Mitglieder und die KI (am Link steht `linkGiltNichtText`); dort ist die Ursache
  // nie das Team (deren Wege antworten `nicht_gefunden`), darum ohne Team im Text — Wortlaut wie vor Story 7.
  assert.equal(ABMELDUNG_TEXT.giltNicht, "Dieser Termin gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.");
  assert.equal(MELDUNG_TEXT.giltNicht, "Dieses Spiel gilt nicht mehr für diese Spieler:in. Sieh dir die Termine noch einmal an.");
  const eltern = readFileSync(join(web, "components/privat/ElternAnsicht.tsx"), "utf8");
  assert.match(eltern, /if \(r\.giltNicht\) setGiltNicht\(/, "am Link ersetzt die Meldung «Nicht gespeichert» den Abweisungstext");
  // W5: nach `gilt_nicht` geht der Fokus auf die Meldung.
  assert.match(eltern, /ref=\{giltNichtRef\} tabIndex=\{-1\}/);
  assert.match(eltern, /if \(giltNicht\) giltNichtRef\.current\?\.focus\(\)/);
  // AK 17: der ungültige Link nennt weder Team noch Spieler:in und weist drei Wege.
  assert.ok(LINK_TEXT.ungueltig.includes("Abholadresse") && LINK_TEXT.ungueltig.includes("Vereinsverwaltung"));
});

pruefe("Abholseite und «Fragen und Feedback» am Link: alle Teams, Verweis bei Dringendem je nach Lage (#583 AK 12, 18, 19)", () => {
  // AK 12: der Link zeigt alle Teams — ohne sie zu nennen.
  const erhalt = abholErhaltText("Noah Keller", "FC Wyler");
  assert.equal(erhalt.teams, "Der Link zeigt die Termine aller Teams von Noah Keller.");
  // AK 19, #587 PC 2: mit Team die Trainer:innen, ohne Team die Vereinsverwaltung des Vereins — mit Namen,
  // ohne Artikel davor (Vereinsnamen sind frei wählbar).
  assert.equal(feedbackDringend(false, "FC Wyler"), "Bei Dringendem, etwa einer kurzfristigen Absage, wende dich direkt an die Trainer:innen des Teams.");
  assert.equal(feedbackDringend(true, "FC Wyler"), "Bei Dringendem, etwa einer kurzfristigen Absage, wende dich an die Vereinsverwaltung von «FC Wyler».");
});

pruefe("Abo Spielervertretung: Spiel zugesagt, vielleicht bis zur Frist, sonst abgesagt (#508 PC 3–6, AK 2)", () => {
  const spiel = (t: Partial<AboFeedTermin>) => feedTermin({ id: "s", art: "spiel", bezeichnung: "Cup gegen Thun", ...t });
  assert.equal(aboStatus(spiel({ meldung: "angemeldet" })), "zugesagt", "PC 3");
  assert.equal(aboStatus(spiel({ meldung: "angemeldet", nicht_aufgeboten: true })), "abgesagt", "nicht aufgeboten, auch wenn angemeldet");
  assert.equal(aboStatus(spiel({})), "vielleicht", "PC 4: ohne Meldung, ohne Frist, vor dem Anpfiff");
  assert.equal(aboStatus(spiel({ frist_abgelaufen: true })), "abgesagt", "PC 6: Frist abgelaufen");
  assert.equal(aboStatus(spiel({ begonnen: true })), "abgesagt", "PC 5: ohne Frist zählt der Anpfiff");
  assert.equal(aboStatus(spiel({ nicht_aufgeboten: true })), "abgesagt");
  assert.equal(aboStatus(spiel({ meldung: "abgemeldet" })), "abgesagt");
  assert.equal(aboStatus(spiel({ meldung: "angemeldet", begonnen: true })), "zugesagt", "angemeldet bleibt zugesagt");
  const vielleicht = aboEintrag(spiel({}));
  assert.equal(vielleicht.titel, "❔ Cup gegen Thun · FC Test", "Bezeichnung statt Terminart");
  assert.deepEqual([vielleicht.status, vielleicht.frei], ["TENTATIVE", false]);
  assert.equal(aboEintrag(spiel({ bezeichnung: null })).titel, "❔ Spiel · FC Test");
  // Ein Training kennt kein «vielleicht», auch ohne Meldung.
  assert.equal(aboStatus(feedTermin({ id: "t", meldung: null })), "zugesagt");
});

pruefe("Abo Spielervertretung: Treffpunkte und Hinweis für Eltern wie am Link (#508 PC 2, AK 3; OoS 1, 2; #590 AK 12)", () => {
  const treffpunkte = [
    { anreise: "car" as const, zeitpunkt: "2026-10-06T19:00", ort: null },
    { anreise: "oev" as const, zeitpunkt: "2026-10-07T16:30", ort: "Bahnhof; Gleis 3" },
    { anreise: "vor_ort" as const, zeitpunkt: "2026-10-07T17:30", ort: null },
  ];
  const spiel = (t: Partial<AboFeedTermin>) =>
    feedTermin({ id: "s", art: "spiel", bezeichnung: "Cup", ort: "Wyler", treffpunkte, hinweis_eltern: "Leibchen mitnehmen", ...t });
  assert.equal(
    aboEintrag(spiel({ meldung: "angemeldet" })).beschreibung,
    "Zugesagt\n\nTreffpunkte\nDi., 06.10., 19:00 · Car oder Vereinsbus\n16:30 · öV · Bahnhof; Gleis 3\n17:30 · vor Ort · Wyler\n\nLeibchen mitnehmen",
  );
  // Abgesagt oder begonnen: am Link gedämpft bzw. vorbei — keine Treffpunkte, der Hinweis bleibt.
  assert.equal(aboEintrag(spiel({ meldung: "abgemeldet" })).beschreibung, "Abgesagt\n\nLeibchen mitnehmen");
  assert.equal(aboEintrag(spiel({ meldung: "angemeldet", begonnen: true })).beschreibung, "Zugesagt\n\nLeibchen mitnehmen");
  assert.equal(aboEintrag(spiel({ treffpunkte: [], hinweis_eltern: null })).beschreibung, "Vielleicht");
  // #590 AK 12: auch ein Training trägt seinen Hinweis, abgesagt ebenso.
  const training = feedTermin({ id: "t", hinweis_eltern: "Pincode: 4702\nEintritt frühestens 15 min vorher" });
  assert.equal(aboEintrag(training).beschreibung, "Zugesagt\n\nPincode: 4702\nEintritt frühestens 15 min vorher");
  assert.equal(aboEintrag({ ...training, abgemeldet: true }).beschreibung, "Abgesagt\n\nPincode: 4702\nEintritt frühestens 15 min vorher");
  // Weder Meldefrist noch Richtwert noch Zahl der Angemeldeten (OoS 1), kein Grund der Absage (OoS 2).
  const text = elternAbo([spiel({ nicht_aufgeboten: true })]);
  assert.ok(!/frist|aufgeboten|angemeldet|18:00/i.test(text.replace(/DTSTART[^\r]*|DTEND[^\r]*/g, "")));
  assert.ok(text.includes("\r\nSUMMARY:❌ Cup · FC Test\r\n"));
});

pruefe("Abo Spielervertretung: Adresse neben dem Abo der Mitglieder (#507 AK 4)", () => {
  assert.equal(aboPfad("tok", "spieler/"), "/api/kalender/spieler/tok.ics");
  assert.equal(aboTokenAus(`${"a".repeat(64)}.ics`), "a".repeat(64));
  for (const falsch of ["tok.ics", `${"a".repeat(64)}.ICS`, `${"A".repeat(64)}.ics`, `${"a".repeat(64)}.ics.x`]) assert.equal(aboTokenAus(falsch), null, falsch);
  assert.equal(spielerAboUrl("https://ki-fu.ch", "tok"), "https://ki-fu.ch/api/kalender/spieler/tok.ics");
});

pruefe("Spielerliste: Namen bereinigt, Grenzen der Angaben (#434 AK 6, 14)", () => {
  assert.equal(bereinigeName("  Lena\u00a0  Marie "), "Lena Marie");
  assert.equal(bereinigeName("Mu\u0308ller"), "Müller", "NFC wie spieler_text_bereinigt");
  const gut = { vorname: "Lena", nachname: "Meier", jahrgang: "2017" };
  assert.equal(spielerProblem(gut), null);
  assert.equal(spielerProblem({ ...gut, vorname: "   " })?.feld, "vorname");
  assert.equal(spielerProblem({ ...gut, nachname: "x".repeat(61) })?.text, SPIELER_TEXT.nachname);
  assert.equal(spielerProblem({ ...gut, nachname: "x".repeat(60) }), null);
  assert.equal(spielerProblem({ ...gut, vorname: "😀".repeat(60) }), null, "Länge in Code Points wie char_length");
  for (const j of ["17", "20170", "2O17", "0999", ""]) assert.equal(spielerProblem({ ...gut, jahrgang: j })?.feld, "jahrgang", j);
  assert.equal(jahrgangAus(" 2017 "), 2017);
  assert.equal(spielerProblem({ ...gut, jsNummer: "x".repeat(21) })?.feld, "js_nummer");
  assert.equal(spielerProblem({ ...gut, jsNummer: " 1234567 " }), null);
  assert.deepEqual(
    nachSpielerName([{ vorname: "Mia", nachname: "Kunz" }, { vorname: "Ayla", nachname: "Demir" }, { vorname: "Mia", nachname: "Bauer" }]).map((s) => s.nachname),
    ["Demir", "Bauer", "Kunz"],
  );
});

pruefe("Aufzählung von Teamnamen (#583): ein, zwei, drei Teams; bestehende Sätze unverändert", () => {
  assert.equal(aufzaehlung([]), "");
  assert.equal(aufzaehlung(["A"]), "A");
  assert.equal(aufzaehlung(["A", "B"]), "A und B");
  assert.equal(aufzaehlung(["A", "B", "C"]), "A, B und C");
  assert.equal(aufzaehlung(["A", "B"], "oder"), "A oder B");
  assert.equal(aufzaehlung(["A", "B", "C"], "oder"), "A, B oder C");
  // Die bestehenden Sätze, die sie nutzen, ändern sich im Wortlaut nicht.
  assert.equal(imTeam(["A"]), "im Team «A»");
  assert.equal(imTeam(["B", "A"]), "im Team «A» und «B»");
  assert.equal(imTeam(["C", "A", "B"]), "im Team «A», «B» und «C»");
  assert.equal(spielerLoeschenSaetze("Lina", ["Ca", "FF-15"]).zuordnung, "Lina ist den Teams Ca und FF-15 zugeordnet und verschwindet aus allen.");
  assert.equal(spielerLoeschenSaetze("Lina", ["A", "B", "C"]).zuordnung, "Lina ist den Teams A, B und C zugeordnet und verschwindet aus allen.");
});

pruefe("Link am Team-Ort und Verein-Ort (#583 AK 13, 15, 16): Hinweis und Erneuern-Text je Lage", () => {
  const ab = (name: string, abholbar: boolean) => ({ name, abholbar });
  // Hinweis: ein Team ohne den zweiten Satz, mehrere mit; Verein-Ort nie mit; ohne Team keiner.
  assert.equal(linkTeamsText("Lina", [ab("Ca", false)], true), "Der Link zeigt die Termine aller Teams von Lina: Ca.");
  assert.equal(
    linkTeamsText("Lina", [ab("Ca", false), ab("Cb", true)], true),
    "Der Link zeigt die Termine aller Teams von Lina: Ca und Cb. Eine hier ausgeschaltete Selbstabholung sperrt den Link nicht, wenn ein anderes Team von Lina sie eingeschaltet hat.",
  );
  assert.equal(linkTeamsText("Lina", [ab("Ca", false), ab("Cb", true)], false), "Der Link zeigt die Termine aller Teams von Lina: Ca und Cb.");
  assert.equal(linkTeamsText("Lina", [], true), null);
  // Eine Ordnung der Teamnamen (D4): deutsch, Gross-/Kleinschreibung und Umlaute wie in allen Team-Listen der Vereins-Funktionen;
  // geordnet wird beim Laden (Kern, Link-Ansicht), die Sätze übernehmen die Folge.
  assert.deepEqual(["beta", "Zug", "Älpler", "Alpha"].sort(nachTeamname), ["Alpha", "Älpler", "beta", "Zug"]);
  assert.deepEqual(linkTeamsText("Lina", [ab("Cb", false)].concat([ab("Ca", false)]), false), "Der Link zeigt die Termine aller Teams von Lina: Cb und Ca.");
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  assert.match(lies("lib/kern/spieler.ts"), /teams: \[\.\.\.r\.teams\]\.sort\(\(a, b\) => nachTeamname\(a\.name, b\.name\)\)/, "ladeSpielerTeams ordnet nicht");
  assert.match(lies("lib/kern/verein.ts"), /const nachName = \(a: \{ name: string \}, b: \{ name: string \}\) => nachTeamname\(a\.name, b\.name\);/);
  assert.match(lies("lib/privater-link.ts"), /teams: \[\.\.\.ansicht\.teams\]\.sort\(nachTeamname\)/, "Link-Ansicht ordnet die Teams nicht");
  assert.ok(!/\.sort\(/.test(lies("components/privat/ElternAnsicht.tsx")), "die Eltern-Seite ordnet nicht noch einmal um");
  // Erneuern: ein Team mit Abholung.
  assert.deepEqual(linkErneuernSaetze("Lina", [ab("Ca", true)]), [
    "Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden für alle Teams von Lina: Ca. Abmeldungen bleiben bestehen.",
    LINK_ERNEUERN_MITTEILUNGEN,
    "Die Spieler:in oder ihre Eltern holen den neuen Link über die Abholadresse von Ca ab.",
  ]);
  // Mehrere Teams, zwei mit Abholung; in der geladenen Folge (geordnet hat der Kern, `nachTeamname`).
  assert.deepEqual(linkErneuernSaetze("Lina", [ab("Ca", true), ab("Cb", true), ab("Cc", false)]), [
    "Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden für alle Teams von Lina: Ca, Cb und Cc. Abmeldungen bleiben bestehen.",
    LINK_ERNEUERN_MITTEILUNGEN,
    "Die Spieler:in oder ihre Eltern holen den neuen Link über die Abholadresse von Ca oder Cb ab.",
  ]);
  // Keines abholbar.
  assert.deepEqual(linkErneuernSaetze("Lina", [ab("Ca", false), ab("Cb", false)]), [
    "Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden für alle Teams von Lina: Ca und Cb. Abmeldungen bleiben bestehen.",
    LINK_ERNEUERN_MITTEILUNGEN,
    "Keines dieser Teams hat die Selbstabholung eingeschaltet. Gib den neuen Link selbst weiter.",
  ]);
  // Ohne Team.
  assert.deepEqual(linkErneuernSaetze("Lina", []), [
    "Der bisherige Link, das Kalender-Abo und die Benachrichtigungen enden. Abmeldungen bleiben bestehen.",
    LINK_ERNEUERN_MITTEILUNGEN,
    "Lina ist keinem Team zugeordnet; gib den neuen Link selbst weiter.",
  ]);
});

pruefe("Link in jedem Team (#583 AK 14, 16): kein Web-Code liest das «erste Team» für den Link", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Das «erste Team» (`spieler.team_id`) hat im Web keinen Leser mehr: `erstesTeam` ist weg; pruefe-kern-db.ts nennt es nur, um zu prüfen, dass die Liste es nicht mehr trägt.
  const treffer: string[] = [];
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei === fileURLToPath(import.meta.url) || rel === "scripts/pruefe-kern-db.ts") continue;
    readFileSync(datei, "utf8").split("\n").forEach((zeile, i) => {
      if (/\berstesTeam\b/.test(zeile)) treffer.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(treffer, [], `«erstesTeam» gelesen: ${treffer.join(", ")}`);
  // Die Link-Wege des Kerns geben das Team mit (`p_team`), lesen weder `ladeSpieler` noch `team_id` der Spieler:in; ohne Team leitet `eigenesTeamVon` es ab.
  const kern = lies("lib/kern/spieler.ts");
  const link = kern.match(/async function linkRpc[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(link, /\.rpc\(name, \{ p_team: teamId, p_spieler: e\.spielerId \}\)/, "Link-RPC ohne p_team");
  assert.match(link, /eigenesTeamVon\(/, "Ohne Team leitet der KI-Weg es nicht ab");
  assert.ok(!/ladeSpieler\(|\.team_id\b|"team_id"\)/.test(link.replace(/\.eq\("id"/g, "")), "Link-Weg liest das erste Team der Spieler:in");
  assert.match(kern, /name: "spieler_link_holen" \| "spieler_link_erneuern"/);
  // Die Team-Actions nennen das Team der Seite; Erneuern lädt alle Teams und den Verein neu (AK 15).
  const aktionen = lies("lib/actions/spieler.ts");
  assert.match(aktionen, /holeSpielerLinkAktion\(teamId: string, spielerId: string\)/);
  const erneuern = aktionen.match(/export async function erneuereSpielerLinkAktion[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(erneuern, /revalidiereAlleTeams\(\)[\s\S]*revalidiereVerein\(\)/, "Erneuern revalidiert nicht alle Teams und den Verein");
  const vereinErneuern = lies("lib/actions/verein.ts").match(/export async function erneuereVereinSpielerLinkAktion[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(vereinErneuern, /revalidiereAlleTeams\(\)[\s\S]*revalidiereVerein\(\)/);
  // Die Rückfrage zum Erneuern liegt im Link-Dialog: Der Dialog-Baustein reagiert nur auf eigene `close`/`cancel`, sonst
  // schlösse Abbrechen, Escape oder das Erneuern selbst auch den Link-Dialog (React reicht die Ereignisse nach aussen weiter).
  const dialog = lies("components/ui/Dialog.tsx");
  assert.match(dialog, /onClose=\{\(e\) => \{\s*if \(e\.target === ref\.current\) onClose\(\);/);
  assert.match(dialog, /onCancel=\{\(e\) => \{\s*if \(e\.target !== ref\.current\) return;/);
  // Der Dialog hat kein `abholungAktiv` mehr.
  assert.ok(!/abholungAktiv/.test(lies("components/spieler/LinkDialog.tsx") + lies("components/team/SpielerLinkDialog.tsx") + lies("components/team/SpielerListe.tsx")), "abholungAktiv ist gefallen");
  // Der Link-Knopf der Spielerliste steht in jeder Zeile, an keiner Bedingung (früher `s.erstesTeam && (`): Zwischen dem Beginn
  // der Knopfgruppe der Zeile und dem Kettenglied steht kein bedingtes Rendern.
  const liste = lies("components/team/SpielerListe.tsx");
  const gruppe = liste.indexOf('<span className="flex justify-end gap-1">');
  const knopf = liste.indexOf("icon={Link2}", gruppe);
  assert.ok(gruppe > 0 && knopf > gruppe, "Knopfgruppe mit Link-Knopf nicht gefunden");
  assert.ok(!/&&\s*\(|\?\s*\(/.test(liste.slice(gruppe, knopf)), "Link-Knopf hängt an einer Bedingung");
});

pruefe("Spielerliste: Marker der Datenebene tragen die Sätze der Oberfläche", () => {
  for (const [marker, satz] of Object.entries(SPIELER_MELDUNG)) assert.equal(fehlerMeldung(`x ${marker} y`), satz, marker);
  assert.equal(fehlerMeldung('new row violates check constraint "spieler_jahrgang"'), SPIELER_TEXT.jahrgang);
});

pruefe("Doppelerfassung im Verein (#578, #579 AK 19): Satz je Lage, Teams nach Namen, Eingabe bereinigt, nie J+S", () => {
  assert.equal(imTeam(["A"]), "im Team «A»");
  assert.equal(imTeam(["B", "A"]), "im Team «A» und «B»");
  assert.equal(imTeam(["C", "Ä", "B"]), "im Team «Ä», «B» und «C»");
  const eingabe = { vorname: "  Lina ", nachname: "Muster\u00a0Meier", jahrgang: 2016 };
  const d = (eigenes_team: boolean, teams: string[], ohne_team = false) => ({ eigenes_team, teams, ohne_team });
  // AK 4: nur in anderen Teams — Eingabe, Jahrgang, Teams, Verweis auf die Verwaltung.
  assert.equal(
    spielerDoppeltText(d(false, ["Eb", "Ea"]), eingabe),
    "Lina Muster Meier (2016) wird im Verein schon im Team «Ea» und «Eb» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  assert.equal(
    spielerDoppeltText(d(false, ["Ea"]), eingabe),
    "Lina Muster Meier (2016) wird im Verein schon im Team «Ea» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  // AK 3: im eigenen Team der bisherige Satz, auch bei weiteren Teams; beim Ändern ebenso.
  assert.equal(spielerDoppeltText(d(true, ["Ea", "Eb"]), eingabe), SPIELER_MELDUNG.SPIELER_DOPPELT);
  assert.equal(spielerDoppeltText(d(true, ["Ea"]), null), SPIELER_MELDUNG.SPIELER_DOPPELT);
  assert.equal(spielerDoppeltText(d(true, [], true), eingabe), SPIELER_MELDUNG.SPIELER_DOPPELT, "im eigenen Team geht vor «ohne Team»");
  // AK 6: Ändern nennt die Teams der anderen Spieler:in (Wortlaut der PO).
  assert.equal(
    spielerDoppeltText(d(false, ["Eb", "Ea", "D"]), null),
    "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «D», «Ea» und «Eb».",
  );
  // #579 AK 19: in keinem Team — im Verein geführt, ohne Team, Zuordnung mit der Verwaltung klären (Wortlaut des Boards).
  assert.equal(
    spielerDoppeltText(d(false, [], true), { vorname: "Elias", nachname: "Brunner", jahrgang: 2014 }),
    "Elias Brunner (2014) wird im Verein geführt, ist aber keinem Team zugeordnet. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  assert.equal(
    spielerDoppeltText(d(false, [], true), null),
    "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, die keinem Team zugeordnet ist. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
  );
  assert.ok(!spielerDoppeltText(d(false, [], true), eingabe).includes("J+S"), "nie J+S-Nummer");
  // Das Netz aus dem Trigger trägt den bisherigen Satz (Rennen); `SCHON_ZUGEORDNET` einen eigenen.
  assert.equal(fehlerMeldung("x SPIELER_DOPPELT y"), SPIELER_MELDUNG.SPIELER_DOPPELT);
  assert.equal(fehlerMeldung("x SCHON_ZUGEORDNET y"), "Diese Spieler:in ist dem Team schon zugeordnet.");
});

pruefe("Abholseite (#579 PC 12): Herausnehmen lässt die Angaben im Verein, erst das Löschen entfernt sie", () => {
  const speichert = abholSpeichertText("FC Wyler");
  assert.ok(speichert.includes("bleiben ihre Angaben im Verein"));
  assert.ok(speichert.includes("wenn die Vereinsverwaltung die Spieler:in aus dem Verein löscht"));
  assert.ok(!speichert.includes("verschwinden ihre Angaben überall"), "der alte Satz stimmt nicht mehr");
});

pruefe("Abholseite (#642 AK 5): nennt die Benachrichtigungen, ihre 90 Tage und wer sie sieht", () => {
  const speichert = abholSpeichertText("FC Wyler");
  assert.equal(BENACHRICHTIGUNG_TAGE, 90);
  assert.ok(
    speichert.includes("Benachrichtigungen zu ihren Terminen bewahrt KiFu 90 Tage auf; sie sieht nur, wer den Link hat."),
    speichert,
  );
  // Vor dem Block «wer die Angaben sieht», nach den gespeicherten Angaben.
  assert.ok(speichert.indexOf("Benachrichtigungen") < speichert.indexOf(angabenSehenText("FC Wyler")));
});

pruefe("Wer die Angaben sieht (#580 PC 4, #587 PC 2): ein Textblock für Abholseite und privaten Link, mit dem Verein als Verantwortlichem, nicht in LINK_TEXT", () => {
  const rest =
    "sehen alle Trainer:innen des Vereins, alle Angaben die Trainer:innen ihrer Teams, J+S-Nummer und Link auch die Vereinsverwaltung, dazu die KI-Assistenten, die diese Personen verbunden haben, und wer den Link hat.";
  // Der Verein steht als Verantwortlicher im selben Textblock wie «wer die Angaben sieht».
  assert.equal(angabenSehenText("FC Wyler"), `Verantwortlich für die Daten ist der Verein «FC Wyler». Name, Jahrgang und Teams der Spieler:in ${rest}`);
  assert.equal(angabenSehenText("FC Wyler", "Noah"), `Verantwortlich für die Daten von Noah ist der Verein «FC Wyler». Name, Jahrgang und Teams von Noah ${rest}`);
  // Die Abholseite trägt ihn anstelle der bisherigen Angabe; die übrigen Sätze bleiben.
  const speichert = abholSpeichertText("FC Wyler");
  assert.ok(speichert.includes(angabenSehenText("FC Wyler")));
  assert.ok(!speichert.includes("Das sehen die Trainer:innen des Teams"), "die bisherige Angabe ist ersetzt");
  assert.ok(
    speichert.includes("sehen nur die Trainer:innen ihrer Teams und ihre KI-Assistenten"),
    "der Stand der letzten Ab- und Anmeldung bleibt bei den Teams (#467)",
  );
  assert.ok(speichert.startsWith("Zu jeder Spieler:in nur Vorname, Nachname, Jahrgang"));
  // Der Verein ist verantwortlich — keine Person (OoS 6): überall, wo der Text steht, mit dem Namen des Vereins.
  for (const t of [angabenSehenText("FC Wyler"), angabenSehenText("FC Wyler", "Noah"), speichert])
    assert.ok(t.includes("Verantwortlich für die Daten") && t.includes("ist der Verein «FC Wyler»."), t);
  // Auf dem Erhalt-Bildschirm der Abholseite derselbe Textblock mit dem Namen der Spieler:in.
  const erhalt = abholErhaltText("Noah Keller", "FC Wyler");
  assert.ok(erhalt.daten.startsWith(angabenSehenText("FC Wyler", "Noah Keller")));
  assert.ok(erhalt.daten.endsWith("Nimmt ein Team Noah Keller heraus, bleiben die Angaben im Verein; sie verschwinden erst, wenn die Vereinsverwaltung sie aus dem Verein löscht."));
  // Link und Abholseite lesen den Verein aus der Datenebene (Eingabe und Erhalt), nicht aus dem Browser.
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Seit #598 auf der Infos-Seite des Links.
  assert.match(lies("components/privat/LinkInfos.tsx"), /\{angabenSehenText\(verein, vorname\)\}/);
  assert.match(lies("app/(privat)/abmelden/[privaterLink]/infos/page.tsx"), /verein=\{ansicht\.verein\}/);
  assert.match(lies("components/privat/AbholSeite.tsx"), /\{abholSpeichertText\(verein\)\}/);
  assert.match(lies("components/privat/AbholSeite.tsx"), /abholErhaltText\(name, verein\)[\s\S]*?\{text\.daten\}/);
  assert.match(lies("app/(privat)/abholen/[privaterLink]/page.tsx"), /<AbholSeite token=\{privaterLink\} team=\{ansicht\.team\} verein=\{ansicht\.verein\} \/>/);
  assert.match(lies("app/(privat)/abmelden/[privaterLink]/page.tsx"), /<FeedbackLink [^>]*verein=\{ansicht\.verein\}/);
  assert.match(lies("app/(privat)/abmelden/[privaterLink]/infos/page.tsx"), /verein=\{ansicht\.verein\}[\s\S]*?<FeedbackLink [^>]*verein=\{ansicht\.verein\}/);
  assert.ok(!Object.values(LINK_TEXT).some((t) => typeof t === "string" && (t.includes("Trainer:innen des Vereins") || t.includes("Verantwortlich"))), "nichts davon in LINK_TEXT (KI-Beschreibungen)");
});

pruefe("Spieler:innen des Vereins (#580): Texte der Liste, Leerzustände, Hinweis, Filterleiste", () => {
  assert.equal(SPIELER_OHNE_TEAM, "ohne Team");
  assert.equal(SPIELER_BESTAND_LEER_MITGLIED, "Der Verein führt noch keine Spieler:innen.");
  assert.deepEqual(SPIELER_KEINE_TREFFER, { titel: "Keine Spieler:in gefunden", text: "Ändere die Suche oder die Eingrenzung." });
  assert.equal(SPIELER_ZUORDNUNG_HINWEIS, "Spieler:innen ordnet die Vereinsverwaltung einem Team zu.");
  assert.deepEqual(SPIELER_FILTER, {
    suche: "Spieler:innen durchsuchen",
    team: "Team",
    ohneTeam: "Ohne Team",
    teamsGruppe: "Teams",
    jahrgang: "Jahrgang",
    zuruecksetzen: "Zurücksetzen",
    weiter: "Weitere anzeigen",
  });
  assert.equal(spielerAngezeigtText(50, 144), "50 von 144 angezeigt");
  // Weder «kein Team» noch «Kind» in den neuen Sätzen.
  for (const t of [SPIELER_BESTAND_LEER_MITGLIED, SPIELER_KEINE_TREFFER.text, SPIELER_ZUORDNUNG_HINWEIS]) assert.ok(!/kein Team|Kind/.test(t), t);
});

pruefe("Adress-Parameter der Spieler:innen des Vereins (#580 AK 6–10): lesen, prüfen, verwerfen", () => {
  const ea = "11111111-1111-4111-8111-111111111111";
  const eb = "22222222-2222-4222-8222-222222222222";
  // Nackte Adresse: keine Eingrenzung, eine Seite.
  assert.deepEqual(liesSpielerEingrenzung({}), { suche: "", teamIds: [], ohneTeam: false, jahrgaenge: [] });
  assert.equal(eingrenzungGesetzt(liesSpielerEingrenzung({})), false);
  assert.equal(liesSpielerAnzahl({}), SPIELER_SEITE);
  // Alles gesetzt: Suche ohne Rand- und Mehrfach-Leerzeichen, «ohne» neben den Kennungen, Jahrgänge geordnet und einmal.
  const e = liesSpielerEingrenzung({ q: "  lina   beispiel ", team: `${ohne()},${ea},${eb},${ea}`, jahrgang: "2017,2016,2017" });
  assert.deepEqual(e, { suche: "lina beispiel", teamIds: [ea, eb], ohneTeam: true, jahrgaenge: [2016, 2017] });
  assert.equal(eingrenzungGesetzt(e), true);
  assert.deepEqual(teamFilterWerte(e), [OHNE_TEAM_WERT, ea, eb], "so, wie AuswahlFilter und ?team= sie führen");
  // Jedes für sich setzt «Zurücksetzen» frei.
  for (const sp of [{ q: "x" }, { team: ohne() }, { team: ea }, { jahrgang: "2016" }]) assert.equal(eingrenzungGesetzt(liesSpielerEingrenzung(sp)), true, JSON.stringify(sp));
  // Unbrauchbares fällt weg: keine Kennung, keine Zahl, zu kurz, zu lang, leer.
  assert.deepEqual(liesSpielerEingrenzung({ team: "nicht-uuid,,123", jahrgang: "abc,99999,12,-2016,2016.5,0999,2e3" }), { suche: "", teamIds: [], ohneTeam: false, jahrgaenge: [] });
  assert.equal(liesSpielerEingrenzung({ q: "   " }).suche, "");
  // Die Suche wie die Datenebene bereinigt (spieler_text_bereinigt), nicht gekappt: Im Feld steht, wonach gesucht wird.
  assert.equal(liesSpielerEingrenzung({ q: "a".repeat(500) }).suche.length, 500, "ungekappt — länger als jeder Name trifft eben niemanden");
  assert.equal(liesSpielerEingrenzung({ q: "😀".repeat(70) }).suche, "😀".repeat(70), "kein halbes Zeichen");
  assert.equal(liesSpielerEingrenzung({ q: "Zoe\u0308" }).suche, "Zo\u00eb", "NFC wie die Datenebene");
  assert.equal(liesSpielerEingrenzung({ q: "\u00a0Léa\u202f\u2009 Müller\t\u0085" }).suche, "Léa Müller", "geschützte und schmale Leerzeichen, NEL");
  assert.equal(liesSpielerEingrenzung({ q: "\ufeffLea" }).suche, "\ufeffLea", "U+FEFF ist für die Datenebene kein Leerraum");
  assert.equal(liesSpielerEingrenzung({ q: "50% _a\\b 'c\" d," }).suche, "50% _a\\b 'c\" d,", "Sonderzeichen bleiben, wie sie sind");
  assert.equal(liesSpielerEingrenzung({ q: ["eins", "zwei"] }).suche, "eins", "bei Wiederholung zählt der erste");
  assert.deepEqual(liesSpielerEingrenzung({ team: [ea, eb] }).teamIds, [ea, eb], "auch mehrfach in der Adresse");
  // Was es im Verein nicht gibt, fällt aus der Eingrenzung — die Seite fragt dann ohne es neu.
  const bestand = { teams: [{ id: ea }], jahrgaenge: [2015, 2016] };
  const sauber = bereinigeEingrenzung(e, bestand);
  assert.deepEqual(sauber, { suche: "lina beispiel", teamIds: [ea], ohneTeam: true, jahrgaenge: [2016] });
  assert.deepEqual(bereinigeEingrenzung(sauber, bestand), sauber, "Bereinigtes bleibt");
  // Die Adresse sagt danach dasselbe wie Leiste und Abfrage: einmal weiterleiten, q und anzahl reisen mit.
  const P = "/verein/spieler";
  const sp = { q: "  lina   beispiel ", team: `${ohne()},${ea},${eb},${ea}`, jahrgang: "2017,2016,2017", anzahl: "100" };
  const ziel = bereinigteAdresse(P, sp, sauber);
  assert.equal(ziel, `${P}?q=++lina+++beispiel+&anzahl=100&team=${ohne()}%2C${ea}&jahrgang=2016`);
  const zurueck = Object.fromEntries(new URL(ziel!, "http://x").searchParams);
  assert.equal(bereinigteAdresse(P, zurueck, bereinigeEingrenzung(liesSpielerEingrenzung(zurueck), bestand)), null, "die bereinigte Adresse bleibt stehen");
  for (const roh of [{}, { q: "x" }, { team: `${ohne()},${ea}` }, { team: [ohne(), ea] }, { jahrgang: "2015,2016" }])
    assert.equal(bereinigteAdresse(P, roh, bereinigeEingrenzung(liesSpielerEingrenzung(roh), bestand)), null, JSON.stringify(roh));
  assert.equal(bereinigteAdresse(P, { team: "abc", jahrgang: "1999" }, liesSpielerEingrenzung({})), P, "nichts übrig: die nackte Seite");
  assert.equal(bereinigteAdresse(P, { team: eb }, bereinigeEingrenzung(liesSpielerEingrenzung({ team: eb }), bestand)), P, "im Verein unbekannt");
  assert.equal(bereinigteAdresse(P, { jahrgang: "2016,2015" }, liesSpielerEingrenzung({ jahrgang: "2016,2015" })), `${P}?jahrgang=2015%2C2016`, "in der Schreibweise der Leiste");
  // Die Suche: dieselbe Bereinigung für Adresse, Echo im Suchfeld und Datenebene.
  assert.equal(bereinigeSuche("  Lea   M "), "Lea M");
  assert.equal(bereinigeSuche("Lea "), "Lea", "Echo von «Lea »");
  assert.equal(bereinigeSuche("Zoë"), "Zoë");
  // Anzeige in Schritten: nie unter einer Seite, nie Müll.
  assert.equal(liesSpielerAnzahl({ anzahl: "100" }), 100);
  for (const a of ["-5", "0", "abc", "", undefined]) assert.equal(liesSpielerAnzahl({ anzahl: a }), SPIELER_SEITE, String(a));
  assert.equal(liesSpielerAnzahl({ anzahl: "10" }), SPIELER_SEITE);
  // Die gemeinsamen Hilfen der Seiten mit Adress-Filtern.
  assert.deepEqual(liesListe("a,,b"), ["a", "b"]);
  assert.deepEqual(liesListe(["a,b", "c"]), ["a", "b", "c"]);
  assert.deepEqual(liesListe(undefined), []);
  assert.equal(liesPositiveZahl("7"), 7);
  assert.equal(liesPositiveZahl(["7", "9"]), 7);
  assert.equal(liesPositiveZahl("0"), undefined);
  assert.equal(liesPositiveZahl("x"), undefined);
  assert.equal(mitAnzahl("/verein/spieler", { q: "li", team: [ea, eb], anzahl: "50", leer: undefined }, 100), `/verein/spieler?q=li&team=${ea}&team=${eb}&anzahl=100`, "alles reist mit, nur anzahl neu");
  assert.equal(mitAnzahl("/", {}, 48), "/?anzahl=48");
  function ohne() {
    return OHNE_TEAM_WERT;
  }
});

pruefe("Spieler:innen des Vereins (#580): für alle Mitglieder, Mitglieder-Form ohne Verwaltungsfelder, Leiste für alle", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Die Seite sperrt Mitglieder nicht mehr; ohne Verein geht es zu den Teams.
  const seite = lies("app/(app)/verein/spieler/page.tsx");
  assert.ok(!/redirect\("\/verein"\)/.test(seite), "kein Verweis der Mitglieder auf die Teamübersicht");
  assert.match(seite, /if \(!verein\) redirect\("\/teams"\);/);
  assert.match(seite, /r\.art === "nicht_gefunden"\) redirect\("\/teams"\)/, "wer inzwischen kein Mitglied mehr ist, geht zu den Teams");
  // Der Eintrag «Spieler:innen» steht im Bereich «Verein» für alle, nur «Verwaltung» an der Rolle.
  const nav = lies("components/layout/AppNavClient.tsx");
  const vereinGruppe = nav.slice(nav.indexOf('titel: "Verein"'), nav.indexOf('titel: "Start"'));
  assert.ok(vereinGruppe.indexOf('label: "Spieler:innen"') < vereinGruppe.indexOf("verein?.istVerwaltung"), "«Spieler:innen» vor der Rollenbedingung");
  assert.ok(vereinGruppe.indexOf("verein?.istVerwaltung") < vereinGruppe.indexOf('label: "Verwaltung"'), "«Verwaltung» hinter der Rollenbedingung");
  // Der Typ der Mitglieder-Zeile führt J+S, Link-Stand und Schnuppern gar nicht; der Kern setzt sie nur, wenn die Datenebene sie liefert.
  const kern = lies("lib/kern/verein.ts");
  const mitglied = kern.slice(kern.indexOf("export type VereinSpielerMitglied"), kern.indexOf("export type VereinSpieler ="));
  assert.ok(mitglied.length > 0 && !/\b(js|linkStand|schnuppern|anzahl)\b/.test(mitglied.replace(/\/\*\*[\s\S]*?\*\//g, "")), "Mitglieder-Form ohne Verwaltungsfelder");
  assert.match(kern, /if \(!passt\) return fehlschlag\("technisch"/, "Form gegen die Rolle der Antwort geprüft, sonst ein Fehler");
  assert.match(kern, /if \(!r\.verwaltung\)\s+return ok\(\{ \.\.\.basis, verwaltung: false, spieler: zeilen\.map\(mitglied\)/, "Mitglieder-Zeilen Feld für Feld, nie ein undefined-Schlüssel");
  // Die lesende Sicht kennt weder Aktionen noch Verwaltungsbausteine.
  const ansicht = lies("components/verein/VereinSpielerAnsicht.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.ok(!/actions\/|VereinSpieler(Formular|LinkDialog|Loeschen|Liste|Import)|OverflowMenu|Checkbox|AuswahlLeiste|"use client"/.test(ansicht), "nur lesen");
  // Die Sicht wählt allein `verwaltung` aus der Antwort der Liste (eine Quelle), nicht die Vereinslage.
  assert.match(seite, /\{liste\.verwaltung \? \(/);
  assert.ok(!/istVerwaltung/.test(seite), "keine zweite Quelle für die Rolle");
  assert.match(seite, /if \(sauber\) redirect\(sauber\);/, "unbekannte Eingrenzung: einmal weiterleiten, nicht zweimal abfragen");
  assert.equal(seite.match(/ladeVereinSpielerliste\(/g)?.length, 1, "ein Abruf je Aufruf");
  // «ohne Team» steht als Plakette in beiden Sichten auch schmal (AK 4; #582 AK 8): Die Teams-Zelle ist nie versteckt.
  for (const d of ["components/verein/VereinSpielerAnsicht.tsx", "components/verein/VereinSpielerListe.tsx"])
    assert.match(lies(d), /<span className="mt-1 block min-w-0 sm:mt-0">\s*<SpielerTeams /, d);
  // Die Verwaltungsliste zeigt nur, was steht: die Auswahl leert sich mit Suche und Eingrenzung.
  assert.match(lies("components/verein/VereinSpielerListe.tsx"), /schluessel !== schluesselVorher\) \{\s*setSchluesselVorher\(schluessel\);\s*setAuswahl\(\[\]\)/);
});

pruefe("Aus dem Team nehmen (#579 AK 13–16): nicht gelöscht, bleibt im Verein, was verfällt — mit weiteren Teams, als letztes Team, schnuppernd", () => {
  const lage = { vorname: "Noah", nachname: "Keller", team: "Da Junioren", verein: "FC Wyler", verbleibend: ["Ea Junioren"], probe: false };
  assert.equal(herausnehmenTitel(lage), "Noah Keller aus Da Junioren nehmen", "Titel des Boards");
  // Mit weiterem Team: Wortlaut des Boards, ohne Pronomen.
  assert.deepEqual(herausnehmenSaetze(lage), {
    absaetze: [
      "Noah wird dadurch nicht gelöscht und bleibt samt privatem Link im Verein «FC Wyler» und im Team Ea Junioren. Aus dem Verein löscht nur die Vereinsverwaltung.",
    ],
    warnung: "Künftige Abmeldungen, Spiel-Meldungen und Kader in Da Junioren verfallen.",
    zusatz: "Vergangene Anwesenheiten bleiben mit dem Namen stehen.",
  });
  // Mehrere verbleibende Teams.
  assert.match(herausnehmenSaetze({ ...lage, verbleibend: ["Ea Junioren", "Fa Junioren", "FF-15"] }).absaetze[0], /im Verein «FC Wyler» und in den Teams Ea Junioren, Fa Junioren und FF-15\. Aus dem Verein/);
  // Letztes Team: keinem Team mehr zugeordnet, nur die Verwaltung führt sie (AK 16).
  const letzte = herausnehmenSaetze({ ...lage, vorname: "Leon", nachname: "Graf", verbleibend: [] });
  assert.deepEqual(letzte.absaetze, [
    "Leon wird dadurch nicht gelöscht und bleibt samt privatem Link im Verein «FC Wyler», ist danach aber keinem Team mehr zugeordnet.",
    "Ändern, einem Team zuordnen oder löschen kann dann nur die Vereinsverwaltung.",
  ]);
  // Vergangene Anwesenheiten bleiben auch beim letzten Team mit dem Namen stehen (PC 5).
  assert.equal(letzte.zusatz, "Vergangene Anwesenheiten bleiben mit dem Namen stehen.");
  // Schnuppernd: das Schnuppertraining endet mit (Board).
  assert.equal(
    herausnehmenSaetze({ ...lage, verbleibend: [], probe: true }).warnung,
    "Das Schnuppertraining endet samt Zählung; künftige Abmeldungen, Spiel-Meldungen und Kader in Da Junioren verfallen.",
  );
  // Ohne bekannten Verein.
  assert.match(herausnehmenSaetze({ ...lage, verein: null }).absaetze[0], /im Verein und im Team Ea Junioren/);
  // Weder «gelöscht werden» noch eine Zahl der verfallenden Meldungen (Out of Scope 4); beides sagt, wer löscht.
  for (const l of [lage, { ...lage, verbleibend: [] }]) {
    const text = herausnehmenFrage(l);
    assert.ok(text.includes("nicht gelöscht") && text.includes("nur die Vereinsverwaltung"), "AK 13");
    assert.ok(!/\d/.test(text), "keine Zahl verfallender Meldungen");
  }
  assert.equal(herausnehmenFrage(lage).startsWith("Noah Keller aus Da Junioren nehmen?"), true);
  assert.deepEqual(verbleibendeTeams([{ name: "Da Junioren", dieses: true }, { name: "Ea Junioren", dieses: false }]), ["Ea Junioren"]);
  // Gleichnamige Teams gibt es im Bestand: Nur das, in dem man handelt, fällt weg.
  assert.deepEqual(verbleibendeTeams([{ name: "Da Junioren", dieses: false }, { name: "Da Junioren", dieses: true }]), ["Da Junioren"]);
  assert.equal(HERAUSNEHMEN_TEXT.geaendert, "Inzwischen hat sich etwas geändert. Lies den Hinweis noch einmal und bestätige erneut.");
});

pruefe("Herausnehmen über den KI-Assistenten (#589 AK 4): beim letzten eigenen Team der Zusatz «über den Assistenten nicht mehr erreichbar», nie im Dialog der Anwendung", () => {
  const lage = { vorname: "Noah", nachname: "Keller", team: "Da Junioren", verein: "FC Wyler", verbleibend: ["Ea Junioren"], probe: false };
  const zusatz = "Danach ist Noah über den Assistenten nicht mehr erreichbar: Noah gehört dann keinem deiner Teams mehr an.";
  // Die Rückfrage an den Assistenten: dieselben Sätze wie die Bestätigung, beim letzten eigenen Team dazu der Zusatz.
  assert.equal(herausnehmenFrage({ ...lage, letztesEigenes: true }), `${herausnehmenFrage(lage)} ${zusatz}`);
  assert.equal(herausnehmenFrage({ ...lage, verbleibend: [], letztesEigenes: true }), `${herausnehmenFrage({ ...lage, verbleibend: [] })} ${zusatz}`);
  assert.equal(herausnehmenFrage({ ...lage, letztesEigenes: false }), herausnehmenFrage(lage), "mit einem weiteren eigenen Team kein Zusatz");
  assert.ok(!herausnehmenFrage(lage).includes("Assistenten"), "ohne das Feld kein Zusatz");
  // Der Dialog der Anwendung bleibt, wie er ist: Die Sätze kennen das Feld nicht.
  assert.deepEqual(herausnehmenSaetze({ ...lage, letztesEigenes: true }), herausnehmenSaetze(lage));
  assert.deepEqual(herausnehmenSaetze({ ...lage, verbleibend: [], letztesEigenes: true }), herausnehmenSaetze({ ...lage, verbleibend: [] }));
  // Und die Anwendung setzt das Feld nirgends und baut die Rückfrage nicht: Der Zusatz gelangt nicht in sie.
  const treffer: string[] = [];
  for (const ordner of ["app", "components", "lib/actions"])
    for (const datei of quelldateien(join(web, ordner)))
      if (/\b(letztesEigenes|herausnehmenFrage)\b/.test(readFileSync(datei, "utf8"))) treffer.push(relative(web, datei));
  assert.deepEqual(treffer, [], `KI-Zusatz in der Anwendung: ${treffer.join(", ")}`);
  // Ohne `stand` käme die Rückfrage des KI-Wegs samt Zusatz zurück: Jeder Aufruf in den Server-Actions gibt ihn mit.
  const ohneStand = (text: string) => [...text.matchAll(/\bnimmSpielerAusTeam\(([^;]*?)\);/g)].filter((m) => !/\bstand\b/.test(m[1])).length;
  const aufrufe: string[] = [];
  let ohne = 0;
  for (const datei of quelldateien(join(web, "lib/actions"))) {
    const text = readFileSync(datei, "utf8");
    const n = [...text.matchAll(/\bnimmSpielerAusTeam\(/g)].length;
    if (n) aufrufe.push(relative(web, datei));
    ohne += ohneStand(text);
  }
  assert.deepEqual(aufrufe, ["lib/actions/spieler.ts"], "die Anwendung ruft nimmSpielerAusTeam an einer Stelle auf");
  assert.equal(ohne, 0, "nimmSpielerAusTeam ohne stand in lib/actions");
  // Der Wächter schlägt an und lässt den Aufruf mit `stand` durch.
  assert.equal(ohneStand("await nimmSpielerAusTeam(a.supabase, a.userId, { teamId, spielerId });"), 1);
  assert.equal(ohneStand("await nimmSpielerAusTeam(a.supabase, a.userId, { teamId, spielerId, stand });"), 0);
});

pruefe("Zuordnen zum Schnuppern (#584 AK 7–12, 16): jede Abweisung, eine und mehrere Schnuppernde, Satz und Snackbar", () => {
  const p = (vorname: string, nachname: string, jahrgang: number) => ({ id: vorname, vorname, nachname, jahrgang });
  const leer = { bereits: [], gleich: [], schnuppert: [], ueber_grenze: 0 };
  // AK 9, 10: Die Datenebene nennt genau einen Grund; der Satz steht allein.
  assert.equal(
    zuordnenAbweisungText({ ...leer, grund: "schnuppern_hat_team" }, "Da Junioren", 1),
    "Diese Spieler:in ist schon einem Team zugeordnet. Ordne sie ohne Schnuppern zu.",
  );
  assert.equal(
    zuordnenAbweisungText({ ...leer, grund: "schnuppern_anzahl_fehlt" }, "Da Junioren", 1),
    "Das Team hat noch keine Anzahl Schnuppertrainings. Ein Mitglied des Teams legt sie zuerst fest.",
  );
  assert.deepEqual(Object.keys(SCHNUPPERN_ZUORDNEN_TEXT).sort(), ["schnuppern_anzahl_fehlt", "schnuppern_hat_team"]);
  // AK 12: eine Schnuppernde nennt ihr Team und beide Auswege; einzeln ohne
  // «Wähle ein anderes Team» — auch dort liesse sie sich nicht zuordnen.
  assert.equal(
    zuordnenAbweisungText({ ...leer, schnuppert: [{ ...p("Leon", "Graf", 2015), team: "Da Junioren" }] }, "Ea Junioren", 1),
    "Leon Graf (2015) schnuppert im Team «Da Junioren». Dort beendet zuerst ein Mitglied das Schnuppern, oder Leon wird aus dem Team genommen.",
  );
  assert.ok(
    !zuordnenAbweisungText({ ...leer, gleich: [p("Elias", "Brunner", 2014)], schnuppert: [{ ...p("Elias", "Brunner", 2014), team: "Da Junioren" }] }, "Ea Junioren", 1).includes("anderes Team"),
    "einzeln mit Schnuppern nie «anderes Team»",
  );
  // AK 16: gesammelt nennt jede Schnuppernde mit ihrem Team, in der Reihenfolge der Datenebene.
  const mehrere = zuordnenAbweisungText(
    {
      ...leer,
      schnuppert: [
        { ...p("Leon", "Graf", 2015), team: "Da Junioren" },
        { ...p("Mia", "Ott", 2016), team: "Fa Junioren" },
      ],
    },
    "Ea Junioren",
    3,
  );
  assert.equal(
    mehrere,
    "Leon Graf (2015) schnuppert im Team «Da Junioren». Dort beendet zuerst ein Mitglied das Schnuppern, oder Leon wird aus dem Team genommen. " +
      "Mia Ott (2016) schnuppert im Team «Fa Junioren». Dort beendet zuerst ein Mitglied das Schnuppern, oder Mia wird aus dem Team genommen. " +
      "Ändere die Auswahl und versuche es nochmals.",
  );
  // Schnuppernde zusammen mit anderen Befunden: keiner geht verloren.
  const gemischt = zuordnenAbweisungText(
    { ...leer, bereits: [p("Luis", "Ott", 2012)], schnuppert: [{ ...p("Leon", "Graf", 2015), team: "Da Junioren" }] },
    "Ea Junioren",
    2,
  );
  assert.ok(gemischt.includes("Luis Ott (2012) ist Ea Junioren schon zugeordnet.") && gemischt.includes("Leon Graf (2015) schnuppert im Team «Da Junioren»"));
  // AK 7, 8, 11: Beschriftung, Satz unter der Auswahl, Snackbar.
  assert.equal(SCHNUPPERN_ZUORDNEN_LABEL, "Zum Schnuppern zuordnen");
  assert.equal(SCHNUPPERN_ZUORDNEN_HINWEIS, "Solange die Spieler:in schnuppert, lässt sie sich keinem weiteren Team zuordnen.");
  assert.equal(schnuppernZugeordnetText("Noah Keller", "Da Junioren"), "Noah Keller ist jetzt dem Team Da Junioren zugeordnet und schnuppert dort.");
  // AK 13: Endet beim Herausnehmen ein Schnuppern, das die Bestätigung nicht ankündigte, sagt es die Snackbar.
  assert.equal(vereinHerausgenommenText("Noah", "Da Junioren", false), "Noah ist nicht mehr im Team Da Junioren.");
  assert.equal(vereinHerausgenommenText("Noah", "Da Junioren", true), "Noah ist nicht mehr im Team Da Junioren. Das Schnuppertraining ist damit beendet.");
  // Marker der Datenebene kommen beim Zuordnen als Satz an (der Verein-Kern übersetzt sie über `fachlicheMeldung`).
  assert.equal(fachlicheMeldung("SCHNUPPERN_NUR_EINZELN"), "Zum Schnuppern lässt sich nur eine Spieler:in zuordnen.");
  assert.equal(
    fachlicheMeldung("SPIELER_SCHNUPPERT"),
    "Diese Spieler:in schnuppert in einem anderen Team. Dort beendet zuerst ein Mitglied das Schnuppern, oder sie wird aus dem Team genommen.",
  );
  // Kein «Probe» in den Sätzen.
  for (const t of [...Object.values(SCHNUPPERN_ZUORDNEN_TEXT), SCHNUPPERN_ZUORDNEN_LABEL, SCHNUPPERN_ZUORDNEN_HINWEIS, mehrere, gemischt])
    assert.ok(!/probe/i.test(t), t);
});

pruefe("Zuordnen (#579 AK 4–7, 20–23): Abweisung einzeln und gesammelt, Zahl der Termine im Singular und Plural", () => {
  const p = (vorname: string, nachname: string, jahrgang: number) => ({ id: vorname, vorname, nachname, jahrgang });
  const leer = { bereits: [], gleich: [], schnuppert: [], ueber_grenze: 0 };
  // Gleiche Angaben: Wortlaut des Boards; Schluss je nach Auswahl.
  assert.equal(
    zuordnenAbweisungText({ ...leer, gleich: [p("Elias", "Brunner", 2014)] }, "Db Junioren", 2),
    "Db Junioren führt schon eine Spieler:in mit gleichen Angaben wie Elias Brunner, 2014. Ändere die Auswahl und versuche es nochmals.",
  );
  assert.equal(
    zuordnenAbweisungText({ ...leer, gleich: [p("Elias", "Brunner", 2014)] }, "Db Junioren", 1),
    "Db Junioren führt schon eine Spieler:in mit gleichen Angaben wie Elias Brunner, 2014. Wähle ein anderes Team und versuche es nochmals.",
  );
  // Schon zugeordnet, einzeln und mehrere.
  assert.equal(
    zuordnenAbweisungText({ ...leer, bereits: [p("Luis", "Ott", 2012)] }, "Da Junioren", 1),
    "Luis Ott (2012) ist Da Junioren schon zugeordnet. Wähle ein anderes Team und versuche es nochmals.",
  );
  assert.match(
    zuordnenAbweisungText({ ...leer, bereits: [p("Luis", "Ott", 2012), p("Mia", "Graf", 2016)] }, "Da Junioren", 3),
    /^Luis Ott \(2012\) und Mia Graf \(2016\) sind Da Junioren schon zugeordnet\./,
  );
  assert.match(
    zuordnenAbweisungText({ ...leer, gleich: [p("Luis", "Ott", 2012), p("Mia", "Graf", 2016)] }, "Da Junioren", 3),
    /^Da Junioren führt schon Spieler:innen mit gleichen Angaben wie Luis Ott \(2012\) und Mia Graf \(2016\)\./,
  );
  // Schnuppernd: nennt das Team, in dem sie schnuppert.
  assert.match(
    zuordnenAbweisungText({ ...leer, schnuppert: [{ ...p("Leon", "Graf", 2015), team: "Da Junioren" }] }, "Ea Junioren", 1),
    /^Leon Graf \(2015\) schnuppert im Team «Da Junioren»\. Dort beendet zuerst ein Mitglied das Schnuppern, oder Leon wird aus dem Team genommen\./,
  );
  // Grenze: Wortlaut des Boards gesammelt («eine zu viel»), einzeln als Grenze des Teams.
  assert.equal(
    zuordnenAbweisungText({ ...leer, ueber_grenze: 1 }, "Da Junioren", 2),
    "Mit allen gewählten wären es 101 von 100, eine zu viel. Ändere die Auswahl und versuche es nochmals.",
  );
  assert.match(zuordnenAbweisungText({ ...leer, ueber_grenze: 3 }, "Da Junioren", 5), /^Mit allen gewählten wären es 103 von 100, 3 zu viel\./);
  assert.match(zuordnenAbweisungText({ ...leer, ueber_grenze: 1 }, "Da Junioren", 1), /^Da Junioren umfasst schon 100 oder mehr Spieler:innen\. Die Grenze des Teams ist erreicht;/);
  // Gesammelt nennt beides (AK 22), erst die Befunde, dann die Grenze.
  const beides = zuordnenAbweisungText({ ...leer, gleich: [p("Elias", "Brunner", 2014)], ueber_grenze: 2 }, "Db Junioren", 4);
  assert.ok(beides.indexOf("gleichen Angaben") < beides.indexOf("zu viel"), "Befunde vor der Grenze");
  assert.ok(beides.includes("102 von 100, 2 zu viel"));
  // Meldung nach dem Zuordnen: Namen bis drei, darüber die Zahl; Zahl der Termine Singular und Plural (AK 23).
  assert.equal(zugeordnetText(["Elias Brunner"], "Da Junioren", 0), "Elias Brunner ist jetzt dem Team Da Junioren zugeordnet.");
  assert.equal(zugeordnetText(["Elias Brunner", "Luis Ott"], "Da Junioren", 0), "Elias Brunner und Luis Ott sind jetzt dem Team Da Junioren zugeordnet.");
  assert.equal(zugeordnetText(["A", "B", "C", "D"], "Da Junioren", 0), "4 Spieler:innen sind jetzt dem Team Da Junioren zugeordnet.");
  assert.match(zugeordnetText(["A"], "Da", 1), /An 1 anstehenden Termin ist die erwartete Spielerzahl weggefallen/);
  assert.match(zugeordnetText(["A"], "Da", 3), /An 3 anstehenden Terminen ist die erwartete Spielerzahl weggefallen/);
  assert.ok(!zugeordnetText(["A"], "Da", 0).includes("Spielerzahl"), "ohne ersetzte Termine keine Zahl");
  assert.equal(zuordnenEinleitung(["Elias Brunner", "Luis Ott"]), "Elias Brunner und Luis Ott kommen ins gewählte Team. Bisherige Teams bleiben bestehen.", "Wortlaut des Boards");
  assert.equal(zuordnenEinleitung(["Elias Brunner"]), "Elias Brunner kommt ins gewählte Team. Bisherige Teams bleiben bestehen.");
});

pruefe("Kein Verweis auf den Index spieler_eindeutig (#578, Architekturplan §5.5)", () => {
  const repo = join(web, "..");
  const treffer: string[] = [];
  const dateien = [
    ...quelldateien(web),
    ...[join(repo, "supabase/tests"), join(repo, ".github/workflows")].flatMap((w) =>
      readdirSync(w, { recursive: true, encoding: "utf8" }).map((d) => join(w, d)).filter((d) => statSync(d).isFile()),
    ),
  ];
  for (const datei of dateien)
    if (datei !== fileURLToPath(import.meta.url) && /\bspieler_eindeutig\b/.test(readFileSync(datei, "utf8")))
      treffer.push(relative(repo, datei));
  assert.deepEqual(treffer, [], `spieler_eindeutig steht noch in: ${treffer.join(", ")}`);
});

/** Ein Aufruf oder Verweis auf die RPC `spieler_importieren` (Team-Import): `verein_spieler_importieren` zählt nicht. */
const ALTER_IMPORT = /(?<![A-Za-z_])spieler_importieren\b/;

pruefe("Kein Verweis auf spieler_importieren: der Team-Import ist weg, auch in Tests (#585 AK 12, Architekturplan §5.5)", () => {
  // Der Wächter schlägt an und lässt den Verein-Namen durch.
  assert.ok(ALTER_IMPORT.test("select spieler_importieren(a, b)"));
  assert.ok(ALTER_IMPORT.test('await db.rpc("spieler_importieren", {})'));
  assert.ok(!ALTER_IMPORT.test("select verein_spieler_importieren(a, b)"));
  assert.ok(!ALTER_IMPORT.test('db.rpc("verein_spieler_importieren")'));
  assert.ok(!ALTER_IMPORT.test("-- importieren Spieler"), "nur der Name der RPC");
  const repo = join(web, "..");
  const treffer: string[] = [];
  // Frühere Migrationen sind unveränderlich und bleiben ausgenommen; `pruefe-kern-db.ts` belegt, dass der Aufruf scheitert.
  const dateien = [
    ...quelldateien(web),
    ...[join(repo, "supabase/tests"), join(repo, ".github/workflows")].flatMap((w) =>
      readdirSync(w, { recursive: true, encoding: "utf8" }).map((d) => join(w, d)).filter((d) => statSync(d).isFile()),
    ),
  ];
  for (const datei of dateien) {
    if (datei === fileURLToPath(import.meta.url) || relative(repo, datei) === "web/scripts/pruefe-kern-db.ts") continue;
    if (ALTER_IMPORT.test(readFileSync(datei, "utf8"))) treffer.push(relative(repo, datei));
  }
  assert.deepEqual(treffer, [], `spieler_importieren steht noch in: ${treffer.join(", ")}`);
});

pruefe("Verein (#577): Marker der Datenebene tragen die Sätze der Oberfläche, Team- und Vereinsgrenze bleiben unterscheidbar", () => {
  for (const [marker, satz] of Object.entries(VEREIN_MELDUNG)) assert.equal(fehlerMeldung(`x ${marker} y`), satz, marker);
  for (const [marker, satz] of Object.entries(VEREIN_MELDUNG)) assert.equal(still(() => ausDbFehler({ message: marker })).meldung, satz, `ausDbFehler ${marker}`);
  // Wortlaut nach Architekturplan §5.3.
  assert.equal(SPIELER_MAX, 100);
  assert.equal(VEREIN_SPIELER_MAX, 1000);
  assert.equal(VEREIN_TEAMS_MAX, 30);
  assert.equal(SPIELER_MELDUNG.SPIELERLISTE_VOLL, "Das Team hat schon 100 Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.");
  assert.equal(VEREIN_MELDUNG.VEREIN_VOLL, "Der Verein hat schon 1000 Spieler:innen. Weitere kommen erst dazu, wenn es weniger sind.");
  assert.equal(VEREIN_MELDUNG.VEREIN_TEAMS_VOLL, "Der Verein hat schon 30 Teams. Ein weiteres kommt erst dazu, wenn es weniger sind.");
  // Kein Marker mehr (#581): eigene Konstante, nicht in der Markerliste.
  assert.equal(TEAM_NUR_VERWALTUNG, "Neue Teams legt die Vereinsverwaltung an.");
  assert.ok(!("TEAM_NUR_VERWALTUNG" in VEREIN_MELDUNG), "TEAM_NUR_VERWALTUNG steht wieder in VEREIN_MELDUNG");
  // Verein-Ort: neutral, ohne den Zusatz des Team-Orts (die Verwaltung arbeitet ohne Mitgliedschaft).
  assert.equal(VEREIN_TEAM_NICHT_GEFUNDEN, "Team nicht gefunden.");
  assert.ok(SERIE_MELDUNG.TEAM_NICHT_GEFUNDEN.startsWith("Team nicht gefunden. Du kannst nur in Teams arbeiten"), "Satz des Team-Orts unverändert");
  assert.equal(VEREIN_MELDUNG.VEREIN_NICHT_GEFUNDEN, "Verein nicht gefunden.");
  assert.notEqual(SPIELER_MELDUNG.SPIELERLISTE_VOLL, VEREIN_MELDUNG.VEREIN_VOLL, "AK 7: Team- und Vereinsgrenze unterscheiden sich");
  // Die heiklen Paare aus Architekturplan §5.2 sind je als Ganzes eindeutig.
  for (const [a, b] of [["VEREIN_VOLL", "VEREIN_TEAMS_VOLL"]] as const) {
    assert.equal(fehlerMeldung(`x ${a} y`), VEREIN_MELDUNG[a]);
    assert.equal(fehlerMeldung(`x ${b} y`), VEREIN_MELDUNG[b]);
  }
});

/** Eine Vorschau in der Form der Datenebene (Vertrag Story #585) — Zeilennummern wie in der Datei. */
const importVorschau = (v: Partial<ImportVorschau>): ImportVorschau => ({ bestand: 0, ueber: 0, neu: [], js: [], gleich: [], mehrfach: [], ...v });

pruefe("Import im Verein: Grenze 1000, Zeilendeckel und Dateigrösse haben je ihren Satz (#585 AK 6, 7)", () => {
  assert.equal(IMPORT_ZEILEN_MAX, 1000);
  assert.equal(SPIELER_MELDUNG.IMPORT_ZU_GROSS, `Eine Datei darf höchstens ${IMPORT_ZEILEN_MAX} Zeilen haben.`, "Satz und Zahl bleiben Zwillinge");
  assert.equal(IMPORT_TEXT.zuGross, SPIELER_MELDUNG.IMPORT_ZU_GROSS, "Zeilen: derselbe Satz wie der Marker");
  assert.notEqual(IMPORT_TEXT.zuGrossBytes, IMPORT_TEXT.zuGross, "die Dateigrösse hat einen eigenen Satz");
  assert.equal(
    IMPORT_TEXT.zuGrossBytes,
    "Die Datei ist zu gross. Speichere die Datei nur mit den Spalten für Vorname, Nachname, Jahrgang und J+S-Nummer und wähle sie erneut.",
  );
  assert.equal(fehlerMeldung("x IMPORT_ZU_GROSS y"), SPIELER_MELDUNG.IMPORT_ZU_GROSS, "der Marker der Datenebene kommt als Satz an");
  // Mit Zahl: um wie viele der Verein über 1000 läge (Beispiel des Boards). Ohne
  // «Nichts übernommen.»: In der Vorschau ist noch nichts versucht; nach einer
  // Übernahme sagt es das Band.
  assert.ok(IMPORT_TEXT.veraltet.includes("Nichts übernommen."), "das Band sagt, dass nichts übernommen wurde");
  assert.equal(
    importUeberGrenzeText(importVorschau({ bestand: 997, ueber: 9, neu: Array.from({ length: 12 }, (_, i) => i + 2) })),
    "Mit diesen 12 neuen wären es 1009 Spieler:innen, 9 mehr als 1000. Entferne Zeilen aus der Datei oder lösche zuerst Spieler:innen.",
  );
  assert.equal(
    importUeberGrenzeText(importVorschau({ bestand: 1000, ueber: 1, neu: [2] })),
    "Mit dieser neuen Spieler:in wären es 1001 Spieler:innen, 1 mehr als 1000. Entferne Zeilen aus der Datei oder lösche zuerst Spieler:innen.",
  );
});

pruefe("Import im Verein: bestätigen nur mit Änderung und unter der Grenze (#585 AK 5, 6)", () => {
  assert.equal(importUebernehmbar(importVorschau({ neu: [2] })), true, "eine Neue genügt");
  assert.equal(importUebernehmbar(importVorschau({ js: [{ zeile: 2, alt: null, teams: [] }] })), true, "eine geänderte J+S-Nummer genügt");
  assert.equal(importUebernehmbar(importVorschau({ gleich: [{ zeile: 2, teams: [] }] })), false, "nur Unveränderte: nichts zu übernehmen");
  assert.equal(importUebernehmbar(importVorschau({ mehrfach: [{ zeile: 2, teams: [] }] })), false, "mehrfach allein genügt nicht (AK 5)");
  assert.equal(importUebernehmbar(importVorschau({})), false);
  assert.equal(importUebernehmbar(importVorschau({ bestand: 1000, ueber: 1, neu: [2] })), false, "über der Grenze gesperrt");
  assert.equal(
    importUebernehmbar(importVorschau({ bestand: 1005, ueber: 0, js: [{ zeile: 2, alt: "1", teams: [] }] })),
    true,
    "ein Bestand über der Grenze lässt J+S-Änderungen ohne Neue zu",
  );
});

pruefe("Import im Verein: Sätze der Vorschau, mit Einzahl und ohne Team (#585 AK 3, 4, 5)", () => {
  assert.equal(
    importNeuText(12, 144, "FC Wyler"),
    "12 Spieler:innen kommen neu in den Verein «FC Wyler», ohne Team. Alle Trainer:innen des Vereins sehen sie mit Name und Jahrgang; löschen lassen sie sich nur einzeln. Danach sind es 156 von 1000.",
  );
  assert.equal(
    importNeuText(1, 0, "FC Wyler"),
    "1 Spieler:in kommt neu in den Verein «FC Wyler», ohne Team. Alle Trainer:innen des Vereins sehen sie mit Name und Jahrgang; löschen lässt sie sich nur einzeln. Danach ist es 1 von 1000.",
  );
  assert.equal(IMPORT_TEXT.einleitung("FC Wyler"), "Neue Spieler:innen kommen ohne Team in den Verein «FC Wyler». Bestehende erkennt KiFu im ganzen Verein und legt sie nicht neu an.");
  const ea = { id: "t2", name: "Ea Junioren" };
  const da = { id: "t1", name: "Da Junioren" };
  assert.equal(
    importMehrfachText([{ name: "Mia Rossi", jahrgang: 2014, teams: [da, ea] }]),
    "Mia Rossi, 2014, wird mehrfach im Verein geführt (Da Junioren und Ea Junioren). KiFu ändert bei keinem dieser Einträge die J+S-Nummer.",
  );
  assert.equal(
    importMehrfachText([{ name: "Lio Doppel", jahrgang: 2015, teams: [] }]),
    "Lio Doppel, 2015, wird mehrfach im Verein geführt. KiFu ändert bei keinem dieser Einträge die J+S-Nummer.",
    "ohne Team entfällt die Klammer",
  );
  assert.equal(importMehrfachText([{ name: "A", jahrgang: 2014, teams: [] }, { name: "B", jahrgang: 2015, teams: [da] }]), IMPORT_TEXT.mehrfachViele);
  assert.equal(importNichtsZuTunText(0), "Alle stehen schon so im Verein; es gibt nichts zu übernehmen.");
  assert.equal(importNichtsZuTunText(2), "Alle stehen schon so im Verein; es gibt nichts zu übernehmen. Mehrfach geführte Spieler:innen ändert KiFu nicht.");
  assert.equal(
    IMPORT_TEXT.veraltet,
    "Seit der Vorschau hat sich der Spielerbestand geändert. Nichts übernommen. Prüfe die neue Vorschau.",
  );
});

pruefe("Import im Verein: Antwort der Datenebene wird zur Vorschau, Teams in deutscher Ordnung (#585 Vertrag)", () => {
  const roh = importVorschau({
    bestand: 5,
    ueber: 0,
    neu: [2, 5],
    js: [{ zeile: 3, alt: null, teams: [{ id: "b", name: "Zebra" }, { id: "a", name: "Älpler" }, { id: "c", name: "Adler" }] }],
    gleich: [{ zeile: 4, teams: [] }],
    mehrfach: [{ zeile: 6, teams: [{ id: "b", name: "Zebra" }, { id: "a", name: "Älpler" }] }],
  });
  const v = vorschauAus({ status: "vorschau", ...roh })!;
  assert.ok(v, "der Status der Antwort stört nicht");
  assert.deepEqual(v.js[0].teams.map((t) => t.name), ["Adler", "Älpler", "Zebra"], "Ä sortiert wie A");
  assert.deepEqual(v.mehrfach[0].teams.map((t) => t.name), ["Älpler", "Zebra"]);
  assert.deepEqual(v.gleich, [{ zeile: 4, teams: [] }], "leer heisst ohne Team");
  assert.deepEqual({ neu: v.neu, bestand: v.bestand, ueber: v.ueber }, { neu: [2, 5], bestand: 5, ueber: 0 });
  assert.deepEqual(roh.js[0].teams.map((t) => t.name), ["Zebra", "Älpler", "Adler"], "die Antwort bleibt unangetastet");
  // Übernommen und veraltet (Grund Bestand wie Grenze) kommen in Form des Kerns an.
  assert.deepEqual(ausgangAus({ status: "uebernommen", neu: 12, js: 2 }), { status: "uebernommen", neu: 12, js: 2 });
  assert.deepEqual(ausgangAus({ status: "veraltet", grund: "grenze", vorschau: roh }), { status: "veraltet", grund: "grenze", vorschau: v });
  const bestand = ausgangAus({ status: "veraltet", grund: "bestand", vorschau: roh });
  assert.ok(bestand?.status === "veraltet" && bestand.grund === "bestand");
  // Passt die Form nicht, gibt es keine Vorschau (der Kern meldet einen technischen Fehler).
  for (const kaputt of [
    null,
    [],
    { ...roh, bestand: "5" },
    { ...roh, neu: [2.5] },
    { ...roh, mehrfach: undefined },
    { ...roh, gleich: [{ zeile: 4 }] },
    { ...roh, js: [{ zeile: 3, alt: 7, teams: [] }] },
    { ...roh, js: [{ zeile: 3, alt: null, teams: [{ id: "a" }] }] },
  ])
    assert.equal(vorschauAus(kaputt), null, JSON.stringify(kaputt));
  for (const kaputt of [
    { status: "vorschau", ...roh },
    { status: "uebernommen", neu: 1 },
    { status: "veraltet", grund: "anders", vorschau: roh },
    { status: "veraltet", grund: "bestand", vorschau: { ...roh, ueber: null } },
    { neu: 1, js: 0 },
  ])
    assert.equal(ausgangAus(kaputt), null, JSON.stringify(kaputt));
  // Was die Oberfläche der Übernahme mitgibt: die Zeilennummern der Vorschau.
  assert.equal(IMPORT_TEXT.unstimmig, "Der Import liess sich gerade nicht auswerten. Bitte versuche es noch einmal.");
  assert.deepEqual(erwartetVon(v), { neu: [2, 5], js: [{ zeile: 3, alt: null }], mehrfach: [6] }, "J+S mit der alten Nummer (D1)");
});

pruefe("Import im Verein: Zeilennummern der Antwort stammen aus den gesendeten Zeilen, keine doppelt (#585, Review W2)", () => {
  const v = importVorschau({ neu: [2], js: [{ zeile: 3, alt: "1", teams: [] }], gleich: [{ zeile: 4, teams: [] }], mehrfach: [{ zeile: 5, teams: [] }] });
  assert.equal(importZeilenStimmen(v, [2, 3, 4, 5]), true);
  assert.equal(importZeilenStimmen(v, [2, 3, 4, 5, 6]), true, "überstimmte Zeilen fehlen still");
  assert.equal(importZeilenStimmen(v, [2, 3, 4]), false, "Zeile 5 nicht gesendet");
  assert.equal(importZeilenStimmen({ ...v, gleich: [{ zeile: 2, teams: [] }] }, [2, 3, 4, 5]), false, "Zeile 2 doppelt");
  assert.equal(importZeilenStimmen({ ...v, neu: [2, 2] }, [2, 3, 4, 5]), false, "doppelt in derselben Liste");
  assert.equal(importZeilenStimmen(importVorschau({}), []), true);
});

pruefe("Import im Verein: Eingaben einer Action in Form, sonst kein TypeError (#585, Review W4)", () => {
  const z = { zeile: 2, vorname: "Mia", nachname: "Rossi", jahrgang: 2015, jsNummer: null };
  assert.equal(importZeilenForm([z, { ...z, zeile: 3, jsNummer: "123" }]), true);
  assert.equal(importZeilenForm([]), true);
  for (const kaputt of [null, undefined, "x", {}, [null], [7], [{ ...z, zeile: "2" }], [{ ...z, vorname: 1 }], [{ ...z, jahrgang: "2015" }], [{ ...z, jsNummer: undefined }]])
    assert.equal(importZeilenForm(kaputt), false, JSON.stringify(kaputt));
  const e = { neu: [2], js: [{ zeile: 3, alt: null }, { zeile: 4, alt: "9" }], mehrfach: [] };
  assert.equal(importErwartetForm(e), true);
  for (const kaputt of [null, undefined, [], {}, { ...e, neu: null }, { ...e, js: [3] }, { ...e, js: [{ zeile: 3 }] }, { ...e, js: [{ zeile: 3, alt: 9 }] }, { ...e, mehrfach: ["6"] }])
    assert.equal(importErwartetForm(kaputt), false, JSON.stringify(kaputt));
});

pruefe("Import im Verein: Plakette der J+S-Änderungen in Ein- und Mehrzahl (#585, Review W5)", () => {
  assert.equal(importJsPlakette(1), "1 J+S-Nummer ändert sich");
  assert.equal(importJsPlakette(3), "3 J+S-Nummern ändern sich");
});

pruefe("Spielerzahl: Liste vor erwartet, ausgefallen ohne Zahl (#434 AK 8, #435 AK 6, #437 AK 4)", () => {
  const liste = spielerzahlVon({ spielerzahl: 12, spielstand: { gesamt: 15, angemeldet: 0, eingefroren: false } });
  assert.deepEqual(liste, { quelle: "liste", angemeldet: 0, gesamt: 15, anwesend: null });
  assert.equal(spielerzahlKurz(liste), "0/15", "auch 0 angemeldet");
  assert.equal(spielerzahlLang(liste), "0 von 15 angemeldet");
  const erwartet = spielerzahlVon({ spielerzahl: 1, spielstand: null });
  assert.equal(spielerzahlKurz(erwartet), "1");
  assert.equal(spielerzahlLang(erwartet), "1 Spieler:in erwartet");
  assert.deepEqual(spielerzahlVon({ spielerzahl: null, spielstand: null }), { quelle: "unbekannt" });
  assert.deepEqual(spielerzahlVon({ spielerzahl: 12, spielstand: null, ausgefallen: true }), { quelle: "unbekannt" });
});

pruefe("Nachtrag: vier Stände, anwesend ist, wer angemeldet oder doch erschienen ist, ab Beginn zählen die Anwesenden (#475 AK 8–10)", () => {
  const faelle = [
    [{ abgemeldet: false, nachgetragen: false }, "angemeldet", true],
    [{ abgemeldet: true, nachgetragen: false }, "abgemeldet", false],
    [{ abgemeldet: false, nachgetragen: true }, "nicht_erschienen", false],
    [{ abgemeldet: true, nachgetragen: true }, "doch_erschienen", true],
  ] as const;
  for (const [t, status, da] of faelle) {
    assert.equal(teilnahmeStatus(t), status);
    assert.equal(istAnwesend(t), da, status);
  }
  assert.equal(TEILNAHME_TEXT.nicht_erschienen, "angemeldet, nicht erschienen");
  // Der Schalter: vor Beginn angemeldet, ab Beginn da.
  assert.equal(statusNachSchalter({ abgemeldet: false }, false, false), "abgemeldet");
  assert.equal(statusNachSchalter({ abgemeldet: false }, false, true), "nicht_erschienen");
  assert.equal(statusNachSchalter({ abgemeldet: true }, true, true), "doch_erschienen");
  assert.equal(statusNachSchalter({ abgemeldet: true }, false, true), "abgemeldet");
  const begonnen = spielerzahlVon({ spielerzahl: null, spielstand: { gesamt: 15, angemeldet: 12, eingefroren: true, anwesend: 11 } });
  assert.equal(spielerzahlKurz(begonnen), "11/15");
  assert.equal(spielerzahlLang(begonnen), "11 von 15 da");
  assert.deepEqual(spielerzahlVon({ spielerzahl: null, spielstand: { gesamt: 15, angemeldet: 12, eingefroren: true, anwesend: 11 }, ausgefallen: true }), { quelle: "unbekannt" }, "AK 11");
  assert.equal(abweisungText("nicht_begonnen"), ABMELDUNG_TEXT.nichtBegonnen);
  assert.equal(abweisungText("nicht_dabei"), ABMELDUNG_TEXT.nichtDabei);
});

pruefe("Nachtrag: Verlegen in die Zukunft nennt verfallende Nachträge (#475 AK 12)", () => {
  assert.equal(verfallText(0, 1), "Damit verfällt 1 Nachtrag zur Anwesenheit: Die Spieler:in gilt wieder als angemeldet.");
  assert.equal(verfallText(2, 1), `${verfallText(2)} Damit verfällt auch 1 Nachtrag zur Anwesenheit.`);
  assert.equal(verfallText(1, 3), `${verfallText(1)} Damit verfallen auch 3 Nachträge zur Anwesenheit.`);
  assert.ok(verfallDialogText(2).endsWith("Wer am neuen Zeitpunkt nicht kann, meldet sich neu ab."));
  assert.equal(verfallDialogText(0, 2), verfallText(0, 2), "ohne Abmeldungen kein Satz zum Abmelden");
});

pruefe("terminBegonnen: minutengenau am Trainingsort (Zwilling von termin_begonnen)", () => {
  assert.equal(terminBegonnen("2026-10-16", "18:00", "2026-10-16T17:59"), false);
  assert.equal(terminBegonnen("2026-10-16", "18:00", "2026-10-16T18:00"), true, "ab der Minute des Beginns");
  assert.equal(terminBegonnen("2026-10-16", "18:00:00", "2026-10-16T18:01"), true, "Postgres-Zeit mit Sekunden");
  assert.equal(terminBegonnen("2026-10-17", "08:00", "2026-10-16T23:59"), false);
});

pruefe("Statuswechsel: seit wann, die feinste Stufe gewinnt, Schweizer Kalendertage (#467 AK 3–10)", () => {
  const um = (jetzt: string) => (zeitpunkt: string) => seitWann(zeitpunkt, jetzt);
  // Montag, 19.10.2026, 12:00 (Sommerzeit).
  const mittag = um("2026-10-19T12:00:00+02:00");
  assert.equal(mittag("2026-10-19T11:59:30+02:00"), "gerade eben");
  assert.equal(mittag("2026-10-19T12:00:20+02:00"), "gerade eben", "Uhren gehen auseinander: nie «vor -1 Minute»");
  assert.equal(mittag("2026-10-19T11:59:00+02:00"), "vor 1 Minute");
  assert.equal(mittag("2026-10-19T11:01:00+02:00"), "vor 59 Minuten");
  assert.equal(mittag("2026-10-19T11:00:00+02:00"), "vor 1 Stunde");
  assert.equal(mittag("2026-10-19T10:01:00+02:00"), "vor 1 Stunde", "abgerundet");
  assert.equal(mittag("2026-10-19T00:30:00+02:00"), "vor 11 Stunden");
  assert.equal(mittag("2026-10-18T23:59:00+02:00"), "gestern", "Sonntag ist am Montag gestern, nicht letzte Woche");
  assert.equal(mittag("2026-10-17T08:00:00+02:00"), "vorgestern");
  assert.equal(mittag("2026-10-16T18:00:00+02:00"), "letzte Woche");
  assert.equal(mittag("2026-10-12T00:00:00+02:00"), "letzte Woche");
  assert.equal(mittag("2026-10-11T23:00:00+02:00"), "So., 11.10.2026");
  // Über Mitternacht zählen die Minuten weiter, Stunden nicht.
  const nacht = um("2026-10-19T00:10:00+02:00");
  assert.equal(nacht("2026-10-18T23:50:00+02:00"), "vor 20 Minuten");
  assert.equal(nacht("2026-10-18T22:30:00+02:00"), "gestern");
  // Der Kalendertag ist der Schweizer: 00:30 bei uns ist in UTC noch der Vortag.
  assert.equal(um("2026-10-19T00:30:00+02:00")("2026-10-18T21:00:00+02:00"), "gestern");
  // Donnerstag: Montag ist diese Woche, Dienstag vorgestern.
  const donnerstag = um("2026-10-22T12:00:00+02:00");
  assert.equal(donnerstag("2026-10-19T10:00:00+02:00"), "diese Woche");
  assert.equal(donnerstag("2026-10-20T10:00:00+02:00"), "vorgestern");
  assert.equal(donnerstag("2026-10-21T10:00:00+02:00"), "gestern");
  // Über den Jahreswechsel: die Woche von Montag bis Sonntag.
  assert.equal(seitWann("2026-12-28T12:00:00+01:00", "2027-01-02T12:00:00+01:00"), "diese Woche");
  assert.equal(seitWann("2026-12-31T12:00:00+01:00", "2027-01-04T12:00:00+01:00"), "letzte Woche");
  assert.equal(seitWann("2026-12-20T12:00:00+01:00", "2027-01-04T12:00:00+01:00"), "So., 20.12.2026");
  // Zeitumstellung: Es zählt die verstrichene Zeit (01:30 Sommerzeit bis 03:30 Winterzeit sind 3 Stunden).
  assert.equal(seitWann("2026-10-25T01:30:00+02:00", "2026-10-25T03:30:00+01:00"), "vor 3 Stunden");
});

pruefe("Abmelden: Abweisung nennt den Stand, Liste nach Name mit ehemaligen zuletzt (#435 AK 4, PC 4; #437 AK 5)", () => {
  assert.equal(
    abweisungText("verlegt", { datum: "2026-10-22", beginn: "17:30", ende: "19:00", ausgefallen: false }),
    "Der Termin wurde inzwischen verlegt, neu auf Do., 22.10.2026 um 17:30. Sieh ihn dir noch einmal an.",
  );
  assert.equal(abweisungText("begonnen"), ABMELDUNG_TEXT.begonnen);
  assert.equal(abweisungText("ausgefallen"), ABMELDUNG_TEXT.ausgefallen);
  assert.equal(abweisungText("nicht_gefunden"), ABMELDUNG_TEXT.nichtGefunden);
  const t = (vorname: string | null) => ({ spielerId: vorname, vorname, nachname: vorname && "X", abgemeldet: false, ehemalig: vorname === null, nichtMehrImTeam: false, kader: [], gewechseltAm: null, nachgetragen: false });
  assert.deepEqual(nachTeilnehmer([t(null), t("Noah"), t("Ayla")]).map((x) => x.vorname ?? EHEMALIGE_SPIELERIN), ["Ayla", "Noah", EHEMALIGE_SPIELERIN]);
});

pruefe("Privater Link und Abholadresse: Format, Adresse, Pfad von Middleware und Besucherstatistik ausgenommen (#436 AK 4, 11, 14; #438 AK 6, 20)", () => {
  assert.equal(abholUrl("https://ki-fu.ch", "b".repeat(64)), `https://ki-fu.ch/abholen/${"b".repeat(64)}`);
  const token = "a".repeat(64);
  assert.equal(istLinkToken(token), true);
  for (const x of ["A".repeat(64), "a".repeat(63), "a".repeat(65), `${"a".repeat(63)}g`, 42, null])
    assert.equal(istLinkToken(x), false, String(x));
  assert.equal(spielerLinkUrl("https://ki-fu.ch/", token), `https://ki-fu.ch/abmelden/${token}`);
  // Der Ordner trägt den Parameter, an dem die Besucherstatistik die Seite erkennt.
  assert.ok(existsSync(`app/(privat)/${LINK_PFAD}/[privaterLink]/page.tsx`));
  assert.ok(readFileSync("components/layout/Besucherstatistik.tsx", "utf8").includes('"privaterLink" in params'));
  // Ohne Sitzung: die Middleware lässt den Pfad aus, Next schickt die Schutz-Header.
  for (const pfad of [LINK_PFAD, ABHOL_PFAD]) {
    assert.ok(existsSync(`app/(privat)/${pfad}/[privaterLink]/page.tsx`), pfad);
    assert.ok(readFileSync("middleware.ts", "utf8").includes(`|${pfad}/|`), pfad);
    assert.ok(readFileSync("next.config.ts", "utf8").includes(`"/${pfad}/:pfad*"`), pfad);
  }
});

pruefe("Verlegen: Texte zu verfallenden Abmeldungen (#437 AK 1, 2)", () => {
  assert.equal(verfallText(1), "Damit verfällt 1 Abmeldung: Die Spieler:in gilt wieder als angemeldet.");
  assert.equal(verfallText(3), "Damit verfallen 3 Abmeldungen: Diese Spieler:innen gelten wieder als angemeldet.");
  assert.ok(verfallBestaetigen(2).startsWith(verfallText(2)) && verfallBestaetigen(2).includes("«bestaetigt: true»"));
  assert.equal(
    verfallenHinweis({ datum: "2026-10-19", beginn: "18:00" }),
    "Verlegt, vorher Montag, 19. Oktober um 18:00. Deine Abmeldung gilt nicht mehr.",
  );
});

// ── CSV-Import der Spielerliste (#455) ──────────────────────────────────────

const csvBytes = (text: string, kodierung: "utf8" | "latin1" = "utf8") => new Uint8Array(Buffer.from(text, kodierung));
const CLUBCORNER_KOPF =
  "Name;Zweitname;Vorname;Anrede;Strasse;PLZ;Ort;E-Mail gesetzliche Vertretung;Name/Vorname gesetzliche Vertretung;Geburtsdatum;Passnummer;J+S-Nummer;Rückennummer";

pruefe("CSV-Import: Zeichensatz, Trennzeichen, leere und fremde Dateien (#455 AK 2–4)", () => {
  const text = `${CLUBCORNER_KOPF}\nLüthi;;Amélie;Frau;Weg 1;3014;Bern;a@b.ch;Lüthi Eva;07.04.2016;2101204;2745102;\n\n`;
  // Windows-1252 wie der ClubCorner-Export, UTF-8 mit BOM wie «CSV UTF-8» von Excel.
  for (const bytes of [csvBytes(text, "latin1"), new Uint8Array([0xef, 0xbb, 0xbf, ...csvBytes(text)])]) {
    const r = leseDatei("kader.csv", bytes);
    assert.ok(r.ok);
    assert.equal(r.tabelle.zeilen.length, 1, "Leerzeilen fallen weg");
    assert.equal(r.tabelle.zeilen[0].werte[2], "Amélie");
    assert.equal(r.tabelle.zeilen[0].nr, 2);
  }
  const komma = leseDatei("x.csv", csvBytes('Vorname,Nachname,Jahrgang\n"Anna, Lena","O""Brien",2017\r\n'));
  assert.ok(komma.ok);
  assert.deepEqual(komma.tabelle.zeilen[0].werte, ["Anna, Lena", 'O"Brien', "2017"]);
  assert.deepEqual(leseDatei("Kader.xlsx", csvBytes("x")), { ok: false, text: IMPORT_TEXT.keineCsv("Kader.xlsx") });
  assert.deepEqual(leseDatei("x.csv", new Uint8Array([0x50, 0x4b, 3, 4])), { ok: false, text: IMPORT_TEXT.keineCsv("x.csv") });
  assert.deepEqual(leseDatei("x.csv", csvBytes("")), { ok: false, text: IMPORT_TEXT.leer });
  assert.deepEqual(leseDatei("x.csv", csvBytes("Vorname;Name\n;\n")), { ok: false, text: IMPORT_TEXT.nurKopf });
  assert.deepEqual(leseDatei("x.csv", new Uint8Array([0x4e, 0x81, 0x0a])), { ok: false, text: IMPORT_TEXT.zeichensatz });
  assert.equal(dekodiere(csvBytes("Müller", "latin1")), "Müller");
  const zuViele = "Vorname;Name;Jahrgang\n" + "A;B;2017\n".repeat(IMPORT_ZEILEN_MAX + 1);
  assert.deepEqual(leseDatei("x.csv", csvBytes(zuViele)), { ok: false, text: IMPORT_TEXT.zuGross }, "1001 Zeilen: Zeilendeckel");
  const genau = "Vorname;Name;Jahrgang\n" + "A;B;2017\n".repeat(IMPORT_ZEILEN_MAX);
  assert.ok(leseDatei("x.csv", csvBytes(genau)).ok, "1000 Zeilen gehen");
  // Die Dateigrösse (1 MB) hat einen eigenen Satz, auch bei wenigen Zeilen.
  const gross = "Vorname;Name;Jahrgang\n" + "A;B;2017;" + "x".repeat(IMPORT_BYTES_MAX) + "\n";
  assert.deepEqual(leseDatei("x.csv", csvBytes(gross)), { ok: false, text: IMPORT_TEXT.zuGrossBytes }, "über 1 MB: Dateigrösse");
});

pruefe("CSV-Import: Spalten an ihren Köpfen erkennen (#455 AK 5–8)", () => {
  // ClubCorner: «Name» ist der Nachname, die Elternspalten zählen nicht.
  assert.deepEqual(erkenneSpalten(CLUBCORNER_KOPF.split(";")), { vorname: 2, nachname: 0, geburtsdatum: 9, jsNummer: 11 });
  assert.deepEqual(erkenneSpalten(["Rufname", "Familienname", "Geb.", "JS-Nr"]), { vorname: 0, nachname: 1, geburtsdatum: 2, jsNummer: 3 });
  // Ein Jahrgang geht dem Geburtsdatum vor; zwei gleich gute Spalten bleiben offen.
  assert.equal(erkenneSpalten(["Vorname", "Geburtsdatum", "Jahrgang"]).geburtsdatum, 2);
  assert.equal(erkenneSpalten(["Vorname", "Name", "Familienname"]).nachname, null);
  assert.equal(erkenneSpalten(["Spieler", "Telefon"]).vorname, null);
});

pruefe("CSV-Import: Jahrgang, J+S-Nummer und ausgelassene Zeilen (#455 AK 17–20)", () => {
  for (const [roh, j] of [["07.04.2016", 2016], ["7.4.2016", 2016], ["2016-04-07", 2016], ["2016", 2016], ["07.04.2016 00:00", 2016], ["7/4/2016", 2016]] as const)
    assert.equal(jahrgangAusDatum(roh), j, roh);
  for (const roh of ["3.5.16", "16", "", "April 2016", "0999"]) assert.equal(jahrgangAusDatum(roh), null, roh);
  assert.deepEqual(jsAus(" 100442966 "), { wert: "100442966", ungueltig: false });
  assert.deepEqual(jsAus(""), { wert: null, ungueltig: false });
  for (const roh of ["k.A.", "-", "756.1234.5678.97", "1".repeat(21)]) assert.deepEqual(jsAus(roh), { wert: null, ungueltig: true }, roh);

  const r = leseDatei(
    "x.csv",
    csvBytes("Vorname;Name;Geburtsdatum;J+S-Nummer\nPaula Marie;Baumgartner;19.05.2016;\nLea;Hostettler;01.02.2016;k.A.\nMalea;Frey;3.5.16;1\n;Ohne;01.01.2016;\n;;;\n"),
  );
  assert.ok(r.ok);
  const { eintraege, hinweise } = importZeilen(r.tabelle, erkenneSpalten(r.tabelle.kopf));
  assert.deepEqual(eintraege, [
    { zeile: 2, vorname: "Paula Marie", nachname: "Baumgartner", jahrgang: 2016, jsNummer: null },
    { zeile: 3, vorname: "Lea", nachname: "Hostettler", jahrgang: 2016, jsNummer: null },
  ]);
  assert.deepEqual(hinweise, [
    { zeile: 3, name: "Lea Hostettler", text: IMPORT_TEXT.js("k.A."), ausgelassen: false },
    { zeile: 4, name: "Malea Frey", text: IMPORT_TEXT.geburt("3.5.16"), ausgelassen: true },
    { zeile: 5, name: "Ohne", text: IMPORT_TEXT.vorname, ausgelassen: true },
  ]);
});

pruefe("CSV-Import: Meldung nach der Übernahme, die Neuen sind ohne Team (#585 AK 10)", () => {
  const zuordnen = "einem Team ordnest du sie im Spielerbestand zu.";
  assert.equal(
    importErgebnisText({ neu: 12, js: 2 }),
    `12 Spieler:innen aufgenommen, bei 2 die J+S-Nummer geändert. Die Neuen sind keinem Team zugeordnet; ${zuordnen}`,
  );
  assert.equal(importErgebnisText({ neu: 12, js: 0 }), `12 Spieler:innen aufgenommen. Die Neuen sind keinem Team zugeordnet; ${zuordnen}`);
  assert.equal(
    importErgebnisText({ neu: 1, js: 2 }),
    `1 Spieler:in aufgenommen, bei 2 die J+S-Nummer geändert. Die neue Spieler:in ist keinem Team zugeordnet; ${zuordnen}`,
  );
  assert.equal(importErgebnisText({ neu: 1, js: 0 }), `1 Spieler:in aufgenommen. Die neue Spieler:in ist keinem Team zugeordnet; ${zuordnen}`);
  assert.equal(importErgebnisText({ neu: 0, js: 1 }), "Bei 1 Spieler:in die J+S-Nummer geändert.", "ohne Neue kein Satz zu Teams");
  assert.equal(importErgebnisText({ neu: 0, js: 3 }), "Bei 3 Spieler:innen die J+S-Nummer geändert.");
});

// ── Kader (Epic #447) ───────────────────────────────────────────────────────

pruefe("Kader: Name 1 bis 30 Zeichen, Gross/Klein und Leerzeichen unterscheiden nicht, Bindestrich schon (#452 AK 10)", () => {
  assert.equal(kaderNameProblem("Stärkeklasse 1"), null);
  assert.equal(kaderNameProblem("   "), KADER_TEXT.name);
  assert.equal(kaderNameProblem("x".repeat(KADER_NAME_MAX)), null);
  assert.equal(kaderNameProblem("x".repeat(KADER_NAME_MAX + 1)), KADER_TEXT.name);
  assert.equal(kaderNameProblem("😀".repeat(KADER_NAME_MAX)), null, "Länge in Code Points wie char_length");
  assert.deepEqual(nachKaderName([{ name: "Torhüterinnen" }, { name: "Aushilfe" }]).map((k) => k.name), ["Aushilfe", "Torhüterinnen"]);
});

pruefe("Kader: Marker der Datenebene tragen die Sätze der Oberfläche (#452 AK 15)", () => {
  for (const [marker, satz] of Object.entries(KADER_MELDUNG)) assert.equal(fehlerMeldung(`x ${marker} y`), satz, marker);
  assert.equal(fehlerMeldung('new row violates check constraint "kader_name"'), KADER_TEXT.name);
});

pruefe("Kader: Zugehörigkeit einer Auswahl und Kader einer Spieler:in (#452 AK 6, 7)", () => {
  const k = { id: "k", name: "Aushilfe", spielerIds: ["a", "b"] };
  assert.equal(zugehoerigkeit(k, ["a", "b"]), "alle");
  assert.equal(zugehoerigkeit(k, ["a", "c"]), "teil");
  assert.equal(zugehoerigkeit(k, ["c"]), "keine");
  assert.deepEqual(kaderVon("b", [k, { id: "j", name: "S1", spielerIds: ["c"] }]).map((x) => x.id), ["k"]);
});

pruefe("Team-Verwaltung in vier Bereichen mit eigener Adresse; die bisherige zeigt die Spieler:innen (#656)", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  // AK 3: die vier Bereiche in dieser Reihenfolge, unterscheidbar benannt.
  assert.deepEqual(TEAM_BEREICHE.map((b) => b.label), ["Spieler:innen", "Kader & Schnuppern", "Privater Link", "Trainer:innen"]);
  // AK 1, 2, PC 1: jeder Bereich hat seine Adresse, die bisherige ist «Spieler:innen».
  assert.equal(teamBereichHref(T, "spieler"), `/team/${T}/verwaltung`);
  assert.equal(teamBereichHref(T, "trainer"), `/team/${T}/verwaltung/trainer`);
  for (const b of TEAM_BEREICHE) {
    const href = teamBereichHref(T, b.schluessel);
    assert.equal(teamBereichAusPfad(href, T), b.schluessel, href);
    const seite = join(web, "app/(app)/team/[id]/verwaltung", b.pfad.slice(1), "page.tsx");
    assert.ok(existsSync(seite), `${relative(web, seite)} fehlt`);
  }
  assert.equal(teamBereichAusPfad(`/team/${T}/verwaltung/`, T), "spieler");
  assert.equal(teamBereichAusPfad(`/team/${T}`, T), null);
  assert.equal(teamBereichAusPfad(`/team/${T}/verwaltung/unbekannt`, T), null);
  // Die Reiter tragen nur die Eingrenzung der Spielerliste weiter (#601).
  assert.deepEqual([...FILTER_SCHLUESSEL], ["q", "kader", "jahrgang", "link"]);
  const suche = new URLSearchParams("jahrgang=2016&fremd=1&kader=a&kader=ohne&q=lea");
  assert.equal(teamBereichHref(T, "link", suche), `/team/${T}/verwaltung/link?q=lea&kader=a&kader=ohne&jahrgang=2016`);
  assert.equal(teamBereichHref(T, "kader", new URLSearchParams("fremd=1")), `/team/${T}/verwaltung/kader`);
  // AK 4: was die eine Seite bot, steht jetzt in genau einem Bereich.
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const lies = (d: string) => ohneKommentare(readFileSync(join(web, "app/(app)/team/[id]/verwaltung", d), "utf8"));
  const ort: Record<string, string> = {
    SpielerListe: "page.tsx",
    KaderKarte: "kader/page.tsx",
    SchnupperKarte: "kader/page.tsx",
    Selbstabholung: "link/page.tsx",
    TeamInfosKarte: "link/page.tsx",
    MitgliederListe: "trainer/page.tsx",
    TeamGefahrenzone: "trainer/page.tsx",
    Teamangaben: "trainer/page.tsx",
  };
  const seiten = ["page.tsx", "kader/page.tsx", "link/page.tsx", "trainer/page.tsx"];
  for (const [teil, datei] of Object.entries(ort))
    for (const s of seiten) assert.equal(new RegExp(`\\b${teil}\\b`).test(lies(s)), s === datei, `${teil} in ${s}`);
  assert.ok(!/Selbstabholung/.test(ohneKommentare(readFileSync(join(web, "components/team/SpielerListe.tsx"), "utf8"))), "die Spielerliste zeigt die Selbstabholung nicht mehr");
  // Die Seitenleiste markiert «Team» in jedem Bereich.
  assert.match(readFileSync(join(web, "components/layout/AppNavClient.tsx"), "utf8"), /pfad\.startsWith\(`\$\{basis\}\/verwaltung\/`\)/);
});

pruefe("Spielerliste eingrenzen: Suche, Kader, Jahrgang, Link-Stand; Adresse und Auswahl (#601)", () => {
  const ka = "11111111-1111-4111-8111-111111111111";
  const kb = "22222222-2222-4222-8222-222222222222";
  const kx = "33333333-3333-4333-8333-333333333333";
  const zeile = (id: string, vorname: string, nachname: string, jahrgang: number, kaderIds: string[], linkStand: LinkStand, jsNummer: string | null = null) =>
    ({ id, vorname, nachname, jahrgang, kaderIds, linkStand, jsNummer });
  const liste = [
    zeile("lea", "Léa", "Müller", 2016, [ka], "abgeholt", "1234567"),
    zeile("noah", "Noah", "Strauß", 2017, [ka, kb], "zugestellt"),
    zeile("mia", "Mia", "Øster", 2016, [], "offen", "7654321"),
    zeile("ole", "Ole", "Beispiel", 2015, [kb], "offen"),
  ];
  const ids = (e: Parameters<typeof filtereSpieler>[1]) => filtereSpieler(liste, e).map((s) => s.id);
  const leer = liesTeamEingrenzung({});
  // Nackte Adresse: nichts gesetzt, alle sichtbar, der Kopf zählt die ganze Liste.
  assert.deepEqual(leer, { suche: "", kaderIds: [], ohneKader: false, jahrgaenge: [], linkStaende: [] });
  assert.equal(teamEingrenzungGesetzt(leer), false);
  assert.deepEqual(ids(leer), ["lea", "noah", "mia", "ole"]);
  assert.equal(teamSpielerAnzahlText(4, 4, false), "4");
  assert.equal(teamSpielerAnzahlText(1, 4, true), "1 von 4");
  // AK 1: Vorname, Nachname, beide in jeder Reihenfolge, J+S-Nummer; ohne Gross/Klein und Akzente.
  const q = (text: string) => ids(liesTeamEingrenzung({ q: text }));
  assert.deepEqual(q("lea"), ["lea"]);
  assert.deepEqual(q("MUELLER"), [], "keine Umschreibung «ue» für «ü»");
  assert.deepEqual(q("muller"), ["lea"]);
  assert.deepEqual(q("léa müller"), ["lea"]);
  assert.deepEqual(q("muller lea"), ["lea"], "Nachname vor Vorname");
  assert.deepEqual(q("  LEA   MÜL "), ["lea"], "bereinigt wie die Datenebene");
  assert.deepEqual(q("strauss"), ["noah"], "ß wie unaccent");
  assert.deepEqual(q("oster"), ["mia"], "ø wie unaccent");
  assert.deepEqual(q("4567"), ["lea"], "J+S-Nummer als Teiltext");
  assert.deepEqual(q("a m"), ["lea"], "über die Grenze zwischen Vor- und Nachname");
  assert.deepEqual(q("xyz"), []);
  assert.equal(falteSuchtext("Zoë ÅSA"), "zoe asa");
  // AK 2: mehrere Kader und «Ohne Kader» — wer mindestens eine Bedingung erfüllt.
  const k = (wert: string) => ids(liesTeamEingrenzung({ kader: wert }));
  assert.deepEqual(k(ka), ["lea", "noah"]);
  assert.deepEqual(k(`${ka},${kb}`), ["lea", "noah", "ole"]);
  assert.deepEqual(k(OHNE_KADER_WERT), ["mia"]);
  assert.deepEqual(k(`${OHNE_KADER_WERT},${kb}`), ["noah", "mia", "ole"]);
  // AK 3: Jahrgänge mehrfach; zur Wahl stehen die Jahrgänge der ganzen Liste.
  assert.deepEqual(ids(liesTeamEingrenzung({ jahrgang: "2016,2015" })), ["lea", "mia", "ole"]);
  assert.deepEqual(jahrgaengeDerListe(liste), [2015, 2016, 2017]);
  // AK 4: abgeholt oder nicht abgeholt (zugestellt und offen).
  assert.deepEqual(ids(liesTeamEingrenzung({ link: "abgeholt" })), ["lea"]);
  assert.deepEqual(ids(liesTeamEingrenzung({ link: "zugestellt,offen" })), ["noah", "mia", "ole"]);
  assert.deepEqual(Object.keys(TEAM_SPIELER_FILTER.linkStand), [...LINK_STAENDE]);
  // AK 5: zwischen den Filtern und.
  assert.deepEqual(ids(liesTeamEingrenzung({ kader: kb, jahrgang: "2017", link: "zugestellt" })), ["noah"]);
  assert.deepEqual(ids(liesTeamEingrenzung({ q: "lea", link: "offen" })), [], "AK 7: niemand");
  // AK 6, 8: jedes für sich gilt als gesetzt (Zurücksetzen, Zahl im Kopf).
  for (const sp of [{ q: "x" }, { kader: OHNE_KADER_WERT }, { kader: ka }, { jahrgang: "2016" }, { link: "offen" }])
    assert.equal(teamEingrenzungGesetzt(liesTeamEingrenzung(sp)), true, JSON.stringify(sp));
  // Lesen: Unbrauchbares fällt weg, jeder Wert einmal, Stände in fester Folge.
  assert.deepEqual(liesTeamEingrenzung({ kader: `kaputt,,${ka},${ka},${OHNE_KADER_WERT}`, jahrgang: "abc,12,2016,2016", link: "offen,bezogen,abgeholt,offen" }), {
    suche: "",
    kaderIds: [ka],
    ohneKader: true,
    jahrgaenge: [2016],
    linkStaende: ["abgeholt", "offen"],
  });
  // Bereinigen: entfernte oder fremde Kader, Jahrgänge, die niemand trägt, «ohne» bei einem Team ohne Kader.
  const bestand = { kader: [{ id: ka }, { id: kb }], jahrgaenge: jahrgaengeDerListe(liste) };
  const roh = liesTeamEingrenzung({ kader: `${kx},${ka},${OHNE_KADER_WERT}`, jahrgang: "2014,2016" });
  const sauber = bereinigeTeamEingrenzung(roh, bestand);
  assert.deepEqual(sauber.kaderIds, [ka]);
  assert.deepEqual(sauber.jahrgaenge, [2016]);
  assert.deepEqual(kaderFilterWerte(sauber), [OHNE_KADER_WERT, ka], "so, wie AuswahlFilter und ?kader= sie führen");
  assert.equal(bereinigeTeamEingrenzung(liesTeamEingrenzung({ kader: OHNE_KADER_WERT }), { kader: [], jahrgaenge: [] }).ohneKader, false);
  // Leere Liste: Die Leiste fehlt, also fällt auch Suche und Link-Stand weg (sonst unsichtbar).
  const leerSp = { q: "lea", link: "offen", fremd: "1" };
  const leerE = bereinigeTeamEingrenzung(liesTeamEingrenzung(leerSp), { kader: [], jahrgaenge: [] });
  assert.deepEqual([leerE.suche, leerE.linkStaende], ["", []]);
  assert.equal(bereinigteTeamAdresse("/t", leerSp, leerE), "/t?fremd=1");
  assert.equal(bereinigteTeamAdresse("/t", { q: "   " }, liesTeamEingrenzung({ q: "   " })), "/t", "leere Suche fällt aus der Adresse");
  // Die Adresse: einmal weiterleiten, q und Fremdes reisen mit; die bereinigte bleibt stehen.
  const P = "/team/x/verwaltung";
  const sp = { q: "lea", kader: `${kx},${ka},${OHNE_KADER_WERT}`, jahrgang: "2016,2014", link: "offen,abgeholt" };
  const ziel = bereinigteTeamAdresse(P, sp, bereinigeTeamEingrenzung(liesTeamEingrenzung(sp), bestand));
  assert.equal(ziel, `${P}?q=lea&kader=${OHNE_KADER_WERT}%2C${ka}&jahrgang=2016&link=abgeholt%2Coffen`);
  const zurueck = Object.fromEntries(new URL(ziel!, "http://x").searchParams);
  assert.equal(bereinigteTeamAdresse(P, zurueck, bereinigeTeamEingrenzung(liesTeamEingrenzung(zurueck), bestand)), null);
  for (const r of [{}, { q: "x" }, { kader: [OHNE_KADER_WERT, ka] }, { jahrgang: "2015,2016" }, { link: "zugestellt,offen" }])
    assert.equal(bereinigteTeamAdresse(P, r, bereinigeTeamEingrenzung(liesTeamEingrenzung(r), bestand)), null, JSON.stringify(r));
  assert.equal(bereinigteTeamAdresse(P, { kader: kx, link: "kaputt" }, bereinigeTeamEingrenzung(liesTeamEingrenzung({ kader: kx }), bestand)), P, "nichts übrig: die nackte Seite");
  // AK 9: Die Reiter tragen genau diese Schlüssel weiter.
  assert.deepEqual(Object.keys(sp).sort(), [...FILTER_SCHLUESSEL].sort());
  // AK 10: Zugeteilt wird nur, wer ausgewählt und sichtbar ist.
  const sichtbar = filtereSpieler(liste, liesTeamEingrenzung({ jahrgang: "2016" }));
  assert.deepEqual(sichtbareAuswahl(["ole", "mia", "lea", "weg"], sichtbar), ["mia", "lea"]);
  const quelle = (d: string) => readFileSync(join(web, d), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const listeQuelle = quelle("components/team/SpielerListe.tsx");
  assert.match(listeQuelle, /const gewaehlt = sichtbareAuswahl\(auswahl, sichtbar\)/, "die Auswahl schneidet auf die sichtbaren");
  assert.match(listeQuelle, /auswahl=\{gewaehlt\}/, "Kader zuteilen bekommt nur die sichtbare Auswahl");
  assert.ok(!/KaderChips/.test(listeQuelle), "die Spielerliste hat keine Kader-Chips mehr (ein Chip zur Zeit gilt nur am Termin)");
  // Dieselben Bausteine wie die Leiste des Vereins, kein neues Muster.
  const leiste = quelle("components/team/TeamSpielerFilter.tsx");
  for (const b of ["FilterSuche", "AuswahlFilter", "useAdressFilter", "zuruecksetzen"]) assert.ok(leiste.includes(b), `TeamSpielerFilter nutzt ${b}`);
  assert.match(quelle("app/(app)/team/[id]/verwaltung/page.tsx"), /bereinigteTeamAdresse\(/, "die Seite leitet auf die bereinigte Adresse weiter");
});

pruefe("Stand der Links im Team überblicken: Zahlen je Stand, Sprung auf die offenen (#658)", () => {
  const T = "11111111-1111-4111-8111-111111111111";
  // AK 1: je Stand gezählt, über alle Zeilen; ein leeres Team hat überall null.
  const staende: LinkStand[] = ["abgeholt", "offen", "zugestellt", "offen", "abgeholt", "offen"];
  assert.deepEqual(zaehleLinkStaende(staende.map((linkStand) => ({ linkStand }))), { abgeholt: 2, zugestellt: 1, offen: 3 });
  assert.deepEqual(zaehleLinkStaende([]), { abgeholt: 0, zugestellt: 0, offen: 0 });
  assert.deepEqual(Object.keys(LINK_UEBERSICHT.beschreibung), [...LINK_STAENDE]);
  // AK 2: der Sprung führt auf die Spielerliste, eingegrenzt auf «offen» — in der
  // Schreibweise der Leiste, die Seite leitet also nicht noch einmal weiter.
  const ziel = teamSpielerHref(T, { linkStaende: ["offen"] });
  assert.equal(ziel, `/team/${T}/verwaltung?link=offen`);
  const sp = Object.fromEntries(new URL(ziel, "http://x").searchParams);
  assert.deepEqual(filtereSpieler(
    staende.map((linkStand, i) => ({ vorname: `V${i}`, nachname: "N", jsNummer: null, jahrgang: 2016, kaderIds: [], linkStand })),
    liesTeamEingrenzung(sp),
  ).map((s) => s.linkStand), ["offen", "offen", "offen"]);
  assert.equal(bereinigteTeamAdresse(`/team/${T}/verwaltung`, sp, liesTeamEingrenzung(sp)), null);
  assert.equal(teamSpielerHref(T), `/team/${T}/verwaltung`);
  assert.equal(teamSpielerHref(T, { linkStaende: ["offen", "abgeholt"], jahrgaenge: [2016] }), `/team/${T}/verwaltung?jahrgang=2016&link=abgeholt%2Coffen`);
  // Die Übersicht steht im Bereich «Privater Link», gezählt über die ganze
  // Spielerliste (samt Schnuppernden), und springt über teamSpielerHref.
  const quelle = (d: string) => readFileSync(join(web, d), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const seite = quelle("app/(app)/team/[id]/verwaltung/link/page.tsx");
  assert.match(seite, /<LinkUebersicht teamId=\{id\} spieler=\{liste\.wert\.spieler\} \/>/);
  assert.match(seite, /ladeSpielerliste\(/);
  const karte = quelle("components/team/LinkUebersicht.tsx");
  assert.match(karte, /teamSpielerHref\(teamId, \{ linkStaende: \["offen"\] \}\)/);
  assert.match(karte, /zaehleLinkStaende\(spieler\)/);
});

pruefe("Kader am privaten Link ausgeblendet; die Kader-Karte sagt, dass nur das Team sie sieht (#663 AK 1, 2)", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // AK 1: Keine Datei des privaten Links zeigt Kader-Plaketten, der Typ trägt keine Kader.
  for (const d of quelldateien(join(web, "components/privat")))
    assert.ok(!/KaderLozenge/.test(readFileSync(d, "utf8")), `${relative(web, d)} zeigt keine Kader`);
  assert.ok(!/^\s*kader\s*:/m.test(lies("lib/privater-link.ts")), "LinkTermin trägt keine Kader");
  // AK 1, Datenebene: die jüngste Fassung von spieler_link_ansicht liefert keine Kadernamen
  // (Platzhalter `[]` bis N1), filtert die Termine aber weiter über die Kader (OoS 1).
  const ordner = join(web, "../supabase/migrations");
  const juengste = readdirSync(ordner)
    .filter((d) => d.endsWith(".sql") && /create or replace function spieler_link_ansicht\(/.test(readFileSync(join(ordner, d), "utf8")))
    .sort()
    .at(-1)!;
  const rumpf = readFileSync(join(ordner, juengste), "utf8");
  assert.match(rumpf, /'kader', '\[\]'::jsonb\)/, `${juengste}: kader als leere Liste`);
  assert.ok(!/jsonb_agg\(k\.name/.test(rumpf), `${juengste}: keine Kadernamen`);
  assert.match(rumpf, /termin_gilt_fuer\(t\.id, s\.id\)/, `${juengste}: Termine weiter nur, wenn sie für sie gelten`);
  // AK 2: die Karte zeigt den Satz immer, nicht nur mit Kadern; der Namenshinweis widerspricht nicht.
  assert.match(KADER_TEXT.sichtbarkeit, /^Kader sieht nur das Team\. Am privaten Link erscheinen sie nicht/);
  assert.ok(!/Eltern sehen/.test(KADER_TEXT.heikel));
  const karte = lies("components/team/KaderKarte.tsx");
  assert.ok(karte.indexOf("KADER_TEXT.sichtbarkeit") < karte.indexOf("kader.length > 0 ?"), "vor der Unterscheidung mit/ohne Kader");
});

pruefe("Kader: verfallende Abmeldungen - Zahl aus der Datenebene, Texte (#453 AK 10, 12, 16)", () => {
  assert.equal(verfallAusFehler(`${VERFALL_MARKER} 3`), 3);
  assert.equal(verfallAusFehler("KADER_DOPPELT"), null);
  assert.equal(
    kaderVerfallText(1),
    "Damit verfällt 1 Abmeldung: Der Termin gilt für diese Spieler:in nicht mehr. Gilt er später wieder für sie, ist sie angemeldet.",
  );
  assert.ok(kaderVerfallText(2).startsWith("Damit verfallen 2 Abmeldungen:"));
  assert.ok(kaderVerfallGeaendert(4).endsWith(kaderVerfallText(4)));
  assert.ok(kaderVerfallBestaetigen(2).startsWith(kaderVerfallText(2)) && kaderVerfallBestaetigen(2).includes("«bestaetigt: true»"));
});

pruefe("Termine für Kader: für wie viele er gilt, die übrigen, ehemalige zuletzt (#453 AK 5-8)", () => {
  const kader = [
    { id: "a", name: "S1", spielerIds: ["l", "m"] },
    { id: "b", name: "S2", spielerIds: ["m", "n"] },
    { id: "c", name: "Leer", spielerIds: [] },
  ];
  assert.equal(giltFuerAnzahl([], kader, 4), 4, "ohne Kader für alle");
  assert.equal(giltFuerAnzahl(["a", "b"], kader, 4), 3, "mindestens einem angehören, jede einmal");
  assert.equal(giltFuerText([], kader, 4), "Gilt für alle 4 Spieler:innen.");
  assert.equal(giltFuerText(["a"], kader, 4), "Gilt für 2 von 4 Spieler:innen.");
  assert.equal(giltFuerText(["c"], kader, 4), "Gilt für niemanden: Diesen Kadern gehört keine Spieler:in an.");
  assert.equal(uebrigeText(0), null);
  assert.equal(uebrigeText(7), "Für die übrigen 7 Spieler:innen des Teams gilt der Termin nicht.");
  assert.deepEqual(
    nachTerminKader([{ id: null, name: null }, { id: "b", name: "S2" }, { id: "a", name: "Aushilfe" }]).map((k) => k.name),
    ["Aushilfe", "S2", null],
  );
  assert.equal(abweisungText("gilt_nicht"), ABMELDUNG_TEXT.giltNicht);
  assert.ok(KONFLIKT_MARKER.includes("SERIE_VERFALL_GEAENDERT"), "eine geänderte Zahl ist veraltet, keine Regel");
  assert.equal(still(() => ausDbFehler({ message: "KADER_TERMIN_BEGONNEN" })).meldung, KADER_MELDUNG.KADER_TERMIN_BEGONNEN);
});

pruefe("Spiele: Bezeichnung, Richtwert, Bewertung und Marker (#459, #463 AK 7/28/29)", () => {
  assert.equal(bezeichnungProblem("  Cup gegen FC Köniz "), null);
  assert.equal(bezeichnungProblem("   ")?.text, SPIEL_TEXT.bezeichnung);
  assert.equal(bezeichnungProblem(null)?.text, SPIEL_TEXT.bezeichnung);
  assert.equal(bezeichnungProblem("x".repeat(BEZEICHNUNG_MAX)), null);
  assert.equal(bezeichnungProblem("x".repeat(BEZEICHNUNG_MAX + 1))?.text, SPIEL_TEXT.bezeichnungLang);
  // In Code Points gezählt wie Postgres `char_length`.
  assert.equal(bezeichnungProblem("⚽".repeat(BEZEICHNUNG_MAX)), null);

  assert.equal(richtwertProblem(null, null), null);
  assert.equal(richtwertProblem(9, null), null);
  assert.equal(richtwertProblem(null, 12), null);
  assert.equal(richtwertProblem(9, 9), null, "gleich gross ist erlaubt");
  assert.deepEqual(richtwertProblem(0, 12), { feld: "mindestzahl", text: SPIEL_TEXT.richtwert });
  assert.deepEqual(richtwertProblem(9, 201), { feld: "hoechstzahl", text: SPIEL_TEXT.richtwert });
  assert.deepEqual(richtwertProblem(9.5, null), { feld: "mindestzahl", text: SPIEL_TEXT.richtwert });
  assert.deepEqual(richtwertProblem(12, 9), { feld: "mindestzahl", text: SPIEL_TEXT.richtwertReihenfolge });

  assert.equal(richtwertText(9, 12), "9 bis 12");
  assert.equal(richtwertText(9, 9), "9");
  assert.equal(richtwertText(9, null), "mindestens 9");
  assert.equal(richtwertText(null, 12), "höchstens 12");
  assert.equal(richtwertText(null, null), null);

  // Die Bewertung: unter, knapp (genau die Mindestzahl, auch bei Min = Max),
  // im Richtwert (bis und mit Höchstzahl), über; nur gegen gesetzte Grenzen.
  assert.equal(richtwertStufe(7, 9, 12), "unter");
  assert.equal(richtwertStufe(9, 9, 12), "knapp");
  assert.equal(richtwertStufe(10, 9, 12), "im");
  assert.equal(richtwertStufe(12, 9, 12), "im", "die Höchstzahl erreicht ist im Richtwert");
  assert.equal(richtwertStufe(13, 9, 12), "ueber");
  assert.equal(richtwertStufe(11, 11, 11), "knapp");
  assert.equal(richtwertStufe(12, 11, 11), "ueber");
  assert.equal(richtwertStufe(30, 9, null), "im", "ohne Höchstzahl nie zu viele");
  assert.equal(richtwertStufe(0, null, 12), "im", "ohne Mindestzahl nie zu wenige");
  assert.equal(richtwertStufe(13, null, 12), "ueber");
  assert.equal(richtwertStufe(5, null, null), null);
  assert.equal(richtwertStufeText(7, 9, 12), "noch 2 bis Mindestzahl 9");
  assert.equal(richtwertStufeText(9, 9, 12), "Mindestzahl 9 genau erreicht");
  assert.equal(richtwertStufeText(11, 9, 12), "Richtwert 9 bis 12");
  assert.equal(richtwertStufeText(30, 9, null), "Richtwert mindestens 9");
  assert.equal(richtwertStufeText(14, 9, 12), "2 über Höchstzahl 12");

  for (const [marker, satz] of Object.entries(SPIEL_MELDUNG)) assert.equal(fehlerMeldung(`x ${marker} y`), satz, marker);
  for (const [check, satz] of SPIEL_CHECKS)
    assert.equal(fehlerMeldung(`new row violates check constraint ${check}`), satz, check);
  // Kein Spiel-Marker steckt in einem anderen Marker des Kalenders.
  const alle = [...Object.keys(TERMIN_MELDUNG), ...Object.keys(SERIE_MELDUNG), ...Object.keys(SPIEL_MELDUNG)];
  for (const a of Object.keys(SPIEL_MELDUNG)) for (const b of alle) if (a !== b) assert.ok(!b.includes(a) && !a.includes(b), `${a} / ${b}`);
  assert.equal(abweisungText("ist_spiel"), SPIEL_TEXT.istSpiel);
});

pruefe("Spiele: Meldefrist als Abstand zum Anpfiff, Verfall- und Abweisungstexte (#463)", () => {
  // Wanduhr ohne Zeitzone: die Zeitumstellung (25.10.2026) verschiebt nichts.
  assert.equal(meldefristVorlauf("2026-10-25", "10:00", "2026-10-24T20:00"), 14 * 60);
  assert.equal(meldefristZeitpunkt("2026-10-25", "10:00", 14 * 60), "2026-10-24T20:00");
  assert.equal(meldefristZeitpunkt("2026-11-01", "09:30", 24 * 60), "2026-10-31T09:30");
  assert.equal(meldefristProblem("2026-10-25", "10:00", "2026-10-24T20:00"), null);
  assert.equal(meldefristProblem("2026-10-25", "10:00", "2026-10-25T10:00")?.text, SPIEL_TEXT.meldefrist, "nicht beim Anpfiff");
  assert.equal(meldefristProblem("2026-10-25", "10:00", "2025-10-24T10:00")?.text, SPIEL_TEXT.meldefrist, "höchstens ein Jahr");
  assert.equal(meldefristProblem("2026-10-25", "10:00", "morgen")?.text, SPIEL_TEXT.meldefristFormat);
  assert.equal(fristAbgelaufen(null, "2026-10-21T12:00"), false);
  assert.equal(fristAbgelaufen("2026-10-21T12:00", "2026-10-21T12:00"), true, "minutengenau wie termin_begonnen");
  // Verlegt: nur, wenn sie dadurch erst abläuft.
  const jetzt = "2026-10-21T12:00";
  assert.equal(fristWirdAbgelaufen({ datum: "2026-10-23", beginn: "10:00" }, { datum: "2026-10-22", beginn: "10:00" }, 24 * 60, jetzt), true);
  assert.equal(fristWirdAbgelaufen({ datum: "2026-10-23", beginn: "10:00" }, { datum: "2026-10-24", beginn: "10:00" }, 24 * 60, jetzt), false);
  assert.equal(fristWirdAbgelaufen({ datum: "2026-10-22", beginn: "10:00" }, { datum: "2026-10-22", beginn: "08:00" }, 24 * 60, jetzt), false, "war schon vorbei");
  assert.equal(fristWirdAbgelaufen({ datum: "2026-10-23", beginn: "10:00" }, { datum: "2026-10-22", beginn: "10:00" }, null, jetzt), false);

  assert.equal(spielVerfallText(1, false), "Damit verfällt 1 Meldung: Die Spieler:in ist wieder ohne Meldung.");
  assert.ok(spielVerfallText(3, true).startsWith("Damit verfallen 3 Meldungen") && spielVerfallText(3, true).includes("Meldefrist"));
  assert.equal(spielVerfallText(0, false), "");
  assert.equal(spielEntfernenText(2), "Damit verschwinden 2 Meldungen.");
  assert.equal(meldungAbweisungText("frist_abgelaufen"), MELDUNG_TEXT.fristAbgelaufen);
  assert.ok(meldungAbweisungText("verlegt", { datum: "2026-10-31", beginn: "10:00", ende: "11:00", ausgefallen: false }).includes("10:00"));

  // Kader (#463 AK 14): Meldungen zu Spielen eigens genannt.
  assert.equal(verfallAusFehler("ABMELDUNGEN_VERFALLEN 3 1"), 3);
  assert.equal(verfallSpieleAusFehler("ABMELDUNGEN_VERFALLEN 3 1"), 1);
  assert.equal(verfallSpieleAusFehler("ABMELDUNGEN_VERFALLEN 3"), 0);
  assert.equal(kaderVerfallText(2), kaderVerfallText(2, 0), "ohne Spiele der bisherige Satz");
  assert.ok(kaderVerfallText(3, 1).startsWith("Damit verfallen 2 Abmeldungen zu Trainings und 1 Meldung zu einem Spiel"));
  assert.ok(kaderVerfallText(1, 1).startsWith("Damit verfällt 1 Meldung zu einem Spiel"));
});

pruefe("Spiele: Treffpunkte prüfen, als Abstand zum Anpfiff führen und anzeigen (#465)", () => {
  const ok = treffpunkteNormal(
    [
      { anreise: "oev", zeitpunkt: "2026-10-30T18:00", ort: " Bahnhof " },
      { anreise: "vor_ort", zeitpunkt: "2026-10-31T10:15" },
    ],
    "2026-10-31",
    "10:00",
  );
  assert.deepEqual(ok, {
    ok: true,
    zeilen: [
      { anreise: "oev", vorlauf_min: 16 * 60, ort: "Bahnhof" },
      { anreise: "vor_ort", vorlauf_min: -15, ort: null },
    ],
  }, "AK 5: Vortag und nach dem Anpfiff");
  const problem = (liste: { anreise: unknown; zeitpunkt: unknown; ort?: unknown }[]) => {
    const r = treffpunkteNormal(liste, "2026-10-31", "10:00");
    return r.ok ? null : r.problem;
  };
  assert.deepEqual(problem([{ anreise: "zug", zeitpunkt: "2026-10-31T09:00" }]), { feld: "treffpunkte", index: 0, text: TREFFPUNKT_TEXT.anreise });
  assert.equal(problem([{ anreise: "auto", zeitpunkt: "2026-10-31T09:00", ort: "  " }])?.text, TREFFPUNKT_TEXT.ort);
  assert.equal(problem([{ anreise: "vor_ort", zeitpunkt: "2026-10-31T09:00", ort: "Platz" }])?.text, TREFFPUNKT_TEXT.ortVorOrt);
  assert.equal(problem([{ anreise: "velo", zeitpunkt: "2026-10-31T09:00", ort: "ä".repeat(101) }])?.text, TREFFPUNKT_TEXT.ortLang);
  assert.equal(problem([{ anreise: "velo", zeitpunkt: "2026-10-31T09:00", ort: "ä".repeat(100) }]), null, "100 Zeichen in Code Points");
  assert.equal(problem([{ anreise: "car", zeitpunkt: "2025-10-30T09:00", ort: "X" }])?.text, TREFFPUNKT_TEXT.zeitpunktWeit);
  assert.equal(problem([{ anreise: "car", zeitpunkt: "31.10. 9 Uhr", ort: "X" }])?.text, TREFFPUNKT_TEXT.zeitpunkt);
  assert.deepEqual(
    problem([
      { anreise: "car", zeitpunkt: "2026-10-31T08:00", ort: "X" },
      { anreise: "car", zeitpunkt: "2026-10-31T08:30", ort: "Y" },
    ]),
    { feld: "treffpunkte", index: 1, text: TREFFPUNKT_TEXT.doppelt },
  );
  const sechs = ["vor_ort", "oev", "auto", "velo", "car", "car"].map((anreise) => ({ anreise, zeitpunkt: "2026-10-31T08:00", ort: "X" }));
  assert.deepEqual(problem(sechs), { feld: "treffpunkte", index: null, text: TREFFPUNKT_TEXT.zuViele });

  // PC 2: verlegt, frühester zuerst, im selben Abstand — auch über den Tag.
  const zu = treffpunkteZu([{ anreise: "vor_ort", vorlauf_min: 30, ort: null }, { anreise: "oev", vorlauf_min: 120, ort: "Bahnhof" }], "2026-11-01", "01:00");
  assert.deepEqual(zu, [
    { anreise: "oev", zeitpunkt: "2026-10-31T23:00", ort: "Bahnhof" },
    { anreise: "vor_ort", zeitpunkt: "2026-11-01T00:30", ort: null },
  ]);
  // AK 8, PC 1: Datum nur ausserhalb des Spieltags; vor Ort mit dem Ort des Spiels oder nur der Zeit.
  assert.deepEqual(treffpunktAnzeige(zu[1], "2026-11-01", "Bodenweid"), { anreise: "vor Ort", zeit: "00:30", ort: "Bodenweid" });
  assert.deepEqual(treffpunktAnzeige(zu[1], "2026-11-01", null), { anreise: "vor Ort", zeit: "00:30", ort: null });
  const amVortag = treffpunktAnzeige(zu[0], "2026-11-01", "Bodenweid");
  assert.deepEqual([amVortag.anreise, amVortag.ort], ["öV", "Bahnhof"]);
  assert.ok(amVortag.zeit.endsWith("31.10., 23:00"), amVortag.zeit);
});

pruefe("Spiele: nicht aufbieten - Abweisung, Verfall- und Entfernen-Texte, Kader-Marker (#464)", () => {
  assert.equal(meldungAbweisungText("nicht_aufgeboten"), MELDUNG_TEXT.nichtAufgeboten);
  assert.equal(spielVerfallText(0, false, 1), "Damit verfällt 1 Kennzeichnung als nicht aufgeboten.");
  assert.equal(
    spielVerfallText(9, false, 2),
    "Damit verfallen 9 Meldungen: Diese Spieler:innen sind wieder ohne Meldung. Ausserdem verfallen 2 Kennzeichnungen als nicht aufgeboten.",
  );
  assert.equal(spielEntfernenText(11, 2), "Damit verschwinden 11 Meldungen und 2 Kennzeichnungen als nicht aufgeboten.");
  assert.equal(spielEntfernenText(0, 1), "Damit verschwindet 1 Kennzeichnung als nicht aufgeboten.");
  assert.equal(spielEntfernenText(2), "Damit verschwinden 2 Meldungen.", "ohne Kennzeichnung wie bisher");
  assert.equal(verfallKennzeichnungenAusFehler("ABMELDUNGEN_VERFALLEN 4 1 1"), 1);
  assert.equal(verfallKennzeichnungenAusFehler("ABMELDUNGEN_VERFALLEN 4 1"), 0);
  assert.ok(kaderVerfallText(4, 1, 1).startsWith("Damit verfallen 2 Abmeldungen zu Trainings, 1 Meldung zu einem Spiel und 1 Kennzeichnung als nicht aufgeboten:"));
  assert.ok(kaderVerfallText(1, 0, 1).startsWith("Damit verfällt 1 Kennzeichnung als nicht aufgeboten:"));
  assert.equal(AUFGEBOT_TEXT.eltern("Mia"), "Mia ist für dieses Spiel nicht aufgeboten. Fragen dazu ans Team.");
});

pruefe("Spiele: Nachtrag - wer beim Anpfiff zählte, Verfall-Text (#487)", () => {
  assert.equal(zaehlteBeimAnpfiff("angemeldet", false), true);
  assert.equal(zaehlteBeimAnpfiff("angemeldet", true), false, "nicht aufgeboten zählt nicht");
  assert.equal(zaehlteBeimAnpfiff("abgemeldet", false), false);
  assert.equal(zaehlteBeimAnpfiff(null, false), false);
  assert.equal(spielVerfallText(0, false, 0, 1), "Damit verfällt 1 Nachtrag zur Anwesenheit.");
  assert.equal(
    spielVerfallText(2, false, 1, 3),
    "Damit verfallen 2 Meldungen: Diese Spieler:innen sind wieder ohne Meldung. Ausserdem verfallen 1 Kennzeichnung als nicht aufgeboten und 3 Nachträge zur Anwesenheit.",
  );
  assert.equal(NACHTRAG_TEXT.zurueck, "Nachtrag zurücknehmen");
});

pruefe("Schnuppertraining: Anzahl, Plakette, Stand am Link, Hinweis über der Anzahl (#555 AK 2, 6, 7, 11, 12; PC 13; #584 AK 1)", () => {
  for (const n of [0, 21, 1.5, -1, null, undefined, Number.NaN]) assert.equal(probeAnzahlProblem(n as number), PROBE_TEXT.anzahlProblem, String(n));
  for (const n of [1, 4, 20]) assert.equal(probeAnzahlProblem(n), null);
  const stand = { anzahl: 4, besucht: 1, angemeldet: 2, moeglich: 1 };
  assert.equal(probeKurz(stand), "Schnuppern 1/4", "besuchte von der Anzahl, ohne Angemeldete");
  assert.equal(probeLang(stand), "Schnuppern: 1 von 4 Schnuppertrainings besucht");
  assert.equal(probeKurz({ ...stand, anzahl: null }), "Schnuppern");
  assert.equal(probeLang({ anzahl: null, besucht: 0 }), "Schnuppert");
  // Die Verwaltung kennt nur Anzahl und besuchte: Das genügt der Plakette.
  assert.equal(probeKurz({ anzahl: 4, besucht: 0 }), "Schnuppern 0/4");
  assert.equal(linkProbeZaehler(stand), "Noch 1 von 4 Schnuppertrainings möglich");
  assert.equal(linkProbeZaehler({ ...stand, angemeldet: 3, moeglich: 0 }), "Alle 4 Schnuppertrainings vergeben");
  // Bei einem Schnuppertraining kein «Alle 1 Schnuppertrainings».
  const eins = { anzahl: 1, besucht: 0, angemeldet: 0, moeglich: 1 };
  assert.equal(linkProbeZaehler(eins), "Noch 1 von 1 Schnuppertraining möglich");
  assert.equal(linkProbeZaehler({ ...eins, angemeldet: 1, moeglich: 0 }), "Das Schnuppertraining ist vergeben");
  assert.ok(linkProbeVoll("Mia", { ...eins, angemeldet: 1, moeglich: 0 }).startsWith("Das Schnuppertraining ist vergeben. Meldest du Mia"));
  assert.ok(linkProbeVoll("Mia", stand).startsWith("Alle 4 Schnuppertrainings sind vergeben. Meldest du Mia"));
  assert.equal(
    linkProbeVoll("Mia", { anzahl: 4, besucht: 4, angemeldet: 0, moeglich: 0 }),
    "Alle 4 Schnuppertrainings sind vergeben. Für weitere Trainings wende dich an das Team.",
    "alles besucht: nichts abzumelden",
  );
  assert.equal(linkProbeKopf("Mia"), "Mia schnuppert. Melde Mia für die Trainings an, an denen Mia teilnimmt, und bis zum Beginn wieder ab.");
  // Zusatzentscheid PO 2026-10-29: über der Anzahl ein Hinweis, kein Verbot.
  assert.equal(ueberAnzahl(stand), false);
  assert.equal(ueberAnzahl({ ...stand, angemeldet: 3 }), false, "genau die Anzahl");
  assert.equal(ueberAnzahl({ ...stand, angemeldet: 4, moeglich: 0 }), true);
  assert.equal(ueberAnzahl(null), false);
  assert.equal(
    ueberAnzahlText("Mia Keller", { ...stand, angemeldet: 4, moeglich: 0 }),
    "Mia Keller ist damit über der Anzahl Schnuppertrainings: 1 besucht und 4 angemeldet, vorgesehen sind 4.",
  );
});

pruefe("Schnuppertraining: Einschalten - Bedeutung, Verfall aus der Datenebene, Texte (#555 AK 5, 16)", () => {
  assert.equal(probeEinschaltenText("Mia", 4), "Mia meldet sich selbst für Trainings an, höchstens für 4. Spiele sieht Mia nicht.");
  assert.deepEqual(probeFolgenAusFehler(`${PROBE_VERFALL_MARKER} 4 2 1 1`), { abmeldungen: 2, meldungen: 1, kennzeichnungen: 1 });
  assert.equal(probeFolgenAusFehler("PROBE_ANZAHL_FEHLT"), null);
  assert.equal(probeVerfallTitel({ abmeldungen: 1, meldungen: 0, kennzeichnungen: 0 }), "Damit verfällt 1 Abmeldung von einem Training");
  assert.equal(
    probeVerfallTitel({ abmeldungen: 2, meldungen: 1, kennzeichnungen: 1 }),
    "Damit verfallen 2 Abmeldungen von Trainings, 1 Meldung zu einem Spiel und 1 Kennzeichnung als nicht aufgeboten",
  );
  const f = { abmeldungen: 2, meldungen: 0, kennzeichnungen: 0 };
  assert.ok(probeVerfallText("Mia", f).endsWith("Mia ist danach an allen kommenden Trainings nicht angemeldet."));
  assert.ok(probeVerfallBestaetigen("Mia", f).includes("«bestaetigt: true»"));
  // Der Kader- und Verlegen-Marker trägt verfallende Anmeldungen als vierte Zahl (#555 AK 14).
  assert.equal(verfallAnmeldungenAusFehler(`${VERFALL_MARKER} 3 0 0 1`), 1);
  assert.equal(verfallAnmeldungenAusFehler(`${VERFALL_MARKER} 3`), 0);
});

pruefe("Schnuppertraining: Link-Abweisung, verfallene Anmeldung, Abo «vielleicht» (#555 AK 12; PC 5, 11)", () => {
  assert.equal(abweisungText("probe_voll"), ABMELDUNG_TEXT.probeVoll);
  assert.equal(ABMELDUNG_TEXT.probeVoll, "Alle Schnuppertrainings sind vergeben. Meldest du von einem anderen Training ab, wird ein Platz frei. Für weitere Trainings wende dich an das Team.");
  assert.equal(verfallenHinweis({ datum: "2026-11-09", beginn: "17:30", anmeldung: true }), "Verlegt, vorher Montag, 9. November um 17:30. Deine Anmeldung gilt nicht mehr.");
  assert.ok(verfallenHinweis({ datum: "2026-11-09", beginn: "17:30" }).endsWith("Deine Abmeldung gilt nicht mehr."));
  assert.equal(aboStatus(feedTermin({ id: "a", abgemeldet: true }), true), "vielleicht", "nicht angemeldet");
  assert.equal(aboStatus(feedTermin({ id: "a" }), true), "zugesagt");
});

pruefe("Schnuppern (#584 AK 1, 4, 6, 7, 13, 15): Sätze für Team-Ort, Link und KI wortgleich", () => {
  // AK 1: der Begriff in der ganzen Einstellung.
  assert.equal(PROBE_TEXT.titel, "Schnuppertraining");
  assert.equal(PROBE_TEXT.imProbeModus, "Schnuppert");
  assert.equal(PROBE_TEXT.checkbox, "Schnuppert");
  assert.equal(PROBE_TEXT.einschalten, "Schnuppern einschalten");
  assert.equal(PROBE_TEXT.imProbeModusZahl(1), "1 Spieler:in schnuppert");
  assert.equal(PROBE_TEXT.imProbeModusZahl(3), "3 Spieler:innen schnuppern");
  assert.equal(PROBE_TEXT.linkInfoTitel, "Infos zum Schnuppertraining");
  assert.equal(PROBE_TEXT.vergeben, "Schnuppertrainings vergeben");
  assert.equal(PROBE_TEXT.festgelegt, "Schnuppertraining gespeichert.");
  // AK 4: unter dem Titel steht, für wen es gedacht ist.
  assert.ok(PROBE_TEXT.karte.startsWith("Für Spieler:innen, die den Verein ausprobieren."), PROBE_TEXT.karte);
  // AK 6, 7, 15: dieselben Sätze in Oberfläche und KI.
  assert.equal(PROBE_TEXT.mehrereTeams, "Diese Spieler:in ist weiteren Teams zugeordnet und macht darum regulär in deinem Team mit.");
  assert.equal(PROBE_TEXT.keinWeiteresTeam, "Solange die Spieler:in schnuppert, lässt sie sich keinem weiteren Team zuordnen.");
  assert.equal(PROBE_MELDUNG.SCHNUPPERN_MEHRERE_TEAMS, PROBE_TEXT.mehrereTeams);
  assert.equal(fachlicheMeldung("SCHNUPPERN_MEHRERE_TEAMS"), PROBE_TEXT.mehrereTeams, "die KI sagt, was die Anwendung sagt");
  assert.equal(
    PROBE_MELDUNG.SPIELER_SCHNUPPERT,
    "Diese Spieler:in schnuppert in einem anderen Team. Dort beendet zuerst ein Mitglied das Schnuppern, oder sie wird aus dem Team genommen.",
  );
  assert.equal(PROBE_MELDUNG.SCHNUPPERN_NUR_EINZELN, "Zum Schnuppern lässt sich nur eine Spieler:in zuordnen.");
  // Was das Einschalten und Ausschalten bedeutet.
  assert.ok(probeAusschaltenText("Mia").endsWith("Schaltest du das Schnuppern später wieder ein, zählt es wieder ab null."));
  // Das Verfallen einer Anmeldung nennt schnuppernde Spieler:innen.
  assert.equal(mitAnmeldungen("", 1), "Damit verfällt 1 Anmeldung einer schnuppernden Spieler:in: Sie gilt wieder als nicht angemeldet.");
  assert.equal(mitAnmeldungen("", 2), "Damit verfallen 2 Anmeldungen von schnuppernden Spieler:innen: Sie gelten wieder als nicht angemeldet.");
  // AK 13: Herausnehmen beendet das Schnuppern samt Zählung (Bedingung kommt aus `spieler_teams`).
  assert.ok(
    herausnehmenSaetze({ vorname: "Noah", nachname: "Keller", team: "Da Junioren", verein: null, verbleibend: [], probe: true }).warnung.startsWith(
      "Das Schnuppertraining endet samt Zählung;",
    ),
  );
  // Der Zugang nennt das Schnuppertraining wie die Werkzeuge (PC 4: ohne neue Zustimmung).
  const umfang = readFileSync(join(web, "lib/mcp/umfang.ts"), "utf8");
  assert.ok(umfang.includes("ins Schnuppertraining nehmen und die Anzahl Schnuppertrainings samt Info-Schreiben festlegen"));
});

pruefe("Info-Schreiben: bereinigt wie die Datenebene, höchstens 2000 Zeichen als Codepunkte (#556 AK 1, 2; PC 2)", () => {
  assert.equal(probeInfoBereinigt("  \r\nHallo\r\n\r\nWelt \n "), "Hallo\n\nWelt", "Umbrüche bleiben, Rand fällt");
  assert.equal(probeInfoBereinigt(" \n\t "), null, "leer = keines");
  assert.equal(probeInfoBereinigt(null), null);
  assert.equal(PROBE_INFO_MAX, 2000);
  assert.equal(probeInfoProblem("x".repeat(2000)), null);
  assert.equal(probeInfoProblem("x".repeat(2001)), PROBE_TEXT.infoZuLang);
  assert.equal(probeInfoLaenge("⚽".repeat(3)), 3, "ein Emoji ist ein Zeichen wie in char_length");
  assert.equal(probeInfoProblem("⚽".repeat(2000)), null);
  assert.equal(probeInfoProblem(`  ${"x".repeat(2000)}  `), null, "Rand zählt nicht");
});

pruefe("Info-Schreiben: Webadressen werden Links, der Rest bleibt Text (#556 AK 5)", () => {
  const ganz = (t: string) => textMitLinks(t).map((x) => x.text).join("");
  const links = (t: string) => textMitLinks(t).filter((x) => x.art === "link").map((x) => (x.art === "link" ? x.href : ""));
  const t = "Mehr: https://fc-beispiel.ch/junioren. Oder www.fc.ch, (siehe https://de.wikipedia.org/wiki/Fussball_(Sport)).";
  assert.equal(ganz(t), t, "die Teile ergeben den ganzen Text");
  assert.deepEqual(links(t), ["https://fc-beispiel.ch/junioren", "https://www.fc.ch", "https://de.wikipedia.org/wiki/Fussball_(Sport)"]);
  assert.deepEqual(links("javascript:alert(1) mailto:a@b.ch ftp://x.ch"), [], "andere Schemata bleiben Text");
  assert.deepEqual(links("www. und https://localhost"), [], "ohne Domain kein Link");
  assert.deepEqual(textMitLinks("Ohne Adresse"), [{ art: "text", text: "Ohne Adresse" }]);
  assert.deepEqual(links("Zeile1\nhttp://a.ch\nZeile3"), ["http://a.ch"]);
});

pruefe("Status einer Spieler:in und Meldefrist verpasst (#495, #496)", () => {
  assert.deepEqual(meldeStatus(null, false, false), { wort: "Ohne Meldung", appearance: "warning" });
  assert.deepEqual(meldeStatus(null, false, true), { wort: "Meldefrist verpasst", appearance: "danger" }, "nach der Frist");
  assert.equal(meldeStatus(null, true, true).wort, "Nicht aufgeboten", "die Kennzeichnung geht vor");
  assert.equal(meldeStatus("angemeldet", false, true).wort, "Angemeldet");
  assert.equal(meldeStatus("abgemeldet", false, false).appearance, "danger");
  assert.equal(meldefristVerpasst(null, false, true), true);
  assert.equal(meldefristVerpasst(null, false, false), false, "ohne oder vor der Frist nie");
  assert.equal(meldefristVerpasst(null, true, true), false);
  assert.equal(meldefristVerpasst("angemeldet", false, true), false);
});

pruefe("Treffpunkt eines Trainings: Regeln, Abstand, Änderung und Abo (#561)", () => {
  // AK 3, 5, 6: Uhrzeit und Ort Pflicht, am Termintag nicht nach dem Beginn, Ort höchstens 100.
  assert.equal(treffpunktProblem(null, "17:30"), null);
  assert.equal(treffpunktProblem({ zeit: "17:15", ort: "Garderoben" }, "17:30"), null);
  assert.equal(treffpunktProblem({ zeit: "17:30", ort: "Garderoben" }, "17:30"), null, "gleichzeitig ist erlaubt");
  assert.equal(treffpunktProblem({ zeit: "", ort: "Garderoben" }, "17:30")?.text, TERMIN_TEXT.treffpunktPflicht);
  assert.equal(treffpunktProblem({ zeit: "17:15", ort: "  " }, "17:30")?.text, TERMIN_TEXT.treffpunktPflicht);
  assert.equal(treffpunktProblem({ zeit: "17:45", ort: "Garderoben" }, "17:30")?.text, treffpunktNachBeginnText("17:30"));
  assert.equal(treffpunktProblem({ zeit: "17:15", ort: "x".repeat(100) }, "17:30"), null);
  assert.equal(treffpunktProblem({ zeit: "17:15", ort: "x".repeat(101) }, "17:30")?.feld, "treffpunkt");
  assert.equal(terminProblem({ datum: "2026-11-03", beginn: "17:30", ende: "19:00", treffpunkt: { zeit: "18:00", ort: "G" } })?.feld, "treffpunkt");
  // PC 1, 4: gespeichert ist der Abstand; am Vortag passt er nicht (Zwilling von treffpunkt_passt).
  assert.equal(treffpunktVorlauf("17:30", "17:15"), 15);
  assert.equal(treffpunktZeit("18:00", 15), "17:45");
  assert.equal(treffpunktZeit("00:10", 15), null);
  assert.equal(treffpunktPasst(15, "00:15"), true);
  assert.equal(treffpunktPasst(15, "00:10"), false);
  assert.equal(treffpunktPasst(null, "00:00"), true);
  // Der Dialog sendet ihn nur, wenn er sich gegenüber dem Beginn verschoben hat.
  const start = { datum: "2026-11-03", beginn: "17:30", ende: "19:00", treffpunkt: { zeit: "17:15", ort: "Garderoben" } };
  assert.equal(geaenderteFelder({ ...start, beginn: "18:00", ende: "19:30", treffpunkt: { zeit: "17:45", ort: "Garderoben" } }, start)?.treffpunkt, undefined);
  assert.deepEqual(geaenderteFelder({ ...start, treffpunkt: { zeit: "17:00", ort: "Garderoben" } }, start), { treffpunkt: { zeit: "17:00", ort: "Garderoben" } });
  assert.deepEqual(geaenderteFelder({ ...start, treffpunkt: null }, start), { treffpunkt: null });
  assert.equal(geaenderteFelder({ ...start, treffpunkt: undefined }, start), null);
  // Die CHECKs sagen dasselbe wie der Kern.
  const termin = (name: string) => `new row for relation "training_termine" violates check constraint "${name}"`;
  assert.equal(still(() => fehlerMeldung(termin("tt_treffpunkt_termintag"))), TERMIN_TEXT.treffpunktTermintag);
  assert.equal(still(() => fehlerMeldung(termin("tt_treffpunkt_art"))), TERMIN_TEXT.treffpunktNurTraining);
  // AK 13: im Abo wie am Link — nicht abgesagt, nicht nach Beginn; der Kartenlink gehört erkennbar zum Ort (AK 16).
  const training = feedTermin({ id: "t", treffpunkt: { zeit: "17:15", ort: "Garderoben Schulhaus Rain" }, hinweis_eltern: "Pincode 4702" });
  assert.equal(aboEintrag(training).beschreibung, "Zugesagt\n\nTreffpunkt\n17:15 · Garderoben Schulhaus Rain\n\nPincode 4702");
  assert.equal(aboEintrag({ ...training, abgemeldet: true }).beschreibung, "Abgesagt\n\nPincode 4702");
  assert.equal(aboEintrag({ ...training, begonnen: true }).beschreibung, "Zugesagt\n\nPincode 4702");
  assert.equal(
    aboEintrag({ ...training, abgemeldet: true }, true).beschreibung,
    "Vielleicht\n\nTreffpunkt\n17:15 · Garderoben Schulhaus Rain\n\nPincode 4702",
    "auf Probe nicht angemeldet sieht ihn",
  );
});

// ── Verein gründen (Story #587) ─────────────────────────────────────────────

pruefe("Verein gründen (#587 AK 1–5): Sätze des Dialogs und des Einstiegs, Marker mit eigenem Satz", () => {
  assert.equal(VEREIN_MELDUNG.SCHON_IM_VEREIN, "Du gehörst schon einem Verein an. Einen Verein gründen kann nur, wer keinem angehört.");
  assert.equal(VEREIN_MELDUNG.BESTAETIGUNG_FEHLT, "Bestätige zuerst, dass du für den Verein handeln darfst.");
  // Die Datenebene meldet mit Markern; der Kern liest sie als Regel, nicht als technischen Fehler.
  for (const marker of ["SCHON_IM_VEREIN", "BESTAETIGUNG_FEHLT", "ZUSTIMMUNG_FEHLT", "VEREINBARUNG_VERALTET"] as const) {
    assert.equal(fehlerMeldung(`x ${marker} y`), VEREIN_MELDUNG[marker]);
    assert.equal(still(() => ausDbFehler({ message: `ERROR: ${marker}` })).art, "regel", marker);
  }
  assert.deepEqual(VEREIN_GRUENDEN_TEXT, {
    titel: "Verein gründen",
    feld: "Name des Vereins",
    info: "Höchstens 60 Zeichen. Den Namen kannst du später ändern.",
    haken1: "Ich bin berechtigt, für diesen Verein zu handeln.",
    haken2: "Ich stimme für den Verein der Vereinbarung zur Auftragsbearbeitung zu.",
    lesen: "Vereinbarung lesen",
    erste: "Du wirst die erste Person der Vereinsverwaltung. Solange du dabei bist, kannst du keinem anderen Verein angehören.",
    knopf: "Verein gründen",
  });
  assert.ok(VEREIN_GRUENDEN_TEXT.info.includes(String(VEREIN_NAME_MAX)), "der Hinweis nennt die Grenze des CHECK");
  assert.equal(TEAMS_OHNE_VEREIN_TEXT.titel, "Willkommen bei KiFu");
  assert.equal(TEAMS_OHNE_VEREIN_TEXT.gruenden.knopf, "Verein gründen");
  for (const t of JSON.stringify(TEAMS_OHNE_VEREIN_TEXT).split('"')) assert.ok(!/FutAssist|Kind\b|Kinder/.test(t), `Produktname und Spieler:in: ${t}`);
  assert.ok(TEAMS_OHNE_VEREIN_TEXT.aufnahme.text.includes("E-Mail-Adresse"), "der Einstieg sagt, was man weitergibt");
});

pruefe("Verein gründen (#587): Antwort der Datenebene wird auf ihre Form geprüft", () => {
  const id = "4b3f9d0e-4c8a-4a39-9d57-0a8f2f7f1d11";
  assert.deepEqual(gruendungAus({ status: "gegruendet", id, name: "FC Wyler" }), { id, name: "FC Wyler" });
  for (const kaputt of [
    null,
    "gegruendet",
    [],
    {},
    { status: "gegruendet" },
    { status: "gegruendet", id, name: "" },
    { status: "gegruendet", id: 7, name: "FC Wyler" },
    { status: "gegruendet", id, name: 5 },
    { status: "abgewiesen", id, name: "FC Wyler" },
  ])
    assert.equal(gruendungAus(kaputt), null, JSON.stringify(kaputt));
});

pruefe("Verein gründen (#587): ein Weg — RPC nur im Verein-Kern, Einstieg liest den Verein ohne Fehlerschlucken, Dialog sperrt ohne beide Häkchen", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const rpc: string[] = [];
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei === fileURLToPath(import.meta.url) || rel === "scripts/pruefe-kern-db.ts") continue;
    if (/\.rpc\(\s*["`']verein_gruenden["`']/.test(readFileSync(datei, "utf8"))) rpc.push(rel);
  }
  assert.deepEqual(rpc, ["lib/kern/verein.ts"], "verein_gruenden nur im Verein-Kern");
  // «Kein Verein» ist sicher von «Fehler beim Laden» unterschieden: Einem Mitglied wird nie «Verein gründen» angeboten.
  const seite = lies("app/(app)/teams/page.tsx");
  assert.match(seite, /getMeinVereinOderWurf\(\)/, "/teams liest die Vereinslage mit Wurf");
  assert.ok(!/\bgetMeinVerein\(/.test(seite), "/teams nutzt nicht die tolerante Fassung");
  assert.match(seite, /if \(!verein\)[\s\S]*?<OhneVereinStart/, "ohne Verein der Einstieg");
  assert.ok(seite.lastIndexOf("TEAM_NUR_VERWALTUNG") > seite.indexOf("<OhneVereinStart"), "der Hinweis für Mitglieder steht erst nach dem Einstieg, nicht statt seiner");
  // Der Dialog: beide Häkchen, Knopf gesperrt ohne sie, fester Hinweis hinter ⓘ, Weiterleitung in der Action.
  const dialog = lies("components/verein/VereinGruenden.tsx");
  assert.match(dialog, /const frei = berechtigt && zugestimmt;/);
  assert.match(dialog, /disabled=\{!frei \|\| pending\}/, "Knopf gesperrt ohne beide Häkchen und während der Anfrage");
  assert.match(dialog, /info=\{VEREIN_GRUENDEN_TEXT\.info\}/, "fester Hinweis hinter ⓘ");
  assert.ok(!/router\.(push|replace)\(/.test(dialog), "die Weiterleitung steht in der Action");
  assert.match(lies("lib/actions/verein.ts"), /export async function gruendeVereinAktion[\s\S]*?redirect\("\/verein"\);/);
  // Die Seitenleiste lädt nach dem Gründen neu (Bereich «Verein»).
  assert.match(lies("lib/actions/verein.ts"), /gruendeVerein\(a\.supabase[\s\S]*?revalidiereMitgliedschaften\(\);[\s\S]*?redirect/);
});

// ── Verein löschen, Konto löschen (Story #587) ──────────────────────────────

pruefe("Verein löschen (#587 AK 10, 11): Sätze der Gefahrenzone und des Dialogs, Zahlen nur, wo es etwas gibt", () => {
  assert.equal(
    VEREIN_LOESCHEN_TEXT.beschreibung,
    "Austreten betrifft nur dich; in deinen Teams bleibst du Trainer:in. Verein löschen entfernt alle Teams und alle Spieler:innen samt Links und Abos; alle Personen werden Konten ohne Verein und behalten ihre eigenen Übungen und Trainings.",
  );
  assert.equal(VEREIN_LOESCHEN_TEXT.knopf, "Verein löschen");
  assert.equal(VEREIN_LOESCHEN_TEXT.endgueltig, "Das lässt sich nicht rückgängig machen.");
  assert.equal(vereinLoeschenTitel("FC Wyler"), "FC Wyler löschen");
  assert.equal(vereinGeloeschtText("FC Wyler"), "Der Verein «FC Wyler» ist gelöscht. Deine eigenen Übungen und Trainings bleiben.");
  // Das Beispiel des Boards: Teams, Spieler:innen auch ohne Team, Personen.
  assert.deepEqual(vereinLoeschenFolgen({ teams: 10, spieler: 144, ohneTeam: 2, personen: 23 }), {
    geloescht: ["10 Teams, mit Terminen und Team-Trainings", "144 Spieler:innen, davon 2 ohne Team, samt Links, Abos und Abholadressen"],
    personen: "Alle 23 Personen werden Konten ohne Verein und behalten ihre eigenen Übungen und Trainings.",
  });
  // Einzahl, ohne Spieler:innen ohne Team, ohne Spieler:innen und Teams.
  assert.deepEqual(vereinLoeschenFolgen({ teams: 1, spieler: 1, ohneTeam: 0, personen: 2 }).geloescht, [
    "1 Team, mit Terminen und Team-Trainings",
    "1 Spieler:in samt Links, Abos und Abholadressen",
  ]);
  assert.deepEqual(vereinLoeschenFolgen({ teams: 0, spieler: 0, ohneTeam: 0, personen: 1 }).geloescht, [], "ein leerer Verein nennt nichts Leeres");
  // Statt der leeren Liste ein klarer Satz (Fix-Lauf #587).
  assert.equal(VEREIN_LOESCHEN_TEXT.leer, "Der Verein hat keine Teams und keine Spieler:innen.");
  assert.match(
    readFileSync(join(web, "components/verein/VereinLoeschen.tsx"), "utf8"),
    /folgen\.geloescht\.length > 0 \?[\s\S]*?: \(\s*<p>\{VEREIN_LOESCHEN_TEXT\.leer\}<\/p>/,
    "ohne Teams und Spieler:innen der Satz statt der Liste",
  );
  assert.equal(
    vereinLoeschenFolgen({ teams: 0, spieler: 3, ohneTeam: 3, personen: 1 }).personen,
    "Dein Konto bleibt bestehen, ohne Verein; deine eigenen Übungen und Trainings bleiben.",
    "die einzige Person liest nicht «Alle 1 Personen»",
  );
  assert.equal(vereinLoeschenFolgen({ teams: 0, spieler: 3, ohneTeam: 3, personen: 1 }).geloescht[0], "3 Spieler:innen, davon 3 ohne Team, samt Links, Abos und Abholadressen");
});

pruefe("Verein und Konto löschen (#587 AK 14): jede Rückmeldung hat ihren eigenen Satz, Verein und Konto unterscheiden sich", () => {
  const verein = vereinHeisstInzwischenText("FC Wyler", "verein");
  const konto = vereinHeisstInzwischenText("FC Wyler", "konto");
  assert.equal(verein, "Der Verein heisst inzwischen «FC Wyler». Gib diesen Namen ein, um fortzufahren. Der Verein bleibt unverändert.");
  assert.equal(konto, "Der Verein heisst inzwischen «FC Wyler». Gib diesen Namen ein, um fortzufahren. Verein und Konto bleiben unverändert.");
  assert.ok(!verein.includes("Konto"), "der Satz fürs Löschen des Vereins spricht nicht vom Konto");
  // Die vier Antworten von delete_account und der technische Fehler: je ein anderer Satz.
  const saetze = [
    VEREIN_MELDUNG.LETZTE_VERWALTUNG,
    KONTO_LOESCHEN_TEXT.weiterePerson,
    kontoEinzigePersonInzwischenText("FC Wyler"),
    konto,
    KONTO_LOESCHEN_TEXT.fehler,
    KONTO_LOESCHEN_TEXT.teilweise,
  ];
  assert.equal(new Set(saetze).size, saetze.length, "keine zwei Rückmeldungen mit demselben Satz");
  // Nichts verspricht ein Löschen, das nicht geschehen ist.
  for (const t of [KONTO_LOESCHEN_TEXT.weiterePerson, konto]) assert.ok(t.includes("bleiben unverändert"), t);
  // Mit Namen gesendet, aber nicht mehr einzige Person: Der Satz stimmt für jede Ursache (weitere Person im
  // Team oder in der Verwaltung, Verein inzwischen gelöscht) und schickt nicht in die Verwaltung.
  assert.equal(
    KONTO_LOESCHEN_TEXT.weiterePerson,
    "Im Verein hat sich inzwischen etwas geändert. Verein und Konto bleiben unverändert. Prüfe die Angaben und versuche es noch einmal.",
  );
  assert.ok(kontoEinzigePersonInzwischenText("FC Wyler").includes("nichts gelöscht"));
  // Die Antwort der Datenebene ist unlesbar: Der Satz schickt zum Nachsehen, nicht zum blinden Wiederholen.
  assert.ok(VEREIN_UNSTIMMIG.loeschen.includes("prüfe, ob der Verein noch besteht"));
  assert.ok(VEREIN_UNSTIMMIG.konto.includes("prüfe, ob dein Konto noch besteht"));
});

pruefe("Konto löschen (#587 AK 12, 13): drei Fälle des Dialogs im Wortlaut des Boards, ohne Teamnamen", () => {
  assert.deepEqual(kontoLetzteVerwaltungSaetze("FC Wyler"), {
    lage: "Du bist die letzte Person in der Vereinsverwaltung von «FC Wyler», und dem Verein gehören weitere Personen an.",
    weg: "Nimm zuerst jemanden in die Verwaltung auf. Oder lösche den Verein unter Verein › Verwaltung.",
  });
  assert.equal(KONTO_LOESCHEN_TEXT.nichtLoeschbar, "Konto lässt sich noch nicht löschen");
  assert.deepEqual(kontoEinzigePersonSaetze("FC Seefeld", 2, 31), {
    titel: "Konto und Verein löschen",
    lage: "Du bist die einzige Person im Verein «FC Seefeld». Mit deinem Konto wird der Verein gelöscht:",
    geloescht: ["2 Teams, mit Terminen und Team-Trainings", "31 Spieler:innen samt Links, Abos und Abholadressen"],
    endgueltig: "Das lässt sich nicht rückgängig machen.",
    feld: "Vereinsname",
    knopf: "Konto und Verein löschen",
  });
  assert.deepEqual(kontoEinzigePersonSaetze("FC Seefeld", 0, 1).geloescht, ["1 Spieler:in samt Links, Abos und Abholadressen"]);
  assert.deepEqual(kontoEinzigePersonSaetze("FC Seefeld", 0, 0).geloescht, []);
  // Ohne Liste kein Doppelpunkt ins Leere.
  assert.equal(kontoEinzigePersonSaetze("FC Seefeld", 0, 0).lage, "Du bist die einzige Person im Verein «FC Seefeld». Mit deinem Konto wird der Verein gelöscht.");
  assert.ok(kontoEinzigePersonSaetze("FC Seefeld", 0, 1).lage.endsWith("gelöscht:"));
  assert.equal(
    kontoEinzigePersonInzwischenText("FC Seefeld"),
    "Dein Konto ist inzwischen die einzige Person im Verein «FC Seefeld». Mit dem Konto wird der Verein gelöscht: Bestätige das mit dem Vereinsnamen. Es ist nichts gelöscht.",
  );
  // Die Team-Zeile lautet in beiden Löschdialogen gleich.
  assert.equal(kontoEinzigePersonSaetze("FC Seefeld", 3, 0).geloescht[0], vereinLoeschenFolgen({ teams: 3, spieler: 0, ohneTeam: 0, personen: 1 }).geloescht[0]);
  assert.equal(KONTO_LOESCHEN_TEXT.vereinBleibt, "Gehörst du einem Verein an, bleibt er bestehen.");
  // LETZTE_VERWALTUNG bleibt wörtlich; der Weg «im Bereich «Verein» löschen» gibt es jetzt wirklich.
  assert.ok(VEREIN_MELDUNG.LETZTE_VERWALTUNG.endsWith("Du kannst den Verein auch im Bereich «Verein» löschen."));
});

pruefe("Verein und Konto löschen (#587): Antworten der Datenebene werden auf ihre Form geprüft", () => {
  const bild = { id: "4b3f9d0e-4c8a-4a39-9d57-0a8f2f7f1d11", bild_url: "https://x.test/storage/v1/object/public/b/4b3f.webp" };
  // verein_loeschen
  assert.deepEqual(vereinLoeschAusgangAus({ status: "geloescht", name: "FC Wyler", bilder: [bild, { id: "a", bild_url: null }] }), {
    status: "geloescht",
    name: "FC Wyler",
    bilder: [bild, { id: "a", bild_url: null }],
  });
  assert.deepEqual(vereinLoeschAusgangAus({ status: "geloescht", name: "FC Wyler", bilder: [] }), { status: "geloescht", name: "FC Wyler", bilder: [] });
  assert.deepEqual(vereinLoeschAusgangAus({ status: "vereinsname_falsch", name: "FC Wyler 2" }), { status: "vereinsname_falsch", name: "FC Wyler 2" });
  for (const kaputt of [
    null,
    "geloescht",
    {},
    { status: "geloescht", name: "FC Wyler" },
    { status: "geloescht", name: "FC Wyler", bilder: null },
    { status: "geloescht", name: "FC Wyler", bilder: [{ id: "a" }] },
    { status: "geloescht", name: "FC Wyler", bilder: [{ id: 5, bild_url: null }] },
    { status: "geloescht", name: "", bilder: [] },
    { status: "vereinsname_falsch" },
    { status: "unbekannt", name: "FC Wyler", bilder: [] },
  ])
    assert.equal(vereinLoeschAusgangAus(kaputt), null, JSON.stringify(kaputt));
  // delete_account: alle vier Antworten des Vertrags
  assert.deepEqual(kontoLoeschAusgangAus({ status: "geloescht", bilder: [] }), { status: "geloescht", bilder: [] });
  assert.deepEqual(kontoLoeschAusgangAus({ status: "geloescht", bilder: [bild] }), { status: "geloescht", bilder: [bild] });
  assert.deepEqual(kontoLoeschAusgangAus({ status: "letzte_verwaltung" }), { status: "letzte_verwaltung" });
  assert.deepEqual(kontoLoeschAusgangAus({ status: "verein_bestaetigen", verein: "FC Seefeld", teams: 2, spieler: 31 }), {
    status: "verein_bestaetigen",
    verein: "FC Seefeld",
    teams: 2,
    spieler: 31,
  });
  assert.deepEqual(kontoLoeschAusgangAus({ status: "vereinsname_falsch", name: "FC Seefeld" }), { status: "vereinsname_falsch", name: "FC Seefeld" });
  for (const kaputt of [
    null,
    [],
    {},
    { status: "geloescht" },
    { status: "geloescht", bilder: {} },
    { status: "verein_bestaetigen", verein: "FC Seefeld", teams: 2 },
    { status: "verein_bestaetigen", verein: "", teams: 2, spieler: 1 },
    { status: "verein_bestaetigen", verein: "FC Seefeld", teams: -1, spieler: 1 },
    { status: "verein_bestaetigen", verein: "FC Seefeld", teams: 1.5, spieler: 1 },
    { status: "verein_bestaetigen", verein: "FC Seefeld", teams: "2", spieler: 1 },
    { status: "vereinsname_falsch" },
    { status: "weiss_nicht" },
  ])
    assert.equal(kontoLoeschAusgangAus(kaputt), null, JSON.stringify(kaputt));
  // konto_loeschen_info: die Zahlen stehen immer da, der Verein bei den beiden Fällen mit Verein
  assert.deepEqual(kontoInfoAus({ fall: "frei", verein: null, teams: 0, spieler: 0 }), { fall: "frei" });
  assert.deepEqual(kontoInfoAus({ fall: "letzte_verwaltung", verein: "FC Wyler", teams: 0, spieler: 0 }), { fall: "letzte_verwaltung", verein: "FC Wyler" });
  assert.deepEqual(kontoInfoAus({ fall: "einzige_person", verein: "FC Seefeld", teams: 2, spieler: 31 }), {
    fall: "einzige_person",
    verein: "FC Seefeld",
    teams: 2,
    spieler: 31,
  });
  for (const kaputt of [
    null,
    "frei",
    {},
    { fall: "frei" },
    { fall: "frei", verein: null, teams: 0 },
    { fall: "letzte_verwaltung", verein: null, teams: 0, spieler: 0 },
    { fall: "einzige_person", verein: "", teams: 1, spieler: 1 },
    { fall: "einzige_person", verein: "FC Seefeld", teams: "1", spieler: 1 },
    { fall: "anderer", verein: "FC Seefeld", teams: 1, spieler: 1 },
  ])
    assert.equal(kontoInfoAus(kaputt), null, JSON.stringify(kaputt));
});

pruefe("Verein und Konto löschen (#587): ein Weg je RPC, Bestätigung mit dem Baustein, Redirect in der Action, Bilder vor dem Entfernen der Anmeldung", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentar = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Jede der drei RPCs steht an genau einer Stelle: im Verein-Kern.
  const rpcs = { verein_loeschen: [] as string[], konto_loeschen_info: [] as string[], delete_account: [] as string[] };
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei === fileURLToPath(import.meta.url) || rel === "scripts/pruefe-kern-db.ts") continue;
    const text = readFileSync(datei, "utf8");
    for (const name of Object.keys(rpcs) as (keyof typeof rpcs)[])
      if (new RegExp(`\\.rpc\\(\\s*["\`']${name}["\`']`).test(text)) rpcs[name].push(rel);
  }
  assert.deepEqual(rpcs, {
    verein_loeschen: ["lib/kern/verein.ts"],
    konto_loeschen_info: ["lib/kern/verein.ts"],
    delete_account: ["lib/kern/verein.ts"],
  });
  // Der Namensvergleich steht einmal: im Baustein; Verein und Konto nutzen ihn, nichts baut ihn nach.
  const trimNfc: string[] = [];
  for (const datei of quelldateien(web)) {
    const rel = relative(web, datei);
    if (datei !== fileURLToPath(import.meta.url) && /\.trim\(\)\.normalize\("NFC"\)/.test(readFileSync(datei, "utf8"))) trimNfc.push(rel);
  }
  assert.deepEqual(trimNfc, ["components/ui/NamenBestaetigen.tsx"], "Namensvergleich nicht duplizieren");
  const loeschen = lies("components/verein/VereinLoeschen.tsx");
  const konto = lies("app/(app)/konto/KontoClient.tsx");
  for (const [name, text] of [["VereinLoeschen", loeschen], ["KontoClient", konto]] as const) {
    assert.match(text, /<NamenBestaetigen[\s\S]*?gesperrt=\{pending\}/, `${name}: Bestätigung mit dem Baustein, Eingabe gesperrt während der Anfrage`);
    assert.match(text, /namenStimmen\(eingabe, /, `${name}: Knopf nur bei passendem Namen`);
    assert.match(text, /if \(pending \|\| !passt\) return|if \(!passt \|\| pending\) return/, `${name}: kein doppeltes Absenden`);
  }
  assert.match(loeschen, /variant="danger" disabled=\{!passt \|\| pending\}/);
  assert.match(konto, /variant="danger" disabled=\{!passt \|\| pending\}/);
  // Verein löschen: Redirect und Flash in der Action, Teil der Gefahrenzone, nicht am Team-Ort.
  const aktionen = lies("lib/actions/verein.ts");
  assert.match(aktionen, /export async function loescheVereinAktion[\s\S]*?raeumeVerwaisteBilder\(eigeneBildPfade\(r\.wert\.bilder\)\);\s*redirect\(`\/teams\?verein_weg=/);
  assert.ok(!/router\.(push|replace)\(/.test(loeschen), "die Weiterleitung steht in der Action");
  assert.match(lies("components/verein/VereinVerwaltung.tsx"), /<Gefahrenzone beschreibung=\{VEREIN_LOESCHEN_TEXT\.beschreibung\}>[\s\S]*?<VereinLoeschen\b/);
  assert.match(lies("app/(app)/teams/page.tsx"), /sp\.verein_weg && <Flash message=\{vereinGeloeschtText\(/);
  // Konto löschen: Datenebene → Bilder (eigene, dann Verein) → Anmeldung (mit Fehlerprüfung) → Cookies.
  const auth = ohneKommentar(lies("lib/actions/auth.ts"));
  const fluss = auth.slice(auth.indexOf("export async function deleteAccount"));
  const stelle = (text: string) => {
    const i = fluss.indexOf(text);
    assert.ok(i >= 0, `deleteAccount enthält «${text}» nicht`);
    return i;
  };
  assert.ok(
    stelle("loescheKonto(") < stelle("storage.from(STORAGE_BUCKET).remove(paths)") &&
      stelle("storage.from(STORAGE_BUCKET).remove(paths)") < stelle("raeumeVerwaisteBilder(eigeneBildPfade(a.bilder))") &&
      stelle("raeumeVerwaisteBilder(eigeneBildPfade(a.bilder))") < stelle("auth.admin.deleteUser(uid)") &&
      stelle("auth.admin.deleteUser(uid)") < stelle("auth.signOut()"),
    "Reihenfolge: Datenebene, eigene Bilder, Bilder des Vereins, Anmeldung entfernen, Abmelden",
  );
  assert.match(fluss, /const \{ error: loeschFehler \} = await createAdminClient\(\)\.auth\.admin\.deleteUser\(uid\);\s*if \(loeschFehler\)/, "das Entfernen der Anmeldung wird geprüft");
  assert.match(fluss, /KONTO_LOESCHEN_TEXT\.teilweise/, "der Teilzustand hat seinen Satz");
  // Alle vier Antworten haben einen Zweig.
  for (const status of ["letzte_verwaltung", "verein_bestaetigen", "vereinsname_falsch"]) assert.ok(fluss.includes(`a.status === "${status}"`), status);
  // Der Dialog liest den Fall beim Rendern der Seite, nicht erst beim Klick.
  assert.match(lies("app/(app)/konto/daten/page.tsx"), /ladeKontoLoeschenInfo\(supabase, user\.id\)[\s\S]*?<KontoClient info=\{loeschInfo\.wert\} \/>/);
  // Nie ein Namensfeld ohne Pflichtangabe: Die Eingabe geht nur im Fall «einzige Person» mit.
  assert.match(konto, /deleteAccount\(verein \? eingabe : null\)/);
  // Nach jeder Antwort ohne Löschen lädt der Dialog die Lage neu; Name und Zahlen gehen über Antwortfolgen nicht
  // verloren, und eine neu geladene Lage entscheidet den Fall (Fix-Lauf #587).
  assert.match(konto, /await deleteAccount\([\s\S]*?verein: neu\.verein \?\? \(neu\.letzteVerwaltung \? undefined : vorher\.verein\)[\s\S]*?router\.refresh\(\);/);
  assert.match(konto, /if \(info !== infoStand\) \{\s*setInfoStand\(info\);\s*setZustand\(\(z\) => \(\{ fehler: meldungBleibt\(z, info\.fall\) \? z\.fehler : null \}\)\);/);
  // Die stehen gebliebene Meldung passt zur frischen Lage oder fällt weg, nie doppelt zu den Sätzen der Lage (Schlusskorrektur #587).
  assert.match(konto, /function meldungBleibt\([^)]*\): boolean \{\s*if \(z\.letzteVerwaltung\) return fall !== "letzte_verwaltung" && z\.fehler === KONTO_LOESCHEN_TEXT\.weiterePerson;\s*if \(z\.verein \|\| z\.aktuellerName !== undefined\) return fall === "einzige_person";\s*return true;\s*\}/);
  // Teilzustand: Vor der Rückgabe revalidieren, damit Leiste und Seiten den gelöschten Verein nicht weiter zeigen.
  assert.match(fluss, /if \(loeschFehler\) \{[\s\S]*?revalidiereVerein\(\);\s*revalidiereMitgliedschaften\(\);\s*return \{ fehler: KONTO_LOESCHEN_TEXT\.teilweise \}/);
  // Team auflösen sperrt die Eingabe während der Anfrage wie die neuen Dialoge.
  assert.match(lies("components/verein/VereinTeamVerwaltung.tsx"), /<NamenBestaetigen name=\{team\.name\}[^>]*gesperrt=\{pending\}/);
  // Der Flash nennt höchstens einen Vereinsnamen voller Länge.
  assert.match(lies("app/(app)/teams/page.tsx"), /vereinGeloeschtText\(sp\.verein_weg\.slice\(0, VEREIN_NAME_MAX\)\)/);
  // Abholseite und Link: Fehlt der Verein (oder das Team) in der Antwort, gilt sie als ungültig, nie «undefined».
  assert.match(lies("lib/abholung.ts"), /typeof r\.verein !== "string" \|\| !r\.verein\)\s*return \{ gueltig: false \};/);
  assert.ok(!/return data as AbholAnsicht/.test(lies("lib/abholung.ts")), "keine ungeprüfte Übernahme");
  assert.match(lies("lib/privater-link.ts"), /if \(ansicht\.gueltig && \(typeof ansicht\.verein !== "string" \|\| !ansicht\.verein\)\) return UNGUELTIG;/);
  // Der Namensvergleich trimmt beide Seiten (gespeicherter Name mit Rand, Zwilling namen_stimmen); ein Name, der
  // ohne Rand leer ist, stimmt nie (Schlusskorrektur #587).
  assert.match(lies("components/ui/NamenBestaetigen.tsx"), /const verlangt = name\.trim\(\);\s*return verlangt !== "" && eingabe\.trim\(\)\.normalize\("NFC"\) === verlangt\.normalize\("NFC"\);/);
  // Der Speicher wird in Stücken geräumt.
  assert.match(lies("lib/storage-aufraeumen.ts"), /for \(let i = 0; i < pfade\.length; i \+= STUECK\)/);
  // Kein Verein-Weg am Team-Ort, kein KI-Weg zu Gründen und Löschen (Ortsprüfung der Datenebene, Test 30).
  for (const ordner of ["components/team", "app/(app)/team", "lib/mcp"])
    for (const datei of quelldateien(join(web, ordner)))
      assert.ok(!/\b(loescheVerein\w*|gruendeVerein\w*|loescheKonto|ladeKontoLoeschenInfo|verein_loeschen|verein_gruenden|delete_account|konto_loeschen_info)\b/.test(readFileSync(datei, "utf8")), relative(web, datei));
});

// ── Konten ohne Verein (Story #588) ─────────────────────────────────────────

pruefe("Konto ohne Verein (#588): Zwillinge der Grenzen und feste Sätze, ohne Verein nur der Marker mit Bestand", () => {
  assert.equal(KONTO_UEBUNGEN_MAX, 50);
  assert.equal(KONTO_TRAININGS_MAX, 30);
  assert.deepEqual(KONTO_MARKER, { uebungen: "KONTO_UEBUNGEN_VOLL", trainings: "KONTO_TRAININGS_VOLL" });
  assert.equal(
    KONTO_GRENZE_SCHLUSS,
    "In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.",
  );
  assert.equal(KONTO_GRENZE_HINWEIS, "Es ist nichts entstanden.");
  // Der Bestand steht hinter dem Marker; ohne Marker oder ohne Zahl nichts.
  assert.deepEqual(kontoGrenzeAusFehler("ERROR: KONTO_UEBUNGEN_VOLL 50"), { art: "uebungen", bestand: 50 });
  assert.deepEqual(kontoGrenzeAusFehler("x KONTO_TRAININGS_VOLL 62 y"), { art: "trainings", bestand: 62 });
  assert.equal(kontoGrenzeAusFehler("KONTO_UEBUNGEN_VOLL"), null, "ohne Zahl kein Satz");
  assert.equal(kontoGrenzeAusFehler("KONTO_UEBUNGEN_VOLL x"), null);
  assert.equal(kontoGrenzeAusFehler("VEREIN_VOLL"), null);
  assert.equal(kontoGrenzeMeldung("VEREIN_VOLL"), null);
});

pruefe("Konto ohne Verein (#588 AK 6): Satz bei der Abweisung — genau an, bei und über der Grenze", () => {
  // Genau an der Grenze: «n von max», dazu Platz schaffen und der Verein.
  assert.equal(
    kontoGrenzeText("uebungen", 50),
    "Du besitzt 50 von 50 Übungen. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.",
  );
  assert.equal(
    kontoGrenzeText("trainings", 30),
    "Du besitzt 30 von 30 Trainings. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.",
  );
  // Über der Grenze (Altbestand): nie «60 von 50».
  assert.equal(
    kontoGrenzeText("uebungen", 62),
    "Du besitzt 62 Übungen, höchstens 50 sind erlaubt. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.",
  );
  assert.equal(
    kontoGrenzeText("trainings", 31),
    "Du besitzt 31 Trainings, höchstens 30 sind erlaubt. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.",
  );
  // Die Einzahl stimmt auch bei einer erfundenen Zahl.
  assert.match(kontoGrenzeText("trainings", 1), /^Du besitzt 1 von 30 Trainings\./);
  for (const art of ["uebungen", "trainings"] as const)
    for (const n of [29, 30, 31, 50, 51, 100]) {
      const satz = kontoGrenzeText(art, n);
      assert.ok(!/wiederhol|nochmal|noch einmal/i.test(satz), `kein Wiederholen: ${satz}`);
      assert.ok(!/loesch|_loeschen/.test(satz), "kein Löschwerkzeug des Assistenten");
      assert.ok(!/FutAssist|\bKind\b|Kinder/.test(satz), satz);
    }
});

pruefe("Konto ohne Verein (#588 AK 6, 7): Anwendung und KI lesen denselben Satz, der Marker ist eine Regel mit Hinweis", () => {
  for (const [marker, art, bestand] of [
    [KONTO_MARKER.uebungen, "uebungen", 50],
    [KONTO_MARKER.uebungen, "uebungen", 57],
    [KONTO_MARKER.trainings, "trainings", 30],
    [KONTO_MARKER.trainings, "trainings", 44],
  ] as const) {
    const message = `${marker} ${bestand}`;
    const satz = kontoGrenzeText(art, bestand);
    // Anwendung: createExercise nutzt `fehlerMeldung`, der Kern `ausDbFehler` — beide denselben Satz.
    assert.equal(fehlerMeldung(message), satz, message);
    assert.equal(fehlerMeldung(`ERROR: ${message} (P0001)`), satz, "Postgres-Rahmen um den Marker");
    const f = ausDbFehler({ message, code: "P0001" });
    assert.equal(f.art, "regel", "eine Regel, kein technischer Fehler");
    assert.equal(f.meldung, satz);
    // KI: dieselbe Auskunft, nichts entstanden, kein Wiederholen.
    assert.equal(f.hinweis, "Es ist nichts entstanden.");
    assert.equal(f.wiederholbar, undefined, "nicht als wiederholbar gekennzeichnet");
    assert.ok(!/wiederhol/i.test(`${f.meldung} ${f.hinweis}`));
  }
  // Der Marker wird erwartet und nicht als unerwarteter Fehler protokolliert.
  const geloggt: unknown[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void geloggt.push(a);
  try {
    fehlerMeldung(`${KONTO_MARKER.uebungen} 50`);
    ausDbFehler({ message: `${KONTO_MARKER.trainings} 30` });
  } finally {
    console.error = orig;
  }
  assert.deepEqual(geloggt, []);
  // Ein Deadlock bleibt ein Konflikt; nur der Marker trägt den Hinweis der Grenze.
  assert.equal(ausDbFehler({ message: "deadlock detected", code: "40P01" }).hinweis, undefined);
  assert.equal(still(() => ausDbFehler({ message: "VEREIN_VOLL" })).hinweis, undefined);
});

pruefe("Konto ohne Verein (#588 PC 3): `grenzen` der Vereinslage wird auf ihre Form geprüft, `null` mit Verein", () => {
  const g = { uebungen: { bestand: 12, max: 50 }, trainings: { bestand: 0, max: 30 } };
  assert.equal(kontoGrenzenAus(null), null, "mit Verein keine Anzeige");
  assert.deepEqual(kontoGrenzenAus(g), g);
  assert.deepEqual(
    kontoGrenzenAus({ uebungen: { bestand: 62, max: 50 }, trainings: { bestand: 31, max: 30 } }),
    { uebungen: { bestand: 62, max: 50 }, trainings: { bestand: 31, max: 30 } },
    "der Bestand darf über der Grenze liegen",
  );
  for (const kaputt of [
    undefined,
    "grenzen",
    [],
    7,
    {},
    { uebungen: g.uebungen },
    { trainings: g.trainings },
    { uebungen: { bestand: 12 }, trainings: g.trainings },
    { uebungen: { bestand: -1, max: 50 }, trainings: g.trainings },
    { uebungen: { bestand: 1.5, max: 50 }, trainings: g.trainings },
    { uebungen: { bestand: "12", max: 50 }, trainings: g.trainings },
    { uebungen: { bestand: 12, max: 0 }, trainings: g.trainings },
    { uebungen: g.uebungen, trainings: null },
    { uebungen: [], trainings: g.trainings },
  ])
    assert.equal(kontoGrenzenAus(kaputt), undefined, JSON.stringify(kaputt));
});

pruefe("Konto ohne Verein (#588, Fix-Lauf): ein Formfehler in `grenzen` reisst die Vereinslage nicht mit", () => {
  // Ohne Verein: Formfehler → keine Anzeige, protokolliert; nie ein Fehler der ganzen Lage.
  assert.deepEqual(grenzenOhneVerein({ uebungen: "kaputt" }), { grenzen: null, formfehler: true });
  assert.deepEqual(grenzenOhneVerein(undefined), { grenzen: null, formfehler: true });
  assert.deepEqual(grenzenOhneVerein(null), { grenzen: null, formfehler: false });
  const g = { uebungen: { bestand: 3, max: 50 }, trainings: { bestand: 1, max: 30 } };
  assert.deepEqual(grenzenOhneVerein(g), { grenzen: g, formfehler: false });
  // Die Lage entsteht zuerst aus dem Verein; mit Verein wird `grenzen` gar nicht gelesen, und ein Formfehler gibt kein `fehler`.
  const lage = readFileSync(join(web, "lib/queries/verein.ts"), "utf8");
  assert.match(lage, /if \(lage\) return \{ lage, grenzen: null, fehler: null \};\s*[\s\S]*?grenzenOhneVerein\(roh\?\.grenzen\)/);
  assert.match(lage, /if \(formfehler\) console\.error\([^)]*\);\s*return \{ lage: null, grenzen, fehler: null \};/);
  assert.ok(!/grenzen hat nicht die erwartete Form"\) \}/.test(lage), "kein `fehler` aus einem Formfehler");
});

pruefe("Konto ohne Verein (#588 AK 5): Texte der Anzeige in jeder Lage — unter, an und über der Grenze", () => {
  const u = (bestand: number) => ({ bestand, max: 50 });
  const t = (bestand: number) => ({ bestand, max: 30 });
  assert.deepEqual([0, 49, 50, 51].map((n) => istVoll(u(n))), [false, false, true, true]);
  assert.deepEqual([29, 30, 31].map((n) => istVoll(t(n))), [false, true, true]);
  assert.equal(bestandText("uebungen", u(0)), "0 von 50 Übungen");
  assert.equal(bestandText("uebungen", u(12)), "12 von 50 Übungen");
  assert.equal(bestandText("uebungen", u(49)), "49 von 50 Übungen");
  assert.equal(bestandText("uebungen", u(50)), "50 von 50 Übungen");
  assert.equal(bestandText("uebungen", u(62)), "62 Übungen (höchstens 50)", "nie ein negativer Rest");
  assert.equal(bestandText("trainings", t(29)), "29 von 30 Trainings");
  assert.equal(bestandText("trainings", t(30)), "30 von 30 Trainings");
  assert.equal(bestandText("trainings", t(31)), "31 Trainings (höchstens 30)");
  assert.equal(NICHTS_MEHR_FREI, "Nichts mehr frei");
  // Eine Abweisung der Datenebene wird zum Stand der vollen Grenze: Bestand aus dem Marker, Grenze vom Zwilling.
  assert.deepEqual(grenzeAusAbweisung({ art: "uebungen", bestand: 50 }), { bestand: 50, max: 50 });
  assert.deepEqual(grenzeAusAbweisung({ art: "trainings", bestand: 34 }), { bestand: 34, max: 30 });
  assert.equal(bestandSatz("uebungen", u(12)), "Du besitzt 12 von 50 Übungen.");
  assert.equal(bestandSatz("trainings", t(31)), "Du besitzt 31 Trainings, höchstens 30 sind erlaubt.");
  // Die Meldung an der Grenze, bevor Angaben gemacht werden: Board-Wortlaut, Link zur eigenen Übersicht.
  assert.deepEqual(bestandVollMeldung("trainings", t(30)), {
    titel: "Nichts mehr frei: 30 von 30 Trainings",
    text: "Ohne Verein besitzt du höchstens 30 Trainings. Lösche eines, um Platz zu schaffen. In einem Verein gilt die Grenze nicht.",
    link: "/trainings?mine=1",
    linkText: "Zu meinen Trainings",
  });
  assert.deepEqual(bestandVollMeldung("uebungen", u(50)), {
    titel: "Nichts mehr frei: 50 von 50 Übungen",
    text: "Ohne Verein besitzt du höchstens 50 Übungen. Lösche eine, um Platz zu schaffen. In einem Verein gilt die Grenze nicht.",
    link: "/uebungen?mine=1",
    linkText: "Zu meinen Übungen",
  });
  assert.equal(bestandVollMeldung("uebungen", u(62)).titel, "Nichts mehr frei: 62 Übungen, höchstens 50");
  assert.equal(bestandVollMeldung("trainings", t(31)).titel, "Nichts mehr frei: 31 Trainings, höchstens 30");
});

pruefe("Konto ohne Verein (#588 AK 5, Fix-Lauf): der Satz über der Grenze nennt, wie viele weg müssen", () => {
  const u = (bestand: number) => ({ bestand, max: 50 });
  const t = (bestand: number) => ({ bestand, max: 30 });
  // Genau an der Grenze: eine bzw. eines.
  assert.match(bestandVollMeldung("uebungen", u(50)).text, / Lösche eine, um Platz zu schaffen\. /);
  assert.match(bestandVollMeldung("trainings", t(30)).text, / Lösche eines, um Platz zu schaffen\. /);
  // Eine darüber: zwei müssen weg, bis eine neue Platz hat.
  assert.equal(
    bestandVollMeldung("uebungen", u(51)).text,
    "Ohne Verein besitzt du höchstens 50 Übungen. Lösche 2 Übungen, um Platz für eine neue zu schaffen. In einem Verein gilt die Grenze nicht.",
  );
  assert.equal(
    bestandVollMeldung("trainings", t(31)).text,
    "Ohne Verein besitzt du höchstens 30 Trainings. Lösche 2 Trainings, um Platz für ein neues zu schaffen. In einem Verein gilt die Grenze nicht.",
  );
  // Weit darüber: Bestand − Grenze + 1.
  assert.match(bestandVollMeldung("uebungen", u(62)).text, / Lösche 13 Übungen, um Platz für eine neue zu schaffen\. /);
  assert.match(bestandVollMeldung("trainings", t(45)).text, / Lösche 16 Trainings, um Platz für ein neues zu schaffen\. /);
});

pruefe("Konto ohne Verein (#588 AK 7): Werkzeugtexte der KI nennen die Grenze, fordern nicht zum Wiederholen auf und kennen kein Löschwerkzeug", () => {
  assert.match(KONTO_GRENZE_WERKZEUG.uebungen, /höchstens 50 Übungen/);
  assert.match(KONTO_GRENZE_WERKZEUG.trainings, /höchstens 30 Trainings.*Team-Trainings nicht/);
  for (const text of Object.values(KONTO_GRENZE_WERKZEUG)) {
    assert.match(text, /«hinweis» sagt, dass nichts entstanden ist/);
    assert.match(text, /statt den Aufruf zu wiederholen/);
    assert.match(text, /In einem Verein gilt die Grenze nicht\.$/);
    assert.ok(!/(uebung|training)_loeschen/.test(text), "kein Verweis auf ein Löschwerkzeug");
  }
});

pruefe("Konto ohne Verein (#588): ein Weg für den Satz, die Hinweise im Kern, Zuordnen bleibt frei (AK 4), Einfüge-Wege vollständig", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Die Übersetzung steht in `fachlicheMeldung`: `createExercise` (fehlerMeldung) und der Kern (ausDbFehler) lesen sie dort.
  assert.match(lies("lib/training-bedingungen.ts"), /const konto = kontoGrenzeMeldung\(message\);\s*if \(konto\) return konto;/);
  assert.match(lies("lib/actions/exercises.ts"), /message: error \? fehlerMeldung\(error\.message\)/, "createExercise übersetzt");
  // Der Hinweis der Datenebene erreicht jeden Weg: Kern, Übungskopie, Trainingskopie.
  assert.match(lies("lib/kern/ergebnis.ts"), /const grenze = kontoGrenzeAusFehler\(e\.message\);\s*return fehlschlag\("regel", meldung, grenze \? \{ hinweis: KONTO_GRENZE_HINWEIS, grenze \} : \{\}\);/);
  assert.match(lies("lib/fassung.ts"), /art: f\.art, \.\.\.\(f\.hinweis && \{ hinweis: f\.hinweis \}\), \.\.\.\(f\.grenze && \{ grenze: f\.grenze \}\)/);
  assert.match(lies("lib/kern/uebungen.ts"), /hinweis: kopie\.hinweis \?\? nichtsEntstanden\(kopie\.art\),\s*\.\.\.\(kopie\.grenze && \{ grenze: kopie\.grenze \}\)/);
  assert.match(lies("lib/kern/kopie.ts"), /return vorher\(f\.error, f\.art, f\);/);
  // «Gefahrlos wiederholen» nur bei technisch/konflikt, auch beim Übernehmen eines Trainings (Fix-Lauf #588).
  assert.match(lies("lib/kern/kopie.ts"), /kopie\.nichtsEntstanden \? \(kopie\.hinweis \?\? nichtsEntstanden\(kopie\.art\)\)/);
  assert.match(lies("lib/kern/kopie.ts"), /return art === "technisch" \|\| art === "konflikt" \? HINWEIS_NICHTS_ENTSTANDEN : KEINE_KOPIE;/);
  assert.ok(!/const nichts = \{ hinweis: HINWEIS_NICHTS_ENTSTANDEN \}/.test(lies("lib/kern/kopie.ts")));
  // Das Merkmal `grenze` erreicht die Actions der Oberfläche; der KI-Weg lässt es weg.
  assert.match(lies("lib/actions/exercises.ts"), /const grenze = error \? kontoGrenzeAusFehler\(error\.message\) : null;/);
  assert.match(lies("lib/actions/exercises.ts"), /error: kopie\.meldung, \.\.\.\(kopie\.grenze && \{ grenze: kopie\.grenze \}\)/);
  assert.match(lies("lib/actions/fassung.ts"), /error: kopie\.error, \.\.\.\(kopie\.grenze && \{ grenze: kopie\.grenze \}\)/);
  assert.match(lies("lib/actions/trainings.ts"), /message: oberflaechenMeldung\(r\), \.\.\.\(r\.grenze && \{ grenze: r\.grenze \}\)/);
  assert.match(lies("lib/actions/team-trainings.ts"), /error: oberflaechenMeldung\(r\), \.\.\.\(r\.grenze && \{ grenze: r\.grenze \}\)/);
  assert.match(lies("lib/mcp/ergebnis.ts"), /grenze: _grenze, \.\.\.rest \} = f;/);
  // Kein toter Code: updateExercise und erstelleTeamTraining können an der Grenze nie abweisen.
  assert.equal((lies("lib/actions/exercises.ts").match(/kontoGrenzeAusFehler\(error\.message\)/g) ?? []).length, 1, "nur createExercise");
  assert.equal((lies("lib/actions/team-trainings.ts").match(/r\.grenze/g) ?? []).length, 2, "kopie() — nicht erstelleTeamTraining");
  // Ein Weg, der nicht zählt, kennt die Grenze nicht: Übung ins Training übernehmen.
  assert.ok(!/konto-grenzen|KONTO_/.test(lies("lib/kern/fassung.ts")), "ordneUebungZu bleibt frei");
  assert.ok(!/konto-grenzen|KONTO_/.test(lies("lib/actions/trainings.ts").split("export async function addTrainingExercise")[1]?.split("\nexport async function")[0] ?? ""));
  // Alle vier Einfüge-Wege tragen die Grenze in ihrer Werkzeugbeschreibung.
  for (const d of ["lib/mcp/werkzeuge/uebungen-bearbeiten.ts", "lib/mcp/werkzeuge/trainings.ts", "lib/mcp/werkzeuge/trainings-bestand.ts"])
    assert.match(lies(d), /KONTO_GRENZE_WERKZEUG\.(uebungen|trainings)/, d);
  assert.equal((lies("lib/mcp/werkzeuge/uebungen-bearbeiten.ts").match(/KONTO_GRENZE_WERKZEUG\.uebungen/g) ?? []).length, 2, "uebung_anlegen und uebung_kopieren");
  assert.match(lies("lib/mcp/werkzeuge/trainings.ts"), /KONTO_GRENZE_WERKZEUG\.trainings/, "training_anlegen");
  assert.match(lies("lib/mcp/werkzeuge/trainings-bestand.ts"), /KONTO_GRENZE_WERKZEUG\.trainings/, "training_kopieren");
  // Die Vereinslage reicht `grenzen` durch, auf ihre Form geprüft; ein Weg, der den Verein kennt, zeigt sie nie.
  assert.match(lies("lib/queries/verein.ts"), /const \{ grenzen, formfehler \} = grenzenOhneVerein\(roh\?\.grenzen\);/);
  // Lage unbekannt (Fehler, Formfehler) ist nie «ohne Grenzen»: dritter Zustand.
  const vq = lies("lib/queries/verein.ts");
  assert.match(vq, /export type GrenzenLage = "mit" \| "ohne" \| "unbekannt";/);
  assert.match(vq, /if \(fehler\) \{[^}]*return "unbekannt";\s*\}\s*if \(lage\) return "ohne";\s*return grenzen \? "mit" : "unbekannt";/);
  assert.match(lies("lib/queries/verein.ts"), /if \(lage\) return \{ lage, grenzen: null, fehler: null \};/);
  assert.match(lies("lib/kern/konto.ts"), /kontoGrenzenAus\(/);
  // Die Schreibweise der Grenze steht in einer Datei: keine zweite 50/30 in den Werkzeugtexten.
  for (const d of ["lib/mcp/werkzeuge/uebungen-bearbeiten.ts", "lib/mcp/werkzeuge/trainings.ts", "lib/mcp/werkzeuge/trainings-bestand.ts"])
    assert.ok(!/höchstens (50|30) /.test(lies(d)), `${d}: Grenzen nur über konto-grenzen.ts`);
});

pruefe("Konto ohne Verein (#588 AK 5, PC 3): Anzeige nur ohne Verein und aus der Datenebene, nie hart verdrahtet, nie im Layout", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Kein hartes 50/30 in den Bausteinen der Anzeige: Die Zahl kommt aus `grenzen`, die Sätze aus lib/konto-grenzen.ts.
  for (const d of ["components/ui/BestandAnzeige.tsx", "components/konto/BestandStufe.tsx", "lib/actions/konto-bestand.ts"])
    assert.ok(!/\b(50|30)\b/.test(lies(d).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), `${d}: keine feste Grenze im Code`);
  // Die Übersichten zeigen den Stand nur in «Meine …» und lesen ihn von der Datenebene, nicht aus der Liste.
  assert.match(lies("app/(app)/uebungen/page.tsx"), /const grenzen = filters\.mine \? await getMeineGrenzen\(\) : null;/);
  assert.match(lies("app/(app)/uebungen/page.tsx"), /\{grenzen && <BestandAnzeige art="uebungen" grenze=\{grenzen\.uebungen\}/);
  // Die Trainingsübersicht lädt ihn mit Liste und Detail zusammen (#630).
  assert.match(lies("app/(app)/trainings/page.tsx"), /mine \? getMeineGrenzen\(\) : Promise\.resolve\(null\),/);
  assert.match(lies("app/(app)/trainings/page.tsx"), /\{grenzen && <BestandAnzeige art="trainings" grenze=\{grenzen\.trainings\}/);
  // Anlegen: Meldung statt der Maske erst an der Grenze (`istVoll`, auch darüber), darunter die Zeile; ohne `grenzen` nichts.
  assert.match(lies("app/(app)/neu/page.tsx"), /const voll = grenzen !== null && istVoll\(grenzen\.uebungen\);/);
  assert.match(lies("app/(app)/neu/page.tsx"), /\{grenzen && voll \? \(\s*<BestandAnzeige art="uebungen" grenze=\{grenzen\.uebungen\} variante="meldung" \/>/);
  assert.match(lies("app/(app)/neu/page.tsx"), /bestand=\{grenzen\?\.uebungen\}/);
  assert.match(lies("app/(app)/training/neu/page.tsx"), /const voll = grenzen !== null && istVoll\(grenzen\.trainings\);/);
  assert.match(lies("app/(app)/training/neu/page.tsx"), /\{grenzen && voll \? \(\s*<BestandAnzeige art="trainings" grenze=\{grenzen\.trainings\} variante="meldung" \/>/);
  assert.match(lies("app/(app)/training/neu/page.tsx"), /<TrainingCreateForm bestand=\{grenzen\?\.trainings\} \/>/);
  // Weist die Datenebene beim Speichern ab (Rennen): dieselbe Meldung wie bei voller Grenze, erkannt am Merkmal
  // `grenze`, und die Zeile mit dem alten Stand fällt weg — die Angaben bleiben in der Maske (Fix-Lauf).
  for (const [d, art] of [["components/exercise/ExerciseForm.tsx", "uebungen"], ["components/training/TrainingCreateForm.tsx", "trainings"]] as const) {
    const t = lies(d);
    assert.match(t, new RegExp(`state\\.grenze \\? \\(\\s*<div ref=\\{grenzMeldungRef\\}[^>]*role="alert"[^>]*>\\s*<BestandAnzeige art="${art}" grenze=\\{grenzeAusAbweisung\\(state\\.grenze\\)\\} variante="meldung"`), d);
    assert.match(t, new RegExp(`\\{bestand && !state\\.grenze && (?:\\(\\s*)?<BestandAnzeige art="${art}" grenze=\\{bestand\\}`), d);
  }
  // Die Zähler stehen in der Seite, nie im Layout: Das Layout rendert bei Navigation im Client nicht neu und zeigte einen
  // Stand von gestern; eine Anzeige, die nie sperrt, darf veralten, eine Seite soll es nicht.
  for (const datei of quelldateien(join(web, "components/layout")))
    assert.ok(!/konto-grenzen|getMeineGrenzen|BestandAnzeige/.test(readFileSync(datei, "utf8")), relative(web, datei));
  // Die Vereinslage liest je Anfrage (React-`cache`), nie über Anfragen hinweg.
  assert.ok(!/unstable_cache|revalidate\s*=/.test(lies("lib/queries/verein.ts")), "kein Zwischenspeicher über Anfragen");
  assert.match(lies("lib/queries/verein.ts"), /if \(lage\) return \{ lage, grenzen: null, fehler: null \};/, "mit Verein nie eine Anzeige");
  // Die Seiten rendern je Aufruf frisch.
  for (const d of ["app/(app)/uebungen/page.tsx", "app/(app)/trainings/page.tsx", "app/(app)/neu/page.tsx", "app/(app)/training/neu/page.tsx"])
    assert.match(lies(d), /export const dynamic = "force-dynamic";/, d);
});

pruefe("Konto ohne Verein (#588 AK 5, 6): die Stufe vor Kopieren, Übernehmen und «In die Bibliothek» — ein Klick mit Verein, frischer Stand ohne, gesperrt bis zur Zielseite, Abweisung am Merkmal", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Alle vier Einstiege gehen über die Stufe und geben das Ergebnis der Action samt Merkmal weiter.
  for (const [d, art] of [
    ["components/exercise/UebungKopierenButton.tsx", "uebungen"],
    ["components/exercise/OwnerActions.tsx", "uebungen"],
    ["components/training/InBibliothekButton.tsx", "uebungen"],
    ["components/training/TrainingAktionen.tsx", "trainings"],
  ] as const) {
    const t = lies(d);
    assert.match(t, new RegExp(`useBestandStufe\\(\\{\\s*art: "${art}"`), d);
    assert.match(t, /\.dialog\b|\{(dialog|kopierDialog)\}/, `${d} zeigt die Stufe`);
    assert.match(t, /if \(!res\.ok\) return res;/, `${d}: das Merkmal reist mit`);
    // Der Auslöser sperrt fokussierbar (W6), nie `disabled` durch die Stufe.
    assert.ok(!/disabled=\{(laeuft|kopierLaeuft|pending \|\| uebernehmenStufe\.laeuft)\}/.test(t), `${d}: kein disabled durch die Stufe`);
  }
  assert.match(lies("components/exercise/UebungKopierenButton.tsx"), /aria-disabled=\{laeuft \|\| undefined\}/);
  assert.match(lies("components/training/InBibliothekButton.tsx"), /aria-disabled=\{laeuft \|\| undefined\}/);
  assert.match(lies("components/exercise/OwnerActions.tsx"), /gesperrt=\{kopierLaeuft\}/);
  assert.match(lies("components/training/TrainingAktionen.tsx"), /gesperrt=\{uebernehmenStufe\.laeuft\}/);
  const menue = lies("components/ui/OverflowMenu.tsx");
  assert.match(menue, /aria-disabled=\{gesperrt \|\| undefined\}/);
  assert.match(menue, /if \(gesperrt\) return;\s*setOffen/);
  // Die Seiten geben die Lage mit (W2): mit Verein kein Aufruf der Bestands-Action.
  for (const d of ["app/(app)/uebung/[slug]/page.tsx", "app/(app)/training/[id]/edit/page.tsx"]) {
    const t = lies(d);
    assert.match(t, /getMeineGrenzenLage\(\)\]\)/, `${d}: Lage parallel zu den anderen Abfragen`);
    assert.match(t, /const mitGrenzen = grenzenLage !== "ohne";/, `${d}: unbekannt heisst nicht «ohne Grenzen»`);
    assert.match(t, /<KontoGrenzenLage mitGrenzen=\{mitGrenzen\}>/, d);
  }
  // Ansichtsseite und Detail der Trainingsübersicht (#630) teilen die
  // Zusammenstellung (`ladeTrainingAnsicht`).
  const ansicht = lies("lib/queries/training-ansicht.ts");
  assert.match(ansicht, /Promise\.all\(\[\s*getTrainingView\(id\),[^;]*getMeineGrenzenLage\(\)/, "Lage parallel zu den anderen Abfragen");
  assert.match(ansicht, /mitGrenzen: grenzenLage !== "ohne",/, "unbekannt heisst nicht «ohne Grenzen»");
  for (const d of ["app/(app)/training/[id]/page.tsx", "components/training/TrainingDetailSpalte.tsx"]) {
    assert.match(lies(d), /<KontoGrenzenLage mitGrenzen=\{mitGrenzen\}>/, d);
  }
  assert.match(lies("app/(app)/training/[id]/page.tsx"), /await ladeTrainingAnsicht\(id\)/);
  assert.match(lies("app/(app)/trainings/page.tsx"), /ladeTrainingAnsicht\(auswahl\.training, user\)/);
  const stufe = lies("components/konto/BestandStufe.tsx");
  assert.match(stufe, /if \(!mitGrenzen\) \{\s*ausfuehrenGesichert\(nr, false\);\s*return;\s*\}/, "mit Verein sofort, ohne Rundreise");
  assert.match(stufe, /ladeBestandAktion\(art\)/, "ohne Verein der Stand frisch, nicht von der Seite übernommen");
  // W1: Die Aktion läuft in einer Transition; im Erfolg bleibt sie offen, bis die Zielseite steht.
  assert.match(stufe, /const \[fuehrtAus, startAusfuehren\] = useTransition\(\);/);
  assert.match(stufe, /startAusfuehren\(async \(\) => \{\s*let r: StufenFehler;\s*try \{\s*r = await ausfuehren\(\);/);
  assert.match(stufe, /const laeuft = fragt \|\| fuehrtAus;/);
  assert.match(stufe, /function starte\(\) \{\s*if \(belegt\.current \|\| laeuft \|\| offen\) return;/);
  assert.match(stufe, /if \(belegt\.current \|\| laeuft\) return;\s*ausfuehrenGesichert\(\+\+lauf\.current, true\);/);
  assert.match(stufe, /function schliessen\(\) \{\s*if \(belegt\.current \|\| fuehrtAus\) return;/);
  assert.match(stufe, /if \(nr !== lauf\.current\) return;/, "überholte Antworten werden verworfen");
  // W5: Die Abweisung an der Grenze erkennt die Stufe am Merkmal, nie am Text, und zeigt die Form der vollen Grenze.
  assert.match(stufe, /if \(r\.grenze\) setOffen\(\{ grenze: grenzeAusAbweisung\(r\.grenze\), fehler: null, abgewiesen: true \}\);/);
  assert.match(stufe, /const voll = grenze !== null && \(offen\?\.abgewiesen \|\| \(istVoll\(grenze\) && offen\?\.fehler == null\)\);/);
  assert.match(stufe, /voll \? \(\s*<Button type="button" variant="outlined" onClick=\{schliessen\}>\s*Schliessen/);
  assert.match(stufe, /<BestandAnzeige art=\{art\} grenze=\{grenze\} variante="meldung" \/>/, "mit dem Weg zur eigenen Übersicht");
  assert.ok(!/endsWith|KONTO_GRENZE_SCHLUSS/.test(stufe), "keine Erkennung am Text");
  assert.match(stufe, /else melde\(r\.error\);/);
  // Die Action liest nur, prüft ihre Eingabe und gehört dem angemeldeten Konto.
  const aktion = lies("lib/actions/konto-bestand.ts");
  assert.match(aktion, /art !== "uebungen" && art !== "trainings"/);
  assert.match(aktion, /angemeldet\(\)/);
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(aktion), "nur lesen");
});

pruefe("Konto ohne Verein (#588 PC 2): Wer die Zugehörigkeit oder den Bestand ändert, lädt die Ansichten neu — Anlegen, Kopieren, Löschen, Aufnahme, Austritt, Auflösen, Verein löschen", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  /** Der Rumpf einer exportierten Funktion bis zur nächsten. */
  const rumpf = (text: string, name: string): string => {
    const i = text.search(new RegExp(`export async function ${name}\\b`));
    assert.ok(i >= 0, `${name} nicht gefunden`);
    const rest = text.slice(i + 1);
    const j = rest.search(/\n(?:\/\*\*|export )/);
    return j < 0 ? rest : rest.slice(0, j);
  };
  // Wer den Bestand ändert, verwirft die Liste, die ihn zeigt.
  const exercises = lies("lib/actions/exercises.ts");
  for (const name of ["createExercise", "kopiereUebung", "deleteExercise"]) assert.match(rumpf(exercises, name), /revalidateLists\(\)/, name);
  assert.match(rumpf(lies("lib/actions/fassung.ts"), "kopiereInBibliothek"), /revalidatePath\("\/uebungen"\)/);
  const trainings = lies("lib/actions/trainings.ts");
  for (const name of ["createTraining", "deleteTraining"]) assert.match(rumpf(trainings, name), /revalidatePath\("\/trainings"\)/, name);
  assert.match(rumpf(lies("lib/actions/team-trainings.ts"), "uebernimmTraining"), /revalidatePath\("\/trainings"\)/);
  // Wer die eigene Zugehörigkeit ändert, rendert das Wurzel-Layout neu (Leiste, Wechsler) und verwirft den Router-Cache,
  // damit `/` und `/trainings` bei der nächsten Navigation den Stand ohne oder mit Grenze zeigen.
  const verein = lies("lib/actions/verein.ts");
  for (const name of [
    "gruendeVereinAktion",
    "loeseTeamAufAktion",
    "loescheVereinAktion",
    "nimmMichInsTeamAktion",
    "entferneAusTeamAktion",
    "nimmInVerwaltungAufAktion",
    "entferneAusVerwaltungAktion",
  ])
    assert.match(rumpf(verein, name), /revalidiereMitgliedschaften\(\)/, name);
  assert.match(rumpf(lies("lib/actions/teams.ts"), "entferneMitglied"), /revalidiereMitgliedschaften\(\)/, "Austritt aus dem Team");
  assert.match(lies("lib/actions/auth.ts"), /revalidiereVerein\(\);\s*revalidiereMitgliedschaften\(\);/, "Konto löschen mit Verein");
});

pruefe("Infos zum Team: Gliederung mit Zwischentiteln, Listen und Fett, sonst Text (#598 AK 2; OoS 1)", () => {
  const b = gliederungBloecke("## Trainings\r\n- Dienstag\n- **Donnerstag** 17:30\n\nText eins\nText zwei\n1. Schoner\n2. Flasche\n# Ende");
  assert.deepEqual(b.map((x) => x.art), ["titel", "aufzaehlung", "absatz", "nummeriert", "titel"]);
  assert.deepEqual(b[1], {
    art: "aufzaehlung",
    punkte: [[{ art: "text", text: "Dienstag" }], [{ art: "fett", text: "Donnerstag" }, { art: "text", text: " 17:30" }]],
  });
  assert.equal(b[2].art === "absatz" && b[2].zeilen.length, 2, "ein Umbruch im Absatz bleibt");
  assert.equal(b[3].art === "nummeriert" && b[3].start, 1);
  // Leerzeile beendet eine Liste; Text direkt nach der Liste ist ein Absatz.
  assert.deepEqual(gliederungBloecke("- a\n\n- b").map((x) => x.art), ["aufzaehlung", "aufzaehlung"]);
  assert.deepEqual(gliederungBloecke("- a\nweiter").map((x) => x.art), ["aufzaehlung", "absatz"]);
  // Kein Markdown darüber hinaus: Links mit Linktext, Bilder, HTML bleiben Text.
  const roh = "[Link](https://x.ch) ![Bild](a.png) <b>fett</b> ** offen";
  assert.deepEqual(gliederungBloecke(roh), [{ art: "absatz", zeilen: [[{ art: "text", text: roh }]] }]);
  assert.equal(gliederungAlsText("## Titel\n- a\n- b"), "Titel · a · b");
  assert.deepEqual(gliederungBloecke(" \n "), []);
});

pruefe("Infos zum Team: die Werkzeugleiste setzt und entfernt Kürzel (#598 AK 2)", () => {
  // Zwischentitel auf der Zeile des Cursors, nochmals = weg.
  const t = gliedere({ text: "Hallo\nWelt", start: 7, ende: 7 }, "titel");
  assert.deepEqual(t, { text: "Hallo\n## Welt", start: 6, ende: 13 });
  assert.equal(gliedere(t, "titel").text, "Hallo\nWelt");
  // Aufzählung über mehrere Zeilen; Nummerierung ersetzt sie und zählt.
  const l = gliedere({ text: "a\nb\nc", start: 0, ende: 5 }, "aufzaehlung");
  assert.equal(l.text, "- a\n- b\n- c");
  assert.equal(gliedere(l, "nummeriert").text, "1. a\n2. b\n3. c");
  // Fett um die Auswahl, ohne Auswahl ein Platzhalter, nochmals = weg.
  const f = gliedere({ text: "ganz wichtig", start: 5, ende: 12 }, "fett");
  assert.deepEqual(f, { text: "ganz **wichtig**", start: 7, ende: 14 });
  assert.equal(gliedere(f, "fett").text, "ganz wichtig");
  assert.equal(gliedere({ text: "", start: 0, ende: 0 }, "fett").text, "**fett**");
  // Auf einer leeren Zeile beginnt die Leiste eine Liste (E2E/Review #598).
  assert.equal(gliedere({ text: "", start: 0, ende: 0 }, "aufzaehlung").text, "- ");
  assert.equal(gliedere({ text: "abc\n", start: 4, ende: 4 }, "titel").text, "abc\n## ");
  // Fett hebt nur auf, was die Auswahl selbst umschliesst, nicht Nachbarn.
  assert.equal(gliedere({ text: "**x** y **z**", start: 5, ende: 8 }, "fett").text, "**x**** y ****z**");
  // Über mehrere Zeilen: jede Zeile für sich.
  assert.equal(gliedere({ text: "a\nb", start: 0, ende: 3 }, "fett").text, "**a**\n**b**");
});

pruefe("Infos zum Team: bereinigt wie die Datenebene, höchstens 10'000 Zeichen samt Gliederung (#598 AK 3, 7)", () => {
  assert.equal(TEAM_INFOS_MAX, 10000);
  assert.equal(teamInfosBereinigt("  \r\n## Hallo\r\n "), "## Hallo");
  assert.equal(teamInfosBereinigt(" \n "), null, "leer = keine");
  assert.equal(teamInfosProblem("x".repeat(10000)), null);
  assert.equal(teamInfosProblem("x".repeat(10001)), TEAM_INFOS_TEXT.zuLang);
  assert.equal(teamInfosProblem("⚽".repeat(10000)), null, "Codepunkte wie char_length");
  assert.equal(zahlCh(10000), "10'000");
  assert.equal(standDatum("2026-11-12"), "12.11.2026");
  // Zwilling: dieselbe Zahl in der Migration.
  const sql = readFileSync(join(web, "../supabase/migrations/20261118100000_team_infos.sql"), "utf8");
  assert.match(sql, /char_length\(text\) between 1 and 10000/);
  assert.match(sql, /char_length\(v_text\) > 10000/);
  // Der Zugang nennt die Infos (PC 2: ohne neue Zustimmung).
  assert.ok(readFileSync(join(web, "lib/mcp/umfang.ts"), "utf8").includes("die Infos zum Team für Spieler:innen und Eltern verfassen, ändern und entfernen"));
});

pruefe("Infos am privaten Link: die Erklärungen stehen hinter dem ⓘ, nicht mehr auf der Termin-Seite (#598 AK 10; OoS 10)", () => {
  const ansicht = readFileSync(join(web, "components/privat/ElternAnsicht.tsx"), "utf8");
  for (const weg of ["angabenSehenText", "linkProbeKopf", "KuerzbarerText", "ist für jedes Training zuerst angemeldet"])
    assert.ok(!ansicht.includes(weg), `${weg} gehört auf die Infos-Seite`);
  assert.match(ansicht, /\/abmelden\/\$\{token\}\/infos/);
  assert.match(ansicht, /ProbeZaehler stand=\{probeLokal\}/, "der Schnupperstand bleibt bei den Terminen");
  const infos = readFileSync(join(web, "components/privat/LinkInfos.tsx"), "utf8");
  assert.ok(!/defaultOpen/.test(infos), "OoS 9: nichts öffnet sich von selbst");
  for (const da of ["angabenSehenText", "linkProbeKopf", "linkMeldenText", "teamInfosLinkTitel", "PROBE_TEXT.linkInfoTitel"])
    assert.ok(infos.includes(da), da);
});

// ── Benachrichtigungen am privaten Link (Epic #641, Story #642) ──────────────
const BN_K1 = "abcdefghijkl";
const BN_K2 = "ABCDEFGHIJ-_";

pruefe("Benachrichtigungen (#642 AK 2): das Cookie merkt sich je Link den Stand — Rundlauf, Grenze 20, sinkt nie, Müll fällt weg", () => {
  assert.equal(leseGesehenStand(undefined, BN_K1), null, "ein Gerät ohne Eintrag kennt den Link nicht");
  assert.equal(leseGesehenStand("", BN_K1), null);
  const a = mitGesehen(undefined, BN_K1, 1_790_000_000_000);
  assert.equal(leseGesehenStand(a, BN_K1), 1_790_000_000_000, "Rundlauf");
  assert.equal(leseGesehenStand(a, BN_K2), null);
  // Nie senken, aber höher geht.
  assert.equal(leseGesehenStand(mitGesehen(a, BN_K1, 5), BN_K1), 1_790_000_000_000);
  assert.equal(leseGesehenStand(mitGesehen(a, BN_K1, 1_800_000_000_000), BN_K1), 1_800_000_000_000);
  // Mehrere Links; der zuletzt geschriebene steht zuerst.
  const b = mitGesehen(a, BN_K2, 7);
  assert.ok(b.startsWith(`${BN_K2}:`), b);
  assert.equal(leseGesehenStand(b, BN_K1), 1_790_000_000_000);
  assert.equal(leseGesehenStand(b, BN_K2), 7);
  // Höchstens 20, der älteste fällt zuerst heraus.
  let wert: string | undefined;
  for (let i = 0; i < BENACHRICHTIGUNG_MAX_LINKS + 5; i++) wert = mitGesehen(wert, `k${String(i).padStart(11, "0")}`, i + 1);
  assert.equal(wert!.split(".").length, BENACHRICHTIGUNG_MAX_LINKS);
  assert.equal(leseGesehenStand(wert, "k00000000000"), null, "der älteste ist verdrängt");
  assert.equal(leseGesehenStand(wert, `k${String(BENACHRICHTIGUNG_MAX_LINKS + 4).padStart(11, "0")}`), BENACHRICHTIGUNG_MAX_LINKS + 5);
  // Müll: Unlesbares fällt weg, Lesbares bleibt; nichts wirft.
  for (const muell of ["x", "::", "a:b:c", "zu-kurz:1", `${BN_K1}:`, `${BN_K1}:-5`, `${BN_K1}:ZZ`, ".", "..", `${BN_K1}:1:2`])
    assert.equal(leseGesehenStand(muell, BN_K1), null, muell);
  assert.equal(leseGesehenStand(`muell.${BN_K1}:${(42).toString(36)}`, BN_K1), 42, "ein kaputter Eintrag nimmt die anderen nicht mit");
  assert.equal(mitGesehen("muell", BN_K1, 3), `${BN_K1}:3`);
  assert.equal(mitGesehen(a, "kurz", 9), a, "ein ungültiger Schlüssel ändert nichts");
  assert.equal(mitGesehen(a, BN_K1, Number.NaN), a);
  assert.equal(mitGesehen(a, BN_K1, -1), a);
  // Das Cookie: Name, Pfad nur der Links, ein Jahr, kein Klartext-Token.
  const c = benachrichtigungCookie(a);
  assert.ok(c.startsWith(`${BENACHRICHTIGUNG_COOKIE}=`) && c.includes("; path=/abmelden;") && c.includes("max-age=31536000") && c.includes("samesite=lax"), c);
  assert.equal(wertAusCookieString(`x=1; ${BENACHRICHTIGUNG_COOKIE}=${encodeURIComponent(a)}; y=2`), a);
  assert.equal(wertAusCookieString("x=1; y=2"), undefined);
  assert.equal(wertAusCookieString(`${BENACHRICHTIGUNG_COOKIE}=%E0%A4%A`), undefined, "kaputte Kodierung wirft nicht");
  // Browser-Speicher: die Seite «Cookies» nennt es (#409).
  assert.ok(SPEICHERUNGEN.some((x) => x.name === BENACHRICHTIGUNG_COOKIE), "SPEICHERUNGEN enthält das Cookie");
});

/** Ein Eintrag für die Prüfungen, wie `spieler_link_benachrichtigungen` ihn liefert. */
function bnEintrag(ereignis: BenachrichtigungEreignis, inhalt: unknown, extra: Partial<LinkBenachrichtigung> = {}): LinkBenachrichtigung {
  return { id: `id-${ereignis}`, termin_id: "t1", erstellt: 1000, erstellt_tag: "2026-12-01", ereignis, inhalt, ...extra } as LinkBenachrichtigung;
}
const BN_SPIEL = { team: "E-Junioren", art: "spiel", bezeichnung: "FC Wyler - FC Aarau", datum: "2026-12-05", beginn: "14:00", ende: "15:30", ort: "Sportplatz Wyler" };
const BN_TRAINING = { team: "E-Junioren", art: "training", bezeichnung: null, datum: "2026-12-02", beginn: "18:00", ende: null, ort: null };

pruefe("Benachrichtigungen (#642): gruppiere und neuZahl — ohne Stand ist nichts neu, sonst zählt nur, was danach entstand", () => {
  const e = [bnEintrag("neues_spiel", BN_SPIEL, { id: "a", erstellt: 300 }), bnEintrag("neues_spiel", BN_SPIEL, { id: "b", erstellt: 200 }), bnEintrag("neues_spiel", BN_SPIEL, { id: "c", erstellt: 100 })];
  assert.equal(neuZahl(e, null), 0, "Erstanzeige: alles Bisherige gilt als gesehen");
  assert.equal(neuZahl(e, 0), 3);
  assert.equal(neuZahl(e, 100), 2, "gleich alt ist nicht neu");
  assert.equal(neuZahl(e, 300), 0);
  assert.equal(neuZahl([], 5), 0);
  const g = gruppiere(e, 150);
  assert.deepEqual(g.neu.map((x) => x.id), ["a", "b"], "die Reihenfolge bleibt");
  assert.deepEqual(g.frueher.map((x) => x.id), ["c"]);
  assert.deepEqual(gruppiere(e, null).neu, []);
  assert.equal(knopfLabel(0), "Benachrichtigungen");
  assert.equal(knopfLabel(3), "Benachrichtigungen, 3 neu");
});

pruefe("Benachrichtigungen (#642 AK 3): Titel, Wann, Wo und Zusatz je Ereignis — auch die sechs, die erst #643-#645 erzeugen", () => {
  const spiel = bnEintrag("neues_spiel", BN_SPIEL);
  assert.equal(eintragTitel(spiel), "FC Wyler - FC Aarau · E-Junioren");
  assert.equal(eintragWann(spiel), "Samstag, 5. Dezember · 14:00–15:30");
  assert.equal(eintragWo(spiel), "Sportplatz Wyler");
  assert.deepEqual(eintragZusaetze(spiel), []);
  assert.equal(eintragTitel(bnEintrag("neues_spiel", { ...BN_SPIEL, bezeichnung: null })), "Spiel · E-Junioren");
  // Training ohne Ende und ohne Ort.
  const training = bnEintrag("verlegung", BN_TRAINING);
  assert.equal(eintragTitel(training), "Training · E-Junioren");
  assert.equal(eintragWann(training), "Mittwoch, 2. Dezember · ab 18:00");
  assert.equal(eintragWo(training), null);
  assert.equal(eintragWann(bnEintrag("verlegung", { ...BN_TRAINING, beginn: null })), "Mittwoch, 2. Dezember");
  assert.deepEqual(eintragZusaetze(bnEintrag("verlegung", { ...BN_TRAINING, wieder: true })), ["Findet wieder statt."]);
  assert.deepEqual(eintragZusaetze(training), []);
  // Ausfall mit und ohne Grund; die Rücknahme sagt es im Wort.
  assert.deepEqual(eintragZusaetze(bnEintrag("ausfall", { ...BN_SPIEL, grund: "Platz gesperrt" })), ["Grund: Platz gesperrt"]);
  assert.deepEqual(eintragZusaetze(bnEintrag("ausfall", { ...BN_SPIEL, grund: null })), []);
  assert.deepEqual(eintragZusaetze(bnEintrag("ruecknahme", BN_SPIEL)), []);
  assert.equal(EREIGNIS_WORT.ruecknahme, "Findet wieder statt");
  // Die Serie: neue Angaben und Wegfall — auch mit Wegfall allein.
  const serie = bnEintrag("serie", {
    team: "E-Junioren", art: "training", ab: "2026-12-01",
    angaben: { wochentage: [2], beginn: "18:00", ende: "19:30" },
    wegfall: { von: "2026-12-02", bis: "2026-12-16", wochentage: [3], anzahl: 3 },
  });
  assert.equal(eintragTitel(serie), "Training · E-Junioren");
  assert.equal(eintragWann(serie), "Ab Dienstag, 1. Dezember");
  assert.equal(eintragWo(serie), null);
  assert.deepEqual(eintragZusaetze(serie), ["Neu jeweils Dienstag · 18:00–19:30", "Es fallen 3 Trainings am Mittwoch weg (2.–16. Dez.)."]);
  const nurWegfall = bnEintrag("serie", { team: "E-Junioren", art: "training", ab: null, angaben: null, wegfall: { von: "2026-11-28", bis: "2026-12-16", wochentage: [2, 4], anzahl: 1 } });
  assert.equal(eintragWann(nurWegfall), null);
  assert.deepEqual(eintragZusaetze(nurWegfall), ["Es fällt 1 Training am Dienstag und Donnerstag weg (28. Nov.–16. Dez.)."]);
  const nurAngaben = bnEintrag("serie", { team: "E-Junioren", art: "training", ab: "2026-12-01", angaben: { ort: "Halle" }, wegfall: null });
  assert.deepEqual(eintragZusaetze(nurAngaben), ["Neu Halle"]);
  assert.deepEqual(eintragZusaetze(bnEintrag("serie", { team: "E-Junioren", art: "training", ab: null, angaben: {}, wegfall: null })), []);
  // Wort und Farbe: Die Änderung heisst «Trainings geändert», der reine Wegfall wie ein Wegfall.
  assert.equal(eintragWort(serie), "Trainings geändert");
  assert.equal(eintragNegativ(serie), false);
  assert.equal(eintragWort(nurAngaben), "Trainings geändert");
  assert.equal(eintragWort(nurWegfall), "Training fällt weg");
  assert.equal(eintragNegativ(nurWegfall), true);
  const ganzWeg = bnEintrag("serie", { team: "E-Junioren", art: "training", ab: null, angaben: {}, wegfall: { von: "2026-11-26", bis: "2026-12-17", wochentage: [4], anzahl: 4 } });
  assert.equal(eintragWort(ganzWeg), "Trainings fallen weg");
  assert.equal(eintragNegativ(ganzWeg), true);
  assert.equal(eintragWort(spiel), "Neues Spiel");
  assert.equal(eintragNegativ(bnEintrag("ausfall", BN_SPIEL)), true);
  // «Zum Termin»: nur zum betroffenen Termin, solange er am Link steht; nie bei der Serie.
  const amLink = new Set(["t1"]);
  assert.equal(zumTermin(spiel, amLink), "t1");
  assert.equal(zumTermin(spiel, new Set()), null);
  assert.equal(zumTermin(bnEintrag("wegfall", BN_SPIEL, { termin_id: null }), amLink), null);
  assert.equal(zumTermin(serie, amLink), null, "Die Serienänderung führt zu keinem einzelnen Termin");
  assert.equal(zumTermin(ganzWeg, amLink), null);
  // Rot nur bei Ausfall und Wegfall.
  assert.deepEqual(Object.entries(EREIGNIS_NEGATIV).filter(([, v]) => v).map(([k]) => k), ["ausfall", "wegfall"]);
  // Jedes Ereignis hat sein Wort.
  assert.deepEqual(Object.keys(EREIGNIS_WORT).sort(), ["ausfall", "neues_spiel", "ruecknahme", "serie", "verlegung", "wegfall"]);
});

pruefe("Benachrichtigungen (#642): erhaltenText — heute, gestern, sonst das Datum", () => {
  assert.equal(erhaltenText("2026-12-01", "2026-12-01"), "Erhalten heute");
  assert.equal(erhaltenText("2026-11-30", "2026-12-01"), "Erhalten gestern");
  assert.equal(erhaltenText("2026-11-03", "2026-12-01"), "Erhalten am 3. Nov.");
  assert.equal(erhaltenText("2026-12-02", "2026-12-01"), "Erhalten heute", "ein später gestelltes Gerät lügt nicht über die Zukunft");
});

pruefe("Benachrichtigungen (#642 AK 5, 6): Texte als Konstanten; Oberfläche und KI nennen dasselbe; keine Browser-Formatierung in lib/benachrichtigung.ts", () => {
  assert.equal(ELTERN_TEXT.speicher, "KiFu bewahrt Benachrichtigungen 90 Tage auf. Welche du schon gesehen hast, merkt sich nur dieses Gerät.");
  // Je Dialog ein Hinweis (Epic #641, Prinzip 4); die KI-Beschreibung desselben
  // Vorgangs nennt Label und Hinweis wortgleich und den Standard.
  assert.deepEqual(Object.keys(BENACHRICHTIGEN_HINWEIS).sort(), ["aendern", "ausfall", "entfernen", "neues_spiel", "ruecknahme"]);
  const team = readFileSync(join(web, "lib/mcp/werkzeuge/team.ts"), "utf8");
  for (const v of Object.keys(BENACHRICHTIGEN_HINWEIS) as (keyof typeof BENACHRICHTIGEN_HINWEIS)[]) {
    const modell = BENACHRICHTIGEN_MODELL(v);
    assert.ok(modell.startsWith(`${BENACHRICHTIGEN_TEXT.label}: ${BENACHRICHTIGEN_HINWEIS[v]} `) && modell.includes("Standard true"), modell);
    assert.ok(team.includes(`BENACHRICHTIGEN_MODELL("${v}")`), `UI = KI: kein KI-Werkzeug für «${v}»`);
  }
  // Die Rücknahme sagt es wie das Ereigniswort (#643 AK 4), auch als Zusatz einer Verlegung.
  assert.ok(BENACHRICHTIGEN_HINWEIS.ruecknahme.includes("wieder stattfindet"), BENACHRICHTIGEN_HINWEIS.ruecknahme);
  assert.deepEqual(eintragZusaetze(bnEintrag("verlegung", { ...BN_TRAINING, wieder: true })), [`${EREIGNIS_WORT.ruecknahme}.`]);
  // Hydration: nur Funktionen aus monat.ts/serie.ts, nie der Browser selbst.
  const quelle = readFileSync(join(web, "lib/benachrichtigung.ts"), "utf8");
  assert.ok(!/toLocale|new Date\(|Intl\./.test(quelle), "keine Formatierung des Browsers");
  assert.ok(
    !/\bProbe/.test(Object.values(ELTERN_TEXT).join(" ") + Object.values(BENACHRICHTIGEN_HINWEIS).join(" ") + BENACHRICHTIGEN_WERKZEUG),
    "kein «Probe» in Oberflächen- und KI-Texten",
  );
  assert.ok(BENACHRICHTIGEN_WERKZEUG.startsWith("Standardmässig erhalten die Spielervertretungen"));
});

pruefe("Benachrichtigungen (Prinzip 2; #643 AK 1, #645 AK 1): benachrichtigungZaehlt — heute oder später am Trainingsort", () => {
  assert.equal(benachrichtigungZaehlt("2026-12-01", "2026-12-01"), true, "heute");
  assert.equal(benachrichtigungZaehlt("2026-12-02", "2026-12-01"), true, "morgen");
  assert.equal(benachrichtigungZaehlt("2026-11-30", "2026-12-01"), false, "gestern");
  assert.deepEqual(AUSFALL_ZURUECKNEHMEN_TEXT, { titel: "Ausfall zurücknehmen", knopf: "Zurücknehmen", erfolg: "Ausfall zurückgenommen." });
});

pruefe("Benachrichtigungen (#644 AK 1–3; OoS 1): istVerlegung, ausfallEndet, mitteilbarEinzeln und mitteilbarSerie als Zwillinge der Datenebene", () => {
  const stand = { datum: "2026-12-02", beginn: "18:00:00", ende: "19:30:00", ort: "Halle" };
  // Sekunden aus der Datenbank, Minuten aus dem Dialog: gleich.
  assert.equal(istVerlegung(stand, { ...stand, beginn: "18:00", ende: "19:30" }), false);
  assert.equal(istVerlegung(stand, { ...stand, ort: " Halle " }), false);
  for (const [feld, wert] of [["datum", "2026-12-03"], ["beginn", "18:30"], ["ende", "20:00"], ["ort", "Wiese"], ["ort", null]] as const)
    assert.equal(istVerlegung(stand, { ...stand, [feld]: wert }), true, feld);
  const heute = "2026-12-01";
  // Der Ausfall endet: ein Training mit neuem Datum ab heute, ein Spiel mit neuem Datum oder Beginn.
  assert.equal(ausfallEndet(stand, { ...stand, datum: "2026-12-04" }, "training", heute), true);
  assert.equal(ausfallEndet(stand, { ...stand, datum: "2026-11-30" }, "training", heute), false, "Training in die Vergangenheit");
  assert.equal(ausfallEndet(stand, { ...stand, beginn: "18:30" }, "training", heute), false, "Training, nur Zeit");
  assert.equal(ausfallEndet(stand, { ...stand, beginn: "18:30" }, "spiel", heute), true, "Spiel, Zeit");
  assert.equal(ausfallEndet(stand, { ...stand, datum: "2026-11-30" }, "spiel", heute), true, "Spiel, auch in die Vergangenheit (Trigger)");
  assert.equal(ausfallEndet(stand, stand, "spiel", heute), false);
  const einzeln = (vorher: Partial<typeof stand> & { ausgefallen?: boolean }, nachher: Partial<typeof stand>, art: "training" | "spiel" = "training") =>
    mitteilbarEinzeln({ vorher: { ...stand, ausgefallen: false, ...vorher }, nachher: { ...stand, ...vorher, ...nachher }, art, heute });
  // Nur der Kartenlink (gleiche Angaben): nein (OoS 1). Datum in die Vergangenheit: nein.
  assert.equal(einzeln({}, {}), false, "nur Kartenlink");
  assert.equal(einzeln({}, { datum: "2026-11-30" }), false, "in die Vergangenheit");
  assert.equal(einzeln({}, { datum: heute }), true, "auf heute");
  assert.equal(einzeln({}, { ende: "20:00" }), true, "nur Ende");
  // Ausgefallen: nur, wenn der Ausfall damit endet.
  assert.equal(einzeln({ ausgefallen: true }, { beginn: "18:30" }), false, "ausgefallenes Training, nur Zeit");
  assert.equal(einzeln({ ausgefallen: true }, { datum: "2026-12-04" }), true, "ausgefallenes Training verlegt");
  assert.equal(einzeln({ ausgefallen: true, datum: "2026-11-28" }, { datum: "2026-12-02" }), true, "ausgefallenes Training auf morgen");
  assert.equal(einzeln({ ausgefallen: true }, { beginn: "18:30" }, "spiel"), true, "ausgefallenes Spiel, Zeit");
  assert.equal(einzeln({ ausgefallen: true }, { ende: "20:00" }, "spiel"), false, "ausgefallenes Spiel, nur Ende");
  // Über die Serie: Ende ab heute und Regel, Zeit oder Ort geändert.
  const serie = (nachher: Partial<typeof stand>, regelGeaendert: boolean, serieEnde: string) =>
    mitteilbarSerie({ vorher: stand, nachher: { ...stand, ...nachher }, regelGeaendert, serieEnde, heute });
  assert.equal(serie({ beginn: "17:00" }, false, "2026-12-20"), true, "Serie Zeit");
  assert.equal(serie({}, true, "2026-12-20"), true, "Serie Regel");
  assert.equal(serie({ ort: "Wiese" }, false, "2026-12-20"), true, "Serie Ort");
  assert.equal(serie({}, false, "2026-12-20"), false, "Serie ohne Verlegung");
  assert.equal(serie({ beginn: "17:00" }, false, "2026-11-30"), false, "Serie vorbei");
  assert.equal(serie({}, true, heute), true, "Serie endet heute");
});

pruefe("Benachrichtigungen (#645 AK 1, 3; PC 3): Wegfall am Link; Serie mit Verlegung und Wegfall in einem Eintrag", () => {
  // Die Form der Datenebene (benachrichtigung_serie_zeilen): von, bis, ISO-Wochentage, Anzahl.
  assert.equal(wegfallText({ von: "2026-12-02", bis: "2026-12-16", wochentage: [3], anzahl: 3 }), "Es fallen 3 Trainings am Mittwoch weg (2.–16. Dez.).");
  assert.equal(wegfallText({ von: "2026-12-02", bis: "2026-12-02", wochentage: [3], anzahl: 1 }), "Es fällt 1 Training am Mittwoch weg (2. Dez.).");
  assert.equal(
    wegfallText({ von: "2026-11-30", bis: "2026-12-17", wochentage: [1, 4], anzahl: 6 }),
    "Es fallen 6 Trainings am Montag und Donnerstag weg (30. Nov.–17. Dez.).",
  );
  const serie = (inhalt: Record<string, unknown>) =>
    ({ id: "x", termin_id: null, erstellt: 0, erstellt_tag: "2026-12-01", ereignis: "serie", inhalt: { team: "Ea", art: "training", ...inhalt } }) as never;
  // PC 3: dieselbe Zeile nennt die neuen Angaben und den Wegfall.
  assert.deepEqual(
    eintragZusaetze(serie({ ab: "2026-12-08", angaben: { beginn: "17:30" }, wegfall: { von: "2026-12-10", bis: "2026-12-17", wochentage: [4], anzahl: 2 } })),
    ["Neu ab 17:30", "Es fallen 2 Trainings am Donnerstag weg (10.–17. Dez.)."],
  );
  // Nur Wegfall: ohne «Ab …», nur der Wegfall.
  const nurWeg = serie({ ab: null, angaben: null, wegfall: { von: "2026-12-10", bis: "2026-12-10", wochentage: [4], anzahl: 1 } });
  assert.equal(eintragWann(nurWeg), null);
  assert.deepEqual(eintragZusaetze(nurWeg), ["Es fällt 1 Training am Donnerstag weg (10. Dez.)."]);
  // Der einzelne Wegfall trägt den Termin vor dem Löschen (AK 2).
  const einzeln = {
    id: "y", termin_id: "t", erstellt: 0, erstellt_tag: "2026-12-01", ereignis: "wegfall",
    inhalt: { team: "Ea", art: "spiel", bezeichnung: "Turnier", datum: "2026-12-05", beginn: "14:00", ende: "15:30", ort: "Halle" },
  } as never;
  assert.equal(eintragTitel(einzeln), "Turnier · Ea");
  assert.equal(eintragWo(einzeln), "Halle");
  assert.equal(EREIGNIS_NEGATIV.wegfall, true);
});

const AA_K1 = "AbCdEf123456";
const AA_K2 = "zyxwvu-_9876";
const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  iphoneInstagram: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 357.0.0.25.101",
  iphoneFacebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.107;FBBV/1]",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidWebView: "Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36",
  androidWhatsApp: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.1",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
};

pruefe("App ablegen (#650 AK 1, 8; OoS 4): erkenneGeraet — iPhone, Android, Browser in Apps, Computer", () => {
  assert.deepEqual(erkenneGeraet(UA.iphoneSafari, 5), { system: "ios", inApp: false });
  assert.deepEqual(erkenneGeraet(UA.iphoneChrome, 5), { system: "ios", inApp: false }, "Chrome auf dem iPhone legt über «Teilen» ab");
  assert.deepEqual(erkenneGeraet(UA.iphoneInstagram, 5), { system: "ios", inApp: true });
  assert.deepEqual(erkenneGeraet(UA.iphoneFacebook, 5), { system: "ios", inApp: true });
  assert.deepEqual(erkenneGeraet(UA.ipad, 5), { system: "ios", inApp: false }, "das iPad meldet sich als Mac mit Touchscreen");
  assert.deepEqual(erkenneGeraet(UA.ipad, 0), { system: "andere", inApp: false }, "ein Mac ohne Touchscreen ist ein Computer");
  assert.deepEqual(erkenneGeraet(UA.androidChrome, 5), { system: "android", inApp: false });
  assert.deepEqual(erkenneGeraet(UA.androidWebView, 5), { system: "android", inApp: true });
  assert.deepEqual(erkenneGeraet(UA.androidWhatsApp, 5), { system: "android", inApp: true });
  assert.deepEqual(erkenneGeraet(UA.macChrome, 0), { system: "andere", inApp: false });
  assert.deepEqual(erkenneGeraet(UA.windows, 0), { system: "andere", inApp: false });
  assert.deepEqual(erkenneGeraet("", 0), { system: "andere", inApp: false });
});

pruefe("App ablegen (#650 AK 6, 7): Besuche je Link, ab dem zweiten der Hinweis, nach dem Schliessen 7 Tage Ruhe", () => {
  const t0 = 1_800_000_000_000;
  const iphone = erkenneGeraet(UA.iphoneSafari, 5);
  const hinweis = (wert: string, jetzt: number, extra: Partial<Parameters<typeof zeigeHinweis>[0]> = {}) =>
    zeigeHinweis({ geraet: iphone, standalone: false, stand: ablageFuer(wert, AA_K1), jetzt, ...extra });
  // Erster Besuch: kein Hinweis.
  let w = mitBesuch(null, AA_K1, t0);
  assert.deepEqual(ablageFuer(w, AA_K1), { k: AA_K1, b: 1, l: t0, z: null });
  assert.equal(hinweis(w, t0), false);
  // Neu laden kurz danach ist derselbe Besuch.
  w = mitBesuch(w, AA_K1, t0 + BESUCH_ABSTAND_MS - 1);
  assert.equal(ablageFuer(w, AA_K1)?.b, 1);
  assert.equal(hinweis(w, t0 + BESUCH_ABSTAND_MS - 1), false);
  // Zweiter Besuch: der Hinweis.
  const t1 = t0 + BESUCH_ABSTAND_MS;
  w = mitBesuch(w, AA_K1, t1);
  assert.equal(ablageFuer(w, AA_K1)?.b, 2);
  assert.equal(hinweis(w, t1), true);
  // Nicht in der abgelegten App, nicht am Computer (OoS 4), nicht ohne Stand.
  assert.equal(hinweis(w, t1, { standalone: true }), false);
  assert.equal(hinweis(w, t1, { geraet: erkenneGeraet(UA.macChrome, 0) }), false);
  assert.equal(hinweis(w, t1, { geraet: erkenneGeraet(UA.androidChrome, 5) }), true);
  assert.equal(hinweis(w, t1, { geraet: erkenneGeraet(UA.iphoneInstagram, 5) }), true, "im Browser einer App sagt er, wo es geht (AK 8)");
  assert.equal(zeigeHinweis({ geraet: iphone, standalone: false, stand: null, jetzt: t1 }), false);
  // Geschlossen: ruht 7 Tage, auch über weitere Besuche hinweg.
  w = mitGeschlossen(w, AA_K1, t1);
  assert.equal(ablageFuer(w, AA_K1)?.z, t1);
  assert.equal(ablageFuer(w, AA_K1)?.b, 2, "Schliessen zählt keinen Besuch");
  const t2 = t1 + HINWEIS_PAUSE_MS - 1;
  w = mitBesuch(w, AA_K1, t2);
  assert.equal(hinweis(w, t2), false);
  assert.equal(hinweis(w, t1 + HINWEIS_PAUSE_MS), true, "nach 7 Tagen wieder");
  // Je Link getrennt: Ein anderer Link beginnt bei 1, der zuletzt besuchte steht zuerst.
  w = mitBesuch(w, AA_K2, t2);
  assert.deepEqual(liesAblage(w).map((s) => [s.k, s.b]), [[AA_K2, 1], [AA_K1, 3]]);
  assert.equal(zeigeHinweis({ geraet: iphone, standalone: false, stand: ablageFuer(w, AA_K2), jetzt: t2 }), false);
  // Schliessen eines unbekannten Links legt ihn an.
  assert.deepEqual(ablageFuer(mitGeschlossen(null, AA_K1, t0), AA_K1), { k: AA_K1, b: 1, l: t0, z: t0 });
  // Höchstens 20 Links; der älteste fällt heraus.
  let viele: string | null = null;
  for (let i = 0; i < APP_ABLEGEN_MAX_LINKS + 3; i++) viele = mitBesuch(viele, `k${String(i).padStart(11, "0")}`, t0 + i);
  const liste = liesAblage(viele);
  assert.equal(liste.length, APP_ABLEGEN_MAX_LINKS);
  assert.equal(liste[0].k, `k${String(APP_ABLEGEN_MAX_LINKS + 2).padStart(11, "0")}`);
  assert.equal(liste.some((s) => s.k === "k00000000000"), false);
  // Müll: Unlesbares fällt weg, nichts wirft; ein ungültiger Schlüssel ändert nichts.
  for (const muell of ["x", "{}", "[1]", '[{"k":"kurz","b":1,"l":1,"z":null}]', '[{"k":"AbCdEf123456","b":-1,"l":1,"z":null}]', '[{"k":"AbCdEf123456","b":1,"l":1,"z":"x"}]'])
    assert.equal(ablageFuer(muell, AA_K1), null, muell);
  const gut = JSON.stringify([{ k: AA_K1, b: 2, l: 5, z: null }]);
  assert.equal(ablageFuer(`[{"k":"kaputt"},${gut.slice(1)}`, AA_K1)?.b, 2, "ein kaputter Eintrag nimmt die anderen nicht mit");
  assert.equal(mitBesuch(gut, "kurz", t0), gut);
  assert.equal(mitBesuch(gut, AA_K1, Number.NaN), gut);
  assert.equal(mitGeschlossen(gut, AA_K1, -1), gut);
  // Kein Klartext-Link im Speicher, und die Seite «Cookies» nennt ihn (#409).
  assert.ok(SPEICHERUNGEN.some((x) => x.name === APP_ABLEGEN_SPEICHER), "SPEICHERUNGEN enthält den lokalen Speicher");
});

pruefe("App ablegen (#650 AK 1, 3–5): Manifest je Link — Name «Vorname · Verein», id, start_url und scope mit dem Link", () => {
  const token = "a".repeat(43);
  const m = linkManifest({ token, vorname: "Lena", verein: "FC Wyler" });
  assert.equal(m.name, "Lena · FC Wyler");
  assert.equal(appName("Lena", "FC Wyler"), m.name);
  assert.equal(m.id, `/abmelden/${token}`);
  assert.equal(m.start_url, `/abmelden/${token}`);
  // Ohne Schrägstrich am Ende: Sonst läge die Startseite selbst nicht im Bereich.
  assert.equal(m.scope, `/abmelden/${token}`);
  assert.ok(m.start_url.startsWith(m.scope));
  assert.equal(m.display, "standalone");
  assert.ok(!("short_name" in m), "kein Kurzname: der Verein gehört zum Namen");
  // Zwei Spieler:innen, zwei Apps (AK 5).
  assert.notEqual(linkManifest({ token: "b".repeat(43), vorname: "Noah", verein: "FC Wyler" }).id, m.id);
  // Icons: 192, 512 und ein maskierbares; die Dateien liegen da.
  assert.deepEqual(APP_ICONS.map((i) => `${i.sizes}:${i.purpose}`), ["192x192:any", "512x512:any", "512x512:maskable"]);
  for (const i of APP_ICONS) assert.ok(existsSync(join(web, "public", i.src)), i.src);
});

pruefe("KiFu als App (#651 AK 1–3, #671): Manifest «KiFu» ab «/», nur in App und Anmeldung verlinkt, kein Service Worker", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const m = kontoManifest();
  assert.equal(m.name, "KiFu");
  assert.equal(m.short_name, "KiFu");
  // Ab «/»: angemeldet in den Arbeitsbereich, sonst die Startseite (#671 PC 1).
  assert.equal(m.start_url, "/");
  assert.equal(m.id, "/");
  assert.equal(m.scope, "/");
  assert.equal(m.display, "standalone");
  assert.deepEqual(m.icons, APP_ICONS, "dieselbe Bildmarke wie beim Link");
  assert.equal(KONTO_APP_METADATA.manifest, KONTO_MANIFEST_PFAD);
  assert.equal(KONTO_APP_METADATA.appleWebApp.title, "KiFu");
  // Die Route liegt da, wo der Pfad hinzeigt, und ist fest (ohne Daten einer Person).
  const route = lies(`app${KONTO_MANIFEST_PFAD}/route.ts`);
  assert.match(route, /kontoManifest\(\)/);
  assert.match(route, /force-static/);
  // Verlinkt nur in den Layouts von App und Anmeldung — nie im Wurzel-Layout und
  // nie per `app/manifest.ts`: beides überdeckte das Manifest des Links (#650).
  for (const d of ["app/(app)/layout.tsx", "app/(auth)/layout.tsx"])
    assert.match(lies(d), /export const metadata: Metadata = KONTO_APP_METADATA;/, d);
  assert.ok(!/KONTO_APP_METADATA|manifest:/.test(lies("app/layout.tsx")), "Wurzel ohne Manifest");
  assert.ok(!/KONTO_APP_METADATA/.test(lies("app/(privat)/layout.tsx")), "Link-Seiten ohne KiFu-Manifest");
  // Die Startseite ist nicht die App (#670): keine Seite der Gruppe `(start)` verlinkt das Manifest.
  for (const datei of quelldateien(join(web, "app/(start)")))
    assert.ok(!/KONTO_APP_METADATA|manifest:/.test(readFileSync(datei, "utf8")), `${relative(web, datei)}: ohne KiFu-Manifest`);
  for (const d of ["app/manifest.ts", "app/manifest.json", "app/manifest.webmanifest/page.tsx", "public/manifest.webmanifest", "public/manifest.json"])
    assert.ok(!existsSync(join(web, d)), `${d}: Manifest per Dateikonvention hinge an jeder Seite`);
  // Die Middleware lässt den Pfad aus (keine Sitzung, der Browser schickt keine Cookies).
  assert.match(lies("middleware.ts"), /\|manifest\\\\\.webmanifest\|/);
  // Kein Service Worker für Konten (OoS 1, 2): einziger ist der des Links (#483).
  assert.ok(!/serviceWorker/.test(lies("app/(app)/layout.tsx") + lies("app/(auth)/layout.tsx") + route));
  // Systemleiste hell/dunkel im Grund (Zwilling --color-elev-00).
  assert.match(lies("app/layout.tsx"), /themeColor: \[\.\.\.THEME_FARBEN\]/);
  const grund = lies("app/globals.css").match(/--color-elev-00: light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)/);
  assert.ok(grund);
  assert.deepEqual(THEME_FARBEN.map((f) => f.color), [grund[1], grund[2]]);
});

pruefe("App ablegen (#650 AK 2, 6, 8): Texte — Genitiv des Vornamens, Begriff «Mobile», Mitteilungen nur mit #483", () => {
  assert.equal(genitiv("Lena"), "Lenas");
  assert.equal(genitiv("Jonas"), "Jonas’");
  assert.equal(genitiv("Max"), "Max’");
  assert.equal(genitiv("Fritz"), "Fritz’");
  assert.equal(genitiv("Alice"), "Alice’");
  assert.equal(APP_ABLEGEN_TEXT.hinweisTitel("Lena"), "Termine von Lena als App");
  assert.equal(
    APP_ABLEGEN_TEXT.hinweisText("Lena"),
    "Lege diese Seite auf den Home-Bildschirm. Dann öffnest du Lenas Termine mit einem Tipp, ohne den Link im Chat zu suchen.",
  );
  assert.equal(APP_ABLEGEN_TEXT.inApp, "Hier lässt sich die Seite nicht als App ablegen. Öffne den Link im Browser deines Mobiles, etwa in Safari oder Chrome.");
  const alle = JSON.stringify(APP_ABLEGEN_TEXT) + APP_ABLEGEN_TEXT.hinweisText("X") + APP_ABLEGEN_TEXT.hinweisTitel("X");
  assert.ok(!/Handy/i.test(alle), "«Mobile», nie «Handy»");
  assert.ok(!/Mitteilung/i.test(alle), "ohne Mitteilungen in der Umgebung nennt der Hinweis sie nicht");
  assert.equal(APP_ABLEGEN_TEXT.ios.length, 3);
  assert.equal(APP_ABLEGEN_TEXT.android.length, 3);
  assert.match(APP_ABLEGEN_TEXT.ios[1], /«Zum Home-Bildschirm»/);
  assert.match(APP_ABLEGEN_TEXT.ios[2], /«Hinzufügen»/);
  assert.match(APP_ABLEGEN_TEXT.android[1], /«Zum Startbildschirm hinzufügen»/);
});

// ── Mitteilungen aufs Mobile (#483) ─────────────────────────────────────────

const PUSH_MIGRATION = readFileSync(join(web, "../supabase/migrations/20261120100000_push_mitteilungen.sql"), "utf8");
const P256DH_OK = `B${"A".repeat(86)}`;
const AUTH_OK = "A".repeat(22);

pruefe("Mitteilungen (#483 AK 5, PC 4, 5): Zwillinge zur Datenebene — Grenze, Dienste, TTL, Versuche", () => {
  assert.equal(PUSH_MAX_GERAETE, 10);
  assert.match(PUSH_MIGRATION, new RegExp(`where spieler_id = new\\.spieler_id\\) >= ${PUSH_MAX_GERAETE} then`), "Grenze im Trigger");
  // Dieselbe Liste der Dienste: die Quelle des TS-Musters ohne die Schrägstrich-Masken steht im Check.
  assert.ok(PUSH_MIGRATION.includes(`endpoint ~ '${PUSH_ENDPUNKT.source.replace(/\\\//g, "/")}'`), "PUSH_ENDPUNKT ≠ Check push_abos_endpunkt");
  assert.match(PUSH_MIGRATION, /length\(endpoint\) <= 1024/);
  assert.equal(PUSH_TTL_SEKUNDEN, 24 * 60 * 60);
  assert.match(PUSH_MIGRATION, /erstellt_am < now\(\) - interval '24 hours' or versuche >= 5/);
  assert.equal(PUSH_MAX_VERSUCHE, 5);
  assert.match(PUSH_MIGRATION, /and versuche >= 5;/);
  // Kein Upsert auf die zählende Tabelle (CLAUDE.md).
  assert.ok(!/insert into push_abos[^;]*on conflict/i.test(PUSH_MIGRATION), "kein Upsert auf push_abos");
  // Der Anstoss nur mit beiden Vault-Einträgen.
  assert.match(PUSH_MIGRATION, /if k\.url is null or k\.geheimnis is null then return false; end if;/);
});

pruefe("Mitteilungen (#483 AK 1): nur Anmeldungen bekannter Dienste mit lesbaren Schlüsseln", () => {
  const abo = (endpoint: string, p256dh = P256DH_OK, auth = AUTH_OK) => ({ endpoint, keys: { p256dh, auth } });
  for (const gut of [
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://fcm.googleapis.com/wp/abc",
    "https://web.push.apple.com/QGv",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://wns2-par02p.notify.windows.com/w/?token=x",
  ])
    assert.ok(istPushAbo(abo(gut)) && istPushEndpunkt(gut), gut);
  for (const schlecht of [
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com.angreifer.example/x",
    "https://angreifer.example/fcm.googleapis.com/x",
    "https://evilpush.apple.com.example/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com",
    `https://fcm.googleapis.com/${"x".repeat(1100)}`,
  ])
    assert.ok(!istPushAbo(abo(schlecht)) && !istPushEndpunkt(schlecht), schlecht);
  assert.ok(!istPushAbo(abo("https://fcm.googleapis.com/x", "kaputt")));
  assert.ok(!istPushAbo(abo("https://fcm.googleapis.com/x", P256DH_OK, "<script>")));
  assert.ok(!istPushAbo(null) && !istPushAbo({ endpoint: "https://fcm.googleapis.com/x" }) && !istPushEndpunkt(42));
});

pruefe("Mitteilungen (#483 PC 4): Antworten der Dienste — 2xx zugestellt, 404/410 weg, sonst nochmals", () => {
  assert.equal(pushErgebnis(201), "zugestellt");
  assert.equal(pushErgebnis(200), "zugestellt");
  assert.equal(pushErgebnis(404), "weg");
  assert.equal(pushErgebnis(410), "weg");
  for (const s of [400, 403, 413, 429, 500, 503, null]) assert.equal(pushErgebnis(s), "fehler", String(s));
});

pruefe("Mitteilungen (#483 AK 8, 9): Titel mit Ereignis und Team, Text mit Vorname, Antippen öffnet die Benachrichtigungen", () => {
  const link = "a".repeat(43);
  const termin = { team: "E-Junioren", art: "spiel" as const, bezeichnung: "Match gegen Uster", datum: "2026-12-05", beginn: "14:00", ende: "15:30", ort: "Allmend" };
  const basis = { id: "11111111-1111-4111-8111-111111111111", termin_id: null, erstellt: 1, erstellt_tag: "2026-11-20" };
  const neu = mitteilungInhalt({ vorname: "Lena", link, eintrag: { ...basis, ereignis: "neues_spiel", inhalt: termin } });
  assert.deepEqual(neu, {
    titel: "Neues Spiel · E-Junioren",
    text: "Lena: Match gegen Uster · Samstag, 5. Dezember · 14:00–15:30 · Allmend",
    url: `/abmelden/${link}?ansicht=benachrichtigungen`,
    tag: basis.id,
  });
  assert.ok(neu.url.startsWith(pushBereich(link)), "im Bereich des Service Workers");
  const aus = mitteilungInhalt({ vorname: "Noah", link, eintrag: { ...basis, ereignis: "ausfall", inhalt: { ...termin, art: "training", bezeichnung: null, ort: null, grund: "Platz gesperrt" } } });
  assert.equal(aus.titel, "Fällt aus · E-Junioren");
  assert.equal(aus.text, "Noah: Training · Samstag, 5. Dezember · 14:00–15:30 · Grund: Platz gesperrt");
  const serie = mitteilungInhalt({
    vorname: "Mia",
    link,
    eintrag: { ...basis, ereignis: "serie", inhalt: { team: "E-Junioren", art: "training", ab: "2026-12-01", angaben: { beginn: "18:00", ende: "19:30" }, wegfall: null } },
  });
  assert.equal(serie.titel, "Trainings geändert · E-Junioren");
  assert.equal(serie.text, "Mia: Training · Ab Dienstag, 1. Dezember · Neu 18:00–19:30");
  const lang = mitteilungInhalt({ vorname: "Lena", link, eintrag: { ...basis, ereignis: "ausfall", inhalt: { ...termin, grund: "x".repeat(500) } } });
  assert.equal(lang.text.length, MITTEILUNG_TEXT_MAX);
  assert.ok(lang.text.endsWith("…"));
});

pruefe("Mitteilungen (#483): Service Worker — nur push und notificationclick, kein fetch, kein Cache, nur im eigenen Bereich", () => {
  assert.equal(SERVICE_WORKER_PFAD, "/abmelden/sw.js");
  assert.ok(existsSync(join(web, "app/(privat)/abmelden/sw.js/route.ts")));
  const ereignisse = [...SERVICE_WORKER_QUELLE.matchAll(/addEventListener\("([a-z]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(ereignisse, ["activate", "install", "notificationclick", "push"]);
  assert.ok(!/fetch|caches|importScripts|indexedDB/.test(SERVICE_WORKER_QUELLE), "kein fetch, kein Cache");
  assert.match(SERVICE_WORKER_QUELLE, /u\.origin === self\.location\.origin/, "nur die eigene Herkunft");
  assert.match(SERVICE_WORKER_QUELLE, /startsWith\(bereich/, "nur innerhalb des Links");
  // Der Bereich je Link ist derselbe wie der des Manifests (#650).
  const link = "b".repeat(43);
  assert.equal(pushBereich(link), linkManifest({ token: link, vorname: "X", verein: "Y" }).scope);
});

pruefe("Mitteilungen (#652 Review): Service Worker zeigt jeden Push als Mitteilung — ohne oder mit unlesbarer Nutzlast einen Ersatz, der die Benachrichtigungen öffnet", () => {
  const bereich = `https://ki-fu.ch/abmelden/${"b".repeat(43)}`;
  const hoerer = new Map<string, (e: unknown) => void>();
  const gezeigt: { titel: string; body: string; url: unknown }[] = [];
  const swSelf = {
    addEventListener: (n: string, f: (e: unknown) => void) => hoerer.set(n, f),
    registration: {
      scope: bereich,
      showNotification: (titel: string, o: { body: string; data: { url: unknown } }) => {
        gezeigt.push({ titel, body: o.body, url: o.data.url });
        return Promise.resolve();
      },
    },
    location: { origin: "https://ki-fu.ch" },
  };
  new Function("self", SERVICE_WORKER_QUELLE)(swSelf);
  const push = (data: unknown) => hoerer.get("push")!({ data, waitUntil: () => {} });
  push(null);
  push({ json: () => { throw new SyntaxError("kaputt"); } });
  push({ json: () => ({ text: "ohne Titel" }) });
  push({ json: () => ({ titel: "Neues Spiel · Adler", text: "Lea: Cup", url: "/abmelden/x?ansicht=benachrichtigungen", tag: "t" }) });
  assert.equal(gezeigt.length, 4, "jeder Push zeigt eine Mitteilung (Safari: kein stiller Push)");
  for (const g of gezeigt.slice(0, 3))
    assert.deepEqual(g, { titel: MITTEILUNG_ERSATZ.titel, body: MITTEILUNG_ERSATZ.text, url: `${bereich}?ansicht=benachrichtigungen` });
  assert.deepEqual(gezeigt[3], { titel: "Neues Spiel · Adler", body: "Lea: Cup", url: "/abmelden/x?ansicht=benachrichtigungen" });
});

pruefe("Mitteilungen (#652 Review): Notbremse länger als das Zeitlimit des Senders; ohne VAPID verwirft die Route die Aufträge", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  // Meldete die Notbremse «fehler», während web-push noch zustellt, käme die Mitteilung doppelt.
  assert.ok(PUSH_ZEITLIMIT_MS > PUSH_TIMEOUT_MS);
  assert.match(lies("lib/kern/push.ts"), /timeoutMs = PUSH_ZEITLIMIT_MS,/);
  assert.match(lies("lib/push/senden.ts"), /timeout: PUSH_TIMEOUT_MS,/);
  // Ohne VAPID holt die Route ohne Schlüssel (alle Aufträge fallen weg), statt sie liegen zu lassen (#444).
  assert.match(lies("app/api/push/abarbeiten/route.ts"), /if \(!vapid\) \{\s*const verworfen = await pushZugang\(createAnonClient\(\), geheimnis, null\)\.holen\(1\);/);
  assert.match(PUSH_MIGRATION, /if p_schluessel is null then\s*delete from push_auftraege where true;[^\n]*\n\s*return '\[\]'::jsonb;/);
});

pruefe("Mitteilungen (#652 Review): Spielerliste fragt Glocken gleichzeitig; Einschalten nimmt nur eine in diesem Durchgang neue Anmeldung zurück", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  assert.match(lies("lib/kern/spieler.ts"), /Promise\.all\(\[[\s\S]{0,300}"spieler_weitere_teams"[\s\S]{0,120}"team_spieler_mitteilungen"/);
  const m = lies("components/privat/Mitteilungen.tsx");
  const ein = m.slice(m.indexOf("async function einschalten()"), m.indexOf("return { stand"));
  // Eine wiederverwendete Anmeldung kennt die Datenebene vielleicht schon: abmelden nur, wenn neu, sonst neu prüfen.
  assert.match(ein, /if \(anmeldung && neu\) \{\s*await anmeldung\.unsubscribe\(\)[\s\S]*?\} else await pruefen\(\);/);
  assert.match(ein, /subscribe\(\{[^}]*\}\);\s*neu = true;/);
  // Ausser beim fremden Schlüssel (taugt nie) meldet nur `zuruecknehmen` ab.
  assert.equal((ein.match(/\.unsubscribe\(\)/g) ?? []).length, 2);
});

const KOPF_REGELN = await (await import("../next.config")).default.headers!();
pruefe("Manifest des Links (#652 Review): schlanke Abfrage und zwischenspeicherbar, die übrigen Schutz-Header bleiben", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const route = lies("app/(privat)/abmelden/[privaterLink]/manifest.webmanifest/route.ts");
  assert.ok(!/ladeLinkAnsicht|spieler_link_ansicht/.test(route), "nicht die ganze Ansicht");
  assert.match(route, /ladeLinkApp\(/);
  assert.match(lies("lib/privater-link.ts"), /\.rpc\("spieler_link_app"/);
  const fuer = (pfad: string) => {
    const kopf = new Map<string, string>();
    // Wie Next: Jede passende Regel setzt ihre Header, eine spätere überschreibt denselben Schlüssel.
    for (const r of KOPF_REGELN) {
      const muster = new RegExp(`^${r.source.replace(/\./g, "\\.").replace(/:\w+\*/g, ".*").replace(/:\w+/g, "[^/]+")}$`);
      if (muster.test(pfad)) for (const h of r.headers) kopf.set(h.key, h.value);
    }
    return kopf;
  };
  const link = "b".repeat(43);
  const manifest = fuer(`/abmelden/${link}/manifest.webmanifest`);
  assert.match(manifest.get("Cache-Control") ?? "", /^private, max-age=\d+$/);
  for (const k of ["Referrer-Policy", "X-Robots-Tag", "X-Frame-Options", "Content-Security-Policy"]) assert.ok(manifest.has(k), k);
  assert.equal(fuer(`/abmelden/${link}`).get("Cache-Control"), "private, no-store", "die Seite selbst nirgends zwischenspeichern");
});

pruefe("Mitteilungen (#483): Route und Schlüssel — force-dynamic, nodejs, kein Service-Role-Schlüssel, keine NEXT_PUBLIC", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const route = lies("app/api/push/abarbeiten/route.ts");
  assert.match(route, /export const dynamic = "force-dynamic";/);
  assert.match(route, /export const runtime = "nodejs";/);
  assert.match(route, /createAnonClient\(\)/);
  for (const d of ["app/api/push/abarbeiten/route.ts", "lib/kern/push.ts", "lib/push/senden.ts", "lib/push/schluessel.ts"])
    assert.ok(!/SERVICE_ROLE|supabaseServiceRoleKey|supabase\/admin/.test(lies(d)), `${d}: Service-Role zur Laufzeit`);
  for (const d of ["lib/env.ts", "lib/push.ts", "lib/push/schluessel.ts", "components/privat/Mitteilungen.tsx", "app/(privat)/abmelden/[privaterLink]/page.tsx", "../.env.example".replace("../", "")])
    if (existsSync(join(web, d))) assert.ok(!/NEXT_PUBLIC_VAPID/.test(lies(d)), `${d}: NEXT_PUBLIC`);
  assert.match(lies("lib/env.ts"), /VAPID_PUBLIC_KEY[\s\S]*VAPID_PRIVATE_KEY[\s\S]*VAPID_SUBJECT/);
  assert.match(lies(".env.example"), /VAPID_PUBLIC_KEY/);
  assert.match(lies("middleware.ts"), /\|api\/push\|/, "keine Sitzung für die Route");
  // Der öffentliche Schlüssel als Bytes, und der Vergleich einer bestehenden Anmeldung.
  const key = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
  const bytes = schluesselBytes(key);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4, "unkomprimierter P-256-Punkt");
  assert.ok(gleicherSchluessel(bytes.buffer, key));
  assert.ok(!gleicherSchluessel(schluesselBytes(key.replace("BEl6", "BEl7")).buffer, key));
  assert.ok(!gleicherSchluessel(null, key));
});

pruefe("Mitteilungen (#483 PC 5): sync-staging leert die Geräte nach dem Restore, die Tabellen stehen in PUBLIC_TABLES", () => {
  const yml = readFileSync(join(web, "../.github/workflows/sync-staging.yml"), "utf8");
  const liste = /PUBLIC_TABLES: "([^"]+)"/.exec(yml)?.[1].split(" ") ?? [];
  assert.ok(liste.includes("push_abos") && liste.includes("push_auftraege"));
  assert.deepEqual(liste, [...liste].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), "bytewise sortiert");
  assert.match(yml, /delete from public\.push_auftraege;\s*\n\s*delete from public\.push_abos;/);
});

pruefe("Mitteilungen (#483 AK 2–4, 10, 11, 13; PC 6): Texte — Begriff «Mobile», was gespeichert wird, wer zustellt, wann es verschwindet", () => {
  const v = "Lena";
  const dialog = [
    MITTEILUNGEN_TEXT.dialogTitel(v),
    MITTEILUNGEN_TEXT.speichert,
    MITTEILUNGEN_TEXT.zusteller,
    MITTEILUNGEN_TEXT.verschwindet(v),
  ].join(" ");
  assert.equal(MITTEILUNGEN_TEXT.dialogTitel(v), "Mitteilungen für Lena einschalten");
  assert.match(dialog, /Keine Telefonnummer, keine E-Mail-Adresse/);
  assert.match(dialog, /Apple, Google oder Mozilla/);
  assert.match(dialog, /Server im Ausland/);
  assert.match(dialog, /verschlüsselt/);
  for (const wann of ["ausschaltest", "keine mehr annimmt", "Link erneuert", "nicht mehr im Verein"]) assert.ok(dialog.includes(wann), wann);
  assert.equal(MITTEILUNGEN_TEXT.stand.aus, "Aus. Neues siehst du nur hier.");
  assert.equal(MITTEILUNGEN_TEXT.stand.an, "Auf diesem Gerät eingeschaltet. Andere Mobiles schaltest du dort ein.");
  assert.equal(MITTEILUNGEN_TEXT.stand.ios_browser, "Auf dem iPhone nur in der abgelegten App.");
  assert.equal(MITTEILUNGEN_TEXT.stand.abgelehnt, "Dein Mobile lässt keine Mitteilungen zu.");
  assert.match(MITTEILUNGEN_TEXT.grenze(v), new RegExp(`${PUSH_MAX_GERAETE} Geräten`));
  // AK 4: der Hinweis zum Ablegen nennt die Mitteilungen, wenn es sie gibt.
  assert.ok(APP_ABLEGEN_TEXT.hinweisText(v, true).endsWith(APP_ABLEGEN_MITTEILUNGEN));
  assert.match(APP_ABLEGEN_MITTEILUNGEN, /Mitteilungen aufs Mobile/);
  // AK 10: das Häkchen.
  for (const vorgang of ["neues_spiel", "ausfall", "ruecknahme", "aendern", "entfernen"] as const)
    assert.ok(benachrichtigenHinweis(vorgang).endsWith(BENACHRICHTIGEN_MOBILE), vorgang);
  assert.match(BENACHRICHTIGEN_MOBILE, /als Mitteilung aufs Mobile/);
  // AK 11: die Spalte.
  assert.equal(MITTEILUNGEN_SPALTE.kopf, "Mobile");
  assert.equal(
    MITTEILUNGEN_SPALTE.hinweis,
    "Glocke heisst: Nach dem letzten bekannten Stand erhält mindestens ein Mobile Mitteilungen für diese Spieler:in. Ankommen ist damit nicht gesichert.",
  );
  // AK 13: Link erneuern.
  assert.ok(LINK_TEXT.erneuern.endsWith(LINK_ERNEUERN_MITTEILUNGEN));
  assert.match(LINK_ERNEUERN_MITTEILUNGEN, /neu ein und legt die App neu ab/);
  // PC 6: die Auskunft, was KiFu speichert.
  assert.ok(abholSpeichertText("FC Wyler").includes(ABHOL_MITTEILUNGEN));
  assert.match(ABHOL_MITTEILUNGEN, /ohne Telefonnummer und E-Mail-Adresse/);
  // Die Seite «Cookies» nennt Service Worker und Anmeldung (#409).
  assert.ok(SPEICHERUNGEN.some((x) => x.name.includes(SERVICE_WORKER_PFAD)), "SPEICHERUNGEN nennt den Service Worker");
  const alle =
    JSON.stringify(MITTEILUNGEN_TEXT) +
    dialog +
    MITTEILUNGEN_TEXT.iosHinweis(v) +
    MITTEILUNGEN_TEXT.grenze(v) +
    JSON.stringify(MITTEILUNGEN_SPALTE) +
    BENACHRICHTIGEN_MOBILE +
    LINK_ERNEUERN_MITTEILUNGEN +
    ABHOL_MITTEILUNGEN +
    APP_ABLEGEN_MITTEILUNGEN +
    JSON.stringify(SPEICHERUNGEN);
  assert.ok(!/Handy/i.test(alle), "«Mobile», nie «Handy»");
  assert.ok(!/\bKind/.test(alle) && !/\bProbe/.test(alle), "Spieler:in, nie Kind; kein «Probe»");
});

pruefe("Eigene Inhalte über die Bibliothek (#660): kein Eintrag «Meine Bibliothek», der Chip grenzt ein, Bestand und alte Adressen bleiben", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // AK 1: Die Leiste führt keine eigenen Einträge für eigene Übungen und Trainings.
  const nav = ohneKommentare(lies("components/layout/AppNavClient.tsx"));
  assert.ok(!/Meine Bibliothek|Meine Übungen|Meine Trainings/.test(nav), "keine Gruppe «Meine Bibliothek»");
  assert.ok(!/aktiv\.meine|mine=1|get\("mine"\)/.test(nav), "die Leiste liest `?mine=1` nicht mehr");
  const demo = ohneKommentare(lies("app/(app)/styleguide/SeitenleisteDemo.tsx"));
  assert.ok(!/Meine Bibliothek/.test(demo), "die Demo im Styleguide ebenso");
  // Die Eingrenzung ändert den offenen Eintrag nicht: «Übungen» bzw. «Trainings» bleibt aktiv.
  assert.ok(!/\bmine\b/.test(ohneKommentare(lies("lib/navigation.ts"))), "navigation.ts kennt `mine` nicht");
  assert.equal(aktiveBereiche.length, 2, "aktiveBereiche(pfad, imTeamBereich)");
  assert.deepEqual(aktiveBereiche("/", false), { uebungen: false, trainings: false }, "«/» ist die Startseite (#670)");
  assert.deepEqual(aktiveBereiche("/uebung/abc", false), { uebungen: true, trainings: false });
  assert.deepEqual(aktiveBereiche("/trainings", false), { uebungen: false, trainings: true });
  assert.deepEqual(aktiveBereiche("/training/abc", false), { uebungen: false, trainings: true });
  assert.deepEqual(aktiveBereiche("/training/abc", true), { uebungen: false, trainings: false }, "ein Team-Training gehört zum Team");
  assert.deepEqual(aktiveBereiche("/konto", false), { uebungen: false, trainings: false });
  // AK 2, AK 3, PC 1: Die Bibliotheken lesen `?mine=1` weiter (bisherige Adressen und Verweise),
  // bieten den Chip und zeigen eingegrenzt den Bestand von der Grenze.
  for (const [seite, filterleiste, art] of [
    ["app/(app)/uebungen/page.tsx", "CatalogFilterBar", "uebungen"],
    ["app/(app)/trainings/page.tsx", "TrainingFilterBar", "trainings"],
  ] as const) {
    const text = lies(seite);
    assert.match(text, /sp\.mine === "1"/, `${seite}: liest ?mine=1`);
    // Nur mit Konto (#669): die Seite setzt die Anmeldung voraus, der Chip steht immer.
    assert.match(text, /if \(!user\) redirect\(loginAdresse\(/, `${seite}: nur mit Konto, Rücksprung samt Abfrage`);
    assert.ok(!/!!user/.test(ohneKommentare(text)), `${seite}: kein Zweig ohne Konto`);
    assert.match(text, new RegExp(`\\{grenzen && <BestandAnzeige art="${art}"`), `${seite}: Bestand bei Eingrenzung`);
  }
  for (const d of ["components/catalog/CatalogFilterBar.tsx", "components/training/TrainingFilterBar.tsx", "app/(app)/trainings/page.tsx"])
    assert.ok(!/canFavorite|showMine/.test(lies(d)), `${d}: Chips ohne Schalter`);
  assert.match(lies("components/catalog/CatalogFilterBar.tsx"), /filter\.schalte\("mine"/);
  assert.match(lies("components/training/TrainingFilterBar.tsx"), /filter\.schalte\("mine"/);
});

pruefe("Konto-Menü in der Navigation (#661): eine Stelle für Konto, Darstellung, Feedback, Neuigkeiten und Abmelden, auch ohne Anmeldung", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // Kit: Die Fusszeilen der Leiste (Feedback, Darstellung, Version) und der Anmelde-Knopf sind weg;
  // unten steht nur die Konto-Karte, ein Knopf mit Menü.
  const leiste = ohneKommentare(lies("components/ui/Seitenleiste.tsx"));
  const props = leiste.slice(leiste.indexOf("export interface SeitenleisteProps"), leiste.indexOf("/* ── Breite"));
  assert.ok(props.length > 0, "SeitenleisteProps gefunden");
  for (const weg of ["version", "feedback", "darstellung", "anmeldenHref"])
    assert.ok(!new RegExp(`\\b${weg}\\??:`).test(props), `Seitenleiste ohne Prop «${weg}»`);
  assert.match(props, /\bkonto: SeitenleisteKonto;/, "die Konto-Karte gibt es immer, auch ohne Anmeldung");
  assert.ok(!/DarstellungZeile|DARSTELLUNGEN|ButtonLink|SeitenleisteVersion|SeitenleisteFeedback|SeitenleisteDarstellung/.test(leiste), "keine Reste der Fusszeilen");
  assert.ok(!/SeitenleisteVersion|SeitenleisteFeedback|SeitenleisteDarstellung/.test(lies("components/ui/index.ts")), "keine Exporte der alten Typen");
  const karte = leiste.slice(leiste.indexOf("function KontoKarte"), leiste.indexOf("function Marke"));
  assert.match(karte, /aria-haspopup="menu"/);
  assert.match(karte, /aria-expanded=\{!!lage\}/);
  assert.match(karte, /data-hinweis=\{lage \? undefined : hinweis\}/, "offen weicht der Hinweis dem Menü");
  assert.match(karte, /e\.key !== "Tab"\) return;\s*e\.preventDefault\(\);\s*zu\(\);\s*knopfRef\.current\?\.focus\(\);/, "Tab schliesst und gibt den Fokus an die Karte");
  assert.match(karte, /m\.gewaehlt === undefined\s*\?[\s\S]*?onNavigiert\(\);/, "Ziele und Aktionen schliessen den Drawer, die Darstellung nicht");
  assert.match(karte, /\{neu && \(\s*<span[^>]*>\s*<ZeichenPunkt ton="primary" \/>/, "Punkt am Avatar bei neuer Version, breit wie schmal");
  assert.match(karte, /<span className="sr-only">, neue Version erschienen<\/span>/, "der Punkt hat seinen Text");
  // Das Menü passt ins Fenster (Drawer auf einem Handy quer) und scrollt in sich, ohne zuzugehen.
  assert.match(karte, /"--konto-menue-hoehe": `\$\{Math\.max\(unterkante - 8, 0\)\}px`/, "Höchsthöhe aus dem Platz über der Unterkante");
  assert.match(karte, /max-h-\(--konto-menue-hoehe\)[^"]*overflow-y-auto/, "das Menü scrollt in sich");
  assert.match(karte, /if \(menueRef\.current\?\.contains\(e\.target as Node\)\) return;\s*schliessen\(\);/, "Scrollen im Menü schliesst es nicht");
  assert.match(karte, /useEffect\(\(\) => setLage\(null\), \[pfad\]\);/, "ein Seitenwechsel schliesst das Menü (auch nach der Warnung #246)");
  assert.match(karte, /const menueName = anonym \? "Ohne Konto" : "Konto";[\s\S]*label=\{menueName\}/, "Menüname getrennt vom Hinweis «Anmelden»");
  // Die Fokusfalle des Drawers überlässt Escape und Tab dem offenen Menü (es steht `fixed`).
  assert.match(leiste, /const imMenue = [^;]*closest\?\.\('\[role="menu"\]'\)/);
  assert.match(leiste, /if \(e\.key !== "Tab" \|\| !navRef\.current \|\| imMenue\) return;/);

  // Menü: Ziele werden Links (die Warnung vor ungesicherten Angaben fängt nur Links ab), Gruppen
  // haben einen Namen; `fuss` ist ungenutzt und weg.
  const menu = ohneKommentare(lies("components/ui/Menu.tsx"));
  assert.match(menu, /\{item\.href \? \(\s*<Link\s+href=\{item\.href\}\s+role="menuitem"/);
  assert.match(menu, /<div role="group" aria-label=\{a\.gruppe\}>/);
  assert.match(menu, /role="menuitem"\s+aria-current=\{aktuell \? "page" : undefined\}/, "die offene Seite ist am Ziel genannt");
  assert.ok(!/\bfuss\b/.test(menu), "Menü ohne `fuss`");

  // Navigation: die Einträge des Menüs in der Reihenfolge des Entwurfs.
  const nav = ohneKommentare(lies("components/layout/AppNavClient.tsx"));
  const stelle = (t: string, s: string) => {
    const i = t.indexOf(s);
    assert.ok(i >= 0, `«${s}» fehlt`);
    return i;
  };
  const angemeldet = nav.slice(stelle(nav, "const menue: MenuItemDef[] = konto"), stelle(nav, '{ label: "Anmelden"'));
  const reihe = [
    '{ label: "Konto und Einstellungen", icon: Settings, href: "/konto", current: imKonto }',
    "...(umschaltbar",
    'gruppe: "Darstellung"',
    'hinweis: i === DARSTELLUNGEN.length - 1 ? "Gilt in diesem Browser." : undefined',
    "{ label: FEEDBACK_TITEL, icon: MessageSquare, trenner: umschaltbar, onSelect: feedback.oeffnen }",
    "wasIstNeu,",
    "startseite,",
    'label: "Abmelden"',
    "nachRueckfrage(() => {",
    "void signOut();",
  ].map((s) => stelle(angemeldet, s));
  assert.deepEqual(reihe, [...reihe].sort((a, b) => a - b), "angemeldet: Konto, Darstellung, Feedback, Was ist neu, Startseite, Abmelden");
  const anonym = nav.slice(stelle(nav, '{ label: "Anmelden"'), stelle(nav, "return ("));
  const reiheAnonym = [
    '{ label: "Anmelden", icon: LogIn, href: "/login" }',
    '{ label: "Konto erstellen", icon: UserPlus, href: "/registrieren" }',
    "{ ...wasIstNeu, trenner: true }",
    "startseite,",
  ].map((s) => stelle(anonym, s));
  assert.deepEqual(reiheAnonym, [...reiheAnonym].sort((a, b) => a - b), "ohne Anmeldung: Anmelden, Konto erstellen, Was ist neu, Startseite");
  // Die Startseite bewusst (#671 AK 1): ein Link, kein Knopf.
  assert.match(nav, /const startseite: MenuItemDef = \{ label: "Startseite", icon: House, href: STARTSEITE_PFAD \};/);
  assert.ok(!/FEEDBACK_TITEL|waehle|signOut/.test(anonym), "ohne Konto weder Feedback, Darstellung noch Abmelden");
  const neuigkeiten = nav.slice(stelle(nav, "const wasIstNeu: MenuItemDef"), stelle(nav, "const menue"));
  assert.match(neuigkeiten, /href: "\/versionen",\s*current: pfad === "\/versionen",/);
  assert.match(neuigkeiten, /trailing: neu \? \([\s\S]*<Lozenge appearance="discovery">[\s\S]*\) : \([\s\S]*\{version\}/, "Plakette «Neu» oder die Versionsnummer");
  assert.equal(nav.match(/signOut/g)?.length, 2, "signOut: ein Import, ein Aufruf");
  assert.match(nav, /const imKonto = pfad === "\/konto" \|\| pfad\.startsWith\("\/konto\/"\);/);
  assert.match(nav, /\.\.\.konto,\s*current: imKonto,/, "die Karte ist auf jeder Konto-Seite hervorgehoben");
  // Abmelden ist kein Link: Es fragt die Warnung vor ungesicherten Angaben selbst (#246).
  const warnung = ohneKommentare(lies("components/layout/VerlassenWarnung.tsx"));
  assert.match(warnung, /export function nachRueckfrage\(weiter: \(\) => void\)/);
  assert.match(warnung, /if \(window\.dispatchEvent\(anfrage\)\) weiter\(\);/, "ohne scharfe Warnung läuft es sofort");
  assert.match(warnung, /window\.addEventListener\(ANFRAGE, anfrage\);/);
  assert.match(warnung, /window\.removeEventListener\(ANFRAGE, anfrage\);/);
  assert.match(nav, /name: "Nicht angemeldet", email: "Anmelden oder Konto erstellen", anonym: true, neu, menue/);
  assert.match(ohneKommentare(lies("components/layout/AppNav.tsx")), /version=\{APP_VERSION\}/, "die Nummer kommt vom Server");
  // Im Styleguide zeigt die Demo das Menü angemeldet und ohne Anmeldung.
  const demo = ohneKommentare(lies("app/(app)/styleguide/SeitenleisteDemo.tsx"));
  assert.match(demo, /menue: kontoMenue\(angemeldet, neu, darstellung, setDarstellung\)/);
});

pruefe("Konto in Themen gegliedert (#662): Profil, Verbindungen sowie Daten und Konto je mit eigener Adresse; Verweise führen zu «Verbindungen»", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // AK 1: drei Reiter, genau diese drei Adressen; jede Seite setzt ihren Reiter.
  const rahmen = ohneKommentare(lies("app/(app)/konto/KontoRahmen.tsx"));
  assert.deepEqual(
    [...rahmen.matchAll(/\{ id: "(\w+)", label: "([^"]+)", href: "([^"]+)" \}/g)].map((m) => [m[1], m[2], m[3]]),
    [
      ["profil", "Profil", "/konto"],
      ["verbindungen", "Verbindungen", "/konto/verbindungen"],
      ["daten", "Daten und Konto", "/konto/daten"],
    ],
  );
  assert.match(rahmen, /<TabNav\s+ariaLabel="Bereiche des Kontos"/);
  assert.match(rahmen, /current: r\.id === reiter/);
  for (const [seite, reiter] of [
    ["app/(app)/konto/page.tsx", "profil"],
    ["app/(app)/konto/verbindungen/page.tsx", "verbindungen"],
    ["app/(app)/konto/daten/page.tsx", "daten"],
  ] as const) {
    const text = ohneKommentare(lies(seite));
    assert.match(text, new RegExp(`<KontoRahmen reiter="${reiter}">`), seite);
    assert.match(text, /export const dynamic = "force-dynamic";/, `${seite}: je Anfrage frisch`);
    assert.match(text, /export const metadata: Metadata = \{ title: "[^"]+ - KiFu", robots: \{ index: false \} \};/, seite);
  }
  // Abmelden gibt es nur im Konto-Menü (#661), «Meine Übungen» nur über den Chip der Bibliothek (#660).
  for (const datei of quelldateien(join(web, "app/(app)/konto"))) {
    const text = ohneKommentare(readFileSync(datei, "utf8"));
    assert.ok(!/signOut/.test(text), `${relative(web, datei)}: kein Abmelden auf den Konto-Seiten`);
    assert.ok(!/mine=1|Meine Übungen/.test(text), `${relative(web, datei)}: kein Verweis «Meine Übungen»`);
  }
  // AK 2: E-Mail zum Lesen, Anzeigename zum Ändern, der Weg zu einem neuen Passwort.
  const profil = ohneKommentare(lies("app/(app)/konto/page.tsx"));
  assert.match(profil, /\{user\.email\}/);
  assert.match(profil, /<AnzeigenameForm aktuell=\{anzeigeName\} \/>/);
  assert.match(profil, /href="\/passwort-vergessen"/);
  // AK 3: KI-Zugänge (Adresse, Anleitung, Widerruf) und Kalender-Abos.
  const verbindungen = ohneKommentare(lies("app/(app)/konto/verbindungen/page.tsx"));
  assert.match(verbindungen, /<KopierFeld label="Adresse für den KI-Assistenten" value=\{adresse\}/);
  assert.match(verbindungen, /<Disclosure title="So verbindest du Claude Desktop, claude\.ai oder Claude Code"/);
  assert.match(verbindungen, /<KiZugaengeListe zugaenge=\{zugaenge\} \/>/);
  assert.match(verbindungen, /<AbosListe abos=\{abos\} \/>/);
  // AK 4: Die Kurzfassung leitet sich aus der einen Liste der Speicherungen ab; Löschen in der Gefahrenzone.
  const daten = ohneKommentare(lies("app/(app)/konto/daten/page.tsx"));
  assert.match(daten, /SPEICHERUNGEN\.map\(\(s\) => s\.titel\)/);
  assert.match(daten, /href="\/cookies"/);
  assert.match(daten, /<Gefahrenzone>[\s\S]*<KontoClient info=\{loeschInfo\.wert\} \/>[\s\S]*<\/Gefahrenzone>/);
  // Die Aktionen frischen das Thema auf, das ihre Liste zeigt.
  assert.match(lies("lib/actions/abos.ts"), /revalidatePath\("\/konto\/verbindungen"\);/);
  const kiAktionen = lies("lib/actions/ki-zugaenge.ts");
  assert.equal(kiAktionen.match(/revalidatePath\("\/konto\/verbindungen"\);/g)?.length, 2, "erlauben und widerrufen");
  assert.ok(!/revalidatePath\("\/konto"\)/.test(kiAktionen + lies("lib/actions/abos.ts")), "nicht mehr das Profil");
  // AK 5: Jeder Verweis auf KI-Zugänge oder Abos führt zu «Verbindungen».
  assert.match(lies("app/(auth)/oauth/consent/page.tsx"), /<ButtonLink href="\/konto\/verbindungen" variant="link">\s*Zu den Verbindungen/);
  assert.match(lies("app/(auth)/oauth/consent/ZustimmungFormular.tsx"), /im Konto unter «Verbindungen» widerrufen/);
  assert.match(lies("components/team/AboDialog.tsx"), /Unter «Konto › Verbindungen» findest du deine Abos wieder/);
  assert.match(lies("lib/mcp/regeln.ts"), /"Widerrufe zuerst einen davon im Konto unter «Verbindungen» /);
  assert.match(lies("lib/mcp/werkzeuge/konto.ts"), /konto_url: zugang\.url\("konto", "verbindungen"\)/);
  // Die Seite «Cookies» hängt unter «Daten und Konto».
  assert.match(
    lies("app/(app)/cookies/page.tsx"),
    /\[\{ label: "Konto", href: "\/konto" \}, \{ label: "Daten und Konto", href: "\/konto\/daten" \}, \{ label: "Cookies" \}\]/,
  );
});

pruefe("Übungskatalog an eigener Adresse (#674): «/uebungen», alte Filter-Adressen «/?…» leiten weiter, Verweise führen zum Katalog", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(UEBUNGEN_PFAD, "/uebungen");
  // AK 1 + 2: «/» leitet jede Adresse mit Katalog-Filter samt Parametern weiter; ohne Filter gilt die Startseite.
  assert.deepEqual([...KATALOG_PARAMETER], ["teil", "kat", "feld", "form", "typ", "kinder", "q", "fav", "mine", "anzahl", "deleted", "hkat"]);
  for (const k of KATALOG_PARAMETER) assert.equal(katalogWeiterleitung({ [k]: "1" }), `/uebungen?${k}=1`, `Filter ${k} leitet weiter`);
  assert.equal(katalogWeiterleitung({ kat: ["E", "F"], q: "tor", x: "y" }), "/uebungen?kat=E&kat=F&q=tor&x=y", "alle Parameter reisen mit");
  assert.equal(katalogWeiterleitung({}), null);
  assert.equal(katalogWeiterleitung({ [KONTO_GELOESCHT_PARAMETER]: "1" }), null, "der Hinweis nach dem Löschen des Kontos bleibt auf «/»");
  // Jeder Parameter, den der Katalog liest, steht in der Weiterleitung — ein neuer Filter fällt hier auf.
  const katalog = ohneKommentare(lies("app/(app)/uebungen/page.tsx"));
  for (const [, k] of katalog.matchAll(/\bsp\.([a-z_]+)/g))
    assert.ok((KATALOG_PARAMETER as readonly string[]).includes(k), `«/?${k}=…» leitet zum Katalog weiter`);
  const start = ohneKommentare(lies("app/(start)/page.tsx"));
  assert.match(start, /const katalog = katalogWeiterleitung\(sp\);\s*if \(katalog\) redirect\(katalog\);/);
  assert.ok(!existsSync(join(web, "app/(app)/page.tsx")), "«/» gehört der Startseite, nicht dem App-Layout");
  // AK 3: Verweise auf die Übungen führen zum Katalog, nicht mehr zu «/».
  assert.match(lies("components/layout/AppNavClient.tsx"), /UEBUNGEN_PFAD/);
  for (const d of ["app/(app)/neu/page.tsx", "app/(app)/not-found.tsx", "app/(app)/uebung/[slug]/page.tsx", "app/(app)/uebung/[slug]/edit/page.tsx"])
    assert.match(lies(d), /UEBUNGEN_PFAD/, d);
  assert.match(lies("lib/actions/exercises.ts"), /redirect\("\/uebungen\?mine=1&deleted=1"\)/);
  for (const d of ["lib/actions/exercises.ts", "lib/actions/fassung.ts", "lib/actions/favorites.ts"]) {
    assert.match(lies(d), /revalidatePath\("\/uebungen"\)/, d);
    assert.ok(!/revalidatePath\("\/"\)/.test(lies(d)), `${d}: «/» ist nicht mehr der Katalog`);
  }
  const aktiv = aktiveBereiche("/uebungen", false);
  assert.equal(aktiv.uebungen, true);
});

pruefe("Startseite (#670): eigene Gruppe ohne Seitenleiste, immer hell, feste Angaben am Bestand, Wege hinein und zurück", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const layout = ohneKommentare(lies("app/(start)/layout.tsx"));
  const seite = ohneKommentare(lies("components/start/Startseite.tsx"));
  // Entscheid 1: keine Seitenleiste, eigene Kopfzeile (Marke → «/», Anmelden, Kostenlos registrieren; angemeldet «Zur App»).
  assert.ok(!/AppNav|Seitenleiste|AppRahmen/.test(layout), "ohne App-Chrome");
  assert.match(layout, /<Link href="\/"[^>]*>[\s\S]*?KiFu<\/span>\s*<\/Link>/, "Marke führt auf «/»");
  assert.match(layout, /user \? \(\s*<ButtonLink href="\/" variant="filled">\s*Zur App/);
  assert.match(layout, /<ButtonLink href="\/login" variant="text">\s*Anmelden/);
  assert.match(layout, /<ButtonLink href="\/registrieren" variant="filled"[^>]*>\s*Kostenlos registrieren/);
  // AK 10: Versionen und Cookies in der Fusszeile, dazu das Repository.
  assert.match(layout, /<FussLink href="\/versionen">Versionen<\/FussLink>/);
  assert.match(layout, /<FussLink href="\/cookies">Cookies<\/FussLink>/);
  assert.match(layout, /href=\{REPO_URL\}/);
  assert.equal(REPO_URL, "https://github.com/adbstyle/kifutraining");
  // AK 13: immer hell — Marke für globals.css und die Systemleiste im hellen Grund.
  assert.match(layout, /<DarstellungsMarke darstellung="hell" \/>/);
  assert.match(layout, /colorScheme: "light",\s*themeColor: GRUND_HELL,/);
  assert.match(layout, /<FigurenSprite \/>/, "die Diagramme der Karten brauchen die Figurteile");
  // Eine Komponente für «/» und «/startseite».
  for (const d of ["app/(start)/page.tsx", "app/(start)/startseite/page.tsx"]) {
    const t = ohneKommentare(lies(d));
    assert.match(t, /<Startseite\s+beispiele=/, d);
    assert.match(t, /getStartseitenBeispiele\(\)/, d);
    assert.match(t, /export const dynamic = "force-dynamic";/, d);
  }
  // AK 3: registrieren und anmelden, auch am Schluss der Seite.
  assert.match(seite, /<ButtonLink href="\/registrieren" variant="filled">\s*Kostenlos registrieren/);
  assert.match(seite, /<ButtonLink href="\/login" variant="outlined">\s*Anmelden/);
  // AK 2: Verein, Team und Kalender, Schnuppertraining, Mitteilungen, Training und Übungen, KI-Assistent.
  for (const t of ["Verein", "Team und Kalender", "Abmeldungen ohne Konto", "Schnuppertraining", "Mitteilungen aufs Mobile", "Training und Übungen", "KI-Assistent"])
    assert.ok(seite.includes(`titel="${t}"`), `Leistung «${t}»`);
  // AK 4: feste Zahl der Manual-Übungen (OoS 1: von Hand nachgeführt, hier am Bestand gehalten) und feste Beispiele mit Diagramm.
  const yaml = readdirSync(join(web, "..", "data/uebungen")).filter((f) => f.endsWith(".yaml"));
  assert.equal(MANUAL_UEBUNGEN_ANZAHL, yaml.length, "Zahl der Manual-Übungen = data/uebungen/*.yaml");
  assert.match(seite, /\{MANUAL_UEBUNGEN_ANZAHL\} Übungen aus dem Manual Kinderfussball/);
  assert.equal(STARTSEITE_BEISPIELE.length, 6);
  assert.equal(new Set(STARTSEITE_BEISPIELE).size, 6);
  for (const slug of STARTSEITE_BEISPIELE) {
    assert.ok(yaml.includes(`${slug}.yaml`), `${slug}: aus dem Manual`);
    assert.ok(existsSync(join(web, "..", "data/diagramme", `${slug}.json`)), `${slug}: mit Diagramm`);
  }
  // Nur Manual-Übungen (Epic EK 11): über startseite_beispiele() (#669), siehe dort.
  // AK 5: Der SFV erscheint nur mit dem Hinweis — nirgends sonst auf der Seite.
  assert.match(SFV_HINWEIS, /eigene Fassungen nach dem Manual Kinderfussball des SFV, nicht vom SFV geprüft/i);
  assert.ok(!/\bSFV\b/.test(seite + layout), "der SFV steht nur in SFV_HINWEIS");
  assert.match(seite, /\{SFV_HINWEIS\}/);
  // AK 6: Kinder- und Juniorenfussball, das Manual nur für den Kinderfussball.
  assert.match(seite, /KiFu unterstützt den Kinderfussball \(G, F, E\) und den Juniorenfussball \(D, C, B, A\)\. Die Übungen aus dem\s+Manual decken den Kinderfussball ab/);
  // AK 7, 8: heute gratis, geplanter Preis, Konto ohne Verein gratis und seine Grenzen aus der einen Quelle.
  assert.equal(GEPLANTER_PREIS_CHF, 5);
  assert.match(seite, /KiFu ist heute gratis\. Nach Einführung des Preismodells sind CHF \{GEPLANTER_PREIS_CHF\} pro Team und\s+Monat geplant\./);
  assert.match(seite, /Ein Konto ohne Verein bleibt gratis\. Es hat höchstens \{KONTO_UEBUNGEN_MAX\} eigene Übungen und\{" "\}\s*\{KONTO_TRAININGS_MAX\} eigene Trainings/);
  assert.ok(!/\b(50|30) (eigene|Übungen|Trainings)/.test(seite), "Grenzen nie als Zahl im Text");
  // AK 9: Open Source, selbst betreibbar, Datenort.
  assert.match(seite, /titel="Open Source"/);
  assert.match(seite, /selbst betreiben/);
  assert.match(seite, /titel="Wo die Daten liegen"/);
  // Datenort nicht abschliessend (EK 3, Entscheid 7): selbst verbundene Dienste und der Verweis auf alle Ausnahmen.
  assert.match(seite, /KI-Assistenten und Kalender, die ihr selbst verbindet/);
  assert.match(seite, /<TextLink href="\/datenschutz">Alle Ausnahmen in der Datenschutzerklärung<\/TextLink>/);
  // Serien gibt es nur für Trainings (docs/produkt/team-bereich.md).
  assert.ok(!/Trainings und Spiele als Einzeltermin oder Serie/.test(seite), "keine Serie für Spiele");
  // AK 14: nur erfundene Namen — das Bild nimmt sie aus BEISPIEL_NAMEN, die Seite nennt sonst keine.
  assert.match(seite, /const n = BEISPIEL_NAMEN;/);
  assert.deepEqual([...BEISPIEL_NAMEN.spieler], ["Lena", "Noah", "Mia", "Elias"]);
  // AK 11: Von den Anmeldeseiten und «Nicht gefunden» ohne Anmeldung zur Startseite.
  const auth = ohneKommentare(lies("app/(auth)/layout.tsx"));
  assert.match(auth, /<Link\s+href="\/"[\s\S]*?Zur Startseite\s*<\/Link>/);
  assert.ok(!/Zum Katalog/.test(auth));
  const nichtGefunden = ohneKommentare(lies("app/(app)/not-found.tsx"));
  assert.match(
    nichtGefunden,
    /user \? \(\s*<ButtonLink href=\{UEBUNGEN_PFAD\} variant="link">\s*Zu den Übungen\s*<\/ButtonLink>\s*\) : \(\s*<ButtonLink href="\/" variant="link">\s*Zur Startseite/,
  );
  // AK 12: Die Registrierung nennt den Weg danach.
  assert.match(lies("app/(auth)/registrieren/page.tsx"), /Danach gründest du einen Verein oder lässt dich in Verein und Team aufnehmen\./);
  // PC 1: Abmelden führt auf «/», ohne Sitzung die Startseite.
  assert.match(lies("lib/actions/auth.ts"), /await supabase\.auth\.signOut\(\);\s*redirect\("\/"\);/);
  // PC 2: Nach «Konto löschen» die Bestätigung auf der Startseite, nicht mehr im Katalog.
  assert.ok(lies("lib/actions/auth.ts").includes(`redirect("/?${KONTO_GELOESCHT_PARAMETER}=1");`));
  assert.match(KONTO_GELOESCHT_TEXT, /^Konto gelöscht\. .*Community/);
  assert.ok(!/öffentlich/i.test(KONTO_GELOESCHT_TEXT));
  assert.match(ohneKommentare(lies("app/(start)/page.tsx")), /kontoGeloescht=\{sp\[KONTO_GELOESCHT_PARAMETER\] !== undefined\}/);
  assert.match(seite, /\{kontoGeloescht && \([\s\S]*?<SectionMessage appearance="success">\s*\{KONTO_GELOESCHT_TEXT\}/);
  assert.ok(!/account_deleted/.test(lies("app/(app)/uebungen/page.tsx")), "kein Hinweis mehr im Katalog");
});

pruefe("Angemeldete direkt in ihre Arbeit (#671): «/» führt in den Arbeitsbereich, «/startseite» bleibt erreichbar", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const a = "11111111-1111-4111-8111-111111111111";
  const b = "22222222-2222-4222-8222-222222222222";
  const fremd = "33333333-3333-4333-8333-333333333333";
  // Entscheid 1: Einstieg eines Teams ist der Trainingsplan, der des Vereins die Teams des Vereins.
  assert.equal(bereichPfad({ art: "team", id: a }), `/team/${a}`);
  assert.equal(bereichPfad({ art: "verein" }), "/verein");
  // PC 1: der gemerkte Bereich, dem das Konto noch angehört.
  assert.equal(arbeitsbereichPfad([{ id: a }, { id: b }], true, { art: "team", id: b }), `/team/${b}`);
  assert.equal(arbeitsbereichPfad([{ id: a }, { id: b }], true, { art: "verein" }), "/verein");
  // Sonst der erste: Teams zuerst (Entscheid 2), auch bei einem fremden oder fehlenden gemerkten Bereich (Entscheid 3).
  assert.equal(arbeitsbereichPfad([{ id: a }, { id: b }], true, { art: "team", id: fremd }), `/team/${a}`);
  assert.equal(arbeitsbereichPfad([{ id: a }], true, null), `/team/${a}`);
  // Nur Verwaltung: der Verein; ein gemerktes Team, dem das Konto nicht mehr angehört, gilt nicht.
  assert.equal(arbeitsbereichPfad([], true, null), "/verein");
  assert.equal(arbeitsbereichPfad([], true, { art: "team", id: a }), "/verein");
  // Ohne Verein der Einstieg «Verein gründen oder aufnehmen lassen».
  assert.equal(arbeitsbereichPfad([], false, { art: "verein" }), "/teams");
  assert.equal(arbeitsbereichPfad([], false, null), "/teams");
  // Der Server-Helfer: Cookie des Wechslers, Teams alphabetisch wie im Wechsler, Verein — beide werfen bei Fehlern.
  const helfer = ohneKommentare(lies("lib/arbeitsbereich.ts"));
  assert.match(helfer, /getMeineTeamsImRequest\(\)/);
  assert.match(helfer, /getMeinVereinOderWurf\(\)/);
  assert.ok(!/getMeinVerein\(\)|getMeineTeams\(\)|catch/.test(helfer), "nie ein verschluckter Fehler (sonst «Verein gründen» für Mitglieder)");
  assert.match(helfer, /\.sort\(\(a, b\) => nachTeamname\(a\.name, b\.name\)\)/);
  assert.match(helfer, /leseBereich\(jar\.get\(BEREICH_COOKIE\)\?\.value\)/);
  // «/»: zuerst die Katalog-Weiterleitung, dann angemeldet der Arbeitsbereich, sonst die Startseite.
  const start = ohneKommentare(lies("app/(start)/page.tsx"));
  const reihe = ["katalogWeiterleitung(sp)", "if (user) redirect(nurMitKonto ?? (await getArbeitsbereichPfad()));", "<Startseite"].map((t) => {
    const i = start.indexOf(t);
    assert.ok(i >= 0, t);
    return i;
  });
  assert.deepEqual(reihe, [...reihe].sort((x, y) => x - y));
  assert.match(start, /angemeldet=\{false\}/, "auf «/» nie angemeldet");
  // AK 1: «/startseite» auch angemeldet, nicht indexiert, kanonisch «/».
  assert.equal(STARTSEITE_PFAD, "/startseite");
  const bewusst = ohneKommentare(lies("app/(start)/startseite/page.tsx"));
  assert.ok(!/redirect/.test(bewusst), "keine Weiterleitung");
  assert.match(bewusst, /robots: \{ index: false \},\s*alternates: \{ canonical: "\/" \},/);
  assert.match(bewusst, /angemeldet=\{user !== null\}/);
  // Anmeldung ohne Ziel und bestätigte Registrierung fallen auf «/» zurück — und damit in den Arbeitsbereich.
  assert.match(lies("lib/weiterleitung.ts"), /export function sichererRuecksprung\(roh: unknown, rueckfall = "\/"\)/);
  for (const d of ["app/auth/confirm/route.ts", "app/auth/callback/route.ts", "lib/actions/auth.ts"])
    assert.match(lies(d), /sichererRuecksprung\((searchParams\.get\("next"\)|formData\.get\("redirect"\))\)/, d);
  // Die Marke der Seitenleiste bleibt «/».
  assert.match(lies("components/ui/Seitenleiste.tsx"), /function Marke[\s\S]*?<Link\s+href="\/"/);
});

pruefe("Übungen und Trainings nur mit Konto (#669): Umleitung mit Hinweis und Rücksprung, RLS nur für Angemeldete, «Community»", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // PC 1: Katalog, Übung, Trainingsübersicht und Training samt Unterseiten — am Pfadsegment, nicht als Präfix.
  assert.deepEqual([...NUR_MIT_KONTO_PRAEFIXE], ["/uebungen", "/uebung", "/trainings", "/training"]);
  for (const p of ["/uebungen", "/uebung/autorennen", "/trainings", "/training/x", "/training/x/druck", "/training/x/durchfuehren", "/training/x/uebung/y/diagramm", "/uebung/autorennen/diagramm"])
    assert.ok(istNurMitKonto(p), p);
  for (const p of ["/", "/uebungenx", "/trainingsplan", "/team/x/trainings", "/startseite", "/abmelden/x"]) assert.ok(!istNurMitKonto(p), p);
  // PC 2: Der Rücksprung trägt Pfad und Abfrage, die Startseite liest ihn nur sicher.
  assert.equal(nurMitKontoAdresse("/uebungen", "?kat=F&q=tor"), "/?nur_mit_konto=1&redirect=%2Fuebungen%3Fkat%3DF%26q%3Dtor");
  // Schickt eine Seite selbst zur Anmeldung, geht die Abfrage mit (Review #677).
  assert.equal(abfrageAus({}), "");
  assert.equal(abfrageAus({ kat: ["F", "E"], q: "tor", leer: undefined }), "?kat=F&kat=E&q=tor");
  assert.equal(nurMitKontoZiel({ nur_mit_konto: "1", redirect: "/training/x?variante=2" }), "/training/x?variante=2");
  assert.equal(nurMitKontoZiel({ nur_mit_konto: "1", redirect: "//boese.example" }), UEBUNGEN_PFAD, "fremdes Ziel fällt auf den Katalog");
  assert.equal(nurMitKontoZiel({ nur_mit_konto: "1" }), UEBUNGEN_PFAD);
  assert.equal(nurMitKontoZiel({ redirect: "/uebungen" }), null, "ohne Hinweis kein Ziel");
  assert.equal(katalogWeiterleitung({ nur_mit_konto: "1", redirect: "/uebungen?q=x" }), null, "der Hinweis ist kein Katalog-Filter");
  // Die Middleware: erst Bearbeiten/Neu zur Anmeldung, dann die Startseite mit Hinweis — nur ohne Anmeldung.
  const mw = ohneKommentare(lies("lib/supabase/middleware.ts"));
  const geschuetzt = mw.indexOf("isProtected(request.nextUrl.pathname)");
  const nurMitKonto = mw.indexOf("if (!user && istNurMitKonto(request.nextUrl.pathname))");
  assert.ok(geschuetzt >= 0 && nurMitKonto > geschuetzt);
  assert.match(mw, /nurMitKontoAdresse\(request\.nextUrl\.pathname, request\.nextUrl\.search\)/);
  // AK 2: der Hinweis oben auf der Startseite mit «Anmelden» (zum Ziel) und «Kostenlos registrieren».
  assert.match(NUR_MIT_KONTO_TEXT, /^Dieser Inhalt ist nur mit Konto sichtbar\./);
  const seite = ohneKommentare(lies("components/start/Startseite.tsx"));
  assert.match(seite, /\{nurMitKonto && \([\s\S]*?href=\{loginAdresse\(nurMitKonto, ""\)\}[\s\S]*?Anmelden[\s\S]*?href="\/registrieren"[\s\S]*?Kostenlos registrieren[\s\S]*?\{NUR_MIT_KONTO_TEXT\}/);
  const start = ohneKommentare(lies("app/(start)/page.tsx"));
  assert.match(start, /const nurMitKonto = nurMitKontoZiel\(sp\);/);
  assert.match(start, /nurMitKonto=\{nurMitKonto\}/);
  assert.match(ohneKommentare(lies("app/(start)/startseite/page.tsx")), /nurMitKonto=\{null\}/);
  // AK 1: Die RLS liest Übungen und Trainings nur für `authenticated`; die Startseite liest ihre Beispiele über die eine Funktion.
  const mig = lies("../supabase/migrations/20261123100000_nur_mit_konto.sql");
  for (const [policy, tabelle] of [["ex_select", "exercises"], ["fav_select", "exercise_favorites"], ["tr_select", "trainings"], ["te_select", "training_exercises"], ["tg_select", "training_gruppen"], ["teg_select", "training_exercise_gruppen"], ["tv_select", "training_varianten"]])
    assert.match(mig, new RegExp(`create policy ${policy} on public\\.${tabelle}\\s+for select to authenticated`), policy);
  // Zwilling: die Liste in startseite_beispiele() = STARTSEITE_BEISPIELE, in derselben Reihenfolge.
  const liste = mig.slice(mig.indexOf("from unnest(array["), mig.indexOf("]) with ordinality"));
  assert.deepEqual([...liste.matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]), [...STARTSEITE_BEISPIELE]);
  assert.match(mig, /where e\.source = 'manual' and e\.visibility = 'public'/, "nur Manual-Übungen (Epic EK 11)");
  assert.match(mig, /grant execute on function public\.startseite_beispiele\(\) to anon, authenticated;/);
  const abfrage = lies("lib/queries/exercises.ts");
  const beispiele = abfrage.slice(abfrage.indexOf("export async function getStartseitenBeispiele"), abfrage.indexOf("export function toCardData"));
  assert.match(beispiele, /\.rpc\("startseite_beispiele"\)/);
  assert.ok(!/\.from\("exercises"\)/.test(beispiele), "ohne Konto liest die RLS nichts");
  // Hygiene: kein Anmelde-Hinweis für Besucher:innen mehr an Trainings-Seiten, keine Vorlagen ohne Konto.
  assert.ok(!existsSync(join(web, "components/training/AnmeldeHinweis.tsx")));
  for (const d of ["app/(app)/trainings/page.tsx", "app/(app)/training/[id]/page.tsx", "app/(app)/styleguide/page.tsx"])
    assert.ok(!/AnmeldeHinweis/.test(lies(d)), d);
  assert.match(lies("lib/queries/exercises.ts"), /if \(!user\) return \[\];/);
  // AK 3: «Community» statt «öffentlich» an der Oberfläche, im Konto-Löschen und beim KI-Assistenten.
  assert.equal(HERKUNFT_LABEL.oeffentlich, "Community");
  assert.match(lies("components/ui/Lozenge.tsx"), /<HerkunftArtLozenge art="oeffentlich" label=\{HERKUNFT_LABEL\.oeffentlich\} \/>/);
  assert.equal(ZUM_VEROEFFENTLICHEN_FEHLT, "Für die Community fehlt noch:");
  assert.match(TRAGWEITE_VEROEFFENTLICHEN, /in der Community für alle angemeldeten Konten sichtbar/);
  assert.match(lies("app/(app)/konto/KontoClient.tsx"), /Deine Übungen und Trainings <strong>in der Community<\/strong> bleiben anonymisiert erhalten/);
  assert.match(lies("app/(app)/konto/daten/page.tsx"), /Übungen und Trainings in der Community bleiben anonymisiert erhalten\./);
  // Werkzeugnamen bleiben (OoS 2), ihre Titel sagen «Community».
  assert.match(lies("lib/mcp/werkzeuge/trainings-bearbeiten.ts"), /name: "training_veroeffentlichen",\s*titel: "Training in die Community stellen",/);
  assert.match(lies("lib/mcp/werkzeuge/uebungen-bearbeiten.ts"), /name: "uebung_veroeffentlichen",\s*titel: "Übung in die Community stellen",/);
  // Kein «öffentlich»/«veröffentlich» mehr in dem, was Oberfläche und KI sagen (Kommentare ausgenommen; Release-Texte bleiben, wie sie erschienen;
  // der Amtsname des EDÖB in der Datenschutzerklärung, #672, ist kein Sichtbarkeitsbegriff).
  const treffer: string[] = [];
  for (const wurzel of ["app", "components", "lib"])
    for (const datei of quelldateien(join(web, wurzel))) {
      const rel = relative(web, datei);
      if (["lib/releases.ts", "lib/feedback/wissen.ts"].includes(rel) || rel.startsWith("app/(app)/versionen/") || rel.startsWith("app/api/versionen/")) continue;
      ohneKommentare(readFileSync(datei, "utf8")).split("\n").forEach((zeile, i) => {
        if (/^\s*\*/.test(zeile)) return;
        if (/[öÖ]ffentlich/.test(zeile) && !/Tag der Veröffentlichung|Öffentlichkeitsbeauftragte/.test(zeile)) treffer.push(`${rel}:${i + 1}`);
      });
    }
  assert.deepEqual(treffer, [], `«öffentlich» an der Oberfläche: ${treffer.join(", ")}`);
});

pruefe("Auffindbar und Link-Vorschau (#673 AK 1–3): robots nur auf Produktion offen, Sitemap, eine Marken-Vorschau für alle Adressen", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  // AK 1: Produktion gibt nur Startseite (genau «/»; «/startseite» nur, damit ihr noindex gelesen wird), Versionen,
  // Impressum und Datenschutz frei (#672), dazu die Vorschaubilder und was die Seiten zum Darstellen laden.
  const prod = robotsRegeln("production");
  assert.deepEqual(prod[0], {
    userAgent: "*",
    allow: ["/$", "/startseite", "/versionen", "/impressum", "/datenschutz", "/opengraph-image", "/twitter-image", "/_next/static/", "/_next/image", "/icon.svg"],
    disallow: "/",
  });
  assert.deepEqual([...FREIGEGEBEN], prod[0].allow);
  // Entscheid 2: Dienste der Link-Vorschau dürfen jede Adresse lesen — sie indexieren nicht.
  assert.deepEqual(prod[1], { userAgent: [...VORSCHAU_DIENSTE], allow: "/" });
  assert.ok(!VORSCHAU_DIENSTE.some((d) => /google|bing|duckduck|yandex/i.test(d)), "keine Suchmaschine unter den Vorschau-Diensten");
  for (const env of [undefined, "", "preview", "development"])
    assert.deepEqual(robotsRegeln(env), [{ userAgent: "*", disallow: "/" }], `${env}: alles gesperrt`);
  const robots = ohneKommentare(lies("app/robots.ts"));
  assert.match(robots, /rules: robotsRegeln\(process\.env\.VERCEL_ENV\)/);
  assert.match(robots, /produktion \? \{ sitemap:/, "Sitemap nur auf Produktion angekündigt");
  // Sitemap = die freigegebenen Seiten.
  assert.deepEqual([...SITEMAP_PFADE], ["/", "/versionen", "/impressum", "/datenschutz"]);
  for (const p of SITEMAP_PFADE.filter((p) => p !== "/")) assert.ok(FREIGEGEBEN.includes(p as (typeof FREIGEGEBEN)[number]), `${p} in robots frei`);
  assert.match(ohneKommentare(lies("app/sitemap.ts")), /SITEMAP_PFADE\.map/);
  assert.equal(basisOrigin(undefined), PRODUKTION_ORIGIN);
  assert.equal(basisOrigin("https://staging.ki-fu.ch/"), "https://staging.ki-fu.ch");
  // AK 2: Titel und Beschreibung der Startseite nennen, wofür KiFu da ist; canonical «/».
  const start = ohneKommentare(lies("app/(start)/page.tsx"));
  const beschreibung = start.match(/description:\s*"([^"]+)"/)?.[1] ?? "";
  const titel = start.match(/title: "([^"]+)"/)?.[1] ?? "";
  for (const w of ["Vereinsverwaltung", "Team und Abmeldungen", "Trainingsplanung nach SFV", "KI-Assistent", "Kinder- und Juniorenfussball"])
    assert.ok(beschreibung.includes(w), `Beschreibung nennt «${w}»`);
  assert.match(titel, /^KiFu – .*Kinder- und Juniorenfussball$/);
  assert.match(start, /alternates: \{ canonical: "\/" \}/);
  // AK 3: Vorschau nur in der Wurzel — Marke, «KiFu», Claim; metadataBase für absolute Adressen.
  assert.equal(VORSCHAU_NAME, "KiFu");
  assert.equal(VORSCHAU_CLAIM, "Mehr Fussball. Weniger Bürokratie.");
  const wurzel = ohneKommentare(lies("app/layout.tsx"));
  // Der Rückfall für Seiten ohne eigene Beschreibung (etwa /versionen) sagt dasselbe Bild wie die Startseite.
  assert.ok(!/Übungen durchsuchen|SFV-Trainingsschemata/.test(wurzel), "Wurzel ohne Bild der Übungsdatenbank");
  assert.match(wurzel, /description:\s*"Vereinsverwaltung, Team und Abmeldungen/);
  assert.match(wurzel, /metadataBase: new URL\(basisOrigin\(process\.env\.APP_ORIGIN\)\)/);
  assert.match(wurzel, /openGraph: \{\s*type: "website",\s*siteName: VORSCHAU_NAME,\s*title: VORSCHAU_NAME,\s*description: VORSCHAU_CLAIM,/);
  assert.match(wurzel, /twitter: \{ card: "summary_large_image", title: VORSCHAU_NAME, description: VORSCHAU_CLAIM \}/);
  const bild = ohneKommentare(lies("app/opengraph-image.tsx"));
  assert.match(bild, /\{VORSCHAU_NAME\}/);
  assert.match(bild, /\{VORSCHAU_CLAIM\}/);
  assert.match(bild, /app\/icon\.svg/, "dieselbe Bildmarke wie das Favicon");
  // Im Bild steht sonst nichts: nur die beiden Konstanten als Text.
  assert.deepEqual([...bild.matchAll(/>\{([A-Z_]+)\}</g)].map((m) => m[1]), ["VORSCHAU_NAME", "VORSCHAU_CLAIM"]);
  for (const d of ["app/opengraph-image.tsx", "app/twitter-image.tsx"])
    assert.match(lies(d), /export const alt = "KiFu – Mehr Fussball\. Weniger Bürokratie\.";/, d);
  assert.match(lies("app/twitter-image.tsx"), /export \{ default \} from "\.\/opengraph-image";/);
  assert.match(lies("components/start/Startseite.tsx"), /\{VORSCHAU_CLAIM\}/, "der Claim der Startseite ist derselbe");
  // Keine Seite ersetzt die Vorschau (sie trüge sonst womöglich einen Namen, z. B. am privaten Link) und keine eigenen Bilder.
  for (const datei of quelldateien(join(web, "app"))) {
    const rel = relative(web, datei);
    if (rel === "app/layout.tsx") continue;
    assert.ok(!/\bopenGraph\s*:|\btwitter\s*:/.test(ohneKommentare(readFileSync(datei, "utf8"))), `${rel}: keine eigene Vorschau`);
    if (/(^|\/)(opengraph|twitter)-image\.tsx$/.test(rel)) assert.ok(["app/opengraph-image.tsx", "app/twitter-image.tsx"].includes(rel), `${rel}: kein eigenes Vorschaubild`);
  }
  // Private Links: Seitentitel fest, ohne Namen (der Name unter dem App-Symbol, `appleWebApp.title`, ist kein Seitentitel).
  for (const datei of quelldateien(join(web, "app/(privat)"))) {
    const t = ohneKommentare(readFileSync(datei, "utf8"));
    for (const [, titel] of t.matchAll(/^\s*title: ([^,\n]+)/gm))
      assert.match(titel, /^"[^"$]*- KiFu"$/, `${relative(web, datei)}: Titel ohne Namen`);
  }
  // Suchmaschinen und Vorschau-Dienste kommen ohne Sitzung.
  assert.match(lies("middleware.ts"), /\|robots\\\\\.txt\|sitemap\\\\\.xml\|opengraph-image\|twitter-image\|/);
});

pruefe("Impressum und Datenschutz (#672, ENTWURF): Seiten mit Entwurfshinweis, erreichbar von Startseite, Anmeldung und privatem Link, für Suchmaschinen frei", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(IMPRESSUM_PFAD, "/impressum");
  assert.equal(DATENSCHUTZ_PFAD, "/datenschutz");
  assert.deepEqual(RECHTLICHE_LINKS.map((l) => [l.href, l.label]), [["/impressum", "Impressum"], ["/datenschutz", "Datenschutz"]]);
  // Entscheid 2: Entwurf, bis die Rechtsberatung geprüft hat — sichtbar auf jeder Seite über das gemeinsame Gerüst.
  assert.match(ENTWURF_HINWEIS, /^Entwurf – rechtlich noch nicht geprüft\./);
  const geruest = ohneKommentare(lies("components/start/RechtsSeite.tsx"));
  assert.match(geruest, /<SectionMessage appearance="warning"[^>]*>\s*\{ENTWURF_HINWEIS\}/);
  // Die Seiten liegen in der Gruppe (start) (ohne Seitenleiste, ohne Anmeldung), nutzen das Gerüst und sperren Suchmaschinen nicht.
  const impressum = ohneKommentare(lies("app/(start)/impressum/page.tsx"));
  const datenschutz = ohneKommentare(lies("app/(start)/datenschutz/page.tsx"));
  for (const [name, t] of [["impressum", impressum], ["datenschutz", datenschutz]] as const) {
    assert.match(t, /<RechtsSeite titel=/, `${name}: Gerüst mit Entwurfshinweis`);
    assert.ok(!/robots\s*:/.test(t), `${name}: indexierbar (AK 8)`);
    assert.match(t, /alternates: \{ canonical: (IMPRESSUM_PFAD|DATENSCHUTZ_PFAD) \}/, `${name}: canonical`);
  }
  // AK 2: Trägerschaft, Postadresse und E-Mail-Adresse für Anfragen (Platzhalter bis zur Gründung).
  assert.match(impressum, /\{TRAEGERSCHAFT\}/);
  assert.match(impressum, /POSTADRESSE_PLATZHALTER\.map/);
  assert.match(impressum, /<KontaktAdresse \/>/);
  // Epic EK 16, AK 2/6: Auf Produktion braucht es die E-Mail-Adresse, nicht den Platzhalter. Der
  // Release-PR auf `main` (pr-checks setzt GITHUB_BASE_REF) scheitert, solange KONTAKT_EMAIL fehlt.
  if (process.env.GITHUB_BASE_REF === "main")
    assert.ok(KONTAKT_EMAIL, "Release nach main: KONTAKT_EMAIL in lib/rechtliches.ts setzen (keine Platzhalter auf Produktion)");
  // AK 3–7: Daten, Zwecke, Fristen aus ihren Quellen; Auftrag der Vereine; Datenort und Ausnahmen; Rechte ohne Konto; Cookies.
  assert.match(datenschutz, /\{BENACHRICHTIGUNG_TAGE\} Tage/);
  assert.match(datenschutz, /\{AUFBEWAHRUNG_MONATE\} Monaten/);
  assert.match(datenschutz, /KiFu bearbeitet\s+diese Daten in seinem Auftrag/);
  assert.match(datenschutz, /titel="Wo die Daten liegen"/);
  for (const w of ["Fragen und Feedback:", "Mitteilungen aufs Mobile:", "KI-Assistenten, die du selbst verbindest:", "Kalender, die du selbst abonnierst:"])
    assert.ok(datenschutz.includes(w), `Ausnahme «${w}»`);
  assert.match(datenschutz, /Dafür brauchst du kein Konto: Schreib an <KontaktAdresse \/>/);
  assert.match(datenschutz, /leiten wir sie an den Verein weiter/);
  assert.match(datenschutz, /<TextLink href="\/cookies">Cookies<\/TextLink>/);
  // AK 1: erreichbar von der Startseite (Fusszeile), den Anmeldeseiten und dem privaten Link.
  assert.match(ohneKommentare(lies("app/(start)/layout.tsx")), /RECHTLICHE_LINKS\.map\(\(l\) => \(\s*<FussLink key=\{l\.href\} href=\{l\.href\}>/);
  assert.match(ohneKommentare(lies("app/(auth)/layout.tsx")), /<RechtlicheLinks /);
  assert.match(ohneKommentare(lies("app/(privat)/layout.tsx")), /<RechtlicheLinks /);
  assert.match(ohneKommentare(lies("components/layout/RechtlicheLinks.tsx")), /RECHTLICHE_LINKS\.map/);
  // Die Middleware lässt beide Seiten ohne Anmeldung zu (kein Präfix «nur mit Konto»).
  for (const p of [IMPRESSUM_PFAD, DATENSCHUTZ_PFAD]) assert.ok(!istNurMitKonto(p), `${p} ohne Konto`);
  // AK 8: robots und Sitemap führen beide.
  for (const p of [IMPRESSUM_PFAD, DATENSCHUTZ_PFAD]) {
    assert.ok((FREIGEGEBEN as readonly string[]).includes(p), `${p} in robots frei`);
    assert.ok((SITEMAP_PFADE as readonly string[]).includes(p), `${p} in der Sitemap`);
  }
});

pruefe("Vereinbarung zur Auftragsbearbeitung (#675, ENTWURF): Seite mit Entwurfshinweis, Zustimmung beim Gründen mit der geltenden Fassung, Hinweis für die Verwaltung", () => {
  const lies = (d: string) => readFileSync(join(web, d), "utf8");
  const ohneKommentare = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.equal(VEREINBARUNG_PFAD, "/vereinbarung");
  assert.equal(VEREINBARUNG_TITEL, "Vereinbarung zur Auftragsbearbeitung");
  // Zwilling der Fassung: vereinbarung_fassung() in der Migration (check:kern-db vergleicht mit der laufenden DB).
  const migration = readFileSync(join(web, "../supabase/migrations/20261123110000_vereinbarung_auftragsbearbeitung.sql"), "utf8");
  assert.ok(migration.includes(`as $$ select '${VEREINBARUNG_FASSUNG}'::text $$;`), "SQL-Zwilling der Fassung");
  // Seite: Gerüst mit Entwurfshinweis, Fassung sichtbar, ohne Anmeldung, nicht für Suchmaschinen freigegeben.
  const seite = ohneKommentare(lies("app/(start)/vereinbarung/page.tsx"));
  assert.match(seite, /<RechtsSeite titel=\{VEREINBARUNG_TITEL\} fassung=\{VEREINBARUNG_FASSUNG\}>/);
  assert.match(seite, /alternates: \{ canonical: VEREINBARUNG_PFAD \}/);
  assert.ok(!istNurMitKonto(VEREINBARUNG_PFAD), "ohne Konto lesbar");
  assert.ok(!(FREIGEGEBEN as readonly string[]).includes(VEREINBARUNG_PFAD) && !(SITEMAP_PFADE as readonly string[]).includes(VEREINBARUNG_PFAD));
  assert.match(ohneKommentare(lies("components/start/RechtsSeite.tsx")), /\{fassung && <> · Fassung \{fassung\}<\/>\}/);
  // Datenschutz verweist auf die Vereinbarung.
  assert.match(ohneKommentare(lies("app/(start)/datenschutz/page.tsx")), /<TextLink href=\{VEREINBARUNG_PFAD\}>\{VEREINBARUNG_TITEL\}<\/TextLink>/);
  // AK 1, 2: Der Dialog verlinkt die Vereinbarung (neuer Tab, der Dialog bleibt) und schickt die geltende Fassung.
  const dialog = ohneKommentare(lies("components/verein/VereinGruenden.tsx"));
  assert.match(dialog, /href=\{VEREINBARUNG_PFAD\}\s+target="_blank"/);
  assert.match(dialog, /gruendeVereinAktion\(name, true, VEREINBARUNG_FASSUNG\)/);
  assert.match(lies("lib/kern/verein.ts"), /p_fassung: \(typeof e\.fassung === "string" \? e\.fassung : null\)/);
  // AK 3, 4: Lage der Verwaltung.
  assert.equal(vereinbarungLage("b", "b"), "aktuell");
  assert.equal(vereinbarungLage("b", "a"), "neue_fassung");
  assert.equal(vereinbarungLage("b", null), "ohne");
  assert.equal(VEREIN_VEREINBARUNG_TEXT.zugestimmt("23.11.26"), "Der Verein hat ihr am 23.11.26 zugestimmt.");
  // Antwort der Datenebene auf ihre Form geprüft.
  assert.deepEqual(vereinbarungAus({ geltend: "f", zustimmung: null }), { geltend: "f", zustimmung: null });
  const am = "2026-11-23T10:00:00+00:00";
  assert.deepEqual(vereinbarungAus({ geltend: "f", zustimmung: { fassung: "f", am } }), { geltend: "f", zustimmung: { fassung: "f", am } });
  for (const kaputt of [null, {}, { geltend: "" , zustimmung: null }, { geltend: "f" }, { geltend: "f", zustimmung: {} }, { geltend: "f", zustimmung: { fassung: "f", am: "gestern" } }])
    assert.equal(vereinbarungAus(kaputt), null, JSON.stringify(kaputt));
  // Die Verwaltung liest sie in «Verwaltung» (Karte, Fehler werfen) und erfährt eine neue Fassung auch in der Übersicht.
  const verwaltung = ohneKommentare(lies("app/(app)/verein/verwaltung/page.tsx"));
  assert.match(verwaltung, /ladeVereinbarung\(supabase, user\.id, \{ vereinId: verein\.id \}\)/);
  assert.match(verwaltung, /if \(!vereinbarung\.ok\) throw new Error/);
  assert.match(verwaltung, /vereinbarung=\{<VereinbarungKarte vereinbarung=\{vereinbarung\.wert\} \/>\}/);
  const karte = ohneKommentare(lies("components/verein/VereinbarungKarte.tsx"));
  assert.match(karte, /<ButtonLink href=\{VEREINBARUNG_PFAD\}/);
  assert.match(karte, /lage === "neue_fassung"[\s\S]*?VEREIN_VEREINBARUNG_TEXT\.neueFassung/);
  assert.match(karte, /lage === "ohne"[\s\S]*?VEREIN_VEREINBARUNG_TEXT\.ohneZustimmung/);
  const uebersicht = ohneKommentare(lies("app/(app)/verein/page.tsx"));
  assert.match(uebersicht, /istVerwaltung \? ladeVereinbarung\(/, "nur die Verwaltung fragt");
  assert.match(uebersicht, /\{neueFassung && \(/);
  // Auf der Übersicht ist sie nur ein Hinweis: Lesefehler lassen ihn weg (Deploy-Fenster), werfen nicht.
  assert.ok(!/vereinbarung\.ok\) throw/.test(uebersicht), "Übersicht wirft nicht wegen der Vereinbarung");
  assert.match(uebersicht, /vereinbarung\?\.ok === true &&/);
  // sync-staging kennt die neue Tabelle.
  const yml = readFileSync(join(web, "../.github/workflows/sync-staging.yml"), "utf8");
  assert.ok((/PUBLIC_TABLES: "([^"]+)"/.exec(yml)?.[1].split(" ") ?? []).includes("verein_zustimmungen"));
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
