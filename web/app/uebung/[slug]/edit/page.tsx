import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { DiagrammVorschau } from "@/components/diagramm/DiagrammVorschau";
import { updateExercise } from "@/lib/actions/exercises";
import { getExerciseDetail } from "@/lib/queries/exercises";
import { createClient } from "@/lib/supabase/server";
import { trainingsteil as teilLabels } from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Übung bearbeiten — KiFu", robots: { index: false } };

export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();

  // Nur eigene Nutzer-Übungen sind bearbeitbar (Story 7 EK5). Manual/fremd -> Detail.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (ex.source !== "user" || !user || ex.owner_id !== user.id) {
    redirect(`/uebung/${slug}`);
  }

  // Brotkrumen wie in der Detailseite/im Diagramm-Editor, eine Stufe tiefer:
  // die Übung wird zum Link, „Übung bearbeiten" ist die aktuelle Seite und
  // ersetzt den separaten Seitentitel.
  const teilLabel =
    teilLabels[ex.trainingsteil as keyof typeof teilLabels] ?? ex.trainingsteil;
  const crumbs: BreadcrumbItem[] = [
    { label: "Übungspool", href: "/" },
    { label: teilLabel, href: `/?teil=${ex.trainingsteil}` },
    { label: ex.name, href: `/uebung/${slug}` },
    { label: "Übung bearbeiten" },
  ];

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={crumbs} className="mb-6" />
      <ExerciseForm
        action={updateExercise.bind(null, ex.id)}
        afterName={
          <DiagrammVorschau slug={slug} name={ex.name} diagramm={ex.diagramm} />
        }
        initial={{
          name: ex.name,
          trainingsteil: ex.trainingsteil,
          kategorien: ex.kategorien,
          feldtyp: ex.feldtyp,
          erscheinungsform: ex.erscheinungsform,
          hauptteilkategorie: ex.hauptteilkategorie,
          anzahl_kinder: ex.anzahl_kinder,
          material: ex.material,
          methodischer_fahrplan: ex.methodischer_fahrplan,
          aufbau: ex.aufbau,
          varianten: ex.varianten,
          bildUrl: ex.bild_url,
        }}
        submitLabel="Änderungen speichern"
      />
    </main>
  );
}
