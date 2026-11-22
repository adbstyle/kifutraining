// Prüft die Regeln des KI-Zugangs (Story #142): web/lib/mcp/regeln.ts,
// web/lib/weiterleitung.ts und die reinen Werkzeug-Bausteine
// web/lib/mcp/{vokabular,eingaben,uebung-eingaben,diagramm-eingaben,ergebnis,abo}.ts. Ohne DB und ohne Netz; läuft
// im PR-Check neben `typecheck` und den übrigen `check:*`.
//
// Der Wert dieser Prüfung liegt an sechs Stellen:
//
// - Die Namensregel und die Aufruf-Grenze haben je einen SQL-Zwilling (CHECK
//   `kzn_name_laenge`, `v_grenze` in `ki_aufruf_zaehlen()`). Laufen die
//   Zahlen auseinander, bekommt der Trainer am Namensfeld eine Zusage, die die
//   Datenbank bricht — oder der Assistent eine Wartezeit, die nicht stimmt.
// - Die Grenze von fünf Zugängen zählt den anfragenden Client NICHT mit. Wer
//   das umdreht, sperrt einen Trainer mit fünf Zugängen aus dem erneuten
//   Anmelden eines bereits verbundenen Geräts aus.
// - `sichererRuecksprung` ist die eine Regel gegen offene Weiterleitungen über
//   den Login; der Erlauben-Ablauf bewirbt genau diesen Weg öffentlich.
// - Das Werkzeug «vokabular» ist aus vocab.ts und dem Feld-Gating abgeleitet,
//   und die Suchfilter nehmen nur dessen Werte an. Verliert die Ableitung
//   einen Wert, rät der Assistent; nimmt ein Filter freie Strings, landen sie
//   interpoliert im PostgREST-`or=`.
// - Die Ergebnis-Helfer sind die Konvention ALLER Werkzeuge (#192 ff.):
//   jedes gesetzte Feld eines Kern-Fehlers muss beim Assistenten ankommen.
// - Kein Änderungs-Abo (lib/mcp/abo.ts): Kündigt der Handler `listChanged`
//   an oder nimmt er `subscriptions/listen` an, halten Clients endlose Streams
//   offen — auf Vercel je Client eine Funktion bis zum Timeout.
//
//   npx tsx scripts/pruefe-ki-zugang.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KI_AUFRUFE_JE_STUNDE,
  KI_ZUGAENGE_MAX,
  MELDUNG_ZUGAENGE_GRENZE,
  ZUGANGSNAME_MAX,
  ANFRAGE_KENNUNG_MAX,
  andereZugaenge,
  eigenerZugangsname,
  istAnfrageKennung,
  grenzeErreicht,
  meldungGebremst,
  zugangsAnzeigename,
  zugangsnameProblem,
} from "../lib/mcp/regeln";
import { loginAdresse, sichererRuecksprung } from "../lib/weiterleitung";
import { KONTO_GRENZE_WERKZEUG, kontoGrenzeText } from "../lib/konto-grenzen";
import { registriereWerkzeuge } from "../lib/mcp/server";
import { ZUGANG_DARF, ZUGANG_DARF_NICHT, ZUGANG_ERWEITERUNG } from "../lib/mcp/umfang";
import { BENACHRICHTIGEN_HINWEIS, BENACHRICHTIGEN_MODELL, BENACHRICHTIGEN_TEXT, BENACHRICHTIGEN_WERKZEUG } from "../lib/benachrichtigung";
import {
  altersstufeSlugs,
  erscheinungsform_juniorenSlugs,
  erscheinungsformSlugs,
  feldtypSlugs,
  hauptteilkategorieSlugs,
  junioren_blockSlugs,
  kategorienSlugs,
  trainingsteilSlugs,
  uebungstypSlugs,
} from "../lib/vocab";
import {
  BANDBREITEN,
  BLOCK_ERSCHEINUNGSFORM,
  GESAMTDAUER_JUNIOREN,
  JUNIOREN_PFLICHT_BLOECKE,
} from "../lib/junioren";
import {
  FELDTYP_MIT_SPIELFELD,
  FREIES_SPIEL,
  altersstufeDerEinordnung,
  einordnungenFuer,
  kategorienFuer,
} from "../lib/altersstufe";
import { ANZAHL_HINWEIS, HAUPTTEILKATEGORIE_SLUGS, LEER_HINWEIS, OHNE_DAUER_TEILE } from "../lib/training";
import { istHauptteil } from "../lib/gruppen";
import { FELDTYP_HINWEIS, VokabularSchema, baueVokabular } from "../lib/mcp/vokabular";
import { SucheEingabe } from "../lib/mcp/eingaben";
import { DiagrammEingabe } from "../lib/mcp/diagramm-eingaben";
import { z } from "zod";
import {
  UEBUNG_ANGABEN,
  UebungAendernEingabe,
  UebungAnlegenEingabe,
  alsUebungInhalt,
  alsUebungPatch,
  angabenText,
} from "../lib/mcp/uebung-eingaben";
import { ausKern, erfolg, fehlerErgebnis } from "../lib/mcp/ergebnis";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { KernFehler } from "../lib/kern/ergebnis";
import { createMcpHandler } from "mcp-handler";
import { ABO_ABGEWIESEN, KEIN_ABO, aboAbweisung } from "../lib/mcp/abo";

let gelaufen = 0;

function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

// ── Namensregel (AK 3, PC 2) ────────────────────────────────────────────────
pruefe("Ein leerer Name ist kein Fehler - dann gilt der Client-Name", () => {
  assert.equal(zugangsnameProblem(""), null);
  assert.equal(zugangsnameProblem("   "), null);
  assert.equal(eigenerZugangsname("", "Claude"), null);
  assert.equal(eigenerZugangsname("   ", "Claude"), null);
});

pruefe(`Genau ${ZUGANGSNAME_MAX} Zeichen sind erlaubt, ${ZUGANGSNAME_MAX + 1} nicht`, () => {
  assert.equal(ZUGANGSNAME_MAX, 40);
  assert.equal(zugangsnameProblem("x".repeat(40)), null);
  assert.equal(zugangsnameProblem("x".repeat(41)), "Höchstens 40 Zeichen.");
});

pruefe("Die Länge zählt bereinigt - wie der SQL-CHECK auf den gespeicherten Namen", () => {
  assert.equal(zugangsnameProblem(`  ${"x".repeat(40)}  `), null);
});

pruefe("Leerraum wird zusammengezogen und getrimmt", () => {
  assert.equal(eigenerZugangsname("  Claude  Laptop ", "Claude"), "Claude Laptop");
});

pruefe("Ein Name gleich dem Client-Namen ist kein eigener", () => {
  assert.equal(eigenerZugangsname("Claude", "Claude"), null);
  assert.equal(eigenerZugangsname(" Claude ", "Claude"), null);
  // Gross-/Kleinschreibung zählt: «claude» ist bewusst gewählt.
  assert.equal(eigenerZugangsname("claude", "Claude"), "claude");
});

pruefe("Ohne eigenen Namen zeigt das Konto den des Clients", () => {
  assert.equal(zugangsAnzeigename(null, "X"), "X");
  assert.equal(zugangsAnzeigename("Laptop", "X"), "Laptop");
  assert.equal(zugangsAnzeigename(null, "  "), "Unbenannter Client");
});

pruefe("Fehlende oder fremde Werte gelten als leer, statt zu werfen", () => {
  // Supabase lässt einen leeren Client-Namen weg (omitempty), und die Action
  // ist von aussen mit beliebigen Argumenten aufrufbar.
  assert.equal(eigenerZugangsname(undefined, undefined), null);
  assert.equal(eigenerZugangsname("Laptop", undefined), "Laptop");
  assert.equal(eigenerZugangsname(42, "Claude"), null);
  assert.equal(zugangsnameProblem(undefined), null);
  assert.equal(zugangsAnzeigename(null, undefined), "Unbenannter Client");
});

pruefe(`Eine Anfrage-Kennung ist nicht leer und höchstens ${ANFRAGE_KENNUNG_MAX} Zeichen`, () => {
  assert.equal(istAnfrageKennung("abc"), true);
  assert.equal(istAnfrageKennung("x".repeat(ANFRAGE_KENNUNG_MAX)), true);
  assert.equal(istAnfrageKennung("x".repeat(ANFRAGE_KENNUNG_MAX + 1)), false);
  assert.equal(istAnfrageKennung(""), false);
  assert.equal(istAnfrageKennung(undefined), false);
  assert.equal(istAnfrageKennung(["a"]), false);
});

// ── Grenze der Zugänge (AK 11) ──────────────────────────────────────────────
const grant = (id: string) => ({ client: { id } });
const grants = (n: number) => Array.from({ length: n }, (_, i) => grant(`c${i}`));

pruefe("KI_ZUGAENGE_MAX ist 5 (PO 2026-09-23)", () => {
  assert.equal(KI_ZUGAENGE_MAX, 5);
  assert.match(MELDUNG_ZUGAENGE_GRENZE, /bereits 5 KI-Zugänge/);
});

pruefe("4 andere Zugänge: ein neuer ist frei", () => {
  assert.equal(grenzeErreicht(grants(4), "neu"), false);
});

pruefe("5 andere Zugänge: die Grenze ist erreicht", () => {
  assert.equal(grenzeErreicht(grants(5), "neu"), true);
});

pruefe("Der anfragende Client zählt nicht mit - erneutes Erlauben ersetzt nur", () => {
  // Fünf Zugänge, einer davon gehört dem anfragenden Client.
  assert.equal(andereZugaenge(grants(5), "c0"), 4);
  assert.equal(grenzeErreicht(grants(5), "c0"), false);
});

pruefe("Doppelte Einträge desselben Clients zählen einmal", () => {
  assert.equal(andereZugaenge([grant("a"), grant("a"), grant("b")], "neu"), 2);
});

// ── Aufruf-Grenze: Meldung (AK 12, PC 9) ────────────────────────────────────
pruefe("Die Bremse nennt Grund und Wartezeit", () => {
  assert.equal(KI_AUFRUFE_JE_STUNDE, 600);
  assert.match(meldungGebremst(3600), /600 Werkzeug-Aufrufe je Stunde/);
  assert.match(meldungGebremst(3600), /in etwa 60 Minuten\.$/);
  assert.match(meldungGebremst(30), /in etwa 1 Minute\.$/);
});

// ── sichererRuecksprung (offene Weiterleitung über den Login) ───────────────
pruefe("Relative Pfade dieser Anwendung gehen durch", () => {
  assert.equal(sichererRuecksprung("/konto"), "/konto");
  assert.equal(sichererRuecksprung("/"), "/");
});

pruefe("Die Query bleibt erhalten - der Erlauben-Ablauf braucht sie", () => {
  assert.equal(
    sichererRuecksprung("/oauth/consent?authorization_id=x"),
    "/oauth/consent?authorization_id=x",
  );
});

pruefe("Fremde Ziele fallen auf die Startseite", () => {
  for (const boese of ["//evil.example", "/\\evil", "/\t/evil", "https://evil", "evil", ""]) {
    assert.equal(sichererRuecksprung(boese), "/", JSON.stringify(boese));
  }
  assert.equal(sichererRuecksprung(undefined), "/");
  assert.equal(sichererRuecksprung(null), "/");
});

pruefe("Die Login-Adresse trägt Pfad und Abfrage als Rücksprung, sonst nichts (#330 PC 7)", () => {
  const ziel = "/team/abc/termin/def?meine=1&termin=t1";
  const u = new URL(loginAdresse("/team/abc/termin/def", "?meine=1&termin=t1"), "http://x");
  assert.equal(u.pathname, "/login");
  assert.deepEqual([...u.searchParams.keys()], ["redirect"], "keine fremden Parameter");
  assert.equal(u.searchParams.get("redirect"), ziel);
  assert.equal(sichererRuecksprung(u.searchParams.get("redirect")), ziel, "und der Login nimmt es an");
  assert.equal(new URL(loginAdresse("/teams", ""), "http://x").searchParams.get("redirect"), "/teams");
});

pruefe("Der Rückfall ist wählbar", () => {
  assert.equal(sichererRuecksprung("//evil.example", "/konto"), "/konto");
});

// ── SQL-Zwilling ────────────────────────────────────────────────────────────
const migrationen = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../supabase/migrations");

pruefe("Die Migration trägt dieselben Zahlen wie regeln.ts", () => {
  const dateien = readdirSync(migrationen).filter((f) => f.endsWith("_ki_zugaenge.sql"));
  assert.ok(
    dateien.length === 1,
    `Erwartet genau eine Migration «*_ki_zugaenge.sql» in supabase/migrations, gefunden: ${
      dateien.length ? dateien.join(", ") : "keine"
    }. Ohne sie fehlen die SQL-Zwillinge von KI_AUFRUFE_JE_STUNDE und ZUGANGSNAME_MAX.`,
  );
  const sql = readFileSync(join(migrationen, dateien[0]), "utf8");
  // Leerraum-tolerant: Deklarationen im plpgsql-Block stehen ausgerichtet.
  assert.ok(
    new RegExp(`v_grenze\\s+constant\\s+integer\\s*:=\\s*${KI_AUFRUFE_JE_STUNDE}\\s*;`).test(sql),
    `ki_aufruf_zaehlen(): «v_grenze constant integer := ${KI_AUFRUFE_JE_STUNDE}» fehlt - Zwilling von KI_AUFRUFE_JE_STUNDE.`,
  );
  assert.ok(
    // An den CHECK-Namen verankert: ein anderes «between 1 and 40» in der
    // Datei darf die Prüfung nicht bestehen lassen.
    new RegExp(
      `constraint\\s+kzn_name_laenge\\s+check\\s*\\([^;]*between\\s+1\\s+and\\s+${ZUGANGSNAME_MAX}\\b`,
      "i",
    ).test(sql),
    `CHECK kzn_name_laenge: «between 1 and ${ZUGANGSNAME_MAX}» fehlt - Zwilling von ZUGANGSNAME_MAX.`,
  );
});

// ── Werkzeug «vokabular» gegen vocab.ts (AK 9) ─────────────────────────────
// Das Werkzeug ist abgeleitet, nie handgeschrieben. Diese Prüfungen fangen,
// wenn eine Ableitung einen Wert verliert oder doppelt meldet — dann füllte
// der Assistent Filter mit Werten, die die Datenbank abweist, oder fände
// vorhandene Übungen nicht.
const vok = baueVokabular();
const stufe = (s: string) => {
  const a = vok.altersstufen.find((x) => x.slug === s);
  assert.ok(a, `Altersstufe ${s} fehlt im Vokabular`);
  return a;
};
const alleEinordnungen = vok.altersstufen.flatMap((a) =>
  a.trainingsteile.flatMap((t) => t.einordnungen.map((e) => ({ stufe: a.slug, ...e }))),
);
const gleicheMenge = (ist: readonly string[], soll: readonly string[], was: string) => {
  assert.equal(new Set(ist).size, ist.length, `${was}: doppelte Werte ${JSON.stringify(ist)}`);
  assert.deepEqual([...ist].sort(), [...soll].sort(), was);
};

pruefe("Das Vokabular erfüllt sein eigenes Ausgabeschema", () => {
  VokabularSchema.parse(vok);
});

pruefe("Die Altersstufen sind genau die aus vocab.ts, in derselben Reihenfolge", () => {
  assert.deepEqual(
    vok.altersstufen.map((a) => a.slug),
    [...altersstufeSlugs],
  );
});

pruefe("Einordnungen = Trainingsteile ∪ Junioren-Blöcke, überschneidungsfrei", () => {
  gleicheMenge(
    alleEinordnungen.map((e) => e.slug),
    [...trainingsteilSlugs, ...junioren_blockSlugs],
    "Einordnungen",
  );
  gleicheMenge(
    stufe("kinderfussball").trainingsteile.flatMap((t) => t.einordnungen.map((e) => e.slug)),
    trainingsteilSlugs,
    "Einordnungen Kinderfussball",
  );
  gleicheMenge(
    stufe("juniorenfussball").trainingsteile.flatMap((t) => t.einordnungen.map((e) => e.slug)),
    junioren_blockSlugs,
    "Einordnungen Juniorenfussball",
  );
  // Kinderfussball kennt keine zweite Ebene: je Teil genau ein Eintrag.
  for (const t of stufe("kinderfussball").trainingsteile) {
    assert.equal(t.einordnungen.length, 1, t.slug);
    assert.equal(t.einordnungen[0].ebene, "trainingsteil", t.slug);
  }
  for (const t of stufe("juniorenfussball").trainingsteile)
    for (const e of t.einordnungen) assert.equal(e.ebene, "block", e.slug);
});

pruefe("Alterskategorien je Stufe: disjunkt und zusammen vollständig", () => {
  gleicheMenge(
    vok.altersstufen.flatMap((a) => a.alterskategorien.map((k) => k.slug)),
    kategorienSlugs,
    "Alterskategorien",
  );
});

pruefe("Hauptteilkategorien nur im Kinderfussball, dort vollständig", () => {
  gleicheMenge(
    stufe("kinderfussball").hauptteilkategorien.map((h) => h.slug),
    hauptteilkategorieSlugs,
    "Hauptteilkategorien",
  );
  assert.deepEqual(stufe("juniorenfussball").hauptteilkategorien, []);
  // Das freie Spiel trägt eine Beschreibung, die beiden anderen den Fahrplan.
  const ablauf = Object.fromEntries(
    stufe("kinderfussball").hauptteilkategorien.map((h) => [h.slug, h.ablauf]),
  );
  assert.equal(ablauf["fussball-spielen"], "beschreibung");
  assert.equal(ablauf["fussball-spielen-lernen"], "fahrplan");
});

pruefe("Hauptteilkategorie ist Pflicht genau im Kinderfussball-Hauptteil", () => {
  const pflicht = alleEinordnungen.filter((e) => e.hauptteilkategorie_pflicht);
  assert.deepEqual(
    pflicht.map((e) => `${e.stufe}/${e.slug}`),
    ["kinderfussball/hauptteil"],
  );
  // Dort hängt der Ablauf an der Kategorie, nicht an der Einordnung.
  assert.equal(pflicht[0].ablauf, null);
  for (const e of alleEinordnungen.filter((x) => !x.hauptteilkategorie_pflicht))
    assert.notEqual(e.ablauf, null, e.slug);
});

pruefe("Feldtypen nur im Kinderfussball, Übungstypen nur im Juniorenfussball", () => {
  gleicheMenge(stufe("kinderfussball").feldtypen.map((f) => f.slug), feldtypSlugs, "Feldtypen");
  assert.deepEqual(stufe("juniorenfussball").feldtypen, []);
  gleicheMenge(
    stufe("juniorenfussball").uebungstypen.map((t) => t.slug),
    uebungstypSlugs,
    "Übungstypen",
  );
  assert.deepEqual(stufe("kinderfussball").uebungstypen, []);
  // Die Spielfeldgrösse: im Juniorenfussball immer, im Kinderfussball nur
  // beim freien Feld (#272).
  assert.equal(stufe("kinderfussball").spielfeldgroesse, true);
  assert.equal(stufe("kinderfussball").spielfeldgroesse_bei_feldtyp?.slug, "freies_feld");
  assert.equal(stufe("juniorenfussball").spielfeldgroesse, true);
  assert.equal(stufe("juniorenfussball").spielfeldgroesse_bei_feldtyp, null);
  for (const e of alleEinordnungen.filter((x) => x.stufe === "kinderfussball"))
    assert.equal(e.traegt_uebungstyp, false, e.slug);
});

// ── Richtmasse von Kleinfeld und Grossfeld (#392) ──────────────────────────
// Ohne sie kann der Assistent den Platzbedarf einer Kinderfussball-Übung
// nicht mit den Feldern eines Termins vergleichen. Fehlt eine Kategorie oder
// ein Feldtyp, schätzt er still ins Blaue.
const richtmasse = stufe("kinderfussball").feldtyp_richtmasse;
const richtmass = (ft: string, k: string) => {
  const r = richtmasse.find((x) => x.feldtyp.slug === ft)?.je_alterskategorie.find((x) => x.alterskategorie === k);
  assert.ok(r, `Richtmass ${ft}/${k} fehlt`);
  return r;
};

pruefe("Richtmasse: jeder Feldtyp ausser dem freien Feld, je Kategorie der Kinderfussball-Stufe", () => {
  gleicheMenge(
    richtmasse.map((r) => r.feldtyp.slug),
    feldtypSlugs.filter((f) => f !== FELDTYP_MIT_SPIELFELD),
    "Feldtypen mit Richtmass",
  );
  for (const r of richtmasse) {
    assert.ok(r.tore.trim(), `${r.feldtyp.slug}: Tore fehlen`);
    // In der Reihenfolge der Alterskategorien, keine fehlt, keine doppelt.
    assert.deepEqual(
      r.je_alterskategorie.map((k) => k.alterskategorie),
      [...kategorienFuer("kinderfussball")],
      r.feldtyp.slug,
    );
    for (const k of r.je_alterskategorie)
      for (const s of [k.laenge_m, k.breite_m]) {
        assert.ok(Number.isInteger(s.min) && s.min > 0 && s.min <= s.max, `${r.feldtyp.slug}/${k.alterskategorie}`);
        assert.ok(k.text.endsWith(" m"), k.text);
      }
  }
  assert.deepEqual(stufe("juniorenfussball").feldtyp_richtmasse, []);
  assert.equal(stufe("juniorenfussball").feldtyp_hinweis, null);
});

pruefe("Richtmasse = SFV-Ausführungsbestimmungen 2026/27, G beim Grossfeld wie F", () => {
  const soll: [string, string, [number, number], [number, number], string][] = [
    ["kleinfeld", "G", [20, 20], [15, 15], "ca. 20 × 15 m"],
    ["kleinfeld", "F", [25, 25], [20, 20], "ca. 25 × 20 m"],
    ["kleinfeld", "E", [25, 30], [20, 25], "25–30 × 20–25 m"],
    ["grossfeld", "F", [30, 30], [25, 25], "ca. 30 × 25 m"],
    ["grossfeld", "E", [43, 48], [25, 30], "43–48 × 25–30 m"],
  ];
  for (const [ft, k, [lMin, lMax], [bMin, bMax], text] of soll) {
    const r = richtmass(ft, k);
    assert.deepEqual(r.laenge_m, { min: lMin, max: lMax }, `${ft}/${k} Länge`);
    assert.deepEqual(r.breite_m, { min: bMin, max: bMax }, `${ft}/${k} Breite`);
    assert.equal(r.text, text, `${ft}/${k}`);
    assert.equal(r.wie_alterskategorie, null, `${ft}/${k}`);
  }
  // PO-Entscheid 12: Die Bestimmungen kennen in G kein Grossfeld.
  const g = richtmass("grossfeld", "G");
  const f = richtmass("grossfeld", "F");
  assert.equal(g.wie_alterskategorie, "F");
  assert.deepEqual(
    { l: g.laenge_m, b: g.breite_m, u: g.ungefaehr, t: g.text },
    { l: f.laenge_m, b: f.breite_m, u: f.ungefaehr, t: f.text },
  );
  assert.match(richtmasse.find((r) => r.feldtyp.slug === "grossfeld")!.tore, /5-m-Tore \(5 × 2 m\)/);
});

pruefe("Feldtyp-Hinweis nennt Torregel, 5-m-Tor, G wie F und das freie Feld ohne Meter", () => {
  assert.equal(stufe("kinderfussball").feldtyp_hinweis, FELDTYP_HINWEIS);
  for (const teil of [
    "nach den Toren einer Übung eingestuft, nicht nach ihrer Fläche",
    "grosses Tor einer Kinderfussball-Übung",
    "5-m-Tor",
    "in G kein Grossfeld, dort gilt das Richtmass von F",
    "freies Feld ohne Meterangabe",
    "keine bekannte Grösse",
  ])
    assert.ok(FELDTYP_HINWEIS.includes(teil), `«${teil}» fehlt im Hinweis`);
  assert.ok(!FELDTYP_HINWEIS.includes("—"), "Werkzeugtexte ohne Geviertstrich");
});

pruefe("Erscheinungsformen je Stufe = das jeweilige Manual", () => {
  gleicheMenge(
    stufe("kinderfussball").erscheinungsformen.map((f) => f.slug),
    erscheinungsformSlugs,
    "Erscheinungsformen Kinderfussball",
  );
  gleicheMenge(
    stufe("juniorenfussball").erscheinungsformen.map((f) => f.slug),
    erscheinungsform_juniorenSlugs,
    "Erscheinungsformen Juniorenfussball",
  );
});

pruefe("zieht_erscheinungsform_an = BLOCK_ERSCHEINUNGSFORM", () => {
  const ist = Object.fromEntries(
    alleEinordnungen
      .filter((e) => e.zieht_erscheinungsform_an)
      .map((e) => [e.slug, e.zieht_erscheinungsform_an]),
  );
  assert.deepEqual(ist, { ...BLOCK_ERSCHEINUNGSFORM });
});

pruefe("suchfilter_einordnung: jede Einordnung genau einmal, bei ihrer Altersstufe", () => {
  // Erwartet: alle Trainingsteile und Blöcke, der Kinderfussball-Hauptteil
  // ersetzt durch seine drei Hauptteilkategorien (Story #129).
  gleicheMenge(
    vok.suchfilter_einordnung.map((o) => o.wert),
    [
      ...trainingsteilSlugs.filter((t) => t !== "hauptteil"),
      ...hauptteilkategorieSlugs,
      ...junioren_blockSlugs,
    ],
    "suchfilter_einordnung",
  );
  for (const o of vok.suchfilter_einordnung) {
    const soll = (hauptteilkategorieSlugs as readonly string[]).includes(o.wert)
      ? "kinderfussball"
      : altersstufeDerEinordnung(o.wert);
    assert.equal(o.altersstufe, soll, o.wert);
  }
});

// ── Abschnitt «schema» (#199 AK 2, NFR 1/2) ─────────────────────────────────
// Gegen die Quellen geprüft, aus denen er NICHT gebaut ist (einordnungenFuer,
// BANDBREITEN, JUNIOREN_PFLICHT_BLOECKE, OHNE_DAUER_TEILE, istHauptteil,
// LEER_HINWEIS): Er entsteht aus der Editor-Gliederung und dem Spiegel der
// DB-Bedingungen — läuft eine davon auseinander, fällt es hier auf.
const schemaVon = (s: string) => {
  const a = vok.schema.altersstufen.find((x) => x.altersstufe === s);
  assert.ok(a, `Schema ${s} fehlt`);
  return a;
};
const schemaBloecke = (s: string) => schemaVon(s).teile.flatMap((t) => t.bloecke);
/** Wo der Editor die Stelle kennt: die Hauptteilkategorie im
 *  Kinderfussball-Hauptteil, sonst die Einordnung. */
const stelle = (b: { einordnung: string; hauptteilkategorie: string | null }) =>
  b.hauptteilkategorie ?? b.einordnung;

pruefe("schema: je Altersstufe, in der Reihenfolge von vocab.ts, Richtwerte als Orientierung", () => {
  assert.deepEqual(vok.schema.altersstufen.map((a) => a.altersstufe), [...altersstufeSlugs]);
  assert.equal(vok.schema.richtwerte_sind_orientierung, true);
  assert.match(vok.schema.richtwerte_hinweis, /Orientierung, keine Bedingung/);
  assert.equal(schemaVon("juniorenfussball").gesamtdauer_min, GESAMTDAUER_JUNIOREN);
  assert.equal(schemaVon("kinderfussball").gesamtdauer_min, null);
});

pruefe("schema: Teile und Blöcke = einordnungenFuer, der Kinderfussball-Hauptteil in drei Kategorien", () => {
  for (const s of altersstufeSlugs) {
    const soll = einordnungenFuer(s);
    const ist = schemaVon(s).teile;
    assert.deepEqual(ist.map((t) => t.slug), soll.map((g) => g.teil), `Teile ${s}`);
    assert.deepEqual(ist.map((t) => t.reihenfolge), soll.map((_, i) => i + 1), `Reihenfolge ${s}`);
    ist.forEach((t, i) => {
      const g = soll[i];
      const bloecke = t.bloecke.map((b) => `${b.einordnung}/${b.hauptteilkategorie ?? ""}`);
      if (g.bloecke.length > 0)
        assert.deepEqual(bloecke, g.bloecke.map((b) => `${b.slug}/`), `Blöcke ${s}/${t.slug}`);
      else if (t.hauptteilkategorie_pflicht)
        assert.deepEqual(bloecke, HAUPTTEILKATEGORIE_SLUGS.map((h) => `${g.teil}/${h}`), `Kategorien ${s}/${t.slug}`);
      else assert.deepEqual(bloecke, [`${g.teil}/`], `Block ${s}/${t.slug}`);
    });
  }
  // Die Pflicht zur Hauptteilkategorie steht genau am Kinderfussball-Hauptteil;
  // der Juniorenfussball kennt keine (PC 3).
  const mitPflicht = vok.schema.altersstufen.flatMap((a) =>
    a.teile.filter((t) => t.hauptteilkategorie_pflicht).map((t) => `${a.altersstufe}/${t.slug}`),
  );
  assert.deepEqual(mitPflicht, ["kinderfussball/hauptteil"]);
  assert.ok(schemaBloecke("juniorenfussball").every((b) => b.hauptteilkategorie === null));
});

pruefe("schema: jeder Richtwert aus BANDBREITEN genau einmal, nur im Juniorenfussball", () => {
  const ist: Record<string, { min: number; max: number }> = {};
  for (const t of schemaVon("juniorenfussball").teile) {
    if (t.richtwert) ist[t.slug] = { min: t.richtwert.min_min, max: t.richtwert.max_min };
    for (const b of t.bloecke)
      if (b.richtwert) ist[b.einordnung] = { min: b.richtwert.min_min, max: b.richtwert.max_min };
  }
  assert.deepEqual(ist, { ...BANDBREITEN });
  const kifu = schemaVon("kinderfussball").teile;
  assert.ok(kifu.every((t) => t.richtwert === null && t.bloecke.every((b) => b.richtwert === null)));
});

pruefe("schema: ohne Dauer genau OHNE_DAUER_TEILE, Gruppen genau istHauptteil", () => {
  for (const s of altersstufeSlugs) {
    for (const b of schemaBloecke(s)) {
      assert.equal(b.traegt_dauer, !OHNE_DAUER_TEILE.has(b.einordnung), `Dauer ${b.einordnung}`);
      assert.equal(b.traegt_gruppen, istHauptteil(b.einordnung), `Gruppen ${b.einordnung}`);
    }
    for (const t of schemaVon(s).teile)
      assert.equal(t.traegt_dauer, !OHNE_DAUER_TEILE.has(t.slug), `Dauer Teil ${s}/${t.slug}`);
  }
  // Das Auffangen beider Altersstufen: weder Dauer noch Richtwert (PC 2).
  for (const s of altersstufeSlugs) {
    const auffangen = schemaVon(s).teile[0];
    assert.equal(auffangen.slug, "auffangen");
    assert.equal(auffangen.traegt_dauer, false);
    assert.equal(auffangen.richtwert, null);
  }
});

pruefe("schema: Pflicht zum Veröffentlichen = JUNIOREN_PFLICHT_BLOECKE bzw. Einleitung und freies Spiel", () => {
  const pflicht = (s: string) => schemaBloecke(s).filter((b) => b.pflicht_zum_veroeffentlichen).map(stelle);
  assert.deepEqual(pflicht("juniorenfussball"), [...JUNIOREN_PFLICHT_BLOECKE]);
  assert.deepEqual(pflicht("kinderfussball"), ["einleitung", FREIES_SPIEL]);
});

pruefe("schema: Leer-Hinweise = LEER_HINWEIS, anziehende Formen = BLOCK_ERSCHEINUNGSFORM", () => {
  const alle = altersstufeSlugs.flatMap(schemaBloecke);
  assert.deepEqual(
    Object.fromEntries(alle.filter((b) => b.leer_hinweis).map((b) => [stelle(b), b.leer_hinweis])),
    { ...LEER_HINWEIS },
  );
  assert.deepEqual(
    Object.fromEntries(
      alle.filter((b) => b.zieht_erscheinungsform_an).map((b) => [b.einordnung, b.zieht_erscheinungsform_an]),
    ),
    { ...BLOCK_ERSCHEINUNGSFORM },
  );
});

pruefe("schema: «ungewöhnlich viele» nur im Kinderfussball, ab ANZAHL_HINWEIS + 1", () => {
  for (const t of schemaVon("kinderfussball").teile)
    assert.equal(t.anzahl_hinweis_ab, ANZAHL_HINWEIS[t.slug as keyof typeof ANZAHL_HINWEIS] + 1, t.slug);
  assert.ok(schemaVon("juniorenfussball").teile.every((t) => t.anzahl_hinweis_ab === null));
});

pruefe("Kein Label im Vokabular ist leer", () => {
  const leer: string[] = [];
  const pruefeLabels = (x: unknown, pfad: string) => {
    if (Array.isArray(x)) x.forEach((v, i) => pruefeLabels(v, `${pfad}[${i}]`));
    else if (x && typeof x === "object")
      for (const [k, v] of Object.entries(x)) {
        if ((k === "label" || k === "definition") && (typeof v !== "string" || !v.trim()))
          leer.push(`${pfad}.${k}`);
        pruefeLabels(v, `${pfad}.${k}`);
      }
  };
  pruefeLabels(vok, "vokabular");
  assert.deepEqual(leer, []);
});

// ── Eingaben: Enums statt freier Strings ────────────────────────────────────
// Die Einordnung landet interpoliert in einer PostgREST-`or=`-Klausel. Nimmt
// das Schema einen freien String an, lässt sich die Abfrage von aussen umbauen.
const nimmt = (eingabe: unknown) => SucheEingabe.safeParse(eingabe).success;

pruefe("SucheEingabe nimmt jeden Wert aus dem Vokabular an", () => {
  for (const a of altersstufeSlugs) assert.ok(nimmt({ altersstufe: a }), a);
  for (const o of vok.suchfilter_einordnung) assert.ok(nimmt({ einordnung: [o.wert] }), o.wert);
  assert.ok(nimmt({ einordnung: vok.suchfilter_einordnung.map((o) => o.wert) }), "alle zugleich");
  assert.ok(nimmt({ kategorien: [...kategorienSlugs] }));
  assert.ok(nimmt({ feldtyp: [...feldtypSlugs] }));
  assert.ok(nimmt({ uebungstyp: [...uebungstypSlugs] }));
  assert.ok(nimmt({ erscheinungsform: [...erscheinungsformSlugs, ...erscheinungsform_juniorenSlugs] }));
  assert.ok(nimmt({ q: "Hand", kinder: 8, nur_eigene: true, limit: 50, offset: 10 }));
});

pruefe("SucheEingabe lehnt ab, was nicht im Vokabular steht", () => {
  assert.ok(!nimmt({ einordnung: ["hauptteil"] }), "hauptteil");
  assert.ok(!nimmt({ einordnung: ["einleitung),or(owner_id.is.null"] }), "Injektion");
  assert.ok(!nimmt({ kategorien: ["G,owner_id.is.null"] }), "Injektion Kategorien");
  assert.ok(!nimmt({ altersstufe: "erwachsene" }), "Altersstufe");
  assert.ok(!nimmt({ kinder: 0 }), "kinder 0");
  assert.ok(!nimmt({ limit: 51 }), "limit 51");
  assert.ok(!nimmt({ offset: -1 }), "offset -1");
});

pruefe("SucheEingabe setzt limit 20 und offset 0 als Vorgabe", () => {
  const e = SucheEingabe.parse({});
  assert.equal(e.limit, 20);
  assert.equal(e.offset, 0);
});

// ── Ergebnis-Helfer (Konvention aller Werkzeuge) ────────────────────────────
const textVon = (r: CallToolResult) =>
  r.content.map((c) => ("text" in c ? c.text : "")).join("");
const fehlerVon = (r: CallToolResult) =>
  (r.structuredContent as { fehler: Record<string, unknown> }).fehler;

pruefe("fehlerErgebnis: isError, Text mit [art] feld: meldung und zulässigen Werten", () => {
  const r = fehlerErgebnis({ art: "regel", feld: "x", meldung: "y", zulaessig: ["a", "b"] });
  assert.equal(r.isError, true);
  assert.ok(textVon(r).startsWith("[regel] x: y"), textVon(r));
  assert.ok(textVon(r).includes("Zulässig: a, b."), textVon(r));
  assert.deepEqual(r.structuredContent, {
    fehler: { art: "regel", meldung: "y", feld: "x", zulaessig: ["a", "b"] },
  });
});

pruefe("fehlerErgebnis: die Bremse nennt retry_after in Text und Struktur", () => {
  const r = fehlerErgebnis({ art: "gebremst", meldung: "Zu viele", retryAfter: 42, wiederholbar: true });
  assert.ok(textVon(r).includes("retry_after=42"), textVon(r));
  assert.equal(fehlerVon(r).retry_after, 42);
  assert.equal(fehlerVon(r).wiederholbar, true);
});

pruefe("fehlerErgebnis: jedes gesetzte Feld eines Kern-Fehlers kommt an", () => {
  // Record über ALLE Schlüssel: ein neues Feld in KernFehler, das hier fehlt,
  // bricht schon den Typecheck — und damit die Frage, ob es ankommt.
  const voll: Required<Omit<KernFehler, "ok">> = {
    art: "bedingung",
    meldung: "Es fehlt etwas.",
    feld: "sichtbarkeit",
    zulaessig: ["a"],
    bedingung: "einleitung",
    varianteId: "v1",
    fehlend: [{ bedingung: "einleitung", varianteId: null }],
    wiederholbar: false,
    retryAfter: 7,
    fremd: true,
    verstoesse: [{ feld: "kategorien", meldung: "m", zulaessig: ["G"] }],
    hinweis: "Es ist keine Kopie entstanden.",
    verfallend: 2,
    nachtraege: 1,
    absagen: 1,
    fristAbgelaufen: true,
    verschwindend: 3,
    verfallendSpiele: 1,
    kennzeichnungen: 1,
    anmeldungen: 1,
    treffpunktEntfaellt: true,
    grenze: { art: "uebungen", bestand: 50 },
  };
  const SNAKE: Record<string, string> = {
    retryAfter: "retry_after",
    varianteId: "variante_id",
    fristAbgelaufen: "frist_abgelaufen",
    verfallendSpiele: "verfallend_spiele",
    treffpunktEntfaellt: "treffpunkt_entfaellt",
  };
  const aussen = (k: string) => SNAKE[k] ?? k;
  const f = fehlerVon(fehlerErgebnis(voll));
  // Einzige Ausnahme: `grenze` ist das Merkmal der Oberfläche (#588); der
  // Assistent liest die Grenze aus Meldung und Hinweis.
  assert.deepEqual(
    Object.keys(f).sort(),
    Object.keys(voll).filter((k) => k !== "grenze").map(aussen).sort(),
    "Schlüssel in structuredContent.fehler",
  );
  assert.ok(!("grenze" in f));
  assert.deepEqual(f.bedingung, "einleitung");
  // Auch in `fehlend` snake_case (#196): aussen trägt nichts camelCase.
  assert.deepEqual(f.fehlend, [{ bedingung: "einleitung", variante_id: null }]);
  assert.equal(f.variante_id, "v1");
  // Die Verstösse sind schon in Werkzeug-Feldnamen (#143) und reisen unverändert.
  assert.deepEqual(f.verstoesse, [{ feld: "kategorien", meldung: "m", zulaessig: ["G"] }]);
  // `false` ist eine Auskunft und bleibt; Leeres fällt weg.
  assert.equal(f.wiederholbar, false);
  const knapp = fehlerVon(fehlerErgebnis({ art: "regel", meldung: "m", zulaessig: [], feld: "" }));
  assert.deepEqual(knapp, { art: "regel", meldung: "m" });
});

pruefe("fehlerErgebnis: mehrere Verstösse je auf einer Zeile, der Hinweis zuletzt (#143 AK 6)", () => {
  const r = fehlerErgebnis({
    art: "regel",
    meldung: "Die Übung entspricht den Regeln nicht.",
    verstoesse: [
      { feld: "kategorien", meldung: "Gehört nicht dazu. Nicht zulässig: D.", zulaessig: ["G", "F", "E"] },
      { feld: "name", meldung: "Bitte einen Namen angeben." },
    ],
    hinweis: "Es ist nichts angelegt worden.",
  });
  assert.equal(
    textVon(r),
    "[regel] Die Übung entspricht den Regeln nicht.\n" +
      "- kategorien: Gehört nicht dazu. Nicht zulässig: D. Zulässig: G, F, E.\n" +
      "- name: Bitte einen Namen angeben.\n" +
      "Es ist nichts angelegt worden.",
  );
  // Ohne Verstösse bleibt es eine Zeile.
  assert.equal(textVon(fehlerErgebnis({ art: "eingabe", meldung: "m", hinweis: "h" })), "[eingabe] m h");
});

// ── Übungsangaben (#143) ────────────────────────────────────────────────────
const ANLEGEN = { name: "Probe", einordnung: "einleitung", kategorien: ["F"], altersstufe: "kinderfussball" };

pruefe("UebungAnlegenEingabe: beide Altersstufen und alle Angaben, Pflicht nur das Nötigste", () => {
  assert.ok(UebungAnlegenEingabe.safeParse(ANLEGEN).success);
  assert.ok(
    UebungAnlegenEingabe.safeParse({ ...ANLEGEN, einordnung: "jun-spiel", kategorien: ["D"], altersstufe: "juniorenfussball" })
      .success,
    "die Zugehörigkeit zur Altersstufe entscheidet der Kern, nicht das Schema",
  );
  const voll = {
    ...ANLEGEN,
    hauptteilkategorie: null,
    offen_starten: "a",
    ueben: ["- b"],
    wetteifern: "c",
    aufbau: null,
    varianten: "v",
    erscheinungsformen: [erscheinungsformSlugs[0], erscheinungsform_juniorenSlugs[0]],
    uebungstyp: null,
    feldtyp: "freies_feld",
    spielfeld: { laenge_m: 20, breite_m: 15 },
    anzahl_kinder: { min: 6, max: null },
    material: { liste: [{ art: "pylone", farbe: "rot", menge: 4 }, { art: "tor", menge: 2 }], ergaenzung: ["Pfeife"] },
  };
  assert.ok(UebungAnlegenEingabe.safeParse(voll).success);
  assert.ok(UebungAnlegenEingabe.safeParse({ ...voll, ueben: "b" }).success, "«ueben» auch als Text");
  for (const pflicht of ["name", "einordnung", "kategorien", "altersstufe"]) {
    const { [pflicht]: _weg, ...ohne } = ANLEGEN as Record<string, unknown>;
    assert.ok(!UebungAnlegenEingabe.safeParse(ohne).success, `ohne ${pflicht}`);
  }
});

pruefe("UebungAnlegenEingabe: streng - ein unbekanntes oder vertipptes Feld fällt nicht still weg", () => {
  const abgelehnt = [
    { ...ANLEGEN, erscheinungsform: ["mutig-tore-erzielen"] }, // Name des Suchfilters
    { ...ANLEGEN, spielfeld: { laenge: 20, breite_m: 15 } },
    { ...ANLEGEN, anzahl_kinder: { min: 1, empfohlen: 4 } },
    { ...ANLEGEN, material: { liste: [{ art: "pylone", menge: 1, farben: "rot" }] } },
    { ...ANLEGEN, material: { zusatz: ["Pfeife"] } },
    { ...ANLEGEN, einordnung: "hauptteil-x" },
    { ...ANLEGEN, altersstufe: "erwachsene" },
  ];
  for (const e of abgelehnt) assert.ok(!UebungAnlegenEingabe.safeParse(e).success, JSON.stringify(e));
});

pruefe("alsUebungInhalt: jede Angabe kommt beim Kern an, null bleibt null", () => {
  const i = alsUebungInhalt(
    UebungAnlegenEingabe.parse({
      ...ANLEGEN,
      hauptteilkategorie: null,
      offen_starten: "a",
      ueben: "b",
      wetteifern: "c",
      aufbau: "d",
      varianten: "v",
      erscheinungsformen: ["mutig-tore-erzielen"],
      uebungstyp: "spielform",
      feldtyp: "freies_feld",
      spielfeld: { laenge_m: 20, breite_m: 15 },
      anzahl_kinder: { min: 6, max: 8 },
      material: { liste: [{ art: "pylone", menge: 4 }], ergaenzung: ["Pfeife"] },
    }),
  );
  assert.deepEqual(i, {
    name: "Probe",
    einordnung: "einleitung",
    kategorien: ["F"],
    hauptteilkategorie: null,
    offenStarten: "a",
    ueben: "b",
    wetteifern: "c",
    aufbau: "d",
    varianten: "v",
    erscheinungsformen: ["mutig-tore-erzielen"],
    uebungstyp: "spielform",
    feldtyp: "freies_feld",
    spielfeld: { laengeM: 20, breiteM: 15 },
    anzahlKinder: { min: 6, max: 8 },
    material: { liste: [{ art: "pylone", menge: 4 }], ergaenzung: ["Pfeife"] },
  });
  assert.equal(alsUebungInhalt(UebungAnlegenEingabe.parse({ ...ANLEGEN, spielfeld: null })).spielfeld, null);
});

pruefe("UebungAendernEingabe: Pflicht nur die Kennung, jede Angabe frei, null nur wo freiwillig (#144)", () => {
  const K = { kennung: "mein-slug-abc123" };
  assert.ok(UebungAendernEingabe.safeParse(K).success);
  assert.ok(UebungAendernEingabe.safeParse({ ...K, name: "Neu", altersstufe: "juniorenfussball" }).success);
  assert.ok(UebungAendernEingabe.safeParse({ ...K, varianten: null, spielfeld: null, material: null }).success);
  // Je Teil des Materials: `null` leert genau diesen Teil.
  const teile = UebungAendernEingabe.parse({ ...K, material: { liste: null, ergaenzung: null } });
  assert.deepEqual(alsUebungPatch(teile).material, { liste: null, ergaenzung: null });
  assert.ok(!UebungAendernEingabe.safeParse({ name: "Neu" }).success, "ohne Kennung");
  assert.ok(!UebungAendernEingabe.safeParse({ kennung: "  " }).success, "leere Kennung");
  for (const pflicht of ["name", "einordnung", "kategorien"])
    assert.ok(!UebungAendernEingabe.safeParse({ ...K, [pflicht]: null }).success, `${pflicht}: null`);
  // Streng wie beim Anlegen: ein vertipptes Feld fällt nicht still weg.
  assert.ok(!UebungAendernEingabe.safeParse({ ...K, erscheinungsform: [] }).success);
  assert.ok(!UebungAendernEingabe.safeParse({ ...K, spielfeld: { laenge: 1, breite_m: 2 } }).success);
});

pruefe("alsUebungPatch: Fehlendes bleibt undefined («bleibt»), null bleibt null («leeren»)", () => {
  const p = alsUebungPatch(UebungAendernEingabe.parse({ kennung: "k", name: "Neu", aufbau: null, spielfeld: null }));
  assert.equal(p.name, "Neu");
  assert.equal(p.aufbau, null);
  assert.equal(p.spielfeld, null);
  for (const bleibt of ["einordnung", "kategorien", "offenStarten", "material", "anzahlKinder"] as const)
    assert.equal(p[bleibt], undefined, bleibt);
  assert.ok(!("kennung" in p) && !("altersstufe" in p), "Kennung und Altersstufe sind keine Angaben");
});

// ── Feld-Diagramm (#145) ────────────────────────────────────────────────────
pruefe("DiagrammEingabe: locker - jedes Element erreicht den Kern, Pflicht ist nur «elemente» als Liste", () => {
  // Der Kern benennt jedes schlechte Element einzeln; das Schema bricht nie
  // beim ersten ab.
  assert.ok(DiagrammEingabe.safeParse({ elemente: [1, "x", null] }).success);
  assert.ok(DiagrammEingabe.safeParse({ elemente: [], version: 1 }).success);
  for (const roh of [{}, { elemente: "x" }, null, []]) assert.ok(!DiagrammEingabe.safeParse(roh).success, JSON.stringify(roh));
  // Nur beim Anlegen; an einer bestehenden Übung setzt «uebung_diagramm_setzen».
  assert.ok(UebungAnlegenEingabe.safeParse({ ...ANLEGEN, diagramm: { elemente: [] } }).success);
  assert.ok(!UebungAendernEingabe.safeParse({ kennung: "k", diagramm: { elemente: [] } }).success);
  z.toJSONSchema(UebungAnlegenEingabe);
});

pruefe("UEBUNG_ANGABEN: beide Altersstufen mit Pflicht, Ablaufform und Spielfeld-Grenzen (#147 AK 1)", () => {
  const kifu = angabenText("kinderfussball");
  const jun = angabenText("juniorenfussball");
  assert.equal(UEBUNG_ANGABEN, `${kifu} ${jun}`);
  for (const teil of [
    "Pflicht sind «name», «einordnung» (auffangen, einleitung, hauptteil, ausklang) und «kategorien» (G, F, E)",
    "in auffangen, ausklang: «aufbau»",
    "in einleitung: «offen_starten», «ueben», «wetteifern»",
    "in hauptteil mit «hauptteilkategorie» fussball-spielen-lernen oder vielseitigkeit-erleben: " +
      "«hauptteilkategorie», «offen_starten», «ueben», «wetteifern»",
    "in hauptteil mit «hauptteilkategorie» fussball-spielen: «hauptteilkategorie», «aufbau»",
    "«feldtyp» (kleinfeld, grossfeld, freies_feld)",
    "«spielfeld» (nur bei «feldtyp» freies_feld; Länge und Breite zusammen, ganze Meter von 5 bis 120)",
  ])
    assert.ok(kifu.includes(teil), `fehlt: ${teil}\n${kifu}`);
  assert.ok(kifu.endsWith("Nicht vorgesehen: «uebungstyp»."), kifu);
  // Juniorenfussball: in jedem Block der Beschreibungstext, kein Fahrplan,
  // keine Hauptteilkategorie, kein Feldtyp; Spielfeld ohne Feldtyp-Bedingung.
  for (const teil of [
    "Pflicht sind «name», «einordnung» (jun-auffangen, jun-aufwaermen, jun-spielform-trainingsziel, " +
      "jun-explosivitaet, jun-spielformen, jun-spiel, jun-abschluss) und «kategorien» (D, C, B, A), " +
      "dazu in jeder Einordnung «aufbau».",
    "«uebungstyp» (basisspielform, spielform, isolierte-form; nur in jun-aufwaermen, " +
      "jun-spielform-trainingsziel, jun-explosivitaet, jun-spielformen, jun-spiel)",
    "«spielfeld» (Länge und Breite zusammen, ganze Meter von 5 bis 120)",
    "Nicht vorgesehen: «hauptteilkategorie», «offen_starten», «ueben», «wetteifern», «feldtyp».",
  ])
    assert.ok(jun.includes(teil), `fehlt: ${teil}\n${jun}`);
  // Das Auffangen trägt keine Erscheinungsform.
  assert.match(jun, /«erscheinungsformen» \([^)]*; nur in jun-aufwaermen, [^)]*jun-abschluss\)/);
});

pruefe("erfolg: structuredContent ist der Wert selbst, content derselbe als JSON", () => {
  const w = { a: 1, b: ["x"] };
  const r = erfolg(w);
  assert.equal(r.structuredContent, w);
  assert.equal(r.isError, undefined);
  assert.equal(JSON.parse(textVon(r)).a, 1);
});

pruefe("ausKern: ok → erfolg, Fehler → fehlerErgebnis", () => {
  const w = { x: 1 };
  assert.deepEqual(ausKern({ ok: true, wert: w }), erfolg(w));
  const fehler: KernFehler = { ok: false, art: "nicht_gefunden", meldung: "weg", feld: "kennung" };
  const r = ausKern<Record<string, unknown>>(fehler);
  assert.equal(r.isError, true);
  assert.equal(textVon(r), "[nicht_gefunden] kennung: weg");
  assert.deepEqual(fehlerVon(r), { art: "nicht_gefunden", meldung: "weg", feld: "kennung" });
});

// ── Kein Änderungs-Abo (lib/mcp/abo.ts) ─────────────────────────────────────
// Am echten Handler statt an den Optionen: Die Wirkung hängt an SDK-Semantik
// (`listChanged ?? true` beim Registrieren, `maxSubscriptions: 0` = keins),
// die ein Update still ändern könnte — dann hielten Clients wieder endlose
// `subscriptions/listen`-Streams offen und Funktionen bis zum Timeout wach.
const aboHandler = createMcpHandler(
  (server) => {
    server.registerTool("probe", { description: "Probe" }, async () => ({ content: [] }));
  },
  { serverInfo: { name: "probe", version: "0" }, ...KEIN_ABO },
);
// So schickt der Referenz-Client (@modelcontextprotocol/client 2.3) eine
// Anfrage im Protokoll 2026-07-28.
function moderneAnfrage(methode: string, params: Record<string, unknown> = {}): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-method": methode,
      "mcp-protocol-version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "a1",
      method: methode,
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": { name: "probe", version: "0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
        ...params,
      },
    }),
  });
}
// Ein offener Stream liefert nie ein Ende — darum vor dem Lesen die Art prüfen.
async function jsonOderStream(res: Response): Promise<unknown> {
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    await res.body?.cancel();
    return "stream";
  }
  return res.json();
}
const ABO_PARAMS = { notifications: { toolsListChanged: true } };
const entdeckt = (await jsonOderStream(await aboHandler(moderneAnfrage("server/discover")))) as {
  result?: { capabilities?: { tools?: { listChanged?: boolean } } };
};
const sdkAbo = await jsonOderStream(await aboHandler(moderneAnfrage("subscriptions/listen", ABO_PARAMS)));
const fruehAbo = await aboAbweisung(moderneAnfrage("subscriptions/listen", ABO_PARAMS));
const fruehAboWert = fruehAbo ? await jsonOderStream(fruehAbo) : null;
const fruehAufruf = await aboAbweisung(moderneAnfrage("tools/call", { name: "probe", arguments: {} }));

pruefe("Der Server kündigt keine Änderungen am Werkzeugsatz an", () => {
  assert.equal(entdeckt.result?.capabilities?.tools?.listChanged, false);
});

pruefe("Ein trotzdem gesendetes Abo weist das SDK sofort ab, statt einen Stream zu öffnen", () => {
  assert.deepEqual(sdkAbo, { jsonrpc: "2.0", error: ABO_ABGEWIESEN, id: "a1" });
});

pruefe("Die Frühabweisung antwortet wie das SDK und lässt alles andere durch", () => {
  assert.deepEqual(fruehAboWert, sdkAbo);
  assert.equal(fruehAufruf, null);
});

// ── Konten ohne Verein: die Grenzen im KI-Zugang (Story #588 AK 2, 3, 7, 8) ──
//
// Ohne Datenbank: Ein Client, der auf jedes Einfügen mit dem Marker der
// Datenebene antwortet, durchläuft die vier Wege (Übung anlegen, Übung kopieren,
// Training anlegen, Training kopieren) und die beiden Rümpfe dahinter. Was die
// Datenebene dazu sagt, prüft `check:kern-db` und `supabase/tests`.

type DbAntwort = { data: unknown; error: { message: string; code?: string } | null };

function fakeClient(antwort: (tabelle: string, art: string) => DbAntwort) {
  const aufrufe: string[] = [];
  const baustein = (tabelle: string) => {
    let art = "select";
    const b: Record<string, unknown> = {};
    const fertig = () => {
      aufrufe.push(`${art} ${tabelle}`);
      return Promise.resolve(antwort(tabelle, art));
    };
    for (const m of ["select", "eq", "order", "in", "limit"]) b[m] = () => b;
    for (const m of ["insert", "delete", "update"]) b[m] = () => ((art = m), b);
    b.single = fertig;
    b.maybeSingle = fertig;
    b.then = (ok: (v: DbAntwort) => unknown, nein?: (e: unknown) => unknown) => fertig().then(ok, nein);
    return b;
  };
  const storage = {
    from: () => ({
      copy: async () => (aufrufe.push("copy bild"), { error: null }),
      remove: async (pfade: string[]) => (aufrufe.push(`remove ${pfade.join(",")}`), { error: null }),
      getPublicUrl: (pfad: string) => ({ data: { publicUrl: `https://x.test/storage/v1/object/public/exercise-images/${pfad}` } }),
    }),
  };
  return { client: { from: baustein, storage } as never, aufrufe };
}

const KONTO_FEHLER = (art: "UEBUNGEN" | "TRAININGS", n: number) => ({
  message: `KONTO_${art}_VOLL ${n}`,
  code: "P0001",
});
const QUELLE_UEBUNG = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "quelle-1",
  name: "Quelle",
  altersstufe: "kinderfussball",
  owner_id: "11111111-1111-4111-8111-111111111112",
  source: "user",
  visibility: "private",
  trainingsteil: "einleitung",
  hauptteilkategorie: null,
  bild_url: "https://x.test/storage/v1/object/public/exercise-images/u/quelle.webp",
  bild_quelle: "foto",
  diagramm: null,
};
const QUELLE_TRAINING = {
  id: "11111111-1111-4111-8111-111111111113",
  name: "Quelle",
  altersstufe: "kinderfussball",
  stufen: ["F"],
  ziel: null,
  owner_id: "11111111-1111-4111-8111-111111111112",
  team_id: null,
  visibility: "private",
};
const NUTZER = "11111111-1111-4111-8111-111111111112";
const nurLesen = (tabelle: string, art: string): DbAntwort | null =>
  art !== "select"
    ? null
    : tabelle === "exercises"
      ? { data: QUELLE_UEBUNG, error: null }
      : tabelle === "trainings"
        ? { data: QUELLE_TRAINING, error: null }
        : { data: [], error: null };

const voll = async (art: "UEBUNGEN" | "TRAININGS", n: number) => {
  const { client, aufrufe } = fakeClient((tabelle, a) => nurLesen(tabelle, a) ?? { data: null, error: KONTO_FEHLER(art, n) });
  const { legeUebungAn } = await import("../lib/kern/uebungen");
  const { kopiereUebungNach } = await import("../lib/kern/uebungen");
  const { legeTrainingAn } = await import("../lib/kern/training");
  const { kopiereTrainingNach } = await import("../lib/kern/kopie");
  const { legeUebungsKopieAn } = await import("../lib/fassung");
  return {
    aufrufe,
    anlegenUebung: await legeUebungAn(client, NUTZER, {
      altersstufe: "kinderfussball",
      name: "Probe",
      einordnung: "einleitung",
      kategorien: ["F"],
      offenStarten: "Offen",
      ueben: "Üben",
      wetteifern: "Wett",
    } as never),
    kopierenUebung: await kopiereUebungNach(client, NUTZER, { kennung: QUELLE_UEBUNG.slug }),
    anlegenTraining: await legeTrainingAn(client, NUTZER, { name: "Probe", altersstufe: "kinderfussball", stufen: ["F"] }),
    kopierenTraining: await kopiereTrainingNach(client, NUTZER, { quelleId: QUELLE_TRAINING.id }),
    bibliothek: await legeUebungsKopieAn(client, QUELLE_UEBUNG as never, { ownerId: NUTZER, altersstufe: "kinderfussball" }),
  };
};
const uebungenVoll = await voll("UEBUNGEN", 50);
const trainingsVoll = await voll("TRAININGS", 31);

pruefe("Konto ohne Verein (#588 AK 2, 7): Übung anlegen und kopieren, auch aus dem Training in die Bibliothek — dieselbe Auskunft, nichts entstanden, kein Wiederholen", () => {
  const satz = kontoGrenzeText("uebungen", 50);
  for (const f of [uebungenVoll.anlegenUebung, uebungenVoll.kopierenUebung]) {
    assert.equal(f.ok, false);
    if (f.ok) return;
    assert.equal(f.art, "regel");
    assert.equal(f.meldung, satz, "wie in der Anwendung");
    assert.equal(f.hinweis, "Es ist nichts entstanden.");
    assert.equal(f.wiederholbar, undefined);
    // Wie es beim Assistenten ankommt: Text und Struktur, ohne Aufforderung zum Wiederholen.
    const r = fehlerErgebnis(f);
    assert.ok(textVon(r).startsWith(`[regel] ${satz}`), textVon(r));
    assert.ok(textVon(r).endsWith("Es ist nichts entstanden."), textVon(r));
    assert.ok(!/wiederhol|noch einmal/i.test(textVon(r)), textVon(r));
    assert.ok(!("wiederholbar" in fehlerVon(r)), "nicht als wiederholbar gekennzeichnet");
    assert.ok(!/(uebung|training)_loeschen/.test(textVon(r)), "kein Löschwerkzeug");
  }
  // Das Kopieren aus dem Training (Rumpf der Bibliothek) meldet denselben Satz.
  assert.equal(uebungenVoll.bibliothek.ok, false);
  if (!uebungenVoll.bibliothek.ok) {
    assert.equal(uebungenVoll.bibliothek.error, satz);
    assert.equal(uebungenVoll.bibliothek.art, "regel");
    assert.equal(uebungenVoll.bibliothek.hinweis, "Es ist nichts entstanden.");
  }
  // Eine abgewiesene Kopie hinterlässt nichts, auch kein Bild: Die kopierte Bilddatei wird entfernt.
  const bildKopien = uebungenVoll.aufrufe.filter((a) => a === "copy bild").length;
  const bildEntfernt = uebungenVoll.aufrufe.filter((a) => a.startsWith("remove ")).length;
  assert.equal(bildKopien, 2, "uebung_kopieren und Bibliothek kopieren das Bild vor dem Einfügen");
  assert.equal(bildEntfernt, bildKopien, "jede abgewiesene Kopie räumt ihr Bild ab");
  assert.ok(!uebungenVoll.aufrufe.includes("delete exercises"), "nichts zu löschen: es entstand keine Zeile");
});

pruefe("Konto ohne Verein (#588 AK 3, 7): Training anlegen und übernehmen — dieselbe Auskunft, nichts entstanden, kein «gefahrlos wiederholen»", () => {
  const satz = kontoGrenzeText("trainings", 31);
  assert.equal(satz, "Du besitzt 31 Trainings, höchstens 30 sind erlaubt. In der Anwendung schaffst du durch Löschen wieder Platz. Für Personen in einem Verein gelten die Grenzen nicht.");
  for (const f of [trainingsVoll.anlegenTraining, trainingsVoll.kopierenTraining]) {
    assert.equal(f.ok, false);
    if (f.ok) return;
    assert.equal(f.art, "regel");
    assert.equal(f.meldung, satz);
    assert.equal(f.hinweis, "Es ist nichts entstanden.", "nicht «gefahrlos wiederholen»");
    assert.equal(f.wiederholbar, undefined);
    const r = fehlerErgebnis(f);
    assert.ok(!/wiederhol|noch einmal/i.test(textVon(r)), textVon(r));
    assert.ok(!("wiederholbar" in fehlerVon(r)));
    assert.ok(!/(uebung|training)_loeschen/.test(textVon(r)), "kein Löschwerkzeug");
  }
  assert.ok(!trainingsVoll.aufrufe.includes("delete trainings"), "nichts zu löschen: es entstand keine Zeile");
});

pruefe("Konto ohne Verein (#588): der Satz nennt die Art - Übungen und Trainings haben je ihre Grenze", () => {
  // Ein Marker der anderen Art ergibt den eigenen Satz: Bei Trainings nennt er Trainings.
  assert.ok(uebungenVoll.kopierenUebung.ok === false && uebungenVoll.kopierenUebung.meldung.includes("Übungen"));
  assert.ok(trainingsVoll.kopierenTraining.ok === false && trainingsVoll.kopierenTraining.meldung.includes("Trainings"));
});

pruefe("Konto ohne Verein (#588 AK 7): die Werkzeugbeschreibungen der vier Wege nennen die Grenze; «gefahrlos wiederholen» gilt bei training_kopieren nicht für sie", () => {
  const beschreibungen = new Map<string, string>();
  const teamKennung = new Map<string, boolean>();
  const server = {
    registerTool: (name: string, def: { description?: string; inputSchema?: { shape?: Record<string, unknown> } }) => {
      beschreibungen.set(name, def.description ?? "");
      teamKennung.set(name, "team_id" in (def.inputSchema?.shape ?? {}));
    },
  };
  registriereWerkzeuge(server as never);
  for (const name of ["uebung_anlegen", "uebung_kopieren"])
    assert.ok(beschreibungen.get(name)?.includes(KONTO_GRENZE_WERKZEUG.uebungen), name);
  for (const name of ["training_anlegen", "training_kopieren"])
    assert.ok(beschreibungen.get(name)?.includes(KONTO_GRENZE_WERKZEUG.trainings), name);
  const kopieren = beschreibungen.get("training_kopieren") ?? "";
  // «Gefahrlos wiederholen» nur bei «technisch» und «konflikt» — nie bei einer Regel wie der Grenze (Fix-Lauf #588).
  assert.match(kopieren, /«hinweis» sagt, dass nichts entstanden ist - bei «technisch» oder «konflikt» mit dem Zusatz, dass ein Wiederholen gefahrlos ist -/);
  assert.ok(!/ausser bei der Grenze unten/.test(kopieren));
  // Die Aufforderung, bei einer Ablehnung «noch einmal zu senden», gilt für Verstösse, nicht für die Grenze.
  const anlegen = beschreibungen.get("uebung_anlegen") ?? "";
  assert.match(anlegen, /Nach einer Ablehnung wegen verletzter Angaben die ganze Übung korrigiert noch einmal senden\./);
  assert.ok(!/Danach die ganze Übung korrigiert/.test(anlegen));
  // Übungen löscht der Assistent nie (#588 OoS 3): kein Werkzeug, kein Verweis darauf.
  assert.ok(![...beschreibungen.keys()].some((n) => n === "uebung_loeschen"));
  for (const [name, text] of beschreibungen)
    if (name.startsWith("uebung")) assert.ok(!/uebung_loeschen/.test(text), name);
  // Übung ins Training übernehmen zählt nicht (AK 4) — die Beschreibung sagt es.
  assert.match(beschreibungen.get("training_uebung_zuordnen") ?? "", /zählt nicht zur Grenze der eigenen Übungen/);
  // AK 9 (schon durchgesetzt, hier festgehalten): Team, Spielerliste, Kader und Kalender öffnet nur, wer die Kennung
  // eines Teams nennt, und `pruefeTeamMitglied` liest das Team unter der RLS (lib/kern/zugriff.ts) — ein Konto ohne
  // Team bekommt «nicht gefunden». Kein Werkzeug listet fremde Teams, `teams_abrufen` nur die eigenen.
  for (const name of ["team_plan_abrufen", "team_mitglieder_abrufen", "spielerliste_abrufen", "kader_abrufen", "termin_festlegen", "spieler_aufnehmen"])
    assert.ok(teamKennung.get(name), `${name} verlangt «team_id»`);
});

// ── KI-Assistent und Vereine (Story #589) ───────────────────────────────────
// Die Werkzeugbeschreibungen sind das ganze Modell des Assistenten (keine
// Server-Anweisungen): Hier steht fest, was sie seit Story 13 über Verein,
// weitere Teams, Herausnehmen, Löschen und den privaten Link sagen.
/** Beschreibungen und Eingabefelder aller registrierten Werkzeuge. */
function werkzeugTexte() {
  const beschreibung = new Map<string, string>();
  const eingabe = new Map<string, string[]>();
  registriereWerkzeuge({
    registerTool: (name: string, def: { description?: string; inputSchema?: { shape?: Record<string, unknown> } }) => {
      beschreibung.set(name, def.description ?? "");
      eingabe.set(name, Object.keys(def.inputSchema?.shape ?? {}));
    },
  } as never);
  return { beschreibung, eingabe };
}

pruefe("Story 13 (#589 A2): der Werkzeugsatz bleibt, wie er ist - kein Werkzeug umbenannt, entfernt oder neu (seither neu: #598 team_infos_*, #657 spieler_link_zugestellt)", () => {
  assert.deepEqual([...werkzeugTexte().beschreibung.keys()].sort(), [
    "abholadresse_erneuern", "diagramm_katalog_abrufen", "gruppe_anlegen", "gruppe_entfernen", "gruppe_umbenennen",
    "kader_abrufen", "kader_anlegen", "kader_entfernen", "kader_herausnehmen", "kader_umbenennen", "kader_zuteilen",
    "schnuppertraining_abrufen", "schnuppertraining_festlegen", "selbstabholung_abrufen", "selbstabholung_schalten",
    "spieler_aendern", "spieler_aufnehmen", "spieler_aus_team_nehmen", "spieler_link_abrufen", "spieler_link_erneuern",
    "spieler_link_zugestellt", "spieler_schnuppern_setzen", "spielerliste_abrufen", "team_infos_abrufen", "team_infos_festlegen",
    "team_mitglieder_abrufen", "team_plan_abrufen",
    "teams_abrufen", "termin_abmeldung_setzen", "termin_aendern", "termin_anwesenheit_setzen",
    "termin_aufgebot_setzen", "termin_ausfall_zuruecknehmen", "termin_ausfallen_lassen", "termin_der_serie_folgen",
    "termin_entfernen", "termin_festlegen", "termin_spieler_abrufen", "termin_trainer_absagen",
    "termin_trainer_aendern", "terminserie_festlegen", "training_abrufen", "training_anlegen",
    "training_auf_entwurf_setzen", "training_durchlauf_abrufen", "training_hinweise_abrufen",
    "training_kategorien_setzen", "training_kopieren", "training_loeschen", "training_loesen",
    "training_uebung_dauer_setzen", "training_uebung_durchlauf_setzen", "training_uebung_entfernen",
    "training_uebung_notiz_setzen", "training_uebung_zuordnen", "training_uebungen_fuer_block",
    "training_uebungen_ordnen", "training_umbenennen", "training_veroeffentlichen", "training_ziel_setzen",
    "training_zuordnen", "trainings_suchen", "uebung_abrufen", "uebung_aendern", "uebung_anlegen",
    "uebung_auf_entwurf_setzen", "uebung_diagramm_maengel_abrufen", "uebung_diagramm_setzen", "uebung_kopieren",
    "uebung_veroeffentlichen", "uebungen_suchen", "variante_anlegen", "variante_entfernen", "variante_umbenennen",
    "varianten_ordnen", "vokabular", "wer_bin_ich",
  ]);
});

pruefe("Story 13 (#589 AK 1, 10): teams_abrufen nennt den Verein und den Hinweis ohne Team; Teams verwaltet nur die Vereinsverwaltung im Bereich «Verein»", () => {
  const t = werkzeugTexte().beschreibung.get("teams_abrufen") ?? "";
  assert.match(t, /«verein»/);
  assert.match(t, /«hinweis»/);
  assert.match(t, /Teams, Spielerlisten und Kalender stehen nur Mitgliedern eines Teams offen/);
  assert.match(t, /Teams anlegen, umbenennen und auflösen kann nur die Vereinsverwaltung, im Bereich «Verein» der Anwendung/);
  // Seit #581 falsch: Umbenennen und Auflösen gehen nicht im Team-Bereich.
  assert.ok(!t.includes("nur im Team-Bereich von KiFu"), t);
});

pruefe("Story 13 (#589 AK 2, 5, 8): Spieler-Werkzeuge nennen weitere Teams, Herausnehmen statt Löschen, «nicht gefunden» ausserhalb der eigenen Teams", () => {
  const { beschreibung } = werkzeugTexte();
  const LOESCHEN = "Aus dem Verein löscht Spieler:innen nur die Vereinsverwaltung, in der Anwendung; kein Werkzeug löscht sie.";
  for (const n of ["spielerliste_abrufen", "spieler_aufnehmen", "spieler_aendern", "spieler_aus_team_nehmen"])
    assert.ok(beschreibung.get(n)?.includes(LOESCHEN), n);
  assert.match(beschreibung.get("spielerliste_abrufen") ?? "", /«weitere_teams»/);
  // Kein Werkzeug löscht Spieler:innen, und keine Beschreibung verweist auf ein Lösch-Werkzeug, das es nicht gibt.
  for (const [n, text] of beschreibung) {
    assert.ok(!/^spieler.*loeschen$/.test(n), n);
    for (const m of text.matchAll(/\b[a-z]+(?:_[a-z]+)*_loeschen\b/g)) assert.ok(beschreibung.has(m[0]), `${n} verweist auf ${m[0]}`);
  }
  // AK 8: «nicht gefunden» schliesst Spieler:innen ohne Team und in fremden Teams ein; die Ausnahmen stehen dabei.
  const fehlerText = beschreibung.get("spieler_aendern") ?? "";
  assert.match(fehlerText, /sie gehört nur fremden Teams oder keinem Team des Vereins an/);
  assert.match(fehlerText, /aus deinen Teams genommen oder aus dem Verein gelöscht/);
  assert.match(fehlerText, /Abweisung einer Doppelerfassung/);
  assert.match(fehlerText, /«nicht_mehr_im_team»/);
  assert.ok(!fehlerText.includes("sie wurde entfernt"), "das Entfernen gibt es nicht mehr");
});

pruefe("Story 13 (#589 AK 4, 6, 7): spieler_aus_team_nehmen beschreibt die Rückfrage als «regel» mit «stand», den Zusatz zum letzten eigenen Team und die Auskunft bei fremdem Team", () => {
  const t = werkzeugTexte().beschreibung.get("spieler_aus_team_nehmen") ?? "";
  assert.match(t, /Fehlerart «regel», «feld»: «stand»/);
  assert.match(t, /über den Assistenten nicht mehr erreichbar/);
  assert.match(t, /Fehlerart «konflikt»/);
  assert.match(t, /dieselbe Auskunft wie eine unbekannte Spieler:in/);
});

pruefe("Story 13 (#589 AK 9; A8, A9): Link-Werkzeuge über alle Teams, Erneuern zweistufig mit «bestaetigt», kein «team_id» als Eingabe", () => {
  const { beschreibung, eingabe } = werkzeugTexte();
  for (const n of ["spieler_link_abrufen", "spieler_link_erneuern"]) {
    const t = beschreibung.get(n) ?? "";
    assert.match(t, /die anstehenden Termine aller ihrer Teams/, n);
    assert.match(t, /Ein erneuerter Link gilt für alle ihre Teams/, n);
    assert.match(t, /«teams»/, n);
    // Der Link zeigt seit Story 7 nicht mehr die Termine eines Teams.
    assert.ok(!/den Teamnamen|Termine des Teams/.test(t), n);
  }
  assert.deepEqual(eingabe.get("spieler_link_abrufen"), ["spieler_id"]);
  assert.deepEqual(eingabe.get("spieler_link_erneuern"), ["spieler_id", "bestaetigt"]);
  assert.match(beschreibung.get("spieler_link_erneuern") ?? "", /Ohne «bestaetigt: true» ändert der Aufruf nichts/);
  // A9: kein «team_id» an Link und Schnuppern — der Link gilt für alle Teams, Schnuppern nur bei genau einem.
  assert.deepEqual(eingabe.get("spieler_schnuppern_setzen"), ["spieler_id", "schnuppern", "bestaetigt"]);
  const schnuppern = beschreibung.get("spieler_schnuppern_setzen") ?? "";
  assert.ok(!schnuppern.includes("im ältesten ihrer Teams"), schnuppern);
  assert.match(schnuppern, /solange sie genau einem Team angehört/);
  // Die Abholadresse eines Teams gibt den einen Link der Spieler:in heraus.
  for (const n of ["selbstabholung_abrufen", "selbstabholung_schalten", "abholadresse_erneuern"])
    assert.match(beschreibung.get(n) ?? "", /denselben, den die Abholadresse jedes ihrer Teams mit eingeschalteter Selbstabholung herausgibt/, n);
});

pruefe("Link als zugestellt (#657 AK 3, PC 4): ein Werkzeug je Spieler:in, reine Markierung, nur solange nicht abgeholt; derselbe Stand in Liste und Link", () => {
  const { beschreibung, eingabe } = werkzeugTexte();
  assert.deepEqual(eingabe.get("spieler_link_zugestellt"), ["spieler_id", "zugestellt"], "einzeln, nie gesammelt (OoS 1)");
  const t = beschreibung.get("spieler_link_zugestellt") ?? "";
  assert.match(t, /KiFu verschickt nichts/);
  assert.match(t, /Nur solange der Link nicht abgeholt ist/);
  assert.match(t, /ein erneuerter Link ist wieder offen/);
  assert.match(t, /Immer eine Spieler:in je Aufruf/);
  // PC 4: überall abgeholt/zugestellt/offen, nirgends «bezogen».
  for (const [n, text] of beschreibung) assert.ok(!/bezogen/i.test(text), `${n} sagt «bezogen»`);
});

pruefe("Benachrichtigungen (#642 AK 6): termin_festlegen beschreibt «benachrichtigen» wie die Oberfläche; der Zugang nennt es ohne neue Zustimmung", () => {
  const felder = new Map<string, { description?: string }>();
  registriereWerkzeuge({
    registerTool: (name: string, def: { inputSchema?: { shape?: Record<string, { description?: string }> } }) => {
      if (name === "termin_festlegen") for (const [k, v] of Object.entries(def.inputSchema?.shape ?? {})) felder.set(k, v);
    },
  } as never);
  const beschreibung = felder.get("benachrichtigen")?.description ?? "";
  assert.equal(beschreibung, `Nur bei einem Spiel. ${BENACHRICHTIGEN_MODELL("neues_spiel")}`);
  assert.ok(beschreibung.includes(BENACHRICHTIGEN_HINWEIS.neues_spiel), "UI = KI: derselbe Hinweis");
  // Der Satz gilt für alle Vorgänge des Epics #641 (#642–#645).
  assert.ok(
    ZUGANG_DARF[3].endsWith(
      "; bei neuen Spielen, Ausfällen und ihrer Rücknahme, Verlegungen und beim Entfernen jeweils entscheiden, ob die Spielervertretungen am privaten Link benachrichtigt werden",
    ),
  );
  assert.ok(ZUGANG_ERWEITERUNG.includes("nicht erneut zustimmen"));
});

pruefe("Benachrichtigungen (#643 AK 1, 2): termin_ausfallen_lassen und termin_ausfall_zuruecknehmen beschreiben «benachrichtigen» wie die Oberfläche (Standard true)", () => {
  const felder = new Map<string, Map<string, { description?: string; parse?: (x: unknown) => unknown }>>();
  registriereWerkzeuge({
    registerTool: (name: string, def: { inputSchema?: { shape?: Record<string, { description?: string }> } }) => {
      if (name === "termin_ausfallen_lassen" || name === "termin_ausfall_zuruecknehmen")
        felder.set(name, new Map(Object.entries(def.inputSchema?.shape ?? {})));
    },
  } as never);
  const ausfall = felder.get("termin_ausfallen_lassen")?.get("benachrichtigen");
  const ruecknahme = felder.get("termin_ausfall_zuruecknehmen")?.get("benachrichtigen");
  assert.equal(
    ausfall?.description,
    `Nur beim Ausfallen lassen; den Grund eines schon ausgefallenen ändern bleibt still. ${BENACHRICHTIGEN_MODELL("ausfall")}`,
  );
  assert.ok(ausfall?.description?.includes(BENACHRICHTIGEN_HINWEIS.ausfall), "UI = KI: derselbe Hinweis (AK 2)");
  assert.equal(ruecknahme?.description, BENACHRICHTIGEN_MODELL("ruecknahme"));
  assert.ok(ruecknahme?.description?.includes(BENACHRICHTIGEN_HINWEIS.ruecknahme), "UI = KI: derselbe Hinweis");
  // Ohne Angabe: benachrichtigen (Prinzip 4).
  assert.equal(ausfall?.parse?.(undefined), true);
  assert.equal(ruecknahme?.parse?.(undefined), true);
});

pruefe("Benachrichtigungen (#644 AK 1, 2): termin_aendern und termin_der_serie_folgen beschreiben «benachrichtigen» wie die Oberfläche (Standard true); jeder Werkzeugtext nennt den Standard", () => {
  const felder = new Map<string, Map<string, { description?: string; parse?: (x: unknown) => unknown }>>();
  const texte = new Map<string, string>();
  registriereWerkzeuge({
    registerTool: (name: string, def: { description?: string; inputSchema?: { shape?: Record<string, { description?: string }> } }) => {
      felder.set(name, new Map(Object.entries(def.inputSchema?.shape ?? {})));
      texte.set(name, def.description ?? "");
    },
  } as never);
  const aendern = felder.get("termin_aendern")?.get("benachrichtigen");
  const folgen = felder.get("termin_der_serie_folgen")?.get("benachrichtigen");
  // UI = KI: derselbe Hinweis wie unter dem Häkchen des Termin-Dialogs, einzeln
  // und über die Serie — und kein weiterer (#641 Prinzip 4).
  assert.ok(aendern?.description?.endsWith(BENACHRICHTIGEN_MODELL("aendern")), aendern?.description);
  for (const [v, h] of Object.entries(BENACHRICHTIGEN_HINWEIS))
    if (v !== "aendern") assert.ok(!aendern?.description?.includes(h), `termin_aendern nennt den Hinweis «${v}»`);
  assert.ok(aendern?.description?.includes("der Kartenlink allein nicht"), "OoS 1");
  assert.ok(folgen?.description?.endsWith(BENACHRICHTIGEN_MODELL("aendern")), folgen?.description);
  // Ohne Angabe: benachrichtigen (Prinzip 4).
  assert.equal(aendern?.parse?.(undefined), true);
  assert.equal(folgen?.parse?.(undefined), true);
  // Jedes Werkzeug mit «benachrichtigen» nennt den Standard im Werkzeugtext, und nur diese.
  const mit = [...felder].filter(([, f]) => f.has("benachrichtigen")).map(([n]) => n).sort();
  assert.deepEqual(mit, [
    "termin_aendern",
    "termin_ausfall_zuruecknehmen",
    "termin_ausfallen_lassen",
    "termin_der_serie_folgen",
    "termin_entfernen",
    "termin_festlegen",
  ]);
  for (const [name, text] of texte) assert.equal(text.includes(BENACHRICHTIGEN_WERKZEUG), mit.includes(name), name);
});

pruefe("Benachrichtigungen (#645 AK 1): termin_entfernen beschreibt «benachrichtigen» wie die Oberfläche (Standard true) und nennt «benachrichtigt»", () => {
  const felder = new Map<string, Map<string, { description?: string; parse?: (x: unknown) => unknown }>>();
  const ausgaben = new Map<string, Record<string, unknown>>();
  registriereWerkzeuge({
    registerTool: (
      name: string,
      def: { inputSchema?: { shape?: Record<string, { description?: string }> }; outputSchema?: { shape?: Record<string, unknown> } },
    ) => {
      felder.set(name, new Map(Object.entries(def.inputSchema?.shape ?? {})));
      ausgaben.set(name, def.outputSchema?.shape ?? {});
    },
  } as never);
  const entfernen = felder.get("termin_entfernen")?.get("benachrichtigen");
  assert.equal(entfernen?.description, BENACHRICHTIGEN_MODELL("entfernen"));
  assert.ok(entfernen?.description?.includes(BENACHRICHTIGEN_HINWEIS.entfernen), "UI = KI: derselbe Hinweis");
  assert.equal(entfernen?.parse?.(undefined), true, "Prinzip 4: ohne Angabe benachrichtigen");
  assert.equal(entfernen?.parse?.(false), false);
  assert.ok("benachrichtigt" in (ausgaben.get("termin_entfernen") ?? {}), "Ausgabe benachrichtigt");
  // Befund 3: Die Wege, die direkt schreiben, sagen ein Scheitern der
  // Benachrichtigung im «hinweis» — wortgleich zur Oberfläche. Die RPC-Wege
  // legen in derselben Transaktion ab und kennen es nicht.
  const mitHinweis = ["termin_aendern", "termin_ausfall_zuruecknehmen", "termin_ausfallen_lassen", "termin_festlegen"];
  for (const n of [...mitHinweis, "termin_entfernen", "termin_der_serie_folgen"]) {
    const hinweis = ausgaben.get(n)?.hinweis as { description?: string; parse?: (x: unknown) => unknown } | undefined;
    assert.equal(!!hinweis, mitHinweis.includes(n), `${n}: hinweis`);
    if (!hinweis) continue;
    assert.ok(hinweis.description?.includes(BENACHRICHTIGEN_TEXT.gescheitert), hinweis.description);
    assert.equal(hinweis.parse?.(undefined), undefined, "ohne Scheitern kein hinweis");
  }
});

pruefe("Story 13 (#589 PC 1, 2): ZUGANG_DARF und ZUGANG_DARF_NICHT im Wortlaut, der Kopf von umfang.ts verlangt keine erneute Zustimmung", () => {
  assert.equal(
    ZUGANG_DARF[5],
    "die Spielerliste deiner Teams (Vorname, Nachname, Jahrgang, J+S-Nummer) einsehen und führen, dazu den Verein deiner Teams und die Namen weiterer Teams einer Spieler:in sehen, Spieler:innen aus einem deiner Teams nehmen (sie bleiben im Verein), Kader anlegen, umbenennen und entfernen und ihnen Spieler:innen zuteilen, Spieler:innen ins Schnuppertraining nehmen und die Anzahl Schnuppertrainings samt Info-Schreiben festlegen, die Infos zum Team für die Eltern verfassen, ändern und entfernen, Spieler:innen für Termine ab- und wieder anmelden, für Spiele an- oder abmelden und als nicht aufgeboten kennzeichnen und sehen, wer angemeldet ist, wer an Spielen noch ohne Meldung ist und seit wann, ab Beginn eines Trainings oder Spiels nachtragen, wer nicht oder doch erschienen ist, den privaten Link einer Spieler:in holen, erneuern und als zugestellt markieren, die Selbstabholung ein- und ausschalten, die Abholadresse holen und erneuern und sehen, welche Links abgeholt oder zugestellt sind",
  );
  assert.deepEqual(ZUGANG_DARF_NICHT, [
    "deine Favoriten",
    "die Verwaltung deiner Teams und deines Vereins (Verein gründen, umbenennen und löschen, Teams anlegen, umbenennen und auflösen, Personen in Teams oder in die Vereinsverwaltung aufnehmen oder daraus entfernen, Spieler:innen Teams zuordnen, Spieler:innen aus dem Verein löschen und Spielerlisten importieren)",
    "dein Konto selbst (Anzeigename, Passwort, Löschen)",
  ]);
  const kopf = readFileSync(join(fileURLToPath(new URL("..", import.meta.url)), "lib/mcp/umfang.ts"), "utf8").split("export")[0];
  assert.ok(!kopf.includes("Frage nach erneuter Zustimmung"), "PC 2: keine erneute Zustimmung");
  assert.match(kopf, /#589 PC 2/);
});

pruefe("#598 AK 9: die Infos zum Team über zwei Werkzeuge, mit Gliederung, Grenze und wer sie sieht", () => {
  const { beschreibung, eingabe } = werkzeugTexte();
  assert.deepEqual(eingabe.get("team_infos_abrufen"), ["team_id"]);
  assert.deepEqual(eingabe.get("team_infos_festlegen"), ["team_id", "text"]);
  for (const n of ["team_infos_abrufen", "team_infos_festlegen"]) {
    const t = beschreibung.get(n) ?? "";
    assert.match(t, /10000 Zeichen samt Gliederung/, n);
    assert.match(t, /nicht, solange die Spieler:in schnuppert/, n);
    assert.match(t, /«## »/, n);
  }
  assert.match(beschreibung.get("team_infos_festlegen") ?? "", /leerer Text/);
});

console.log(`\n${gelaufen} Prüfungen bestanden.`);
