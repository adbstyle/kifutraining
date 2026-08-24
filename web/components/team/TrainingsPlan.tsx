"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, CalendarPlus, MapPin, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { Button, Card, Dialog, KategorieChip, Snackbar } from "@/components/ui";
import { TerminDialog } from "./TerminDialog";
import {
  aktualisiereTermin,
  entferneTermin,
  setzeErneutAn,
  type TerminFelder,
} from "@/lib/actions/termine";
import type { TerminZeile } from "@/lib/queries/termine";

/** Datum als „Mo, 01.09.2026" — der Wochentag ist beim Planen die wichtigste
 *  Information und in der reinen Zahlenform nicht ablesbar. */
function datumLang(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("de-CH", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

/** Heutiges Datum als `YYYY-MM-DD` in lokaler Zeit — `toISOString()` wäre UTC
 *  und stufte am Abend den heutigen Termin bereits als vergangen ein. */
function heuteIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/* Der Team-Trainingsplan (Team-Epic Stories 7–9).
   Chronologisch aufsteigend, Vergangenes gedämpft aber sichtbar — auch
   nachträglich erfasste Einheiten gehören dazu. Je Eintrag: ansehen,
   durchführen (mit Termin-Kontext), ändern, erneut ansetzen, entfernen. */
export function TrainingsPlan({ termine }: { termine: TerminZeile[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aendern, setAendern] = useState<TerminZeile | null>(null);
  const [erneut, setErneut] = useState<TerminZeile | null>(null);
  const [loeschen, setLoeschen] = useState<TerminZeile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const heute = heuteIso();

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
          ? "Termin entfernt. Das Training bleibt im Team-Bestand."
          : (res.error ?? "Fehlgeschlagen."),
      );
    });
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {termine.map((t) => {
          const vergangen = t.datum < heute;
          return (
            <li key={t.id}>
              <Card className={vergangen ? "p-4 opacity-60" : "p-4"}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="type-title-small inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays size={16} strokeWidth={2} aria-hidden />
                        {datumLang(t.datum)}
                        {t.beginn && <> · {t.beginn} Uhr</>}
                      </span>
                      {t.ort && (
                        <span className="inline-flex items-center gap-1.5 type-body-small text-on-surface-variant">
                          <MapPin size={14} strokeWidth={2} aria-hidden />
                          {t.ort}
                        </span>
                      )}
                    </p>

                    <h3 className="mt-1 type-title-medium text-on-surface">
                      <Link
                        href={`/training/${t.training.id}`}
                        className="focus-ring hover:text-primary"
                      >
                        {t.training.name}
                      </Link>
                    </h3>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {t.training.stufen.map((k) => (
                        <KategorieChip key={k} k={k} />
                      ))}
                    </div>

                    {t.bemerkung && (
                      <p className="mt-2 type-body-small text-on-surface-variant">
                        {t.bemerkung}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      variant="text"
                      size="sm"
                      onClick={() =>
                        router.push(`/training/${t.training.id}/durchfuehren?termin=${t.id}`)
                      }
                    >
                      <PlayCircle size={18} strokeWidth={2} aria-hidden />
                      Durchführen
                    </Button>
                    <Button variant="text" size="sm" onClick={() => setAendern(t)}>
                      <Pencil size={18} strokeWidth={2} aria-hidden />
                      Ändern
                    </Button>
                    <Button variant="text" size="sm" onClick={() => setErneut(t)}>
                      <CalendarPlus size={18} strokeWidth={2} aria-hidden />
                      Erneut ansetzen
                    </Button>
                    <Button variant="text" size="sm" onClick={() => setLoeschen(t)}>
                      <Trash2 size={18} strokeWidth={2} aria-hidden />
                      Entfernen
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

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
          bleibt im Team-Bestand und lässt sich jederzeit neu ansetzen.
        </p>
      </Dialog>

      <Snackbar open={notice != null} message={notice ?? ""} onClose={() => setNotice(null)} />
    </>
  );
}
