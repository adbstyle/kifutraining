import { redirect } from "next/navigation";
import { ClipboardList, SearchX } from "lucide-react";
import { Leerzustand, SectionMessage } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { TeamTrainingErstellenButton } from "@/components/team/TeamTrainingErstellenButton";
import { TrainingDetailSpalte } from "@/components/training/TrainingDetailSpalte";
import { TrainingFilterBar } from "@/components/training/TrainingFilterBar";
import { TrainingTabelle } from "@/components/training/TrainingTabelle";
import { getTeamTrainings } from "@/lib/queries/trainings";
import { ladeTrainingAnsicht } from "@/lib/queries/training-ansicht";
import {
  ANSICHT_PARAM,
  AUSWAHL_PARAM,
  adressParameter,
  auswahlHref,
  leseAuswahl,
  type DetailAnsicht,
} from "@/lib/training-auswahl";
import { leseSortierung } from "@/lib/training-sortierung";
import { VARIANTE_PARAM } from "@/lib/varianten";
import { kategorienSlugs } from "@/lib/vocab";

/* Der Trainingsbestand eines Teams (Story 17) — das Material, aus dem geplant
 * wird; Termin-Trainings stehen nicht darin (PO 2026-10-06).
 *
 * Seit #637 wie die Trainingsübersicht: eine sortierbare Tabelle mit Suche und
 * Filter, das ausgewählte Training im Detail daneben. Dieselben Bausteine und
 * dieselben Adressparameter (`q`, `stufen`, `sort`, `dir`, `training`,
 * `variante`, `ansicht`); was sich unterscheidet: keine Spalte
 * «Sichtbarkeit / Urheber» (Team-Trainings gehören dem Team), kein Schalter
 * «Meine Trainings», und die Aktionen der früheren Kachel — Termin zuordnen,
 * Zu mir übernehmen, Löschen — stehen im Detail (`TrainingAktionen`). */
export default async function TeamTrainingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    stufen?: string;
    sort?: string;
    dir?: string;
    deleted?: string;
    training?: string;
    variante?: string;
    ansicht?: string;
  }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const pfad = `/team/${id}/trainings`;
  const q = sp.q?.trim() ?? "";
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));
  const filtersActive = !!q || stufen.length > 0;
  const sortierung = leseSortierung(sp.sort, sp.dir);
  const auswahl = leseAuswahl(sp);

  const [trainings, ansicht] = await Promise.all([
    getTeamTrainings(id, { q, stufen, sortierung }),
    auswahl ? ladeTrainingAnsicht(auswahl.training) : Promise.resolve(null),
  ]);
  // Wie in der Übersicht (#630 PC 2/3): nicht zugänglich → Hinweis;
  // zugänglich, aber nicht in diesem Bestand (ausgefiltert, ein
  // Termin-Training, ein fremdes) → die Auswahl schliesst.
  const nichtVerfuegbar = !!auswahl && !ansicht;
  if (ansicht && !trainings.some((t) => t.id === ansicht.training.id)) {
    redirect(auswahlHref(pfad, adressParameter(sp), null));
  }
  const detail = ansicht;
  const ohne = detail ? ["deleted"] : ["deleted", AUSWAHL_PARAM, VARIANTE_PARAM, ANSICHT_PARAM];
  const parameter = adressParameter(sp, ohne);
  const detailHref = (wahl: { variante?: string; ansicht: DetailAnsicht } | null) =>
    auswahlHref(pfad, parameter, wahl && detail ? { training: detail.training.id, ...wahl } : null);

  return (
    <section>
      {/* Keine sichtbare Überschrift: «Trainings» steht schon in der
          Seitenleiste; für Screenreader bleibt sie, damit unter dem Teamnamen
          keine Ebene fehlt. */}
      <h2 className="sr-only">Trainings</h2>
      {sp.deleted && <Flash message="Training gelöscht." param="deleted" />}

      {/* Schmal ersetzt das Detail den ganzen Bestand samt Filtern. */}
      <div className={detail ? "max-lg:hidden" : undefined}>
        <div className="mb-4 flex justify-end">
          <TeamTrainingErstellenButton teamId={id} />
        </div>
        <TrainingFilterBar q={q} stufen={stufen} />
        {nichtVerfuegbar && <SectionMessage className="mb-4">Dieses Training ist nicht verfügbar.</SectionMessage>}
      </div>

      {trainings.length === 0 ? (
        <Leerzustand
          icon={filtersActive ? SearchX : ClipboardList}
          titel={filtersActive ? "Keine Trainings gefunden" : "Noch kein Training im Team"}
          dicht
        >
          {filtersActive
            ? "Kein Training entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
            : "Erstelle eines hier oder stelle eine Kopie eines eigenen Trainings ins Team."}
        </Leerzustand>
      ) : (
        <ListeMitDetail
          spaltenName="Trainingsdetail"
          links={
            <TrainingTabelle
              trainings={trainings}
              sortierung={sortierung}
              pfad={pfad}
              parameter={parameter}
              ausgewaehlt={detail?.training.id}
              mitUrheber={false}
            />
          }
          rechts={
            detail &&
            auswahl && (
              <TrainingDetailSpalte
                ansicht={detail}
                varianteParam={auswahl.variante}
                offen={auswahl.ansicht}
                hrefFuer={detailHref}
                schliessenHref={detailHref(null)}
              />
            )
          }
        />
      )}
    </section>
  );
}
