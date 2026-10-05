// Das Werkzeug «vokabular» (Story #142 AK 9): die Werte aller geführten
// Angaben samt Klartext und Zugehörigkeit, damit der Assistent Suchfilter —
// und später Übungen und Trainings — ohne Raten füllen kann.
//
// Hier wird NICHTS von Hand geschrieben. Jede Zeile ist abgeleitet aus
// - `lib/vocab.ts` (generiert aus data/vokabular.yaml) für Werte und Labels,
// - `lib/altersstufe.ts` für das Feld-Gating (jede Funktion dort spiegelt
//   einen SQL-CHECK — was hier steht, hält also auch die Datenbank),
// - `lib/junioren.ts` für die anziehenden Erscheinungsformen der Blöcke, die
//   Zeitbandbreiten und die vorgesehene Gesamtdauer,
// - `lib/labels.ts`, `lib/training.ts` und `lib/filter-optionen.ts` für
//   Stufen-Namen, Übungstyp-Definitionen, die Hauptteilkategorien in ihrer
//   methodischen Reihenfolge und die Werte des Katalogfilters,
// - `lib/feldtyp-richtmasse.ts` für die Richtmasse von Kleinfeld und
//   Grossfeld je Alterskategorie (#392),
// - für den Abschnitt `schema` (#199 AK 2, NFR 1) die Editor-Gliederung
//   (`editorGliederung` in lib/training.ts, dieselbe wie im Editor und in
//   «training_abrufen») und für die Veröffentlichungspflicht der Spiegel der
//   DB-Bedingungen (`fehlendeBedingungenAus` in lib/training-bedingungen.ts).
// `check:ki-zugang` prüft die Ausgabe gegen vocab.ts auf Vollständigkeit.
//
// REIN: keine Server-Importe.
import { z } from "zod";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import {
  ALTERSSTUFEN,
  brauchtFahrplan,
  einordnungenFuer,
  einordnungsSlugsFuer,
  kategorienFuer,
  traegtErscheinungsform,
  traegtFeldtyp,
  traegtHauptteilkategorie,
  FELDTYP_MIT_SPIELFELD,
  traegtUebungstyp,
  zielblock,
  type Altersstufe,
} from "@/lib/altersstufe";
import { BANDBREITEN, BLOCK_ERSCHEINUNGSFORM, GESAMTDAUER_JUNIOREN } from "@/lib/junioren";
import { UEBUNGSTYP_DEFINITION, kategorieStufe } from "@/lib/labels";
import {
  ANZAHL_HINWEIS,
  HAUPTTEILKATEGORIEN,
  editorGliederung,
  teilTraegtDauer,
} from "@/lib/training";
import { fehlendeBedingungenAus } from "@/lib/training-bedingungen";
import {
  einordnungFilterOptionenFuer,
  erscheinungsformOptionen,
  feldOptionen,
  uebungstypOptionen,
} from "@/lib/filter-optionen";
import { Wert } from "@/lib/mcp/bausteine";
import {
  FELDTYP_RICHTMASSE,
  FELDTYP_TORE,
  FELDTYPEN_MIT_RICHTMASS,
  richtmassText,
  type RichtmassKategorie,
} from "@/lib/feldtyp-richtmasse";

const ABLAUF = z.enum(["fahrplan", "beschreibung"]);

const EinordnungSchema = z.object({
  slug: z.string(),
  label: z.string(),
  /** `trainingsteil` im Kinderfussball (keine zweite Ebene), `block` im
   *  Juniorenfussball. */
  ebene: z.enum(["trainingsteil", "block"]),
  traegt_erscheinungsform: z.boolean(),
  traegt_uebungstyp: z.boolean(),
  hauptteilkategorie_pflicht: z.boolean(),
  /** Ablaufform einer Übung hier; `null` = hängt an der Hauptteilkategorie
   *  (siehe `hauptteilkategorien[].ablauf`). */
  ablauf: ABLAUF.nullable(),
  /** Erscheinungsform, deren Übungen dieser Block zusätzlich aufnimmt. */
  zieht_erscheinungsform_an: z.string().nullable(),
});

/** Eine Spanne in ganzen Metern; «ca. 20» ist min 20, max 20. */
const SpanneSchema = z.object({ min: z.number().int(), max: z.number().int() });

/** Die Richtmasse eines Feldtyps je Alterskategorie (#392). */
const FeldtypRichtmassSchema = z.object({
  feldtyp: Wert,
  /** Die Tore, auf die dieser Feldtyp spielt - die Torregel seiner Einstufung. */
  tore: z.string(),
  je_alterskategorie: z.array(
    z.object({
      alterskategorie: z.string(),
      laenge_m: SpanneSchema,
      breite_m: SpanneSchema,
      /** Nennt die Quelle das Mass nur ungefähr («ca.»)? */
      ungefaehr: z.boolean(),
      /** Kategorie, deren Mass hier gilt, weil die Quelle für diese keins
       *  kennt (Grossfeld in G → F); `null` = eigenes Mass. */
      wie_alterskategorie: z.string().nullable(),
      /** Klartext wie in der Quelle, etwa «ca. 20 × 15 m». */
      text: z.string(),
    }),
  ),
});

const AltersstufeSchema = z.object({
  slug: z.string(),
  label: z.string(),
  alterskategorien: z.array(Wert),
  trainingsteile: z.array(
    z.object({ slug: z.string(), label: z.string(), einordnungen: z.array(EinordnungSchema) }),
  ),
  hauptteilkategorien: z.array(z.object({ slug: z.string(), label: z.string(), ablauf: ABLAUF })),
  erscheinungsformen: z.array(Wert),
  feldtypen: z.array(Wert),
  /** Kann eine Übung dieser Stufe eine Spielfeldgrösse (Länge × Breite in
   *  Metern) tragen? */
  spielfeldgroesse: z.boolean(),
  /** Nur bei diesem Feldtyp — im Kinderfussball das freie Feld; `null`, wo
   *  sie nicht am Feldtyp hängt (Juniorenfussball). */
  spielfeldgroesse_bei_feldtyp: Wert.nullable(),
  /** Richtmasse von Kleinfeld und Grossfeld je Alterskategorie (#392); leer,
   *  wo die Stufe keinen Feldtyp kennt. */
  feldtyp_richtmasse: z.array(FeldtypRichtmassSchema),
  /** Wie Feldtypen eingestuft sind und was ihre Richtmasse bedeuten; `null`,
   *  wo die Stufe keinen Feldtyp kennt. */
  feldtyp_hinweis: z.string().nullable(),
  uebungstypen: z.array(z.object({ slug: z.string(), label: z.string(), definition: z.string() })),
});

/** Ein Zeitrichtwert des Manuals Fussball Jugendliche in Minuten. */
const RichtwertSchema = z.object({ min_min: z.number().int(), max_min: z.number().int() });

/** Ein Block des Trainingsschemas: die Stelle, an der eine Übung liegt.
 *  `einordnung` und `hauptteilkategorie` sind genau die Werte, die
 *  «training_uebung_zuordnen» und «training_uebungen_fuer_block» dafür
 *  erwarten — im Kinderfussball-Hauptteil ist der Block eine
 *  Hauptteilkategorie, sonst bleibt sie `null`. */
const SchemaBlockSchema = z.object({
  einordnung: z.string(),
  hauptteilkategorie: z.string().nullable(),
  label: z.string(),
  traegt_dauer: z.boolean(),
  traegt_gruppen: z.boolean(),
  /** Braucht ein öffentliches Training hier mindestens eine Übung? */
  pflicht_zum_veroeffentlichen: z.boolean(),
  /** Nur an Blöcken eines untergliederten Teils; sonst steht er am Teil. */
  richtwert: RichtwertSchema.nullable(),
  /** Was der Editor meldet, solange der Block leer ist; `null` = nichts. */
  leer_hinweis: z.string().nullable(),
  /** Erscheinungsform, deren Übungen dieser Block zusätzlich aufnimmt. */
  zieht_erscheinungsform_an: z.string().nullable(),
});

const SchemaTeilSchema = z.object({
  slug: z.string(),
  label: z.string(),
  /** 1-basiert, die feste Durchführungsreihenfolge. */
  reihenfolge: z.number().int(),
  richtwert: RichtwertSchema.nullable(),
  traegt_dauer: z.boolean(),
  /** Ist hier je Übung eine Hauptteilkategorie Pflicht (Kinderfussball-Hauptteil)? */
  hauptteilkategorie_pflicht: z.boolean(),
  /** Ab so vielen Übungen meldet der Editor «ungewöhnlich viele»; `null` = nie. */
  anzahl_hinweis_ab: z.number().int().nullable(),
  bloecke: z.array(SchemaBlockSchema),
});

const SchemaSchema = z.object({
  richtwerte_sind_orientierung: z.literal(true),
  richtwerte_hinweis: z.string(),
  altersstufen: z.array(
    z.object({
      altersstufe: z.string(),
      label: z.string(),
      /** Vorgesehene Gesamtdauer ab dem Einstieg; `null` = keine Vorgabe. */
      gesamtdauer_min: z.number().int().nullable(),
      teile: z.array(SchemaTeilSchema),
    }),
  ),
});

export const VokabularSchema = z.object({
  altersstufen: z.array(AltersstufeSchema),
  /** Die Werte des Suchfilters `einordnung` von «uebungen_suchen», je mit
   *  ihrer Altersstufe — im Kinderfussball die Hauptteilkategorien statt des
   *  Hauptteils. */
  suchfilter_einordnung: z.array(
    z.object({ wert: z.string(), label: z.string(), altersstufe: z.string() }),
  ),
  /** Das Trainingsschema je Altersstufe: Teile und Blöcke in Reihenfolge,
   *  mit Dauer, Gruppen, Veröffentlichungspflicht, Leer-Hinweis und
   *  Zeitrichtwert (#199 AK 2, NFR 1/2). */
  schema: SchemaSchema,
});

export type Vokabular = z.infer<typeof VokabularSchema>;

/** Option einer Filterleiste → Wert der Ausgabe. */
const alsWert = (o: { value: string; label: string }) => ({ slug: o.value, label: o.label });

function ablaufVon(stufe: Altersstufe, einordnung: string, hkat: string | null) {
  return brauchtFahrplan(stufe, einordnung, hkat) ? "fahrplan" : "beschreibung";
}

/** Die Erklärung zu Feldtyp und Richtmass (#392 AK 3-6) - im Vokabular am
 *  Kinderfussball und wortgleich in der Beschreibung von «vokabular». */
export const FELDTYP_HINWEIS =
  "Kleinfeld und Grossfeld sind nach den Toren einer Übung eingestuft, nicht nach ihrer " +
  "Fläche: Grossfeld spielt auf grosse Tore, Kleinfeld auf Minitore oder 3:3 in einem " +
  "abgegrenzten Feld. Ein grosses Tor einer Kinderfussball-Übung (Material «Tor», im " +
  "Unterschied zu «Minitor») meint ein 5-m-Tor (5 × 2 m). Den Platzbedarf in Metern " +
  "schätzen die Richtmasse je Alterskategorie in «feldtyp_richtmasse» ab, festgelegt nach " +
  "den SFV-Ausführungsbestimmungen Kinder- und Jugendfussball 2026/27; die Bestimmungen " +
  "kennen in G kein Grossfeld, dort gilt das Richtmass von F. Ein freies Feld ohne " +
  "Meterangabe («spielfeld» leer) hat keine bekannte Grösse. Der Juniorenfussball kennt " +
  "keinen Feldtyp und keine solche Torzuordnung; dort ist der Platzbedarf die freiwillige " +
  "Spielfeldgrösse.";

/** Der Verweis aus den Übungs-Werkzeugen, die einen Feldtyp liefern. */
export const FELDTYP_VERWEIS =
  "Wie Kleinfeld und Grossfeld eingestuft sind und wie gross sie je Alterskategorie " +
  "ungefähr sind, liefert «vokabular».";

function baueFeldtypRichtmasse(stufe: Altersstufe): z.infer<typeof FeldtypRichtmassSchema>[] {
  if (!traegtFeldtyp(stufe)) return [];
  return FELDTYPEN_MIT_RICHTMASS.map((ft) => ({
    feldtyp: alsWert(feldOptionen.find((o) => o.value === ft)!),
    tore: FELDTYP_TORE[ft],
    je_alterskategorie: kategorienFuer(stufe).map((k) => {
      const r = FELDTYP_RICHTMASSE[ft][k as RichtmassKategorie];
      // Fehlt ein Mass, soll das laut scheitern statt still zu fehlen;
      // `check:ki-zugang` fängt es vor jedem Deploy.
      if (!r) throw new Error(`Richtmass ${ft}/${k} fehlt in lib/feldtyp-richtmasse.ts`);
      return {
        alterskategorie: k,
        laenge_m: r.laenge_m,
        breite_m: r.breite_m,
        ungefaehr: r.ungefaehr,
        wie_alterskategorie: r.wie_kategorie,
        text: richtmassText(r),
      };
    }),
  }));
}

function baueAltersstufe(stufe: Altersstufe): z.infer<typeof AltersstufeSchema> {
  const einordnungen = einordnungsSlugsFuer(stufe);
  // Die Einordnung, die eine Hauptteilkategorie trägt — heute genau der
  // Kinderfussball-Hauptteil; gefragt wird das Gating, nicht der Slug.
  const mitHkat = einordnungen.find((e) => traegtHauptteilkategorie(stufe, e));
  const mitUebungstyp = einordnungen.some((e) => traegtUebungstyp(stufe, e));

  return {
    slug: stufe,
    label: altersstufeLabels[stufe],
    alterskategorien: kategorienFuer(stufe).map((k) => ({
      slug: k,
      label: kategorieStufe[k as keyof typeof kategorieStufe],
    })),
    // Ohne zweite Ebene (Kinderfussball) ist der Teil selbst die Einordnung.
    trainingsteile: einordnungenFuer(stufe).map((g) => {
      const ebene = g.bloecke.length > 0 ? ("block" as const) : ("trainingsteil" as const);
      const eintraege = ebene === "block" ? g.bloecke : [{ slug: g.teil, label: g.label }];
      return {
        slug: g.teil,
        label: g.label,
        einordnungen: eintraege.map((e) => {
          const hkatPflicht = traegtHauptteilkategorie(stufe, e.slug);
          return {
            slug: e.slug,
            label: e.label,
            ebene,
            traegt_erscheinungsform: traegtErscheinungsform(stufe, e.slug),
            traegt_uebungstyp: traegtUebungstyp(stufe, e.slug),
            hauptteilkategorie_pflicht: hkatPflicht,
            ablauf: hkatPflicht ? null : ablaufVon(stufe, e.slug, null),
            // Die Tabelle kennt nur Junioren-Blöcke; jeder andere Slug fällt
            // von selbst auf null.
            zieht_erscheinungsform_an:
              BLOCK_ERSCHEINUNGSFORM[e.slug as keyof typeof BLOCK_ERSCHEINUNGSFORM] ?? null,
          };
        }),
      };
    }),
    hauptteilkategorien: mitHkat
      ? HAUPTTEILKATEGORIEN.map((h) => ({
          slug: h.slug,
          label: h.label,
          ablauf: ablaufVon(stufe, mitHkat, h.slug),
        }))
      : [],
    erscheinungsformen: erscheinungsformOptionen(stufe).map(alsWert),
    feldtypen: traegtFeldtyp(stufe) ? feldOptionen.map(alsWert) : [],
    spielfeldgroesse: true,
    spielfeldgroesse_bei_feldtyp: traegtFeldtyp(stufe)
      ? alsWert(feldOptionen.find((o) => o.value === FELDTYP_MIT_SPIELFELD)!)
      : null,
    feldtyp_richtmasse: baueFeldtypRichtmasse(stufe),
    feldtyp_hinweis: traegtFeldtyp(stufe) ? FELDTYP_HINWEIS : null,
    uebungstypen: mitUebungstyp
      ? uebungstypOptionen.map((o) => ({
          ...alsWert(o),
          definition: UEBUNGSTYP_DEFINITION[o.value] ?? "",
        }))
      : [],
  };
}

/** Der Satz zu den Zeitrichtwerten (#199 NFR 2) — im Abschnitt `schema` und
 *  wortgleich in den Beschreibungen von «vokabular» und «training_abrufen». */
export const RICHTWERTE_HINWEIS =
  "Die Zeitrichtwerte stammen aus dem Manual Fussball Jugendliche und sind Orientierung, " +
  "keine Bedingung: Speichern und Veröffentlichen gelingen auch ausserhalb. Der " +
  "Kinderfussball gibt keine Zeiten vor. Das Auffangen zählt nicht zur Trainingszeit und " +
  "trägt weder Dauer noch Richtwert.";

/** Der Verweis vom Vokabular auf das konkrete Training — nur dort, nicht in
 *  der Beschreibung von «training_abrufen» selbst. */
export const RICHTWERTE_VERWEIS =
  "Summen und Abweichung eines konkreten Trainings nennt «training_abrufen».";

/** Braucht ein öffentliches Training an dieser Stelle eine Übung? Gefragt
 *  wird der Spiegel der DB-Bedingungen selbst: Eine Übung genau hier erfüllt
 *  eine Bedingung, die ein leeres Training verletzt. So steht die Antwort
 *  nirgends ein zweites Mal. */
function pflichtZumVeroeffentlichen(stufe: Altersstufe, einordnung: string, hkat: string | null) {
  const varianten = [{ id: "v" }];
  const fehlen = (fassungen: Parameters<typeof fehlendeBedingungenAus>[2]) =>
    fehlendeBedingungenAus(stufe, kategorienFuer(stufe), fassungen, varianten).length;
  return (
    fehlen([{ trainingsteil: einordnung, hauptteilkategorie: hkat, varianteId: "v" }]) < fehlen([])
  );
}

const richtwertVon = (slug: string | undefined) => {
  const band = slug ? BANDBREITEN[slug] : undefined;
  return band ? { min_min: band.min, max_min: band.max } : null;
};

/** Das Schema einer Altersstufe — die Gliederung eines leeren Trainings, wie
 *  der Editor sie zeigt. */
function baueSchema(stufe: Altersstufe): z.infer<typeof SchemaSchema>["altersstufen"][number] {
  return {
    altersstufe: stufe,
    label: altersstufeLabels[stufe],
    // Wie die Summenleiste des Editors: nur im Juniorenfussball.
    gesamtdauer_min: stufe === "juniorenfussball" ? GESAMTDAUER_JUNIOREN : null,
    teile: editorGliederung(stufe, []).map((t, i) => ({
      slug: t.key,
      label: t.label,
      reihenfolge: i + 1,
      richtwert: richtwertVon(t.richtwertSlug),
      traegt_dauer: teilTraegtDauer(t.key),
      hauptteilkategorie_pflicht: traegtHauptteilkategorie(stufe, t.key),
      // Den Hinweis gibt der Editor nur im Kinderfussball (`tooMany` in
      // `editorGliederung`); er erscheint bei MEHR als dem Schwellenwert.
      anzahl_hinweis_ab:
        stufe === "kinderfussball" ? ANZAHL_HINWEIS[t.key as keyof typeof ANZAHL_HINWEIS] + 1 : null,
      bloecke: t.bloecke.map((b) => {
        const hkat = b.hkat ?? null;
        const ziel = zielblock(stufe, b.einordnung, hkat);
        return {
          einordnung: b.einordnung,
          hauptteilkategorie: hkat,
          label: b.label,
          traegt_dauer: b.traegtDauer,
          traegt_gruppen: b.traegtGruppen,
          pflicht_zum_veroeffentlichen: pflichtZumVeroeffentlichen(stufe, b.einordnung, hkat),
          // Ein einblockiger Teil nennt seinen Richtwert einmal, am Teil.
          richtwert: b.flaeche ? richtwertVon(b.richtwertSlug) : null,
          leer_hinweis: b.leerHinweis ?? null,
          zieht_erscheinungsform_an: (ziel.ok && ziel.filter.erscheinungsformen?.[0]) || null,
        };
      }),
    })),
  };
}

/** Das ganze Vokabular. Rein und deterministisch — es hängt an keinem
 *  Konto, darum ohne Datenbank. */
export function baueVokabular(): Vokabular {
  return {
    altersstufen: ALTERSSTUFEN.map(baueAltersstufe),
    suchfilter_einordnung: ALTERSSTUFEN.flatMap((stufe) =>
      einordnungFilterOptionenFuer(stufe).map((o) => ({
        wert: o.value,
        label: o.label,
        altersstufe: stufe,
      })),
    ),
    schema: {
      richtwerte_sind_orientierung: true,
      richtwerte_hinweis: `${RICHTWERTE_HINWEIS} ${RICHTWERTE_VERWEIS}`,
      altersstufen: ALTERSSTUFEN.map(baueSchema),
    },
  };
}
