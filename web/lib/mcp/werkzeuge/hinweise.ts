import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { trainingHinweise as trainingHinweiseImKern } from "@/lib/kern/lesen";
import { HINWEIS_ARTEN, HinweiseAuskunft, alsAuskunft, type HinweisArt } from "@/lib/hinweise";
import { KENNUNG_FEHLER, TrainingId } from "@/lib/mcp/werkzeuge/trainings";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Fachliche Hinweise zu einem Training (Story #195).
 *
 * Dünner Adapter über lib/kern/lesen.ts; die Hinweise selbst rechnet
 * lib/hinweise.ts aus denselben Funktionen, aus denen der Editor zeichnet.
 * Ein eigenes Werkzeug statt eines Felds in «training_abrufen»: Alle Hinweise
 * kommen so in einem Aufruf (NFR 1), ohne die grosse Auskunft mitzuschleppen.
 */

/** Was jede Art bedeutet — der Record erzwingt, dass keine Art unerklärt bleibt. */
const ART_ERKLAERT: Record<HinweisArt, string> = {
  veroeffentlichung:
    "was noch fehlt, damit das Training öffentlich werden darf (nur bei deinen eigenen " +
    "persönlichen Trainings)",
  gruppe_doppelt: "eine Gruppe steht im selben Wechsel an mehreren Übungen",
  dauer_ungleich: "die Übungen eines Wechsels sind ungleich lang",
  zeitrichtwert:
    "ein Trainingsteil, ein Block oder die Gesamtdauer weicht vom Zeitrichtwert ab (nur " +
    "Juniorenfussball; «richtwert.abweichung_min» positiv = zu lang, negativ = zu kurz)",
  block_leer: "ein Block, der ins Training gehört, ist noch leer",
  teil_voll: "ungewöhnlich viele Übungen in einem Trainingsteil (nur Kinderfussball)",
  dauer_fehlt: "Übungen ohne erfasste Dauer; sie zählen nicht zur Summe",
  stufe_abweichend: "eine Übung deckt keine Alterskategorie des Trainings ab",
};

export const trainingHinweiseAbrufen = werkzeug({
  name: "training_hinweise",
  titel: "Hinweise zu einem Training",
  beschreibung:
    "Liefert alle fachlichen Hinweise, die KiFu zu einem Training zeigt, in einer Liste — " +
    "mit demselben Wortlaut wie in KiFu. Arten: " +
    HINWEIS_ARTEN.map((a) => `«${a}» — ${ART_ERKLAERT[a]}`).join("; ") +
    ". «stelle» nennt, wo zu handeln ist: Trainingsteil («teil»), Block oder im " +
    "Kinderfussball-Hauptteil die «hauptteilkategorie», die Variante des Hauptteils " +
    "(«variante_id», erst ab zwei Varianten), die betroffenen Übungen («fassung_ids»), die " +
    "Gruppe und die Wechsel (1-basiert). Hinweise sind keine Fehler; nur «sperrt: true» " +
    "(Veröffentlichungsbedingungen) blockiert etwas, nämlich das Veröffentlichen. " +
    "Zeitrichtwerte sind Orientierung, keine Bedingung. Eine leere Liste heisst: nichts zu " +
    `melden. Das Abrufen ändert nichts am Training. ${KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ training_id: TrainingId }),
  ausgabe: HinweiseAuskunft,
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await trainingHinweiseImKern(zugang.supabase, zugang.userId, { trainingId: e.training_id }),
      (w) => ({ hinweise: w.hinweise.map(alsAuskunft) }),
    ),
});
