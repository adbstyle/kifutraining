import { Lozenge } from "./Lozenge";
import { SectionMessage } from "./SectionMessage";
import { ButtonLink } from "./Button";
import { NICHTS_MEHR_FREI, bestandText, bestandVollMeldung, istVoll, type KontoArt, type KontoGrenze } from "@/lib/konto-grenzen";
import { cn } from "@/lib/cn";

/* ── Bestand und Grenze ───────────────────────────────────────
   Wie viele eigene Übungen oder Trainings ein Konto ohne Verein von der Grenze
   besitzt (Story #588 AK 5): «12 von 50 Übungen». Ein Baustein, weil derselbe
   Stand an drei Orten steht und überall gleich lauten muss: oben in «Meine
   Übungen» und «Meine Trainings», vor dem Anlegen und in der Dialogstufe vor
   Kopieren und Übernehmen. Die Zahl kommt von der Datenebene (`grenzen` der
   Vereinslage), nie aus einer gezählten Liste; die Texte stehen einmal in
   lib/konto-grenzen.ts.

   Zwei Formen: `zeile` ist der Stand als Text, ab der Grenze mit einer Lozenge
   `warning` «Nichts mehr frei» daneben — eine Eigenschaft, die Aufmerksamkeit
   braucht, kein Fehler (`SectionMessage` ist der Baustein für Meldungen im
   Fluss, die Lozenge der für ein Wort). `meldung` ist die Section Message
   `warning` mit Titel, Satz und dem Weg zur eigenen Übersicht, wo etwas
   gelöscht werden kann: für die Seite, die an der Grenze keine Angaben mehr
   entgegennimmt. Unter der Grenze fällt sie auf die Zeile zurück.

   Über der Grenze (Altbestand, PC 1) steht die Zahl ohne negativen Rest:
   «62 Übungen (höchstens 50)». Kein Fortschrittsbalken: Er zeigte dieselbe Zahl
   ein zweites Mal und bräuchte ein Mass für den Bestand über der Grenze.

   Die Anzeige entscheidet nie. Sie zeigt, was die Seite beim Rendern sah; die
   Datenebene weist ab, und was sie abweist, zeigt der Aufrufer bleibend. */
export function BestandAnzeige({
  art,
  grenze,
  variante = "zeile",
  className,
}: {
  art: KontoArt;
  grenze: KontoGrenze;
  variante?: "zeile" | "meldung";
  className?: string;
}) {
  if (variante === "meldung" && istVoll(grenze)) {
    const m = bestandVollMeldung(art, grenze);
    return (
      <SectionMessage
        appearance="warning"
        className={className}
        actions={
          <ButtonLink href={m.link} variant="link">
            {m.linkText}
          </ButtonLink>
        }
      >
        <p className="font-medium">{m.titel}</p>
        <p className="mt-1">{m.text}</p>
      </SectionMessage>
    );
  }
  return (
    <p className={cn("type-label-small flex flex-wrap items-center gap-2 text-on-surface-mittel", className)}>
      <span>{bestandText(art, grenze)}</span>
      {istVoll(grenze) && <Lozenge appearance="warning">{NICHTS_MEHR_FREI}</Lozenge>}
    </p>
  );
}
