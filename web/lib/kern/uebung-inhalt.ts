// Die Regeln des Übungsinhalts für den KI-Weg (Epic #139, ab Story #143).
//
// Für den Inhalt einer Übung gibt es genau EINE Regelquelle:
// `parseUebungsInhalt` (lib/uebung-form.ts), die auch das Formular prüft
// (#143 NFR 1). Diese Datei baut aus der typisierten Eingabe eines
// KI-Werkzeugs dasselbe Formular, ruft genau diese Funktion und übersetzt ihr
// Ergebnis zurück — die Fehlerschlüssel des Formulars (`kat`, `trainingsteil`,
// …) in die Eingabenamen des Werkzeugs (`kategorien`, `einordnung`, …).
//
// Eine neue Regel entsteht dabei nicht, nur eine strengere Reaktion: Was das
// Formular still verwirft, weil die Oberfläche es gar nicht anbietet — eine
// Hauptteilkategorie ausserhalb des Hauptteils, eine Erscheinungsform des
// anderen Manuals —, ist hier ein benannter Verstoss (#143 AK 5). Erkannt
// wird es am Abgleich: Was gesendet wurde und in der geprüften Zeile fehlt,
// hat eine Regel verworfen. Dazu kommen die zwei Stellen, an denen das
// Formular normalisiert, weil dort das Eingabefeld die Form erzwingt: die
// Anzahl Spieler:innen und die Mengen der Materialliste sind ganze Zahlen.
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// `check:kern` lädt diese Datei mit tsx.
import { isDeepStrictEqual } from "node:util";
import { altersstufe as altersstufeLabels, hauptteilkategorieSlugs } from "@/lib/vocab";
import {
  brauchtFahrplan,
  einordnungsSlugsFuer,
  erscheinungsformenFuer,
  kategorienFuer,
  traegtErscheinungsform,
  traegtHauptteilkategorie,
  traegtUebungstyp,
  zielblock,
  type Altersstufe,
} from "@/lib/altersstufe";
import type { FarbSlug } from "@/lib/diagramm";
import { ANZAHL_SPIELER_LABEL } from "@/lib/labels";
import {
  MATERIAL_KATALOG,
  MATERIAL_MENGE_MAX,
  mengeGueltig,
  parseMaterialListe,
  type MaterialArt,
} from "@/lib/material";
import { fachlicheMeldung } from "@/lib/training-bedingungen";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import { fehlschlag, type KernFehler, type Verstoss } from "@/lib/kern/ergebnis";

/** Der Zusatz für den Assistenten an einer abgelehnten Anlage bzw. Änderung. */
export const NICHTS_ANGELEGT = "Es ist nichts angelegt worden.";
export const UNVERAENDERT = "Die Übung ist unverändert.";

/** Ein Posten der gezählten Materialliste, wie ihn ein Werkzeug sendet. */
type MaterialEintrag = { art: MaterialArt; farbe?: FarbSlug | null; menge: number };

/** Die fachlichen Angaben einer Übung, wie der Kern sie entgegennimmt. */
export type UebungInhalt = {
  name: string;
  /** Kinderfussball: der Trainingsteil; Juniorenfussball: der Block. */
  einordnung: string;
  kategorien: readonly string[];
  hauptteilkategorie?: string | null;
  offenStarten?: string | null;
  /** Freitext oder seine Zeilen (die Form aus «uebung_abrufen»). */
  ueben?: string | readonly string[] | null;
  wetteifern?: string | null;
  aufbau?: string | null;
  varianten?: string | null;
  erscheinungsformen?: readonly string[] | null;
  uebungstyp?: string | null;
  feldtyp?: string | null;
  spielfeld?: { laengeM: number; breiteM: number } | null;
  anzahlKinder?: { min?: number | null; max?: number | null } | null;
  material?: {
    liste?: readonly MaterialEintrag[] | null;
    ergaenzung?: readonly string[] | null;
  } | null;
};

/** Ein Verstoss samt Einordnung: `regel` für einen Wert, der nicht zu
 *  Einordnung oder Altersstufe passt, `eingabe` für eine fehlende oder
 *  unförmige Angabe. Die Art trägt nach aussen der ganze Fehler. */
export type Fund = Verstoss & { art: "eingabe" | "regel" };

export type Pruefung = { ok: true; row: Record<string, unknown> } | { ok: false; funde: Fund[] };

/** Eine Änderung (#144): Was fehlt (`undefined`), bleibt; `null` leert eine
 *  freiwillige Angabe. Bei `material` gilt das je Teil. */
export type UebungPatch = Partial<UebungInhalt>;

/** Eine gespeicherte Übung, gelesen mit `VORLAGE_SELECT` (lib/fassung.ts):
 *  Einordnung, Inhalt, Bild und Diagramm. */
export type UebungsZeile = {
  trainingsteil: string;
  hauptteilkategorie: string | null;
  name: string;
  kategorien: string[] | null;
  erscheinungsform: string[] | null;
  feldtyp: string | null;
  spielfeld_laenge_m: number | null;
  spielfeld_breite_m: number | null;
  anzahl_kinder: { min?: number | null; max?: number | null } | null;
  material: string[] | null;
  material_liste: unknown;
  material_basis: unknown;
  methodischer_fahrplan: { offen_starten?: string | null; ueben?: string[] | null; wetteifern?: string | null } | null;
  uebungstyp: string | null;
  aufbau: string | null;
  varianten_text: string | null;
  bild_quelle: "foto" | "diagramm" | null;
  bild_url: string | null;
  diagramm: unknown;
};

/** Die Klartexte der Datenebene, wortgleich übernommen. Fehlt einer, weil ein
 *  Constraint umbenannt wurde, gilt ein allgemeiner Satz — nie der Name des
 *  Constraints, und das Laden scheitert nicht (diese Datei hängt über den
 *  Kern auch an den Server Actions). Die Umbenennung fällt in `check:kern`
 *  auf: dort sind die Texte eingefroren. */
function dbRegel(constraint: string): string {
  return fachlicheMeldung(constraint) ?? "Dieser Wert passt nicht zur Einordnung oder Altersstufe der Übung.";
}
const REGEL = {
  erscheinungsform: dbRegel("erscheinungsform_je_altersstufe"),
  feldtyp: dbRegel("ex_feldtyp_nur_kifu"),
  spielfeld: dbRegel("spielfeld_je_feld"),
  uebungstyp: dbRegel("ex_uebungstyp_nur_junioren"),
};

const KEIN_FAHRPLAN = "Hier gibt es keinen methodischen Fahrplan - der Ablauf steht in «aufbau».";
const NICHT_AUFBAU =
  "Hier gilt der methodische Fahrplan («offen_starten», «ueben», «wetteifern»), nicht «aufbau».";
const KEINE_FORM = "Diese Einordnung trägt keine Erscheinungsform.";
const OHNE_UEBUNGSTYP = `Den Übungstyp gibt es nur im ${altersstufeLabels.juniorenfussball} - lass «uebungstyp» weg.`;
const ANZAHL_GANZ = `Die ${ANZAHL_SPIELER_LABEL} ist eine ganze Zahl ab 1.`;
const MENGE_GANZ = `Die Menge ist eine ganze Zahl von 1 bis ${MATERIAL_MENGE_MAX}.`;
const ABGELEHNT =
  "Die Übung entspricht den Regeln nicht. Korrigiere die unter «verstoesse» genannten Angaben " +
  "und sende sie noch einmal.";

/** Die Formularfelder des Ablaufs — ohne Hauptteilkategorie ist seine Form
 *  unbestimmt, ihre Befunde entfallen dann. */
const ABLAUF = new Set(["offen_starten", "ueben", "wetteifern", "aufbau"]);

/** Hat der Aufrufer hier etwas gesendet? Leerraum und leere Listen zählen
 *  nicht — sie verwirft das Formular ohnehin. */
function gesendet(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (Array.isArray(v)) return v.some(gesendet);
  return true;
}

const zahl = (n: number | null | undefined) => (n == null ? "" : String(n));

/** Die Eingabe als das Formular, das `parseUebungsInhalt` liest. */
function alsFormular(i: UebungInhalt, trainingsteil: string): FormData {
  const fd = new FormData();
  fd.set("name", i.name);
  fd.set("trainingsteil", trainingsteil);
  fd.set("kat", [...new Set(i.kategorien)].join(","));
  fd.set("hauptteilkategorie", i.hauptteilkategorie ?? "");
  fd.set("offen_starten", i.offenStarten ?? "");
  fd.set("ueben", typeof i.ueben === "string" ? i.ueben : (i.ueben ?? []).join("\n"));
  fd.set("wetteifern", i.wetteifern ?? "");
  fd.set("aufbau", i.aufbau ?? "");
  fd.set("varianten", i.varianten ?? "");
  fd.set("form", [...new Set(i.erscheinungsformen ?? [])].join(","));
  fd.set("uebungstyp", i.uebungstyp ?? "");
  fd.set("feldtyp", i.feldtyp ?? "");
  fd.set("spielfeld_laenge", zahl(i.spielfeld?.laengeM));
  fd.set("spielfeld_breite", zahl(i.spielfeld?.breiteM));
  fd.set("anzahl_min", zahl(i.anzahlKinder?.min));
  fd.set("anzahl_max", zahl(i.anzahlKinder?.max));
  fd.set("material", (i.material?.ergaenzung ?? []).join("\n"));
  // Wie im Formular: ohne Liste bleibt die gespeicherte bzw. der Default.
  if (i.material?.liste) fd.set("material_liste", JSON.stringify(i.material.liste));
  return fd;
}

/** Welche Hauptteilkategorie den Ablauf als Beschreibung trägt — ohne
 *  Kategorie ist die Form offen, darum hängt der Satz an deren Pflicht. */
function ablaufJeKategorie(stufe: Altersstufe, einordnung: string): string {
  const ohne = hauptteilkategorieSlugs.filter((h) => !brauchtFahrplan(stufe, einordnung, h));
  return `Bei «${ohne.join("», «")}» steht der Ablauf in «aufbau», sonst in «offen_starten», «ueben» und «wetteifern».`;
}

/** Ein Fehler des Formulars als Verstoss des Werkzeugs. Die Meldungen bleiben
 *  wortgleich; wo das Formular nur «falsch» sagt, nennt der Zusatz den Wert. */
function uebersetzt(schluessel: string, meldung: string, i: UebungInhalt, stufe: Altersstufe): Fund {
  switch (schluessel) {
    case "trainingsteil": {
      const zulaessig = einordnungsSlugsFuer(stufe);
      return i.einordnung.trim()
        ? {
            feld: "einordnung",
            meldung: `„${i.einordnung}" ist keine Einordnung der Altersstufe ${altersstufeLabels[stufe]}.`,
            zulaessig,
            art: "regel",
          }
        : { feld: "einordnung", meldung, zulaessig, art: "eingabe" };
    }
    case "kat": {
      const zulaessig = kategorienFuer(stufe);
      const fremde = [...new Set(i.kategorien)].filter((k) => !zulaessig.includes(k));
      return fremde.length
        ? { feld: "kategorien", meldung: `${meldung} Nicht zulässig: ${fremde.join(", ")}.`, zulaessig, art: "regel" }
        : { feld: "kategorien", meldung, zulaessig, art: "eingabe" };
    }
    case "hauptteilkategorie":
      return {
        feld: schluessel,
        meldung: `${meldung} ${ablaufJeKategorie(stufe, i.einordnung)}`,
        zulaessig: hauptteilkategorieSlugs,
        art: "eingabe",
      };
    case "anzahl_max":
      return { feld: "anzahl_kinder.max", meldung, art: "eingabe" };
    default:
      // name, offen_starten, ueben, wetteifern, aufbau, spielfeld: gleichnamig.
      return { feld: schluessel, meldung, art: "eingabe" };
  }
}

/** Wo das Formular normalisiert statt abzulehnen: nicht ganzzahlige Anzahlen
 *  (sie scheiterten erst an der Datenbank) und Mengen, die es still verwirft
 *  oder kappt, dazu eine Farbe an Material, das es nicht in Farben gibt. */
function zusatz(i: UebungInhalt): Fund[] {
  const funde: Fund[] = [];
  for (const grenze of ["min", "max"] as const) {
    const n = i.anzahlKinder?.[grenze];
    if (n != null && !(Number.isInteger(n) && n >= 1))
      funde.push({ feld: `anzahl_kinder.${grenze}`, meldung: ANZAHL_GANZ, art: "eingabe" });
  }
  (i.material?.liste ?? []).forEach((p, n) => {
    if (!mengeGueltig(p.menge))
      funde.push({ feld: `material.liste[${n}].menge`, meldung: MENGE_GANZ, art: "eingabe" });
    // Dieselbe Quelle wie die Farbe, unter der die Liste einen Posten führt.
    const info = MATERIAL_KATALOG[p.art];
    if (p.farbe != null && !info.farbig)
      funde.push({
        feld: `material.liste[${n}].farbe`,
        meldung: `${info.einzahl} gibt es nicht in Farben - lass «farbe» weg.`,
        art: "eingabe",
      });
  });
  return funde;
}

/** Die gesendeten Werte, die die Regel verworfen hat: in der geprüften Zeile
 *  fehlen sie. Felder mit eigenem Formularfehler sind schon genannt. */
function verworfen(
  i: UebungInhalt,
  zeile: Record<string, unknown>,
  stufe: Altersstufe,
  fehler: Record<string, string>,
): Fund[] {
  const funde: Fund[] = [];
  if (gesendet(i.hauptteilkategorie) && zeile.hauptteilkategorie == null) {
    const z = zielblock(stufe, i.einordnung, i.hauptteilkategorie);
    if (!z.ok) funde.push({ feld: "hauptteilkategorie", meldung: z.problem.text, art: "regel" });
  }
  if (!("hauptteilkategorie" in fehler)) {
    if (zeile.methodischer_fahrplan != null) {
      if (gesendet(i.aufbau)) funde.push({ feld: "aufbau", meldung: NICHT_AUFBAU, art: "regel" });
    } else {
      const fahrplan = { offen_starten: i.offenStarten, ueben: i.ueben, wetteifern: i.wetteifern };
      for (const [feld, v] of Object.entries(fahrplan))
        if (gesendet(v)) funde.push({ feld, meldung: KEIN_FAHRPLAN, art: "regel" });
    }
  }
  const behalten = (zeile.erscheinungsform ?? []) as string[];
  const weg = [...new Set(i.erscheinungsformen ?? [])].filter((f) => !behalten.includes(f));
  if (weg.length)
    funde.push(
      traegtErscheinungsform(stufe, i.einordnung)
        ? {
            feld: "erscheinungsformen",
            meldung: `${REGEL.erscheinungsform} Nicht zulässig: ${weg.join(", ")}.`,
            zulaessig: erscheinungsformenFuer(stufe),
            art: "regel",
          }
        : { feld: "erscheinungsformen", meldung: KEINE_FORM, art: "regel" },
    );
  if (gesendet(i.feldtyp) && zeile.feldtyp == null)
    funde.push({ feld: "feldtyp", meldung: REGEL.feldtyp, art: "regel" });
  if (i.spielfeld && !("spielfeld" in fehler) && zeile.spielfeld_laenge_m == null)
    funde.push({ feld: "spielfeld", meldung: REGEL.spielfeld, art: "regel" });
  // Die Meldung der Datenebene nennt die Junioren-Blöcke, die einen Übungstyp
  // tragen — im Kinderfussball gibt es ihn gar nicht.
  if (gesendet(i.uebungstyp) && zeile.uebungstyp == null)
    funde.push({
      feld: "uebungstyp",
      meldung: einordnungsSlugsFuer(stufe).some((e) => traegtUebungstyp(stufe, e))
        ? REGEL.uebungstyp
        : OHNE_UEBUNGSTYP,
      art: "regel",
    });
  return funde;
}

/** Die fehlerhaften Felder auf gültige Platzhalter setzen, damit ein zweiter
 *  Lauf derselben Regelquelle die Zeile liefert, an der sich die übrigen
 *  Felder abgleichen lassen. Diese Zeile wird nie gespeichert. */
function mitPlatzhaltern(fd: FormData, fehler: Record<string, string>, stufe: Altersstufe): FormData {
  for (const schluessel of Object.keys(fehler)) {
    if (schluessel === "kat") fd.set("kat", kategorienFuer(stufe)[0]);
    else if (schluessel === "hauptteilkategorie") fd.set(schluessel, hauptteilkategorieSlugs[0]);
    else if (schluessel === "spielfeld") {
      fd.set("spielfeld_laenge", "");
      fd.set("spielfeld_breite", "");
    } else if (schluessel === "anzahl_max") {
      fd.set("anzahl_min", "");
      fd.set("anzahl_max", "");
    } else fd.set(schluessel, "x"); // name und die Felder des Ablaufs
  }
  return fd;
}

/** Prüft den Inhalt einer Übung dieser Altersstufe nach den Regeln des
 *  Formulars und nennt die Verstösse auf einmal (#143 AK 6): die Fehler des
 *  Formulars, die gesendeten Werte, die es verworfen hätte, und die
 *  unförmigen Zahlen. Nur zwei Fälle verschieben Befunde auf den nächsten
 *  Lauf: Ist die Einordnung ungültig, entfällt der Abgleich der verworfenen
 *  Werte; fehlt im Hauptteil die Hauptteilkategorie, der des Ablaufs.
 *  Ohne Verstoss liefert sie die Zeile des Formulars — genau die, die auch
 *  das Formular speicherte. */
export function pruefeUebungsInhalt(
  i: UebungInhalt,
  o: {
    altersstufe: Altersstufe;
    /** Beim Ändern (#144): die Eingabenamen, deren Wert aus der gespeicherten
     *  Übung stammt. Verwirft die Regel einen davon, sagt die Meldung, wie er
     *  sich entfernen lässt — gelöscht wird er nie still (PO 2026-09-29). */
    ausBestand?: ReadonlySet<string>;
  },
): Pruefung {
  const stufe = o.altersstufe;
  // Eine fremde Einordnung geht leer ins Formular: Sonst folgten aus ihr
  // Fehler am Ablauf, die mit der Korrektur der Einordnung hinfällig sind.
  const einordnungOk = einordnungsSlugsFuer(stufe).includes(i.einordnung);
  const fd = alsFormular(i, einordnungOk ? i.einordnung : "");
  const erst = parseUebungsInhalt(fd, { altersstufe: stufe });
  const fehler: Record<string, string> = erst.ok ? {} : erst.errors;

  const funde: Fund[] = [];
  for (const [schluessel, meldung] of Object.entries(fehler)) {
    if ("hauptteilkategorie" in fehler && ABLAUF.has(schluessel)) continue;
    funde.push(uebersetzt(schluessel, meldung, i, stufe));
  }
  funde.push(...zusatz(i));

  if (einordnungOk) {
    const zweit = erst.ok ? erst : parseUebungsInhalt(mitPlatzhaltern(fd, fehler, stufe), { altersstufe: stufe });
    if (zweit.ok) funde.push(...verworfen(i, zweit.row, stufe, fehler));
  }
  return erst.ok && funde.length === 0
    ? { ok: true, row: erst.row }
    : { ok: false, funde: funde.map((f) => mitAltwertZusatz(f, o.ausBestand)) };
}

/** Die Pflichtangaben, die sich nicht auf `null` setzen lassen. */
const NICHT_LEERBAR = new Set(["name", "einordnung", "kategorien"]);

/** Beim Ändern: Stammt die beanstandete Angabe unverändert aus der
 *  gespeicherten Übung, sagt der Verstoss, wie sie sich entfernen lässt —
 *  ob die Regel sie verworfen hätte oder sie selbst unförmig ist (etwa eine
 *  gespeicherte Anzahl 0). Massgeblich ist das oberste Feld
 *  («anzahl_kinder.min» → «anzahl_kinder»). */
function mitAltwertZusatz(f: Fund, ausBestand: ReadonlySet<string> | undefined): Fund {
  const feld = f.feld.split(/[.[]/)[0];
  if (!ausBestand?.has(feld) || NICHT_LEERBAR.has(feld)) return f;
  return { ...f, meldung: `${f.meldung} Die Angabe steht noch in der Übung - setze «${feld}» auf null, um sie zu entfernen.` };
}

/** Die Pflichtangaben einer Übung — je Altersstufe, Einordnung und, wo sie
 *  die Ablaufform bestimmt, Hauptteilkategorie. Aus denselben Funktionen wie
 *  `parseUebungsInhalt`; `check:kern` hält beide gegeneinander. */
export function pflichtangaben(
  stufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie?: string | null,
): string[] {
  return [
    "name",
    "einordnung",
    "kategorien",
    ...(traegtHauptteilkategorie(stufe, einordnung) ? ["hauptteilkategorie"] : []),
    ...(brauchtFahrplan(stufe, einordnung, hauptteilkategorie ?? null)
      ? ["offen_starten", "ueben", "wetteifern"]
      : ["aufbau"]),
  ];
}

/** Die Ablehnung einer Übung mit allen Verstössen. `regel`, sobald einer
 *  eine Fachregel verletzt, sonst `eingabe`. */
export function abgelehnt(funde: readonly Fund[], hinweis: string): KernFehler {
  return fehlschlag(funde.some((f) => f.art === "regel") ? "regel" : "eingabe", ABGELEHNT, {
    verstoesse: alsVerstoesse(funde),
    hinweis,
  });
}

/** Funde als Verstösse der Antwort: ohne ihre Art, die nach aussen der ganze
 *  Fehler trägt. */
export function alsVerstoesse(funde: readonly Fund[]): Verstoss[] {
  return funde.map(({ art: _art, ...v }) => v);
}

// ── Ändern (#144) ───────────────────────────────────────────────────────────

/** Die gespeicherte Übung als Kern-Eingabe — dieselbe Form, in der ein
 *  Werkzeug sie sendet, damit eine Änderung sie nur überlagert. */
export function inhaltAusZeile(z: UebungsZeile): UebungInhalt {
  const fahrplan = z.methodischer_fahrplan;
  return {
    name: z.name,
    einordnung: z.trainingsteil,
    kategorien: z.kategorien ?? [],
    hauptteilkategorie: z.hauptteilkategorie,
    offenStarten: fahrplan?.offen_starten ?? null,
    ueben: fahrplan?.ueben ?? null,
    wetteifern: fahrplan?.wetteifern ?? null,
    aufbau: z.aufbau,
    varianten: z.varianten_text,
    erscheinungsformen: z.erscheinungsform,
    uebungstyp: z.uebungstyp,
    feldtyp: z.feldtyp,
    spielfeld:
      z.spielfeld_laenge_m != null && z.spielfeld_breite_m != null
        ? { laengeM: z.spielfeld_laenge_m, breiteM: z.spielfeld_breite_m }
        : null,
    anzahlKinder: z.anzahl_kinder,
    material: { liste: parseMaterialListe(z.material_liste), ergaenzung: z.material ?? [] },
  };
}

/** Eine Änderung über die gespeicherte Übung legen. Was die Änderung nicht
 *  nennt, bleibt; `null` leert. `material` wird je Teil überlagert: `null`
 *  an `liste` oder `ergaenzung` leert diesen Teil, `material: null` beide.
 *  `ausBestand` sammelt die Eingabenamen der Angaben, die unverändert aus dem
 *  Bestand kommen und etwas tragen. */
export function ueberlagere(
  bestand: UebungInhalt,
  patch: UebungPatch,
): { inhalt: UebungInhalt; ausBestand: Set<string> } {
  const inhalt: Record<string, unknown> = { ...bestand };
  const ausBestand = new Set<string>();
  for (const k of Object.keys(bestand) as (keyof UebungInhalt)[]) {
    if (k === "material") continue;
    if (patch[k] !== undefined) inhalt[k] = patch[k];
    else if (gesendet(bestand[k])) ausBestand.add(k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`));
  }
  // Je Teil: fehlt er, bleibt der gespeicherte; `null` leert ihn.
  const teil = <T>(neu: readonly T[] | null | undefined, alt: readonly T[] | null | undefined) =>
    neu === undefined ? alt : (neu ?? []);
  const m = patch.material;
  inhalt.material =
    m === undefined
      ? bestand.material
      : m === null
        ? { liste: [], ergaenzung: [] }
        : {
            liste: teil(m.liste, bestand.material?.liste),
            ergaenzung: teil(m.ergaenzung, bestand.material?.ergaenzung),
          };
  return { inhalt: inhalt as UebungInhalt, ausBestand };
}

/** Die Spalten der geprüften Zeile, die sich vom Bestand unterscheiden —
 *  verglichen unabhängig von der Schlüsselreihenfolge, in der jsonb sie
 *  zurückgibt. Geschrieben wird nur sie: Was die Änderung nicht betrifft,
 *  bleibt, wie es gespeichert ist — auch eine gleichzeitige Änderung in der
 *  Oberfläche an einer anderen Angabe (#144 OoS 4). */
export function geaenderteSpalten(
  row: Record<string, unknown>,
  zeile: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([k, v]) => !isDeepStrictEqual(v, zeile[k])));
}
