import "server-only";
import { materialAusgabe } from "@/lib/material-ausgabe";
import { parseMaterialListe } from "@/lib/material";
import type { z } from "zod";
import { getExerciseDetailFuer, type ExerciseDetail } from "@/lib/queries/exercises";
import {
  getExercisesFuer,
  type ExerciseFilters,
  type ExerciseListRow,
} from "@/lib/queries/uebungen-fuer";
import {
  altersstufe as altersstufeLabels,
  feldtyp as feldtypLabels,
  hauptteilkategorie as hauptteilkategorieLabels,
  uebungstyp as uebungstypLabels,
} from "@/lib/vocab";
import { alsAltersstufe, einordnungenFuer, teilDerEinordnung } from "@/lib/altersstufe";
import {
  EINORDNUNG_LABEL,
  ERSCHEINUNGSFORM_LABEL,
  HERKUNFT_LABEL,
  herkunftArt,
  kategorieStufe,
} from "@/lib/labels";
import { einordnungNachSpalten } from "@/lib/filter-optionen";
import { hatDiagramm } from "@/lib/diagramm";
import { NICHT_GEFUNDEN, fehlschlag, ok } from "@/lib/kern/ergebnis";
import { istUuid } from "@/lib/kennung";
import { sichtbarkeitVon, wert, wertOderNull, type UebungKopf } from "@/lib/mcp/bausteine";
import {
  AbrufEingabe,
  SucheAusgabe,
  SucheEingabe,
  type SuchTreffer,
  UebungAusgabe,
} from "@/lib/mcp/eingaben";
import { werkzeug, type Zugang } from "@/lib/mcp/werkzeug";

/**
 * Übungsbestand durchsuchen und abrufen (Story #142 AK 7, 8, 10).
 *
 * Beide Werkzeuge sind dünne Adapter über dieselben Queries wie Katalog und
 * Detailseite (`getExercisesFuer`, `getExerciseDetailFuer`): dieselben
 * Filter, dieselbe Sortierung, und die Sichtbarkeit entscheidet allein RLS
 * mit dem Token des Kontos (NFR 5). Eine fremde private Übung ist darum
 * «nicht gefunden» — ununterscheidbar von einer, die es nicht gibt (AK 10).
 * Favoriten bleiben aussen vor (`favoriten: false`, Erlauben-Seite).
 *
 * Treffer und volle Übung entstehen über denselben Kopf und dieselben
 * Label-Tabellen wie Karte und Detailseite — kein zweiter Satz Klartexte.
 */

/** Was Listen- und Detailzeile gemeinsam tragen. */
type Grunddaten = Pick<
  ExerciseListRow,
  | "id"
  | "slug"
  | "name"
  | "altersstufe"
  | "trainingsteil"
  | "hauptteilkategorie"
  | "feldtyp"
  | "kategorien"
  | "source"
  | "visibility"
  | "bild_url"
>;

function kopf(ex: Grunddaten, zugang: Zugang, mitDiagramm: boolean): z.infer<typeof UebungKopf> {
  return {
    id: ex.id,
    slug: ex.slug,
    name: ex.name,
    url: zugang.url("uebung", ex.slug),
    altersstufe: wert(altersstufeLabels, ex.altersstufe),
    einordnung: wert(EINORDNUNG_LABEL, ex.trainingsteil),
    hauptteilkategorie: wertOderNull(hauptteilkategorieLabels, ex.hauptteilkategorie),
    feldtyp: wertOderNull(feldtypLabels, ex.feldtyp),
    herkunft: wert(HERKUNFT_LABEL, herkunftArt(ex.source, ex.visibility)),
    sichtbarkeit: sichtbarkeitVon(ex.visibility),
    bild_url: ex.bild_url,
    hat_diagramm: mitDiagramm,
  };
}

const kategorienVon = (k: string[] | null) => (k ?? []).map((s) => wert(kategorieStufe, s));

/** Ein Suchtreffer — auch für «training_uebungen_fuer_block» (#192 NFR 2). */
export function alsTreffer(row: ExerciseListRow, zugang: Zugang): z.infer<typeof SuchTreffer> {
  return { ...kopf(row, zugang, hatDiagramm(row.diagramm)), kategorien: kategorienVon(row.kategorien) };
}

function alsUebung(ex: ExerciseDetail, zugang: Zugang): z.infer<typeof UebungAusgabe> {
  const stufe = alsAltersstufe(ex.altersstufe);
  const teilLabels = Object.fromEntries(einordnungenFuer(stufe).map((g) => [g.teil, g.label]));
  const mitDiagramm = hatDiagramm(ex.diagramm);
  const fahrplan = ex.methodischer_fahrplan;
  return {
    ...kopf({ ...ex, altersstufe: stufe }, zugang, mitDiagramm),
    kategorien: kategorienVon(ex.kategorien),
    trainingsteil: wert(teilLabels, teilDerEinordnung(stufe, ex.trainingsteil)),
    erscheinungsformen: (ex.erscheinungsform ?? []).map((f) => wert(ERSCHEINUNGSFORM_LABEL, f)),
    uebungstyp: wertOderNull(uebungstypLabels, ex.uebungstyp),
    spielfeld:
      ex.spielfeld_laenge_m != null && ex.spielfeld_breite_m != null
        ? { laenge_m: ex.spielfeld_laenge_m, breite_m: ex.spielfeld_breite_m }
        : null,
    anzahl_kinder: ex.anzahl_kinder
      ? { min: ex.anzahl_kinder.min ?? null, max: ex.anzahl_kinder.max ?? null }
      : null,
    material: materialAusgabe(parseMaterialListe(ex.material_liste), ex.material ?? []),
    methodischer_fahrplan: fahrplan
      ? {
          offen_starten: fahrplan.offen_starten ?? "",
          ueben: fahrplan.ueben ?? [],
          wetteifern: fahrplan.wetteifern ?? null,
        }
      : null,
    aufbau: ex.aufbau,
    varianten: ex.varianten,
    bild_quelle: ex.bild_quelle,
    diagramm: mitDiagramm ? ex.diagramm : null,
    // Statt der Eigentümer-ID: fremde Konto-IDs gibt kein Werkzeug aus.
    eigene: ex.owner_id === zugang.userId,
  };
}

export const uebungenSuchen = werkzeug({
  name: "uebungen_suchen",
  titel: "Übungen suchen",
  beschreibung:
    "Durchsucht den Übungsbestand, den dein Konto in KiFu sieht (Kifu-Manual, " +
    "öffentliche Community-Übungen und eigene Übungen), mit denselben Filtern und " +
    "derselben Sortierung (nach Name) wie der Katalog. Dimensionen wirken als UND, " +
    "mehrere Werte innerhalb einer Dimension als ODER. Die zulässigen Werte und ihre " +
    "Zugehörigkeit liefert «vokabular». Liefert je Treffer die Angaben der Katalog-Karte " +
    "und eine Adresse in KiFu; alle Angaben einer Übung liefert «uebung_abrufen». " +
    "Seitenweise: «naechster_offset» als «offset» übernehmen. Favoriten sind über " +
    "diesen Zugang nicht erreichbar.",
  nurLesen: true,
  eingabe: SucheEingabe,
  ausgabe: SucheAusgabe,
  ausfuehren: async (e, zugang) => {
    const filter: ExerciseFilters = {
      q: e.q || undefined,
      altersstufe: e.altersstufe,
      kat: e.kategorien,
      feld: e.feldtyp,
      form: e.erscheinungsform,
      typ: e.uebungstyp,
      kinder: e.kinder,
      mine: e.nur_eigene,
      // Wie der Katalog (app/page.tsx): Trainingsteile/Blöcke und
      // Hauptteilkategorien als EINE ODER-Dimension über zwei Spalten.
      einordnung: e.einordnung?.length ? einordnungNachSpalten(e.einordnung) : undefined,
    };
    const rows = await getExercisesFuer(zugang.supabase, zugang.userId, filter, {
      favoriten: false,
    });
    // Seitenweise in JS über die eine Katalog-Abfrage: bewusst derselbe
    // Abfrageweg wie der Katalog, der ebenfalls den ganzen Bestand lädt.
    const weiter = e.offset + e.limit;
    return ok({
      gesamt: rows.length,
      offset: e.offset,
      limit: e.limit,
      naechster_offset: weiter < rows.length ? weiter : null,
      treffer: rows.slice(e.offset, weiter).map((r) => alsTreffer(r, zugang)),
    });
  },
});

export const uebungAbrufen = werkzeug({
  name: "uebung_abrufen",
  titel: "Übung abrufen",
  beschreibung:
    "Liefert eine Übung mit allen Angaben, die ihre Seite in KiFu zeigt: Einordnung, " +
    "Alterskategorien, Gruppengrösse, Material, Ablauf (methodischer Fahrplan oder " +
    "Beschreibung), Varianten, Herkunft und das Feld-Diagramm als Vektordaten. " +
    "Kennung ist die id oder der slug aus «uebungen_suchen». Eine Übung, die dein " +
    "Konto nicht sehen darf, gilt als nicht gefunden.",
  nurLesen: true,
  eingabe: AbrufEingabe,
  ausgabe: UebungAusgabe,
  ausfuehren: async ({ kennung }, zugang) => {
    const ex = await getExerciseDetailFuer(
      zugang.supabase,
      istUuid(kennung) ? { id: kennung } : { slug: kennung },
    );
    if (!ex) return fehlschlag("nicht_gefunden", NICHT_GEFUNDEN.uebung, { feld: "kennung" });
    return ok(alsUebung(ex, zugang));
  },
});
