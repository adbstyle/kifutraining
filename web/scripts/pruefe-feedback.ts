// Prüft die Regeln des Feedback-Dialogs (Epic #541): web/lib/feedback/regeln.ts
// und das generierte Produktwissen. Ohne DB und ohne Netz; läuft im PR-Check
// neben `typecheck` und den übrigen `check:*`.
//
// Der Wert dieser Prüfung liegt an drei Stellen:
//
// - Die Grenzen (Dialoge je Tag, Nachrichten, Korrekturen) haben einen
//   SQL-Zwilling in `feedback_grenzen()`. Laufen sie auseinander, zeigt der
//   Zähler eine Zusage, die die Datenbank bricht.
// - Das Produktwissen reist als generiertes Modul mit (Vercel baut nur web/).
//   Wer docs/feedback-triage.md nachführt und das Generieren vergisst, liesse
//   den Dialog auf altem Stand antworten.
// - Der Verlauf kommt aus dem Browser: Seine Form und die Länge der
//   Nachrichten sind die Grenze dessen, was ans Modell geht.
//
//   npx tsx scripts/pruefe-feedback.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DIALOGE_JE_TAG,
  KORREKTUREN_MAX,
  NACHRICHT_MAX,
  NACHRICHTEN_MAX,
  dialogStand,
  seiteAus,
  verlaufSchema,
} from "../lib/feedback/regeln";
import { PRODUKTWISSEN } from "../lib/feedback/wissen";

const hier = fileURLToPath(new URL(".", import.meta.url));

// ── SQL-Zwilling ────────────────────────────────────────────────────────────
const migrationen = resolve(hier, "../../supabase/migrations");
const datei = readdirSync(migrationen).filter((d) => d.endsWith("_feedback_dialog.sql"));
assert.equal(datei.length, 1, "Erwartet genau eine Migration «*_feedback_dialog.sql»");
const sql = readFileSync(join(migrationen, datei[0]), "utf8");
const grenzen = sql.match(/'dialoge_je_tag', (\d+), 'nachrichten', (\d+), 'korrekturen', (\d+)/);
assert.ok(grenzen, "feedback_grenzen() nicht gefunden");
assert.deepEqual(
  grenzen.slice(1).map(Number),
  [DIALOGE_JE_TAG, NACHRICHTEN_MAX, KORREKTUREN_MAX],
  "feedback_grenzen() und lib/feedback/regeln.ts tragen verschiedene Grenzen",
);

// ── Produktwissen ───────────────────────────────────────────────────────────
assert.equal(
  PRODUKTWISSEN,
  readFileSync(resolve(hier, "../../docs/feedback-triage.md"), "utf8"),
  "lib/feedback/wissen.ts ist nicht auf dem Stand von docs/feedback-triage.md — npm run gen:feedback-wissen",
);

// ── Zähler ──────────────────────────────────────────────────────────────────
assert.deepEqual(dialogStand(0, null), { offen: true, zaehler: "Nachricht 1 von 10" });
assert.deepEqual(dialogStand(9, null), { offen: true, zaehler: "Nachricht 10 von 10" });
assert.equal(dialogStand(10, null).offen, true, "Vergisst das Modell die Zusammenfassung, darf die Person sie verlangen");
assert.equal(dialogStand(12, null).offen, false, "Höchstens zwölf Nachrichten, wie in der Datenbank");
assert.deepEqual(dialogStand(4, 4), { offen: true, zaehler: "Noch 2 Korrekturen möglich" });
assert.deepEqual(dialogStand(5, 4), { offen: true, zaehler: "Noch 1 Korrektur möglich" });
assert.equal(dialogStand(6, 4).offen, false, "Nach zwei Korrekturen bleibt nur Bestätigen oder Verwerfen");
assert.equal(dialogStand(12, 10).offen, false);

// ── Verlauf ─────────────────────────────────────────────────────────────────
const p = (text: string) => ({ von: "person" as const, text });
const k = (text: string) => ({ von: "ki" as const, text });
assert.ok(verlaufSchema.safeParse([]).success);
assert.ok(verlaufSchema.safeParse([p("a"), k("b")]).success);
assert.ok(!verlaufSchema.safeParse([k("a")]).success, "Die Person beginnt");
assert.ok(!verlaufSchema.safeParse([p("a"), p("b")]).success, "Person und KI wechseln sich ab");
assert.ok(!verlaufSchema.safeParse([p("x".repeat(NACHRICHT_MAX + 1))]).success, "Nachricht über der Grenze");
assert.ok(
  !verlaufSchema.safeParse(Array.from({ length: 2 * (NACHRICHTEN_MAX + KORREKTUREN_MAX) + 2 }, (_, i) => (i % 2 ? k("b") : p("a")))).success,
  "Mehr Nachrichten, als die Grenzen erlauben",
);

// ── Seite ───────────────────────────────────────────────────────────────────
assert.equal(seiteAus("/team/abc/termine?suche=Muster#x"), "/team/abc/termine", "Ohne Suche und Anker");
assert.equal(seiteAus("https://fremd.example/x"), "/");
assert.equal(seiteAus(undefined), "/");

console.log("Feedback-Regeln: alles in Ordnung.");
