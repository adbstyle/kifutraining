import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DiagrammEditor } from "@/components/diagramm/DiagrammEditor";
import type { BreadcrumbItem } from "@/components/ui";
import { getFassungZumBearbeiten } from "@/lib/queries/fassung";
import { trainingsKrumen } from "@/lib/brotkrumen";
import { saveFassungDiagramm } from "@/lib/actions/fassung";
import { parseDiagramm, LEERES_DIAGRAMM } from "@/lib/diagramm";
import { VARIANTE_PARAM, varianteAnhang } from "@/lib/varianten";

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
  searchParams,
}: {
  params: Promise<{ id: string; teId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, teId } = await params;
  // Die Variante reist über die Brotkrumen zurück (#201): Der Rückweg führt
  // über die Fassungs-Bearbeitung in den Editor, und beide Stufen sollen die
  // Zusammenstellung zeigen, aus der der Trainer gekommen ist.
  const varianteRoh = (await searchParams)[VARIANTE_PARAM];
  const variante = Array.isArray(varianteRoh) ? varianteRoh[0] : varianteRoh;
  const anhang = varianteAnhang(variante);
  const f = await getFassungZumBearbeiten(teId);
  if (!f || f.trainingId !== id) notFound();

  const crumbs: BreadcrumbItem[] = trainingsKrumen(
    {
      id: f.trainingId,
      name: f.trainingName,
      team: f.trainingTeam,
      terminDatum: f.trainingTerminDatum,
    },
    [
      { label: f.name, href: `/training/${f.trainingId}/uebung/${f.id}/edit${anhang}` },
      { label: "Feld-Diagramm" },
    ],
  );

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
