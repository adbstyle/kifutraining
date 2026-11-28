import { Card, InfoKnopf, LiegenderBalken } from "@/components/ui";
import { MELDE_FENSTER, MELDE_TEXT, MELDEARTEN, type Meldeart } from "@/lib/meldezeitpunkte";
import type { TeamSummen } from "@/lib/teilnahme";

/* Die Meldungen im Team (#703, Variante M2): je Meldeart eine Karte mit
   liegenden Balken über die fünf Zeitfenster, alle im gleichen Massstab
   (AK 5), daneben die Kacheln «Ohne Abmeldung gefehlt» (Trainings und
   Spiele getrennt, AK 7) und «Nicht gemeldet» (AK 8). Die Zahlen gelten für
   die eingegrenzten Spieler:innen (AK 9, 10).

   Die Kacheln sind `Card`s mit Kit-Typografie — eine Bezeichnung, eine
   Erklärung, grosse Zahlen in gleich breiten Ziffern; ein eigener Baustein
   lohnt sich für zwei Kacheln an einem Ort nicht. */
export function MeldeTeam({
  fenster,
  summen,
  zeitraumText,
}: {
  fenster: Record<Meldeart, number[]>;
  summen: TeamSummen;
  /** Der gewählte Zeitraum als Text; `null`: die ganze Zeit im Team. */
  zeitraumText: string | null;
}) {
  // Ein Massstab für alle drei Karten, damit ihre Balken vergleichbar sind.
  const max = Math.max(1, ...MELDEARTEN.flatMap((m) => fenster[m]));
  return (
    <section aria-labelledby="meldungen-im-team" className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 id="meldungen-im-team" className="type-title-medium text-on-surface">
            {MELDE_TEXT.teamTitel}
          </h3>
          <p className="type-body-small text-on-surface-mittel">
            {MELDE_TEXT.teamUnter} Zeitraum: {zeitraumText ?? "ganze Zeit im Team"}
          </p>
        </div>
        <InfoKnopf label={MELDE_TEXT.hinweisLabel}>
          <div className="flex flex-col gap-2">
            {MELDE_TEXT.hinweis.map(([titel, text]) => (
              <p key={titel}>
                <strong className="font-semibold">{titel}</strong> {text}
              </p>
            ))}
          </div>
        </InfoKnopf>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] gap-4">
        {MELDEARTEN.map((m) => {
          const summe = fenster[m].reduce((a, b) => a + b, 0);
          return (
            <Card key={m} className="px-5 py-4">
              <article aria-labelledby={`melde-${m}`} className="flex flex-col gap-3">
                <div className="flex flex-col gap-0.5">
                  <h4 id={`melde-${m}`} className="type-title-small text-on-surface">
                    {MELDE_TEXT.karte[m]}
                  </h4>
                  <p className="type-body-small text-on-surface-mittel">{MELDE_TEXT.unter(m)}</p>
                </div>
                {summe > 0 ? (
                  <LiegenderBalken
                    label={MELDE_TEXT.liste(m)}
                    max={max}
                    reihen={MELDE_FENSTER.map((f, i) => ({ label: f.label, anzahl: fenster[m][i] }))}
                  />
                ) : (
                  <p className="flex min-h-20 items-center type-body-medium text-on-surface-mittel">{MELDE_TEXT.karteLeer}</p>
                )}
              </article>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(18rem,1fr))] gap-4">
        <Kachel
          id="kz-ohne"
          titel={MELDE_TEXT.ohneAbmeldung}
          unter={MELDE_TEXT.ohneAbmeldungUnter}
          zahlen={[
            { label: MELDE_TEXT.trainings, wert: summen.ohneAbmeldungGefehlt.training },
            { label: MELDE_TEXT.spiele, wert: summen.ohneAbmeldungGefehlt.spiel },
          ]}
        />
        <Kachel
          id="kz-ng"
          titel={MELDE_TEXT.nichtGemeldet}
          unter={MELDE_TEXT.nichtGemeldetUnter}
          zahlen={[{ label: MELDE_TEXT.spiele, wert: summen.nichtGemeldet }]}
        />
      </div>
      <p className="type-body-small text-on-surface-mittel">{MELDE_TEXT.eigeneGruppen}</p>
    </section>
  );
}

function Kachel({
  id,
  titel,
  unter,
  zahlen,
}: {
  id: string;
  titel: string;
  unter: string;
  zahlen: readonly { label: string; wert: number }[];
}) {
  return (
    <Card className="px-5 py-4">
      <article aria-labelledby={id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h4 id={id} className="type-title-small text-on-surface">
            {titel}
          </h4>
          <p className="type-body-small text-on-surface-mittel">{unter}</p>
        </div>
        <dl className="flex gap-6">
          {zahlen.map((z) => (
            // Die Zahl gross über ihrer Bezeichnung; vorgelesen in der Folge Bezeichnung, Zahl.
            <div key={z.label} className="flex flex-col-reverse gap-0.5">
              <dt className="type-body-small text-on-surface-mittel">{z.label}</dt>
              <dd className="type-headline-small tabular-nums text-on-surface">{z.wert}</dd>
            </div>
          ))}
        </dl>
      </article>
    </Card>
  );
}
