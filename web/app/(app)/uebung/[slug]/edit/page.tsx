import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { type BreadcrumbItem } from "@/components/ui";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { updateExercise } from "@/lib/actions/exercises";
import { getExerciseDetail } from "@/lib/queries/exercises";
import { createClient } from "@/lib/supabase/server";
import { parseMaterialBasis, parseMaterialListe } from "@/lib/material";
import { EINORDNUNG_LABEL } from "@/lib/labels";
import { katalogFilterZiel } from "@/lib/filter-optionen";

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

  // Brotkrumen wie in der Detailseite, eine Stufe tiefer:
  // die Übung wird zum Link, „Übung bearbeiten" ist die aktuelle Seite und
  // ersetzt den separaten Seitentitel.
  // Der Brotkrumen-Link zielt auf die feinste Einordnung, die der Katalog
  // filtern kann — im Kinderfussball-Hauptteil auf die Hauptteilkategorie
  // (Story #129). Der TEXT bleibt die Einordnung selbst.
  const teilLabel = EINORDNUNG_LABEL[ex.trainingsteil] ?? ex.trainingsteil;
  const crumbs: BreadcrumbItem[] = [
    { label: "Übungen", href: "/" },
    { label: teilLabel, href: `/?teil=${katalogFilterZiel(ex)}` },
    { label: ex.name, href: `/uebung/${slug}` },
    { label: "Übung bearbeiten" },
  ];

  return (
    <Seitenrahmen breite="6xl" krumen={crumbs}>
      <h1 className="sr-only">Übung bearbeiten</h1>
      <ExerciseForm
        action={updateExercise.bind(null, ex.id)}
        // Gezeichnet wird in der Maske (#247); als Vorlage taugt die Übung
        // sich selbst nicht.
        diagramm={ex.diagramm}
        vorlagenAusser={ex.id}
        altersstufe={ex.altersstufe}
        stufenWahl="fest"
        kontext="bibliothek"
        // Die Übung gehört dem angemeldeten USER (oben geprüft) und ist eine
        // Nutzer-Übung — nur hier lässt sie sich in die andere Altersstufe
        // überführen (Story 4 AK 1/5).
        ueberfuehrbar
        materialBasis={parseMaterialBasis(ex.material_basis)}
        initial={{
          name: ex.name,
          trainingsteil: ex.trainingsteil,
          kategorien: ex.kategorien,
          feldtyp: ex.feldtyp,
          spielfeld_laenge_m: ex.spielfeld_laenge_m,
          spielfeld_breite_m: ex.spielfeld_breite_m,
          erscheinungsform: ex.erscheinungsform,
          hauptteilkategorie: ex.hauptteilkategorie,
          uebungstyp: ex.uebungstyp,
          anzahl_kinder: ex.anzahl_kinder,
          material: ex.material,
          materialListe: parseMaterialListe(ex.material_liste),
          methodischer_fahrplan: ex.methodischer_fahrplan,
          aufbau: ex.aufbau,
          varianten: ex.varianten_text,
          bildUrl: ex.bild_url,
        }}
        submitLabel="Änderungen speichern"
      />
    </Seitenrahmen>
  );
}
