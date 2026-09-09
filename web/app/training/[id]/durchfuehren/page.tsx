import type { Metadata } from "next";
import { getTrainingView } from "@/lib/queries/trainings";
import { getTerminZuTraining } from "@/lib/queries/termine";
import { TrainingNotAvailable } from "@/components/training/TrainingNotAvailable";
import { TrainingDurchfuehren } from "@/components/training/TrainingDurchfuehren";
import { trainingsKrumen } from "@/lib/brotkrumen";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Training durchführen — KiFu",
  robots: { index: false },
};

export default async function TrainingDurchfuehrenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ termin?: string }>;
}) {
  const { id } = await params;
  const training = await getTrainingView(id);
  if (!training) return <TrainingNotAvailable />;

  // Termin-Kontext nur, wenn aus dem Plan geöffnet (`?termin=…`). Gelesen wird
  // der Termin DES TRAININGS, nicht der übergebene — so kann eine manipulierte
  // Adresse keinen fremden Termin an ein Training heften. Die RLS gibt Termine
  // ohnehin nur Team-Mitgliedern.
  const { termin: terminParam } = await searchParams;
  const termin = terminParam ? await getTerminZuTraining(id) : null;

  return (
    <TrainingDurchfuehren
      training={training}
      // Der Rückweg hängt am Training, nicht am Aufrufweg: das Termindatum
      // dafür kommt aus dem Training selbst (`terminDatum`), nicht aus
      // `?termin=` — sonst sähen dieselbe Seite je nach Herkunft zwei
      // verschiedene Brotkrumen (#156 PC 1).
      crumbs={trainingsKrumen(training)}
      termin={
        termin
          ? {
              datum: termin.datum,
              beginn: termin.beginn,
              ort: termin.ort,
              bemerkung: termin.bemerkung,
            }
          : undefined
      }
    />
  );
}
