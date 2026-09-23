import "server-only";
import { z } from "zod";
import { GRUPPE_NAME_MAX } from "@/lib/gruppen";
import { abgebildet } from "@/lib/kern/ergebnis";
import { DurchlaufAusschnitt } from "@/lib/kern/auskunft-schema";
import { benenneGruppe, entferneGruppe, legeGruppeAn, setzeDurchlauf } from "@/lib/kern/gruppen";
import { trainingAbrufen } from "@/lib/kern/lesen";
import { kennung } from "@/lib/mcp/bausteine";
import { FassungId, KENNUNG_FEHLER, TrainingId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Gruppen und Durchlauf des Hauptteils (Story #194).
 *
 * Dünne Adapter über lib/kern/gruppen.ts — dieselben Funktionen, die der
 * Editor aufruft, also dieselben Regeln und wortgleich dieselben Meldungen.
 * Zod prüft nur Typ und Kennungsformat; Länge, Eindeutigkeit und jede
 * Fachregel prüft der Kern und benennt sie samt Feld (#194 AK 9–11, PC 4).
 *
 * Bewusst nicht dabei: die Reihenfolge der Gruppen ändern (#194 OoS 2),
 * Kinderzahl oder Namen von Kindern (OoS 1), eine Rückfrage vor dem Entfernen
 * (OoS 3 — die Auskunft steht vorher in «training_durchlauf_abrufen») und
 * Konflikte der Verteilung (OoS 5, kommt mit «training_hinweise_abrufen»).
 */

export const GruppeId = kennung(
  "Kennung der Gruppe («gruppen[].id» aus «training_durchlauf_abrufen» oder «training_abrufen»).",
);

/** Was die Bezeichnung erfüllen muss — aus der Regelquelle. */
const NAME_REGEL = `nicht leer, höchstens ${GRUPPE_NAME_MAX} Zeichen, im Training eindeutig (Gross-/Kleinschreibung zählt nicht)`;

/** Die Wechsel-Regel in einem Satz — an jedem Werkzeug, das Durchläufe zeigt oder setzt. */
const WECHSEL_SATZ =
  "Der n-te Eintrag eines Durchlaufs ist der n-te Wechsel; ein Wechsel ist dasselbe Zeitfenster " +
  "an allen Übungen des Hauptteils — im Juniorenfussball über beide Hauptteil-Blöcke hinweg " +
  "(Spielformen und Spiel) durchgezählt.";

// ── gruppe_anlegen ──────────────────────────────────────────────────────────

export const gruppeAnlegen = werkzeug({
  name: "gruppe_anlegen",
  titel: "Gruppe anlegen",
  beschreibung:
    `Legt eine Gruppe am Training an; sie steht hinter den bestehenden. Die Bezeichnung ist ` +
    `${NAME_REGEL}. Eine Gruppe ist nur eine Bezeichnung — ohne Kinderzahl und ohne Namen von ` +
    `Kindern. Verteilt wird sie mit «training_uebung_durchlauf_setzen». ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    name: z.string().describe(`Bezeichnung der Gruppe, höchstens ${GRUPPE_NAME_MAX} Zeichen.`),
  }),
  ausgabe: z.object({ gruppe: z.object({ id: z.string(), name: z.string() }) }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeGruppeAn(zugang.supabase, zugang.userId, { trainingId: e.training_id, name: e.name }),
      (w) => ({ gruppe: w.gruppe }),
    ),
});

// ── gruppe_umbenennen ───────────────────────────────────────────────────────

export const gruppeUmbenennen = werkzeug({
  name: "gruppe_umbenennen",
  titel: "Gruppe umbenennen",
  beschreibung:
    `Ändert die Bezeichnung einer Gruppe (${NAME_REGEL}; die eigene bisherige zählt nicht als ` +
    `vergeben). Ihr Durchlauf an den Übungen bleibt. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    gruppe_id: GruppeId,
    name: z.string().describe(`Neue Bezeichnung, höchstens ${GRUPPE_NAME_MAX} Zeichen.`),
  }),
  ausgabe: z.object({ name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await benenneGruppe(zugang.supabase, zugang.userId, { gruppeId: e.gruppe_id, name: e.name }),
      (w) => ({ name: w.name }),
    ),
});

// ── gruppe_entfernen ────────────────────────────────────────────────────────

export const gruppeEntfernen = werkzeug({
  name: "gruppe_entfernen",
  titel: "Gruppe entfernen",
  beschreibung:
    "Entfernt eine Gruppe sofort und ohne Rückfrage und nennt, an wie vielen Übungen sie im " +
    "Durchlauf stand («an_uebungen», über alle Varianten); aus jedem dieser Durchläufe fällt sie " +
    "heraus, die Übungen selbst bleiben. Dieselbe Zahl zeigt vorher «training_durchlauf_abrufen» " +
    `je Gruppe — dort nachsehen, bevor du entfernst. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ gruppe_id: GruppeId }),
  ausgabe: z.object({ name: z.string(), an_uebungen: z.number().int() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneGruppe(zugang.supabase, zugang.userId, { gruppeId: e.gruppe_id }),
      (w) => ({ name: w.name, an_uebungen: w.anUebungen }),
    ),
});

// ── training_uebung_durchlauf_setzen ────────────────────────────────────────

export const trainingUebungDurchlaufSetzen = werkzeug({
  name: "training_uebung_durchlauf_setzen",
  titel: "Durchlauf einer Übung setzen",
  beschreibung:
    "Legt fest, welche Gruppen eine Übung des Hauptteils durchlaufen und in welcher Abfolge — " +
    "der bisherige Durchlauf wird vollständig ersetzt. «[]» heisst: alle gemeinsam. " +
    `${WECHSEL_SATZ} Nur Übungen im Hauptteil, nur Gruppen dieses Trainings (bei einer fremden ` +
    "nennt «zulaessig» die Kennungen), jede Gruppe höchstens einmal. Wie die Wechsel danach " +
    `insgesamt stehen, zeigt «training_durchlauf_abrufen». ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    fassung_id: FassungId,
    gruppe_ids: z
      .array(kennung("Kennung einer Gruppe des Trainings."))
      .describe("Die Gruppen in Wechselreihenfolge; [] = alle gemeinsam."),
  }),
  ausgabe: z.object({ gruppen: z.array(z.object({ id: z.string(), name: z.string() })) }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeDurchlauf(zugang.supabase, zugang.userId, {
        fassungId: e.fassung_id,
        gruppeIds: e.gruppe_ids,
      }),
      (w) => ({ gruppen: w.gruppen }),
    ),
});

// ── training_durchlauf_abrufen ──────────────────────────────────────────────

export const trainingDurchlaufAbrufen = werkzeug({
  name: "training_durchlauf_abrufen",
  titel: "Durchlauf des Hauptteils abrufen",
  beschreibung:
    "Liefert die Gruppen eines Trainings («an_uebungen»: an wie vielen Hauptteil-Übungen sie " +
    "stehen, über alle Varianten) und den Durchlauf des ganzen Hauptteils je Variante: die Zahl " +
    "der Wechsel, je Wechsel welche Gruppe an welcher Übung steht, und je Gruppe die zugewiesene " +
    `Zeit. ${WECHSEL_SATZ} Eine Übung ohne Gruppen machen alle gemeinsam; sie steht in keinem ` +
    "Wechsel. Derselbe Ausschnitt steht auch in «training_abrufen». Konflikte der Verteilung " +
    `meldet dieses Werkzeug nicht. ${KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: DurchlaufAusschnitt,
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await trainingAbrufen(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (a) => ({ gruppen: a.gruppen, durchlauf: a.durchlauf }),
    ),
});
