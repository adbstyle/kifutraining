import { SPIELER_ZUORDNUNG_HINWEIS } from "@/lib/verein";
import { Tabelle, TabellenZeile } from "@/components/ui";
import type { VereinSpielerMitglied, VereinTeamMitglied } from "@/lib/kern/verein";
import type { SpielerEingrenzung } from "@/lib/verein-spielerliste";
import { VereinSpielerFilter } from "./VereinSpielerFilter";
import { SpielerFuss, SpielerKopf, SpielerLeer, SpielerTeams } from "./VereinSpielerTeile";

/* Die Spieler:innen des Vereins für Mitglieder ohne Vereinsverwaltung (Story
   #580 AK 3–5): nur lesen, nur Vorname, Nachname, Jahrgang und Teams — auch bei
   Spieler:innen der eigenen Teams, ohne Auswahl, Menü und Erfassen; aufs
   Zuordnen weist der Hinweis. Die Verwaltungsfelder kennt diese Sicht nicht:
   Die Datenebene liefert sie einem Mitglied gar nicht erst, und der Typ der
   Zeile führt sie nicht. Die Verwaltung hat ihre eigene Liste
   (`VereinSpielerListe`); beide teilen Filterleiste, Kopf und Leerzustände. */
export function VereinSpielerAnsicht({
  spieler,
  treffer,
  gesamt,
  ohneTeam,
  teams,
  jahrgaenge,
  eingrenzung,
  weiterHref,
  pfad,
}: {
  /** Die Zeilen, die stehen (eine Seite oder mehr); `treffer` zählt alle. */
  spieler: VereinSpielerMitglied[];
  treffer: number;
  gesamt: number;
  ohneTeam: number;
  teams: VereinTeamMitglied[];
  jahrgaenge: number[];
  eingrenzung: SpielerEingrenzung;
  weiterHref: string | null;
  pfad: string;
}) {
  return (
    <>
      <SpielerKopf gesamt={gesamt} ohneTeam={ohneTeam} />
      <p className="type-body-small mt-1 text-on-surface-mittel">{SPIELER_ZUORDNUNG_HINWEIS}</p>
      {gesamt > 0 && <VereinSpielerFilter eingrenzung={eingrenzung} teams={teams} jahrgaenge={jahrgaenge} />}
      <div className="mt-4">
        {treffer === 0 ? (
          <SpielerLeer vereinLeer={gesamt === 0} verwaltung={false} pfad={pfad} />
        ) : (
          <Tabelle
            spalten="sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)]"
            kopf={["Vorname", "Nachname", "Jahrgang", "Teams"]}
          >
            {spieler.map((s) => (
              <TabellenZeile key={s.id}>
                <span className="min-w-0 flex-1 sm:contents">
                  <span className="type-body-medium block truncate text-on-surface">
                    {s.vorname}
                    <span className="sm:hidden"> {s.nachname}</span>
                  </span>
                  <span className="type-body-medium hidden truncate text-on-surface sm:block">{s.nachname}</span>
                  <span className="type-body-small block text-on-surface-mittel sm:hidden">{s.jahrgang}</span>
                  <span className="type-body-medium hidden text-on-surface-mittel sm:block">{s.jahrgang}</span>
                  <span className="mt-1 block min-w-0 sm:mt-0">
                    <SpielerTeams teams={s.teams} />
                  </span>
                </span>
              </TabellenZeile>
            ))}
          </Tabelle>
        )}
        <SpielerFuss angezeigt={spieler.length} treffer={treffer} weiterHref={weiterHref} />
      </div>
    </>
  );
}
