import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  KategorieChip,
  MethodischerFahrplan,
  PrintButton,
  UebungsBild,
} from "@/components/ui";
import { getExerciseDetail, type ExerciseDetail } from "@/lib/queries/exercises";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  hauptteilkategorie as hkatLabels,
  type KategorieSlug,
} from "@/lib/vocab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Übung drucken — KiFu",
  robots: { index: false },
};

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label-small text-on-surface-variant">{label}</p>
      <div className="type-body-medium mt-1 text-on-surface">{children}</div>
    </div>
  );
}

function anzahlText(a: ExerciseDetail["anzahl_kinder"]): string | null {
  if (!a) return null;
  const { min, max } = a;
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  if (min != null) return `ab ${min}`;
  if (max != null) return `bis ${max}`;
  return null;
}

/** Woher die Übung stammt — als Satz für den Fuss des Blattes (AK 7).
 *
 *  Drei Fälle statt zwei: Der Bestand kennt neben Manual und veröffentlichter
 *  Trainerübung auch den eigenen, noch privaten Entwurf. Der ist druckbar
 *  (AK 2), wäre aber ohne Zusatz von einer Gemeinschafts-Übung nicht zu
 *  unterscheiden — auf Papier soll ein Entwurf nicht wie ein fertiger Beitrag
 *  wirken (PO-Entscheid 2026-08-28).
 *
 *  Ein Trainername steht nirgends: ausgewiesen wird die Herkunft als solche
 *  (Out of Scope 5). */
function HerkunftsHinweis({ ex }: { ex: ExerciseDetail }) {
  if (ex.source === "manual") {
    return (
      <p className="type-body-small text-on-surface-variant">
        Offizielle Übung aus dem{" "}
        <strong className="text-on-surface">Manual Kinderfussball</strong> des
        Schweizerischen Fussballverbands (SFV) — kuratierter Bestand,
        unverändert übernommen.
      </p>
    );
  }
  return (
    <p className="type-body-small text-on-surface-variant">
      Übung aus der <strong className="text-on-surface">Gemeinschaft</strong> der
      Trainerinnen und Trainer, nicht aus dem Manual Kinderfussball.
      {ex.visibility === "private" && " Noch nicht veröffentlicht — ein Entwurf."}
    </p>
  );
}

/** Druckfertiges Blatt einer einzelnen Bibliotheks-Übung (Story #114).
 *
 *  Eigene Route statt Druck-CSS auf der Detailseite: so trägt die Seite von
 *  vornherein nur den Druckinhalt und kein Bedienelement (Postcondition 5) —
 *  ausser dem Auslöser selbst, den der Druck ausblendet.
 *
 *  Welche Übungen sichtbar sind, entscheidet die RLS: anonym der Manual-Bestand
 *  und die öffentlichen Trainerübungen, angemeldet zusätzlich die eigenen
 *  (AK 2 und AK 3). Hier steht deshalb keine eigene Sichtbarkeitsprüfung.
 *
 *  Herkunft im Fuss: eine bewusste Abweichung vom Trainings-Druck, der keine
 *  trägt. Ein Blatt, das eine einzelne Übung aus der Bibliothek heraus trägt,
 *  weist deren Herkunft aus (PO-Entscheid 2026-08-28); für den Trainings-Druck
 *  bleibt der Entscheid von 2026-08-23 unverändert. */
export default async function UebungDruckPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();

  const anzahl = anzahlText(ex.anzahl_kinder);
  const teilLabel =
    teilLabels[ex.trainingsteil as keyof typeof teilLabels] ?? ex.trainingsteil;

  // Jede Angabe erscheint nur, wenn die Übung sie führt (Postcondition 2).
  const eckdaten = [
    { label: "Trainingsteil", wert: teilLabel },
    ex.hauptteilkategorie && {
      label: "Hauptteilkategorie",
      wert:
        hkatLabels[ex.hauptteilkategorie as keyof typeof hkatLabels] ??
        ex.hauptteilkategorie,
    },
    ex.erscheinungsform.length > 0 && {
      label: "Erscheinungsform",
      wert: ex.erscheinungsform
        .map((f) => formLabels[f as keyof typeof formLabels] ?? f)
        .join(", "),
    },
    ex.feldtyp && {
      label: "Feldtyp",
      wert: feldLabels[ex.feldtyp as keyof typeof feldLabels] ?? ex.feldtyp,
    },
    anzahl && { label: "Anzahl Kinder", wert: anzahl },
    ex.material.length > 0 && { label: "Material", wert: ex.material.join(", ") },
  ].filter((e): e is { label: string; wert: string } => !!e);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-outline pb-4">
        <h1 className="type-headline-large text-on-surface">{ex.name}</h1>
        {ex.kategorien.length > 0 && (
          <div
            className="mt-2 flex flex-wrap items-center gap-2"
            aria-label="Geeignete Alterskategorien"
          >
            {ex.kategorien.map((k) => (
              <KategorieChip key={k} k={k as KategorieSlug} />
            ))}
          </div>
        )}
      </header>

      {/* Diagramm, Foto oder leere Feld-Skizze — dieselbe Weiche wie überall
          sonst (Postcondition 3). Das Diagramm entsteht als SVG und bleibt
          darum in jeder Vergrösserung scharf. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[6px] border border-outline-variant">
        <UebungsBild
          name={ex.name}
          bildUrl={ex.bild_url}
          diagramm={ex.diagramm}
          bildQuelle={ex.bild_quelle}
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
        {eckdaten.map((e) => (
          <Meta key={e.label} label={e.label}>
            {e.wert}
          </Meta>
        ))}
      </div>

      {/* Kein `break-inside-avoid` um Ablauf und Varianten: sie dürfen über die
          Seite hinauslaufen und müssen dann umbrechen (Postcondition 4).
          Zusammengehalten wird nur die Überschrift mit ihrem Anfang, sonst
          bliebe eine Seite bis auf den Titel leer. */}
      <section className="mt-8">
        <h2 className="mb-3 break-after-avoid border-b border-outline-variant pb-1 type-title-medium text-on-surface">
          Übungsablauf
        </h2>
        {ex.methodischer_fahrplan ? (
          <MethodischerFahrplan fahrplan={ex.methodischer_fahrplan} />
        ) : ex.aufbau ? (
          <p className="type-body-medium whitespace-pre-line text-on-surface-variant">
            {ex.aufbau}
          </p>
        ) : (
          <p className="type-body-medium text-on-surface-variant">
            Kein Ablauf erfasst.
          </p>
        )}
      </section>

      {ex.varianten.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 break-after-avoid border-b border-outline-variant pb-1 type-title-medium text-on-surface">
            Varianten
          </h2>
          <ul className="type-body-medium list-disc space-y-1 pl-5 text-on-surface-variant">
            {ex.varianten.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-10 border-t border-outline-variant pt-4">
        <HerkunftsHinweis ex={ex} />
      </footer>
    </main>
  );
}
