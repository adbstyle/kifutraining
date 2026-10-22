"use client";

import { Button, Kalenderblatt, Lozenge, Meldebalken, SectionMessage, TreffpunktListe } from "@/components/ui";
import { KaderLozenges } from "@/components/team/KaderLozenge";
import { KartenAbschnitt } from "@/components/team/KartenAbschnitt";
import { cn } from "@/lib/cn";
import { tagOhneJahr, tagText } from "@/lib/monat";
import type { LinkTermin } from "@/lib/privater-link";
import { AUFGEBOT_TEXT, zeitpunktKurz, type Meldung } from "@/lib/spiel";
import { TERMIN_STATUS, meldeStatus } from "@/lib/termin-status";

/* Ein Spiel am privaten Link (#459, #463, #464, #465; Epic #490, Tafel 9).
   Von oben nach unten: Kalenderblatt, der Status der eigenen Spieler:in als
   Lozenge, Bezeichnung, Zeit und Ort; bis wann sich melden lässt; die
   Handlung als Knopf; Hinweise zur Verlegung oder zu einem Fehler;
   TREFFPUNKTE, frühester zuerst; KADER mit Balken; BEMERKUNG.

   - Ohne Meldung «Anmelden» hell und «Abmelden» umrandet, sonst nur der eine
     mögliche Wechsel umrandet. Nach der Meldefrist, ab dem Anpfiff und bei
     nicht aufgeboten keine Knöpfe, nur der Satz dazu.
   - Abgemeldet, nicht aufgeboten, Meldefrist verpasst und ausgefallen: Die
     Karte tritt gedämpft zurück, das Kalenderblatt grau und durchgestrichen.
   - Treffpunkte nur, solange das Spiel nicht begonnen hat und die
     Spieler:in dabei sein kann.
   - Ein ausgefallenes Spiel zeigt nur Kopf und Bemerkung (#465 AK 10, 11). */
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
          {t.ort && <span className="type-body-medium text-on-surface-mittel">{t.ort}</span>}
        </div>
      </div>
      {!t.ausgefallen && (
        <p className="type-body-small text-on-surface-mittel">{nichtAufgeboten ? AUFGEBOT_TEXT.eltern(name) : frist}</p>
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
        <KartenAbschnitt ebene="h4" titel="Treffpunkte">
          <TreffpunktListe treffpunkte={treffpunkte} spieltag={t.datum} spielOrt={t.ort} className="type-body-medium text-on-surface" />
        </KartenAbschnitt>
      )}
      {!t.ausgefallen && (
        <KartenAbschnitt ebene="h4" titel="Kader" zusatz={<KaderLozenges namen={t.kader} />}>
          {angemeldet !== null && t.gesamt !== null ? (
            <Meldebalken
              zahl={angemeldet}
              gesamt={t.gesamt}
              min={t.richtwert_min}
              max={t.richtwert_max}
              zusatz={(t.nicht_aufgeboten_zahl ?? 0) > 0 ? `${t.nicht_aufgeboten_zahl} nicht aufgeboten` : undefined}
            />
          ) : (
            <p className="type-body-medium text-on-surface-mittel">Das Team führt keine Spielerliste.</p>
          )}
        </KartenAbschnitt>
      )}
      {t.bemerkung && (
        <KartenAbschnitt ebene="h4" titel="Bemerkung">
          <p className="type-body-medium whitespace-pre-line text-on-surface">{t.bemerkung}</p>
        </KartenAbschnitt>
      )}
    </li>
  );
}
