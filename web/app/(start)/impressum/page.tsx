import type { Metadata } from "next";
import { KontaktAdresse, Platzhalter, RechtsAbschnitt, RechtsSeite, TextLink } from "@/components/start/RechtsSeite";
import { ExternerLink } from "@/components/ui";
import { DATENSCHUTZ_PFAD, IMPRESSUM_PFAD, POSTADRESSE_PLATZHALTER, TRAEGERSCHAFT } from "@/lib/rechtliches";
import { REPO_URL } from "@/lib/startseite";

/* Impressum (#672 AK 2): wer hinter KiFu steht, mit Postadresse und
   E-Mail-Adresse für Anfragen. ENTWURF — Trägerschaft, Adresse und E-Mail
   sind Platzhalter bis zur Gründung (Entscheid 1, 2). Für Suchmaschinen frei
   (AK 8, lib/auffindbar.ts); ohne Anmeldung erreichbar. */
export const metadata: Metadata = {
  title: "Impressum - KiFu",
  description: "Wer hinter KiFu steht und wie du KiFu erreichst.",
  alternates: { canonical: IMPRESSUM_PFAD },
};

export default function ImpressumSeite() {
  return (
    <RechtsSeite titel="Impressum">
      <RechtsAbschnitt titel="Betreiberin">
        <address className="not-italic">
          <Platzhalter>{TRAEGERSCHAFT}</Platzhalter>
          {POSTADRESSE_PLATZHALTER.map((zeile) => (
            <span key={zeile} className="block">
              <Platzhalter>{zeile}</Platzhalter>
            </span>
          ))}
        </address>
        <p>
          KiFu wird von einer Trägerschaft betrieben, die zurzeit gegründet wird. Sobald sie besteht, stehen hier
          ihr Name und ihre Postadresse.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Kontakt">
        <p>
          Anfragen zu KiFu und zu deinen Daten: <KontaktAdresse />
        </p>
        <p>
          Wer angemeldet ist, erreicht uns auch über «Fragen und Feedback» im Konto-Menü; Spieler:innen und Eltern
          über «Fragen und Feedback» am privaten Link.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Open Source">
        <p>
          Der Quellcode von KiFu ist offen: <ExternerLink href={REPO_URL}>KiFu auf GitHub</ExternerLink>
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Datenschutz">
        <p>
          Welche Daten KiFu bearbeitet, wozu und wie lange, steht in der{" "}
          <TextLink href={DATENSCHUTZ_PFAD}>Datenschutzerklärung</TextLink>.
        </p>
      </RechtsAbschnitt>
    </RechtsSeite>
  );
}
