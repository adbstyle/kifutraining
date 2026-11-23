import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getTrainingView, type TrainingDetail } from "@/lib/queries/trainings";
import { getMeineTeams, type TeamUebersicht } from "@/lib/queries/teams";
import { getMeineGrenzenLage } from "@/lib/queries/verein";
import { bearbeitungszielVon, type Bearbeitungsziel } from "@/lib/training-zugriff";
import { fehlendeBedingungenAus, type FehlendeBedingung } from "@/lib/training-bedingungen";
import { formatDuration, gesamtDauer, leseGliederung } from "@/lib/training";
import { sichtbareZuordnungen, type Variante } from "@/lib/varianten";

/* Was ein angesehenes Training ausser sich selbst braucht — EINMAL
   zusammengestellt für die Ansichtsseite (/training/[id]) und das Detail der
   Trainingsübersicht (#630): Bearbeitungsrecht, Teams (Ziele für Übernehmen,
   Ins-Team-Stellen, Termin zuordnen), die Grenzen-Lage des Kontos und was dem
   Training zum Veröffentlichen fehlt. Zwei Orte, die das je für sich
   zusammensetzen, liefen auseinander — und mit ihnen die Aktionen. */

export type TrainingAnsicht = {
  training: TrainingDetail;
  bearbeitungsziel: Bearbeitungsziel | null;
  teams: TeamUebersicht[];
  /** Gelten für das Konto Grenzen (#588)? Für `KontoGrenzenLage`. */
  mitGrenzen: boolean;
  fehlendeBedingungen: FehlendeBedingung[];
};

/** Lädt ein Training samt Kontext; `null`, wenn es dem USER nicht zugänglich
 *  ist (fremder Entwurf, gelöscht, ungültige Kennung — die RLS entscheidet).
 *  `user`: wer die Anmeldung schon gelesen hat, gibt sie mit (`undefined` =
 *  selbst lesen). Trainings gibt es nur mit Konto (#669): Ohne Anmeldung ist
 *  keines zugänglich. Training, Teams und Grenzen laufen
 *  zusammen — die Teams sind auch für ein unzugängliches Training bloss eine
 *  kurze Abfrage zu viel. */
export async function ladeTrainingAnsicht(id: string, user?: User): Promise<TrainingAnsicht | null> {
  const ich = user ?? (await (await createClient()).auth.getUser()).data.user;
  if (!ich) return null;
  const [training, teams, grenzenLage] = await Promise.all([
    getTrainingView(id),
    getMeineTeams(),
    getMeineGrenzenLage(),
  ]);
  if (!training) return null;

  const bearbeitungsziel = bearbeitungszielVon(
    { owner_id: training.ownerId, team_id: training.team?.id ?? null },
    ich.id,
  );
  // Was dem Training zum Veröffentlichen fehlt — dieselbe Funktion, die der
  // Editor und die Server Action nutzen. Gebraucht nur, wo die Aktion
  // offensteht: am eigenen, nicht dem Team gehörenden Training.
  const fehlendeBedingungen =
    bearbeitungsziel?.art === "persoenlich"
      ? fehlendeBedingungenAus(training.altersstufe, training.stufen, training.exercises, training.varianten)
      : [];

  return {
    training,
    bearbeitungsziel,
    teams: [...teams],
    mitGrenzen: grenzenLage !== "ohne",
    fehlendeBedingungen,
  };
}

/** Was von einem Training in einer Variante zu sehen ist: die Übungen samt
 *  allem ausserhalb des Hauptteils, gegliedert nach Trainingsteilen, und die
 *  Gesamtdauer als Text — dieselbe Rechnung wie in den Eigenschaften. */
export function angezeigteVariante(training: TrainingDetail, aktive: Variante | undefined) {
  const sichtbar = sichtbareZuordnungen(training.exercises, aktive?.id);
  const dauer = gesamtDauer(sichtbar);
  return {
    sichtbar,
    sections: leseGliederung(training.altersstufe, sichtbar),
    dauerText: dauer.erfasst ? formatDuration(dauer.summe) : "Keine Dauer erfasst",
  };
}
