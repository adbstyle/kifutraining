// Fassungen: eigenständige, im Training lebende Kopien von Bibliotheks-Übungen
// (Epic #72). Diese Datei hält die Regeln, die Erzeugung und Übernahme teilen —
// die Server Actions bleiben dadurch dünn.
import { brauchtFahrplan } from "@/lib/labels";

/** Woraus eine Fassung entstanden ist. Reine Angabe ohne Fremdschlüssel: sie
 *  überlebt das Verschwinden des Originals und ist unveränderlich. */
export type Herkunft = {
  herkunft_name: string;
  herkunft_typ: HerkunftTyp;
  herkunft_datum: string;
};

export type HerkunftTyp = "manual" | "community" | "eigen";

/** Die Felder einer Quelle, die zum Stempeln der Herkunft nötig sind. Deckt
 *  sowohl Bibliotheks-Übungen als auch Fassungen ab — beide können Quelle sein
 *  (Übernehmen ins Training bzw. in die Bibliothek). */
export type HerkunftsQuelle = {
  name: string;
  /** Nur Bibliotheks-Übungen tragen eine Quelle; Fassungen erben sie nicht. */
  source?: "manual" | "user" | null;
  owner_id?: string | null;
  herkunft_name?: string | null;
  herkunft_typ?: HerkunftTyp | null;
  herkunft_datum?: string | null;
};

/** Die Herkunft für eine neue Kopie bestimmen.
 *
 *  Trägt die Quelle selbst schon eine Herkunft, wird sie unverändert
 *  weitergegeben — bei einer Kopie einer Kopie bleibt so die ursprüngliche
 *  Herkunft stehen (Erfolgskriterium 5). Erst wenn die Quelle ein Original ist,
 *  entsteht ein neuer Stempel.
 *
 *  Der Typ sagt, aus welchem Bestand das Original kam; eine Personenangabe
 *  enthält er bewusst nicht. */
export function stempleHerkunft(quelle: HerkunftsQuelle, userId: string): Herkunft {
  if (quelle.herkunft_name && quelle.herkunft_typ && quelle.herkunft_datum) {
    return {
      herkunft_name: quelle.herkunft_name,
      herkunft_typ: quelle.herkunft_typ,
      herkunft_datum: quelle.herkunft_datum,
    };
  }
  return {
    herkunft_name: quelle.name,
    herkunft_typ: herkunftsTyp(quelle, userId),
    herkunft_datum: new Date().toISOString(),
  };
}

/** Aus welchem Bestand stammt das Original? Manual-Übungen sind der kuratierte
 *  Bestand; alles andere unterscheidet sich danach, ob es dem Handelnden selbst
 *  gehört.
 *
 *  Fehlt `source`, bricht das laut ab: ohne dieses Feld liesse sich der Typ nur
 *  raten, und das Ergebnis wäre eine plausibel aussehende, aber falsche
 *  Herkunftsangabe — die sich später nicht mehr korrigieren lässt, weil der
 *  Stempel unveränderlich ist. Ein Aufrufer, der die Quelle liest, muss `source`
 *  mitselektieren. */
function herkunftsTyp(quelle: HerkunftsQuelle, userId: string): HerkunftTyp {
  if (!quelle.source)
    throw new Error(
      "stempleHerkunft: Die Quelle trägt keine eigene Herkunft, dann ist `source` zum Ableiten des Typs erforderlich.",
    );
  if (quelle.source === "manual") return "manual";
  return quelle.owner_id === userId ? "eigen" : "community";
}

/** Die inhaltlichen Felder, die eine Fassung von ihrer Vorlage übernimmt.
 *  Bewusst NICHT dabei: slug, source, owner_id, visibility (Bibliotheks-
 *  Belange) sowie die Einordnung, die der Aufrufer setzt. */
export const FASSUNG_INHALT_FELDER = [
  "name",
  "kategorien",
  "erscheinungsform",
  "feldtyp",
  "anzahl_kinder",
  "material",
  "methodischer_fahrplan",
  "aufbau",
  "varianten",
  "bild_quelle",
] as const;

/** Die Spaltenliste, mit der eine Vorlage für das Kopieren gelesen wird —
 *  Inhalte, Bild/Diagramm und die Felder für den Herkunfts-Stempel. */
export const VORLAGE_SELECT = [
  "id",
  "name",
  "trainingsteil",
  "hauptteilkategorie",
  "kategorien",
  "erscheinungsform",
  "feldtyp",
  "anzahl_kinder",
  "material",
  "methodischer_fahrplan",
  "aufbau",
  "varianten",
  "bild_url",
  "bild_quelle",
  "diagramm",
  "source",
  "owner_id",
  "herkunft_name",
  "herkunft_typ",
  "herkunft_datum",
].join(", ");

/** Die Dateiendung eines Storage-Pfads (ohne Punkt), mit Rückfall auf `png`.
 *  Die Endung bestimmt den Zielnamen der Bildkopie. */
export function dateiendung(pfad: string): string {
  const teil = pfad.split(".").pop();
  return teil && teil !== pfad && /^[a-z0-9]+$/i.test(teil) ? teil : "png";
}

/** Erfüllt der Inhalt einer Fassung die Vollständigkeitsregel für Übungen?
 *  Gibt `null` zurück, wenn sie erfüllt ist, sonst eine Meldung für den USER.
 *
 *  Spiegelt die DB-Constraints `ablauf_je_einordnung` und
 *  `fahrplan_vollstaendig`: die Datenbank würde eine lückenhafte Übung ohnehin
 *  abweisen — hier geht es um eine verständliche Meldung statt eines rohen
 *  Constraint-Fehlers. Betrifft vor allem die inhaltsleeren Fassungen aus der
 *  Bestand-Überführung. */
export function fassungUnvollstaendig(f: {
  name: string | null;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  methodischer_fahrplan: { offen_starten?: string; ueben?: string[]; wetteifern?: string | null } | null;
  aufbau: string | null;
}): string | null {
  if (!f.name?.trim()) return "Diese Übung hat keinen Namen.";

  if (brauchtFahrplan(f.trainingsteil, f.hauptteilkategorie)) {
    const fp = f.methodischer_fahrplan;
    const vollstaendig =
      !!fp?.offen_starten?.trim() &&
      Array.isArray(fp.ueben) &&
      fp.ueben.length > 0 &&
      !!fp.wetteifern?.trim();
    return vollstaendig
      ? null
      : "Diese Übung hat keinen vollständigen methodischen Fahrplan. Ergänze ihn im Training, bevor du sie in deine Bibliothek übernimmst.";
  }

  return f.aufbau?.trim()
    ? null
    : "Diese Übung hat keine Ablaufbeschreibung. Ergänze sie im Training, bevor du sie in deine Bibliothek übernimmst.";
}

/** Zielpfad der Bildkopie einer Fassung. Der Dateiname ist die Zuordnungs-ID —
 *  damit kollisionsfrei zu Übungsbildern (die tragen die Übungs-ID) und
 *  deterministisch, sodass ein erneuter Versuch dieselbe Datei überschreibt
 *  statt Waisen zu hinterlassen. */
export function fassungBildPfad(
  ownerId: string,
  trainingExerciseId: string,
  quellPfad: string,
): string {
  return `user/${ownerId}/${trainingExerciseId}.${dateiendung(quellPfad)}`;
}
