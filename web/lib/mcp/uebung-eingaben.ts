// Eingabeschema und Beschreibung der Übungsangaben für die schreibenden
// Übungs-Werkzeuge (Epic #139, ab Story #143).
//
// Das Schema ist STRIKT (`z.strictObject`): Ein vertipptes freiwilliges Feld
// — etwa «erscheinungsform» statt «erscheinungsformen», wie der Suchfilter
// heisst — fiele sonst still weg, und der Assistent hielte die Angabe für
// gesetzt. Das ist genau der stille Verlust, den #143 AK 5 ausschliesst.
//
// Wie überall prüft es nur Typ und Enum (lib/mcp/werkzeug.ts); ob ein Wert zu
// Einordnung und Altersstufe passt, entscheidet der Kern und nennt dann die
// zulässigen Werte. Die Enums umfassen darum beide Altersstufen.
//
// REIN: keine Server-Importe — `check:ki-zugang` lädt diese Datei mit tsx.
import { z } from "zod";
import {
  altersstufe as altersstufeLabels,
  erscheinungsform_juniorenSlugs,
  erscheinungsformSlugs,
  feldtypSlugs,
  hauptteilkategorieSlugs,
  kategorienSlugs,
  uebungstypSlugs,
} from "@/lib/vocab";
import {
  ALTERSSTUFEN,
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
import { farbSlugs } from "@/lib/diagramm";
import { MATERIAL_ARTEN, MATERIAL_KATALOG, MATERIAL_MENGE_MAX } from "@/lib/material";
import { SPIELFELD_MAX, SPIELFELD_MIN } from "@/lib/uebung-form";
import { FREITEXT_LISTEN, UEBEN_ZEILEN } from "@/lib/freitext";
import {
  UEBUNG_STUFEN_KI,
  pflichtangaben,
  type UebungInhalt,
  type UebungPatch,
} from "@/lib/kern/uebung-inhalt";
import { AbrufEingabe } from "@/lib/mcp/eingaben";
import { DiagrammEingabe } from "@/lib/mcp/diagramm-eingaben";
import {
  ALTERSSTUFEN_TEXT,
  Einordnung,
  PFLICHT_SATZ,
  alsEnum,
  kategorienText,
} from "@/lib/mcp/bausteine";

const zitiert = (namen: readonly string[]) => namen.map((n) => `«${n}»`).join(", ");

/** Welche Angaben eine Übung dieser Altersstufe führt und welche Pflicht
 *  sind (#143 AK 1) — erzeugt aus derselben Regelquelle wie die Prüfung,
 *  nie von Hand geschrieben. Die Pflicht über Name, Einordnung und
 *  Alterskategorien hinaus stammt aus `pflichtangaben`, das `check:kern`
 *  gegen `parseUebungsInhalt` hält. */
export function angabenText(stufe: Altersstufe): string {
  const einordnungen = einordnungsSlugsFuer(stufe);
  // Einordnungen mit derselben zusätzlichen Pflicht zusammen; wo die
  // Hauptteilkategorie die Ablaufform bestimmt, je Kategorie.
  const gruppen = new Map<string, Map<string, string[]>>();
  for (const e of einordnungen) {
    const kategorien = traegtHauptteilkategorie(stufe, e) ? hauptteilkategorieSlugs : [null];
    for (const h of kategorien) {
      const pflicht = zitiert(pflichtangaben(stufe, e, h).slice(3));
      const orte = gruppen.get(pflicht) ?? new Map<string, string[]>();
      orte.set(e, [...(orte.get(e) ?? []), ...(h ? [h] : [])]);
      gruppen.set(pflicht, orte);
    }
  }
  const jeEinordnung = [...gruppen.entries()]
    .map(([pflicht, orte]) => {
      const wo = [...orte.entries()]
        .map(([e, hs]) => (hs.length ? `${e} mit «hauptteilkategorie» ${hs.join(" oder ")}` : e))
        .join(", ");
      return `in ${wo}: ${pflicht}`;
    })
    .join("; ");

  const mitForm = einordnungen.filter((e) => traegtErscheinungsform(stufe, e));
  const mitTyp = einordnungen.filter((e) => traegtUebungstyp(stufe, e));
  const spielfeldNur = traegtSpielfeldgroesse(stufe, null)
    ? ""
    : `nur bei «feldtyp» ${feldtypSlugs.filter((f) => traegtSpielfeldgroesse(stufe, f)).join(", ")}; `;
  const freiwillig = [
    "«varianten»",
    `«erscheinungsformen» (${erscheinungsformenFuer(stufe).join(", ")}; nur in ${mitForm.join(", ")})`,
    ...(mitTyp.length ? [`«uebungstyp» (${uebungstypSlugs.join(", ")}; nur in ${mitTyp.join(", ")})`] : []),
    ...(traegtFeldtyp(stufe) ? [`«feldtyp» (${feldtypSlugs.join(", ")})`] : []),
    `«spielfeld» (${spielfeldNur}Länge und Breite zusammen, ganze Meter von ${SPIELFELD_MIN} bis ${SPIELFELD_MAX})`,
    "«anzahl_kinder»",
    "«material»",
  ];
  return (
    `${altersstufeLabels[stufe]}: Pflicht sind «name», «einordnung» (${einordnungen.join(", ")}) und ` +
    `«kategorien» (${kategorienFuer(stufe).join(", ")}), dazu je nach Einordnung ${jeEinordnung}. ` +
    `Freiwillig: ${freiwillig.join(", ")}.`
  );
}

/** Die Angaben aller Altersstufen, deren Übungen der KI-Zugang anlegt. */
export const UEBUNG_ANGABEN = UEBUNG_STUFEN_KI.map(angabenText).join(" ");

const Freitext = (was: string) => z.string().nullable().optional().describe(was);

/** Die Angaben einer Übung — Feldnamen wie in «uebung_abrufen», die drei
 *  Stufen des Fahrplans hier flach. */
const Angaben = z.strictObject({
  name: z.string().describe("Name der Übung."),
  einordnung: Einordnung,
  kategorien: z
    .array(alsEnum(kategorienSlugs))
    .describe(
      `Alterskategorien, mindestens eine, alle aus der gewählten Altersstufe. ${kategorienText(ALTERSSTUFEN)}.`,
    ),
  hauptteilkategorie: alsEnum(hauptteilkategorieSlugs)
    .nullable()
    .optional()
    .describe(`${PFLICHT_SATZ} Sie bestimmt die Form des Ablaufs.`),
  offen_starten: Freitext("Methodischer Fahrplan, Stufe «Offen starten»."),
  ueben: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional()
    .describe(`Methodischer Fahrplan, Stufe «Üben»: Freitext oder seine Zeilen. ${UEBEN_ZEILEN}`),
  wetteifern: Freitext("Methodischer Fahrplan, Stufe «Wetteifern»."),
  aufbau: Freitext(
    `Der Ablauf als Beschreibung, wo kein methodischer Fahrplan gilt. Freitext: ${FREITEXT_LISTEN}.`,
  ),
  varianten: Freitext("Varianten der Übung, Freitext wie «aufbau»."),
  erscheinungsformen: z
    .array(alsEnum([...erscheinungsformSlugs, ...erscheinungsform_juniorenSlugs]))
    .nullable()
    .optional()
    .describe("Erscheinungsformen aus dem Manual der gewählten Altersstufe."),
  uebungstyp: alsEnum(uebungstypSlugs).nullable().optional().describe("Übungstyp (Juniorenfussball)."),
  feldtyp: alsEnum(feldtypSlugs).nullable().optional().describe("Feldtyp (Kinderfussball)."),
  spielfeld: z
    .strictObject({ laenge_m: z.number(), breite_m: z.number() })
    .nullable()
    .optional()
    .describe(`Spielfeldgrösse in ganzen Metern, Länge und Breite je ${SPIELFELD_MIN} bis ${SPIELFELD_MAX}.`),
  anzahl_kinder: z
    .strictObject({ min: z.number().nullable().optional(), max: z.number().nullable().optional() })
    .nullable()
    .optional()
    .describe("Anzahl Spieler:innen: ganze Zahlen ab 1, das Maximum nicht unter dem Minimum."),
  material: z
    .strictObject({
      liste: z
        .array(
          z.strictObject({
            art: alsEnum(MATERIAL_ARTEN),
            farbe: alsEnum(farbSlugs).nullable().optional(),
            menge: z.number(),
          }),
        )
        .optional()
        .describe(
          `Gezähltes Material: Art, Menge (ganze Zahl von 1 bis ${MATERIAL_MENGE_MAX}) und — nur bei ` +
            `${MATERIAL_ARTEN.filter((a) => MATERIAL_KATALOG[a].farbig).join(", ")} — die Farbe; ohne ` +
            "Farbe gilt die des Diagramms.",
        ),
      ergaenzung: z
        .array(z.string())
        .optional()
        .describe("Weiteres Material, das die Liste nicht kennt (Pfeife, Stoppuhr …), je Eintrag eine Zeile."),
    })
    .nullable()
    .optional(),
});

export const UebungAnlegenEingabe = Angaben.extend({
  altersstufe: alsEnum(ALTERSSTUFEN).describe(
    `Altersstufe: ${ALTERSSTUFEN_TEXT}. Sie bestimmt, welche Angaben die Übung führt.`,
  ),
  // Nur beim Anlegen: Ändern setzt das Diagramm über «uebung_diagramm_setzen».
  diagramm: DiagrammEingabe.optional(),
});

/** Die Kennung einer Übung — derselbe Zuschnitt wie bei «uebung_abrufen». */
export const UebungKennung = AbrufEingabe.shape.kennung.describe(
  "id (UUID) oder slug der Übung, etwa aus «uebungen_suchen» oder «uebung_abrufen».",
);

/** Was die Fehler zu einer Übungs-Kennung bedeuten (#144 AK 4). Gehört an
 *  JEDE Beschreibung eines Werkzeugs, das `UebungKennung` annimmt —
 *  `check:kern` wacht darüber. */
export const UEBUNG_KENNUNG_FEHLER =
  "Fehlerarten zur Kennung: «nicht_gefunden» — für dein Konto nicht sichtbar (es gibt sie " +
  "nicht, sie wurde gelöscht oder gehört jemand anderem privat; bewusst nicht " +
  "unterscheidbar); «keine_rechte» — eine Übung aus dem Kifu-Manual oder die öffentliche eines " +
  "anderen Kontos: ansehen ja, ändern nein.";

/** Eine Änderung (#144): Pflicht ist nur die Kennung, jede Angabe ist frei. */
const ALS_GANZES = "Beim Ändern ersetzt die neue Angabe die bisherige als Ganzes.";
export const UebungAendernEingabe = z.strictObject({
  kennung: UebungKennung,
  ...Angaben.partial().shape,
  spielfeld: Angaben.shape.spielfeld.describe(`${Angaben.shape.spielfeld.description} ${ALS_GANZES}`),
  anzahl_kinder: Angaben.shape.anzahl_kinder.describe(`${Angaben.shape.anzahl_kinder.description} ${ALS_GANZES}`),
  altersstufe: alsEnum(ALTERSSTUFEN)
    .optional()
    .describe("Nur zur Kontrolle: Die Altersstufe einer Übung ändert sich nie; weicht sie ab, lehnt KiFu ab."),
});

/** Eine Änderung (snake_case) als Kern-Eingabe (camelCase). Was fehlt, bleibt
 *  `undefined` («bleibt, wie es ist»), was `null` ist, bleibt `null`. */
export function alsUebungPatch(e: Partial<z.infer<typeof Angaben>>): UebungPatch {
  return {
    name: e.name,
    einordnung: e.einordnung,
    kategorien: e.kategorien,
    hauptteilkategorie: e.hauptteilkategorie,
    offenStarten: e.offen_starten,
    ueben: e.ueben,
    wetteifern: e.wetteifern,
    aufbau: e.aufbau,
    varianten: e.varianten,
    erscheinungsformen: e.erscheinungsformen,
    uebungstyp: e.uebungstyp,
    feldtyp: e.feldtyp,
    spielfeld: e.spielfeld && { laengeM: e.spielfeld.laenge_m, breiteM: e.spielfeld.breite_m },
    anzahlKinder: e.anzahl_kinder,
    material: e.material,
  };
}

/** Die vollständige Werkzeug-Eingabe als Kern-Eingabe. */
export function alsUebungInhalt(e: z.infer<typeof Angaben>): UebungInhalt {
  return { ...alsUebungPatch(e), name: e.name, einordnung: e.einordnung, kategorien: e.kategorien };
}
