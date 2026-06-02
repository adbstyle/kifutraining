import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import {
  HerkunftBadge,
  Card,
  KategorieChip,
  FieldPlaceholder,
  MethodischerFahrplan,
} from "@/components/ui";
import { Flash } from "@/components/Flash";
import { OwnerActions } from "@/components/exercise/OwnerActions";
import { createClient } from "@/lib/supabase/server";
import { FAHRPLAN_TEILE } from "@/lib/labels";
import {
  getExerciseDetail,
  getThemaDetail,
  type ExerciseDetail,
} from "@/lib/queries/exercises";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
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
  const parts: string[] = [];
  if (a.min != null) parts.push(`ab ${a.min}`);
  if (a.empfohlen != null) parts.push(`empfohlen ${a.empfohlen}`);
  return parts.length ? parts.join(" · ") : null;
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

  const thema =
    ex.thema && FAHRPLAN_TEILE.has(ex.trainingsteil)
      ? await getThemaDetail(ex.thema)
      : null;

  const meta = [
    teilLabels[ex.trainingsteil as keyof typeof teilLabels] ?? ex.trainingsteil,
    ex.feldtyp ? feldLabels[ex.feldtyp as keyof typeof feldLabels] : null,
    ex.spielform,
  ].filter(Boolean);
  const anzahl = anzahlText(ex.anzahl_kinder);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      {flash && <Flash message={flash} />}
      <Link
        href="/"
        className="focus-ring type-label-medium inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Alle Übungen
      </Link>

      <div className="mt-4">
        {isOwner && (
          <OwnerActions id={ex.id} slug={ex.slug} visibility={ex.visibility} />
        )}
      </div>

      <header className="mt-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <HerkunftBadge herkunft={ex.source} visibility={ex.visibility} />
        </div>
        <h1 className="type-headline-large text-on-surface">{ex.name}</h1>
        {meta.length > 0 && (
          <p className="type-label-medium mt-2 text-on-surface-variant">
            {meta.join(" · ")}
          </p>
        )}
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Diagramm */}
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[6px] border border-outline-variant">
          {ex.bild_url ? (
            <Image
              src={ex.bild_url}
              alt={`Feld-Diagramm: ${ex.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              className="object-contain"
            />
          ) : (
            <FieldPlaceholder className="h-full w-full" />
          )}
        </div>

        {/* Eckdaten */}
        <div className="flex flex-col gap-5">
          <div>
            <p className="type-label-small text-on-surface-variant">Alterskategorien</p>
            <div className="mt-2 flex gap-1.5">
              {ex.kategorien.map((k) => (
                <KategorieChip key={k} k={k as KategorieSlug} />
              ))}
            </div>
            <p className="type-body-small mt-2 text-on-surface-variant">
              Geeignet für diese Stufen — in jeweils angepasster Komplexität.
            </p>
          </div>

          {ex.erscheinungsform.length > 0 && (
            <Meta label="Erscheinungsform">
              {ex.erscheinungsform
                .map((f) => formLabels[f as keyof typeof formLabels] ?? f)
                .join(", ")}
            </Meta>
          )}
          {thema && <Meta label="Thema">{thema.name}</Meta>}
          {anzahl && <Meta label="Anzahl Kinder">{anzahl}</Meta>}
          {ex.material.length > 0 && (
            <Meta label="Material">{ex.material.join(", ")}</Meta>
          )}
        </div>
      </div>

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

      {/* Themen-Infos (Hauptteil/Einleitung mit Thema) */}
      {thema && (
        <section className="mt-10">
          <h2 className="type-headline-small mb-4 text-on-surface">
            Zum Thema „{thema.name}"
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <ThemaCard title="Ziele" items={thema.ziele} />
            <ThemaCard title="Metaphern" items={thema.metaphern} />
            <ThemaCard title="Fragen an die Kinder" items={thema.fragen_an_die_kinder} />
          </div>
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

function ThemaCard({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <Card className="p-4">
      <p className="type-label-small text-primary">{title}</p>
      <ul className="type-body-medium mt-2 list-disc space-y-1 pl-4 text-on-surface-variant">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </Card>
  );
}
