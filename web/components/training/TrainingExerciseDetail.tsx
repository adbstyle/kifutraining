import { Clock } from "lucide-react";
import { DurchlaufListe } from "./DurchlaufListe";
import {
  Freitext,
  KategorieLozenge,
  MaterialListe,
  MethodischerFahrplan,
  UebungsBild,
} from "@/components/ui";
import { formatDuration, teilTraegtDauer } from "@/lib/training";
import {
  feldtyp as feldLabels,
  type KategorieSlug,
} from "@/lib/vocab";
import type { TrainingExerciseItem } from "@/lib/queries/trainings";
import { hatMaterial } from "@/lib/material";
import {
  ANZAHL_SPIELER_LABEL,
  anzahlSpielerText,
  hauptteilkategorieText,
  uebungstypText,
} from "@/lib/labels";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="type-label-small text-on-surface-mittel">{label}</p>
      <div className="type-body-medium mt-1 text-on-surface">{children}</div>
    </div>
  );
}

/* Vollständige Durchführungs-Details einer Fassung im Training (Stories #17/#18):
   Übungsablauf und Varianten, Feld-Diagramm, Eckdaten und Dauer. Präsentational, daher in
   Durchführungs- (Client) wie Druck-Ansicht (Server) nutzbar.

   Beide Ansichten sind fürs Training auf dem Platz gedacht und zeigen darum
   ausschliesslich Durchführungsrelevantes. */
export function TrainingExerciseDetail({ item }: { item: TrainingExerciseItem }) {
  const dur =
    teilTraegtDauer(item.trainingsteil) && item.durationMin != null
      ? formatDuration(item.durationMin)
      : null;
  const anzahl = anzahlSpielerText(item.anzahlKinder);
  const mitMaterial = hatMaterial(item.materialListe, item.material);
  // Die Spielfeldgrösse führt das Junioren-Manual an Stelle des Feldtyps
  // (Story 3 AK 8/10); im Kinderfussball ergänzt sie das freie Feld (#272).
  // Geschrieben wie auf der Übungs-Detailseite — «35 × 20 m».
  const spielfeld =
    item.spielfeldLaengeM != null && item.spielfeldBreiteM != null
      ? `${item.spielfeldLaengeM} × ${item.spielfeldBreiteM} m`
      : null;

  return (
    <article className="break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="type-title-large text-on-surface">{item.name}</h3>
        {dur && (
          <span className="inline-flex items-center gap-1.5 type-label-large text-on-surface-mittel">
            <Clock size={16} strokeWidth={2} aria-hidden />
            {dur}
          </span>
        )}
      </div>

      {/* Der Durchlauf zuoberst (Stories #153/#154): Er sagt, WER als Nächstes
          an diese Übung kommt — Durchführungswissen wie die Dauer, darum über
          den Kategorie-Lozenges und nicht im umbrechenden Eckdaten-Fluss unter
          dem Bild. Übungen ohne Zuweisung zeigen die Zeile gar nicht: Auf dem
          Platz ist ihr Fehlen selbsterklärend. */}
      {item.gruppen.length > 0 && (
        <div className="mb-1.5 flex gap-3">
          {/* Die sichtbare Beschriftung benennt zugleich die Liste — so heisst
              sie auch für Screenreader „Durchlauf", ohne dass das Wort doppelt
              vorgelesen wird. */}
          <span
            id={`durchlauf-${item.id}`}
            className="type-label-small w-[78px] shrink-0 pt-1 text-on-surface-mittel"
          >
            Durchlauf
          </span>
          <DurchlaufListe
            gruppen={item.gruppen}
            beschriftetVon={`durchlauf-${item.id}`}
            className="type-body-large text-on-surface"
          />
        </div>
      )}

      {/* Die Notiz gleich hinter dem Durchlauf (Story #152 AK 4): Sie sagt, was für
          GENAU dieses Training gilt — etwa wer die Übung betreut —, und das
          gehört gelesen, bevor der Blick zu Lozenges und Ablauf wandert. Der
          Text selbst steht in Fliesstext-Typografie und nicht in der des
          Labels: Er stammt vom Trainer. */}
      {item.notiz && (
        <div className="mb-3 flex gap-3">
          <span className="type-label-small w-[78px] shrink-0 pt-1 text-on-surface-mittel">
            Notiz
          </span>
          <p className="type-body-large whitespace-pre-line text-on-surface">{item.notiz}</p>
        </div>
      )}

      {item.kategorien.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {item.kategorien.map((k) => (
            <KategorieLozenge key={k} k={k as KategorieSlug} />
          ))}
        </div>
      )}

      {/* Der Diagramm-/Bildrahmen: Haarlinie, und derselbe Radius wie jede
          andere Fläche, die Inhalt hält — der grössere gehört dem Dialog. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-flaeche border border-linie">
        <UebungsBild
          name={item.name}
          bildUrl={item.bildUrl}
          diagramm={item.diagramm}
          bildQuelle={item.bildQuelle}
          sizes="(max-width: 768px) 100vw, 768px"
        />
      </div>

      {/* Eckdaten fürs Aufbauen — der Übungstyp gehört seit Story #124 nicht
          mehr dazu, er steht unterhalb des Ablaufs. */}
      {(item.hauptteilkategorie ||
        item.feldtyp ||
        spielfeld ||
        anzahl ||
        mitMaterial) && (
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
          {item.feldtyp && (
            <Meta label="Feldtyp">
              {feldLabels[item.feldtyp as keyof typeof feldLabels] ?? item.feldtyp}
            </Meta>
          )}
          {spielfeld && <Meta label="Spielfeldgrösse">{spielfeld}</Meta>}
          {item.hauptteilkategorie && (
            <Meta label="Hauptteilkategorie">
              {hauptteilkategorieText(item.hauptteilkategorie)}
            </Meta>
          )}
          {anzahl && <Meta label={ANZAHL_SPIELER_LABEL}>{anzahl}</Meta>}
          {mitMaterial && (
            <Meta label="Material">
              <MaterialListe liste={item.materialListe} ergaenzung={item.material} />
            </Meta>
          )}
        </div>
      )}

      <div className="mt-4">
        <p className="type-label-medium mb-2 text-on-surface-mittel">Übungsablauf</p>
        {item.fahrplan ? (
          <MethodischerFahrplan fahrplan={item.fahrplan} />
        ) : item.aufbau ? (
          <Freitext text={item.aufbau} />
        ) : (
          <p className="type-body-medium text-on-surface-mittel">Kein Ablauf erfasst.</p>
        )}
      </div>

      {/* Varianten — unmittelbar nach dem Ablauf und wie er dargestellt
          (Story #282 AK 6–8): auf dem Platz wie im Druck zur Hand. */}
      {item.uebungsvarianten && (
        <div className="mt-4">
          <p className="type-label-medium mb-2 text-on-surface-mittel">Varianten</p>
          <Freitext text={item.uebungsvarianten} />
        </div>
      )}

      {/* Übungstyp — hinter dem Ablauf (Story #124, PO 2026-08-31): er ordnet
          die Übung ein und speist die Filter, für die Durchführung auf dem Platz
          sagt er nichts. Die Erscheinungsform bleibt hier weiterhin ganz weg,
          Durchführungs- wie Druckansicht zeigen nur Durchführungsrelevantes. */}
      {item.uebungstyp && (
        <div className="mt-4">
          <Meta label="Übungstyp">
            {uebungstypText(item.uebungstyp)}
          </Meta>
        </div>
      )}
    </article>
  );
}
