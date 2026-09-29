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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
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
import { fachlicheMeldung, fehlerMeldung } from "../lib/training-bedingungen";
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
import { leerZuNull, terminProblem } from "../lib/termin";
import type { TrainingDetail, TrainingExerciseItem } from "../lib/queries/trainings-fuer";

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
      "Ein öffentliches Training braucht mindestens eine Übung in der Einleitung. " +
        "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
    ],
  ];
  // #193: die Marker der Übungsfolge und der bisher unübersetzte Termin-Marker.
  beispiele.push(
    ["UEBUNGSFOLGE_DOPPELT", "Eine Übung steht in der Reihenfolge mehrfach."],
    [
      "UEBUNGSFOLGE_UNVOLLSTAENDIG",
      "Die Reihenfolge muss genau die Übungen dieses Abschnitts nennen — jede einmal. " +
        "Lies das Training neu und sende die vollständige Folge.",
    ],
    ["UEBUNGSFOLGE_ABSCHNITT_LEER", "In diesem Abschnitt steht keine Übung."],
    [
      "TERMIN_NUR_FUER_TEAM_TRAININGS: Training x",
      "Termine gibt es nur für Team-Trainings. Stelle das Training zuerst ins Team.",
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
      "Die Reihenfolge muss genau die Varianten dieses Trainings nennen — jede einmal. " +
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
    "Ein öffentliches Training braucht in jeder Variante mindestens eine Übung im freien Spiel. " +
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
    datum: "2026-09-23",
    beginn: "18:30",
    ort: "Allmend",
    bemerkung: null,
    training: { id: "t1", name: "Probe", stufen: ["F" as const] },
  };
  const heute = trainingAuskunft(team, { userId: ICH, termin, heute: "2026-09-23" });
  assert.deepEqual(heute.termin, {
    id: "tt1",
    datum: "2026-09-23",
    beginn: "18:30",
    ort: "Allmend",
    bemerkung: null,
    anstehend: true,
  });
  // Der heutige Tag zählt ganz zum Anstehenden — wie im Plan (`teilePlan`).
  assert.equal(trainingAuskunft(team, { userId: ICH, termin, heute: "2026-09-24" }).termin?.anstehend, false);
  assert.equal(trainingAuskunft(team, { userId: ICH, termin: null }).termin, null);
  assert.equal(trainingAuskunft(training({}), { userId: ICH }).termin, null);
  // Ein undeklariertes Feld im Termin fiele im strengen Schema auf.
  assert.throws(() => TrainingAuskunftStreng.parse({ ...heute, termin: { ...heute.termin, extra: 1 } }));
});

// ── Termin-Felder (#198 AK 7/8) ─────────────────────────────────────────────
// Die Texte sind die bisherigen der Server Actions. Neu ist die echte
// Kalenderprüfung: «2026-02-30» und «25:99» passten auf das Muster und
// scheiterten erst in der Datenbank — als «liess sich nicht speichern».
pruefe("terminProblem: gültig, leer, erfundene Tage und Uhrzeiten", () => {
  const DATUM = { feld: "datum", text: "Bitte ein Datum angeben." };
  const ZEIT = { feld: "beginn", text: "Bitte eine gültige Uhrzeit angeben." };
  assert.equal(terminProblem({ datum: "2026-09-23" }), null);
  assert.equal(terminProblem({ datum: "2028-02-29", beginn: "00:00" }), null, "Schalttag");
  assert.equal(terminProblem({ datum: "2026-12-31", beginn: "23:59" }), null);
  assert.equal(terminProblem({ datum: "2026-09-23", beginn: "" }), null, "leerer Beginn = keiner");
  assert.equal(terminProblem({ datum: "2026-09-23", beginn: null }), null);
  for (const datum of ["", undefined, null, "2026-02-30", "2027-02-29", "2026-13-01", "2026-04-31", "0000-01-01", "2026-9-3", "23.09.2026"])
    assert.deepEqual(terminProblem({ datum }), DATUM, `Datum ${datum}`);
  for (const beginn of ["25:99", "24:00", "18:60", "8:30", "18.30", "18:30:00"])
    assert.deepEqual(terminProblem({ datum: "2026-09-23", beginn }), ZEIT, `Beginn ${beginn}`);
  assert.equal(leerZuNull("  "), null);
  assert.equal(leerZuNull(" Allmend "), "Allmend");
  assert.equal(leerZuNull(undefined), null);
});

pruefe("Termin-Marker: vorab und aus der Datenbank derselbe Satz", () => {
  const f = still(() => ausDbFehler({ message: "TERMIN_NUR_FUER_TEAM_TRAININGS" }));
  assert.equal(f.art, "regel");
  assert.equal(f.meldung, "Termine gibt es nur für Team-Trainings. Stelle das Training zuerst ins Team.");
  assert.equal(NICHT_GEFUNDEN.termin, "Termin nicht gefunden.");
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
    "Zugewiesen —",
  ]);
  assert.deepEqual(a.durchlauf[1].zeit_je_gruppe.map((z) => z.text), ["Zugewiesen —", "Zugewiesen —"]);
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
  // Ohne Materialliste bleibt sie aus der Zeile — dann gilt der Default.
  const ohne = pruefeInhalt(EINLEITUNG);
  assert.ok(ohne.ok && !("material_liste" in ohne.row));
});

pruefe("Übungsinhalt: Pflichtvertrag — pflichtangaben genügt, jede fehlende nennt genau ihr Feld", () => {
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
    "Hier gibt es keinen methodischen Fahrplan — der Ablauf steht in «aufbau».",
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
    "Den Übungstyp gibt es nur im Juniorenfussball — lass «uebungstyp» weg.",
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
    "Tor gibt es nicht in Farben — lass «farbe» weg.",
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
    "Hier gibt es keinen methodischen Fahrplan — der Ablauf steht in «aufbau».",
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
  const beides = aendere(VOLL_EINLEITUNG, { material: null });
  assert.ok(beides.ok);
  assert.deepEqual(geaenderteSpalten(beides.row, VOLL_EINLEITUNG), { material_liste: [], material: [] });

  // Eine Änderung wird wie eine neue Übung geprüft: dieselben Verstösse.
  einziger(aendere(VOLL_EINLEITUNG, { name: " " }), "name", "Bitte einen Namen angeben.", "eingabe");
  einziger(
    aendere(VOLL_EINLEITUNG, { uebungstyp: "spielform" }),
    "uebungstyp",
    "Den Übungstyp gibt es nur im Juniorenfussball — lass «uebungstyp» weg.",
  );
});

pruefe("Übung ändern: neue Einordnung nennt stehengebliebene Angaben, statt sie still zu löschen", () => {
  const stehen = " Die Angabe steht noch in der Übung — setze";
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
    assert.ok(!existsSync(join(web, alt)), `${alt} existiert wieder — gehört nach lib/kern/`);
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
      if (/\bUebungKennung\b/.test(eingabe))
        assert.ok(block.includes("UEBUNG_KENNUNG_FEHLER"), `${m[1]} nimmt eine Übungs-Kennung, erklärt aber UEBUNG_KENNUNG_FEHLER nicht`);
      if (/\b(TrainingId|FassungId|GruppeId|VarianteId)\b/.test(eingabe))
        assert.ok(/\bKENNUNG_FEHLER\b/.test(block), `${m[1]} nimmt eine Kennung, erklärt aber KENNUNG_FEHLER nicht`);
      // Dasselbe für Teams und Termine (#198 AK 11). «termin_entfernen» ist
      // ausgenommen: Es kennt kein «nicht_gefunden» — ein fehlender Termin
      // gilt als entfernt.
      if (/\bTeamId\b/.test(eingabe))
        assert.ok(block.includes("TEAM_KENNUNG_FEHLER"), `${m[1]} nimmt team_id, erklärt aber TEAM_KENNUNG_FEHLER nicht`);
      if (/\bTerminId\b/.test(eingabe) && m[1] !== "terminEntfernen")
        assert.ok(block.includes("TERMIN_KENNUNG_FEHLER"), `${m[1]} nimmt termin_id, erklärt aber TERMIN_KENNUNG_FEHLER nicht`);
    }
  }

  const jeStory: Record<string, string[]> = {
    "#143": ["uebung_anlegen"],
    "#144": ["uebung_aendern", "uebung_veroeffentlichen", "uebung_auf_entwurf_setzen"],
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
    "#198": [
      "teams_abrufen",
      "team_plan_abrufen",
      "termin_ansetzen",
      "termin_aendern",
      "termin_entfernen",
      "training_erneut_ansetzen",
    ],
    "#263": ["variante_anlegen", "variante_umbenennen", "variante_entfernen", "varianten_ordnen"],
  };
  for (const [story, erwartet] of Object.entries(jeStory))
    for (const n of erwartet) assert.ok(namen.includes(n), `${n} fehlt im Werkzeugsatz (${story})`);
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
