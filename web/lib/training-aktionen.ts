// Welche Aktionen an einem Training einem Betrachter offenstehen (#249 AK 14).
//
// Bis zu dieser Story stand die Antwort an vier Orten verstreut: als
// JSX-Bedingung auf der Ansichtsseite, als `!training.team` im Editor-Kopf, als
// `teams.length === 0` in den Controls selbst und als Ladebedingung für die
// Teamliste. Die Reihe soll aber an beiden Orten dieselbe sein — und das ist
// sie nur, wenn die Frage auch nur einmal beantwortet wird.
//
// Reine Fachlogik ohne Server-Bezug, wie `training-zugriff.ts`, aus dem sie
// das Bearbeitungsrecht übernimmt. Und wie dort gilt: Die RLS bleibt die
// Autorität. Hier geht es darum, dem Trainer nichts anzubieten, was ohnehin
// abgewiesen würde — nicht um Zugriffsschutz.
import type { Bearbeitungsziel } from "@/lib/training-zugriff";

/** Was an einem Training zu tun ist — je Aktion, nicht je Ort.
 *
 *  Durchführen und Drucken fehlen absichtlich: Sie stehen jedem offen, der das
 *  Training überhaupt sieht (seit #669 nur mit Konto). Eine Zeile `durchfuehren: true`
 *  sagte nichts und lüde bloss dazu ein, sie eines Tages zu verneinen. */
export type TrainingAktionsRechte = {
  /** Bearbeiten — auf der Ansichtsseite ein Zeichen, im Editor selbst nicht
   *  mehr (#249 AK 9). Diese Unterscheidung gehört dem Ort und nicht dem
   *  Recht; sie trifft die Oberfläche. */
  bearbeiten: boolean;
  /** Übernehmen — jede Person an einem Community-Training,
   *  auch sein Urheber: Die Kopie ist ein eigenes Trainingsobjekt. */
  uebernehmen: boolean;
  /** Welcher der beiden Wege offensteht, oder `null` für keinen. Ein Training
   *  ist entweder Entwurf oder öffentlich; beides zugleich anzubieten hiesse,
   *  einen der beiden Knöpfe nie zu brauchen. */
  sichtbarkeit: "veroeffentlichen" | "auf_entwurf" | null;
  insTeamStellen: boolean;
  /** Einem Team-Termin zuordnen — immer als Kopie: vom persönlichen Training
   *  aus, wenn es ein Team gibt (#328 AK 2), und vom Training im Bestand
   *  eines Teams aus, dann in dessen Termine (#637). */
  terminZuordnen: boolean;
  /** Ein Training aus dem Bestand eines Teams als persönliche Kopie zu sich
   *  nehmen (Team-Epic Story 5) — bis #637 nur an der Kachel des Bestands. */
  zuMirUebernehmen: boolean;
  /** Ein Termin-Training bewusst in den Bestand seines Teams kopieren (PO
   *  2026-10-06) — das Original bleibt am Termin. */
  inBestandKopieren: boolean;
  loeschen: boolean;
};

/** Die eine Regel, welche Aktionen an einem Training offenstehen.
 *
 *  `bearbeitungsziel` stammt aus `bearbeitungszielVon` — wer bearbeiten darf,
 *  darf auch veröffentlichen, ins Team stellen und löschen. Getrennte Rechte
 *  dafür kennt das Modell nicht: Im Team sind alle gleichberechtigt, und ein
 *  persönliches Training gehört genau einer Person.
 *
 *  Veröffentlichen und Ins-Team-Stellen gibt es nur am persönlichen Training:
 *  Ein Team-Training gehört dem Team, nicht einer Person — wer eine
 *  Team-Arbeit veröffentlichen will, übernimmt sie zuerst zu sich.
 *
 *  `hatTeams` schliesst «Ins Team stellen» aus, solange der USER in keinem
 *  Team ist: Es gäbe kein Ziel, und ein Eintrag, der nur einen leeren Dialog
 *  öffnet, ist kein Angebot. Beim Übernehmen ist es umgekehrt kein
 *  Ausschlussgrund — dort bleibt man selbst immer ein gültiges Ziel.
 *
 *  Dem Termin zuordnen gibt es am persönlichen Training nur mit einem Team
 *  (#328), am Team-Training nur im Bestand: Ein Termin-Training gehört
 *  schon seinem Termin. Dasselbe gilt fürs Übernehmen zu sich — ein
 *  Termin-Training kopiert man erst in den Bestand. */
export function trainingAktionsRechte(
  training: { visibility: "public" | "private"; teamId: string | null; terminTraining: boolean },
  bearbeitungsziel: Bearbeitungsziel | null,
  hatTeams: boolean,
): TrainingAktionsRechte {
  const darfBearbeiten = bearbeitungsziel !== null;
  const persoenlich = darfBearbeiten && training.teamId === null;
  const oeffentlich = training.visibility === "public";
  const imBestand = darfBearbeiten && training.teamId !== null && !training.terminTraining;

  return {
    bearbeiten: darfBearbeiten,
    uebernehmen: oeffentlich,
    sichtbarkeit: persoenlich ? (oeffentlich ? "auf_entwurf" : "veroeffentlichen") : null,
    insTeamStellen: persoenlich && hatTeams,
    terminZuordnen: (persoenlich && hatTeams) || imBestand,
    zuMirUebernehmen: imBestand,
    inBestandKopieren: darfBearbeiten && training.teamId !== null && training.terminTraining,
    loeschen: darfBearbeiten,
  };
}

/** Steht überhaupt etwas im Überlaufmenü? Die Reihe stellt es sonst gar nicht
 *  erst bereit (#249 Postcondition 3) — ein ⋮, das ein leeres Panel öffnet,
 *  ist ein Versprechen, das die Anwendung nicht hält. */
export function hatUeberlauf(rechte: TrainingAktionsRechte): boolean {
  return (
    rechte.uebernehmen ||
    rechte.sichtbarkeit !== null ||
    rechte.insTeamStellen ||
    rechte.terminZuordnen ||
    rechte.zuMirUebernehmen ||
    rechte.inBestandKopieren ||
    rechte.loeschen
  );
}
