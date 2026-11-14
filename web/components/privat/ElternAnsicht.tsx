"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarX2 } from "lucide-react";
import { ExternerLink, FilterChip, Kalenderblatt, KuerzbarerText, Leerzustand, Lozenge, SectionMessage, Switch, TrainingsTreffpunkt } from "@/components/ui";
import { MELDE_STATUS, TERMIN_STATUS } from "@/lib/termin-status";
import type { Meldung } from "@/lib/spiel";
import { SpielKarte } from "./SpielKarte";
import { AusfallGrund } from "./AusfallGrund";
import { HinweisEltern } from "./HinweisEltern";
import { AboKnopf } from "./AboKnopf";
import { KaderLozenges } from "@/components/team/KaderLozenge";
import { cn } from "@/lib/cn";
import { meldeSpielUeberLinkAktion, meldeUeberLinkAktion } from "@/lib/actions/spieler-link";
import { monatsName, tagText } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
import type { LinkTermin } from "@/lib/privater-link";
import {
  LINK_EINGRENZUNG,
  LINK_GILT_NICHT_TITEL,
  LINK_KEINE_TERMINE_TITEL,
  linkEingrenzungLeer,
  linkEingrenzungStand,
  linkGiltNichtText,
  linkKeineTermineText,
  linkKopfTitel,
  linkOhneTeamEltern,
  spielerName,
  spielerzahlKurz,
  verfallenHinweis,
  type Spielerzahl,
} from "@/lib/spieler";
import { useLokalerStand } from "@/lib/use-lokaler-stand";
import { PROBE_TEXT, linkProbeKopf, linkProbeStand, linkProbeVoll, linkProbeZaehler, type ProbeStand } from "@/lib/probe";

/* Was die Spielervertretung über den privaten Link sieht (#436 AK 5–9): ihre
   Spieler:in, ihre Teams und die anstehenden Termine aller Teams — jeder
   Termin nennt sein Team, auch bei nur einem (#583 AK 1–3). Angemeldet ist der
   Normalfall — man meldet nur ab, wenn sie nicht kann, und bis zum Beginn
   wieder an. Ein begonnener Termin bleibt bis Ende des Tages stehen,
   gesperrt; ein ausgefallener ist neutral gesperrt. Wurde ein Termin verlegt,
   seit sie abgemeldet wurde, sagt ein Hinweis, dass die Abmeldung nicht mehr
   gilt (#437 AK 2) — bis man neu wählt.

   Eine schlichte Liste nach Monat (PO 2026-10-22: kein «Als Nächstes» am
   privaten Link): jedes Training mit dem Schalter, jedes Spiel mit seinen
   Knöpfen. Fürs Handy gebaut. Der Satz im Kopf nennt den Vornamen statt
   eines Pronomens — KiFu kennt das Geschlecht nicht.

   Die Spielerzahl steht knapp wie im Trainingsplan, «24/33» mit dem Shirt
   (#472): «angemeldet» und «abgemeldet» meinen auf dieser Seite nur die
   eigene Spieler:in.

   Im Probe-Modus (#555 AK 9–12) ist es umgekehrt: Die Spieler:in ist an
   Trainings zuerst nicht angemeldet, Spiele stehen keine da. Der Kopf nennt,
   wie viele Probetrainings noch möglich sind, mit einem Balken je
   Probetraining (besucht gefüllt, angemeldet umrandet). Ist die Anzahl
   erreicht, sagt das eine Meldung über den Trainings, und die Schalter der
   übrigen sind gesperrt, bis ein Platz frei wird. Das Info-Schreiben des
   Teams (#556) steht davor, gekürzt mit «Ganz lesen» — man liest es, bevor
   man anmeldet (AK 4); Webadressen darin öffnen sich (AK 5). */
export function ElternAnsicht({
  token,
  teams,
  spieler,
  probe,
  probeInfo,
  termine,
}: {
  token: string;
  /** Die Teams der Spieler:in, alphabetisch, auch ohne Termine; leer ohne Team. */
  teams: string[];
  spieler: { vorname: string; nachname: string };
  /** Im Probe-Modus ihr Stand, sonst `null`. */
  probe: ProbeStand | null;
  /** Das Info-Schreiben des Teams, nur im Probe-Modus (#556). */
  probeInfo: string | null;
  termine: LinkTermin[];
}) {
  // Was gerade umgelegt wird, steht sofort so da; scheitert es, zurück. Bei
  // Spielen die Meldung (#463) ebenso.
  const abmeldungen = useLokalerStand<boolean>(termine);
  const meldungen = useLokalerStand<Meldung>(termine);
  const pending = abmeldungen.pending || meldungen.pending;
  const [fehler, setFehler] = useState<{ terminId: string; text: string } | null>(null);
  // Gilt der Termin nicht mehr für die Spieler:in (#583 AK 7), zeigt die neu
  // geladene Liste ihn nicht mehr: Die Meldung hält Art und Tag selbst fest und
  // bleibt stehen, bis neu gemeldet wird.
  const [giltNicht, setGiltNicht] = useState<{ art: LinkTermin["art"]; datum: string } | null>(null);
  // Der gedrückte Schalter verschwindet mit seiner Karte: Der Fokus geht auf
  // die Meldung, statt auf die Seite zu fallen (Tastatur, Vorlesehilfen).
  const giltNichtRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (giltNicht) giltNichtRef.current?.focus();
  }, [giltNicht]);
  // Ein inzwischen erneuerter Link: Die Seite lädt neu und sagt es.
  const zeigeFehler = (t: LinkTermin) => (r: { ungueltig: true } | { ungueltig?: false; giltNicht?: boolean; error: string }) => {
    if (r.ungueltig) return;
    if (r.giltNicht) setGiltNicht({ art: t.art, datum: t.datum });
    else setFehler({ terminId: t.id, text: r.error });
  };

  const name = spielerName(spieler);
  // Auf Trainings oder Spiele eingrenzen (#596): Es gilt höchstens eine Art,
  // ein Klick auf die gewählte hebt sie auf — wie «Meine Termine» im Team.
  // Bewusst nur im Zustand der Seite: Neu öffnen oder neu laden zeigt wieder
  // alles (PC 1), ein Melden lädt die Daten neu und lässt die Wahl stehen
  // (AK 7). Im Probe-Modus stehen keine Spiele da, also keine Wahl (AK 8).
  const [art, setArt] = useState<LinkTermin["art"] | null>(null);
  const eingrenzbar = !probe && termine.length > 0;
  // Verschwinden die Chips (Probe-Modus, keine Termine mehr), fällt die Wahl
  // weg, statt verdeckt weiterzuleben und beim Wiedererscheinen still zu gelten.
  if (!eingrenzbar && art) setArt(null);
  const sichtbar = art ? termine.filter((t) => t.art === art) : termine;
  // Ein Fehler beim Melden steht an seiner Karte; ist sie weggefiltert, steht
  // er mit dem Tag über der Liste, damit er nicht ungesehen verschwindet.
  const fehlerVerdeckt = fehler && !sichtbar.some((t) => t.id === fehler.terminId) ? termine.find((t) => t.id === fehler.terminId) : undefined;
  // Begonnen sind nur Termine von heute: Sie stehen zuoberst unter «Heute»,
  // gesperrt bis Ende des Tages.
  const begonnen = sichtbar.filter((t) => t.begonnen);
  const uebrige = sichtbar.filter((t) => !t.begonnen);

  // Der Probe-Stand folgt den lokalen Schaltern, bevor der Server antwortet.
  const probeLokal = probe && {
    ...probe,
    angemeldet:
      probe.angemeldet +
      termine
        .filter((t) => t.art !== "spiel" && !t.begonnen && !t.ausgefallen)
        .reduce((n, t) => n + Number(t.abgemeldet) - Number(abmeldungen.wert(t.id, t.abgemeldet)), 0),
  };
  if (probeLokal && probeLokal.anzahl !== null)
    probeLokal.moeglich = Math.max(0, probeLokal.anzahl - probeLokal.besucht - probeLokal.angemeldet);
  const voll = !!probeLokal && probeLokal.anzahl !== null && probeLokal.moeglich === 0;

  function umlegen(t: LinkTermin, an: boolean) {
    setFehler(null);
    setGiltNicht(null);
    abmeldungen.aendere(
      t.id,
      !an,
      () => meldeUeberLinkAktion(token, { terminId: t.id, abgemeldet: !an, gesehen: { datum: t.datum, beginn: t.beginn } }),
      zeigeFehler(t),
    );
  }

  /** Ein Spiel melden (#463 AK 3): bis zur Meldefrist, sonst bis zum Anpfiff. */
  function melden(t: LinkTermin, an: boolean) {
    setFehler(null);
    setGiltNicht(null);
    meldungen.aendere(
      t.id,
      an ? "angemeldet" : "abgemeldet",
      () => meldeSpielUeberLinkAktion(token, { terminId: t.id, angemeldet: an, gesehen: { datum: t.datum, beginn: t.beginn } }),
      zeigeFehler(t),
    );
  }

  /** Ein Spiel, wie es gerade dasteht: die lokale Meldung zuerst, die Zahl der
   *  Angemeldeten folgt ihr. */
  function spielKarte(t: LinkTermin) {
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
    // «Fällt aus» sagt schon die Lozenge; ausgefallen bleibt der Ort stehen (#530 AK 5).
    const zweite = !t.ausgefallen && t.begonnen ? "Hat begonnen · nicht mehr änderbar" : null;
    // Probe: Ist die Anzahl erreicht, lässt sich nur noch abmelden (AK 10, 12).
    const vergeben = voll && ab && !t.ausgefallen && !t.begonnen;
    return { ab, zweite, zahl, probe: !!probe, vergeben };
  }

  /** Hinweis bei verfallener Abmeldung und Fehler — unter jeder Karte gleich. */
  function hinweise(t: LinkTermin, ab: boolean) {
    return (
      <>
        {t.verfallen && ab === !!t.verfallen.anmeldung && !t.ausgefallen && !t.begonnen && (
          <SectionMessage>{verfallenHinweis(t.verfallen)}</SectionMessage>
        )}
        {fehler?.terminId === t.id && <SectionMessage appearance="error">{fehler.text}</SectionMessage>}
      </>
    );
  }

  return (
    <>
      <header className="flex flex-col gap-0.5 border-b border-linie px-4 pb-4 pt-6">
        {/* Das Kalender-Abo (#507 AK 1) gleich hinter dem Namen: Es ist der
            Kalender dieser Spieler:in (PO 2026-10-24). */}
        <div className="flex items-center gap-1">
          <h1 className="min-w-0 type-headline-small text-on-surface">{linkKopfTitel(name)}</h1>
          <AboKnopf token={token} />
        </div>
        {/* Die Teams alphabetisch, auch ohne Termine (#583 AK 3). */}
        {teams.length > 0 && (
          <ul aria-label="Teams" className="mt-1 flex flex-wrap gap-1">
            {/* Gleichnamige Teams eines Vereins sind im Altbestand möglich: Schlüssel mit Stelle. */}
            {teams.map((t, i) => (
              <li key={`${i}:${t}`}>
                <Lozenge appearance="neutral">{t}</Lozenge>
              </li>
            ))}
          </ul>
        )}
        {probeLokal ? (
          <>
            <p className="type-body-medium text-on-surface-mittel">{linkProbeKopf(spieler.vorname)}</p>
            <ProbeZaehler stand={probeLokal} />
          </>
        ) : teams.length === 0 ? null : (
          <p className="type-body-medium text-on-surface-mittel">
            {name} ist für jedes Training zuerst angemeldet. Kann {spieler.vorname} nicht, melde ab - und bis zum
            Beginn wieder an. Für ein Spiel ist {spieler.vorname} erst angemeldet, wenn du anmeldest.
          </p>
        )}
      </header>
      {probeLokal && probeInfo && (
        <section aria-labelledby="probe-info" className="mx-4 mt-4 rounded-flaeche bg-elev-01 px-3 py-3">
          <h2 id="probe-info" className="type-title-small text-on-surface">
            {PROBE_TEXT.linkInfoTitel}
          </h2>
          <KuerzbarerText text={probeInfo} zeilen={4} className="mt-1 type-body-medium text-on-surface" />
        </section>
      )}
      {voll && probeLokal && (
        <div className="px-4 pt-4">
          <SectionMessage>{linkProbeVoll(spieler.vorname, probeLokal)}</SectionMessage>
        </div>
      )}
      {eingrenzbar && (
        <div role="group" aria-label="Termine eingrenzen" className="flex flex-wrap gap-2 px-4 pt-4">
          {(["training", "spiel"] as const).map((a) => (
            <FilterChip key={a} selected={art === a} onClick={() => setArt(art === a ? null : a)}>
              {LINK_EINGRENZUNG[a].chip}
            </FilterChip>
          ))}
          {/* Nach dem Wechsel sagt eine Sprachausgabe, was nun dasteht. */}
          <p role="status" className="sr-only">
            {art ? linkEingrenzungStand(art, sichtbar.length) : ""}
          </p>
        </div>
      )}
      {fehlerVerdeckt && fehler && (
        <div className="px-4 pt-4">
          <SectionMessage appearance="error">
            {tagText(fehlerVerdeckt.datum)}: {fehler.text}
          </SectionMessage>
        </div>
      )}
      {giltNicht && (
        <div ref={giltNichtRef} tabIndex={-1} className="px-4 pt-4 focus:outline-none">
          <SectionMessage appearance="error">
            <strong className="block font-semibold">{LINK_GILT_NICHT_TITEL}</strong>
            {linkGiltNichtText(giltNicht.art, giltNicht.datum, spieler.vorname)}
          </SectionMessage>
        </div>
      )}
      {termine.length === 0 ? (
        <div className="px-4 py-6">
          <Leerzustand icon={CalendarX2} titel={LINK_KEINE_TERMINE_TITEL} dicht>
            {/* Ohne Team bleibt der Link gültig (#583 AK 5). */}
            {teams.length === 0 ? linkOhneTeamEltern(spieler.vorname) : linkKeineTermineText(spieler.vorname)}
          </Leerzustand>
        </div>
      ) : art && sichtbar.length === 0 ? (
        // Die Eingrenzung lässt nichts übrig (AK 6); der Weg zurück ist der
        // gewählte Chip darüber.
        <div className="px-4 py-6">
          <Leerzustand icon={CalendarX2} titel={LINK_EINGRENZUNG[art].leer} dicht>
            {linkEingrenzungLeer(art)}
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
  /** Unter dem Ort: begonnen und nicht mehr änderbar. */
  zweite: string | null;
  zahl: Spielerzahl | null;
  /** Im Probe-Modus: zuerst nicht angemeldet (#555). */
  probe: boolean;
  /** Probe: Die Anzahl ist erreicht, anmelden geht hier nicht (AK 12). */
  vergeben: boolean;
  name: string;
  pending: boolean;
  onUmlegen: (an: boolean) => void;
  hinweise: React.ReactNode;
};

/** Der Status der eigenen Spieler:in an einem Training (Epic #490): grün
 *  angemeldet, rot abgemeldet, grau, wenn er ausfällt. */
function trainingStatus(t: LinkTermin, ab: boolean, probe: boolean) {
  if (t.ausgefallen) return TERMIN_STATUS.faelltAus;
  if (!ab) return MELDE_STATUS.angemeldet;
  // Probe: nicht angemeldet ist der Ausgangsstand, kein Absagen (#555).
  return probe ? { wort: PROBE_TEXT.nichtAngemeldet, appearance: "neutral" as const } : MELDE_STATUS.abgemeldet;
}

/* Ein Training in der Liste (Epic #490, Tafel 9 Gruppe 4): Kalenderblatt,
   der Status als Lozenge, Zeit, Ort, Kader und Spielerzahl, rechts der
   Schalter. Abgemeldet oder ausgefallen tritt die Karte gedämpft zurück. */
function TerminKarte({ t, ab, zweite, zahl, probe, vergeben, name, pending, onUmlegen, hinweise }: KarteProps) {
  const status = trainingStatus(t, ab, probe);
  // Probe: nicht angemeldet ist der Ausgangsstand, keine Absage - die Karte bleibt.
  const gedaempft = t.ausgefallen || (ab && !probe);
  return (
    <li className={cn("flex flex-col gap-2 rounded-flaeche px-3 py-3", gedaempft ? "kontur border-linie" : "bg-elev-01")}>
      <div className="flex items-start gap-3">
        <Kalenderblatt datum={t.datum} stand={gedaempft ? "gestrichen" : "leise"} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
          <span className={cn("type-body-medium", gedaempft ? "text-on-surface-mittel" : "text-on-surface")}>
            {t.beginn}–{t.ende}
          </span>
          {/* Jeder Termin nennt sein Team (#583 AK 2). */}
          <span className="type-body-small text-on-surface-mittel">{t.team}</span>
          {/* Der Ort steht ganz und auch nach Beginn (#534 AK 1, 2); mit
              Kartenlink als Link auf einer Zeile (#533 AK 6, 10, 11; PC 5). */}
          {t.ort &&
            (t.ort_link && !t.ausgefallen ? (
              <ExternerLink href={t.ort_link} einzeilig className="type-body-small">
                {t.ort}
              </ExternerLink>
            ) : (
              <span className="max-w-full break-words type-body-small text-on-surface-mittel">{t.ort}</span>
            ))}
          {zweite && <span className="type-body-small text-on-surface-mittel">{zweite}</span>}
          <AusfallGrund grund={t.ausfall_grund} />
          <TeamZeile t={t} zahl={zahl} zusatz={vergeben ? PROBE_TEXT.vergeben : null} />
          {t.verantwortlich && <span className="type-body-small text-on-surface-mittel">Verantwortlich: {t.verantwortlich}</span>}
        </div>
        {/* Fällt der Termin aus, gibt es nichts zu wählen: kein Schalter — ein
            gesperrter auf ✕ läse sich als «abgemeldet». Den Ausfall sagen
            Kalenderblatt und Grund. */}
        {!t.ausgefallen && (
          <Switch
            ton="ruhig"
            checked={!ab}
            disabled={t.begonnen || vergeben || pending}
            onChange={(e) => onUmlegen(e.target.checked)}
            aria-label={`${name} am ${tagText(t.datum)} dabei`}
          />
        )}
      </div>
      {/* #561 AK 12: der Treffpunkt wie bei einem Spiel — nicht abgemeldet,
          ausgefallen oder ab Beginn; nicht angemeldet auf Probe sieht ihn. */}
      {!t.begonnen && !gedaempft && (
        <TrainingsTreffpunkt treffpunkt={t.treffpunkt ?? null} className="type-body-medium text-on-surface" />
      )}
      <HinweisEltern text={t.hinweis_eltern} gedaempft={gedaempft} />
      {hinweise}
    </li>
  );
}

/* Kader und Spielerzahl knapp: «S1 15/16». Die Zahl wird nie gekürzt (#472
   NFR 1) und bleibt ungefärbt. */
function TeamZeile({ t, zahl, zusatz }: { t: LinkTermin; zahl: Spielerzahl | null; zusatz: string | null }) {
  if (t.kader.length === 0 && zahl?.quelle !== "liste" && !zusatz) return null;
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
      {zusatz && <span>{zahl?.quelle === "liste" ? `· ${zusatz}` : zusatz}</span>}
    </span>
  );
}

/** Wie viele Probetrainings noch möglich sind (#555 AK 11; PC 13): ein Balken
 *  je Probetraining — besucht gefüllt, künftig angemeldet umrandet, frei leer. */
function ProbeZaehler({ stand }: { stand: ProbeStand }) {
  const n = stand.anzahl ?? 0;
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <span className="type-title-small text-on-surface">{linkProbeZaehler(stand)}</span>
      {n > 0 && (
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: n }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-klein",
                i < stand.besucht
                  ? "bg-on-lozenge-discovery"
                  : i < stand.besucht + stand.angemeldet
                    ? "kontur border-on-lozenge-discovery"
                    : "bg-linie",
              )}
            />
          ))}
        </span>
      )}
      <span className="type-body-small tabular-nums text-on-surface-mittel">{linkProbeStand(stand)}</span>
    </div>
  );
}
