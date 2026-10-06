"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarOff, LandPlot, MapPin, Shirt, UserCheck, Users } from "lucide-react";
import { Card, Disclosure, Kalenderblatt, Lozenge } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen } from "./TerminBereich";
import { OhneTraining, TerminHandgriffe } from "./TerminHandgriffe";
import { NaechsterTermin } from "./NaechsterTermin";
import { PlanMonat } from "./PlanMonat";
import { spielerzahlText, zeitText } from "@/lib/termin";
import { felderKurz } from "@/lib/termin-felder";
import { monatVon, monatsName } from "@/lib/monat";
import { nachMonatUndTag } from "@/lib/plan-gliederung";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { terminZustand, verantwortlicheMitDir, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";

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
  ich,
  hervorheben,
  belegt,
  meine,
  leer,
}: {
  plan: Plan;
  heute: string;
  ich: string;
  hervorheben?: string;
  /** Tage mit Terminen, die «Meine Termine» ausblendet (#404 AK 14). */
  belegt: readonly string[];
  meine: boolean;
  leer?: ReactNode;
}) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  // #403: Der erste anstehende Termin — auch ein ausgefallener (PO 6) — steht
  // zuoberst und nicht noch einmal in der Liste (AK 18); die Zahl zählt ihn
  // mit (AK 19). Die Reihenfolge des Tages (Beginn, Anlegen, ohne Beginn
  // zuletzt) kommt aus der Datenbank (AK 16), die Eingrenzung auf die
  // eigenen Termine aus der Seite (AK 17).
  const [naechster, ...danach] = plan.kommend;
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
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div ref={liste} className="min-w-0">
        {alle.length === 0 && leer}
        {naechster && (
          <section>
            <h3 className="type-title-small text-on-surface-mittel">
              Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
            </h3>
            <NaechsterTermin t={naechster} heute={heute} ich={ich} hervorgehoben={naechster.id === hervorheben} />
            <PlanMonate termine={danach} heute={heute} ich={ich} hervorheben={hervorheben} />
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
            <PlanMonate termine={plan.vergangen} heute={heute} ich={ich} hervorheben={hervorheben} />
          </Disclosure>
        )}
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
   Zeile öffnet «Termin ändern»: Ihre Fläche ist ein Knopf, über dem der
   Inhalt liegt, ohne Klicks abzufangen (`pointer-events-none`). Nur der
   Trainingsname, der zum Training führt, und die Handgriffe rechts nehmen
   Klicks selbst an. Was zu lang ist, endet in «…»; die ganze Zeile steht im
   Tooltip des Knopfes (AK 9), alles Weitere am geöffneten Termin (AK 12). */
function TerminReihe({ t, heute, ich, hervorgehoben }: { t: TerminZeile; heute: string; ich: string; hervorgehoben: boolean }) {
  const a = useTerminAktionen();
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
  const ort = ortUndPlatz(t);
  const v = verantwortlicheMitDir(t, ich);
  const VIcon = v.selbst ? UserCheck : Users;
  const zustand = terminZustand(t, heute);
  const ganz = [
    [zeit ?? "Zeit fehlt", ort, t.spielerzahl !== null && spielerzahlText(t.spielerzahl)].filter(Boolean).join(" · "),
    zustand === "ausgefallen" ? ["Ausgefallen", t.ausfallGrund].filter(Boolean).join(": ") : t.training?.name,
    v.text && `Verantwortlich: ${v.text}`,
  ].filter(Boolean).join("\n");
  return (
    <li
      id={t.id}
      data-datum={t.datum}
      aria-current={hervorgehoben ? "true" : undefined}
      // Sprungziel aus dem Kalender-Abo und dem Monat; die Kontur zeigt, wo man landet.
      tabIndex={-1}
      className={cn(
        "state relative flex items-start gap-2 rounded-klein px-2 py-1.5 outline-none focus:kontur focus:border-primary",
        hervorgehoben && "kontur border-primary",
      )}
    >
      <button type="button" onClick={() => a.bearbeiten(t)} title={ganz} className="focus-ring absolute inset-0 rounded-klein">
        <span className="sr-only">Termin ändern: {zeit ?? "Zeit fehlt"}</span>
      </button>
      <div className={cn("pointer-events-none relative min-w-0 flex-1", (vergangen || t.ausgefallen) && "[&_.gedaempft]:opacity-60")}>
        {/* Schmal bricht um, was unter 8 rem schrumpfte, und kürzt erst auf ganzer Breite. */}
        <p aria-hidden className="gedaempft flex min-w-0 flex-wrap items-baseline gap-x-2 type-body-medium text-on-surface">
          <span className="shrink-0">{zeit ? zeit : <span className="text-error">Zeit fehlt</span>}</span>
          {/* AK 8: fehlende Zeit sichtbar, ohne den Termin zu öffnen. */}
          {t.beginn && !t.ende && <span className="shrink-0 type-body-small text-error">Ende fehlt</span>}
          {ort && (
            <span className="inline-flex min-w-32 max-w-full items-center gap-1 type-body-small text-on-surface-mittel">
              {t.ort ? <MapPin size={14} className="shrink-0" /> : <LandPlot size={14} className="shrink-0" />}
              <span className="truncate">{ort}</span>
            </span>
          )}
          {t.spielerzahl !== null && (
            <span className="inline-flex shrink-0 items-center gap-1 type-body-small text-on-surface-mittel">
              <Shirt size={14} className="shrink-0" />
              {t.spielerzahl}
            </span>
          )}
        </p>
        {/* Vorlesehilfen hören die erste Zeile ausgeschrieben. */}
        <p className="sr-only">
          {[t.beginn && !t.ende && "Ende fehlt", ort && `Ort: ${ort}`, t.spielerzahl !== null && `Erwartet: ${spielerzahlText(t.spielerzahl)}`].filter(Boolean).join(", ")}
        </p>
        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          {zustand === "ausgefallen" ? (
            <span className="flex min-w-0 max-w-full items-center gap-2">
              <Lozenge iconBefore={CalendarOff}>Ausgefallen</Lozenge>
              {/* AK 7: der Grund, gekürzt; ganz im Tooltip und am geöffneten Termin. */}
              {t.ausfallGrund && (
                <span className="truncate type-body-small text-on-surface-mittel">
                  <span className="sr-only">Grund: </span>
                  {t.ausfallGrund}
                </span>
              )}
            </span>
          ) : zustand === "training" ? (
            <Link
              href={`/training/${t.training!.id}`}
              title={t.training!.name}
              className="gedaempft focus-ring pointer-events-auto min-w-0 truncate rounded-klein type-title-small text-on-surface hover:underline"
            >
              {t.training!.name}
            </Link>
          ) : (
            <OhneTraining zustand={zustand} />
          )}
          {v.text && (
            <span className="gedaempft inline-flex min-w-32 max-w-full items-center gap-1 type-body-small text-on-surface-mittel">
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
