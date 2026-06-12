import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
      <Link
        href={`/uebung/${slug}`}
        className="focus-ring type-label-medium mb-4 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zurück zur Übung
      </Link>
      <h1 className="type-headline-large mb-2 text-on-surface">Feld-Diagramm</h1>
      <p className="type-body-medium mb-8 text-on-surface-variant">
        {ex.name} — Elemente platzieren, verschieben und entfernen. Änderungen
        werden automatisch gespeichert.
      </p>
      <DiagrammEditor
        exerciseId={ex.id}
        initial={parseDiagramm(ex.diagramm) ?? LEERES_DIAGRAMM}
      />
    </main>
  );
}
