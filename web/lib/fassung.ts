// Fassungen: eigenständige, im Training lebende Kopien von Bibliotheks-Übungen
// (Epic #72). Diese Datei hält die Regeln, die Erzeugung und Übernahme teilen —
// die Server Actions bleiben dadurch dünn.

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
 *  gehört. */
function herkunftsTyp(quelle: HerkunftsQuelle, userId: string): HerkunftTyp {
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
