"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { Button, Kalenderblatt, Leerzustand, SectionMessage, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { meldeUeberLinkAktion } from "@/lib/actions/spieler-link";
import { monatsName, tagOhneJahr, tagText } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
import type { LinkTermin } from "@/lib/privater-link";
import { plusTage } from "@/lib/serie";
import { spielerName, verfallenHinweis } from "@/lib/spieler";

/* Was die Spielervertretung über den privaten Link sieht (#436 AK 5–9): ihre
   Spieler:in, das Team und die anstehenden Termine. Angemeldet ist der
   Normalfall — man meldet nur ab, wenn sie nicht kann, und bis zum Beginn
   wieder an. Ein begonnener Termin bleibt bis Ende des Tages stehen,
   gesperrt; ein ausgefallener ist neutral gesperrt. Wurde ein Termin verlegt,
   seit sie abgemeldet wurde, sagt ein Hinweis, dass die Abmeldung nicht mehr
   gilt (#437 AK 2) — bis man neu wählt.

   Aufgebaut wie der Trainingsplan (PO 2026-10-17): zuoberst «Als Nächstes»,
   der nächste Termin, der noch nicht begonnen hat, gross und mit einem Knopf
   zum Ab- oder Wiederanmelden; darunter die übrigen nach Monat, je mit dem
   Schalter. Fürs Handy gebaut. Der Satz im Kopf nennt den Vornamen statt
   eines Pronomens — KiFu kennt das Geschlecht nicht. */
export function ElternAnsicht({
  token,
  team,
  spieler,
  termine,
  heute,
}: {
  token: string;
  team: string;
  spieler: { vorname: string; nachname: string };
  termine: LinkTermin[];
  /** Der Kalendertag am Trainingsort — für «Heute» und «Morgen». */
  heute: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});
  const [fehler, setFehler] = useState<{ terminId: string; text: string } | null>(null);
  useEffect(() => setLokal({}), [termine]);

  const name = spielerName(spieler);
  const naechster = termine.find((t) => !t.begonnen);
  const uebrige = termine.filter((t) => t !== naechster);

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

  /** Der Stand eines Termins, wie er gerade dasteht — der lokale Schalter
   *  zuerst; die Zahl folgt ihm, bevor der Server antwortet. */
  function stand(t: LinkTermin) {
    const ab = t.id in lokal ? lokal[t.id] : t.abgemeldet;
    const zahl = t.angemeldet === null ? null : t.angemeldet + Number(t.abgemeldet) - Number(ab);
    const zweite = t.ausgefallen
      ? "Fällt aus"
      : t.begonnen
        ? "Hat begonnen · nicht mehr änderbar"
        : [t.ort, `${zahl} angemeldet`].filter(Boolean).join(" · ");
    return { ab, zweite };
  }
  const naechsterStand = naechster && stand(naechster);

  /** Hinweis bei verfallener Abmeldung und Fehler — unter jeder Karte gleich. */
  function hinweise(t: LinkTermin, ab: boolean) {
    return (
      <>
        {t.verfallen && !ab && !t.ausgefallen && !t.begonnen && (
          <SectionMessage>{verfallenHinweis(t.verfallen)}</SectionMessage>
        )}
        {fehler?.terminId === t.id && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-0.5 border-b border-linie px-4 pb-4 pt-6">
        <p className="type-body-small text-on-surface-mittel">{team}</p>
        <h1 className="type-headline-small text-on-surface">{name}</h1>
        <p className="type-body-medium text-on-surface-mittel">
          {name} ist für jedes Training zuerst angemeldet. Kann {spieler.vorname} nicht, melde ab - und bis zum
          Beginn wieder an.
        </p>
      </header>
      {termine.length === 0 ? (
        <div className="px-4 py-6">
          <Leerzustand icon={CalendarX2} titel="Keine anstehenden Termine" dicht>
            Sobald das Team Termine plant, stehen sie hier.
          </Leerzustand>
        </div>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          {naechster && naechsterStand && (
            <NaechsterTermin
              t={naechster}
              {...naechsterStand}
              name={name}
              heute={heute}
              pending={pending}
              onUmlegen={(an) => umlegen(naechster, an)}
              hinweise={hinweise(naechster, naechsterStand.ab)}
            />
          )}
          {nachMonatUndTag(uebrige).map((m) => (
            <section key={m.monat}>
              <h2 className="type-title-small text-on-surface">{monatsName(m.monat)}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {m.tage.flatMap((tag) => tag.termine).map((t) => {
                  const { ab, zweite } = stand(t);
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
                      {hinweise(t, ab)}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/* Der nächste Termin, der noch nicht begonnen hat — wie im Trainingsplan
   grösser und auf einer höheren Fläche (#403), dazu ein Knopf statt des
   Schalters: «Abmelden» oder «Wieder anmelden». Abgemeldet steht die Karte
   zurückgenommen im Fehlerton, der Tag in der Fehlerfarbe, und «Wieder
   anmelden» ist der helle Knopf. */
function NaechsterTermin({
  t,
  ab,
  zweite,
  name,
  heute,
  pending,
  onUmlegen,
  hinweise,
}: {
  t: LinkTermin;
  ab: boolean;
  zweite: string;
  name: string;
  heute: string;
  pending: boolean;
  onUmlegen: (an: boolean) => void;
  hinweise: React.ReactNode;
}) {
  const relativ = t.datum === heute ? "Heute" : t.datum === plusTage(heute, 1) ? "Morgen" : null;
  return (
    <section aria-labelledby="als-naechstes">
      <h2 id="als-naechstes" className="type-title-small text-on-surface-mittel">
        Als Nächstes
      </h2>
      {/* Abgemeldet trägt die Karte den Fehlerton — zurückgenommen: die Fläche
          eines Fehlerhinweises halb deckend, die Kontur bleibt die Kante
          (eine Fehlerkontur gibt es nur voll, check:farben). */}
      <div
        className={cn(
          "kontur mt-2 flex flex-col gap-3 rounded-flaeche p-4",
          "border-kante", ab && !t.ausgefallen ? "bg-section-danger/60" : "bg-elev-04",
        )}
      >
        <div>
          <p className={cn("type-title-small", t.ausgefallen ? "text-on-surface-mittel" : ab ? "text-error" : "text-primary")}>
            {relativ && <>{relativ} · </>}
            {tagOhneJahr(t.datum)}
          </p>
          <p className={cn("mt-1 type-headline-small text-on-surface", t.ausgefallen && "line-through")}>
            {t.beginn}–{t.ende} Uhr
          </p>
          <p className="type-body-medium mt-1 text-on-surface-mittel">{zweite}</p>
          <p className="type-body-medium mt-1 text-on-surface">
            {t.ausgefallen ? null : ab ? `${name} ist abgemeldet.` : `${name} ist angemeldet.`}
          </p>
        </div>
        {!t.ausgefallen &&
          (ab ? (
            <Button variant="hell" className="self-start" disabled={pending} onClick={() => onUmlegen(true)}>
              Wieder anmelden
            </Button>
          ) : (
            <Button variant="outlined" className="self-start" disabled={pending} onClick={() => onUmlegen(false)}>
              Abmelden
            </Button>
          ))}
        {hinweise}
      </div>
    </section>
  );
}
