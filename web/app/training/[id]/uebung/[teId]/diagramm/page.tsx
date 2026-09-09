import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DiagrammEditor } from "@/components/diagramm/DiagrammEditor";
import type { BreadcrumbItem } from "@/components/ui";
import { getFassungZumBearbeiten } from "@/lib/queries/fassung";
import { saveFassungDiagramm } from "@/lib/actions/fassung";
import { parseDiagramm, LEERES_DIAGRAMM } from "@/lib/diagramm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Feld-Diagramm im Training zeichnen — KiFu",
  robots: { index: false },
};

/* Das Diagramm einer Fassung zeichnen (Story 5 AK 4). Derselbe Editor wie für
   Bibliotheks-Übungen; gespeichert wird an der Fassung, das Schreibrecht hängt
   am Training. Der Vorlagen-Fundus bleibt hier bewusst leer: die Fassung bringt
   ihr Diagramm aus der Übernahme ins Training mit, und das Kopieren einer
   weiteren Diagramm-Vorlage ist Sache der Bibliothek. */
export default async function FassungDiagrammPage({
  params,
}: {
  params: Promise<{ id: string; teId: string }>;
}) {
  const { id, teId } = await params;
  const f = await getFassungZumBearbeiten(teId);
  if (!f || f.trainingId !== id) notFound();

  const crumbs: BreadcrumbItem[] = [
    { label: "Trainings", href: "/trainings" },
    { label: f.trainingName, href: `/training/${f.trainingId}/edit` },
    { label: f.name, href: `/training/${f.trainingId}/uebung/${f.id}/edit` },
    { label: "Feld-Diagramm" },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <DiagrammEditor
        speichern={saveFassungDiagramm.bind(null, f.id)}
        name={f.name}
        crumbs={crumbs}
        initial={parseDiagramm(f.diagramm) ?? LEERES_DIAGRAMM}
        vorlagen={[]}
      />
    </main>
  );
}
