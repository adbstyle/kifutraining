import { FileText } from "lucide-react";
import { ButtonLink, Card, SectionMessage } from "@/components/ui";
import { VEREINBARUNG_PFAD } from "@/lib/rechtliches";
import { formatDate } from "@/lib/training";
import { VEREIN_VEREINBARUNG_TEXT, vereinbarungLage } from "@/lib/verein";
import type { VereinVereinbarung } from "@/lib/verein-antwort";

/* Die Vereinbarung zur Auftragsbearbeitung in der Verwaltung des Vereins
   (#675 AK 3, 4): die geltende Fassung zum Lesen, wann der Verein zugestimmt
   hat, und ein Hinweis, wenn inzwischen eine neue Fassung gilt oder keine
   Zustimmung festgehalten ist. Der Hinweis informiert nur (Entscheid 3);
   eine erneute Zustimmung gibt es nicht (Out of Scope 2). Kein neuer
   Baustein: Card wie die übrigen Abschnitte der Verwaltung, SectionMessage
   für den Hinweis. */
export function VereinbarungKarte({ vereinbarung }: { vereinbarung: VereinVereinbarung }) {
  const { zustimmung } = vereinbarung;
  const lage = vereinbarungLage(vereinbarung.geltend, zustimmung?.fassung ?? null);
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 type-title-large text-on-surface">
            <FileText size={20} strokeWidth={2} aria-hidden />
            {VEREIN_VEREINBARUNG_TEXT.titel}
          </h2>
          <p className="type-body-small text-on-surface-mittel">{VEREIN_VEREINBARUNG_TEXT.text}</p>
        </div>
        <ButtonLink href={VEREINBARUNG_PFAD} variant="outlined">
          {VEREIN_VEREINBARUNG_TEXT.lesen}
        </ButtonLink>
      </div>
      {zustimmung && (
        <p className="type-body-medium mt-3 text-on-surface">{VEREIN_VEREINBARUNG_TEXT.zugestimmt(formatDate(zustimmung.am))}</p>
      )}
      {lage === "neue_fassung" && (
        <SectionMessage appearance="information" className="mt-3">
          {VEREIN_VEREINBARUNG_TEXT.neueFassung}
        </SectionMessage>
      )}
      {lage === "ohne" && (
        <SectionMessage appearance="information" className="mt-3">
          {VEREIN_VEREINBARUNG_TEXT.ohneZustimmung}
        </SectionMessage>
      )}
    </Card>
  );
}
