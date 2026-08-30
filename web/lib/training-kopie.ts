// Der zentrale Kopier-Baustein für Trainings (Team-Epic, Kopie-Modell).
//
// Geteilt wird nie, kopiert immer: ins Team stellen, zu mir übernehmen, je
// Termin ansetzen, eine Vorlage übernehmen und das Veröffentlichen gehen alle
// durch `kopiereTraining`. Damit gibt es genau eine Stelle, die weiss, was zu
// einer vollständigen, entkoppelten Kopie gehört — und genau eine Stelle, die
// aufräumt, wenn unterwegs etwas schiefgeht.
//
// Die Fassungs-Bausteine (`kopiereBild`, `inhaltFelder`, `kopiereDiagrammVon`)
// stammen aus dem Bibliotheks-Epic und werden hier wiederverwendet.
import {
  entferneStorageObjekte,
  inhaltFelder,
  kopiereBild,
  kopiereDiagrammVon,
  teamOrdner,
  userOrdner,
  type BildOrdner,
} from "@/lib/fassung";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Wohin kopiert wird. Der Diskriminator bestimmt Eigentum, Sichtbarkeit und
 *  den Storage-Ordner der Bildkopien in einem Zug.
 *
 *  Für Vorlagen gibt es bewusst KEINE eigene Art: eine Vorlage entsteht als
 *  persönliche Kopie und wird erst danach freigegeben. Grund ist die RLS —
 *  Fassungen lassen sich nur in ein privates Training einfügen, weil eine
 *  öffentliche Vorlage eingefroren ist. */
export type KopieZiel =
  /** Zu mir übernehmen, eine Vorlage übernehmen, Vorlage vorbereiten. */
  | { art: "persoenlich"; ownerId: string }
  /** Ins Team stellen bzw. je Termin ansetzen — Eigentum des Teams. */
  | { art: "team"; teamId: string };

export type KopieErgebnis =
  | { ok: true; neueId: string }
  | { ok: false; error: string };

/** Die Felder einer Fassung, die in die Kopie übergehen. Inhalt kommt aus
 *  `inhaltFelder`; hier stehen Einordnung, Reihenfolge und Dauer. */
const FASSUNG_SELECT = `
  id, trainingsteil, hauptteilkategorie, position, duration_min,
  name, kategorien, erscheinungsform, feldtyp, anzahl_kinder, material,
  methodischer_fahrplan, aufbau, varianten, bild_quelle,
  bild_url, diagramm
`;

type QuellFassung = {
  id: string;
  trainingsteil: string;
  hauptteilkategorie: string | null;
  position: number;
  duration_min: number | null;
  bild_url: string | null;
  diagramm: unknown;
} & Record<string, unknown>;

/** Eigentum, Sichtbarkeit und Bild-Ordner des Ziels — an einer Stelle, damit
 *  eine neue Kopier-Art nicht an zwei Orten nachgezogen werden muss. */
function zielFelder(ziel: KopieZiel): {
  spalten: { owner_id: string | null; team_id: string | null; visibility: "public" | "private" };
  ordner: BildOrdner;
} {
  switch (ziel.art) {
    case "team":
      return {
        spalten: { owner_id: null, team_id: ziel.teamId, visibility: "private" },
        ordner: teamOrdner(ziel.teamId),
      };
    case "persoenlich":
      return {
        spalten: { owner_id: ziel.ownerId, team_id: null, visibility: "private" },
        ordner: userOrdner(ziel.ownerId),
      };
  }
}

/** Kopiert ein ganzes Training samt aller Übungs-Fassungen mit eigenen Bild-
 *  und Diagrammkopien.
 *
 *  Die Kopie hält nicht fest, woraus sie entstanden ist: Sie ist ab dem ersten
 *  Moment eigenständig und frei änderbar, und ein Vermerk darauf, dass sie
 *  einmal aus etwas anderem hervorging, sagte darüber nichts Brauchbares.
 *
 *  Bei einem Fehler werden bereits kopierte Bilder und die halbe Kopie wieder
 *  entfernt — es bleibt nie eine Teilkopie zurück. */
export async function kopiereTraining(
  supabase: SupabaseClient,
  quelleId: string,
  ziel: KopieZiel,
): Promise<KopieErgebnis> {
  const { spalten, ordner } = zielFelder(ziel);

  // Quelle lesen — die RLS lässt nur durch, was der Handelnde sehen darf.
  const { data: quelle } = await supabase
    .from("trainings")
    .select("id, name, altersstufe, stufen")
    .eq("id", quelleId)
    .maybeSingle();
  if (!quelle) return { ok: false, error: "Das Training ist nicht (mehr) verfügbar." };

  const { data: quellFassungen, error: leseFehler } = await supabase
    .from("training_exercises")
    .select(FASSUNG_SELECT)
    .eq("training_id", quelleId);
  if (leseFehler) return { ok: false, error: leseFehler.message };

  const { data: neu, error: insertFehler } = await supabase
    .from("trainings")
    .insert({
      name: quelle.name,
      // Die Altersstufe wandert mit: Sie steht ab dem Anlegen fest, auch für
      // eine Kopie — Trainingsteile, Gliederung und Übungsbestand der Kopie
      // sind dieselben wie die des Originals (Story 1, Übungswelten).
      altersstufe: quelle.altersstufe,
      stufen: quelle.stufen ?? [],
      ...spalten,
    })
    .select("id")
    .single();
  if (insertFehler || !neu)
    return { ok: false, error: insertFehler?.message ?? "Kopieren fehlgeschlagen." };

  // Ab hier kann eine Teilkopie entstehen: jeder weitere Fehlerpfad räumt die
  // bereits erzeugten Bilddateien und das Ziel-Training wieder ab.
  const kopierteBilder: string[] = [];
  const abbrechen = async (fehler: string): Promise<KopieErgebnis> => {
    await entferneStorageObjekte(supabase, kopierteBilder);
    await supabase.from("trainings").delete().eq("id", neu.id);
    return { ok: false, error: fehler };
  };

  // Die IDs entstehen vorab: sie benennen die Bildkopien, die vor dem Insert
  // liegen müssen (der Pfad steht dann bereits in bild_url).
  const fassungen = (quellFassungen ?? []) as unknown as QuellFassung[];
  const bilder = await Promise.all(
    fassungen.map(async (f) => {
      const neueId = crypto.randomUUID();
      return { quelle: f, neueId, bild: await kopiereBild(supabase, f.bild_url, ordner, neueId) };
    }),
  );

  for (const { bild } of bilder) if (bild.pfad) kopierteBilder.push(bild.pfad);
  const bildFehler = bilder.find((b) => b.bild.error);
  if (bildFehler) return abbrechen(bildFehler.bild.error!);

  if (bilder.length > 0) {
    const { error } = await supabase.from("training_exercises").insert(
      bilder.map(({ quelle: f, neueId, bild }) => ({
        id: neueId,
        training_id: neu.id,
        trainingsteil: f.trainingsteil,
        hauptteilkategorie: f.hauptteilkategorie,
        position: f.position,
        duration_min: f.duration_min,
        // `altersstufe` steht bewusst nicht hier: Der Trigger
        // `te_altersstufe_erben` setzt sie aus dem Ziel-Training.
        ...inhaltFelder(f),
        bild_url: bild.url,
        diagramm: kopiereDiagrammVon(f.diagramm),
      })),
    );
    if (error) return abbrechen(error.message);
  }

  return { ok: true, neueId: neu.id };
}
