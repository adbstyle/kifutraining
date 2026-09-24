import "server-only";
import { z } from "zod";
import { VARIANTE_NAME_MAX, VARIANTE_VORGABENAME } from "@/lib/varianten";
import { abgebildet } from "@/lib/kern/ergebnis";
import {
  benenneVariante,
  entferneVariante,
  legeVarianteAn,
  setzeVariantenfolge,
} from "@/lib/kern/varianten";
import { kennung } from "@/lib/mcp/bausteine";
import { KENNUNG_FEHLER, TrainingId, VarianteId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Varianten des Hauptteils (Epic #190, Story #263).
 *
 * Dünne Adapter über lib/kern/varianten.ts — dieselben Funktionen, die der
 * Editor aufruft, also dieselben Regeln und wortgleich dieselben Meldungen.
 * Zod prüft nur Typ und Kennungsformat; Länge, Eindeutigkeit und jede
 * Fachregel prüft der Kern und benennt sie samt Feld.
 *
 * Bewusst nicht dabei: eine leere Variante anlegen (jede entsteht als Kopie,
 * Epic #200 EK 4) und Übungen zwischen Varianten verschieben oder kopieren
 * (wie in der Oberfläche).
 */

/** Was die Bezeichnung erfüllen muss — aus der Regelquelle. */
const NAME_REGEL = `nicht leer, höchstens ${VARIANTE_NAME_MAX} Zeichen, im Training eindeutig (Gross-/Kleinschreibung zählt nicht)`;

const IdName = z.object({ id: z.string(), name: z.string() });

// ── variante_anlegen ────────────────────────────────────────────────────────

export const varianteAnlegen = werkzeug({
  name: "variante_anlegen",
  titel: "Variante des Hauptteils anlegen",
  beschreibung:
    "Legt eine weitere Variante des Hauptteils an — als vollständige Kopie einer bestehenden " +
    "(«quelle_variante_id», ohne Angabe die vorderste): alle Übungen des Hauptteils samt " +
    "Inhalt, Dauer, Notiz, Bild, Diagramm und Gruppen im Durchlauf. Die Quelle bleibt " +
    "unverändert, die neue Variante steht hinter den bestehenden. Eine Variante umfasst immer " +
    "den ganzen Hauptteil (im Juniorenfussball Spielformen und Spiel zusammen); alle übrigen " +
    "Teile gelten für alle Varianten gemeinsam. Eine leere Variante gibt es nicht. Die " +
    `Bezeichnung ist ${NAME_REGEL}. Solange ein Training nur eine Variante führt, trägt sie ` +
    `unsichtbar den Vorgabenamen «${VARIANTE_VORGABENAME}» — beim Anlegen der ZWEITEN benenne ` +
    "sie mit «name_quelle» mit, sonst steht dieser Name ab jetzt sichtbar da. Übungen kommen " +
    "danach mit «training_uebung_zuordnen» und «variante_id» in die neue Variante; ändern " +
    `lassen sie sich dort unabhängig von der Quelle. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    quelle_variante_id: VarianteId.optional().describe(
      "Die Variante, die kopiert wird. Ohne Angabe die vorderste.",
    ),
    name: z
      .string()
      .describe(`Bezeichnung der neuen Variante, höchstens ${VARIANTE_NAME_MAX} Zeichen.`),
    name_quelle: z
      .string()
      .optional()
      .describe(
        "Optional: neue Bezeichnung der Quelle — beim Anlegen der zweiten Variante empfohlen.",
      ),
  }),
  ausgabe: z.object({ variante: IdName, quelle: IdName, uebungen_kopiert: z.number().int() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeVarianteAn(zugang.supabase, zugang.userId, {
        trainingId: e.training_id,
        quelleVarianteId: e.quelle_variante_id,
        name: e.name,
        nameQuelle: e.name_quelle,
      }),
      (w) => ({ variante: w.variante, quelle: w.quelle, uebungen_kopiert: w.uebungenKopiert }),
    ),
});

// ── variante_umbenennen ─────────────────────────────────────────────────────

export const varianteUmbenennen = werkzeug({
  name: "variante_umbenennen",
  titel: "Variante des Hauptteils umbenennen",
  beschreibung:
    `Ändert die Bezeichnung einer Variante des Hauptteils (${NAME_REGEL}; die eigene bisherige ` +
    "zählt nicht als vergeben). Ihre Übungen bleiben. Führt das Training nur eine Variante, " +
    `zeigt KiFu die Bezeichnung nirgends. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    variante_id: VarianteId,
    name: z.string().describe(`Neue Bezeichnung, höchstens ${VARIANTE_NAME_MAX} Zeichen.`),
  }),
  ausgabe: z.object({ name: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await benenneVariante(zugang.supabase, zugang.userId, {
        varianteId: e.variante_id,
        name: e.name,
      }),
      (w) => ({ name: w.name }),
    ),
});

// ── variante_entfernen ──────────────────────────────────────────────────────

export const varianteEntfernen = werkzeug({
  name: "variante_entfernen",
  titel: "Variante des Hauptteils entfernen",
  beschreibung:
    "Entfernt eine Variante des Hauptteils sofort und ohne Rückfrage — samt allen ihren " +
    "Übungen mit Notizen, Bildern und Gruppen im Durchlauf («uebungen_entfernt»). Die Gruppen " +
    "selbst, die übrigen Varianten und alle Teile ausserhalb des Hauptteils bleiben. Was " +
    "mitfällt, zeigt vorher «training_abrufen» (der Hauptteil je Variante) — dort nachsehen, " +
    "bevor du entfernst. Die letzte Variante lässt sich nicht entfernen («regel»). Bleibt " +
    `genau eine übrig, wird sie aufgelöst und heisst wieder «${VARIANTE_VORGABENAME}»; KiFu ` +
    "zeigt den Hauptteil dann wieder ohne Varianten («aufgeloest: true»). Eine entfernte " +
    `Variante kommt nicht zurück. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ variante_id: VarianteId }),
  ausgabe: z.object({
    name: z.string(),
    uebungen_entfernt: z.number().int(),
    aufgeloest: z.boolean(),
    varianten: z.array(IdName),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await entferneVariante(zugang.supabase, zugang.userId, { varianteId: e.variante_id }),
      (w) => ({
        name: w.name,
        uebungen_entfernt: w.uebungenEntfernt,
        aufgeloest: w.aufgeloest,
        varianten: w.verbleibend,
      }),
    ),
});

// ── varianten_ordnen ────────────────────────────────────────────────────────

export const variantenOrdnen = werkzeug({
  name: "varianten_ordnen",
  titel: "Varianten des Hauptteils ordnen",
  beschreibung:
    "Legt die Reihenfolge der Varianten des Hauptteils in einem Zug fest. «variante_ids» nennt " +
    "ALLE Varianten des Trainings, jede genau einmal, in der gewünschten Folge — die Kennungen " +
    "stehen in «training_abrufen» unter «varianten». Die vorderste zeigt KiFu beim Öffnen des " +
    "Trainings. Fehlt eine, nennt die Meldung sie mit Namen und Kennung; gehört eine nicht " +
    "dazu, nennt sie deren Kennung, und «zulaessig» nennt die Kennungen des Trainings — " +
    `geändert wird dann nichts. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({
    training_id: TrainingId,
    variante_ids: z
      .array(kennung("Kennung einer Variante des Trainings."))
      .describe("Alle Varianten des Trainings in der neuen Reihenfolge."),
  }),
  ausgabe: z.object({ varianten: z.array(IdName) }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeVariantenfolge(zugang.supabase, zugang.userId, {
        trainingId: e.training_id,
        varianteIds: e.variante_ids,
      }),
      (w) => ({ varianten: w.folge }),
    ),
});
