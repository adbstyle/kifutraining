import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { DiagrammVorschau } from "@/components/diagramm/DiagrammVorschau";
import { updateFassung } from "@/lib/actions/fassung";
import { getFassungZumBearbeiten } from "@/lib/queries/fassung";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Übung im Training bearbeiten — KiFu",
  robots: { index: false },
};

/* Eine Fassung im Training bearbeiten (Story 5). Sie ist eine eigenständige
   Kopie: Änderungen wirken ausschliesslich hier, nie auf die Vorlage in der
   Bibliothek und nie auf andere Trainings. Deshalb ist auch die Fassung einer
   Manual-Übung frei bearbeitbar, während der kuratierte Bestand unverändert
   bleibt. */
export default async function FassungBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string; teId: string }>;
}) {
  const { id, teId } = await params;
  const f = await getFassungZumBearbeiten(teId);
  // Auch ein fremdes oder nicht existierendes Training endet hier — beides ist
  // für den Betrachter dasselbe.
  if (!f || f.trainingId !== id) notFound();

  const crumbs: BreadcrumbItem[] = [
    { label: "Trainings", href: "/trainings" },
    { label: f.trainingName, href: `/training/${f.trainingId}/edit` },
    { label: f.name },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={crumbs} className="mb-6" />
      <ExerciseForm
        action={updateFassung.bind(null, f.id)}
        afterName={
          <DiagrammVorschau
            href={`/training/${f.trainingId}/uebung/${f.id}/diagramm`}
            name={f.name}
            diagramm={f.diagramm}
          />
        }
        initial={{
          name: f.name,
          trainingsteil: f.trainingsteil,
          kategorien: f.kategorien,
          feldtyp: f.feldtyp,
          erscheinungsform: f.erscheinungsform,
          hauptteilkategorie: f.hauptteilkategorie,
          anzahl_kinder: f.anzahlKinder,
          material: f.material,
          methodischer_fahrplan: f.fahrplan,
          aufbau: f.aufbau,
          varianten: f.varianten,
          bildUrl: f.bildUrl,
        }}
        submitLabel="Änderungen speichern"
        bildEntfernenMoeglich
        fussnote="Änderungen gelten nur für dieses Training."
      />
    </main>
  );
}
