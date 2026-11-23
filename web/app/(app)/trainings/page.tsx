import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList, SearchX } from "lucide-react";
import { BestandAnzeige, ButtonLink, Leerzustand, SectionMessage } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { TrainingTabelle } from "@/components/training/TrainingTabelle";
import { TrainingFilterBar } from "@/components/training/TrainingFilterBar";
import { getTrainingPool } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { getMeineGrenzen } from "@/lib/queries/verein";
import { leseSortierung } from "@/lib/training-sortierung";
import { kategorienSlugs } from "@/lib/vocab";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";
import { ListeMitDetail } from "@/components/layout/ListeMitDetail";
import { TrainingDetailSpalte } from "@/components/training/TrainingDetailSpalte";
import { ladeTrainingAnsicht } from "@/lib/queries/training-ansicht";
import { auswahlLage, leseAuswahl } from "@/lib/training-auswahl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trainings - KiFu",
};

export default async function TrainingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stufen?: string;
    mine?: string;
    deleted?: string;
    /** Die Sortierung (#629): Spalte und Richtung, ohne Angabe die Vorgabe. */
    sort?: string;
    dir?: string;
    /** Das ausgewählte Training, sein Detail steht daneben (#630), mit der
     *  angezeigten Variante und der offenen Ansicht des Detail. */
    training?: string;
    variante?: string;
    ansicht?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Nur mit Konto (#669): ohne Anmeldung leitet die Middleware vorher auf die Startseite.
  if (!user) redirect("/login?redirect=/trainings");
  const mine = sp.mine === "1";
  const filtersActive = !!q || stufen.length > 0;

  const sortierung = leseSortierung(sp.sort, sp.dir);
  // Die Übersicht gibt die Ordnung immer vor — auch mit Suchbegriff ordnet sie
  // nach der Wahl bzw. dem Datum der letzten Änderung, nie nach Relevanz
  // (#629 AK 7). Das Detail nur, wenn etwas ausgewählt ist — dann zusammen
  // mit der Liste geladen.
  const auswahl = leseAuswahl(sp);
  // Nur in «Meine Trainings» und nur für ein Konto ohne Verein (#588 AK 5, PC 3):
  // der Stand von der Datenebene, nie aus der gezählten Liste (Filter).
  const [trainings, ansicht, grenzen] = await Promise.all([
    getTrainingPool({ q, stufen, mine, sortierung }),
    auswahl ? ladeTrainingAnsicht(auswahl.training, user) : Promise.resolve(null),
    mine ? getMeineGrenzen() : Promise.resolve(null),
  ]);
  // Nicht zugänglich (fremder Entwurf, gelöscht): die Übersicht mit Hinweis
  // (PC 2). Zugänglich, aber nicht in der Liste — ausgefiltert oder ein
  // Team-Training, das hier nie steht: Das Detail schliesst, und mit ihm die
  // Auswahl in der Adresse (PC 3) — sonst kehrte es mit dem Zurücknehmen des
  // Filters ungefragt wieder.
  const lage = auswahlLage(sp, "/trainings", auswahl, ansicht, trainings);
  if (lage.schliessenZu) redirect(lage.schliessenZu);
  const { detail, nichtVerfuegbar, parameter, detailHref } = lage;

  return (
    <Seitenrahmen
      breite="voll"
      krumen={
        mine ? [{ label: "Trainings", href: "/trainings" }, { label: "Meine Trainings" }] : [{ label: "Trainings" }]
      }
      aktionen={
        <ButtonLink href="/training/neu" variant="filled">
          Training erstellen
        </ButtonLink>
      }
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">{mine ? "Meine Trainings" : "Trainings"}</h1>
      {sp.deleted && <Flash message="Training gelöscht." param="deleted" />}

      {/* Schmal ersetzt das Detail die ganze Übersicht samt Filtern (AK 9). */}
      <div className={detail ? "max-lg:hidden" : undefined}>
        {grenzen && <BestandAnzeige art="trainings" grenze={grenzen.trainings} className="mb-4" />}

        <TrainingFilterBar q={q} stufen={stufen} mine={mine} showMine />

        {/* Ein Zustand der Adresse, kein Vorgang: als Section Message, nicht
            als Snackbar. Sie bleibt, bis man ein anderes Training wählt. */}
        {nichtVerfuegbar && <SectionMessage className="mb-4">Dieses Training ist nicht verfügbar.</SectionMessage>}
      </div>

      {trainings.length === 0 ? (
        <Leerzustand
          icon={filtersActive ? SearchX : ClipboardList}
          titel={
            filtersActive
              ? "Keine Trainings gefunden"
              : mine
                ? "Noch kein eigenes Training"
                : "Noch keine Trainings"
          }
        >
          {filtersActive
            ? "Kein Training entspricht der aktiven Suche oder den Filtern. Passe die Kriterien an."
            : mine
              ? "Stelle aus dem Übungsbestand dein erstes Training zusammen - es bleibt ein Entwurf, bis du es in die Community stellst."
              : "Stelle dein erstes Training zusammen. Stellst du es in die Community, steht es allen angemeldeten Konten zur Verfügung."}
        </Leerzustand>
      ) : (
        // Immer dieselbe Fläche, auch ohne Detail: So bleibt die Tabelle beim
        // Öffnen und Schliessen dasselbe Element und weiss, welche Zeile zuvor
        // ausgewählt war (Fokus, NFR 2).
        <ListeMitDetail
          spaltenName="Trainingsdetail"
          links={
            <TrainingTabelle
              trainings={trainings}
              sortierung={sortierung}
              pfad="/trainings"
              parameter={parameter}
              ausgewaehlt={detail?.training.id}
            />
          }
          rechts={
            detail && auswahl && (
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
    </Seitenrahmen>
  );
}
