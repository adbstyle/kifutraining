import type { Metadata } from "next";
import { KontaktAdresse, Platzhalter, RechtsAbschnitt, RechtsSeite, TextLink } from "@/components/start/RechtsSeite";
import { BENACHRICHTIGUNG_TAGE } from "@/lib/benachrichtigung";
import { DATENSCHUTZ_PFAD, IMPRESSUM_PFAD, TRAEGERSCHAFT, VEREINBARUNG_FASSUNG, VEREINBARUNG_PFAD, VEREINBARUNG_TITEL } from "@/lib/rechtliches";

/* Vereinbarung zur Auftragsbearbeitung (#675 AK 1, 3). ENTWURF wie Impressum
   und Datenschutz (Entscheid 5): aus dem Ist-Zustand (docs/produkt/,
   Datenschutzerklärung) abgeleitet, die Rechtsberatung prüft den Text vor
   Produktion. Die Seite zeigt immer die geltende Fassung
   (VEREINBARUNG_FASSUNG, SQL-Zwilling `vereinbarung_fassung()`); ihr stimmt
   zu, wer einen Verein gründet. Ohne Anmeldung erreichbar, damit sie auch vor
   dem Gründen und ausserhalb von KiFu lesbar ist; Suchmaschinen sperrt
   robots.txt (nicht in lib/auffindbar.ts freigegeben). */
export const metadata: Metadata = {
  title: "Vereinbarung zur Auftragsbearbeitung - KiFu",
  description: "Wie KiFu die Daten der Spieler:innen im Auftrag der Vereine bearbeitet.",
  alternates: { canonical: VEREINBARUNG_PFAD },
};

export default function VereinbarungSeite() {
  return (
    <RechtsSeite titel={VEREINBARUNG_TITEL} fassung={VEREINBARUNG_FASSUNG}>
      <RechtsAbschnitt titel="Wer sie miteinander abschliesst">
        <p>
          Diese Vereinbarung gilt zwischen dem Verein, der KiFu nutzt (Verantwortlicher), und der{" "}
          <Platzhalter>{TRAEGERSCHAFT}</Platzhalter>, die KiFu betreibt (Auftragsbearbeiterin, siehe{" "}
          <TextLink href={IMPRESSUM_PFAD}>Impressum</TextLink>). Wer einen Verein in KiFu gründet, stimmt ihr für
          den Verein zu und bestätigt, für ihn handeln zu dürfen.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Gegenstand und Zweck">
        <p>
          KiFu bearbeitet die Daten der Spieler:innen des Vereins nur in seinem Auftrag: damit der Verein und seine
          Teams Spielerlisten führen, Trainings und Spiele planen und Spieler:innen und Eltern sich am privaten
          Link ab- und anmelden können. KiFu nutzt diese Daten nie für eigene Zwecke, gibt sie nicht weiter und
          wertet sie nicht aus.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Welche Daten und wessen">
        <p>Betroffen sind die Spieler:innen des Vereins und, am privaten Link, ihre Eltern und Vertretungen:</p>
        <ul>
          <li>Vorname, Nachname, Jahrgang und, wenn erfasst, die J+S-Nummer,</li>
          <li>die Teams und Kader, denen eine Spieler:in zugeordnet ist,</li>
          <li>
            Ab- und Anmeldungen mit Kommentar und Zeitpunkt, Aufgebote, Anwesenheit und ein allfälliges
            Schnuppertraining,
          </li>
          <li>die Zustelladresse eines Geräts, wenn am privaten Link Mitteilungen aufs Mobile eingeschaltet sind.</li>
        </ul>
        <p>
          Für die Konten der Trainer:innen und der Vereinsverwaltung ist KiFu selbst verantwortlich; das regelt die{" "}
          <TextLink href={DATENSCHUTZ_PFAD}>Datenschutzerklärung</TextLink>.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Was der Verein verantwortet">
        <ul>
          <li>dass er die Daten seiner Spieler:innen in KiFu führen darf und die Betroffenen darüber informiert,</li>
          <li>wen er in die Vereinsverwaltung und als Trainer:innen in seine Teams aufnimmt,</li>
          <li>wem er den privaten Link einer Spieler:in gibt,</li>
          <li>
            was seine Personen selbst weitergeben, etwa an einen KI-Assistenten, den sie mit KiFu verbinden, oder an
            einen Kalender, den sie abonnieren.
          </li>
        </ul>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Was KiFu zusichert">
        <ul>
          <li>Die Daten liegen bei Supabase in Paris (Frankreich), die Anwendung läuft bei Vercel in Paris.</li>
          <li>
            Zugriff haben nur die Personen, die der Verein aufnimmt, im Rahmen ihrer Rolle: die Trainer:innen in
            ihren Teams, die Vereinsverwaltung im Bereich «Verein».
          </li>
          <li>
            Wer KiFu betreibt, ist zur Verschwiegenheit verpflichtet und sieht Daten nur, soweit es für Betrieb und
            Fehlerbehebung nötig ist.
          </li>
          <li>
            KiFu schützt die Daten mit angemessenen technischen und organisatorischen Massnahmen{" "}
            <Platzhalter>[Massnahmen ergänzen]</Platzhalter>.
          </li>
          <li>
            KiFu meldet dem Verein eine Verletzung der Datensicherheit, die seine Daten betrifft, so rasch wie
            möglich.
          </li>
          <li>
            KiFu hilft dem Verein, Anfragen von Betroffenen zu beantworten, und leitet Anfragen, die bei KiFu
            eingehen, an den Verein weiter.
          </li>
        </ul>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Wer ausserdem beteiligt ist">
        <p>KiFu setzt für den Betrieb diese Dienste ein (Unterauftragsbearbeiter):</p>
        <ul>
          <li>
            <strong>Supabase:</strong> Datenbank, Anmeldung und Bilder, in Paris (Frankreich).
          </li>
          <li>
            <strong>Vercel:</strong> Betrieb der Anwendung, in Paris (Frankreich).
          </li>
          <li>
            <strong>Dienste der Gerätehersteller und Browser:</strong> Sie stellen Mitteilungen aufs Mobile zu,
            wenn sie am privaten Link eingeschaltet sind (zum Beispiel Apple, Google oder Mozilla).
          </li>
          <li>
            <strong>Anthropic (USA):</strong> nur, was jemand selbst unter «Fragen und Feedback» schreibt.
          </li>
        </ul>
        <p>
          Für Tests übernimmt der Betrieb eine Kopie der Daten in eine getrennte Testumgebung{" "}
          <Platzhalter>[Ort und Umfang ergänzen]</Platzhalter>. Kommt ein Dienst dazu, steht er in einer neuen
          Fassung dieser Vereinbarung.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Dauer und Löschen">
        <p>
          Die Vereinbarung gilt, solange der Verein in KiFu besteht. Die Vereinsverwaltung kann Spieler:innen
          jederzeit löschen. Löscht sie den Verein, löscht KiFu alle seine Teams und Spieler:innen samt Links und
          Abos und den Nachweis dieser Zustimmung. Benachrichtigungen am privaten Link bewahrt KiFu{" "}
          {BENACHRICHTIGUNG_TAGE} Tage auf.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Neue Fassungen">
        <p>
          Ändert sich die Vereinbarung, gilt eine neue Fassung. Die Vereinsverwaltung erfährt es im Bereich
          «Verein», wo sie die geltende Fassung jederzeit lesen kann. KiFu hält fest, wer wann welcher Fassung
          zugestimmt hat.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Kontakt">
        <p>
          Fragen zu dieser Vereinbarung: <KontaktAdresse />
        </p>
      </RechtsAbschnitt>
    </RechtsSeite>
  );
}
