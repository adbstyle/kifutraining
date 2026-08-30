// Formular-Auswertung für Übungsinhalte — geteilt zwischen den Server Actions
// der Bibliotheks-Übung und der Fassung im Training (Epic #72, Story 5 NFR 1).
// Bewusst KEIN "use server"-Modul: hier stehen reine Validierungsregeln, keine
// Mutationen. (Ein Server-Actions-Modul darf ausserdem nur async Funktionen
// exportieren.)
import {
  FAHRPLAN_NUR_OFFEN,
  ERSCHEINUNGSFORM_TEILE,
  FREIES_SPIEL,
  brauchtFahrplan,
  brauchtFahrplanFuerFassung,
} from "@/lib/labels";
import {
  trainingsteilSlugs,
  junioren_heimatSlugs,
  feldtypSlugs,
  uebungstypSlugs,
  hauptteilkategorieSlugs,
} from "@/lib/vocab";
import {
  erscheinungsformenFuer,
  kategorienFuer,
  type Altersstufe,
} from "@/lib/altersstufe";

function lines(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

/** Komma-getrennte Mehrfachwerte (Chips schreiben ein einzelnes Hidden-Feld). */
function csv(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}


export type ParseResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

/** Formular -> inhaltliche Übungsfelder + Validierung.
 *
 *  Genutzt vom Erstellen und Bearbeiten einer Bibliotheks-Übung UND vom
 *  Bearbeiten einer Fassung im Training: beide tragen dieselben Inhaltsfelder
 *  und müssen denselben Regeln genügen (Story 5 NFR 1). Nicht enthalten sind
 *  Bibliotheks-Belange (slug, source, owner_id, visibility) und das Bild. */
export function parseUebungsInhalt(
  form: FormData,
  opts: {
    /** Die Altersstufe, der die Übung bzw. ihr Training angehört. Sie
     *  entscheidet über die zulässigen Alterskategorien und
     *  Erscheinungsformen (Story 1, Epic Übungswelten). Sie kommt NIE aus dem
     *  Formular: bei einer Bibliotheks-Übung ist sie gespeichert bzw. folgt
     *  aus der gewählten Heimat, bei einer Fassung aus ihrem Training. */
    altersstufe: Altersstufe;
    /** Zulässige Einordnungen. Für eine Bibliotheks-Übung sind das die Heimaten
     *  (vier Kinderfussball-Teile und die drei Einstiegs-Unterblöcke); für eine
     *  Fassung im Training die Blöcke ihres Schemas — dort kann sie auch in
     *  `jun-spielformen` oder in der Nacharbeit liegen, was nie eine Heimat ist
     *  (Epic #71). Ohne Angabe gelten die Heimaten. */
    erlaubteEinordnungen?: readonly string[];
  },
): ParseResult {
  const { altersstufe, erlaubteEinordnungen } = opts;
  const errors: Record<string, string> = {};
  const name = clean(form.get("name"));
  const trainingsteil = clean(form.get("trainingsteil"));
  const kategorien = csv(form.get("kat"));

  if (!name) errors.name = "Bitte einen Namen angeben.";
  // Die Heimat ist entweder ein Kinderfussball-Trainingsteil oder einer der
  // drei Einstiegs-Unterblöcke des Juniorenschemas — nie beides, dafür sorgt
  // schon die Skalarität des Felds (Entscheidungsdokument §4).
  const zulaessig: readonly string[] =
    erlaubteEinordnungen ?? [...trainingsteilSlugs, ...junioren_heimatSlugs];
  if (!zulaessig.includes(trainingsteil))
    errors.trainingsteil = erlaubteEinordnungen
      ? "Bitte eine Einordnung wählen."
      : "Bitte eine Heimat wählen.";
  // Alterskategorien gehören zu genau einer Altersstufe (DB-Constraint
  // `ex_kategorien_je_altersstufe`): G–E zum Kinderfussball, D–A zum
  // Juniorenfussball. Eine Kategorie der anderen Altersstufe ist kein
  // Tippfehler, sondern die Frage nach dem falschen Lehrmittel — darum eine
  // eigene Meldung.
  const erlaubteKategorien = kategorienFuer(altersstufe);
  if (kategorien.length === 0)
    errors.kat = "Bitte mindestens eine Alterskategorie wählen.";
  else if (kategorien.some((k) => !erlaubteKategorien.includes(k)))
    errors.kat = "Diese Alterskategorie gehört nicht zur Altersstufe dieser Übung.";

  // Hauptteilkategorie ist genau bei Hauptteil-Übungen Pflicht (Enabler #21,
  // AC2); andere Trainingsteile tragen keine (Postcondition 2). Wird VOR dem
  // Ablauf ausgewertet, weil die Kategorie über dessen Form entscheidet.
  const istHauptteil = trainingsteil === "hauptteil";
  const hauptteilkategorie = istHauptteil ? clean(form.get("hauptteilkategorie")) : null;
  if (istHauptteil && !hauptteilkategorieSlugs.includes(hauptteilkategorie as never))
    errors.hauptteilkategorie = "Bitte eine Hauptteilkategorie wählen.";

  // Welche Ablauf-Form gilt? Bei den Kinderfussball-Teilen und den beiden
  // Fahrplan-Heimaten entscheidet die Einordnung. Bei den übrigen
  // Junioren-Blöcken — in denen eine Fassung liegen kann, ohne dass es eine
  // Heimat wäre — entscheidet der mitgelieferte Inhalt: eine aus einer
  // Hauptteil-Übung entstandene Fassung bringt ihren Fahrplan mit, eine aus
  // dem freien Spiel ihren Aufbau-Text.
  // Das Formular teilt mit, in welcher Form es den Ablauf erfasst hat. Ohne
  // die Angabe — etwa bei einem Aufruf ausserhalb des Formulars — wird sie aus
  // dem Inhalt abgeleitet.
  const angesagteForm = clean(form.get("ablauf_form"));
  const istFahrplan =
    angesagteForm === "fahrplan" || angesagteForm === "aufbau"
      ? angesagteForm === "fahrplan"
      : brauchtFahrplanFuerFassung(
          trainingsteil,
          hauptteilkategorie,
          clean(form.get("offen_starten")) !== "" ||
            lines(form.get("ueben")).length > 0 ||
            clean(form.get("wetteifern")) !== "",
        );
  const istFreiesSpiel = hauptteilkategorie === FREIES_SPIEL;
  let methodischer_fahrplan: Record<string, unknown> | null = null;
  let aufbau: string | null = null;

  if (istFahrplan) {
    const offen = clean(form.get("offen_starten"));
    const ueben = lines(form.get("ueben"));
    const wett = clean(form.get("wetteifern"));
    // Bei den Junioren-Heimaten genügt «Offen starten»; die übrigen Stufen
    // sind dort freiwillig (Story 5b AC 3/4).
    const nurOffen = FAHRPLAN_NUR_OFFEN.has(trainingsteil);
    if (!offen) errors.offen_starten = "Bitte beschreiben, wie die Übung offen startet.";
    if (!nurOffen && ueben.length === 0)
      errors.ueben = "Bitte mindestens einen Übungsschritt angeben.";
    if (!nurOffen && !wett) errors.wetteifern = "Bitte den Wett-eifern-Teil beschreiben.";
    methodischer_fahrplan = { offen_starten: offen, ueben, wetteifern: wett };
  } else if (trainingsteil) {
    aufbau = clean(form.get("aufbau"));
    if (!aufbau)
      errors.aufbau = istFreiesSpiel
        ? "Bitte das Spiel beschreiben."
        : "Bitte den Aufbau beschreiben.";
  }

  // Erscheinungsform bleibt an die Einordnung gebunden (DB-Constraint
  // `erscheinungsform_je_altersstufe`) — auch das freie Spiel darf eine
  // tragen, obwohl es keinen Fahrplan hat.
  // Welcher der beiden Kataloge gilt, entscheidet neu die Altersstufe: die
  // Manuals führen verschiedene Erscheinungsformen, und seit Story 1 hält die
  // Datenbank sie auseinander. Werte des anderen Katalogs fallen hier still
  // weg — wie jeder unbekannte Wert auch.
  const erlaubteFormen: readonly string[] = erscheinungsformenFuer(altersstufe);
  const erscheinungsform = ERSCHEINUNGSFORM_TEILE.has(trainingsteil)
    ? csv(form.get("form")).filter((f) => erlaubteFormen.includes(f))
    : [];

  const feldtyp = clean(form.get("feldtyp"));
  const min = clean(form.get("anzahl_min"));
  const max = clean(form.get("anzahl_max"));
  const anzahl_kinder =
    min || max
      ? { min: min ? Number(min) : null, max: max ? Number(max) : null }
      : null;
  if (min && max && Number(max) < Number(min))
    errors.anzahl_max = "Die Maximalanzahl darf nicht kleiner als die Mindestanzahl sein.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    row: {
      name,
      // Die Altersstufe gehört zum Inhalt: sie entscheidet, nach welchem
      // Lehrmittel die Zeile gelesen wird. An der Fassung im Training setzt
      // sie allerdings der DB-Trigger `te_altersstufe_erben` — dort wird
      // dieses Feld verworfen.
      altersstufe,
      trainingsteil,
      kategorien,
      feldtyp: feldtyp && feldtypSlugs.includes(feldtyp as never) ? feldtyp : null,
      erscheinungsform,
      hauptteilkategorie,
      anzahl_kinder,
      material: lines(form.get("material")),
      // Übungstyp: optionale Selbstauskunft, gegen nichts geprüft (Story 9
      // Out of Scope 1). Leerer Wert heisst «kein Typ».
      uebungstyp: uebungstypSlugs.includes(clean(form.get("uebungstyp")) as never)
        ? clean(form.get("uebungstyp"))
        : null,
      methodischer_fahrplan,
      aufbau,
      varianten: lines(form.get("varianten")),
    },
  };
}
