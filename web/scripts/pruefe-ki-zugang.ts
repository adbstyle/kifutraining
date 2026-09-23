// Prüft die Regeln des KI-Zugangs (Story #142): web/lib/mcp/regeln.ts,
// web/lib/weiterleitung.ts und die reinen Werkzeug-Bausteine
// web/lib/mcp/{vokabular,eingaben,ergebnis}.ts. Ohne DB und ohne Netz; läuft
// im PR-Check neben `typecheck` und den übrigen `check:*`.
//
// Der Wert dieser Prüfung liegt an fünf Stellen:
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
import { sichererRuecksprung } from "../lib/weiterleitung";
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
import { FREIES_SPIEL, altersstufeDerEinordnung, einordnungenFuer } from "../lib/altersstufe";
import { ANZAHL_HINWEIS, HAUPTTEILKATEGORIE_SLUGS, LEER_HINWEIS, OHNE_DAUER_TEILE } from "../lib/training";
import { istHauptteil } from "../lib/gruppen";
import { VokabularSchema, baueVokabular } from "../lib/mcp/vokabular";
import { SucheEingabe } from "../lib/mcp/eingaben";
import { ausKern, erfolg, fehlerErgebnis } from "../lib/mcp/ergebnis";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { KernFehler } from "../lib/kern/ergebnis";

let gelaufen = 0;

function pruefe(was: string, fn: () => void) {
  fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

// ── Namensregel (AK 3, PC 2) ────────────────────────────────────────────────
pruefe("Ein leerer Name ist kein Fehler — dann gilt der Client-Name", () => {
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

pruefe("Die Länge zählt bereinigt — wie der SQL-CHECK auf den gespeicherten Namen", () => {
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

pruefe("Der anfragende Client zählt nicht mit — erneutes Erlauben ersetzt nur", () => {
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

pruefe("Die Query bleibt erhalten — der Erlauben-Ablauf braucht sie", () => {
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
    `ki_aufruf_zaehlen(): «v_grenze constant integer := ${KI_AUFRUFE_JE_STUNDE}» fehlt — Zwilling von KI_AUFRUFE_JE_STUNDE.`,
  );
  assert.ok(
    // An den CHECK-Namen verankert: ein anderes «between 1 and 40» in der
    // Datei darf die Prüfung nicht bestehen lassen.
    new RegExp(
      `constraint\\s+kzn_name_laenge\\s+check\\s*\\([^;]*between\\s+1\\s+and\\s+${ZUGANGSNAME_MAX}\\b`,
      "i",
    ).test(sql),
    `CHECK kzn_name_laenge: «between 1 and ${ZUGANGSNAME_MAX}» fehlt — Zwilling von ZUGANGSNAME_MAX.`,
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
  assert.equal(stufe("kinderfussball").spielfeldgroesse, false);
  assert.equal(stufe("juniorenfussball").spielfeldgroesse, true);
  for (const e of alleEinordnungen.filter((x) => x.stufe === "kinderfussball"))
    assert.equal(e.traegt_uebungstyp, false, e.slug);
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
    hinweis: "Es ist keine Kopie entstanden.",
  };
  const aussen = (k: string) =>
    k === "retryAfter" ? "retry_after" : k === "varianteId" ? "variante_id" : k;
  const f = fehlerVon(fehlerErgebnis(voll));
  assert.deepEqual(
    Object.keys(f).sort(),
    Object.keys(voll).map(aussen).sort(),
    "Schlüssel in structuredContent.fehler",
  );
  assert.deepEqual(f.bedingung, "einleitung");
  // Auch in `fehlend` snake_case (#196): aussen trägt nichts camelCase.
  assert.deepEqual(f.fehlend, [{ bedingung: "einleitung", variante_id: null }]);
  assert.equal(f.variante_id, "v1");
  // `false` ist eine Auskunft und bleibt; Leeres fällt weg.
  assert.equal(f.wiederholbar, false);
  const knapp = fehlerVon(fehlerErgebnis({ art: "regel", meldung: "m", zulaessig: [], feld: "" }));
  assert.deepEqual(knapp, { art: "regel", meldung: "m" });
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

console.log(`\n${gelaufen} Prüfungen bestanden.`);
