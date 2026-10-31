import { Repeat } from "lucide-react";
import { Eigenschaft, EigenschaftFehlt, ExternerLink, Lozenge, TreffpunktListe } from "@/components/ui";
import { spielStatus } from "@/lib/termin-status";
import { cn } from "@/lib/cn";
import { wochentageText } from "@/lib/serie";
import { spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { feldName, feldText } from "@/lib/termin-felder";
import type { TerminZeile } from "@/lib/queries/termine-fuer";
import { dabeiZahl, eingeladenZahl, noetigeVon, verantwortlichText } from "@/lib/trainer";
import { FUER_ALLE } from "@/lib/kader";
import { richtwertStufeText, richtwertText, zeitpunktKurz } from "@/lib/spiel";
import { KaderLozenges } from "./KaderLozenge";

/** Der Status eines Spiels als Lozenge mit seinem Detail; ohne Richtwert nichts. */
function spielStatusEcke(zahl: number, min: number | null, max: number | null) {
  const status = spielStatus(zahl, min, max);
  if (!status) return null;
  return (
    <>
      <Lozenge appearance={status.appearance}>{status.wort}</Lozenge>
      <span className="type-body-small text-on-surface-mittel">{richtwertStufeText(zahl, min, max)}</span>
    </>
  );
}

/* Alle Angaben eines Termins ungekürzt (#403 AK 3, 5): Ort, Trainer:innen (#519),
   Spielerzahl und Felder ausführlich, Bemerkung und die Wochentage der Serie.
   Fehlen Spielerzahl oder Felder, steht «Nicht erfasst» da (AK 6); ohne
   Verantwortliche «Niemand» (#519 AK 17); Ort, Bemerkung und Serie
   erscheinen nur, wenn es sie gibt;
   die Kader, sobald das Team welche führt — ohne steht «Für alle» (#453 AK 5).
   Geteilt vom nächsten Termin und dem Reiter «Termin» der Termin-Spalte
   (#435). Ein Spiel (#459) nennt statt Spielerzahl und Feldern seinen
   Richtwert, soweit festgelegt (AK 9), gleich nach dem Ort seine Treffpunkte
   (#465 AK 8). Der Hinweis für Eltern steht vor der Bemerkung und ist als
   solcher benannt (#590 AK 8): Ihn sehen die Eltern, die Bemerkung nicht. */
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
  const v = verantwortlichText(t.trainer, ich);
  const noetig = noetigeVon(t);
  const zahlText = spielerzahlLang(spielerzahlVon(t));
  return (
    <dl className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]", className)}>
      {t.ort && (
        <Eigenschaft label="Ort">
          <span className="flex flex-col items-start gap-0.5">
            <span>{t.ort}</span>
            {/* #533 AK 8: den Kartenlink öffnen, um ihn zu prüfen. */}
            {t.ortLink && <ExternerLink href={t.ortLink}>Auf der Karte öffnen</ExternerLink>}
          </span>
        </Eigenschaft>
      )}
      {t.spiel && t.spiel.treffpunkte.length > 0 && (
        <Eigenschaft label="Treffpunkte">
          <TreffpunktListe treffpunkte={t.spiel.treffpunkte} spieltag={t.datum} spielOrt={t.ort} />
        </Eigenschaft>
      )}
      {/* #519 AK 17: wer verantwortlich ist, man selbst mit «(du)»; die Namen aller im Reiter «Trainer:innen». */}
      <Eigenschaft label="Verantwortlich">{v ?? "Niemand"}</Eigenschaft>
      <Eigenschaft label="Trainer:innen">
        {dabeiZahl(t.trainer)} von {eingeladenZahl(t.trainer)} dabei
        {noetig !== null && ` · nötig ${noetig}`}
      </Eigenschaft>
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
          {/* #463 AK 6, 7: die Angemeldeten, ab dem Anpfiff die Anwesenden
              (#487 AK 10, 11) — ungefärbt mit dem Status des Spiels in einem
              Wort und seinem Detail (Epic #490, #495 AK 13). */}
          {!t.ausgefallen && t.spielstand && (
            <Eigenschaft label="Spieler:innen">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {spielStatusEcke(t.spielstand.anwesend ?? t.spielstand.angemeldet, t.spiel.richtwertMin, t.spiel.richtwertMax)}
                <span>
                  {t.spielstand.anwesend != null
                    ? `${t.spielstand.anwesend} von ${t.spielstand.gesamt} da`
                    : `${t.spielstand.angemeldet} von ${t.spielstand.gesamt} angemeldet`}
                </span>
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
      {t.hinweisEltern && (
        <Eigenschaft label="Hinweis für Eltern">
          <span className="whitespace-pre-line">{t.hinweisEltern}</span>
        </Eigenschaft>
      )}
      {t.bemerkung && (
        <Eigenschaft label="Bemerkung">
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
