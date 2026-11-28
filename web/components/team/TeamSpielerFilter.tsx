"use client";

import { useMemo } from "react";
import { AuswahlFilter, Button, FilterSuche } from "@/components/ui";
import { useAdressFilter } from "@/lib/use-adress-filter";
import { TEILNAHME_PARAMETER } from "@/lib/teilnahme";
import { LINK_STAENDE, TEAM_SPIELER_FILTER } from "@/lib/spieler";
import { bereinigeSuche } from "@/lib/verein-spielerliste";
import { kaderFilterWerte, OHNE_KADER_WERT, teamEingrenzungGesetzt, type TeamEingrenzung } from "@/lib/team-spielerliste";

/* Die Filterleiste der Spielerliste eines Teams (Story #601): Suche, «Kader»
   mit «Ohne Kader» und darunter den Kadern des Teams (nur, wenn es Kader
   führt), «Jahrgang» mit den Jahrgängen der ganzen Liste, «Privater Link»
   mit seinen drei Ständen, und «Zurücksetzen», sobald etwas gesetzt ist
   (AK 6, 8). Dieselben Bausteine wie die Spieler:innen des Vereins
   (`VereinSpielerFilter`, aus der Leiste des Katalogs): Der Zustand steht in
   der Adresse, die Reiter unter «Spieler:innen» tragen ihn weiter (AK 9, #704). Die
   Optionen kommen aus der ganzen Liste — sie schrumpfen nicht mit der
   Eingrenzung. */
export function TeamSpielerFilter({
  eingrenzung,
  kader,
  jahrgaenge,
}: {
  eingrenzung: TeamEingrenzung;
  kader: readonly { id: string; name: string }[];
  jahrgaenge: readonly number[];
}) {
  // Die Teilnahme daneben (#700) und ihr Zeitraum gehören nicht zur
  // Eingrenzung der Liste: «Zurücksetzen» lässt sie stehen.
  const filter = useAdressFilter({ behalte: TEILNAHME_PARAMETER });
  const kaderOptionen = useMemo(
    () => [
      { value: OHNE_KADER_WERT, label: TEAM_SPIELER_FILTER.ohneKader },
      ...kader.map((k) => ({ value: k.id, label: k.name, group: TEAM_SPIELER_FILTER.kaderGruppe })),
    ],
    [kader],
  );
  const jahrOptionen = useMemo(() => jahrgaenge.map((j) => ({ value: String(j), label: String(j) })), [jahrgaenge]);
  const linkOptionen = LINK_STAENDE.map((s) => ({ value: s, label: TEAM_SPIELER_FILTER.linkStand[s] }));

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <FilterSuche
        label={TEAM_SPIELER_FILTER.suche}
        initial={eingrenzung.suche}
        bereinige={bereinigeSuche}
        onCommit={(v) => filter.setzeWert("q", v, bereinigeSuche)}
      />
      {kader.length > 0 && (
        <AuswahlFilter
          label={TEAM_SPIELER_FILTER.kader}
          options={kaderOptionen}
          value={kaderFilterWerte(eingrenzung)}
          onChange={(v) => filter.setzeListe("kader", v)}
        />
      )}
      <AuswahlFilter
        label={TEAM_SPIELER_FILTER.jahrgang}
        options={jahrOptionen}
        value={eingrenzung.jahrgaenge.map(String)}
        onChange={(v) => filter.setzeListe("jahrgang", v)}
      />
      <AuswahlFilter
        label={TEAM_SPIELER_FILTER.link}
        options={linkOptionen}
        value={eingrenzung.linkStaende}
        onChange={(v) => filter.setzeListe("link", v)}
      />
      {teamEingrenzungGesetzt(eingrenzung) && (
        <Button variant="text" onClick={filter.zuruecksetzen}>
          {TEAM_SPIELER_FILTER.zuruecksetzen}
        </Button>
      )}
    </div>
  );
}
