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
const { legeTerminFest, aendereTermin, entferneTermin, ordneTrainingZu, loeseTraining, kalenderFehler, lasseAusfallen, nimmAusfallZurueck } = await import(
  "../lib/kern/termine"
);
const { TERMIN_MELDUNG, TERMIN_TEXT } = await import("../lib/termin");
const { FELDER_TEXT, felderProblem } = await import("../lib/termin-felder");
type Feld = import("../lib/termin-felder").Feld;
type Felder = import("../lib/termin-felder").Felder;
const { felderAusgabe } = await import("../lib/termin-felder-ausgabe");
const { MASS_TEXT } = await import("../lib/feldmass");
const { ausDbFehler } = await import("../lib/kern/ergebnis");
const { ZEITRAUM_TEXT } = await import("../lib/monat");
const { SERIE_MELDUNG, SERIE_TEXT, plusTage, vergangeneBestaetigen, wochentagVon } = await import("../lib/serie");
const { kalendertagAmTrainingsort } = await import("../lib/zeit");
const { legeSerieFest, aendereSerie, entferneSerie, folgeDerSerie, aendereMitReichweite, entferneMitReichweite } =
  await import("../lib/kern/serien");
const { meineTeams, teamPlan } = await import("../lib/kern/team");
const { getTeamPlanFuer } = await import("../lib/queries/termine-fuer");
const { getTeamTrainingsFuer } = await import("../lib/queries/trainings-fuer");
const { AendernEingabe: TerminAendernEingabe } = await import("../lib/mcp/werkzeuge/team");
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
  assert.ok(data, `keine Manual-Übung für ${trainingsteil}/${hkat} - lief der Seed?`);
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
      /^Die Reihenfolge muss genau die Übungen dieses Abschnitts nennen - jede einmal\. Lies das Training neu und sende die vollständige Folge\. Es fehlen: „/,
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
      /^Die Reihenfolge muss genau die Varianten dieses Trainings nennen - jede einmal\. Lies das Training neu und sende die vollständige Folge\. Es fehlen: „/,
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
    assert.equal(f.hinweis, "Es ist keine Kopie entstanden - der Versuch lässt sich gefahrlos wiederholen.");
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
      terminBleibt: null,
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

  // ── Kalender: Fehler der RPCs einordnen (#324, #326) — ohne Datenbankzugriff,
  //    liegt hier, weil kalenderFehler server-only ist (check:kern lädt es nicht).
  await pruefe("Kalender: Serien-Konflikte, Team nicht gefunden, Serien-Regeln", async () => {
    const konflikt = kalenderFehler({ message: "SERIE_BELEGUNG_GEAENDERT" }, true);
    assert.equal(konflikt.art, "konflikt");
    assert.equal(konflikt.meldung, SERIE_MELDUNG.SERIE_BELEGUNG_GEAENDERT);
    assert.equal(konflikt.wiederholbar, true);
    assert.equal(kalenderFehler({ message: "SERIE_GEAENDERT" }).meldung, SERIE_MELDUNG.SERIE_GEAENDERT);
    const team = kalenderFehler({ message: "TEAM_NICHT_GEFUNDEN" });
    assert.equal(team.art, "nicht_gefunden");
    assert.equal(team.feld, "team_id");
    assert.equal(team.meldung, "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.");
    const regel = kalenderFehler({ message: "SERIE_ZU_LANG" });
    assert.equal(regel.art, "regel");
    assert.equal(regel.meldung, SERIE_TEXT.zuLang);
    assert.equal(kalenderFehler({ message: "SERIE_OHNE_ZEITRAUM" }).meldung, "Bitte ein Datum angeben.");
  });

  // ── Kalender: Termin ohne Training (#322) ───────────────────────────────
  await pruefe("Kalender: festlegen, ändern, entfernen, Bestand, Löschen, fremd", async () => {
    const TEAM_FREMD = "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.";
    const { data: team, error } = await admin.from("teams").insert({ name: "Kern-DB-Kalender" }).select("id").single();
    if (error) throw error;
    teams.push(team.id);
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team.id, user_id: a.id });
    if (e2) throw e2;
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const zeile = async (id: string) =>
      (await admin.from("training_termine").select("datum, beginn, ende, ort, bemerkung, training_id").eq("id", id).single()).data;

    // AK 1, 2, 4: ohne Training, auch vergangen; Beginn und Ende Pflicht.
    fehler(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "" }), "eingabe", TERMIN_TEXT.zeitPflicht);
    fehler(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "18:00" }), "eingabe", TERMIN_TEXT.endeNachBeginn);
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "20:00", ort: " Allmend " }));
    const t0 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-3), beginn: "10:00", ende: "11:30" }));
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ende: "20:00:00", ort: "Allmend", bemerkung: null, training_id: null });
    // AK 22: nur Mitglieder.
    fehler(await legeTerminFest(b.supabase, b.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "20:00" }), "nicht_gefunden", TEAM_FREMD);

    // PO 17: geschrieben wird nur, was übergeben wurde — eine gleichzeitige
    // Änderung eines anderen Feldes bleibt stehen. Der Client protokolliert
    // die Update-Nutzlast.
    await admin.from("training_termine").update({ bemerkung: "X" }).eq("id", t1.terminId);
    const spur: string[][] = [];
    const mitSpur = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "from")
          return (tabelle: string) => {
            const q = ziel.from(tabelle);
            return tabelle !== "training_termine"
              ? q
              : new Proxy(q, {
                  get(z, n, r) {
                    if (n === "update")
                      return (nutzlast: object) => {
                        spur.push(Object.keys(nutzlast).sort());
                        return z.update(nutzlast as never);
                      };
                    const v = Reflect.get(z, n, r);
                    return typeof v === "function" ? v.bind(z) : v;
                  },
                });
          };
        const v = Reflect.get(ziel, name, empf);
        return typeof v === "function" ? v.bind(ziel) : v;
      },
    });
    wert(await aendereTermin(mitSpur, a.id, { terminId: t1.terminId, ort: "Platz" }));
    assert.deepEqual(spur, [["ort"]], "nur das übergebene Feld wird geschrieben");
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ende: "20:00:00", ort: "Platz", bemerkung: "X", training_id: null });
    // PO 17 (Oberfläche): Der Dialog sendet nur Geändertes. Hat ein anderes
    // Mitglied inzwischen den Ort geändert, bleibt seine Änderung stehen, wenn
    // dieses Mitglied nur die Bemerkung sendet.
    await admin.from("training_termine").update({ ort: "Von anderem Mitglied" }).eq("id", t1.terminId);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, bemerkung: "Neu" }));
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ende: "20:00:00", ort: "Von anderem Mitglied", bemerkung: "Neu", training_id: null });
    await admin.from("training_termine").update({ ort: "Platz", bemerkung: "X" }).eq("id", t1.terminId);
    spur.length = 0;
    wert(await aendereTermin(mitSpur, a.id, { terminId: t1.terminId, beginn: "18:45", ende: "20:00" }));
    assert.deepEqual(spur, [["beginn", "ende"]], "Beginn und Ende gehen stets zusammen");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, beginn: "18:30", ende: "20:00" }));

    // Beginn und Ende sind Pflicht, auch in der Datenebene (2026-10-06).
    for (const ohne of [{ beginn: "17:00" }, { ende: "18:30" }, {}]) {
      const { error } = await admin.from("training_termine").insert({ team_id: team.id, datum: tag(5), ...ohne });
      assert.ok(error, `ohne Zeit abgewiesen: ${JSON.stringify(ohne)}`);
    }
    const { data: alt } = await admin.from("training_termine")
      .insert({ team_id: team.id, datum: tag(5), beginn: "17:00", ende: "18:30" }).select("id").single();
    // Wer nur den Beginn ändert, behält das Ende — solange es danach liegt.
    wert(await aendereTermin(a.supabase, a.id, { terminId: alt!.id, beginn: "17:30" }));
    assert.deepEqual(await zeile(alt!.id), { datum: tag(5), beginn: "17:30:00", ende: "18:30:00", ort: null, bemerkung: null, training_id: null });
    fehler(await aendereTermin(a.supabase, a.id, { terminId: alt!.id, beginn: "19:00" }), "eingabe", TERMIN_TEXT.endeNachBeginn);
    // AK 8: nicht leeren.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, beginn: null, ende: null }), "eingabe", TERMIN_TEXT.zeitPflicht);
    // #322 AK 21: Ein `null` für Beginn oder Ende passiert die Eingabeprüfung des
    // Werkzeugs und wird vom Kern mit demselben Satz abgewiesen.
    {
      const e = TerminAendernEingabe.parse({ termin_id: t1.terminId, beginn: null, ende: null });
      assert.equal(e.beginn, null);
      fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, beginn: e.beginn, ende: e.ende }), "eingabe", TERMIN_TEXT.zeitPflicht);
      fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, beginn: null }), "eingabe", TERMIN_TEXT.zeitPflicht);
    }

    // Plan: Termine ohne Training zählen wie alle anderen (PC 3).
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team.id }));
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId, alt!.id]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [t0.terminId]);
    assert.equal(plan.kommend[0].training, null);
    assert.equal(plan.kommend[0].ende, "20:00");

    // PC 7, 8: Löschen des Trainings lässt den Termin stehen.
    const tt = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Kalender", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }));
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt.id })).trainingId;
    const weg = wert(await loescheTraining(a.supabase, a.id, { trainingId: amTermin }));
    assert.deepEqual(weg.terminBleibt, { id: t1.terminId, datum: tag(2) });
    assert.equal((await zeile(t1.terminId))!.training_id, null);

    // AK 23: Wer mit veralteter Auswahl ändert oder entfernt, wird abgewiesen.
    const tt2 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zwei", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }));
    const c2 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt2.id })).trainingId;
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "x", erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    assert.equal((await zeile(t1.terminId))!.ort, "Platz", "abgewiesen heisst unverändert");
    fehler(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    assert.ok(await zeile(t1.terminId), "der Termin steht noch");
    // KI-Weg ohne erwartetes Training: geprüft wird gegen den gelesenen Stand.
    assert.deepEqual(
      wert(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "KI-Ort" })),
      { terminId: t1.terminId, teamId: team.id, trainingId: c2 },
    );
    assert.equal((await zeile(t1.terminId))!.ort, "KI-Ort");
    const t3 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(9), beginn: "18:00", ende: "19:00" }));
    const tt3 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Drei", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }));
    const c3 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t3.terminId, trainingId: tt3.id })).trainingId;
    // Entfernen nimmt das Termin-Training mit; die Quelle bleibt im Bestand.
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t3.terminId })), { teamId: team.id, training: { trainingId: c3, geloescht: true } });
    assert.equal(await zeile(t3.terminId), null);
    assert.equal(await ladeTrainingDetail(a.supabase, c3), null, "das Termin-Training ist weg");
    assert.ok(await ladeTrainingDetail(a.supabase, tt3.id), "die Quelle bleibt im Team-Bestand");
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: c2 })), { teamId: team.id, training: { trainingId: c2, geloescht: true } });
    assert.ok(await ladeTrainingDetail(a.supabase, tt2.id), "die Quelle bleibt im Team-Bestand");
    fehler(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId }), "nicht_gefunden", "Termin nicht gefunden.");
    fehler(await aendereTermin(b.supabase, b.id, { terminId: t0.terminId, ort: "x" }), "nicht_gefunden", "Termin nicht gefunden.");
    // Die SECURITY-DEFINER-Sperre: ein Nicht-Mitglied ändert nichts, auch nicht direkt über die RPC.
    fehler(await entferneTermin(b.supabase, b.id, { terminId: t0.terminId }), "nicht_gefunden", "Termin nicht gefunden.");
    assert.ok(await zeile(t0.terminId), "der Termin des fremden Teams steht noch");
    const { error: direkt } = await b.supabase.rpc("termin_training_setzen", { p_termin: t0.terminId, p_training: null });
    assert.ok(direkt?.message.includes("TERMIN_NICHT_GEFUNDEN"), "RPC weist Nicht-Mitglieder ab");

    // PC 10: Anzahl aller Termine (auch ohne Training).
    const termineDes = async () =>
      (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team.id)).count;
    assert.equal(await termineDes(), 2);
    // PC 9: Das Team aufzulösen nimmt alle seine Termine mit.
    const { error: aufloesen } = await admin.from("teams").delete().eq("id", team.id);
    if (aufloesen) throw aufloesen;
    assert.equal(await termineDes(), 0);
  });

  // ── Kalender: Training zuordnen und lösen (#323; Termin-Trainings, PO 2026-10-06) ──
  await pruefe("Kalender: zuordnen als Termin-Training, ersetzen, lösen, entfernen, Ausfall, Konflikte", async () => {
    const { data: team } = await admin.from("teams").insert({ name: "Kern-DB-Zuordnen" }).select("id").single();
    teams.push(team!.id);
    await admin.from("team_members").insert({ team_id: team!.id, user_id: a.id });
    const { data: anderes } = await admin.from("teams").insert({ name: "Kern-DB-Anderes" }).select("id").single();
    teams.push(anderes!.id);
    await admin.from("team_members").insert({ team_id: anderes!.id, user_id: a.id });
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const termin = async (d: number, teamId = team!.id) =>
      wert(await legeTerminFest(a.supabase, a.id, { teamId, datum: tag(d), beginn: "18:00", ende: "19:30" })).terminId;
    const training = async (name: string, teamId: string = team!.id) =>
      wert(await legeTrainingAn(a.supabase, a.id, { name, altersstufe: "kinderfussball", stufen: ["F"], teamId })).id;
    const traegt = async (terminId: string) =>
      (await admin.from("training_termine").select("training_id").eq("id", terminId).single()).data!.training_id;
    const gibtEs = async (id: string) => !!(await admin.from("trainings").select("id").eq("id", id).maybeSingle()).data;
    const ordne = async (terminId: string, trainingId: string) => ordneTrainingZu(a.supabase, a.id, { terminId, trainingId });

    const morgen = await termin(1), uebermorgen = await termin(2), gestern = await termin(-1);
    const x = await training("Kern-DB-X");

    // Jede Zuordnung legt still eine Kopie als Termin-Training an; die Quelle bleibt ohne Termin im Bestand.
    const z1 = wert(await ordne(morgen, x));
    assert.notEqual(z1.trainingId, x);
    assert.equal(z1.ersetzt, null);
    assert.equal(await traegt(morgen), z1.trainingId);
    assert.deepEqual(
      (await admin.from("trainings").select("name, team_id, termin_training").eq("id", z1.trainingId).single()).data,
      { name: "Kern-DB-X", team_id: team!.id, termin_training: true },
    );
    assert.equal((await admin.from("training_termine").select("id").eq("training_id", x).maybeSingle()).data, null, "die Quelle bekommt keinen Termin");
    // Der Bestand zeigt keine Termin-Trainings.
    const bestand = (await getTeamTrainingsFuer(a.supabase, team!.id)).map((t) => t.id);
    assert.ok(bestand.includes(x) && !bestand.includes(z1.trainingId), "Bestand ohne Termin-Training");
    // Dieselbe Quelle für einen weiteren, auch vergangenen Termin: wieder still eine Kopie.
    const z2 = wert(await ordne(gestern, x));
    assert.notEqual(z2.trainingId, z1.trainingId);
    // Ein Training eines anderen Teams lässt sich nicht zuordnen.
    const fremd = await training("Kern-DB-Fremd", anderes!.id);
    fehler(await ordne(uebermorgen, fremd), "regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM);
    // Quelle darf ein Termin-Training sein: Es bleibt an seinem Termin.
    const z3 = wert(await ordne(uebermorgen, z1.trainingId));
    assert.equal(await traegt(morgen), z1.trainingId);

    // Ersetzen löscht das Termin-Training.
    const y = await training("Kern-DB-Y");
    assert.deepEqual(wert(await ordne(morgen, y)).ersetzt, { trainingId: z1.trainingId, geloescht: true });
    assert.equal(await gibtEs(z1.trainingId), false);
    // Ein älteres Bestands-Training direkt am Termin bleibt beim Ersetzen im Bestand.
    const alt = await training("Kern-DB-Alt");
    await admin.from("training_termine").update({ training_id: alt }).eq("id", uebermorgen);
    assert.equal(await gibtEs(z3.trainingId), false, "auch ein direkter Wechsel löscht das Termin-Training");
    assert.deepEqual(wert(await ordne(uebermorgen, y)).ersetzt, { trainingId: alt, geloescht: false });
    assert.equal(await gibtEs(alt), true);
    // Die Datenebene verknüpft nur eine frische Kopie.
    const { error: doppelt } = await a.supabase.rpc("termin_training_setzen", { p_termin: gestern, p_training: await traegt(morgen) });
    assert.match(doppelt!.message, /TRAINING_SCHON_EINGEPLANT/);

    // AK 14: veraltete Auswahl.
    const w = await training("Kern-DB-W");
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: w, erwartet: { terminTraining: null } }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);

    // Ausfall: Das Training ruht am Termin und ist nach der Rücknahme wieder da.
    const amMorgen = await traegt(morgen);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: morgen, grund: "Regen" }));
    assert.equal(await traegt(morgen), amMorgen);
    fehler(await ordne(morgen, y), "regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: morgen }));
    assert.equal(await traegt(morgen), amMorgen);

    // AK 12: Lösen löscht das Termin-Training.
    assert.deepEqual(wert(await loeseTraining(a.supabase, a.id, { terminId: morgen })).training, { trainingId: amMorgen, geloescht: true });
    assert.equal(await traegt(morgen), null);
    assert.equal(await gibtEs(amMorgen!), false);
    // Entfernen des Termins nimmt sein Termin-Training mit.
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: gestern })).training, { trainingId: z2.trainingId, geloescht: true });
    assert.equal(await gibtEs(z2.trainingId), false);

    // PC 8: Scheitert das Verknüpfen, geht die Kopie wieder.
    const kaputt = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "rpc")
          return async (fn: string, args: unknown) =>
            fn === "termin_training_setzen" && (args as { p_training: string | null }).p_training !== null
              ? { data: null, error: { message: "Probe", code: "XX000" } }
              : ziel.rpc(fn, args as never);
        return Reflect.get(ziel, name, empf);
      },
    });
    const zahl = async () => (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team!.id)).count;
    const vorher = await zahl();
    const f = fehler(await ordneTrainingZu(kaputt, a.id, { terminId: morgen, trainingId: x }), "technisch") as { hinweis?: string };
    assert.equal(f.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await zahl(), vorher, "keine Kopie bleibt stehen");
  });

  // ── Kalender: Lesen und Zugang ─────────────────────────────────────────
  await pruefe("Kalender: Teams, Plan-Grenze, Suche, Auskunft, fremd", async () => {
    const TEAM_FREMD = "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.";
    const { data: team, error } = await admin.from("teams").insert({ name: "Kern-DB-Lesen" }).select("id").single();
    if (error) throw error;
    teams.push(team.id);
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team.id, user_id: a.id });
    if (e2) throw e2;
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);

    // AK 1: die eigenen Teams; B ist in keinem.
    const ta = wert(await meineTeams(a.supabase, a.id)).teams;
    assert.deepEqual(ta.find((t) => t.id === team.id), { id: team.id, name: "Kern-DB-Lesen", mitglieder: 1 });
    assert.equal(wert(await meineTeams(b.supabase, b.id)).teams.length, 0);

    const neuesTraining = async (name: string, teamId?: string) =>
      wert(await legeTrainingAn(a.supabase, a.id, { name, altersstufe: "kinderfussball", stufen: ["F"], teamId })).id;
    const tt = await neuesTraining("Kern-DB-Lesen", team.id);
    const vergangenes = await neuesTraining("Kern-DB-Lesen-Vergangen", team.id);
    const persoenlich = await neuesTraining("Kern-DB-Lesen-Persönlich");
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(2), beginn: "18:30", ende: "20:00", ort: " Allmend ", bemerkung: "Leibchen" }));
    const t0 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-1), beginn: "10:00", ende: "11:30" }));
    // Bestands-Trainings mit Termin, wie es sie vor den Termin-Trainings gab
    // (bis 2026-10-06 wurde direkt verknüpft); Suche und Auskunft nennen ihn.
    await admin.from("training_termine").update({ training_id: tt }).eq("id", t1.terminId);
    await admin.from("training_termine").update({ training_id: vergangenes }).eq("id", t0.terminId);

    // Der Plan ist bereits geteilt; am Tag des Termins zählt er noch zum Kommenden.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team.id }));
    assert.equal(plan.team.name, "Kern-DB-Lesen");
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [t0.terminId]);
    assert.equal(plan.vergangen[0].training?.id, vergangenes);
    const amTag = wert(await teamPlan(a.supabase, a.id, { teamId: team.id, heute: tag(-1) }));
    assert.deepEqual(amTag.kommend.map((t) => t.id), [t0.terminId, t1.terminId]);

    // Die Abfrage läuft in zwei Hälften (anstehend aufsteigend, vergangen
    // absteigend; max_rows kappt sonst die neuesten): die zusammengeführte
    // Liste bleibt aufsteigend, die Teilung unverändert. Drei vergangene,
    // zwei anstehende.
    const v3 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-3), beginn: "17:00", ende: "18:00" }));
    const v2a = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-2), beginn: "09:00", ende: "10:00" }));
    const v2b = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(-2), beginn: "16:00", ende: "17:00" }));
    const k0 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team.id, datum: tag(0), beginn: "08:00", ende: "09:00" }));
    const reihe = (ts: { terminId: string }[]) => ts.map((t) => t.terminId);
    const aufsteigend = (await getTeamPlanFuer(a.supabase, team.id, { heute: tag(0) })).map((t) => t.id);
    assert.deepEqual(aufsteigend, reihe([v3, v2a, v2b, t0, k0, t1]), "aufsteigend über beide Hälften");
    const geteilt = wert(await teamPlan(a.supabase, a.id, { teamId: team.id, heute: tag(0) }));
    assert.deepEqual(geteilt.kommend.map((t) => t.id), reihe([k0, t1]));
    assert.deepEqual(geteilt.vergangen.map((t) => t.id), reihe([t0, v2b, v2a, v3]), "jüngste zuerst");

    // Suche im Team-Bestand samt Termin.
    const suche = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, limit: 10 }));
    assert.equal(suche.treffer.length, 2);
    assert.deepEqual(suche.treffer.find((t) => t.id === tt)!.termin, {
      id: t1.terminId,
      datum: tag(2),
      beginn: "18:30",
      ende: "20:00",
      ort: "Allmend",
      bemerkung: "Leibchen",
      felder: null,
      spielerzahl: null,
      serieId: null,
      verantwortliche: [],
      ausgefallen: false,
      ausfallGrund: null,
      anstehend: true,
    });
    assert.equal(suche.treffer.find((t) => t.id === vergangenes)!.termin?.anstehend, false);
    // Ein Termin-Training steht nicht im Bestand.
    const kopie = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: k0.terminId, trainingId: tt })).trainingId;
    const ohneKopie = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, limit: 10 }));
    assert.deepEqual(ohneKopie.treffer.map((t) => t.id).sort(), [tt, vergangenes].sort());
    assert.ok(!ohneKopie.treffer.some((t) => t.id === kopie));
    const gesucht = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, q: "Kern-DB-Lesen", limit: 1 }));
    assert.equal(gesucht.treffer.length, 1);
    assert.equal(gesucht.weitere, true);
    fehler(await trainingsSuchen(a.supabase, a.id, { bestand: "team", limit: 10 }), "eingabe");

    // Die Auskunft nennt den Termin; ein persönliches Training hat keinen.
    const auskunft = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tt }));
    assert.deepEqual(auskunft.termin, {
      id: t1.terminId,
      datum: tag(2),
      beginn: "18:30",
      ende: "20:00",
      ort: "Allmend",
      bemerkung: "Leibchen",
      felder: null,
      erwartete_spielerzahl: null,
      serie_id: null,
      verantwortliche: [],
      ausgefallen: false,
      ausfall_grund: null,
      anstehend: true,
    });
    assert.equal(wert(await trainingAbrufen(a.supabase, a.id, { trainingId: persoenlich })).termin, null);

    // Die Verantwortlichen des Termins stehen in Suchtreffer und Auskunft (#325 AK 16).
    const { setzeVerantwortliche: setzeLeute } = await import("../lib/kern/verantwortliche");
    wert(await setzeLeute(a.supabase, a.id, { terminId: t1.terminId, userIds: [a.id] }));
    const name = (await admin.rpc("anzeige_name", { p_user: a.id })).data as string;
    const erwartetLeute = [{ userId: a.id, name, ehemalig: false }];
    const mitLeuten = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team.id, limit: 10 }));
    assert.deepEqual(mitLeuten.treffer.find((t) => t.id === tt)!.termin!.verantwortliche, erwartetLeute);
    assert.deepEqual(
      wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tt })).termin!.verantwortliche,
      [{ id: a.id, anzeigename: name, ehemalig: false }],
    );

    // Fremdes Team und unbekanntes Team.
    fehler(await teamPlan(b.supabase, b.id, { teamId: team.id }), "nicht_gefunden", TEAM_FREMD);
    fehler(await teamPlan(a.supabase, a.id, { teamId: randomUUID() }), "nicht_gefunden", TEAM_FREMD);
    fehler(await trainingsSuchen(b.supabase, b.id, { bestand: "team", teamId: team.id, limit: 5 }), "nicht_gefunden", TEAM_FREMD);
    fehler(
      await legeTrainingAn(b.supabase, b.id, { name: "x", altersstufe: "kinderfussball", stufen: ["F"], teamId: team.id }),
      "nicht_gefunden",
      TEAM_FREMD,
    );
  });

  // ── Kalender: Terminserien (#324, #326) ──────────────────────────────────
  // Hilfen: ein Team mit dem Konto a, das Kalenderdatum relativ zu heute (am
  // Trainingsort) und die Termine einer Serie in Datumsfolge.
  async function serienTeam(name: string) {
    const { data: team } = await admin.from("teams").insert({ name }).select("id").single();
    teams.push(team!.id);
    await admin.from("team_members").insert({ team_id: team!.id, user_id: a.id });
    return team!.id as string;
  }
  const heuteCh = kalendertagAmTrainingsort();
  const tagCh = (d: number) => plusTage(heuteCh, d);
  const termineDer = async (serieId: string) =>
    (
      await admin
        .from("training_termine")
        .select("id, datum, serien_tag, beginn, ende, ort, bemerkung, zeit_abweichend, ort_abweichend, bemerkung_abweichend, training_id")
        .eq("serie_id", serieId)
        .order("datum")
    ).data!;

  await pruefe("Serie festlegen: je Wochentag ein Termin, Regeln, bestehende Termine bleiben (#324)", async () => {
    const team = await serienTeam("Kern-DB-Serie");
    const einzel = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: "2030-01-01", beginn: "10:00", ende: "11:00" }));
    const s = wert(
      await legeSerieFest(a.supabase, a.id, {
        teamId: team, wochentage: [2, 4], von: "2030-01-01", bis: "2030-01-30", beginn: "18:00", ende: "19:30", ort: "Allmend",
      }),
    );
    assert.equal(s.termine, 9); // 1.–30. Januar 2030: 5 Di + 4 Do (der 31. ist ein Donnerstag)
    const t = await termineDer(s.serieId);
    assert.equal(t[0].datum, "2030-01-01");
    assert.ok(t.every((x) => x.training_id === null && x.ort === "Allmend" && x.serien_tag === x.datum));
    assert.ok((await admin.from("training_termine").select("id").eq("id", einzel.terminId).single()).data, "PC 3");
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [6], von: "2030-01-07", bis: "2030-01-11", beginn: "18:00", ende: "19:30" }), "eingabe", SERIE_TEXT.ohneTag);
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2028-02-29", bis: "2029-03-01", beginn: "18:00", ende: "19:30" }), "eingabe", SERIE_TEXT.zuLang);
    wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2028-02-29", bis: "2029-02-28", beginn: "18:00", ende: "19:30" }));
    fehler(await legeSerieFest(b.supabase, b.id, { teamId: team, wochentage: [2], von: "2030-01-01", bis: "2030-01-31", beginn: "18:00", ende: "19:30" }), "nicht_gefunden");
    // Die Vorprüfung fängt ab, was die Datenebene sonst roh meldete.
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2030-02-30", bis: "2030-03-31", beginn: "18:00", ende: "19:30" }), "eingabe");
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2030-01-01", bis: "2030-01-31", beginn: "25:00", ende: "26:00" }), "eingabe");
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2030-01-01", bis: "2030-01-31", beginn: "18:00", ende: "19:30", ort: "x".repeat(101) }), "eingabe", TERMIN_TEXT.ortLang);
    // Zeitraum-Abruf (#329): beide Tage eingeschlossen, leer ohne Termine, Grenze wie bei Serien.
    const z = wert(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-01-06", bis: "2030-01-10" }));
    assert.deepEqual([...z.kommend, ...z.vergangen].map((x) => x.datum), ["2030-01-08", "2030-01-10"]);
    assert.equal(wert(await teamPlan(a.supabase, a.id, { teamId: team, von: "2031-06-01", bis: "2031-06-30" })).kommend.length, 0, "PC 7: leer");
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-01-01", bis: "2031-01-02" }), "eingabe", ZEITRAUM_TEXT.zuLang);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-01-01" }), "eingabe", ZEITRAUM_TEXT.beideTage);
  });

  await pruefe("Serie ändern: nur dieser, folgende teilt, alle erfasst Vergangenes, Abweichungen bleiben (#326)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Ändern");
    // Wöchentlich am heutigen Wochentag, drei Wochen zurück bis fünf Wochen voraus.
    const von = tagCh(-21), bis = tagCh(35);
    const w = wochentagVon(heuteCh);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von, bis, beginn: "18:00", ende: "19:30", ort: "A" }));
    let t = await termineDer(s.serieId);
    const heuteTermin = t.find((x) => x.datum === heuteCh)!;
    const naechster = t.find((x) => x.datum === tagCh(7))!;

    // Nur dieser: Ort weicht ab, Zeit und Bemerkung nicht.
    wert(await aendereTermin(a.supabase, a.id, { terminId: naechster.id, ort: "B" }));
    const nach = (await termineDer(s.serieId)).find((x) => x.id === naechster.id)!;
    assert.equal(nach.ort_abweichend, true);
    assert.equal(nach.zeit_abweichend, false);
    assert.equal(nach.bemerkung_abweichend, false);
    // Lesepfad: Serie, Serientag und Abweichungen im Plan.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const zeile = [...plan.kommend, ...plan.vergangen].find((x) => x.id === naechster.id)!;
    assert.deepEqual(zeile.abweichungen, ["ort"]);
    assert.equal(zeile.serienTag, naechster.datum);
    assert.deepEqual(
      [zeile.serie?.id, zeile.serie?.wochentage, zeile.serie?.beginnDatum, zeile.serie?.endDatum, zeile.serie?.beginn, zeile.serie?.ende, zeile.serie?.ort],
      [s.serieId, [w], von, bis, "18:00", "19:30", "A"],
    );
    assert.deepEqual([...plan.kommend, ...plan.vergangen].find((x) => x.id === heuteTermin.id)!.abweichungen, []);
    // Ein unveränderter Ort setzt kein Flag: derselbe Wert wie die Serie.
    wert(await aendereTermin(a.supabase, a.id, { terminId: heuteTermin.id, ort: "A" }));
    assert.equal((await termineDer(s.serieId)).find((x) => x.id === heuteTermin.id)!.ort_abweichend, false);

    // KI ohne Reichweite → abgewiesen (AK 11).
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, ort: "C" }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);
    // KI «alle» mit Vergangenem → Bestätigung nötig.
    const ohne = fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, reichweite: "alle", beginn: "18:30", ende: "20:00" }), "regel");
    assert.match((ohne as { meldung: string }).meldung, /vergangene Termine/);
    // Alle, bestätigt: Zeit überall, auch vergangen; der abweichende Ort bleibt.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: naechster.id, reichweite: "alle", beginn: "18:30", ende: "20:00", bestaetigt: true }));
    t = await termineDer(s.serieId);
    assert.ok(t.every((x) => x.beginn === "18:30:00"), "PC 4");
    assert.equal(t.find((x) => x.id === naechster.id)!.ort, "B", "PC 5");

    // Dieser und folgende ab heute: teilt; alte Serie endet gestern.
    const f = wert(await aendereSerie(a.supabase, a.id, { terminId: heuteTermin.id, reichweite: "dieser_und_folgende", aenderung: { ort: "C" } }));
    assert.notEqual(f.serieId, s.serieId);
    const alt = (await admin.from("termin_serien").select("end_datum").eq("id", s.serieId).single()).data!;
    assert.equal(alt.end_datum, tagCh(-1), "PC 3");
    const neu = await termineDer(f.serieId!);
    assert.equal(neu[0].id, heuteTermin.id);
    assert.equal(neu.find((x) => x.id === naechster.id)!.ort, "B", "die Abweichung reist mit");
    assert.ok(neu.filter((x) => x.id !== naechster.id).every((x) => x.ort === "C"));
    // PC 19: Mit «folgende» beginnt die Teilserie frühestens am gewählten Termin.
    fehler(await aendereSerie(a.supabase, a.id, { terminId: naechster.id, reichweite: "dieser_und_folgende", aenderung: { von: heuteCh } }), "eingabe", SERIE_MELDUNG.TEILSERIE_BEGINN);

    // Der Serie folgen lassen (AK 6): Ort wieder aus der Serie.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: naechster.id, angaben: ["ort"] }));
    const gefolgt = (await termineDer(f.serieId!)).find((x) => x.id === naechster.id)!;
    assert.equal(gefolgt.ort, "C");
    assert.equal(gefolgt.ort_abweichend, false);
    // Keine oder unbekannte Angaben: die Meldung nennt, was wählbar ist; das Datum folgt nie (PO 3).
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: naechster.id, angaben: [] }), "eingabe", SERIE_MELDUNG.SERIE_ANGABEN_UNGUELTIG);
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: naechster.id, angaben: ["farbe" as never] }), "eingabe", SERIE_MELDUNG.SERIE_ANGABEN_UNGUELTIG);
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: naechster.id, angaben: ["datum" as never] }), "regel", SERIE_MELDUNG.DATUM_FOLGT_NICHT);
  });

  await pruefe("Serie: Wochentag weg/dazu/Tausch, Zeitraum, belegte vorab genannt, Konflikt, Lücken (#326)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Regel");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2, 4], von: "2030-01-01", bis: "2030-01-30", beginn: "18:00", ende: "19:30" }));
    let t = await termineDer(s.serieId);
    const tt = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Serie-Training", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const donnerstag = t.find((x) => x.datum === "2030-01-03")!;
    const amDo = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: donnerstag.id, trainingId: tt.id })).trainingId;
    // Einzeln entfernt: Der 8.1. kommt bei keiner Änderung zurück (PC 10).
    wert(await entferneTermin(a.supabase, a.id, { terminId: t.find((x) => x.datum === "2030-01-08")!.id }));

    // Tausch Do → Fr (PC 8): samt Training in dieselbe Woche.
    const v = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2, 5] }, vorschau: true }));
    assert.equal(v.entfallendAnzahl, 0);
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2, 5] }, erwartet: { version: v.versionVorher, entfallend: [] } }));
    t = await termineDer(s.serieId);
    assert.equal(t.find((x) => x.id === donnerstag.id)!.datum, "2030-01-04");
    assert.equal(t.find((x) => x.id === donnerstag.id)!.training_id, amDo);
    assert.equal(t.filter((x) => x.datum === "2030-01-08").length, 0, "PC 10");

    // Wochentag weg (PC 7): Fr entfällt, auch mit Training — vorab genannt (AK 8).
    const v2 = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, vorschau: true }));
    assert.deepEqual(v2.entfallend.map((e) => e.terminId), [donnerstag.id]);
    assert.deepEqual(v2.entfallend[0].training, { id: amDo, name: "Kern-DB-Serie-Training", terminTraining: true });
    // AK 9: Hat sich die Belegung seit der Vorschau geändert → abgewiesen.
    fehler(
      await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher, entfallend: [] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_BELEGUNG_GEAENDERT,
    );
    fehler(
      await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher - 1, entfallend: [donnerstag.id] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_GEAENDERT,
    );
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [2] }, erwartet: { version: v2.versionVorher, entfallend: [donnerstag.id] } }));
    assert.equal(await ladeTrainingDetail(a.supabase, amDo), null, "das Termin-Training ging mit seinem Termin");
    assert.ok(await ladeTrainingDetail(a.supabase, tt.id), "die Quelle bleibt im Bestand");

    // Zeitraum erweitern (PC 6) — der 8.1. bleibt Lücke, der Februar kommt dazu.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { bis: "2030-02-12" }, erwartet: { version: v2.versionVorher + 1, entfallend: [] } }));
    t = await termineDer(s.serieId);
    assert.deepEqual(t.map((x) => x.datum), ["2030-01-01", "2030-01-15", "2030-01-22", "2030-01-29", "2030-02-05", "2030-02-12"]);

    // Entfernen «dieser und folgende» (PC 11) und «alle» (PC 12, 14).
    const e1 = wert(await entferneSerie(a.supabase, a.id, { terminId: t[3].id, reichweite: "dieser_und_folgende" }));
    assert.equal(e1.entfallendAnzahl, 3);
    assert.equal((await admin.from("termin_serien").select("end_datum").eq("id", s.serieId).single()).data!.end_datum, "2030-01-28");
    wert(await entferneSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle" }));
    assert.equal((await admin.from("termin_serien").select("id").eq("id", s.serieId).maybeSingle()).data, null);
  });

  await pruefe("Tausch So → Mo über die Wochengrenze; anstehend nicht in die Vergangenheit (Review Focus 3)", async () => {
    const team = await serienTeam("Kern-DB-Tausch");
    // Ein Sonntag in der Zukunft und einer zwei Wochen zurück.
    const sonntagVoraus = plusTage(heuteCh, (7 - wochentagVon(heuteCh)) % 7 || 7);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [7], von: plusTage(sonntagVoraus, -14), bis: sonntagVoraus, beginn: "10:00", ende: "11:30" }));
    wert(await aendereSerie(a.supabase, a.id, { terminId: (await termineDer(s.serieId))[0].id, reichweite: "alle", aenderung: { wochentage: [1] }, bestaetigt: true }));
    const t = await termineDer(s.serieId);
    // Jeder Sonntag wandert auf den Montag DERSELBEN Woche (6 Tage zurück).
    assert.ok(t.every((x) => wochentagVon(x.datum) === 1));
    // Liegt der Montag vor heute, entfällt der anstehende Sonntag (PC 9).
    const montag = plusTage(sonntagVoraus, -6);
    assert.equal(t.some((x) => x.datum === montag), montag >= heuteCh);
  });

  await pruefe("Serie: Teilung durch ein anderes Mitglied → SERIE_GEAENDERT bei «alle» (Änderung und Entfernen)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Wettlauf");
    // Das zweite Mitglied, das die Serie teilt, während a noch die alte Vorschau hat.
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: "2030-03-05", bis: "2030-04-30", beginn: "18:00", ende: "19:30" }));
    const t = await termineDer(s.serieId);
    for (const art of ["aendern", "entfernen"] as const) {
      const veraltet = art === "aendern"
        ? wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { ort: "Halle" }, vorschau: true }))
        : wert(await entferneSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", vorschau: true }));
      // Mitglied b teilt die Serie an einem späteren Termin — die
      // Serie S behält ihre Zeile, ihre Version steigt aber (Teilung).
      // Beim zweiten Durchgang liegt t[3] schon in der Teilserie; geteilt wird
      // darum an einem Termin, der noch in S liegt.
      wert(await aendereSerie(b.supabase, b.id, { terminId: art === "aendern" ? t[3].id : t[2].id, reichweite: "dieser_und_folgende", aenderung: { ort: "Andere" } }));
      const r = art === "aendern"
        ? await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { ort: "Halle" }, erwartet: { version: veraltet.versionVorher, entfallend: [] } })
        : await entferneSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", erwartet: { version: veraltet.versionVorher, entfallend: [] } });
      fehler(r, "konflikt", SERIE_MELDUNG.SERIE_GEAENDERT);
      // Die Serie ist unverändert geblieben: noch immer t[0] da, kein Löschen.
      assert.ok((await admin.from("training_termine").select("id").eq("id", t[0].id).maybeSingle()).data);
    }
  });

  await pruefe("Kalender: Serie mit Reichweite über den KI-Weg - nur dieser, Regeln, Datum, Entfernen (#326 AK 2–4, 7, 10, 11)", async () => {
    const team = await serienTeam("Kern-DB-Serie-KI");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: tagCh(7), bis: tagCh(49), beginn: "18:00", ende: "19:30", ort: "A" }));
    const t = await termineDer(s.serieId);
    // Nur dieser: Einzeländerung, Ort weicht ab.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", ort: "Z" }));
    assert.equal((await termineDer(s.serieId)).find((x) => x.id === t[1].id)!.ort_abweichend, true);
    // Zeit (nur als Paar) und Bemerkung setzen ihre Flags; das Datum braucht keines.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", beginn: "17:00", ende: "18:00", bemerkung: "Test" }));
    const z = (await termineDer(s.serieId)).find((x) => x.id === t[1].id)!;
    assert.deepEqual([z.zeit_abweichend, z.ort_abweichend, z.bemerkung_abweichend], [true, true, true]);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "nur_dieser", datum: plusTage(t[0].datum, 1) }));
    const d = (await termineDer(s.serieId)).find((x) => x.id === t[0].id)!;
    assert.deepEqual([d.zeit_abweichend, d.ort_abweichend, d.bemerkung_abweichend], [false, false, false]);
    assert.notEqual(d.datum, d.serien_tag);
    // Unveränderte Zeit und Bemerkung setzen kein Flag (gleicher Wert wie die Serie bzw. leer → leer).
    const flagsVon = async (id: string) => {
      const x = (await termineDer(s.serieId)).find((r) => r.id === id)!;
      return [x.zeit_abweichend, x.ort_abweichend, x.bemerkung_abweichend];
    };
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[3].id, reichweite: "nur_dieser", beginn: "18:00", ende: "19:30", bemerkung: "" }));
    assert.deepEqual(await flagsVon(t[3].id), [false, false, false]);
    // Lesepfad: ein verlegtes Datum und eine geänderte Zeit erscheinen als Abweichung.
    const planKi = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const zeileKi = (id: string) => [...planKi.kommend, ...planKi.vergangen].find((x) => x.id === id)!;
    assert.ok(zeileKi(t[0].id).abweichungen.includes("datum"), "verlegtes Datum");
    assert.ok(zeileKi(t[1].id).abweichungen.includes("zeit"), "geänderte Zeit");
    assert.deepEqual(zeileKi(t[3].id).abweichungen, [], "unverändert");
    // Regeln nur für folgende oder alle; das Datum nur für diesen.
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", bis: tagCh(40) }), "regel", SERIE_MELDUNG.REGEL_NUR_SERIE);
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "alle", datum: tagCh(9) }), "regel", SERIE_MELDUNG.DATUM_NUR_EINZELN);
    // Ein Einzeltermin kennt keine Reichweite ausser «nur dieser».
    const einzel = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00" }));
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: einzel.terminId, reichweite: "alle", ort: "Q" }), "regel", SERIE_MELDUNG.TERMIN_OHNE_SERIE);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: einzel.terminId, ort: "Q" }));
    // Entfernen: Reichweite Pflicht; «nur dieser» lässt eine Lücke, «alle» löscht die Serie.
    fehler(await entferneMitReichweite(a.supabase, a.id, { terminId: t[2].id }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);
    wert(await entferneMitReichweite(a.supabase, a.id, { terminId: t[2].id, reichweite: "nur_dieser" }));
    assert.equal((await termineDer(s.serieId)).some((x) => x.id === t[2].id), false);
    wert(await entferneMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle" }));
    assert.equal((await admin.from("termin_serien").select("id").eq("id", s.serieId).maybeSingle()).data, null);
  });

  await pruefe("Serie entfernen über den KI-Weg: Vergangenes verlangt Bestätigung, vorher bleibt alles stehen (#326 AK 11)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Entfernen-KI");
    const w = wochentagVon(heuteCh);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30" }));
    const t = await termineDer(s.serieId);
    assert.equal(t[0].datum, tagCh(-14));
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Serie-Vergangen", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t[0].id, trainingId: tr.id })).trainingId;
    const anzahl = async () =>
      (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count;
    const vorher = await anzahl();

    // «Dieser und folgende» ab einem vergangenen Termin, «alle»: ohne Bestätigung nichts.
    fehler(await entferneMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "dieser_und_folgende" }), "regel", /vergangene/);
    fehler(await entferneMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle" }), "regel", /vergangene/);
    assert.equal(await anzahl(), vorher, "nichts gelöscht");
    assert.ok((await admin.from("termin_serien").select("id").eq("id", s.serieId).maybeSingle()).data);

    // Bestätigt: die Serie ist weg samt Termin-Training, die Quelle bleibt im Bestand.
    const weg = wert(await entferneMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(weg.serie!.entfallend.map((e) => e.training), [{ id: amTermin, name: "Kern-DB-Serie-Vergangen", terminTraining: true }]);
    assert.equal(await anzahl(), 0);
    assert.equal((await admin.from("termin_serien").select("id").eq("id", s.serieId).maybeSingle()).data, null);
    assert.equal(await ladeTrainingDetail(a.supabase, amTermin), null, "das Termin-Training ging mit");
    assert.ok(await ladeTrainingDetail(a.supabase, tr.id), "die Quelle bleibt im Bestand");
  });

  // ── Kalender: Verantwortliche (#325) ─────────────────────────────────────
  const { setzeVerantwortliche, teamMitglieder } = await import("../lib/kern/verantwortliche");

  await pruefe("Verantwortliche: eintragen, Serie gibt vor, abweichen, folgen, austreten, Konto löschen (#325)", async () => {
    const team = await serienTeam("Kern-DB-Verantwortliche");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const c = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: c.id });

    const m = wert(await teamMitglieder(a.supabase, a.id, { teamId: team })).mitglieder;
    assert.equal(m.length, 3);
    assert.equal(m.find((x) => x.id === a.id)!.ich, true);
    assert.ok(m.every((x) => !("email" in x)), "PC 9");
    // Ein viertes Mitglied, das nur einen einzelnen Termin trägt: macht den Filter «nur meine» prüfbar.
    const e4 = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: e4.id });

    const w = wochentagVon(heuteCh);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", verantwortliche: [a.id, b.id] }));
    const leute = async (terminId: string) =>
      (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", terminId)).data!.map((x) => x.user_id).sort();
    const t = await termineDer(s.serieId);
    assert.deepEqual(await leute(t[0].id), [a.id, b.id].sort(), "PC 1");

    const fremder = t.find((x) => x.datum === tagCh(14))!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: fremder.id, userIds: [e4.id], reichweite: "nur_dieser" }));
    // Nur dieser: C statt B (AK 5, PC 2).
    const kuenftig = t.find((x) => x.datum === tagCh(7))!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: kuenftig.id, userIds: [c.id], reichweite: "nur_dieser" }));
    // Alle: nur A — der abweichende bleibt bei C (PC 3).
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [a.id], reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(await leute(kuenftig.id), [c.id]);
    assert.deepEqual(await leute(t[0].id), [a.id]);
    // AK 21: Hat ein anderes Mitglied die Serie seit der Auswahl geändert → abgewiesen.
    fehler(
      await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [b.id], reichweite: "alle", erwartet: { version: 1, entfallend: [] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_GEAENDERT,
    );
    // AK 20: KI ohne Reichweite am Serientermin → abgewiesen.
    fehler(await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [b.id] }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);
    // Vorab geprüft: keine Kennung, ein Null-Eintrag → Eingabefehler, nichts geschrieben.
    fehler(
      await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: ["kein-uuid"], reichweite: "nur_dieser" }),
      "eingabe",
      TERMIN_TEXT.verantwortlicheUngueltig,
    );
    fehler(
      await setzeVerantwortliche(a.supabase, a.id, { terminId: t[0].id, userIds: [null as never], reichweite: "nur_dieser" }),
      "eingabe",
      TERMIN_TEXT.verantwortlicheUngueltig,
    );
    assert.deepEqual(await leute(t[0].id), [a.id], "unverändert");

    // Austritt (PC 6, 12): C verschwindet aus dem anstehenden Termin, der abweichend bleibt.
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", c.id);
    assert.deepEqual(await leute(kuenftig.id), []);
    assert.equal((await admin.from("training_termine").select("verantwortliche_abweichend").eq("id", kuenftig.id).single()).data!.verantwortliche_abweichend, true);
    // AK 13: ein ehemaliges Mitglied lässt sich nicht neu eintragen.
    fehler(await setzeVerantwortliche(a.supabase, a.id, { terminId: kuenftig.id, userIds: [c.id], reichweite: "nur_dieser" }), "regel", TERMIN_MELDUNG.NICHT_MEHR_MITGLIED);

    // Der Serie wieder folgen (PC 4): der abweichende Termin erhält die Verantwortlichen der Serie.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: kuenftig.id, angaben: ["verantwortliche"] }));
    assert.deepEqual(await leute(kuenftig.id), [a.id]);
    assert.equal((await admin.from("training_termine").select("verantwortliche_abweichend").eq("id", kuenftig.id).single()).data!.verantwortliche_abweichend, false);

    // Vergangenes bleibt (PC 7): B an einem vergangenen Termin, dann tritt B aus.
    const vergangen = t.find((x) => x.datum < heuteCh)!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: vergangen.id, userIds: [a.id, b.id], reichweite: "nur_dieser" }));
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", b.id);
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const vb = plan.vergangen.find((x) => x.id === vergangen.id)!.verantwortliche.find((v) => v.userId === b.id)!;
    assert.equal(vb.ehemalig, true);
    assert.ok(vb.name, "mit aktuellem Anzeigenamen");
    // Die Serie trägt nur noch A; der Serientermin ohne Abweichung folgt ihr.
    assert.deepEqual(plan.kommend[0].serie!.verantwortliche.map((v) => v.userId), [a.id]);
    assert.ok(plan.kommend[0].serie!.verantwortliche.every((v) => typeof v.name === "string" && v.name.length > 0), "Serie mit Namen");
    assert.ok(plan.vergangen.find((x) => x.id === vergangen.id)!.abweichungen.includes("verantwortliche"));
    // PC 13: Verlegt man ihn auf heute, fällt B heraus.
    wert(await aendereTermin(a.supabase, a.id, { terminId: vergangen.id, datum: heuteCh }));
    assert.deepEqual(await leute(vergangen.id), [a.id]);

    // AK 11, 17: nur die eigenen.
    const meine = wert(await teamPlan(a.supabase, a.id, { teamId: team, nurMeine: true }));
    const meineIds = [...meine.kommend, ...meine.vergangen].map((x) => x.id);
    assert.ok(meineIds.length >= 1, "nicht leer");
    assert.ok(!meineIds.includes(fremder.id), "der Termin einer anderen Person fehlt");
    assert.ok([...meine.kommend, ...meine.vergangen].every((x) => x.verantwortliche.some((v) => v.userId === a.id)));
    const alle = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.ok([...alle.kommend, ...alle.vergangen].some((x) => x.id === fremder.id), "im ganzen Plan steht er");
    assert.ok(meineIds.length < alle.kommend.length + alle.vergangen.length, "der Filter schränkt ein");
    // #329: Zeitraum und «nur meine» verbinden sich; beide Grenzen schliessen ein.
    const ids = (p: { kommend: { id: string }[]; vergangen: { id: string }[] }) => [...p.kommend, ...p.vergangen].map((x) => x.id).sort();
    const weit = { teamId: team, von: tagCh(-14), bis: tagCh(14) };
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { ...weit, nurMeine: true }))), [...meineIds].sort(), "weiter Zeitraum + nur meine = nur meine");
    const amRand = { teamId: team, von: tagCh(14), bis: tagCh(14) };
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, amRand))), [fremder.id], "von = bis = ein Tag, eingeschlossen");
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { ...amRand, nurMeine: true }))), [], "Zeitraum + nur meine: der fremde Termin fällt heraus");
    const ueberHeute = wert(await teamPlan(a.supabase, a.id, weit));
    assert.ok(ueberHeute.kommend.length > 0 && ueberHeute.vergangen.length > 0, "ein Zeitraum über heute teilt in kommend und vergangen");
    assert.ok(ueberHeute.kommend.every((x) => x.datum >= heuteCh) && ueberHeute.vergangen.every((x) => x.datum < heuteCh));
    // Leere Angaben sind gegeben, aber ungültig — nicht «kein Zeitraum» (AK 14).
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "", bis: "" }), "eingabe", TERMIN_TEXT.datum);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "", bis: tagCh(1) }), "eingabe", TERMIN_TEXT.datum);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: tagCh(1), bis: tagCh(0) }), "eingabe", ZEITRAUM_TEXT.bisVorVon);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-02-30", bis: "2030-03-01" }), "eingabe", TERMIN_TEXT.datum);
  });

  await pruefe("Austritt eines Serien-Verantwortlichen: Serie und anstehende Termine ohne ihn, Vergangenes behält ihn (#325 PC 6, 7)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Austritt");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", verantwortliche: [a.id, b.id] }));
    const t = await termineDer(s.serieId);
    const leute = async (terminId: string) =>
      (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", terminId)).data!.map((x) => x.user_id).sort();
    const anstehend = t.find((x) => x.datum === tagCh(7))!;
    const vergangen = t.find((x) => x.datum === tagCh(-7))!;
    assert.equal((await admin.from("training_termine").select("verantwortliche_abweichend").eq("id", anstehend.id).single()).data!.verantwortliche_abweichend, false, "folgt der Serie");
    assert.deepEqual(await leute(anstehend.id), [a.id, b.id].sort());

    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", b.id);
    const serie = (await admin.from("termin_serien_verantwortliche").select("user_id").eq("serie_id", s.serieId)).data!;
    assert.deepEqual(serie, [{ user_id: a.id }], "aus der Serie ausgetragen");
    assert.deepEqual(await leute(anstehend.id), [a.id], "aus dem anstehenden Termin ausgetragen");
    assert.deepEqual(await leute(vergangen.id), [a.id, b.id].sort(), "der vergangene behält ihn");
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.equal(plan.vergangen.find((x) => x.id === vergangen.id)!.verantwortliche.find((v) => v.userId === b.id)!.ehemalig, true);
    assert.deepEqual(plan.kommend.find((x) => x.id === anstehend.id)!.serie!.verantwortliche.map((v) => v.userId), [a.id]);
  });

  await pruefe("Konto löschen anonymisiert vergangene Einträge, auch nach dem Austritt (#325 PC 8)", async () => {
    const team = await serienTeam("Kern-DB-Anonym");
    const d = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: d.id });
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-3), beginn: "10:00", ende: "11:00" }));
    const neu = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00" }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [d.id] }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: neu.terminId, userIds: [d.id] }));
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", d.id); // erst Austritt …
    assert.equal((await d.supabase.rpc("delete_account")).error, null); // … dann Konto
    const e = (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", alt.terminId)).data!;
    assert.deepEqual(e, [{ user_id: null }]);
    const p = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.deepEqual(p.vergangen[0].verantwortliche.map((v) => ({ name: v.name, ehemalig: v.ehemalig })), [{ name: null, ehemalig: true }]);
  });

  await pruefe("Konto löschen als noch aktives Mitglied: anstehend und Serie ohne es, vergangen anonym und zuletzt (#325 PC 6, 8)", async () => {
    const team = await serienTeam("Kern-DB-Anonym-Mitglied");
    const d = await wegwerfKonto();
    const x = await wegwerfKonto();
    await admin.from("team_members").insert([{ team_id: team, user_id: d.id }, { team_id: team, user_id: x.id }]);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-7), bis: tagCh(14), beginn: "18:00", ende: "19:30", verantwortliche: [d.id] }));
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-3), beginn: "10:00", ende: "11:00" }));
    const neu = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00" }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [d.id, a.id, x.id] }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: neu.terminId, userIds: [d.id] }));
    assert.equal((await d.supabase.rpc("delete_account")).error, null); // noch Mitglied
    const leute = async (terminId: string) =>
      (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", terminId)).data!.map((v) => v.user_id);
    assert.deepEqual(await leute(neu.terminId), [], "anstehender Eintrag entfernt");
    assert.deepEqual((await admin.from("termin_serien_verantwortliche").select("user_id").eq("serie_id", s.serieId)).data, [], "Serie ohne das Konto");
    const serienTermine = await termineDer(s.serieId);
    for (const st of serienTermine.filter((y) => y.datum >= heuteCh)) assert.deepEqual(await leute(st.id), [], "anstehender Serientermin");
    const vergangeneSerie = serienTermine.find((y) => y.datum < heuteCh)!;
    assert.deepEqual(await leute(vergangeneSerie.id), [null], "vergangener Serientermin anonym");
    // Lesepfad: zwei benannte, ein anonymer Eintrag — der anonyme zuletzt, die benannten nach Name.
    const p = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const v = p.vergangen.find((y) => y.id === alt.terminId)!.verantwortliche;
    assert.equal(v.length, 3);
    assert.equal(v[2].name, null, "anonym zuletzt");
    assert.ok(v[0].name && v[1].name, "zwei benannte");
    assert.ok(v[0].name!.localeCompare(v[1].name!, "de") <= 0, "nach Name geordnet");
    assert.deepEqual(v.map((y) => y.ehemalig), [false, false, true]);
  });

  // ── Kalender: Verantwortliche und Serienteilung (#325 PC 4, 11, AK 18) ──────
  const leuteVon = async (terminId: string) =>
    (await admin.from("termin_verantwortliche").select("user_id").eq("termin_id", terminId)).data!.map((x) => x.user_id).sort();
  const serienLeute = async (serieId: string) =>
    (await admin.from("termin_serien_verantwortliche").select("user_id").eq("serie_id", serieId)).data!.map((x) => x.user_id).sort();
  const serieVon = async (terminId: string) =>
    (await admin.from("training_termine").select("serie_id").eq("id", terminId).single()).data!.serie_id as string;
  /** Ein Team mit A und B und einer Serie mit beiden als Verantwortlichen: Termine bei -14, -7, 0, 7, 14 Tagen. */
  async function serieMitZweien(name: string) {
    const team = await serienTeam(name);
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", verantwortliche: [a.id, b.id] }));
    return { team, serieId: s.serieId, t: await termineDer(s.serieId) };
  }
  const beide = [a.id, b.id].sort();

  await pruefe("«Dieser und folgende» mit neuen Verantwortlichen teilt die Serie (#325 PC 11)", async () => {
    const { serieId, t } = await serieMitZweien("Kern-DB-Verantwortliche-Teilen");
    const ab = t.find((x) => x.datum === tagCh(7))!;
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: ab.id, userIds: [a.id], reichweite: "dieser_und_folgende" }));
    const neueSerie = await serieVon(ab.id);
    assert.notEqual(neueSerie, serieId, "neue Serie");
    assert.deepEqual(await serienLeute(serieId), beide, "alte Serie behält die alte Liste");
    assert.deepEqual(await serienLeute(neueSerie), [a.id], "neue Serie trägt die neue Liste");
    for (const x of t) {
      const ab_ = x.datum >= tagCh(7);
      assert.equal(await serieVon(x.id), ab_ ? neueSerie : serieId, `Serie von ${x.datum}`);
      assert.deepEqual(await leuteVon(x.id), ab_ ? [a.id] : beide, `Termin ${x.datum}`);
    }
  });

  await pruefe("Teilung durch eine Ortsänderung: die neue Serie übernimmt die Verantwortlichen (#325 PC 4)", async () => {
    const { serieId, t } = await serieMitZweien("Kern-DB-Verantwortliche-Ort");
    const ab = t.find((x) => x.datum === tagCh(7))!;
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: ab.id, reichweite: "dieser_und_folgende", ort: "Neuer Platz" }));
    const neueSerie = await serieVon(ab.id);
    assert.notEqual(neueSerie, serieId, "geteilt");
    assert.deepEqual(await serienLeute(neueSerie), beide, "neue Serie übernimmt die Liste");
    assert.deepEqual(await serienLeute(serieId), beide, "alte Serie behält sie");
    assert.deepEqual(await leuteVon(ab.id), beide);
  });

  await pruefe("Zeitraum erweitern: neue Termine tragen die Verantwortlichen der Serie (#325 PC 1)", async () => {
    const { serieId, t } = await serieMitZweien("Kern-DB-Verantwortliche-Erweitern");
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", bis: tagCh(28), bestaetigt: true }));
    const alle = await termineDer(serieId);
    const neu = alle.filter((x) => x.datum > tagCh(14));
    assert.ok(neu.length >= 2, "neue Termine");
    for (const x of neu) assert.deepEqual(await leuteVon(x.id), beide, `neuer Termin ${x.datum}`);
  });

  await pruefe("Namenlose Einträge: p_anonyme null behält alle, [] entfernt alle, [id] genau den (#325 PC 8, AK 18)", async () => {
    const team = await serienTeam("Kern-DB-Verantwortliche-Namenlose");
    const d1 = await wegwerfKonto();
    const d2 = await wegwerfKonto();
    await admin.from("team_members").insert([{ team_id: team, user_id: d1.id }, { team_id: team, user_id: d2.id }]);
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-3), beginn: "10:00", ende: "11:00" }));
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [a.id, d1.id, d2.id] }));
    for (const d of [d1, d2]) {
      await admin.from("team_members").delete().eq("team_id", team).eq("user_id", d.id);
      assert.equal((await d.supabase.rpc("delete_account")).error, null);
    }
    const eintraege = async () =>
      (await admin.from("termin_verantwortliche").select("id, user_id").eq("termin_id", alt.terminId)).data!;
    const namenlos = async () => (await eintraege()).filter((x) => x.user_id === null).map((x) => x.id).sort();
    const beide2 = await namenlos();
    assert.equal(beide2.length, 2, "zwei namenlose Einträge");

    // null (auch ohne Angabe): alle behalten.
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [a.id], anonyme: null }));
    assert.deepEqual(await namenlos(), beide2);
    // Genau einer bleibt.
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [a.id], anonyme: [beide2[0]] }));
    assert.deepEqual(await namenlos(), [beide2[0]]);
    // Keiner bleibt.
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: alt.terminId, userIds: [a.id], anonyme: [] }));
    assert.deepEqual(await namenlos(), []);
    assert.deepEqual(await leuteVon(alt.terminId), [a.id]);

    // AK 18: Für folgende und alle gilt dieselbe Regel wie in der Oberfläche — `anonyme` wird abgelehnt, nichts geschrieben.
    const { serieId, t } = await serieMitZweien("Kern-DB-Verantwortliche-Namenlose-Serie");
    for (const reichweite of ["dieser_und_folgende", "alle"] as const)
      fehler(
        await setzeVerantwortliche(a.supabase, a.id, { terminId: t[2].id, userIds: [a.id], anonyme: [], reichweite, bestaetigt: true }),
        "regel",
        SERIE_TEXT.namenloseNurEinzeln,
      );
    assert.deepEqual(await serienLeute(serieId), beide, "Serie unverändert");
    assert.equal(await serieVon(t[2].id), serieId, "nicht geteilt");
    assert.deepEqual(await leuteVon(t[2].id), beide);
    // Ohne `anonyme` (KI-Standard) läuft dieselbe Änderung.
    wert(await setzeVerantwortliche(a.supabase, a.id, { terminId: t[2].id, userIds: [a.id], reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(await serienLeute(serieId), [a.id]);
  });

  // ── Kalender: Ausfall (#327) ─────────────────────────────────────────────
  await pruefe("Ausfall: das Training ruht am Termin, Grund, zurücknehmen, verlegen (#327, PO 2026-10-06)", async () => {
    const team = await serienTeam("Kern-DB-Ausfall");
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Ausfall", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", bemerkung: "Leibchen" }));
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: tr.id })).trainingId;
    // Zu langer Grund: vorab abgewiesen, der Termin bleibt unverändert.
    fehler(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "x".repeat(501) }), "eingabe", TERMIN_TEXT.grundLang);
    // Kein Ausfall zum Zurücknehmen.
    fehler(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }), "regel", TERMIN_MELDUNG.NICHT_AUSGEFALLEN);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Platz gesperrt" }));
    const zeile = async () => (await admin.from("training_termine").select("ausgefallen, ausfall_grund, training_id, bemerkung").eq("id", t.terminId).single()).data!;
    assert.deepEqual(await zeile(), { ausgefallen: true, ausfall_grund: "Platz gesperrt", training_id: amTermin, bemerkung: "Leibchen" });
    // AK 9: kein Training auf einen ausgefallenen Termin.
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: tr.id }), "regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN);
    // Auch die Datenebene weist ab (RPC direkt).
    const { error: rpcFehler } = await a.supabase.rpc("termin_training_setzen", { p_termin: t.terminId, p_training: tr.id });
    assert.match(rpcFehler!.message, /TERMIN_AUSGEFALLEN/);
    // Ohne Angabe bleibt der Grund eines ausgefallenen Termins stehen …
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId }));
    assert.equal((await zeile()).ausfall_grund, "Platz gesperrt", "grund weggelassen = unverändert");
    // … «» und null leeren ihn, ein neuer Text ersetzt ihn.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Neu" }));
    assert.equal((await zeile()).ausfall_grund, "Neu");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "" }));
    assert.equal((await zeile()).ausfall_grund, null);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Nochmal" }));
    // AK 3: Grund ändern und leeren, ohne den Ausfall zurückzunehmen.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: null }));
    assert.equal((await zeile()).ausfall_grund, null);
    // PC 3: zurücknehmen → normal, ohne Grund, mit dem Training, das ruhte.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Nochmal" }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    // Ein zweites Zurücknehmen (etwa eines anderen Mitglieds) weist ab.
    fehler(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }), "regel", TERMIN_MELDUNG.NICHT_AUSGEFALLEN);
    // Ein neu markierter Termin ohne Grund trägt keinen.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId }));
    assert.equal((await zeile()).ausfall_grund, null);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    assert.deepEqual(await zeile(), { ausgefallen: false, ausfall_grund: null, training_id: amTermin, bemerkung: "Leibchen" });
    // PC 4/5: Einzeln auf heute oder später verlegt endet der Ausfall, auf gestern nicht.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Regen" }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, datum: tagCh(-1) }));
    assert.equal((await zeile()).ausgefallen, true);
    // Ein anderes Feld beendet den Ausfall nicht.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, ort: "Halle" }));
    assert.equal((await zeile()).ausgefallen, true);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, datum: tagCh(4) }));
    assert.deepEqual(await zeile(), { ausgefallen: false, ausfall_grund: null, training_id: amTermin, bemerkung: "Leibchen" });
    // PC 4, Grenze: Genau auf heute verlegt endet der Ausfall ebenfalls.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Schnee" }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, datum: tagCh(0) }));
    assert.deepEqual(await zeile(), { ausgefallen: false, ausfall_grund: null, training_id: amTermin, bemerkung: "Leibchen" });
  });

  await pruefe("Ausfall: ein inzwischen geänderter Ausfall-Zustand weist ab, nichts wird überschrieben (PO 17)", async () => {
    const team = await serienTeam("Kern-DB-Ausfall-Konflikt");
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30" }));
    const zeile = async () => (await admin.from("training_termine").select("ausgefallen, ausfall_grund").eq("id", t.terminId).single()).data!;
    // (a) «Grund ändern»: Ein anderes Mitglied hat den Ausfall inzwischen zurückgenommen.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Regen" }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    fehler(
      await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Schnee", erwartetAusgefallen: true }),
      "konflikt",
      TERMIN_MELDUNG.AUSFALL_GEAENDERT,
    );
    assert.deepEqual(await zeile(), { ausgefallen: false, ausfall_grund: null }, "bleibt nicht ausgefallen");
    // (b) «Ausfallen lassen»: Ein anderes Mitglied ist zuvorgekommen, sein Grund bleibt.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Fremder Grund" }));
    fehler(
      await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Eigener Grund", erwartetAusgefallen: false }),
      "konflikt",
      TERMIN_MELDUNG.AUSFALL_GEAENDERT,
    );
    assert.deepEqual(await zeile(), { ausgefallen: true, ausfall_grund: "Fremder Grund" }, "fremder Grund bleibt");
    // Passt die Erwartung, schreibt es; ohne Angabe (KI) gilt der eben gelesene Stand.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Neu", erwartetAusgefallen: true }));
    assert.equal((await zeile()).ausfall_grund, "Neu");
    // Termin weg → nicht gefunden.
    await admin.from("training_termine").delete().eq("id", t.terminId);
    fehler(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "x", erwartetAusgefallen: true }), "nicht_gefunden", TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN);
  });

  await pruefe("Ausfall in der Serie: Tausch behält ihn, Serienänderung wirkt wie bei anderen, keine Abweichung (#327 PC 5, 7, 8)", async () => {
    const team = await serienTeam("Kern-DB-Ausfall-Serie");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: tagCh(7), bis: tagCh(49), beginn: "18:00", ende: "19:30", ort: "A" }));
    const t = await termineDer(s.serieId);
    const z = async (id: string) =>
      (await admin.from("training_termine").select("datum, serien_tag, ort, ausgefallen, ausfall_grund, zeit_abweichend, ort_abweichend, bemerkung_abweichend").eq("id", id).single()).data!;
    // PC 8: Markieren und Zurücknehmen setzt kein Abweichungs-Flag.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t[1].id, grund: "Platz gesperrt" }));
    let r = await z(t[1].id);
    assert.deepEqual([r.ausgefallen, r.zeit_abweichend, r.ort_abweichend, r.bemerkung_abweichend, r.datum === r.serien_tag], [true, false, false, false, true]);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t[1].id }));
    r = await z(t[1].id);
    assert.deepEqual([r.ausgefallen, r.zeit_abweichend, r.ort_abweichend, r.bemerkung_abweichend], [false, false, false, false]);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t[1].id, grund: "Platz gesperrt" }));
    // PC 7: Eine Serienänderung trifft den ausgefallenen Termin wie jeden anderen.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { ort: "Halle" } }));
    r = await z(t[1].id);
    assert.deepEqual([r.ort, r.ausgefallen, r.ausfall_grund, r.ort_abweichend], ["Halle", true, "Platz gesperrt", false]);
    // PC 5: Ein Tausch des Wochentags verlegt nicht einzeln — der Ausfall bleibt.
    const wt = wochentagVon(t[1].datum);
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { wochentage: [((wt % 7) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7] }, bestaetigt: true }));
    r = await z(t[1].id);
    assert.deepEqual([r.ausgefallen, r.ausfall_grund, wochentagVon(r.datum)], [true, "Platz gesperrt", (wt % 7) + 1]);
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
    assert.equal(r.verstoesse?.[7].meldung, "Den Übungstyp gibt es nur im Juniorenfussball - lass «uebungstyp» weg.");
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

    wert(await aendereUebung(a.supabase, a.id, { kennung: probe.slug, aenderung: { varianten: null, material: { ergaenzung: null } } }));
    const danach = await uebungszeile(probe.id);
    assert.equal(danach.varianten_text, null);
    assert.deepEqual(danach.material, []);
    assert.deepEqual(danach.material_liste, [{ art: "pylone", farbe: "rot", menge: 4 }], "die gezählte Liste bleibt");

    // Leer oder nur die gleiche Altersstufe: nichts zu ändern bzw. nichts geändert.
    fehler(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: {} }), "eingabe", "Nenne mindestens eine Angabe, die sich ändern soll.");
    wert(await aendereUebung(a.supabase, a.id, { kennung: probe.id, aenderung: {}, altersstufe: "kinderfussball" }));
    assert.deepEqual(await uebungszeile(probe.id), danach, "kein Schreiben, auch updated_at bleibt");
  });

  await pruefe("Übung ändern: jsonb in anderer Schlüsselfolge gilt als gleich - geschrieben wird nur Geändertes", async () => {
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
      "Die Übung wird für alle sichtbar - mit allen Angaben, Bild und Feld-Diagramm - und trägt die " +
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

  await pruefe("Mängel: gespeichert UND gemeldet - beim Setzen, beim Anlegen und jederzeit abrufbar, gleich lautend (#146 AK 1–4, PC 1)", async () => {
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
      // Ein zweiter Versuch ändert daran nichts — keine Aufforderung dazu.
      assert.equal(r.hinweis, "Es ist keine Kopie entstanden.");
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
    assert.equal(uebersetzt.hinweis, "Es ist keine Kopie entstanden.", "eine Regel ändert kein zweiter Versuch");
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
    const r = diagrammAusFormular(form, gespeichert);
    assert.ok(!(r && typeof r === "object" && "fehler" in r), "die Kopie lässt sich speichern");
    // … ein geändertes mit demselben Element weist sie ab.
    const geaendert = parseDiagramm(gespeichert)!;
    form.set("diagramm", JSON.stringify({ ...geaendert, elemente: [{ ...geaendert.elemente[0], x: 500 }] }));
    const r2 = diagrammAusFormular(form, gespeichert);
    assert.ok(r2 && typeof r2 === "object" && "fehler" in r2);

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
  // ── Kalender: persönliches Training als Kopie zuordnen (#328) ──────────
  await pruefe("Persönliches Training: nur als Kopie, Original unberührt, jede Zuordnung eine neue Kopie (#328)", async () => {
    const team = await serienTeam("Kern-DB-Persoenlich");
    const anderes = await serienTeam("Kern-DB-Persoenlich-Anderes");
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" }));
    const t2 = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-2), beginn: "18:00", ende: "19:00" }));
    const p = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Meins", altersstufe: "juniorenfussball", stufen: ["D"] })).id;

    // AK 1, 8, PC 1, 3, 4: Kopie als Termin-Training, auch vergangen; jede Zuordnung eine neue.
    const k1 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: p }));
    const k2 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t2.terminId, trainingId: p }));
    assert.notEqual(k1.trainingId, k2.trainingId);
    const kz = (await admin.from("trainings").select("team_id, owner_id, name, termin_training").eq("id", k1.trainingId).single()).data!;
    assert.deepEqual(kz, { team_id: team, owner_id: null, name: "Kern-DB-Meins", termin_training: true });
    const orig = (await admin.from("trainings").select("owner_id, team_id").eq("id", p).single()).data!;
    assert.deepEqual(orig, { owner_id: a.id, team_id: null }, "PC 3");
    // AK 4: Ein Training eines ANDEREN eigenen Teams geht nicht.
    const fremd = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Fremdteam", altersstufe: "kinderfussball", stufen: ["F"], teamId: anderes })).id;
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: fremd }), "regel", TERMIN_MELDUNG.TERMIN_TRAINING_FREMDES_TEAM);
    // AK 9: nicht auf einen ausgefallenen Termin — und es entsteht keine Kopie.
    wert(await loeseTraining(a.supabase, a.id, { terminId: t1.terminId }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t1.terminId }));
    const vorher = (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count;
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: p }), "regel", TERMIN_MELDUNG.TERMIN_AUSGEFALLEN);
    assert.equal((await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count, vorher);
    // Ein fremdes privates Training bleibt unsichtbar (Epic OoS 4): nicht gefunden.
    fehler(await ordneTrainingZu(b.supabase, b.id, { terminId: t2.terminId, trainingId: p }), "nicht_gefunden");
  });
  await pruefe("Persönliches Training: veraltete Auswahl legt keine Kopie an, ersetzt wird das Termin-Training (#328 AK 11, PC 5/7)", async () => {
    const team = await serienTeam("Kern-DB-Persoenlich-Belegt");
    const anzahl = async () =>
      (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count;
    const termin = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    const traegt = async () => (await admin.from("training_termine").select("training_id").eq("id", termin).single()).data!.training_id;
    const p = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Persoenlich-Kinder", altersstufe: "kinderfussball", stufen: ["F"] })).id;

    // AK 11 (UI-Weg): Wer den Termin ohne Training sah, obwohl er eines trägt, wird abgewiesen — ohne Kopie.
    const altes = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Alt", altersstufe: "kinderfussball", stufen: ["F"], teamId: team })).id;
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: altes })).trainingId;
    const vorher = await anzahl();
    fehler(
      await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: p, erwartet: { terminTraining: null } }),
      "konflikt",
      TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT,
    );
    assert.equal(await anzahl(), vorher, "veraltete Auswahl: keine Kopie");
    assert.equal(await traegt(), amTermin, "der Termin bleibt unverändert");

    // PC 5, AK 7: Mit zutreffender Erwartung wird die Kopie verknüpft; das ersetzte Termin-Training geht.
    const z = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: p, erwartet: { terminTraining: amTermin } }));
    assert.deepEqual(z.ersetzt, { trainingId: amTermin, geloescht: true }, "das ersetzte Training wird genannt");
    assert.equal(await traegt(), z.trainingId, "der Termin trägt die Kopie");
    assert.notEqual(z.trainingId, p);
    assert.equal((await admin.from("trainings").select("team_id").eq("id", altes).single()).data!.team_id, team, "die Quelle bleibt im Team-Bestand");
    assert.equal(await anzahl(), vorher, "eine Kopie kam hinzu, eine ging");
  });

  // ── Kalender: Abo (#330) ─────────────────────────────────────────────────
  // Der Feed ist ohne Anmeldung aufrufbar (das Geheimnis ist die Berechtigung),
  // die Tabelle selbst nur für den Besitzer des Abos lesbar.
  const feldAnon = createClient(URL_, process.env.SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const holen = async (k: Konto, team: string) => {
    const { data, error } = await k.supabase.rpc("kalender_abo_holen", { p_team: team });
    return { token: data as string | null, error };
  };
  const feed = async (token: string) => {
    const { data, error } = await feldAnon.rpc("kalender_abo_termine", { p_token: token });
    if (error) throw error;
    return data as {
      gueltig: boolean;
      team?: { id: string; name: string };
      termine?: { id: string; datum: string; beginn: string; ende: string; ort: string | null; geaendert: string }[];
    };
  };
  const aboZeilen = async (team: string, user?: string) => {
    let q = admin.from("kalender_abos").select("id, token, user_id").eq("team_id", team);
    if (user) q = q.eq("user_id", user);
    return (await q).data ?? [];
  };
  const austreten = async (k: Konto, team: string, bestaetigt = false) => {
    const { error } = await k.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: k.id, p_bestaetigt: bestaetigt });
    if (error) throw error;
  };

  await pruefe("Abo holen: derselbe Link bei jedem Aufruf, 64 Hex-Zeichen, Nichtmitglied abgewiesen (#330 AK 6, 11)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Holen");
    const eins = await holen(a, team);
    const zwei = await holen(a, team);
    assert.equal(eins.error, null);
    assert.match(eins.token!, /^[0-9a-f]{64}$/, "64 Hex-Zeichen");
    assert.equal(zwei.token, eins.token, "AK 6: derselbe Link");
    assert.equal((await aboZeilen(team, a.id)).length, 1, "AK 10: höchstens ein Link je Mitglied und Team");
    // Ein anderes Mitglied desselben Teams bekommt einen eigenen Link.
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const fuerB = await holen(b, team);
    assert.match(fuerB.token!, /^[0-9a-f]{64}$/);
    assert.notEqual(fuerB.token, eins.token);
    // Wer nicht im Team ist (oder ein unbekanntes Team nennt): nicht gefunden, und es entsteht nichts.
    const fremdesTeam = await serienTeam("Kern-DB-Abo-Fremd");
    const abgewiesen = await holen(b, fremdesTeam);
    assert.equal(abgewiesen.token, null);
    assert.match(abgewiesen.error!.message, /TEAM_NICHT_GEFUNDEN/);
    assert.match((await holen(a, randomUUID())).error!.message, /TEAM_NICHT_GEFUNDEN/);
    assert.equal((await aboZeilen(fremdesTeam, b.id)).length, 0);
    // Ein Abo ohne Mitgliedschaft kann es nicht geben (Fremdschlüssel auf team_members), auch nicht
    // durch ein direktes Einfügen — das schliesst das Rennen «holen während Entfernen».
    const ohneMitglied = await admin.from("kalender_abos").insert({ team_id: fremdesTeam, user_id: b.id });
    assert.equal(ohneMitglied.error?.code, "23503", "kein Abo ohne Mitgliedschaft");
    // Ohne Anmeldung gibt es kein Abo zu holen — die RPC ist für anon nicht aufrufbar.
    assert.ok((await feldAnon.rpc("kalender_abo_holen", { p_team: team })).error, "anon darf kalender_abo_holen nicht aufrufen");
  });

  await pruefe("Abo-Tabelle: nur das eigene Abo lesbar, nicht schreibbar, für anon gesperrt (#330 AK 11)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Rls");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const ta = (await holen(a, team)).token!;
    const tb = (await holen(b, team)).token!;
    const sichtA = (await a.supabase.from("kalender_abos").select("token").eq("team_id", team)).data ?? [];
    assert.deepEqual(sichtA.map((z) => z.token), [ta], "a sieht nur das eigene Abo");
    const sichtB = (await b.supabase.from("kalender_abos").select("token").eq("team_id", team)).data ?? [];
    assert.deepEqual(sichtB.map((z) => z.token), [tb], "b sieht nur das eigene Abo");
    // Schreiben geht nur über die RPC.
    const ins = await a.supabase.from("kalender_abos").insert({ team_id: team, user_id: a.id, token: "x".repeat(64) });
    assert.ok(ins.error, "direktes Einfügen ist gesperrt");
    const upd = await a.supabase.from("kalender_abos").update({ token: "y".repeat(64) }).eq("team_id", team).select();
    assert.ok(upd.error || (upd.data ?? []).length === 0, "direktes Ändern ist gesperrt");
    assert.equal((await aboZeilen(team, a.id))[0].token, ta, "Token unverändert");
    // anon: weder lesen noch schreiben.
    const anonLesen = await feldAnon.from("kalender_abos").select("token");
    assert.ok(anonLesen.error, "anon hat nicht einmal das Leserecht");
    assert.ok((await feldAnon.from("kalender_abos").insert({ team_id: team, user_id: a.id })).error);
    // Fremdes Abo löschen bleibt wirkungslos (RLS).
    await b.supabase.from("kalender_abos").delete().eq("token", ta);
    assert.equal((await aboZeilen(team, a.id)).length, 1, "fremdes Abo bleibt");
    // Das eigene löschen geht; ein neuer Aufruf legt dann einen neuen Link an.
    await a.supabase.from("kalender_abos").delete().eq("token", ta);
    assert.equal((await aboZeilen(team, a.id)).length, 0);
    assert.notEqual((await holen(a, team)).token, ta, "nach dem Löschen ein neuer Link");
  });

  await pruefe("Abo-Feed: ohne Anmeldung, nur Zeit und Ort, anstehende und die der letzten 28 Tage, ohne ausgefallene (#330 PC 1, 2, 5, 6)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Feed");
    // Das Fenster hängt am Kalendertag der DB: heute frisch rechnen, nicht den
    // beim Start gemerkten nehmen (sonst kippt der Test um Mitternacht).
    const tagCh = (d: number) => plusTage(kalendertagAmTrainingsort(), d);
    const token = (await holen(a, team)).token!;
    const ins = async (d: string, extra: Record<string, unknown> = {}) => {
      const { data, error } = await admin
        .from("training_termine")
        .insert({ team_id: team, datum: d, beginn: "18:00", ende: "19:15", ort: "Sportplatz", bemerkung: "geheim", ...extra })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    };
    const anstehend = await ins(tagCh(3));
    const heute = await ins(tagCh(0), { ort: null });
    const grenze = await ins(tagCh(-28));
    const zuAlt = await ins(tagCh(-29));
    const ausgefallen = await ins(tagCh(5), { ausgefallen: true, ausfall_grund: "Regen" });
    const ausgefallenVergangen = await ins(tagCh(-3), { ausgefallen: true });

    const f = await feed(token);
    assert.equal(f.gueltig, true);
    assert.deepEqual(f.team, { id: team, name: "Kern-DB-Abo-Feed" });
    const ids = f.termine!.map((t) => t.id);
    assert.deepEqual(ids, [grenze, heute, anstehend], "Datumsfolge: heute−28, heute, anstehend");
    assert.ok(!ids.includes(zuAlt), "älter als 28 Tage fehlt");
    assert.ok(!ids.includes(ausgefallen) && !ids.includes(ausgefallenVergangen), "Ausgefallene fehlen");
    for (const t of f.termine!)
      assert.deepEqual(Object.keys(t).sort(), ["beginn", "datum", "ende", "geaendert", "id", "ort"], "nur Zeit und Ort - weder Bemerkung noch Verantwortliche noch Training");
    const a1 = f.termine!.find((t) => t.id === anstehend)!;
    assert.deepEqual(
      { datum: a1.datum, beginn: a1.beginn, ende: a1.ende, ort: a1.ort },
      { datum: tagCh(3), beginn: "18:00", ende: "19:15", ort: "Sportplatz" },
    );
    assert.ok(!Number.isNaN(Date.parse(a1.geaendert)), "geaendert ist ein Zeitstempel");
    const ohne = f.termine!.find((t) => t.id === heute)!;
    assert.equal(ohne.ort, null, "ein Termin ohne Ort bleibt im Feed");
    // Ein Termin eines anderen Teams taucht nicht auf.
    const fremd = await serienTeam("Kern-DB-Abo-Feed-Fremd");
    await admin.from("training_termine").insert({ team_id: fremd, datum: tagCh(4), beginn: "18:00", ende: "19:30" });
    assert.equal((await feed(token)).termine!.length, 3);
    // Eine Änderung zeigt sich im Zeitstempel.
    const vorher = a1.geaendert;
    await admin.from("training_termine").update({ ort: "Halle" }).eq("id", anstehend);
    const danach = (await feed(token)).termine!.find((t) => t.id === anstehend)!;
    assert.equal(danach.ort, "Halle");
    assert.ok(Date.parse(danach.geaendert) > Date.parse(vorher), "geaendert rückt bei Änderung vor");
    // Unbekannte und abgeschnittene Token: ungültig, ohne Hinweis auf das Team.
    for (const t of ["", "0".repeat(64), token.slice(0, 63), token.toUpperCase()])
      assert.deepEqual(await feed(t), { gueltig: false }, `Token «${t.slice(0, 8)}…» ist ungültig`);
  });

  await pruefe("Abo-Feed über den Kern-Pfad: Festlegen, Verlegen, Ausfallen, Entfernen - der Termin erscheint genau einmal im neuen Stand (#330 PC 1, 5, 6)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Kern");
    const tagCh = (d: number) => plusTage(kalendertagAmTrainingsort(), d);
    const token = (await holen(a, team)).token!;
    const alt = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-29), beginn: "10:00", ende: "11:00" }));
    const rand = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(-28), beginn: "10:00", ende: "11:00" }));
    const aus = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "10:00", ende: "11:00" }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: aus.terminId }));
    const ids = async () => (await feed(token)).termine!.map((t) => t.id);
    assert.deepEqual(await ids(), [rand.terminId], "PC 1, 5: heute−28 ja, heute−29 und Ausgefallene nein");
    assert.ok(!(await ids()).includes(alt.terminId));
    // PC 6: Verlegen ändert den Stand, die Kennung bleibt — genau ein Eintrag.
    wert(await aendereTermin(a.supabase, a.id, { terminId: rand.terminId, datum: tagCh(4), beginn: "17:00", ende: "18:30", ort: "Halle" }));
    const nachVerlegen = (await feed(token)).termine!;
    assert.equal(nachVerlegen.length, 1, "genau einmal");
    assert.deepEqual(
      { id: nachVerlegen[0].id, datum: nachVerlegen[0].datum, beginn: nachVerlegen[0].beginn, ende: nachVerlegen[0].ende, ort: nachVerlegen[0].ort },
      { id: rand.terminId, datum: tagCh(4), beginn: "17:00", ende: "18:30", ort: "Halle" },
    );
    // Ausfall zurücknehmen bringt den Termin wieder; Entfernen nimmt ihn weg.
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: aus.terminId }));
    assert.deepEqual(await ids(), [aus.terminId, rand.terminId], "Datumsfolge: heute+2, heute+4");
    wert(await entferneTermin(a.supabase, a.id, { terminId: aus.terminId }));
    assert.deepEqual(await ids(), [rand.terminId], "PC 5: entfernt");
  });

  await pruefe("Abo erlischt beim Austritt und lebt bei erneuter Aufnahme nicht wieder auf (#330 AK 9, PC 9, 10)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Austritt");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    await admin.from("training_termine").insert({ team_id: team, datum: tagCh(2), beginn: "18:00", ende: "19:30" });
    const alt = (await holen(b, team)).token!;
    const vonA = (await holen(a, team)).token!;
    assert.equal((await feed(alt)).gueltig, true);
    await austreten(b, team);
    assert.deepEqual(await feed(alt), { gueltig: false }, "PC 9: Link ungültig");
    assert.equal((await aboZeilen(team, b.id)).length, 0, "die Zeile ist weg");
    assert.equal((await feed(vonA)).gueltig, true, "das Abo der Verbliebenen gilt weiter");
    // Nichtmitglied holt nichts mehr.
    assert.match((await holen(b, team)).error!.message, /TEAM_NICHT_GEFUNDEN/);
    // PC 10: Wiederaufnahme belebt den alten Link nicht.
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    assert.deepEqual(await feed(alt), { gueltig: false }, "PC 10: der alte Link bleibt tot");
    const neu = (await holen(b, team)).token!;
    assert.notEqual(neu, alt, "AK 9: ein neuer Link");
    assert.equal((await feed(neu)).gueltig, true);
  });

  await pruefe("Abo erlischt beim Entfernen durch ein anderes Mitglied, bei Teamauflösung und bei Kontolöschung (#330 PC 9)", async () => {
    // Entfernen durch ein anderes Mitglied.
    const team = await serienTeam("Kern-DB-Abo-Entfernen");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const tb = (await holen(b, team)).token!;
    const { error } = await a.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: b.id, p_bestaetigt: false });
    assert.equal(error, null);
    assert.deepEqual(await feed(tb), { gueltig: false });
    assert.equal((await aboZeilen(team, b.id)).length, 0);

    // Auflösung: das letzte Mitglied tritt aus; Team und Abo sind weg.
    const aufgeloest = await serienTeam("Kern-DB-Abo-Aufloesen");
    const ta = (await holen(a, aufgeloest)).token!;
    await austreten(a, aufgeloest, true);
    assert.equal((await admin.from("teams").select("id").eq("id", aufgeloest)).data!.length, 0, "Team aufgelöst");
    assert.deepEqual(await feed(ta), { gueltig: false });
    assert.equal((await aboZeilen(aufgeloest)).length, 0);

    // Kontolöschung.
    const c = await wegwerfKonto();
    const tc = await serienTeam("Kern-DB-Abo-Konto");
    await admin.from("team_members").insert({ team_id: tc, user_id: c.id });
    const token = (await holen(c, tc)).token!;
    assert.equal((await feed(token)).gueltig, true);
    const { error: e2 } = await admin.auth.admin.deleteUser(c.id);
    if (e2) throw e2;
    konten.splice(konten.indexOf(c.id), 1);
    assert.deepEqual(await feed(token), { gueltig: false });
    assert.equal((await aboZeilen(tc)).length, 0, "kein verwaistes Abo");
  });

  // ── Kalender: Felder eines Termins (#389) ────────────────────────────────
  const KUNSTRASEN: Feld = { laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0, tor_7m: null }, untergrund: "kunstrasen" };
  const UNBEKANNT: Feld = { laenge_m: null, breite_m: null, tore: { minitor: null, tor_5m: null, tor_7m: null }, untergrund: null };
  const felderVon = async (id: string) =>
    (await admin.from("training_termine").select("felder").eq("id", id).single()).data!.felder as Felder | null;

  await pruefe("Felder: TS- und SQL-Zwilling nehmen dieselben Werte an (#389 AK 9)", async () => {
    const mit = (f: Record<string, unknown>) => [{ ...KUNSTRASEN, ...f }];
    const faelle: unknown[] = [
      null,
      [],
      [KUNSTRASEN],
      [KUNSTRASEN, UNBEKANNT],
      mit({ laenge_m: 5, breite_m: 120 }),
      mit({ laenge_m: 4 }),
      mit({ breite_m: 121 }),
      mit({ laenge_m: 30.5 }),
      mit({ laenge_m: null }),
      mit({ laenge_m: null, breite_m: null }),
      mit({ laenge_m: "30" }),
      mit({ tore: { minitor: 0, tor_5m: 0, tor_7m: 0 } }),
      mit({ tore: { minitor: 9_007_199_254_740_991, tor_5m: null, tor_7m: null } }),
      mit({ tore: { minitor: -1, tor_5m: null, tor_7m: null } }),
      mit({ tore: { minitor: 1.5, tor_5m: null, tor_7m: null } }),
      mit({ tore: { minitor: "2", tor_5m: null, tor_7m: null } }),
      mit({ tore: { minitor: null, tor_5m: null } }),
      mit({ tore: { minitor: null, tor_5m: null, tor_7m: null, tor_3m: 1 } }),
      mit({ tore: null }),
      mit({ untergrund: "halle" }),
      mit({ untergrund: "sand" }),
      mit({ untergrund: 1 }),
      mit({ extra: true }),
      [null],
      [[]],
      { laenge_m: 30 },
      "30 × 30",
      [{ laenge_m: 30, breite_m: 30, tore: { minitor: null, tor_5m: null, tor_7m: null } }],
    ];
    for (const f of faelle) {
      const { data, error } = await admin.rpc("termin_felder_gueltig", { p: f as never });
      if (error) throw error;
      assert.equal(data, felderProblem(f) === null, `Zwilling uneins bei ${JSON.stringify(f)}`);
    }
  });

  await pruefe("Felder: festlegen, ändern, entfernen, ungültig abgewiesen, Plan und Auskunft (#389 AK 1–9, 12–15)", async () => {
    const team = await serienTeam("Kern-DB-Felder");
    // AK 8: ohne Felder.
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:30" }));
    assert.equal(await felderVon(ohne.terminId), null);
    // AK 1–6: mehrere Felder, Angaben einzeln offen, «keine» als 0; fehlende Angaben werden unbekannt.
    const t = wert(
      await legeTerminFest(a.supabase, a.id, {
        teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30",
        felder: [{ laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0 }, untergrund: "kunstrasen" }, {}],
      }),
    );
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN, UNBEKANNT]);
    // Eine leere Liste heisst ohne Felder.
    const leer = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", felder: [] }));
    assert.equal(await felderVon(leer.terminId), null);

    // AK 9, 15: vorab abgewiesen, mit dem Satz der Oberfläche und der Stelle; es entsteht nichts.
    const vorher = (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count;
    const r = fehler(
      await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:30", felder: [{}, { laenge_m: 30 }] }),
      "eingabe",
      MASS_TEXT.paarweise,
    ) as { feld?: string };
    assert.equal(r.feld, "felder[1].breite_m");
    assert.equal((await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count, vorher);

    // AK 7: ändern als ganze Liste; geschrieben wird nur `felder` (PO 17).
    const spur: string[][] = [];
    const mitSpur = new Proxy(a.supabase, {
      get(ziel, name, empf) {
        if (name === "from")
          return (tabelle: string) => {
            const q = ziel.from(tabelle);
            return tabelle !== "training_termine"
              ? q
              : new Proxy(q, {
                  get(z, n, r2) {
                    if (n === "update")
                      return (nutzlast: object) => {
                        spur.push(Object.keys(nutzlast).sort());
                        return z.update(nutzlast as never);
                      };
                    const v = Reflect.get(z, n, r2);
                    return typeof v === "function" ? v.bind(z) : v;
                  },
                });
          };
        const v = Reflect.get(ziel, name, empf);
        return typeof v === "function" ? v.bind(ziel) : v;
      },
    });
    wert(await aendereTermin(mitSpur, a.id, { terminId: t.terminId, felder: [{ ...KUNSTRASEN, untergrund: "naturrasen" }] }));
    assert.deepEqual(spur, [["felder"]]);
    assert.deepEqual(await felderVon(t.terminId), [{ ...KUNSTRASEN, untergrund: "naturrasen" }]);
    // Ungültig: abgewiesen, der Stand bleibt.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, felder: [{ ...KUNSTRASEN, untergrund: "sand" }] }), "eingabe", FELDER_TEXT.untergrund);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, felder: [{ ...KUNSTRASEN, tore: { minitor: -1 } }] }), "eingabe", FELDER_TEXT.tore);
    assert.deepEqual(await felderVon(t.terminId), [{ ...KUNSTRASEN, untergrund: "naturrasen" }]);
    // Ein anderes Feld des Termins lässt die Felder stehen.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, ort: "Allmend" }));
    assert.deepEqual(await felderVon(t.terminId), [{ ...KUNSTRASEN, untergrund: "naturrasen" }]);

    // AK 12, 15 über den KI-Weg: dieselbe Eingabeprüfung des Werkzeugs, derselbe Satz.
    const ki = TerminAendernEingabe.parse({ termin_id: t.terminId, felder: [{ laenge_m: 30.5, breite_m: 25 }] });
    const kiFehler = fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, felder: ki.felder }), "eingabe", MASS_TEXT.bereich) as { feld?: string };
    assert.equal(kiFehler.feld, "felder[0].laenge_m");
    const kiOk = TerminAendernEingabe.parse({ termin_id: t.terminId, felder: [{ laenge_m: 40, breite_m: 30, untergrund: "hartplatz" }] });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, felder: kiOk.felder }));
    assert.deepEqual(await felderVon(t.terminId), [{ laenge_m: 40, breite_m: 30, tore: UNBEKANNT.tore, untergrund: "hartplatz" }]);
    // KI: null entfernt.
    const kiWeg = TerminAendernEingabe.parse({ termin_id: t.terminId, felder: null });
    assert.equal(kiWeg.felder, null);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, felder: kiWeg.felder }));
    assert.equal(await felderVon(t.terminId), null, "AK 7: entfernt");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, felder: [KUNSTRASEN, UNBEKANNT] }));

    // Die Datenebene als Rückhalt: wer den Kern umgeht, bekommt den Klartext.
    const { error: direkt } = await a.supabase.from("training_termine").update({ felder: [{ laenge_m: 30 }] }).eq("id", t.terminId);
    assert.ok(direkt, "CHECK tt_felder weist ab");
    const e = ausDbFehler(direkt!);
    assert.equal(e.art, "regel");
    assert.equal(e.meldung, FELDER_TEXT.ungueltig);
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN, UNBEKANNT]);

    // AK 10, 13, 14: Plan und Auskunft nennen die Felder; unbekannt als null.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const imPlan = (id: string) => plan.kommend.find((x) => x.id === id)!;
    assert.deepEqual(imPlan(t.terminId).felder, [KUNSTRASEN, UNBEKANNT]);
    assert.equal(imPlan(ohne.terminId).felder, null);
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Felder", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    // Ein Bestands-Training mit Termin (direkt verknüpft wie vor den Termin-Trainings).
    await admin.from("training_termine").update({ training_id: tr.id }).eq("id", t.terminId);
    const aus = wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tr.id }));
    assert.deepEqual(aus.termin?.felder, felderAusgabe([KUNSTRASEN, UNBEKANNT]));
    assert.deepEqual(aus.termin?.felder?.[0].untergrund, { slug: "kunstrasen", label: "Kunstrasen" });
    const such = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team, limit: 5 }));
    assert.deepEqual(such.treffer.find((x) => x.id === tr.id)?.termin?.felder, [KUNSTRASEN, UNBEKANNT]);
  });

  await pruefe("Felder bleiben beim Zuordnen, Ersetzen, Lösen und Ausfallen; nicht im Abo (#389 PC 1, OoS 4)", async () => {
    const team = await serienTeam("Kern-DB-Felder-Bestand");
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", ort: "Platz", felder: [KUNSTRASEN] }));
    const t1 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Felder-1", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const t2 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Felder-2", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: t1.id }));
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN], "zuordnen");
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: t2.id }));
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN], "ersetzen");
    wert(await loeseTraining(a.supabase, a.id, { terminId: t.terminId }));
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN], "lösen");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Regen" }));
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN], "ausfallen");
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN], "zurücknehmen");
    // OoS 4: Das Abo nennt nur Zeit und Ort.
    const token = (await holen(a, team)).token!;
    const imFeed = (await feed(token)).termine!.find((x) => x.id === t.terminId)!;
    assert.deepEqual(Object.keys(imFeed).sort(), ["beginn", "datum", "ende", "geaendert", "id", "ort"]);
  });

  // ── Kalender: erwartete Spielerzahl (#390) ───────────────────────────────
  const zahlVon = async (id: string) =>
    (await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", id).single()).data!.erwartete_spielerzahl as number | null;

  await pruefe("Spielerzahl: festlegen, ändern, entfernen, abgewiesen, KI-Parität, Plan und Auskunft (#390 AK 1–7)", async () => {
    const team = await serienTeam("Kern-DB-Spielerzahl");
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:30" }));
    assert.equal(await zahlVon(ohne.terminId), null, "PC 2: ohne Angabe unbekannt");
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", spielerzahl: 12 }));
    assert.equal(await zahlVon(t.terminId), 12);
    // AK 3: nur ganze Zahlen von 1 bis 200; vorab abgewiesen, es entsteht nichts.
    for (const schlecht of [0, 201, 12.5])
      fehler(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", spielerzahl: schlecht }), "eingabe", TERMIN_TEXT.spielerzahl);
    assert.equal((await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count, 2);
    wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", spielerzahl: 200 }));
    // AK 2: ändern und entfernen; eine andere Angabe lässt die Zahl stehen.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, spielerzahl: 1 }));
    assert.equal(await zahlVon(t.terminId), 1);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, ort: "Allmend" }));
    assert.equal(await zahlVon(t.terminId), 1);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, spielerzahl: -1 }), "eingabe", TERMIN_TEXT.spielerzahl);
    assert.equal(await zahlVon(t.terminId), 1, "abgewiesen heisst unverändert");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, spielerzahl: null }));
    assert.equal(await zahlVon(t.terminId), null);

    // AK 5, 7 über den KI-Weg: Eingabeprüfung des Werkzeugs, dann derselbe Satz.
    const halb = TerminAendernEingabe.parse({ termin_id: t.terminId, erwartete_spielerzahl: 12.5 });
    const kiFehler = fehler(
      await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, spielerzahl: halb.erwartete_spielerzahl }),
      "eingabe",
      TERMIN_TEXT.spielerzahl,
    ) as { feld?: string };
    assert.equal(kiFehler.feld, "erwartete_spielerzahl");
    const ki = TerminAendernEingabe.parse({ termin_id: t.terminId, erwartete_spielerzahl: 14 });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, spielerzahl: ki.erwartete_spielerzahl }));
    assert.equal(await zahlVon(t.terminId), 14);
    const weg = TerminAendernEingabe.parse({ termin_id: t.terminId, erwartete_spielerzahl: null });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t.terminId, spielerzahl: weg.erwartete_spielerzahl }));
    assert.equal(await zahlVon(t.terminId), null, "KI: null entfernt");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t.terminId, spielerzahl: 12 }));

    // Die Datenebene als Rückhalt: wer den Kern umgeht, bekommt den Klartext.
    const { error: direkt } = await a.supabase.from("training_termine").update({ erwartete_spielerzahl: 0 }).eq("id", t.terminId);
    assert.ok(direkt, "CHECK tt_spielerzahl weist ab");
    const e = ausDbFehler(direkt!);
    assert.deepEqual([e.art, e.meldung], ["regel", TERMIN_TEXT.spielerzahl]);
    assert.equal(await zahlVon(t.terminId), 12);

    // AK 4, 6: Plan, Auskunft und Suche nennen die Zahl; unbekannt als null.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.equal(plan.kommend.find((x) => x.id === t.terminId)!.spielerzahl, 12);
    assert.equal(plan.kommend.find((x) => x.id === ohne.terminId)!.spielerzahl, null);
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Spielerzahl", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    // Ein Bestands-Training mit Termin (direkt verknüpft wie vor den Termin-Trainings).
    await admin.from("training_termine").update({ training_id: tr.id }).eq("id", t.terminId);
    assert.equal(wert(await trainingAbrufen(a.supabase, a.id, { trainingId: tr.id })).termin?.erwartete_spielerzahl, 12);
    const such = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team, limit: 5 }));
    assert.equal(such.treffer.find((x) => x.id === tr.id)?.termin?.spielerzahl, 12);
  });

  await pruefe("Spielerzahl bleibt beim Zuordnen, Ersetzen, Lösen und Ausfallen; nicht im Abo (#390 PC 1, OoS 5)", async () => {
    const team = await serienTeam("Kern-DB-Spielerzahl-Bestand");
    const t = wert(await legeTerminFest(a.supabase, a.id, { teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", spielerzahl: 12 }));
    const t1 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zahl-1", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const t2 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zahl-2", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: t1.id }));
    wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t.terminId, trainingId: t2.id }));
    wert(await loeseTraining(a.supabase, a.id, { terminId: t.terminId }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t.terminId, grund: "Regen" }));
    assert.equal(await zahlVon(t.terminId), 12, "zuordnen, ersetzen, lösen, ausfallen");
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t.terminId }));
    assert.equal(await zahlVon(t.terminId), 12);
    // OoS 5: Das Abo nennt nur Zeit und Ort.
    const imFeed = (await feed((await holen(a, team)).token!)).termine!.find((x) => x.id === t.terminId)!;
    assert.deepEqual(Object.keys(imFeed).sort(), ["beginn", "datum", "ende", "geaendert", "id", "ort"]);
  });

  // ── Kalender: Felder und Spielerzahl einer Terminserie (#391) ─────────────
  const RASEN: Feld = { ...UNBEKANNT, laenge_m: 40, breite_m: 30, untergrund: "naturrasen" };
  const platzVon = async (id: string) =>
    (
      await admin
        .from("training_termine")
        .select("felder, erwartete_spielerzahl, felder_abweichend, spielerzahl_abweichend")
        .eq("id", id)
        .single()
    ).data! as { felder: Felder | null; erwartete_spielerzahl: number | null; felder_abweichend: boolean; spielerzahl_abweichend: boolean };
  const platzDerSerie = async (id: string) =>
    (await admin.from("termin_serien").select("felder, erwartete_spielerzahl").eq("id", id).single()).data! as {
      felder: Felder | null;
      erwartete_spielerzahl: number | null;
    };

  await pruefe("Serie mit Feldern und Spielerzahl festlegen: jeder Termin trägt sie, dieselben Regeln (#391 AK 1, 10; PC 1, 7)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Platz");
    // AK 10: vorab abgewiesen mit den Sätzen des einzelnen Termins; es entsteht nichts.
    const basis = { teamId: team, wochentage: [2 as const], von: tagCh(7), bis: tagCh(28), beginn: "18:00", ende: "19:30" };
    const ungueltig = fehler(await legeSerieFest(a.supabase, a.id, { ...basis, felder: [{ laenge_m: 30 }] }), "eingabe", MASS_TEXT.paarweise) as { feld?: string };
    assert.equal(ungueltig.feld, "felder[0].breite_m");
    fehler(await legeSerieFest(a.supabase, a.id, { ...basis, spielerzahl: 0 }), "eingabe", TERMIN_TEXT.spielerzahl);
    assert.equal((await admin.from("termin_serien").select("id").eq("team_id", team)).data!.length, 0);
    // Die Datenebene als Rückhalt (CHECK ts_felder), mit dem Klartext.
    const { error: direkt } = await a.supabase.rpc("terminserie_festlegen", {
      p_team: team, p_wochentage: [2], p_von: tagCh(7), p_bis: tagCh(28), p_beginn: "18:00", p_ende: "19:30",
      p_ort: null, p_bemerkung: null, p_felder: [{ laenge_m: 30 }],
    });
    assert.deepEqual([ausDbFehler(direkt!).art, ausDbFehler(direkt!).meldung], ["regel", FELDER_TEXT.ungueltig]);

    const s = wert(await legeSerieFest(a.supabase, a.id, { ...basis, felder: [KUNSTRASEN], spielerzahl: 12 }));
    assert.deepEqual(await platzDerSerie(s.serieId), { felder: [KUNSTRASEN], erwartete_spielerzahl: 12 });
    for (const t of await termineDer(s.serieId))
      assert.deepEqual(await platzVon(t.id), { felder: [KUNSTRASEN], erwartete_spielerzahl: 12, felder_abweichend: false, spielerzahl_abweichend: false });
    // AK 9 und Plan: Die Serie nennt ihre Werte.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.deepEqual([plan.kommend[0].serie?.felder, plan.kommend[0].serie?.spielerzahl], [[KUNSTRASEN], 12]);
    assert.deepEqual(plan.kommend[0].abweichungen, []);
    // PC 7: eine Serie ohne Angaben bleibt ohne.
    const ohne = wert(await legeSerieFest(a.supabase, a.id, { ...basis, wochentage: [4] }));
    assert.deepEqual(await platzDerSerie(ohne.serieId), { felder: null, erwartete_spielerzahl: null });
  });

  await pruefe("Serie: nur dieser weicht ab (auch bewusst leer), alle behält Abweichungen, folgen holt zurück (#391 AK 2, 3, 5, 6; PC 2–6)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Platz-Reichweite");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: tagCh(7), bis: tagCh(35), beginn: "18:00", ende: "19:30", felder: [KUNSTRASEN], spielerzahl: 12 }));
    const [t0, t1, t2, t3] = await termineDer(s.serieId);
    // PC 4: nur dieser macht die geänderte Angabe zur Abweichung — je Angabe für sich (AK 7).
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t1.id, reichweite: "nur_dieser", felder: [RASEN] }));
    assert.deepEqual(await platzVon(t1.id), { felder: [RASEN], erwartete_spielerzahl: 12, felder_abweichend: true, spielerzahl_abweichend: false });
    // PC 5 / AK 3: entfernen macht den Termin bewusst leer — er weicht ab und ist unbekannt.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t2.id, reichweite: "nur_dieser", spielerzahl: null }));
    assert.deepEqual(await platzVon(t2.id), { felder: [KUNSTRASEN], erwartete_spielerzahl: null, felder_abweichend: false, spielerzahl_abweichend: true });
    // Ein unveränderter Wert setzt kein Flag.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t3.id, reichweite: "nur_dieser", spielerzahl: 12 }));
    assert.equal((await platzVon(t3.id)).spielerzahl_abweichend, false);
    // AK 5: Der Plan nennt die Abweichungen.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const abw = (id: string) => plan.kommend.find((x) => x.id === id)!.abweichungen;
    assert.deepEqual([abw(t1.id), abw(t2.id), abw(t0.id)], [["felder"], ["spielerzahl"], []]);

    // PC 2, 6: «alle» übernimmt in alle, die nicht abweichen; Abweichungen bleiben.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t0.id, reichweite: "alle", spielerzahl: 14, felder: [UNBEKANNT] }));
    assert.deepEqual(await platzDerSerie(s.serieId), { felder: [UNBEKANNT], erwartete_spielerzahl: 14 });
    assert.deepEqual(await platzVon(t0.id), { felder: [UNBEKANNT], erwartete_spielerzahl: 14, felder_abweichend: false, spielerzahl_abweichend: false });
    assert.deepEqual(await platzVon(t1.id), { felder: [RASEN], erwartete_spielerzahl: 14, felder_abweichend: true, spielerzahl_abweichend: false });
    assert.deepEqual(await platzVon(t2.id), { felder: [UNBEKANNT], erwartete_spielerzahl: null, felder_abweichend: false, spielerzahl_abweichend: true });
    // PC 3: Der gewählte Termin folgt danach wieder der Serie, auch wenn er abwich.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t2.id, reichweite: "alle", spielerzahl: 16 }));
    assert.deepEqual(await platzVon(t2.id), { felder: [UNBEKANNT], erwartete_spielerzahl: 16, felder_abweichend: false, spielerzahl_abweichend: false });
    // Die Serie auf «unbekannt» setzen (Schlüssel mit null).
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t0.id, reichweite: "alle", felder: null }));
    assert.deepEqual(await platzDerSerie(s.serieId), { felder: null, erwartete_spielerzahl: 16 });
    assert.equal((await platzVon(t0.id)).felder, null);
    assert.deepEqual((await platzVon(t1.id)).felder, [RASEN], "die Abweichung bleibt");

    // AK 6: wieder der Serie folgen — je Angabe; über den KI-Weg dasselbe Werkzeug.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: t1.id, angaben: ["felder"] }));
    assert.deepEqual(await platzVon(t1.id), { felder: null, erwartete_spielerzahl: 16, felder_abweichend: false, spielerzahl_abweichend: false });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t3.id, reichweite: "nur_dieser", spielerzahl: 9 }));
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: t3.id, angaben: ["spielerzahl"] }));
    assert.deepEqual(await platzVon(t3.id), { felder: null, erwartete_spielerzahl: 16, felder_abweichend: false, spielerzahl_abweichend: false });
    // AK 10: Ungültiges für die Serie mit denselben Sätzen.
    fehler(await aendereSerie(a.supabase, a.id, { terminId: t0.id, reichweite: "alle", aenderung: { spielerzahl: 201 } }), "eingabe", TERMIN_TEXT.spielerzahl);
    fehler(await aendereSerie(a.supabase, a.id, { terminId: t0.id, reichweite: "alle", aenderung: { felder: [{ untergrund: "sand" }] } }), "eingabe", FELDER_TEXT.untergrund);
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: t0.id, angaben: ["platz" as never] }), "eingabe", SERIE_MELDUNG.SERIE_ANGABEN_UNGUELTIG);
  });

  await pruefe("Serie: «folgende» teilt mit neuen Werten, neue Tage erben sie, Vergangenes verlangt Bestätigung (#391 AK 8; PC 1, 2)", async () => {
    const team = await serienTeam("Kern-DB-Serie-Platz-Teilung");
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: tagCh(7), bis: tagCh(35), beginn: "18:00", ende: "19:30", felder: [KUNSTRASEN], spielerzahl: 12 }));
    const [t0, t1, t2] = await termineDer(s.serieId);
    // Über den KI-Weg: Eingabe des Werkzeugs, Reichweite «dieser_und_folgende».
    const ki = TerminAendernEingabe.parse({ termin_id: t1.id, reichweite: "dieser_und_folgende", felder: [{ laenge_m: 40, breite_m: 30, untergrund: "naturrasen" }], erwartete_spielerzahl: 10 });
    const r = wert(await aendereMitReichweite(a.supabase, a.id, {
      terminId: t1.id, reichweite: ki.reichweite, felder: ki.felder, spielerzahl: ki.erwartete_spielerzahl,
    }));
    const neu = r.serie!.serieId!;
    assert.notEqual(neu, s.serieId);
    assert.deepEqual(await platzDerSerie(neu), { felder: [RASEN], erwartete_spielerzahl: 10 });
    assert.deepEqual(await platzDerSerie(s.serieId), { felder: [KUNSTRASEN], erwartete_spielerzahl: 12 }, "die alte Serie behält ihre Werte");
    assert.deepEqual((await platzVon(t0.id)).felder, [KUNSTRASEN]);
    for (const t of [t1, t2]) assert.deepEqual(await platzVon(t.id), { felder: [RASEN], erwartete_spielerzahl: 10, felder_abweichend: false, spielerzahl_abweichend: false });
    // PC 1: Ein dazukommender Wochentag legt Termine mit den Werten der Serie an.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t1.id, reichweite: "alle", aenderung: { wochentage: [2, 4] } }));
    const alle = await termineDer(neu);
    assert.ok(alle.length > 2, "neue Tage");
    for (const t of alle) assert.deepEqual(await platzVon(t.id), { felder: [RASEN], erwartete_spielerzahl: 10, felder_abweichend: false, spielerzahl_abweichend: false });

    // Vergangene Termine: Der KI-Weg verlangt die Bestätigung, vorher bleibt alles stehen.
    const alt = await serienTeam("Kern-DB-Serie-Platz-Vergangen");
    const sv = wert(await legeSerieFest(a.supabase, a.id, { teamId: alt, wochentage: [wochentagVon(tagCh(-7))], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", spielerzahl: 12 }));
    const tv = await termineDer(sv.serieId);
    const vergangen = tv.filter((t) => t.datum < heuteCh).length;
    assert.ok(vergangen > 0);
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: tv.at(-1)!.id, reichweite: "alle", spielerzahl: 8 }), "regel", vergangeneBestaetigen(vergangen));
    assert.equal((await platzVon(tv[0].id)).erwartete_spielerzahl, 12, "ohne Bestätigung unverändert");
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: tv.at(-1)!.id, reichweite: "alle", spielerzahl: 8, bestaetigt: true }));
    assert.equal((await platzVon(tv[0].id)).erwartete_spielerzahl, 8);
  });
} finally {
  await aufraeumen();
}

console.log(`\n${gelaufen} Prüfungen bestanden (Wegwerf-Konten entfernt).`);
