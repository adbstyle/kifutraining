import { Building2, UserPlus } from "lucide-react";
import { Card, KopierFeld } from "@/components/ui";
import { VereinGruenden } from "@/components/verein/VereinGruenden";
import { TEAMS_OHNE_VEREIN_TEXT as TEXT } from "@/lib/verein";

/* Der Einstieg für ein Konto ohne Verein (Epic Vereine #575, Story #587
   AK 5), auf `/teams` an der Stelle des Hinweises, dass Teams die
   Vereinsverwaltung anlegt: zwei Wege zu einem Verein. Entweder gründet die
   Person selbst einen und wird seine erste Verwaltung, oder sie lässt sich mit
   ihrer E-Mail-Adresse aufnehmen — diese steht hier zum Kopieren, damit sie
   sie weitergeben kann (Konten sind sonst nirgends sichtbar). Eine lokale
   Komponente: Karte, Zeichen, Titel, Text, ein Weg — nur hier gebraucht. */
export function OhneVereinStart({ email }: { email: string | null }) {
  return (
    <div>
      <header className="mb-6 max-w-2xl">
        <h1 className="type-headline-large text-on-surface">{TEXT.titel}</h1>
        <p className="type-body-medium mt-2 text-on-surface-mittel">{TEXT.einleitung}</p>
      </header>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4">
        <Karte icon={Building2} titel={TEXT.gruenden.titel} text={TEXT.gruenden.text}>
          <VereinGruenden />
        </Karte>
        <Karte icon={UserPlus} titel={TEXT.aufnahme.titel} text={TEXT.aufnahme.text}>
          {email && <KopierFeld label={TEXT.aufnahme.feld} value={email} />}
        </Karte>
      </div>
    </div>
  );
}

function Karte({
  icon: Icon,
  titel,
  text,
  children,
}: {
  icon: typeof Building2;
  titel: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3 p-5 sm:p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full betont text-on-surface">
        <Icon size={22} strokeWidth={2} aria-hidden />
      </span>
      <h2 className="type-title-large text-on-surface">{titel}</h2>
      <p className="type-body-medium flex-1 text-on-surface-mittel">{text}</p>
      <div className="mt-1 flex flex-col items-start">{children}</div>
    </Card>
  );
}
