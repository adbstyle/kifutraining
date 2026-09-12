"use client";

import Link from "next/link";
import { Trash2, Pencil, Users } from "lucide-react";
import { Card, Badge, TextArea } from "@/components/ui";
import { StufenField } from "../StufenField";
import { SichtbarkeitControl } from "../SichtbarkeitControl";
import { InTeamStellenControl } from "../InTeamStellenControl";
import { kategorienFuer } from "@/lib/altersstufe";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { ZIEL_MAX } from "@/lib/training";
import type { FehlendeBedingung } from "@/lib/training-bedingungen";
import type { TrainingDetail } from "@/lib/queries/trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/** Kopf des Editors: Name, Zugehörigkeit, Ziel, Alterskategorien und die
 *  Aktionen am Training selbst (veröffentlichen, ins Team stellen, löschen).
 *  Die Dialoge dahinter führt der Editor — hier stehen nur die Auslöser. */
export function TrainingKopf({
  training,
  teams,
  oeffentlich,
  fehlendeBedingungen,
  stufen,
  onStufen,
  ziel,
  onZielChange,
  onZielSpeichern,
  onUmbenennen,
  onLoeschen,
}: {
  training: TrainingDetail;
  teams: TeamUebersicht[];
  oeffentlich: boolean;
  fehlendeBedingungen: FehlendeBedingung[];
  stufen: string[];
  onStufen: (next: string[]) => void;
  ziel: string;
  onZielChange: (next: string) => void;
  onZielSpeichern: () => void;
  onUmbenennen: () => void;
  onLoeschen: () => void;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="type-headline-medium truncate text-on-surface">
              {training.name}
            </h1>
            <button
              type="button"
              onClick={onUmbenennen}
              aria-label="Namen bearbeiten"
              className="state focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-mittel"
            >
              <Pencil size={16} strokeWidth={2} aria-hidden />
            </button>
          </div>
          {/* Team-Training oder persönliches? Die Marke sagt, wem es gehört —
              und bei persönlichen zusätzlich, ob es öffentlich ist. Daneben,
              in derselben Zeile, welchem Lehrmittel es folgt (Story 5 AK 3):
              beide Schemata teilen Begriffe wie „Hauptteil", der Trainer muss
              jederzeit sehen, in welchem er plant. Neutral statt in einer
              Kategorie-Farbe — die Altersstufe ist keine Alterskategorie. */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {training.team ? (
              <Link
                href={`/team/${training.team.id}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded-flaeche type-label-medium text-on-surface-mittel hover:text-primary"
              >
                <Users size={16} strokeWidth={2} aria-hidden />
                Team-Training von {training.team.name}
              </Link>
            ) : (
              <Badge tone={oeffentlich ? "oeffentlich" : "entwurf"}>
                {oeffentlich ? "Öffentlich" : "✎ Entwurf"}
              </Badge>
            )}
            <Badge tone="neutral">{altersstufeLabels[training.altersstufe]}</Badge>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {/* Veröffentlichen und Ins-Team-Stellen gibt es nur für das eigene
              Training: ein Team-Training gehört dem Team, nicht einer Person. */}
          {!training.team && (
            <>
              <SichtbarkeitControl
                trainingId={training.id}
                oeffentlich={oeffentlich}
                fehlend={fehlendeBedingungen}
                varianten={training.varianten}
              />
              <InTeamStellenControl trainingId={training.id} teams={teams} />
            </>
          )}
          {/* Die Zustands-Ebene nimmt die Farbe des Inhalts mit — an einem
              Knopf in Error-Schrift ist der Overlay damit von selbst rötlich,
              ohne eine eigene Hover-Fläche. */}
          <button
            type="button"
            onClick={onLoeschen}
            className="state focus-ring inline-flex items-center gap-1.5 rounded-flaeche px-3 py-1.5 type-label-large text-error"
          >
            <Trash2 size={18} strokeWidth={2} aria-hidden />
            Löschen
          </button>
        </div>
      </div>

      {/* Ziel: optional, jederzeit änder- und entfernbar (Story 10 AC 3).
          Gespeichert wird beim Verlassen des Felds — wie der Trainingsname
          über einen eigenen Schritt, nicht bei jedem Tastendruck. */}
      <div className="mt-4">
        <TextArea
          label="Ziel (optional)"
          rows={2}
          maxLength={ZIEL_MAX}
          value={ziel}
          onChange={(e) => onZielChange(e.target.value)}
          onBlur={onZielSpeichern}
          supportingText={`Woran das Team in diesem Training arbeitet. Höchstens ${ZIEL_MAX} Zeichen.`}
        />
      </div>

      <div className="mt-4">
        <p className="mb-2 type-label-large text-on-surface">Alterskategorien</p>
        {/* Nur die Kategorien der Altersstufe dieses Trainings: Sie folgen ihr,
            statt sie zu bestimmen (Story 5 AK 4). Ein Wechsel der Altersstufe
            ist bewusst nirgends vorgesehen (AK 5) — wer für die andere plant,
            legt ein neues Training an. */}
        <StufenField
          value={stufen}
          onChange={onStufen}
          kategorien={kategorienFuer(training.altersstufe)}
        />
      </div>
    </Card>
  );
}
