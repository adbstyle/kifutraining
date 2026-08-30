// AUTO-GENERIERT aus data/vokabular.yaml — NICHT von Hand bearbeiten.
// Neu generieren mit: npm run gen:vocab
/* eslint-disable */

export const altersstufe = {
  "kinderfussball": "Kinderfussball",
  "juniorenfussball": "Juniorenfussball"
} as const;
export type AltersstufeSlug = keyof typeof altersstufe;
export const altersstufeSlugs = Object.keys(altersstufe) as AltersstufeSlug[];

export const erscheinungsform = {
  "spiel-kreativ-gestalten": "Das Spiel kreativ gestalten",
  "ball-entschlossen-erobern": "Den Ball entschlossen erobern",
  "mutig-tore-erzielen": "Mutig Tore erzielen",
  "mutig-tore-verhindern": "Mutig Tore verhindern",
  "flink-geschickt-bewegen": "Sich flink und geschickt bewegen",
  "respektvoll-fair-spielen": "Sich respektvoll verhalten und fair spielen"
} as const;
export type ErscheinungsformSlug = keyof typeof erscheinungsform;
export const erscheinungsformSlugs = Object.keys(erscheinungsform) as ErscheinungsformSlug[];

export const feldtyp = {
  "kleinfeld": "Kleinfeld",
  "grossfeld": "Grossfeld",
  "freies_feld": "Freies Feld"
} as const;
export type FeldtypSlug = keyof typeof feldtyp;
export const feldtypSlugs = Object.keys(feldtyp) as FeldtypSlug[];

export const trainingsteil = {
  "auffangen": "Auffangen",
  "einleitung": "Einleitung",
  "hauptteil": "Hauptteil",
  "ausklang": "Ausklang"
} as const;
export type TrainingsteilSlug = keyof typeof trainingsteil;
export const trainingsteilSlugs = Object.keys(trainingsteil) as TrainingsteilSlug[];

export const hauptteilkategorie = {
  "fussball-spielen-lernen": "Fussball spielen lernen",
  "vielseitigkeit-erleben": "Vielseitigkeit erleben",
  "fussball-spielen": "Fussball spielen"
} as const;
export type HauptteilkategorieSlug = keyof typeof hauptteilkategorie;
export const hauptteilkategorieSlugs = Object.keys(hauptteilkategorie) as HauptteilkategorieSlug[];

export const kategorien = {
  "G": "G",
  "F": "F",
  "E": "E",
  "D": "D",
  "C": "C",
  "B": "B",
  "A": "A"
} as const;
export type KategorienSlug = keyof typeof kategorien;
export const kategorienSlugs = Object.keys(kategorien) as KategorienSlug[];

export const junioren_trainingsteil = {
  "einstieg": "Einstieg",
  "hauptteil": "Hauptteil",
  "abschluss": "Abschluss"
} as const;
export type JuniorenTrainingsteilSlug = keyof typeof junioren_trainingsteil;
export const junioren_trainingsteilSlugs = Object.keys(junioren_trainingsteil) as JuniorenTrainingsteilSlug[];

export const junioren_block = {
  "jun-aufwaermen": "Aufwärmen",
  "jun-spielform-trainingsziel": "Spielform zum Trainingsziel",
  "jun-explosivitaet": "Explosivität",
  "jun-spielformen": "Spielformen und unterstützende Übungen",
  "jun-spiel": "Spiel",
  "jun-ausklang": "Ausklang"
} as const;
export type JuniorenBlockSlug = keyof typeof junioren_block;
export const junioren_blockSlugs = Object.keys(junioren_block) as JuniorenBlockSlug[];

export const junioren_heimat = {
  "jun-aufwaermen": "Aufwärmen",
  "jun-spielform-trainingsziel": "Spielform zum Trainingsziel",
  "jun-explosivitaet": "Explosivität"
} as const;
export type JuniorenHeimatSlug = keyof typeof junioren_heimat;
export const junioren_heimatSlugs = Object.keys(junioren_heimat) as JuniorenHeimatSlug[];

export const uebungstyp = {
  "basisspielform": "Basisspielform",
  "spielform": "Spielform",
  "isolierte-form": "Isolierte Form"
} as const;
export type UebungstypSlug = keyof typeof uebungstyp;
export const uebungstypSlugs = Object.keys(uebungstyp) as UebungstypSlug[];

export const erscheinungsform_junioren = {
  "spiel-variantenreich-aufbauen": "Das Spiel variantenreich und situationsangepasst aufbauen",
  "torchancen-vorbereiten-abschliessen": "Torchancen variantenreich vorbereiten und erfolgreich abschliessen",
  "offensive-zweikaempfe-bestreiten": "Offensive Zweikämpfe mutig und erfolgreich bestreiten",
  "ballorientiert-kompakt-verteidigen": "Ballorientiert, kompakt und situationsangepasst verteidigen",
  "defensive-zweikaempfe-bestreiten": "Defensive Zweikämpfe mutig und erfolgreich bestreiten",
  "schnell-umschalten": "Schnell umschalten",
  "explosiv-dynamisch-agieren": "Explosiv und dynamisch agieren",
  "koerper-stabil-halten": "Den Körper stabil halten",
  "intensive-spielaktionen-ausfuehren": "Viele intensive Spielaktionen bis ans Spielende ausführen",
  "positiv-miteinander-umgehen": "Positiv miteinander umgehen",
  "mutig-selbstbewusst-handeln": "Mutig und selbstbewusst zum Nutzen des ganzen Teams handeln"
} as const;
export type ErscheinungsformJuniorenSlug = keyof typeof erscheinungsform_junioren;
export const erscheinungsform_juniorenSlugs = Object.keys(erscheinungsform_junioren) as ErscheinungsformJuniorenSlug[];

export type KategorieSlug = KategorienSlug;
