import type { Metadata } from "next";
import { KontaktAdresse, Platzhalter, RechtsAbschnitt, RechtsSeite, TextLink } from "@/components/start/RechtsSeite";
import { BENACHRICHTIGUNG_TAGE } from "@/lib/benachrichtigung";
import { AUFBEWAHRUNG_MONATE } from "@/lib/feedback/regeln";
import { DATENSCHUTZ_PFAD, IMPRESSUM_PFAD, TRAEGERSCHAFT } from "@/lib/rechtliches";

/* Datenschutzerklärung (#672 AK 3–7). ENTWURF aus dem Ist-Zustand
   (docs/produkt/, Seite «Cookies», lib/browser-speicher.ts): welche Daten,
   wozu, wie lange; die Spielerdaten im Auftrag der Vereine; wo die Daten
   liegen und wer ausserhalb etwas erhält (Entscheid 5); die Rechte ohne
   Konto per E-Mail (Entscheid 3); der Weg zu «Cookies» (Entscheid 4). Die
   Fristen kommen aus ihren Quellen. Für Suchmaschinen frei (AK 8). */
export const metadata: Metadata = {
  title: "Datenschutz - KiFu",
  description: "Welche Daten KiFu bearbeitet, wozu, wie lange und wo sie liegen.",
  alternates: { canonical: DATENSCHUTZ_PFAD },
};

export default function DatenschutzSeite() {
  return (
    <RechtsSeite titel="Datenschutzerklärung">
      <RechtsAbschnitt titel="Wer verantwortlich ist">
        <p>
          KiFu wird von der <Platzhalter>{TRAEGERSCHAFT}</Platzhalter> betrieben (siehe{" "}
          <TextLink href={IMPRESSUM_PFAD}>Impressum</TextLink>). Fragen zum Datenschutz: <KontaktAdresse />
        </p>
        <p>
          Für die Daten der Spieler:innen ist der Verein verantwortlich, der sie in KiFu führt. KiFu bearbeitet
          diese Daten in seinem Auftrag: nur, damit der Verein und seine Teams KiFu nutzen können, und nie für
          eigene Zwecke.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Konten von Trainer:innen und Vereinsverwaltung">
        <p>Wer ein Konto hat, gibt KiFu:</p>
        <ul>
          <li>die E-Mail-Adresse und das Passwort (nur verschlüsselt gespeichert) für die Anmeldung,</li>
          <li>einen Anzeigenamen; die anderen Mitglieder eines Teams sehen ihn und die E-Mail-Adresse,</li>
          <li>
            was man in KiFu anlegt: Übungen, Trainings, Bilder, Teams, Termine, Zuteilungen, Kalender-Abos und
            Zugänge für KI-Assistenten.
          </li>
        </ul>
        <p>
          Wozu: damit KiFu funktioniert — anmelden, planen, im Team und im Verein zusammenarbeiten. Wie lange: bis
          das Konto gelöscht wird. Dann verschwindet, was privat war. Was in der Community steht, bleibt ohne
          Bezug zur Person; an vergangenen Terminen bleibt ein Eintrag ohne Namen. Teams und Verein bleiben, wenn
          ihnen weitere Personen angehören.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Spieler:innen und Eltern am privaten Link">
        <p>Im Auftrag des Vereins bearbeitet KiFu zu jeder Spieler:in:</p>
        <ul>
          <li>Vorname, Nachname, Jahrgang und, wenn erfasst, die J+S-Nummer,</li>
          <li>die Teams und Kader, denen sie zugeordnet ist,</li>
          <li>
            Ab- und Anmeldungen mit Kommentar und Zeitpunkt, Aufgebote, Anwesenheit und ein allfälliges
            Schnuppertraining.
          </li>
        </ul>
        <p>
          Wozu: damit das Team weiss, wer an Trainings und Spielen dabei ist, und Spieler:innen und Eltern ohne
          Konto ab- und anmelden können. Wie lange: solange der Verein die Spieler:in führt. Die Vereinsverwaltung kann sie
          jederzeit löschen; mit dem Verein werden alle seine Spieler:innen gelöscht. Benachrichtigungen am
          privaten Link bewahrt KiFu {BENACHRICHTIGUNG_TAGE} Tage auf.
        </p>
        <p>
          Spieler:innen und Eltern brauchen kein Konto. Wer am privaten Link Mitteilungen aufs Mobile einschaltet, gibt KiFu die
          Zustelladresse dieses Geräts; sie gilt, bis die Mitteilungen ausgeschaltet werden.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Fragen und Feedback">
        <p>
          Was du unter «Fragen und Feedback» schreibst, bewahrt KiFu samt Zusammenfassung auf, um Fehler zu beheben
          und KiFu zu verbessern. Nach {AUFBEWAHRUNG_MONATE} Monaten wird es gelöscht.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Besuch der Website">
        <p>
          Wie oft welche Seite aufgerufen wird, zählt KiFu mit Vercel Web Analytics. Die Statistik erhält die Seite
          ohne Suchbegriffe und Filter, die Herkunft, das Land und den Gerätetyp; sie weiss nicht, wer du bist, und
          legt nichts in deinem Browser ab. Seiten hinter einem privaten Link zählt sie nicht. Für Betrieb und
          Sicherheit führen die Dienste, bei denen KiFu läuft, technische Protokolle der Aufrufe.
        </p>
        <p>
          Was KiFu in deinem Browser speichert, wozu und wie lange, steht auf der Seite{" "}
          <TextLink href="/cookies">Cookies</TextLink>.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Wo die Daten liegen">
        <p>
          Die Datenbank mit Anmeldung und Bildern liegt bei Supabase in Paris (Frankreich), die Anwendung läuft bei
          Vercel ebenfalls in Paris. Ausserhalb davon erhalten Daten nur:
        </p>
        <ul>
          <li>
            <strong>Fragen und Feedback:</strong> Das Gespräch führt ein KI-Modell von Anthropic in den USA.
          </li>
          <li>
            <strong>Mitteilungen aufs Mobile:</strong> Sie werden über die Dienste der Gerätehersteller und
            Browser zugestellt (zum Beispiel Apple, Google oder Mozilla).
          </li>
          <li>
            <strong>KI-Assistenten, die du selbst verbindest:</strong> Sie erhalten, was du sie in KiFu lesen oder
            ändern lässt; dafür gelten die Bedingungen ihres Anbieters.
          </li>
          <li>
            <strong>Kalender, die du selbst abonnierst:</strong> Dein Kalenderdienst holt die Termine deines Teams
            regelmässig bei KiFu ab.
          </li>
        </ul>
        <p>
          E-Mails zur Anmeldung verschickt ein E-Mail-Dienst <Platzhalter>[Anbieter und Ort ergänzen]</Platzhalter>.
          Für Tests übernimmt der Betrieb eine Kopie der Daten in eine getrennte Testumgebung{" "}
          <Platzhalter>[Ort und Umfang ergänzen]</Platzhalter>.
        </p>
      </RechtsAbschnitt>

      <RechtsAbschnitt titel="Deine Rechte">
        <p>
          Du kannst Auskunft über deine Daten verlangen, sie berichtigen oder löschen lassen und eine Kopie
          verlangen. Dafür brauchst du kein Konto: Schreib an <KontaktAdresse />. Damit wir keine Daten an die
          falsche Person geben, fragen wir nach, wer du bist{" "}
          <Platzhalter>[Vorgehen zum Ausweisen ergänzen]</Platzhalter>.
        </p>
        <p>
          Betrifft die Anfrage die Daten einer Spieler:in, leiten wir sie an den Verein weiter, der sie in KiFu
          führt. Du kannst dich auch direkt an das Team oder den Verein wenden.
        </p>
        <p>
          Mit Konto änderst du deinen Anzeigenamen selbst und löschst dein Konto unter «Konto › Daten und Konto».
        </p>
        <p>
          Bist du mit unserer Antwort nicht einverstanden, kannst du dich an den Eidgenössischen Datenschutz- und
          Öffentlichkeitsbeauftragten (EDÖB) wenden.
        </p>
      </RechtsAbschnitt>
    </RechtsSeite>
  );
}
