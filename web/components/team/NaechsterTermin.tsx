"use client";

import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button, ButtonLink, Kalenderblatt, Lozenge, Meldebalken, OverflowMenu, SectionMessage, TreffpunktListe } from "@/components/ui";
import { cn } from "@/lib/cn";
import { tagOhneJahr } from "@/lib/monat";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
import { zeitpunktKurz } from "@/lib/spiel";
import { feldName, feldText } from "@/lib/termin-felder";
import { spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { terminHref } from "@/lib/team-ansicht";
import { handlungsMeldung, nachMeldefrist, terminStatus } from "@/lib/termin-status";
import { verantwortlicheMitDir, type TerminZeile } from "@/lib/queries/termine-fuer";
import { useTerminAktionen } from "./TerminBereich";
import { terminMenue } from "./TerminHandgriffe";
import { KaderLozenges } from "./KaderLozenge";

/* Ein Termin als grosse Karte zuoberst im Trainingsplan (#403; Epic #490,
   Tafeln 2b und 2d): «Als Nächstes» ist der nächste Termin, der stattfindet.
   Grösser als die Zeilen und auf einer höheren Fläche, damit man ihn am
   Spielfeldrand nicht suchen muss.

   Von oben nach unten: der Kopf wie eine Zeile — weisses Kalenderblatt,
   Status, Name, Zeit und Ort, das Menü —, dann der Abschnitt TEAM (wer kommt,
   als Balken), bei einem Training der Abschnitt PLATZ, bei einem Spiel die
   TREFFPUNKTE, der späteste zuoberst: Die Trainer:in steht am Treffpunkt nächst
   am Spiel. Zuunterst die Handgriffe, der wichtigste hell. Bemerkung und
   Serie stehen am geöffneten Termin.

   `hervorgehoben`: Der Verweis aus dem Kalender-Abo zielt auf ihn (PC 4) —
   Kontur in Primary, `aria-current` und Sprungziel wie an jeder Zeile. */
export function NaechsterTermin({
  t,
  heute,
  jetzt,
  ich,
  meine,
  hervorgehoben,
  naechster = true,
}: {
  t: TerminZeile;
  heute: string;
  /** `YYYY-MM-DDTHH:MM` am Trainingsort, für die Meldefrist (#494). */
  jetzt: string;
  ich: string;
  meine: boolean;
  hervorgehoben: boolean;
  /** `false`: ein Spiel nach der Meldefrist in der Liste, nicht «Als Nächstes» (#494). */
  naechster?: boolean;
}) {
  const a = useTerminAktionen();
  const zeit = zeitText(t.beginn, t.ende);
  const status = terminStatus(t, heute);
  const nachFrist = nachMeldefrist(t, jetzt);
  const handlung = nachFrist ? handlungsMeldung(t) : null;
  const name = t.spiel ? t.spiel.bezeichnung : t.training ? t.training.name : "Noch kein Training";
  const oeffnen = terminHref(t.teamId, meine, t.id);
  return (
    <div
      id={t.id}
      data-datum={t.datum}
      aria-current={hervorgehoben ? "true" : undefined}
      tabIndex={-1}
      className={cn(
        // Eine Stufe höher als die Karten der Tage darunter: abgehoben (AK 1).
        "relative rounded-flaeche bg-elev-04 p-4 outline-none focus:border-primary",
        naechster && "mt-2",
        hervorgehoben ? "kontur border-primary" : "kontur border-kante",
      )}
    >
      {/* Die ganze Karte öffnet den Termin daneben (#435), wie eine Zeile des
          Plans. Der Inhalt liegt darüber und lässt Klicks durch — ausser auf
          seine eigenen Links und Knöpfe. Für Tastatur und Vorlesehilfe öffnet
          der Name. */}
      <Link href={oeffnen} scroll={false} tabIndex={-1} aria-hidden className="absolute inset-0 rounded-flaeche" />
      <div className="pointer-events-none relative flex flex-col gap-3.5 [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        <div className="flex items-start gap-4">
          <Kalenderblatt datum={t.datum} />
          <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
            {status && <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>}
            <h4 className="type-title-large max-w-full text-on-surface">
              <Link href={oeffnen} scroll={false} className="focus-ring rounded-klein hover:underline">
                <span className="sr-only">{naechster ? "Nächster Termin" : "Spiel nach der Meldefrist"}, {tagOhneJahr(t.datum)}: </span>
                {name}
              </Link>
            </h4>
            <p className="type-body-medium text-on-surface-mittel">{[zeit, t.ort].filter(Boolean).join(" · ")}</p>
          </div>
          <OverflowMenu
            label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
            items={[
              ...(t.training ? [{ label: "Training ersetzen", icon: CalendarPlus, onSelect: () => a.zuordnen(t) }] : []),
              ...terminMenue(t, a),
            ]}
          />
        </div>

        {/* #494: Nach der Meldefrist meldet sich niemand mehr von selbst — die
            Karte sagt, was vor dem Anpfiff zu tun ist. `status`, damit beim
            Laden nicht jede Karte als Alarm vorgelesen wird. */}
        {handlung && (
          <SectionMessage appearance={handlung.appearance} role="status">
            {handlung.text}
          </SectionMessage>
        )}

        <Abschnitt titel="Team" zusatz={<KaderLozenges namen={t.kader.map((k) => k.name)} />}>
          <TeamStand t={t} ich={ich} nachFrist={nachFrist} />
        </Abschnitt>

        {t.spiel ? (
          t.spiel.treffpunkte.length > 0 && (
            <Abschnitt titel="Treffpunkte">
              <TreffpunktListe
                treffpunkte={[...t.spiel.treffpunkte].reverse()}
                spieltag={t.datum}
                spielOrt={t.ort}
                className="type-body-medium text-on-surface"
              />
            </Abschnitt>
          )
        ) : (
          <Abschnitt titel="Platz">
            {t.felder && t.felder.length > 0 ? (
              <ul className="flex flex-col gap-1 type-body-medium text-on-surface">
                {t.felder.map((f, i, alle) => (
                  <li key={i}>{alle.length > 1 ? `${feldName(i, alle.length)}: ${feldText(f)}` : feldText(f)}</li>
                ))}
              </ul>
            ) : (
              <p className="type-body-medium text-on-surface-mittel">Nicht erfasst</p>
            )}
          </Abschnitt>
        )}

        <div className="flex flex-wrap gap-2">
          {t.training ? (
            <>
              <ButtonLink variant="hell" href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`}>Durchführen</ButtonLink>
              <ButtonLink variant="outlined" href={`/training/${t.training.id}`}>Training öffnen</ButtonLink>
            </>
          ) : (
            !t.spiel && (
              <Button variant="hell" aria-haspopup="dialog" onClick={() => a.zuordnen(t)}>Training hinzufügen</Button>
            )
          )}
          {/* Wer kommt (#435) — sobald das Team eine Spielerliste führt. */}
          {t.spielstand && (
            <ButtonLink variant="outlined" href={terminHref(t.teamId, meine, t.id, "spieler")} scroll={false}>Spieler:innen</ButtonLink>
          )}
          {t.spiel && <ButtonLink variant="outlined" href={oeffnen} scroll={false}>Spiel öffnen</ButtonLink>}
        </div>
      </div>
    </div>
  );
}

/** Ein Abschnitt der Karte: Trenner, kleine Überschrift, Inhalt. */
function Abschnitt({ titel, zusatz, children }: { titel: string; zusatz?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-linie pt-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="type-label-medium uppercase tracking-wider text-on-surface-mittel">{titel}</h5>
        {zusatz}
      </div>
      {children}
    </section>
  );
}

/** Wer kommt: der Balken, darunter eine ruhige Zeile — beim Training die
 *  Abgemeldeten, bis wann man ändern kann, und wer verantwortlich ist; beim
 *  Spiel, wie viele noch ohne Meldung sind, und die Meldefrist. Ohne
 *  Spielerliste die erwartete Zahl (Training) bzw. dass nicht gemeldet wird
 *  (Spiel). */
function TeamStand({ t, ich, nachFrist }: { t: TerminZeile; ich: string; nachFrist: boolean }) {
  const v = verantwortlicheMitDir(t, ich).text;
  const s = t.spielstand;
  if (!s) {
    if (t.spiel)
      return <p className="type-body-medium text-on-surface-mittel">Das Team führt keine Spielerliste – hier wird nicht gemeldet.</p>;
    const zeile = [spielerzahlLang(spielerzahlVon(t)), v && `verantwortlich ${v}`].filter(Boolean).join(" · ");
    return <p className="type-body-medium text-on-surface-mittel">{zeile || "Nicht erfasst"}</p>;
  }
  const da = s.anwesend ?? null;
  const zeile = t.spiel
    ? da !== null
      ? ["Stand beim Anpfiff"]
      : [
        (s.ohne_meldung ?? 0) > 0 ? `${s.ohne_meldung} ohne Meldung` : "alle haben sich gemeldet",
        t.spiel.meldefrist && `Meldefrist ${nachFrist ? "abgelaufen " : ""}${zeitpunktKurz(t.spiel.meldefrist)}`,
        ]
    : [da === null && `${s.gesamt - s.angemeldet} abgemeldet · änderbar bis zum Beginn`, v && `verantwortlich ${v}`];
  return (
    <>
      <Meldebalken
        zahl={da ?? s.angemeldet}
        gesamt={s.gesamt}
        min={t.spiel?.richtwertMin}
        max={t.spiel?.richtwertMax}
        wort={da === null ? "angemeldet" : "da"}
      />
      <p className="type-body-small text-on-surface-mittel">{zeile.filter(Boolean).join(" · ")}</p>
    </>
  );
}
