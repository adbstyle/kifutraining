import "server-only";
import { z } from "zod";
import { kategorienSlugs } from "@/lib/vocab";
import { ALTERSSTUFEN } from "@/lib/altersstufe";
import { EINORDNUNG_LABEL, kategorieStufe } from "@/lib/labels";
import { NOTIZ_MAX, OHNE_DAUER_TEILE, TRAINING_NAME_MAX, ZIEL_MAX } from "@/lib/training";
import { abgebildet } from "@/lib/kern/ergebnis";
import {
  benenneTrainingUm,
  setzeAufEntwurf,
  setzeStufen,
  setzeZiel,
  veroeffentliche,
} from "@/lib/kern/training";
import { TRAGWEITE_VEROEFFENTLICHEN } from "@/lib/training-bedingungen";
import { entferneUebung, setzeDauer, setzeNotiz, setzeUebungsfolge } from "@/lib/kern/fassung";
import { Wert, alsEnum, kennung, wert } from "@/lib/mcp/bausteine";
import {
  Einordnung,
  FassungId,
  Hauptteilkategorie,
  KENNUNG_FEHLER,
  TrainingId,
  kategorienText,
} from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Ein bestehendes Training überarbeiten (Story #193 AK 3–13).
 *
 * Dünne Adapter über den Fachkern (lib/kern/training.ts, lib/kern/fassung.ts)
 * — dieselben Funktionen, die Editor-Kopf und Editor-Zeile aufrufen, also
 * dieselben Regeln und wortgleich dieselben Meldungen. Zod prüft nur Typ,
 * Enum und Kennungsformat; Längen, «mindestens eine» und jede Fachregel prüft
 * der Kern und benennt sie samt Feld (#193 PC 4, NFR 2).
 *
 * Bewusst nicht dabei (#193 OoS 1–3): den Inhalt einer Übung ändern, eine
 * Übung in einen anderen Trainingsteil hängen, eine Übung in die Bibliothek
 * kopieren. Und kein Verschieben um eine Position — das Ordnen setzt die
 * ganze Folge in einem Zug.
 */

/** «Auffangen (auffangen, jun-auffangen)» — aus der Regelquelle, beide Altersstufen. */
const OHNE_DAUER = `Auffangen (${[...OHNE_DAUER_TEILE].join(", ")})`;

// ── training_umbenennen ─────────────────────────────────────────────────────

export const trainingUmbenennen = werkzeug({
  name: "training_umbenennen",
  titel: "Training umbenennen",
  beschreibung:
    `Ändert den Namen eines Trainings (nicht leer, höchstens ${TRAINING_NAME_MAX} Zeichen). ` +
    `Gilt für eigene Trainings und die deiner Teams. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    name: z.string().describe(`Neuer Name, höchstens ${TRAINING_NAME_MAX} Zeichen.`),
  }),
  ausgabe: z.object({ name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await benenneTrainingUm(zugang.supabase, zugang.userId, {
        trainingId: e.training_id,
        name: e.name,
      }),
      (w) => ({ name: w.name }),
    ),
});

// ── training_ziel_setzen ────────────────────────────────────────────────────

export const trainingZielSetzen = werkzeug({
  name: "training_ziel_setzen",
  titel: "Ziel des Trainings setzen",
  beschreibung:
    `Setzt, ändert oder entfernt das Ziel eines Trainings (höchstens ${ZIEL_MAX} Zeichen). ` +
    `«null» oder ein leerer Text entfernt es. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    ziel: z
      .string()
      .nullable()
      .describe(`Das Ziel, höchstens ${ZIEL_MAX} Zeichen; «null» entfernt es.`),
  }),
  ausgabe: z.object({ ziel: z.string().nullable() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeZiel(zugang.supabase, zugang.userId, { trainingId: e.training_id, ziel: e.ziel }),
      (w) => ({ ziel: w.ziel }),
    ),
});

// ── training_kategorien_setzen ──────────────────────────────────────────────

export const trainingKategorienSetzen = werkzeug({
  name: "training_kategorien_setzen",
  titel: "Alterskategorien des Trainings setzen",
  beschreibung:
    "Ersetzt die Alterskategorien eines Trainings. Mindestens eine bleibt, alle aus der " +
    "Altersstufe des Trainings (die Altersstufe selbst steht fest). Übungen, die danach " +
    "keine der Kategorien mehr abdecken, bleiben im Training und werden in " +
    "«nicht_mehr_passend» genannt — über alle Varianten. Ob sie bleiben, entscheidest du; " +
    `entfernen lassen sie sich mit «training_uebung_entfernen». ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    stufen: z
      .array(alsEnum(kategorienSlugs))
      .describe(`Die neuen Alterskategorien. ${kategorienText(ALTERSSTUFEN)}.`),
  }),
  ausgabe: z.object({
    stufen: z.array(Wert),
    nicht_mehr_passend: z.array(
      z.object({ fassung_id: z.string(), name: z.string(), variante_id: z.string().nullable() }),
    ),
  }),
  ausfuehren: async (e, zugang) => {
    const r = await setzeStufen(zugang.supabase, zugang.userId, {
      trainingId: e.training_id,
      stufen: e.stufen,
    });
    return abgebildet(r, (w) => ({
      stufen: w.stufen.map((s) => wert(kategorieStufe, s)),
      nicht_mehr_passend: w.nichtMehrPassend.map((f) => ({
        fassung_id: f.fassungId,
        name: f.name,
        variante_id: f.varianteId,
      })),
    }));
  },
});

// ── training_uebung_entfernen ───────────────────────────────────────────────

export const trainingUebungEntfernen = werkzeug({
  name: "training_uebung_entfernen",
  titel: "Übung aus dem Training entfernen",
  beschreibung:
    "Entfernt eine Übung sofort und ohne Rückfrage aus dem Training, samt ihrer Notiz, ihrer " +
    "Gruppen im Durchlauf und ihres Bildes; die Vorlage in der Bibliothek bleibt unberührt. " +
    "Wie viele Gruppen ihren Durchlauf tragen, zeigt vorher «training_abrufen» je Übung " +
    "(«gruppen»); das Ergebnis nennt sie noch einmal. Bei einem öffentlichen Training lässt " +
    "sich die letzte Übung eines Pflicht-Abschnitts nicht entfernen — dann zuerst auf " +
    `Entwurf setzen. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ fassung_id: FassungId }),
  ausgabe: z.object({
    entfernt: z.object({ name: z.string(), einordnung: Wert, variante_id: z.string().nullable() }),
    /** Namen der Gruppen, die die Übung durchliefen, in Wechselreihenfolge. */
    gruppen: z.array(z.string()),
    notiz_entfiel: z.boolean(),
  }),
  ausfuehren: async (e, zugang) => {
    const r = await entferneUebung(zugang.supabase, zugang.userId, { fassungId: e.fassung_id });
    return abgebildet(r, (w) => ({
      entfernt: {
        name: w.name,
        einordnung: wert(EINORDNUNG_LABEL, w.einordnung),
        variante_id: w.varianteId,
      },
      gruppen: w.gruppen,
      notiz_entfiel: w.notizEntfiel,
    }));
  },
});

// ── training_uebungen_ordnen ────────────────────────────────────────────────

export const trainingUebungenOrdnen = werkzeug({
  name: "training_uebungen_ordnen",
  titel: "Übungen eines Abschnitts ordnen",
  beschreibung:
    "Legt die Reihenfolge der Übungen eines Abschnitts in einem Zug fest. Ein Abschnitt ist " +
    "ein Trainingsteil bzw. Block, im Kinderfussball-Hauptteil zusätzlich die " +
    "Hauptteilkategorie und im Hauptteil zusätzlich die Variante (Pflicht, sobald das " +
    "Training mehrere führt). «fassung_ids» nennt ALLE Übungen dieses Abschnitts, jede genau " +
    "einmal, in der gewünschten Folge — die Kennungen und Abschnitte liefert " +
    "«training_abrufen». Fehlt eine oder gehört eine nicht dazu, nennt die Meldung sie mit " +
    `Namen und ändert nichts. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    einordnung: Einordnung,
    hauptteilkategorie: Hauptteilkategorie,
    variante_id: kennung(
      "Nur im Hauptteil: welche Variante. Pflicht, wenn das Training mehrere führt.",
    ).optional(),
    fassung_ids: z
      .array(kennung("Kennung einer Übung im Training («fassung_id»)."))
      .describe("Alle Übungen des Abschnitts in der neuen Reihenfolge."),
  }),
  ausgabe: z.object({
    folge: z.array(
      z.object({ fassung_id: z.string(), name: z.string(), position: z.number().int() }),
    ),
  }),
  ausfuehren: async (e, zugang) => {
    const r = await setzeUebungsfolge(zugang.supabase, zugang.userId, {
      trainingId: e.training_id,
      einordnung: e.einordnung,
      hauptteilkategorie: e.hauptteilkategorie,
      varianteId: e.variante_id,
      fassungIds: e.fassung_ids,
    });
    return abgebildet(r, (w) => ({
      folge: w.folge.map((f) => ({ fassung_id: f.fassungId, name: f.name, position: f.position })),
    }));
  },
});

// ── training_uebung_dauer_setzen ────────────────────────────────────────────

export const trainingUebungDauerSetzen = werkzeug({
  name: "training_uebung_dauer_setzen",
  titel: "Dauer einer Übung setzen",
  beschreibung:
    "Setzt die Dauer einer Übung im Training in ganzen Minuten ab 0, oder entfernt sie mit " +
    `«null». Im ${OHNE_DAUER} trägt eine Übung keine Dauer; dort lässt sie sich nur entfernen. ` +
    KENNUNG_FEHLER,
  nurLesen: false,
  eingabe: z.object({
    fassung_id: FassungId,
    minuten: z.number().int().nullable().describe("Ganze Minuten ab 0; «null» entfernt die Dauer."),
  }),
  ausgabe: z.object({ minuten: z.number().int().nullable() }),
  ausfuehren: async (e, zugang) => {
    const r = await setzeDauer(zugang.supabase, zugang.userId, {
      fassungId: e.fassung_id,
      minuten: e.minuten,
    });
    return abgebildet(r, (w) => ({ minuten: w.minuten }));
  },
});

// ── training_uebung_notiz_setzen ────────────────────────────────────────────

export const trainingUebungNotizSetzen = werkzeug({
  name: "training_uebung_notiz_setzen",
  titel: "Notiz zu einer Übung setzen",
  beschreibung:
    "Hält zu einer Übung in diesem Training eine Notiz fest, ändert oder leert sie " +
    `(höchstens ${NOTIZ_MAX} Zeichen; ein leerer Text entfernt sie). Die Notiz gehört dem ` +
    `Training, nicht der Übung — in die Bibliothek gelangt sie nie. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    fassung_id: FassungId,
    notiz: z.string().describe(`Die Notiz, höchstens ${NOTIZ_MAX} Zeichen; "" entfernt sie.`),
  }),
  ausgabe: z.object({ notiz: z.string().nullable() }),
  ausfuehren: async (e, zugang) => {
    const r = await setzeNotiz(zugang.supabase, zugang.userId, {
      fassungId: e.fassung_id,
      notiz: e.notiz,
    });
    return abgebildet(r, (w) => ({ notiz: w.notiz }));
  },
});

// ── training_veroeffentlichen / training_auf_entwurf_setzen (#196) ───────────

export const trainingVeroeffentlichen = werkzeug({
  name: "training_veroeffentlichen",
  titel: "Training veröffentlichen",
  beschreibung:
    "Schaltet ein eigenes persönliches Training öffentlich — ohne Rückfrage. Tragweite, die " +
    `du dem Trainer vorher nennen solltest: «${TRAGWEITE_VEROEFFENTLICHEN}» Es entsteht keine ` +
    "Kopie und nichts wird eingefroren: Das Training bleibt bearbeitbar, die Öffentlichkeit " +
    "sieht jeweils den aktuellen Stand. Ein Team-Training lässt sich nicht veröffentlichen " +
    "(«regel»); es muss zuerst in den persönlichen Bestand übernommen werden. Ob alle " +
    "Bedingungen erfüllt sind, zeigt vorher «training_hinweise» (Einträge mit «sperrt: " +
    "true»). Fehlt etwas, lehnt das Werkzeug mit der Fehlerart «bedingung» ab und nennt ALLE " +
    "fehlenden Bedingungen; ergänzt wird nichts von selbst. Solange das Training öffentlich " +
    "ist, weist KiFu jede Änderung ab, die eine Bedingung verletzte — dann zuerst " +
    "«training_auf_entwurf_setzen». Das Ergebnis nennt den Anzeigenamen, der nun als Urheber " +
    `sichtbar ist («urheber»), und die Tragweite. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: z.object({
    sichtbarkeit: z.literal("oeffentlich"),
    urheber: z.string().nullable(),
    tragweite: z.string(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await veroeffentliche(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (w) => ({ sichtbarkeit: w.sichtbarkeit, urheber: w.urheber, tragweite: w.tragweite }),
    ),
});

export const trainingAufEntwurfSetzen = werkzeug({
  name: "training_auf_entwurf_setzen",
  titel: "Training auf Entwurf setzen",
  beschreibung:
    "Nimmt ein eigenes öffentliches Training aus dem öffentlichen Bestand; im Übrigen bleibt " +
    "es unberührt. Kopien, die andere bereits übernommen haben, bleiben bestehen — sie sind " +
    "eigenständige Trainings; benachrichtigt wird niemand. Ein Entwurf bleibt Entwurf. " +
    "Team-Trainings sind nie öffentlich («regel»). Danach lassen sich auch Änderungen machen, " +
    `die ein öffentliches Training nicht erlaubt. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: z.object({ sichtbarkeit: z.literal("entwurf") }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeAufEntwurf(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (w) => ({ sichtbarkeit: w.sichtbarkeit }),
    ),
});
