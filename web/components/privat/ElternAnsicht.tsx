"use client";

import { useState } from "react";
import { CalendarX2 } from "lucide-react";
import { Button, Kalenderblatt, Leerzustand, Lozenge, SectionMessage, Switch } from "@/components/ui";
import { MELDE_STATUS, TERMIN_STATUS } from "@/lib/termin-status";
import type { Meldung } from "@/lib/spiel";
import { SpielKarte } from "./SpielKarte";
import { KaderLozenges } from "@/components/team/KaderLozenge";
import { cn } from "@/lib/cn";
import { meldeSpielUeberLinkAktion, meldeUeberLinkAktion } from "@/lib/actions/spieler-link";
import { monatsName, tagOhneJahr, tagText } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
import type { LinkTermin } from "@/lib/privater-link";
import { plusTage } from "@/lib/serie";
import { spielerName, spielerzahlKurz, verfallenHinweis, type Spielerzahl } from "@/lib/spieler";
import { useLokalerStand } from "@/lib/use-lokaler-stand";

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
   eines Pronomens — KiFu kennt das Geschlecht nicht.

   Die Spielerzahl steht knapp wie im Trainingsplan, «24/33» mit dem Shirt
   (#472): «angemeldet» und «abgemeldet» meinen auf dieser Seite nur die
   eigene Spieler:in. */
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
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück. Bei
  // Spielen die Meldung (#463) ebenso.
  const abmeldungen = useLokalerStand<boolean>(termine);
  const meldungen = useLokalerStand<Meldung>(termine);
  const pending = abmeldungen.pending || meldungen.pending;
  const [fehler, setFehler] = useState<{ terminId: string; text: string } | null>(null);
  // Ein inzwischen erneuerter Link: Die Seite lädt neu und sagt es.
  const zeigeFehler = (terminId: string) => (r: { ungueltig: true } | { ungueltig?: false; error: string }) => {
    if (!r.ungueltig) setFehler({ terminId, text: r.error });
  };

  const name = spielerName(spieler);
  // Begonnen sind nur Termine von heute: Sie stehen vor «Als Nächstes», damit
  // die Seite in der Zeitfolge bleibt.
  const begonnen = termine.filter((t) => t.begonnen);
  // #497 AK 12: «Als Nächstes» ist der nächste Termin, der stattfindet; ein
  // ausgefallener davor steht als gewöhnliche Karte in der Liste.
  const naechster = termine.find((t) => !t.begonnen && !t.ausgefallen);
  const uebrige = termine.filter((t) => !t.begonnen && t !== naechster);

  function umlegen(t: LinkTermin, an: boolean) {
    setFehler(null);
    abmeldungen.aendere(
      t.id,
      !an,
      () => meldeUeberLinkAktion(token, { terminId: t.id, abgemeldet: !an, gesehen: { datum: t.datum, beginn: t.beginn } }),
      zeigeFehler(t.id),
    );
  }

  /** Ein Spiel melden (#463 AK 3): bis zur Meldefrist, sonst bis zum Anpfiff. */
  function melden(t: LinkTermin, an: boolean) {
    setFehler(null);
    meldungen.aendere(
      t.id,
      an ? "angemeldet" : "abgemeldet",
      () => meldeSpielUeberLinkAktion(token, { terminId: t.id, angemeldet: an, gesehen: { datum: t.datum, beginn: t.beginn } }),
      zeigeFehler(t.id),
    );
  }

  /** Ein Spiel, wie es gerade dasteht: die lokale Meldung zuerst, die Zahl der
   *  Angemeldeten folgt ihr. */
  function spielKarte(t: LinkTermin, o: { gross?: boolean; kopf?: string } = {}) {
    const meldung = meldungen.wert(t.id, t.meldung);
    const angemeldet =
      t.ausgefallen || t.angemeldet == null
        ? null
        : t.angemeldet + Number(meldung === "angemeldet") - Number(t.meldung === "angemeldet");
    return (
      <SpielKarte
        key={t.id}
        t={t}
        meldung={meldung}
        angemeldet={angemeldet}
        name={name}
        pending={pending}
        gross={o.gross}
        kopf={o.kopf}
        fehler={fehler?.terminId === t.id ? fehler.text : undefined}
        onMelden={(an) => melden(t, an)}
      />
    );
  }

  /** Der Stand eines Termins, wie er gerade dasteht — der lokale Schalter
   *  zuerst; die Zahl der Angemeldeten folgt ihm, bevor der Server antwortet,
   *  die Gesamtzahl bleibt (#472 PC 1). */
  function stand(t: LinkTermin) {
    const ab = abmeldungen.wert(t.id, t.abgemeldet);
    const zahl =
      // `== null`: Ein Bundle, das vor der Migration live ist, erhält noch kein `gesamt`.
      t.angemeldet == null || t.gesamt == null
        ? null
        : { quelle: "liste" as const, angemeldet: t.angemeldet + Number(t.abgemeldet) - Number(ab), gesamt: t.gesamt, anwesend: null }; // Eltern sehen den Stand bei Beginn (#475 AK 16).
    const zweite = t.ausgefallen ? "Fällt aus" : t.begonnen ? "Hat begonnen · nicht mehr änderbar" : null;
    return { ab, zweite, zahl };
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
          Beginn wieder an. Für ein Spiel ist {spieler.vorname} erst angemeldet, wenn du anmeldest.
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
          {begonnen.length > 0 && (
            <section>
              <h2 className="type-title-small text-on-surface">Heute</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {begonnen.map((t) =>
                  t.art === "spiel" ? (
                    spielKarte(t)
                  ) : (
                    <TerminKarte key={t.id} t={t} {...stand(t)} name={name} pending={pending} onUmlegen={(an) => umlegen(t, an)} hinweise={hinweise(t, stand(t).ab)} />
                  ),
                )}
              </ul>
            </section>
          )}
          {naechster && naechster.art === "spiel" && (
            <section aria-labelledby="als-naechstes">
              <h2 id="als-naechstes" className="type-title-small text-on-surface-mittel">
                Als Nächstes
              </h2>
              <div className="mt-2">{spielKarte(naechster, { gross: true, kopf: relativerTag(naechster.datum, heute) })}</div>
            </section>
          )}
          {naechster && naechster.art !== "spiel" && naechsterStand && (
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
                {m.tage.flatMap((tag) => tag.termine).map((t) =>
                  t.art === "spiel" ? (
                    spielKarte(t)
                  ) : (
                    <TerminKarte key={t.id} t={t} {...stand(t)} name={name} pending={pending} onUmlegen={(an) => umlegen(t, an)} hinweise={hinweise(t, stand(t).ab)} />
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

type KarteProps = {
  t: LinkTermin;
  ab: boolean;
  /** Statt Ort und Zahl: ausgefallen oder begonnen. */
  zweite: string | null;
  zahl: Spielerzahl | null;
  name: string;
  pending: boolean;
  onUmlegen: (an: boolean) => void;
  hinweise: React.ReactNode;
};

/** Der Status der eigenen Spieler:in an einem Training (Epic #490): grün
 *  angemeldet, rot abgemeldet, grau, wenn er ausfällt. */
function trainingStatus(t: LinkTermin, ab: boolean) {
  return t.ausgefallen ? TERMIN_STATUS.faelltAus : ab ? MELDE_STATUS.abgemeldet : MELDE_STATUS.angemeldet;
}

/* Ein Training in der Liste (Epic #490, Tafel 9 Gruppe 4): Kalenderblatt,
   der Status als Lozenge, Zeit, Ort, Kader und Spielerzahl, rechts der
   Schalter. Abgemeldet oder ausgefallen tritt die Karte gedämpft zurück. */
function TerminKarte({ t, ab, zweite, zahl, name, pending, onUmlegen, hinweise }: KarteProps) {
  const status = trainingStatus(t, ab);
  const gedaempft = t.ausgefallen || ab;
  return (
    <li className={cn("flex flex-col gap-2 rounded-flaeche px-3 py-3", gedaempft ? "kontur border-linie" : "bg-elev-01")}>
      <div className="flex items-start gap-3">
        <Kalenderblatt datum={t.datum} stand={gedaempft ? "gestrichen" : "leise"} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
          <span className={cn("type-body-medium", gedaempft ? "text-on-surface-mittel" : "text-on-surface")}>
            {t.beginn}–{t.ende}
          </span>
          {zweite ? (
            <span className="type-body-small text-on-surface-mittel">{zweite}</span>
          ) : (
            t.ort && <span className="max-w-full truncate type-body-small text-on-surface-mittel">{t.ort}</span>
          )}
          <TeamZeile t={t} zahl={zahl} />
        </div>
        <Switch
          ton="ruhig"
          checked={!t.ausgefallen && !ab}
          neutral={t.ausgefallen}
          disabled={t.ausgefallen || t.begonnen || pending}
          onChange={(e) => onUmlegen(e.target.checked)}
          aria-label={`${name} am ${tagText(t.datum)} dabei`}
        />
      </div>
      {hinweise}
    </li>
  );
}

/* Das nächste Training, das stattfindet und noch nicht begonnen hat — wie im
   Trainingsplan grösser und auf einer höheren Fläche (#403; Epic #490,
   Tafel 9, 4.3): über dem Kopf Heute oder Morgen und der Tag, dann
   Kalenderblatt, Status, Zeit, Ort, Kader und Zahl; darunter bis wann sich
   ändern lässt und ein Knopf statt des Schalters, umrandet. Abgemeldet tritt
   die Karte gedämpft zurück. */
function NaechsterTermin({ t, ab, zahl, name, heute, pending, onUmlegen, hinweise }: KarteProps & { heute: string }) {
  const status = trainingStatus(t, ab);
  return (
    <section aria-labelledby="als-naechstes">
      <h2 id="als-naechstes" className="type-title-small text-on-surface-mittel">
        Als Nächstes
      </h2>
      <div className={cn("mt-2 flex flex-col gap-3 rounded-flaeche p-4", ab ? "kontur border-linie" : "kontur border-kante bg-elev-04")}>
        <p className="type-title-small text-on-surface-mittel">{relativerTag(t.datum, heute)}</p>
        <div className="flex items-start gap-3">
          <Kalenderblatt datum={t.datum} stand={ab ? "gestrichen" : "leise"} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
            <span className={cn("type-title-large", ab ? "text-on-surface-mittel" : "text-on-surface")}>
              {t.beginn}–{t.ende} Uhr
            </span>
            {t.ort && <span className="type-body-medium text-on-surface-mittel">{t.ort}</span>}
            <TeamZeile t={t} zahl={zahl} />
          </div>
        </div>
        <p className="type-body-small text-on-surface-mittel">Änderbar bis zum Beginn</p>
        <Button
          variant="outlined"
          className="self-start"
          disabled={pending}
          onClick={() => onUmlegen(ab)}
          aria-label={`${name} am ${tagText(t.datum)} ${ab ? "anmelden" : "abmelden"}`}
        >
          {ab ? "Anmelden" : "Abmelden"}
        </Button>
        {hinweise}
      </div>
    </section>
  );
}

/* Kader und Spielerzahl knapp: «S1 15/16». Die Zahl wird nie gekürzt (#472
   NFR 1) und bleibt ungefärbt. */
function TeamZeile({ t, zahl }: { t: LinkTermin; zahl: Spielerzahl | null }) {
  if (t.kader.length === 0 && zahl?.quelle !== "liste") return null;
  return (
    <span className="flex flex-wrap items-center gap-2 type-body-small text-on-surface-mittel">
      <KaderLozenges namen={t.kader} />
      {zahl?.quelle === "liste" && (
        <>
          <span aria-hidden className="tabular-nums">{spielerzahlKurz(zahl)}</span>
          {/* Ohne «angemeldet» — das Wort gehört hier der eigenen Spieler:in. */}
          <span className="sr-only">
            Spielerzahl {zahl.angemeldet} von {zahl.gesamt}
          </span>
        </>
      )}
    </span>
  );
}

/** «Heute · Samstag, 31. Oktober», «Morgen · …» oder nur der Tag. */
function relativerTag(datum: string, heute: string): string {
  const relativ = datum === heute ? "Heute" : datum === plusTage(heute, 1) ? "Morgen" : null;
  return `${relativ ? `${relativ} · ` : ""}${tagOhneJahr(datum)}`;
}
