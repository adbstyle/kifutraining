import { Repeat } from "lucide-react";
import { Eigenschaft, EigenschaftFehlt } from "@/components/ui";
import { cn } from "@/lib/cn";
import { wochentageText } from "@/lib/serie";
import { spielerzahlLang, spielerzahlVon } from "@/lib/spieler";
import { feldName, feldText } from "@/lib/termin-felder";
import { verantwortlicheMitDir, type TerminZeile } from "@/lib/queries/termine-fuer";

/* Alle Angaben eines Termins ungekürzt (#403 AK 3, 5): Ort, Verantwortliche,
   Spielerzahl und Felder ausführlich, Bemerkung und die Wochentage der Serie.
   Fehlen Spielerzahl oder Felder, steht «Nicht erfasst» da (AK 6); Ort,
   Verantwortliche, Bemerkung und Serie erscheinen nur, wenn es sie gibt.
   Geteilt vom nächsten Termin und dem Reiter «Termin» der Termin-Spalte
   (#435). */
export function TerminEigenschaften({ t, ich, className }: { t: TerminZeile; ich: string; className?: string }) {
  const v = verantwortlicheMitDir(t, ich);
  const zahlText = spielerzahlLang(spielerzahlVon(t));
  return (
    <dl className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 sm:grid-cols-[8rem_minmax(0,1fr)]", className)}>
      {t.ort && <Eigenschaft label="Ort">{t.ort}</Eigenschaft>}
      {/* AK 4: wer man selbst ist, steht zuerst und mit «(du)». */}
      {v.text && <Eigenschaft label="Verantwortlich">{v.text}</Eigenschaft>}
      {/* Aus der Spielerliste, sonst die erwartete Zahl (#434 AK 8); ein
          ausgefallener Termin nennt keine (#437 AK 4). */}
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
  );
}
