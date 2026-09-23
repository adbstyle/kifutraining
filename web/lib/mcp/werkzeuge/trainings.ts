import "server-only";
import { z } from "zod";
import {
  altersstufe as altersstufeLabels,
  hauptteilkategorieSlugs,
  kategorienSlugs,
} from "@/lib/vocab";
import {
  ALTERSSTUFEN,
  einordnungenFuer,
  einordnungsSlugsFuer,
  kategorienFuer,
  traegtHauptteilkategorie,
  type Altersstufe,
} from "@/lib/altersstufe";
import { kategorieStufe } from "@/lib/labels";
import { HAUPTTEILKATEGORIEN, TRAINING_NAME_MAX, ZIEL_MAX } from "@/lib/training";
import { formOptionen, typOptionen } from "@/lib/filter-optionen";
import { abgebildet } from "@/lib/kern/ergebnis";
import { legeTrainingAn } from "@/lib/kern/training";
import { ordneUebungZu, vorlagenFuerBlock } from "@/lib/kern/fassung";
import { alsEnum, katalogFilter, kennung } from "@/lib/mcp/bausteine";
import { SuchTreffer } from "@/lib/mcp/eingaben";
import { alsTreffer } from "@/lib/mcp/werkzeuge/uebungen";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Ein Training anlegen und ihm Übungen zuordnen (Story #192).
 *
 * Drei dünne Adapter über den Fachkern (lib/kern/training.ts,
 * lib/kern/fassung.ts), denselben Funktionen, die das Anlege-Formular und
 * der Picker der Oberfläche aufrufen — eine Regelquelle, dieselben Meldungen.
 * Zod prüft hier nur Typ, Enum und Kennungsformat (lib/mcp/werkzeug.ts);
 * jede Fachregel — auch «mindestens eine Alterskategorie» und die
 * Längengrenzen — prüft der Kern und benennt sie (#192 NFR 3/4).
 *
 * Alle Beschreibungen sind aus dem Vokabular erzeugt: Ein neuer Wert in
 * data/vokabular.yaml erscheint hier ohne Zutun.
 */

/** Altersstufen, für die sich über den KI-Client ein Training anlegen lässt.
 *  #192 OoS 5: noch nicht Juniorenfussball — das öffnet #199. */
const ANLEGBAR: readonly Altersstufe[] = ["kinderfussball"];

export const liste = (werte: readonly { slug: string; label: string }[]) =>
  werte.map((w) => `${w.slug} (${w.label})`).join(", ");

/** Das Trainingsschema einer Altersstufe als ein Satz: Teile, Blöcke,
 *  Hauptteilkategorien — damit der Assistent die Einordnung nicht rät. */
function schemaText(stufe: Altersstufe): string {
  const teile = einordnungenFuer(stufe).map((g) => {
    if (g.bloecke.length > 0) return `${g.label}: ${liste(g.bloecke)}`;
    const hkat = traegtHauptteilkategorie(stufe, g.teil)
      ? ` — Hauptteilkategorie Pflicht: ${liste(HAUPTTEILKATEGORIEN)}`
      : "";
    return `${g.teil} (${g.label}${hkat})`;
  });
  return `${altersstufeLabels[stufe]}: ${teile.join("; ")}.`;
}

const SCHEMA_TEXT = ALTERSSTUFEN.map(schemaText).join(" ");

/** Alle Einordnungen beider Altersstufen — welche zum Training gehört,
 *  entscheidet der Kern an dessen Altersstufe und nennt sonst die zulässigen. */
const EINORDNUNGEN = [...new Set(ALTERSSTUFEN.flatMap(einordnungsSlugsFuer))];

export const PFLICHT_SATZ =
  "Im Kinderfussball-Hauptteil ist die Hauptteilkategorie Pflicht; ausserhalb davon bleibt sie leer.";

export const Einordnung = alsEnum(EINORDNUNGEN).describe(
  `Wohin die Übung gehört: im Kinderfussball der Trainingsteil, im Juniorenfussball der Block. ${SCHEMA_TEXT}`,
);
export const Hauptteilkategorie = alsEnum(hauptteilkategorieSlugs)
  .optional()
  .describe(`${PFLICHT_SATZ} Werte: ${liste(HAUPTTEILKATEGORIEN)}.`);
export const TrainingId = kennung(
  "Kennung des Trainings, etwa aus «training_anlegen» oder «trainings_suchen».",
);
export const FassungId = kennung(
  "Kennung der Übung im Training («fassung_id» aus «training_abrufen»).",
);

/** Was die Fehler zu einer Kennung bedeuten (#193 AK 14, OoS 7). Gehört an
 *  JEDE Beschreibung eines Werkzeugs, das `training_id` oder `fassung_id`
 *  annimmt — `check:kern` wacht darüber. */
export const KENNUNG_FEHLER =
  "Fehlerarten zur Kennung: «nicht_gefunden» — für dein Konto nicht sichtbar (es gibt sie " +
  "nicht, sie wurde gelöscht oder gehört jemand anderem privat; bewusst nicht " +
  "unterscheidbar); «keine_rechte» — ein öffentliches Training eines anderen Kontos: " +
  "ansehen und übernehmen ja, ändern nein.";

/** Die Alterskategorien je Altersstufe als ein Satz, etwa «Kinderfussball: G
 *  (G-Junior:innen), F (…)» — für jede Beschreibung, die Kategorien annimmt. */
export function kategorienText(stufen: readonly Altersstufe[]): string {
  return stufen
    .map(
      (s) =>
        `${altersstufeLabels[s]}: ${kategorienFuer(s)
          .map((k) => `${k} (${kategorieStufe[k as keyof typeof kategorieStufe] ?? k})`)
          .join(", ")}`,
    )
    .join(". ");
}

// ── training_anlegen ────────────────────────────────────────────────────────

const AnlegenEingabe = z.object({
  name: z.string().describe(`Name des Trainings, höchstens ${TRAINING_NAME_MAX} Zeichen.`),
  altersstufe: alsEnum(ANLEGBAR).describe(
    `Altersstufe: ${ANLEGBAR.map((s) => `${s} (${altersstufeLabels[s]})`).join(", ")}. ` +
      "Sie steht danach fest.",
  ),
  stufen: z
    .array(alsEnum(kategorienSlugs))
    .describe(
      `Alterskategorien, mindestens eine, alle aus der gewählten Altersstufe. ${kategorienText(ANLEGBAR)}.`,
    ),
  ziel: z
    .string()
    .optional()
    .describe(`Ziel des Trainings (optional), höchstens ${ZIEL_MAX} Zeichen.`),
});

const AnlegenAusgabe = z.object({
  training_id: z.string(),
  /** Der Editor des Trainings in KiFu. */
  url: z.string(),
});

export const trainingAnlegen = werkzeug({
  name: "training_anlegen",
  titel: "Training anlegen",
  beschreibung:
    "Legt in deinem persönlichen Bestand ein neues Training als privaten Entwurf an — " +
    "mit Name, Altersstufe, mindestens einer Alterskategorie und optional einem Ziel. " +
    "Heute nur Kinderfussball. Liefert die Kennung und die Adresse des Editors in KiFu. " +
    "Übungen kommen danach mit «training_uebung_zuordnen» dazu.",
  nurLesen: false,
  eingabe: AnlegenEingabe,
  ausgabe: AnlegenAusgabe,
  ausfuehren: async (e, zugang) => {
    const r = await legeTrainingAn(zugang.supabase, zugang.userId, e);
    return abgebildet(r, (w) => ({
      training_id: w.id,
      url: zugang.url("training", w.id, "edit"),
    }));
  },
});

// ── training_uebungen_fuer_block ────────────────────────────────────────────

const FuerBlockEingabe = z.object({
  training_id: TrainingId,
  einordnung: Einordnung,
  hauptteilkategorie: Hauptteilkategorie,
  erscheinungsform: katalogFilter(formOptionen, "Erscheinungsformen, grenzt weiter ein."),
  uebungstyp: katalogFilter(typOptionen, "Übungstyp, grenzt weiter ein."),
  q: z
    .string()
    .trim()
    .max(200)
    .optional()
    .describe("Freitext über Name, Aufbau, Ablauf, Material und Varianten; Wortteile genügen."),
  limit: z.number().int().min(1).max(50).default(20).describe("Höchstens so viele Treffer (bis 50)."),
});

const FuerBlockAusgabe = z.object({
  treffer: z.array(SuchTreffer),
  /** Gibt es mehr Treffer als `limit`? Dann enger suchen. */
  weitere: z.boolean(),
  /** Nur bei null Treffern: ob der sichtbare Bestand für diesen Block gar
   *  nichts führt oder nur die Eingrenzung zu eng war (#192 AK 8). */
  leer: z
    .object({ grund: z.enum(["bestand_leer", "eingrenzung_zu_eng"]), text: z.string() })
    .nullable(),
});

export const trainingUebungenFuerBlock = werkzeug({
  name: "training_uebungen_fuer_block",
  titel: "Passende Übungen für einen Block",
  beschreibung:
    "Liefert ausschliesslich die Übungen, die ein Block dieses Trainings annimmt — " +
    "dieselbe Auswahl wie «Übung hinzufügen» im Editor: passend zur Altersstufe des " +
    "Trainings, zum Trainingsteil bzw. Block und im Kinderfussball-Hauptteil zur " +
    "Hauptteilkategorie. Nur Übungen, die dein Konto in KiFu sieht. Sortiert nach Name. " +
    "Ohne Treffer sagt «leer», ob der Bestand dafür nichts führt oder nur die " +
    `Eingrenzung zu eng war. ${PFLICHT_SATZ} ${KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: FuerBlockEingabe,
  ausgabe: FuerBlockAusgabe,
  ausfuehren: async (e, zugang) => {
    const r = await vorlagenFuerBlock(zugang.supabase, zugang.userId, {
      trainingId: e.training_id,
      einordnung: e.einordnung,
      hauptteilkategorie: e.hauptteilkategorie,
      form: e.erscheinungsform,
      typ: e.uebungstyp,
      q: e.q,
      limit: e.limit,
      // Ein KI-Zugang erreicht die Favoriten nicht (lib/mcp/umfang.ts).
      favoriten: false,
      mitLeerGrund: true,
    });
    return abgebildet(r, (w) => ({
      treffer: w.treffer.map((t) => alsTreffer(t, zugang)),
      weitere: w.weitere,
      leer: w.leer,
    }));
  },
});

// ── training_uebung_zuordnen ────────────────────────────────────────────────

const ZuordnenEingabe = z.object({
  training_id: TrainingId,
  exercise_id: kennung("Kennung (id) der Übung, etwa aus «training_uebungen_fuer_block»."),
  einordnung: Einordnung,
  hauptteilkategorie: Hauptteilkategorie,
  variante_id: kennung(
    "Nur im Hauptteil und nur, wenn das Training mehrere Varianten führt: in welche. " +
      "Ohne Angabe die erste.",
  ).optional(),
});

const ZuordnenAusgabe = z.object({
  fassung_id: z.string(),
  /** 0-basiert, am Ende des Abschnitts. */
  position: z.number().int(),
  variante_id: z.string().nullable(),
  name: z.string(),
});

export const trainingUebungZuordnen = werkzeug({
  name: "training_uebung_zuordnen",
  titel: "Übung einem Training zuordnen",
  beschreibung:
    "Hängt eine Übung ans Ende ihres Trainingsteils bzw. Blocks. Das Training bekommt " +
    "eine eigenständige Kopie samt Bild und Diagramm; die Vorlage bleibt unverändert. " +
    "Dieselbe Übung darf mehrfach vorkommen. Angenommen wird nur, was zur Altersstufe " +
    "des Trainings, zum Block und im Kinderfussball-Hauptteil zur Hauptteilkategorie " +
    `passt — sonst nennt die Meldung die verletzte Regel. ${PFLICHT_SATZ} ` +
    "Scheitert eine Zuordnung, bleiben alle vorherigen bestehen; bei «konflikt» genügt " +
    `es, denselben Aufruf zu wiederholen. ${KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: ZuordnenEingabe,
  ausgabe: ZuordnenAusgabe,
  ausfuehren: async (e, zugang) => {
    const r = await ordneUebungZu(zugang.supabase, zugang.userId, {
      trainingId: e.training_id,
      exerciseId: e.exercise_id,
      einordnung: e.einordnung,
      hauptteilkategorie: e.hauptteilkategorie,
      varianteId: e.variante_id,
    });
    return abgebildet(r, (w) => ({
      fassung_id: w.fassungId,
      position: w.position,
      variante_id: w.varianteId,
      name: w.name,
    }));
  },
});
