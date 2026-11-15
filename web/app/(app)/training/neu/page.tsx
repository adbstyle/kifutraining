import type { Metadata } from "next";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { BestandAnzeige } from "@/components/ui";
import { TrainingCreateForm } from "@/components/training/TrainingCreateForm";
import { istVoll } from "@/lib/konto-grenzen";
import { getMeineGrenzen } from "@/lib/queries/verein";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Neues Training - KiFu",
  robots: { index: false },
};

export default async function NeuesTrainingPage() {
  // Wie bei «Neue Übung»: Ein Konto ohne Verein erfährt den Stand, bevor es
  // Angaben macht (#588 AK 5); die Datenebene entscheidet beim Anlegen.
  const grenzen = await getMeineGrenzen();
  const voll = grenzen !== null && istVoll(grenzen.trainings);

  return (
    <Seitenrahmen
      breite="4xl"
      krumen={[
        { label: "Trainings", href: "/trainings" },
        { label: "Neues Training" },
      ]}
    >
      {/* Kopf wie bei «Neue Übung»: Brotkrumen, darunter der Name als
          Kopf-Feld der Maske. Die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">Neues Training</h1>
      {grenzen && voll ? (
        <BestandAnzeige art="trainings" grenze={grenzen.trainings} variante="meldung" />
      ) : (
        <>
          {grenzen && <BestandAnzeige art="trainings" grenze={grenzen.trainings} className="mb-4" />}
          <TrainingCreateForm />
        </>
      )}
    </Seitenrahmen>
  );
}
