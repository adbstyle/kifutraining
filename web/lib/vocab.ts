// AUTO-GENERIERT aus data/vokabular.yaml — NICHT von Hand bearbeiten.
// Neu generieren mit: npm run gen:vocab
/* eslint-disable */

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

export const kategorien = { G: "G", F: "F", E: "E" } as const;
export type KategorieSlug = keyof typeof kategorien;
export const kategorienSlugs = Object.keys(kategorien) as KategorieSlug[];
