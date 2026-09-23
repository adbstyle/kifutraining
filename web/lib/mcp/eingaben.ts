// Eingabe- und Ausgabeschemas der KI-Werkzeuge (Story #142).
//
// Jede geführte Angabe ist ein `z.enum` aus dem Vokabular — nie ein freier
// String. Zwei Gründe:
// 1. Sicherheit: Die Einordnung landet im Query-Layer interpoliert in einer
//    PostgREST-`or=`-Klausel (lib/queries/exercises.ts). Ein freier String wie
//    `einleitung),or(owner_id.is.null` würde dort die Abfrage umbauen. Die
//    Allowlist steht darum VOR dem Query-Layer, als Schema.
// 2. Der Assistent sieht die zulässigen Werte im JSON-Schema des Werkzeugs
//    und korrigiert sich bei einem Fehlgriff selbst (Epic-NFR 3).
// Die Filter nehmen genau die Optionen der Filterleisten des Katalogs
// (lib/filter-optionen.ts) — Werte, Klartext und Gruppierung —, statt sie
// hier nachzubauen. Ein neuer Wert in data/vokabular.yaml erscheint ohne
// Zutun an beiden Orten.
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";
import { altersstufe as altersstufeLabels, altersstufeSlugs } from "@/lib/vocab";
import {
  einordnungFilterOptionen,
  feldOptionen,
  formOptionen,
  stufenOptionen,
  typOptionen,
} from "@/lib/filter-optionen";
import { UebungKopf, Wert, alsEnum, katalogFilter } from "@/lib/mcp/bausteine";

export const SucheEingabe = z.object({
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Freitext über Name, Aufbau, Ablauf, Material und Varianten; Wortteile genügen."),
  altersstufe: alsEnum(altersstufeSlugs)
    .optional()
    .describe(
      "Nur Übungen dieser Altersstufe: " +
        altersstufeSlugs.map((s) => `${s} (${altersstufeLabels[s]})`).join(", ") +
        ".",
    ),
  einordnung: katalogFilter(
    einordnungFilterOptionen,
    "Filter «Trainingsteil» wie im Katalog. Im Kinderfussball steht statt des Hauptteils " +
      "dessen Hauptteilkategorie; die Zugehörigkeit der Werte liefert «vokabular».",
  ),
  kategorien: katalogFilter(stufenOptionen, "Alterskategorien."),
  feldtyp: katalogFilter(feldOptionen, "Feldtyp."),
  erscheinungsform: katalogFilter(formOptionen, "Erscheinungsformen beider Manuals als eine Dimension."),
  uebungstyp: katalogFilter(typOptionen, "Übungstyp."),
  kinder: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe(
      "Verfügbare Kinder: liefert Übungen, deren Mindestzahl damit erreicht ist (oder die keine nennen).",
    ),
  nur_eigene: z
    .boolean()
    .optional()
    .describe("Nur Übungen dieses Kontos (öffentliche wie private Entwürfe)."),
  limit: z.number().int().min(1).max(50).default(20).describe("Treffer je Seite, höchstens 50."),
  offset: z
    .number()
    .int()
    .min(0)
    .max(10_000)
    .default(0)
    .describe("Ab welchem Treffer; für die nächste Seite «naechster_offset» übernehmen."),
});

/** Ein Treffer — die Angaben der Katalog-Karte samt Alterskategorien
 *  (#142 AK 7). */
export const SuchTreffer = UebungKopf.extend({
  kategorien: z.array(Wert),
});

export const SucheAusgabe = z.object({
  gesamt: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  naechster_offset: z.number().int().nullable(),
  treffer: z.array(SuchTreffer),
});

export const AbrufEingabe = z.object({
  kennung: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .describe("id (UUID) oder slug einer Übung, etwa aus «uebungen_suchen»."),
});

/** Eine Übung mit allem, was ihre Seite in KiFu zeigt (#142 AK 8). */
export const UebungAusgabe = UebungKopf.extend({
  kategorien: z.array(Wert),
  /** Juniorenfussball: der Teil des Blocks; Kinderfussball: der Teil selbst
   *  (dann gleich `einordnung`). */
  trainingsteil: Wert,
  erscheinungsformen: z.array(Wert),
  uebungstyp: Wert.nullable(),
  spielfeld: z.object({ laenge_m: z.number(), breite_m: z.number() }).nullable(),
  anzahl_kinder: z
    .object({ min: z.number().nullable(), max: z.number().nullable() })
    .nullable(),
  material: z.array(z.string()),
  methodischer_fahrplan: z
    .object({
      offen_starten: z.string(),
      ueben: z.array(z.string()),
      wetteifern: z.string().nullable(),
    })
    .nullable(),
  aufbau: z.string().nullable(),
  varianten: z.array(z.string()),
  bild_quelle: z.enum(["foto", "diagramm"]).nullable(),
  /** Das Feld-Diagramm als Vektordaten (Epic #139: kein Bild). */
  diagramm: z.unknown().nullable(),
  /** Gehört die Übung diesem Konto? Statt einer Eigentümer-ID — fremde
   *  Konto-IDs gibt kein Werkzeug aus. */
  eigene: z.boolean(),
});

export const LeereEingabe = z.object({});

export const WerBinIchAusgabe = z.object({
  anzeigename: z.string(),
  konto_url: z.string(),
});
