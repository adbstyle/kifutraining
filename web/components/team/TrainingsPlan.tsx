"use client";

import { EHEMALIGER_KADER } from "./KaderLozenge";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Card, Disclosure, Kalenderblatt, Lozenge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { TerminHandgriffe, TrainingHinzufuegen } from "./TerminHandgriffe";
import { NaechsterTermin } from "./NaechsterTermin";
import { PlanMonat } from "./PlanMonat";
import { PlanGeteilt } from "./PlanGeteilt";
import { zeitText } from "@/lib/termin";
import { spielerzahlKurz, spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { terminHref } from "@/lib/team-ansicht";
import { monatVon, monatsName } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, verantwortlicheMitDir, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";
import { blattStand, nachMeldefrist, terminStatus } from "@/lib/termin-status";

/* Der Kalender eines Teams als Liste (Team-Kalender #322, #323; gegliedert
   mit Story 18 und Epic #401): zuoberst, was ansteht, danach der Rückblick,
   zugeklappt. Beide sind nach Monaten gegliedert, die Überschrift nennt das
   Jahr (#402 AK 20); darin steht jeder Tag einmal als Kalenderblatt mit
   seinen Terminen als knappe Zeilen (AK 1, 2).

   Ab `lg` steht der Monat daneben und bleibt beim Scrollen stehen (#404
   AK 1, 15); schmal und auf Papier gibt es ihn nicht (OoS 7). Ohne Termine
   steht `leer` an der Stelle der Liste. */
export function TrainingsPlan({
  plan,
  heute,
  jetzt,
  ich,
  hervorheben,
  belegt,
  meine,
  leer,
  spalte,
}: {
  plan: Plan;
  heute: string;
  /** `YYYY-MM-DDTHH:MM` am Trainingsort — der Stand beim Laden (#494). */
  jetzt: string;
  ich: string;
  hervorheben?: string;
  /** Tage mit Terminen, die «Meine Termine» ausblendet (#404 AK 14). */
  belegt: readonly string[];
  meine: boolean;
  leer?: ReactNode;
  /** Der geöffnete Termin (#435): ab `lg` an Stelle des Monats daneben, in
   *  einer geteilten Fläche mit Griff (`PlanGeteilt`); schmaler an Stelle
   *  der Liste. */
  spalte?: ReactNode;
}) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  // #403, #492 AK 1, 2: Der erste anstehende Termin, der stattfindet, steht
  // zuoberst und nicht noch einmal in der Liste (AK 18); ein ausgefallener
  // davor bleibt eine gewöhnliche Zeile (Epic #490, hebt PO 6 auf). Die Zahl
  // zählt alle anstehenden (AK 19). Die Reihenfolge des Tages (Beginn, dann
  // Anlegen) kommt aus der Datenbank (AK 16), die Eingrenzung auf die eigenen
  // Termine aus der Seite (AK 17).
  const naechster = plan.kommend.find((t) => !t.ausgefallen);
  const danach = plan.kommend.filter((t) => t !== naechster);
  const liste = useRef<HTMLDivElement>(null);
  // #404 AK 10, 11: ein im Monat gewählter Termin. `nr` macht jede Wahl neu,
  // auch dieselbe zweimal.
  const [sprung, setSprung] = useState<{ id: string; nr: number } | null>(null);
  // #330 PC 7: Der Verweis aus dem Kalender zeigt auch einen Termin im
  // Rückblick — der Abschnitt klappt dafür auf, und `key` setzt den
  // Anfangszustand neu, wenn ein anderer Termin gemeint ist. Ebenso jeder im
  // Monat gewählte vergangene Termin (#404 PC 7): `rueckblickAuf` zählt nur
  // hoch, ein späterer Sprung nach vorn klappt den Rückblick nicht wieder zu.
  const imRueckblick = hervorheben !== undefined && plan.vergangen.some((t) => t.id === hervorheben);
  const [rueckblickAuf, setRueckblickAuf] = useState(0);
  // Beim Einhängen (Kindeffekte laufen vor diesem): Der Rückblick ist dann schon offen.
  useEffect(() => {
    const ziel = hervorheben ? document.getElementById(hervorheben) : null;
    ziel?.scrollIntoView({ block: "center" });
    // Auch Tastatur und Vorlesehilfe landen dort: Der Fokus folgt dem Scrollen.
    ziel?.focus({ preventScroll: true });
  }, [hervorheben]);
  // Zum gewählten Termin, oben unter die Kopfzeile (`scroll-padding-top`) —
  // so ist er der oberste und der Monat bleibt seiner (#404 AK 3). Der
  // nächste Termin ist dabei die Karte zuoberst (PC 8).
  useEffect(() => {
    const ziel = sprung ? document.getElementById(sprung.id) : null;
    ziel?.scrollIntoView({ block: "start" });
    ziel?.focus({ preventScroll: true });
  }, [sprung]);

  const alle = [...plan.vergangen, ...plan.kommend];
  const termine = (
    <>
      {alle.length === 0 && leer}
      {plan.kommend.length > 0 && (
        <section>
          <h3 className="type-title-small text-on-surface-mittel">
            Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
          </h3>
          {naechster && <NaechsterTermin t={naechster} heute={heute} jetzt={jetzt} ich={ich} meine={meine} hervorgehoben={naechster.id === hervorheben} />}
          <PlanMonate termine={danach} heute={heute} jetzt={jetzt} ich={ich} meine={meine} hervorheben={hervorheben} />
        </section>
      )}
      {plan.vergangen.length > 0 && (
        <Disclosure
          key={`${nichtsMehrOffen ? "allein" : "mit-kommendem"}-${imRueckblick ? hervorheben : ""}-${rueckblickAuf}`}
          title="Vergangen"
          count={plan.vergangen.length}
          defaultOpen={nichtsMehrOffen || imRueckblick || rueckblickAuf > 0}
          className={cn(!nichtsMehrOffen && "mt-6")}
        >
          <PlanMonate termine={plan.vergangen} heute={heute} jetzt={jetzt} ich={ich} meine={meine} hervorheben={hervorheben} />
        </Disclosure>
      )}
    </>
  );

  // Ein geöffneter Termin teilt die Fläche wie ein Training (#435).
  if (spalte) return <PlanGeteilt links={termine} rechts={spalte} listeRef={liste} />;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div ref={liste} className="min-w-0">
        {termine}
      </div>
      <div className="sticky top-20 hidden lg:block print:hidden">
        <PlanMonat
          termine={alle}
          heute={heute}
          belegt={belegt}
          meine={meine}
          anfang={monatVon(plan.kommend[0]?.datum ?? heute)}
          liste={liste}
          onWahl={(id) => {
            if (plan.vergangen.some((t) => t.id === id)) setRueckblickAuf((n) => n + 1);
            setSprung((s) => ({ id, nr: (s?.nr ?? 0) + 1 }));
          }}
        />
      </div>
    </div>
  );
}

/** Termine nach Monat und Tag: je Monat eine Überschrift mit Jahr, je Tag eine
 *  Karte mit seinen Terminen als Zeilen, jede mit ihrem Kalenderblatt. Ein
 *  Spiel nach der Meldefrist steht an seinem Platz als grosse Karte statt als
 *  Zeile (#494 AK 1); die Zeilen davor und danach bilden je eine Karte. */
function PlanMonate({
  termine,
  heute,
  jetzt,
  ich,
  meine,
  hervorheben,
}: {
  termine: TerminZeile[];
  heute: string;
  jetzt: string;
  ich: string;
  meine: boolean;
  hervorheben?: string;
}) {
  return nachMonatUndTag(termine).map((m) => (
    <section key={m.monat} className="mt-4 first:mt-2">
      <h4 className="type-title-small text-on-surface">{monatsName(m.monat)}</h4>
      <ol className="mt-2 flex flex-col gap-2">
        {m.tage.flatMap((tag) => {
          // Der erste Termin des Tages — Zeile oder grosse Karte — trägt
          // dessen Überschrift (sein Kalenderblatt).
          const erste = tag.termine[0];
          return abschnitte(tag.termine, (t) => nachMeldefrist(t, jetzt)).map((teil) =>
            teil.gross ? (
              <li key={teil.termine[0].id}>
                <NaechsterTermin
                  t={teil.termine[0]}
                  heute={heute}
                  jetzt={jetzt}
                  ich={ich}
                  meine={meine}
                  hervorgehoben={teil.termine[0].id === hervorheben}
                  naechster={false}
                  tagesUeberschrift={teil.termine[0] === erste}
                />
              </li>
            ) : (
              <li key={teil.termine[0].id}>
                {/* Ohne Polsterung: Die Zeilen füllen die Karte, ihre Zustands-
                    Ebene beim Überfahren reicht bis an deren Rand. */}
                <Card>
                  <ol className="divide-y divide-linie">
                    {teil.termine.map((t) => (
                      <TerminReihe key={t.id} t={t} heute={heute} ich={ich} meine={meine} hervorgehoben={t.id === hervorheben} ersterDesTages={t === erste} />
                    ))}
                  </ol>
                </Card>
              </li>
            ),
          );
        })}
      </ol>
    </section>
  ));
}

/** Teilt die Termine eines Tages in Folgen gewöhnlicher Zeilen und einzelne
 *  grosse Karten, in ihrer Reihenfolge. */
function abschnitte(termine: TerminZeile[], gross: (t: TerminZeile) => boolean): { gross: boolean; termine: TerminZeile[] }[] {
  const teile: { gross: boolean; termine: TerminZeile[] }[] = [];
  for (const t of termine) {
    const g = gross(t);
    const letzter = teile.at(-1);
    if (!g && letzter && !letzter.gross) letzter.termine.push(t);
    else teile.push({ gross: g, termine: [t] });
  }
  return teile;
}

/* Ein Termin als knappe Zeile (#402; Epic #490, Tafel 2 und 2c). Die ganze
   Zeile öffnet den Termin daneben: Ihre Fläche ist ein Link, über dem der
   Inhalt liegt, ohne Klicks abzufangen (`pointer-events-none`). Nur der
   Trainingsname, «+ Training hinzufügen» und die Handgriffe rechts nehmen
   Klicks selbst an. Was zu lang ist, endet in «…»; die ganze Zeile steht im
   Tooltip des Links, alles Weitere am geöffneten Termin.

   Aufbau wie im Design: links das Kalenderblatt (weiss, vergangen grau,
   ausgefallen grau und durchgestrichen), daneben untereinander der Status
   als Lozenge, der Name und eine ruhige Zeile mit Zeit, Ort — bei einem
   ausgefallenen Termin statt des Orts der Grund —, Kader und Verantwortlichen;
   rechts die Spielerzahl klein und ungefärbt, dann die Handgriffe. Ein
   vergangener Termin steht gedämpft und ohne Status, ein ausgefallener
   gedämpft mit durchgestrichenem Namen. Nur das erste Blatt eines Tages ist
   dessen Überschrift, die übrigen sind stumm. */
function TerminReihe({
  t,
  heute,
  ich,
  meine,
  hervorgehoben,
  ersterDesTages,
}: {
  t: TerminZeile;
  heute: string;
  ich: string;
  meine: boolean;
  hervorgehoben: boolean;
  ersterDesTages: boolean;
}) {
  const vergangen = t.datum < heute;
  const gedaempft = vergangen || t.ausgefallen;
  const zeit = zeitText(t.beginn, t.ende);
  const v = verantwortlicheMitDir(t, ich);
  const status = terminStatus(t, heute);
  const zahl = spielerzahlVon(t);
  const zahlKurz = spielerzahlKurz(zahl);
  const zahlLang = spielerzahlLang(zahl);
  const kaderText = t.kader.map((k) => k.name ?? EHEMALIGER_KADER).join(", ");
  const name = t.spiel ? t.spiel.bezeichnung : t.training ? t.training.name : t.ausgefallen || vergangen ? "Kein Training eingetragen" : null;
  const unterzeile = [
    zeit,
    t.ausgefallen ? t.ausfallGrund : t.ort,
    t.ausgefallen && t.training ? "Training ruht" : null,
    kaderText && `Kader ${kaderText}`,
    v.text,
  ].filter(Boolean).join(" · ");
  const ganz = [status?.wort, name, unterzeile, zahlLang].filter(Boolean).join("\n");
  return (
    <li
      id={t.id}
      data-datum={t.datum}
      aria-current={hervorgehoben ? "true" : undefined}
      // Sprungziel aus dem Kalender-Abo und dem Monat; die Kontur zeigt, wo man landet.
      tabIndex={-1}
      className={cn(
        "group/zeile state relative flex items-start gap-3 px-3 py-2.5 outline-none first:rounded-t-flaeche last:rounded-b-flaeche focus:kontur focus:border-primary",
        hervorgehoben && "kontur border-primary",
      )}
    >
      {/* Die Zeile öffnet den Termin daneben (#435); ändern lässt er sich dort. */}
      <Link href={terminHref(t.teamId, meine, t.id)} scroll={false} title={ganz} className="focus-ring absolute inset-0 group-first/zeile:rounded-t-flaeche group-last/zeile:rounded-b-flaeche">
        <span className="sr-only">{t.spiel ? `Spiel öffnen: ${t.spiel.bezeichnung}, ${zeit}` : `Termin öffnen: ${zeit}`}</span>
      </Link>
      <div aria-hidden={!ersterDesTages || undefined} className="pointer-events-none relative">
        <Kalenderblatt as={ersterDesTages ? "h5" : "div"} datum={t.datum} stand={blattStand(t, heute)} />
      </div>
      <div className="pointer-events-none relative flex min-w-0 flex-1 flex-col items-start gap-0.5">
        {status && <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>}
        {t.training && !t.ausgefallen ? (
          <Link
            href={`/training/${t.training.id}`}
            title={t.training.name}
            className={cn(
              "focus-ring pointer-events-auto max-w-full truncate rounded-klein type-title-small hover:underline",
              vergangen ? "text-on-surface-mittel" : "text-on-surface",
            )}
          >
            {t.training.name}
          </Link>
        ) : name ? (
          <span className={cn("max-w-full truncate type-title-small", gedaempft ? "text-on-surface-mittel" : "text-on-surface", t.ausgefallen && "line-through")}>
            {name}
          </span>
        ) : (
          <TrainingHinzufuegen t={t} className="type-title-small" />
        )}
        <span className="max-w-full truncate type-body-medium text-on-surface-mittel">{unterzeile}</span>
      </div>
      {zahlKurz && (
        <span className="pointer-events-none relative shrink-0 py-0.5 type-body-small tabular-nums text-on-surface-mittel">
          <span aria-hidden>{zahlKurz}</span>
          <span className="sr-only">Spielerzahl: {zahlLang}</span>
        </span>
      )}
      <TerminHandgriffe t={t} zuordnen={!nochNichtVorbereitet(t, heute)} />
    </li>
  );
}
