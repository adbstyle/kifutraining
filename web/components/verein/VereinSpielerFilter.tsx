"use client";

import { useMemo } from "react";
import { AuswahlFilter, Button, FilterSuche } from "@/components/ui";
import { useAdressFilter } from "@/lib/use-adress-filter";
import { SPIELER_FILTER } from "@/lib/verein";
import {
  bereinigeSuche,
  eingrenzungGesetzt,
  OHNE_TEAM_WERT,
  teamFilterWerte,
  type SpielerEingrenzung,
} from "@/lib/verein-spielerliste";

/* Die Filterleiste von `/verein/spieler` (Story #580 AK 6–8): Suche, «Team»
   mit «Ohne Team» und darunter den Teams des Vereins, «Jahrgang», und
   «Zurücksetzen», sobald etwas gesetzt ist. Für Mitglieder und Verwaltung
   dieselbe, aus den Bausteinen des Katalogs (`CatalogFilterBar`): Der Zustand
   steht in der Adresse, jede Änderung fragt den Server neu. Die Optionen
   kommen ungefiltert vom Server — sie schrumpfen nicht mit der Eingrenzung. */
export function VereinSpielerFilter({
  eingrenzung,
  teams,
  jahrgaenge,
}: {
  eingrenzung: SpielerEingrenzung;
  teams: readonly { id: string; name: string }[];
  jahrgaenge: readonly number[];
}) {
  const filter = useAdressFilter();
  const teamOptionen = useMemo(
    () => [
      { value: OHNE_TEAM_WERT, label: SPIELER_FILTER.ohneTeam },
      ...teams.map((t) => ({ value: t.id, label: t.name, group: SPIELER_FILTER.teamsGruppe })),
    ],
    [teams],
  );
  const jahrOptionen = useMemo(() => jahrgaenge.map((j) => ({ value: String(j), label: String(j) })), [jahrgaenge]);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <FilterSuche
        label={SPIELER_FILTER.suche}
        initial={eingrenzung.suche}
        bereinige={bereinigeSuche}
        onCommit={(v) => filter.setzeWert("q", v, bereinigeSuche)}
      />
      <AuswahlFilter
        label={SPIELER_FILTER.team}
        options={teamOptionen}
        value={teamFilterWerte(eingrenzung)}
        onChange={(v) => filter.setzeListe("team", v)}
      />
      <AuswahlFilter
        label={SPIELER_FILTER.jahrgang}
        options={jahrOptionen}
        value={eingrenzung.jahrgaenge.map(String)}
        onChange={(v) => filter.setzeListe("jahrgang", v)}
      />
      {eingrenzungGesetzt(eingrenzung) && (
        <Button variant="text" onClick={filter.zuruecksetzen}>
          {SPIELER_FILTER.zuruecksetzen}
        </Button>
      )}
    </div>
  );
}
