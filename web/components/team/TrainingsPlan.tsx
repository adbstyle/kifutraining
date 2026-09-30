"use client";

import Link from "next/link";
import { CalendarDays, CalendarPlus, CalendarX2, MapPin, Pencil, PlayCircle, Trash2, Unlink } from "lucide-react";
import { Badge, Card, Disclosure, IconButton, IconButtonLink, KategorieChip, OverflowMenu, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen } from "./TerminBereich";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Der Kalender eines Teams als Liste (Team-Kalender #322, #323; gegliedert
   mit Story 18): zuoberst, was ansteht, danach der Rückblick, zugeklappt.
   Ein Termin ohne Training ist auf einen Blick erkennbar (AK 16, 17). */
export function TrainingsPlan({ plan, heute }: { plan: Plan; heute: string }) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  return (
    <>
      <section>
        <h3 className="type-title-small text-on-surface-mittel">
          Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
        </h3>
        <ol className="mt-2 flex flex-col gap-3">
          {plan.kommend.map((t) => <TerminKarte key={t.id} t={t} heute={heute} />)}
        </ol>
      </section>
      {plan.vergangen.length > 0 && (
        <Disclosure
          key={nichtsMehrOffen ? "allein" : "mit-kommendem"}
          title="Vergangen"
          count={plan.vergangen.length}
          defaultOpen={nichtsMehrOffen}
          className={cn(plan.kommend.length > 0 && "mt-6")}
        >
          <ol className="mt-2 flex flex-col gap-3">
            {plan.vergangen.map((t) => <TerminKarte key={t.id} t={t} heute={heute} />)}
          </ol>
        </Disclosure>
      )}
    </>
  );
}

export function TerminKarte({ t, heute }: { t: TerminZeile; heute: string }) {
  const a = useTerminAktionen();
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
  const kopf = (
    <p className="flex flex-wrap items-center gap-x-2 type-body-small text-on-surface-mittel">
      <CalendarDays size={14} aria-hidden />
      {datumKurz(t.datum)}
      {zeit ? <> · {zeit} Uhr</> : null}
      {/* AK 15: fehlende Zeit sichtbar machen, ohne den Termin zu öffnen. */}
      {!t.beginn && <span className="text-error">· Zeit fehlt</span>}
      {t.beginn && !t.ende && <span className="text-error">· Ende fehlt</span>}
      {t.ort && <><MapPin size={14} aria-hidden />{t.ort}</>}
    </p>
  );

  return (
    <li>
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cn("min-w-0 flex-1", vergangen && "opacity-60")}>
            {kopf}
            {t.training ? (
              <Link href={`/training/${t.training.id}`} className="focus-ring group mt-1 block rounded-flaeche">
                <h4 className="type-title-medium text-on-surface group-hover:underline">{t.training.name}</h4>
                <div className="mt-1 flex flex-wrap gap-1">{t.training.stufen.map((k) => <KategorieChip key={k} k={k} />)}</div>
              </Link>
            ) : (
              <div className="mt-1">
                {nochNichtVorbereitet(t, heute) ? (
                  <Badge tone="befund"><CalendarX2 size={12} strokeWidth={2.5} aria-hidden />Noch kein Training</Badge>
                ) : (
                  <Badge tone="neutral">Ohne Training</Badge>
                )}
              </div>
            )}
            {t.bemerkung && <p className="mt-1 type-body-small text-on-surface-mittel">{t.bemerkung}</p>}
          </div>
          <div className="flex shrink-0 gap-0.5">
            {t.training && (
              <Tooltip label="Durchführen">
                <IconButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`} icon={PlayCircle} label={`${t.training.name} durchführen`} />
              </Tooltip>
            )}
            <Tooltip label={t.training ? "Training ersetzen" : "Training zuordnen"}>
              <IconButton icon={CalendarPlus} label={`Training für ${datumKurz(t.datum)} ${t.training ? "ersetzen" : "zuordnen"}`} onClick={() => a.zuordnen(t)} />
            </Tooltip>
            <OverflowMenu
              label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
              items={[
                { label: "Termin ändern", icon: Pencil, onSelect: () => a.bearbeiten(t) },
                ...(t.training ? [{ label: "Training lösen", icon: Unlink, onSelect: () => a.loesen(t) }] : []),
                { label: "Termin entfernen", icon: Trash2, danger: true, onSelect: () => a.entfernen(t) },
              ]}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}
