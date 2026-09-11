import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui";
import { ExerciseForm } from "@/components/exercise/ExerciseForm";
import { DiagrammVorschau } from "@/components/diagramm/DiagrammVorschau";
import { updateFassung } from "@/lib/actions/fassung";
import { getFassungZumBearbeiten } from "@/lib/queries/fassung";
import { trainingsKrumen } from "@/lib/brotkrumen";
import { VARIANTE_PARAM, varianteAnhang } from "@/lib/varianten";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Übung im Training bearbeiten — KiFu",
  robots: { index: false },
};

/* Eine Fassung im Training bearbeiten (Story 5). Sie ist eine eigenständige
   Kopie: Änderungen wirken ausschliesslich hier, nie auf die Vorlage in der
   Bibliothek und nie auf andere Trainings. Deshalb ist auch die Fassung einer
   Manual-Übung frei bearbeitbar, während der kuratierte Bestand unverändert
   bleibt. */
export default async function FassungBearbeitenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; teId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, teId } = await params;
  // Aus welcher Variante des Hauptteils heraus die Fassung geöffnet wurde
  // (#201). Sie wird gebraucht, um nach dem Speichern dorthin zurückzuführen —
  // und für den einen Fall, in dem die Fassung von ausserhalb in den Hauptteil
  // wandert und erstmals eine Variante braucht.
  const varianteRoh = (await searchParams)[VARIANTE_PARAM];
  const variante = Array.isArray(varianteRoh) ? varianteRoh[0] : varianteRoh;
  const anhang = varianteAnhang(variante);
  const f = await getFassungZumBearbeiten(teId);
  // Auch ein fremdes oder nicht existierendes Training endet hier — beides ist
  // für den Betrachter dasselbe.
  if (!f || f.trainingId !== id) notFound();

  const crumbs: BreadcrumbItem[] = trainingsKrumen(
    {
      id: f.trainingId,
      name: f.trainingName,
      team: f.trainingTeam,
      terminDatum: f.trainingTerminDatum,
    },
    [{ label: f.name }],
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <Breadcrumbs items={crumbs} className="mb-6" />
      <ExerciseForm
        action={updateFassung.bind(null, f.id, variante)}
        afterName={
          <DiagrammVorschau
            href={`/training/${f.trainingId}/uebung/${f.id}/diagramm${anhang}`}
            name={f.name}
            diagramm={f.diagramm}
          />
        }
        altersstufe={f.trainingAltersstufe}
        stufenWahl="fest"
        kontext="fassung"
        initial={{
          name: f.name,
          trainingsteil: f.trainingsteil,
          kategorien: f.kategorien,
          feldtyp: f.feldtyp,
          spielfeld_laenge_m: f.spielfeldLaengeM,
          spielfeld_breite_m: f.spielfeldBreiteM,
          erscheinungsform: f.erscheinungsform,
          hauptteilkategorie: f.hauptteilkategorie,
          uebungstyp: f.uebungstyp,
          anzahl_kinder: f.anzahlKinder,
          material: f.material,
          methodischer_fahrplan: f.fahrplan,
          aufbau: f.aufbau,
          varianten: f.varianten,
          bildUrl: f.bildUrl,
        }}
        submitLabel="Änderungen speichern"
        bildEntfernenMoeglich
        fussnote="Änderungen gelten nur für dieses Training."
      />
    </main>
  );
}
