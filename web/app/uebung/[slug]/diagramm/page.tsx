import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { DiagrammEditor } from "@/components/diagramm/DiagrammEditor";
import { getExerciseDetail } from "@/lib/queries/exercises";
import { createClient } from "@/lib/supabase/server";
import { parseDiagramm, LEERES_DIAGRAMM } from "@/lib/diagramm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feld-Diagramm zeichnen — KiFu",
  robots: { index: false },
};

export default async function DiagrammPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();

  // Diagramme gibt es nur für eigene Nutzer-Übungen (Epic #47 Precondition).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (ex.source !== "user" || !user || ex.owner_id !== user.id) {
    redirect(`/uebung/${slug}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <DiagrammEditor
        exerciseId={ex.id}
        slug={slug}
        name={ex.name}
        initial={parseDiagramm(ex.diagramm) ?? LEERES_DIAGRAMM}
      />
    </main>
  );
}
