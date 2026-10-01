"use client";

import Link from "next/link";
import { CalendarDays, CalendarOff, CalendarPlus, CalendarX2, MapPin, MessageSquareText, Pencil, PlayCircle, Repeat, Trash2, Undo2, Unlink, Users } from "lucide-react";
import { Badge, Card, Disclosure, IconButton, IconButtonLink, KategorieChip, OverflowMenu, Tooltip } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useTerminAktionen } from "./TerminBereich";
import { wochentageText } from "@/lib/serie";
import { zeitText } from "@/lib/termin";
import { datumKurz } from "@/lib/zeit";
// Werte aus termine-fuer.ts, nicht aus termine.ts: Jenes zieht den Cookie-Client
// (next/headers) ins Client-Bundle.
import { nochNichtVorbereitet, verantwortlichenNamen, type Plan, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Der Kalender eines Teams als Liste (Team-Kalender #322, #323; gegliedert
   mit Story 18): zuoberst, was ansteht, danach der Rückblick, zugeklappt.
   Ein Termin ohne Training ist auf einen Blick erkennbar (AK 16, 17). */
export function TrainingsPlan({ plan, heute }: { plan: Plan; heute: string }) {
  const nichtsMehrOffen = plan.kommend.length === 0;
  return (
    <>
      {!nichtsMehrOffen && (
        <section>
          <h3 className="type-title-small text-on-surface-mittel">
            Als Nächstes <span className="text-on-surface-tief">{plan.kommend.length}</span>
          </h3>
          <ol className="mt-2 flex flex-col gap-3">
            {plan.kommend.map((t) => <TerminKarte key={t.id} t={t} heute={heute} />)}
          </ol>
        </section>
      )}
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

/** `ebene`: die Überschriftsebene der Datum-/Zeitzeile — in der Liste h4, im
 *  Detail-Dialog des Monatsüberblicks h3 (unter dessen h2), ohne Sprung. */
export function TerminKarte({ t, heute, ebene: Kopf = "h4" }: { t: TerminZeile; heute: string; ebene?: "h3" | "h4" }) {
  const a = useTerminAktionen();
  const vergangen = t.datum < heute;
  const zeit = zeitText(t.beginn, t.ende);
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
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className={cn("min-w-0 flex-1", vergangen && !t.ausgefallen && "opacity-60")}>
            {/* Bei einem ausgefallenen Termin dämpft nur Kopf und Verantwortliche;
                Badge und Grund bleiben im vollen Kontrast (AA). */}
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
            </div>
            {t.ausgefallen ? (
              <div className="mt-1">
                <Badge tone="neutral"><CalendarOff size={12} strokeWidth={2.5} aria-hidden />Ausgefallen</Badge>
                {/* AK 7: der Grund steht darunter, wenn es einen gibt. */}
                {t.ausfallGrund && (
                  <p className="mt-1 type-body-small text-on-surface-mittel">
                    <span className="sr-only">Grund: </span>
                    {t.ausfallGrund}
                  </p>
                )}
              </div>
            ) : t.training ? (
              <Link href={`/training/${t.training.id}`} className="focus-ring group mt-1 block rounded-flaeche">
                <span className="block type-title-medium text-on-surface group-hover:underline">{t.training.name}</span>
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
            {!t.ausgefallen && t.training && (
              <Tooltip label="Durchführen">
                <IconButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`} icon={PlayCircle} label={`${t.training.name} durchführen`} size="sm" />
              </Tooltip>
            )}
            {!t.ausgefallen && (
              <Tooltip label={t.training ? "Training ersetzen" : "Training zuordnen"}>
                <IconButton icon={CalendarPlus} label={`Training für ${datumKurz(t.datum)} ${t.training ? "ersetzen" : "zuordnen"}`} size="sm" onClick={() => a.zuordnen(t)} />
              </Tooltip>
            )}
            <OverflowMenu
              size="sm"
              label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
              items={[
                ...(t.ausgefallen
                  ? [
                      { label: "Grund ändern", icon: MessageSquareText, onSelect: () => a.ausfallen(t) },
                      { label: "Ausfall zurücknehmen", icon: Undo2, onSelect: () => a.ausfallZuruecknehmen(t) },
                    ]
                  : []),
                { label: "Termin ändern", icon: Pencil, onSelect: () => a.bearbeiten(t) },
                ...(t.training ? [{ label: "Training lösen", icon: Unlink, onSelect: () => a.loesen(t) }] : []),
                ...(!t.ausgefallen ? [{ label: "Ausfallen lassen", icon: CalendarOff, onSelect: () => a.ausfallen(t) }] : []),
                { label: "Termin entfernen", icon: Trash2, danger: true, onSelect: () => a.entfernen(t) },
              ]}
            />
          </div>
        </div>
      </Card>
    </li>
  );
}
