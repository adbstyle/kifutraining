"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { Kalenderblatt, Leerzustand, SectionMessage, Switch } from "@/components/ui";
import { meldeUeberLinkAktion } from "@/lib/actions/spieler-link";
import { tagText } from "@/lib/monat";
import type { LinkTermin } from "@/lib/privater-link";

/* Was die Spielervertretung über den privaten Link sieht (#436 AK 5–9): ihre
   Spieler:in, das Team und je anstehenden Termin ein Schalter, der sofort
   speichert. Angemeldet ist der Normalfall — man schaltet nur aus, wenn sie
   nicht kann. Ein begonnener Termin bleibt bis Ende des Tages stehen, gesperrt;
   ein ausgefallener ist neutral gesperrt.

   Fürs Handy gebaut: eine Spalte, Karten statt Tabelle. Der Satz im Kopf nennt
   den Vornamen statt eines Pronomens — KiFu kennt das Geschlecht nicht. */
export function ElternAnsicht({
  token,
  team,
  spieler,
  termine,
}: {
  token: string;
  team: string;
  spieler: { vorname: string; nachname: string };
  termine: LinkTermin[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  const [fehler, setFehler] = useState<{ terminId: string; text: string } | null>(null);
  useEffect(() => setLokal({}), [termine]);

  const name = `${spieler.vorname} ${spieler.nachname}`;

  function umlegen(t: LinkTermin, an: boolean) {
    setLokal((l) => ({ ...l, [t.id]: !an }));
    setFehler(null);
    startTransition(async () => {
      const r = await meldeUeberLinkAktion(token, {
        terminId: t.id,
        abgemeldet: !an,
        gesehen: { datum: t.datum, beginn: t.beginn },
      });
      if (!r.ok) {
        setLokal((l) => {
          const { [t.id]: _weg, ...rest } = l;
          return rest;
        });
        // Ein inzwischen erneuerter Link: Die Seite lädt neu und sagt es.
        if (!r.ungueltig) setFehler({ terminId: t.id, text: r.error });
      }
      router.refresh();
    });
  }

  return (
    <>
      <header className="flex flex-col gap-0.5 border-b border-linie px-4 pb-4 pt-6">
        <p className="type-body-small text-on-surface-mittel">{team}</p>
        <h1 className="type-headline-small text-on-surface">{name}</h1>
        <p className="type-body-medium text-on-surface-mittel">
          {name} ist für jedes Training angemeldet. Kann {spieler.vorname} nicht, schalte es aus.
        </p>
      </header>
      {termine.length === 0 ? (
        <div className="px-4 py-6">
          <Leerzustand icon={CalendarX2} titel="Keine anstehenden Termine" dicht>
            Sobald das Team Termine plant, stehen sie hier.
          </Leerzustand>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-4 py-2">
          {termine.map((t) => {
            const ab = t.id in lokal ? lokal[t.id] : t.abgemeldet;
            // Die Zahl folgt dem Schalter, bevor der Server antwortet.
            const zahl = t.angemeldet === null ? null : t.angemeldet + Number(t.abgemeldet) - Number(ab);
            const zweite = t.ausgefallen
              ? "Fällt aus"
              : t.begonnen
                ? "Hat begonnen · nicht mehr änderbar"
                : [t.ort, `${zahl} angemeldet`].filter(Boolean).join(" · ");
            return (
              <li key={t.id} className="flex flex-col gap-2 rounded-flaeche bg-elev-01 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <Kalenderblatt
                    datum={t.datum}
                    zustand={t.ausgefallen ? "ausgefallen" : ab ? "abgemeldet" : "training"}
                    className="self-center"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="type-body-medium text-on-surface">
                      {t.beginn}–{t.ende}
                    </span>
                    <span className="type-body-small truncate text-on-surface-mittel">{zweite}</span>
                  </div>
                  <Switch
                    checked={!t.ausgefallen && !ab}
                    neutral={t.ausgefallen}
                    disabled={t.ausgefallen || t.begonnen || pending}
                    onChange={(e) => umlegen(t, e.target.checked)}
                    aria-label={`${name} am ${tagText(t.datum)} dabei`}
                  />
                </div>
                {fehler?.terminId === t.id && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
