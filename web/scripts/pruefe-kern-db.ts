// Prüft den Fachkern ECHT gegen die Datenbank (Epic #190, ab Story #193):
// dieselben Kern-Funktionen, die Server Actions und KI-Werkzeuge aufrufen,
// mit einem Client, der als Nutzer spricht — gebaut wie der des KI-Zugangs
// (`createBearerClient`: Anon-Key + Bearer-Token). Die RLS wirkt also
// unverändert; was hier durchgeht, geht auch im Betrieb durch, und was hier
// abgewiesen wird, weist auch der Betrieb ab.
//
// Der Wert gegenüber `check:kern`: Rechte («nicht gefunden» vs. «keine
// Rechte» an einem fremden öffentlichen Training), Positionen je Variante,
// die neue RPC `setze_uebungsfolge` samt ihren Markern und die Meldungstexte
// gegen eingefrorene Literale — nichts davon ist ohne Datenbank prüfbar.
//
// Läuft gegen den lokalen Stack bzw. im PR-Check gegen die Wegwerf-DB nach
// dem Manual-Seed (es braucht Manual-Übungen). Legt zwei Wegwerf-Konten an und
// räumt sie am Ende samt Trainings und Bilddateien wieder ab — auch wenn eine
// Prüfung scheitert.
//
//   npm run check:kern-db
//   (= tsx --conditions=react-server scripts/pruefe-kern-db.ts — unter dieser
//    Bedingung ist `server-only` ein leeres Modul, sonst würfe jeder Import
//    aus lib/kern)
//
// Env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY — aus der
// Umgebung (CI) oder aus web/.env.local.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const web = resolve(fileURLToPath(import.meta.url), "../..");
const envDatei = join(web, ".env.local");
if (existsSync(envDatei)) {
  for (const zeile of readFileSync(envDatei, "utf8").split("\n")) {
    const m = /^([A-Z_]+)=(.*)$/.exec(zeile.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
for (const n of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
  assert.ok(process.env[n], `${n} fehlt`);

// Erst nach der Env: lib/env liest sie beim Aufruf.
const { createBearerClient } = await import("../lib/supabase/bearer");
const { legeTrainingAn, benenneTrainingUm, setzeStufen, setzeZiel } = await import("../lib/kern/training");
const { ordneUebungZu, entferneUebung, setzeDauer, setzeNotiz, setzeUebungsfolge } = await import(
  "../lib/kern/fassung"
);
const { trainingAbrufen, trainingsSuchen } = await import("../lib/kern/lesen");
const { legeGruppeAn, benenneGruppe, entferneGruppe, setzeDurchlauf } = await import("../lib/kern/gruppen");
const { loescheTrainingMitBildern } = await import("../lib/training-loeschen");

const URL_ = process.env.SUPABASE_URL!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let gelaufen = 0;
async function pruefe(was: string, fn: () => Promise<void>) {
  await fn();
  gelaufen++;
  console.log(`✓ ${was}`);
}

/** Erfolg erwarten und den Wert liefern — sonst mit der Kern-Meldung scheitern. */
function wert<T>(r: { ok: true; wert: T } | { ok: false; meldung: string; art: string }): T {
  if (!r.ok) assert.fail(`erwartet ok, bekam [${r.art}] ${r.meldung}`);
  return r.wert;
}

/** Fehler erwarten — Art und (eingefrorener) Text. */
function fehler(
  r: { ok: boolean; art?: string; meldung?: string; fremd?: true },
  art: string,
  meldung?: string | RegExp,
) {
  assert.equal(r.ok, false, "erwartet Fehler, bekam ok");
  assert.equal(r.art, art, `Art (Meldung: ${r.meldung})`);
  if (typeof meldung === "string") assert.equal(r.meldung, meldung);
  else if (meldung) assert.match(r.meldung!, meldung);
  return r;
}

type Konto = { id: string; supabase: SupabaseClient };
const konten: string[] = [];

async function wegwerfKonto(): Promise<Konto> {
  const email = `kern-db-${randomBytes(6).toString("hex")}@test.local`;
  const password = randomBytes(12).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  konten.push(data.user.id);
  const anon = createClient(URL_, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password });
  if (e2) throw e2;
  return { id: data.user.id, supabase: createBearerClient(s.session!.access_token) };
}

/** Eine Manual-Übung für einen Block (der Seed hat sie angelegt). */
async function vorlage(trainingsteil: string, hkat: string | null = null): Promise<string> {
  let q = admin
    .from("exercises")
    .select("id")
    .eq("source", "manual")
    .eq("altersstufe", "kinderfussball")
    .eq("trainingsteil", trainingsteil);
  q = hkat ? q.eq("hauptteilkategorie", hkat) : q;
  const { data } = await q.order("name").limit(1).maybeSingle();
  assert.ok(data, `keine Manual-Übung für ${trainingsteil}/${hkat} — lief der Seed?`);
  return data.id as string;
}

async function positionen(trainingId: string, teil: string) {
  const { data } = await admin
    .from("training_exercises")
    .select("id, position, variante_id")
    .eq("training_id", trainingId)
    .eq("trainingsteil", teil)
    .order("position");
  return data ?? [];
}

/** Je Konto einzeln und ohne Wurf: Ein Aufräumfehler soll weder die übrigen
 *  Konten stehen lassen noch den eigentlichen Prüffehler überdecken — er wird
 *  nur gemeldet. */
async function aufraeumen() {
  for (const id of konten) {
    try {
      const { data } = await admin.from("trainings").select("id").eq("owner_id", id);
      for (const t of data ?? []) {
        // Ein öffentliches Training verlöre sonst beim Löschen die Pflicht-Übungen.
        await admin.from("trainings").update({ visibility: "private" }).eq("id", t.id);
        await loescheTrainingMitBildern(admin as never, t.id);
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    } catch (e) {
      console.error(`[aufräumen] Konto ${id} nicht vollständig entfernt:`, e instanceof Error ? e.message : e);
    }
  }
}

try {
  const a = await wegwerfKonto();
  const b = await wegwerfKonto();
  const ein = await vorlage("einleitung");
  const auff = await vorlage("auffangen");
  const frei = await vorlage("hauptteil", "fussball-spielen");

  // ── Anlegen und Zuordnen ──────────────────────────────────────────────────
  const t = wert(
    await legeTrainingAn(a.supabase, a.id, {
      name: "Kern-DB-Probe",
      altersstufe: "kinderfussball",
      stufen: ["F"],
    }),
  ).id;
  const e1 = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: t, einordnung: "einleitung", exerciseId: ein }));
  const e2 = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: t, einordnung: "einleitung", exerciseId: ein }));
  const e3 = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: t, einordnung: "einleitung", exerciseId: ein }));

  await pruefe("Zuordnen: Positionen am Ende, je Variante ab 0", async () => {
    assert.deepEqual([e1.position, e2.position, e3.position], [0, 1, 2]);
    const h1 = wert(
      await ordneUebungZu(a.supabase, a.id, {
        trainingId: t,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
      }),
    );
    assert.equal(h1.position, 0);
    assert.ok(h1.varianteId, "der Hauptteil trägt die erste Variante");
    // Zweite Variante direkt anlegen — ihr Hauptteil beginnt wieder bei 0.
    const { data: v2, error } = await admin
      .from("training_varianten")
      .insert({ training_id: t, name: "Variante B", position: 1 })
      .select("id")
      .single();
    if (error) throw error;
    const h2 = wert(
      await ordneUebungZu(a.supabase, a.id, {
        trainingId: t,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
        varianteId: v2.id,
      }),
    );
    assert.equal(h2.position, 0);
    assert.equal(h2.varianteId, v2.id);
  });

  // ── Dauer ────────────────────────────────────────────────────────────────
  await pruefe("Dauer: gesetzt, entfernt; im Auffangen und negativ abgewiesen", async () => {
    assert.deepEqual(wert(await setzeDauer(a.supabase, a.id, { fassungId: e1.fassungId, minuten: 12 })), {
      trainingId: t,
      minuten: 12,
    });
    fehler(
      await setzeDauer(a.supabase, a.id, { fassungId: e1.fassungId, minuten: -1 }),
      "eingabe",
      "Die Dauer muss eine ganze Zahl in Minuten sein.",
    );
    const au = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: t, einordnung: "auffangen", exerciseId: auff }));
    fehler(
      await setzeDauer(a.supabase, a.id, { fassungId: au.fassungId, minuten: 5 }),
      "regel",
      "Für das Auffangen kann keine Dauer gesetzt werden.",
    );
    wert(await setzeDauer(a.supabase, a.id, { fassungId: au.fassungId, minuten: null }));
  });

  // ── Name, Ziel, Notiz ────────────────────────────────────────────────────
  await pruefe("Name, Ziel und Notiz: Regeln und Texte wie in der Oberfläche", async () => {
    fehler(await benenneTrainingUm(a.supabase, a.id, { trainingId: t, name: "  " }), "eingabe", "Ein Training braucht einen Namen.");
    fehler(await benenneTrainingUm(a.supabase, a.id, { trainingId: t, name: "x".repeat(81) }), "eingabe", "Höchstens 80 Zeichen.");
    assert.deepEqual(wert(await benenneTrainingUm(a.supabase, a.id, { trainingId: t, name: " Neu " })), {
      trainingId: t,
      name: "Neu",
    });
    fehler(
      await setzeZiel(a.supabase, a.id, { trainingId: t, ziel: "z".repeat(201) }),
      "eingabe",
      "Das Ziel darf höchstens 200 Zeichen lang sein.",
    );
    assert.deepEqual(wert(await setzeZiel(a.supabase, a.id, { trainingId: t, ziel: "Passen" })), {
      trainingId: t,
      ziel: "Passen",
    });
    assert.deepEqual(wert(await setzeZiel(a.supabase, a.id, { trainingId: t, ziel: "   " })), {
      trainingId: t,
      ziel: null,
    });
    fehler(await setzeNotiz(a.supabase, a.id, { fassungId: e1.fassungId, notiz: "n".repeat(501) }), "eingabe", "Höchstens 500 Zeichen.");
    assert.equal(wert(await setzeNotiz(a.supabase, a.id, { fassungId: e1.fassungId, notiz: " Hütchen " })).notiz, "Hütchen");
    assert.equal(wert(await setzeNotiz(a.supabase, a.id, { fassungId: e1.fassungId, notiz: "" })).notiz, null);
    const { data } = await admin.from("training_exercises").select("notiz").eq("id", e1.fassungId).single();
    assert.equal(data!.notiz, null, "leer heisst null, nicht ''");
  });

  // ── Alterskategorien ─────────────────────────────────────────────────────
  await pruefe("Alterskategorien: mindestens eine, nur der Altersstufe, nicht mehr Passendes benannt", async () => {
    fehler(await setzeStufen(a.supabase, a.id, { trainingId: t, stufen: [] }), "eingabe", "Bitte mindestens eine Alterskategorie wählen.");
    fehler(
      await setzeStufen(a.supabase, a.id, { trainingId: t, stufen: ["D"] }),
      "regel",
      "Diese Alterskategorie gehört nicht zur Altersstufe dieses Trainings. " +
        "Lege für die andere Altersstufe ein neues Training an.",
    );
    // Eine Fassung eindeutig auf G stellen — dann deckt sie E nicht mehr ab.
    await admin.from("training_exercises").update({ kategorien: ["G"] }).eq("id", e2.fassungId);
    const r = wert(await setzeStufen(a.supabase, a.id, { trainingId: t, stufen: ["E", "F", "E"] }));
    assert.deepEqual(r.stufen, ["F", "E"], "fachliche Reihenfolge, ohne Doppel");
    const r2 = wert(await setzeStufen(a.supabase, a.id, { trainingId: t, stufen: ["E"] }));
    assert.ok(r2.nichtMehrPassend.some((f) => f.fassungId === e2.fassungId), "G-Fassung passt nicht zu E");
    const { data } = await admin.from("training_exercises").select("id").eq("id", e2.fassungId);
    assert.equal(data!.length, 1, "nicht mehr Passendes bleibt stehen (PC 3)");
  });

  // ── Reihenfolge in einem Zug ─────────────────────────────────────────────
  await pruefe("Übungsfolge: in einem Zug, doppelt und unvollständig abgewiesen (Kern und RPC)", async () => {
    const folge = [e3.fassungId, e1.fassungId, e2.fassungId];
    const r = wert(await setzeUebungsfolge(a.supabase, a.id, { trainingId: t, einordnung: "einleitung", fassungIds: folge }));
    assert.deepEqual(r.folge.map((f) => f.position), [0, 1, 2]);
    assert.deepEqual((await positionen(t, "einleitung")).map((p) => p.id), folge);

    fehler(
      await setzeUebungsfolge(a.supabase, a.id, {
        trainingId: t,
        einordnung: "einleitung",
        fassungIds: [e1.fassungId, e1.fassungId, e2.fassungId],
      }),
      "regel",
      /^Eine Übung steht in der Reihenfolge mehrfach\. Mehrfach: „/,
    );
    fehler(
      await setzeUebungsfolge(a.supabase, a.id, { trainingId: t, einordnung: "einleitung", fassungIds: [e1.fassungId] }),
      "regel",
      /^Die Reihenfolge muss genau die Übungen dieses Abschnitts nennen — jede einmal\. Lies das Training neu und sende die vollständige Folge\. Es fehlen: „/,
    );
    fehler(
      await setzeUebungsfolge(a.supabase, a.id, { trainingId: t, einordnung: "ausklang", fassungIds: [] }),
      "regel",
      "In diesem Abschnitt steht keine Übung.",
    );
    // Zwei Varianten: ohne Angabe ist unklar, welche geordnet wird.
    fehler(
      await setzeUebungsfolge(a.supabase, a.id, {
        trainingId: t,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        fassungIds: [],
      }),
      "eingabe",
      "Dieses Training führt mehrere Varianten des Hauptteils. Gib an, welche du ordnest.",
    );
    // Die RPC selbst — der Rückhalt, falls die Vorprüfung umgangen wird.
    const rpc = (ids: string[]) =>
      a.supabase.rpc("setze_uebungsfolge", {
        p_training: t,
        p_einordnung: "einleitung",
        p_hauptteilkategorie: null,
        p_variante: null,
        p_ids: ids,
      });
    assert.match((await rpc([e1.fassungId, e1.fassungId])).error?.message ?? "", /UEBUNGSFOLGE_DOPPELT/);
    assert.match((await rpc([e1.fassungId])).error?.message ?? "", /UEBUNGSFOLGE_UNVOLLSTAENDIG/);
    assert.deepEqual((await positionen(t, "einleitung")).map((p) => p.id), folge, "abgewiesen heisst unverändert");
    // Fremde Hand an der RPC: B darf A's Training nicht ordnen.
    const { error } = await b.supabase.rpc("setze_uebungsfolge", {
      p_training: t,
      p_einordnung: "einleitung",
      p_hauptteilkategorie: null,
      p_variante: null,
      p_ids: folge,
    });
    assert.match(error?.message ?? "", /not found or not editable/);
  });

  // ── Entfernen ────────────────────────────────────────────────────────────
  await pruefe("Entfernen: nennt Gruppen im Durchlauf und die Notiz, die mitfallen", async () => {
    const { data: g, error } = await admin
      .from("training_gruppen")
      .insert({ training_id: t, name: "Rot" })
      .select("id")
      .single();
    if (error) throw error;
    const [h] = (await positionen(t, "hauptteil")).slice(0, 1);
    const { error: e2Fehler } = await admin
      .from("training_exercise_gruppen")
      .insert({ training_exercise_id: h.id, gruppe_id: g.id, position: 0 });
    if (e2Fehler) throw e2Fehler;
    wert(await setzeNotiz(a.supabase, a.id, { fassungId: h.id, notiz: "Leibchen" }));
    const r = wert(await entferneUebung(a.supabase, a.id, { fassungId: h.id }));
    assert.deepEqual(r.gruppen, ["Rot"]);
    assert.equal(r.notizEntfiel, true);
    assert.equal(r.einordnung, "hauptteil");
    const { count } = await admin
      .from("training_exercise_gruppen")
      .select("*", { count: "exact", head: true })
      .eq("training_exercise_id", h.id);
    assert.equal(count, 0, "Gruppenzuweisungen fallen mit (PC 2)");
  });

  // ── Lesen ────────────────────────────────────────────────────────────────
  await pruefe("Abrufen und Suchen über den Nutzer-Client", async () => {
    const aus = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: t }));
    assert.equal(aus.name, "Neu");
    assert.equal(aus.varianten.length, 2);
    assert.equal(aus.teile.filter((x) => x.teil.slug === "hauptteil").length, 2);
    assert.deepEqual(
      aus.teile.find((x) => x.teil.slug === "einleitung")!.bloecke[0].uebungen.map((u) => u.fassung_id),
      [e3.fassungId, e1.fassungId, e2.fassungId],
    );
    const s = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "eigene", q: "neu", limit: 5 }));
    assert.ok(s.treffer.some((x) => x.id === t));
    const o = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "oeffentlich", q: "neu", limit: 5 }));
    assert.ok(!o.treffer.some((x) => x.id === t), "ein Entwurf ist nicht öffentlich");
  });

  // ── Gruppen und Durchlauf (#194) ─────────────────────────────────────────
  await pruefe("Gruppen: anlegen, Namensregeln (41 Zeichen, doppelt), umbenennen", async () => {
    // «Rot» steht aus dem Entfernen-Szenario oben schon am Training.
    const gelb = wert(await legeGruppeAn(a.supabase, a.id, { trainingId: t, name: " Gelb " })).gruppe;
    assert.equal(gelb.name, "Gelb");
    fehler(await legeGruppeAn(a.supabase, a.id, { trainingId: t, name: "   " }), "eingabe", "Bitte eine Bezeichnung eingeben.");
    fehler(await legeGruppeAn(a.supabase, a.id, { trainingId: t, name: "b".repeat(41) }), "eingabe", "Höchstens 40 Zeichen.");
    fehler(
      await legeGruppeAn(a.supabase, a.id, { trainingId: t, name: "gelb" }),
      "regel",
      "Diese Bezeichnung gibt es in diesem Training schon.",
    );
    const blau = wert(await legeGruppeAn(a.supabase, a.id, { trainingId: t, name: "Blau" })).gruppe;
    fehler(
      await benenneGruppe(a.supabase, a.id, { gruppeId: blau.id, name: "GELB" }),
      "regel",
      "Diese Bezeichnung gibt es in diesem Training schon.",
    );
    // Die eigene Bezeichnung zählt nicht als vergeben.
    assert.deepEqual(wert(await benenneGruppe(a.supabase, a.id, { gruppeId: gelb.id, name: "gelb" })), {
      trainingId: t,
      name: "gelb",
    });
    fehler(await benenneGruppe(a.supabase, a.id, { gruppeId: randomUUID(), name: "x" }), "nicht_gefunden", "Gruppe nicht gefunden.");
  });

  await pruefe("Durchlauf: setzen, ersetzen, leeren; fremde, doppelte Gruppe und Einleitung abgewiesen", async () => {
    const { data: gs } = await admin.from("training_gruppen").select("id, name").eq("training_id", t);
    const gelb = gs!.find((g) => g.name === "gelb")!;
    const blau = gs!.find((g) => g.name === "Blau")!;
    const [h] = await positionen(t, "hauptteil");
    const folge = async () =>
      (
        await admin
          .from("training_exercise_gruppen")
          .select("gruppe_id")
          .eq("training_exercise_id", h.id)
          .order("position")
      ).data!.map((z) => z.gruppe_id);

    const r = wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [blau.id, gelb.id] }));
    assert.deepEqual(r.gruppen.map((g) => g.name), ["Blau", "gelb"]);
    assert.deepEqual(await folge(), [blau.id, gelb.id]);
    wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [gelb.id] }));
    assert.deepEqual(await folge(), [gelb.id], "ersetzt vollständig (PC 1)");

    fehler(
      await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [gelb.id, gelb.id] }),
      "regel",
      "Eine Gruppe steht im Durchlauf mehrfach.",
    );
    // Eine Gruppe eines ZWEITEN Trainings desselben Kontos.
    const t2 = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zweit", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    const gruen = wert(await legeGruppeAn(a.supabase, a.id, { trainingId: t2, name: "Grün" })).gruppe;
    const f = fehler(
      await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [gruen.id] }),
      "regel",
      "Diese Gruppe gehört zu einem anderen Training.",
    ) as { zulaessig?: readonly string[] };
    assert.deepEqual([...(f.zulaessig ?? [])].sort(), gs!.map((g) => g.id).sort(), "alle Gruppen des Trainings");
    fehler(
      await setzeDurchlauf(a.supabase, a.id, { fassungId: e1.fassungId, gruppeIds: [gelb.id] }),
      "regel",
      "Gruppen lassen sich nur im Hauptteil verteilen.",
    );
    assert.deepEqual(await folge(), [gelb.id], "abgewiesen heisst unverändert");

    // Leeren = alle gemeinsam, dann wieder setzen für das Entfernen.
    wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [] }));
    assert.deepEqual(await folge(), []);
    wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: h.id, gruppeIds: [gelb.id, blau.id] }));

    const aus = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: t }));
    assert.deepEqual(
      aus.gruppen.filter((g) => g.id === gelb.id || g.id === blau.id).map((g) => [g.name, g.an_uebungen]),
      [["gelb", 1], ["Blau", 1]],
    );
    const d = aus.durchlauf.find((x) => x.wechsel.some((w) => w.belegung.some((b) => b.fassung_id === h.id)))!;
    assert.equal(d.wechsel_zahl, 2);

    // Entfernen nennt die Zahl der Übungen und räumt den Durchlauf.
    assert.deepEqual(wert(await entferneGruppe(a.supabase, a.id, { gruppeId: gelb.id })), {
      trainingId: t,
      name: "gelb",
      anUebungen: 1,
    });
    assert.deepEqual(await folge(), [blau.id], "aus dem Durchlauf entfernt (PC 2)");
    fehler(await entferneGruppe(a.supabase, a.id, { gruppeId: gelb.id }), "nicht_gefunden", "Gruppe nicht gefunden.");
  });

  await pruefe("Durchlauf Juniorenfussball: Wechsel über beide Hauptteil-Blöcke (PC 3)", async () => {
    const tj = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Junioren", altersstufe: "juniorenfussball", stufen: ["D"] }),
    ).id;
    const { data: v } = await admin.from("training_varianten").select("id").eq("training_id", tj).single();
    // Kein Manual-Bestand im Juniorenfussball — die Fassungen direkt anlegen.
    const { data: fs, error } = await admin
      .from("training_exercises")
      .insert(
        (["jun-spielformen", "jun-spiel"] as const).map((teil) => ({
          training_id: tj,
          trainingsteil: teil,
          altersstufe: "juniorenfussball",
          variante_id: v!.id,
          position: 0,
          name: teil,
          aufbau: "Frei",
          duration_min: 15,
        })),
      )
      .select("id, trainingsteil");
    if (error) throw error;
    const spielformen = fs!.find((x) => x.trainingsteil === "jun-spielformen")!.id;
    const spiel = fs!.find((x) => x.trainingsteil === "jun-spiel")!.id;
    const a1 = wert(await legeGruppeAn(a.supabase, a.id, { trainingId: tj, name: "A" })).gruppe;
    const b1 = wert(await legeGruppeAn(a.supabase, a.id, { trainingId: tj, name: "B" })).gruppe;
    wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: spielformen, gruppeIds: [a1.id, b1.id] }));
    wert(await setzeDurchlauf(a.supabase, a.id, { fassungId: spiel, gruppeIds: [b1.id, a1.id] }));
    const [d] = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tj })).durchlauf;
    assert.equal(d.wechsel_zahl, 2);
    assert.deepEqual(
      d.wechsel.map((w) => w.belegung.map((b) => `${b.gruppe}@${b.uebung}`)),
      [["A@jun-spielformen", "B@jun-spiel"], ["A@jun-spiel", "B@jun-spielformen"]],
    );
    assert.deepEqual(d.zeit_je_gruppe.map((z) => z.text), ["Zugewiesen 30 min", "Zugewiesen 30 min"]);
  });

  // ── Fremd und unbekannt (#193 AK 12/14, OoS 7) ───────────────────────────
  await pruefe("Fremdes öffentliches Training: lesbar, Änderung → keine_rechte; Unsichtbares → nicht_gefunden", async () => {
    const tb = wert(
      await legeTrainingAn(b.supabase, b.id, { name: "Fremd öffentlich", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    const fb = wert(await ordneUebungZu(b.supabase, b.id, { trainingId: tb, einordnung: "einleitung", exerciseId: ein }));
    wert(
      await ordneUebungZu(b.supabase, b.id, {
        trainingId: tb,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
      }),
    );
    const { error } = await b.supabase.from("trainings").update({ visibility: "public" }).eq("id", tb);
    if (error) throw error;
    const privat = wert(
      await legeTrainingAn(b.supabase, b.id, { name: "Fremd privat", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;

    const FREMD = "Dieses Training gehört jemand anderem. Du kannst es ansehen und übernehmen, aber nicht ändern.";
    assert.equal(wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tb })).bearbeitbar, false);
    assert.equal(fehler(await benenneTrainingUm(a.supabase, a.id, { trainingId: tb, name: "X" }), "keine_rechte", FREMD).fremd, true);
    fehler(await setzeDauer(a.supabase, a.id, { fassungId: fb.fassungId, minuten: 3 }), "keine_rechte", FREMD);
    fehler(await entferneUebung(a.supabase, a.id, { fassungId: fb.fassungId }), "keine_rechte", FREMD);
    // Gruppen: B legt eine an, A darf sie weder ändern noch entfernen, noch am
    // fremden Training anlegen oder den Durchlauf setzen.
    const gb = wert(await legeGruppeAn(b.supabase, b.id, { trainingId: tb, name: "Fremd" })).gruppe;
    fehler(await legeGruppeAn(a.supabase, a.id, { trainingId: tb, name: "X" }), "keine_rechte", FREMD);
    fehler(await benenneGruppe(a.supabase, a.id, { gruppeId: gb.id, name: "X" }), "keine_rechte", FREMD);
    fehler(await entferneGruppe(a.supabase, a.id, { gruppeId: gb.id }), "keine_rechte", FREMD);
    fehler(
      await setzeDurchlauf(a.supabase, a.id, { fassungId: fb.fassungId, gruppeIds: [gb.id] }),
      "keine_rechte",
      FREMD,
    );
    fehler(
      await setzeUebungsfolge(a.supabase, a.id, { trainingId: tb, einordnung: "einleitung", fassungIds: [fb.fassungId] }),
      "keine_rechte",
      FREMD,
    );
    // Privat-fremd und zufällig: ununterscheidbar «nicht gefunden».
    fehler(await trainingAbrufen(a.supabase, a.id, { trainingId: privat }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await setzeZiel(a.supabase, a.id, { trainingId: randomUUID(), ziel: "x" }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await setzeNotiz(a.supabase, a.id, { fassungId: randomUUID(), notiz: "x" }), "nicht_gefunden", "Zuordnung nicht gefunden.");
    fehler(await entferneUebung(a.supabase, a.id, { fassungId: "keine-uuid" }), "nicht_gefunden", "Zuordnung nicht gefunden.");
  });
} finally {
  await aufraeumen();
}

console.log(`\n${gelaufen} Prüfungen bestanden (Wegwerf-Konten entfernt).`);
