import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import {
  HerkunftBadge,
  Breadcrumbs,
  type BreadcrumbItem,
  Card,
  KategorieChip,
  MethodischerFahrplan,
  PrintButton,
  UebungsBild,
} from "@/components/ui";
import { Flash } from "@/components/Flash";
import { cn } from "@/lib/cn";
import { OwnerActions } from "@/components/exercise/OwnerActions";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { UebungUebernehmenButton } from "@/components/exercise/UebungUebernehmenButton";
import { createClient } from "@/lib/supabase/server";
import {
  getExerciseDetail,
  isFavorited,
  type ExerciseDetail,
} from "@/lib/queries/exercises";
import {
  feldtyp as feldLabels,
  uebungstyp as uebungstypLabels,
  hauptteilkategorie as hkatLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import { EINORDNUNG_LABEL, ERSCHEINUNGSFORM_LABEL } from "@/lib/labels";
import { traegtFeldtyp, traegtSpielfeldgroesse } from "@/lib/altersstufe";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExerciseDetail(slug).catch(() => null);
  if (!ex) return { title: "Übung nicht gefunden" };
  return { title: `${ex.name} — Übung` };
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="type-label-small text-on-surface-variant">{label}</p>
      <div className="type-body-large mt-1 text-on-surface">{children}</div>
    </div>
  );
}

function anzahlText(a: ExerciseDetail["anzahl_kinder"]): string | null {
  if (!a) return null;
  const { min, max } = a;
  if (min != null && max != null)
    return min === max ? `${min}` : `${min}–${max}`;
  if (min != null) return `ab ${min}`;
  if (max != null) return `bis ${max}`;
  return null;
}

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    uebernommen?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();
  const flash = sp.created
    ? "Übung erstellt."
    : sp.updated
      ? "Änderungen gespeichert."
      : sp.uebernommen
        ? "Kopie liegt in deinem Bestand — du kannst sie jetzt anpassen."
        : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = ex.source === "user" && !!user && ex.owner_id === user.id;
  // Favoriten-Aktion nur für angemeldete USER (AC2/AC11).
  const favorited = user ? await isFavorited(ex.id) : false;

  // Einordnung wandert in die Brotkrumen (als Filter-Link auf den Pool); die
  // Eyebrow-Zeile zeigt nur noch ergänzenden Kontext.
  const teilLabel = EINORDNUNG_LABEL[ex.trainingsteil] ?? ex.trainingsteil;
  const crumbs: BreadcrumbItem[] = [
    { label: "Übungspool", href: "/" },
    { label: teilLabel, href: `/?teil=${ex.trainingsteil}` },
    { label: ex.name },
  ];
  // Feldtyp und Spielfeldgrösse schliessen einander aus: der Feldtyp ist eine
  // Kategorie des Manuals Fussball Kinder, die Spielfeldgrösse führt das
  // Junioren-Manual an seiner Stelle (Story 3 AK 8/10).
  const spielfeld =
    traegtSpielfeldgroesse(ex.altersstufe) &&
    ex.spielfeld_laenge_m != null &&
    ex.spielfeld_breite_m != null
      ? `${ex.spielfeld_laenge_m} × ${ex.spielfeld_breite_m} m`
      : null;
  const meta = [
    traegtFeldtyp(ex.altersstufe) && ex.feldtyp
      ? feldLabels[ex.feldtyp as keyof typeof feldLabels]
      : null,
    spielfeld,
  ].filter(Boolean);
  const anzahl = anzahlText(ex.anzahl_kinder);
  const hatEckdaten =
    !!spielfeld ||
    !!ex.hauptteilkategorie ||
    !!ex.uebungstyp ||
    ex.erscheinungsform.length > 0 ||
    !!anzahl ||
    ex.material.length > 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {flash && (
        <div className="print:hidden">
          <Flash message={flash} />
        </div>
      )}
      <div className="print:hidden">
        <Breadcrumbs items={crumbs} />
      </div>

      <header className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          {ex.kategorien.length > 0 && (
            <>
              <div
                className="flex items-center gap-1.5"
                aria-label="Geeignete Alterskategorien"
              >
                {ex.kategorien.map((k) => (
                  <KategorieChip key={k} k={k as KategorieSlug} />
                ))}
              </div>
              <span aria-hidden className="h-3.5 w-px bg-outline-variant" />
            </>
          )}
          <HerkunftBadge herkunft={ex.source} visibility={ex.visibility} />

          {/* Aktions-Cluster rechts: Drucken · Stift · Globus · Herz · ⋮.
              Drucken steht ausserhalb der Anmelde-Bedingung: eine Übung lässt
              sich auch ohne Konto ausdrucken (Story #114 AK 3). Owner sieht
              alle Aktionen, sonstige angemeldete User nur den Favoriten.
              Im Druck ist der ganze Cluster weg — auf dem Blatt hat kein
              Bedienelement etwas verloren (Postcondition 5). */}
          <div className="ml-auto flex items-center gap-0.5 print:hidden">
            <PrintButton variant="icon" size="sm" />
            {(isOwner || user) && (
              <>
                {isOwner ? (
                  <OwnerActions
                    id={ex.id}
                    slug={ex.slug}
                    visibility={ex.visibility}
                    favoriteSlot={
                      <FavoriteButton
                        exerciseId={ex.id}
                        initial={favorited}
                        size="sm"
                      />
                    }
                  />
                ) : (
                  <>
                    {/* Übernehmen (Story 7, Übungswelten) — nur an einer
                        fremden oder kuratierten Übung: die eigene liegt
                        bereits im Bestand. */}
                    <UebungUebernehmenButton exerciseId={ex.id} name={ex.name} />
                    <FavoriteButton
                      exerciseId={ex.id}
                      initial={favorited}
                      size="sm"
                    />
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <h1 className="type-headline-large text-on-surface">{ex.name}</h1>
        {meta.length > 0 && (
          <p className="type-label-medium mt-2 text-on-surface-variant">
            {meta.join(" · ")}
          </p>
        )}
      </header>

      {/* Aktives Bild — gezeichnetes Diagramm, Foto oder Platzhalter */}
      <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-[6px] border border-outline-variant">
        <UebungsBild
          name={ex.name}
          bildUrl={ex.bild_url}
          diagramm={ex.diagramm}
          bildQuelle={ex.bild_quelle}
          sizes="(max-width: 896px) 100vw, 896px"
        />
      </div>
      {/* Eckdaten — unterhalb des Bildes.

          Der Trainingsteil steht am Bildschirm in den Brotkrumen und wäre hier
          doppelt. Im Druck sind die Brotkrumen weg, und der Ausdruck muss ihn
          nennen (Story #114 AK 4) — dort tritt er an ihre Stelle. Die Leiste
          selbst bleibt am Bildschirm verborgen, wenn sie ausser ihm nichts zu
          zeigen hat, damit dort kein leerer Abstand entsteht. */}
      <div
        className={cn(
          "mt-6 flex flex-wrap gap-x-12 gap-y-5",
          !hatEckdaten && "hidden print:flex",
        )}
      >
        <div className="hidden print:block">
          <Meta label="Trainingsteil">{teilLabel}</Meta>
        </div>
        {spielfeld && <Meta label="Spielfeldgrösse">{spielfeld}</Meta>}
        {ex.hauptteilkategorie && (
          <Meta label="Hauptteilkategorie">
            {hkatLabels[ex.hauptteilkategorie as keyof typeof hkatLabels] ??
              ex.hauptteilkategorie}
          </Meta>
        )}
        {ex.uebungstyp && (
          <Meta label="Übungstyp">
            {uebungstypLabels[ex.uebungstyp as keyof typeof uebungstypLabels] ??
              ex.uebungstyp}
          </Meta>
        )}
        {ex.erscheinungsform.length > 0 && (
          <Meta label="Erscheinungsform">
            {ex.erscheinungsform
              .map((f) => ERSCHEINUNGSFORM_LABEL[f] ?? f)
              .join(", ")}
          </Meta>
        )}
        {anzahl && <Meta label="Anzahl Kinder">{anzahl}</Meta>}
        {ex.material.length > 0 && (
          <Meta label="Material">{ex.material.join(", ")}</Meta>
        )}
      </div>

      {/* Ablauf */}
      <section className="mt-10">
        <h2 className="type-headline-small mb-4 text-on-surface">
          Übungsablauf
        </h2>
        <Card className="p-6">
          {ex.methodischer_fahrplan ? (
            <MethodischerFahrplan fahrplan={ex.methodischer_fahrplan} />
          ) : ex.aufbau ? (
            <p className="type-body-large whitespace-pre-line text-on-surface-variant">
              {ex.aufbau}
            </p>
          ) : (
            <p className="type-body-medium text-on-surface-variant">
              Kein Ablauf erfasst.
            </p>
          )}
        </Card>
      </section>

      {/* Varianten */}
      {ex.varianten.length > 0 && (
        <section className="mt-8">
          <h2 className="type-headline-small mb-4 text-on-surface">
            Varianten
          </h2>
          <ul className="type-body-large list-disc space-y-1 pl-5 text-on-surface-variant">
            {ex.varianten.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Herkunft auf dem Ausdruck (Story #114 AK 7). Am Bildschirm sagt sie
          schon die Plakette oben; auf Papier fehlt sie, denn die Plakette nennt
          beim eigenen Entwurf nur den Zustand, nicht die Herkunft. Darum im
          Druck ein eigener Satz für alle drei Fälle — und der Manual-Fuss
          darunter entfällt dort, sonst stünde dieselbe Aussage zweimal.

          Bewusste Abweichung vom Trainings-Druck, der keine Herkunft trägt: ein
          Blatt aus der Bibliothek weist seine Quelle aus (PO 2026-08-28), für
          das Training bleibt der Entscheid von 2026-08-23 unverändert. */}
      <footer className="mt-10 hidden border-t border-outline-variant pt-4 print:block">
        {ex.source === "manual" ? (
          <p className="type-body-small text-on-surface-variant">
            Offizielle Übung aus dem{" "}
            <strong className="text-on-surface">Manual Kinderfussball</strong>{" "}
            des Schweizerischen Fussballverbands (SFV) — kuratierter Bestand,
            unverändert übernommen.
          </p>
        ) : (
          <p className="type-body-small text-on-surface-variant">
            Übung aus der{" "}
            <strong className="text-on-surface">Gemeinschaft</strong> der
            Trainerinnen und Trainer, nicht aus dem Manual Kinderfussball.
            {ex.visibility === "private" &&
              " Noch nicht veröffentlicht — ein Entwurf."}
          </p>
        )}
      </footer>

      {/* Quellen-/Urheberangabe (Manual), nur am Bildschirm */}
      {ex.source === "manual" && (
        <footer className="mt-12 flex items-start gap-2 border-t border-outline-variant pt-5 print:hidden">
          <BookOpen
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-on-surface-variant"
            aria-hidden
          />
          <p className="type-body-small text-on-surface-variant">
            Offizielle Übung aus dem{" "}
            <strong className="text-on-surface">Manual Kinderfussball</strong>{" "}
            des Schweizerischen Fussballverbands (SFV) — kuratierter Bestand,
            unverändert übernommen.
          </p>
        </footer>
      )}
    </main>
  );
}
