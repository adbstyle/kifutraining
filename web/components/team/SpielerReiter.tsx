"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leerzustand, Switch } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAbmeldungAktion } from "@/lib/actions/abmeldungen";
import { EHEMALIGE_SPIELERIN, spielerName, type Teilnehmer } from "@/lib/spieler";
import type { TerminSpieler } from "@/lib/kern/abmeldungen";
import { Users } from "lucide-react";

/* Der Reiter «Spieler:innen» am Termin (#435 AK 1, 2, 5): wer angemeldet ist,
   wer abgemeldet, je mit einem Schalter, der sofort speichert. Abgemeldete
   stehen gedämpft. Ab Beginn ist der Stand fest (AK 4, 7): die Schalter
   gesperrt, ehemalige Spieler:innen ohne Namen. Ein ausgefallener Termin
   nennt weder Zahl noch Abmeldungen (#437 AK 4). */
export function SpielerReiter({ teamId, daten }: { teamId: string; daten: TerminSpieler }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  useEffect(() => setLokal({}), [daten]);

  if (daten.gesamt === 0)
    return (
      <Leerzustand icon={Users} titel="Noch keine Spielerliste" dicht>
        Wer an einem Termin kommt, siehst du, sobald das Team eine Spielerliste führt. Sie steht unter{" "}
        <Link href={`/team/${teamId}/verwaltung`} className="focus-ring rounded-klein text-primary hover:underline">
          Team
        </Link>
        .
      </Leerzustand>
    );

  if (daten.ausgefallen)
    return <p className="type-body-medium text-on-surface-mittel">Der Termin fällt aus. Für ihn lässt sich niemand an- oder abmelden.</p>;

  const abgemeldet = (s: Teilnehmer) => (s.spielerId && s.spielerId in lokal ? lokal[s.spielerId] : s.abgemeldet);
  const angemeldet = daten.spieler.filter((s) => !abgemeldet(s)).length;

  function umlegen(s: Teilnehmer, an: boolean) {
    const id = s.spielerId;
    if (!id) return;
    setLokal((l) => ({ ...l, [id]: !an }));
    startTransition(async () => {
      const r = await setzeAbmeldungAktion(teamId, {
        terminId: daten.terminId,
        spielerId: id,
        abgemeldet: !an,
        gesehen: { datum: daten.datum, beginn: daten.beginn },
      });
      if (!r.ok) {
        setLokal((l) => {
          const { [id]: _weg, ...rest } = l;
          return rest;
        });
        melde(r.error);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-body-medium text-on-surface-mittel">
          <span className="type-headline-small text-on-surface">{angemeldet}</span> von {daten.gesamt} angemeldet
        </p>
        <p className="type-body-small text-on-surface-mittel">
          {daten.begonnen ? "Stand bei Beginn - nicht mehr änderbar" : `Änderbar bis ${daten.beginn}`}
        </p>
      </div>
      <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
        {daten.spieler.map((s, i) => {
          const name = s.vorname !== null ? spielerName({ vorname: s.vorname, nachname: s.nachname ?? "" }) : EHEMALIGE_SPIELERIN;
          const ab = abgemeldet(s);
          return (
            <li key={s.spielerId ?? `ehemalig-${i}`} className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
              <span className={`min-w-0 flex-1 truncate type-body-medium ${ab || s.ehemalig ? "text-on-surface-mittel" : "text-on-surface"}`}>
                {name}
                <span className="sr-only">{ab ? ", abgemeldet" : ", angemeldet"}</span>
              </span>
              <Switch
                checked={!ab}
                disabled={daten.begonnen || s.ehemalig || pending}
                onChange={(e) => umlegen(s, e.target.checked)}
                aria-label={`${name} angemeldet`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
