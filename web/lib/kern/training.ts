import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { istAltersstufe, kategorienFuer } from "@/lib/altersstufe";
import { trainingNameProblem, ZIEL_MAX } from "@/lib/training";
import { pruefeTeamMitglied } from "@/lib/kern/zugriff";
import { ausDbFehler, fehlschlag, ok, type KernErgebnis } from "@/lib/kern/ergebnis";

/**
 * Ein Training anlegen (Story #10, Story 5, Team-Epic Story 3, #192 AK 1/2).
 *
 * Eine Regelquelle für drei Wege: das Anlege-Formular (`createTraining`), das
 * Team-Anlegen (`erstelleTeamTraining`) und das KI-Werkzeug
 * «training_anlegen». Das Training entsteht immer als privater Entwurf
 * (#192 PC 1) — persönlich mit dem Aufrufer als Eigentümer oder, mit
 * `teamId`, als Team-Training ohne Eigentümer.
 *
 * Die Meldungen sind wortgleich mit denen der Oberfläche. Das Ziel wird hier
 * NICHT gekürzt: Das Formular kürzt still auf `ZIEL_MAX` (`zielWert`), ein
 * KI-Client bekommt stattdessen die Grenze genannt.
 */
export type TrainingAnlegen = {
  name: string;
  altersstufe: string;
  stufen: readonly string[];
  ziel?: string | null;
  teamId?: string;
};

export async function legeTrainingAn(
  supabase: SupabaseClient,
  userId: string,
  e: TrainingAnlegen,
): Promise<KernErgebnis<{ id: string; teamId: string | null }>> {
  // Dieselbe Regel wie beim Umbenennen. Ohne sie entstünde hier ein Name, den
  // das Feld im Editor-Kopf nicht mehr speichern könnte — die Grenze sperrte
  // dann ausgerechnet das Werkzeug, mit dem man sie einhält. Seit #192 gilt
  // sie auch für Team-Trainings (bisher nur «nicht leer»).
  const namensProblem = trainingNameProblem(e.name);
  if (namensProblem) return fehlschlag("eingabe", namensProblem, { feld: "name" });
  const name = e.name.trim();

  // Die Altersstufe ist Pflicht und hat bewusst KEINEN Rückfall: Sie bindet
  // lebenslang (Story 5 AK 5), und eine stille Vorgabe wäre genau das
  // Durchrutschen, das die Story ausschliesst. Die Datenebene führt die Spalte
  // seit der Migration `training_altersstufe_default_drop` ohne Default.
  const altersstufe = e.altersstufe.trim();
  if (!istAltersstufe(altersstufe))
    return fehlschlag("eingabe", "Bitte die Altersstufe wählen.", {
      feld: "altersstufe",
    });

  // Mindestens eine Alterskategorie, ab dem Anlegen (PO 2026-08-30). Die
  // Datenebene setzt es als Trigger `trainings_stufe_pflicht` ebenfalls durch.
  const erlaubt = kategorienFuer(altersstufe);
  if (e.stufen.length === 0)
    return fehlschlag("eingabe", "Bitte mindestens eine Alterskategorie wählen.", {
      feld: "stufen",
      zulaessig: erlaubt,
    });
  // Die Kategorien folgen der gewählten Altersstufe; sie bestimmen sie nicht
  // mehr (Story 5 AK 4). Ein stufenfremder Wert wird abgewiesen statt still
  // weggefiltert — sonst entstünde ein Training mit weniger Kategorien, als der
  // Trainer gewählt hat.
  if (e.stufen.some((s) => !erlaubt.includes(s)))
    return fehlschlag(
      "regel",
      "Diese Alterskategorie gehört nicht zur gewählten Altersstufe. " +
        "Wähle nur Kategorien dieser Altersstufe.",
      { feld: "stufen", zulaessig: erlaubt },
    );

  const ziel = e.ziel?.trim() ? e.ziel.trim() : null;
  if (ziel && ziel.length > ZIEL_MAX)
    return fehlschlag("eingabe", `Das Ziel darf höchstens ${ZIEL_MAX} Zeichen lang sein.`, {
      feld: "ziel",
    });

  if (e.teamId) {
    const team = await pruefeTeamMitglied(supabase, e.teamId);
    if (!team.ok) return team;
  }

  const { data, error } = await supabase
    .from("trainings")
    .insert({
      name,
      ziel,
      altersstufe,
      stufen: [...e.stufen],
      visibility: "private",
      // Genau eine Eigentumsform (`tr_ein_eigentuemer`): Person ODER Team.
      ...(e.teamId ? { team_id: e.teamId } : { owner_id: userId }),
    })
    .select("id")
    .single<{ id: string }>();
  // Übersetzt, nicht roh: eine gemischte Stufenwahl kommt hier als
  // Constraint-Meldung an, und die versteht niemand (Epic #71).
  if (error) return ausDbFehler(error);
  return ok({ id: data.id, teamId: e.teamId ?? null });
}
