import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui";
import type { Metadata } from "next";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { updateExercise } from "@/lib/actions/exercises";
import { setBildQuelle } from "@/lib/actions/diagramm";
import { getExerciseDetail } from "@/lib/queries/exercises";
import { createClient } from "@/lib/supabase/server";
import { aktivesBild, hatDiagramm } from "@/lib/diagramm";

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

  const mitDiagramm = hatDiagramm(ex.diagramm);
  const aktiv = aktivesBild({
    bildQuelle: ex.bild_quelle,
    bildUrl: ex.bild_url,
    diagramm: ex.diagramm,
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/uebung/${slug}`}
        className="focus-ring type-label-medium mb-4 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zurück zur Übung
      </Link>
      <h1 className="type-headline-large mb-4 text-on-surface">Übung bearbeiten</h1>
      <div className="mb-8 flex flex-col gap-3 rounded-[6px] border border-outline-variant bg-surface-container p-4">
        <div className="flex items-center gap-3">
          <PenLine size={20} strokeWidth={2} className="shrink-0 text-primary" aria-hidden />
          <p className="type-body-medium flex-1 text-on-surface-variant">
            Spielfeld-Skizze mit Toren, Hütchen und Spielern direkt in der App zeichnen.
          </p>
          <ButtonLink href={`/uebung/${slug}/diagramm`} variant="tonal" size="sm">
            {mitDiagramm ? "Diagramm bearbeiten" : "Diagramm zeichnen"}
          </ButtonLink>
        </div>
        {/* Aktives Anzeige-Bild wählen — nur wenn Foto UND Diagramm existieren (#56). */}
        {mitDiagramm && ex.bild_url && (
          <div className="flex items-center gap-2 border-t border-outline-variant pt-3">
            <span className="type-label-small text-on-surface-variant">Angezeigt wird</span>
            <form action={setBildQuelle.bind(null, ex.id, "diagramm")}>
              <Button type="submit" variant={aktiv === "diagramm" ? "filled" : "outlined"} size="sm">
                Diagramm
              </Button>
            </form>
            <form action={setBildQuelle.bind(null, ex.id, "foto")}>
              <Button type="submit" variant={aktiv === "foto" ? "filled" : "outlined"} size="sm">
                Foto
              </Button>
            </form>
          </div>
        )}
      </div>
      <ExerciseForm
        action={updateExercise.bind(null, ex.id)}
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
