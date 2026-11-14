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
const { TRAINER_MELDUNG, TRAINER_TEXT, mitAbsagen, aboBeschreibung, aboTitel } = await import("../lib/trainer");
type AboTrainerTermin = import("../lib/trainer").AboTrainerTermin;
const { BESETZUNG_TEXT } = await import("../lib/besetzung");
const { FELDER_TEXT, felderProblem } = await import("../lib/termin-felder");
type Feld = import("../lib/termin-felder").Feld;
type Felder = import("../lib/termin-felder").Felder;
const { felderAusgabe } = await import("../lib/termin-felder-ausgabe");
const { MASS_TEXT } = await import("../lib/feldmass");
const { ausDbFehler, NICHT_GEFUNDEN } = await import("../lib/kern/ergebnis");
const { ZEITRAUM_TEXT } = await import("../lib/monat");
const { SERIE_MELDUNG, SERIE_TEXT, plusTage, vergangeneBestaetigen, wochentagVon } = await import("../lib/serie");
const { kalendertagAmTrainingsort } = await import("../lib/zeit");
const { legeSerieFest, aendereSerie, entferneSerie, folgeDerSerie, aendereMitReichweite, entferneMitReichweite } =
  await import("../lib/kern/serien");
const { meineTeams, teamPlan } = await import("../lib/kern/team");
const { getTeamPlanFuer, nochNichtVorbereitet } = await import("../lib/queries/termine-fuer");
const { ladeSpielerliste, anzahlSpieler, nimmSpielerAuf, aendereSpieler, ladeSpieler, ladeSpielerTeams, eigenesTeamVon, nimmSpielerAusTeam, holeSpielerLink, erneuereSpielerLink, leseAbholung, schalteAbholung, erneuereAbholung, pruefeSpielerImport, importiereSpieler } =
  await import("../lib/kern/spieler");
const { IMPORT_TEXT, erwartetVon } = await import("../lib/spieler-import");
const { VEREIN_MELDUNG, VEREIN_TEAM_NICHT_GEFUNDEN, VEREIN_SPIELER_MAX, VEREIN_TEAMS_MAX, PERSON_MELDUNG, teamnameVergebenText, zuordnenAbweisungText, zugeordnetText } =
  await import("../lib/verein");
const {
  ladeVereinSpielerliste,
  ordneSpielerZu,
  ladeVereinAnsicht,
  ladeVereinTeamAnsicht,
  legeTeamAn,
  benenneTeamUm,
  benenneVereinUm,
  loeseTeamAuf,
  findePerson,
  nimmInsTeamAuf,
  nimmMichInsTeam,
  entferneAusTeam,
  nimmInVerwaltungAuf,
  entferneAusVerwaltung,
  nimmSpielerAusTeamImVerein,
  legeSpielerImVereinAn,
  aendereSpielerImVerein,
  ladeSpielerTeamsImVerein,
  loescheSpielerImVerein,
  holeSpielerLinkImVerein,
  erneuereSpielerLinkImVerein,
} = await import("../lib/kern/verein");
const { SPIELER_MELDUNG, SPIELER_TEXT, ABMELDUNG_TEXT, HERAUSNEHMEN_TEXT, abweisungText, herausnehmenFrage, spielerDoppeltText, spielerzahlVon, verfallBestaetigen } = await import("../lib/spieler");
const { SPIEL_MELDUNG, SPIEL_TEXT, MELDUNG_TEXT, TREFFPUNKT_TEXT, meldefristZeitpunkt, spielBestaetigen, spielEntfernenText, spielVerfallText } =
  await import("../lib/spiel");
const { setzeMeldung, setzeAufgebot, spielSpieler } = await import("../lib/kern/spiele");
const { jetztAmTrainingsort } = await import("../lib/zeit");
const { setzeAbmeldung, setzeAnwesenheit, terminSpieler } = await import("../lib/kern/abmeldungen");
const { ladeKader, legeKaderAn, benenneKaderUm, entferneKader, aendereZuteilung } = await import("../lib/kern/kader");
const { KADER_MELDUNG, KADER_TEXT, kaderVerfallBestaetigen, kaderVerfallGeaendert } = await import("../lib/kader");
const { getTeamTrainingsFuer } = await import("../lib/queries/trainings-fuer");
const { AendernEingabe: TerminAendernEingabe } = await import("../lib/mcp/werkzeuge/team");
const { teilnehmerAusgabe } = await import("../lib/mcp/werkzeuge/spieler");
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
/** Eine Prüfung; danach sind ihre Teams und die Spieler:innen, die sie in den
 *  Test-Vereinen angelegt hat, wieder weg. Ein Verein fasst höchstens 30 Teams
 *  (Trigger `teams_vorher`), der Lauf legt über hundert an. Spieler:innen
 *  fallen mit dem Team nicht mehr (Story #579, Entscheid A.2): Ohne das
 *  Abräumen träfen spätere Prüfungen auf Doppeleinträge im Verein
 *  (`SPIELER_DOPPELT`) oder auf die Vereinsgrenze. */
async function pruefe(was: string, fn: () => Promise<void>) {
  const vorher = teams.length;
  const bestand = new Set(await spielerDerVereine());
  await fn();
  await teamsEntfernen(teams.splice(vorher));
  const neu = (await spielerDerVereine()).filter((id) => !bestand.has(id));
  for (let i = 0; i < neu.length; i += 200) {
    const { error } = await admin.from("spieler").delete().in("id", neu.slice(i, i + 200));
    if (error) throw new Error(`Spieler:innen nicht entfernt: ${error.message}`);
  }
  gelaufen++;
  console.log(`✓ ${was}`);
}

/** Die Kennungen aller Spieler:innen der Test-Vereine. */
async function spielerDerVereine(): Promise<string[]> {
  if (!vereine.length) return [];
  const ids: string[] = [];
  for (let von = 0; ; von += 1000) {
    const { data, error } = await admin.from("spieler").select("id").in("verein_id", vereine).order("id").range(von, von + 999);
    if (error) throw new Error(`Spieler:innen nicht gelesen: ${error.message}`);
    ids.push(...data.map((x) => x.id as string));
    if (data.length < 1000) return ids;
  }
}

/** Eine Spieler:in aus dem Team nehmen, wie die Bestätigung es tut: erst die
 *  Teams samt Stand lesen (`spieler_teams`), dann mit diesem Stand handeln
 *  (Story #579 AK 10, 13–16). */
async function nimmHeraus(k: Konto, teamId: string, spielerId: string) {
  const t = await ladeSpielerTeams(k.supabase, k.id, { teamId, spielerId });
  if (!t.ok) return t;
  return nimmSpielerAusTeam(k.supabase, k.id, { teamId, spielerId, stand: t.wert.stand });
}

/** Eine Spieler:in aus dem Verein löschen — auf dem einzigen Weg der
 *  Anwendung (Story #582): die Verwaltung über den Verein-Kern
 *  (`verein_spieler_entfernen`). Danach ist die Zeile weg; die Folgen
 *  (ehemalig ohne Namen, Link und Abo erloschen) prüfen die Aufrufer. */
async function loescheSpieler(verwaltung: Konto, spielerId: string) {
  wert(await loescheSpielerImVerein(verwaltung.supabase, verwaltung.id, { spielerId }));
  assert.equal((await admin.from("spieler").select("id").eq("id", spielerId)).data!.length, 0, "gelöscht");
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
/** Wegwerf-Teams; ihre Trainings kaskadieren beim Löschen mit, ihre
 *  Spieler:innen bleiben im Verein (Story #579) und räumt `pruefe` ab. */
const teams: string[] = [];
/** Wegwerf-Vereine (Epic Vereine #575); jeder Lauf hat genau einen Test-Verein,
 *  dazu eigene für Fälle über Vereinsgrenzen. */
const vereine: string[] = [];
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

/** Ein Verein mit dem Konto als einziger Verwaltung (Story #577). Seine Teams
 *  legt der Lauf per Admin an; Mitglied eines Teams ist damit Mitglied des
 *  Vereins, und eine Person gehört höchstens einem Verein an. */
async function testVerein(name: string, verwaltung: Konto): Promise<string> {
  const { data, error } = await admin.from("vereine").insert({ name }).select("id").single();
  if (error) throw error;
  vereine.push(data.id);
  const { error: e2 } = await admin.from("verein_verwaltung").insert({ verein_id: data.id, user_id: verwaltung.id });
  if (e2) throw e2;
  return data.id as string;
}

async function teamsEntfernen(ids: string[]) {
  if (!ids.length) return;
  const { error } = await admin.from("teams").delete().in("id", ids);
  if (error) throw new Error(`Teams nicht entfernt: ${error.message}`);
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

/** In der Reihenfolge Teams → Spieler:innen → Vereine → Konten: Die
 *  Verwaltung hält ihr Konto (`verein_verwaltung … on delete restrict`), Teams
 *  und Spieler:innen ihren Verein. Je Schritt und Konto einzeln, damit ein
 *  Fehler die übrigen nicht stehen lässt; jeder Fehler lässt den Lauf
 *  scheitern, ohne den eigentlichen Prüffehler zu überdecken. */
async function aufraeumen(): Promise<string[]> {
  const fehler: string[] = [];
  const melde = (was: string, e: unknown) => fehler.push(`${was}: ${(e as { message?: string })?.message ?? String(e)}`);
  if (dateien.length) {
    const { error } = await admin.storage.from("exercise-images").remove(dateien);
    if (error) melde("Dateien nicht entfernt", error);
  }
  try {
    await teamsEntfernen(teams);
  } catch (e) {
    melde("Teams", e);
  }
  if (vereine.length) {
    // Auch Teams, die nicht über den Helfer entstanden (verein_team_anlegen).
    const t = await admin.from("teams").delete().in("verein_id", vereine);
    if (t.error) melde("Teams der Vereine nicht entfernt", t.error);
    const s = await admin.from("spieler").delete().in("verein_id", vereine);
    if (s.error) melde("Spieler:innen nicht entfernt", s.error);
    const v = await admin.from("vereine").delete().in("id", vereine);
    if (v.error) melde("Vereine nicht entfernt", v.error);
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
      melde(`Konto ${id} nicht vollständig entfernt`, e);
    }
  }
  return fehler;
}

try {
  const a = await wegwerfKonto();
  const b = await wegwerfKonto();
  // Genau ein Test-Verein je Lauf (Story #577): Kämen a oder b in Teams zweier
  // Vereine, schlüge das an «höchstens ein Verein je Person» fehl. Seine
  // Verwaltung ist ein eigenes Konto ohne Team.
  const verwaltung = await wegwerfKonto();
  const verein = await testVerein("Kern-DB", verwaltung);
  /** Ein Wegwerf-Team im Test-Verein, ohne Mitglieder. Jedes Team des Laufs
   *  entsteht hier; `pruefe` räumt es nach der Prüfung wieder ab. */
  async function neuesTeam(name: string): Promise<string> {
    const { data, error } = await admin.from("teams").insert({ name, verein_id: verein }).select("id").single();
    if (error) throw error;
    teams.push(data.id);
    return data.id as string;
  }
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
    const team = await neuesTeam("Kern-DB-Team");
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    if (e2) throw e2;
    const tt = wert(
      await legeTrainingAn(a.supabase, a.id, { name: "Team", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }),
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
    const team = await neuesTeam("Kern-DB-Kalender");
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    if (e2) throw e2;
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const zeile = async (id: string) =>
      (await admin.from("training_termine").select("datum, beginn, ende, ort, bemerkung, training_id").eq("id", id).single()).data;

    // AK 1, 2, 4: ohne Training, auch vergangen; Beginn und Ende Pflicht.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(2), beginn: "18:30", ende: "" }), "eingabe", TERMIN_TEXT.zeitPflicht);
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(2), beginn: "18:30", ende: "18:00" }), "eingabe", TERMIN_TEXT.endeNachBeginn);
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(2), beginn: "18:30", ende: "20:00", ort: " Allmend " }));
    const t0 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(-3), beginn: "10:00", ende: "11:30" }));
    assert.deepEqual(await zeile(t1.terminId), { datum: tag(2), beginn: "18:30:00", ende: "20:00:00", ort: "Allmend", bemerkung: null, training_id: null });
    // AK 22: nur Mitglieder.
    fehler(await legeTerminFest(b.supabase, b.id, { art: "training", teamId: team, datum: tag(2), beginn: "18:30", ende: "20:00" }), "nicht_gefunden", TEAM_FREMD);

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
      const { error } = await admin.from("training_termine").insert({ team_id: team, datum: tag(5), ...ohne });
      assert.ok(error, `ohne Zeit abgewiesen: ${JSON.stringify(ohne)}`);
    }
    const { data: alt } = await admin.from("training_termine")
      .insert({ team_id: team, datum: tag(5), beginn: "17:00", ende: "18:30" }).select("id").single();
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
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId, alt!.id]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [t0.terminId]);
    assert.equal(plan.kommend[0].training, null);
    assert.equal(plan.kommend[0].ende, "20:00");

    // PC 7, 8: Löschen des Trainings lässt den Termin stehen.
    const tt = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Kalender", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt.id })).trainingId;
    const weg = wert(await loescheTraining(a.supabase, a.id, { trainingId: amTermin }));
    assert.deepEqual(weg.terminBleibt, { id: t1.terminId, datum: tag(2) });
    assert.equal((await zeile(t1.terminId))!.training_id, null);

    // AK 23: Wer mit veralteter Auswahl ändert oder entfernt, wird abgewiesen.
    const tt2 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Zwei", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const c2 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t1.terminId, trainingId: tt2.id })).trainingId;
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "x", erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    assert.equal((await zeile(t1.terminId))!.ort, "Platz", "abgewiesen heisst unverändert");
    fehler(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: null }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);
    assert.ok(await zeile(t1.terminId), "der Termin steht noch");
    // KI-Weg ohne erwartetes Training: geprüft wird gegen den gelesenen Stand.
    assert.deepEqual(
      wert(await aendereTermin(a.supabase, a.id, { terminId: t1.terminId, ort: "KI-Ort" })),
      { terminId: t1.terminId, teamId: team, trainingId: c2, abmeldungenVerfallen: 0, kartenlinkEntfallen: false, treffpunktEntfallen: false },
    );
    assert.equal((await zeile(t1.terminId))!.ort, "KI-Ort");
    const t3 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(9), beginn: "18:00", ende: "19:00" }));
    const tt3 = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Drei", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const c3 = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: t3.terminId, trainingId: tt3.id })).trainingId;
    // Entfernen nimmt das Termin-Training mit; die Quelle bleibt im Bestand.
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t3.terminId })), { teamId: team, training: { trainingId: c3, geloescht: true } });
    assert.equal(await zeile(t3.terminId), null);
    assert.equal(await ladeTrainingDetail(a.supabase, c3), null, "das Termin-Training ist weg");
    assert.ok(await ladeTrainingDetail(a.supabase, tt3.id), "die Quelle bleibt im Team-Bestand");
    assert.deepEqual(wert(await entferneTermin(a.supabase, a.id, { terminId: t1.terminId, erwartetesTraining: c2 })), { teamId: team, training: { trainingId: c2, geloescht: true } });
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
      (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count;
    assert.equal(await termineDes(), 2);
    // PC 9: Das Team aufzulösen nimmt alle seine Termine mit.
    const { error: aufloesen } = await admin.from("teams").delete().eq("id", team);
    if (aufloesen) throw aufloesen;
    assert.equal(await termineDes(), 0);
  });

  // ── Kalender: Training zuordnen und lösen (#323; Termin-Trainings, PO 2026-10-06) ──
  await pruefe("Kalender: zuordnen als Termin-Training, ersetzen, lösen, entfernen, Ausfall, Konflikte", async () => {
    const team = await neuesTeam("Kern-DB-Zuordnen");
    await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    const anderes = await neuesTeam("Kern-DB-Anderes");
    await admin.from("team_members").insert({ team_id: anderes, user_id: a.id });
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);
    const termin = async (d: number, teamId = team) =>
      wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId, datum: tag(d), beginn: "18:00", ende: "19:30" })).terminId;
    const training = async (name: string, teamId: string = team) =>
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
      { name: "Kern-DB-X", team_id: team, termin_training: true },
    );
    assert.equal((await admin.from("training_termine").select("id").eq("training_id", x).maybeSingle()).data, null, "die Quelle bekommt keinen Termin");
    // Der Bestand zeigt keine Termin-Trainings.
    const bestand = (await getTeamTrainingsFuer(a.supabase, team)).map((t) => t.id);
    assert.ok(bestand.includes(x) && !bestand.includes(z1.trainingId), "Bestand ohne Termin-Training");
    // Dieselbe Quelle für einen weiteren, auch vergangenen Termin: wieder still eine Kopie.
    const z2 = wert(await ordne(gestern, x));
    assert.notEqual(z2.trainingId, z1.trainingId);
    // Ein Training eines anderen Teams lässt sich nicht zuordnen.
    const fremd = await training("Kern-DB-Fremd", anderes);
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
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: morgen, trainingId: w, erwartet: { trainingAmTermin: null } }), "konflikt", TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT);

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
    const zahl = async () => (await admin.from("trainings").select("*", { count: "exact", head: true }).eq("team_id", team)).count;
    const vorher = await zahl();
    const f = fehler(await ordneTrainingZu(kaputt, a.id, { terminId: morgen, trainingId: x }), "technisch") as { hinweis?: string };
    assert.equal(f.hinweis, HINWEIS_NICHTS_ENTSTANDEN);
    assert.equal(await zahl(), vorher, "keine Kopie bleibt stehen");
  });

  // ── Kalender: Lesen und Zugang ─────────────────────────────────────────
  await pruefe("Kalender: Teams, Plan-Grenze, Suche, Auskunft, fremd", async () => {
    const TEAM_FREMD = "Team nicht gefunden. Du kannst nur in Teams arbeiten, in denen du Mitglied bist.";
    const team = await neuesTeam("Kern-DB-Lesen");
    const { error: e2 } = await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    if (e2) throw e2;
    const heute = new Date();
    const tag = (d: number) => new Date(heute.getTime() + d * 86_400_000).toISOString().slice(0, 10);

    // AK 1: die eigenen Teams; B ist in keinem.
    const ta = wert(await meineTeams(a.supabase, a.id)).teams;
    assert.deepEqual(ta.find((t) => t.id === team), { id: team, name: "Kern-DB-Lesen", mitglieder: 1 });
    assert.equal(wert(await meineTeams(b.supabase, b.id)).teams.length, 0);

    const neuesTraining = async (name: string, teamId?: string) =>
      wert(await legeTrainingAn(a.supabase, a.id, { name, altersstufe: "kinderfussball", stufen: ["F"], teamId })).id;
    const tt = await neuesTraining("Kern-DB-Lesen", team);
    const vergangenes = await neuesTraining("Kern-DB-Lesen-Vergangen", team);
    const persoenlich = await neuesTraining("Kern-DB-Lesen-Persönlich");
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(2), beginn: "18:30", ende: "20:00", ort: " Allmend ", bemerkung: "Leibchen" }));
    const t0 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(-1), beginn: "10:00", ende: "11:30" }));
    // Bestands-Trainings mit Termin, wie es sie vor den Termin-Trainings gab
    // (bis 2026-10-06 wurde direkt verknüpft); Suche und Auskunft nennen ihn.
    await admin.from("training_termine").update({ training_id: tt }).eq("id", t1.terminId);
    await admin.from("training_termine").update({ training_id: vergangenes }).eq("id", t0.terminId);

    // Der Plan ist bereits geteilt; am Tag des Termins zählt er noch zum Kommenden.
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.equal(plan.team.name, "Kern-DB-Lesen");
    assert.deepEqual(plan.kommend.map((t) => t.id), [t1.terminId]);
    assert.deepEqual(plan.vergangen.map((t) => t.id), [t0.terminId]);
    assert.equal(plan.vergangen[0].training?.id, vergangenes);
    const amTag = wert(await teamPlan(a.supabase, a.id, { teamId: team, heute: tag(-1) }));
    assert.deepEqual(amTag.kommend.map((t) => t.id), [t0.terminId, t1.terminId]);

    // Die Abfrage läuft in zwei Hälften (anstehend aufsteigend, vergangen
    // absteigend; max_rows kappt sonst die neuesten): die zusammengeführte
    // Liste bleibt aufsteigend, die Teilung unverändert. Drei vergangene,
    // zwei anstehende.
    const v3 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(-3), beginn: "17:00", ende: "18:00" }));
    const v2a = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(-2), beginn: "09:00", ende: "10:00" }));
    const v2b = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(-2), beginn: "16:00", ende: "17:00" }));
    const k0 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tag(0), beginn: "08:00", ende: "09:00" }));
    const reihe = (ts: { terminId: string }[]) => ts.map((t) => t.terminId);
    const aufsteigend = (await getTeamPlanFuer(a.supabase, team, { heute: tag(0) })).map((t) => t.id);
    assert.deepEqual(aufsteigend, reihe([v3, v2a, v2b, t0, k0, t1]), "aufsteigend über beide Hälften");
    const geteilt = wert(await teamPlan(a.supabase, a.id, { teamId: team, heute: tag(0) }));
    assert.deepEqual(geteilt.kommend.map((t) => t.id), reihe([k0, t1]));
    assert.deepEqual(geteilt.vergangen.map((t) => t.id), reihe([t0, v2b, v2a, v3]), "jüngste zuerst");

    // Suche im Team-Bestand samt Termin; festgelegt ohne Angabe: alle Mitglieder
    // eingeladen, wer festlegt verantwortlich (#519 PO 9) — hier nur a.
    const name = (await admin.rpc("anzeige_name", { p_user: a.id })).data as string;
    const eintrag = (await admin.from("termin_trainer").select("id").eq("termin_id", t1.terminId).single()).data!.id as string;
    const suche = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team, limit: 10 }));
    assert.equal(suche.treffer.length, 2);
    assert.deepEqual(suche.treffer.find((t) => t.id === tt)!.termin, {
      id: t1.terminId,
      datum: tag(2),
      beginn: "18:30",
      ende: "20:00",
      ort: "Allmend",
      bemerkung: "Leibchen",
      hinweisEltern: null,
      felder: null,
      spielerzahl: null,
      spielstand: null,
      serieId: null,
      trainer: [{ eintragId: eintrag, userId: a.id, name, ehemalig: false, verantwortlich: true, abgesagtAm: null }],
      mindestbesetzung: null,
      ausgefallen: false,
      ausfallGrund: null,
      anstehend: true,
    });
    assert.equal(suche.treffer.find((t) => t.id === vergangenes)!.termin?.anstehend, false);
    // Ein Termin-Training steht nicht im Bestand.
    const kopie = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: k0.terminId, trainingId: tt })).trainingId;
    const ohneKopie = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team, limit: 10 }));
    assert.deepEqual(ohneKopie.treffer.map((t) => t.id).sort(), [tt, vergangenes].sort());
    assert.ok(!ohneKopie.treffer.some((t) => t.id === kopie));
    const gesucht = wert(await trainingsSuchen(a.supabase, a.id, { bestand: "team", teamId: team, q: "Kern-DB-Lesen", limit: 1 }));
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
      hinweis_eltern: null,
      felder: null,
      erwartete_spielerzahl: null,
      spielerzahl: { quelle: "unbekannt", zahl: null, gesamt: null },
      serie_id: null,
      trainer: [{ id: a.id, anzeigename: name, ehemalig: false, verantwortlich: true, abgesagt_am: null }],
      mindestbesetzung: null,
      noetige_trainer: null,
      ausgefallen: false,
      ausfall_grund: null,
      anstehend: true,
    });
    assert.equal(wert(await trainingAbrufen(a.supabase, a.id, { trainingId: persoenlich })).termin, null);

    // Fremdes Team und unbekanntes Team.
    fehler(await teamPlan(b.supabase, b.id, { teamId: team }), "nicht_gefunden", TEAM_FREMD);
    fehler(await teamPlan(a.supabase, a.id, { teamId: randomUUID() }), "nicht_gefunden", TEAM_FREMD);
    fehler(await trainingsSuchen(b.supabase, b.id, { bestand: "team", teamId: team, limit: 5 }), "nicht_gefunden", TEAM_FREMD);
    fehler(
      await legeTrainingAn(b.supabase, b.id, { name: "x", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }),
      "nicht_gefunden",
      TEAM_FREMD,
    );
  });

  // ── Kalender: Terminserien (#324, #326) ──────────────────────────────────
  // Hilfen: ein Team mit dem Konto a, das Kalenderdatum relativ zu heute (am
  // Trainingsort) und die Termine einer Serie in Datumsfolge.
  async function serienTeam(name: string) {
    const team = await neuesTeam(name);
    await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    return team;
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
    const einzel = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: "2030-01-01", beginn: "10:00", ende: "11:00" }));
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

  await pruefe("Kartenlink: nur mit Ort, fällt mit dem Ort weg, folgt der Serie, am privaten Link (#533)", async () => {
    const team = await serienTeam("Kern-DB-Kartenlink");
    const L1 = "https://maps.app.goo.gl/eins";
    const L2 = "https://maps.app.goo.gl/zwei";
    const link = async (id: string) =>
      (await admin.from("training_termine").select("ort, ort_link, ort_abweichend").eq("id", id).single()).data!;

    // AK 1, 4, 5: einzelner Termin, nur mit Ort, nur https, bis 500 Zeichen.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", ortLink: L1 }), "eingabe", TERMIN_TEXT.kartenlinkOhneOrt);
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", ort: "Halle", ortLink: "maps.app.goo.gl/x" }), "eingabe", TERMIN_TEXT.kartenlinkUngueltig);
    const e = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", ort: "Halle", ortLink: L1 })).terminId;
    assert.deepEqual(await link(e), { ort: "Halle", ort_link: L1, ort_abweichend: false });
    // Die Datenebene als Untergrenze: kein http, kein Link ohne Ort (Trigger).
    assert.ok((await admin.from("training_termine").update({ ort_link: "http://x.ch" }).eq("id", e)).error, "tt_ort_link");
    wert(await aendereTermin(a.supabase, a.id, { terminId: e, bemerkung: "x" }));
    assert.equal((await link(e)).ort_link, L1, "eine andere Angabe lässt den Link stehen");
    // PC 1, AK 14: Ort ändern ohne Link nimmt ihn mit und meldet es.
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: e, ort: "Aula" })).kartenlinkEntfallen, true);
    assert.deepEqual(await link(e), { ort: "Aula", ort_link: null, ort_abweichend: false });
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: e, ort: "Halle", ortLink: L2 })).kartenlinkEntfallen, false);
    assert.equal((await link(e)).ort_link, L2);
    await admin.from("training_termine").update({ ort: null }).eq("id", e);
    assert.deepEqual(await link(e), { ort: null, ort_link: null, ort_abweichend: false }, "geleerter Ort nimmt den Link mit");

    // AK 2: Serie mit Link, jeder Termin trägt ihn.
    const von = tagCh(7), bis = tagCh(27);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(von)], von, bis, beginn: "18:00", ende: "19:30", ort: "Wyler", ortLink: L1 }));
    let t = await termineDer(s.serieId);
    assert.equal(t.length, 3);
    for (const x of t) assert.equal((await link(x.id)).ort_link, L1);
    // AK 3 (nur dieser): eigener Link weicht mit dem Ort ab.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t[1].id, ort: "Wyler", ortLink: L2 }));
    assert.deepEqual(await link(t[1].id), { ort: "Wyler", ort_link: L2, ort_abweichend: true });
    // Serie ändern (alle): neuer Ort ohne Link — der Link der Serie fällt weg,
    // der abweichende Termin behält seinen (PC 2).
    const r = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { ort: "Allmend" } }));
    assert.equal(r.kartenlinkEntfallen, true);
    assert.equal((await admin.from("termin_serien").select("ort_link").eq("id", s.serieId).single()).data!.ort_link, null);
    assert.deepEqual(await link(t[0].id), { ort: "Allmend", ort_link: null, ort_abweichend: false });
    assert.deepEqual(await link(t[1].id), { ort: "Wyler", ort_link: L2, ort_abweichend: true });
    // Nur der Link der Serie, über den KI-Weg.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[2].id, reichweite: "alle", ortLink: L1 }));
    assert.deepEqual(await link(t[2].id), { ort: "Allmend", ort_link: L1, ort_abweichend: false });
    assert.equal((await link(t[1].id)).ort_link, L2, "abweichend bleibt");
    // PC 3, AK 13: wieder der Serie folgen übernimmt Ort und Link.
    const g = wert(await folgeDerSerie(a.supabase, a.id, { terminId: t[1].id, angaben: ["ort"] }));
    assert.equal(g.kartenlinkEntfallen, true);
    assert.deepEqual(await link(t[1].id), { ort: "Allmend", ort_link: L1, ort_abweichend: false });

  });

  await pruefe("Hinweis für Eltern: Serie gibt ihn mit, Termin weicht ab oder ist bewusst ohne, folgt wieder (#590 AK 1–5, 16; PC 3)", async () => {
    const team = await serienTeam("Kern-DB-Hinweis-Eltern");
    const hinweis = async (id: string) =>
      (await admin.from("training_termine").select("hinweis_eltern, hinweis_eltern_abweichend, bemerkung").eq("id", id).single()).data!;
    const vonSerie = async (id: string) => (await admin.from("termin_serien").select("hinweis_eltern").eq("id", id).single()).data!.hinweis_eltern;

    // AK 1, 16: am einzelnen Termin, neben der Bemerkung; höchstens 500 Zeichen.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", hinweisEltern: "x".repeat(501) }), "eingabe", TERMIN_TEXT.hinweisElternLang);
    const e = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", bemerkung: "Schlüssel", hinweisEltern: " Pincode 4702 " })).terminId;
    assert.deepEqual(await hinweis(e), { hinweis_eltern: "Pincode 4702", hinweis_eltern_abweichend: false, bemerkung: "Schlüssel" });
    assert.ok((await admin.from("training_termine").update({ hinweis_eltern: "x".repeat(501) }).eq("id", e)).error, "tt_hinweis_eltern_laenge");
    wert(await aendereTermin(a.supabase, a.id, { terminId: e, hinweisEltern: "" }));
    assert.deepEqual(await hinweis(e), { hinweis_eltern: null, hinweis_eltern_abweichend: false, bemerkung: "Schlüssel" }, "leeren; ohne Serie kein Merker");

    // AK 2: Die Serie gibt ihn jedem Termin mit.
    const von = tagCh(7), bis = tagCh(34);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(von)], von, bis, beginn: "18:00", ende: "19:30", hinweisEltern: "Pincode 4702" }));
    const t = await termineDer(s.serieId);
    assert.equal(t.length, 4);
    for (const x of t) assert.equal((await hinweis(x.id)).hinweis_eltern, "Pincode 4702");
    // AK 3 (nur dieser) weicht ab; AK 4: entfernt ist er bewusst ohne und weicht ebenso ab.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", hinweisEltern: "Heute Eingang Nord" }));
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[2].id, reichweite: "nur_dieser", hinweisEltern: null }));
    assert.deepEqual(await hinweis(t[1].id), { hinweis_eltern: "Heute Eingang Nord", hinweis_eltern_abweichend: true, bemerkung: null });
    assert.deepEqual(await hinweis(t[2].id), { hinweis_eltern: null, hinweis_eltern_abweichend: true, bemerkung: null });
    // Die Bemerkung ist eine eigene Angabe: Sie lässt den Hinweis folgen.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[3].id, reichweite: "nur_dieser", bemerkung: "Bälle" }));
    assert.equal((await hinweis(t[3].id)).hinweis_eltern_abweichend, false);
    // PC 3: «alle» ändert die Serie und die Termine, die ihr folgen; die abweichenden bleiben.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { hinweisEltern: "Pincode 5180" } }));
    assert.equal(await vonSerie(s.serieId), "Pincode 5180");
    assert.deepEqual((await Promise.all(t.map((x) => hinweis(x.id)))).map((x) => x.hinweis_eltern), ["Pincode 5180", "Heute Eingang Nord", null, "Pincode 5180"]);
    // Der gewählte Termin folgt danach in jedem Fall wieder der Serie.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[2].id, reichweite: "alle", aenderung: { hinweisEltern: "Pincode 6000" } }));
    assert.deepEqual(await hinweis(t[2].id), { hinweis_eltern: "Pincode 6000", hinweis_eltern_abweichend: false, bemerkung: null });
    assert.equal((await hinweis(t[1].id)).hinweis_eltern, "Heute Eingang Nord", "abweichend bleibt");
    // AK 5: wieder der Serie folgen.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: t[1].id, angaben: ["hinweis_eltern"] }));
    assert.deepEqual(await hinweis(t[1].id), { hinweis_eltern: "Pincode 6000", hinweis_eltern_abweichend: false, bemerkung: null });
    // «dieser und folgende» teilt die Serie: Die Teilserie behält den Hinweis, ohne Änderung daran.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[2].id, reichweite: "dieser_und_folgende", aenderung: { beginn: "17:30", ende: "19:00" } }));
    const teil = (await admin.from("training_termine").select("serie_id").eq("id", t[2].id).single()).data!.serie_id as string;
    assert.notEqual(teil, s.serieId);
    assert.equal(await vonSerie(teil), "Pincode 6000");
    // Teilen samt neuem Hinweis: die Teilserie und ihre Termine bekommen ihn, die alte Serie behält ihren.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[3].id, reichweite: "dieser_und_folgende", aenderung: { hinweisEltern: "Ab Dezember: Halle Nord" } }));
    const zweite = (await admin.from("training_termine").select("serie_id").eq("id", t[3].id).single()).data!.serie_id as string;
    assert.deepEqual([await vonSerie(zweite), await vonSerie(teil), await vonSerie(s.serieId)], ["Ab Dezember: Halle Nord", "Pincode 6000", "Pincode 6000"]);
    assert.deepEqual([(await hinweis(t[2].id)).hinweis_eltern, (await hinweis(t[3].id)).hinweis_eltern], ["Pincode 6000", "Ab Dezember: Halle Nord"]);
    // Lesepfad und KI: der Hinweis am Termin und an der Serie, die Abweichung benannt.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[3].id, reichweite: "nur_dieser", hinweisEltern: "Eigener" }));
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const z = plan.kommend.find((x) => x.id === t[3].id)!;
    assert.deepEqual([z.hinweisEltern, z.serie?.hinweisEltern, z.abweichungen.includes("hinweis_eltern")], ["Eigener", "Ab Dezember: Halle Nord", true]);
  });

  await pruefe("Treffpunkt eines Trainings: Abstand zum Beginn, Serie, Abweichung, Wegfall am Vortag (#561)", async () => {
    const team = await serienTeam("Kern-DB-Treffpunkt");
    const tp = async (id: string) =>
      (await admin.from("training_termine").select("beginn, treffpunkt_vorlauf_min, treffpunkt_ort, treffpunkt_abweichend").eq("id", id).single()).data!;
    const vonSerie = async (id: string) =>
      (await admin.from("termin_serien").select("treffpunkt_vorlauf_min, treffpunkt_ort").eq("id", id).single()).data!;
    const garderobe = { zeit: "17:15", ort: "Garderoben Schulhaus Rain" };

    // AK 3, 5, 6: nicht nach dem Beginn, Ort Pflicht; gespeichert als Abstand.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "17:30", ende: "19:00", treffpunkt: { zeit: "17:45", ort: "G" } }), "eingabe");
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "17:30", ende: "19:00", treffpunkt: { zeit: "17:15", ort: "" } }), "eingabe", TERMIN_TEXT.treffpunktPflicht);
    fehler(await legeTerminFest(a.supabase, a.id, { art: "spiel", teamId: team, bezeichnung: "Cup", datum: tagCh(3), beginn: "17:30", ende: "19:00", treffpunkt: garderobe }), "eingabe", TERMIN_TEXT.treffpunktNurTraining);
    const e = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "17:30", ende: "19:00", ort: "Allmend", treffpunkt: garderobe })).terminId;
    assert.deepEqual(await tp(e), { beginn: "17:30:00", treffpunkt_vorlauf_min: 15, treffpunkt_ort: "Garderoben Schulhaus Rain", treffpunkt_abweichend: false });
    assert.ok((await admin.from("training_termine").update({ treffpunkt_vorlauf_min: 2000 }).eq("id", e)).error, "tt_treffpunkt_termintag");
    assert.ok((await admin.from("training_termine").update({ treffpunkt_ort: null }).eq("id", e)).error, "tt_treffpunkt_angabe");
    // PC 1, 7: Verlegt wandert er mit; ein anderer Ort lässt ihn stehen.
    const v = wert(await aendereTermin(a.supabase, a.id, { terminId: e, beginn: "18:00", ende: "19:30", ort: "Wyler" }));
    assert.equal(v.treffpunktEntfallen, false);
    assert.deepEqual(await tp(e), { beginn: "18:00:00", treffpunkt_vorlauf_min: 15, treffpunkt_ort: "Garderoben Schulhaus Rain", treffpunkt_abweichend: false });
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    assert.deepEqual(plan.kommend.find((x) => x.id === e)!.treffpunkt, { zeit: "17:45", ort: "Garderoben Schulhaus Rain" });
    // PC 4, 5: Läge er am Vortag, fragt die Oberfläche zuerst; bestätigt entfällt er (PC 6: so meldet es auch die KI).
    const frage = await aendereTermin(a.supabase, a.id, { terminId: e, beginn: "00:10", ende: "01:00", bestaetigt: false });
    assert.equal(frage.ok, false);
    assert.equal(!frage.ok && frage.treffpunktEntfaellt, true);
    assert.equal((await tp(e)).treffpunkt_vorlauf_min, 15, "vor der Bestätigung unverändert");
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: e, beginn: "00:10", ende: "01:00", bestaetigt: 0, treffpunktWeg: true })).treffpunktEntfallen, true);
    assert.deepEqual(await tp(e), { beginn: "00:10:00", treffpunkt_vorlauf_min: null, treffpunkt_ort: null, treffpunkt_abweichend: false });
    // AK 1: entfernen und neu setzen, auch an einem ausgefallenen Termin.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: e }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: e, treffpunkt: { zeit: "00:00", ort: "Eingang" } }));
    assert.equal((await tp(e)).treffpunkt_vorlauf_min, 10);

    // AK 2: Die Serie gibt ihn jedem Termin mit.
    const von = tagCh(7), bis = tagCh(34);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(von)], von, bis, beginn: "17:30", ende: "19:00", treffpunkt: garderobe }));
    const t = await termineDer(s.serieId);
    assert.equal(t.length, 4);
    for (const x of t) assert.equal((await tp(x.id)).treffpunkt_vorlauf_min, 15);
    // AK 7, 8; PC 2: nur dieser weicht ab, auch entfernt; eine andere Angabe lässt ihn folgen.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", treffpunkt: { zeit: "17:00", ort: "Parkplatz" } }));
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[2].id, reichweite: "nur_dieser", treffpunkt: null }));
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[3].id, reichweite: "nur_dieser", bemerkung: "Bälle" }));
    assert.deepEqual((await Promise.all(t.map((x) => tp(x.id)))).map((x) => [x.treffpunkt_vorlauf_min, x.treffpunkt_abweichend]), [[15, false], [30, true], [null, true], [15, false]]);
    // PC 3: «alle» ändert die Serie und die Folgenden; abweichende bleiben, auch die bewusst ohne.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { treffpunkt: { zeit: "17:20", ort: "Garderoben" } } }));
    assert.deepEqual(await vonSerie(s.serieId), { treffpunkt_vorlauf_min: 10, treffpunkt_ort: "Garderoben" });
    assert.deepEqual((await Promise.all(t.map((x) => tp(x.id)))).map((x) => x.treffpunkt_vorlauf_min), [10, 30, null, 10]);
    // AK 9: wieder der Serie folgen.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: t[2].id, angaben: ["treffpunkt"] }));
    assert.deepEqual(await tp(t[2].id), { beginn: "17:30:00", treffpunkt_vorlauf_min: 10, treffpunkt_ort: "Garderoben", treffpunkt_abweichend: false });
    // Lesepfad: Treffpunkt am Termin und an der Serie, die Abweichung benannt.
    const z = wert(await teamPlan(a.supabase, a.id, { teamId: team })).kommend.find((x) => x.id === t[1].id)!;
    assert.deepEqual([z.treffpunkt, z.serie?.treffpunkt, z.abweichungen.includes("treffpunkt")], [{ zeit: "17:00", ort: "Parkplatz" }, { zeit: "17:20", ort: "Garderoben" }, true]);

    // PC 4–6: Rückt die Zeit der Serie ihn auf den Vortag, nennt die Vorschau die anstehenden Termine, die ihn verlieren.
    const vorschau = wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { beginn: "00:05", ende: "01:00" }, vorschau: true }));
    assert.deepEqual(vorschau.treffpunktEntfallend.map((x) => x.terminId).sort(), [t[0].id, t[1].id, t[2].id, t[3].id].sort());
    const ki = wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", beginn: "00:05", ende: "01:00" }));
    assert.equal(ki.treffpunktEntfallen.length, 4);
    assert.deepEqual(await vonSerie(s.serieId), { treffpunkt_vorlauf_min: null, treffpunkt_ort: null });
    assert.deepEqual((await Promise.all(t.map((x) => tp(x.id)))).map((x) => [x.treffpunkt_vorlauf_min, x.treffpunkt_abweichend]), [[null, false], [null, true], [null, false], [null, false]]);

    // «Zeit folgt der Serie» nimmt einen eigenen Treffpunkt, der am Vortag läge — erst nach Rückfrage.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[3].id, reichweite: "nur_dieser", beginn: "18:00", ende: "19:00", treffpunkt: { zeit: "17:30", ort: "Bahnhof" } }));
    const f = await folgeDerSerie(a.supabase, a.id, { terminId: t[3].id, angaben: ["zeit"] });
    assert.equal(!f.ok && f.treffpunktEntfaellt, true);
    assert.equal(wert(await folgeDerSerie(a.supabase, a.id, { terminId: t[3].id, angaben: ["zeit"], treffpunktWeg: true })).treffpunktEntfallen, true);
    assert.deepEqual(await tp(t[3].id), { beginn: "00:05:00", treffpunkt_vorlauf_min: null, treffpunkt_ort: null, treffpunkt_abweichend: true });
    // AK 9: Passt der Treffpunkt der Serie nicht zur eigenen Zeit, sagt der Kern, was zuerst folgen muss.
    wert(await aendereSerie(a.supabase, a.id, { terminId: t[0].id, reichweite: "alle", aenderung: { treffpunkt: { zeit: "00:00", ort: "Halle" } } }));
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t[1].id, reichweite: "nur_dieser", beginn: "00:02", ende: "01:00" }));
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: t[1].id, angaben: ["treffpunkt"] }), "regel", TERMIN_TEXT.treffpunktFolgtNicht);
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: t[1].id, angaben: ["zeit", "treffpunkt"], bestaetigt: true }));
    assert.deepEqual(await tp(t[1].id), { beginn: "00:05:00", treffpunkt_vorlauf_min: 5, treffpunkt_ort: "Halle", treffpunkt_abweichend: false });
    // An einem Spiel zuerst «nur an einem Training», nicht die Regeln des Trainings-Treffpunkts.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "spiel", teamId: team, bezeichnung: "Cup", datum: tagCh(3), beginn: "17:30", ende: "19:00", treffpunkt: { zeit: "19:00", ort: "" } }), "eingabe", TERMIN_TEXT.treffpunktNurTraining);
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
    const einzel = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00" }));
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

  // ── Kalender: Trainer:innen einladen und Verantwortung (#519) ───────────
  const { aendereTrainer, setzeAbsage, teamMitglieder } = await import("../lib/kern/trainer");
  const { trainerAusgabe } = await import("../lib/trainer-ausgabe");
  /** Die Eingeladenen eines Termins, sortiert; `null` = Eintrag eines gelöschten Kontos. */
  const eingeladeneVon = async (terminId: string) =>
    (await admin.from("termin_trainer").select("user_id").eq("termin_id", terminId)).data!.map((x) => x.user_id).sort();
  const verantwortlichVon = async (terminId: string) =>
    ((await admin.from("termin_trainer").select("user_id").eq("termin_id", terminId).eq("verantwortlich", true)).data ?? [])[0]?.user_id ?? null;
  const serienVorgabe = async (serieId: string) =>
    (await admin.from("termin_serien_trainer").select("user_id, verantwortlich").eq("serie_id", serieId)).data!
      .map((x) => `${x.user_id}${x.verantwortlich ? "*" : ""}`)
      .sort();
  const abweichungVon = async (terminId: string) =>
    (await admin.from("training_termine").select("eingeladene_abweichend, verantwortung_abweichend").eq("id", terminId).single()).data!;
  const serieVon = async (terminId: string) =>
    (await admin.from("training_termine").select("serie_id").eq("id", terminId).single()).data!.serie_id as string;

  await pruefe("Trainer:innen festlegen: Vorgabe, Pflicht zur Verantwortlichen, nur Mitglieder (#519 AK 1–4, 11, PO 9)", async () => {
    const team = await serienTeam("Kern-DB-Trainer-Festlegen");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const m = wert(await teamMitglieder(a.supabase, a.id, { teamId: team })).mitglieder;
    assert.equal(m.length, 2);
    assert.equal(m.find((x) => x.id === a.id)!.ich, true);
    assert.ok(m.every((x) => !("email" in x)), "ohne E-Mail (PC 10)");

    // Ohne Angabe: alle Mitglieder eingeladen, wer festlegt verantwortlich.
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" }));
    assert.deepEqual(await eingeladeneVon(ohne.terminId), [a.id, b.id].sort());
    assert.equal(await verantwortlichVon(ohne.terminId), a.id);
    // Mit Angabe: die Verantwortliche ist damit eingeladen (PC 13).
    const mit = wert(await legeTerminFest(b.supabase, b.id, { art: "spiel", bezeichnung: "Cup", teamId: team, datum: tagCh(4), beginn: "10:00", ende: "11:00", eingeladene: [], verantwortlich: a.id }));
    assert.deepEqual(await eingeladeneVon(mit.terminId), [a.id]);
    assert.equal(await verantwortlichVon(mit.terminId), a.id);

    const anzahl = async () => (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count;
    const vorher = await anzahl();
    // AK 3: genau eine Verantwortliche — `null` ist keine.
    fehler(
      await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:00", verantwortlich: null }),
      "regel",
      TRAINER_TEXT.verantwortlichPflicht,
    );
    fehler(
      await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:00", eingeladene: ["kein-uuid"] }),
      "eingabe",
      TRAINER_TEXT.kennungUngueltig,
    );
    // AK 11: Wer nicht (mehr) Mitglied ist, lässt sich nicht einladen; der Termin bleibt nicht stehen.
    const fremd = await wegwerfKonto();
    fehler(
      await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:00", eingeladene: [fremd.id] }),
      "regel",
      TERMIN_MELDUNG.NICHT_MEHR_MITGLIED,
    );
    assert.equal(await anzahl(), vorher, "kein halber Termin");

    // Serie: dieselbe Vorgabe für jeden Termin und an der Serie (PC 1).
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-7), bis: tagCh(7), beginn: "18:00", ende: "19:30", eingeladene: [b.id], verantwortlich: b.id }));
    assert.deepEqual(await serienVorgabe(s.serieId), [`${b.id}*`]);
    for (const x of await termineDer(s.serieId)) {
      assert.deepEqual(await eingeladeneVon(x.id), [b.id]);
      assert.equal(await verantwortlichVon(x.id), b.id);
    }
    fehler(
      await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(0), bis: tagCh(7), beginn: "18:00", ende: "19:30", verantwortlich: null }),
      "regel",
      TRAINER_TEXT.verantwortlichPflicht,
    );
  });

  await pruefe("Trainer:innen eines Termins: einladen, ausladen, Verantwortung geben, Widerspruch (#519 AK 5–11, 16, 20)", async () => {
    const team = await serienTeam("Kern-DB-Trainer-Einzeln");
    const c = await wegwerfKonto();
    await admin.from("team_members").insert([{ team_id: team, user_id: b.id }, { team_id: team, user_id: c.id }]);
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-2), beginn: "18:00", ende: "19:00", eingeladene: [a.id] })).terminId;

    // AK 16: auch an vergangenen Terminen. AK 6: ohne Zustimmung, wer verantwortlich wird, ist eingeladen.
    wert(await aendereTrainer(b.supabase, b.id, { terminId: t, einladen: [b.id] }));
    wert(await aendereTrainer(b.supabase, b.id, { terminId: t, verantwortlich: c.id }));
    assert.deepEqual(await eingeladeneVon(t), [a.id, b.id, c.id].sort());
    assert.equal(await verantwortlichVon(t), c.id, "genau eine (AK 8)");
    // AK 7: in einem weitergeben und die Bisherige ausladen.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, verantwortlich: b.id, ausladen: [c.id] }));
    assert.deepEqual(await eingeladeneVon(t), [a.id, b.id].sort());
    assert.equal(await verantwortlichVon(t), b.id);
    // Wer verantwortlich wird, lässt sich nicht gleichzeitig ausladen.
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t, verantwortlich: a.id, ausladen: [a.id] }), "regel", TRAINER_MELDUNG.TRAINER_WIDERSPRUCH);
    // AK 9: die Verantwortliche ausladen — der Termin ist ohne Verantwortliche:n.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, ausladen: [b.id] }));
    assert.deepEqual(await eingeladeneVon(t), [a.id]);
    assert.equal(await verantwortlichVon(t), null);

    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t }), "eingabe", SERIE_MELDUNG.KEINE_AENDERUNG);
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t, einladen: ["kein-uuid"] }), "eingabe", TRAINER_TEXT.kennungUngueltig);
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t, einladen: [null as never] }), "eingabe", TRAINER_TEXT.kennungUngueltig);
    // AK 11, 20: Wer inzwischen nicht mehr Mitglied ist, lässt sich nicht neu einladen oder verantwortlich machen.
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", c.id);
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t, einladen: [c.id] }), "regel", TERMIN_MELDUNG.NICHT_MEHR_MITGLIED);
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: t, verantwortlich: c.id }), "regel", TERMIN_MELDUNG.NICHT_MEHR_MITGLIED);
    assert.deepEqual(await eingeladeneVon(t), [a.id], "unverändert");
    // Fremde sehen den Termin nicht.
    fehler(await aendereTrainer(c.supabase, c.id, { terminId: t, einladen: [c.id] }), "nicht_gefunden", TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN);
  });

  await pruefe("Trainer:innen einer Serie: Reichweite, je Angabe abweichen und folgen, teilen, nichts auslassen (#519 AK 12–15, PC 1, 2)", async () => {
    const team = await serienTeam("Kern-DB-Trainer-Serie");
    const c = await wegwerfKonto();
    await admin.from("team_members").insert([{ team_id: team, user_id: b.id }, { team_id: team, user_id: c.id }]);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-14), bis: tagCh(14), beginn: "18:00", ende: "19:30", eingeladene: [a.id, b.id], verantwortlich: a.id }));
    const t = await termineDer(s.serieId);
    const kuenftig = t.find((x) => x.datum === tagCh(7))!;

    // Am Serientermin ohne Reichweite → abgewiesen (KI-Weg).
    fehler(await aendereTrainer(a.supabase, a.id, { terminId: kuenftig.id, einladen: [c.id] }), "regel", SERIE_MELDUNG.REICHWEITE_FEHLT);
    // Nur dieser: Eingeladene und Verantwortung weichen je für sich ab (AK 14, 15).
    wert(await aendereTrainer(a.supabase, a.id, { terminId: kuenftig.id, einladen: [c.id], reichweite: "nur_dieser" }));
    assert.deepEqual(await abweichungVon(kuenftig.id), { eingeladene_abweichend: true, verantwortung_abweichend: false });
    // Alle: B verantwortlich — der Termin mit abweichenden Eingeladenen folgt bei der Verantwortung trotzdem.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t[0].id, verantwortlich: b.id, reichweite: "alle", bestaetigt: true }));
    for (const x of t) assert.equal(await verantwortlichVon(x.id), b.id, `Termin ${x.datum}`);
    assert.deepEqual(await eingeladeneVon(kuenftig.id), [a.id, b.id, c.id].sort(), "die abweichenden Eingeladenen bleiben");
    assert.deepEqual(await serienVorgabe(s.serieId), [a.id, `${b.id}*`].sort());
    // Alle: Eingeladene als ganze Liste — B (die Verantwortliche) ausgeladen, nichts ausgelassen (AK 13).
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t[0].id, ausladen: [b.id], reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(await serienVorgabe(s.serieId), [a.id]);
    for (const x of t.filter((y) => y.id !== kuenftig.id)) {
      assert.deepEqual(await eingeladeneVon(x.id), [a.id], `Termin ${x.datum}`);
      assert.equal(await verantwortlichVon(x.id), null, "mit der Verantwortlichen fällt die Verantwortung");
    }
    assert.deepEqual(await eingeladeneVon(kuenftig.id), [a.id, b.id, c.id].sort(), "weicht weiter ab");
    // Der Serie wieder folgen, je Angabe (AK 14).
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: kuenftig.id, angaben: ["eingeladene"] }));
    assert.deepEqual(await eingeladeneVon(kuenftig.id), [a.id]);
    assert.deepEqual(await abweichungVon(kuenftig.id), { eingeladene_abweichend: false, verantwortung_abweichend: false });

    // AK 20: Hat jemand die Serie seit der Auswahl geändert → abgewiesen.
    fehler(
      await aendereTrainer(a.supabase, a.id, { terminId: t[0].id, verantwortlich: a.id, reichweite: "alle", erwartet: { version: 1, entfallend: [] } }),
      "konflikt",
      SERIE_MELDUNG.SERIE_GEAENDERT,
    );
    // Namenlose Einträge nur für diesen Termin.
    fehler(
      await aendereTrainer(a.supabase, a.id, { terminId: t[0].id, ausladenEintraege: [randomUUID()], reichweite: "alle", bestaetigt: true }),
      "regel",
      SERIE_TEXT.namenloseNurEinzeln,
    );

    // PC 2: «dieser und folgende» teilt; die neue Serie trägt die neue Verantwortung, die alte behält ihre.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: kuenftig.id, verantwortlich: c.id, reichweite: "dieser_und_folgende" }));
    const neue = await serieVon(kuenftig.id);
    assert.notEqual(neue, s.serieId);
    assert.deepEqual(await serienVorgabe(neue), [a.id, `${c.id}*`].sort());
    assert.deepEqual(await serienVorgabe(s.serieId), [a.id]);
    // Teilung durch eine Ortsänderung: die neue Serie übernimmt die Vorgabe.
    const spaeter = t.find((x) => x.datum === tagCh(14))!;
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: spaeter.id, reichweite: "dieser_und_folgende", ort: "Neuer Platz" }));
    assert.deepEqual(await serienVorgabe(await serieVon(spaeter.id)), [a.id, `${c.id}*`].sort());
    // Zeitraum erweitern: neue Termine tragen die Vorgabe (PC 1).
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: spaeter.id, reichweite: "alle", bis: tagCh(28), bestaetigt: true }));
    const dazu = (await termineDer(await serieVon(spaeter.id))).filter((x) => x.datum > tagCh(14));
    assert.ok(dazu.length >= 1, "neue Termine");
    for (const x of dazu) {
      assert.deepEqual(await eingeladeneVon(x.id), [a.id, c.id].sort());
      assert.equal(await verantwortlichVon(x.id), c.id);
    }
  });

  await pruefe("Trainer:innen: Austritt, Verlegen und Konto löschen (#519 PC 5–9)", async () => {
    const team = await serienTeam("Kern-DB-Trainer-Austritt");
    const d = await wegwerfKonto();
    const x = await wegwerfKonto();
    await admin.from("team_members").insert([{ team_id: team, user_id: b.id }, { team_id: team, user_id: d.id }, { team_id: team, user_id: x.id }]);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(heuteCh)], von: tagCh(-7), bis: tagCh(14), beginn: "18:00", ende: "19:30", eingeladene: [a.id, b.id], verantwortlich: b.id }));
    const t = await termineDer(s.serieId);
    const anstehend = t.find((y) => y.datum === tagCh(7))!;
    const vergangen = t.find((y) => y.datum === tagCh(-7))!;

    // PC 5: Ein neues Mitglied ist zu nichts eingeladen.
    const neu = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: neu.id });
    assert.ok(!(await eingeladeneVon(anstehend.id)).includes(neu.id));

    // PC 6, 7: B (verantwortlich) tritt aus — anstehende Termine und Serie ohne B und ohne Verantwortliche:n.
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", b.id);
    assert.deepEqual(await serienVorgabe(s.serieId), [a.id]);
    assert.deepEqual(await eingeladeneVon(anstehend.id), [a.id]);
    assert.equal(await verantwortlichVon(anstehend.id), null);
    // PC 8: Vergangenes behält B, mit aktuellem Namen und als ehemalig.
    assert.deepEqual(await eingeladeneVon(vergangen.id), [a.id, b.id].sort());
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const vb = plan.vergangen.find((y) => y.id === vergangen.id)!.trainer.find((v) => v.userId === b.id)!;
    assert.equal(vb.ehemalig, true);
    assert.equal(vb.verantwortlich, true);
    assert.ok(vb.name, "mit aktuellem Anzeigenamen");
    assert.deepEqual(plan.kommend.find((y) => y.id === anstehend.id)!.serie!.trainer.map((v) => v.userId), [a.id]);
    // Eine Serienänderung ab dem vergangenen Termin scheitert nicht an der Ausgetretenen:
    // Sie geht nicht in die Liste der Serie (Review PR #525).
    wert(await aendereTrainer(a.supabase, a.id, { terminId: vergangen.id, einladen: [x.id], reichweite: "alle", bestaetigt: true }));
    assert.deepEqual(await serienVorgabe(s.serieId), [a.id, x.id].sort());
    assert.deepEqual(await eingeladeneVon(vergangen.id), [a.id, x.id].sort());

    // PC 9: Konto löschen — anstehend und Serie ohne es, vergangen anonym und zuletzt, auch nach dem Austritt.
    const alt = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-3), beginn: "10:00", ende: "11:00", eingeladene: [a.id, d.id, x.id], verantwortlich: d.id })).terminId;
    const bald = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "10:00", ende: "11:00", eingeladene: [d.id], verantwortlich: d.id })).terminId;
    assert.deepEqual(await d.supabase.rpc("delete_account").then((r) => [r.error, r.data]), [null, { status: "geloescht" }]);
    assert.deepEqual(await eingeladeneVon(bald), []);
    assert.deepEqual(await eingeladeneVon(alt), [null, a.id, x.id].sort());
    const p = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const v = p.vergangen.find((y) => y.id === alt)!.trainer;
    assert.equal(v.length, 3);
    assert.deepEqual([v[2].name, v[2].ehemalig, v[2].verantwortlich], [null, true, true], "anonym zuletzt, weiter verantwortlich");
    assert.ok(v[0].name!.localeCompare(v[1].name!, "de") <= 0, "nach Name geordnet");
    // Einträge ohne Namen lassen sich an diesem Termin ausladen (KI-Weg ohne Kennungen).
    wert(await aendereTrainer(a.supabase, a.id, { terminId: alt, ohneNamenEntfernen: true }));
    assert.deepEqual(await eingeladeneVon(alt), [a.id, x.id].sort());
    assert.equal(await verantwortlichVon(alt), null);
  });

  await pruefe("Absagen: für sich und andere, nur bis Beginn, nie am Ausfall, veraltet abgewiesen (#520 AK 1–3, 6, 10)", async () => {
    const team = await serienTeam("Kern-DB-Absagen");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", verantwortlich: a.id })).terminId;
    const absage = async (terminId: string, userId: string) =>
      (await admin.from("termin_trainer").select("abgesagt_am").eq("termin_id", terminId).eq("user_id", userId).single()).data!.abgesagt_am as string | null;
    // AK 1: auch für andere. PC 9: mit Zeitpunkt; wieder zusagen entfernt ihn.
    wert(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: b.id, abgesagt: true }));
    const erste = await absage(t, b.id);
    assert.ok(erste, "abgesagt mit Zeitpunkt");
    wert(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: true }));
    assert.equal(await absage(t, b.id), erste, "eine bestehende Absage behält ihren Zeitpunkt");
    const plan = wert(await teamPlan(b.supabase, b.id, { teamId: team, eingrenzung: "dabei" }));
    assert.ok(![...plan.kommend, ...plan.vergangen].some((x) => x.id === t), "PC 7: nicht mehr unter «dabei»");
    const eingeladen = wert(await teamPlan(b.supabase, b.id, { teamId: team, eingrenzung: "eingeladen" }));
    assert.ok(eingeladen.kommend.some((x) => x.id === t), "PC 7: weiter unter «eingeladen»");
    wert(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: false }));
    assert.equal(await absage(t, b.id), null);

    // AK 10: Was die Oberfläche zeigte, hat sich geändert → veraltet.
    const gesehen = { datum: tagCh(3), beginn: "18:00", verantwortlich: a.id };
    wert(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: true, gesehen }));
    fehler(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: false, gesehen: { ...gesehen, verantwortlich: b.id } }), "konflikt", TRAINER_MELDUNG.ABSAGE_VERALTET);
    fehler(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: false, gesehen: { ...gesehen, beginn: "17:00" } }), "konflikt", TRAINER_MELDUNG.ABSAGE_VERALTET);
    // Nicht (mehr) eingeladen.
    const c = await wegwerfKonto();
    await admin.from("team_members").insert({ team_id: team, user_id: c.id });
    fehler(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: c.id, abgesagt: true }), "regel", TRAINER_MELDUNG.TRAINER_NICHT_EINGELADEN);

    // AK 3, 6: Am ausgefallenen Termin ruht die Absage und lässt sich nicht ändern; zurückgenommen gilt sie wieder (PC 5).
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t }));
    fehler(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: false }), "regel", TRAINER_MELDUNG.ABSAGE_AUSGEFALLEN);
    assert.ok(await absage(t, b.id), "ruht");
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.ok(await absage(t, b.id), "gilt wieder");
    // AK 3: ab Beginn nicht mehr.
    const vorbei = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeAbsage(a.supabase, a.id, { terminId: vorbei, userId: b.id, abgesagt: true }), "regel", TRAINER_MELDUNG.ABSAGE_BEGONNEN);
    // Fremde sehen den Termin nicht.
    fehler(await setzeAbsage(c.supabase, c.id, { terminId: randomUUID(), userId: c.id, abgesagt: true }), "nicht_gefunden");
  });

  await pruefe("Absagen der Verantwortlichen: erst übergeben, sonst ohne Verantwortliche:n; Verantwortung hebt die Absage auf (#520 AK 4, 5, 19, PC 1, 11)", async () => {
    const team = await serienTeam("Kern-DB-Absagen-Verantwortung");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Cup", teamId: team, datum: tagCh(4), beginn: "10:00", ende: "11:00", verantwortlich: a.id })).terminId;
    // AK 4: B ist dabei → A kann nicht einfach absagen.
    fehler(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: a.id, abgesagt: true }), "regel", TRAINER_MELDUNG.VERANTWORTUNG_UEBERGEBEN);
    fehler(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: a.id, abgesagt: true, uebernimmt: a.id }), "regel", TRAINER_MELDUNG.UEBERNAHME_UNGUELTIG);
    // AK 19: im selben Schritt an B übergeben.
    wert(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: a.id, abgesagt: true, uebernimmt: b.id }));
    assert.equal(await verantwortlichVon(t), b.id);
    // PC 1: B ist die Letzte, die dabei ist → sagt ab, der Termin ist ohne Verantwortliche:n.
    wert(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: true }));
    assert.equal(await verantwortlichVon(t), null);
    // AK 5, PC 11: Verantwortung an eine, die abgesagt hat — sie ist wieder dabei.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, verantwortlich: a.id }));
    const zeile = (await admin.from("termin_trainer").select("verantwortlich, abgesagt_am").eq("termin_id", t).eq("user_id", a.id).single()).data!;
    assert.deepEqual(zeile, { verantwortlich: true, abgesagt_am: null });
    // PC 6: Ausladen entfernt die Absage mit der Einladung.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, ausladen: [b.id] }));
    assert.deepEqual(await eingeladeneVon(t), [a.id]);
  });

  await pruefe("Absagen verfallen beim Verlegen, auch über die Serie, mit Zahl vorher (#520 AK 11, 14, PC 2–4)", async () => {
    const team = await serienTeam("Kern-DB-Absagen-Verfall");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const abgesagte = async (terminId: string) =>
      (await admin.from("termin_trainer").select("user_id").eq("termin_id", terminId).not("abgesagt_am", "is", null)).data!.length;
    // Einzeln: Ort ändern lässt sie (PC 4), Beginn ändern verlangt Bestätigung, dann verfallen sie (PC 2).
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", verantwortlich: a.id })).terminId;
    wert(await setzeAbsage(b.supabase, b.id, { terminId: t, userId: b.id, abgesagt: true }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, ort: "Neu" }));
    assert.equal(await abgesagte(t), 1);
    const r = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: "17:00", ende: "19:00" }), "regel") as { verfallend?: number; absagen?: number; meldung: string };
    assert.equal(r.verfallend, 1);
    assert.equal(r.absagen, 1);
    assert.ok(r.meldung.startsWith(mitAbsagen("", 1)), r.meldung);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: "17:00", ende: "19:00", bestaetigt: 1 }));
    assert.equal(await abgesagte(t), 0);
    // Ein Spiel: nur mit einem anderen Datum (PC 3).
    const s = wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Cup", teamId: team, datum: tagCh(5), beginn: "10:00", ende: "11:00", verantwortlich: a.id })).terminId;
    wert(await setzeAbsage(b.supabase, b.id, { terminId: s, userId: b.id, abgesagt: true }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: s, beginn: "11:00", ende: "12:00", bestaetigt: true }));
    assert.equal(await abgesagte(s), 1, "andere Zeit am selben Tag: bleibt");
    wert(await aendereTermin(a.supabase, a.id, { terminId: s, datum: tagCh(6), bestaetigt: true }));
    assert.equal(await abgesagte(s), 0, "anderes Datum: verfällt");

    // Serie: Vorschau zählt, Ausführung lässt verfallen (AK 11, 14).
    const serie = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(tagCh(1))], von: tagCh(1), bis: tagCh(15), beginn: "18:00", ende: "19:30", verantwortlich: a.id }));
    const st = await termineDer(serie.serieId);
    for (const x of st.slice(0, 2)) wert(await setzeAbsage(b.supabase, b.id, { terminId: x.id, userId: b.id, abgesagt: true }));
    const vorschau = wert(await aendereSerie(a.supabase, a.id, { terminId: st[0].id, reichweite: "alle", aenderung: { beginn: "17:00", ende: "18:30" }, vorschau: true }));
    assert.equal(vorschau.absagenVerfallend, 2);
    // KI ohne Bestätigung → abgewiesen, mit → ausgeführt.
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: st[0].id, reichweite: "alle", beginn: "17:00", ende: "18:30" }), "regel");
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: st[0].id, reichweite: "alle", beginn: "17:00", ende: "18:30", bestaetigt: true }));
    for (const x of st) assert.equal(await abgesagte(x.id), 0, `verfallen ${x.datum}`);
  });

  await pruefe("Absagen über die KI: termin_trainer_absagen und die Auskunft mit abgesagt_am (#520 AK 12, 13, 23)", async () => {
    const team = await serienTeam("Kern-DB-Absagen-KI");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00", verantwortlich: a.id })).terminId;
    wert(await setzeAbsage(a.supabase, a.id, { terminId: t, userId: b.id, abgesagt: true }));
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const eintrag = plan.kommend.find((x) => x.id === t)!.trainer.find((x) => x.userId === b.id)!;
    assert.ok(eintrag.abgesagtAm, "der Plan nennt den Zeitpunkt");
    assert.equal(trainerAusgabe([eintrag])[0].abgesagt_am, eintrag.abgesagtAm);
  });

  await pruefe("Mindestbesetzung: festlegen, ändern, entfernen, Grenzen, Serie mit Reichweite, folgen, teilen (#521 AK 1–5, 11, PC 1)", async () => {
    const team = await serienTeam("Kern-DB-Mindestbesetzung");
    const besetzungVon = async (terminId: string) =>
      (await admin.from("training_termine").select("besetzung_art, besetzung_zahl, besetzung_abweichend").eq("id", terminId).single()).data!;
    // Einzeln: festlegen, ändern, entfernen (AK 1, 2).
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", mindestbesetzung: { art: "fest", zahl: 2 } })).terminId;
    assert.deepEqual(await besetzungVon(t), { besetzung_art: "fest", besetzung_zahl: 2, besetzung_abweichend: false });
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, mindestbesetzung: { art: "verhaeltnis", zahl: 12 } }));
    assert.deepEqual((await teamPlan(a.supabase, a.id, { teamId: team }).then(wert)).kommend.find((x) => x.id === t)!.mindestbesetzung, { art: "verhaeltnis", zahl: 12 });
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, mindestbesetzung: null }));
    assert.deepEqual(await besetzungVon(t), { besetzung_art: null, besetzung_zahl: null, besetzung_abweichend: false });
    // AK 5: ganze Zahlen von 1 bis 99, vorab mit dem Satz der Oberfläche; die Datenebene als Rückhalt.
    for (const zahl of [0, 100, 1.5])
      fehler(await aendereTermin(a.supabase, a.id, { terminId: t, mindestbesetzung: { art: "fest", zahl } }), "eingabe", BESETZUNG_TEXT.zahl);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, mindestbesetzung: { art: "keine" as never, zahl: 2 } }), "eingabe", BESETZUNG_TEXT.art);
    const { error: direkt } = await admin.from("training_termine").update({ besetzung_art: "fest", besetzung_zahl: 0 }).eq("id", t);
    assert.ok(direkt?.message.includes("tt_besetzung"), direkt?.message);

    // Serie (AK 1, 3, 4, PC 1): jeder Termin trägt sie; nur dieser weicht ab; alle lässt den abweichenden aus.
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(tagCh(1))], von: tagCh(1), bis: tagCh(22), beginn: "18:00", ende: "19:30", mindestbesetzung: { art: "verhaeltnis", zahl: 10 } }));
    const st = await termineDer(s.serieId);
    for (const x of st) assert.deepEqual(await besetzungVon(x.id), { besetzung_art: "verhaeltnis", besetzung_zahl: 10, besetzung_abweichend: false });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: st[1].id, reichweite: "nur_dieser", mindestbesetzung: { art: "fest", zahl: 3 } }));
    assert.deepEqual(await besetzungVon(st[1].id), { besetzung_art: "fest", besetzung_zahl: 3, besetzung_abweichend: true });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: st[0].id, reichweite: "alle", mindestbesetzung: { art: "fest", zahl: 2 }, bestaetigt: true }));
    assert.deepEqual(await besetzungVon(st[0].id), { besetzung_art: "fest", besetzung_zahl: 2, besetzung_abweichend: false });
    assert.deepEqual(await besetzungVon(st[1].id), { besetzung_art: "fest", besetzung_zahl: 3, besetzung_abweichend: true }, "der abweichende bleibt");
    const plan = wert(await teamPlan(a.supabase, a.id, { teamId: team }));
    const eintrag = plan.kommend.find((x) => x.id === st[1].id)!;
    assert.deepEqual(eintrag.serie!.mindestbesetzung, { art: "fest", zahl: 2 });
    assert.ok(eintrag.abweichungen.includes("besetzung"));
    // AK 4: wieder der Serie folgen.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: st[1].id, angaben: ["besetzung"] }));
    assert.deepEqual(await besetzungVon(st[1].id), { besetzung_art: "fest", besetzung_zahl: 2, besetzung_abweichend: false });
    // Teilen: die neue Serie trägt die neue Angabe, die alte behält ihre; erweitern: neue Termine tragen sie.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: st[2].id, reichweite: "dieser_und_folgende", mindestbesetzung: null }));
    const neueSerie = (await admin.from("training_termine").select("serie_id").eq("id", st[2].id).single()).data!.serie_id as string;
    assert.notEqual(neueSerie, s.serieId);
    const serieBesetzung = async (id: string) =>
      (await admin.from("termin_serien").select("besetzung_art, besetzung_zahl").eq("id", id).single()).data!;
    assert.deepEqual(await serieBesetzung(s.serieId), { besetzung_art: "fest", besetzung_zahl: 2 });
    assert.deepEqual(await serieBesetzung(neueSerie), { besetzung_art: null, besetzung_zahl: null });
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: st[0].id, reichweite: "alle", bis: tagCh(29), bestaetigt: true }));
    const dazu = (await termineDer(s.serieId)).filter((x) => x.datum > tagCh(8));
    for (const x of dazu) assert.equal((await besetzungVon(x.id)).besetzung_art, "fest", `neuer Termin ${x.datum}`);
    // KI-Auskunft: Mindestbesetzung und nötige Zahl stehen im Plan (AK 12).
    const s2 = await teamPlan(a.supabase, a.id, { teamId: team }).then(wert);
    assert.deepEqual(s2.kommend.find((x) => x.id === st[0].id)!.mindestbesetzung, { art: "fest", zahl: 2 });
  });

  await pruefe("Trainingsplan eingrenzen: dabei und eingeladen, mit Zeitraum (#519 AK 19, 26, #329)", async () => {
    const team = await serienTeam("Kern-DB-Trainer-Eingrenzen");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const meiner = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00", eingeladene: [a.id] })).terminId;
    const fremder = wert(await legeTerminFest(b.supabase, b.id, { art: "training", teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:00", eingeladene: [b.id] })).terminId;
    const ids = (p: { kommend: { id: string }[]; vergangen: { id: string }[] }) => [...p.kommend, ...p.vergangen].map((x) => x.id).sort();
    for (const eingrenzung of ["dabei", "eingeladen"] as const)
      assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { teamId: team, eingrenzung }))), [meiner], eingrenzung);
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { teamId: team }))), [meiner, fremder].sort());
    // Zeitraum und Eingrenzung verbinden sich; beide Grenzen schliessen ein.
    const amRand = { teamId: team, von: tagCh(4), bis: tagCh(4) };
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, amRand))), [fremder], "von = bis = ein Tag, eingeschlossen");
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { ...amRand, eingrenzung: "dabei" }))), [], "der fremde Termin fällt heraus");
    // AK 25: sich selbst einladen — danach steht er auch in der Eingrenzung.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: fremder, einladen: [a.id] }));
    assert.deepEqual(ids(wert(await teamPlan(a.supabase, a.id, { teamId: team, eingrenzung: "dabei" }))), [meiner, fremder].sort());
    // Leere Angaben sind gegeben, aber ungültig — nicht «kein Zeitraum» (#329 AK 14).
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "", bis: "" }), "eingabe", TERMIN_TEXT.datum);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "", bis: tagCh(1) }), "eingabe", TERMIN_TEXT.datum);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: tagCh(1), bis: tagCh(0) }), "eingabe", ZEITRAUM_TEXT.bisVorVon);
    fehler(await teamPlan(a.supabase, a.id, { teamId: team, von: "2030-02-30", bis: "2030-03-01" }), "eingabe", TERMIN_TEXT.datum);
  });

  await pruefe("Mitgliederliste mit E-Mail-Adresse, nur für aktuelle Mitglieder; der KI-Weg ohne (#425 AK 1, 4, PC 3, OoS 1)", async () => {
    const team = await serienTeam("Kern-DB-Mitglieder-Email");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const adresse = async (id: string) => (await admin.auth.admin.getUserById(id)).data.user!.email!;
    const liste = async (k: Konto) => k.supabase.rpc("team_mitglieder", { p_team: team });

    const { data, error } = await liste(b);
    assert.equal(error, null);
    assert.deepEqual(
      (data as { user_id: string; email: string; ist_verwaltung: boolean }[]).map((m) => [m.user_id, m.email, m.ist_verwaltung]).sort(),
      [[a.id, await adresse(a.id), false], [b.id, await adresse(b.id), false]].sort(),
      "AK 1: jedes Mitglied mit seiner Adresse",
    );
    // #581 AK 15: Wer auch zur Vereinsverwaltung gehört, ist gekennzeichnet.
    await admin.from("team_members").insert({ team_id: team, user_id: verwaltung.id });
    const mitVerwaltung = (await liste(b)).data as { user_id: string; ist_verwaltung: boolean }[];
    assert.deepEqual(mitVerwaltung.filter((m) => m.ist_verwaltung).map((m) => m.user_id), [verwaltung.id], "#581 AK 15");
    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", verwaltung.id);
    assert.ok((await liste(await wegwerfKonto())).error, "AK 4: wer nicht im Team ist, bekommt keine Liste");

    await admin.from("team_members").delete().eq("team_id", team).eq("user_id", b.id);
    assert.ok((await liste(b)).error, "PC 3: nach dem Austritt keine Adressen mehr");
    const m = wert(await teamMitglieder(a.supabase, a.id, { teamId: team })).mitglieder;
    assert.ok(m.length === 1 && m.every((x) => !("email" in x)), "OoS 1: der KI-Assistent bekommt keine Adresse");
  });

  // ── Kalender: Ausfall (#327) ─────────────────────────────────────────────
  await pruefe("Ausfall: das Training ruht am Termin, Grund, zurücknehmen, verlegen (#327, PO 2026-10-06)", async () => {
    const team = await serienTeam("Kern-DB-Ausfall");
    const tr = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Ausfall", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", bemerkung: "Leibchen" }));
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
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30" }));
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
    const t1 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" }));
    const t2 = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-2), beginn: "18:00", ende: "19:00" }));
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
    const termin = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    const traegt = async () => (await admin.from("training_termine").select("training_id").eq("id", termin).single()).data!.training_id;
    const p = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Persoenlich-Kinder", altersstufe: "kinderfussball", stufen: ["F"] })).id;

    // AK 11 (UI-Weg): Wer den Termin ohne Training sah, obwohl er eines trägt, wird abgewiesen — ohne Kopie.
    const altes = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Alt", altersstufe: "kinderfussball", stufen: ["F"], teamId: team })).id;
    const amTermin = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: altes })).trainingId;
    const vorher = await anzahl();
    fehler(
      await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: p, erwartet: { trainingAmTermin: null } }),
      "konflikt",
      TERMIN_MELDUNG.TERMIN_BELEGUNG_GEAENDERT,
    );
    assert.equal(await anzahl(), vorher, "veraltete Auswahl: keine Kopie");
    assert.equal(await traegt(), amTermin, "der Termin bleibt unverändert");

    // PC 5, AK 7: Mit zutreffender Erwartung wird die Kopie verknüpft; das ersetzte Termin-Training geht.
    const z = wert(await ordneTrainingZu(a.supabase, a.id, { terminId: termin, trainingId: p, erwartet: { trainingAmTermin: amTermin } }));
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
  const austreten = async (k: Konto, team: string) => {
    const { error } = await k.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: k.id });
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
      // Das Abo nennt nur die Termine, zu denen man eingeladen ist (#522 AK 1).
      await admin.from("termin_trainer").insert({ termin_id: data.id, user_id: a.id, verantwortlich: true });
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
      assert.deepEqual(
        Object.keys(t).sort(),
        ["art", "beginn", "besetzung_art", "besetzung_zahl", "bezeichnung", "datum", "ende", "erwartete_spielerzahl", "geaendert", "id", "ort", "ort_link", "spielstand", "stand", "trainer"],
        "Zeit, Ort samt Kartenlink (#533 PC 4) und Besetzung (#522) - weder Bemerkung noch Training",
      );
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
    const alt = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-29), beginn: "10:00", ende: "11:00" }));
    const rand = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-28), beginn: "10:00", ende: "11:00" }));
    const aus = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "10:00", ende: "11:00" }));
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

  await pruefe("Abo der Trainer:innen: nur eigene Einladungen, Stand, Namen, Besetzung, LAST-MODIFIED bewegt sich (#522 AK 1–5, PC 1–3)", async () => {
    const team = await serienTeam("Kern-DB-Abo-Trainer");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const tagCh = (d: number) => plusTage(kalendertagAmTrainingsort(), d);
    const token = (await holen(b, team)).token!;
    const mit = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", mindestbesetzung: { art: "fest", zahl: 3 } })).terminId;
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:00", eingeladene: [a.id] })).terminId;
    type Eintrag = AboTrainerTermin & { id: string; geaendert: string };
    const eintraege = async () => (await feed(token)).termine as unknown as Eintrag[];
    // AK 1, PC 3: nur, wozu B eingeladen ist.
    assert.deepEqual((await eintraege()).map((t) => t.id), [mit]);
    const e1 = (await eintraege())[0];
    assert.equal(e1.stand, "dabei");
    assert.equal(aboTitel(e1, "Training · X"), "Training · X");
    const text = aboBeschreibung(e1);
    assert.ok(text.includes("Du bist dabei."), text);
    assert.ok(/Dabei \(2 von 2\): /.test(text), text);
    assert.ok(text.includes("Mindestbesetzung 3 – es fehlt 1 Trainer:in."), text);
    // AK 2, 3, PC 2: absagen bleibt im Abo, «Abgesagt» vorn, LAST-MODIFIED rückt vor.
    await new Promise((r) => setTimeout(r, 20));
    wert(await setzeAbsage(b.supabase, b.id, { terminId: mit, userId: b.id, abgesagt: true }));
    const e2 = (await eintraege())[0];
    assert.equal(e2.stand, "abgesagt");
    assert.equal(aboTitel(e2, "Training · X"), "Abgesagt · Training · X");
    assert.ok(Date.parse(e2.geaendert) > Date.parse(e1.geaendert), "LAST-MODIFIED rückt vor");
    assert.ok(aboBeschreibung(e2).includes("Abgesagt: "), aboBeschreibung(e2));
    // Verantwortlich vorn im Titel.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: mit, verantwortlich: b.id }));
    const e3 = (await eintraege())[0];
    assert.equal(aboTitel(e3, "Training · X"), "Verantwortlich · Training · X");
    // PC 1: eingeladen → erscheint; ausgeladen → verschwindet.
    wert(await aendereTrainer(a.supabase, a.id, { terminId: ohne, einladen: [b.id] }));
    assert.deepEqual((await eintraege()).map((t) => t.id), [mit, ohne]);
    wert(await aendereTrainer(a.supabase, a.id, { terminId: ohne, ausladen: [b.id] }));
    assert.deepEqual((await eintraege()).map((t) => t.id), [mit]);
    // Die Stand-Tabelle ist für die API-Rollen gesperrt.
    assert.ok((await b.supabase.from("termin_trainer_stand").select("termin_id")).error || ((await b.supabase.from("termin_trainer_stand").select("termin_id")).data ?? []).length === 0);
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

  await pruefe("Abo erlischt beim Entfernen durch ein anderes Mitglied, beim Austritt der Letzten, bei Teamauflösung und bei Kontolöschung (#330 PC 9; #581 PC 3)", async () => {
    // Entfernen durch ein anderes Mitglied.
    const team = await serienTeam("Kern-DB-Abo-Entfernen");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    const tb = (await holen(b, team)).token!;
    const { error } = await a.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: b.id });
    assert.equal(error, null);
    assert.deepEqual(await feed(tb), { gueltig: false });
    assert.equal((await aboZeilen(team, b.id)).length, 0);

    // #581 PC 3: Das letzte Mitglied tritt aus — sein Abo erlischt, das Team bleibt.
    const aufgeloest = await serienTeam("Kern-DB-Abo-Aufloesen");
    await admin.from("team_members").insert({ team_id: aufgeloest, user_id: b.id });
    const ta = (await holen(a, aufgeloest)).token!;
    const tb2 = (await holen(b, aufgeloest)).token!;
    await austreten(a, aufgeloest);
    assert.deepEqual(await feed(ta), { gueltig: false }, "Abo der Ausgetretenen erloschen");
    assert.equal((await feed(tb2)).gueltig, true);
    await austreten(b, aufgeloest);
    assert.equal((await admin.from("teams").select("id").eq("id", aufgeloest)).data!.length, 1, "#581 PC 3: Team bleibt ohne Mitglied");
    assert.deepEqual(await feed(tb2), { gueltig: false });
    // Auflösen durch die Vereinsverwaltung: Team und alle Abos sind weg.
    await admin.from("team_members").insert({ team_id: aufgeloest, user_id: b.id });
    const tb3 = (await holen(b, aufgeloest)).token!;
    assert.equal(wert(await loeseTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: aufgeloest, teamname: "Kern-DB-Abo-Aufloesen" })).status, "aufgeloest");
    assert.equal((await admin.from("teams").select("id").eq("id", aufgeloest)).data!.length, 0, "Team aufgelöst");
    assert.deepEqual(await feed(tb3), { gueltig: false });
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
    assert.equal((await admin.from("teams").select("id").eq("id", tc)).data!.length, 1, "#581 PC 3: Team bleibt nach der Kontolöschung");
  });

  // ── Team bleibt ohne Mitglied; Auflösen nur durch die Verwaltung (#480 → #581) ──
  await pruefe("Team bleibt beim Austritt der Letzten und löst sich nur durch die Verwaltung mit dem aktuellen Namen auf (#480 AK 6, 7, 11, PC 2, 3, 5; #581 AK 24, 26, 28, PC 1, 3)", async () => {
    const besteht = async (team: string) => (await admin.from("teams").select("id").eq("id", team)).data!.length === 1;
    const austritt = async (k: Konto, team: string) => {
      const { data, error } = await k.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: k.id });
      if (error) throw error;
      return data as { status: string };
    };
    const aufloesen = async (k: Konto, team: string, teamname: string) =>
      loeseTeamAuf(k.supabase, k.id, { teamId: team, teamname });

    const team = await serienTeam("Kern-DB-Auflösen-480");
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });

    // #480 AK 11, #581 AK 26: Die direkten Wege sind zu — weder Team löschen
    // noch umbenennen noch die eigene Mitgliedschaft löschen.
    await a.supabase.from("teams").delete().eq("id", team);
    assert.ok((await a.supabase.from("teams").update({ name: "Kern-DB-Direkt" }).eq("id", team)).error, "direktes UPDATE auf teams abgewiesen");
    await a.supabase.from("team_members").delete().eq("team_id", team).eq("user_id", a.id);
    assert.ok(await besteht(team), "direktes DELETE auf teams wirkungslos");
    assert.equal((await admin.from("teams").select("name").eq("id", team).single()).data!.name, "Kern-DB-Auflösen-480");
    assert.equal((await admin.from("team_members").select("user_id").eq("team_id", team)).data!.length, 2, "direktes DELETE auf team_members wirkungslos");

    // #581 AK 26: Mitglieder lösen nicht auf, auch nicht mit dem richtigen Namen — ununterscheidbar «nicht gefunden».
    fehler(await aufloesen(a, team, "Kern-DB-Auflösen-480"), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);
    assert.ok(await besteht(team));

    // #480 AK 6: Gross- und Kleinschreibung zählen; PC 2: Team unverändert.
    assert.deepEqual(wert(await aufloesen(verwaltung, team, "kern-db-auflösen-480")), { status: "name_falsch", name: "Kern-DB-Auflösen-480" });
    assert.ok(await besteht(team));

    // #581 AK 28, PC 3: Beide verlassen das Team ohne Namen; es bleibt ohne Mitglied bestehen.
    assert.deepEqual(await austritt(b, team), { status: "entfernt" });
    assert.deepEqual(await austritt(a, team), { status: "entfernt" });
    assert.ok(await besteht(team), "#581 PC 3: Team bleibt ohne Mitglied");
    // Ein Nichtmitglied tritt nicht aus: «not a member» (die Action macht daraus einen Satz).
    await assert.rejects(austritt(a, team), (e: { message: string }) => e.message.includes("not a member"));

    // #480 PC 3: Umbenannt — der alte Name trägt nicht mehr, die Antwort nennt den neuen.
    wert(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: team, name: "Kern-DB-Umbenannt-480" }));
    assert.deepEqual(wert(await aufloesen(verwaltung, team, "Kern-DB-Auflösen-480")), { status: "name_falsch", name: "Kern-DB-Umbenannt-480" });
    assert.ok(await besteht(team));

    // #480 AK 7, #581 AK 24, PC 1: Leerzeichen am Rand zählen nicht; die
    // Spieler:innen bleiben samt Link im Verein.
    const lena = wert(await nimmSpielerAuf(a.supabase, a.id, { teamId: (await serienTeam("Kern-DB-Auflösen-480-Hilf")), vorname: "Lena", nachname: "Muster", jahrgang: 2017 })).spielerId;
    await admin.from("team_spieler").insert({ team_id: team, spieler_id: lena, verein_id: verein });
    const link = (await admin.from("spieler").select("link_token").eq("id", lena).single()).data!.link_token as string;
    const r = wert(await aufloesen(verwaltung, team, "  Kern-DB-Umbenannt-480 "));
    assert.deepEqual([r.status, r.status === "aufgeloest" && r.spielerBleiben], ["aufgeloest", 1]);
    assert.ok(!(await besteht(team)), "Team aufgelöst");
    assert.equal((await admin.from("spieler").select("link_token").eq("id", lena).single()).data!.link_token, link, "PC 1: Spieler:in samt Link bleibt");

    // #480 PC 5: Danach erfährt das frühere Mitglied, dass es das Team nicht
    // mehr gibt; die Verwaltung bekommt «nicht gefunden».
    const zwei = await serienTeam("Kern-DB-Auflösen-480-B");
    const aufgeloestZwei = wert(await aufloesen(verwaltung, zwei, "Kern-DB-Auflösen-480-B"));
    assert.equal(aufgeloestZwei.status, "aufgeloest");
    assert.equal(aufgeloestZwei.status === "aufgeloest" && aufgeloestZwei.name, "Kern-DB-Auflösen-480-B", "der Name für die Meldung kommt von der Datenebene");
    assert.deepEqual(await austritt(a, zwei), { status: "team_weg" });
    fehler(await aufloesen(verwaltung, zwei, "Kern-DB-Auflösen-480-B"), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);

    // Unicode-Normalform zählt nicht: «ö» als o + Trema bestätigt «ö».
    const drei = await serienTeam("Kern-DB-Auflösen-480-C");
    assert.equal(wert(await aufloesen(verwaltung, drei, "Kern-DB-Auflösen-480-C".normalize("NFD"))).status, "aufgeloest");

    // #581 PC 3: Löscht das letzte Mitglied sein Konto, bleibt das Team.
    const c = await wegwerfKonto();
    const vier = await serienTeam("Kern-DB-Auflösen-480-D");
    await admin.from("team_members").insert({ team_id: vier, user_id: c.id });
    await admin.from("team_members").delete().eq("team_id", vier).eq("user_id", a.id);
    const { error: weg } = await admin.auth.admin.deleteUser(c.id);
    if (weg) throw weg;
    konten.splice(konten.indexOf(c.id), 1);
    assert.ok(await besteht(vier), "Konto-Löschung lässt das Team bestehen");
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
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:30" }));
    assert.equal(await felderVon(ohne.terminId), null);
    // AK 1–6: mehrere Felder, Angaben einzeln offen, «keine» als 0; fehlende Angaben werden unbekannt.
    const t = wert(
      await legeTerminFest(a.supabase, a.id, {
        art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30",
        felder: [{ laenge_m: 30, breite_m: 25, tore: { minitor: 2, tor_5m: 0 }, untergrund: "kunstrasen" }, {}],
      }),
    );
    assert.deepEqual(await felderVon(t.terminId), [KUNSTRASEN, UNBEKANNT]);
    // Eine leere Liste heisst ohne Felder.
    const leer = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", felder: [] }));
    assert.equal(await felderVon(leer.terminId), null);

    // AK 9, 15: vorab abgewiesen, mit dem Satz der Oberfläche und der Stelle; es entsteht nichts.
    const vorher = (await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count;
    const r = fehler(
      await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:30", felder: [{}, { laenge_m: 30 }] }),
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
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", ort: "Platz", felder: [KUNSTRASEN] }));
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
    assert.ok(!("felder" in imFeed), "die Felder stehen nicht im Abo");
  });

  // ── Kalender: erwartete Spielerzahl (#390) ───────────────────────────────
  const zahlVon = async (id: string) =>
    (await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", id).single()).data!.erwartete_spielerzahl as number | null;

  await pruefe("Spielerzahl: festlegen, ändern, entfernen, abgewiesen, KI-Parität, Plan und Auskunft (#390 AK 1–7)", async () => {
    const team = await serienTeam("Kern-DB-Spielerzahl");
    const ohne = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:30" }));
    assert.equal(await zahlVon(ohne.terminId), null, "PC 2: ohne Angabe unbekannt");
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", spielerzahl: 12 }));
    assert.equal(await zahlVon(t.terminId), 12);
    // AK 3: nur ganze Zahlen von 1 bis 200; vorab abgewiesen, es entsteht nichts.
    for (const schlecht of [0, 201, 12.5])
      fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", spielerzahl: schlecht }), "eingabe", TERMIN_TEXT.spielerzahl);
    assert.equal((await admin.from("training_termine").select("id", { count: "exact", head: true }).eq("team_id", team)).count, 2);
    wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(4), beginn: "18:00", ende: "19:30", spielerzahl: 200 }));
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
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:30", spielerzahl: 12 }));
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
    // Die erwartete Zahl liefert der Feed nur für die Mindestbesetzung (#521); der Eintrag nennt sie nicht.
    // Verglichen mit demselben Eintrag ohne Zahl statt nach «12» gesucht: Die
    // Namen der Wegwerf-Konten sind zufälliges Hex und enthalten manchmal «12».
    const eintrag = imFeed as unknown as AboTrainerTermin;
    assert.equal(
      aboBeschreibung(eintrag),
      aboBeschreibung({ ...eintrag, erwartete_spielerzahl: null }),
      "die Spielerzahl steht nicht im Eintrag",
    );
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
      p_ort: null, p_bemerkung: null, p_verantwortlich: a.id, p_felder: [{ laenge_m: 30 }],
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
  // ── Spielerliste (#434) ──────────────────────────────────────────────────
  /** Die Spieler:innen eines Teams über seine Zuordnungen (Story #577/#579),
   *  nicht über `spieler.team_id` — das ist nur noch das erste Team. */
  type SpielerZeile = { id: string; vorname: string; nachname: string; jahrgang: number; js_nummer: string | null };
  const spielerVon = async (team: string): Promise<SpielerZeile[]> => {
    const { data, error } = await admin
      .from("team_spieler")
      .select("spieler:spieler!tsp_spieler(id, vorname, nachname, jahrgang, js_nummer)")
      .eq("team_id", team);
    assert.equal(error, null);
    return ((data ?? []) as unknown as { spieler: SpielerZeile }[])
      .map((z) => z.spieler)
      .sort((x, y) => x.vorname.localeCompare(y.vorname, "de"));
  };
  const standVon = async (team: string, terminId: string) => {
    const t = (await getTeamPlanFuer(a.supabase, team)).find((x) => x.id === terminId);
    assert.ok(t, "Termin im Plan");
    return t;
  };
  const neuerSpieler = async (team: string, vorname: string, nachname = "Muster", jahrgang: number | string = 2017, jsNummer?: string) =>
    wert(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname, nachname, jahrgang, jsNummer }));
  /** Füllt das Team per Admin mit `n` Spieler:innen des Test-Vereins samt
   *  Zuordnung (Story #577); die Trigger und damit die Grenzen wirken. */
  const fuelleTeam = async (team: string, n: number) => {
    const zeilen = Array.from({ length: n }, (_, i) => ({ verein_id: verein, vorname: `Kind${i}`, nachname: "Viele", jahrgang: 2017 }));
    const { data, error } = await admin.from("spieler").insert(zeilen).select("id");
    assert.equal(error, null);
    const z = await admin.from("team_spieler").insert(data!.map((x) => ({ team_id: team, spieler_id: x.id, verein_id: verein })));
    assert.equal(z.error, null);
    return data!.map((x) => x.id as string);
  };

  await pruefe("Spielerliste: aufnehmen, bereinigt gespeichert, eindeutig über Schreibvarianten (#434 AK 1, 6, 14)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Eindeutig");
    const lena = await neuerSpieler(team, "  Anna-Lena ", " O’Brien ", "2017", " 2048731 ");
    assert.deepEqual(await spielerVon(team), [{ id: lena.spielerId, vorname: "Anna-Lena", nachname: "O’Brien", jahrgang: 2017, js_nummer: "2048731" }]);
    for (const [v, n] of [["anna lena", "o'brien"], ["ANNA  LENA", "O`Brien"], ["Anna–Lena", "o’brien"]])
      fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: v, nachname: n, jahrgang: 2017 }), "regel", SPIELER_MELDUNG.SPIELER_DOPPELT);
    // Akzente zählen, ein anderer Jahrgang auch.
    await neuerSpieler(team, "Anna-Lena", "O’Bríen", 2017);
    await neuerSpieler(team, "Anna-Lena", "O’Brien", 2018);
    fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: "Lena", nachname: "", jahrgang: 2017 }), "eingabe", SPIELER_TEXT.nachname);
    fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: "Lena", nachname: "Meier", jahrgang: "17" }), "eingabe", SPIELER_TEXT.jahrgang);
    // Ändern prüft dieselbe Eindeutigkeit; leer entfernt die J+S-Nummer.
    const zweite = (await spielerVon(team)).find((x) => x.jahrgang === 2018)!;
    fehler(await aendereSpieler(a.supabase, a.id, { teamId: team, spielerId: zweite.id, vorname: "anna lena", nachname: "o'brien", jahrgang: 2017 }), "regel", SPIELER_MELDUNG.SPIELER_DOPPELT);
    wert(await aendereSpieler(a.supabase, a.id, { teamId: team, spielerId: lena.spielerId, vorname: "Lena", nachname: "Meier", jahrgang: 2017, jsNummer: "" }));
    assert.equal((await spielerVon(team)).find((x) => x.id === lena.spielerId)!.js_nummer, null);
    const liste = wert(await ladeSpielerliste(a.supabase, a.id, { teamId: team }));
    assert.deepEqual(liste.spieler.map((x) => x.vorname), ["Anna-Lena", "Anna-Lena", "Lena"], "nach Vorname");
  });

  await pruefe("Spielerliste: nur Mitglieder, nur über die RPCs, höchstens 100 (#434 AK 7, 10; #577 AK 6, PC 2)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Rechte");
    const lena = await neuerSpieler(team, "Lena");
    fehler(await ladeSpielerliste(b.supabase, b.id, { teamId: team }), "nicht_gefunden");
    fehler(await nimmSpielerAuf(b.supabase, b.id, { teamId: team, vorname: "X", nachname: "Y", jahrgang: 2017 }), "nicht_gefunden");
    fehler(await aendereSpieler(b.supabase, b.id, { teamId: team, spielerId: lena.spielerId, vorname: "X", nachname: "Y", jahrgang: 2017 }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    // Herausnehmen: weder Auskunft noch Wirkung, auch nicht mit einem Stand (#579 AK 10).
    fehler(await ladeSpielerTeams(b.supabase, b.id, { teamId: team, spielerId: lena.spielerId }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    const standA = wert(await ladeSpielerTeams(a.supabase, a.id, { teamId: team, spielerId: lena.spielerId })).stand;
    fehler(await nimmSpielerAusTeam(b.supabase, b.id, { teamId: team, spielerId: lena.spielerId, stand: standA }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    assert.equal(await anzahlSpieler(a.supabase, team), 1, "nichts herausgenommen");
    assert.equal((await b.supabase.from("spieler").select("id").eq("id", lena.spielerId)).data?.length ?? 0, 0, "Fremde sehen nichts");
    assert.ok((await a.supabase.from("spieler").insert({ team_id: team, vorname: "X", nachname: "Y", jahrgang: 2017 })).error, "kein direktes Einfügen");
    const upd = await a.supabase.from("spieler").update({ vorname: "Hack" }).eq("id", lena.spielerId).select();
    assert.ok(upd.error || (upd.data ?? []).length === 0, "kein direktes Ändern");
    assert.ok((await feldAnon.from("spieler").select("id")).error, "anon hat kein Leserecht");
    assert.ok((await feldAnon.rpc("spieler_aufnehmen", { p_team: team, p_vorname: "X", p_nachname: "Y", p_jahrgang: 2017, p_js: null })).error);
    // 100 je Team (#577): 99 weitere direkt, dann weist die 101. ab.
    await fuelleTeam(team, 99);
    fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: "Zuviel", nachname: "X", jahrgang: 2017 }), "regel", SPIELER_MELDUNG.SPIELERLISTE_VOLL);
    // PC 2: An der Grenze bleiben Ändern und Herausnehmen möglich; danach ist wieder Platz.
    wert(await aendereSpieler(a.supabase, a.id, { teamId: team, spielerId: lena.spielerId, vorname: "Lena", nachname: "Geändert", jahrgang: 2017 }));
    wert(await nimmHeraus(a, team, lena.spielerId));
    await neuerSpieler(team, "Wieder", "Platz");
    assert.equal(await anzahlSpieler(a.supabase, team), 100);
  });

  await pruefe("Doppelerfassung im Verein: abgewiesen mit den Teams, ohne J+S, vor der Teamgrenze, fremder Verein stört nicht (#578 AK 1–4, 9, PC 2, 3; Testfall 5)", async () => {
    const eigenes = await serienTeam("Kern-DB-Doppelt-A");
    const teamB = await neuesTeam("Kern-DB-Doppelt-B");
    const teamC = await neuesTeam("Kern-DB-Doppelt-C");
    assert.equal((await admin.from("team_members").insert({ team_id: teamB, user_id: b.id })).error, null);
    // B führt Lina mit J+S-Nummer; sie gehört zusätzlich Team C an (Zuordnung
    // per Admin, wie sie ab Story #579 die Verwaltung setzt).
    const lina = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: teamB, vorname: "Lina", nachname: "Doppelt", jahrgang: 2016, jsNummer: "7654321" }));
    assert.equal((await admin.from("team_spieler").insert({ team_id: teamC, spieler_id: lina.spielerId, verein_id: verein })).error, null);
    // PC 2: Dieselbe Spieler:in in einem fremden Verein stört nicht und kommt in keiner Meldung vor.
    const fremd = await wegwerfKonto();
    const fremdVerein = await testVerein("Kern-DB-Doppelt-Fremd", fremd);
    const { data: ft, error: ftFehler } = await admin.from("teams").insert({ name: "Kern-DB-Doppelt-Fremd", verein_id: fremdVerein }).select("id").single();
    assert.equal(ftFehler, null);
    teams.push(ft!.id);
    assert.equal((await admin.from("team_members").insert({ team_id: ft!.id, user_id: fremd.id })).error, null);
    wert(await nimmSpielerAuf(fremd.supabase, fremd.id, { teamId: ft!.id, vorname: "Lina", nachname: "Doppelt", jahrgang: 2016 }));

    // AK 1, 2, 4: in Team A abgewiesen, nach den Vergleichsregeln, mit der
    // bereinigten Eingabe und beiden Teams in Namensfolge; PC 3: ohne J+S.
    const r = fehler(
      await nimmSpielerAuf(a.supabase, a.id, { teamId: eigenes, vorname: " lina ", nachname: "DOPPELT", jahrgang: 2016 }),
      "regel",
      "lina DOPPELT (2016) wird im Verein schon im Team «Kern-DB-Doppelt-B» und «Kern-DB-Doppelt-C» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
    );
    assert.equal((r as { feld?: string }).feld, "vorname");
    // PC 3 an der Quelle: Der Status nennt nur Teamnamen, keine J+S-Nummer, keinen Link, keine Kennung.
    const roh = await a.supabase.rpc("spieler_aufnehmen", { p_team: eigenes, p_vorname: "Lina", p_nachname: "Doppelt", p_jahrgang: 2016, p_js: null });
    assert.equal(roh.error, null);
    assert.deepEqual(roh.data, { status: "abgewiesen", grund: "doppelt", eigenes_team: false, teams: ["Kern-DB-Doppelt-B", "Kern-DB-Doppelt-C"], ohne_team: false });
    // AK 1: auch eine Schnuppernde; ein Team im Text.
    const nora = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: teamB, vorname: "Nora", nachname: "Doppelt", jahrgang: 2016 }));
    assert.equal((await admin.from("team_spieler").update({ probe_seit: new Date().toISOString() }).eq("spieler_id", nora.spielerId)).error, null);
    fehler(
      await nimmSpielerAuf(a.supabase, a.id, { teamId: eigenes, vorname: "Nora", nachname: "Doppelt", jahrgang: 2016 }),
      "regel",
      "Nora Doppelt (2016) wird im Verein schon im Team «Kern-DB-Doppelt-B» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
    );
    // AK 3: im eigenen Team der bisherige Text, auch wenn sie weiteren Teams angehört.
    fehler(await nimmSpielerAuf(b.supabase, b.id, { teamId: teamB, vorname: "Lina", nachname: "Doppelt", jahrgang: 2016 }), "regel", SPIELER_MELDUNG.SPIELER_DOPPELT);
    // AK 9: vor der Teamgrenze — im vollen Team A zuerst die Dublette.
    await fuelleTeam(eigenes, 100);
    fehler(
      await nimmSpielerAuf(a.supabase, a.id, { teamId: eigenes, vorname: "Lina", nachname: "Doppelt", jahrgang: 2016 }),
      "regel",
      /^Lina Doppelt \(2016\) wird im Verein schon im Team/,
    );
    fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: eigenes, vorname: "Neu", nachname: "Doppelt", jahrgang: 2016 }), "regel", SPIELER_MELDUNG.SPIELERLISTE_VOLL);
    // Nichts ist halb geschrieben: Lina steht im Verein genau einmal.
    const { count } = await admin.from("spieler").select("id", { count: "exact", head: true }).eq("verein_id", verein).eq("nachname", "Doppelt").eq("vorname", "Lina");
    assert.equal(count, 1);
  });

  await pruefe("Doppelerfassung beim Ändern: abgewiesen mit den Teams, gleicher Schlüssel geht (#578 AK 5–7; Testfall 7 ohne Altdublette)", async () => {
    const eigenes = await serienTeam("Kern-DB-Aendern-A");
    const teamB = await neuesTeam("Kern-DB-Aendern-B");
    const teamC = await neuesTeam("Kern-DB-Aendern-C");
    assert.equal((await admin.from("team_members").insert({ team_id: teamB, user_id: b.id })).error, null);
    const lina = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: teamB, vorname: "Lina", nachname: "Aendern", jahrgang: 2016, jsNummer: "7654321" }));
    assert.equal((await admin.from("team_spieler").insert({ team_id: teamC, spieler_id: lina.spielerId, verein_id: verein })).error, null);
    const mia = await neuerSpieler(eigenes, "Mia", "Aendern", 2016);
    const ella = await neuerSpieler(eigenes, "Ella", "Aendern", 2016);
    // AK 5, 6: auf eine Spieler:in anderer Teams → deren Teams, ohne J+S.
    fehler(
      await aendereSpieler(a.supabase, a.id, { teamId: eigenes, spielerId: mia.spielerId, vorname: "lina", nachname: "aendern", jahrgang: 2016 }),
      "regel",
      "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «Kern-DB-Aendern-B» und «Kern-DB-Aendern-C».",
    );
    // Auf eine Spieler:in des eigenen Teams → der bisherige Text.
    fehler(
      await aendereSpieler(a.supabase, a.id, { teamId: eigenes, spielerId: mia.spielerId, vorname: "Ella", nachname: "Aendern", jahrgang: 2016 }),
      "regel",
      SPIELER_MELDUNG.SPIELER_DOPPELT,
    );
    assert.deepEqual((await spielerVon(eigenes)).find((x) => x.id === mia.spielerId), { id: mia.spielerId, vorname: "Mia", nachname: "Aendern", jahrgang: 2016, js_nummer: null }, "unverändert");
    // AK 7: Schreibvariante desselben Schlüssels und neue J+S-Nummer gehen.
    wert(await aendereSpieler(a.supabase, a.id, { teamId: eigenes, spielerId: mia.spielerId, vorname: "MIA", nachname: "aendern", jahrgang: 2016, jsNummer: "123" }));
    assert.equal((await spielerVon(eigenes)).find((x) => x.id === mia.spielerId)!.js_nummer, "123");
    // Ein Team, dem sie nicht angehört, gilt als nicht gefunden (Rollen nach Ort).
    fehler(await aendereSpieler(b.supabase, b.id, { teamId: teamB, spielerId: ella.spielerId, vorname: "Ella", nachname: "Aendern", jahrgang: 2017 }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    fehler(await aendereSpieler(a.supabase, a.id, { teamId: teamB, spielerId: lina.spielerId, vorname: "Lina", nachname: "Aendern", jahrgang: 2017 }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
  });

  // ── Zuordnen und Herausnehmen (#579) ──────────────────────────────────────
  // Die Verwaltung ist ein eigenes Konto ohne Teammitgliedschaft; sie ordnet
  // über `verein_spieler_zuordnen` zu, Mitglieder nehmen über
  // `spieler_aus_team_nehmen` heraus. Was psql deckt (Altdubletten, Trigger-
  // Netz, Rennen), steht in supabase/tests/zuordnen_herausnehmen.sql und rennen.sql.
  /** Eine Spieler:in, wie die Abweisung des Zuordnens sie nennt. */
  const angaben = (id: string, vorname: string, nachname: string, jahrgang: number) => ({ id, vorname, nachname, jahrgang });
  const leer = { bereits: [], gleich: [], schnuppert: [], ueber_grenze: 0 };
  const zuordnen = (teamId: string, teamName: string, spielerIds: string[]) =>
    ordneSpielerZu(verwaltung.supabase, verwaltung.id, { teamId, teamName, spielerIds });
  const kaderVon = async (team: string) => wert(await ladeKader(a.supabase, a.id, { teamId: team })).kader;
  const zuordnungenVon = async (team: string) =>
    (await admin.from("team_spieler").select("spieler_id", { count: "exact", head: true }).eq("team_id", team)).count ?? 0;

  await pruefe("Zuordnen: nur die Verwaltung, ohne Mitgliedschaft, ganz oder gar nicht, mit der Zahl der Termine (#579 AK 1–3, 20, 23; PC 1, 13; Testfall 8)", async () => {
    const HERKUNFT = "Kern-DB-Zuordnen-Herkunft";
    const ZIEL = "Kern-DB-Zuordnen-Ziel";
    const herkunft = await neuesTeam(HERKUNFT);
    assert.equal((await admin.from("team_members").insert({ team_id: herkunft, user_id: b.id })).error, null);
    const ziel = await serienTeam(ZIEL);
    const lena = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: herkunft, vorname: "Lena", nachname: "Zuordnen", jahrgang: 2016, jsNummer: "1234567" })).spielerId;
    const noah = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: herkunft, vorname: "Noah", nachname: "Zuordnen", jahrgang: 2016 })).spielerId;
    // Mia steht ohne Team im Verein: aufgenommen und aus ihrem einzigen Team genommen.
    const mia = wert(await nimmSpielerAuf(b.supabase, b.id, { teamId: herkunft, vorname: "Mia", nachname: "Zuordnen", jahrgang: 2017 })).spielerId;
    assert.deepEqual(
      (({ ohneTeam, letztesEigenesTeam }) => [ohneTeam, letztesEigenesTeam])(wert(await nimmHeraus(b, herkunft, mia))),
      [true, true],
    );
    // Das Ziel ohne Spieler:innen: anstehende Termine und eine Serie mit erwarteter Zahl, ein vergangener.
    const kader = wert(await legeKaderAn(a.supabase, a.id, { teamId: ziel, name: "Ziel-Kader" })).kaderId;
    const bald = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: ziel, datum: tagCh(3), beginn: "18:00", ende: "19:00", spielerzahl: 12 })).terminId;
    const serie = wert(await legeSerieFest(a.supabase, a.id, { teamId: ziel, wochentage: [wochentagVon(tagCh(7))], von: tagCh(7), bis: tagCh(14), beginn: "18:00", ende: "19:30", spielerzahl: 14 })).serieId;
    const vorbei = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: ziel, datum: tagCh(-3), beginn: "18:00", ende: "19:00", spielerzahl: 9 })).terminId;
    const anstehend = (await admin.from("training_termine").select("id").eq("team_id", ziel).gt("datum", heuteCh).not("erwartete_spielerzahl", "is", null)).data!.length;
    assert.equal(anstehend, 3, "der Einzeltermin und zwei der Serie");

    // Testfall 8, AK 3: Ein Mitglied ordnet nicht zu und sieht den Bestand nicht.
    fehler(await ordneSpielerZu(a.supabase, a.id, { teamId: ziel, teamName: ZIEL, spielerIds: [lena] }), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);
    fehler(await ordneSpielerZu(b.supabase, b.id, { teamId: herkunft, teamName: HERKUNFT, spielerIds: [mia] }), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);
    fehler(await ladeVereinSpielerliste(a.supabase, a.id, { vereinId: verein }), "nicht_gefunden", NICHT_GEFUNDEN.verein);
    // Die Verwaltung: kein unbekanntes Team, keine Spieler:in eines fremden Vereins.
    fehler(await zuordnen(randomUUID(), ZIEL, [lena]), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);
    const fremd = await wegwerfKonto();
    const fremdVerein = await testVerein("Kern-DB-Zuordnen-Fremd", fremd);
    const { data: ft } = await admin.from("teams").insert({ name: "Kern-DB-Zuordnen-Fremd", verein_id: fremdVerein }).select("id").single();
    teams.push(ft!.id);
    assert.equal((await admin.from("team_members").insert({ team_id: ft!.id, user_id: fremd.id })).error, null);
    const fremde = wert(await nimmSpielerAuf(fremd.supabase, fremd.id, { teamId: ft!.id, vorname: "Lena", nachname: "Zuordnen", jahrgang: 2016 })).spielerId;
    fehler(await zuordnen(ziel, ZIEL, [lena, fremde]), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    // Am Team-Ort ist die Verwaltung ohne Mitgliedschaft niemand (Rollen nach Ort).
    fehler(await ladeSpielerliste(verwaltung.supabase, verwaltung.id, { teamId: ziel }), "nicht_gefunden");
    fehler(await nimmHeraus(verwaltung, herkunft, lena), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    assert.equal(await zuordnungenVon(ziel), 0, "nichts zugeordnet");

    // AK 1: Die Verwaltung sieht alle mit Vorname, Nachname, Jahrgang und Teams, auch ohne Team; seit #582 AK 1 dazu J+S-Nummer und Link-Stand, nie den Link.
    const vorher = wert(await ladeVereinSpielerliste(verwaltung.supabase, verwaltung.id, { vereinId: verein }));
    const zeile = (l: typeof vorher, id: string) => l.spieler.find((x) => x.id === id)!;
    assert.deepEqual(zeile(vorher, lena), { id: lena, vorname: "Lena", nachname: "Zuordnen", jahrgang: 2016, js: "1234567", linkBezogen: false, teams: [{ id: herkunft, name: HERKUNFT }] });
    assert.deepEqual(zeile(vorher, mia).teams, [], "ohne Team im Bestand");
    assert.ok(!vorher.spieler.some((x) => x.id === fremde), "kein fremder Verein");
    assert.deepEqual(vorher.teams.filter((t) => [herkunft, ziel].includes(t.id)), [
      { id: herkunft, name: HERKUNFT, anzahl: 2 },
      { id: ziel, name: ZIEL, anzahl: 0 },
    ]);

    // AK 2, 20, 23; PC 13: gesammelt, aus einem anderen Team und ohne Team; die erwartete Zahl fällt weg.
    const z = wert(await zuordnen(ziel, ZIEL, [lena, mia]));
    assert.deepEqual(z, { anzahl: 2, ersetzt: anstehend });
    assert.ok(zugeordnetText(["Lena Zuordnen", "Mia Zuordnen"], ZIEL, z.ersetzt).includes(`${anstehend} anstehenden Terminen`), "AK 23: die gelieferte Zahl im Satz");
    assert.equal((await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", bald).single()).data!.erwartete_spielerzahl, null);
    assert.equal((await admin.from("termin_serien").select("erwartete_spielerzahl").eq("id", serie).single()).data!.erwartete_spielerzahl, null);
    assert.equal((await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", vorbei).single()).data!.erwartete_spielerzahl, 9, "ein vergangener behält seine Zahl");
    // PC 1: kein Kader, zählt wie eine erfasste, auch für die Spielerzahl.
    assert.deepEqual((await kaderVon(ziel)).map((k) => [k.id, k.spielerIds]), [[kader, []]]);
    assert.deepEqual(spielerzahlVon(await standVon(ziel, bald)), { quelle: "liste", angemeldet: 2, gesamt: 2, anwesend: null });
    // Sie bleibt in ihrem bisherigen Team (AK 2).
    const nachher = wert(await ladeVereinSpielerliste(verwaltung.supabase, verwaltung.id, { vereinId: verein }));
    assert.deepEqual(zeile(nachher, lena).teams, [{ id: herkunft, name: HERKUNFT }, { id: ziel, name: ZIEL }]);
    assert.deepEqual(zeile(nachher, mia).teams, [{ id: ziel, name: ZIEL }]);
    // Ein Team mit Spieler:innen: keine Zahl fällt weg.
    assert.deepEqual(wert(await zuordnen(ziel, ZIEL, [noah])), { anzahl: 1, ersetzt: 0 });
    assert.equal(zugeordnetText(["Noah Zuordnen"], ZIEL, 0), zugeordnetText(["Noah Zuordnen"], ZIEL, 0).split(" An ")[0], "ohne Satz zur Zahl");
    assert.deepEqual(nachher.teams.find((t) => t.id === ziel), { id: ziel, name: ZIEL, anzahl: 2 });
  });

  await pruefe("Zuordnen abgewiesen: schon zugeordnet, schnuppert, Grenze — einzeln und gesammelt, nichts geschrieben (#579 AK 4–7, 21, 22; Entscheid A.4; Testfall 9)", async () => {
    const HERKUNFT = "Kern-DB-Abgewiesen-Herkunft";
    const ZIEL = "Kern-DB-Abgewiesen-Ziel";
    const VOLL = "Kern-DB-Abgewiesen-Voll";
    const herkunft = await serienTeam(HERKUNFT);
    const ziel = await serienTeam(ZIEL);
    const voll = await neuesTeam(VOLL);
    const neu = async (vorname: string) => angaben((await neuerSpieler(herkunft, vorname, "Abgewiesen", 2015)).spielerId, vorname, "Abgewiesen", 2015);
    const [eins, zwei, drei, vier, fuenf] = [await neu("Eins"), await neu("Zwei"), await neu("Drei"), await neu("Vier"), await neu("Fuenf")];
    // AK 4, 6: einzeln schon zugeordnet → der Befund, ohne die Grenze.
    wert(await zuordnen(ziel, ZIEL, [eins.id]));
    fehler(await zuordnen(ziel, ZIEL, [eins.id]), "regel", zuordnenAbweisungText({ ...leer, bereits: [eins] }, ZIEL, 1));
    // Entscheid A.4: Wer in einem Team schnuppert, lässt sich keinem weiteren zuordnen.
    assert.equal((await admin.from("team_spieler").update({ probe_seit: new Date().toISOString() }).eq("team_id", herkunft).eq("spieler_id", fuenf.id)).error, null);
    fehler(await zuordnen(ziel, ZIEL, [fuenf.id]), "regel", zuordnenAbweisungText({ ...leer, schnuppert: [{ ...fuenf, team: HERKUNFT }] }, ZIEL, 1));
    assert.equal((await admin.from("team_spieler").update({ probe_seit: null }).eq("team_id", herkunft).eq("spieler_id", fuenf.id)).error, null);

    // Testfall 9, AK 5, 21, 22: fünf in ein Team mit 97 → nichts, zwei zu viel.
    const bestand = await fuelleTeam(voll, 97);
    const fuenfe = [eins, zwei, drei, vier, fuenf];
    fehler(await zuordnen(voll, VOLL, fuenfe.map((p) => p.id)), "regel", zuordnenAbweisungText({ ...leer, ueber_grenze: 2 }, VOLL, 5));
    assert.equal(await zuordnungenVon(voll), 97, "ganz oder gar nicht");
    // Mit einer schon zugeordneten: der Befund und die Grenze (eine zu viel).
    const kind0 = (await admin.from("spieler").select("id, vorname, nachname, jahrgang").eq("id", bestand[0]).single()).data!;
    fehler(
      await zuordnen(voll, VOLL, [kind0.id, eins.id, zwei.id, drei.id, vier.id]),
      "regel",
      zuordnenAbweisungText({ ...leer, bereits: [kind0], ueber_grenze: 1 }, VOLL, 5),
    );
    assert.equal(await zuordnungenVon(voll), 97);
    // AK 7: Bei 100 nennt eine einzelne Zuordnung mit Befund nur den Befund, ohne Befund die Grenze.
    assert.deepEqual(wert(await zuordnen(voll, VOLL, [eins.id, zwei.id, drei.id])), { anzahl: 3, ersetzt: 0 });
    assert.equal(await zuordnungenVon(voll), 100);
    fehler(await zuordnen(voll, VOLL, [kind0.id]), "regel", zuordnenAbweisungText({ ...leer, bereits: [kind0] }, VOLL, 1));
    fehler(await zuordnen(voll, VOLL, [vier.id]), "regel", zuordnenAbweisungText({ ...leer, ueber_grenze: 1 }, VOLL, 1));
    assert.equal(await zuordnungenVon(voll), 100);
  });

  await pruefe("Weitere Teams und Herausnehmen: Auch-in, Kader nur des Kontextteams, Rückfrage ohne Stand, geänderter Stand, Folgen (#579 AK 9, 10, 13–16, 18; PC 3, 5–7, 9; Testfälle 10, 11, 29)", async () => {
    const HERKUNFT = "Kern-DB-Heraus-Herkunft";
    const ZIEL = "Kern-DB-Heraus-Ziel";
    const DRITT = "Kern-DB-Heraus-Dritt";
    // a in Herkunft und Ziel, b nur in Herkunft, c nur im Ziel.
    const herkunft = await serienTeam(HERKUNFT);
    assert.equal((await admin.from("team_members").insert({ team_id: herkunft, user_id: b.id })).error, null);
    const ziel = await serienTeam(ZIEL);
    const c = await wegwerfKonto();
    assert.equal((await admin.from("team_members").insert({ team_id: ziel, user_id: c.id })).error, null);
    const dritt = await neuesTeam(DRITT);
    const lena = (await neuerSpieler(herkunft, "Lena", "Heraus", 2016, "7654321")).spielerId;
    const elias = (await neuerSpieler(herkunft, "Elias", "Heraus", 2016)).spielerId;
    const noah = (await neuerSpieler(ziel, "Noah", "Heraus", 2016)).spielerId;
    wert(await zuordnen(ziel, ZIEL, [lena, elias]));

    // AK 9: Das Mitglied sieht die weiteren Teams; der Kader gehört dem Kontextteam.
    const kH = wert(await legeKaderAn(a.supabase, a.id, { teamId: herkunft, name: "K-Herkunft" })).kaderId;
    const kZ = wert(await legeKaderAn(a.supabase, a.id, { teamId: ziel, name: "K-Ziel" })).kaderId;
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: herkunft, spielerIds: [lena], dazu: [kH] }));
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: ziel, spielerIds: [lena], dazu: [kZ] }));
    const listeVon = async (k: Konto, team: string) => wert(await ladeSpielerliste(k.supabase, k.id, { teamId: team })).spieler;
    const imZiel = await listeVon(a, ziel);
    assert.deepEqual(imZiel.map((s) => [s.vorname, s.weitereTeams, s.kaderIds]), [["Elias", [HERKUNFT], []], ["Lena", [HERKUNFT], [kZ]], ["Noah", [], []]]);
    assert.deepEqual((await listeVon(a, herkunft)).map((s) => [s.vorname, s.weitereTeams, s.kaderIds]), [["Elias", [ZIEL], []], ["Lena", [ZIEL], [kH]]]);
    assert.deepEqual((await listeVon(b, herkunft)).find((s) => s.id === lena)!.weitereTeams, [ZIEL], "auch ohne Mitgliedschaft im weiteren Team");
    // Link-Knopf nur im ersten Team (bis Phase 7): Herkunft ist Lenas erstes.
    assert.deepEqual([imZiel.find((s) => s.id === lena)!.erstesTeam, imZiel.find((s) => s.id === noah)!.erstesTeam], [false, true]);
    // MCP «spieler_aendern» ohne team_id: das älteste ihrer Teams, dem man angehört — für c (nur im Ziel)
    // das Ziel, nicht ihr erstes Team (Herkunft), in dem c «nicht gefunden» bekäme.
    assert.equal(wert(await eigenesTeamVon(c.supabase, lena)), ziel);
    assert.equal(wert(await eigenesTeamVon(a.supabase, lena)), herkunft);
    assert.equal(wert(await aendereSpieler(c.supabase, c.id, { teamId: ziel, spielerId: lena, vorname: "Lena", nachname: "Heraus", jahrgang: 2016, jsNummer: "7654321" })).teamId, ziel);
    fehler(await eigenesTeamVon(b.supabase, noah), "nicht_gefunden");

    // Termine in beiden Teams. PC 3: Eine Abmeldung im Ziel berührt die Herkunft nicht und bleibt dort, wo sie gilt.
    const tH = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: herkunft, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const tZ = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: ziel, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const sZ = wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Cup", teamId: ziel, datum: tagCh(3), beginn: "10:00", ende: "12:00" })).terminId;
    const gZ = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: ziel, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: tZ, spielerId: lena, abgemeldet: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: tH, spielerId: elias, abgemeldet: true }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: sZ, spielerId: lena, angemeldet: true }));
    const abgemeldet = async (k: Konto, t: string, id: string) => wert(await terminSpieler(k.supabase, k.id, { terminId: t })).spieler.find((s) => s.spielerId === id)?.abgemeldet;
    assert.equal(await abgemeldet(a, tH, lena), false);
    assert.equal(await abgemeldet(c, tZ, lena), true);
    assert.equal(await abgemeldet(c, tZ, elias), false, "die Abmeldung der Herkunft gilt im Ziel nicht");
    fehler(await terminSpieler(b.supabase, b.id, { terminId: tZ }), "nicht_gefunden");

    // Testfall 29: ohne Stand eine Rückfrage samt Stand, nichts geändert.
    const frage = fehler(
      await nimmSpielerAusTeam(a.supabase, a.id, { teamId: ziel, spielerId: lena }),
      "regel",
      herausnehmenFrage({ vorname: "Lena", nachname: "Heraus", team: ZIEL, verein: "Kern-DB", verbleibend: [HERKUNFT], probe: false }),
    ) as { feld?: string; hinweis?: string };
    const auskunft = wert(await ladeSpielerTeams(a.supabase, a.id, { teamId: ziel, spielerId: lena }));
    assert.deepEqual(auskunft.teams, [{ name: HERKUNFT, eigen: true, dieses: false }, { name: ZIEL, eigen: true, dieses: true }]);
    assert.equal(frage.feld, "stand");
    assert.ok(frage.hinweis!.includes(auskunft.stand), "der Stand für die Wiederholung");
    assert.deepEqual(wert(await ladeSpielerTeams(c.supabase, c.id, { teamId: ziel, spielerId: lena })).teams.map((t) => t.eigen), [false, true], "eigen je Konto");
    // Inzwischen ordnet die Verwaltung sie einem dritten Team zu: Der alte Stand ändert nichts.
    wert(await zuordnen(dritt, DRITT, [lena]));
    fehler(await nimmSpielerAusTeam(a.supabase, a.id, { teamId: ziel, spielerId: lena, stand: auskunft.stand }), "konflikt", HERAUSNEHMEN_TEXT.geaendert);
    const roh = await a.supabase.rpc("spieler_aus_team_nehmen", { p_team: ziel, p_spieler: lena, p_stand: null });
    assert.equal(roh.error, null);
    assert.deepEqual((roh.data as { status: string; teams: unknown }).status, "stand_geaendert", "ohne p_stand: nichts geändert");
    assert.equal(await abgemeldet(c, tZ, lena), true, "noch im Ziel");

    // AK 10, 15: mit frischem Stand heraus — sie bleibt in Herkunft und Dritt, a ist dort Mitglied.
    assert.deepEqual(
      (({ ohneTeam, letztesEigenesTeam }) => [ohneTeam, letztesEigenesTeam])(wert(await nimmHeraus(a, ziel, lena))),
      [false, false],
    );
    // Testfall 10, PC 6: künftige Abmeldung, Spiel-Meldung und Kader im Ziel verfallen; die der Herkunft bleiben.
    assert.equal((await admin.from("termin_abmeldungen").select("spieler_id").eq("termin_id", tZ).eq("spieler_id", lena)).data!.length, 0);
    assert.equal((await admin.from("spiel_meldungen").select("spieler_id").eq("termin_id", sZ).eq("spieler_id", lena)).data!.length, 0);
    assert.deepEqual((await kaderVon(ziel)).find((k) => k.id === kZ)!.spielerIds, []);
    assert.deepEqual((await kaderVon(herkunft)).find((k) => k.id === kH)!.spielerIds, [lena]);
    assert.equal(await abgemeldet(a, tH, elias), true);
    // PC 5: an begonnenen Terminen des Ziels mit Namen und Stand bei Beginn, auch für c.
    const amBegonnenen = wert(await terminSpieler(c.supabase, c.id, { terminId: gZ })).spieler.find((s) => s.spielerId === lena)!;
    assert.deepEqual([amBegonnenen.vorname, amBegonnenen.ehemalig, amBegonnenen.nichtMehrImTeam], ["Lena", false, true]);
    // Testfall 11, AK 18: Nachtragen und Korrigieren am begonnenen Training; am künftigen nicht. Ein
    // Spiel mit vergangenem Anpfiff lässt sich über supabase-js nicht anlegen (SPIEL_ANPFIFF_VERGANGEN);
    // den Spiel-Fall deckt zuordnen_herausnehmen.sql.
    assert.equal(wert(await setzeAnwesenheit(c.supabase, c.id, { terminId: gZ, spielerId: lena, da: false })).nachgetragen, true);
    assert.equal(wert(await setzeAnwesenheit(c.supabase, c.id, { terminId: gZ, spielerId: lena, da: true })).nachgetragen, false);
    assert.equal((await setzeAnwesenheit(c.supabase, c.id, { terminId: tZ, spielerId: lena, da: false })).ok, false);
    // PC 7 über die Kern-Leser: c sieht sie nicht mehr, weder Zeile noch J+S-Nummer noch Link; a (Herkunft) schon.
    fehler(await ladeSpieler(c.supabase, lena), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    fehler(await holeSpielerLink(c.supabase, c.id, { spielerId: lena }), "nicht_gefunden");
    assert.ok(!(await listeVon(c, ziel)).some((s) => s.id === lena));
    assert.deepEqual((await c.supabase.from("spieler").select("js_nummer").eq("id", lena)).data ?? [], []);
    assert.equal(wert(await ladeSpieler(a.supabase, lena)).jsNummer, "7654321");
    // PC 4: Link bleibt.
    wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena }));

    // PC 9: erneut zugeordnet wie neu — ohne Kader, ohne frühere Meldungen.
    wert(await zuordnen(ziel, ZIEL, [lena]));
    assert.deepEqual((await listeVon(a, ziel)).find((s) => s.id === lena)!.kaderIds, []);
    assert.equal(await abgemeldet(a, tZ, lena), false);
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: sZ })).spieler.find((s) => s.spielerId === lena)!.meldung, null);

    // AK 16: c nimmt Elias aus dem letzten eigenen Team; er bleibt in der Herkunft.
    assert.deepEqual(
      (({ ohneTeam, letztesEigenesTeam }) => [ohneTeam, letztesEigenesTeam])(wert(await nimmHeraus(c, ziel, elias))),
      [false, true],
    );
    // Testfall 12 (Teil Mitglied), AK 12, 16: Noah aus seinem letzten Team — nicht gelöscht, ohne Team im Verein.
    fehler(
      await nimmSpielerAusTeam(a.supabase, a.id, { teamId: ziel, spielerId: noah }),
      "regel",
      herausnehmenFrage({ vorname: "Noah", nachname: "Heraus", team: ZIEL, verein: "Kern-DB", verbleibend: [], probe: false }),
    );
    assert.deepEqual(
      (({ ohneTeam, letztesEigenesTeam }) => [ohneTeam, letztesEigenesTeam])(wert(await nimmHeraus(a, ziel, noah))),
      [true, true],
    );
    assert.deepEqual(wert(await ladeVereinSpielerliste(verwaltung.supabase, verwaltung.id, { vereinId: verein })).spieler.find((s) => s.id === noah)!.teams, []);
    // Löschen kann das Mitglied nicht: Die Tabelle lässt es nicht zu; dass die
    // alte RPC fehlt, prüfen zuordnen_herausnehmen.sql und check:kern (alte Namen abwesend).
    await a.supabase.from("spieler").delete().eq("id", lena);
    assert.equal((await admin.from("spieler").select("id").eq("id", lena)).data!.length, 1, "kein direktes Löschen");
  });

  // Gleichnamige Teams gibt es seit #581 nur noch als Altdubletten (PC 6).
  // Auch die Service-Rolle legt keine mehr an (der Trigger `teams_vorher`
  // weist sie ab); dass die Datenebene «dieses» bei echten gleichnamigen
  // Teams über die Kennung setzt, prüft darum zuordnen_herausnehmen.sql
  // (Altdubletten unter `replica`), dass `verbleibendeTeams` nicht über den
  // Namen geht, `check:kern`. Hier der Weg durch Kern und Satz.
  await pruefe("Herausnehmen mit einem weiteren Team: verbleibend über «dieses» (#579 AK 14; #581 PC 6)", async () => {
    const NAME = "Kern-DB-Gleichnamig";
    const ZWEI = "Kern-DB-Gleichnamig-Zwei";
    const eins = await serienTeam(NAME);
    const zwei = await neuesTeam(ZWEI);
    const lena = (await neuerSpieler(eins, "Lena", "Gleich", 2016)).spielerId;
    wert(await zuordnen(zwei, ZWEI, [lena]));
    const teams = wert(await ladeSpielerTeams(a.supabase, a.id, { teamId: eins, spielerId: lena })).teams;
    assert.deepEqual(teams.map((t) => [t.name, t.dieses]).sort((x, y) => Number(x[1]) - Number(y[1])), [[ZWEI, false], [NAME, true]]);
    fehler(
      await nimmSpielerAusTeam(a.supabase, a.id, { teamId: eins, spielerId: lena }),
      "regel",
      herausnehmenFrage({ vorname: "Lena", nachname: "Gleich", team: NAME, verein: "Kern-DB", verbleibend: [ZWEI], probe: false }),
    );
  });

  await pruefe("Ohne Team im Verein: Doppelerfassung nennt es; Zuordnen nach Beginn lässt begonnene Termine, Kader-Termine gelten erst mit Kader (#579 AK 19; PC 2, 8)", async () => {
    const team = await serienTeam("Kern-DB-OhneTeam");
    const mia = (await neuerSpieler(team, "Mia", "Ohneteam", 2017)).spielerId;
    const lena = (await neuerSpieler(team, "Lena", "Ohneteam", 2017)).spielerId;
    // Mia aus ihrem einzigen Team: ohne Team im Verein.
    wert(await nimmHeraus(a, team, mia));
    // AK 19: Erfassen und Ändern nennen, dass sie ohne Team im Verein geführt wird.
    const roh = await a.supabase.rpc("spieler_aufnehmen", { p_team: team, p_vorname: "Mia", p_nachname: "Ohneteam", p_jahrgang: 2017, p_js: null });
    assert.deepEqual(roh.data, { status: "abgewiesen", grund: "doppelt", eigenes_team: false, teams: [], ohne_team: true });
    const doppelt = { eigenes_team: false, teams: [], ohne_team: true };
    fehler(
      await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: " mia ", nachname: "OHNETEAM", jahrgang: 2017 }),
      "regel",
      spielerDoppeltText(doppelt, { vorname: " mia ", nachname: "OHNETEAM", jahrgang: 2017 }),
    );
    fehler(
      await aendereSpieler(a.supabase, a.id, { teamId: team, spielerId: lena, vorname: "Mia", nachname: "Ohneteam", jahrgang: 2017 }),
      "regel",
      spielerDoppeltText(doppelt, null),
    );
    assert.notEqual(spielerDoppeltText(doppelt, null), SPIELER_MELDUNG.SPIELER_DOPPELT, "ein eigener Satz");

    // PC 8: Zuordnen nach Beginn ändert den festgehaltenen Stand nicht. PC 2: Kader-Termine gelten erst mit Kader.
    const k = wert(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "Nur Lena" })).kaderId;
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena], dazu: [k] }));
    const gestern = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    const morgen = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(1), beginn: "18:00", ende: "19:00" })).terminId;
    const mitKader = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00", kaderIds: [k] })).terminId;
    wert(await zuordnen(team, "Kern-DB-OhneTeam", [mia]));
    const namen = async (t: string) => wert(await terminSpieler(a.supabase, a.id, { terminId: t })).spieler.map((s) => s.vorname);
    assert.deepEqual(await namen(gestern), ["Lena"], "PC 8: begonnen, ohne die Zugeordnete");
    assert.equal((await standVon(team, gestern)).spielstand?.gesamt, 1);
    assert.deepEqual(await namen(morgen), ["Lena", "Mia"], "PC 2: ohne Kader sofort");
    assert.deepEqual(await namen(mitKader), ["Lena"], "PC 2: mit Kader erst im Kader");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [mia], dazu: [k] }));
    assert.deepEqual(await namen(mitKader), ["Lena", "Mia"]);
  });

  await pruefe("Verein: die 1001. Spieler:in weist ab, mit eigenem Text, auch in einem Team mit Platz (#577 AK 7, PC 3)", async () => {
    const team = await serienTeam("Kern-DB-Verein-Voll");
    const fuellung = await serienTeam("Kern-DB-Verein-Voll-Bestand");
    // Eine mit Zuordnung für die Dublette (#578 AK 9), dann bis 1000 im Verein
    // auffüllen, ohne Zuordnung: Alle Einträge zählen, auch die ohne Team
    // (ab Story #579) — und die Teamgrenze bleibt so unberührt.
    await neuerSpieler(fuellung, "Vorhanden", "Verein", 2016);
    const { count } = await admin.from("spieler").select("id", { count: "exact", head: true }).eq("verein_id", verein);
    const fehlend = VEREIN_SPIELER_MAX - (count ?? 0);
    assert.ok(fehlend > 0);
    for (let i = 0; i < fehlend; i += 500) {
      const zeilen = Array.from({ length: Math.min(500, fehlend - i) }, (_, j) => ({ verein_id: verein, vorname: `Kind${i + j}`, nachname: "Verein", jahrgang: 2016 }));
      assert.equal((await admin.from("spieler").insert(zeilen)).error, null);
    }
    const voll = fehler(await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: "Zuviel", nachname: "Verein", jahrgang: 2017 }), "regel", VEREIN_MELDUNG.VEREIN_VOLL);
    assert.notEqual(voll.meldung, SPIELER_MELDUNG.SPIELERLISTE_VOLL, "AK 7: unterscheidbar von der Teamgrenze");
    // #578 AK 9: Auch im vollen Verein meldet eine Dublette zuerst die Dublette.
    fehler(
      await nimmSpielerAuf(a.supabase, a.id, { teamId: team, vorname: "Vorhanden", nachname: "Verein", jahrgang: 2016 }),
      "regel",
      "Vorhanden Verein (2016) wird im Verein schon im Team «Kern-DB-Verein-Voll-Bestand» geführt. Kläre die Zuordnung zu deinem Team mit der Vereinsverwaltung.",
    );
    const zeilen = [{ zeile: 2, vorname: "Zuviel", nachname: "Import", jahrgang: 2016, jsNummer: null }];
    const v = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen }));
    fehler(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen, erwartet: erwartetVon(v) }), "regel", VEREIN_MELDUNG.VEREIN_VOLL);
    assert.equal(await anzahlSpieler(a.supabase, team), 0, "nichts aufgenommen");
    // #582 AK 6, 7: Erfassen durch die Verwaltung — derselbe Satz der Grenze, eine Dublette zuerst; die Zahl in der Ansicht.
    const erfassen = (vorname: string, nachname: string, jahrgang: number) =>
      legeSpielerImVereinAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, vereinName: "Kern-DB", vorname, nachname, jahrgang });
    fehler(await erfassen("Zuviel", "Verwaltung", 2017), "regel", VEREIN_MELDUNG.VEREIN_VOLL);
    fehler(
      await erfassen("Vorhanden", "Verein", 2016),
      "regel",
      "Vorhanden Verein (2016) wird im Kern-DB schon im Team «Kern-DB-Verein-Voll-Bestand» geführt. Ordne die vorhandene Spieler:in selbst einem Team zu. Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.",
    );
    const ansicht = wert(await ladeVereinAnsicht(verwaltung.supabase, verwaltung.id, { vereinId: verein }));
    const mitTeam = new Set((await admin.from("team_spieler").select("spieler_id").eq("verein_id", verein)).data!.map((z) => z.spieler_id)).size;
    assert.deepEqual([ansicht.spielerZahl, ansicht.spielerOhneTeam], [VEREIN_SPIELER_MAX, VEREIN_SPIELER_MAX - mitTeam], "#582 A1.2: gezählt wie die Grenze, mit denen ohne Team");
  });

  await pruefe("CSV-Import: Vorschau schreibt nicht, letzte Zeile gewinnt, Übernahme nur mit passender Vorschau (#455)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Import");
    const bald = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", spielerzahl: 12 })).terminId;
    const zeilen = [
      { zeile: 2, vorname: "Lina Marie", nachname: "Aebi", jahrgang: 2016, jsNummer: "100517283" },
      { zeile: 3, vorname: "Zoe", nachname: "Gerber", jahrgang: 2016, jsNummer: null },
      { zeile: 4, vorname: "Zoe", nachname: "Gerber", jahrgang: 2016, jsNummer: "2734410" },
    ];
    const v = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen }));
    assert.deepEqual(v, { neu: [2, 4], js: [], gleich: [], bestand: 0 }, "AK 21: die letzte Zeile gewinnt");
    assert.equal((await spielerVon(team)).length, 0, "die Vorschau schreibt nicht");
    assert.deepEqual(wert(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen, erwartet: erwartetVon(v) })), { teamId: team, neu: 2, js: 0, ersetzt: 1 });
    assert.deepEqual((await spielerVon(team)).map((x) => [x.vorname, x.js_nummer]), [["Lina Marie", "100517283"], ["Zoe", "2734410"]]);
    assert.equal(spielerzahlVon(await standVon(team, bald)).quelle, "liste", "die erste Spieler:in ersetzt die erwartete Zahl");

    // Weiterer Import: J+S-Nummer ändert sich, leere Zelle löscht nichts, neu, unverändert.
    const folge = [
      { zeile: 2, vorname: "lina marie", nachname: "AEBI", jahrgang: 2016, jsNummer: null },
      { zeile: 3, vorname: "Zoe", nachname: "Gerber", jahrgang: 2016, jsNummer: "100388164" },
      { zeile: 5, vorname: "Ronja", nachname: "Bühlmann", jahrgang: 2016, jsNummer: null },
    ];
    const v2 = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: folge }));
    assert.deepEqual(v2, { neu: [5], js: [{ zeile: 3, alt: "2734410" }], gleich: [2], bestand: 2 });
    // AK 27: Ein anderes Mitglied nimmt Ronja inzwischen auf — nichts wird übernommen.
    await neuerSpieler(team, "Ronja", "Bühlmann", 2016);
    fehler(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen: folge, erwartet: erwartetVon(v2) }), "konflikt", IMPORT_TEXT.geaendert);
    assert.equal((await spielerVon(team)).find((x) => x.vorname === "Zoe")!.js_nummer, "2734410", "ganz oder gar nicht");
    const v3 = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: folge }));
    assert.deepEqual(wert(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen: folge, erwartet: erwartetVon(v3) })), { teamId: team, neu: 0, js: 1, ersetzt: 0 });
    assert.deepEqual((await spielerVon(team)).map((x) => [x.vorname, x.js_nummer]), [["Lina Marie", "100517283"], ["Ronja", null], ["Zoe", "100388164"]]);

    // Nur Mitglieder, nur gültige Angaben.
    fehler(await pruefeSpielerImport(b.supabase, b.id, { teamId: team, zeilen }), "nicht_gefunden");
    fehler(await importiereSpieler(b.supabase, b.id, { teamId: team, zeilen, erwartet: { neu: [], js: [] } }), "nicht_gefunden");
    fehler(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: [{ ...zeilen[0], vorname: " " }] }), "eingabe", SPIELER_TEXT.vorname);
    fehler(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: [{ ...zeilen[0], jsNummer: "k.A." }] }), "eingabe", IMPORT_TEXT.js("k.A."));
  });

  await pruefe("CSV-Import: über 100 übernimmt nichts, nur J+S-Nummern an der Grenze schon (#455 AK 22; #577 PC 2)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Import-Voll");
    await fuelleTeam(team, 99);
    const zeilen = [
      { zeile: 2, vorname: "Eins", nachname: "Neu", jahrgang: 2016, jsNummer: null },
      { zeile: 3, vorname: "Zwei", nachname: "Neu", jahrgang: 2016, jsNummer: null },
    ];
    const v = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen }));
    assert.equal(v.bestand + v.neu.length, 101);
    fehler(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen, erwartet: erwartetVon(v) }), "regel", IMPORT_TEXT.zuGross);
    assert.equal((await spielerVon(team)).length, 99);
    // Bei 100 geht ein Import ohne neue Zeilen durch; eine neue Zeile nicht.
    await neuerSpieler(team, "Hundert");
    const js = [{ zeile: 2, vorname: "Kind0", nachname: "Viele", jahrgang: 2017, jsNummer: "1234567" }];
    const vj = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: js }));
    assert.deepEqual(wert(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen: js, erwartet: erwartetVon(vj) })), { teamId: team, neu: 0, js: 1, ersetzt: 0 });
    const mitNeu = [...js, { ...zeilen[0], zeile: 3 }];
    const vn = wert(await pruefeSpielerImport(a.supabase, a.id, { teamId: team, zeilen: mitNeu }));
    // An der Grenze nennt die Übernahme die Teamgrenze, nicht die Datei (wie die Vorschau, importGrenzText).
    assert.equal(vn.bestand, 100);
    fehler(await importiereSpieler(a.supabase, a.id, { teamId: team, zeilen: mitNeu, erwartet: erwartetVon(vn) }), "regel", SPIELER_MELDUNG.SPIELERLISTE_VOLL);
    assert.equal(await anzahlSpieler(a.supabase, team), 100);
  });

  await pruefe("Spielerliste ersetzt die erwartete Zahl: erste Aufnahme leert sie an anstehenden Terminen und Serien (#434 AK 8, 9, PC 1, 2)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Zahl");
    const vorbei = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-3), beginn: "18:00", ende: "19:00", spielerzahl: 9 })).terminId;
    const bald = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00", spielerzahl: 12 })).terminId;
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(tagCh(7))], von: tagCh(7), bis: tagCh(14), beginn: "18:00", ende: "19:30", spielerzahl: 14 }));
    assert.equal(spielerzahlVon(await standVon(team, bald)).quelle, "erwartet", "PC 1: ohne Liste wie bisher");
    const erste = await neuerSpieler(team, "Lena");
    assert.equal(erste.ersetzt, 1 + 2, "der anstehende Einzeltermin und die zwei der Serie");
    assert.equal((await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", bald).single()).data!.erwartete_spielerzahl, null);
    assert.equal((await admin.from("termin_serien").select("erwartete_spielerzahl").eq("id", s.serieId).single()).data!.erwartete_spielerzahl, null);
    assert.equal((await admin.from("training_termine").select("erwartete_spielerzahl").eq("id", vorbei).single()).data!.erwartete_spielerzahl, 9, "ein vergangener behält seine Zahl");
    assert.deepEqual(spielerzahlVon(await standVon(team, bald)), { quelle: "liste", angemeldet: 1, gesamt: 1, anwesend: null });
    assert.deepEqual(spielerzahlVon(await standVon(team, vorbei)), { quelle: "erwartet", zahl: 9 }, "bei Beginn war die Liste leer");
    // AK 9: keine Handzahl an anstehenden Terminen und Serien; der vergangene bleibt korrigierbar.
    fehler(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:00", spielerzahl: 8 }), "regel", SPIELER_MELDUNG.SPIELERLISTE_FUEHRT_ZAHL);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: bald, spielerzahl: 8 }), "regel", SPIELER_MELDUNG.SPIELERLISTE_FUEHRT_ZAHL);
    fehler(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [2], von: tagCh(20), bis: tagCh(30), beginn: "18:00", ende: "19:00", spielerzahl: 8 }), "regel", SPIELER_MELDUNG.SPIELERLISTE_FUEHRT_ZAHL);
    wert(await aendereTermin(a.supabase, a.id, { terminId: vorbei, spielerzahl: 10 }));
    // PC 2: Wird die Liste leer (hier durch Herausnehmen), ist die Zahl unbekannt, bis jemand eine festlegt.
    wert(await nimmHeraus(a, team, erste.spielerId));
    assert.deepEqual(spielerzahlVon(await standVon(team, bald)), { quelle: "unbekannt" });
    wert(await aendereTermin(a.supabase, a.id, { terminId: bald, spielerzahl: 11 }));
    assert.deepEqual(spielerzahlVon(await standVon(team, bald)), { quelle: "erwartet", zahl: 11 });
  });

  await pruefe("Spielerliste: begonnene Termine behalten den Stand bei Beginn, Namen wirken überall (#434 PC 3; #435 PC 1–4; #579 PC 5, 8, 11)", async () => {
    const team = await serienTeam("Kern-DB-Spieler-Stand");
    const lena = await neuerSpieler(team, "Lena");
    const ella = await neuerSpieler(team, "Ella");
    // Beim Festlegen schon begonnen: Der Stand gilt sofort (#435 PC 2).
    const gestern = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    const morgen = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(1), beginn: "18:00", ende: "19:00" })).terminId;
    const noah = await neuerSpieler(team, "Noah");
    assert.equal((await standVon(team, gestern)).spielstand?.gesamt, 2, "wer danach kam, zählt am vergangenen nicht");
    assert.equal((await standVon(team, morgen)).spielstand?.gesamt, 3);
    // Aus dem Verein gelöscht: am vergangenen bleibt sie als ehemalige Zeile ohne Namen, am anstehenden zählt sie nicht mehr (#579 PC 11).
    await loescheSpieler(verwaltung, lena.spielerId);
    assert.equal((await standVon(team, gestern)).spielstand?.gesamt, 2);
    assert.equal((await standVon(team, morgen)).spielstand?.gesamt, 2);
    const zeilen = async () => ((await admin.from("termin_teilnahmen").select("spieler_id").eq("termin_id", gestern)).data ?? []).map((z) => z.spieler_id).sort();
    assert.deepEqual(await zeilen(), [ella.spielerId, null].sort(), "ehemalige Spieler:in ohne Namen");
    // Aus dem Team genommen (#579 PC 5, 8): am vergangenen bleibt sie mit Namen, am anstehenden zählt sie nicht mehr, im Verein bleibt sie.
    wert(await nimmHeraus(a, team, ella.spielerId));
    assert.equal((await standVon(team, gestern)).spielstand?.gesamt, 2);
    assert.equal((await standVon(team, morgen)).spielstand?.gesamt, 1);
    assert.deepEqual(await zeilen(), [ella.spielerId, null].sort(), "die Zeile behält ihre Kennung");
    const amVergangenen = wert(await terminSpieler(a.supabase, a.id, { terminId: gestern })).spieler;
    assert.deepEqual(
      amVergangenen.map((x) => [x.vorname, x.ehemalig, x.nichtMehrImTeam]),
      [["Ella", false, true], [null, true, false]],
      "herausgenommen mit Namen, gelöscht ohne",
    );
    assert.equal((await admin.from("spieler").select("id").eq("id", ella.spielerId)).data?.length, 1, "nicht gelöscht");
    // In die Vergangenheit verlegt hält er jetzt fest; zurück in die Zukunft ist er wieder offen.
    wert(await aendereTermin(a.supabase, a.id, { terminId: morgen, datum: tagCh(-2) }));
    assert.equal((await standVon(team, morgen)).spielstand?.eingefroren, true);
    const mia = await neuerSpieler(team, "Mia");
    assert.equal((await standVon(team, morgen)).spielstand?.gesamt, 1);
    wert(await aendereTermin(a.supabase, a.id, { terminId: morgen, datum: tagCh(2) }));
    assert.deepEqual((await standVon(team, morgen)).spielstand, { gesamt: 2, angemeldet: 2, eingefroren: false, anwesend: null });
    // Der Name ändert sich überall (#435 PC 3): Er steht nur in `spieler`.
    wert(await aendereSpieler(a.supabase, a.id, { teamId: team, spielerId: noah.spielerId, vorname: "Noé", nachname: "Muster", jahrgang: 2017 }));
    assert.equal((await spielerVon(team)).find((x) => x.id === noah.spielerId)!.vorname, "Noé");
    // Team auflösen nimmt Termine und Zuordnungen mit (#434 PC 4); die
    // Spieler:innen bleiben ohne dieses Team im Verein (#579, Entscheid A.2).
    assert.equal((await admin.from("teams").delete().eq("id", team)).error, null);
    assert.equal((await admin.from("team_spieler").select("spieler_id").eq("team_id", team)).data?.length, 0);
    assert.equal((await admin.from("termin_eingefroren").select("termin_id").eq("team_id", team)).data?.length, 0);
    assert.deepEqual(
      ((await admin.from("spieler").select("id, team_id").in("id", [noah.spielerId, mia.spielerId])).data ?? []).map((x) => x.team_id),
      [null, null],
      "im Verein, ohne Team",
    );
  });
  // ── Ab- und Anmelden (#435) ──────────────────────────────────────────────
  await pruefe("Abmelden: ab und wieder an bis zum Beginn, Zahl folgt, Abweisungen mit Stand (#435 AK 1–6; #437 AK 3, 5)", async () => {
    const team = await serienTeam("Kern-DB-Abmelden");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const gesehen = { datum: tagCh(2), beginn: "18:00" };
    // AK 3: ohne Abmeldung alle angemeldet.
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 2, angemeldet: 2, eingefroren: false, anwesend: null });
    const ab = wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: true, gesehen }));
    assert.deepEqual(ab.stand, { gesamt: 2, angemeldet: 1, eingefroren: false, anwesend: null });
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: true, gesehen }));
    const liste = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.equal(liste.begonnen, false);
    assert.deepEqual(liste.spieler.map((s) => [s.vorname, s.abgemeldet]), [["Lena", false], ["Noah", true]]);
    assert.equal(liste.angemeldet, 1);
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: false, gesehen }));
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 2, "AK 2: wieder angemeldet");
    // #437 AK 5: inzwischen verlegt → Konflikt mit dem neuen Stand, nichts geschrieben.
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true, gesehen: { datum: tagCh(1), beginn: "18:00" } }),
      "konflikt", abweisungText("verlegt", { datum: tagCh(2), beginn: "18:00", ende: "19:00", ausgefallen: false }));
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 2);
    // #437 AK 3: ausgefallen → keine Ab- oder Anmeldung.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: null }));
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true, gesehen }), "regel", ABMELDUNG_TEXT.ausgefallen);
    // AK 4: begonnen → abgewiesen.
    const gestern = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: gestern, spielerId: lena, abgemeldet: true }), "regel", ABMELDUNG_TEXT.begonnen);
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: gestern })).begonnen, true);
    // Fremde: weder Team noch Spieler:in sichtbar; eine Spieler:in eines anderen Teams passt nicht.
    fehler(await setzeAbmeldung(b.supabase, b.id, { terminId: t, spielerId: lena, abgemeldet: true }), "nicht_gefunden");
    const anderes = await serienTeam("Kern-DB-Abmelden-Anders");
    const fremd = (await neuerSpieler(anderes, "Fremd")).spielerId;
    const offen = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: offen, spielerId: fremd, abgemeldet: true }), "nicht_gefunden");
    // Nur über die RPC: kein direktes Schreiben, die interne Regel nicht aufrufbar, anon ohne Zugang.
    assert.ok((await a.supabase.from("termin_abmeldungen").insert({ termin_id: offen, spieler_id: lena, team_id: team })).error);
    assert.ok((await a.supabase.rpc("abmeldung_anwenden", { p_termin: offen, p_spieler: lena, p_abgemeldet: true, p_gesehen_datum: null, p_gesehen_beginn: null })).error);
    assert.ok((await feldAnon.rpc("termin_abmeldung_setzen", { p_termin: offen, p_spieler: lena, p_abgemeldet: true })).error);
  });

  await pruefe("Abmelden: der Stand bei Beginn hält Abmeldungen fest, ehemalige ohne Namen (#435 AK 7, PC 1, 4; #437 PC 2)", async () => {
    const team = await serienTeam("Kern-DB-Abmelden-Stand");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(1), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: true }));
    // In die Vergangenheit verlegt: begonnen — die Abmeldung bleibt im festgehaltenen Stand.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-1) }));
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 2, angemeldet: 1, eingefroren: true, anwesend: 1 });
    assert.equal((await admin.from("termin_abmeldungen").select("spieler_id").eq("termin_id", t)).data?.length, 0, "eine Quelle: der festgehaltene Stand");
    // Danach ändert die Liste den Stand nicht mehr (PC 1).
    await neuerSpieler(team, "Mia");
    // Aus dem Verein gelöscht: ohne Namen (PC 4); aus dem Team genommen: mit
    // Namen und Stand bei Beginn (#579 PC 5). Die Zahl bleibt in beiden Fällen.
    await loescheSpieler(verwaltung, noah);
    wert(await nimmHeraus(a, team, lena));
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 2, angemeldet: 1, eingefroren: true, anwesend: 1 });
    const liste = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual(
      liste.spieler.map((s) => [s.vorname, s.abgemeldet, s.ehemalig, s.nichtMehrImTeam]),
      [["Lena", false, false, true], [null, true, true, false]],
      "PC 4; #579 PC 5",
    );
    assert.equal(liste.spieler[0].spielerId, lena);
  });
  // ── Privater Link (#436) ─────────────────────────────────────────────────
  await pruefe("Privater Link: holen, ansehen ohne Konto, ab- und anmelden, Geheimnis nur über die RPC (#436 AK 1, 4–9, 11, PC 1)", async () => {
    const team = await serienTeam("Kern-DB-Link");
    const lena = (await neuerSpieler(team, "Lena", "Meier")).spielerId;
    await neuerSpieler(team, "Noah");
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00", ort: "Wyler" })).terminId;
    // Gestern: vergangen, erscheint nicht.
    const gestern = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena }));
    assert.match(link.token, /^[0-9a-f]{64}$/);
    assert.equal(link.name, "Lena Meier");
    assert.equal(wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena })).token, link.token, "derselbe Link, bis er erneuert wird");
    fehler(await holeSpielerLink(b.supabase, b.id, { spielerId: lena }), "nicht_gefunden");
    // Das Geheimnis ist über die Tabelle nicht lesbar — auch nicht für Mitglieder.
    assert.ok((await a.supabase.from("spieler").select("link_token").eq("id", lena)).error);
    assert.ok((await a.supabase.from("spieler").select("*").eq("id", lena)).error);
    assert.ok((await feldAnon.rpc("spieler_link_holen", { p_spieler: lena })).error);

    const ansicht = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data;
    assert.equal(ansicht.gueltig, true);
    assert.equal(ansicht.team, "Kern-DB-Link");
    assert.deepEqual(ansicht.spieler, { vorname: "Lena", nachname: "Meier" }, "keine Namen anderer (OoS 2)");
    assert.deepEqual(ansicht.termine.map((x: { id: string }) => x.id), [t], "nichts Vergangenes (OoS 2)");
    assert.ok(!ansicht.termine.some((x: { id: string }) => x.id === gestern));
    assert.deepEqual(ansicht.termine[0], {
      id: t, datum: tagCh(2), beginn: "18:00", ende: "19:00", ort: "Wyler", ort_link: null, ausgefallen: false, ausfall_grund: null, begonnen: false, angemeldet: 2, gesamt: 2, abgemeldet: false, verfallen: null, kader: [],
      // Ein Training: keine Spielangaben (#459 AK 17).
      art: "training", bezeichnung: null, richtwert_min: null, richtwert_max: null,
      // Spielangaben (#463) bleiben an einem Training leer.
      meldung: null, meldung_verfallen: false, frist: null, frist_abgelaufen: false, vorher: null, hinweis_eltern: null, treffpunkte: null, treffpunkt: null, nicht_aufgeboten: false, aufgebot_verfallen: false, nicht_aufgeboten_zahl: null,
      // #523 AK 1, 2: die Verantwortliche mit Anzeigenamen (festgelegt hat a).
      verantwortlich: (await admin.rpc("anzeige_name", { p_user: a.id })).data as string,
    });
    // #523 AK 3, PC 1: nur sie, keine weiteren; ohne Verantwortliche:n null, ausgefallen null.
    await admin.from("team_members").insert({ team_id: team, user_id: b.id });
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, einladen: [b.id] }));
    const mitB = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0];
    assert.ok(!JSON.stringify(mitB).includes("trainer"), "keine weiteren Trainer:innen am Link");
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, ausladen: [a.id] }));
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0].verantwortlich, null);
    wert(await aendereTrainer(a.supabase, a.id, { terminId: t, verantwortlich: b.id }));
    // #533 AK 6: der Kartenlink zum Ort am privaten Link.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, ortLink: "https://maps.app.goo.gl/wyler" }));
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0].ort_link, "https://maps.app.goo.gl/wyler");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "Platz gesperrt\nNachholen offen" }));
    const ausgefallen = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0];
    assert.equal(ausgefallen.verantwortlich, null, "ausgefallen: keine");
    assert.equal(ausgefallen.ort_link, null, "#533 AK 7: ausgefallen kein Kartenlink");
    // #530 AK 1, 4: der Grund ganz, samt Zeilenumbruch.
    assert.equal(ausgefallen.ausfall_grund, "Platz gesperrt\nNachholen offen");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: null }));
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0].ausfall_grund, null, "#530 PC 1, 2: geleert");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "Regen" }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0].ausfall_grund, null, "#530 PC 3: zurückgenommen");

    const abmelden = (token: string, abgemeldet: boolean) =>
      feldAnon.rpc("spieler_link_abmelden", { p_token: token, p_termin: t, p_abgemeldet: abgemeldet, p_gesehen_datum: tagCh(2), p_gesehen_beginn: "18:00" });
    const ab = (await abmelden(link.token, true)).data;
    assert.equal(ab.status, "ok");
    assert.equal(ab.stand.angemeldet, 1);
    // #472 PC 1: Abgemeldet zählt sie weiter zu denen, für die er gilt.
    assert.deepEqual(
      (({ angemeldet, gesamt }) => [angemeldet, gesamt])((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0]),
      [1, 2],
    );
    // PC 1: Mitglieder sehen die Abmeldung wie eine eigene.
    const liste = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual(liste.spieler.map((s) => [s.vorname, s.abgemeldet]), [["Lena", true], ["Noah", false]]);
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine[0].abgemeldet, true);
    assert.equal((await abmelden(link.token, false)).data.stand.angemeldet, 2, "AK 8: wieder angemeldet");
    // Ein Termin eines anderen Teams passt nicht zum Link.
    const anderes = await serienTeam("Kern-DB-Link-Anders");
    const fremd = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: anderes, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const r = (await feldAnon.rpc("spieler_link_abmelden", { p_token: link.token, p_termin: fremd, p_abgemeldet: true, p_gesehen_datum: null, p_gesehen_beginn: null })).data;
    assert.deepEqual([r.status, r.grund], ["abgewiesen", "nicht_gefunden"]);

    // AK 11: unbekannt antwortet wie ungültig, ohne irgendetwas preiszugeben.
    const unbekannt = "0".repeat(64);
    assert.deepEqual((await feldAnon.rpc("spieler_link_ansicht", { p_token: unbekannt })).data, { gueltig: false });
    assert.deepEqual((await abmelden(unbekannt, true)).data, { status: "ungueltig" });
    // Anon sieht die Tabellen selbst nicht.
    assert.deepEqual((await feldAnon.from("spieler").select("id").eq("id", lena)).data ?? [], []);
    assert.deepEqual((await feldAnon.from("termin_abmeldungen").select("spieler_id").eq("termin_id", t)).data ?? [], []);
  });

  await pruefe("Privater Link: erneuern macht den alten ungültig, Abmeldungen bleiben; gelöscht gilt keiner mehr, herausgenommen bleibt er (#436 AK 3, 10, PC 2, 3; #579 PC 4)", async () => {
    const team = await serienTeam("Kern-DB-Link-Erneuern");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const alt = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena })).token;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    const neu = wert(await erneuereSpielerLink(a.supabase, a.id, { spielerId: lena })).token;
    assert.notEqual(neu, alt);
    assert.equal(wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena })).token, neu);
    assert.deepEqual((await feldAnon.rpc("spieler_link_ansicht", { p_token: alt })).data, { gueltig: false });
    assert.deepEqual(
      (await feldAnon.rpc("spieler_link_abmelden", { p_token: alt, p_termin: t, p_abgemeldet: false, p_gesehen_datum: null, p_gesehen_beginn: null })).data,
      { status: "ungueltig" },
    );
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: neu })).data.termine[0].abgemeldet, true, "PC 3");
    fehler(await erneuereSpielerLink(b.supabase, b.id, { spielerId: lena }), "nicht_gefunden");
    // #579 PC 4: Aus dem (letzten) Team genommen bleibt der Link gültig — bis
    // Story #583 (Phase 7) ohne Team und ohne Termine, danach mit denen der übrigen Teams.
    const vonNoah = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: noah })).token;
    wert(await nimmHeraus(a, team, noah));
    const ohneTeam = (await feldAnon.rpc("spieler_link_ansicht", { p_token: vonNoah })).data;
    assert.deepEqual([ohneTeam.gueltig, ohneTeam.team, ohneTeam.spieler, ohneTeam.termine], [true, null, { vorname: "Noah", nachname: "Muster" }, []]);
    // PC 2: aus dem Verein gelöscht gilt keiner mehr.
    await loescheSpieler(verwaltung, lena);
    assert.deepEqual((await feldAnon.rpc("spieler_link_ansicht", { p_token: neu })).data, { gueltig: false }, "PC 2: gelöscht");
  });

  // ── Kalender-Abo der Spielervertretung (#507) ────────────────────────────
  const linkVon = async (spielerId: string) => wert(await holeSpielerLink(a.supabase, a.id, { spielerId })).token;
  const aboHolen = async (link: string) => (await feldAnon.rpc("spieler_abo_holen", { p_link: link })).data as string | null;
  type AboFeedDb = { gueltig: boolean; abo?: string; team?: string; termine?: Record<string, unknown>[] };
  const aboFeed = async (token: string) => (await feldAnon.rpc("spieler_abo_termine", { p_token: token })).data as AboFeedDb;

  await pruefe("Abo Spielervertretung: über den Link holen, dieselbe Adresse, nur lesend, nie ableitbar (#507 AK 1, 5, 8–10; OoS 7)", async () => {
    const team = await serienTeam("Kern-DB-Eltern-Abo");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    const link = await linkVon(lena);
    const abo = (await aboHolen(link))!;
    assert.match(abo, /^[0-9a-f]{64}$/, "AK 9: nicht erratbar");
    assert.notEqual(abo, link);
    assert.equal(await aboHolen(link), abo, "AK 5: dieselbe Adresse");
    assert.equal((await admin.from("spieler_abos").select("id").eq("spieler_id", lena)).data!.length, 1, "AK 8: höchstens eine");
    assert.equal(await aboHolen("f".repeat(64)), null, "ungültiger Link holt nichts");
    // AK 10: Die Abo-Adresse ist kein Link — weder Ansicht noch Ab-/Anmelden.
    assert.deepEqual((await feldAnon.rpc("spieler_link_ansicht", { p_token: abo })).data, { gueltig: false });
    assert.deepEqual(
      (await feldAnon.rpc("spieler_link_abmelden", { p_token: abo, p_termin: t, p_abgemeldet: true, p_gesehen_datum: null, p_gesehen_beginn: null })).data,
      { status: "ungueltig" },
    );
    assert.equal(await aboHolen(abo), null, "aus der Abo-Adresse entsteht keine weitere");
    // OoS 7: Mitglieder und anon sehen keine Abo-Zeile.
    for (const k of [a.supabase, feldAnon]) assert.ok((await k.from("spieler_abos").select("id")).error, "kein Recht auf die Tabelle");
    // Der Feed nennt keinen Namen und verrät den Link nicht (PC 2, 6).
    const f = await aboFeed(abo);
    assert.deepEqual([f.gueltig, f.team], [true, "Kern-DB-Eltern-Abo"]);
    assert.ok(!JSON.stringify(f).includes("Lena") && !JSON.stringify(f).includes(link));
    assert.deepEqual(Object.keys(f.termine![0]).sort(), [
      "abgemeldet", "art", "beginn", "begonnen", "bezeichnung", "datum", "ende", "frist_abgelaufen", "hinweis_eltern",
      "id", "meldung", "nicht_aufgeboten", "ort", "ort_link", "treffpunkt", "treffpunkte",
    ]);
    assert.deepEqual(await aboFeed("f".repeat(64)), { gueltig: false });
  });

  await pruefe("Abo Spielervertretung: dieselben Termine wie der Link im selben Moment, ohne ausgefallene, mit dem Stand (#507 PC 1, 3, 4)", async () => {
    const team = await serienTeam("Kern-DB-Eltern-Abo-Gleichlauf");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const kader = wert(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "Nur Noah" })).kaderId;
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [noah], dazu: [kader] }));
    const neu = (tage: number, beginn = "18:00") =>
      legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(tage), beginn, ende: "21:00" }).then((r) => wert(r).terminId);
    const offen = await neu(2);
    const ab = await neu(3);
    const aus = await neu(4);
    const fremd = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(5), beginn: "18:00", ende: "19:00" })).terminId;
    const { setzeTerminKader } = await import("../lib/kern/kader");
    wert(await setzeTerminKader(a.supabase, a.id, { terminId: fremd, kaderIds: [kader] }));
    await admin.from("training_termine").insert({ team_id: team, datum: tagCh(-1), beginn: "18:00", ende: "19:00" });
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: ab, spielerId: lena, abgemeldet: true }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: aus }));
    const link = await linkVon(lena);
    const abo = (await aboHolen(link))!;
    const ansicht = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data as { termine: { id: string; ausgefallen: boolean }[] };
    const ids = (await aboFeed(abo)).termine!.map((x) => x.id);
    assert.deepEqual(ids, ansicht.termine.filter((x) => !x.ausgefallen).map((x) => x.id), "PC 1: wie der Link, ohne ausgefallene");
    assert.deepEqual(ids, [offen, ab], "nichts Vergangenes, nichts für andere Kader");
    assert.ok(!ids.includes(fremd) && !ids.includes(aus));
    assert.deepEqual((await aboFeed(abo)).termine!.map((x) => x.abgemeldet), [false, true], "PC 3");
    // PC 4: Verlegt erscheint er genau einmal am neuen Zeitpunkt, ausgefallen fehlt er.
    wert(await aendereTermin(a.supabase, a.id, { terminId: offen, datum: tagCh(6) }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: aus }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: ab }));
    const danach = (await aboFeed(abo)).termine!;
    assert.deepEqual(danach.map((x) => [x.id, x.datum]), [[aus, tagCh(4)], [offen, tagCh(6)]]);
  });

  await pruefe("Abo Spielervertretung erlischt mit Erneuern und Löschen, nicht mit Herausnehmen und Auflösen, und lebt nicht wieder auf (#507 PC 7, 8; #579 PC 4)", async () => {
    const team = await serienTeam("Kern-DB-Eltern-Abo-Erloeschen");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    await admin.from("training_termine").insert({ team_id: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" });
    const alt = (await aboHolen(await linkVon(lena)))!;
    const vonNoah = (await aboHolen(await linkVon(noah)))!;
    wert(await erneuereSpielerLink(a.supabase, a.id, { spielerId: lena }));
    assert.deepEqual(await aboFeed(alt), { gueltig: false }, "erneuert");
    assert.equal((await aboFeed(vonNoah)).gueltig, true, "andere Abos bleiben");
    const neu = (await aboHolen(await linkVon(lena)))!;
    assert.notEqual(neu, alt, "PC 8: über den neuen Link eine neue Adresse");
    assert.deepEqual(await aboFeed(alt), { gueltig: false }, "PC 8: die alte bleibt erloschen");
    await loescheSpieler(verwaltung, lena);
    assert.deepEqual(await aboFeed(neu), { gueltig: false }, "gelöscht");
    // #579 PC 4: Herausgenommen bleibt die Spieler:in samt Link im Verein, das
    // Abo mit ihr — bis Story #583 (Phase 7) ohne Termine.
    const mia = (await neuerSpieler(team, "Mia")).spielerId;
    const vonMia = (await aboHolen(await linkVon(mia)))!;
    wert(await nimmHeraus(a, team, mia));
    const feedMia = await aboFeed(vonMia);
    assert.deepEqual([feedMia.gueltig, feedMia.team, feedMia.termine], [true, null, []], "herausgenommen: bleibt, ohne Termine");
    // #581 PC 3: Ohne Mitglieder bleibt das Team samt Abos und Terminen.
    await admin.from("team_members").delete().eq("team_id", team);
    assert.equal((await admin.from("teams").select("id").eq("id", team)).data!.length, 1, "Team bleibt ohne Mitglied");
    assert.equal((await aboFeed(vonNoah)).termine!.length, 1, "ohne Mitglied: Abo mit Terminen");
    // Auflösen durch die Verwaltung: Die Spieler:innen bleiben ohne Team im
    // Verein (Entscheid A.2), ihre Abos mit.
    assert.equal(wert(await loeseTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, teamname: "Kern-DB-Eltern-Abo-Erloeschen" })).status, "aufgeloest");
    assert.equal((await admin.from("teams").select("id").eq("id", team)).data!.length, 0, "Team aufgelöst");
    assert.deepEqual([(await aboFeed(vonNoah)).gueltig, (await aboFeed(vonNoah)).termine], [true, []], "aufgelöst: bleibt, ohne Termine");
    assert.equal((await admin.from("spieler_abos").select("id").in("token", [alt, neu])).data!.length, 0);
    assert.equal((await admin.from("spieler_abos").select("id").in("token", [vonNoah, vonMia])).data!.length, 2);
  });

  await pruefe("Abo Spielervertretung widerrufen: Adresse erlischt für alle, Link und Abmeldungen bleiben, neue holbar (#509 AK 1, 4; PC 1–3)", async () => {
    const team = await serienTeam("Kern-DB-Eltern-Abo-Widerruf");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    const link = await linkVon(lena);
    const alt = (await aboHolen(link))!;
    const vonNoah = (await aboHolen(await linkVon(noah)))!;
    const widerrufen = async (l: string) => (await feldAnon.rpc("spieler_abo_widerrufen", { p_link: l })).data;
    assert.equal(await widerrufen(alt), "ungueltig", "die Abo-Adresse selbst widerruft nichts");
    assert.equal(await widerrufen(link), "ok");
    assert.deepEqual(await aboFeed(alt), { gueltig: false }, "PC 1");
    assert.equal((await aboFeed(vonNoah)).gueltig, true, "fremde Abos bleiben");
    // PC 3: Link, Abmeldung und Zahl bleiben.
    assert.equal(await linkVon(lena), link);
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine[0].abgemeldet, true);
    assert.equal(await widerrufen(link), "ok", "ohne Abo kein Fehler");
    // AK 4, PC 2: eine neue Adresse, die alte bleibt erloschen.
    const neu = (await aboHolen(link))!;
    assert.notEqual(neu, alt);
    assert.equal((await aboFeed(neu)).gueltig, true);
    assert.deepEqual(await aboFeed(alt), { gueltig: false });
    assert.equal(await widerrufen("f".repeat(64)), "ungueltig");
  });

  // ── Verlegen und Ausfall (#437) ──────────────────────────────────────────
  const linkAnsicht = async (spielerId: string) =>
    (await feldAnon.rpc("spieler_link_ansicht", { p_token: wert(await holeSpielerLink(a.supabase, a.id, { spielerId })).token })).data as {
      termine: { id: string; abgemeldet: boolean; angemeldet: number | null; gesamt: number | null; verfallen: { datum: string; beginn: string; anmeldung: boolean } | null }[];
    };

  await pruefe("Verlegen: Bestätigung nennt die Zahl, danach alle angemeldet, Link zeigt den Zeitpunkt vorher (#437 AK 1, 2, 6; PC 1, 3)", async () => {
    const team = await serienTeam("Kern-DB-Verlegen");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    await neuerSpieler(team, "Noah");
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    // PC 3: Ende, Ort, Bemerkung lassen sie stehen — ohne Rückfrage.
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: t, ende: "19:30", beginn: "18:00", ort: "Wyler", bemerkung: "x" })).abmeldungenVerfallen, 0);
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 1);
    // AK 1: Verlegen fragt mit der Zahl nach.
    const f = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(4) }), "regel") as { feld?: string; verfallend?: number };
    assert.deepEqual([f.feld, f.verfallend], ["bestaetigt", 1]);
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 1, "ohne Bestätigung nichts geschrieben");
    // AK 6: dasselbe über den KI-Weg.
    fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: t, beginn: "17:00", ende: "18:00" }), "regel");
    const r = wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t, datum: tagCh(4), bestaetigt: true }));
    assert.equal(r.abmeldungenVerfallen, 1);
    // PC 1: alle wieder angemeldet; AK 2: der Link nennt den Zeitpunkt vorher.
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 2);
    assert.deepEqual(wert(await terminSpieler(a.supabase, a.id, { terminId: t })).spieler.map((s) => s.abgemeldet), [false, false]);
    const termin = (await linkAnsicht(lena)).termine.find((x) => x.id === t)!;
    assert.deepEqual([termin.abgemeldet, termin.verfallen], [false, { datum: tagCh(3), beginn: "18:00", anmeldung: false }]);
    // Ein zweites Verlegen behält den ursprünglichen Zeitpunkt und fragt nicht mehr.
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(5) })).abmeldungenVerfallen, 0);
    assert.deepEqual((await linkAnsicht(lena)).termine.find((x) => x.id === t)!.verfallen, { datum: tagCh(3), beginn: "18:00", anmeldung: false });
    // Neu abmelden ersetzt die Markierung; danach zählt die Abmeldung wieder.
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    assert.deepEqual((await linkAnsicht(lena)).termine.find((x) => x.id === t)!.verfallen, null);
    assert.equal((await standVon(team, t)).spielstand?.angemeldet, 1);
    assert.equal(
      (await a.supabase.rpc("termin_abmeldungen_verfallend", { p_termin: t, p_datum: tagCh(5), p_beginn: "18:00" })).data,
      0,
      "unverändert verfällt nichts",
    );
  });

  await pruefe("Verlegen: in die Vergangenheit behält, zurück in die Zukunft verfällt; Ausfall lässt ruhen (#437 PC 1, 2, 4)", async () => {
    const team = await serienTeam("Kern-DB-Verlegen-Stand");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    await neuerSpieler(team, "Noah");
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    // PC 2: begonnen durch die Verlegung — kein Verfall, keine Rückfrage.
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-1) })).abmeldungenVerfallen, 0);
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 2, angemeldet: 1, eingefroren: true, anwesend: 1 });
    // Zurück in die Zukunft: Die festgehaltene Abmeldung verfällt — nach Bestätigung.
    const f = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(2) }), "regel") as { verfallend?: number };
    assert.equal(f.verfallend, 1);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(2), bestaetigt: true }));
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 2, angemeldet: 2, eingefroren: false, anwesend: null });
    assert.deepEqual((await linkAnsicht(lena)).termine.find((x) => x.id === t)!.verfallen, { datum: tagCh(-1), beginn: "18:00", anmeldung: false });

    // PC 4: Ein Ausfall lässt die Abmeldung ruhen; zurückgenommen gilt sie wieder.
    const u = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: u, spielerId: lena, abgemeldet: true }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: u, grund: null }));
    const ausgefallen = (await linkAnsicht(lena)).termine.find((x) => x.id === u)!;
    assert.equal(ausgefallen.abgemeldet, true);
    // AK 4, #472: Ausgefallen nennt der Link keine Zahl, auch nicht von wie vielen.
    assert.deepEqual([ausgefallen.angemeldet, ausgefallen.gesamt], [null, null]);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: u }));
    assert.equal((await standVon(team, u)).spielstand?.angemeldet, 1);
    // PC 1: Auch während des Ausfalls verfällt sie beim Verlegen.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: u, grund: null }));
    fehler(await aendereTermin(a.supabase, a.id, { terminId: u, beginn: "17:00", ende: "18:00" }), "regel");
    wert(await aendereTermin(a.supabase, a.id, { terminId: u, beginn: "17:00", ende: "18:00", bestaetigt: true }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: u }));
    assert.equal((await standVon(team, u)).spielstand?.angemeldet, 2);
    // PC 5: Entfernen nimmt die Abmeldungen mit.
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: u, spielerId: lena, abgemeldet: true }));
    wert(await entferneTermin(a.supabase, a.id, { terminId: u }));
    assert.equal((await admin.from("termin_abmeldungen").select("spieler_id").eq("termin_id", u)).data?.length, 0);
  });

  await pruefe("Verlegen über die Serie: Vorschau zählt, KI braucht Bestätigung, Zeit der Serie folgen ebenso (#437 AK 1, 6; PC 1)", async () => {
    const team = await serienTeam("Kern-DB-Verlegen-Serie");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const s = wert(await legeSerieFest(a.supabase, a.id, {
      teamId: team, wochentage: [wochentagVon(tagCh(1))], von: tagCh(1), bis: tagCh(15), beginn: "18:00", ende: "19:00",
    }));
    const [erster, zweiter] = await termineDer(s.serieId);
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: erster.id, spielerId: lena, abgemeldet: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: zweiter.id, spielerId: lena, abgemeldet: true }));
    // Nur der Ort: nichts verfällt.
    const ort = wert(await aendereSerie(a.supabase, a.id, { terminId: erster.id, reichweite: "alle", aenderung: { ort: "Wyler" } }));
    assert.equal(ort.abmeldungenVerfallend, 0);
    // Vorschau zählt, ohne zu schreiben.
    const v = wert(await aendereSerie(a.supabase, a.id, {
      terminId: erster.id, reichweite: "alle", aenderung: { beginn: "17:30", ende: "18:30" }, vorschau: true, erwartet: { version: (await admin.from("termin_serien").select("version").eq("id", s.serieId).single()).data!.version, entfallend: [] },
    }));
    assert.equal(v.abmeldungenVerfallend, 2);
    assert.equal((await standVon(team, erster.id)).spielstand?.angemeldet, 0, "Vorschau schreibt nichts");
    // KI-Weg ohne Bestätigung: abgewiesen mit der Zahl; bestätigt: geändert.
    const f = fehler(await aendereMitReichweite(a.supabase, a.id, { terminId: erster.id, reichweite: "alle", beginn: "17:30", ende: "18:30" }), "regel") as { verfallend?: number };
    assert.equal(f.verfallend, 2);
    const r = wert(await aendereMitReichweite(a.supabase, a.id, { terminId: erster.id, reichweite: "alle", beginn: "17:30", ende: "18:30", bestaetigt: true }));
    assert.equal(r.abmeldungenVerfallen, 2);
    assert.equal((await standVon(team, erster.id)).spielstand?.angemeldet, 1);
    assert.equal((await standVon(team, zweiter.id)).spielstand?.angemeldet, 1);

    // Zeit wieder der Serie folgen lassen ändert den Beginn — ebenso nachfragen.
    wert(await aendereTermin(a.supabase, a.id, { terminId: zweiter.id, beginn: "19:00", ende: "20:00" }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: zweiter.id, spielerId: lena, abgemeldet: true }));
    const g = fehler(await folgeDerSerie(a.supabase, a.id, { terminId: zweiter.id, angaben: ["zeit"] }), "regel") as { verfallend?: number };
    assert.equal(g.verfallend, 1);
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: zweiter.id, angaben: ["zeit"], bestaetigt: true }));
    assert.equal((await standVon(team, zweiter.id)).spielstand?.angemeldet, 1);
  });

  // ── Selbstabholung (#438) ────────────────────────────────────────────────
  const abholen = async (token: string, schluessel: string, vorname: string, nachname: string, jahrgang: number) =>
    (await feldAnon.rpc("abholung_abholen", { p_token: token, p_schluessel: schluessel, p_vorname: vorname, p_nachname: nachname, p_jahrgang: jahrgang }))
      .data as { status: string; token?: string; spieler?: { vorname: string; nachname: string } };
  const anschluss = (n: number) => `${"k".repeat(60)}${String(n).padStart(4, "0")}${Date.now()}`;

  await pruefe("Selbstabholung: aus bis eingeschaltet, Abgleich wie die Eindeutigkeit, bezogen, erneuern (#438 AK 1, 2, 4, 8, 9, 11, 13, 18; PC 1–6)", async () => {
    const team = await serienTeam("Kern-DB-Abholung");
    const lena = (await neuerSpieler(team, "Anna-Lena", "O’Brien", 2017)).spielerId;
    assert.deepEqual(wert(await leseAbholung(a.supabase, a.id, { teamId: team })), { teamId: team, token: null, aktiv: false }, "PO 3: aus");
    fehler(await leseAbholung(b.supabase, b.id, { teamId: team }), "nicht_gefunden");
    // Ausgeschaltet angelegt gilt sie noch nicht (PC 1).
    const start = wert(await schalteAbholung(a.supabase, a.id, { teamId: team, aktiv: false }));
    assert.equal(start.aktiv, false);
    assert.match(start.token, /^[0-9a-f]{64}$/);
    assert.deepEqual((await feldAnon.rpc("abholung_ansicht", { p_token: start.token })).data, { gueltig: false }, "PC 1");
    assert.deepEqual(await abholen(start.token, anschluss(1), "Anna-Lena", "O’Brien", 2017), { status: "ungueltig" });

    const an = wert(await schalteAbholung(a.supabase, a.id, { teamId: team, aktiv: true }));
    assert.equal(an.token, start.token);
    assert.deepEqual((await feldAnon.rpc("abholung_ansicht", { p_token: an.token })).data, { gueltig: true, team: "Kern-DB-Abholung" });
    // AK 9: Schreibvarianten passen, Umlaute und Akzente müssen stimmen.
    const k = anschluss(2);
    const r = await abholen(an.token, k, "  anna lena ", "o'brien", 2017);
    assert.equal(r.status, "ok");
    assert.deepEqual(r.spieler, { vorname: "Anna-Lena", nachname: "O’Brien" });
    assert.equal(r.token, wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena })).token, "AK 11: der gültige Link");
    assert.equal((await abholen(an.token, k, "Anna–Lena", "O`BRIEN", 2017)).status, "ok");
    assert.equal((await abholen(an.token, k, "Anna-Lena", "O’Bríen", 2017)).status, "passt_nicht");
    assert.deepEqual(await abholen(an.token, k, "Anna-Lena", "O’Brien", 2018), { status: "passt_nicht" }, "AK 13: dieselbe Antwort");
    // PC 2, 3: bezogen — bis der Link erneuert wird.
    assert.equal(wert(await ladeSpielerliste(a.supabase, a.id, { teamId: team })).spieler[0].linkBezogen, true);
    const neuLink = wert(await erneuereSpielerLink(a.supabase, a.id, { spielerId: lena })).token;
    assert.equal(wert(await ladeSpielerliste(a.supabase, a.id, { teamId: team })).spieler[0].linkBezogen, false);
    assert.equal((await abholen(an.token, anschluss(3), "Anna-Lena", "O’Brien", 2017)).token, neuLink, "OoS 5: wieder abholbar");

    // PC 4, 6: erneuert gilt die alte nie wieder; bezogene Links bleiben.
    const erneuert = wert(await erneuereAbholung(a.supabase, a.id, { teamId: team }));
    assert.notEqual(erneuert.token, an.token);
    assert.deepEqual((await feldAnon.rpc("abholung_ansicht", { p_token: an.token })).data, { gueltig: false });
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: neuLink })).data.gueltig, true, "PC 6");
    // PC 5: aus und wieder ein — dieselbe Adresse.
    wert(await schalteAbholung(a.supabase, a.id, { teamId: team, aktiv: false }));
    assert.deepEqual(await abholen(erneuert.token, anschluss(4), "Anna-Lena", "O’Brien", 2017), { status: "ungueltig" });
    assert.equal(wert(await schalteAbholung(a.supabase, a.id, { teamId: team, aktiv: true })).token, erneuert.token);
    assert.equal((await abholen(erneuert.token, anschluss(5), "Anna-Lena", "O’Brien", 2017)).status, "ok");

    // Nur über die RPCs; Anon sieht keine Tabelle, ohne Anschluss keine Abholung.
    assert.deepEqual((await feldAnon.from("team_abholung").select("token").eq("team_id", team)).data ?? [], []);
    assert.ok((await a.supabase.from("team_abholung").update({ aktiv: false }).eq("team_id", team)).error);
    assert.ok((await a.supabase.from("abholung_sperren").select("schluessel")).error);
    assert.ok((await feldAnon.rpc("abholung_abholen", { p_token: erneuert.token, p_schluessel: null, p_vorname: "x", p_nachname: "y", p_jahrgang: 2017 })).error);
  });

  await pruefe("Selbstabholung: nach 5 Fehlversuchen 15 Minuten gesperrt, nur dieser Anschluss (#438 AK 15, 16)", async () => {
    const team = await serienTeam("Kern-DB-Abholung-Sperre");
    await neuerSpieler(team, "Lena", "Meier", 2017);
    const t = wert(await schalteAbholung(a.supabase, a.id, { teamId: team, aktiv: true })).token;
    const k = anschluss(6);
    for (let i = 1; i <= 4; i++) assert.equal((await abholen(t, k, "Lena", "Maier", 2017)).status, "passt_nicht", `Versuch ${i}`);
    assert.equal((await abholen(t, k, "Lena", "Maier", 2017)).status, "gesperrt", "der fünfte sperrt");
    assert.equal((await abholen(t, k, "Lena", "Meier", 2017)).status, "gesperrt", "auch eine passende Eingabe");
    assert.equal((await abholen(t, anschluss(7), "Lena", "Meier", 2017)).status, "ok", "andere bleiben offen");
    // Nach der Wartezeit wieder offen.
    await admin.from("abholung_sperren").update({ gesperrt_bis: new Date(Date.now() - 1000).toISOString() }).eq("schluessel", k);
    assert.equal((await abholen(t, k, "Lena", "Meier", 2017)).status, "ok");
    // Ein Treffer setzt die Zählung nicht zurück: Wer ein Kind kennt, rät
    // dazwischen nicht beliebig weiter.
    for (let i = 1; i <= 4; i++) await abholen(t, k, "Lena", "Maier", 2017);
    assert.equal((await abholen(t, k, "Lena", "Meier", 2017)).status, "ok");
    assert.equal((await abholen(t, k, "Lena", "Maier", 2017)).status, "gesperrt");
  });

  await pruefe("Selbstabholung: der Anschluss ist IPv4 ganz, IPv6 sein /64 (#438 AK 15)", async () => {
    const { anschlussVon } = await import("../lib/abholung");
    assert.equal(anschlussVon("203.0.113.7"), "203.0.113.7");
    assert.equal(anschlussVon("2001:db8:0:1:aaaa::1"), "2001:db8:0:1::/64");
    assert.equal(anschlussVon("2001:DB8::1"), "2001:db8:0:0::/64");
    assert.equal(anschlussVon("2001:0db8:0000:0001:1:2:3:4"), "2001:db8:0:1::/64");
    assert.equal(anschlussVon("::1"), "0:0:0:0::/64");
    assert.equal(anschlussVon("::ffff:203.0.113.7"), "203.0.113.7", "IPv4 in IPv6-Schreibweise");
  });

  // ── Kader (#447) ─────────────────────────────────────────────────────────
  const kaderVonTeam = async (team: string) => wert(await ladeKader(a.supabase, a.id, { teamId: team })).kader;
  const neuerKader = async (team: string, name: string) => wert(await legeKaderAn(a.supabase, a.id, { teamId: team, name })).kaderId;

  await pruefe("Kader: anlegen, eindeutig ohne Gross/Klein und Leerzeichen, Bindestrich unterscheidet, umbenennen (#452 AK 1, 2, 10)", async () => {
    const team = await serienTeam("Kern-DB-Kader-Namen");
    const s1 = await neuerKader(team, "  Stärkeklasse   1 ");
    assert.deepEqual((await kaderVonTeam(team)).map((k) => k.name), ["Stärkeklasse 1"], "bereinigt gespeichert");
    fehler(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "stärkeklasse 1" }), "regel", KADER_MELDUNG.KADER_DOPPELT);
    fehler(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "" }), "eingabe", KADER_TEXT.name);
    fehler(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "x".repeat(31) }), "eingabe", KADER_TEXT.name);
    await neuerKader(team, "U-10");
    await neuerKader(team, "U 10");
    // Ein Name auch beim Umbenennen nur einmal; der eigene Name in anderer Schreibweise geht.
    fehler(await benenneKaderUm(a.supabase, a.id, { kaderId: s1, name: "u-10" }), "regel", KADER_MELDUNG.KADER_DOPPELT);
    wert(await benenneKaderUm(a.supabase, a.id, { kaderId: s1, name: "STÄRKEKLASSE 1" }));
    assert.ok((await kaderVonTeam(team)).some((k) => k.name === "STÄRKEKLASSE 1"));
    // Unmittelbar über die RPC: Die Datenebene setzt dieselben Regeln durch.
    const { error } = await a.supabase.rpc("kader_anlegen", { p_team: team, p_name: "x".repeat(31) });
    assert.match(error!.message, /kader_name/);
  });

  await pruefe("Kader: höchstens 20 je Team (#452 AK 11)", async () => {
    const team = await serienTeam("Kern-DB-Kader-Grenze");
    for (let i = 1; i <= 20; i++) await neuerKader(team, `Kader ${i}`);
    fehler(await legeKaderAn(a.supabase, a.id, { teamId: team, name: "Kader 21" }), "regel", KADER_MELDUNG.KADER_VOLL);
  });

  await pruefe("Kader: zuteilen und herausnehmen, mehrere in einem Schritt, Spielerliste zeigt sie (#452 AK 5, 6, 7)", async () => {
    const team = await serienTeam("Kern-DB-Kader-Zuteilung");
    const [s1, s2] = [await neuerKader(team, "S1"), await neuerKader(team, "S2")];
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const mia = (await neuerSpieler(team, "Mia")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const z = wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena, mia], dazu: [s1, s2] }));
    assert.deepEqual([z.dazu, z.weg, z.verfallen], [4, 0, 0]);
    // Schon dabei: bleibt, zählt nicht.
    assert.equal(wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena, noah], dazu: [s1] })).dazu, 1);
    assert.equal(wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena, mia, noah], weg: [s2] })).weg, 2);
    const liste = wert(await ladeSpielerliste(a.supabase, a.id, { teamId: team })).spieler;
    assert.deepEqual(liste.map((s) => [s.vorname, s.kaderIds]), [["Lena", [s1]], ["Mia", [s1]], ["Noah", [s1]]]);
    assert.deepEqual((await kaderVonTeam(team)).map((k) => [k.name, k.spielerIds.length]), [["S1", 3], ["S2", 0]]);
  });

  await pruefe("Kader: entfernen lässt die Spieler:innen auf der Liste, fällt mit Herausnehmen, Löschen und Team (#452 AK 3, PC 1, 3; #579 PC 6)", async () => {
    const team = await serienTeam("Kern-DB-Kader-Entfernen");
    const k = await neuerKader(team, "Aushilfe");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const mia = (await neuerSpieler(team, "Mia")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena, mia, noah], dazu: [k] }));
    wert(await nimmHeraus(a, team, mia));
    assert.deepEqual((await kaderVonTeam(team))[0].spielerIds.sort(), [lena, noah].sort(), "die herausgenommene fällt aus dem Kader");
    await loescheSpieler(verwaltung, noah);
    assert.deepEqual((await kaderVonTeam(team))[0].spielerIds, [lena], "die gelöschte auch");
    assert.deepEqual(wert(await entferneKader(a.supabase, a.id, { kaderId: k })), { teamId: team, name: "Aushilfe", verfallen: 0 });
    assert.deepEqual(await kaderVonTeam(team), []);
    assert.equal(wert(await ladeSpielerliste(a.supabase, a.id, { teamId: team })).spieler.length, 1, "Lena bleibt");
    fehler(await entferneKader(a.supabase, a.id, { kaderId: k }), "nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN);
    // Das Team aufgelöst (durch die Verwaltung, #581): Kader und Zuteilung gehen mit.
    const k2 = await neuerKader(team, "S1");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena], dazu: [k2] }));
    assert.equal(wert(await loeseTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, teamname: "Kern-DB-Kader-Entfernen" })).status, "aufgeloest");
    assert.equal((await admin.from("kader").select("id").eq("team_id", team)).data!.length, 0);
    assert.equal((await admin.from("kader_spieler").select("kader_id").eq("team_id", team)).data!.length, 0);
  });

  await pruefe("Kader: nur Mitglieder sehen und führen sie, nichts über Teamgrenzen (#452 AK 12)", async () => {
    const team = await serienTeam("Kern-DB-Kader-Rechte");
    const fremdes = await serienTeam("Kern-DB-Kader-Fremd");
    const k = await neuerKader(team, "S1");
    const kFremd = await neuerKader(fremdes, "S1");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const fremd = (await neuerSpieler(fremdes, "Fremd")).spielerId;
    fehler(await ladeKader(b.supabase, b.id, { teamId: team }), "nicht_gefunden");
    fehler(await legeKaderAn(b.supabase, b.id, { teamId: team, name: "X" }), "nicht_gefunden");
    fehler(await benenneKaderUm(b.supabase, b.id, { kaderId: k, name: "X" }), "nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN);
    fehler(await entferneKader(b.supabase, b.id, { kaderId: k }), "nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN);
    fehler(await aendereZuteilung(b.supabase, b.id, { teamId: team, spielerIds: [lena], dazu: [k] }), "nicht_gefunden");
    assert.deepEqual((await b.supabase.from("kader").select("id").eq("team_id", team)).data, [], "RLS: unsichtbar");
    // Im eigenen Team weder fremde Spieler:innen noch fremde Kader.
    fehler(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [fremd], dazu: [k] }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    fehler(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena], dazu: [kFremd] }), "nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN);
    // Schreiben geht nur über die RPCs.
    const { error } = await a.supabase.from("kader").insert({ team_id: team, name: "Direkt" });
    assert.ok(error, "kein direktes Schreiben");
  });

  // ── Termine für Kader (#453) ─────────────────────────────────────────────
  const { setzeTerminKader, kaderEntfernenFolgen } = await import("../lib/kern/kader");
  const kaderTeam = async (name: string) => {
    const team = await serienTeam(name);
    const s1 = await neuerKader(team, "S1");
    const s2 = await neuerKader(team, "S2");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const mia = (await neuerSpieler(team, "Mia")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [lena, mia], dazu: [s1] }));
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: team, spielerIds: [noah], dazu: [s2] }));
    return { team, s1, s2, lena, mia, noah };
  };
  const anstehend = (team: string, kaderIds: string[] = [], tage = 7) =>
    legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(tage), beginn: "18:00", ende: "19:30", kaderIds });

  await pruefe("Kader am Termin: gilt nur für ihre Spieler:innen, Zahl und Liste nur über sie, für niemanden 0 von 0 (#453 AK 1, 4-7)", async () => {
    const k = await kaderTeam("Kern-DB-Termin-Kader");
    const t = wert(await anstehend(k.team, [k.s1])).terminId;
    const alle = wert(await anstehend(k.team)).terminId;
    assert.deepEqual((await standVon(k.team, t)).spielstand, { gesamt: 2, angemeldet: 2, eingefroren: false, anwesend: null });
    assert.deepEqual((await standVon(k.team, alle)).spielstand, { gesamt: 3, angemeldet: 3, eingefroren: false, anwesend: null }, "ohne Kader für alle");
    assert.deepEqual((await standVon(k.team, t)).kader, [{ id: k.s1, name: "S1" }]);
    const liste = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual(liste.spieler.map((s) => [s.vorname, s.kader]), [["Lena", ["S1"]], ["Mia", ["S1"]]]);
    assert.equal(liste.uebrige, 1);
    // Mehrere Kader: mindestens einem angehören.
    wert(await setzeTerminKader(a.supabase, a.id, { terminId: t, kaderIds: [k.s1, k.s2] }));
    assert.equal((await standVon(k.team, t)).spielstand!.gesamt, 3);
    // Ein leerer Kader: 0 von 0, nicht «ohne Liste».
    const leer = await neuerKader(k.team, "Leer");
    const niemand = wert(await anstehend(k.team, [leer])).terminId;
    assert.deepEqual((await standVon(k.team, niemand)).spielstand, { gesamt: 0, angemeldet: 0, eingefroren: false, anwesend: null });
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: niemand })).mitListe, true);
    // Fremde Kader nimmt der Termin nicht an.
    const fremd = await serienTeam("Kern-DB-Termin-Kader-Fremd");
    const kFremd = await neuerKader(fremd, "F");
    fehler(await setzeTerminKader(a.supabase, a.id, { terminId: t, kaderIds: [kFremd] }), "nicht_gefunden", KADER_MELDUNG.KADER_NICHT_GEFUNDEN);
    fehler(await setzeTerminKader(b.supabase, b.id, { terminId: t, kaderIds: [] }), "nicht_gefunden");
  });

  await pruefe("Kader am Termin: ab- und anmelden nur, für wen er gilt (#453 AK 9)", async () => {
    const k = await kaderTeam("Kern-DB-Termin-Kader-Abmelden");
    const t = wert(await anstehend(k.team, [k.s1])).terminId;
    const gesehen = { datum: tagCh(7), beginn: "18:00" };
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.noah, abgemeldet: true, gesehen }), "regel", ABMELDUNG_TEXT.giltNicht);
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, abgemeldet: true, gesehen }));
  });

  await pruefe("Kader: Abmeldungen verfallen nur mit genau der bestätigten Zahl, spurlos (#453 AK 10, 12, 16, PC 1)", async () => {
    const k = await kaderTeam("Kern-DB-Kader-Verfall");
    const t = wert(await anstehend(k.team, [k.s1])).terminId;
    const gesehen = { datum: tagCh(7), beginn: "18:00" };
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, abgemeldet: true, gesehen }));
    // Auch an einem ausgefallenen Termin (PC 1).
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "" }));
    const weg = { teamId: k.team, spielerIds: [k.lena], weg: [k.s1] };
    const r = fehler(await aendereZuteilung(a.supabase, a.id, weg), "regel", kaderVerfallBestaetigen(1)) as { verfallend?: number };
    assert.equal(r.verfallend, 1);
    assert.equal((await kaderVonTeam(k.team)).find((x) => x.id === k.s1)!.spielerIds.length, 2, "nichts geschrieben");
    // Eine andere Zahl: der aktuelle Stand (AK 12).
    fehler(await aendereZuteilung(a.supabase, a.id, { ...weg, bestaetigt: 2 }), "regel", kaderVerfallGeaendert(1));
    assert.deepEqual(wert(await aendereZuteilung(a.supabase, a.id, { ...weg, bestaetigt: 1 })).verfallen, 1);
    assert.equal((await admin.from("termin_abmeldungen").select("spieler_id").eq("termin_id", t)).data!.length, 0, "spurlos");
    // Wieder zugeteilt: angemeldet, die Abmeldung kehrt nicht zurück (OoS 5).
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena], dazu: [k.s1] }));
    // Die KI bestätigt mit «true», der Kern nennt die Zahl selbst.
    await nimmAusfallZurueck(a.supabase, a.id, { terminId: t });
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, abgemeldet: true, gesehen }));
    assert.equal(wert(await setzeTerminKader(a.supabase, a.id, { terminId: t, kaderIds: [k.s2], bestaetigt: true })).verfallen, 1);
  });

  await pruefe("Kader an der Serie: vorgeben, abweichen, wieder folgen, ändern ohne Begonnene (#453 AK 2, 3, 13)", async () => {
    const k = await kaderTeam("Kern-DB-Serie-Kader");
    const w = wochentagVon(tagCh(8));
    // Ab zwei Wochen vorher: Die ersten Termine haben schon begonnen.
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: k.team, wochentage: [w], von: tagCh(-14), bis: tagCh(30), beginn: "18:00", ende: "19:30", kaderIds: [k.s1] }));
    const plan = () => getTeamPlanFuer(a.supabase, k.team).then((p) => p.filter((x) => x.serie?.id === s.serieId || x.serie === null));
    const termine = await plan();
    assert.ok(termine.every((x) => x.kader.length === 1 && x.kader[0].id === k.s1 && x.serie!.kader[0].id === k.s1));
    const begonnen = termine.filter((x) => x.datum < tagCh(0));
    const kommend = termine.filter((x) => x.datum > tagCh(0));
    assert.ok(begonnen.length >= 1 && kommend.length >= 3);
    const [erster, zweiter] = kommend;
    // Nur dieser: weicht ab, auch mit keinem Kader («für alle»).
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: erster.id, reichweite: "nur_dieser", kaderIds: [] }));
    const nachher = (await plan()).find((x) => x.id === erster.id)!;
    assert.deepEqual([nachher.kader, nachher.abweichungen], [[], ["kader"]]);
    // Alle: der abweichende bleibt, die übrigen folgen.
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: zweiter.id, reichweite: "alle", kaderIds: [k.s2], bestaetigt: true }));
    const alle = await plan();
    assert.deepEqual(alle.find((x) => x.id === erster.id)!.kader, []);
    assert.ok(alle.filter((x) => x.id !== erster.id && x.datum > tagCh(0)).every((x) => x.kader[0]?.id === k.s2));
    // AK 13: Begonnene behalten ihre Kader, auch über die Serie.
    assert.ok(alle.filter((x) => begonnen.some((b) => b.id === x.id)).every((x) => x.kader[0]?.id === k.s1));
    fehler(await folgeDerSerie(a.supabase, a.id, { terminId: begonnen[0].id, angaben: ["kader"] }), "regel", KADER_MELDUNG.KADER_TERMIN_BEGONNEN);
    // Wieder folgen.
    wert(await folgeDerSerie(a.supabase, a.id, { terminId: erster.id, angaben: ["kader"] }));
    const gefolgt = (await plan()).find((x) => x.id === erster.id)!;
    assert.deepEqual([gefolgt.kader.map((x) => x.id), gefolgt.abweichungen], [[k.s2], []]);
  });

  await pruefe("Kader: Stand bei Beginn bleibt, entfernter Kader dort ehemalig, anstehende gelten für alle (#453 AK 11, 13, PC 2-4)", async () => {
    const k = await kaderTeam("Kern-DB-Kader-Beginn");
    // Ein Termin mit S1, danach in die Vergangenheit verlegt: hält mit Lena und Mia fest.
    const t = wert(await anstehend(k.team, [k.s1])).terminId;
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-2) }));
    assert.deepEqual((await standVon(k.team, t)).spielstand, { gesamt: 2, angemeldet: 2, eingefroren: true, anwesend: 2 });
    fehler(await setzeTerminKader(a.supabase, a.id, { terminId: t, kaderIds: [k.s2] }), "regel", KADER_MELDUNG.KADER_TERMIN_BEGONNEN);
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena], weg: [k.s1] }));
    assert.equal((await standVon(k.team, t)).spielstand!.gesamt, 2, "Zuteilung danach ändert nichts");
    const kommend = wert(await anstehend(k.team, [k.s1])).terminId;
    const gemischt = wert(await anstehend(k.team, [k.s1, k.s2])).terminId;
    const f = wert(await kaderEntfernenFolgen(a.supabase, a.id, { kaderId: k.s1 }));
    assert.deepEqual([f.spieler, f.termine.map((x) => x.id), f.verfallend], [1, [kommend], 0]);
    wert(await entferneKader(a.supabase, a.id, { kaderId: k.s1 }));
    assert.deepEqual((await standVon(k.team, t)).kader, [{ id: null, name: null }], "ehemaliger Kader");
    assert.equal((await standVon(k.team, t)).spielstand!.gesamt, 2);
    assert.deepEqual((await standVon(k.team, kommend)).kader, [], "gilt für alle");
    assert.equal((await standVon(k.team, kommend)).spielstand!.gesamt, 3);
    assert.deepEqual((await standVon(k.team, gemischt)).kader.map((x) => x.name), ["S2"]);
  });

  await pruefe("Kader entfernen: Vorschau nennt verfallende Abmeldungen, Serien für alle (#453 AK 10, 11)", async () => {
    const k = await kaderTeam("Kern-DB-Kader-Entfernen-Folgen");
    const w = wochentagVon(tagCh(8));
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: k.team, wochentage: [w], von: tagCh(1), bis: tagCh(20), beginn: "18:00", ende: "19:30", kaderIds: [k.s1] }));
    const t = wert(await anstehend(k.team, [k.s1, k.s2])).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, abgemeldet: true, gesehen: { datum: tagCh(7), beginn: "18:00" } }));
    const f = wert(await kaderEntfernenFolgen(a.supabase, a.id, { kaderId: k.s1 }));
    assert.deepEqual([f.serien.map((x) => x.id), f.verfallend], [[s.serieId], 1]);
    assert.equal((await kaderVonTeam(k.team)).length, 2, "die Vorschau schreibt nichts");
    fehler(await entferneKader(a.supabase, a.id, { kaderId: k.s1 }), "regel", kaderVerfallBestaetigen(1));
    assert.equal(wert(await entferneKader(a.supabase, a.id, { kaderId: k.s1, bestaetigt: 1 })).verfallen, 1);
    assert.deepEqual((await getTeamPlanFuer(a.supabase, k.team)).find((x) => x.serie?.id === s.serieId)!.serie!.kader, []);
  });

  // ── Der private Link mit Kadern (#454) ───────────────────────────────────
  await pruefe("Privater Link: nur geltende Termine, nur die eigenen Kader, Zahl nur über Geltende (#454 AK 1-5, PC 1)", async () => {
    const k = await kaderTeam("Kern-DB-Link-Kader");
    const aushilfe = await neuerKader(k.team, "Aushilfe");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena], dazu: [aushilfe] }));
    const s1 = wert(await anstehend(k.team, [k.s1], 5)).terminId;
    const s2 = wert(await anstehend(k.team, [k.s2], 6)).terminId;
    const gemischt = wert(await anstehend(k.team, [k.s2, aushilfe], 7)).terminId;
    const alle = wert(await anstehend(k.team, [], 8)).terminId;
    const ansicht = async (spielerId: string) =>
      (await feldAnon.rpc("spieler_link_ansicht", { p_token: wert(await holeSpielerLink(a.supabase, a.id, { spielerId })).token })).data as {
        termine: { id: string; angemeldet: number | null; gesamt: number | null; kader: string[] }[];
      };
    const lena = await ansicht(k.lena);
    assert.deepEqual(lena.termine.map((t) => t.id), [s1, gemischt, alle], "S2 betrifft Lena nicht");
    assert.deepEqual(lena.termine.map((t) => t.kader), [["S1"], ["Aushilfe"], []], "nur ihre Kader, nie S2");
    assert.deepEqual(lena.termine.map((t) => t.angemeldet), [2, 2, 3]);
    // #472 AK 2: Von wie vielen, gezählt wie für die Mitglieder — am gemischten
    // Termin auch über S2, ohne S2 zu nennen.
    for (const t of lena.termine) {
      const mitglieder = wert(await terminSpieler(a.supabase, a.id, { terminId: t.id }));
      assert.deepEqual([t.angemeldet, t.gesamt], [mitglieder.angemeldet, mitglieder.gesamt], "wie für die Mitglieder");
    }
    // AK 5: Ein Termin, der inzwischen nicht mehr gilt, weist ab.
    const token = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const ab = (await feldAnon.rpc("spieler_link_abmelden", { p_token: token, p_termin: s2, p_abgemeldet: true, p_gesehen_datum: null, p_gesehen_beginn: null })).data as { status: string; grund: string };
    assert.deepEqual([ab.status, ab.grund], ["abgewiesen", "gilt_nicht"]);
    // PC 1: Gilt er wieder für sie, steht sie dort angemeldet.
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena], dazu: [k.s2] }));
    const wieder = (await ansicht(k.lena)).termine.find((t) => t.id === s2) as { abgemeldet?: boolean; kader: string[] } | undefined;
    assert.ok(wieder && wieder.abgemeldet === false && wieder.kader[0] === "S2");
  });

  // ── Zeitpunkt des letzten Statuswechsels (#467) ──────────────────────────
  const seit = async (terminId: string) =>
    Object.fromEntries(wert(await terminSpieler(a.supabase, a.id, { terminId })).spieler.map((s) => [s.vorname ?? "ehemalig", s.gewechseltAm]));
  const kurz = () => new Promise((r) => setTimeout(r, 15));

  await pruefe("Statuswechsel: jeder Wechsel setzt die Zeit, derselbe Status nicht, auf jedem Weg (#467 AK 1, 2; PC 1, 2)", async () => {
    const team = await serienTeam("Kern-DB-Statuswechsel");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    assert.deepEqual(await seit(t), { Lena: null, Noah: null }, "AK 2: nie gewechselt");
    // Anmelden einer Angemeldeten ist kein Wechsel.
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: false }));
    assert.equal((await seit(t)).Noah, null);
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    const t1 = (await seit(t)).Lena!;
    assert.ok(t1);
    // Nochmals abmelden (etwa auf einer veralteten Seite): Die Zeit bleibt (PC 2).
    await kurz();
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    assert.equal((await seit(t)).Lena, t1);
    // Über den Link wieder angemeldet: ein Wechsel, auch ohne Konto (PC 1).
    const token = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena })).token;
    const ueberLink = (ab: boolean) =>
      feldAnon.rpc("spieler_link_abmelden", { p_token: token, p_termin: t, p_abgemeldet: ab, p_gesehen_datum: tagCh(2), p_gesehen_beginn: "18:00" });
    await kurz();
    assert.equal((await ueberLink(false)).data.status, "ok");
    const t2 = (await seit(t)).Lena!;
    assert.ok(Date.parse(t2) > Date.parse(t1), "wieder angemeldet trägt eine neue Zeit");
    await kurz();
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: false }));
    assert.equal((await seit(t)).Lena, t2);
    await kurz();
    assert.equal((await ueberLink(true)).data.status, "ok");
    assert.ok(Date.parse((await seit(t)).Lena!) > Date.parse(t2));
    // Fremde sehen die Zeiten nicht.
    assert.deepEqual((await feldAnon.from("termin_statuswechsel").select("spieler_id").eq("termin_id", t)).data ?? [], []);
    assert.deepEqual((await b.supabase.from("termin_statuswechsel").select("spieler_id").eq("termin_id", t)).data ?? [], []);
  });

  await pruefe("Statuswechsel: Verlegen und Kader-Wegfall setzen zurück, Ausfall ruht, Beginn behält, Entfernen löscht (#467 PC 3–7)", async () => {
    const team = await serienTeam("Kern-DB-Statuswechsel-Regeln");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    // PC 3: Eine Verlegung setzt alle zurück, auch Wieder-Angemeldete.
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: false }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: true }));
    // Nur das Ende: nichts verfällt, die Zeiten bleiben.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, ende: "19:30" }));
    assert.ok((await seit(t)).Lena && (await seit(t)).Noah);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t, datum: tagCh(4), bestaetigt: true }));
    assert.deepEqual(await seit(t), { Lena: null, Noah: null });
    // PC 5: Ein Ausfall lässt die Zeit ruhen, die Rücknahme zeigt sie wieder.
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }));
    const vorher = (await seit(t)).Lena;
    assert.ok(vorher);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "" }));
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.equal((await seit(t)).Lena, vorher);

    // PC 6, 7: Der Stand bei Beginn behält die Zeit; wer gelöscht wird, nimmt sie mit, wer
    // aus dem Team genommen wird, behält sie dort (#579 PC 5).
    const u = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(1), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: u, spielerId: noah, abgemeldet: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: u, spielerId: lena, abgemeldet: true }));
    const zeiten = await seit(u);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: u, datum: tagCh(-1), bestaetigt: true }));
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: u })).begonnen, true);
    assert.deepEqual(await seit(u), zeiten, "durch die Verlegung begonnen: die Zeiten bleiben");
    await neuerSpieler(team, "Mia");
    assert.deepEqual(await seit(u), zeiten, "eine Änderung der Liste ändert den Stand bei Beginn nicht");
    wert(await nimmHeraus(a, team, lena));
    assert.deepEqual(await seit(u), zeiten, "herausgenommen: am begonnenen mit Zeit");
    await loescheSpieler(verwaltung, noah);
    assert.deepEqual(await seit(u), { Lena: zeiten.Lena, ehemalig: null }, "ehemalig ohne Zeit");
    assert.equal((await admin.from("termin_statuswechsel").select("spieler_id").eq("spieler_id", noah)).data!.length, 0, "überall weg");
    // Herausgenommen: künftige Statuswechsel dieses Teams fallen, der am begonnenen bleibt.
    assert.deepEqual(((await admin.from("termin_statuswechsel").select("termin_id").eq("spieler_id", lena)).data ?? []).map((z) => z.termin_id), [u]);
  });

  await pruefe("Statuswechsel: Jede gültige Abmeldung trägt eine Zeit, auch aus dem Bestand (#467 PC 8)", async () => {
    const offen = (await admin.from("termin_abmeldungen").select("termin_id, spieler_id").is("verfallen_am", null)).data!;
    const zeiten = new Set((await admin.from("termin_statuswechsel").select("termin_id, spieler_id")).data!.map((z) => `${z.termin_id}/${z.spieler_id}`));
    assert.deepEqual(offen.filter((x) => !zeiten.has(`${x.termin_id}/${x.spieler_id}`)), []);
  });

  await pruefe("Statuswechsel: Die KI erhält die Zeit als Uhr am Trainingsort (#467 AK 12)", async () => {
    const kiZeit = (gewechseltAm: string | null) =>
      teilnehmerAusgabe({ spielerId: "x", vorname: "Lena", nachname: "M", abgemeldet: true, ehemalig: false, nichtMehrImTeam: false, kader: [], gewechseltAm, nachgetragen: false, probe: false }).zuletzt_gewechselt;
    assert.equal(kiZeit("2026-10-19T12:05:00Z"), "2026-10-19T14:05", "Sommerzeit");
    assert.equal(kiZeit("2026-12-01T23:30:00Z"), "2026-12-02T00:30", "Winterzeit, nach Mitternacht");
    assert.equal(kiZeit(null), null);
  });

  await pruefe("Statuswechsel: Gilt ein Termin durch Kader nicht mehr und wieder, hat sie dort nie gewechselt (#467 PC 4)", async () => {
    const k = await kaderTeam("Kern-DB-Statuswechsel-Kader");
    const t = wert(await anstehend(k.team, [k.s1])).terminId;
    const gesehen = { datum: tagCh(7), beginn: "18:00" };
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, abgemeldet: true, gesehen }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, abgemeldet: false, gesehen }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, abgemeldet: true, gesehen }));
    assert.ok((await seit(t)).Mia);
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [k.s1] }));
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], dazu: [k.s1] }));
    const z = await seit(t);
    assert.equal(z.Mia, null);
    assert.ok(z.Lena, "wer weiter dazugehört, behält die Zeit");
  });

  // ── Nachtragen, wer da war (#475) ────────────────────────────────────────
  const anwesenheit = async (terminId: string) =>
    Object.fromEntries(
      wert(await terminSpieler(a.supabase, a.id, { terminId })).spieler.map((s) => [s.vorname ?? "ehemalig", [s.abgemeldet, s.nachgetragen]]),
    );
  /** Ein Termin von gestern, an dem Noah bei Beginn abgemeldet war. */
  const gestrigerTermin = async (name: string) => {
    const team = await serienTeam(name);
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    await neuerSpieler(team, "Mia");
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(1), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: noah, abgemeldet: true }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-1) }));
    return { team, t, lena, noah, gesehen: { datum: tagCh(-1), beginn: "18:00" } };
  };

  await pruefe("Nachtrag: nicht und doch erschienen, zurücknehmen, Zahl der Anwesenden, Zeit bleibt (#475 AK 1–4, 8–10; PC 1)", async () => {
    const { team, t, lena, noah, gesehen } = await gestrigerTermin("Kern-DB-Nachtrag");
    const zeitNoah = (await seit(t)).Noah;
    assert.ok(zeitNoah);
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 3, angemeldet: 2, eingefroren: true, anwesend: 2 }, "PO 2: ohne Nachtrag der Stand bei Beginn");
    const r = wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: false, gesehen }));
    assert.deepEqual([r.da, r.nachgetragen, r.stand?.anwesend], [false, true, 1], "AK 1: nicht erschienen");
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: noah, da: true, gesehen }));
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: noah, da: true, gesehen }));
    assert.deepEqual(await anwesenheit(t), { Lena: [false, true], Mia: [false, false], Noah: [true, true] }, "AK 2, 8: doch erschienen, der Stand bei Beginn bleibt");
    const liste = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual([liste.angemeldet, liste.anwesend, liste.gesamt], [2, 2, 3], "AK 9");
    const zahl = spielerzahlVon(await standVon(team, t));
    assert.deepEqual(zahl, { quelle: "liste", angemeldet: 2, gesamt: 3, anwesend: 2 }, "AK 10");
    // AK 3: Zurücknehmen heisst, den Stand bei Beginn wieder setzen.
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: true, gesehen }));
    assert.deepEqual((await anwesenheit(t)).Lena, [false, false]);
    assert.equal((await seit(t)).Noah, zeitNoah, "PC 1: ein Nachtrag ist kein Statuswechsel");
    // AK 4: ohne Frist — auch ein Termin von vor einem Monat.
    const alt = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(-30), beginn: "18:00", ende: "19:00" })).terminId;
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: alt, spielerId: lena, da: false }));
    assert.deepEqual((await anwesenheit(alt)).Lena, [false, true]);
  });

  await pruefe("Nachtrag: Abweisungen — vor Beginn, ausgefallen, verlegt, nicht dabei, Fremde, nur über die RPC (#475 AK 4–7, 11; PC 4)", async () => {
    const { team, t, lena, gesehen } = await gestrigerTermin("Kern-DB-Nachtrag-Regeln");
    const offen = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(2), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: offen, spielerId: lena, da: false }), "regel", ABMELDUNG_TEXT.nichtBegonnen);
    fehler(
      await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: false, gesehen: { datum: tagCh(-2), beginn: "18:00" } }),
      "konflikt",
      abweisungText("verlegt", { datum: tagCh(-1), beginn: "18:00", ende: "19:00", ausgefallen: false }),
    );
    // AK 5: Wer nach Beginn auf die Liste kam, gehörte nicht dazu.
    const spaet = (await neuerSpieler(team, "Spät")).spielerId;
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: spaet, da: true, gesehen }), "regel", ABMELDUNG_TEXT.nichtDabei);
    // Ein Team, das bei Beginn keine Liste führte: Niemand ist dabei.
    const ohne = await serienTeam("Kern-DB-Nachtrag-Ohne-Liste");
    const ohneTermin = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: ohne, datum: tagCh(-1), beginn: "18:00", ende: "19:00" })).terminId;
    const neu = (await neuerSpieler(ohne, "Neu")).spielerId;
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: ohneTermin, spielerId: neu, da: false }), "regel", ABMELDUNG_TEXT.nichtDabei);
    // AK 6, 11: ausgefallen — weder setzen noch sehen; die Rücknahme lässt sie wieder gelten (PC 4).
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: false, gesehen }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: null }));
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: true, gesehen }), "regel", ABMELDUNG_TEXT.ausgefallenNachtrag);
    const ausgefallen = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual([ausgefallen.anwesend, ausgefallen.spieler.some((s) => s.nachgetragen)], [null, false]);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.deepEqual((await anwesenheit(t)).Lena, [false, true]);
    // Fremde und ohne Konto: nichts; direkt schreiben geht nicht.
    fehler(await setzeAnwesenheit(b.supabase, b.id, { terminId: t, spielerId: lena, da: true }), "nicht_gefunden");
    assert.ok((await feldAnon.rpc("termin_anwesenheit_setzen", { p_termin: t, p_spieler: lena, p_da: true })).error);
    await a.supabase.from("termin_teilnahmen").update({ nachgetragen: false }).eq("termin_id", t);
    assert.deepEqual((await anwesenheit(t)).Lena, [false, true], "kein direktes Schreiben");
  });

  await pruefe("Nachtrag: Spielervertretung sieht den Stand bei Beginn, Ehemalige behalten ihren Nachtrag (#475 AK 16; PC 5)", async () => {
    const team = await serienTeam("Kern-DB-Nachtrag-Link");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    await neuerSpieler(team, "Noah");
    // Heute um Mitternacht: begonnen und für die Spielervertretung noch sichtbar.
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: team, datum: tagCh(0), beginn: "00:00", ende: "00:30" })).terminId;
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: false }));
    const termin = (await linkAnsicht(lena)).termine.find((x) => x.id === t)!;
    assert.deepEqual([termin.abgemeldet, termin.angemeldet, termin.gesamt], [false, 2, 2], "AK 16");
    assert.ok(!("nachgetragen" in termin) && !("anwesend" in termin));
    assert.equal((await standVon(team, t)).spielstand?.anwesend, 1);
    // #579 PC 5: aus dem Team genommen, bleibt sie mit Namen samt Nachtrag; die Zahl bleibt.
    wert(await nimmHeraus(a, team, lena));
    assert.deepEqual(await anwesenheit(t), { Lena: [false, true], Noah: [false, false] });
    assert.equal((await standVon(team, t)).spielstand?.anwesend, 1);
    // PC 5: aus dem Verein gelöscht, bleibt sie ohne Namen samt Nachtrag; die Zahl bleibt.
    await loescheSpieler(verwaltung, lena);
    assert.deepEqual(await anwesenheit(t), { Noah: [false, false], ehemalig: [false, true] });
    assert.equal((await standVon(team, t)).spielstand?.anwesend, 1);
  });

  await pruefe("Nachtrag: Verlegen in die Zukunft lässt sie verfallen, mit Rückfrage; in die Vergangenheit bleiben sie (#475 AK 12; PC 2, 3)", async () => {
    const { team, t, lena, noah, gesehen } = await gestrigerTermin("Kern-DB-Nachtrag-Verlegen");
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: lena, da: false, gesehen }));
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: noah, da: true, gesehen }));
    // PC 3: auf einen anderen vergangenen Tag — keine Rückfrage, alles bleibt.
    assert.equal(wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-2) })).abmeldungenVerfallen, 0);
    assert.deepEqual(await anwesenheit(t), { Lena: [false, true], Mia: [false, false], Noah: [true, true] });
    // AK 12: in die Zukunft — die Rückfrage nennt Abmeldung und Nachträge.
    const f = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(2) }), "regel", verfallBestaetigen(1, 2)) as {
      verfallend?: number;
      nachtraege?: number;
    };
    assert.deepEqual([f.verfallend, f.nachtraege], [3, 2]);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(2), bestaetigt: 1 }), "regel");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(2), bestaetigt: 3 }));
    // PC 2: wieder offen — alle angemeldet, keine Nachträge.
    assert.deepEqual(await anwesenheit(t), { Lena: [false, false], Mia: [false, false], Noah: [false, false] });
    assert.deepEqual((await standVon(team, t)).spielstand, { gesamt: 3, angemeldet: 3, eingefroren: false, anwesend: null });

    // Die Serie: Nur der Termin, der wieder offen wird, verliert seine Nachträge.
    // Ein Tausch der Wochentage verschiebt jeden Termin innerhalb seiner
    // Kalenderwoche (Mo–So). Gestern kommt so nur in die Zukunft, wenn in
    // seiner Woche noch zwei Tage folgen — sonntags und montags (gestern
    // Samstag oder Sonntag) nicht. Dann rückt er einen Tag zurück und behält
    // seinen Nachtrag wie der von vor einer Woche (PC 3); der Beginn der
    // Serie liegt darum einen Tag vor dem ersten Termin.
    const w = wochentagVon(tagCh(-1));
    const oeffnet = w <= 5;
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [w], von: tagCh(-9), bis: tagCh(20), beginn: "18:00", ende: "19:00" }));
    const tv = await termineDer(s.serieId);
    const vorWoche = tv.find((x) => x.datum === tagCh(-8))!.id;
    const gestern = tv.find((x) => x.datum === tagCh(-1))!.id;
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: vorWoche, spielerId: lena, da: false }));
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: gestern, spielerId: lena, da: false }));
    const ziel = (oeffnet ? w + 2 : w - 1) as typeof w;
    const tausch = { terminId: gestern, reichweite: "alle" as const, aenderung: { wochentage: [ziel] } };
    const v = wert(await aendereSerie(a.supabase, a.id, { ...tausch, vorschau: true }));
    assert.equal(v.nachtraegeVerfallend, oeffnet ? 1 : 0, "vor einer Woche bleibt vergangen und festgehalten");
    const summe = v.abmeldungenVerfallend + v.abmeldungenKader + v.nachtraegeVerfallend;
    fehler(await aendereSerie(a.supabase, a.id, { ...tausch, erwartet: { version: v.versionVorher, entfallend: [], verfallend: summe - 1 } }), "konflikt");
    wert(await aendereSerie(a.supabase, a.id, { ...tausch, erwartet: { version: v.versionVorher, entfallend: [], verfallend: summe } }));
    assert.deepEqual((await anwesenheit(vorWoche)).Lena, [false, true]);
    assert.deepEqual((await anwesenheit(gestern)).Lena, oeffnet ? [false, false] : [false, true]);
  });

  // ── Spiele selbst erfassen (#459) ───────────────────────────────────────
  await pruefe("Spiel: Art fest, Bezeichnung und Richtwert, nur bevorstehend, kein Training, keine Platzangaben (#459)", async () => {
    const team = await serienTeam("Kern-DB-Spiel");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const spiel = { art: "spiel" as const, teamId: team, datum: tagCh(5), beginn: "10:00", ende: "11:30" };
    // AK 2, 10, 11: Bezeichnung Pflicht, Richtwert 1–200, Mindestzahl nicht über Höchstzahl.
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "  " }), "eingabe", SPIEL_TEXT.bezeichnung);
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "x".repeat(121) }), "eingabe", SPIEL_TEXT.bezeichnungLang);
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "Cup", richtwertMin: 0 }), "eingabe", SPIEL_TEXT.richtwert);
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "Cup", richtwertMin: 12, richtwertMax: 9 }), "eingabe", SPIEL_TEXT.richtwertReihenfolge);
    // AK 16: keine Felder, keine erwartete Spielerzahl; ein Training keine Spielangaben.
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "Cup", spielerzahl: 9 }), "eingabe", SPIEL_TEXT.nurTraining);
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, art: "training", bezeichnung: "Cup" }), "eingabe", SPIEL_TEXT.nurSpiel);
    // AK 21: nur ein bevorstehender Anpfiff.
    fehler(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: "Cup", datum: tagCh(-1) }), "regel", SPIEL_MELDUNG.SPIEL_ANPFIFF_VERGANGEN);
    const t = wert(await legeTerminFest(a.supabase, a.id, { ...spiel, bezeichnung: " Meisterschaft gegen FC Bümpliz ", richtwertMin: 9, richtwertMax: 12 })).terminId;
    const plan = await standVon(team, t);
    assert.equal(plan.art, "spiel");
    assert.deepEqual(plan.spiel, { bezeichnung: "Meisterschaft gegen FC Bümpliz", richtwertMin: 9, richtwertMax: 12, meldefrist: null, vorher: null, treffpunkte: [] });
    assert.deepEqual(plan.spielstand, { gesamt: 1, angemeldet: 0, abgemeldet: 0, ohne_meldung: 1, nicht_aufgeboten: 0, meldungen: 0, eingefroren: false, anwesend: null }, "#463: zuerst ohne Meldung");

    // AK 3, 5: Bezeichnung und Richtwert ändern, einzeln entfernen.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, bezeichnung: "Cup gegen FC Köniz", richtwertMax: null }));
    assert.deepEqual((await standVon(team, t)).spiel, { bezeichnung: "Cup gegen FC Köniz", richtwertMin: 9, richtwertMax: null, meldefrist: null, vorher: null, treffpunkte: [] });
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, richtwertMax: 5 }), "eingabe", SPIEL_TEXT.richtwertReihenfolge);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, felder: [{ laenge_m: 40, breite_m: 20 }] }), "eingabe", SPIEL_TEXT.nurTraining);
    // AK 21: nicht in die Vergangenheit verlegen — auch an der Datenebene vorbei nicht.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(-2) }), "regel", SPIEL_MELDUNG.SPIEL_ANPFIFF_VERGANGEN);
    const roh = await a.supabase.from("training_termine").update({ datum: tagCh(-2) }).eq("id", t);
    assert.ok(roh.error?.message.includes("SPIEL_ANPFIFF_VERGANGEN"));
    // AK 13: Die Art bleibt.
    const art = await a.supabase.from("training_termine").update({ art: "training" }).eq("id", t);
    assert.ok(art.error?.message.includes("TERMIN_ART_FEST"));
    assert.equal(ausDbFehler(art.error!).meldung, SPIEL_MELDUNG.TERMIN_ART_FEST);

    // PC 5: Eine Verlegung beendet den Ausfall — auch nur der Zeit.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "Platz gesperrt" }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: "11:00", ende: "12:30" }));
    const z = (await admin.from("training_termine").select("ausgefallen, ausfall_grund").eq("id", t).single()).data;
    assert.deepEqual(z, { ausgefallen: false, ausfall_grund: null });

    // AK 14: kein Training, auch nicht an der Datenebene.
    const quelle = wert(await legeTrainingAn(a.supabase, a.id, { name: "Kern-DB-Spiel", altersstufe: "kinderfussball", stufen: ["F"], teamId: team }));
    fehler(await ordneTrainingZu(a.supabase, a.id, { terminId: t, trainingId: quelle.id }), "regel", SPIEL_TEXT.keinTraining);
    const tr = await admin.from("training_termine").update({ training_id: quelle.id }).eq("id", t);
    assert.ok(tr.error?.message.includes("tt_spiel_ohne_training"));

    // Die Abmeldung der Trainings gilt für Spiele nicht; ein Spiel kennt Meldungen (#463).
    fehler(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: lena, abgemeldet: true }), "regel", SPIEL_TEXT.istSpiel);
    fehler(await terminSpieler(a.supabase, a.id, { terminId: t }), "regel", SPIEL_TEXT.istSpiel);

    // AK 17: Der private Link zeigt ein Spiel als Spiel mit Bezeichnung und Richtwert.
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: lena }));
    const imLink = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link.token })).data.termine.find((x: { id: string }) => x.id === t);
    assert.deepEqual([imLink.art, imLink.bezeichnung, imLink.richtwert_min, imLink.richtwert_max], ["spiel", "Cup gegen FC Köniz", 9, null]);
    const ab = await feldAnon.rpc("spieler_link_abmelden", { p_token: link.token, p_termin: t, p_abgemeldet: true, p_gesehen_datum: null, p_gesehen_beginn: null });
    assert.equal(ab.data.grund, "ist_spiel");

    // PC 1, 2: im Abo mit Bezeichnung; Bestand und Serien bleiben Trainings (PC 3).
    const { token } = await holen(a, team);
    const imFeed = (await feed(token!)).termine!.find((x) => x.id === t) as unknown as { art: string; bezeichnung: string };
    assert.deepEqual([imFeed.art, imFeed.bezeichnung], ["spiel", "Cup gegen FC Köniz"]);
    const s = wert(await legeSerieFest(a.supabase, a.id, { teamId: team, wochentage: [wochentagVon(tagCh(3))], von: tagCh(3), bis: tagCh(10), beginn: "18:00", ende: "19:00" }));
    assert.ok((await termineDer(s.serieId)).length > 0);
    const arten = (await admin.from("training_termine").select("art").eq("serie_id", s.serieId)).data!.map((x) => x.art);
    assert.ok(arten.every((x) => x === "training"));

    // AK 15, 22: nie «noch nicht vorbereitet», kann der nächste Termin sein.
    const spielTeam = await serienTeam("Kern-DB-Spiel-Naechster");
    wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: spielTeam, datum: tagCh(9), beginn: "18:00", ende: "19:00" }));
    const naechstes = wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Turnier", teamId: spielTeam, datum: tagCh(4), beginn: "09:00", ende: "13:00" })).terminId;
    const kommend = wert(await teamPlan(a.supabase, a.id, { teamId: spielTeam })).kommend;
    assert.equal(kommend[0].id, naechstes);
    assert.equal(nochNichtVorbereitet(kommend[0], tagCh(0)), false);
    assert.equal(kommend[0].art, "spiel");
  });

  // ── Für Spiele ausdrücklich melden (#463) ───────────────────────────────
  const meldungen = async (terminId: string) =>
    Object.fromEntries(
      wert(await spielSpieler(a.supabase, a.id, { terminId })).spieler.map((x) => [x.vorname ?? "ehemalig", x.meldung]),
    );
  const spielTeam = async (name: string) => {
    const team = await serienTeam(name);
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    const mia = (await neuerSpieler(team, "Mia")).spielerId;
    const noah = (await neuerSpieler(team, "Noah")).spielerId;
    const spiel = (tage = 7, extra: Record<string, unknown> = {}) =>
      legeTerminFest(a.supabase, a.id, {
        art: "spiel",
        bezeichnung: "Cup",
        teamId: team,
        datum: tagCh(tage),
        beginn: "10:00",
        ende: "11:30",
        richtwertMin: 2,
        ...extra,
      });
    return { team, lena, mia, noah, spiel };
  };

  await pruefe("Meldung: ohne Meldung, an/ab, Zahl, Zeitpunkt, nur Mitglieder des Teams (#463 AK 1–6, 25)", async () => {
    const k = await spielTeam("Kern-DB-Melden");
    const t = wert(await k.spiel()).terminId;
    assert.deepEqual(await meldungen(t), { Lena: null, Mia: null, Noah: null }, "AK 1: alle ohne Meldung");
    const gesehen = { datum: tagCh(7), beginn: "10:00" };
    const r = wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true, gesehen }));
    assert.deepEqual([r.angemeldet, r.stand?.angemeldet], [true, 1]);
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: false, gesehen }));
    const d = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual([d.angemeldet, d.abgemeldet, d.ohneMeldung, d.gesamt], [1, 1, 1, 3]);
    const lena = d.spieler.find((x) => x.vorname === "Lena")!;
    assert.ok(lena.gewechseltAm, "AK 25: die erste Meldung ist ein Wechsel");
    assert.equal(d.spieler.find((x) => x.vorname === "Noah")!.gewechseltAm, null);
    // Dieselbe Meldung noch einmal ist kein Wechsel.
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true, gesehen }));
    const lena2 = wert(await spielSpieler(a.supabase, a.id, { terminId: t })).spieler.find((x) => x.vorname === "Lena")!;
    assert.equal(lena2.gewechseltAm, lena.gewechseltAm);
    // Plan: Angemeldete von allen, für die es gilt (AK 6).
    assert.deepEqual((await standVon(k.team, t)).spielstand, { gesamt: 3, angemeldet: 1, abgemeldet: 1, ohne_meldung: 1, nicht_aufgeboten: 0, meldungen: 2, eingefroren: false, anwesend: null });
    // Fremde und Trainings.
    fehler(await setzeMeldung(b.supabase, b.id, { terminId: t, spielerId: k.lena, angemeldet: true }), "nicht_gefunden", MELDUNG_TEXT.nichtGefunden);
    const training = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: k.team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeMeldung(a.supabase, a.id, { terminId: training, spielerId: k.lena, angemeldet: true }), "nicht_gefunden");
    // AK 17: veraltet gesehen.
    const f = fehler(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.noah, angemeldet: true, gesehen: { datum: tagCh(6), beginn: "10:00" } }), "konflikt");
    assert.ok(f.meldung?.startsWith("Das Spiel wurde inzwischen verlegt"));
  });

  await pruefe("Meldefrist: Link nur bis zur Frist, Mitglieder bis zum Anpfiff; die Frist wandert mit (#463 AK 8–12; PC 3)", async () => {
    const k = await spielTeam("Kern-DB-Meldefrist");
    // Eine Frist, die schon vorbei ist, ist erlaubt (AK 8).
    const t = wert(await k.spiel(2, { meldefrist: `${tagCh(-1)}T20:00` })).terminId;
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const ueberLink = (angemeldet: boolean) =>
      feldAnon.rpc("spieler_link_melden", { p_token: link, p_termin: t, p_angemeldet: angemeldet, p_gesehen_datum: tagCh(2), p_gesehen_beginn: "10:00" });
    assert.equal((await ueberLink(true)).data.grund, "frist_abgelaufen", "AK 9");
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    const imLink = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === t);
    assert.deepEqual([imLink.meldung, imLink.frist, imLink.frist_abgelaufen], ["angemeldet", `${tagCh(-1)}T20:00`, true], "AK 11, 12");
    // Frist entfernen: bis zum Anpfiff.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, meldefrist: null }));
    assert.equal((await ueberLink(false)).data.status, "ok");
    // Frist vor dem Anpfiff, höchstens ein Jahr.
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, meldefrist: `${tagCh(2)}T11:00` }), "eingabe", SPIEL_TEXT.meldefrist);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, meldefrist: "morgen" }), "eingabe", SPIEL_TEXT.meldefristFormat);
    // PC 3: eine Verlegung nimmt die Frist im selben Abstand mit.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, meldefrist: `${tagCh(1)}T20:00` }));
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: "14:00", ende: "15:00" }));
    assert.equal((await standVon(k.team, t)).spiel?.meldefrist, `${tagCh(2)}T00:00`);
    assert.equal(meldefristZeitpunkt(tagCh(2), "14:00", 14 * 60), `${tagCh(2)}T00:00`);
  });

  await pruefe("Verlegen: gleicher Tag behält, anderes Datum lässt verfallen, Rückfrage mit Zahl und Frist, vorher (#463 AK 13, 15, 16, 26; PC 1, 2)", async () => {
    const k = await spielTeam("Kern-DB-Spiel-Verlegen");
    const t = wert(await k.spiel(5, { meldefrist: `${tagCh(4)}T20:00` })).terminId;
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: false }));
    // PC 2: andere Zeit am selben Tag — keine Rückfrage, Meldungen bleiben, vorher steht.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: "11:00", ende: "12:00" }));
    assert.deepEqual(await meldungen(t), { Lena: "angemeldet", Mia: "abgemeldet", Noah: null });
    assert.deepEqual((await standVon(k.team, t)).spiel?.vorher, { datum: tagCh(5), beginn: "10:00" }, "AK 16");
    // PC 1, AK 13: ein anderes Datum — erst nach Bestätigung, mit der Zahl.
    const f = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(6) }), "regel", spielBestaetigen(spielVerfallText(2, false))) as {
      verfallend?: number;
      fristAbgelaufen?: boolean;
    };
    assert.deepEqual([f.verfallend, f.fristAbgelaufen], [2, false]);
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(6), bestaetigt: 1 }), "regel");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(6), bestaetigt: 2 }));
    assert.deepEqual(await meldungen(t), { Lena: null, Mia: null, Noah: null }, "alle wieder ohne Meldung");
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const imLink = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === t);
    assert.deepEqual([imLink.meldung, imLink.meldung_verfallen, imLink.vorher], [null, true, { datum: tagCh(5), beginn: "11:00" }], "AK 15: verfallen, vorher der zuletzt gültige");
    // Neu melden hebt den Hinweis auf.
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    const nachher = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === t);
    assert.equal(nachher.meldung_verfallen, false);
    // AK 26: Rückt die Verlegung die Frist ins Abgelaufene, fragt sie auch ohne Meldungen nach.
    // Morgen 23:00, Frist 24 Stunden davor; auf morgen 00:30 verlegt, liegt sie heute 00:30 — vorbei.
    const stunde = Number(jetztAmTrainingsort().slice(11, 13));
    if (stunde >= 1 && stunde < 23) {
      const g = wert(await k.spiel(1, { beginn: "23:00", ende: "23:30", meldefrist: `${tagCh(0)}T23:00` })).terminId;
      const ff = fehler(await aendereTermin(a.supabase, a.id, { terminId: g, beginn: "00:30", ende: "01:30" }), "regel") as {
        verfallend?: number;
        fristAbgelaufen?: boolean;
      };
      assert.deepEqual([ff.verfallend, ff.fristAbgelaufen], [0, true]);
      assert.equal((ff as { meldung?: string }).meldung, spielBestaetigen(spielVerfallText(0, true)));
      wert(await aendereTermin(a.supabase, a.id, { terminId: g, beginn: "00:30", ende: "01:30", bestaetigt: 0 }));
    }
  });

  await pruefe("Kader-Wegfall, Ausfall und Entfernen (#463 AK 14, 18, 19, 27; PC 4, 5, 9)", async () => {
    const k = await spielTeam("Kern-DB-Spiel-Kader");
    const s1 = await neuerKader(k.team, "S1");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena, k.mia], dazu: [s1] }));
    const t = wert(await k.spiel(4, { kaderIds: [s1] })).terminId;
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: true }));
    // PC 4, AK 14: Mia fällt aus dem Kader — ihre Meldung verfällt, die Rückfrage nennt sie als Meldung zu einem Spiel.
    const f = fehler(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1] }), "regel") as {
      verfallend?: number;
      verfallendSpiele?: number;
    };
    assert.deepEqual([f.verfallend, f.verfallendSpiele], [1, 1]);
    assert.ok((f as { meldung?: string }).meldung?.includes("1 Meldung zu einem Spiel"));
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1], bestaetigt: 1 }));
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], dazu: [s1] }));
    assert.equal((await meldungen(t)).Mia, null, "gilt es wieder, ist sie ohne Meldung");
    // AK 18, 19; PC 5: Ausfall — keine Meldung, nichts zu sehen; danach gilt die ruhende wieder.
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t }));
    fehler(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: true }), "regel", MELDUNG_TEXT.ausgefallen);
    assert.deepEqual(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).spieler, []);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.equal((await meldungen(t)).Lena, "angemeldet");
    // AK 27; PC 9: Entfernen nur mit der Zahl der verschwindenden Meldungen.
    const e = fehler(await entferneTermin(a.supabase, a.id, { terminId: t }), "regel", spielBestaetigen(spielEntfernenText(1))) as { verschwindend?: number };
    assert.equal(e.verschwindend, 1);
    wert(await entferneTermin(a.supabase, a.id, { terminId: t, bestaetigt: 1 }));
    assert.equal((await admin.from("spiel_meldungen").select("termin_id").eq("termin_id", t)).data!.length, 0);
  });

  await pruefe("Anpfiff: Stand festgehalten, am selben Tag wieder offen, an einem anderen Datum verfallen (#463 AK 20, 21; PC 6–8)", async () => {
    const k = await spielTeam("Kern-DB-Spiel-Anpfiff");
    const jetzt = jetztAmTrainingsort();
    const [heute, uhr] = [jetzt.slice(0, 10), jetzt.slice(11, 16)];
    const [h, m] = uhr.split(":").map(Number);
    const plus = (min: number) => {
      const z = h * 60 + m + min;
      return `${String(Math.floor(z / 60)).padStart(2, "0")}:${String(z % 60).padStart(2, "0")}`;
    };
    // Kurz vor Mitternacht ginge «heute später» nicht (bis plus 90 Minuten) — dann überspringen.
    if (h * 60 + m > 24 * 60 - 100) return;
    const t = wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Gleich", teamId: k.team, datum: heute, beginn: plus(1), ende: plus(60) })).terminId;
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: false }));
    // #464 PC 2: Die Kennzeichnung wird mit festgehalten.
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.noah, nichtAufgeboten: true }));
    await new Promise((r) => setTimeout(r, 61_000));
    fehler(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.noah, angemeldet: true }), "regel", MELDUNG_TEXT.begonnen);
    // Eine neue Spieler:in hält den Stand vorher fest (spieler_vorher) — sie gehört nicht dazu.
    const zoe = (await neuerSpieler(k.team, "Zoe")).spielerId;
    const fest = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    assert.equal(fest.begonnen, true);
    assert.deepEqual(await meldungen(t), { Lena: "angemeldet", Mia: "abgemeldet", Noah: null }, "AK 20: der Stand beim Anpfiff");
    assert.equal((await standVon(k.team, t)).spielstand?.eingefroren, true);
    assert.deepEqual([fest.angemeldet, fest.nichtAufgeboten], [1, 1], "#464: festgehalten, zählt nicht");
    fehler(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.noah, nichtAufgeboten: false }), "regel", MELDUNG_TEXT.begonnen);

    // #487: nachtragen, wer nicht oder doch erschienen ist (AK 1, 2, 5, 9).
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: zoe, da: true }), "regel", ABMELDUNG_TEXT.nichtDabei);
    const r1 = wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: k.lena, da: false }));
    assert.deepEqual([r1.nachgetragen, r1.stand?.anwesend, r1.stand?.angemeldet], [true, 0, 1], "nicht erschienen");
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: k.mia, da: true }));
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: k.noah, da: true }));
    const na = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    assert.deepEqual([na.anwesend, na.angemeldet, na.nichtAufgeboten], [2, 1, 1], "doch erschienen: abgemeldet und nicht aufgeboten");
    assert.deepEqual(na.spieler.filter((x) => x.nachgetragen).map((x) => x.vorname), ["Lena", "Mia", "Noah"]);
    // PC 1, 2: Meldung, Kennzeichnung und Zeitpunkt bleiben.
    assert.deepEqual(await meldungen(t), { Lena: "angemeldet", Mia: "abgemeldet", Noah: null });
    assert.equal(na.spieler.find((x) => x.vorname === "Lena")!.gewechseltAm, fest.spieler.find((x) => x.vorname === "Lena")!.gewechseltAm);
    // AK 10, 19: Mitglieder sehen die Anwesenden, die Eltern weiter die Angemeldeten beim Anpfiff.
    assert.deepEqual([(await standVon(k.team, t)).spielstand?.anwesend, (await standVon(k.team, t)).spielstand?.angemeldet], [2, 1]);
    const lenaLink = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const imLink = (await feldAnon.rpc("spieler_link_ansicht", { p_token: lenaLink })).data.termine.find((x: { id: string }) => x.id === t);
    assert.deepEqual([imLink.angemeldet, "anwesend" in imLink], [1, false]);
    // AK 3: zurücknehmen.
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: k.lena, da: true }));
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).anwesend, 3);
    // AK 6, 12; PC 4: ausgefallen — keine Nachträge, keine Zahl; danach gelten sie wieder.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t }));
    fehler(await setzeAnwesenheit(a.supabase, a.id, { terminId: t, spielerId: k.lena, da: false }), "regel", ABMELDUNG_TEXT.ausgefallenNachtrag);
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).anwesend, null);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).anwesend, 3);

    // PC 7, 8: am selben Tag auf später — wieder offen mit den bisherigen Meldungen; Zoe neu ohne.
    // #487 AK 13, PC 3: Die Nachträge verfallen — erst nach Rückfrage, auch wenn sonst nichts verfällt.
    const rv = fehler(
      await aendereTermin(a.supabase, a.id, { terminId: t, beginn: plus(30), ende: plus(90) }),
      "regel",
      spielBestaetigen(spielVerfallText(0, false, 0, 2)),
    ) as { verfallend?: number; nachtraege?: number };
    assert.deepEqual([rv.verfallend, rv.nachtraege], [2, 2]);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, beginn: plus(30), ende: plus(90), bestaetigt: 2 }));
    assert.deepEqual(await meldungen(t), { Lena: "angemeldet", Mia: "abgemeldet", Noah: null, Zoe: null });
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).nichtAufgeboten, 1, "#464 PC 2: gilt wieder");
    // An einem anderen Datum verfallen sie (mit Rückfrage), samt Kennzeichnung.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(3), bestaetigt: 3 }));
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).nichtAufgeboten, 0);
    assert.deepEqual(await meldungen(t), { Lena: null, Mia: null, Noah: null, Zoe: null });
  });

  // ── Treffpunkte und Bemerkung (#465) ─────────────────────────────────────
  await pruefe("Treffpunkte: Regeln, Abstand zum Anpfiff, Link mit Bemerkung, nicht an Trainings (#465 AK 1–13; PC 1–4)", async () => {
    const k = await spielTeam("Kern-DB-Treffpunkte");
    const tag = tagCh(7);
    const vorTag = tagCh(6);
    // AK 2–7: Anreiseart, Zeitpunkt, Ort ausser vor Ort, je Art einer, höchstens 100 Zeichen.
    const mit = (treffpunkte: { anreise: string; zeitpunkt: string; ort?: string | null }[]) => k.spiel(7, { treffpunkte });
    fehler(await mit([{ anreise: "zug", zeitpunkt: `${tag}T09:00`, ort: "Bahnhof" }]), "eingabe", TREFFPUNKT_TEXT.anreise);
    fehler(await mit([{ anreise: "oev", zeitpunkt: `${tag}`, ort: "Bahnhof" }]), "eingabe", TREFFPUNKT_TEXT.zeitpunkt);
    fehler(await mit([{ anreise: "oev", zeitpunkt: `${tag}T08:00` }]), "eingabe", TREFFPUNKT_TEXT.ort);
    fehler(await mit([{ anreise: "vor_ort", zeitpunkt: `${tag}T09:30`, ort: "Platz" }]), "eingabe", TREFFPUNKT_TEXT.ortVorOrt);
    fehler(await mit([{ anreise: "auto", zeitpunkt: `${tag}T08:00`, ort: "x".repeat(101) }]), "eingabe", TREFFPUNKT_TEXT.ortLang);
    const doppelt = fehler(
      await mit([
        { anreise: "auto", zeitpunkt: `${tag}T08:00`, ort: "A" },
        { anreise: "auto", zeitpunkt: `${tag}T08:30`, ort: "B" },
      ]),
      "eingabe",
      TREFFPUNKT_TEXT.doppelt,
    );
    assert.equal((doppelt as { feld?: string }).feld, "treffpunkte[1]", "die Zeile");
    // Ein Training trägt keine (OoS 1).
    fehler(
      await legeTerminFest(a.supabase, a.id, {
        art: "training", teamId: k.team, datum: tag, beginn: "18:00", ende: "19:00",
        treffpunkte: [{ anreise: "vor_ort", zeitpunkt: `${tag}T17:45` }],
      }),
      "eingabe",
      SPIEL_TEXT.nurSpiel,
    );
    // AK 1, 5: öV am Vortag, vor Ort nach dem Anpfiff erlaubt; gespeichert gekürzt.
    const t = wert(
      await mit([
        { anreise: "vor_ort", zeitpunkt: `${tag}T09:30` },
        { anreise: "oev", zeitpunkt: `${vorTag}T18:00`, ort: " Bahnhof Bern " },
      ]),
    ).terminId;
    assert.deepEqual((await standVon(k.team, t)).spiel?.treffpunkte, [
      { anreise: "oev", zeitpunkt: `${vorTag}T18:00`, ort: "Bahnhof Bern" },
      { anreise: "vor_ort", zeitpunkt: `${tag}T09:30`, ort: null },
    ]);
    // PC 2: eine Verlegung nimmt sie im selben Abstand mit, auch über den Tag.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(8), beginn: "08:00", ende: "09:30" }));
    assert.deepEqual((await standVon(k.team, t)).spiel?.treffpunkte, [
      { anreise: "oev", zeitpunkt: `${tagCh(7)}T16:00`, ort: "Bahnhof Bern" },
      { anreise: "vor_ort", zeitpunkt: `${tagCh(8)}T07:30`, ort: null },
    ]);
    // AK 1: die ganze Liste ändern; ohne Angabe unverändert, [] entfernt alle.
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, ort: "Sportanlage Bodenweid", bemerkung: "Bälle bei Lea", hinweisEltern: "Schienbeinschoner mitnehmen." }));
    assert.equal((await standVon(k.team, t)).spiel?.treffpunkte.length, 2);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, treffpunkte: [{ anreise: "car", zeitpunkt: `${tagCh(8)}T06:45`, ort: "Clubhaus" }] }));
    assert.deepEqual((await standVon(k.team, t)).spiel?.treffpunkte.map((x) => x.anreise), ["car"]);
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, treffpunkte: [{ anreise: "vor_ort", zeitpunkt: `${tagCh(8)}T07:30` }, { anreise: "oev", zeitpunkt: `${tagCh(8)}T07:00`, ort: "Bahnhof" }] }));

    // AK 10: der Link zeigt die Treffpunkte eines Spiels, unabhängig von der Meldung; #590 AK 9, 13:
    // dazu den Hinweis für Eltern, nie die Bemerkung.
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const imLink = async (id: string) => (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === id);
    const s1 = await imLink(t);
    assert.deepEqual([s1.meldung, s1.hinweis_eltern, "bemerkung" in s1], [null, "Schienbeinschoner mitnehmen.", false]);
    assert.deepEqual(s1.treffpunkte, [
      { anreise: "oev", zeitpunkt: `${tagCh(8)}T07:00`, ort: "Bahnhof" },
      { anreise: "vor_ort", zeitpunkt: `${tagCh(8)}T07:30`, ort: null },
    ]);
    const training = wert(
      await legeTerminFest(a.supabase, a.id, { art: "training", teamId: k.team, datum: tagCh(3), beginn: "18:00", ende: "19:00", bemerkung: "Nur intern", hinweisEltern: "Pincode: 4702" }),
    ).terminId;
    const tr = await imLink(training);
    assert.deepEqual([tr.hinweis_eltern, "bemerkung" in tr, tr.treffpunkte], ["Pincode: 4702", false, null], "#590 AK 9, 13: Hinweis ja, Bemerkung nie");
    // PC 3; #530; #590 AK 11, PC 4: ausgefallen nur der Grund, kein Hinweis und keine
    // Treffpunkte; der Ausfall endet, Hinweis und Treffpunkte sind wieder da.
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t, grund: "Platz gesperrt" }));
    const aus = await imLink(t);
    assert.deepEqual([aus.ausfall_grund, aus.hinweis_eltern, aus.treffpunkte], ["Platz gesperrt", null, null]);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    const wieder = await imLink(t);
    assert.deepEqual([wieder.ausfall_grund, wieder.hinweis_eltern, wieder.treffpunkte.length], [null, "Schienbeinschoner mitnehmen.", 2]);

    // Nur Mitglieder schreiben; die Datenebene weist doppelte Arten und Trainings ab.
    const fremd = await b.supabase.rpc("spiel_treffpunkte_setzen", { p_termin: t, p_liste: [] });
    assert.ok(fremd.error?.message.includes("TERMIN_NICHT_GEFUNDEN"));
    const roh = await a.supabase.rpc("spiel_treffpunkte_setzen", {
      p_termin: t,
      p_liste: [
        { anreise: "auto", vorlauf_min: 60, ort: "A" },
        { anreise: "auto", vorlauf_min: 30, ort: "B" },
      ],
    });
    assert.equal(ausDbFehler(roh.error!).meldung, TREFFPUNKT_TEXT.doppelt);
    const amTraining = await a.supabase.rpc("spiel_treffpunkte_setzen", { p_termin: training, p_liste: [] });
    assert.equal(ausDbFehler(amTraining.error!).meldung, SPIEL_TEXT.nurSpiel);
    assert.equal((await imLink(t)).treffpunkte.length, 2, "nichts geschrieben");
    // Mit dem Spiel verschwinden sie.
    wert(await entferneTermin(a.supabase, a.id, { terminId: t }));
    const rest = await a.supabase.from("spiel_treffpunkte").select("anreise").eq("termin_id", t);
    assert.deepEqual(rest.data, []);
  });

  await pruefe("Abo Spielervertretung: Spiele mit Meldung, Frist, Kennzeichnung, Treffpunkten und Hinweis wie am Link (#508 AK 1, PC 1, 2, 7; #590 AK 12)", async () => {
    const k = await spielTeam("Kern-DB-Eltern-Abo-Spiele");
    const offen = wert(await k.spiel(7, { treffpunkte: [{ anreise: "oev", zeitpunkt: `${tagCh(7)}T09:00`, ort: "Bahnhof" }], bemerkung: "Intern", hinweisEltern: "Leibchen" })).terminId;
    const vorbei = wert(await k.spiel(5, { meldefrist: `${tagCh(-1)}T20:00` })).terminId;
    const aus = wert(await k.spiel(6)).terminId;
    const training = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: k.team, datum: tagCh(4), beginn: "18:00", ende: "19:00", hinweisEltern: "Pincode", treffpunkt: { zeit: "17:45", ort: "Garderoben" } })).terminId;
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: aus }));
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: offen, spielerId: k.lena, nichtAufgeboten: true }));
    const link = await linkVon(k.lena);
    const abo = (await aboHolen(link))!;
    const ansicht = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data as { termine: Record<string, unknown>[] };
    const feld = ["id", "art", "bezeichnung", "meldung", "frist_abgelaufen", "nicht_aufgeboten", "hinweis_eltern", "treffpunkte", "treffpunkt"];
    const auswahl = (x: Record<string, unknown>) => Object.fromEntries(feld.map((f) => [f, x[f]]));
    const termine = (await aboFeed(abo)).termine!;
    // AK 1, PC 1, 2: im selben Abo wie die Trainings, mit denselben Angaben wie der Link, ohne ausgefallene.
    assert.deepEqual(termine.map(auswahl), ansicht.termine.filter((x) => !x.ausgefallen).map(auswahl));
    assert.deepEqual(termine.map((x) => x.id), [training, vorbei, offen]);
    const o = termine.find((x) => x.id === offen)!;
    assert.equal(termine.find((x) => x.id === training)!.hinweis_eltern, "Pincode");
    assert.deepEqual(termine.find((x) => x.id === training)!.treffpunkt, { zeit: "17:45", ort: "Garderoben" }, "#561 AK 13");
    assert.deepEqual([o.nicht_aufgeboten, o.hinweis_eltern, o.treffpunkte], [true, "Leibchen", [{ anreise: "oev", zeitpunkt: `${tagCh(7)}T09:00`, ort: "Bahnhof" }]]);
    assert.equal(termine.find((x) => x.id === vorbei)!.frist_abgelaufen, true);
    // PC 7: Der nächste Abruf zeigt den neuen Stand.
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: offen, spielerId: k.lena, nichtAufgeboten: false }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: offen, spielerId: k.lena, angemeldet: true }));
    const danach = (await aboFeed(abo)).termine!.find((x) => x.id === offen)!;
    assert.deepEqual([danach.nicht_aufgeboten, danach.meldung], [false, "angemeldet"]);
  });

  // ── Nicht aufbieten (#464) ───────────────────────────────────────────────
  await pruefe("Nicht aufbieten: kennzeichnen, Meldung bleibt und ruht, zählt nicht, nur Mitglieder (#464 AK 1–9; PC 1, 7)", async () => {
    const k = await spielTeam("Kern-DB-Aufgebot");
    const t = wert(await k.spiel(6)).terminId;
    const gesehen = { datum: tagCh(6), beginn: "10:00" };
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, angemeldet: false }));
    const vorher = wert(await spielSpieler(a.supabase, a.id, { terminId: t })).spieler.find((x) => x.vorname === "Lena")!.gewechseltAm;
    // AK 1: gleich welche Meldung — angemeldet, abgemeldet, ohne.
    for (const id of [k.lena, k.mia, k.noah]) wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: id, nichtAufgeboten: true, gesehen }));
    const d = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    // AK 6, 7: Meldung darunter erkennbar, nichts zählt als angemeldet.
    assert.deepEqual(
      d.spieler.map((x) => [x.vorname, x.meldung, x.nichtAufgeboten]),
      [["Lena", "angemeldet", true], ["Mia", "abgemeldet", true], ["Noah", null, true]],
    );
    assert.deepEqual([d.angemeldet, d.abgemeldet, d.ohneMeldung, d.nichtAufgeboten, d.gesamt], [0, 0, 0, 3, 3]);
    assert.deepEqual((await standVon(k.team, t)).spielstand, {
      gesamt: 3, angemeldet: 0, abgemeldet: 0, ohne_meldung: 0, nicht_aufgeboten: 3, meldungen: 2, eingefroren: false, anwesend: null,
    });
    // AK 4: keine Meldung, weder von Mitgliedern noch über den Link.
    fehler(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.noah, angemeldet: true }), "regel", MELDUNG_TEXT.nichtAufgeboten);
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.lena })).token;
    const ueberLink = await feldAnon.rpc("spieler_link_melden", { p_token: link, p_termin: t, p_angemeldet: false, p_gesehen_datum: tagCh(6), p_gesehen_beginn: "10:00" });
    assert.deepEqual([ueberLink.data.status, ueberLink.data.grund], ["abgewiesen", "nicht_aufgeboten"]);
    // AK 8, 9: der Link nennt die Kennzeichnung und die Zahl.
    const imLink = async () => (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === t);
    const l1 = await imLink();
    assert.deepEqual([l1.nicht_aufgeboten, l1.nicht_aufgeboten_zahl, l1.angemeldet, l1.meldung], [true, 3, 0, "angemeldet"]);
    // AK 2, PC 1, 7: aufheben — die Meldung gilt wieder, ihr Zeitpunkt unverändert.
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.lena, nichtAufgeboten: false, gesehen }));
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.noah, nichtAufgeboten: false }));
    const d2 = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    const lena = d2.spieler.find((x) => x.vorname === "Lena")!;
    assert.deepEqual([lena.meldung, lena.nichtAufgeboten, lena.gewechseltAm], ["angemeldet", false, vorher]);
    assert.deepEqual([d2.angemeldet, d2.ohneMeldung, d2.nichtAufgeboten], [1, 1, 1]);
    assert.equal((await meldungen(t)).Noah, null, "ohne Meldung, die Zeile ist weg");
    assert.equal((await imLink()).nicht_aufgeboten, false);
    // AK 3, 5: nur Mitglieder; dieselben Abweisungen wie die Meldung.
    fehler(await setzeAufgebot(b.supabase, b.id, { terminId: t, spielerId: k.lena, nichtAufgeboten: true }), "nicht_gefunden", MELDUNG_TEXT.nichtGefunden);
    assert.ok((await feldAnon.rpc("termin_aufgebot_setzen", { p_termin: t, p_spieler: k.lena, p_nicht_aufgeboten: true })).error);
    const f = fehler(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.lena, nichtAufgeboten: true, gesehen: { datum: tagCh(5), beginn: "10:00" } }), "konflikt");
    assert.ok(f.meldung?.startsWith("Das Spiel wurde inzwischen verlegt"));
    const training = wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: k.team, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).terminId;
    fehler(await setzeAufgebot(a.supabase, a.id, { terminId: training, spielerId: k.lena, nichtAufgeboten: true }), "nicht_gefunden"); // OoS 1: nicht an Trainings
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: t }));
    fehler(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.lena, nichtAufgeboten: true }), "regel", MELDUNG_TEXT.ausgefallen);
    // PC 2: Sie ruht beim Ausfall und gilt danach wieder.
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: t }));
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).spieler.find((x) => x.vorname === "Mia")!.nichtAufgeboten, true);
  });

  await pruefe("Nicht aufbieten: verfällt mit den Meldungen, Rückfrage zählt sie, auch allein; Kader, Entfernen, Anpfiff (#464 AK 10, 13; PC 2–4)", async () => {
    const k = await spielTeam("Kern-DB-Aufgebot-Verfall");
    const t = wert(await k.spiel(6)).terminId;
    // AK 10: nur eine Kennzeichnung — trotzdem eine Rückfrage.
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.noah, nichtAufgeboten: true }));
    const r = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(7) }), "regel", spielBestaetigen(spielVerfallText(0, false, 1))) as {
      verfallend?: number;
      kennzeichnungen?: number;
    };
    assert.deepEqual([r.verfallend, r.kennzeichnungen], [1, 1]);
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(7), bestaetigt: 1 }), "regel");
    wert(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(7), bestaetigt: 2 }));
    // PC 2, 3: verfallen — mit eigenem Hinweis am Link.
    const d = wert(await spielSpieler(a.supabase, a.id, { terminId: t }));
    const noah = d.spieler.find((x) => x.vorname === "Noah")!;
    assert.deepEqual([noah.nichtAufgeboten, noah.aufgebotVerfallen, d.nichtAufgeboten], [false, true, 0]);
    const link = wert(await holeSpielerLink(a.supabase, a.id, { spielerId: k.noah })).token;
    const imLink = (await feldAnon.rpc("spieler_link_ansicht", { p_token: link })).data.termine.find((x: { id: string }) => x.id === t);
    assert.deepEqual([imLink.nicht_aufgeboten, imLink.aufgebot_verfallen], [false, true]);
    // Neu gekennzeichnet: der Hinweis geht.
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: t, spielerId: k.noah, nichtAufgeboten: true }));
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: t })).spieler.find((x) => x.vorname === "Noah")!.aufgebotVerfallen, false);

    // AK 10, PC 2: Kader-Wegfall nennt die Kennzeichnung eigens.
    const s1 = await neuerKader(k.team, "S1");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena, k.mia], dazu: [s1] }));
    const kt = wert(await k.spiel(4, { kaderIds: [s1] })).terminId;
    wert(await setzeMeldung(a.supabase, a.id, { terminId: kt, spielerId: k.mia, angemeldet: true }));
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: kt, spielerId: k.mia, nichtAufgeboten: true }));
    const kf = fehler(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1] }), "regel") as {
      verfallend?: number;
      verfallendSpiele?: number;
      kennzeichnungen?: number;
      meldung?: string;
    };
    assert.deepEqual([kf.verfallend, kf.verfallendSpiele, kf.kennzeichnungen], [2, 1, 1]);
    assert.ok(kf.meldung?.includes("1 Meldung zu einem Spiel und 1 Kennzeichnung als nicht aufgeboten"), kf.meldung);
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1], bestaetigt: 2 }));

    // AK 10, 13: Entfernen zählt Meldungen und Kennzeichnungen (Lenas verfiel mit der Verlegung).
    wert(await setzeMeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, angemeldet: true }));
    const e =fehler(await entferneTermin(a.supabase, a.id, { terminId: t }), "regel", spielBestaetigen(spielEntfernenText(1, 1))) as {
      verschwindend?: number;
      kennzeichnungen?: number;
    };
    assert.deepEqual([e.verschwindend, e.kennzeichnungen], [2, 1]);
    wert(await entferneTermin(a.supabase, a.id, { terminId: t, bestaetigt: true }));
  });


  // ── Probetraining (#555) ─────────────────────────────────────────────────
  const { leseProbetraining, legeProbetrainingFest, probeFolgen, schalteProbe } = await import("../lib/kern/probe");
  const { PROBE_TEXT, probeVerfallBestaetigen, ueberAnzahlText } = await import("../lib/probe");
  const probeTeam = async (name: string, anzahl: number | null = 2) => {
    const k = await spielTeam(name);
    if (anzahl !== null) wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl, info: null }));
    const training = async (tage: number, kaderIds: string[] = []) =>
      wert(await legeTerminFest(a.supabase, a.id, { art: "training", teamId: k.team, datum: tagCh(tage), beginn: "18:00", ende: "19:30", kaderIds })).terminId;
    const token = async (spielerId: string) => wert(await holeSpielerLink(a.supabase, a.id, { spielerId })).token;
    const ueberLink = async (tok: string, terminId: string, tage: number, abgemeldet: boolean) =>
      (await feldAnon.rpc("spieler_link_abmelden", { p_token: tok, p_termin: terminId, p_abgemeldet: abgemeldet, p_gesehen_datum: tagCh(tage), p_gesehen_beginn: "18:00" })).data as {
        status: string;
        grund?: string;
      };
    const ansicht = async (tok: string) =>
      (await feldAnon.rpc("spieler_link_ansicht", { p_token: tok })).data as {
        probe: { anzahl: number; besucht: number; angemeldet: number; moeglich: number } | null;
        termine: { id: string; art: string; abgemeldet: boolean; verfallen: { anmeldung: boolean } | null }[];
      };
    const probeVon = async (spielerId: string) =>
      wert(await ladeSpielerliste(a.supabase, a.id, { teamId: k.team })).spieler.find((x) => x.id === spielerId)!.probe;
    return { ...k, training, token, ueberLink, ansicht, probeVon };
  };

  await pruefe("Probetraining: Anzahl festlegen und ändern, 1 bis 20, nur Mitglieder, nicht entfernbar (#555 AK 1, 2, 4, 17, 18)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Anzahl", null);
    assert.deepEqual(wert(await leseProbetraining(a.supabase, a.id, { teamId: k.team })).anzahl, null, "AK 18: noch keine");
    // AK 4: ohne Anzahl lässt sich nichts einschalten.
    fehler(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true }), "regel", PROBE_TEXT.anzahlFehlt);
    for (const n of [0, 21, 2.5]) fehler(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: n, info: null }), "eingabe", PROBE_TEXT.anzahlProblem);
    // Auch an der Kernprüfung vorbei weist die Datenebene ab.
    assert.match((await a.supabase.rpc("team_probetraining_festlegen", { p_team: k.team, p_anzahl: 21, p_info: null })).error?.message ?? "", /PROBE_ANZAHL_UNGUELTIG|team_probetraining_anzahl/);
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 4, info: null }));
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: null }));
    assert.equal(wert(await leseProbetraining(a.supabase, a.id, { teamId: k.team })).anzahl, 3);
    // Fremde sehen und ändern nichts; direktes Schreiben geht nicht.
    fehler(await legeProbetrainingFest(b.supabase, b.id, { teamId: k.team, anzahl: 5, info: null }), "nicht_gefunden");
    fehler(await leseProbetraining(b.supabase, b.id, { teamId: k.team }), "nicht_gefunden");
    await a.supabase.from("team_probetraining").update({ anzahl: 9 }).eq("team_id", k.team);
    assert.equal((await admin.from("team_probetraining").select("anzahl").eq("team_id", k.team).single()).data?.anzahl, 3);
    await a.supabase.from("team_probetraining").delete().eq("team_id", k.team);
    assert.equal((await admin.from("team_probetraining").select("anzahl").eq("team_id", k.team).single()).data?.anzahl, 3, "OoS 6: nicht entfernbar");
    assert.deepEqual((await feldAnon.from("team_probetraining").select("anzahl").eq("team_id", k.team)).data ?? [], []);
  });

  await pruefe("Probetraining: Einschalten lässt Abmeldungen, Meldungen und Kennzeichnungen verfallen - nur mit der Zahl (#555 AK 3, 5; PC 1, 3)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Ein");
    const t1 = await k.training(3);
    const t2 = await k.training(5);
    const sp = wert(await k.spiel(4)).terminId;
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t1, spielerId: k.mia, abgemeldet: true }));
    wert(await setzeMeldung(a.supabase, a.id, { terminId: sp, spielerId: k.mia, angemeldet: true }));
    wert(await setzeAufgebot(a.supabase, a.id, { terminId: sp, spielerId: k.mia, nichtAufgeboten: true }));
    const f = wert(await probeFolgen(a.supabase, a.id, { spielerId: k.mia }));
    assert.deepEqual([f.abmeldungen, f.meldungen, f.kennzeichnungen], [1, 1, 1]);
    // Ohne Bestätigung nichts geschrieben; die KI erhält den Weg dazu.
    const r = fehler(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true }), "regel", probeVerfallBestaetigen("Mia", f)) as { verfallend?: number };
    assert.equal(r.verfallend, 3);
    fehler(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: 2 }), "regel", /^Inzwischen hat sich etwas geändert/);
    assert.equal(await k.probeVon(k.mia), null, "nichts geschrieben");
    assert.equal(wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: 3 })).verfallen, 3);
    // PC 1: an allen kommenden Trainings nicht angemeldet; die übrigen zählen weiter.
    for (const t of [t1, t2]) {
      const l = wert(await terminSpieler(a.supabase, a.id, { terminId: t }));
      assert.deepEqual(l.spieler.map((x) => [x.vorname, x.abgemeldet, x.probe]), [["Lena", false, false], ["Mia", true, true], ["Noah", false, false]]);
      assert.deepEqual([l.angemeldet, l.gesamt], [2, 3], "PC 2: zählt unter allen, unter den Angemeldeten nur angemeldet");
    }
    // PC 3: Spiele gelten für sie nicht - weder für Mitglieder noch am Link.
    assert.deepEqual(wert(await spielSpieler(a.supabase, a.id, { terminId: sp })).spieler.map((x) => x.vorname), ["Lena", "Noah"]);
    const tok = await k.token(k.mia);
    const v = await k.ansicht(tok);
    assert.deepEqual(v.termine.map((x) => x.art), ["training", "training"]);
    assert.deepEqual(v.probe, { anzahl: 2, besucht: 0, angemeldet: 0, moeglich: 2 });
    assert.equal((await k.ueberLink(tok, sp, 4, false)).status, "abgewiesen");
    // Eine Probe-Spieler:in ohne Abmeldungen schaltet ohne Rückfrage; die KI mit «true».
    assert.equal(wert(await schalteProbe(a.supabase, a.id, { spielerId: k.noah, probe: true })).verfallen, 0);
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t1, spielerId: k.lena, abgemeldet: true }));
    assert.equal(wert(await schalteProbe(a.supabase, a.id, { spielerId: k.lena, probe: true, bestaetigt: true })).verfallen, 1);
  });

  await pruefe("Probetraining: Anmelden über den Link bis zur Anzahl, Mitglieder darüber mit Hinweis (#555 AK 8–12; PC 8, 13)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Link");
    const [t1, t2, t3] = [await k.training(2), await k.training(3), await k.training(4)];
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    const tok = await k.token(k.mia);
    const an1 = await k.ueberLink(tok, t1, 2, false);
    assert.equal(an1.status, "ok");
    assert.deepEqual((await k.ansicht(tok)).probe, { anzahl: 2, besucht: 0, angemeldet: 1, moeglich: 1 });
    assert.equal((await k.ueberLink(tok, t2, 3, false)).status, "ok");
    // AK 10, 12: die dritte geht über die Anzahl - abgewiesen, mit Stand.
    const voll = await k.ueberLink(tok, t3, 4, false);
    assert.deepEqual([voll.status, voll.grund], ["abgewiesen", "probe_voll"]);
    assert.deepEqual((await k.ansicht(tok)).probe, { anzahl: 2, besucht: 0, angemeldet: 2, moeglich: 0 });
    // Abmelden gibt den Platz frei (AK 9).
    assert.equal((await k.ueberLink(tok, t2, 3, true)).status, "ok");
    assert.equal((await k.ueberLink(tok, t3, 4, false)).status, "ok");
    assert.deepEqual((await k.ansicht(tok)).termine.map((x) => x.abgemeldet), [false, true, false]);
    // AK 8: Mitglieder melden darüber hinaus an, mit Hinweis (Zusatzentscheid PO 2026-10-29).
    const ueber = wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t2, spielerId: k.mia, abgemeldet: false }));
    assert.deepEqual(ueber.probe, { anzahl: 2, besucht: 0, angemeldet: 3, moeglich: 0 });
    assert.equal(ueber.hinweis, ueberAnzahlText("Mia Muster", ueber.probe!));
    assert.equal(wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t2, spielerId: k.mia, abgemeldet: true })).hinweis, null, "abmelden ohne Hinweis");
    // PC 8: Senken der Anzahl belässt bestehende Anmeldungen.
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 1, info: null }));
    assert.deepEqual((await k.ansicht(tok)).probe, { anzahl: 1, besucht: 0, angemeldet: 2, moeglich: 0 });
    assert.deepEqual((await k.probeVon(k.mia)), { anzahl: 1, besucht: 0, angemeldet: 2, moeglich: 0 }, "AK 7: dieselbe Zahl in der Spielerliste");
    // Abmelden geht auch über der Anzahl; anmelden erst wieder mit Platz.
    assert.equal((await k.ueberLink(tok, t3, 4, true)).status, "ok");
    assert.equal((await k.ueberLink(tok, t3, 4, false)).grund, "probe_voll");
  });

  await pruefe("Probetraining: besucht zählt Begonnene seit dem Einschalten, Nachtrag wirkt, Ausfall ruht (#555 AK 13; PC 4, 7)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Besucht", 4);
    const frueher = await k.training(-4);
    const morgen = await k.training(1);
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    // Eingeschaltet vor drei Tagen: die danach Begonnenen fallen in die Probezeit,
    // das vorher Begonnene nicht (es hielt sie beim Einschalten als angemeldet fest).
    await admin.from("team_spieler").update({ probe_seit: new Date(Date.now() - 3 * 864e5).toISOString() }).eq("team_id", k.team).eq("spieler_id", k.mia);
    const gestern = await k.training(-1);
    const vorgestern = await k.training(-2);
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: frueher })).spieler.find((x) => x.spielerId === k.mia)!.abgemeldet, false);
    assert.equal((await k.probeVon(k.mia))!.besucht, 0, "nicht angemeldet bei Beginn: nicht besucht");
    // AK 13: doch erschienen zählt als besucht, nicht erschienen nicht.
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: gestern, spielerId: k.mia, da: true }));
    assert.equal((await k.probeVon(k.mia))!.besucht, 1);
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: vorgestern, spielerId: k.mia, da: true }));
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: vorgestern, spielerId: k.mia, da: false }));
    assert.equal((await k.probeVon(k.mia))!.besucht, 1);
    // PC 7: ein ausgefallenes Training zählt weder als angemeldet noch als besucht und ruht.
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: morgen, spielerId: k.mia, abgemeldet: false }));
    assert.equal((await k.probeVon(k.mia))!.angemeldet, 1);
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: morgen, grund: null }));
    assert.equal((await k.probeVon(k.mia))!.angemeldet, 0);
    wert(await nimmAusfallZurueck(a.supabase, a.id, { terminId: morgen }));
    assert.equal((await k.probeVon(k.mia))!.angemeldet, 1, "die Anmeldung kehrt zurück");
    wert(await lasseAusfallen(a.supabase, a.id, { terminId: gestern, grund: null }));
    assert.equal((await k.probeVon(k.mia))!.besucht, 0);
  });

  await pruefe("Probetraining: Verlegen und Kader lassen Anmeldungen verfallen, mit Zahl vorher; Link nennt es (#555 AK 14; PC 5, 6)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Verfall", 4);
    const s1 = await neuerKader(k.team, "S1");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia, k.lena], dazu: [s1] }));
    const t = await k.training(3);
    const kt = await k.training(5, [s1]);
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.mia, abgemeldet: false }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: t, spielerId: k.lena, abgemeldet: true }));
    wert(await setzeAbmeldung(a.supabase, a.id, { terminId: kt, spielerId: k.mia, abgemeldet: false }));
    // Verlegen: die Rückfrage nennt Abmeldungen und Anmeldungen.
    const v = fehler(await aendereTermin(a.supabase, a.id, { terminId: t, datum: tagCh(4) }), "regel") as { verfallend?: number; anmeldungen?: number };
    assert.deepEqual([v.verfallend, v.anmeldungen], [2, 1]);
    wert(await aendereMitReichweite(a.supabase, a.id, { terminId: t, datum: tagCh(4), bestaetigt: true }));
    const tok = await k.token(k.mia);
    const nachher = (await k.ansicht(tok)).termine.find((x) => x.id === t)!;
    assert.deepEqual([nachher.abgemeldet, nachher.verfallen?.anmeldung], [true, true], "PC 5: nicht angemeldet, Link nennt die Anmeldung");
    assert.deepEqual(wert(await terminSpieler(a.supabase, a.id, { terminId: t })).spieler.map((x) => x.abgemeldet), [false, true, false], "Lena wieder angemeldet");
    // Kader: fällt das Training für sie weg, verfällt die Anmeldung (PC 5).
    const kf = fehler(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1] }), "regel") as { verfallend?: number; anmeldungen?: number };
    assert.deepEqual([kf.verfallend, kf.anmeldungen], [1, 1]);
    // Entfernen des Kaders lässt das Training für alle gelten: nichts verfällt.
    assert.equal(wert(await kaderEntfernenFolgen(a.supabase, a.id, { kaderId: s1 })).verfallendAnmeldungen, 0);
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], weg: [s1], bestaetigt: 1 }));
    // PC 6: gilt es wieder für sie, ist sie nicht angemeldet.
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.mia], dazu: [s1] }));
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: kt })).spieler.find((x) => x.spielerId === k.mia)!.abgemeldet, true);
  });

  await pruefe("Probetraining: Ausschalten - alle Trainings angemeldet, Spiele gelten wieder, neu einschalten zählt ab null (#555 AK 19; PC 9, 10, 11)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Aus", 3);
    const t = await k.training(2);
    const sp = wert(await k.spiel(4)).terminId;
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    await admin.from("team_spieler").update({ probe_seit: new Date(Date.now() - 3 * 864e5).toISOString() }).eq("team_id", k.team).eq("spieler_id", k.mia);
    const vorbei = await k.training(-1);
    wert(await setzeAnwesenheit(a.supabase, a.id, { terminId: vorbei, spielerId: k.mia, da: true }));
    const tok = await k.token(k.mia);
    // PC 11: im Abo der Probe-Spieler:in gilt «nicht angemeldet» als vielleicht.
    const abo = (await aboHolen(tok))!;
    const feed = (await aboFeed(abo)) as unknown as { probe?: boolean; termine: { id: string; abgemeldet: boolean }[] };
    assert.equal(feed.probe, true);
    assert.deepEqual(feed.termine.map((x) => x.id), [t], "PC 11: dieselben Trainings wie der Link, kein Spiel");
    assert.equal((await k.probeVon(k.mia))!.besucht, 1);
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: false }));
    assert.equal(await k.probeVon(k.mia), null);
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: t })).spieler.find((x) => x.spielerId === k.mia)!.abgemeldet, false, "PC 9: angemeldet");
    assert.ok(wert(await spielSpieler(a.supabase, a.id, { terminId: sp })).spieler.some((x) => x.spielerId === k.mia), "PC 9: Spiele gelten wieder");
    assert.equal((await k.ansicht(tok)).probe, null, "derselbe Link, ohne Probe");
    // Begonnene behalten den Stand bei Beginn samt Nachtrag.
    assert.equal(wert(await terminSpieler(a.supabase, a.id, { terminId: vorbei })).spieler.find((x) => x.spielerId === k.mia)!.nachgetragen, true);
    // PC 10: erneut eingeschaltet zählt es ab null.
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    assert.deepEqual(await k.probeVon(k.mia), { anzahl: 3, besucht: 0, angemeldet: 0, moeglich: 3 });
    // Entfernen geht wie bei allen; Fremde schalten nichts.
    fehler(await schalteProbe(b.supabase, b.id, { spielerId: k.lena, probe: true }), "nicht_gefunden");
  });


  await pruefe("Info-Schreiben: verfassen, ändern, entfernen, 2000 Zeichen, nur im Link von Probe-Spieler:innen (#556 AK 1, 2, 4, 7; PC 1-3; OoS 3)", async () => {
    const k = await probeTeam("Kern-DB-Probe-Info", 3);
    const t = await k.training(2);
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true, bestaetigt: true }));
    const [mia, lena] = [await k.token(k.mia), await k.token(k.lena)];
    assert.equal((await k.ansicht(mia) as { probe_info?: string | null }).probe_info, null, "noch keines");
    const text = "Willkommen!\n\nKomm 10 Minuten vorher.\nMehr: https://fc.ch";
    assert.equal(wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: `  ${text}\r\n` })).info, text);
    assert.deepEqual(wert(await leseProbetraining(a.supabase, a.id, { teamId: k.team })), { teamId: k.team, anzahl: 3, info: text }, "AK 7");
    // PC 1, 2: im Link der Probe-Spieler:in mit Zeilenumbrüchen, bei den übrigen nie.
    assert.equal((await k.ansicht(mia) as { probe_info?: string | null }).probe_info, text);
    assert.equal((await k.ansicht(lena) as { probe_info?: string | null }).probe_info, null);
    // OoS 3: nicht im Abo.
    const abo = (await aboHolen(mia))!;
    assert.ok(!JSON.stringify(await aboFeed(abo)).includes("Willkommen"));
    // AK 2: höchstens 2000 Zeichen, auch an der Kernprüfung vorbei.
    fehler(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: "x".repeat(2001) }), "eingabe", PROBE_TEXT.infoZuLang);
    assert.match(
      (await a.supabase.rpc("team_probetraining_festlegen", { p_team: k.team, p_anzahl: 3, p_info: "x".repeat(2001) })).error?.message ?? "",
      /PROBE_INFO_ZU_LANG/,
    );
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: "⚽".repeat(2000) }));
    // PC 3: eine Änderung steht beim nächsten Öffnen; leer entfernt es (AK 1).
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: "Neu" }));
    assert.equal((await k.ansicht(mia) as { probe_info?: string | null }).probe_info, "Neu");
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: " \n " }));
    assert.equal(wert(await leseProbetraining(a.supabase, a.id, { teamId: k.team })).info, null);
    // Ausgeschaltet: kein Info-Schreiben mehr am Link.
    wert(await legeProbetrainingFest(a.supabase, a.id, { teamId: k.team, anzahl: 3, info: "Wieder da" }));
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: false }));
    assert.equal((await k.ansicht(mia) as { probe_info?: string | null }).probe_info, null);
    assert.ok(t);
  });

  // ── Verein (#577) ────────────────────────────────────────────────────────
  // Die Regeln selbst prüft supabase/tests/vereine_fundament.sql per psql;
  // hier der Weg über den Nutzer-Client (PostgREST) und die Kern-Leser.
  type Lage = { verein: { id: string; name: string; ist_verwaltung: boolean; ist_teammitglied: boolean } | null; grenzen: null };
  const lageVon = async (k: Konto) => {
    const { data, error } = await k.supabase.rpc("meine_vereinslage");
    assert.equal(error, null);
    return data as Lage;
  };

  await pruefe("Verein: Lage je Konto, Teams nur durch die Verwaltung, der Verein eines Teams bleibt (#577 AK 4, 5; Testfall 2, 3; #581 AK 17, 26)", async () => {
    const ohne = await wegwerfKonto();
    assert.deepEqual(await lageVon(ohne), { verein: null, grenzen: null }, "Konto ohne Verein");
    assert.deepEqual(await lageVon(verwaltung), {
      verein: { id: verein, name: "Kern-DB", ist_verwaltung: true, ist_teammitglied: false },
      grenzen: null,
    });
    const team = await serienTeam("Kern-DB-Verein");
    assert.deepEqual((await lageVon(a)).verein, { id: verein, name: "Kern-DB", ist_verwaltung: false, ist_teammitglied: true });

    // AK 5, #581 AK 26: Mitglieder und Konten ohne Verein legen keine Teams an
    // — weder über die RPC (ununterscheidbar «nicht gefunden») noch direkt.
    for (const k of [a, ohne]) {
      fehler(await legeTeamAn(k.supabase, k.id, { vereinId: verein, name: "Kern-DB-Verboten" }), "nicht_gefunden", VEREIN_MELDUNG.VEREIN_NICHT_GEFUNDEN);
      assert.ok((await k.supabase.from("teams").insert({ name: "Kern-DB-Verboten", verein_id: verein })).error, "kein direktes INSERT");
    }
    assert.equal((await admin.from("teams").select("id").eq("name", "Kern-DB-Verboten")).data!.length, 0);
    // #581 AK 17: Die Verwaltung legt eines im eigenen Verein an, ohne Mitglied zu werden.
    const neu = wert(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "Kern-DB-Verwaltung" })).teamId;
    teams.push(neu);
    assert.equal((await admin.from("teams").select("verein_id").eq("id", neu).single()).data!.verein_id, verein);
    assert.equal((await admin.from("team_members").select("user_id").eq("team_id", neu)).data!.length, 0, "#581 AK 17: ohne Mitglied");
    assert.equal((await lageVon(verwaltung)).verein!.ist_teammitglied, false);

    // Testfall 2: Der Verein eines Teams bleibt (Netz, auch per Admin); den
    // Namen ändert seit #581 nur die Verwaltung, nie ein Mitglied direkt.
    const fremdeVerwaltung = await wegwerfKonto();
    const anderer = await testVerein("Kern-DB-Anderer", fremdeVerwaltung);
    const wechsel = await admin.from("teams").update({ verein_id: anderer }).eq("id", team).select();
    assert.match(wechsel.error?.message ?? "", /VEREIN_FEST/);
    assert.ok((await a.supabase.from("teams").update({ name: "Kern-DB-Verein-Neu" }).eq("id", team)).error, "#581 AK 26: kein direktes UPDATE");
    wert(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: team, name: "Kern-DB-Verein-Neu" }));
    assert.deepEqual((await admin.from("teams").select("name, verein_id").eq("id", team).single()).data, { name: "Kern-DB-Verein-Neu", verein_id: verein });
  });

  // ── Vereinsverwaltung führt Teams und Trainer:innen (#581) ───────────────
  // Die Regeln und Rennen prüft supabase/tests/vereine_verwaltung.sql per psql;
  // hier der Kern (lib/kern/verein.ts): jede Antwort der Datenebene als
  // Ergebnis und Satz, über den Nutzer-Client.
  const emailVon = async (k: Konto) => (await admin.auth.admin.getUserById(k.id)).data.user!.email!;
  const NG_VEREIN = VEREIN_MELDUNG.VEREIN_NICHT_GEFUNDEN;
  // Team-adressierte RPCs: kein Recht oder Team aufgelöst heisst dort «Team nicht gefunden.» (ohne Zusatz des Team-Orts).
  const NG_TEAM = VEREIN_TEAM_NICHT_GEFUNDEN;
  /** Ein zweiter Verein samt eigener Verwaltung (für `anderer_verein`). */
  let fremdVerwaltung: Konto | null = null;
  const fremdeVerwaltung = async () => {
    if (!fremdVerwaltung) {
      fremdVerwaltung = await wegwerfKonto();
      await testVerein("Kern-DB-581-Fremd", fremdVerwaltung);
    }
    return fremdVerwaltung;
  };

  await pruefe("Verein: Teams anlegen und umbenennen, Name je Verein eindeutig, Grenze 30 nur beim Anlegen (#581 AK 17–22, 26, PC 7)", async () => {
    const eins = wert(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "  Kern-DB-581-A " }));
    teams.push(eins.teamId);
    assert.equal(eins.name, "Kern-DB-581-A", "getrimmt");
    assert.equal((await admin.from("team_members").select("user_id").eq("team_id", eins.teamId)).data!.length, 0, "AK 17");
    const zwei = wert(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "Kern-DB-581-B" })).teamId;
    teams.push(zwei);
    // AK 20, 21: Gross/Klein, Leerzeichen und Bindestriche machen keinen Unterschied; die Abweisung nennt das Team.
    const vergeben = fehler(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "kern db 581 a" }), "regel", teamnameVergebenText("Kern-DB-581-A"));
    assert.equal((vergeben as { feld?: string }).feld, "name");
    fehler(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: zwei, name: "KERN-DB-581-A" }), "regel", teamnameVergebenText("Kern-DB-581-A"));
    // AK 20: Umlaute zählen — «Kern-DB-581-Ä» ist ein anderer Name.
    teams.push(wert(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "Kern-DB-581-Ä" })).teamId);
    // AK 22: eine andere Schreibweise des eigenen Namens.
    assert.equal(wert(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: eins.teamId, name: "kern-db 581-a" })).name, "kern-db 581-a");
    // Eingabe: leer oder über 60 Zeichen, vor der Datenebene.
    fehler(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "  " }), "eingabe");
    fehler(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: zwei, name: "x".repeat(61) }), "eingabe");
    // AK 26: Mitglied, fremde Verwaltung, unbekanntes Team — ununterscheidbar.
    await admin.from("team_members").insert({ team_id: zwei, user_id: a.id });
    const fremd = await fremdeVerwaltung();
    for (const k of [a, fremd]) {
      fehler(await benenneTeamUm(k.supabase, k.id, { teamId: zwei, name: "Kern-DB-581-Fremd" }), "nicht_gefunden", NG_TEAM);
      fehler(await legeTeamAn(k.supabase, k.id, { vereinId: verein, name: "Kern-DB-581-Fremd" }), "nicht_gefunden", NG_VEREIN);
    }
    fehler(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: randomUUID(), name: "Kern-DB-581-C" }), "nicht_gefunden", NG_TEAM);
    fehler(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: "kein-uuid", name: "Kern-DB-581-C" }), "nicht_gefunden", VEREIN_TEAM_NICHT_GEFUNDEN);
    // Netz: Auch an der RPC vorbei (Admin) kein zweiter Name im Verein.
    const netz = await admin.from("teams").insert({ name: "Kern-DB 581 B", verein_id: verein });
    assert.match(netz.error?.message ?? "", /TEAMNAME_VERGEBEN/);
    assert.equal(ausDbFehler(netz.error!).meldung, VEREIN_MELDUNG.TEAMNAME_VERGEBEN);

    // AK 18: Mit 30 Teams weist das Anlegen ab, mit dem Satz der Grenze; PC 7: Umbenennen geht weiter.
    const { count } = await admin.from("teams").select("id", { count: "exact", head: true }).eq("verein_id", verein);
    const fehlend = VEREIN_TEAMS_MAX - count!;
    const { data: voll, error: vollFehler } = await admin
      .from("teams")
      .insert(Array.from({ length: fehlend }, (_, i) => ({ name: `Kern-DB-581-Voll-${i}`, verein_id: verein })))
      .select("id");
    assert.equal(vollFehler, null);
    teams.push(...voll!.map((t) => t.id as string));
    fehler(await legeTeamAn(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "Kern-DB-581-31" }), "regel", VEREIN_MELDUNG.VEREIN_TEAMS_VOLL);
    assert.equal(wert(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: zwei, name: "Kern-DB-581-B2" })).name, "Kern-DB-581-B2", "PC 7");
  });

  await pruefe("Verein: Name ändern, leer und über 60 Zeichen abgewiesen, nur durch die Verwaltung (#581 AK 23, 26)", async () => {
    try {
      assert.equal(wert(await benenneVereinUm(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "  Kern-DB-Neu " })).name, "Kern-DB-Neu");
      assert.equal((await admin.from("vereine").select("name").eq("id", verein).single()).data!.name, "Kern-DB-Neu");
      fehler(await benenneVereinUm(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: " " }), "eingabe", "Bitte einen Vereinsnamen angeben.");
      fehler(await benenneVereinUm(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "x".repeat(61) }), "eingabe", "Der Vereinsname darf höchstens 60 Zeichen lang sein.");
      wert(await benenneVereinUm(verwaltung.supabase, verwaltung.id, { vereinId: verein, name: "x".repeat(60) }));
      fehler(await benenneVereinUm(a.supabase, a.id, { vereinId: verein, name: "Kern-DB-Mitglied" }), "nicht_gefunden", NG_VEREIN);
      assert.ok((await a.supabase.from("vereine").update({ name: "Kern-DB-Direkt" }).eq("id", verein)).error || (await admin.from("vereine").select("name").eq("id", verein).single()).data!.name !== "Kern-DB-Direkt");
    } finally {
      // Die übrigen Prüfungen erwarten den Namen «Kern-DB».
      await admin.from("vereine").update({ name: "Kern-DB" }).eq("id", verein);
    }
  });

  await pruefe("Verein: Trainer:innen suchen, aufnehmen, sich selbst aufnehmen, entfernen — jeder Status als Satz (#581 AK 12–14, 16, 26, PC 3, 4)", async () => {
    const team = await neuesTeam("Kern-DB-581-Personen");
    const [mailA, mailV] = [await emailVon(a), await emailVon(verwaltung)];
    const fremd = await fremdeVerwaltung();
    const schritt = (r: Awaited<ReturnType<typeof findePerson>>) => wert(r);
    // Suche mit Team: nicht gefunden, anderer Verein, gefunden.
    assert.deepEqual(schritt(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: team, email: "niemand-581@test.local" })), { ok: false, meldung: PERSON_MELDUNG.nicht_gefunden });
    assert.deepEqual(schritt(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: team, email: await emailVon(fremd) })), { ok: false, meldung: PERSON_MELDUNG.anderer_verein });
    assert.equal(PERSON_MELDUNG.anderer_verein, VEREIN_MELDUNG.ANDERER_VEREIN, "eine Konstante");
    const gefunden = schritt(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: team, email: ` ${mailA.toUpperCase()} ` }));
    assert.equal(gefunden.ok, true);
    // AK 13: aufnehmen, zweimal → bereits Mitglied (Suche und Aufnahme).
    assert.equal(schritt(await nimmInsTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, email: mailA })).ok, true);
    assert.deepEqual(schritt(await nimmInsTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, email: mailA })), { ok: false, meldung: PERSON_MELDUNG.bereits_mitglied });
    assert.deepEqual(schritt(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: team, email: mailA })), { ok: false, meldung: PERSON_MELDUNG.bereits_mitglied });
    assert.deepEqual(schritt(await nimmInsTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, email: await emailVon(fremd) })), { ok: false, meldung: PERSON_MELDUNG.anderer_verein });
    // Ohne Team: Suche für die Verwaltung → bereits Verwaltung.
    assert.deepEqual(schritt(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: mailV })), { ok: false, meldung: PERSON_MELDUNG.bereits_verwaltung });
    fehler(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: team, email: "  " }), "eingabe", "Bitte eine E-Mail-Adresse angeben.");
    // Team-Ort: Auch finde_trainer und add_team_member weisen ein Konto eines anderen Vereins ab.
    assert.deepEqual((await a.supabase.rpc("finde_trainer", { p_team_id: team, p_email: await emailVon(fremd) })).data, { status: "anderer_verein" });
    assert.deepEqual((await a.supabase.rpc("add_team_member", { p_team_id: team, p_email: await emailVon(fremd) })).data, { status: "anderer_verein" });
    // AK 12: sich selbst aufnehmen, wiederholbar.
    assert.deepEqual(wert(await nimmMichInsTeam(verwaltung.supabase, verwaltung.id, { teamId: team })), { teamId: team });
    wert(await nimmMichInsTeam(verwaltung.supabase, verwaltung.id, { teamId: team }));
    assert.equal((await admin.from("team_members").select("user_id").eq("team_id", team).eq("user_id", verwaltung.id)).data!.length, 1);
    // AK 16, PC 4: Ein Mitglied entfernt die Verwaltung wie jedes Mitglied; sie bleibt Verwaltung.
    assert.deepEqual((await a.supabase.rpc("entferne_team_mitglied", { p_team: team, p_user: verwaltung.id })).data, { status: "entfernt" });
    assert.equal((await lageVon(verwaltung)).verein!.ist_verwaltung, true, "PC 4");
    // AK 14: Die Verwaltung entfernt jede Trainer:in, auch wenn sie schon weg ist; das Team bleibt (PC 3).
    assert.deepEqual(wert(await entferneAusTeam(verwaltung.supabase, verwaltung.id, { teamId: team, userId: a.id })), { teamId: team });
    wert(await entferneAusTeam(verwaltung.supabase, verwaltung.id, { teamId: team, userId: a.id }));
    assert.equal((await admin.from("teams").select("id").eq("id", team)).data!.length, 1, "PC 3: Team bleibt ohne Mitglied");
    // AK 26: Mitglieder und fremde Verwaltung handeln nicht am Verein-Ort.
    await admin.from("team_members").insert({ team_id: team, user_id: a.id });
    for (const k of [a, fremd]) {
      fehler(await findePerson(k.supabase, k.id, { vereinId: verein, teamId: team, email: mailV }), "nicht_gefunden", NG_TEAM);
      fehler(await nimmInsTeamAuf(k.supabase, k.id, { teamId: team, email: mailV }), "nicht_gefunden", NG_TEAM);
      fehler(await nimmMichInsTeam(k.supabase, k.id, { teamId: team }), "nicht_gefunden", NG_TEAM);
      fehler(await entferneAusTeam(k.supabase, k.id, { teamId: team, userId: a.id }), "nicht_gefunden", NG_TEAM);
    }
    // Ein Team eines anderen Vereins bei der Suche: ebenso.
    fehler(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, teamId: randomUUID(), email: mailA }), "nicht_gefunden", NG_TEAM);
    // Nach dem Auflösen: «nicht gefunden» statt eines Rohtexts.
    wert(await loeseTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, teamname: "Kern-DB-581-Personen" }));
    fehler(await nimmMichInsTeam(verwaltung.supabase, verwaltung.id, { teamId: team }), "nicht_gefunden", NG_TEAM);
    fehler(await entferneAusTeam(verwaltung.supabase, verwaltung.id, { teamId: team, userId: a.id }), "nicht_gefunden", NG_TEAM);
    fehler(await nimmInsTeamAuf(verwaltung.supabase, verwaltung.id, { teamId: team, email: mailA }), "nicht_gefunden", NG_TEAM);
    fehler(await benenneTeamUm(verwaltung.supabase, verwaltung.id, { teamId: team, name: "Kern-DB-581-Weg" }), "nicht_gefunden", NG_TEAM);
    fehler(await ladeVereinTeamAnsicht(verwaltung.supabase, verwaltung.id, { teamId: team }), "nicht_gefunden", NG_TEAM);
  });

  await pruefe("Verein: Bremse der Personensuche — nicht gefunden und anderer Verein zählen, gefunden nicht (#581 AK 13; AP §4.3)", async () => {
    const zweite = await wegwerfKonto();
    await admin.from("verein_verwaltung").insert({ verein_id: verein, user_id: zweite.id });
    try {
      const fremdMail = await emailVon(await fremdeVerwaltung());
      const mailA = await emailVon(a);
      const suche = async (email: string) => wert(await findePerson(zweite.supabase, zweite.id, { vereinId: verein, email }));
      for (let i = 0; i < 5; i++) {
        assert.equal((await suche(mailA)).ok, true, "gefunden zählt nicht");
        assert.deepEqual(await suche(`niemand-${i}-581@test.local`), { ok: false, meldung: PERSON_MELDUNG.nicht_gefunden });
        assert.deepEqual(await suche(fremdMail), { ok: false, meldung: PERSON_MELDUNG.anderer_verein });
      }
      assert.equal((await admin.from("trainer_suchversuche").select("user_id").eq("user_id", zweite.id)).data!.length, 10);
      assert.deepEqual(await suche(mailA), { ok: false, meldung: PERSON_MELDUNG.gebremst }, "nach zehn erfolglosen gebremst");
      assert.deepEqual(wert(await nimmInVerwaltungAuf(zweite.supabase, zweite.id, { vereinId: verein, email: mailA })), { ok: false, meldung: PERSON_MELDUNG.gebremst });
    } finally {
      await admin.from("verein_verwaltung").delete().eq("verein_id", verein).eq("user_id", zweite.id);
    }
  });

  await pruefe("Verein: Verwaltung aufnehmen, entfernen, austreten, die letzte bleibt (#581 AK 30–34, PC 4)", async () => {
    const c = await wegwerfKonto();
    const team = await serienTeam("Kern-DB-581-Verwaltung");
    await admin.from("team_members").insert({ team_id: team, user_id: c.id });
    const mailC = await emailVon(c);
    const fremd = await fremdeVerwaltung();
    assert.deepEqual(wert(await findePerson(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: mailC })).ok, true);
    assert.equal(wert(await nimmInVerwaltungAuf(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: mailC })).ok, true);
    assert.deepEqual(wert(await nimmInVerwaltungAuf(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: mailC })), { ok: false, meldung: PERSON_MELDUNG.bereits_verwaltung });
    assert.deepEqual(wert(await nimmInVerwaltungAuf(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: await emailVon(fremd) })), { ok: false, meldung: PERSON_MELDUNG.anderer_verein });
    assert.deepEqual(wert(await nimmInVerwaltungAuf(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: "niemand-581@test.local" })), { ok: false, meldung: PERSON_MELDUNG.nicht_gefunden });
    fehler(await nimmInVerwaltungAuf(a.supabase, a.id, { vereinId: verein, email: mailC }), "nicht_gefunden", NG_VEREIN);
    fehler(await entferneAusVerwaltung(a.supabase, a.id, { vereinId: verein, userId: c.id }), "nicht_gefunden", NG_VEREIN);
    fehler(await entferneAusVerwaltung(fremd.supabase, fremd.id, { vereinId: verein, userId: c.id }), "nicht_gefunden", NG_VEREIN);
    // AK 32, PC 4: c tritt aus und bleibt Trainer:in im Team; danach hat c kein Recht mehr.
    assert.deepEqual(wert(await entferneAusVerwaltung(c.supabase, c.id, { vereinId: verein, userId: c.id })), { vereinId: verein });
    assert.equal((await admin.from("team_members").select("user_id").eq("team_id", team).eq("user_id", c.id)).data!.length, 1, "PC 4");
    fehler(await entferneAusVerwaltung(c.supabase, c.id, { vereinId: verein, userId: verwaltung.id }), "nicht_gefunden", NG_VEREIN);
    // AK 31: eine andere Person entfernen; schon weg → entfernt.
    wert(await nimmInVerwaltungAuf(verwaltung.supabase, verwaltung.id, { vereinId: verein, email: mailC }));
    wert(await entferneAusVerwaltung(verwaltung.supabase, verwaltung.id, { vereinId: verein, userId: c.id }));
    wert(await entferneAusVerwaltung(verwaltung.supabase, verwaltung.id, { vereinId: verein, userId: c.id }));
    // AK 33, 34: Die letzte Person geht nicht — mit dem Satz und dem Feld.
    const letzte = fehler(await entferneAusVerwaltung(verwaltung.supabase, verwaltung.id, { vereinId: verein, userId: verwaltung.id }), "regel", VEREIN_MELDUNG.LETZTE_VERWALTUNG);
    assert.equal((letzte as { feld?: string }).feld, "user_id");
    assert.equal((await admin.from("verein_verwaltung").select("user_id").eq("verein_id", verein)).data!.length, 1);
    // Netz: Auch per Admin bleibt die letzte Person (Trigger).
    const netz = await admin.from("verein_verwaltung").delete().eq("verein_id", verein).eq("user_id", verwaltung.id);
    assert.match(netz.error?.message ?? "", /LETZTE_VERWALTUNG/);
    assert.equal(ausDbFehler(netz.error!).meldung, VEREIN_MELDUNG.LETZTE_VERWALTUNG);
  });

  await pruefe("Verein: Spieler:in aus einem Team nehmen durch die Verwaltung, auch ohne Mitgliedschaft (#579 AK 11, 17)", async () => {
    const team = await serienTeam("Kern-DB-581-Heraus");
    const zweites = await serienTeam("Kern-DB-581-Heraus-2");
    const lena = (await neuerSpieler(team, "Lena")).spielerId;
    wert(await ordneSpielerZu(verwaltung.supabase, verwaltung.id, { teamId: zweites, teamName: "Kern-DB-581-Heraus-2", spielerIds: [lena] }));
    fehler(await nimmSpielerAusTeamImVerein(a.supabase, a.id, { teamId: team, spielerId: lena }), "nicht_gefunden", NG_TEAM);
    assert.deepEqual(wert(await nimmSpielerAusTeamImVerein(verwaltung.supabase, verwaltung.id, { teamId: team, spielerId: lena })), { ohneTeam: false });
    assert.deepEqual(wert(await nimmSpielerAusTeamImVerein(verwaltung.supabase, verwaltung.id, { teamId: zweites, spielerId: lena })), { ohneTeam: true });
    fehler(await nimmSpielerAusTeamImVerein(verwaltung.supabase, verwaltung.id, { teamId: zweites, spielerId: lena }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    fehler(await nimmSpielerAusTeamImVerein(verwaltung.supabase, verwaltung.id, { teamId: zweites, spielerId: "kein-uuid" }), "nicht_gefunden", SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN);
    assert.equal((await admin.from("spieler").select("id").eq("id", lena)).data!.length, 1, "bleibt im Verein");
  });

  await pruefe("Verein: Ansichten für Mitglied und Verwaltung — wer was sieht (#581 AK 1–10, 25)", async () => {
    const mitA = await serienTeam("Kern-DB-581-Ansicht-A");
    const ohneA = await neuesTeam("Kern-DB-581-Ansicht-B");
    await admin.from("team_members").insert({ team_id: ohneA, user_id: b.id });
    await admin.from("team_members").insert({ team_id: ohneA, user_id: a.id });
    const leer = await neuesTeam("Kern-DB-581-Ansicht-C");
    const lena = (await neuerSpieler(mitA, "Lena")).spielerId;
    const mia = (await neuerSpieler(mitA, "Mia")).spielerId;
    await admin.from("team_spieler").insert({ team_id: ohneA, spieler_id: lena, verein_id: verein });
    await admin.from("team_spieler").update({ probe_seit: new Date().toISOString() }).eq("team_id", mitA).eq("spieler_id", mia);
    assert.equal((await admin.from("training_termine").insert({ team_id: mitA, datum: tagCh(3), beginn: "18:00", ende: "19:00" })).error, null);
    wert(await legeTerminFest(a.supabase, a.id, { art: "spiel", bezeichnung: "Cup", teamId: mitA, datum: tagCh(4), beginn: "10:00", ende: "11:00", eingeladene: [], verantwortlich: a.id }));
    await neuerKader(mitA, "S1");
    const zweite = await wegwerfKonto();
    await admin.from("verein_verwaltung").insert({ verein_id: verein, user_id: zweite.id });
    await admin.from("profiles").upsert({ user_id: zweite.id, display_name: "Zweite Verwaltung" });
    try {
      const unsere = (ts: { id: string }[]) => ts.filter((t) => [mitA, ohneA, leer].includes(t.id));
      // AK 1, 8, 9: Ein Mitglied sieht Vereinsname, Anzeigenamen der Verwaltung und nur die Namen der Teams.
      const m = wert(await ladeVereinAnsicht(b.supabase, b.id, { vereinId: verein }));
      assert.equal(m.name, "Kern-DB");
      assert.deepEqual(m.verwaltung, [
        { anzeigeName: "Zweite Verwaltung", ich: false },
        { anzeigeName: null, ich: false },
      ], "AK 9: nur Anzeigenamen (ohne Anzeigenamen null), nie Adresse oder Kennung");
      assert.deepEqual(unsere(m.teams), [
        { id: mitA, name: "Kern-DB-581-Ansicht-A", istMitglied: false },
        { id: ohneA, name: "Kern-DB-581-Ansicht-B", istMitglied: true },
        { id: leer, name: "Kern-DB-581-Ansicht-C", istMitglied: false },
      ], "AK 8: von Teams nur Name und Mitgliedschaft");
      // AK 3–7: Die Verwaltung erkennt sich, sieht Adressen, Trainer:innen, Spielerzahl, Teams ohne Mitglied.
      const v = wert(await ladeVereinAnsicht(verwaltung.supabase, verwaltung.id, { vereinId: verein }));
      assert.deepEqual(
        v.verwaltung.map((p) => [p.anzeigeName, p.ich, p.userId, p.email]),
        [["Zweite Verwaltung", false, zweite.id, await emailVon(zweite)], [null, true, verwaltung.id, await emailVon(verwaltung)]],
        "AK 3, 6; sortiert nach Anzeigenamen, ohne zuletzt",
      );
      const [ta, tb, tc] = unsere(v.teams) as typeof v.teams;
      assert.deepEqual(ta.trainer!.map((t) => [t.userId, t.email, t.istVerwaltung]), [[a.id, await emailVon(a), false]], "AK 4");
      assert.deepEqual(tb.trainer!.map((t) => t.userId), [b.id, a.id], "Trainer:innen in der Reihenfolge der Aufnahme (created_at, user_id)");
      assert.deepEqual([ta.spielerZahl, tb.spielerZahl, tc.spielerZahl], [2, 1, 0], "AK 5: samt Schnuppernden");
      assert.deepEqual([ta.ohneMitglied, tb.ohneMitglied, tc.ohneMitglied], [false, false, true], "AK 7");
      // AK 10, 25: Die Teamansicht der Verwaltung — auch ohne Mitgliedschaft, nie J+S-Nummer oder Link.
      const t = wert(await ladeVereinTeamAnsicht(verwaltung.supabase, verwaltung.id, { teamId: mitA }));
      assert.deepEqual([t.name, t.spielerZahl, t.ichMitglied], ["Kern-DB-581-Ansicht-A", 2, false]);
      assert.deepEqual(t.trainer, [{ userId: a.id, anzeigeName: t.trainer[0].anzeigeName, email: await emailVon(a), istVerwaltung: false, ich: false }]);
      assert.deepEqual(t.spieler.map((s) => [s.vorname, s.jahrgang, s.schnuppert, s.teams.map((x) => x.name)]), [
        ["Lena", 2017, false, ["Kern-DB-581-Ansicht-A", "Kern-DB-581-Ansicht-B"]],
        ["Mia", 2017, true, ["Kern-DB-581-Ansicht-A"]],
      ]);
      assert.deepEqual(Object.keys(t.spieler[0]).sort(), ["id", "jahrgang", "nachname", "schnuppert", "teams", "vorname"], "AK 10: keine J+S-Nummer, kein Link");
      assert.deepEqual(t.aufloesung, { trainings: 0, termine: 1, spiele: 1, kader: 1 }, "AK 25");
      // Mitglied, fremde Verwaltung und Konto ohne Verein: nicht gefunden.
      fehler(await ladeVereinTeamAnsicht(a.supabase, a.id, { teamId: mitA }), "nicht_gefunden", NG_TEAM);
      const fremd = await fremdeVerwaltung();
      fehler(await ladeVereinTeamAnsicht(fremd.supabase, fremd.id, { teamId: mitA }), "nicht_gefunden", NG_TEAM);
      fehler(await ladeVereinAnsicht(fremd.supabase, fremd.id, { vereinId: verein }), "nicht_gefunden", NG_VEREIN);
      const ohne = await wegwerfKonto();
      fehler(await ladeVereinAnsicht(ohne.supabase, ohne.id, { vereinId: verein }), "nicht_gefunden", NG_VEREIN);
      fehler(await ladeVereinAnsicht(ohne.supabase, ohne.id, { vereinId: "kein-uuid" }), "nicht_gefunden", NG_VEREIN);
    } finally {
      await admin.from("verein_verwaltung").delete().eq("verein_id", verein).eq("user_id", zweite.id);
    }
  });

  // ── Spielerbestand der Verwaltung (Story #582) ───────────────────────────
  // Jede Antwort der Datenebene wird im Verein-Kern zu Ergebnis und Satz.
  // Altdubletten (gleicher Schlüssel im Verein, aus der Zeit vor #578)
  // entstehen hier über einen Vereinswechsel per Admin: Der Trigger
  // `spieler_vorher` prüft nur Einfügen und Namensänderungen.
  const VEREIN_NAME = "Kern-DB";
  const EINS = "Kern-DB-582-Eins";
  const ZWEI = "Kern-DB-582-Zwei";
  const NG_SPIELER = SPIELER_MELDUNG.SPIELER_NICHT_GEFUNDEN;
  const erfassen = (k: Konto, e: { vorname: string; nachname: string; jahrgang: number | string; jsNummer?: string | null }, vereinId = verein) =>
    legeSpielerImVereinAn(k.supabase, k.id, { vereinId, vereinName: VEREIN_NAME, ...e });
  const aendern = (k: Konto, spielerId: string, e: { vorname: string; nachname: string; jahrgang: number | string; jsNummer?: string | null }) =>
    aendereSpielerImVerein(k.supabase, k.id, { spielerId, ...e });
  /** Eine Spieler:in mit dem Schlüssel einer bestehenden, ohne Team: im
   *  fremden Verein angelegt und per Admin herübergeholt. */
  const altdublette = async (vorname: string, nachname: string, jahrgang: number) => {
    const fremd = await fremdeVerwaltung();
    const fremdVerein = (await admin.from("verein_verwaltung").select("verein_id").eq("user_id", fremd.id).single()).data!.verein_id as string;
    const id = wert(await erfassen(fremd, { vorname, nachname, jahrgang }, fremdVerein)).spielerId;
    assert.equal((await admin.from("spieler").update({ verein_id: verein }).eq("id", id)).error, null);
    return id;
  };
  /** Zwei Teams; Sina steht in beiden, Xaver ohne Team. */
  const bestand582 = async () => {
    const eins = await serienTeam(EINS);
    const zwei = await serienTeam(ZWEI);
    const sina = (await neuerSpieler(eins, "Sina", "Beide", 2014)).spielerId;
    wert(await ordneSpielerZu(verwaltung.supabase, verwaltung.id, { teamId: zwei, teamName: ZWEI, spielerIds: [sina] }));
    const xaver = wert(await erfassen(verwaltung, { vorname: "  Xaver ", nachname: "Ohne", jahrgang: "2016", jsNummer: " 77 " })).spielerId;
    return { eins, zwei, sina, xaver };
  };

  await pruefe("Verein: Spieler:in erfassen ohne Team — angelegt, doppelt mit Teams, ohne Team, Mischfall, ungültig, ohne Recht (#582 AK 3, 4, 6)", async () => {
    const { eins, xaver } = await bestand582();
    // AK 3: ohne Team im Verein, bereinigt gespeichert, J+S getrimmt.
    const zeile = (await admin.from("spieler").select("verein_id, team_id, vorname, nachname, jahrgang, js_nummer, link_bezogen").eq("id", xaver).single()).data!;
    assert.deepEqual(zeile, { verein_id: verein, team_id: null, vorname: "Xaver", nachname: "Ohne", jahrgang: 2016, js_nummer: "77", link_bezogen: false });
    assert.equal((await admin.from("team_spieler").select("team_id").eq("spieler_id", xaver)).data!.length, 0, "keinem Team zugeordnet");
    const anzahl = async () => (await admin.from("spieler").select("id", { count: "exact", head: true }).eq("verein_id", verein)).count;
    const vorher = await anzahl();
    // AK 4: doppelt — mit Teams, ohne Team, Mischfall (Altdublette: nur die Teams); Schreibvarianten zählen als gleich.
    const doppelt = fehler(await erfassen(verwaltung, { vorname: "sina ", nachname: "BEIDE", jahrgang: 2014 }), "regel",
      `sina BEIDE (2014) wird im ${VEREIN_NAME} schon im Team «${EINS}» und «${ZWEI}» geführt. Ordne die vorhandene Spieler:in selbst einem Team zu. Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.`);
    assert.equal((doppelt as { feld?: string }).feld, "vorname");
    fehler(await erfassen(verwaltung, { vorname: "Xaver", nachname: "Ohne", jahrgang: 2016 }), "regel",
      `Xaver Ohne (2016) wird im ${VEREIN_NAME} schon geführt, ist aber keinem Team zugeordnet. Ordne die vorhandene Spieler:in selbst einem Team zu. Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.`);
    await neuerSpieler(eins, "Lea", "Dublette", 2017);
    await altdublette("Lea", "Dublette", 2017);
    fehler(await erfassen(verwaltung, { vorname: "Lea", nachname: "Dublette", jahrgang: 2017 }), "regel",
      `Lea Dublette (2017) wird im ${VEREIN_NAME} schon im Team «${EINS}» geführt. Ordne die vorhandene Spieler:in selbst einem Team zu. Ist es eine andere Spieler:in, unterscheide sie mit einem Zusatz im Vornamen.`);
    assert.equal(await anzahl(), vorher! + 2, "eine Abweisung hinterlässt nichts (dazu kamen nur Lea und ihre Altdublette)");
    // Ungültige Angaben: der Satz am Feld, bevor die Datenebene sie sieht.
    const amFeld = (r: { ok: boolean; feld?: string }, feld: string) => assert.equal((r as { feld?: string }).feld, feld);
    amFeld(fehler(await erfassen(verwaltung, { vorname: "  ", nachname: "Leer", jahrgang: 2015 }), "eingabe", SPIELER_TEXT.vorname), "vorname");
    amFeld(fehler(await erfassen(verwaltung, { vorname: "Leer", nachname: "x".repeat(61), jahrgang: 2015 }), "eingabe", SPIELER_TEXT.nachname), "nachname");
    amFeld(fehler(await erfassen(verwaltung, { vorname: "Alt", nachname: "Alt", jahrgang: "999" }), "eingabe", SPIELER_TEXT.jahrgang), "jahrgang");
    amFeld(fehler(await erfassen(verwaltung, { vorname: "Lang", nachname: "Js", jahrgang: 2015, jsNummer: "1".repeat(21) }), "eingabe", SPIELER_TEXT.jsNummer), "js_nummer");
    // Wer den Kern umgeht, bekommt von der Datenebene 23514 — auch das wird ein Satz, keine Rohmeldung.
    const roh = await verwaltung.supabase.rpc("verein_spieler_anlegen", { p_verein: verein, p_vorname: "  ", p_nachname: "Leer", p_jahrgang: 2015, p_js: null });
    assert.equal(roh.error?.code, "23514");
    assert.equal(ausDbFehler(roh.error!).meldung, SPIELER_TEXT.vorname);
    const rohJs = await verwaltung.supabase.rpc("verein_spieler_anlegen", { p_verein: verein, p_vorname: "Js", p_nachname: "Leer", p_jahrgang: 2015, p_js: "   " });
    assert.equal(rohJs.data?.status, "angelegt", "eine leere J+S-Nummer ist keine");
    assert.equal((await admin.from("spieler").select("js_nummer").eq("id", rohJs.data.id).single()).data!.js_nummer, null);
    assert.equal(await anzahl(), vorher! + 3);
    // Ohne Recht: ein Mitglied, eine fremde Verwaltung, keine Kennung — «Verein nicht gefunden.» am Feld verein_id.
    const fremd = await fremdeVerwaltung();
    for (const k of [a, fremd])
      amFeld(fehler(await erfassen(k, { vorname: "Ohne", nachname: "Recht", jahrgang: 2015 }), "nicht_gefunden", NG_VEREIN), "verein_id");
    fehler(await erfassen(verwaltung, { vorname: "Ohne", nachname: "Recht", jahrgang: 2015 }, "kein-uuid"), "nicht_gefunden", NG_VEREIN);
    assert.equal(await anzahl(), vorher! + 3, "ohne Recht nichts angelegt");
  });

  await pruefe("Verein: Spieler:in ändern ohne Mitgliedschaft — geändert, J+S leeren, doppelt, Altdublette bleibt änderbar, nicht gefunden (#582 AK 2, 5, 15)", async () => {
    const { eins, sina, xaver } = await bestand582();
    // AK 2: samt J+S; der Name wirkt am Team-Ort.
    assert.deepEqual(wert(await aendern(verwaltung, sina, { vorname: " Sina  Maria ", nachname: "Beide", jahrgang: 2014, jsNummer: "4711" })), { spielerId: sina });
    const zeile = async (id: string) => (await admin.from("spieler").select("vorname, nachname, jahrgang, js_nummer").eq("id", id).single()).data!;
    assert.deepEqual(await zeile(sina), { vorname: "Sina Maria", nachname: "Beide", jahrgang: 2014, js_nummer: "4711" });
    assert.ok(wert(await ladeSpielerliste(a.supabase, a.id, { teamId: eins })).spieler.some((s) => s.vorname === "Sina Maria"), "der Name wirkt am Team-Ort");
    // Ein leeres Feld leert die J+S-Nummer (p_js null).
    wert(await aendern(verwaltung, sina, { vorname: "Sina Maria", nachname: "Beide", jahrgang: 2014, jsNummer: "" }));
    assert.equal((await zeile(sina)).js_nummer, null);
    // AK 5: doppelt — mit Teams, ohne Team; nichts geschrieben.
    fehler(await aendern(verwaltung, xaver, { vorname: "sina maria", nachname: "Beide", jahrgang: 2014 }), "regel",
      `Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «${EINS}» und «${ZWEI}».`);
    fehler(await aendern(verwaltung, sina, { vorname: "Xaver", nachname: "Ohne", jahrgang: 2016 }), "regel",
      "Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, die keinem Team zugeordnet ist.");
    assert.deepEqual(await zeile(xaver), { vorname: "Xaver", nachname: "Ohne", jahrgang: 2016, js_nummer: "77" }, "abgewiesen: unverändert");
    // Altdublette: Mischfall nennt nur die Teams; mit gleichem Schlüssel bleibt jede änderbar, auch in anderer Schreibung.
    const lea = (await neuerSpieler(eins, "Lea", "Dublette", 2017)).spielerId;
    const lea2 = await altdublette("Lea", "Dublette", 2017);
    fehler(await aendern(verwaltung, xaver, { vorname: "Lea", nachname: "Dublette", jahrgang: 2017 }), "regel",
      `Im Verein wird schon eine andere Spieler:in mit diesen Angaben geführt, im Team «${EINS}».`);
    wert(await aendern(verwaltung, lea, { vorname: " lea ", nachname: "DUBLETTE", jahrgang: 2017, jsNummer: "55" }));
    wert(await aendern(verwaltung, lea2, { vorname: "Lea", nachname: "Dublette", jahrgang: 2017, jsNummer: "56" }));
    assert.deepEqual([(await zeile(lea)).js_nummer, (await zeile(lea2)).js_nummer], ["55", "56"]);
    // Ungültig: am Feld, vor der Datenebene.
    fehler(await aendern(verwaltung, sina, { vorname: "Sina", nachname: "Beide", jahrgang: "20" }), "eingabe", SPIELER_TEXT.jahrgang);
    // AK 15: ohne Recht, unbekannt, fremd, keine Kennung — ununterscheidbar am Feld spieler_id.
    const fremd = await fremdeVerwaltung();
    const fremdVerein = (await admin.from("verein_verwaltung").select("verein_id").eq("user_id", fremd.id).single()).data!.verein_id as string;
    const fremde = wert(await erfassen(fremd, { vorname: "Fremde", nachname: "Spielerin", jahrgang: 2015 }, fremdVerein)).spielerId;
    for (const [k, id] of [[a, sina], [b, xaver], [fremd, sina], [verwaltung, fremde], [verwaltung, randomUUID()], [verwaltung, "kein-uuid"]] as [Konto, string][]) {
      const r = fehler(await aendern(k, id, { vorname: "Neu", nachname: "Name", jahrgang: 2015 }), "nicht_gefunden", NG_SPIELER);
      assert.equal((r as { feld?: string }).feld, "spieler_id");
    }
    assert.equal((await zeile(sina)).vorname, "Sina Maria", "nichts geändert");
    assert.equal((await admin.from("spieler").select("vorname").eq("id", fremde).single()).data!.vorname, "Fremde");
  });

  await pruefe("Verein: Teams lesen und Spieler:in löschen — Teams in der Antwort, danach überall nicht gefunden, nur durch die Verwaltung (#582 AK 12, 13, 15; #579 AK 12, 14)", async () => {
    const { eins, zwei, sina, xaver } = await bestand582();
    // AK 13: die Teams frisch, nach Name; ohne Team leer.
    assert.deepEqual(wert(await ladeSpielerTeamsImVerein(verwaltung.supabase, verwaltung.id, { spielerId: sina })).teams, [{ id: eins, name: EINS }, { id: zwei, name: ZWEI }]);
    assert.deepEqual(wert(await ladeSpielerTeamsImVerein(verwaltung.supabase, verwaltung.id, { spielerId: xaver })).teams, []);
    // Ohne Recht: weder lesen noch löschen; die Spieler:in bleibt.
    const fremd = await fremdeVerwaltung();
    for (const k of [a, b, fremd]) {
      fehler(await ladeSpielerTeamsImVerein(k.supabase, k.id, { spielerId: sina }), "nicht_gefunden", NG_SPIELER);
      fehler(await loescheSpielerImVerein(k.supabase, k.id, { spielerId: sina }), "nicht_gefunden", NG_SPIELER);
    }
    fehler(await loescheSpielerImVerein(verwaltung.supabase, verwaltung.id, { spielerId: "kein-uuid" }), "nicht_gefunden", NG_SPIELER);
    fehler(await loescheSpielerImVerein(verwaltung.supabase, verwaltung.id, { spielerId: randomUUID() }), "nicht_gefunden", NG_SPIELER);
    assert.equal((await admin.from("spieler").select("id").eq("id", sina)).data!.length, 1, "ohne Recht nicht gelöscht");
    // AK 12: mit Teams gelöscht — die Antwort nennt sie für die Revalidierung; aus jedem Team und dem Bestand weg.
    assert.deepEqual(wert(await loescheSpielerImVerein(verwaltung.supabase, verwaltung.id, { spielerId: sina })), { teams: [{ id: eins, name: EINS }, { id: zwei, name: ZWEI }] });
    assert.equal((await admin.from("team_spieler").select("team_id").eq("spieler_id", sina)).data!.length, 0);
    assert.ok(!wert(await ladeSpielerliste(a.supabase, a.id, { teamId: eins })).spieler.some((s) => s.id === sina), "nicht mehr am Team-Ort");
    assert.ok(!wert(await ladeVereinSpielerliste(verwaltung.supabase, verwaltung.id, { vereinId: verein })).spieler.some((s) => s.id === sina));
    // Ohne Team gelöscht: keine Teams.
    assert.deepEqual(wert(await loescheSpielerImVerein(verwaltung.supabase, verwaltung.id, { spielerId: xaver })), { teams: [] });
    // AK 15: danach nicht gefunden — an jedem Weg, am Feld spieler_id (der Dialog lädt die Liste neu).
    const k = verwaltung;
    for (const r of [
      await ladeSpielerTeamsImVerein(k.supabase, k.id, { spielerId: sina }),
      await loescheSpielerImVerein(k.supabase, k.id, { spielerId: sina }),
      await aendern(k, sina, { vorname: "Sina", nachname: "Beide", jahrgang: 2014 }),
      await holeSpielerLinkImVerein(k.supabase, k.id, { spielerId: sina }),
      await erneuereSpielerLinkImVerein(k.supabase, k.id, { spielerId: xaver }),
    ]) assert.equal((fehler(r, "nicht_gefunden", NG_SPIELER) as { feld?: string }).feld, "spieler_id");
    fehler(await ordneSpielerZu(k.supabase, k.id, { teamId: eins, teamName: EINS, spielerIds: [xaver] }), "nicht_gefunden", NG_SPIELER);
  });

  await pruefe("Verein: privater Link holen und erneuern, Liste mit J+S und Link-Stand, Zahlen nur für die Verwaltung (#582 AK 1, 8–11; A1.2)", async () => {
    const { sina, xaver } = await bestand582();
    const tokenVon = async (id: string) => (await admin.from("spieler").select("link_token, link_bezogen").eq("id", id).single()).data!;
    // AK 9, 10: der Link, auch ohne Team; `ohneTeam` und `bezogen` aus der Datenebene.
    const x = wert(await holeSpielerLinkImVerein(verwaltung.supabase, verwaltung.id, { spielerId: xaver }));
    assert.deepEqual(x, { token: (await tokenVon(xaver)).link_token, ohneTeam: true, bezogen: false });
    assert.equal((await admin.from("spieler").update({ link_bezogen: true }).eq("id", sina)).error, null);
    const s = wert(await holeSpielerLinkImVerein(verwaltung.supabase, verwaltung.id, { spielerId: sina }));
    assert.deepEqual([s.ohneTeam, s.bezogen], [false, true]);
    // AK 1, 8: die Liste mit J+S und dem Stand, nie dem Link.
    const liste = wert(await ladeVereinSpielerliste(verwaltung.supabase, verwaltung.id, { vereinId: verein })).spieler;
    const zeile = (id: string) => liste.find((z) => z.id === id)!;
    assert.deepEqual([zeile(xaver).js, zeile(xaver).linkBezogen, zeile(xaver).teams], ["77", false, []]);
    assert.deepEqual([zeile(sina).js, zeile(sina).linkBezogen, zeile(sina).teams.map((t) => t.name)], [null, true, [EINS, ZWEI]]);
    assert.deepEqual(Object.keys(zeile(sina)).sort(), ["id", "jahrgang", "js", "linkBezogen", "nachname", "teams", "vorname"], "kein Link in der Liste");
    // AK 11: erneuern — der bisherige gilt nicht mehr, «bezogen» fällt zurück, auch mit Teams.
    const alt = s.token;
    const neu = wert(await erneuereSpielerLinkImVerein(verwaltung.supabase, verwaltung.id, { spielerId: sina })).token;
    assert.notEqual(neu, alt);
    assert.deepEqual(await tokenVon(sina), { link_token: neu, link_bezogen: false });
    assert.deepEqual((await feldAnon.rpc("spieler_link_ansicht", { p_token: alt })).data, { gueltig: false }, "der bisherige Link endet sofort");
    assert.equal((await feldAnon.rpc("spieler_link_ansicht", { p_token: neu })).data.gueltig, true);
    const neuX = wert(await erneuereSpielerLinkImVerein(verwaltung.supabase, verwaltung.id, { spielerId: xaver })).token;
    assert.equal((await tokenVon(xaver)).link_token, neuX, "auch ohne Team");
    // Ohne Recht: kein Link, kein Erneuern.
    const fremd = await fremdeVerwaltung();
    for (const k of [a, b, fremd]) {
      fehler(await holeSpielerLinkImVerein(k.supabase, k.id, { spielerId: sina }), "nicht_gefunden", NG_SPIELER);
      fehler(await erneuereSpielerLinkImVerein(k.supabase, k.id, { spielerId: sina }), "nicht_gefunden", NG_SPIELER);
    }
    assert.equal((await tokenVon(sina)).link_token, neu, "ohne Recht nicht erneuert");
    // A1.2: Zahl aller und ohne Team — nur die Verwaltung bekommt sie.
    const alle = (await admin.from("spieler").select("id", { count: "exact", head: true }).eq("verein_id", verein)).count!;
    const mitTeam = new Set((await admin.from("team_spieler").select("spieler_id").eq("verein_id", verein)).data!.map((z) => z.spieler_id)).size;
    const v = wert(await ladeVereinAnsicht(verwaltung.supabase, verwaltung.id, { vereinId: verein }));
    assert.deepEqual([v.spielerZahl, v.spielerOhneTeam], [alle, alle - mitTeam]);
    assert.ok(v.spielerOhneTeam! >= 1, "Xaver zählt ohne Team");
    const m = wert(await ladeVereinAnsicht(a.supabase, a.id, { vereinId: verein }));
    assert.ok(!("spielerZahl" in m) && !("spielerOhneTeam" in m), "ein Mitglied bekommt keine Zahlen");
  });

  await pruefe("Verein: Eine Spieler:in ohne Team erreicht kein Team-Weg; Verwaltung und Mitglied zugleich löscht nur im Verein (#582 AK 14; Review Focus 4)", async () => {
    const { eins, sina, xaver } = await bestand582();
    const beides = await wegwerfKonto();
    await admin.from("verein_verwaltung").insert({ verein_id: verein, user_id: beides.id });
    await admin.from("team_members").insert({ team_id: eins, user_id: beides.id });
    try {
      for (const k of [a, beides]) {
        // Die Team-Spielerliste kennt sie nicht, kein Team-Weg erreicht sie.
        assert.ok(!wert(await ladeSpielerliste(k.supabase, k.id, { teamId: eins })).spieler.some((s) => s.id === xaver));
        fehler(await aendereSpieler(k.supabase, k.id, { teamId: eins, spielerId: xaver, vorname: "Neu", nachname: "Name", jahrgang: 2015 }), "nicht_gefunden", NG_SPIELER);
        fehler(await holeSpielerLink(k.supabase, k.id, { spielerId: xaver }), "nicht_gefunden", NG_SPIELER);
        fehler(await erneuereSpielerLink(k.supabase, k.id, { spielerId: xaver }), "nicht_gefunden", NG_SPIELER);
        fehler(await nimmHeraus(k, eins, xaver), "nicht_gefunden", NG_SPIELER);
        fehler(await ladeSpieler(k.supabase, xaver), "nicht_gefunden", NG_SPIELER);
        fehler(await eigenesTeamVon(k.supabase, xaver), "nicht_gefunden");
      }
      // Der Team-Kern hat keinen Weg zum Löschen; die Verwaltung löscht im Verein-Kern, auch als Mitglied.
      const teamKern = await import("../lib/kern/spieler");
      assert.deepEqual(Object.keys(teamKern).filter((n) => /l(oe|ö)sch|entfern/i.test(n)), [], "kein Löschen am Team-Ort");
      wert(await aendereSpieler(beides.supabase, beides.id, { teamId: eins, spielerId: sina, vorname: "Sina", nachname: "Beide", jahrgang: 2014 }));
      assert.deepEqual(wert(await loescheSpielerImVerein(beides.supabase, beides.id, { spielerId: xaver })), { teams: [] });
      assert.equal((await admin.from("spieler").select("id").eq("id", xaver)).data!.length, 0);
    } finally {
      await admin.from("verein_verwaltung").delete().eq("verein_id", verein).eq("user_id", beides.id);
    }
  });

  await pruefe("Konto löschen: die letzte Verwaltung bekommt den Status, nichts ist gelöscht (#577)", async () => {
    const training = wert(await legeTrainingAn(verwaltung.supabase, verwaltung.id, { name: "Kern-DB-Verwaltung", altersstufe: "kinderfussball", stufen: ["F"] })).id;
    const { data, error } = await verwaltung.supabase.rpc("delete_account");
    assert.equal(error, null);
    assert.deepEqual(data, { status: "letzte_verwaltung" });
    assert.equal((await admin.from("verein_verwaltung").select("user_id").eq("verein_id", verein)).data!.length, 1, "Verwaltung bleibt");
    assert.equal((await admin.from("trainings").select("id").eq("id", training)).data!.length, 1, "Training bleibt");
    assert.equal((await admin.auth.admin.getUserById(verwaltung.id)).error, null, "Konto bleibt");
  });

  await pruefe("Lesepfade über die Zuordnung: Spielerliste, Anzahl, Termin, Spiel und Schnuppern über team_spieler, nicht über spieler.team_id (#577; #579)", async () => {
    const k = await probeTeam("Kern-DB-Zuordnung");
    const s1 = await neuerKader(k.team, "S1");
    wert(await aendereZuteilung(a.supabase, a.id, { teamId: k.team, spielerIds: [k.lena], dazu: [s1] }));
    wert(await schalteProbe(a.supabase, a.id, { spielerId: k.mia, probe: true }));
    // Ella steht zuerst in einem anderen Team, dann ordnet die Verwaltung sie
    // zu (#579): `spieler.team_id` nennt ihr erstes Team (Entscheid A.1), die
    // Lesepfade folgen den Zuordnungen.
    const anderes = await serienTeam("Kern-DB-Zuordnung-Anderes");
    const ella = (await neuerSpieler(anderes, "Ella")).spielerId;
    wert(await ordneSpielerZu(verwaltung.supabase, verwaltung.id, { teamId: k.team, teamName: "Kern-DB-Zuordnung", spielerIds: [ella] }));
    assert.equal((await admin.from("spieler").select("team_id").eq("id", ella).single()).data!.team_id, anderes, "die Spalte nennt das erste Team");
    const ueberSpalte = (await admin.from("spieler").select("id").eq("team_id", k.team)).data!.map((x) => x.id).sort();
    const ueberZuordnung = (await admin.from("team_spieler").select("spieler_id").eq("team_id", k.team)).data!.map((x) => x.spieler_id).sort();
    assert.deepEqual([ueberSpalte.length, ueberZuordnung.length], [3, 4]);
    const liste = wert(await ladeSpielerliste(a.supabase, a.id, { teamId: k.team })).spieler;
    assert.deepEqual(liste.map((x) => x.id).sort(), ueberZuordnung);
    assert.equal(await anzahlSpieler(a.supabase, k.team), ueberZuordnung.length);
    // Kader S1 gilt nur für Lena: die übrigen kommen aus der Zahl des Teams.
    const t = await k.training(7, [s1]);
    assert.deepEqual((({ gesamt, uebrige }) => ({ gesamt, uebrige }))(wert(await terminSpieler(a.supabase, a.id, { terminId: t }))), { gesamt: 1, uebrige: 3 });
    const spiel = wert(await k.spiel(7, { kaderIds: [s1] })).terminId;
    assert.equal(wert(await spielSpieler(a.supabase, a.id, { terminId: spiel })).uebrige, 3);
    // Schnuppern hängt an der Zuordnung; die Spalte der Spieler:in bleibt leer.
    assert.notEqual((await admin.from("team_spieler").select("probe_seit").eq("team_id", k.team).eq("spieler_id", k.mia).single()).data!.probe_seit, null);
    assert.equal((await admin.from("spieler").select("probe_seit").eq("id", k.mia).single()).data!.probe_seit, null);
    assert.deepEqual(liste.find((x) => x.id === k.mia)!.probe, { anzahl: 2, besucht: 0, angemeldet: 0, moeglich: 2 });
    assert.equal(liste.filter((x) => x.probe).length, 1);
  });

} finally {
  const fehler = await aufraeumen();
  for (const f of fehler) console.error(`[aufräumen] ${f}`);
  // Nach einem Prüffehler wirft der try-Block ohnehin weiter; sonst lässt ein
  // misslungenes Aufräumen den Lauf scheitern.
  if (fehler.length) process.exitCode = 1;
}

if (process.exitCode) throw new Error("Aufräumen unvollständig (siehe oben).");
console.log(`\n${gelaufen} Prüfungen bestanden (Wegwerf-Konten entfernt).`);
