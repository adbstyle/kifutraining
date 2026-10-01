import type { Metadata } from "next";
import { SeitenKopf } from "@/components/layout/SeitenKopf";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { createExercise } from "@/lib/actions/exercises";
import {
  alsAltersstufe,
  einordnungsSlugsFuer,
  traegtHauptteilkategorie,
} from "@/lib/altersstufe";
import { hauptteilkategorieSlugs } from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Neue Übung — KiFu", robots: { index: false } };

export default async function NeuePage({
  searchParams,
}: {
  searchParams: Promise<{ stufe?: string; teil?: string; kategorie?: string }>;
}) {
  const sp = await searchParams;
  // Vorbelegung aus der Adresse: wer aus einem leeren Trainingsblock heraus
  // erfasst, soll dort nicht zweimal wählen müssen. Unbekanntes wird still
  // ignoriert — die Vorbelegung ist Bequemlichkeit, kein Vertrag. Der
  // Kinderfussball bleibt die Vorgabe (Story 1 AC 8).
  const altersstufe = alsAltersstufe(sp.stufe);
  const teil =
    sp.teil && einordnungsSlugsFuer(altersstufe).includes(sp.teil) ? sp.teil : undefined;
  // Die Hauptteilkategorie nur, wo die Einordnung sie trägt — ein leerer
  // Kinderfussball-Hauptteil-Block schickt sie mit.
  const kategorie =
    teil &&
    traegtHauptteilkategorie(altersstufe, teil) &&
    (hauptteilkategorieSlugs as string[]).includes(sp.kategorie ?? "")
      ? sp.kategorie
      : undefined;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Kopf wie im Trainings-Editor: Brotkrumen, darunter der Name als
          Kopf-Feld der Maske. Die Überschrift trägt die Seite unsichtbar. */}
      <SeitenKopf
        krumen={[{ label: "Übungspool", href: "/" }, { label: "Neue Übung" }]}
        className="mb-6"
      />
      <h1 className="sr-only">Neue Übung</h1>
      <ExerciseForm
        action={createExercise}
        altersstufe={altersstufe}
        stufenWahl="waehlbar"
        kontext="bibliothek"
        initial={{ trainingsteil: teil, hauptteilkategorie: kategorie }}
        submitLabel="Übung speichern"
      />
    </main>
  );
}
