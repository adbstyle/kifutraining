"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CalendarDays, CalendarOff, CalendarPlus, CalendarX2, LandPlot, MapPin, MessageSquareText, Pencil, PlayCircle, Repeat, Shirt, Trash2, Undo2, Unlink, UserCheck, Users } from "lucide-react";
import { Card, Disclosure, IconButton, IconButtonLink, Kalenderblatt, KategorieLozenge, Lozenge, OverflowMenu, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen } from "./TerminBereich";
import { TerminHandgriffe } from "./TerminHandgriffe";
import { NaechsterTermin } from "./NaechsterTermin";
import { wochentageText } from "@/lib/serie";
import { spielerzahlText, zeitText } from "@/lib/termin";
import { felderKurz } from "@/lib/termin-felder";
import { datumKurz } from "@/lib/zeit";
import { monatsName } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, verantwortlichenNamen, verantwortlicheMitDir, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Der Kalender eines Teams als Liste (Team-Kalender #322, #323; gegliedert
   mit Story 18 und Epic #401): zuoberst, was ansteht, danach der Rückblick,
   zugeklappt. Beide sind nach Monaten gegliedert, die Überschrift nennt das
   Jahr (#402 AK 20); darin steht jeder Tag einmal als Kalenderblatt mit
   seinen Terminen als knappe Zeilen (AK 1, 2). */
export function TrainingsPlan({ plan, heute, ich, hervorheben }: { plan: Plan; heute: string; ich: string; hervorheben?: string }) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  // #403: Der erste anstehende Termin — auch ein ausgefallener (PO 6) — steht
  // zuoberst und nicht noch einmal in der Liste (AK 18); die Zahl zählt ihn
  // mit (AK 19). Die Reihenfolge des Tages (Beginn, Anlegen, ohne Beginn
  // zuletzt) kommt aus der Datenbank (AK 16), die Eingrenzung auf die
  // eigenen Termine aus der Seite (AK 17).
  const [naechster, ...danach] = plan.kommend;
  // #330 PC 7: Der Verweis aus dem Kalender zeigt auch einen Termin im
  // Rückblick — der Abschnitt klappt dafür auf, und `key` setzt den
  // Anfangszustand neu, wenn ein anderer Termin gemeint ist.
  const imRueckblick = hervorheben !== undefined && plan.vergangen.some((t) => t.id === hervorheben);
  // Beim Einhängen (Kindeffekte laufen vor diesem): Der Rückblick ist dann schon offen.
  useEffect(() => {
    const ziel = hervorheben ? document.getElementById(hervorheben) : null;
    ziel?.scrollIntoView({ block: "center" });
    // Auch Tastatur und Vorlesehilfe landen dort: Der Fokus folgt dem Scrollen.
    ziel?.focus({ preventScroll: true });
  }, [hervorheben]);
  return (
    <>
      {!nichtsMehrOffen && (
        <section>
          <h3 className="type-title-small text-on-surface-mittel">
            Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
          </h3>
          {naechster && <NaechsterTermin t={naechster} heute={heute} ich={ich} hervorgehoben={naechster.id === hervorheben} />}
          <PlanMonate termine={danach} heute={heute} ich={ich} hervorheben={hervorheben} />
        </section>
      )}
      {plan.vergangen.length > 0 && (
        <Disclosure
          key={`${nichtsMehrOffen ? "allein" : "mit-kommendem"}-${imRueckblick ? hervorheben : ""}`}
          title="Vergangen"
          count={plan.vergangen.length}
          defaultOpen={nichtsMehrOffen || imRueckblick}
          className={cn(plan.kommend.length > 0 && "mt-6")}
        >
          <PlanMonate termine={plan.vergangen} heute={heute} ich={ich} hervorheben={hervorheben} />
        </Disclosure>
      )}
    </>
  );
}

/** Termine nach Monat und Tag: je Monat eine Überschrift mit Jahr, je Tag eine
 *  Karte mit dem Kalenderblatt links und den Terminen als Zeilen daneben. */
function PlanMonate({ termine, heute, ich, hervorheben }: { termine: TerminZeile[]; heute: string; ich: string; hervorheben?: string }) {
  return nachMonatUndTag(termine).map((m) => (
    <section key={m.monat} className="mt-4 first:mt-2">
      <h4 className="type-title-small text-on-surface">{monatsName(m.monat)}</h4>
      <ol className="mt-2 flex flex-col gap-2">
        {m.tage.map((tag) => (
          <li key={tag.datum}>
            <Card className="flex gap-2 p-2">
              <Kalenderblatt as="h5" datum={tag.datum} heute={tag.datum === heute} className={cn(tag.datum < heute && "opacity-60")} />
              <ol className="min-w-0 flex-1 divide-y divide-linie">
                {tag.termine.map((t) => (
                  <TerminReihe key={t.id} t={t} heute={heute} ich={ich} hervorgehoben={t.id === hervorheben} />
                ))}
              </ol>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  ));
}

/** Ort und Platz in einem: «Allmend · 30 × 30 m · Kunstrasen» (PO: der Platz steht hinter dem Ort). */
function ortUndPlatz(t: TerminZeile): string | null {
  return [t.ort, felderKurz(t.felder)].filter(Boolean).join(" · ") || null;
}

/* Ein Termin als knappe Zeile (#402 AK 4–11, 15–17; PO 4, 5). Die ganze
   Zeile öffnet «Termin ändern» — ihre Fläche gehört dem Knopf mit der Zeit
   (`before:`); der Trainingsname führt für sich zum Training, die
   Handgriffe rechts bleiben eigene Knöpfe (beide liegen positioniert darüber).
   Was zu lang ist, endet in «…» und steht ganz im Tooltip des Browsers (AK 9);
   alles Weitere zeigt der geöffnete Termin (AK 12). */
function TerminReihe({ t, heute, ich, hervorgehoben }: { t: TerminZeile; heute: string; ich: string; hervorgehoben: boolean }) {
  const a = useTerminAktionen();
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
  const ort = ortUndPlatz(t);
  const v = verantwortlicheMitDir(t, ich);
  const VIcon = v.selbst ? UserCheck : Users;
  return (
    <li
      id={t.id}
      aria-current={hervorgehoben ? "true" : undefined}
      tabIndex={hervorgehoben ? -1 : undefined}
      className={cn(
        "state relative flex items-start gap-2 rounded-klein px-2 py-1.5",
        hervorgehoben && "kontur border-primary outline-none",
      )}
    >
      <div className={cn("min-w-0 flex-1", (vergangen || t.ausgefallen) && "[&_.gedaempft]:opacity-60")}>
        {/* Schmal bricht um, was unter 8 rem schrumpfte, und kürzt erst auf ganzer Breite. */}
        <p className="gedaempft flex min-w-0 flex-wrap items-baseline gap-x-2 type-body-medium text-on-surface">
          <button
            type="button"
            onClick={() => a.bearbeiten(t)}
            className="focus-ring shrink-0 rounded-klein text-left before:absolute before:inset-0 before:rounded-klein before:content-['']"
          >
            <span className="sr-only">Termin ändern: </span>
            {zeit ? zeit : <span className="text-error">Zeit fehlt</span>}
          </button>
          {/* AK 8: fehlende Zeit sichtbar, ohne den Termin zu öffnen. */}
          {t.beginn && !t.ende && <span className="shrink-0 type-body-small text-error">Ende fehlt</span>}
          {ort && (
            <span className="inline-flex min-w-32 max-w-full items-center gap-1 type-body-small text-on-surface-mittel" title={ort}>
              {t.ort ? <MapPin size={14} aria-hidden className="shrink-0" /> : <LandPlot size={14} aria-hidden className="shrink-0" />}
              <span className="sr-only">Ort: </span>
              <span className="truncate">{ort}</span>
            </span>
          )}
          {t.spielerzahl !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 type-body-small text-on-surface-mittel" title={spielerzahlText(t.spielerzahl)}>
              <Shirt size={14} aria-hidden className="shrink-0" />
              <span className="sr-only">Erwartet: </span>
              {t.spielerzahl}
              <span className="sr-only"> {t.spielerzahl === 1 ? "Spieler:in" : "Spieler:innen"}</span>
            </span>
          )}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          {t.ausgefallen ? (
            <span className="flex min-w-0 max-w-full items-center gap-2">
              <Lozenge iconBefore={CalendarOff}>Ausgefallen</Lozenge>
              {/* AK 7: der Grund, gekürzt; ganz im Tooltip und am geöffneten Termin. */}
              {t.ausfallGrund && (
                <span className="truncate type-body-small text-on-surface-mittel" title={t.ausfallGrund}>
                  <span className="sr-only">Grund: </span>
                  {t.ausfallGrund}
                </span>
              )}
            </span>
          ) : t.training ? (
            <Link
              href={`/training/${t.training.id}`}
              title={t.training.name}
              className="gedaempft focus-ring relative min-w-0 truncate rounded-klein type-title-small text-on-surface hover:underline"
            >
              {t.training.name}
            </Link>
          ) : nochNichtVorbereitet(t, heute) ? (
            <Lozenge appearance="warning" iconBefore={CalendarX2}>Noch kein Training</Lozenge>
          ) : (
            <Lozenge>Ohne Training</Lozenge>
          )}
          {v.text && (
            <span className="gedaempft inline-flex min-w-32 max-w-full items-center gap-1 type-body-small text-on-surface-mittel" title={v.text}>
              <VIcon size={14} aria-hidden className="shrink-0" />
              <span className="sr-only">Verantwortlich: </span>
              <span className="truncate">{v.text}</span>
            </span>
          )}
        </div>
      </div>
      <TerminHandgriffe t={t} />
    </li>
  );
}

/** `ebene`: die Überschriftsebene der Datum-/Zeitzeile — in der Liste h4, im
 *  Detail-Dialog des Monatsüberblicks h3 (unter dessen h2), ohne Sprung.
 *  `hervorgehoben`: der Termin, auf den der Verweis aus dem Kalender-Abo zeigt
 *  (#330) — Kontur in Primary, `aria-current` und die Kennung als Sprungziel. */
export function TerminKarte({ t, heute, ebene: Kopf = "h4", hervorgehoben = false }: { t: TerminZeile; heute: string; ebene?: "h3" | "h4"; hervorgehoben?: boolean }) {
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
  const oeffnetTraining = !t.ausgefallen && t.training !== null;
  const platz = felderKurz(t.felder);
  // Die Datum-/Zeitzeile ist die Überschrift jeder Karte — auch die eines
  // Termins ohne Training hat so eine (Screenreader-Navigation per Überschrift).
  const kopf = (
    <Kopf className="flex flex-wrap items-center gap-x-2 type-body-small text-on-surface-mittel">
      <CalendarDays size={14} aria-hidden />
      {datumKurz(t.datum)}
      {zeit ? <> · {zeit} Uhr</> : null}
      {/* AK 15: fehlende Zeit sichtbar machen, ohne den Termin zu öffnen. */}
      {!t.beginn && <span className="text-error">· Zeit fehlt</span>}
      {t.beginn && !t.ende && <span className="text-error">· Ende fehlt</span>}
      {t.ort && <><MapPin size={14} aria-hidden />{t.ort}</>}
      {/* #324 AK 8: die Serie am Termin erkennbar machen. */}
      {t.serie && (
        <span className="inline-flex items-center gap-1">
          <Repeat size={14} aria-hidden />
          <span className="sr-only">Teil einer Terminserie </span>
          {wochentageText(t.serie.wochentage)}
        </span>
      )}
    </Kopf>
  );

  return (
    <li>
      <Card
        id={hervorgehoben ? t.id : undefined}
        aria-current={hervorgehoben ? "true" : undefined}
        tabIndex={hervorgehoben ? -1 : undefined}
        className={cn(
          "p-4",
          // Trägt der Termin ein Training, verhält sich die Karte wie eine
          // Trainingskachel: Sie hellt als Ganzes auf (`state`) und öffnet das
          // Training, wo sie keinen eigenen Knopf trägt — die Fläche des Links
          // reicht dafür über die ganze Karte (`before:`). Ohne Training gibt
          // es nichts zu öffnen, die Karte bleibt still.
          oeffnetTraining && "state",
          hervorgehoben && "kontur border-primary outline-none",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cn("min-w-0 flex-1", vergangen && !t.ausgefallen && "opacity-60")}>
            {/* Bei einem ausgefallenen Termin dämpft nur Kopf und Verantwortliche;
                Lozenge und Grund bleiben im vollen Kontrast (AA). */}
            <div className={cn(t.ausgefallen && "opacity-60")}>
            {kopf}
            {/* #325 AK 10, 12: wer den Termin vorbereitet und leitet, mit dem
                aktuellen Namen. Ohne Verantwortliche steht nichts (OoS 2). */}
            {t.verantwortliche.length > 0 && (
              <p className="mt-0.5 flex items-center gap-1 type-body-small text-on-surface-mittel">
                <Users size={14} aria-hidden className="shrink-0" />
                <span className="sr-only">Verantwortlich: </span>
                {verantwortlichenNamen(t.verantwortliche).join(", ")}
              </p>
            )}
            {/* #389 AK 10, #390 AK 4: knapp in einer Zeile, welche Felder und
                welche Spielerzahl erfasst sind; alle Einzelheiten am geöffneten
                Termin. Was unbekannt ist, steht nicht da. */}
            {(platz || t.spielerzahl !== null) && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 type-body-small text-on-surface-mittel">
                {platz && (
                  <span className="inline-flex items-center gap-1">
                    <LandPlot size={14} aria-hidden className="shrink-0" />
                    <span className="sr-only">Felder: </span>
                    {platz}
                  </span>
                )}
                {t.spielerzahl !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Shirt size={14} aria-hidden className="shrink-0" />
                    <span className="sr-only">Erwartet: </span>
                    {spielerzahlText(t.spielerzahl)}
                  </span>
                )}
              </p>
            )}
            </div>
            {t.ausgefallen ? (
              <div className="mt-1">
                <Lozenge iconBefore={CalendarOff}>Ausgefallen</Lozenge>
                {/* AK 7: der Grund steht darunter, wenn es einen gibt. */}
                {t.ausfallGrund && (
                  <p className="mt-1 type-body-small text-on-surface-mittel">
                    <span className="sr-only">Grund: </span>
                    {t.ausfallGrund}
                  </p>
                )}
              </div>
            ) : t.training ? (
              <Link
                href={`/training/${t.training.id}`}
                className="focus-ring mt-1 block rounded-flaeche before:absolute before:inset-0 before:rounded-flaeche before:content-['']"
              >
                <span className="block type-title-medium text-on-surface">{t.training.name}</span>
                <div className="mt-1 flex flex-wrap gap-1">{t.training.stufen.map((k) => <KategorieLozenge key={k} k={k} />)}</div>
              </Link>
            ) : (
              <div className="mt-1">
                {nochNichtVorbereitet(t, heute) ? (
                  <Lozenge appearance="warning" iconBefore={CalendarX2}>Noch kein Training</Lozenge>
                ) : (
                  <Lozenge>Ohne Training</Lozenge>
                )}
              </div>
            )}
            {t.bemerkung && <p className="mt-1 type-body-small text-on-surface-mittel">{t.bemerkung}</p>}
          </div>
          {/* Über der Link-Fläche, damit die Knöpfe für sich bedienbar bleiben. */}
          <TerminHandgriffe t={t} />
        </div>
      </Card>
    </li>
  );
}
