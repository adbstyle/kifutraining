import type { ReactNode } from "react";
import {
  Eigenschaft,
  EigenschaftBreit,
  EigenschaftFehlt,
  Eigenschaften,
  HerkunftBadge,
  KategorieChip,
  MaterialListe,
} from "@/components/ui";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import {
  ANZAHL_SPIELER_LABEL,
  EINORDNUNG_LABEL,
  ERSCHEINUNGSFORM_LABEL,
  anzahlSpielerText,
  hauptteilkategorieText,
  uebungstypText,
} from "@/lib/labels";
import { einordnungenFuer } from "@/lib/altersstufe";
import { fehlendeEinordnung, feldAngaben } from "@/lib/eckdaten";
import { hatMaterial, parseMaterialListe } from "@/lib/material";
import { sortStufen } from "@/lib/training";
import type { ExerciseDetail } from "@/lib/queries/exercises";

/** Trainingsteil und — im Juniorenschema — Block einer Übung als Klartext.
 *  Der Block steht nur, wo der Teil untergliedert ist: Auffangen und
 *  Abschluss tragen genau einen Block und heissen wie er (Story #127). */
function teilUndBlock(ex: Pick<ExerciseDetail, "altersstufe" | "trainingsteil">): {
  teil: string;
  block: string | null;
} {
  const roh = EINORDNUNG_LABEL[ex.trainingsteil] ?? ex.trainingsteil;
  // Nur die Gruppe, die die Einordnung wirklich enthält: Ein unbekannter Slug
  // steht roh da, statt still als erster Teil zu erscheinen.
  const gruppe = einordnungenFuer(ex.altersstufe).find(
    (g) => g.teil === ex.trainingsteil || g.bloecke.some((b) => b.slug === ex.trainingsteil),
  );
  return {
    teil: gruppe?.label ?? roh,
    block: gruppe && gruppe.bloecke.length > 1 ? roh : null,
  };
}

/**
 * Die Einordnung einer Übung als Liste in der Spalte neben dem Inhalt
 * (Epic #350, Story #351). Hier steht alles, was die Übung einordnet — auf
 * der Seite daneben nichts davon ein zweites Mal. Gezeigt wird nur, was die
 * Übung erfasst hat; Altersstufe, Herkunft und Trainingsteil hat jede.
 *
 * `materialHinweis` ist der Hinweis auf ein geändertes Diagramm-Material,
 * nur für die Eigentümerin: Er steht bei dem, was er betrifft, und ist auf
 * dem Papier weg (Story #269).
 *
 * `fehlendeZeigen` (nur für die Eigentümerin, #352): Was die Übung tragen
 * kann, aber nicht erfasst hat, steht an seinem Platz als «Nicht erfasst» —
 * nur am Bildschirm. Alle anderen sehen allein das Erfasste.
 */
export function EinordnungsLeiste({
  ex,
  materialHinweis,
  fehlendeZeigen = false,
}: {
  ex: ExerciseDetail;
  materialHinweis?: ReactNode;
  fehlendeZeigen?: boolean;
}) {
  const { teil, block } = teilUndBlock(ex);
  const { feldtyp, spielfeld } = feldAngaben(ex);
  const anzahl = anzahlSpielerText(ex.anzahl_kinder);
  const materialListe = parseMaterialListe(ex.material_liste);
  const mitMaterial = hatMaterial(materialListe, ex.material);
  const kategorien = sortStufen(ex.kategorien);
  const fehlt = fehlendeZeigen ? fehlendeEinordnung(ex) : new Set<string>();

  return (
    <Eigenschaften titel="Einordnung">
      <Eigenschaft label="Altersstufe">{altersstufeLabels[ex.altersstufe]}</Eigenschaft>
      {kategorien.length > 0 && (
        <Eigenschaft label="Alterskategorien">
          <span className="flex flex-wrap gap-1.5">
            {kategorien.map((k) => (
              <KategorieChip key={k} k={k} />
            ))}
          </span>
        </Eigenschaft>
      )}
      <Eigenschaft label="Herkunft">
        <HerkunftBadge herkunft={ex.source} visibility={ex.visibility} />
      </Eigenschaft>
      <Eigenschaft label="Trainingsteil">{teil}</Eigenschaft>
      {block && <Eigenschaft label="Block">{block}</Eigenschaft>}
      {ex.hauptteilkategorie && (
        <Eigenschaft label="Hauptteilkategorie">
          {hauptteilkategorieText(ex.hauptteilkategorie)}
        </Eigenschaft>
      )}
      {feldtyp && <Eigenschaft label="Feldtyp">{feldtyp}</Eigenschaft>}
      {fehlt.has("feldtyp") && <EigenschaftFehlt label="Feldtyp" />}
      {spielfeld && <Eigenschaft label="Spielfeldgrösse">{spielfeld}</Eigenschaft>}
      {fehlt.has("spielfeld") && <EigenschaftFehlt label="Spielfeldgrösse" />}
      {anzahl && <Eigenschaft label={ANZAHL_SPIELER_LABEL}>{anzahl}</Eigenschaft>}
      {ex.uebungstyp && (
        <Eigenschaft label="Übungstyp">
          {uebungstypText(ex.uebungstyp)}
        </Eigenschaft>
      )}
      {fehlt.has("uebungstyp") && <EigenschaftFehlt label="Übungstyp" />}
      {ex.erscheinungsform.length > 0 && (
        <Eigenschaft label="Erscheinungsform">
          <ul className="flex flex-col gap-1">
            {ex.erscheinungsform.map((f) => (
              <li key={f}>{ERSCHEINUNGSFORM_LABEL[f] ?? f}</li>
            ))}
          </ul>
        </Eigenschaft>
      )}
      {fehlt.has("erscheinungsform") && <EigenschaftFehlt label="Erscheinungsform" />}
      {materialHinweis && (
        <EigenschaftBreit label="Hinweis zum Material" className="print:hidden">
          {materialHinweis}
        </EigenschaftBreit>
      )}
      {mitMaterial && (
        <Eigenschaft label="Material">
          <MaterialListe liste={materialListe} ergaenzung={ex.material} />
        </Eigenschaft>
      )}
    </Eigenschaften>
  );
}
