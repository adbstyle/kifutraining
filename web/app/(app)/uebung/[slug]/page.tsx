import { notFound } from "next/navigation";
import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import {
  type BreadcrumbItem,
  Card,
  Freitext,
  MethodischerFahrplan,
  PrintButton,
  UebungsBild,
  Button,
} from "@/components/ui";
import { Flash } from "@/components/Flash";
import { OwnerActions } from "@/components/exercise/OwnerActions";
import { FavoriteButton } from "@/components/exercise/FavoriteButton";
import { UebungKopierenButton } from "@/components/exercise/UebungKopierenButton";
import { EinordnungsLeiste } from "@/components/exercise/EinordnungsLeiste";
import { createClient } from "@/lib/supabase/server";
import { getExerciseDetail, isFavorited } from "@/lib/queries/exercises";
import { EINORDNUNG_LABEL } from "@/lib/labels";
import { katalogFilterZiel } from "@/lib/filter-optionen";
import { AenderungBanner } from "@/components/exercise/MaterialField";
import {
  AENDERUNG_BEIBEHALTEN,
  AENDERUNG_UEBERNEHMEN,
  materialAenderungen,
  materialBasisAusDiagramm,
  parseMaterialBasis,
} from "@/lib/material";
import { behalteMaterial, uebernehmeMaterialVorschlag } from "@/lib/actions/material";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

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

/** Die Bestätigungen, die über die Adresse auf diese Seite reisen — je
 *  Parameter ihr Text. Eine Quelle für beides: `Flash` nimmt alle Parameter
 *  wieder aus der Adresse, auch einen später hinzugekommenen. */
const FLASH = {
  created: "Übung erstellt.",
  updated: "Änderungen gespeichert.",
  kopiert: "Kopie liegt in deinem Bestand — du kannst sie jetzt anpassen.",
} as const;
const FLASH_PARAMS = Object.keys(FLASH) as (keyof typeof FLASH)[];

export default async function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Partial<Record<keyof typeof FLASH, string>>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const ex = await getExerciseDetail(slug);
  if (!ex) notFound();
  const flashParam = FLASH_PARAMS.find((p) => sp[p]);
  const flash = flashParam ? FLASH[flashParam] : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = ex.source === "user" && !!user && ex.owner_id === user.id;
  // Favoriten-Aktion nur für angemeldete USER (AC2/AC11).
  const favorited = user ? await isFavorited(ex.id) : false;

  // Die Brotkrumen nennen die Einordnung als Filter-Link auf den Pool. Der
  // Link zielt auf die feinste Einordnung, die der Katalog filtern kann — im
  // Kinderfussball-Hauptteil auf die Hauptteilkategorie (Story #129). Der TEXT bleibt die Einordnung selbst.
  const teilLabel = EINORDNUNG_LABEL[ex.trainingsteil] ?? ex.trainingsteil;
  const crumbs: BreadcrumbItem[] = [
    { label: "Übungen", href: "/" },
    { label: teilLabel, href: `/?teil=${katalogFilterZiel(ex)}` },
    { label: ex.name },
  ];
  const materialHinweis = isOwner
    ? materialAenderungen(parseMaterialBasis(ex.material_basis), materialBasisAusDiagramm(ex.diagramm))
    : [];

  // Die Einordnung steht gesammelt in der Spalte rechts (Epic #350, Story
  // #351) — Alterskategorien, Herkunft, Feld, Eckdaten, Material, Übungstyp
  // und Erscheinungsform. Das hebt die Reihenfolge aus Story #124 auf (Übungstyp
  // und Erscheinungsform hinter dem Ablauf): Neben dem Inhalt unterbrechen sie
  // ihn nicht mehr. Der Inhaltsbereich trägt nur noch Titel, Bild, Ablauf und
  // Varianten.
  const leiste = (
    <>
      <EinordnungsLeiste
        ex={ex}
        // Fehlende Einordnung sieht nur, wer sie nachtragen kann (#352).
        fehlendeZeigen={isOwner}
        materialHinweis={
          materialHinweis.length > 0 && (
            // Hat eine Diagrammänderung das Material verändert (Story #269)? Nur
            // die Eigentümerin sieht es — sie allein kann antworten. Die
            // Entscheidung bleibt auf der Detailseite (PO 2026-10-01).
            <AenderungBanner
              aenderungen={materialHinweis}
              actions={
                <>
                  <form action={behalteMaterial.bind(null, ex.id)}>
                    <Button type="submit" variant="text" size="sm">
                      {AENDERUNG_BEIBEHALTEN}
                    </Button>
                  </form>
                  <form action={uebernehmeMaterialVorschlag.bind(null, ex.id)}>
                    <Button type="submit" variant="text" size="sm">
                      {AENDERUNG_UEBERNEHMEN}
                    </Button>
                  </form>
                </>
              }
            />
          )
        }
      />
      {/* Quellen-/Urheberangabe (Manual), nur am Bildschirm. Sie steht unter
          der Einordnung, bei der Herkunft — schmal damit am Ende der Seite,
          nicht zwischen Inhalt und Einordnung. */}
      {ex.source === "manual" && (
        <p className="mt-5 flex items-start gap-2 px-1 print:hidden">
          <BookOpen
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-on-surface-mittel"
            aria-hidden
          />
          <span className="type-body-small text-on-surface-mittel">
            Übung nach dem{" "}
            <strong className="text-on-surface">Manual Kinderfussball</strong>{" "}
            des Schweizerischen Fussballverbands (SFV) — Aufbau und Regeln aus dem
            Manual, Text in eigener Formulierung.
          </span>
        </p>
      )}
    </>
  );

  // Aktions-Cluster auf der Brotkrumen-Zeile, rechtsbündig — dieselbe Stelle
  // wie beim Training (#249 AK 8); der Titel behält so die volle Breite.
  // Drucken · Stift · Globus · Herz · ⋮. Drucken steht ausserhalb der
  // Anmelde-Bedingung: eine Übung lässt sich auch ohne Konto ausdrucken (Story
  // #114 AK 3). Owner sieht alle Aktionen, sonstige angemeldete User nur den
  // Favoriten. Im Druck ist der ganze Cluster weg — auf dem Blatt hat kein
  // Bedienelement etwas verloren (Postcondition 5).
  const aktionen = (
    <div className="ml-auto flex shrink-0 items-center gap-0.5 print:hidden">
      <PrintButton variant="icon" size="sm" />
      {(isOwner || user) && (
        <>
          {isOwner ? (
            <OwnerActions
              id={ex.id}
              slug={ex.slug}
              name={ex.name}
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
              {/* Kopieren (Story 7, Übungswelten) — hier an einer
                  fremden oder kuratierten Übung; die eigene wird über das
                  ⋮-Menü der Eigentümer-Aktionen kopiert (#171). */}
              <UebungKopierenButton exerciseId={ex.id} name={ex.name} />
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
  );

  return (
    <Seitenrahmen breite="6xl" krumen={crumbs} aktionen={aktionen} spalte={leiste}>
      {flash && <Flash message={flash} param={FLASH_PARAMS} />}

      <header>
        <h1 className="type-headline-large text-on-surface">{ex.name}</h1>
      </header>

      {/* Aktives Bild — gezeichnetes Diagramm, Foto oder Platzhalter */}
      <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-flaeche border border-linie">
        <UebungsBild
          name={ex.name}
          bildUrl={ex.bild_url}
          diagramm={ex.diagramm}
          bildQuelle={ex.bild_quelle}
          // Ab `xl` steht das Bild in der Spalte neben der Einordnung,
          // höchstens rund 800 px breit.
          sizes="(min-width: 1280px) 800px, (max-width: 896px) 100vw, 896px"
        />
      </div>

      {/* Ablauf */}
      <section className="mt-10">
        <h2 className="type-title-medium mb-3 text-on-surface-mittel">
          Übungsablauf
        </h2>
        <Card className="p-6">
          {ex.methodischer_fahrplan ? (
            <MethodischerFahrplan fahrplan={ex.methodischer_fahrplan} />
          ) : ex.aufbau ? (
            <Freitext text={ex.aufbau} />
          ) : (
            <p className="type-body-medium text-on-surface-mittel">
              Kein Ablauf erfasst.
            </p>
          )}
        </Card>
      </section>

      {/* Varianten — dargestellt wie der Ablauf (Story #282) */}
      {ex.varianten_text && (
        <section className="mt-8">
          <h2 className="type-title-medium mb-3 text-on-surface-mittel">
            Varianten
          </h2>
          <Card className="p-6">
            <Freitext text={ex.varianten_text} />
          </Card>
        </section>
      )}

      {/* Herkunft auf dem Ausdruck (Story #114 AK 7). Die Plakette in der
          Einordnung genügt dem Papier nicht: Beim eigenen Entwurf nennt sie
          nur den Zustand, nicht die Herkunft. Darum im
          Druck ein eigener Satz für alle drei Fälle — und der Manual-Fuss
          darunter entfällt dort, sonst stünde dieselbe Aussage zweimal.

          Bewusste Abweichung vom Trainings-Druck, der keine Herkunft trägt: ein
          Blatt aus der Bibliothek weist seine Quelle aus (PO 2026-08-28), für
          das Training bleibt der Entscheid von 2026-08-23 unverändert. */}
      <footer className="mt-10 hidden border-t border-linie pt-4 print:block">
        {ex.source === "manual" ? (
          <p className="type-body-small text-on-surface-mittel">
            Übung nach dem{" "}
            <strong className="text-on-surface">Manual Kinderfussball</strong>{" "}
            des Schweizerischen Fussballverbands (SFV) — Aufbau und Regeln aus dem
            Manual, Text in eigener Formulierung.
          </p>
        ) : (
          <p className="type-body-small text-on-surface-mittel">
            Übung aus der{" "}
            <strong className="text-on-surface">Gemeinschaft</strong> der
            Trainerinnen und Trainer, nicht aus dem kuratierten Manual-Bestand.
            {ex.visibility === "private" &&
              " Noch nicht veröffentlicht — ein Entwurf."}
          </p>
        )}
      </footer>

    </Seitenrahmen>
  );
}
