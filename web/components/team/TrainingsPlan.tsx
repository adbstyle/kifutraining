"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, CalendarDays, CalendarPlus, MapPin, PlayCircle, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  Dialog,
  Disclosure,
  IconButton,
  IconButtonLink,
  KategorieChip,
  OverflowMenu,
  Snackbar,
  Tooltip,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { TerminDialog } from "./TerminDialog";
import {
  aktualisiereTermin,
  entferneTermin,
  setzeErneutAn,
  type TerminFelder,
} from "@/lib/actions/termine";
import { datumKurz } from "@/lib/zeit";
import type { Plan, TerminZeile } from "@/lib/queries/termine";

/* Der Team-Trainingsplan (Team-Epic Stories 7–9, gegliedert mit Story 18).
   Zuoberst, was ansteht — danach der Rückblick, zugeklappt, weil er über die
   Jahre auf mehrere hundert Einheiten anwächst. Je Eintrag: ansehen,
   durchführen (mit Termin-Kontext), ändern, erneut ansetzen, entfernen.

   Geteilt wird auf dem Server (siehe `teilePlan`), nicht hier: Der Schnitt
   hängt am heutigen Tag, und würde ihn der Browser selbst bestimmen, fiele er
   nachts anders aus als beim Vorrendern. */
export function TrainingsPlan({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aendern, setAendern] = useState<TerminZeile | null>(null);
  const [erneut, setErneut] = useState<TerminZeile | null>(null);
  const [loeschen, setLoeschen] = useState<TerminZeile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const nichtsMehrOffen = plan.kommend.length === 0;

  function speichereAenderung(felder: TerminFelder) {
    if (!aendern) return;
    startTransition(async () => {
      const res = await aktualisiereTermin(aendern.id, felder);
      setAendern(null);
      router.refresh();
      setNotice(res.ok ? "Termin geändert." : (res.error ?? "Fehlgeschlagen."));
    });
  }

  function speichereErneut(felder: TerminFelder) {
    if (!erneut) return;
    startTransition(async () => {
      const res = await setzeErneutAn(erneut.training.id, felder);
      setErneut(null);
      router.refresh();
      setNotice(
        res.ok
          ? "Als eigenständige Kopie erneut angesetzt."
          : res.error,
      );
    });
  }

  function loeschenAusfuehren(t: TerminZeile) {
    startTransition(async () => {
      const res = await entferneTermin(t.id);
      setLoeschen(null);
      router.refresh();
      setNotice(
        res.ok
          ? "Termin entfernt. Das Training bleibt unter „Trainings“."
          : (res.error ?? "Fehlgeschlagen."),
      );
    });
  }

  /* Eine Karte des Plans. Als Funktion und nicht als eigene Komponente, damit
     die Dialoge samt ihrem Zustand einmal für beide Abschnitte bestehen. */
  function karte(t: TerminZeile, vergangen: boolean) {
    return (
      <li key={t.id}>
        <Card className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* Der ganze Textblock führt zum Training, nicht nur der
                Titel: auf dem Platz mit dem Daumen ist eine Textzeile ein
                knappes Ziel. Der Block enthält bewusst nichts
                Interaktives — die Aktionen stehen daneben, damit kein
                Fehlgriff etwas auslöst.

                Bewusst ohne eigenes aria-label: Ein knapper Name wie
                „X ansehen" klänge in einer Liste neunmal gleich, weil
                viele Einheiten denselben Trainingsnamen tragen. Vorgelesen
                wird stattdessen der Inhalt selbst — Datum, Ort, Name und
                Bemerkung unterscheiden die Einträge zuverlässig.

                Gedämpft wird dieser Block, NICHT die Karte: `opacity` auf
                der Karte öffnete einen Stacking Context und sperrte das
                ⋮-Menü darin ein — die nächste Karte legte sich darüber.
                Die Aktionen bleiben ausserdem voll lesbar; vergangen
                heisst nicht unbedienbar.

                Die Dämpfung bleibt trotz der Abschnitte: Wer weit unten im
                Rückblick scrollt, hat dessen Kopf längst nicht mehr im
                Blick und erkennt am gedämpften Eintrag trotzdem, wo er
                gerade ist. */}
            <Link
              href={`/training/${t.training.id}`}
              className={cn(
                "focus-ring group block min-w-0 flex-1 rounded-flaeche",
                vergangen && "opacity-60",
              )}
            >
              <p className="type-title-small inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={16} strokeWidth={2} aria-hidden />
                  {datumKurz(t.datum)}
                  {t.beginn && <> · {t.beginn} Uhr</>}
                </span>
                {t.ort && (
                  <span className="inline-flex items-center gap-1.5 type-body-small text-on-surface-mittel">
                    <MapPin size={14} strokeWidth={2} aria-hidden />
                    {t.ort}
                  </span>
                )}
              </p>

              <h4 className="mt-1 type-title-medium text-on-surface transition-colors group-hover:text-primary">
                {t.training.name}
              </h4>

              <div className="mt-1 flex flex-wrap items-center gap-2">
                {t.training.stufen.map((k) => (
                  <KategorieChip key={k} k={k} />
                ))}
              </div>

              {t.bemerkung && (
                <p className="mt-2 type-body-small text-on-surface-mittel">
                  {t.bemerkung}
                </p>
              )}
            </Link>

            {/* Icon-only wie auf der Übungsseite: die ausgeschriebenen
                Beschriftungen (mono, gesperrt, versal) beanspruchten mehr
                Breite als die Karte hat — der Titel blieb auf einen
                Reststreifen gedrängt. Der Tooltip nennt die Aktion, das
                aria-label zusätzlich das Training: in einer Liste hört
                man sonst sechsmal „Termin ändern" ohne Unterschied.
                Entfernen liegt im ⋮-Menü, nicht offen. */}
            <div className="flex shrink-0 items-center gap-0.5">
              <Tooltip label="Durchführen">
                <IconButtonLink
                  href={`/training/${t.training.id}/durchfuehren?termin=${t.id}`}
                  icon={PlayCircle}
                  label={`${t.training.name} durchführen`}
                  size="sm"
                />
              </Tooltip>
              {/* Uhr statt Zahnrad: Beim Ändern geht es um Datum und
                  Zeit, und die runde Uhr bleibt bei 20 Pixel gegen das
                  eckige Kalender-Plus daneben unterscheidbar — ein
                  Zahnrad zerfällt in dieser Grösse zum Fleck. */}
              <Tooltip label="Termin ändern">
                <IconButton
                  icon={CalendarClock}
                  label={`Termin von ${t.training.name} ändern`}
                  size="sm"
                  onClick={() => setAendern(t)}
                />
              </Tooltip>
              <Tooltip label="Erneut ansetzen">
                <IconButton
                  icon={CalendarPlus}
                  label={`${t.training.name} erneut ansetzen`}
                  size="sm"
                  onClick={() => setErneut(t)}
                />
              </Tooltip>
              <OverflowMenu
                label={`Weitere Aktionen zu ${t.training.name}`}
                items={[
                  {
                    label: "Termin entfernen",
                    icon: Trash2,
                    danger: true,
                    onSelect: () => setLoeschen(t),
                  },
                ]}
              />
            </div>
          </div>
        </Card>
      </li>
    );
  }

  return (
    <>
      {plan.kommend.length > 0 && (
        <section>
          <h3 className="type-title-small flex items-baseline gap-2 py-2 text-on-surface">
            Als Nächstes
            <span className="type-label-small text-on-surface-mittel">
              {plan.kommend.length}
            </span>
          </h3>
          <ol className="mt-2 flex flex-col gap-3">
            {plan.kommend.map((t) => karte(t, false))}
          </ol>
        </section>
      )}

      {plan.vergangen.length > 0 && (
        /* Steht nichts mehr an, ist der Rückblick das Einzige, was der Plan
           noch zu zeigen hat — dann beginnt er offen, sonst sähe man in der
           Sommerpause bloss eine zugeklappte Zeile. Das `key` hängt an genau
           dieser Bedingung: Fällt der letzte kommende Termin weg, hängt der
           Abschnitt neu ein und öffnet sich, statt am alten Zustand zu
           kleben. */
        <Disclosure
          key={nichtsMehrOffen ? "allein" : "mit-kommendem"}
          title="Vergangen"
          count={plan.vergangen.length}
          defaultOpen={nichtsMehrOffen}
          className={cn(plan.kommend.length > 0 && "mt-6")}
        >
          <ol className="flex flex-col gap-3">
            {plan.vergangen.map((t) => karte(t, true))}
          </ol>
        </Disclosure>
      )}

      <TerminDialog
        open={aendern != null}
        titel="Termin ändern"
        bestaetigung="Speichern"
        pending={pending}
        start={
          aendern
            ? {
                datum: aendern.datum,
                beginn: aendern.beginn ?? "",
                ort: aendern.ort ?? "",
                bemerkung: aendern.bemerkung ?? "",
              }
            : undefined
        }
        onClose={() => setAendern(null)}
        onSpeichern={speichereAenderung}
      />

      {/* Erneut ansetzen: Beginn, Ort und Bemerkung sind vorbelegt, das Datum
          bewusst leer — es ist die eine Angabe, die sich immer ändert. */}
      <TerminDialog
        open={erneut != null}
        titel="Erneut ansetzen"
        bestaetigung="Ansetzen"
        hinweis="Es entsteht eine eigenständige Kopie des Trainings für den neuen Termin. Der bisherige Termin bleibt mit seinem Stand bestehen."
        pending={pending}
        start={
          erneut
            ? {
                datum: "",
                beginn: erneut.beginn ?? "",
                ort: erneut.ort ?? "",
                bemerkung: erneut.bemerkung ?? "",
              }
            : undefined
        }
        onClose={() => setErneut(null)}
        onSpeichern={speichereErneut}
      />

      <Dialog
        open={loeschen != null}
        onClose={() => setLoeschen(null)}
        title="Termin entfernen?"
        actions={
          <>
            <Button variant="text" onClick={() => setLoeschen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => loeschen && loeschenAusfuehren(loeschen)}
              disabled={pending}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          Der Termin verschwindet aus dem Plan.{" "}
          <strong className="text-on-surface">{loeschen?.training.name}</strong>{" "}
          bleibt unter „Trainings“ und lässt sich jederzeit neu ansetzen.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
