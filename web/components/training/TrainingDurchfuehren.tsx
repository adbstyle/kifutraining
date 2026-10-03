"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react";
import { TrainingExerciseDetail } from "./TrainingExerciseDetail";
import { VariantenWahl } from "./VariantenWahl";
import { GesamtMaterialListe } from "./GesamtMaterialListe";
import { Button, nebenLeiste, unterKopfzeile, type BreadcrumbItem } from "@/components/ui";
import { cn } from "@/lib/cn";
import { SeitenKopf } from "@/components/layout/SeitenKopf";
import { leseGliederung, formatDuration } from "@/lib/training";
import { datumKurz } from "@/lib/zeit";
import { zeitText } from "@/lib/termin";
import {
  VARIANTE_PARAM,
  abschnittMitVariante,
  sichtbareZuordnungen,
  varianteAus,
} from "@/lib/varianten";
import type { TrainingDetail } from "@/lib/queries/trainings";

type TerminKontext = {
  datum: string;
  beginn: string | null;
  ende: string | null;
  ort: string | null;
  bemerkung: string | null;
  /** Die Namen der Verantwortlichen (#325 AK 10); leer: niemand eingetragen. */
  verantwortliche: string[];
};

/** Datum, Beginn und Ende, Ort, Verantwortliche und Bemerkung der Einheit —
 *  der Kontext für alle, die gerade am Platz stehen (Story 7 AK 19, #325 AK 10). */
function TerminKopf({ termin, className }: { termin: TerminKontext; className?: string }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-flaeche border border-linie bg-elev-01 px-3 py-2 type-label-medium text-on-surface-mittel ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-on-surface">
        <CalendarDays size={15} strokeWidth={2} aria-hidden />
        {datumKurz(termin.datum)}
        {zeitText(termin.beginn, termin.ende) && <> · {zeitText(termin.beginn, termin.ende)} Uhr</>}
      </span>
      {/* Ein übernommener Termin kann ohne Beginn sein (#322 PO 9) — das
          steht am Platz im Weg, darum sagt der Kopf es. */}
      {!termin.beginn && <span className="text-error">· Zeit fehlt</span>}
      {termin.ort && (
        <span className="inline-flex items-center gap-1.5">
          <MapPin size={14} strokeWidth={2} aria-hidden />
          {termin.ort}
        </span>
      )}
      {termin.verantwortliche.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} strokeWidth={2} aria-hidden />
          <span className="sr-only">Verantwortlich: </span>
          {termin.verantwortliche.join(", ")}
        </span>
      )}
      {termin.bemerkung && (
        <span className="type-body-small basis-full">{termin.bemerkung}</span>
      )}
    </div>
  );
}

/** Die Gliederung, wie sie in einer Variante gilt: ihre Hauptteil-Übungen plus
 *  alles ausserhalb des Hauptteils, das für alle Varianten gemeinsam gilt
 *  (#203 PC 1). Steht ausserhalb der Komponente, weil der Wechsel sie für die
 *  NEUE Variante braucht, bevor gerendert wird. */
function gliederungFuer(training: TrainingDetail, varianteId: string | undefined) {
  return leseGliederung(
    training.altersstufe,
    sichtbareZuordnungen(training.exercises, varianteId),
  );
}

/* Mobile Durchführungsansicht (Story #17): Trainingsteil für Trainingsteil
   (nur belegte), grosse Bedienflächen, Bildschirm-Wachhalten (Best-Effort).
   Lesend — keine Mutationen. */
export function TrainingDurchfuehren({
  training,
  /** Termin-Kontext, wenn aus dem Team-Trainingsplan geöffnet (Story 7 AK 19):
   *  Wer am Platz steht, sieht so Datum, Beginn, Ort und Bemerkung dieser
   *  Einheit — sonst müsste er dafür zurück in den Plan. */
  termin,
  /** Der Rückweg — beim Team-Training ins Team, sonst in die
   *  Trainingsübersicht (#156 AK 8). */
  crumbs,
  /** Die Variante des Hauptteils aus der Adresse (#203 AK 1). Die Seite liest
   *  sie und gibt sie herein, statt dass diese Ansicht `useSearchParams`
   *  befragt — dasselbe Muster wie im Editor. */
  varianteParam,
}: {
  training: TrainingDetail;
  termin?: TerminKontext;
  crumbs: BreadcrumbItem[];
  varianteParam?: string;
}) {
  // Die angezeigte Variante: die aus der Adresse, sonst die erste (#203 AK 1).
  // Gemerkt wird nichts — wer die Seite neu öffnet, beginnt wieder vorn.
  const [aktiveVariante, setAktiveVariante] = useState<string | undefined>(
    () => varianteAus(varianteParam, training.varianten)?.id,
  );
  const aktive =
    training.varianten.find((v) => v.id === aktiveVariante) ?? training.varianten[0];

  const sections = gliederungFuer(training, aktive?.id);
  const [idx, setIdx] = useState(0);

  /** Zur anderen Variante wechseln (#203 AK 2).
   *
   *  Der Schritt bleibt stehen, wo er kann: Wer im Ausklang steht und die
   *  Variante wechselt, will nicht wieder beim Auffangen anfangen. Hat die
   *  neue Variante weniger Abschnitte (ein leerer Hauptteil etwa), rückt er
   *  auf den letzten vorhandenen — sonst zeigte die Ansicht ins Leere.
   *
   *  Die Adresse zieht per `history.replaceState` mit, ohne Navigation: Alle
   *  Varianten stehen bereits im Speicher, ein Serveraufruf würde bloss die
   *  Seite neu bauen. So bleibt der Wechsel auch nach dem Neuladen erhalten —
   *  und `?termin=` bleibt unangetastet, weil die bestehende Adresse nur
   *  ergänzt wird (#156 AK 19). */
  function wechsleVariante(varianteId: string) {
    const neu = gliederungFuer(training, varianteId);
    setIdx((i) => Math.max(0, Math.min(i, neu.length - 1)));
    setAktiveVariante(varianteId);
    const url = new URL(window.location.href);
    url.searchParams.set(VARIANTE_PARAM, varianteId);
    window.history.replaceState(null, "", url);
  }

  // Bildschirm wachhalten, solange die Ansicht aktiv und sichtbar ist
  // (Best-Effort, AC7). Ohne Browser-Unterstützung still no-op.
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLock> };
    };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await nav.wakeLock!.request("screen");
      } catch {
        /* z. B. nicht im Vordergrund — ignorieren */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const total = sections.reduce((a, s) => a + s.sum, 0);

  if (sections.length === 0) {
    return (
      <main className="max-w-2xl px-4 py-16 sm:px-6 lg:pt-0">
        {/* Läuft nicht mit: Die Blöcke unten kleben selbst oben (#350). */}
        <SeitenKopf krumen={crumbs} mitlaufend={false} className="mb-6" />
        <h1 className="type-headline-small text-center text-on-surface">
          {training.name}
        </h1>
        {/* Auch ohne Übungen: wer aus dem Plan kommt, soll Datum und Ort sehen. */}
        {termin && <TerminKopf termin={termin} className="mt-4 justify-center" />}
        {/* Die Wahl steht auch hier — eine leere Variante darf keine Sackgasse
            sein, sonst käme der Trainer nur über die Adresszeile zurück
            (#203 AK 2). */}
        <VariantenWahl
          varianten={training.varianten}
          aktiv={aktive?.id}
          onWechsel={wechsleVariante}
          className="mt-4 justify-center"
        />
        <p className="mt-3 text-center type-body-medium text-on-surface-mittel">
          {training.varianten.length > 1
            ? `In der Variante „${aktive?.name}" ist noch keine Übung eingeordnet.`
            : "Diesem Training sind noch keine Übungen zugeordnet."}
        </p>
      </main>
    );
  }

  const section = sections[idx];

  return (
    <div className="max-w-2xl px-4 pb-20 pt-4 sm:px-6 lg:pt-0">
      <header className="mb-4">
        {/* Der Rückweg steht zuoberst — wie auf jeder anderen Trainingsseite.
            Im Druck hat er nichts verloren (OOS 2). */}
        <SeitenKopf krumen={crumbs} mitlaufend={false} className="mb-3" />
        {termin && <TerminKopf termin={termin} className="mb-3" />}
        <p className="type-label-medium text-on-surface-mittel">{training.name}</p>
        {/* Unter dem Trainingsnamen und über dem Abschnitt: Die Variante gilt
            für das ganze Training, nicht für den gerade offenen Teil — und sie
            bleibt beim Blättern an derselben Stelle stehen (#203 AK 2). */}
        <VariantenWahl
          varianten={training.varianten}
          aktiv={aktive?.id}
          onWechsel={wechsleVariante}
          className="mt-2"
        />
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <h1 className="type-headline-medium text-on-surface">
            {/* Welche Variante gerade läuft, muss am Hauptteil selbst stehen —
                die Chips zeigen die Wahl, die Überschrift die Antwort
                (#203 AK 5). */}
            {abschnittMitVariante(section.key, section.label, aktive, training.varianten)}
          </h1>
          <span className="type-label-large text-on-surface-mittel">
            {idx + 1}/{sections.length}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-3 type-label-medium text-on-surface-mittel">
          {section.sum > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Clock size={15} strokeWidth={2} aria-hidden />
              {formatDuration(section.sum)} in diesem Teil
            </span>
          )}
          {total > 0 && (
            <span>
              {section.sum > 0 ? "· " : ""}Gesamt {formatDuration(total)}
            </span>
          )}
        </div>
        {/* Das Ziel begleitet den Start des Trainings — danach bleibt der
            knappe Kopfbereich für die Durchführung frei (Story 10 AC 5/PC 4).
            Als eigener Absatz mit Beschriftung, damit es sich vom
            Trainingsnamen unterscheidet. */}
        {idx === 0 && training.ziel && (
          <p className="mt-3 type-body-medium text-on-surface">
            <span className="type-label-small text-on-surface-mittel">Ziel: </span>
            {training.ziel}
          </p>
        )}
        {/* Das Material gehört wie das Ziel an den Start: gebraucht wird es,
            bevor die erste Übung beginnt (Story #271). */}
        {idx === 0 && (
          <GesamtMaterialListe
            exercises={training.exercises}
            varianten={training.varianten}
            className="mt-4"
          />
        )}
      </header>

      <div className="flex flex-col gap-8">
        {section.bloecke.map((b) => (
          <div key={b.key} className="flex flex-col gap-6">
            {/* Beim Scrollen durch einen Trainingsteil muss erkennbar bleiben,
                zu welchem Unterblock die gezeigten Übungen gehören — der
                Einstieg bündelt drei Blöcke in einem Schritt (Story 8 AC 3).
                Die Überschrift bleibt darum am oberen Rand haften und nennt
                die Summe des Blocks (AC 4). Deckend statt durchscheinend:
                Ein Blur liesse den Grund durch die Stufe hindurch
                mitsprechen, und die Höhenleiter wäre nicht mehr ablesbar.
                Eine Stufe über dem Grund reicht, um die durchlaufenden
                Übungen zu überdecken. */}
            {b.label && (
              <h2 className={cn("sticky z-10 -mx-1 bg-elev-01 px-1 py-2 type-title-medium text-on-surface-mittel", unterKopfzeile)}>
                {b.label}
                {b.sum > 0 && (
                  <span className="ml-2 type-label-medium">{formatDuration(b.sum)}</span>
                )}
              </h2>
            )}
            {b.items.map((item, i) => (
              <div key={item.id}>
                <p className="mb-2 type-label-small text-on-surface-mittel">
                  Übung {i + 1} von {b.items.length}
                </p>
                <TrainingExerciseDetail item={item} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Spielfeldrand-Navigation: zwei Knöpfe über die volle Breite, im
          einen Mass der Anwendung (36 px, Epic #363). Deckend auf 04dp und mit einer Haarlinie abgesetzt; ab lg beginnt sie neben
          der Seitenleiste (Breite vom AppRahmen). Durch eine
          schwebende Leiste darf der Inhalt nicht durchscheinen, sonst trägt
          die Höhe die Trennung nicht mehr (kein Blur über der Höhenleiter). */}
      <nav className={cn("fixed right-0 bottom-0 z-10 border-t border-linie bg-elev-04", nebenLeiste)}>
        <div className="flex max-w-2xl items-center gap-2 px-4 py-2 sm:px-6">
          <Button
            type="button"
            variant="outlined"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            className="flex-1"
          >
            <ChevronLeft size={18} strokeWidth={2.5} aria-hidden />
            Zurück
          </Button>
          <Button
            type="button"
            onClick={() => setIdx((i) => Math.min(sections.length - 1, i + 1))}
            disabled={idx === sections.length - 1}
            className="flex-1"
          >
            Weiter
            <ChevronRight size={18} strokeWidth={2.5} aria-hidden />
          </Button>
        </div>
      </nav>
    </div>
  );
}
