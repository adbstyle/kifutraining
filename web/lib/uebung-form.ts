// Formular-Auswertung für Übungsinhalte — geteilt zwischen den Server Actions
// der Bibliotheks-Übung und der Fassung im Training (Epic #72, Story 5 NFR 1).
// Bewusst KEIN "use server"-Modul: hier stehen reine Validierungsregeln, keine
// Mutationen. (Ein Server-Actions-Modul darf ausserdem nur async Funktionen
// exportieren.)
import { feldtypSlugs, uebungstypSlugs, hauptteilkategorieSlugs } from "@/lib/vocab";
import {
  FREIES_SPIEL,
  brauchtFahrplan,
  einordnungsSlugsFuer,
  erscheinungsformenFuer,
  kategorienFuer,
  traegtErscheinungsform,
  traegtFeldtyp,
  traegtHauptteilkategorie,
  traegtSpielfeldgroesse,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";

/** Kleinste und grösste sinnvolle Kantenlänge eines Spielfelds in Metern.
 *  Spiegelt die CHECKs `ex_spielfeld_bereich` / `te_spielfeld_bereich`.
 *
 *  Exportiert, damit das Eingabefeld dieselben Grenzen anbietet, die hier
 *  geprüft werden — sonst liefe das `min`/`max` des Formulars von der Regel
 *  weg, ohne dass es jemandem auffiele. */
export const SPIELFELD_MIN = 5;
export const SPIELFELD_MAX = 120;

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
 *  Bibliotheks-Belange (slug, source, owner_id, visibility) und das Bild.
 *
 *  Trust-Boundary: JEDES stufenabhängige Feld wird hier gegen die Altersstufe
 *  geprüft und andernfalls hart auf null bzw. `[]` gesetzt — auch wenn ein
 *  manipulierter POST es mitschickt (Story 1 AC 9, Story 2 PC 2/3, Story 3
 *  PC 1/2). Das Formular rendert dieselben Regeln, aber es entscheidet sie
 *  nicht. */
export function parseUebungsInhalt(
  form: FormData,
  opts: {
    /** Die Altersstufe, der die Übung bzw. ihr Training angehört. Sie
     *  entscheidet über sämtliche Wertebereiche und darüber, welche Felder es
     *  überhaupt gibt. Beim Erfassen wählt der Trainer sie (Story 3 AK 1);
     *  danach kommt sie NIE aus dem Formular — bei einer Bibliotheks-Übung ist
     *  sie gespeichert, bei einer Fassung folgt sie ihrem Training. */
    altersstufe: Altersstufe;
  },
): ParseResult {
  const { altersstufe } = opts;
  const errors: Record<string, string> = {};
  const name = clean(form.get("name"));
  const trainingsteil = clean(form.get("trainingsteil"));
  const kategorien = csv(form.get("kat"));

  if (!name) errors.name = "Bitte einen Namen angeben.";
  // Die Einordnung ist im Kinderfussball einer der vier Trainingsteile des
  // Manuals Fussball Kinder, im Juniorenfussball einer der sechs Blöcke des
  // Manuals Fussball Jugendliche — nie beides. Die Mengen sind
  // überschneidungsfrei, dafür sorgen die Slugs.
  if (!einordnungsSlugsFuer(altersstufe).includes(trainingsteil))
    errors.trainingsteil = "Bitte eine Einordnung wählen.";
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

  // Hauptteilkategorie: Pflicht im Kinderfussball-Hauptteil, sonst gar kein
  // Feld (Enabler #21 AC 2; Story 3 AK 11). Wird VOR dem Ablauf ausgewertet,
  // weil die Kategorie über dessen Form entscheidet.
  const traegtHkat = traegtHauptteilkategorie(altersstufe, trainingsteil);
  const hauptteilkategorie = traegtHkat ? clean(form.get("hauptteilkategorie")) : null;
  if (traegtHkat && !hauptteilkategorieSlugs.includes(hauptteilkategorie as never))
    errors.hauptteilkategorie = "Bitte eine Hauptteilkategorie wählen.";

  // Welche Ablauf-Form gilt, folgt allein aus Altersstufe und Einordnung — die
  // Antwort ist damit deterministisch, und das Formular muss sie dem Server
  // nicht mehr in einem Hidden-Feld ansagen. Im Juniorenfussball ist es immer
  // der zusammenhängende Beschreibungstext, und der ist Pflicht (Story 3 AK 7,
  // PC 3).
  const istFahrplan = brauchtFahrplan(altersstufe, trainingsteil, hauptteilkategorie);
  const istFreiesSpiel = hauptteilkategorie === FREIES_SPIEL;
  let methodischer_fahrplan: Record<string, unknown> | null = null;
  let aufbau: string | null = null;

  if (istFahrplan) {
    const offen = clean(form.get("offen_starten"));
    const ueben = lines(form.get("ueben"));
    const wett = clean(form.get("wetteifern"));
    if (!offen) errors.offen_starten = "Bitte beschreiben, wie die Übung offen startet.";
    if (ueben.length === 0) errors.ueben = "Bitte mindestens einen Übungsschritt angeben.";
    if (!wett) errors.wetteifern = "Bitte den Wett-eifern-Teil beschreiben.";
    methodischer_fahrplan = { offen_starten: offen, ueben, wetteifern: wett };
  } else if (trainingsteil) {
    aufbau = clean(form.get("aufbau"));
    if (!aufbau)
      errors.aufbau =
        altersstufe === "juniorenfussball"
          ? "Bitte den Ablauf beschreiben."
          : istFreiesSpiel
            ? "Bitte das Spiel beschreiben."
            : "Bitte den Aufbau beschreiben.";
  }

  // Erscheinungsform: welcher der beiden Kataloge gilt, entscheidet die
  // Altersstufe; wo überhaupt einer gilt, die Einordnung. Werte des anderen
  // Katalogs fallen still weg — wie jeder unbekannte Wert auch.
  const erlaubteFormen: readonly string[] = erscheinungsformenFuer(altersstufe);
  const erscheinungsform = traegtErscheinungsform(altersstufe, trainingsteil)
    ? csv(form.get("form")).filter((f) => erlaubteFormen.includes(f))
    : [];

  // Feldtyp und Spielfeldgrösse schliessen einander aus: der Feldtyp ist eine
  // Kategorie des Manuals Fussball Kinder, die Spielfeldgrösse führt das
  // Junioren-Manual an seiner Stelle.
  const feldtypRoh = clean(form.get("feldtyp"));
  const feldtyp =
    traegtFeldtyp(altersstufe) && feldtypSlugs.includes(feldtypRoh as never)
      ? feldtypRoh
      : null;

  // Spielfeldgrösse: optional, aber paarweise — wer sie angibt, gibt Länge UND
  // Breite an (PO 2026-08-30). Spiegelt `ex_spielfeld_paarweise` und
  // `ex_spielfeld_bereich`.
  let spielfeld_laenge_m: number | null = null;
  let spielfeld_breite_m: number | null = null;
  if (traegtSpielfeldgroesse(altersstufe)) {
    const laengeRoh = clean(form.get("spielfeld_laenge"));
    const breiteRoh = clean(form.get("spielfeld_breite"));
    if (laengeRoh || breiteRoh) {
      if (!laengeRoh || !breiteRoh) {
        errors.spielfeld = "Bitte Länge und Breite angeben oder beides leer lassen.";
      } else {
        const laenge = Number(laengeRoh);
        const breite = Number(breiteRoh);
        const gueltig = (n: number) =>
          Number.isInteger(n) && n >= SPIELFELD_MIN && n <= SPIELFELD_MAX;
        if (!gueltig(laenge) || !gueltig(breite))
          errors.spielfeld = `Länge und Breite in ganzen Metern, zwischen ${SPIELFELD_MIN} und ${SPIELFELD_MAX}.`;
        else {
          spielfeld_laenge_m = laenge;
          spielfeld_breite_m = breite;
        }
      }
    }
  }

  // Übungstyp: optionale Selbstauskunft, gegen nichts geprüft (Story 9 Out of
  // Scope 1) — aber nur in den Junioren-Blöcken, in denen eine Spielform
  // vorkommen kann (Story 3 AK 9). Leerer Wert heisst «kein Typ».
  const uebungstypRoh = clean(form.get("uebungstyp"));
  const uebungstyp =
    traegtUebungstyp(altersstufe, trainingsteil) &&
    uebungstypSlugs.includes(uebungstypRoh as never)
      ? uebungstypRoh
      : null;

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
      feldtyp,
      spielfeld_laenge_m,
      spielfeld_breite_m,
      erscheinungsform,
      hauptteilkategorie,
      anzahl_kinder,
      material: lines(form.get("material")),
      uebungstyp,
      methodischer_fahrplan,
      aufbau,
      varianten: lines(form.get("varianten")),
    },
  };
}
