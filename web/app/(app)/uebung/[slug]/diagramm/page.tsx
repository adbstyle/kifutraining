import { redirect } from "next/navigation";

/* Früher die eigene Seite des Diagramm-Editors. Seit #247 wird das Diagramm
   in der Bearbeitungsmaske gezeichnet; eine alte Adresse (Lesezeichen,
   Verlauf) führt dorthin, und die Maske prüft das Recht wie jeder Aufruf
   (PC 4). */
export default async function DiagrammWeiterleitung({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/uebung/${slug}/edit`);
}
