// Die fachlichen Hinweise zu einem Training (#195) — dieselben, die der Editor
// zeigt, als eine Liste für den KI-Assistenten.
//
// Nichts hier rechnet neu: Jede Art kommt aus der Funktion, aus der auch die
// Oberfläche zeichnet (Veröffentlichungsbedingungen, Editor-Gliederung,
// Gruppen-Befund, Zeitabgleich, Stufen-Abgleich), und jeder Text ist die
// Konstante, die die Komponente rendert. So kann ein Hinweis nicht anders
// lauten als in der Anwendung (PC 2) — `check:hinweise` prüft das.
//
// Hinweise sind keine Fehler (NFR 3): Sie kommen als gewöhnliches Ergebnis.
// Nur die Veröffentlichungsbedingungen sperren etwas (`sperrt: true`), und
// auch sie erst beim Veröffentlichen (OoS 2).
//
// Gerechnet wird je Variante des Hauptteils wie im Editor, der immer eine
// Variante zeigt (`sichtbareZuordnungen`). Was ausserhalb des Hauptteils
// liegt, ist in jeder Variante gleich und erscheint darum nur einmal; die
// Variante steht in der Stelle erst ab zwei (Epic EK 7).
//
// REIN: nur zod und reine lib-Module — `check:hinweise` lädt diese Datei mit tsx.
import { z } from "zod";
import { FREIES_SPIEL, type Altersstufe } from "@/lib/altersstufe";
import { konfliktBefund, verteilungAus } from "@/lib/gruppen";
import { GESAMTDAUER_JUNIOREN, JUNIOREN_TEILE, gesamtAbgleich, zeitAbgleich } from "@/lib/junioren";
import {
  ANZAHL_HINWEIS_TEXT,
  STUFE_ABWEICHEND_TEXT,
  editorGliederung,
  ohneDauerText,
  stufenAbgedeckt,
  teilTraegtDauer,
} from "@/lib/training";
import {
  ZUM_VEROEFFENTLICHEN_FEHLT,
  bedingungText,
  fehlendeBedingungenAus,
  type Bedingung,
} from "@/lib/training-bedingungen";
import { sichtbareZuordnungen } from "@/lib/varianten";
import type { TrainingDetail } from "@/lib/queries/trainings-fuer";

/** Die acht Arten (PO 2026-09-23), in der Reihenfolge der Beschreibung. */
export const HINWEIS_ARTEN = [
  "veroeffentlichung",
  "gruppe_doppelt",
  "dauer_ungleich",
  "zeitrichtwert",
  "block_leer",
  "teil_voll",
  "dauer_fehlt",
  "stufe_abweichend",
] as const;
export type HinweisArt = (typeof HINWEIS_ARTEN)[number];

/** Wo ein Hinweis sitzt (AK 8, NFR 2) — so genau, dass der Assistent ihn
 *  beheben kann: Teil und Block als Slug wie in `training_abrufen`, im
 *  Kinderfussball-Hauptteil die Kategorie statt eines Blocks. */
export type HinweisStelle = {
  teil?: string;
  block?: string;
  hauptteilkategorie?: string;
  /** Nur ab zwei Varianten und nur bei Hinweisen, die von der Variante abhängen. */
  varianteId?: string;
  fassungIds?: string[];
  gruppeId?: string;
  /** 1-basiert, wie «1. Wechsel» im Text. */
  wechsel?: number[];
  /** Die Gesamtdauer des Trainings. */
  gesamt?: true;
};

export type Hinweis = {
  art: HinweisArt;
  stelle: HinweisStelle;
  /** Wortgleich mit der Oberfläche. */
  text: string;
  sperrt: boolean;
  /** Nur bei `zeitrichtwert`: Richtwert und Ist in Minuten. */
  richtwert?: { minMin: number; maxMin: number; summeMin: number; abweichungMin: number };
};

/** Was die Hinweise von einem Training brauchen. */
export type HinweisTraining = Pick<
  TrainingDetail,
  "altersstufe" | "stufen" | "exercises" | "gruppen" | "varianten" | "team" | "ownerId"
>;

/** Die Stelle einer Einordnung: im Juniorenfussball Teil und Block, im
 *  Kinderfussball der Teil, im Hauptteil samt Kategorie. */
function stelleVon(
  altersstufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie?: string | null,
): HinweisStelle {
  if (altersstufe === "juniorenfussball") {
    const teil = JUNIOREN_TEILE.find((t) => t.bloecke.some((b) => b.slug === einordnung));
    return teil ? { teil: teil.slug, block: einordnung } : { block: einordnung };
  }
  return hauptteilkategorie ? { teil: einordnung, hauptteilkategorie } : { teil: einordnung };
}

/** Wo eine fehlende Veröffentlichungsbedingung behoben wird. */
function stelleDerBedingung(altersstufe: Altersstufe, b: Bedingung): HinweisStelle {
  if (b === "stufe") return {};
  if (b === "freies_spiel") return { teil: "hauptteil", hauptteilkategorie: FREIES_SPIEL };
  return stelleVon(altersstufe, b);
}

/**
 * Alle fachlichen Hinweise zu einem Training, in der Reihenfolge: erst was
 * sperrt, dann je Variante die Gliederung von oben nach unten samt
 * Gesamtdauer und Gruppen-Befund, zuletzt die Übungen ausserhalb der Stufen.
 *
 * Die Veröffentlichungsbedingungen kommen nur beim eigenen persönlichen
 * Training — nur dort steht das Veröffentlichen offen (wie
 * `app/training/[id]/page.tsx`): Ein Team-Training wird nicht
 * veröffentlicht, ein fremdes nicht von diesem Konto.
 *
 * Nur, was zur Altersstufe gehört (AK 9): Zeitrichtwerte gibt es allein im
 * Juniorenfussball, «ungewöhnlich viele Übungen» allein im Kinderfussball —
 * beides entscheidet schon die Editor-Gliederung.
 */
export function hinweiseFuer(t: HinweisTraining, userId: string): Hinweis[] {
  const hinweise: Hinweis[] = [];
  const junioren = t.altersstufe === "juniorenfussball";
  const mehrere = t.varianten.length > 1;

  // ── Veröffentlichungsbedingungen (AK 2) ───────────────────────────────────
  if (!t.team && t.ownerId === userId) {
    for (const b of fehlendeBedingungenAus(t.altersstufe, t.stufen, t.exercises, t.varianten)) {
      const name = b.varianteId ? t.varianten.find((v) => v.id === b.varianteId)?.name : undefined;
      hinweise.push({
        art: "veroeffentlichung",
        stelle: {
          ...stelleDerBedingung(t.altersstufe, b.bedingung),
          ...(b.varianteId ? { varianteId: b.varianteId } : {}),
        },
        text: `${ZUM_VEROEFFENTLICHEN_FEHLT} ${bedingungText(b.bedingung, name)}`,
        sperrt: true,
      });
    }
  }

  // ── je Variante: was der Editor an dieser Variante zeigt ──────────────────
  // Ohne Variante (nach Lage der Daten unmöglich) einmal über alles.
  const varianten: ({ id: string } | undefined)[] = t.varianten.length ? t.varianten : [undefined];
  for (const v of varianten) {
    const sichtbar = sichtbareZuordnungen(t.exercises, v?.id);
    // Die Variante gehört nur an Hinweise, die von ihr abhängen — die des
    // Hauptteils und die Gesamtdauer.
    const inVariante: HinweisStelle = mehrere && v ? { varianteId: v.id } : {};

    for (const teil of editorGliederung(t.altersstufe, sichtbar)) {
      const zuVariante = teil.key === "hauptteil" ? inVariante : {};

      // Zeitrichtwert des Teils (AK 5) — wie der Kopf der Teil-Karte.
      if (junioren && teil.richtwertSlug) {
        const a = zeitAbgleich(teil.richtwertSlug, teil.sum);
        if (a && teil.sum > 0 && a.abweichungMin !== 0)
          hinweise.push({
            art: "zeitrichtwert",
            stelle: { teil: teil.key, ...zuVariante },
            text: a.richtwertText + a.abweichungText,
            sperrt: false,
            richtwert: {
              minMin: a.band.min,
              maxMin: a.band.max,
              summeMin: teil.sum,
              abweichungMin: a.abweichungMin,
            },
          });
      }

      for (const b of teil.bloecke) {
        const stelle = { ...stelleVon(t.altersstufe, b.einordnung, b.hkat), ...zuVariante };
        // Zeitrichtwert des Blocks: nur, wo der Block eine eigene Fläche
        // trägt — ein einblockiger Teil nennt seinen Richtwert einmal, am Teil
        // (`Unterblock`).
        if (junioren && b.flaeche && b.richtwertSlug) {
          const a = zeitAbgleich(b.richtwertSlug, b.sum);
          if (a && b.sum > 0 && a.abweichungMin !== 0)
            hinweise.push({
              art: "zeitrichtwert",
              stelle,
              text: a.richtwertText + a.abweichungText,
              sperrt: false,
              richtwert: {
                minMin: a.band.min,
                maxMin: a.band.max,
                summeMin: b.sum,
                abweichungMin: a.abweichungMin,
              },
            });
        }
        // Leerer Block mit Hinweis (AK 6) — wie `ExerciseList`.
        if (b.leerHinweis && b.items.length === 0)
          hinweise.push({ art: "block_leer", stelle, text: b.leerHinweis, sperrt: false });
      }

      // Ungewöhnlich viele Übungen (AK 7) — nur im Kinderfussball gesetzt.
      if (teil.tooMany)
        hinweise.push({
          art: "teil_voll",
          stelle: { teil: teil.key, ...zuVariante },
          text: ANZAHL_HINWEIS_TEXT,
          sperrt: false,
        });

      // Übungen ohne Dauer — wie der Fuss der Teil-Karte. Die Einordnungen des
      // Teils: im Juniorenfussball seine Blöcke, sonst der Teil selbst (auch
      // eine Hauptteil-Fassung ohne Kategorie zählt, wie in der Summe).
      if (teil.missing > 0) {
        const einordnungen: string[] = junioren ? teil.bloecke.map((b) => b.einordnung) : [teil.key];
        const ohne = sichtbar.filter(
          (f) =>
            einordnungen.includes(f.trainingsteil) &&
            teilTraegtDauer(f.trainingsteil) &&
            f.durationMin == null,
        );
        hinweise.push({
          art: "dauer_fehlt",
          stelle: { teil: teil.key, ...zuVariante, fassungIds: ohne.map((f) => f.id) },
          text: ohneDauerText(teil.missing),
          sperrt: false,
        });
      }
    }

    // Gesamtdauer gegen die vorgesehenen 90 Minuten — wie die Summenleiste.
    if (junioren) {
      const summe = sichtbar
        .filter((f) => teilTraegtDauer(f.trainingsteil))
        .reduce((a, f) => a + (f.durationMin ?? 0), 0);
      const g = gesamtAbgleich(summe, GESAMTDAUER_JUNIOREN);
      if (g.abweichungMin !== 0)
        hinweise.push({
          art: "zeitrichtwert",
          stelle: { gesamt: true, ...inVariante },
          text: g.vorgesehenText + g.abweichungText,
          sperrt: false,
          richtwert: {
            minMin: GESAMTDAUER_JUNIOREN,
            maxMin: GESAMTDAUER_JUNIOREN,
            summeMin: summe,
            abweichungMin: g.abweichungMin,
          },
        });
    }

    // Gruppenverteilung (AK 3/4) — derselbe Befund wie am Fuss der Hauptteil-Karte.
    for (const k of konfliktBefund(verteilungAus(sichtbar), t.gruppen).konflikte)
      hinweise.push({
        art: k.art === "doppelt" ? "gruppe_doppelt" : "dauer_ungleich",
        stelle: {
          teil: "hauptteil",
          ...inVariante,
          ...(k.gruppeId ? { gruppeId: k.gruppeId } : {}),
          wechsel: k.wechsel,
          fassungIds: k.fassungIds,
        },
        text: k.text,
        sperrt: false,
      });
  }

  // ── Übungen ausserhalb der Stufen — über alle Varianten ───────────────────
  // Ohne eigene Kategorien gibt es nichts abzudecken (wie an der Zeile).
  for (const f of t.exercises) {
    if (f.kategorien.length === 0 || stufenAbgedeckt(t.stufen, f.kategorien)) continue;
    hinweise.push({
      art: "stufe_abweichend",
      stelle: {
        ...stelleVon(t.altersstufe, f.trainingsteil, f.hauptteilkategorie),
        ...(mehrere && f.varianteId ? { varianteId: f.varianteId } : {}),
        fassungIds: [f.id],
      },
      text: STUFE_ABWEICHEND_TEXT,
      sperrt: false,
    });
  }

  // Was ausserhalb des Hauptteils liegt, kam je Variante einmal — gleiche
  // Art, Stelle und Text sind derselbe Hinweis.
  const gesehen = new Set<string>();
  return hinweise.filter((h) => {
    const schluessel = JSON.stringify([h.art, h.stelle, h.text]);
    if (gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
}

// ── Aussen: der Vertrag des Werkzeugs «training_hinweise_abrufen» ───────────────────
// Einmal als zod-Schema (wie lib/kern/auskunft-schema.ts): Das Werkzeug meldet
// es als `outputSchema`, `alsAuskunft` baut danach, und das SDK prüft jede
// Antwort. Aussen snake_case wie alle Werkzeug-Ergebnisse.

export const HinweisAuskunft = z.object({
  art: z.enum(HINWEIS_ARTEN),
  stelle: z.object({
    teil: z.string().optional().describe("Slug des Trainingsteils."),
    block: z.string().optional().describe("Slug des Blocks (Juniorenfussball)."),
    hauptteilkategorie: z.string().optional().describe("Kinderfussball-Hauptteil: die Kategorie."),
    variante_id: z.string().optional().describe("Die Variante des Hauptteils (erst ab zwei)."),
    fassung_ids: z.array(z.string()).optional().describe("Die betroffenen Übungen im Training."),
    gruppe_id: z.string().optional(),
    wechsel: z.array(z.number().int()).optional().describe("Wechsel, 1-basiert."),
    gesamt: z.literal(true).optional().describe("Die Gesamtdauer des Trainings."),
  }),
  text: z.string().describe("Derselbe Wortlaut wie in KiFu."),
  sperrt: z.boolean(),
  richtwert: z
    .object({
      min_min: z.number().int(),
      max_min: z.number().int(),
      summe_min: z.number().int(),
      abweichung_min: z.number().int(),
    })
    .optional(),
});
export type HinweisAuskunft = z.infer<typeof HinweisAuskunft>;

export const HinweiseAuskunft = z.object({ hinweise: z.array(HinweisAuskunft) });

/** Ein Hinweis in der Form des Werkzeug-Ergebnisses. */
export function alsAuskunft(h: Hinweis): HinweisAuskunft {
  const s = h.stelle;
  return {
    art: h.art,
    stelle: {
      ...(s.teil !== undefined && { teil: s.teil }),
      ...(s.block !== undefined && { block: s.block }),
      ...(s.hauptteilkategorie !== undefined && { hauptteilkategorie: s.hauptteilkategorie }),
      ...(s.varianteId !== undefined && { variante_id: s.varianteId }),
      ...(s.fassungIds !== undefined && { fassung_ids: s.fassungIds }),
      ...(s.gruppeId !== undefined && { gruppe_id: s.gruppeId }),
      ...(s.wechsel !== undefined && { wechsel: s.wechsel }),
      ...(s.gesamt && { gesamt: true as const }),
    },
    text: h.text,
    sperrt: h.sperrt,
    ...(h.richtwert && {
      richtwert: {
        min_min: h.richtwert.minMin,
        max_min: h.richtwert.maxMin,
        summe_min: h.richtwert.summeMin,
        abweichung_min: h.richtwert.abweichungMin,
      },
    }),
  };
}
