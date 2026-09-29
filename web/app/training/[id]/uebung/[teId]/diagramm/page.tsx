import { redirect } from "next/navigation";
import { VARIANTE_PARAM, varianteAnhang } from "@/lib/varianten";

/* Früher die eigene Seite des Diagramm-Editors einer Übung im Training. Seit
   #247 wird das Diagramm in deren Bearbeitungsmaske gezeichnet; eine alte
   Adresse führt dorthin, samt der Variante, die sie trug (PC 4). Das Recht
   prüft die Maske wie bei jedem Aufruf. */
export default async function FassungDiagrammWeiterleitung({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; teId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, teId } = await params;
  const varianteRoh = (await searchParams)[VARIANTE_PARAM];
  const variante = Array.isArray(varianteRoh) ? varianteRoh[0] : varianteRoh;
  redirect(`/training/${id}/uebung/${teId}/edit${varianteAnhang(variante)}`);
}
