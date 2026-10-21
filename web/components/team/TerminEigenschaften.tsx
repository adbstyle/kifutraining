import { Repeat } from "lucide-react";
import { Eigenschaft, EigenschaftFehlt, RichtwertLozenge, TreffpunktListe, richtwertSchrift } from "@/components/ui";
import { cn } from "@/lib/cn";
import { wochentageText } from "@/lib/serie";
import { spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { feldName, feldText } from "@/lib/termin-felder";
import { verantwortlicheMitDir, type TerminZeile } from "@/lib/queries/termine-fuer";
import { FUER_ALLE } from "@/lib/kader";
import { richtwertText, zeitpunktKurz } from "@/lib/spiel";
import { KaderLozenges } from "./KaderLozenge";

/* Alle Angaben eines Termins ungekürzt (#403 AK 3, 5): Ort, Verantwortliche,
   Spielerzahl und Felder ausführlich, Bemerkung und die Wochentage der Serie.
   Fehlen Spielerzahl oder Felder, steht «Nicht erfasst» da (AK 6); Ort,
   Verantwortliche, Bemerkung und Serie erscheinen nur, wenn es sie gibt;
   die Kader, sobald das Team welche führt — ohne steht «Für alle» (#453 AK 5).
   Geteilt vom nächsten Termin und dem Reiter «Termin» der Termin-Spalte
   (#435). Ein Spiel (#459) nennt statt Spielerzahl und Feldern seinen
   Richtwert, soweit festgelegt (AK 9), gleich nach dem Ort seine Treffpunkte
   (#465 AK 8) und an der Bemerkung, dass die Eltern sie sehen (AK 9). */
export function TerminEigenschaften({
  t,
  ich,
  mitKadern = false,
  className,
}: {
  t: TerminZeile;
  ich: string;
  /** Das Team führt Kader: Dann steht auch «Für alle» da (#453 AK 5). */
  mitKadern?: boolean;
  className?: string;
}) {
  const v = verantwortlicheMitDir(t, ich);
  const zahlText = spielerzahlLang(spielerzahlVon(t));
  return (
    <dl className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]", className)}>
      {t.ort && <Eigenschaft label="Ort">{t.ort}</Eigenschaft>}
      {t.spiel && t.spiel.treffpunkte.length > 0 && (
        <Eigenschaft label="Treffpunkte">
          <TreffpunktListe treffpunkte={t.spiel.treffpunkte} spieltag={t.datum} spielOrt={t.ort} />
        </Eigenschaft>
      )}
      {/* AK 4: wer man selbst ist, steht zuerst und mit «(du)». */}
      {v.text && <Eigenschaft label="Verantwortlich">{v.text}</Eigenschaft>}
      {/* #453 AK 5: für welche Kader er gilt oder dass er für alle gilt. */}
      {(mitKadern || t.kader.length > 0) && (
        <Eigenschaft label="Kader">
          {t.kader.length > 0 ? <KaderLozenges namen={t.kader.map((k) => k.name)} /> : FUER_ALLE}
        </Eigenschaft>
      )}
      {/* Aus der Spielerliste, sonst die erwartete Zahl (#434 AK 8); ein
          ausgefallener Termin nennt keine (#437 AK 4). */}
      {t.spiel ? (
        <>
          {/* #463 AK 6, 7: die Angemeldeten gegen den Richtwert, farbig und in Worten. */}
          {!t.ausgefallen && t.spielstand && (
            <Eigenschaft label="Spieler:innen">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={richtwertSchrift(t.spielstand.angemeldet, t.spiel.richtwertMin, t.spiel.richtwertMax)}>
                  {t.spielstand.angemeldet} von {t.spielstand.gesamt} angemeldet
                </span>
                <RichtwertLozenge zahl={t.spielstand.angemeldet} min={t.spiel.richtwertMin} max={t.spiel.richtwertMax} />
                {/* #464 AK 8: wie viele nicht aufgeboten sind. */}
                {(t.spielstand.nicht_aufgeboten ?? 0) > 0 && (
                  <span className="type-body-small text-on-surface-mittel">{t.spielstand.nicht_aufgeboten} nicht aufgeboten</span>
                )}
              </span>
            </Eigenschaft>
          )}
          {richtwertText(t.spiel.richtwertMin, t.spiel.richtwertMax) && (
            <Eigenschaft label="Richtwert">{richtwertText(t.spiel.richtwertMin, t.spiel.richtwertMax)} Spieler:innen</Eigenschaft>
          )}
          {/* #463 AK 8: bis wann Eltern melden; ohne Frist bis zum Anpfiff. */}
          <Eigenschaft label="Meldefrist">
            {t.spiel.meldefrist ? `Eltern bis ${zeitpunktKurz(t.spiel.meldefrist)}` : "Bis zum Anpfiff"}
          </Eigenschaft>
        </>
      ) : (
        <>
          {!t.ausgefallen && (zahlText ? (
            <Eigenschaft label="Spieler:innen">{zahlText}</Eigenschaft>
          ) : (
            <EigenschaftFehlt label="Spieler:innen" />
          ))}
          {/* AK 5–7: jedes Feld mit Grösse, Toren je Torart und Untergrund;
              «keine» Tore und unbekannte unterscheiden sich (`feldText`). */}
          {t.felder && t.felder.length > 0 ? (
            t.felder.map((f, i, alle) => (
              <Eigenschaft key={i} label={feldName(i, alle.length)}>{feldText(f)}</Eigenschaft>
            ))
          ) : (
            <EigenschaftFehlt label="Felder" />
          )}
        </>
      )}
      {t.bemerkung && (
        <Eigenschaft label={t.spiel ? "Bemerkung · sichtbar für Eltern" : "Bemerkung"}>
          <span className="whitespace-pre-line">{t.bemerkung}</span>
        </Eigenschaft>
      )}
      {t.serie && (
        <Eigenschaft label="Terminserie">
          <span className="inline-flex items-center gap-1">
            <Repeat size={14} aria-hidden />
            {wochentageText(t.serie.wochentage)}
          </span>
        </Eigenschaft>
      )}
    </dl>
  );
}
