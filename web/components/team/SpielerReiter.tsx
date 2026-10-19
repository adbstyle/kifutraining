"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Leerzustand, Switch } from "@/components/ui";
import { useSnackbar } from "@/components/layout/SnackbarKontext";
import { setzeAbmeldungAktion } from "@/lib/actions/abmeldungen";
import { ABMELDUNG_TEXT, EHEMALIGE_SPIELERIN, spielerName, type Teilnehmer } from "@/lib/spieler";
import type { TerminSpieler } from "@/lib/kern/abmeldungen";
import { seitWann } from "@/lib/zeit";
import { Users } from "lucide-react";
import { KADER_TEXT, uebrigeText } from "@/lib/kader";
import { KaderLozenges } from "./KaderLozenge";
import { EingrenzungLeer, KaderChips } from "./KaderEingrenzung";

/* Der Reiter «Spieler:innen» am Termin (#435 AK 1, 2, 5): wer angemeldet ist,
   wer abgemeldet, je mit einem Schalter, der sofort speichert. Abgemeldete
   stehen gedämpft. Ab Beginn ist der Stand fest (AK 4, 7): die Schalter
   gesperrt, ehemalige Spieler:innen ohne Namen. Ein ausgefallener Termin
   nennt weder Zahl noch Abmeldungen (#437 AK 4).

   Trägt der Termin Kader (#453), steht oben, für welche er gilt, unter jedem
   Namen, über welche er für sie gilt, und unten, für wie viele des Teams er
   nicht gilt (AK 6). Gilt er für niemanden, steht 0 von 0 da (AK 7).

   Gilt er für mehrere Kader, sind die Kader oben Chips, die die Liste auf
   einen Kader eingrenzen — einer zur Zeit wie in der Spielerliste (PO
   2026-10-18). Die Zahl «x von y angemeldet» bleibt die des ganzen Termins.
   Ab Beginn trägt der festgehaltene Stand keine Kader je Spieler:in; dann
   stehen sie wieder als Plaketten.

   Links vom Schalter steht, seit wann ihr Status gilt (#467) — nur, wenn er
   an diesem Termin je gewechselt hat; die Zeile wird dadurch nicht höher. */
export function SpielerReiter({ teamId, daten }: { teamId: string; daten: TerminSpieler }) {
  const router = useRouter();
  const melde = useSnackbar();
  const [pending, startTransition] = useTransition();
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  useEffect(() => setLokal({}), [daten]);
  // Der Name des Kaders, auf den die Liste eingegrenzt ist. Der Reiter hängt
  // am Termin (`key` in TerminSpalte): Ein anderer Termin beginnt ohne.
  const [gewaehlterKader, setKader] = useState<string | null>(null);
  // Wie viele Spieler:innen am Termin welchem Kader angehören — einmal gezählt.
  const jeKader = useMemo(() => {
    const zahl = new Map<string, number>();
    for (const s of daten.spieler) for (const k of s.kader) zahl.set(k, (zahl.get(k) ?? 0) + 1);
    return zahl;
  }, [daten.spieler]);

  // Bei Beginn war die Liste leer: Dort bleibt es so, auch wenn sie inzwischen jemanden führt.
  if (!daten.mitListe && daten.begonnen)
    return <p className="type-body-medium text-on-surface-mittel">{ABMELDUNG_TEXT.ohneListe}</p>;

  if (!daten.mitListe)
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
    return <p className="type-body-medium text-on-surface-mittel">{ABMELDUNG_TEXT.ausgefallen}</p>;

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

  const uebrige = uebrigeText(daten.uebrige);
  const kaderNamen = daten.kader.flatMap((k) => (k.name !== null ? [k.name] : []));
  const mitChips = !daten.begonnen && kaderNamen.length > 1;
  // Fällt der Kader weg (umbenannt, entfernt), gilt wieder die ganze Liste.
  const eingrenzung = mitChips && gewaehlterKader !== null && kaderNamen.includes(gewaehlterKader) ? gewaehlterKader : null;
  const sichtbar = eingrenzung === null ? daten.spieler : daten.spieler.filter((s) => s.kader.includes(eingrenzung));

  return (
    <div className="flex flex-col gap-3">
      {mitChips ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="type-body-medium text-on-surface-mittel">Gilt für</span>
          <KaderChips
            label="Spieler:innen eingrenzen"
            chips={kaderNamen.map((name) => ({ schluessel: name, name, anzahl: jeKader.get(name) ?? 0 }))}
            gewaehlt={eingrenzung}
            onWahl={setKader}
          />
        </div>
      ) : (
        daten.kader.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 type-body-medium text-on-surface-mittel">
            Gilt für
            <KaderLozenges namen={daten.kader.map((k) => k.name)} />
          </p>
        )
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="type-body-medium text-on-surface-mittel">
          <span className="type-headline-small text-on-surface">{angemeldet}</span> von {daten.gesamt} angemeldet
        </p>
        <p className="type-body-small text-on-surface-mittel">
          {daten.begonnen ? "Stand bei Beginn - nicht mehr änderbar" : `Änderbar bis ${daten.beginn}`}
        </p>
      </div>
      {daten.gesamt === 0 && <p className="type-body-medium text-on-surface-mittel">{KADER_TEXT.niemand}</p>}
      {daten.gesamt > 0 && eingrenzung !== null && sichtbar.length === 0 && (
        <EingrenzungLeer titel={KADER_TEXT.leerKader(eingrenzung)} onAufheben={() => setKader(null)}>
          {KADER_TEXT.leerKaderTermin}
        </EingrenzungLeer>
      )}
      {daten.gesamt > 0 && sichtbar.length > 0 && (
      <ul className="divide-y divide-linie rounded-flaeche bg-elev-01">
        {sichtbar.map((s, i) => {
          const name = s.vorname !== null ? spielerName({ vorname: s.vorname, nachname: s.nachname ?? "" }) : EHEMALIGE_SPIELERIN;
          const ab = abgemeldet(s);
          // Eben selbst umgelegt: Der Wechsel steht schon da, bevor die Antwort kommt.
          const eben = s.spielerId !== null && s.spielerId in lokal && lokal[s.spielerId] !== s.abgemeldet;
          const seit = eben ? "gerade eben" : s.gewechseltAm && seitWann(s.gewechseltAm, daten.gelesenAm);
          return (
            <li key={s.spielerId ?? `ehemalig-${i}`} className="state flex min-h-12 items-center gap-3 px-4 py-1.5">
              <span className="min-w-0 flex-1">
                <span className={`block truncate type-body-medium ${ab || s.ehemalig ? "text-on-surface-mittel" : "text-on-surface"}`}>
                  {name}
                  <span className="sr-only">{ab ? ", abgemeldet" : ", angemeldet"}</span>
                </span>
                {s.kader.length > 0 && <span className="block truncate type-body-small text-on-surface-mittel">{s.kader.join(" · ")}</span>}
              </span>
              {seit && <span className="shrink-0 whitespace-nowrap type-body-small text-on-surface-mittel">{seit}</span>}
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
      )}
      {uebrige && <p className="type-body-small text-on-surface-mittel">{uebrige}</p>}
    </div>
  );
}
