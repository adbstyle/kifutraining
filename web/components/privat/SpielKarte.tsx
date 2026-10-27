"use client";

import { Clock, Shirt } from "lucide-react";
import { Button, ExternerLink, Kalenderblatt, Lozenge, SectionMessage, TreffpunktListe, ZeichenZahl } from "@/components/ui";
import { KaderLozenges } from "@/components/team/KaderLozenge";
import { cn } from "@/lib/cn";
import { tagOhneJahr, tagText } from "@/lib/monat";
import type { LinkTermin } from "@/lib/privater-link";
import { AUFGEBOT_TEXT, richtwertText, zeitpunktKurz, type Meldung } from "@/lib/spiel";
import { TERMIN_STATUS, meldeStatus } from "@/lib/termin-status";
import { AusfallGrund } from "./AusfallGrund";

/* Ein Spiel am privaten Link (#459, #463, #464, #465; Epic #490, Tafel 9;
   kompakt mit #523, Tafel «Vergleich» 1c). Von oben nach unten:
   Kalenderblatt, der Status der eigenen Spieler:in als Lozenge, Bezeichnung,
   Zeit und Ort, wer verantwortlich ist (#523 AK 1, 2); EINE Linie mit
   Zeichen — bis wann sich melden lässt und wie viele angemeldet sind, mit dem
   gesuchten Bereich, ohne Überfahren, weil Eltern am Telefon sind (AK 4);
   die Handlung als Knopf; Hinweise zur Verlegung oder zu einem Fehler; die
   Treffpunkte mit Anreise, Zeit und Ort, frühester zuerst (AK 5); die
   Bemerkung.

   - Ohne Meldung «Anmelden» hell und «Abmelden» umrandet, sonst nur der eine
     mögliche Wechsel umrandet. Nach der Meldefrist, ab dem Anpfiff und bei
     nicht aufgeboten keine Knöpfe, nur der Satz dazu.
   - Abgemeldet, nicht aufgeboten, Meldefrist verpasst und ausgefallen: Die
     Karte tritt gedämpft zurück, das Kalenderblatt grau und durchgestrichen.
   - Treffpunkte nur, solange das Spiel nicht begonnen hat und die
     Spieler:in dabei sein kann.
   - Ein ausgefallenes Spiel zeigt nur den Kopf mit dem Grund (#530; ohne
     Bemerkung, PO 2026-10-27). */
export function SpielKarte({
  t,
  meldung,
  angemeldet,
  name,
  pending,
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
  fehler?: string;
  onMelden: (an: boolean) => void;
}) {
  const nichtAufgeboten = t.nicht_aufgeboten && !t.ausgefallen;
  const status = t.ausgefallen ? TERMIN_STATUS.faelltAus : meldeStatus(meldung, nichtAufgeboten, t.frist_abgelaufen);
  // Zählt nicht: abgemeldet, nicht aufgeboten, Meldefrist verpasst, ausgefallen.
  const gedaempft = t.ausgefallen || nichtAufgeboten || meldung === "abgemeldet" || (meldung === null && t.frist_abgelaufen);
  const offen = !t.ausgefallen && !t.begonnen && !t.frist_abgelaufen && !nichtAufgeboten;
  const frist = t.begonnen
    ? "Hat begonnen · nicht mehr änderbar"
    : t.frist_abgelaufen
      ? "Meldefrist abgelaufen · Änderung übers Team"
      : t.frist
        ? `${meldung === null ? "Bitte melden bis" : "Änderbar bis"} ${zeitpunktKurz(t.frist)}`
        : "Änderbar bis zum Anpfiff";
  const treffpunkte = !t.begonnen && !gedaempft && t.treffpunkte && t.treffpunkte.length > 0 ? t.treffpunkte : null;
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-flaeche",
        "px-3 py-3",
        gedaempft ? "kontur border-linie bg-transparent" : "bg-elev-01",
      )}
    >
      <div className="flex items-start gap-3">
        <Kalenderblatt datum={t.datum} stand={gedaempft ? "gestrichen" : "aktiv"} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
          <span className={cn("max-w-full truncate", "type-title-small", gedaempft ? "text-on-surface-mittel" : "text-on-surface", t.ausgefallen && "line-through")}>
            {t.bezeichnung}
          </span>
          <span className="type-body-medium text-on-surface-mittel">
            {t.beginn}–{t.ende}
          </span>
          {/* #533 AK 6, 10, 11; PC 5: mit Kartenlink als Link auf einer Zeile. */}
          {t.ort &&
            (t.ort_link && !t.ausgefallen ? (
              <ExternerLink href={t.ort_link} einzeilig className="type-body-medium">
                {t.ort}
              </ExternerLink>
            ) : (
              <span className="max-w-full break-words type-body-medium text-on-surface-mittel">{t.ort}</span>
            ))}
          <AusfallGrund grund={t.ausfall_grund} />
          {t.verantwortlich && <span className="type-body-small text-on-surface-mittel">Verantwortlich: {t.verantwortlich}</span>}
        </div>
      </div>
      {!t.ausgefallen && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-linie pt-3 text-on-surface">
          {nichtAufgeboten ? (
            <p className="type-body-small text-on-surface-mittel">{AUFGEBOT_TEXT.eltern(name)}</p>
          ) : (
            <ZeichenZahl icon={Clock} label={frist}>
              {frist}
            </ZeichenZahl>
          )}
          {angemeldet !== null && t.gesamt !== null ? (
            <ZeichenZahl icon={Shirt} label={zahlSatz(angemeldet, t)}>
              {angemeldet}/{t.gesamt}
              {richtwertText(t.richtwert_min, t.richtwert_max) && ` · gesucht ${richtwertText(t.richtwert_min, t.richtwert_max)}`}
            </ZeichenZahl>
          ) : (
            <span className="type-body-small text-on-surface-mittel">Das Team führt keine Spielerliste.</span>
          )}
          {t.kader.length > 0 && <KaderLozenges namen={t.kader} />}
        </div>
      )}
      {offen && (
        <div className="flex flex-wrap gap-2">
          {meldung !== "angemeldet" && (
            <Button
              variant={meldung === null ? "hell" : "outlined"}
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
          {t.aufgebot_verfallen && ` ${AUFGEBOT_TEXT.verfallen}`}
        </SectionMessage>
      )}
      {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
      {treffpunkte && (
        <TreffpunktListe treffpunkte={treffpunkte} spieltag={t.datum} spielOrt={t.ort} className="type-body-medium text-on-surface" />
      )}
      {t.bemerkung && !t.ausgefallen && <p className="type-body-medium whitespace-pre-line text-on-surface">{t.bemerkung}</p>}
    </li>
  );
}

/** Die Zahl ausgeschrieben, mit dem Richtwert und den nicht Aufgebotenen. */
function zahlSatz(angemeldet: number, t: LinkTermin): string {
  const richtwert = richtwertText(t.richtwert_min, t.richtwert_max);
  return [
    `${angemeldet} von ${t.gesamt} angemeldet`,
    richtwert && `gesucht ${richtwert}`,
    (t.nicht_aufgeboten_zahl ?? 0) > 0 && `${t.nicht_aufgeboten_zahl} nicht aufgeboten`,
  ]
    .filter(Boolean)
    .join(" · ");
}
