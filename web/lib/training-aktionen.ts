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
 *  Training überhaupt sieht, auch ohne Konto. Eine Zeile `durchfuehren: true`
 *  sagte nichts und lüde bloss dazu ein, sie eines Tages zu verneinen. */
export type TrainingAktionsRechte = {
  /** Bearbeiten — auf der Ansichtsseite ein Zeichen, im Editor selbst nicht
   *  mehr (#249 AK 9). Diese Unterscheidung gehört dem Ort und nicht dem
   *  Recht; sie trifft die Oberfläche. */
  bearbeiten: boolean;
  /** Übernehmen — jede angemeldete Person an einem öffentlichen Training,
   *  auch sein Urheber: Die Kopie ist ein eigenes Trainingsobjekt. */
  uebernehmen: boolean;
  /** Welcher der beiden Wege offensteht, oder `null` für keinen. Ein Training
   *  ist entweder Entwurf oder öffentlich; beides zugleich anzubieten hiesse,
   *  einen der beiden Knöpfe nie zu brauchen. */
  sichtbarkeit: "veroeffentlichen" | "auf_entwurf" | null;
  insTeamStellen: boolean;
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
 *  Ausschlussgrund — dort bleibt man selbst immer ein gültiges Ziel. */
export function trainingAktionsRechte(
  training: { visibility: "public" | "private"; teamId: string | null },
  angemeldet: boolean,
  bearbeitungsziel: Bearbeitungsziel | null,
  hatTeams: boolean,
): TrainingAktionsRechte {
  const darfBearbeiten = bearbeitungsziel !== null;
  const persoenlich = darfBearbeiten && training.teamId === null;
  const oeffentlich = training.visibility === "public";

  return {
    bearbeiten: darfBearbeiten,
    uebernehmen: angemeldet && oeffentlich,
    sichtbarkeit: persoenlich ? (oeffentlich ? "auf_entwurf" : "veroeffentlichen") : null,
    insTeamStellen: persoenlich && hatTeams,
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
    rechte.loeschen
  );
}
