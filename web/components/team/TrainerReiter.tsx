"use client";

import { ArrowLeftRight, UserMinus, UserPlus } from "lucide-react";
import { IconButton, Lozenge, OverflowMenu, SectionMessage, Switch } from "@/components/ui";
import type { TeamMitglied } from "@/lib/queries/teams";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { absageOffen, dabeiZahl, eingeladenZahl, noetigeVon, trainerName, verantwortlicheVon, type TerminTrainer } from "@/lib/trainer";
import { besetzungText, fehlendeTrainer } from "@/lib/besetzung";
import { TrainerLozenge } from "./TrainerZeichen";
import { heuteAmTrainingsort } from "@/lib/zeit";
import { seitWann, terminBegonnen } from "@/lib/zeit";
import { useTerminAktionen } from "./TerminBereich";

/* Reiter «Trainer:innen» am geöffneten Termin (#519 AK 5–10, 17; #520 AK 1,
   9, 17; Tafel «Reiter»): wer dabei ist, wer abgesagt hat und wann, darunter
   die Mitglieder, die nicht eingeladen sind. Ein Schalter je Eingeladene (an
   = dabei); jedes Mitglied schaltet für jedes, die eigene Zeile steht
   zuoberst. Ab Beginn und an einem ausgefallenen Termin sind die Schalter
   gesperrt (#520 AK 3). Einladen, ausladen und die Verantwortung geben gelten
   hier immer nur an diesem Termin, auch in einer Serie; für folgende oder alle
   geht es über «Termin ändern».

   Die Verantwortung geht nur weiter oder fällt mit dem Ausladen weg (#519
   AK 10); auch eine, die abgesagt hat, kann sie übernehmen und ist dann
   wieder dabei (#520 AK 5). Ehemalige lassen sich ausladen, aber nicht
   verantwortlich machen. */
export function TrainerReiter({ t, mitglieder }: { t: TerminZeile; mitglieder: readonly TeamMitglied[] }) {
  const a = useTerminAktionen();
  const imTeam = new Set(mitglieder.map((m) => m.userId));
  const verantwortlich = verantwortlicheVon(t.trainer);
  const begonnen = terminBegonnen(t.datum, t.beginn);
  const offen = absageOffen(t, begonnen);
  const jetzt = new Date().toISOString();
  // Du stehst zuoberst (Tafel «Reiter»), danach wie im Plan nach Name.
  const zuerstDu = (x: TerminTrainer, y: TerminTrainer) => Number(y.userId === a.ich) - Number(x.userId === a.ich);
  const dabei = t.trainer.filter((x) => !x.abgesagtAm).sort(zuerstDu);
  const abgesagt = t.trainer.filter((x) => x.abgesagtAm).sort(zuerstDu);
  const nichtEingeladen = mitglieder.filter((m) => !t.trainer.some((tr) => tr.userId === m.userId));
  const mitDu = (name: string, userId: string | null) => (userId === a.ich ? `${name} (du)` : name);
  // #521 AK 9: wie viele dabei und wie viele nötig sind.
  const noetig = noetigeVon(t);
  const fehlen = fehlendeTrainer(noetig, dabeiZahl(t.trainer));

  function zeile(tr: TerminTrainer) {
    const name = mitDu(trainerName(tr), tr.userId);
    const aktuell = !!tr.userId && imTeam.has(tr.userId);
    const unter = tr.abgesagtAm
      ? `abgesagt ${seitWann(tr.abgesagtAm, jetzt)}`
      : tr.verantwortlich
        ? "bereitet vor und leitet"
        : aktuell
          ? "eingeladen"
          : "nicht mehr im Team";
    const selbst = tr.userId === a.ich;
    return (
      <li key={tr.eintragId} className="flex min-h-14 items-center gap-3 border-b border-linie py-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 type-title-small text-on-surface">
            {name}
            {tr.verantwortlich && <Lozenge>Verantwortlich</Lozenge>}
          </span>
          <span className="type-body-small text-on-surface-mittel">{unter}</span>
        </div>
        {tr.userId && (
          <Switch
            checked={!tr.abgesagtAm}
            disabled={!offen || a.pending}
            aria-label={`${name} dabei`}
            onChange={(e) => a.absagen(t, tr, !e.target.checked)}
          />
        )}
        <OverflowMenu
          label={`Weitere Aktionen zu ${name}`}
          disabled={a.pending}
          items={[
            ...(!tr.verantwortlich && aktuell
              ? [
                  {
                    label: "Verantwortung geben",
                    icon: ArrowLeftRight,
                    hinweis: verantwortlich ? `${trainerName(verantwortlich)} gibt ab` : undefined,
                    onSelect: () =>
                      a.trainer(t, { verantwortlich: tr.userId! }, selbst ? "Du bist verantwortlich." : `${trainerName(tr)} ist verantwortlich.`),
                  },
                ]
              : []),
            {
              label: "Ausladen",
              icon: UserMinus,
              onSelect: () =>
                a.trainer(
                  t,
                  tr.userId ? { ausladen: [tr.userId] } : { ausladenEintraege: [tr.eintragId] },
                  `${selbst ? "Du bist" : `${trainerName(tr)} ist`} ausgeladen.${tr.verantwortlich ? " Niemand ist verantwortlich." : ""}`,
                ),
            },
          ]}
        />
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        {fehlen > 0 && !t.ausgefallen && !begonnen && (
          <div className="flex flex-wrap items-center gap-2">
            <TrainerLozenge t={t} heute={heuteAmTrainingsort()} />
            <span className="type-body-small text-on-surface-mittel">noch {fehlen} bis zur Mindestbesetzung von {noetig}</span>
          </div>
        )}
        <span className="type-headline-small text-on-surface">
          {dabeiZahl(t.trainer)} von {eingeladenZahl(t.trainer)} dabei
        </span>
        <span className="type-body-small text-on-surface-mittel">
          {verantwortlich ? `${mitDu(trainerName(verantwortlich), verantwortlich.userId)} ist verantwortlich.` : "Niemand ist verantwortlich."}
        </span>
        {t.mindestbesetzung && (
          <span className="type-body-small text-on-surface-mittel">
            Mindestbesetzung {besetzungText(t.mindestbesetzung)}
            {t.mindestbesetzung.art === "verhaeltnis" ? (noetig === null ? " · noch keine Spielerzahl" : ` · nötig ${noetig}`) : ""}
          </span>
        )}
        <span className="type-body-small text-on-surface-mittel">
          {t.ausgefallen
            ? "Der Termin fällt aus: Absagen und Zusagen ruhen."
            : begonnen
              ? "Der Termin hat begonnen: Absagen und Zusagen stehen fest."
              : `Absagen änderbar bis ${t.beginn}${t.spiel ? " (Anpfiff)" : ""}.`}
        </span>
      </div>

      <h4 className="pt-4 type-label-small text-on-surface-mittel">Dabei · {dabei.length}</h4>
      {dabei.length > 0 ? (
        <ul>{dabei.map(zeile)}</ul>
      ) : (
        <p className="type-body-medium text-on-surface-mittel">Niemand ist dabei.</p>
      )}

      {abgesagt.length > 0 && (
        <>
          <h4 className="pt-4 type-label-small text-on-surface-mittel">Abgesagt · {abgesagt.length}</h4>
          <ul>{abgesagt.map(zeile)}</ul>
        </>
      )}

      {nichtEingeladen.length > 0 && (
        <>
          <h4 className="pt-4 type-label-small text-on-surface-mittel">Nicht eingeladen · {nichtEingeladen.length}</h4>
          <ul>
            {nichtEingeladen.map((m) => {
              const name = mitDu(m.anzeigeName, m.userId);
              return (
                <li key={m.userId} className="flex min-h-14 items-center gap-3 border-b border-linie py-1.5 last:border-b-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="type-title-small text-on-surface-mittel">{name}</span>
                    <span className="type-body-small text-on-surface-mittel">Mitglied des Teams</span>
                  </div>
                  <IconButton
                    icon={UserPlus}
                    label={`${name} einladen`}
                    disabled={a.pending}
                    onClick={() => a.trainer(t, { einladen: [m.userId] }, m.userId === a.ich ? "Du bist eingeladen." : `${m.anzeigeName} ist eingeladen.`)}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}

      <SectionMessage appearance="information" className="mt-2">
        Jedes Mitglied kann für alle ab- und zusagen, alle einladen und ausladen. Wer neu ins Team kommt, ist erst eingeladen,
        wenn ihr sie oder ihn einladet.{t.serie ? " Hier gilt alles nur für diesen Termin; für die Serie über «Termin ändern»." : ""}
      </SectionMessage>
    </div>
  );
}
