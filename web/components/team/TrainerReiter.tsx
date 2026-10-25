"use client";

import { ArrowLeftRight, UserMinus, UserPlus } from "lucide-react";
import { IconButton, Lozenge, OverflowMenu, SectionMessage } from "@/components/ui";
import type { TeamMitglied } from "@/lib/queries/teams";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { trainerName, verantwortlicheVon, type TerminTrainer } from "@/lib/trainer";
import { useTerminAktionen } from "./TerminBereich";

/* Reiter «Trainer:innen» am geöffneten Termin (#519 AK 5–10, 17; Tafel
   «Reiter»): wer eingeladen ist und wer verantwortlich, darunter die
   Mitglieder, die es nicht sind. Jedes Mitglied lädt jedes ein und aus und
   gibt die Verantwortung weiter — hier immer nur an diesem Termin, auch in
   einer Serie; für folgende oder alle geht es über «Termin ändern».

   Die Verantwortung geht nur weiter oder fällt mit dem Ausladen weg (AK 10);
   ehemalige Mitglieder lassen sich ausladen, aber nicht verantwortlich machen. */
export function TrainerReiter({ t, mitglieder }: { t: TerminZeile; mitglieder: readonly TeamMitglied[] }) {
  const a = useTerminAktionen();
  const imTeam = new Set(mitglieder.map((m) => m.userId));
  const verantwortlich = verantwortlicheVon(t.trainer);
  // Du stehst zuoberst (Tafel «Reiter»), danach wie im Plan nach Name.
  const eingeladene = [...t.trainer].sort((x, y) => Number(y.userId === a.ich) - Number(x.userId === a.ich));
  const nichtEingeladen = mitglieder.filter((m) => !t.trainer.some((tr) => tr.userId === m.userId));
  const mitDu = (name: string, userId: string | null) => (userId === a.ich ? `${name} (du)` : name);

  function zeile(tr: TerminTrainer) {
    const name = mitDu(trainerName(tr), tr.userId);
    const aktuell = !!tr.userId && imTeam.has(tr.userId);
    const unter = tr.verantwortlich ? "bereitet vor und leitet" : aktuell ? "eingeladen" : "nicht mehr im Team";
    return (
      <li key={tr.eintragId} className="flex min-h-14 items-center gap-3 border-b border-linie py-1.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2 type-title-small text-on-surface">
            {name}
            {tr.verantwortlich && <Lozenge>Verantwortlich</Lozenge>}
          </span>
          <span className="type-body-small text-on-surface-mittel">{unter}</span>
        </div>
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
                      a.trainer(t, { verantwortlich: tr.userId! }, tr.userId === a.ich ? "Du bist verantwortlich." : `${trainerName(tr)} ist verantwortlich.`),
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
                  `${tr.userId === a.ich ? "Du bist" : `${trainerName(tr)} ist`} ausgeladen.${tr.verantwortlich ? " Niemand ist verantwortlich." : ""}`,
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
        <span className="type-headline-small text-on-surface">{t.trainer.length} eingeladen</span>
        <span className="type-body-small text-on-surface-mittel">
          {verantwortlich ? `${mitDu(trainerName(verantwortlich), verantwortlich.userId)} ist verantwortlich.` : "Niemand ist verantwortlich."}
        </span>
      </div>

      <h4 className="pt-4 type-label-small text-on-surface-mittel">Eingeladen · {t.trainer.length}</h4>
      {t.trainer.length > 0 ? (
        <ul>{eingeladene.map(zeile)}</ul>
      ) : (
        <p className="type-body-medium text-on-surface-mittel">Niemand ist eingeladen.</p>
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
        Jedes Mitglied kann alle einladen und ausladen. Wer neu ins Team kommt, ist erst eingeladen, wenn ihr sie oder ihn
        einladet.{t.serie ? " Hier gilt es nur für diesen Termin; für die Serie über «Termin ändern»." : ""}
      </SectionMessage>
    </div>
  );
}
