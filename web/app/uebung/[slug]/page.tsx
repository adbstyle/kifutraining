import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import {
  HerkunftBadge,
  HerkunftsAngabe,
  Breadcrumbs,
  type BreadcrumbItem,
  Card,
  KategorieChip,
  MethodischerFahrplan,
  UebungsBild,
} from "@/components/ui";
import { Flash } from "@/components/Flash";
import { OwnerActions } from "@/components/exercise/OwnerActions";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { createClient } from "@/lib/supabase/server";
import {
  getExerciseDetail,
  isFavorited,
  type ExerciseDetail,
} from "@/lib/queries/exercises";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  hauptteilkategorie as hkatLabels,
  type KategorieSlug,
} from "@/lib/vocab";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ex = await getExerciseDetail(slug).catch(() => null);
  if (!ex) return { title: "Übung nicht gefunden" };
  return { title: `${ex.name} — Kinderfussball-Übung` };
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
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
  if (min != null && max != null) return min === max ? `${min}` : `${min}–${max}`;
  if (min != null) return `ab ${min}`;
  if (max != null) return `bis ${max}`;
  return null;
}

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();
  const flash = sp.created ? "Übung erstellt." : sp.updated ? "Änderungen gespeichert." : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = ex.source === "user" && !!user && ex.owner_id === user.id;
  // Favoriten-Aktion nur für angemeldete USER (AC2/AC11).
  const favorited = user ? await isFavorited(ex.id) : false;

  // Trainingsteil wandert in die Brotkrumen (als Filter-Link auf den Pool);
  // die Eyebrow-Zeile zeigt nur noch ergänzenden Kontext (Feldtyp).
  const teilLabel =
    teilLabels[ex.trainingsteil as keyof typeof teilLabels] ?? ex.trainingsteil;
  const crumbs: BreadcrumbItem[] = [
    { label: "Übungspool", href: "/" },
    { label: teilLabel, href: `/?teil=${ex.trainingsteil}` },
    { label: ex.name },
  ];
  const meta = [
    ex.feldtyp ? feldLabels[ex.feldtyp as keyof typeof feldLabels] : null,
  ].filter(Boolean);
  const anzahl = anzahlText(ex.anzahl_kinder);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {flash && <Flash message={flash} />}
      <Breadcrumbs items={crumbs} />

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

          {/* Aktions-Cluster rechts: Stift · Globus · Herz · ⋮.
              Owner sieht alle, sonstige angemeldete User nur den Favoriten. */}
          {(isOwner || user) && (
            <div className="ml-auto flex items-center gap-0.5">
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
                <FavoriteButton
                  exerciseId={ex.id}
                  initial={favorited}
                  size="sm"
                />
              )}
            </div>
          )}
        </div>
        <h1 className="type-headline-large text-on-surface">{ex.name}</h1>
        {meta.length > 0 && (
          <p className="type-label-medium mt-2 text-on-surface-variant">
            {meta.join(" · ")}
          </p>
        )}
        {/* Aus einer Fassung übernommene Vorlage: woraus sie entstanden ist
            (Story 6 AK 7). */}
        {ex.herkunft_name && ex.herkunft_typ && ex.herkunft_datum && (
          <HerkunftsAngabe
            className="mt-2"
            herkunft={{
              name: ex.herkunft_name,
              typ: ex.herkunft_typ,
              datum: ex.herkunft_datum,
            }}
          />
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
      {/* Das Diagramm kann aus einer anderen Quelle stammen als die Übung —
          zwei eigenständige Angaben (Story 6 AK 9). */}
      {ex.diagramm_herkunft_name &&
        ex.diagramm_herkunft_typ &&
        ex.diagramm_herkunft_datum && (
          <HerkunftsAngabe
            className="mt-2"
            herkunft={{
              name: ex.diagramm_herkunft_name,
              typ: ex.diagramm_herkunft_typ,
              datum: ex.diagramm_herkunft_datum,
            }}
          />
        )}

      {/* Eckdaten — unterhalb des Bildes */}
      {(ex.hauptteilkategorie || ex.erscheinungsform.length > 0 || anzahl || ex.material.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-5">
          {ex.hauptteilkategorie && (
            <Meta label="Hauptteilkategorie">
              {hkatLabels[ex.hauptteilkategorie as keyof typeof hkatLabels] ??
                ex.hauptteilkategorie}
            </Meta>
          )}
          {ex.erscheinungsform.length > 0 && (
            <Meta label="Erscheinungsform">
              {ex.erscheinungsform
                .map((f) => formLabels[f as keyof typeof formLabels] ?? f)
                .join(", ")}
            </Meta>
          )}
          {anzahl && <Meta label="Anzahl Kinder">{anzahl}</Meta>}
          {ex.material.length > 0 && (
            <Meta label="Material">{ex.material.join(", ")}</Meta>
          )}
        </div>
      )}

      {/* Ablauf */}
      <section className="mt-10">
        <h2 className="type-headline-small mb-4 text-on-surface">Übungsablauf</h2>
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
          <h2 className="type-headline-small mb-4 text-on-surface">Varianten</h2>
          <ul className="type-body-large list-disc space-y-1 pl-5 text-on-surface-variant">
            {ex.varianten.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Quellen-/Urheberangabe (Manual) */}
      {ex.source === "manual" && (
        <footer className="mt-12 flex items-start gap-2 border-t border-outline-variant pt-5">
          <BookOpen size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
          <p className="type-body-small text-on-surface-variant">
            Offizielle Übung aus dem <strong className="text-on-surface">Manual Kinderfussball</strong>{" "}
            des Schweizerischen Fussballverbands (SFV) — kuratierter Bestand, unverändert übernommen.
          </p>
        </footer>
      )}
    </main>
  );
}
