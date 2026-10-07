"use client";

import Link from "next/link";
import { CalendarOff, CalendarPlus, PlayCircle, Repeat, TriangleAlert } from "lucide-react";
import { BlattLozenge, Button, ButtonLink, Eigenschaft, EigenschaftFehlt, Lozenge, MARKEN_TEXT, OverflowMenu } from "@/components/ui";
import { cn } from "@/lib/cn";
import { tagOhneJahr } from "@/lib/monat";
import { plusTage, wochentageText } from "@/lib/serie";
import { spielerzahlText, zeitText } from "@/lib/termin";
import { feldName, feldText } from "@/lib/termin-felder";
import { datumKurz } from "@/lib/zeit";
import { verantwortlicheMitDir, type TerminZeile } from "@/lib/queries/termine-fuer";
import { useTerminAktionen } from "./TerminBereich";
import { terminMenue } from "./TerminHandgriffe";

/* Der nächste Termin zuoberst im Trainingsplan (#403): grösser als die
   Zeilen darunter und auf einer höheren Fläche, damit man ihn am
   Spielfeldrand nicht suchen muss. Zuerst steht, was man auf dem Handy ohne
   Scrollen sehen soll — Tag, Zeit, Training (AK 2) —, gleich darunter die
   Handgriffe, die man dort braucht: Durchführen und Öffnen (AK 10, 11). Alle
   übrigen liegen im Menü (AK 15). Fehlt das Training noch, soll das auffallen
   (PO 2026-10-07): Wo sonst sein Name steht, steht eine Lozenge in der Gelb
   der Kalenderblätter (`BlattLozenge`), und an
   Stelle der beiden Knöpfe einer: «Training hinzufügen», gleich wie «Training
   öffnen» (AK 13). Der nächste Termin steht nie in der Vergangenheit; ohne
   Training ist er darum immer «noch nicht vorbereitet».

   Darunter alle Angaben ungekürzt (AK 3, 5): Ort, Verantwortliche, erwartete
   Spielerzahl und Felder ausführlich, Bemerkung und die Wochentage der Serie.
   Fehlen Spielerzahl oder Felder, steht «Nicht erfasst» da (AK 6); Ort,
   Verantwortliche, Bemerkung und Serie erscheinen nur, wenn es sie gibt.
   Das Jahr steht nie da (OoS 4), Alterskategorien auch nicht (OoS 2).

   `hervorgehoben`: Der Verweis aus dem Kalender-Abo zielt auf ihn (PC 4) —
   Kontur in Primary, `aria-current` und Sprungziel wie an jeder Zeile. */
export function NaechsterTermin({
  t,
  heute,
  ich,
  hervorgehoben,
}: {
  t: TerminZeile;
  heute: string;
  ich: string;
  hervorgehoben: boolean;
}) {
  const a = useTerminAktionen();
  const zeit = zeitText(t.beginn, t.ende);
  // AK 8: Heute oder Morgen zusätzlich zum Wochentag und Datum.
  const relativ = t.datum === heute ? "Heute" : t.datum === plusTage(heute, 1) ? "Morgen" : null;
  const v = verantwortlicheMitDir(t, ich);
  return (
    <div
      id={t.id}
      data-datum={t.datum}
      aria-current={hervorgehoben ? "true" : undefined}
      tabIndex={-1}
      className={cn(
        // Eine Stufe höher als die Karten der Tage darunter: abgehoben (AK 1).
        "relative mt-2 rounded-flaeche bg-elev-04 p-4 outline-none focus:border-primary",
        hervorgehoben ? "kontur border-primary" : "kontur border-kante",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="type-title-small text-primary">
            <span className="sr-only">Nächster Termin: </span>
            {relativ && <>{relativ} · </>}
            {tagOhneJahr(t.datum)}
          </h4>
          <p className="mt-1 type-headline-small text-on-surface">{zeit} Uhr</p>
        </div>
        <OverflowMenu
          label={`Weitere Aktionen zum Termin ${datumKurz(t.datum)}`}
          items={[
            ...(!t.ausgefallen && t.training
              ? [{ label: "Training ersetzen", icon: CalendarPlus, onSelect: () => a.zuordnen(t) }]
              : []),
            ...terminMenue(t, a),
          ]}
        />
      </div>

      <div className="mt-2">
        {t.ausgefallen ? (
          <>
            <Lozenge iconBefore={CalendarOff}>Ausgefallen</Lozenge>
            {/* AK 14: der Grund vollständig. */}
            {t.ausfallGrund && (
              <p className="mt-1 whitespace-pre-line type-body-medium text-on-surface">
                <span className="sr-only">Grund: </span>
                {t.ausfallGrund}
              </p>
            )}
            {/* Ein Training ruht am ausgefallenen Termin (PO 2026-10-06). */}
            {t.training && (
              <Link href={`/training/${t.training.id}`} className="focus-ring mt-1 inline-block rounded-klein type-body-medium text-on-surface-mittel hover:underline">
                <span className="sr-only">Training: </span>
                {t.training.name}
              </Link>
            )}
          </>
        ) : t.training ? (
          <Link href={`/training/${t.training.id}`} className="focus-ring rounded-klein type-title-large text-on-surface hover:underline">
            {t.training.name}
          </Link>
        ) : (
          <BlattLozenge zustand="noch-nicht" iconBefore={TriangleAlert}>{MARKEN_TEXT["noch-nicht"]}</BlattLozenge>
        )}
      </div>

      {!t.ausgefallen && (
        <div className="mt-3 flex flex-wrap gap-2">
          {t.training ? (
            <>
              <ButtonLink href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`}>
                <PlayCircle size={18} aria-hidden />
                Durchführen
              </ButtonLink>
              <ButtonLink variant="outlined" href={`/training/${t.training.id}`}>Training öffnen</ButtonLink>
            </>
          ) : (
            <Button variant="outlined" aria-haspopup="dialog" onClick={() => a.zuordnen(t)}>Training hinzufügen</Button>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[8rem_minmax(0,1fr)] gap-y-2 border-t border-linie pt-3">
        {t.ort && <Eigenschaft label="Ort">{t.ort}</Eigenschaft>}
        {/* AK 4: wer man selbst ist, steht zuerst und mit «(du)». */}
        {v.text && <Eigenschaft label="Verantwortlich">{v.text}</Eigenschaft>}
        {t.spielerzahl !== null ? (
          <Eigenschaft label="Erwartet">{spielerzahlText(t.spielerzahl)}</Eigenschaft>
        ) : (
          <EigenschaftFehlt label="Erwartet" />
        )}
        {/* AK 5–7: jedes Feld mit Grösse, Toren je Torart und Untergrund;
            «keine» Tore und unbekannte unterscheiden sich (`feldText`). */}
        {t.felder && t.felder.length > 0 ? (
          t.felder.map((f, i, alle) => (
            <Eigenschaft key={i} label={feldName(i, alle.length)}>{feldText(f)}</Eigenschaft>
          ))
        ) : (
          <EigenschaftFehlt label="Felder" />
        )}
        {t.bemerkung && <Eigenschaft label="Bemerkung"><span className="whitespace-pre-line">{t.bemerkung}</span></Eigenschaft>}
        {t.serie && (
          <Eigenschaft label="Terminserie">
            <span className="inline-flex items-center gap-1">
              <Repeat size={14} aria-hidden />
              {wochentageText(t.serie.wochentage)}
            </span>
          </Eigenschaft>
        )}
      </dl>
    </div>
  );
}
