// Prüft den Fachkern ECHT gegen die Datenbank (Epic #190, ab Story #193):
// dieselben Kern-Funktionen, die Server Actions und KI-Werkzeuge aufrufen,
// mit einem Client, der als Nutzer spricht — gebaut wie der des KI-Zugangs
// (`createBearerClient`: Anon-Key + Bearer-Token). Die RLS wirkt also
// unverändert; was hier durchgeht, geht auch im Betrieb durch, und was hier
// abgewiesen wird, weist auch der Betrieb ab.
//
// Der Wert gegenüber `check:kern`: Rechte («nicht gefunden» vs. «keine
// Rechte» an einem fremden öffentlichen Training), Positionen je Variante,
// die RPCs `setze_uebungsfolge` und `setze_variantenfolge` samt ihren Markern
// und die Meldungstexte gegen eingefrorene Literale — nichts davon ist ohne
// Datenbank prüfbar.
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
const { legeTrainingAn, benenneTrainingUm, setzeStufen, setzeZiel, veroeffentliche, setzeAufEntwurf } =
  await import("../lib/kern/training");
const { TRAGWEITE_VEROEFFENTLICHEN } = await import("../lib/training-bedingungen");
const { ordneUebungZu, entferneUebung, setzeDauer, setzeNotiz, setzeUebungsfolge, vorlagenFuerBlock } =
  await import("../lib/kern/fassung");
const { trainingAbrufen, trainingsSuchen } = await import("../lib/kern/lesen");
const { legeGruppeAn, benenneGruppe, entferneGruppe, setzeDurchlauf } = await import("../lib/kern/gruppen");
const { legeVarianteAn, benenneVariante, entferneVariante, setzeVariantenfolge } = await import(
  "../lib/kern/varianten"
);
const { loescheTraining, loescheTrainingMitBildern } = await import("../lib/kern/loeschen");
const { kopiereTrainingNach, HINWEIS_NICHTS_ENTSTANDEN } = await import("../lib/kern/kopie");
const { ladeTrainingDetail } = await import("../lib/queries/trainings-fuer");
const { setzeAn, aendereTermin, entferneTermin, setzeErneutAn, BEREITS_ANGESETZT } = await import(
  "../lib/kern/termine"
);
const { meineTeams, teamPlan } = await import("../lib/kern/team");
const {
  legeUebungAn,
  aendereUebung,
  veroeffentlicheUebung,
  setzeUebungAufEntwurf,
  kopiereUebungNach,
  TRAGWEITE_UEBUNG_VEROEFFENTLICHEN,
  UEBUNG_QUELLE_NICHT_VERFUEGBAR,
} = await import("../lib/kern/uebungen");
const { aktualisiereZeile, UEBUNG_ZEILE } = await import("../lib/kern/zugriff");
const { FASSUNG_INHALT_FELDER } = await import("../lib/fassung");
const { parseDiagramm } = await import("../lib/diagramm");
const { setzeDiagramm, diagrammMaengel, DIAGRAMM_LEER, MATERIAL_MIT_DIAGRAMM } = await import(
  "../lib/kern/uebung-diagramm"
);
const { pruefeDiagramm, diagrammAusFormular } = await import("../lib/diagramm-pruefung");
const { materialVorschlag } = await import("../lib/material");
const { getExercisesFuer } = await import("../lib/queries/uebungen-fuer");

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

/** Die Meldung an einem fremden öffentlichen Training (eingefroren). */
const FREMD = "Dieses Training gehört jemand anderem. Du kannst es ansehen und übernehmen, aber nicht ändern.";

type Konto = { id: string; supabase: SupabaseClient };
const konten: string[] = [];
/** Wegwerf-Teams; ihre Trainings kaskadieren beim Löschen mit. */
const teams: string[] = [];
/** Eigens hochgeladene Storage-Dateien (Bucket exercise-images). */
const dateien: string[] = [];

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
  if (dateien.length) {
    const { error } = await admin.storage.from("exercise-images").remove(dateien);
    if (error) console.error("[aufräumen] Dateien nicht entfernt:", error.message);
  }
  for (const id of teams) {
    const { error } = await admin.from("teams").delete().eq("id", id);
    if (error) console.error(`[aufräumen] Team ${id} nicht entfernt:`, error.message);
  }
  for (const id of konten) {
    try {
      // Bildkopien im Ordner des Kontos (Übungskopien #317) — auch die, die
      // ein gescheitertes Szenario hinterliess.
      const ordner = `user/${id}`;
      const { data: imOrdner } = await admin.storage.from("exercise-images").list(ordner, { limit: 1000 });
      if (imOrdner?.length)
        await admin.storage.from("exercise-images").remove(imOrdner.map((d) => `${ordner}/${d.name}`));
      const { data } = await admin.from("trainings").select("id").eq("owner_id", id);
      for (const t of data ?? []) {
        // Ein öffentliches Training verlöre sonst beim Löschen die Pflicht-Übungen.
        await admin.from("trainings").update({ visibility: "private" }).eq("id", t.id);
        await loescheTrainingMitBildern(admin as never, t.id);
      }
      // Eigene Übungen fielen beim Löschen des Kontos nicht mit
      // (`owner_id … on delete set null`) — sie blieben verwaist liegen.
      const { error: exFehler } = await admin.from("exercises").delete().eq("owner_id", id);
      if (exFehler) throw exFehler;
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

  // ── Material (Epic #266) ─────────────────────────────────────────────────
  await pruefe("Material: Liste, Basis und Ergänzung reisen beim Zuordnen und Kopieren mit (#267 PC 3)", async () => {
    const { data: quelle, error } = await admin.from("exercises").select("*").eq("id", ein).single();
    if (error) throw error;
    const liste = [{ art: "pylone", farbe: "rot", menge: 4 }];
    const basis = [{ art: "pylone", farbe: "rot", menge: 3 }];
    const { id: _id, slug: _slug, search_text: _s, created_at: _c, updated_at: _u, anzahl_kinder_min: _m, ...rest } = quelle;
    const { data: eigene, error: e1 } = await admin
      .from("exercises")
      .insert({
        ...rest,
        slug: `kern-db-material-${randomBytes(4).toString("hex")}`,
        source: "user",
        owner_id: a.id,
        visibility: "private",
        material: ["Pfeife"],
        material_liste: liste,
        material_basis: basis,
      })
      .select("id")
      .single();
    if (e1) throw e1;
    const tm = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Material-Probe", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    const f = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tm, einordnung: "einleitung", exerciseId: eigene.id }));
    const zeile = async (trainingId: string) =>
      (await admin.from("training_exercises").select("material, material_liste, material_basis").eq("training_id", trainingId).single()).data;
    const erwartet = { material: ["Pfeife"], material_liste: liste, material_basis: basis };
    assert.deepEqual(await zeile(tm), erwartet, "die Fassung trägt das Material der Übung");
    const detail = await ladeTrainingDetail(admin as never, tm);
    assert.deepEqual(detail!.exercises.find((x) => x.id === f.fassungId)!.materialListe, liste);
    const kopie = wert(await kopiereTrainingNach(a.supabase, a.id, { quelleId: tm })).id;
    assert.deepEqual(await zeile(kopie), erwartet, "die Trainingskopie trägt es ebenso");
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

  // ── Juniorenfussball anlegen und füllen (#199) ───────────────────────────
  await pruefe("Juniorenfussball: Kategorien, anziehende Form, Übernahme, andere Stufe, Auffangen, Hauptteilkategorie, leerer Block, Richtwerte", async () => {
    // AK 9: eine Kategorie des Kinderfussballs wird mit den zulässigen abgewiesen.
    const g = fehler(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Jun", altersstufe: "juniorenfussball", stufen: ["G"] }),
      "regel",
      "Diese Alterskategorie gehört nicht zur gewählten Altersstufe. Wähle nur Kategorien dieser Altersstufe.",
    ) as { zulaessig?: readonly string[] };
    assert.deepEqual(g.zulaessig, ["D", "C", "B", "A"]);
    const tj = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Jun", altersstufe: "juniorenfussball", stufen: ["D"] }),
    ).id;

    // Kein kuratierter Junioren-Bestand — zwei private Übungen des Kontos:
    // eine in den Spielformen mit «Den Körper stabil halten», eine im Auffangen.
    const eigene = async (trainingsteil: string, extra: Record<string, unknown>) => {
      const { data, error } = await admin
        .from("exercises")
        .insert({
          slug: `kern-db-jun-${randomBytes(4).toString("hex")}`,
          name: `Kern-DB ${trainingsteil}`,
          altersstufe: "juniorenfussball",
          trainingsteil,
          kategorien: ["D"],
          aufbau: "Im Wechsel",
          owner_id: a.id,
          visibility: "private",
          ...extra,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    };
    const stabil = await eigene("jun-spielformen", {
      erscheinungsform: ["koerper-stabil-halten"],
      uebungstyp: "isolierte-form",
      spielfeld_laenge_m: 20,
      spielfeld_breite_m: 15,
    });
    const ankommen = await eigene("jun-auffangen", {});

    // AK 4/5: Das Aufwärmen zeigt die Übung über ihre Erscheinungsform, obwohl
    // sie in den Spielformen liegt; ein Kinderfussball-Teil ist hier kein Block.
    const auf = wert(
      await vorlagenFuerBlock(a.supabase, a.id, { trainingId: tj, einordnung: "jun-aufwaermen", favoriten: false, mitLeerGrund: true }),
    );
    assert.ok(auf.treffer.some((t) => t.id === stabil), "Aufwärmen zieht «koerper-stabil-halten» an");
    assert.equal(auf.leer, null);
    const kifuTeil = fehler(
      await vorlagenFuerBlock(a.supabase, a.id, { trainingId: tj, einordnung: "einleitung" }),
      "regel",
      "Dieser Block gehört nicht zum Trainingsschema Juniorenfussball.",
    ) as { zulaessig?: readonly string[] };
    assert.ok(kifuTeil.zulaessig?.includes("jun-aufwaermen"));

    // AK 3, PC 1: Zuordnen in den gewählten Block — keine abgeleitete Einordnung.
    const w = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tj, einordnung: "jun-aufwaermen", exerciseId: stabil }));
    const af = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tj, einordnung: "jun-auffangen", exerciseId: ankommen }));

    // AK 10: eine Kinderfussball-Übung passt in kein Junioren-Training.
    fehler(
      await ordneUebungZu(a.supabase, a.id, { trainingId: tj, einordnung: "jun-aufwaermen", exerciseId: ein }),
      "regel",
      "Diese Übung gehört zur Altersstufe Kinderfussball und passt darum nicht in ein Training der Altersstufe Juniorenfussball.",
    );
    // PC 3: keine Hauptteilkategorie im Juniorenfussball.
    fehler(
      await ordneUebungZu(a.supabase, a.id, {
        trainingId: tj,
        einordnung: "jun-spielformen",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: stabil,
      }),
      "regel",
      "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
    );
    // PC 2: Das Auffangen nimmt keine Dauer an.
    fehler(
      await setzeDauer(a.supabase, a.id, { fassungId: af.fassungId, minuten: 10 }),
      "regel",
      "Für das Auffangen kann keine Dauer gesetzt werden.",
    );
    wert(await setzeDauer(a.supabase, a.id, { fassungId: w.fassungId, minuten: 15 }));

    // AK 6: Explosivität — leer, solange der sichtbare Bestand dafür nichts
    // führt (lokal kann ein öffentlicher Junioren-Bestand bestehen).
    const { count } = await admin
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("altersstufe", "juniorenfussball")
      .or(`owner_id.eq.${a.id},visibility.eq.public`)
      .or("trainingsteil.eq.jun-explosivitaet,erscheinungsform.cs.{explosiv-dynamisch-agieren}");
    const ex = wert(
      await vorlagenFuerBlock(a.supabase, a.id, { trainingId: tj, einordnung: "jun-explosivitaet", favoriten: false, mitLeerGrund: true }),
    );
    if (!count)
      assert.deepEqual(ex.leer, {
        grund: "bestand_leer",
        text: "Für „Explosivität\" gibt es in deinem sichtbaren Bestand noch keine Übung der Altersstufe Juniorenfussball.",
      });
    else assert.equal(ex.treffer.length > 0, true);

    // AK 7/8: Spielfeld und Übungstyp aus der Vorlage; Richtwert und Abweichung.
    const aus = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tj }));
    const bloecke = aus.teile.flatMap((t) => t.bloecke);
    const aufwaermen = bloecke.find((b) => b.einordnung.slug === "jun-aufwaermen")!;
    const u = aufwaermen.uebungen[0];
    assert.equal(u.fassung_id, w.fassungId);
    assert.equal(u.einordnung.slug, "jun-aufwaermen");
    assert.equal(u.hauptteilkategorie, null);
    assert.deepEqual(u.spielfeld, { laenge_m: 20, breite_m: 15 });
    assert.equal(u.uebungstyp?.slug, "isolierte-form");
    assert.deepEqual(aufwaermen.richtwert, { min_min: 10, max_min: 12, abweichung_min: 3 });
    assert.deepEqual(aus.teile.find((t) => t.teil.slug === "einstieg")!.richtwert, { min_min: 20, max_min: 30, abweichung_min: -5 });
    assert.equal(aus.teile.find((t) => t.teil.slug === "auffangen")!.richtwert, null);
    assert.deepEqual(aus.gesamt[0].richtwert, { min_min: 90, max_min: 90, abweichung_min: -75 });
  });

  // ── Veröffentlichen und zurückziehen (#196) ──────────────────────────────
  await pruefe("Veröffentlichen: alle fehlenden Bedingungen, Urheber, Gate (AK 7), Entwurf, Team und fremd abgewiesen", async () => {
    const tp = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Öffentlich", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    // Leer: JEDE fehlende Bedingung einzeln, nicht nur die erste (NFR 2).
    const leer = fehler(
      await veroeffentliche(a.supabase, a.id, { trainingId: tp }),
      "bedingung",
      "Zum Veröffentlichen fehlt noch: mindestens eine Übung in der Einleitung; " +
        "mindestens eine Übung im freien Spiel.",
    ) as { fehlend?: unknown };
    assert.deepEqual(leer.fehlend, [
      { bedingung: "einleitung", varianteId: null },
      { bedingung: "freies_spiel", varianteId: null },
    ]);

    const einl = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tp, einordnung: "einleitung", exerciseId: ein }));
    fehler(
      await veroeffentliche(a.supabase, a.id, { trainingId: tp }),
      "bedingung",
      "Zum Veröffentlichen fehlt noch: mindestens eine Übung im freien Spiel.",
    );
    wert(
      await ordneUebungZu(a.supabase, a.id, {
        trainingId: tp,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
      }),
    );
    const pub = wert(await veroeffentliche(a.supabase, a.id, { trainingId: tp }));
    const { data: name } = await admin.rpc("anzeige_name", { p_user: a.id });
    assert.deepEqual(pub, {
      trainingId: tp,
      sichtbarkeit: "oeffentlich",
      urheber: name,
      tragweite: TRAGWEITE_VEROEFFENTLICHEN,
    });
    const { data: zeile } = await admin.from("trainings").select("visibility").eq("id", tp).single();
    assert.equal(zeile?.visibility, "public");

    // Ein fremdes öffentliches Training: sichtbar, aber weder zu veröffentlichen
    // noch zurückzuziehen (OoS 1).
    fehler(await veroeffentliche(b.supabase, b.id, { trainingId: tp }), "keine_rechte", FREMD);
    fehler(await setzeAufEntwurf(b.supabase, b.id, { trainingId: tp }), "keine_rechte", FREMD);

    // Öffentlich: Die letzte Einleitungs-Übung lässt sich nicht entfernen (AK 7).
    const gate = fehler(
      await entferneUebung(a.supabase, a.id, { fassungId: einl.fassungId }),
      "bedingung",
      "Ein öffentliches Training braucht mindestens eine Übung in der Einleitung. " +
        "Setze es zuerst auf Entwurf, wenn du es so ändern willst.",
    ) as { bedingung?: string; varianteId?: string };
    assert.equal(gate.bedingung, "einleitung");
    assert.equal(gate.varianteId, undefined);

    // Entwurf: danach geht es; ein zweites Mal bleibt Entwurf.
    assert.deepEqual(wert(await setzeAufEntwurf(a.supabase, a.id, { trainingId: tp })), {
      trainingId: tp,
      sichtbarkeit: "entwurf",
    });
    wert(await setzeAufEntwurf(a.supabase, a.id, { trainingId: tp }));
    wert(await entferneUebung(a.supabase, a.id, { fassungId: einl.fassungId }));

    // Team-Training: nie öffentlich, beide Richtungen als Regel (AK 6).
    const { data: team, error } = await admin.from("teams").insert({ name: "Kern-DB-Team" }).select("id").single();
    if (error) throw error;
    teams.push(team.id);
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team.id, user_id: a.id });
    if (e2) throw e2;
    const tt = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Team", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }),
    ).id;
    fehler(
      await veroeffentliche(a.supabase, a.id, { trainingId: tt }),
      "regel",
      "Ein Team-Training lässt sich nicht veröffentlichen. Übernimm es zuerst in deinen persönlichen Bestand.",
    );
    fehler(
      await setzeAufEntwurf(a.supabase, a.id, { trainingId: tt }),
      "regel",
      "Ein Team-Training ist nie öffentlich und hat darum keinen Entwurfs-Zustand.",
    );
    fehler(await veroeffentliche(a.supabase, a.id, { trainingId: randomUUID() }), "nicht_gefunden", "Training nicht gefunden.");
  });

  // ── Fremd und unbekannt (#193 AK 12/14, OoS 7) ───────────────────────────
  await pruefe("Fremdes öffentliches Training: lesbar, Änderung (auch an Varianten) → keine_rechte; Unsichtbares → nicht_gefunden", async () => {
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
    // Varianten (#263): A darf an Bs Training weder anlegen, umbenennen,
    // entfernen noch ordnen; eine Variante eines privaten fremden Trainings
    // gibt es für A nicht.
    const [vb] = wert(await trainingAbrufen(b.supabase, b.id, { trainingId: tb })).varianten;
    fehler(await legeVarianteAn(a.supabase, a.id, { trainingId: tb, name: "x" }), "keine_rechte", FREMD);
    fehler(await benenneVariante(a.supabase, a.id, { varianteId: vb.id, name: "x" }), "keine_rechte", FREMD);
    fehler(await entferneVariante(a.supabase, a.id, { varianteId: vb.id }), "keine_rechte", FREMD);
    fehler(await setzeVariantenfolge(a.supabase, a.id, { trainingId: tb, varianteIds: [vb.id] }), "keine_rechte", FREMD);
    const { data: vp } = await admin.from("training_varianten").select("id").eq("training_id", privat).single();
    fehler(await benenneVariante(a.supabase, a.id, { varianteId: vp!.id, name: "x" }), "nicht_gefunden", "Variante nicht gefunden.");
    fehler(await legeVarianteAn(a.supabase, a.id, { trainingId: privat, name: "x" }), "nicht_gefunden", "Training nicht gefunden.");
    // Privat-fremd und zufällig: ununterscheidbar «nicht gefunden».
    fehler(await trainingAbrufen(a.supabase, a.id, { trainingId: privat }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await setzeZiel(a.supabase, a.id, { trainingId: randomUUID(), ziel: "x" }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await setzeNotiz(a.supabase, a.id, { fassungId: randomUUID(), notiz: "x" }), "nicht_gefunden", "Zuordnung nicht gefunden.");
    fehler(await entferneUebung(a.supabase, a.id, { fassungId: "keine-uuid" }), "nicht_gefunden", "Zuordnung nicht gefunden.");
  });

  // ── Varianten (#263) ─────────────────────────────────────────────────────
  await pruefe("Varianten: anlegen mit Mitbenennen, Namen, Quelle, Pflicht beim Zuordnen, umbenennen, ordnen, entfernen bis zur Auflösung", async () => {
    const VERGEBEN = "Diese Bezeichnung gibt es in diesem Training schon.";
    const hauptteil = { einordnung: "hauptteil", hauptteilkategorie: "fussball-spielen", exerciseId: frei };
    const tv = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Varianten", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    // Eine Variante: ohne «variante_id» geht es.
    const h1 = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tv, ...hauptteil }));
    const [v1] = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tv })).varianten;
    assert.equal(v1.name, "Variante 1");

    // Anlegen der zweiten, die Quelle wird mitbenannt; der Name wird getrimmt.
    const r2 = wert(
      await legeVarianteAn(a.supabase, a.id, { trainingId: tv, name: " 20 Kinder ", nameQuelle: "12 Kinder" }),
    );
    assert.deepEqual(r2.quelle, { id: v1.id, name: "12 Kinder" });
    assert.equal(r2.variante.name, "20 Kinder");
    assert.equal(r2.uebungenKopiert, 1);
    const v2 = r2.variante;
    const { data: kopien } = await admin.from("training_exercises").select("id").eq("variante_id", v2.id);
    assert.equal(kopien?.length, 1);
    assert.notEqual(kopien![0].id, h1.fassungId, "die Kopie ist eine eigene Fassung");

    // Namensregeln — am richtigen Feld.
    const n1 = await legeVarianteAn(a.supabase, a.id, { trainingId: tv, name: "20 KINDER" });
    fehler(n1, "regel", VERGEBEN);
    assert.equal(!n1.ok && n1.feld, "name");
    const n2 = await legeVarianteAn(a.supabase, a.id, { trainingId: tv, name: "x", nameQuelle: "20 kinder" });
    fehler(n2, "regel", VERGEBEN);
    assert.equal(!n2.ok && n2.feld, "name_quelle");
    fehler(await legeVarianteAn(a.supabase, a.id, { trainingId: tv, name: "   " }), "eingabe", "Bitte eine Bezeichnung eingeben.");
    // Eine Quelle, die nicht zum Training gehört, nennt die zulässigen.
    const q = await legeVarianteAn(a.supabase, a.id, { trainingId: tv, name: "x", quelleVarianteId: randomUUID() });
    fehler(q, "regel", "Diese Variante gehört zu einem anderen Training.");
    assert.deepEqual(!q.ok && q.zulaessig, [v1.id, v2.id]);

    // Zwei Varianten: Zuordnen ohne Angabe wird abgewiesen, mit Angabe geht es.
    const z = await ordneUebungZu(a.supabase, a.id, { trainingId: tv, ...hauptteil });
    fehler(z, "eingabe", "Dieses Training führt mehrere Varianten des Hauptteils. Gib an, in welche die Übung kommt.");
    assert.deepEqual(!z.ok && z.zulaessig, [v1.id, v2.id]);
    assert.equal(!z.ok && z.feld, "variante_id");
    assert.equal(wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tv, ...hauptteil, varianteId: v2.id })).varianteId, v2.id);

    // Umbenennen — die eigene Bezeichnung zählt nicht als vergeben.
    assert.deepEqual(wert(await benenneVariante(a.supabase, a.id, { varianteId: v1.id, name: "12 kinder" })), {
      trainingId: tv,
      name: "12 kinder",
    });
    fehler(await benenneVariante(a.supabase, a.id, { varianteId: v1.id, name: "20 Kinder" }), "regel", VERGEBEN);
    fehler(await benenneVariante(a.supabase, a.id, { varianteId: randomUUID(), name: "x" }), "nicht_gefunden", "Variante nicht gefunden.");
    fehler(await benenneVariante(a.supabase, a.id, { varianteId: "keine-uuid", name: "x" }), "nicht_gefunden", "Variante nicht gefunden.");

    // Eine dritte (Kopie der zweiten), dann ordnen.
    const v3 = wert(await legeVarianteAn(a.supabase, a.id, { trainingId: tv, quelleVarianteId: v2.id, name: "Regen" })).variante;
    const reihenfolge = async () => {
      const { data } = await admin.from("training_varianten").select("id, position").eq("training_id", tv);
      return Object.fromEntries((data ?? []).map((v) => [v.id, v.position]));
    };
    assert.deepEqual(
      wert(await setzeVariantenfolge(a.supabase, a.id, { trainingId: tv, varianteIds: [v3.id, v1.id, v2.id] })).folge.map((v) => v.name),
      ["Regen", "12 kinder", "20 Kinder"],
    );
    assert.deepEqual(await reihenfolge(), { [v3.id]: 0, [v1.id]: 1, [v2.id]: 2 });
    const u = await setzeVariantenfolge(a.supabase, a.id, { trainingId: tv, varianteIds: [v3.id] });
    fehler(
      u,
      "regel",
      /^Die Reihenfolge muss genau die Varianten dieses Trainings nennen — jede einmal\. Lies das Training neu und sende die vollständige Folge\. Es fehlen: „/,
    );
    assert.deepEqual([...(!u.ok && u.zulaessig ? u.zulaessig : [])].sort(), [v1.id, v2.id, v3.id].sort());
    fehler(
      await setzeVariantenfolge(a.supabase, a.id, { trainingId: tv, varianteIds: [v3.id, v3.id, v1.id] }),
      "regel",
      /^Eine Variante steht in der Reihenfolge mehrfach\. Mehrfach: „/,
    );
    // Die RPC selbst — der Rückhalt, falls die Vorprüfung umgangen wird.
    const rpc = (k: Konto, ids: string[]) => k.supabase.rpc("setze_variantenfolge", { p_training: tv, p_ids: ids });
    assert.match((await rpc(a, [v3.id])).error?.message ?? "", /VARIANTENFOLGE_UNVOLLSTAENDIG/);
    assert.match((await rpc(a, [v3.id, v3.id, v1.id, v2.id])).error?.message ?? "", /VARIANTENFOLGE_DOPPELT/);
    assert.match((await rpc(b, [v3.id, v1.id, v2.id])).error?.message ?? "", /not found or not editable/);
    assert.deepEqual(await reihenfolge(), { [v3.id]: 0, [v1.id]: 1, [v2.id]: 2 }, "abgewiesene Folgen ändern nichts");

    // Entfernen bis zur Auflösung.
    const e3 = wert(await entferneVariante(a.supabase, a.id, { varianteId: v3.id }));
    assert.equal(e3.aufgeloest, false);
    assert.equal(e3.verbleibend.length, 2);
    // «Regen» kopierte «20 Kinder» mit beiden Übungen (Kopie + Zuordnung oben).
    assert.equal(e3.uebungenEntfernt, 2);
    const e2 = wert(await entferneVariante(a.supabase, a.id, { varianteId: v2.id }));
    assert.equal(e2.aufgeloest, true);
    assert.deepEqual(e2.verbleibend, [{ id: v1.id, name: "Variante 1" }]);
    assert.deepEqual(await reihenfolge(), { [v1.id]: 0 });
    fehler(
      await entferneVariante(a.supabase, a.id, { varianteId: v1.id }),
      "regel",
      "Die letzte Variante des Hauptteils lässt sich nicht entfernen.",
    );
    fehler(await entferneVariante(a.supabase, a.id, { varianteId: v2.id }), "nicht_gefunden", "Variante nicht gefunden.");
  });

  // ── Übernehmen und Löschen (#197) ────────────────────────────────────────
  // Die Quelle: ein öffentliches Training von B mit allem, was eine Kopie
  // tragen muss — Ziel, zwei Varianten, Gruppen, Durchlauf, Notiz, Dauer.
  const tq = wert(
    await legeTrainingAn(b.supabase, b.id, {
      name: "Kern-DB-Quelle",
      altersstufe: "kinderfussball",
      stufen: ["F", "E"],
      ziel: "Passspiel unter Druck",
    }),
  ).id;
  {
    const qe = wert(await ordneUebungZu(b.supabase, b.id, { trainingId: tq, einordnung: "einleitung", exerciseId: ein }));
    wert(await setzeNotiz(b.supabase, b.id, { fassungId: qe.fassungId, notiz: "Hütchen bereitlegen" }));
    wert(await setzeDauer(b.supabase, b.id, { fassungId: qe.fassungId, minuten: 10 }));
    const qh1 = wert(
      await ordneUebungZu(b.supabase, b.id, {
        trainingId: tq,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
      }),
    );
    wert(await setzeDauer(b.supabase, b.id, { fassungId: qh1.fassungId, minuten: 15 }));
    const { data: v2, error } = await admin
      .from("training_varianten")
      .insert({ training_id: tq, name: "Regen", position: 1 })
      .select("id")
      .single();
    if (error) throw error;
    wert(
      await ordneUebungZu(b.supabase, b.id, {
        trainingId: tq,
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen",
        exerciseId: frei,
        varianteId: v2.id,
      }),
    );
    const blau = wert(await legeGruppeAn(b.supabase, b.id, { trainingId: tq, name: "Blau" })).gruppe;
    const gelb = wert(await legeGruppeAn(b.supabase, b.id, { trainingId: tq, name: "Gelb" })).gruppe;
    wert(await setzeDurchlauf(b.supabase, b.id, { fassungId: qh1.fassungId, gruppeIds: [gelb.id, blau.id] }));
    wert(await veroeffentliche(b.supabase, b.id, { trainingId: tq }));
  }

  /** Das Orakel: ein Training ohne das, was eine Kopie neu bekommt —
   *  Kennungen, Eigentum, Sichtbarkeit, Zeitstempel. Varianten und Gruppen
   *  werden über ihre Reihenfolge abgebildet, damit auch die Zuordnung der
   *  Übungen zu ihnen verglichen wird; jede übrige Kennung (auch im Diagramm)
   *  wird unkenntlich. */
  const inhalt = async (id: string) => {
    const d = await ladeTrainingDetail(a.supabase, id);
    assert.ok(d, `Training ${id} nicht lesbar`);
    const v = new Map(d.varianten.map((x, i) => [x.id, `V${i}`]));
    const g = new Map(d.gruppen.map((x, i) => [x.id, `G${i}`]));
    const { id: _i, ownerId: _o, visibility: _v, urheber: _u, createdAt: _c, updatedAt: _up, ...rest } = d;
    const roh = JSON.stringify({
      ...rest,
      varianten: d.varianten.map((x) => ({ ...x, id: v.get(x.id) })),
      gruppen: d.gruppen.map((x) => ({ ...x, id: g.get(x.id) })),
      exercises: d.exercises
        .map(({ id: _f, ...f }) => ({
          ...f,
          varianteId: f.varianteId ? v.get(f.varianteId) : null,
          gruppen: f.gruppen.map((x) => g.get(x.id)),
        }))
        .map((f) => JSON.stringify(f))
        .sort(),
    });
    return JSON.parse(roh.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "#"));
  };

  let k1 = "";
  await pruefe("Übernehmen: öffentliches Training → private, vollständige Kopie; Quelle unberührt; mehrfach", async () => {
    const vorher = await ladeTrainingDetail(admin as never, tq);
    const r = wert(await kopiereTrainingNach(a.supabase, a.id, { quelleId: tq }));
    k1 = r.id;
    assert.deepEqual(r.ziel, { art: "persoenlich" });
    const { data: zeile } = await admin.from("trainings").select("owner_id, team_id, visibility, ziel").eq("id", k1).single();
    assert.deepEqual(zeile, { owner_id: a.id, team_id: null, visibility: "private", ziel: "Passspiel unter Druck" });

    const q = await inhalt(tq);
    assert.equal(q.ziel, "Passspiel unter Druck");
    assert.equal(q.varianten.length, 2);
    assert.equal(q.gruppen.length, 2);
    assert.deepEqual(await inhalt(k1), q, "die Kopie trägt denselben Inhalt wie die Quelle");
    assert.deepEqual(await ladeTrainingDetail(admin as never, tq), vorher, "die Quelle bleibt unberührt");

    const k2 = wert(await kopiereTrainingNach(a.supabase, a.id, { quelleId: tq })).id;
    assert.notEqual(k2, k1, "jede Übernahme ist ein eigenes Training");
    // Auch ein eigenes Training lässt sich übernehmen — eine zweite Fassung.
    const k3 = wert(await kopiereTrainingNach(a.supabase, a.id, { quelleId: k1 })).id;
    assert.deepEqual(await inhalt(k3), q);

    // Unsichtbares und Zufälliges: nichts entstanden.
    const privat = wert(
      await legeTrainingAn(b.supabase, b.id, { name: "Privat", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    for (const id of [privat, randomUUID(), "keine-uuid"]) {
      const f = fehler(
        await kopiereTrainingNach(a.supabase, a.id, { quelleId: id }),
        "nicht_gefunden",
        "Das Training ist nicht (mehr) verfügbar.",
      ) as { hinweis?: string };
      assert.equal(f.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    }
    // Ein fremdes Team: nicht gefunden, bevor etwas entsteht.
    fehler(
      await kopiereTrainingNach(a.supabase, a.id, { quelleId: tq, teamId: randomUUID() }),
      "nicht_gefunden",
      "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.",
    );
  });

  await pruefe("Übernehmen: gescheiterte Bildkopie → Meldung, «nichts entstanden», kein Training übrig (PC 2, NFR 2)", async () => {
    const tf = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Bildfehler", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    const fe = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tf, einordnung: "einleitung", exerciseId: ein }));
    const fe2 = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tf, einordnung: "einleitung", exerciseId: ein }));
    // Eine Fassung zeigt auf eine Datei, die es im Speicher nicht gibt …
    const { error } = await admin
      .from("training_exercises")
      .update({ bild_url: `${URL_}/storage/v1/object/public/exercise-images/user/${a.id}/fehlt-${randomUUID()}.webp` })
      .eq("id", fe.fassungId);
    if (error) throw error;
    // … die andere auf eine echte: Deren Kopie gelingt und muss beim Abbruch
    // wieder fallen.
    const ordner = `user/${a.id}`;
    const echt = `${ordner}/${fe2.fassungId}.webp`;
    const { error: upFehler } = await admin.storage
      .from("exercise-images")
      .upload(echt, new Blob([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    if (upFehler) throw upFehler;
    dateien.push(echt);
    const { error: e3 } = await admin
      .from("training_exercises")
      .update({ bild_url: `${URL_}/storage/v1/object/public/exercise-images/${echt}` })
      .eq("id", fe2.fassungId);
    if (e3) throw e3;
    const imOrdner = async () =>
      ((await admin.storage.from("exercise-images").list(ordner, { limit: 100 })).data ?? [])
        .map((d) => `${ordner}/${d.name}`)
        .sort();
    const dateienVorher = await imOrdner();
    assert.deepEqual(dateienVorher, [echt]);
    const zahl = async () =>
      (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("owner_id", a.id)).count;
    const vorher = await zahl();
    const f = fehler(
      await kopiereTrainingNach(a.supabase, a.id, { quelleId: tf }),
      "technisch",
      "Das Bild liess sich nicht kopieren. Bitte versuche es noch einmal.",
    ) as { hinweis?: string };
    assert.equal(f.hinweis, "Es ist keine Kopie entstanden — der Versuch lässt sich gefahrlos wiederholen.");
    assert.equal(await zahl(), vorher, "in der Datenbank steht kein neues Training");
    assert.deepEqual(await imOrdner(), dateienVorher, "die gelungene Bildkopie ist wieder entfernt");
  });

  await pruefe("Löschen: Auskunft vorher gelesen, danach weg; fremd → keine_rechte; unbekannt → nicht_gefunden", async () => {
    // Die Kopie erfüllt die Bedingungen der Quelle — veröffentlichen, dann löschen.
    wert(await veroeffentliche(a.supabase, a.id, { trainingId: k1 }));
    // Nur Team-Trainings: ein persönliches bleibt stehen.
    fehler(await loescheTraining(a.supabase, a.id, { trainingId: k1, nurTeam: true }), "nicht_gefunden", "Training nicht gefunden.");
    assert.deepEqual(wert(await loescheTraining(a.supabase, a.id, { trainingId: k1 })), {
      name: "Kern-DB-Quelle",
      uebungen: 3,
      warOeffentlich: true,
      teamId: null,
      terminEntfiel: false,
    });
    fehler(await trainingAbrufen(a.supabase, a.id, { trainingId: k1 }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await loescheTraining(a.supabase, a.id, { trainingId: k1 }), "nicht_gefunden", "Training nicht gefunden.");
    const { count } = await admin.from("training_exercises").select("*", { count: "exact", head: true }).eq("training_id", k1);
    assert.equal(count, 0, "die Übungen gehen mit (PC 5)");

    fehler(await loescheTraining(a.supabase, a.id, { trainingId: tq }), "keine_rechte", FREMD);
    fehler(await loescheTraining(a.supabase, a.id, { trainingId: randomUUID() }), "nicht_gefunden", "Training nicht gefunden.");
    // Die Kopien anderer bleiben, wenn die Quelle geht (PC 7).
    const kb = wert(await kopiereTrainingNach(a.supabase, a.id, { quelleId: tq })).id;
    wert(await loescheTraining(b.supabase, b.id, { trainingId: tq }));
    assert.ok(await ladeTrainingDetail(a.supabase, kb), "die Übernahme von A besteht weiter");
  });

  // ── Teams und Termine (#198) ────────────────────────────────────────────
  await pruefe("Teams und Termine: ansetzen, einmal je Training, ändern, Plan, erneut ansetzen, entfernen, fremd", async () => {
    const TEAM_FREMD = "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.";
    const NUR_TEAM = "Termine gibt es nur für Team-Trainings. Stelle das Training zuerst ins Team.";
    const { data: team, error } = await admin.from("teams").insert({ name: "Kern-DB-Termine" }).select("id").single();
    if (error) throw error;
    teams.push(team.id);
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team.id, user_id: a.id });
    if (e2) throw e2;

    // AK 1: die eigenen Teams; B ist in keinem.
    const ta = wert(await meineTeams(a.supabase, a.id)).teams;
    assert.deepEqual(ta.find((t) => t.id === team.id), { id: team.id, name: "Kern-DB-Termine", mitglieder: 1 });
    assert.equal(wert(await meineTeams(b.supabase, b.id)).teams.length, 0);

    // AK 4: direkt im Team anlegen.
    const tt = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Termin", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }),
    );
    assert.equal(tt.teamId, team.id);
    wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tt.id, einordnung: "einleitung", exerciseId: ein }));

    // AK 10: ein persönliches Training nimmt keinen Termin.
    const persoenlich = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Persönlich", altersstufe: "kinderfussball", stufen: ["F"] }),
    ).id;
    fehler(await setzeAn(a.supabase, a.id, { trainingId: persoenlich, datum: "2030-01-01" }), "regel", NUR_TEAM);
    // Felder zuerst: ein erfundener Tag, eine erfundene Uhrzeit.
    fehler(await setzeAn(a.supabase, a.id, { trainingId: tt.id, datum: "2026-02-30" }), "eingabe", "Bitte ein Datum angeben.");
    fehler(
      await setzeAn(a.supabase, a.id, { trainingId: tt.id, datum: "2030-01-01", beginn: "25:99" }),
      "eingabe",
      "Bitte eine gültige Uhrzeit angeben.",
    );

    // AK 7: ansetzen mit Beginn, Ort, Bemerkung; PC 3: höchstens einer.
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const t1 = wert(
      await setzeAn(a.supabase, a.id, { trainingId: tt.id, datum: tag(2), beginn: "18:30", ort: " Allmend ", bemerkung: "Leibchen" }),
    );
    assert.deepEqual({ trainingId: t1.trainingId, teamId: t1.teamId }, { trainingId: tt.id, teamId: team.id });
    fehler(await setzeAn(a.supabase, a.id, { trainingId: tt.id, datum: tag(3) }), "regel", BEREITS_ANGESETZT);
    const zeile = async (id: string) =>
      (await admin.from("training_termine").select("datum, beginn, ort, bemerkung").eq("id", id).single()).data;
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ort: "Allmend", bemerkung: "Leibchen" });

    // AK 8: nur Übergebenes ändert sich; null leert.
    assert.deepEqual(
      wert(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "Sportplatz Nord", bemerkung: null })),
      { trainingId: tt.id, teamId: team.id },
    );
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ort: "Sportplatz Nord", bemerkung: null });
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, datum: "2026-13-01" }), "eingabe", "Bitte ein Datum angeben.");
    fehler(await aendereTermin(a.supabase, a.id, { terminId: randomUUID(), ort: "x" }), "nicht_gefunden", "Termin nicht gefunden.");

    // AK 9 / PC 4: erneut ansetzen (gestern) → neue Kopie mit eigenem Termin;
    // das Original behält seinen.
    const neu = wert(await setzeErneutAn(a.supabase, a.id, { trainingId: tt.id, datum: tag(-1), ort: "Halle" }));
    assert.notEqual(neu.trainingId, tt.id);
    assert.equal(neu.teamId, team.id);
    const { data: kz } = await admin.from("trainings").select("team_id, owner_id, name").eq("id", neu.trainingId).single();
    assert.deepEqual(kz, { team_id: team.id, owner_id: null, name: "Kern-DB-Termin" });
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ort: "Sportplatz Nord", bemerkung: null });

    // AK 3 / NFR 1: der Plan ist bereits geteilt.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team.id }));
    assert.equal(plan.team.name, "Kern-DB-Termine");
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [neu.terminId]);
    assert.equal(plan.vergangen[0].training.id, neu.trainingId);
    // Am Tag des Termins zählt er noch zum Kommenden.
    const amTag = wert(await teamPlan(a.supabase, a.id, { teamId: team.id, heute: tag(-1) }));
    assert.equal(amTag.kommend.length, 2);

    // AK 2: der Team-Bestand samt Termin; ohne Team-Kennung → eingabe.
    const suche = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, limit: 10 }));
    assert.equal(suche.treffer.length, 2);
    const original = suche.treffer.find((t) => t.id === tt.id)!;
    assert.equal(original.termin?.id, t1.terminId);
    assert.equal(original.termin?.anstehend, true);
    assert.equal(suche.treffer.find((t) => t.id === neu.trainingId)!.termin?.anstehend, false);
    const gesucht = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, q: "Termin", limit: 1 }));
    assert.equal(gesucht.treffer.length, 1);
    assert.equal(gesucht.weitere, true);
    fehler(await trainingsSuchen(a.supabase, a.id, { bestand: "team", limit: 10 }), "eingabe");
    // Die Auskunft nennt den Termin.
    const auskunft = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tt.id }));
    assert.deepEqual(auskunft.termin, {
      id: t1.terminId,
      datum: tag(2),
      beginn: "18:30",
      ort: "Sportplatz Nord",
      bemerkung: null,
      anstehend: true,
    });
    assert.equal(wert(await trainingAbrufen(a.supabase, a.id, { trainingId: persoenlich })).termin, null);

    // Scheitert das Ansetzen der Kopie, geht die Kopie wieder (Risiko 2): ein
    // Client, dessen Termin-Insert fehlschlägt.
    const kaputt = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "from")
          return (tabelle: string) =>
            tabelle === "training_termine"
              ? {
                  insert: () => ({
                    select: () => ({ single: async () => ({ data: null, error: { message: "Probe", code: "XX000" } }) }),
                  }),
                }
              : ziel.from(tabelle);
        return Reflect.get(ziel, name, empf);
      },
    });
    const zahl = async () =>
      (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team.id)).count;
    const vorher = await zahl();
    const f = fehler(
      await setzeErneutAn(kaputt, a.id, { trainingId: tt.id, datum: tag(5) }),
      "technisch",
    ) as { hinweis?: string };
    assert.equal(f.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await zahl(), vorher, "keine Kopie ohne Termin bleibt stehen");
    // Erneut ansetzen braucht ein Team-Training.
    fehler(await setzeErneutAn(a.supabase, a.id, { trainingId: persoenlich, datum: tag(5) }), "regel", NUR_TEAM);

    // AK 11: fremdes Team und fremder Termin.
    fehler(await teamPlan(b.supabase, b.id, { teamId: team.id }), "nicht_gefunden", TEAM_FREMD);
    fehler(await teamPlan(a.supabase, a.id, { teamId: randomUUID() }), "nicht_gefunden", TEAM_FREMD);
    fehler(await trainingsSuchen(b.supabase, b.id, { bestand: "team", teamId: team.id, limit: 5 }), "nicht_gefunden", TEAM_FREMD);
    fehler(
      await legeTrainingAn(b.supabase, b.id, { name: "x", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }),
      "nicht_gefunden",
      TEAM_FREMD,
    );
    fehler(await setzeAn(b.supabase, b.id, { trainingId: tt.id, datum: tag(1) }), "nicht_gefunden", "Training nicht gefunden.");
    fehler(await aendereTermin(b.supabase, b.id, { terminId: t1.terminId, ort: "x" }), "nicht_gefunden", "Termin nicht gefunden.");
    // Ein fremder Termin lässt sich nicht entfernen — er bleibt stehen.
    assert.deepEqual(wert(await entferneTermin(b.supabase, b.id, { terminId: t1.terminId })), { trainingId: null, teamId: null });
    assert.ok(await zeile(t1.terminId), "der Termin des fremden Teams steht noch");

    // AK 8: entfernen, idempotent; das Training bleibt.
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId })), {
      trainingId: tt.id,
      teamId: team.id,
    });
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId })), { trainingId: null, teamId: null });
    assert.ok(await ladeTrainingDetail(a.supabase, tt.id), "das Training bleibt im Team-Bestand");
    // Danach lässt es sich wieder ansetzen.
    wert(await setzeAn(a.supabase, a.id, { trainingId: tt.id, datum: tag(7) }));
  });

  // ── Übung anlegen (#143) ─────────────────────────────────────────────────
  const uebungenVon = async (id: string) =>
    (await admin.from("exercises").select("id", { count: "exact", head: true }).eq("owner_id", id)).count ?? 0;
  const NICHTS_ANGELEGT = "Es ist nichts angelegt worden.";

  await pruefe("Übung anlegen: privater Entwurf des Aufrufers, nur für ihn sichtbar, unter seinen eigenen (PC 1–3)", async () => {
    const u = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name: "KI-Probe Anlegen",
        einordnung: "einleitung",
        kategorien: ["F"],
        offenStarten: "Offen",
        ueben: "Üben",
        wetteifern: "Wett",
      }),
    );
    assert.match(u.slug, /^ki-probe-anlegen-[0-9a-f]{6}$/);
    assert.equal(u.sichtbarkeit, "entwurf");
    const { data: zeile } = await admin
      .from("exercises")
      .select("owner_id, source, visibility, altersstufe")
      .eq("id", u.id)
      .single();
    assert.deepEqual(zeile, { owner_id: a.id, source: "user", visibility: "private", altersstufe: "kinderfussball" });
    const { data: fremd } = await b.supabase.from("exercises").select("id").eq("id", u.id).maybeSingle();
    assert.equal(fremd, null, "ein anderes Konto sieht den Entwurf nicht");
    const eigene = await getExercisesFuer(a.supabase, a.id, { mine: true }, { favoriten: false });
    assert.ok(eigene.some((x) => x.id === u.id), "unter den eigenen Übungen");
  });

  await pruefe("Übung anlegen: jede Angabe des Formulars landet in der Zeile (AK 3)", async () => {
    const u = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name: "KI-Probe Voll",
        einordnung: "hauptteil",
        hauptteilkategorie: "fussball-spielen-lernen",
        kategorien: ["G", "F"],
        offenStarten: "Offen",
        ueben: ["- links", "- rechts"],
        wetteifern: "Wett",
        varianten: "Mit zwei Bällen",
        erscheinungsformen: ["mutig-tore-erzielen"],
        feldtyp: "freies_feld",
        spielfeld: { laengeM: 25, breiteM: 20 },
        anzahlKinder: { min: 6, max: 10 },
        material: {
          liste: [
            { art: "fussball", menge: 6 },
            { art: "pylone", farbe: "rot", menge: 4 },
          ],
          ergaenzung: ["Pfeife"],
        },
      }),
    );
    const { data } = await admin
      .from("exercises")
      .select(
        "name, trainingsteil, hauptteilkategorie, kategorien, methodischer_fahrplan, aufbau, varianten_text, " +
          "erscheinungsform, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, anzahl_kinder, material_liste, " +
          "material, uebungstyp, bild_url, diagramm, bild_quelle, material_basis",
      )
      .eq("id", u.id)
      .single();
    assert.deepEqual(data, {
      name: "KI-Probe Voll",
      trainingsteil: "hauptteil",
      hauptteilkategorie: "fussball-spielen-lernen",
      kategorien: ["G", "F"],
      methodischer_fahrplan: { offen_starten: "Offen", ueben: ["- links", "- rechts"], wetteifern: "Wett" },
      aufbau: null,
      varianten_text: "Mit zwei Bällen",
      erscheinungsform: ["mutig-tore-erzielen"],
      feldtyp: "freies_feld",
      spielfeld_laenge_m: 25,
      spielfeld_breite_m: 20,
      anzahl_kinder: { min: 6, max: 10 },
      // In der Normalform: Katalogreihenfolge, Farbe bei färbbarem Material.
      material_liste: [
        { art: "pylone", farbe: "rot", menge: 4 },
        { art: "fussball", farbe: null, menge: 6 },
      ],
      material: ["Pfeife"],
      uebungstyp: null,
      bild_url: null,
      diagramm: null,
      bild_quelle: null,
      material_basis: null,
    });
  });

  await pruefe("Übung anlegen: abgelehnt nennt jeden Verstoss einzeln und legt nichts an (AK 5/6, PC 4)", async () => {
    const vorher = await uebungenVon(a.id);
    const r = await legeUebungAn(a.supabase, a.id, {
      altersstufe: "kinderfussball",
      name: " ",
      einordnung: "auffangen",
      kategorien: ["F", "D"],
      hauptteilkategorie: "fussball-spielen",
      offenStarten: "x",
      erscheinungsformen: ["mutig-tore-erzielen"],
      uebungstyp: "spielform",
      anzahlKinder: { min: 1.5 },
    });
    fehler(
      r,
      "regel",
      "Die Übung entspricht den Regeln nicht. Korrigiere die unter «verstoesse» genannten Angaben und sende sie noch einmal.",
    );
    assert.ok(!r.ok);
    assert.equal(r.hinweis, NICHTS_ANGELEGT);
    assert.deepEqual(r.verstoesse?.map((v) => v.feld), [
      "name",
      "kategorien",
      "aufbau",
      "anzahl_kinder.min",
      "hauptteilkategorie",
      "offen_starten",
      "erscheinungsformen",
      "uebungstyp",
    ]);
    assert.deepEqual(r.verstoesse?.[1], {
      feld: "kategorien",
      meldung: "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung. Nicht zulässig: D.",
      zulaessig: ["G", "F", "E"],
    });
    assert.deepEqual(r.verstoesse?.[4], {
      feld: "hauptteilkategorie",
      meldung: "Eine Hauptteilkategorie gibt es nur im Kinderfussball-Hauptteil.",
    });
    // Im Kinderfussball gibt es gar keinen Übungstyp — nicht der Junioren-Text.
    assert.equal(r.verstoesse?.[7].meldung, "Den Übungstyp gibt es nur im Juniorenfussball — lass «uebungstyp» weg.");
    assert.equal(await uebungenVon(a.id), vorher, "nichts angelegt");
  });

  await pruefe("Übung anlegen Juniorenfussball: jede Angabe landet in der Zeile (#147 AK 2, PC 1)", async () => {
    const u = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "juniorenfussball",
        name: "KI-Probe Junioren",
        einordnung: "jun-spielformen",
        kategorien: ["D", "C"],
        aufbau: "Zwei gegen zwei auf Minitore",
        varianten: "Mit Joker",
        erscheinungsformen: ["offensive-zweikaempfe-bestreiten"],
        uebungstyp: "spielform",
        spielfeld: { laengeM: 25, breiteM: 20 },
        anzahlKinder: { min: 8, max: 12 },
        material: {
          liste: [
            { art: "leibchen", farbe: "blau", menge: 4 },
            { art: "minitor", menge: 4 },
          ],
          ergaenzung: ["Pfeife"],
        },
      }),
    );
    const { data } = await admin
      .from("exercises")
      .select(
        "altersstufe, trainingsteil, hauptteilkategorie, kategorien, methodischer_fahrplan, aufbau, " +
          "varianten_text, erscheinungsform, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, anzahl_kinder, " +
          "material_liste, material, uebungstyp, visibility, owner_id",
      )
      .eq("id", u.id)
      .single();
    assert.deepEqual(data, {
      altersstufe: "juniorenfussball",
      trainingsteil: "jun-spielformen",
      hauptteilkategorie: null,
      kategorien: ["D", "C"],
      methodischer_fahrplan: null,
      aufbau: "Zwei gegen zwei auf Minitore",
      varianten_text: "Mit Joker",
      erscheinungsform: ["offensive-zweikaempfe-bestreiten"],
      feldtyp: null,
      spielfeld_laenge_m: 25,
      spielfeld_breite_m: 20,
      anzahl_kinder: { min: 8, max: 12 },
      material_liste: [
        { art: "minitor", farbe: null, menge: 4 },
        { art: "leibchen", farbe: "blau", menge: 4 },
      ],
      material: ["Pfeife"],
      uebungstyp: "spielform",
      visibility: "private",
      owner_id: a.id,
    });
  });

  await pruefe("Übung anlegen: Angaben der anderen Altersstufe werden genannt, fremde Einordnung ohne Folgefehler (#147 AK 4)", async () => {
    const vorher = await uebungenVon(a.id);
    const j = await legeUebungAn(a.supabase, a.id, {
      altersstufe: "juniorenfussball",
      name: "x",
      einordnung: "jun-abschluss",
      kategorien: ["D", "F"],
      aufbau: "x",
      hauptteilkategorie: "fussball-spielen",
      offenStarten: "y",
      feldtyp: "kleinfeld",
      uebungstyp: "spielform",
    });
    fehler(j, "regel");
    assert.ok(!j.ok);
    assert.equal(j.hinweis, NICHTS_ANGELEGT);
    assert.deepEqual(j.verstoesse?.map((v) => v.feld), ["kategorien", "hauptteilkategorie", "offen_starten", "feldtyp", "uebungstyp"]);
    // Im Juniorenfussball nennt die Meldung die Blöcke, die einen Übungstyp tragen.
    assert.ok(j.verstoesse?.[4].meldung.startsWith("Der Übungstyp ist eine Angabe des Manuals Fussball Jugendliche"));
    const kinderEinordnung = await legeUebungAn(a.supabase, a.id, {
      altersstufe: "juniorenfussball",
      name: "x",
      einordnung: "einleitung",
      kategorien: ["D"],
      offenStarten: "y",
    });
    assert.ok(!kinderEinordnung.ok);
    assert.deepEqual(kinderEinordnung.verstoesse, [
      {
        feld: "einordnung",
        meldung: '„einleitung" ist keine Einordnung der Altersstufe Juniorenfussball.',
        zulaessig: [
          "jun-auffangen",
          "jun-aufwaermen",
          "jun-spielform-trainingsziel",
          "jun-explosivitaet",
          "jun-spielformen",
          "jun-spiel",
          "jun-abschluss",
        ],
      },
    ]);
    const e = await legeUebungAn(a.supabase, a.id, {
      altersstufe: "kinderfussball",
      name: "x",
      einordnung: "jun-spiel",
      kategorien: ["F"],
      aufbau: "x",
      offenStarten: "y",
    });
    fehler(e, "regel");
    assert.ok(!e.ok);
    assert.deepEqual(e.verstoesse, [
      {
        feld: "einordnung",
        meldung: '„jun-spiel" ist keine Einordnung der Altersstufe Kinderfussball.',
        zulaessig: ["auffangen", "einleitung", "hauptteil", "ausklang"],
      },
    ]);
    assert.equal(await uebungenVon(a.id), vorher, "nichts angelegt");
  });

  // ── Übung ändern und öffentlich schalten (#144) ──────────────────────────
  const UNVERAENDERT = "Die Übung ist unverändert.";
  const FREMDE_UEBUNG =
    "Diese Übung stammt aus dem Kifu-Manual oder gehört jemand anderem. Du kannst sie ansehen und " +
    "in deinen Bestand kopieren, aber nicht ändern.";
  const NICHT_SICHTBAR = "Diese Übung gibt es nicht oder sie ist für dein Konto nicht sichtbar.";
  const UEBUNG_SPALTEN =
    "slug, name, trainingsteil, hauptteilkategorie, kategorien, methodischer_fahrplan, aufbau, " +
    "varianten_text, erscheinungsform, feldtyp, spielfeld_laenge_m, spielfeld_breite_m, anzahl_kinder, " +
    "material_liste, material, visibility, updated_at";
  /** Die Zeile ohne den Zeitstempel, den jeder Update neu setzt. */
  const ohneZeit = ({ updated_at: _z, ...rest }: Record<string, unknown>) => rest;
  const uebungszeile = async (id: string) => {
    const { data, error } = await admin.from("exercises").select(UEBUNG_SPALTEN).eq("id", id).single<Record<string, unknown>>();
    if (error) throw error;
    return data;
  };
  const probe = wert(
    await legeUebungAn(a.supabase, a.id, {
      altersstufe: "kinderfussball",
      name: "KI-Probe Ändern",
      einordnung: "einleitung",
      kategorien: ["F"],
      offenStarten: "Offen",
      ueben: "Üben",
      wetteifern: "Wett",
      varianten: "Mit zwei Bällen",
      erscheinungsformen: ["mutig-tore-erzielen"],
      material: { liste: [{ art: "pylone", farbe: "rot", menge: 4 }], ergaenzung: ["Pfeife"] },
    }),
  );

  await pruefe("Übung ändern: nur das Genannte, null leert, material je Teil, Slug bleibt (AK 1)", async () => {
    const vorher = await uebungszeile(probe.id);
    const r = wert(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: { name: "KI-Probe Neu" } }));
    assert.deepEqual(r, { id: probe.id, slug: probe.slug, sichtbarkeit: "entwurf" });
    assert.deepEqual(
      ohneZeit(await uebungszeile(probe.id)),
      { ...ohneZeit(vorher), name: "KI-Probe Neu" },
      "nur der Name ändert sich, auch nicht der Slug",
    );

    wert(await aendereUebung(a.supabase, a.id, { kennung: probe.slug, aenderung: { varianten: null, material: { ergaenzung: [] } } }));
    const danach = await uebungszeile(probe.id);
    assert.equal(danach.varianten_text, null);
    assert.deepEqual(danach.material, []);
    assert.deepEqual(danach.material_liste, [{ art: "pylone", farbe: "rot", menge: 4 }], "die gezählte Liste bleibt");

    // Leer oder nur die gleiche Altersstufe: nichts zu ändern bzw. nichts geändert.
    fehler(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: {} }), "eingabe", "Nenne mindestens eine Angabe, die sich ändern soll.");
    wert(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: {}, altersstufe: "kinderfussball" }));
    assert.deepEqual(await uebungszeile(probe.id), danach, "kein Schreiben, auch updated_at bleibt");
  });

  await pruefe("Übung ändern: jsonb in anderer Schlüsselfolge gilt als gleich — geschrieben wird nur Geändertes", async () => {
    // jsonb gibt Schlüssel in eigener Folge zurück ({max, min}, {ueben,
    // wetteifern, offen_starten}); das darf nicht als Änderung zählen.
    const zweite = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name: "KI-Probe Zwei",
        einordnung: "hauptteil",
        hauptteilkategorie: "vielseitigkeit-erleben",
        kategorien: ["E"],
        offenStarten: "Offen",
        ueben: ["- links", "- rechts"],
        wetteifern: "Wett",
        feldtyp: "freies_feld",
        spielfeld: { laengeM: 30, breiteM: 20 },
        anzahlKinder: { min: 6, max: 8 },
        material: { liste: [{ art: "teller", menge: 8 }] },
      }),
    );
    const vorher = await uebungszeile(zweite.id);
    wert(await aendereUebung(a.supabase, a.id, { kennung: zweite.id, aenderung: {}, altersstufe: "kinderfussball" }));
    assert.deepEqual(await uebungszeile(zweite.id), vorher, "nur die gleiche Altersstufe: nichts geschrieben, updated_at bleibt");
    wert(await aendereUebung(a.supabase, a.id, { kennung: zweite.id, aenderung: { name: "KI-Probe Zwei neu" } }));
    const danach = await uebungszeile(zweite.id);
    assert.deepEqual(ohneZeit(danach), { ...ohneZeit(vorher), name: "KI-Probe Zwei neu" });
    assert.notEqual(danach.updated_at, vorher.updated_at, "der Name wurde geschrieben");
  });

  await pruefe("Übung ändern: neue Einordnung nennt Altwerte und lässt die Übung sonst unverändert (AK 5, PC 2)", async () => {
    const vorher = await uebungszeile(probe.id);
    const r = await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: { einordnung: "ausklang" } });
    fehler(r, "regel");
    assert.ok(!r.ok);
    assert.equal(r.hinweis, UNVERAENDERT);
    assert.deepEqual(r.verstoesse?.map((v) => v.feld), ["aufbau", "offen_starten", "ueben", "wetteifern", "erscheinungsformen"]);
    assert.ok(r.verstoesse?.[1].meldung.endsWith("setze «offen_starten» auf null, um sie zu entfernen."));
    assert.deepEqual(await uebungszeile(probe.id), vorher, "die Übung ist unverändert");

    // Die Altersstufe wechselt nie — der Verstoss reist mit den übrigen.
    const stufe = await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: { name: " " }, altersstufe: "juniorenfussball" });
    assert.ok(!stufe.ok);
    assert.deepEqual(stufe.verstoesse?.map((v) => v.feld), ["altersstufe", "name"]);
    assert.deepEqual(stufe.verstoesse?.[0].zulaessig, ["kinderfussball"]);

    wert(
      await aendereUebung(a.supabase, a.id, {
        kennung: probe.id,
        aenderung: { einordnung: "ausklang", offenStarten: null, ueben: null, wetteifern: null, erscheinungsformen: null, aufbau: "Auslaufen" },
      }),
    );
    const danach = await uebungszeile(probe.id);
    assert.equal(danach.trainingsteil, "ausklang");
    assert.equal(danach.methodischer_fahrplan, null);
    assert.equal(danach.aufbau, "Auslaufen");
    assert.deepEqual(danach.erscheinungsform, []);
  });

  await pruefe("Übung ändern: nur eigene; Manual, fremde und unsichtbare abgewiesen (AK 4, OoS 2/3)", async () => {
    const manual = await vorlage("einleitung");
    const f = fehler(await aendereUebung(a.supabase, a.id, { kennung: manual, aenderung: { name: "x" } }), "keine_rechte", FREMDE_UEBUNG);
    assert.equal(f.fremd, true);
    // Private Übung von a: für b unsichtbar; öffentlich: sichtbar, aber fremd.
    fehler(await aendereUebung(b.supabase, b.id, { kennung: probe.id, aenderung: { name: "x" } }), "nicht_gefunden", NICHT_SICHTBAR);
    fehler(await aendereUebung(a.supabase, a.id, { kennung: randomUUID(), aenderung: { name: "x" } }), "nicht_gefunden", NICHT_SICHTBAR);
    fehler(await aendereUebung(a.supabase, a.id, { kennung: "gibt-es-nicht-000000", aenderung: { name: "x" } }), "nicht_gefunden", NICHT_SICHTBAR);
    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: probe.id }));
    const fremd = fehler(await aendereUebung(b.supabase, b.id, { kennung: probe.slug, aenderung: { name: "x" } }), "keine_rechte", FREMDE_UEBUNG);
    assert.equal(fremd.fremd, true);
    // Auch am Loader vorbei schützt die RLS (`ex_update`): Konto b schreibt die
    // öffentliche Übung von a, trifft keine Zeile, und die Übung bleibt.
    fehler(
      await aktualisiereZeile(b.supabase, "exercises", probe.id, { name: "x" }, UEBUNG_ZEILE),
      "nicht_gefunden",
      NICHT_SICHTBAR,
    );
    assert.equal((await uebungszeile(probe.id)).name, "KI-Probe Neu");
    wert(await setzeUebungAufEntwurf(a.supabase, a.id, { kennung: probe.id }));

  });

  await pruefe("Übung ändern Juniorenfussball: ändern, zurücklesen, Altwerte nennen; die Altersstufe wechselt nie (#147 AK 3, OoS 1)", async () => {
    const j = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "juniorenfussball",
        name: "KI-Probe Junioren ändern",
        einordnung: "jun-spiel",
        kategorien: ["C"],
        aufbau: "Spiel 7 gegen 7",
        uebungstyp: "basisspielform",
        spielfeld: { laengeM: 50, breiteM: 35 },
      }),
    );
    wert(
      await aendereUebung(a.supabase, a.id, {
        kennung: j.slug,
        altersstufe: "juniorenfussball",
        aenderung: {
          kategorien: ["C", "B"],
          erscheinungsformen: ["schnell-umschalten"],
          spielfeld: { laengeM: 60, breiteM: 40 },
          anzahlKinder: { min: 14 },
          varianten: "Mit Torhütern",
          material: { ergaenzung: ["Leibchen in zwei Farben"] },
        },
      }),
    );
    const zeile = await uebungszeile(j.id);
    assert.deepEqual(
      [zeile.kategorien, zeile.erscheinungsform, zeile.spielfeld_laenge_m, zeile.spielfeld_breite_m, zeile.anzahl_kinder, zeile.varianten_text, zeile.material],
      [["C", "B"], ["schnell-umschalten"], 60, 40, { min: 14, max: null }, "Mit Torhütern", ["Leibchen in zwei Farben"]],
    );
    assert.equal(zeile.aufbau, "Spiel 7 gegen 7");

    // Ein Block ohne Übungstyp: der gespeicherte wird genannt, im Wortlaut der Datenebene.
    const abschluss = await aendereUebung(a.supabase, a.id, { kennung: j.id, aenderung: { einordnung: "jun-abschluss" } });
    assert.ok(!abschluss.ok);
    assert.deepEqual(abschluss.verstoesse?.map((v) => v.feld), ["uebungstyp"]);
    assert.ok(abschluss.verstoesse?.[0].meldung.startsWith("Der Übungstyp ist eine Angabe des Manuals Fussball Jugendliche"));
    assert.deepEqual(await uebungszeile(j.id), zeile, "die Übung ist unverändert");
    wert(await aendereUebung(a.supabase, a.id, { kennung: j.id, aenderung: { einordnung: "jun-abschluss", uebungstyp: null } }));
    assert.equal((await uebungszeile(j.id)).trainingsteil, "jun-abschluss");

    // Die Altersstufe wechselt nie — auch nicht in den Kinderfussball.
    const stufe = await aendereUebung(a.supabase, a.id, { kennung: j.id, aenderung: { name: "x" }, altersstufe: "kinderfussball" });
    assert.ok(!stufe.ok);
    assert.deepEqual(stufe.verstoesse?.map((v) => v.feld), ["altersstufe"]);
    assert.deepEqual(stufe.verstoesse?.[0].zulaessig, ["juniorenfussball"]);
    assert.equal((await uebungszeile(j.id)).name, "KI-Probe Junioren ändern");

    // Die Sichtbarkeit hängt an keiner Altersstufe.
    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: j.id }));
    wert(await setzeUebungAufEntwurf(a.supabase, a.id, { kennung: j.id }));
  });

  await pruefe("Übung ändern: die Fassung in einem Training bleibt unberührt (OoS 3)", async () => {
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Fassung-Probe", altersstufe: "kinderfussball", stufen: ["F"] })).id;
    const f = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tr, einordnung: "ausklang", exerciseId: probe.id }));
    wert(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: { name: "KI-Probe Umbenannt", aufbau: "Neu" } }));
    const { data } = await admin.from("training_exercises").select("name, aufbau").eq("id", f.fassungId).single();
    assert.deepEqual(data, { name: "KI-Probe Neu", aufbau: "Auslaufen" });
  });

  await pruefe("Sichtbarkeit: öffentlich für alle mit Tragweite, zurückgezogen wieder privat, idempotent (AK 2/3, PC 3)", async () => {
    const pub = wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: probe.slug }));
    assert.deepEqual(pub, { id: probe.id, slug: probe.slug, sichtbarkeit: "oeffentlich", tragweite: TRAGWEITE_UEBUNG_VEROEFFENTLICHEN });
    assert.equal(
      TRAGWEITE_UEBUNG_VEROEFFENTLICHEN,
      "Die Übung wird für alle sichtbar — mit allen Angaben, Bild und Feld-Diagramm — und trägt die " +
        "Plakette «Community». Einen Trainernamen zeigt KiFu bei Übungen nicht.",
    );
    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: probe.id }));
    const sieht = async () => (await b.supabase.from("exercises").select("id").eq("id", probe.id).maybeSingle()).data;
    assert.ok(await sieht(), "ein anderes Konto sieht die öffentliche Übung");
    fehler(await veroeffentlicheUebung(b.supabase, b.id, { kennung: probe.id }), "keine_rechte", FREMDE_UEBUNG);
    fehler(await setzeUebungAufEntwurf(b.supabase, b.id, { kennung: probe.id }), "keine_rechte", FREMDE_UEBUNG);
    fehler(await veroeffentlicheUebung(a.supabase, a.id, { kennung: await vorlage("einleitung") }), "keine_rechte", FREMDE_UEBUNG);

    assert.deepEqual(wert(await setzeUebungAufEntwurf(a.supabase, a.id, { kennung: probe.id })), {
      id: probe.id,
      slug: probe.slug,
      sichtbarkeit: "entwurf",
    });
    wert(await setzeUebungAufEntwurf(a.supabase, a.id, { kennung: probe.id }));
    assert.equal(await sieht(), null, "zurückgezogen sieht es nur noch das eigene Konto");
    fehler(await setzeUebungAufEntwurf(b.supabase, b.id, { kennung: probe.id }), "nicht_gefunden", NICHT_SICHTBAR);
    fehler(await veroeffentlicheUebung(a.supabase, a.id, { kennung: randomUUID() }), "nicht_gefunden", NICHT_SICHTBAR);
  });

  // ── Feld-Diagramm setzen (#145) ──────────────────────────────────────────
  /** Ein kleines Spielfeld: zwei Teams (ergibt Leibchen), drei Pylonen, ein Tor. */
  const FELD = {
    elemente: [
      { id: "feld", art: "form", form: "rechteck", x: 200, y: 150, breite: 1200, hoehe: 700 },
      { id: "tor", art: "symbol", typ: "tor", x: 800, y: 150, rotation: 0 },
      { id: "rot-1", art: "symbol", typ: "spieler", x: 600, y: 500, farbe: "rot" },
      { id: "blau-1", art: "symbol", typ: "spieler", x: 1000, y: 500, farbe: "blau" },
      ...[400, 800, 1200].map((x, i) => ({ id: `py-${i}`, art: "symbol", typ: "pylone", x, y: 780, farbe: "gelb" })),
    ],
  };
  const ZWEI_BAELLE = {
    version: 1,
    elemente: [
      { id: "b1", art: "symbol", typ: "fussball", x: 700, y: 500 },
      { id: "b2", art: "symbol", typ: "fussball", x: 900, y: 500 },
    ],
  };
  const vorschlag = (d: unknown) => materialVorschlag(pruefeDiagramm(d).daten);
  const DIAGRAMM_SPALTEN = "diagramm, bild_quelle, bild_url, material_liste, material_basis, material, updated_at";
  const diagrammzeile = async (id: string) => {
    const { data, error } = await admin.from("exercises").select(DIAGRAMM_SPALTEN).eq("id", id).single<Record<string, unknown>>();
    if (error) throw error;
    return data;
  };
  const kinderUebung = async (name: string) =>
    wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name,
        einordnung: "einleitung",
        kategorien: ["F"],
        offenStarten: "Offen",
        ueben: "Üben",
        wetteifern: "Wett",
        material: { liste: [{ art: "pylone", farbe: "rot", menge: 4 }], ergaenzung: ["Pfeife"] },
      }),
    );

  await pruefe("Diagramm setzen: eigene Kinder- und Junioren-Übung, Bild, Liste = Basis = Vorschlag, Ergänzung bleibt; Ersetzen (AK 2/3, PC 1–6)", async () => {
    const u = await kinderUebung("KI-Probe Diagramm");
    const r = wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.slug, diagramm: FELD }));
    assert.deepEqual(r, {
      id: u.id,
      slug: u.slug,
      name: "KI-Probe Diagramm",
      anzahlElemente: FELD.elemente.length,
      angezeigtesBild: "diagramm",
      material: { liste: vorschlag(FELD), ergaenzung: ["Pfeife"] },
      maengel: [],
    });
    const z = await diagrammzeile(u.id);
    assert.equal((z.diagramm as { elemente: unknown[] }).elemente.length, FELD.elemente.length);
    assert.equal((z.diagramm as { version: number }).version, 1);
    assert.equal(z.bild_quelle, "diagramm");
    // Die handgepflegte Liste (4 rote Pylonen) ist durch die gezählte ersetzt.
    assert.deepEqual(z.material_liste, vorschlag(FELD));
    assert.deepEqual(z.material_basis, vorschlag(FELD));
    assert.deepEqual(z.material, ["Pfeife"]);

    const ersetzt = wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: ZWEI_BAELLE }));
    assert.equal(ersetzt.anzahlElemente, 2);
    const z2 = await diagrammzeile(u.id);
    assert.deepEqual((z2.diagramm as { elemente: { id: string }[] }).elemente.map((e) => e.id), ["b1", "b2"]);
    assert.deepEqual(z2.material_liste, [{ art: "fussball", farbe: null, menge: 2 }]);
    assert.deepEqual(z2.material_basis, z2.material_liste);

    const { data: jun, error } = await admin
      .from("exercises")
      .insert({
        slug: `kern-db-jun-dia-${randomBytes(4).toString("hex")}`,
        name: "Kern-DB Junioren Diagramm",
        altersstufe: "juniorenfussball",
        trainingsteil: "jun-spiel",
        kategorien: ["D"],
        aufbau: "Im Wechsel",
        owner_id: a.id,
        visibility: "private",
      })
      .select("id")
      .single();
    if (error) throw error;
    assert.equal(wert(await setzeDiagramm(a.supabase, a.id, { kennung: jun.id, diagramm: FELD })).angezeigtesBild, "diagramm");
    assert.equal((await diagrammzeile(jun.id)).bild_quelle, "diagramm");
  });

  await pruefe("Diagramm setzen: ein vorhandenes Foto bleibt das angezeigte Bild (PC 3)", async () => {
    const u = await kinderUebung("KI-Probe Foto");
    const { error } = await admin.from("exercises").update({ bild_url: "https://example.test/foto.webp", bild_quelle: null }).eq("id", u.id);
    if (error) throw error;
    assert.equal(wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: FELD })).angezeigtesBild, "foto");
    const z = await diagrammzeile(u.id);
    assert.equal(z.bild_quelle, "foto");
    assert.equal(z.bild_url, "https://example.test/foto.webp");
  });

  await pruefe("Diagramm setzen: Grenzen → eingabe mit jedem Element, leer abgelehnt, Übung unverändert (AK 4/6)", async () => {
    const u = await kinderUebung("KI-Probe Grenzen");
    wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: ZWEI_BAELLE }));
    const vorher = await diagrammzeile(u.id);
    const r = fehler(
      await setzeDiagramm(a.supabase, a.id, {
        kennung: u.id,
        diagramm: {
          elemente: [
            { id: "tw", art: "symbol", typ: "torhueter", x: 800, y: 500 },
            { id: "weit", art: "symbol", typ: "pylone", x: 1700, y: 500 },
            { id: "lila", art: "pfad", typ: "linie", punkte: [{ x: 1, y: 1 }, { x: 9, y: 9 }], farbe: "lila" },
          ],
        },
      }),
      "eingabe",
      "Das Diagramm wurde nicht gesetzt: 3 Angaben verletzen die Grenzen eines Feld-Diagramms. Jede " +
        "steht mit Element und Grund unter «verstoesse».",
    ) as { verstoesse?: { feld: string; meldung: string }[]; hinweis?: string };
    assert.deepEqual(r.verstoesse?.map((v) => v.feld), [
      "diagramm.elemente[0].typ",
      "diagramm.elemente[1]",
      "diagramm.elemente[2].farbe",
    ]);
    assert.match(r.verstoesse![0].meldung, /^Element «tw» \(elemente\[0\]\): Das Symbol «torhueter» gibt es nicht\.$/);
    assert.equal(r.hinweis, UNVERAENDERT);
    const leer = fehler(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: { elemente: [] } }), "eingabe") as {
      verstoesse?: { feld: string; meldung: string }[];
    };
    assert.deepEqual(leer.verstoesse, [{ feld: "diagramm", meldung: DIAGRAMM_LEER }]);
    assert.deepEqual(await diagrammzeile(u.id), vorher, "die Übung ist unverändert");
  });

  await pruefe("Diagramm setzen: nur eigene; Manual und fremd öffentlich → keine_rechte, privat fremd und unbekannt → nicht_gefunden", async () => {
    const u = await kinderUebung("KI-Probe Rechte");
    const manual = await vorlage("einleitung");
    assert.equal(fehler(await setzeDiagramm(a.supabase, a.id, { kennung: manual, diagramm: FELD }), "keine_rechte", FREMDE_UEBUNG).fremd, true);
    fehler(await setzeDiagramm(b.supabase, b.id, { kennung: u.id, diagramm: FELD }), "nicht_gefunden", NICHT_SICHTBAR);
    fehler(await setzeDiagramm(a.supabase, a.id, { kennung: randomUUID(), diagramm: FELD }), "nicht_gefunden", NICHT_SICHTBAR);
    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: u.id }));
    assert.equal(fehler(await setzeDiagramm(b.supabase, b.id, { kennung: u.slug, diagramm: FELD }), "keine_rechte", FREMDE_UEBUNG).fremd, true);
    assert.equal((await diagrammzeile(u.id)).diagramm, null, "das fremde Setzen hat nichts geschrieben");
  });

  await pruefe("Diagramm setzen: die Fassung in einem Training bleibt unberührt (#145, OoS #144)", async () => {
    const u = await kinderUebung("KI-Probe Fassung");
    wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: ZWEI_BAELLE }));
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Diagramm-Fassung", altersstufe: "kinderfussball", stufen: ["F"] })).id;
    const f = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tr, einordnung: "einleitung", exerciseId: u.id }));
    const fassung = async () =>
      (await admin.from("training_exercises").select("diagramm, material_liste").eq("id", f.fassungId).single()).data;
    const vorher = await fassung();
    wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: FELD }));
    assert.deepEqual(await fassung(), vorher);
  });

  await pruefe("Übung anlegen mit Diagramm: Bild, gezählte Liste, Ergänzung; Angaben und Diagramm in EINER Ablehnung (#145 AK 5/7, PC 7)", async () => {
    const angaben = {
      altersstufe: "kinderfussball",
      name: "KI-Probe Anlegen Diagramm",
      einordnung: "einleitung",
      kategorien: ["F"],
      offenStarten: "Offen",
      ueben: "Üben",
      wetteifern: "Wett",
      material: { ergaenzung: ["Pfeife"] },
    };
    const u = wert(await legeUebungAn(a.supabase, a.id, { ...angaben, diagramm: FELD }));
    assert.deepEqual(u.material, { liste: vorschlag(FELD), ergaenzung: ["Pfeife"] });
    assert.deepEqual(u.maengel, []);
    const z = await diagrammzeile(u.id);
    assert.equal(z.bild_quelle, "diagramm");
    assert.equal((z.diagramm as { elemente: unknown[] }).elemente.length, FELD.elemente.length);
    assert.deepEqual(z.material_liste, vorschlag(FELD));
    assert.deepEqual(z.material_basis, vorschlag(FELD));
    assert.deepEqual(z.material, ["Pfeife"]);
    // Ohne Diagramm bleibt die Antwort wie in #143.
    assert.equal("material" in wert(await legeUebungAn(a.supabase, a.id, angaben)), false);

    const vorher = await uebungenVon(a.id);
    const r = fehler(
      await legeUebungAn(a.supabase, a.id, {
        ...angaben,
        kategorien: [],
        material: { liste: [{ art: "pylone", farbe: "rot", menge: 4 }] },
        diagramm: { elemente: [{ id: "tw", art: "symbol", typ: "torhueter", x: 800, y: 500 }] },
      }),
      "regel",
    ) as { verstoesse?: { feld: string; meldung: string }[]; hinweis?: string };
    const felder = r.verstoesse?.map((v) => v.feld) ?? [];
    assert.ok(felder.includes("kategorien"), felder.join(", "));
    assert.ok(felder.includes("diagramm.elemente[0].typ"), felder.join(", "));
    assert.deepEqual(r.verstoesse?.find((v) => v.feld === "material.liste")?.meldung, MATERIAL_MIT_DIAGRAMM);
    assert.equal(r.hinweis, NICHTS_ANGELEGT);
    fehler(await legeUebungAn(a.supabase, a.id, { ...angaben, diagramm: { elemente: [] } }), "eingabe");
    assert.equal(await uebungenVon(a.id), vorher, "nichts angelegt");
  });

  // ── Mängel des Diagramms (#146) ──────────────────────────────────────────
  /** Ein Leibchen 60 Einheiten neben einer Figur, aber an keiner Hand. */
  const FREIES_LEIBCHEN = {
    elemente: [
      { id: "kind", art: "symbol", typ: "spieler", x: 600, y: 500 },
      { id: "tuch", art: "symbol", typ: "leibchen", x: 600, y: 560 },
    ],
  };

  await pruefe("Mängel: gespeichert UND gemeldet — beim Setzen, beim Anlegen und jederzeit abrufbar, gleich lautend (#146 AK 1–4, PC 1)", async () => {
    const u = await kinderUebung("KI-Probe Mängel");
    const r = wert(await setzeDiagramm(a.supabase, a.id, { kennung: u.id, diagramm: FREIES_LEIBCHEN }));
    assert.deepEqual(r.maengel.map((b) => `${b.code}:${b.element}:${b.index}`), ["leibchen:tuch:1"]);
    assert.match(r.maengel[0].meldung, /^Element «tuch» \(elemente\[1\]\): Das Leibchen liegt 60 Einheiten neben einer Figur/);
    const z = await diagrammzeile(u.id);
    assert.deepEqual((z.diagramm as { elemente: { id: string }[] }).elemente.map((e) => e.id), ["kind", "tuch"], "trotz Mangel gespeichert");

    const abgerufen = wert(await diagrammMaengel(a.supabase, a.id, { kennung: u.slug }));
    assert.deepEqual(abgerufen, { id: u.id, slug: u.slug, name: "KI-Probe Mängel", hatDiagramm: true, befunde: r.maengel });

    const neu = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name: "KI-Probe Mängel Anlegen",
        einordnung: "einleitung",
        kategorien: ["F"],
        offenStarten: "Offen",
        ueben: "Üben",
        wetteifern: "Wett",
        diagramm: FREIES_LEIBCHEN,
      }),
    );
    assert.deepEqual(neu.maengel?.map((b) => b.code), ["leibchen"], "auch beim Anlegen");
  });

  await pruefe("Mängel: auch am in KiFu gezeichneten Diagramm, samt Altbestand; ohne Diagramm leer (#146 AK 4)", async () => {
    const u = await kinderUebung("KI-Probe Mängel UI");
    const leer = wert(await diagrammMaengel(a.supabase, a.id, { kennung: u.id }));
    assert.deepEqual({ hat: leer.hatDiagramm, befunde: leer.befunde }, { hat: false, befunde: [] });
    // Wie aus der Maske gespeichert: ein Feld mit einem Tor, das vom Feld weg
    // öffnet — und ein älteres, unbekanntes Symbol, das heute eine Grenze wäre.
    const { error } = await admin
      .from("exercises")
      .update({
        diagramm: {
          version: 1,
          elemente: [
            { id: "feld", art: "form", form: "rechteck", x: 200, y: 150, breite: 1200, hoehe: 700 },
            { id: "tor", art: "symbol", typ: "tor", x: 800, y: 150, rotation: 180 },
            { id: "alt", art: "symbol", typ: "torhueter", x: 800, y: 500 },
          ],
        },
        bild_quelle: "diagramm",
      })
      .eq("id", u.id);
    if (error) throw error;
    const m = wert(await diagrammMaengel(a.supabase, a.id, { kennung: u.id }));
    assert.equal(m.hatDiagramm, true);
    assert.deepEqual(m.befunde.map((b) => `${b.art}:${b.code}:${b.element}`), ["grenze:unbekannt:alt", "mangel:tor_richtung:tor"]);
  });

  await pruefe("Mängel abrufen: nur eigene; Manual und fremd öffentlich → keine_rechte, privat fremd und unbekannt → nicht_gefunden", async () => {
    const u = await kinderUebung("KI-Probe Mängel Rechte");
    const manual = await vorlage("einleitung");
    assert.equal(fehler(await diagrammMaengel(a.supabase, a.id, { kennung: manual }), "keine_rechte", FREMDE_UEBUNG).fremd, true);
    fehler(await diagrammMaengel(b.supabase, b.id, { kennung: u.id }), "nicht_gefunden", NICHT_SICHTBAR);
    fehler(await diagrammMaengel(a.supabase, a.id, { kennung: randomUUID() }), "nicht_gefunden", NICHT_SICHTBAR);
    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: u.id }));
    assert.equal(fehler(await diagrammMaengel(b.supabase, b.id, { kennung: u.slug }), "keine_rechte", FREMDE_UEBUNG).fremd, true);
  });
  // ── Übung kopieren (#317) ────────────────────────────────────────────────
  const KOPIER_SPALTEN = [
    "name",
    "owner_id",
    "source",
    "visibility",
    "altersstufe",
    "trainingsteil",
    "hauptteilkategorie",
    "bild_url",
    "diagramm",
    ...FASSUNG_INHALT_FELDER,
  ];
  const kopierZeile = async (id: string) => {
    const { data, error } = await admin
      .from("exercises")
      .select([...new Set(KOPIER_SPALTEN)].join(", "))
      .eq("id", id)
      .single<Record<string, unknown>>();
    if (error) throw error;
    return data;
  };
  const bildOrdner = `user/${a.id}`;
  const bildUrl = (pfad: string) => `${URL_}/storage/v1/object/public/exercise-images/${pfad}`;
  const imBildOrdner = async () =>
    ((await admin.storage.from("exercise-images").list(bildOrdner, { limit: 100 })).data ?? [])
      .map((d) => `${bildOrdner}/${d.name}`)
      .sort();
  const kinderUebungFuerKopie = async (name: string) =>
    wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "kinderfussball",
        name,
        einordnung: "einleitung",
        kategorien: ["F"],
        offenStarten: "Offen",
        ueben: "Üben",
        wetteifern: "Wett",
      }),
    );

  await pruefe("Übung kopieren: Manual-Übung → privater Entwurf mit allen Angaben und Diagramm, Quelle unberührt (AK 1, PC 1/2/4)", async () => {
    const { data: m, error } = await admin
      .from("exercises")
      .select("id, slug")
      .eq("source", "manual")
      .not("diagramm", "is", null)
      .order("name")
      .limit(1)
      .single();
    if (error) throw error;
    const quelle = await kopierZeile(m.id);
    const k = wert(await kopiereUebungNach(a.supabase, a.id, { kennung: m.slug }));
    assert.deepEqual([k.name, k.sichtbarkeit], [quelle.name, "entwurf"], "eine Manual-Kopie behält den Namen");
    const kopie = await kopierZeile(k.id);
    assert.deepEqual([kopie.owner_id, kopie.source, kopie.visibility], [a.id, "user", "private"]);
    for (const f of ["altersstufe", "trainingsteil", "hauptteilkategorie", ...FASSUNG_INHALT_FELDER])
      assert.deepEqual(kopie[f], quelle[f], f);
    // Dasselbe Diagramm, aber entkoppelt: jede Element-ID neu.
    const elemente = (d: unknown) => (d as { elemente: { id: string }[] }).elemente;
    const ohneId = (d: unknown) => elemente(d).map(({ id: _id, ...rest }) => rest);
    assert.deepEqual(ohneId(kopie.diagramm), ohneId(quelle.diagramm));
    assert.ok(elemente(kopie.diagramm).every((e, i) => e.id !== elemente(quelle.diagramm)[i].id));
    assert.deepEqual(await kopierZeile(m.id), quelle, "die Quelle bleibt unberührt");
    assert.equal((await b.supabase.from("exercises").select("id").eq("id", k.id).maybeSingle()).data, null);
  });

  await pruefe("Übung kopieren: «(Kopie)» nur bei eigener Quelle, fremde behält den Namen, Junioren-Stufe bleibt (PC 2/3)", async () => {
    const eigen = wert(
      await legeUebungAn(a.supabase, a.id, {
        altersstufe: "juniorenfussball",
        name: "KI-Probe Kopierquelle",
        einordnung: "jun-spiel",
        kategorien: ["D"],
        aufbau: "Spiel",
      }),
    );
    const k1 = wert(await kopiereUebungNach(a.supabase, a.id, { kennung: eigen.id }));
    assert.equal(k1.name, "KI-Probe Kopierquelle (Kopie)");
    const k2 = wert(await kopiereUebungNach(a.supabase, a.id, { kennung: k1.slug }));
    assert.equal(k2.name, "KI-Probe Kopierquelle (Kopie) (Kopie)");
    assert.equal((await kopierZeile(k2.id)).altersstufe, "juniorenfussball");
    assert.notEqual(k1.id, k2.id);

    wert(await veroeffentlicheUebung(a.supabase, a.id, { kennung: eigen.id }));
    const fremd = wert(await kopiereUebungNach(b.supabase, b.id, { kennung: eigen.slug }));
    assert.equal(fremd.name, "KI-Probe Kopierquelle", "die Kopie einer fremden Übung behält den Namen");
    assert.deepEqual([(await kopierZeile(fremd.id)).owner_id, (await kopierZeile(fremd.id)).visibility], [b.id, "private"]);
    wert(await setzeUebungAufEntwurf(a.supabase, a.id, { kennung: eigen.id }));
  });

  await pruefe("Übung kopieren: unsichtbar, unbekannt und aus einem Training → nicht_gefunden, nichts entsteht (OoS 1)", async () => {
    const privat = await kinderUebungFuerKopie("KI-Probe privat");
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kopier-Probe", altersstufe: "kinderfussball", stufen: ["F"] })).id;
    const fassung = wert(await ordneUebungZu(a.supabase, a.id, { trainingId: tr, einordnung: "einleitung", exerciseId: ein }));
    const vorherA = await uebungenVon(a.id);
    const vorherB = await uebungenVon(b.id);
    for (const [konto, kennung] of [
      [b, privat.id],
      [a, randomUUID()],
      [a, "gibt-es-nicht-000000"],
      [a, fassung.fassungId],
    ] as const) {
      const r = await kopiereUebungNach(konto.supabase, konto.id, { kennung });
      fehler(r, "nicht_gefunden", UEBUNG_QUELLE_NICHT_VERFUEGBAR);
      assert.ok(!r.ok);
      assert.equal(r.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    }
    assert.deepEqual([await uebungenVon(a.id), await uebungenVon(b.id)], [vorherA, vorherB]);
  });

  await pruefe("Übung kopieren: eigene Bilddatei, Quelldatei bleibt; fehlende Datei → nichts entsteht (PC 2)", async () => {
    const mitBild = await kinderUebungFuerKopie("KI-Probe Bild");
    const pfad = `${bildOrdner}/${mitBild.id}.webp`;
    const { error: up } = await admin.storage
      .from("exercise-images")
      .upload(pfad, new Blob([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], { type: "image/webp" }), {
        contentType: "image/webp",
      });
    if (up) throw up;
    dateien.push(pfad);
    const { error: e1 } = await admin
      .from("exercises")
      .update({ bild_url: bildUrl(pfad), bild_quelle: "foto" })
      .eq("id", mitBild.id);
    if (e1) throw e1;
    const k = wert(await kopiereUebungNach(a.supabase, a.id, { kennung: mitBild.id }));
    const kopie = await kopierZeile(k.id);
    assert.equal(kopie.bild_url, bildUrl(`${bildOrdner}/${k.id}.webp`));
    assert.equal(kopie.bild_quelle, "foto");
    assert.ok((await imBildOrdner()).includes(pfad), "die Quelldatei bleibt");
    assert.ok((await imBildOrdner()).includes(`${bildOrdner}/${k.id}.webp`), "die Kopie hat ihre eigene Datei");

    const ohneDatei = await kinderUebungFuerKopie("KI-Probe Bild fehlt");
    const { error: e2 } = await admin
      .from("exercises")
      .update({ bild_url: bildUrl(`${bildOrdner}/fehlt-${randomUUID()}.webp`) })
      .eq("id", ohneDatei.id);
    if (e2) throw e2;
    const vorher = await uebungenVon(a.id);
    const dateienVorher = await imBildOrdner();
    const r = await kopiereUebungNach(a.supabase, a.id, { kennung: ohneDatei.id });
    fehler(r, "technisch", "Das Bild liess sich nicht kopieren. Bitte versuche es noch einmal.");
    assert.ok(!r.ok);
    assert.equal(r.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await uebungenVon(a.id), vorher, "keine neue Übung");
    assert.deepEqual(await imBildOrdner(), dateienVorher, "keine neue Datei");

    // Weist die Datenbank ab, kommt die Meldung übersetzt, und die schon
    // kopierte Datei fällt wieder weg: ein Client, dessen Insert scheitert.
    const kaputt = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "from")
          return (tabelle: string) => {
            const echt = ziel.from(tabelle);
            if (tabelle !== "exercises") return echt;
            return new Proxy(echt, {
              get(q, n) {
                if (n === "insert")
                  return () => ({
                    select: () => ({
                      single: async () => ({
                        data: null,
                        error: {
                          message: 'new row for relation "exercises" violates check constraint "ex_kategorien_je_altersstufe"',
                          code: "23514",
                        },
                      }),
                    }),
                  });
                const v = Reflect.get(q, n);
                return typeof v === "function" ? v.bind(q) : v;
              },
            });
          };
        return Reflect.get(ziel, name, empf);
      },
    });
    const uebersetzt = await kopiereUebungNach(kaputt, a.id, { kennung: mitBild.id });
    fehler(uebersetzt, "regel", "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung.");
    assert.ok(!uebersetzt.ok);
    assert.equal(uebersetzt.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await uebungenVon(a.id), vorher, "keine neue Übung");
    assert.deepEqual(await imBildOrdner(), dateienVorher, "die schon kopierte Datei ist wieder entfernt");
  });

  await pruefe("Übung kopieren: Diagramm-Altbestand bleibt im Editor speicherbar, leeres Diagramm nicht als Bild", async () => {
    // Ein Element, das die Zeichenfläche nicht kennt: für den Bestand
    // lesbar (nachsichtig), für neue Diagramme eine Grenze.
    const alt = await kinderUebungFuerKopie("KI-Probe Altbestand");
    const { error } = await admin
      .from("exercises")
      .update({
        diagramm: { version: 1, elemente: [{ id: "alt-1", art: "symbol", typ: "gibt-es-nicht", x: 400, y: 300 }] },
        bild_quelle: "diagramm",
      })
      .eq("id", alt.id);
    if (error) throw error;
    const k = wert(await kopiereUebungNach(a.supabase, a.id, { kennung: alt.id }));
    const gespeichert = (await kopierZeile(k.id)).diagramm;
    assert.equal(pruefeDiagramm(gespeichert).grenzen.length, 1, "die Kopie trägt den Altbestand mit");
    // Die Maske schickt das gespeicherte Diagramm unverändert zurück …
    const form = new FormData();
    form.set("diagramm", JSON.stringify(parseDiagramm(gespeichert)));
    assert.notEqual(diagrammAusFormular(form, gespeichert), "ungueltig", "die Kopie lässt sich speichern");
    // … ein geändertes mit demselben Element weist sie ab.
    const geaendert = parseDiagramm(gespeichert)!;
    form.set("diagramm", JSON.stringify({ ...geaendert, elemente: [{ ...geaendert.elemente[0], x: 500 }] }));
    assert.equal(diagrammAusFormular(form, gespeichert), "ungueltig");

    // Ein leeres Diagramm fällt beim Kopieren weg — dann zeigt die Kopie
    // auch nicht «Diagramm» als Bild.
    const leer = await kinderUebungFuerKopie("KI-Probe leeres Diagramm");
    const { error: e2 } = await admin
      .from("exercises")
      .update({ diagramm: { version: 1, elemente: [] }, bild_quelle: "diagramm" })
      .eq("id", leer.id);
    if (e2) throw e2;
    const kl = await kopierZeile(wert(await kopiereUebungNach(a.supabase, a.id, { kennung: leer.id })).id);
    assert.deepEqual([kl.diagramm, kl.bild_quelle], [null, null]);
  });
} finally {
  await aufraeumen();
}

console.log(`\n${gelaufen} Prüfungen bestanden (Wegwerf-Konten entfernt).`);
