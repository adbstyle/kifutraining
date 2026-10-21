"use client";

import { Shirt } from "lucide-react";
import { Button, Kalenderblatt, Lozenge, RichtwertLozenge, SectionMessage, SpielLozenge, richtwertSchrift } from "@/components/ui";
import { KaderLozenges } from "@/components/team/KaderLozenge";
import { cn } from "@/lib/cn";
import { tagOhneJahr, tagText } from "@/lib/monat";
import type { LinkTermin } from "@/lib/privater-link";
import { MELDUNG_TEXT, richtwertText, zeitpunktKurz, type Meldung } from "@/lib/spiel";

/* Ein Spiel am privaten Link (#459 AK 17, #463 AK 3, 7, 11, 12, 15, 21; Design
   PO 2026-10-21): Die Meldung steht nur als Lozenge — Angemeldet grün,
   Abgemeldet rot —, daneben bis wann sie sich ändern lässt. Darunter nur die
   Handlung, die möglich ist, als Knopf ohne Zeichen: ohne Meldung
   «Anmelden» (gefüllt) und «Abmelden», sonst die jeweils andere. Nach der
   Meldefrist keine Knöpfe, sondern der Weg übers Team; ab dem Anpfiff gilt
   der Stand beim Anpfiff. Abgemeldet steht die Karte leise rot getönt, mit
   rotem Kalenderblatt. */
export function SpielKarte({
  t,
  meldung,
  angemeldet,
  name,
  pending,
  gross = false,
  kopf,
  fehler,
  onMelden,
}: {
  t: LinkTermin;
  /** Die Meldung, wie sie gerade dasteht (lokal vor der Antwort). */
  meldung: Meldung;
  /** Die Zahl der Angemeldeten, ebenso; `null` ohne Spielerliste oder ausgefallen. */
  angemeldet: number | null;
  name: string;
  pending: boolean;
  /** «Als Nächstes»: grösser, auf höherer Fläche. */
  gross?: boolean;
  /** Über der Zeit, etwa «Morgen · Samstag, 31. Oktober». */
  kopf?: string;
  fehler?: string;
  onMelden: (an: boolean) => void;
}) {
  const abgemeldet = meldung === "abgemeldet" && !t.ausgefallen;
  const offen = !t.ausgefallen && !t.begonnen && !t.frist_abgelaufen;
  const richtwert = richtwertText(t.richtwert_min, t.richtwert_max);
  const Element = gross ? "div" : "li";
  return (
    <Element
      className={cn(
        "flex flex-col gap-3 rounded-flaeche",
        gross ? "kontur border-kante p-4" : "px-3 py-2.5",
        abgemeldet ? "bg-section-danger/60" : gross ? "bg-elev-04" : "bg-elev-01",
      )}
    >
      <div className="flex items-start gap-3">
        {!gross && (
          <Kalenderblatt
            datum={t.datum}
            zustand={t.ausgefallen ? "ausgefallen" : abgemeldet ? "abgemeldet" : "spiel"}
            className="self-start"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {kopf && <p className={cn("type-title-small", abgemeldet ? "text-error" : "text-on-lozenge-discovery")}>{kopf}</p>}
          <span className="flex min-w-0 items-center gap-2">
            <SpielLozenge />
            <span className={cn("truncate text-on-surface", gross ? "type-title-large" : "type-title-small", t.ausgefallen && "line-through")}>
              {t.bezeichnung}
            </span>
          </span>
          <span className={cn("text-on-surface", gross ? "type-headline-small" : "type-body-medium")}>
            {gross && !kopf && <>{tagOhneJahr(t.datum)} · </>}
            {t.beginn}–{t.ende}
            {gross && " Uhr"}
          </span>
          {(t.ort || angemeldet !== null) && (
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 type-body-small text-on-surface-mittel">
              {t.ort && <span className="min-w-0">{t.ort}</span>}
              {angemeldet !== null && t.gesamt !== null && (
                <span className="inline-flex shrink-0 items-center gap-1">
                  <Shirt size={14} className="shrink-0" aria-hidden />
                  <span aria-hidden className={richtwertSchrift(angemeldet, t.richtwert_min, t.richtwert_max)}>
                    {angemeldet}/{t.gesamt}
                  </span>
                  <span className="sr-only">
                    Spielerzahl {angemeldet} von {t.gesamt}
                  </span>
                </span>
              )}
            </p>
          )}
          {richtwert && angemeldet !== null && (
            <span className="flex flex-wrap items-center gap-2 type-body-small text-on-surface-mittel">
              Richtwert {richtwert}
              <RichtwertLozenge zahl={angemeldet} min={t.richtwert_min} max={t.richtwert_max} />
            </span>
          )}
          <KaderLozenges namen={t.kader} className="mt-1" />
          {t.ausgefallen ? (
            <span className="type-body-small text-on-surface-mittel">Fällt aus</span>
          ) : (
            <span className="flex flex-wrap items-center gap-2 type-body-small text-on-surface-mittel">
              {meldung === "angemeldet" && <Lozenge appearance="success">{MELDUNG_TEXT.angemeldet}</Lozenge>}
              {meldung === "abgemeldet" && <Lozenge appearance="danger">{MELDUNG_TEXT.abgemeldet}</Lozenge>}
              {t.begonnen
                ? "Hat begonnen · nicht mehr änderbar"
                : t.frist_abgelaufen
                  ? "Meldefrist abgelaufen · Änderung übers Team"
                  : t.frist
                    ? `Änderbar bis ${zeitpunktKurz(t.frist)}`
                    : "Änderbar bis zum Anpfiff"}
            </span>
          )}
        </div>
      </div>
      {offen && (
        <div className="flex flex-wrap gap-2">
          {meldung !== "angemeldet" && (
            <Button
              variant={meldung === null ? "filled" : "outlined"}
              disabled={pending}
              onClick={() => onMelden(true)}
              aria-label={`${name} am ${tagText(t.datum)} anmelden`}
            >
              Anmelden
            </Button>
          )}
          {meldung !== "abgemeldet" && (
            <Button variant="outlined" disabled={pending} onClick={() => onMelden(false)} aria-label={`${name} am ${tagText(t.datum)} abmelden`}>
              Abmelden
            </Button>
          )}
        </div>
      )}
      {t.vorher && !t.ausgefallen && !t.begonnen && (
        <SectionMessage>
          Verlegt, vorher {tagOhneJahr(t.vorher.datum)} um {t.vorher.beginn}.{" "}
          {t.meldung_verfallen ? "Deine Meldung gilt nicht mehr - melde neu." : meldung !== null ? "Die Meldung gilt weiter." : ""}
        </SectionMessage>
      )}
      {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
    </Element>
  );
}
