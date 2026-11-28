import { Fragment, type ReactNode } from "react";
import { SearchX, Users } from "lucide-react";
import Link from "next/link";
import { ButtonLink, Leerzustand, Lozenge } from "@/components/ui";
import { TeamLozenges } from "@/components/team/TeamLozenges";
import {
  SPIELER_BESTAND_LEER,
  SPIELER_BESTAND_LEER_MITGLIED,
  SPIELER_FILTER,
  SPIELER_KEINE_TREFFER,
  SPIELER_OHNE_TEAM,
  spielerAngezeigtText,
  spielerKopfTeile,
} from "@/lib/verein";
import { eingrenzungGesetzt, SPIELER_SEITE, type SpielerEingrenzung } from "@/lib/verein-spielerliste";

/* Die Teile, die die Spielerliste des Vereins für Mitglieder
   (`VereinSpielerAnsicht`) und Verwaltung (`VereinSpielerListe`) teilt
   (Story #580): die Anzahl über der Liste, die Teams einer Zeile, der Fuss
   «x von y angezeigt», die zwei Leerzustände. Nichts davon bedient etwas der
   Verwaltung; ihre Aktionen stehen in der Kopfzeile (`VereinSpielerAktionen`)
   und in der Verwaltungsliste. */

/** Die Zeile über der Liste (#707 AK 3): «144 Spieler:innen · 23 ohne Team ·
 *  höchstens 1000 je Verein», bei Suche oder Eingrenzung «12 von 144
 *  Spieler:innen · …». Schmal bricht sie nur zwischen den Teilen: Jeder Teil
 *  bleibt beisammen, der Punkt steht vor dem Teil, den er einleitet.
 *  Live-Region, damit die Sprachausgabe eine neue Trefferzahl meldet. */
export function SpielerAnzahl({
  treffer,
  gesamt,
  ohneTeam,
  eingrenzung,
}: {
  treffer: number;
  gesamt: number;
  ohneTeam: number;
  eingrenzung: SpielerEingrenzung;
}) {
  const teile = spielerKopfTeile(gesamt, ohneTeam, eingrenzungGesetzt(eingrenzung) ? treffer : undefined);
  return (
    <p role="status" className="type-label-small mt-4 text-on-surface-mittel">
      {teile.map((teil, i) => (
        <Fragment key={teil}>
          {i > 0 && " "}
          <span className="whitespace-nowrap">{i > 0 ? `· ${teil}` : teil}</span>
        </Fragment>
      ))}
    </p>
  );
}

/** Die Teams einer Zeile als Plaketten, «ohne Team» als Warnung (AK 4);
 *  `children`: weitere Plaketten dahinter (Schnuppern). */
export function SpielerTeams({ teams, children }: { teams: readonly { id: string; name: string }[]; children?: ReactNode }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {teams.length === 0 ? (
        <Lozenge appearance="warning">{SPIELER_OHNE_TEAM}</Lozenge>
      ) : (
        <TeamLozenges namen={teams.map((t) => t.name)} ids={teams.map((t) => t.id)} />
      )}
      {children}
    </span>
  );
}

/** Unter der Liste: wie viele stehen, und der Weg zu mehr — nur, wenn mehr
 *  getroffen sind als eine Seite; die Trefferzahl selbst steht seit #707 über
 *  der Liste (`SpielerAnzahl`). «Weitere anzeigen» nur, solange nicht alle
 *  stehen. Live-Region, damit die Sprachausgabe das Nachladen meldet. */
export function SpielerFuss({
  angezeigt,
  treffer,
  weiterHref,
}: {
  angezeigt: number;
  treffer: number;
  weiterHref: string | null;
}) {
  if (treffer <= SPIELER_SEITE) return null;
  return (
    <p role="status" className="type-body-small mt-3 text-on-surface-mittel">
      {spielerAngezeigtText(angezeigt, treffer)}
      {weiterHref && (
        <>
          {" · "}
          <Link href={weiterHref} scroll={false} className="focus-ring rounded-klein font-semibold text-primary">
            {SPIELER_FILTER.weiter}
          </Link>
        </>
      )}
    </p>
  );
}

/** Der Leerzustand: kein Spieler im Verein, sonst keine Treffer mit dem Weg
 *  zurück zur nackten Liste (AK 11). */
export function SpielerLeer({ vereinLeer, verwaltung, pfad }: { vereinLeer: boolean; verwaltung: boolean; pfad: string }) {
  if (vereinLeer)
    return (
      <Leerzustand icon={Users} titel={SPIELER_BESTAND_LEER.titel}>
        {verwaltung ? SPIELER_BESTAND_LEER.text : SPIELER_BESTAND_LEER_MITGLIED}
      </Leerzustand>
    );
  return (
    <Leerzustand
      icon={SearchX}
      titel={SPIELER_KEINE_TREFFER.titel}
      aktion={
        <ButtonLink href={pfad} scroll={false} variant="text">
          {SPIELER_FILTER.zuruecksetzen}
        </ButtonLink>
      }
    >
      {SPIELER_KEINE_TREFFER.text}
    </Leerzustand>
  );
}
