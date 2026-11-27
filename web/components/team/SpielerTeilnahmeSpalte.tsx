import { DetailKopf, Teilnahmebalken, TeilnahmePunkt, type TeilnahmeTon } from "@/components/ui";
import { KaderLozenges } from "./KaderLozenge";
import { TeilnahmeZeitraum } from "./TeilnahmeZeitraum";
import type { SpielerTeilnahme } from "@/lib/kern/teilnahme";
import {
  TEILNAHME_GRUND_TEXT,
  TEILNAHME_TEXT,
  type TeilnahmeArt,
  type TeilnahmeGrund,
  type TeilnahmeZahlen,
} from "@/lib/teilnahme";

/* Die Teilnahme einer Spieler:in neben der Spielerliste (#700): wie oft sie
   im gewählten Zeitraum an Trainings und Spielen da war und aus welchem Grund
   nicht — je Art die Zahl «da von gezählt», ein Balken der Verteilung und
   die Gründe, die zusammen «nicht da» ergeben (PO 2026-11-27). Darunter die
   Regel, nach der gezählt wird (AK 8). Lesend; die Zahlen kommen aus
   `spielerTeilnahme`, wie im KI-Werkzeug (NFR 3). */

const TON: Record<TeilnahmeGrund, TeilnahmeTon> = {
  abgemeldet: "grau",
  nicht_erschienen: "orange",
  nicht_aufgeboten: "violett",
  meldefrist_verpasst: "blau",
  ohne_meldung: "hellgrau",
};

export function SpielerTeilnahmeSpalte({
  teilnahme,
  jahrgang,
  kaderNamen,
  heute,
  schliessenHref,
}: {
  teilnahme: SpielerTeilnahme;
  jahrgang: number | null;
  kaderNamen: string[];
  heute: string;
  schliessenHref: string;
}) {
  const { spieler, zeitraum, zahlen } = teilnahme;
  const name = `${spieler.vorname} ${spieler.nachname}`;
  return (
    <section aria-label={`Teilnahme von ${name}`} className="flex flex-col gap-4">
      <div>
        <DetailKopf titel={name} schliessenHref={schliessenHref} />
        <div className="mt-1 flex flex-wrap items-center gap-2 type-body-medium text-on-surface-mittel">
          {jahrgang && <span>Jahrgang {jahrgang}</span>}
          <KaderLozenges namen={kaderNamen} />
        </div>
      </div>

      <h3 className="type-title-medium text-on-surface">{TEILNAHME_TEXT.titel}</h3>
      <TeilnahmeZeitraum zeitraum={zeitraum} heute={heute} />

      {(["training", "spiel"] as const).map((art) => (
        <TeilnahmeKarte key={art} art={art} zahlen={zahlen[art]} mitZeitraum={zeitraum.von !== null || zeitraum.bis !== null} />
      ))}

      <p className="type-body-small text-on-surface-mittel">{TEILNAHME_TEXT.regel(spieler.vorname)}</p>
    </section>
  );
}

function TeilnahmeKarte({ art, zahlen, mitZeitraum }: { art: TeilnahmeArt; zahlen: TeilnahmeZahlen; mitZeitraum: boolean }) {
  const titelId = `teilnahme-${art}`;
  return (
    <article aria-labelledby={titelId} className="flex flex-col gap-3 rounded-flaeche bg-elev-01 p-4">
      <h4 id={titelId} className="type-title-small text-on-surface">
        {TEILNAHME_TEXT[art]}
      </h4>
      {zahlen.gesamt === 0 ? (
        <p className="type-body-medium text-on-surface-mittel">{TEILNAHME_TEXT.leer(art, mitZeitraum)}</p>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5 type-body-medium text-on-surface-mittel">
            <span className="type-headline-medium text-on-surface">{zahlen.da}</span>
            <span>von {zahlen.gesamt} da</span>
          </p>
          <Teilnahmebalken
            anteile={[{ anzahl: zahlen.da, ton: "da" }, ...zahlen.gruende.map((g) => ({ anzahl: g.anzahl, ton: TON[g.grund] }))]}
          />
          <dl className="flex flex-col divide-y divide-linie type-body-medium">
            <Zeile label={TEILNAHME_TEXT.da} anzahl={zahlen.da} ton="da" betont />
            <Zeile label={TEILNAHME_TEXT.nichtDa} anzahl={zahlen.nichtDa} betont />
            {zahlen.gruende.map((g) => (
              <Zeile key={g.grund} label={TEILNAHME_GRUND_TEXT[g.grund]} anzahl={g.anzahl} ton={TON[g.grund]} eingerueckt />
            ))}
          </dl>
        </>
      )}
    </article>
  );
}

function Zeile({
  label,
  anzahl,
  ton,
  betont = false,
  eingerueckt = false,
}: {
  label: string;
  anzahl: number;
  ton?: TeilnahmeTon;
  betont?: boolean;
  eingerueckt?: boolean;
}) {
  return (
    <div className={`flex min-h-9 items-center justify-between gap-3 ${eingerueckt ? "pl-5 text-on-surface-mittel" : "text-on-surface"}`}>
      <dt className={`flex items-center gap-2 ${betont ? "font-medium" : ""}`}>
        {ton && <TeilnahmePunkt ton={ton} />}
        {label}
      </dt>
      <dd className="tabular-nums">{anzahl}</dd>
    </div>
  );
}
