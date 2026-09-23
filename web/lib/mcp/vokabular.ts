// Das Werkzeug «vokabular» (Story #142 AK 9): die Werte aller geführten
// Angaben samt Klartext und Zugehörigkeit, damit der Assistent Suchfilter —
// und später Übungen und Trainings — ohne Raten füllen kann.
//
// Hier wird NICHTS von Hand geschrieben. Jede Zeile ist abgeleitet aus
// - `lib/vocab.ts` (generiert aus data/vokabular.yaml) für Werte und Labels,
// - `lib/altersstufe.ts` für das Feld-Gating (jede Funktion dort spiegelt
//   einen SQL-CHECK — was hier steht, hält also auch die Datenbank),
// - `lib/junioren.ts` für die anziehenden Erscheinungsformen der Blöcke,
// - `lib/labels.ts`, `lib/training.ts` und `lib/filter-optionen.ts` für
//   Stufen-Namen, Übungstyp-Definitionen, die Hauptteilkategorien in ihrer
//   methodischen Reihenfolge und die Werte des Katalogfilters.
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
  traegtSpielfeldgroesse,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";
import { BLOCK_ERSCHEINUNGSFORM } from "@/lib/junioren";
import { UEBUNGSTYP_DEFINITION, kategorieStufe } from "@/lib/labels";
import { HAUPTTEILKATEGORIEN } from "@/lib/training";
import {
  einordnungFilterOptionenFuer,
  erscheinungsformOptionen,
  feldOptionen,
  uebungstypOptionen,
} from "@/lib/filter-optionen";
import { Wert } from "@/lib/mcp/bausteine";

const ABLAUF = z.enum(["fahrplan", "beschreibung"]);

export const EinordnungSchema = z.object({
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

export const AltersstufeSchema = z.object({
  slug: z.string(),
  label: z.string(),
  alterskategorien: z.array(Wert),
  trainingsteile: z.array(
    z.object({ slug: z.string(), label: z.string(), einordnungen: z.array(EinordnungSchema) }),
  ),
  hauptteilkategorien: z.array(z.object({ slug: z.string(), label: z.string(), ablauf: ABLAUF })),
  erscheinungsformen: z.array(Wert),
  feldtypen: z.array(Wert),
  spielfeldgroesse: z.boolean(),
  uebungstypen: z.array(z.object({ slug: z.string(), label: z.string(), definition: z.string() })),
});

export const VokabularSchema = z.object({
  altersstufen: z.array(AltersstufeSchema),
  /** Die Werte des Suchfilters `einordnung` von «uebungen_suchen», je mit
   *  ihrer Altersstufe — im Kinderfussball die Hauptteilkategorien statt des
   *  Hauptteils. */
  suchfilter_einordnung: z.array(
    z.object({ wert: z.string(), label: z.string(), altersstufe: z.string() }),
  ),
});

export type Vokabular = z.infer<typeof VokabularSchema>;

/** Option einer Filterleiste → Wert der Ausgabe. */
const alsWert = (o: { value: string; label: string }) => ({ slug: o.value, label: o.label });

function ablaufVon(stufe: Altersstufe, einordnung: string, hkat: string | null) {
  return brauchtFahrplan(stufe, einordnung, hkat) ? "fahrplan" : "beschreibung";
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
    spielfeldgroesse: traegtSpielfeldgroesse(stufe),
    uebungstypen: mitUebungstyp
      ? uebungstypOptionen.map((o) => ({
          ...alsWert(o),
          definition: UEBUNGSTYP_DEFINITION[o.value] ?? "",
        }))
      : [],
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
  };
}
