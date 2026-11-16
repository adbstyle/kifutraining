import type { Metadata } from "next";
import { ClipboardList, SearchX } from "lucide-react";
import { BestandAnzeige, ButtonLink, Leerzustand } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { AnmeldeHinweis } from "@/components/training/AnmeldeHinweis";
import { TrainingTabelle } from "@/components/training/TrainingTabelle";
import { TrainingFilterBar } from "@/components/training/TrainingFilterBar";
import { getTrainingPool } from "@/lib/queries/trainings";
import { createClient } from "@/lib/supabase/server";
import { getMeineGrenzen } from "@/lib/queries/verein";
import { leseSortierung } from "@/lib/training-sortierung";
import { kategorienSlugs } from "@/lib/vocab";
import { Seitenrahmen } from "@/components/layout/Seitenrahmen";

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
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const stufen = (sp.stufen ?? "").split(",").filter((s) => kategorienSlugs.includes(s as never));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // „Meine Trainings" ist nur angemeldet sinnvoll — anonym gibt es keine.
  const mine = !!user && sp.mine === "1";
  const filtersActive = !!q || stufen.length > 0;

  const sortierung = leseSortierung(sp.sort, sp.dir);
  // Die Übersicht gibt die Ordnung immer vor — auch mit Suchbegriff ordnet sie
  // nach der Wahl bzw. dem Datum der letzten Änderung, nie nach Relevanz
  // (#629 AK 7).
  const trainings = await getTrainingPool({ q, stufen, mine, sortierung });
  // Was die Sortier-Links mitnehmen: alle Parameter ausser der einmaligen
  // Meldung (#629 PC 2) — auch solche, die erst später dazukommen.
  const parameter = Object.fromEntries(
    Object.entries(sp).filter(
      (e): e is [string, string] => typeof e[1] === "string" && e[0] !== "deleted",
    ),
  );
  // Nur in «Meine Trainings» und nur für ein Konto ohne Verein (#588 AK 5, PC 3):
  // der Stand von der Datenebene, nie aus der gezählten Liste (Filter).
  const grenzen = mine ? await getMeineGrenzen() : null;

  return (
    <Seitenrahmen
      breite="voll"
      krumen={
        mine ? [{ label: "Trainings", href: "/trainings" }, { label: "Meine Trainings" }] : [{ label: "Trainings" }]
      }
      aktionen={
        user && (
          <ButtonLink href="/training/neu" variant="filled">
            Training erstellen
          </ButtonLink>
        )
      }
    >
      {/* Den Namen zeigt die Brotkrume; die Überschrift trägt die Seite unsichtbar. */}
      <h1 className="sr-only">{mine ? "Meine Trainings" : "Trainings"}</h1>
      {sp.deleted && <Flash message="Training gelöscht." param="deleted" />}

      {grenzen && <BestandAnzeige art="trainings" grenze={grenzen.trainings} className="mb-4" />}

      <TrainingFilterBar q={q} stufen={stufen} mine={mine} showMine={!!user} />

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
              ? "Stelle aus dem Übungsbestand dein erstes Training zusammen - es bleibt ein Entwurf, bis du es veröffentlichst."
              : user
                ? "Stelle dein erstes Training zusammen. Veröffentlichst du es, steht es der Community zur Verfügung."
                : "Es wurde noch kein Training veröffentlicht. Schau später wieder vorbei."}
        </Leerzustand>
      ) : (
        <TrainingTabelle trainings={trainings} sortierung={sortierung} pfad="/trainings" parameter={parameter} />
      )}

      {!user && <AnmeldeHinweis className="mt-8" />}
    </Seitenrahmen>
  );
}
