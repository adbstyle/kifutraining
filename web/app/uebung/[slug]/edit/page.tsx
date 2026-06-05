import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { updateExercise } from "@/lib/actions/exercises";
import { getExerciseDetail } from "@/lib/queries/exercises";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/uebung/${slug}`}
        className="focus-ring type-label-medium mb-4 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zurück zur Übung
      </Link>
      <h1 className="type-headline-large mb-8 text-on-surface">Übung bearbeiten</h1>
      <ExerciseForm
        action={updateExercise.bind(null, ex.id)}
        initial={{
          name: ex.name,
          trainingsteil: ex.trainingsteil,
          kategorien: ex.kategorien,
          feldtyp: ex.feldtyp,
          erscheinungsform: ex.erscheinungsform,
          spielform: ex.spielform,
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
