import {
  BellRing,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  Code2,
  MapPin,
  Sparkles,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { ButtonLink, Card, ExerciseCard, ExternerLink, Lozenge, SectionMessage, type ExerciseCardData } from "@/components/ui";
import { KONTO_TRAININGS_MAX, KONTO_UEBUNGEN_MAX } from "@/lib/konto-grenzen";
import {
  BEISPIEL_NAMEN,
  GEPLANTER_PREIS_CHF,
  KONTO_GELOESCHT_TEXT,
  MANUAL_UEBUNGEN_ANZAHL,
  REPO_URL,
  SFV_HINWEIS,
} from "@/lib/startseite";

/* Die Startseite (#670): was KiFu für Verein, Team und Training leistet, für
   Trainer:innen und Vereinsverwaltungen, die KiFu noch nicht kennen. Eine
   Komponente für «/» (ohne Anmeldung) und «/startseite» (bewusst, auch
   angemeldet, #671 AK 1). Immer hell — das setzt das Layout der Gruppe
   `(start)`.

   Jede Aussage entspricht dem Stand der Anwendung (Epic #668 EK 3); die
   festen Angaben (Zahl der Manual-Übungen, Beispiele, Preis, Hinweis zum SFV)
   stehen in lib/startseite.ts und werden dort geprüft. Namen im Bild sind
   erfunden (AK 14). */
export function Startseite({
  beispiele,
  kontoGeloescht,
  angemeldet,
}: {
  /** Die Manual-Beispiele als Karten; leer, wenn sie nicht zu lesen waren. */
  beispiele: ExerciseCardData[];
  /** Nach «Konto löschen» (PC 2): die Bestätigung oben. */
  kontoGeloescht: boolean;
  /** Angemeldet (über «/startseite»): statt Registrieren der Weg zurück. */
  angemeldet: boolean;
}) {
  return (
    <>
      {kontoGeloescht && (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <SectionMessage appearance="success">
            {KONTO_GELOESCHT_TEXT}
          </SectionMessage>
        </div>
      )}

      {/* Einstieg: wofür KiFu da ist, und der Weg hinein (AK 2, 3). */}
      <section aria-labelledby="start-titel" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
        <div>
          <p className="type-label-large text-primary">Kinder- und Juniorenfussball</p>
          <h1 id="start-titel" className="type-display-small mt-3 text-on-surface sm:type-display-medium">
            Verein, Team und Training an einem Ort
          </h1>
          <p className="type-body-large mt-4 max-w-xl text-on-surface-mittel">
            KiFu organisiert Teams, Termine und Abmeldungen und hilft beim Planen der Trainings. Für die
            Vereinsverwaltung und das Trainerteam — Spieler:innen und Eltern melden sich ohne Konto über einen
            privaten Link ab.
          </p>
          <p className="type-title-medium mt-4 text-on-surface">Mehr Fussball. Weniger Bürokratie.</p>
          <EinstiegKnoepfe angemeldet={angemeldet} className="mt-8" />
        </div>
        <TerminBild />
      </section>

      {/* Was KiFu leistet (AK 2). */}
      <section aria-labelledby="leistung-titel" className="bg-elev-01">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 id="leistung-titel" className="type-headline-medium text-on-surface">
            Was KiFu für euch erledigt
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Leistung icon={Building2} titel="Verein">
              Die Vereinsverwaltung legt Teams an, führt die Spieler:innen des Vereins an einem Ort und nimmt
              Trainer:innen auf. Spieler:innen können in mehreren Teams sein.
            </Leistung>
            <Leistung icon={CalendarDays} titel="Team und Kalender">
              Trainings und Spiele als Einzeltermin oder Serie, mit Ort, Treffpunkt und Trainer:innen. Den Kalender
              abonniert ihr in eurer Kalender-App.
            </Leistung>
            <Leistung icon={UserCheck} titel="Abmeldungen ohne Konto">
              Jede Spieler:in hat einen privaten Link. Darüber melden sich Spieler:innen und Eltern ab und an — ihr
              seht vor dem Training, wer kommt.
            </Leistung>
            <Leistung icon={Sparkles} titel="Schnuppertraining">
              Wer den Verein ausprobiert, meldet sich über den Link selbst für Trainings an, bis zur Anzahl
              Schnuppertrainings, die ihr festlegt.
            </Leistung>
            <Leistung icon={BellRing} titel="Mitteilungen aufs Mobile">
              Spieler:innen und Eltern legen den Link als App ab und erhalten eine Mitteilung, wenn ein Training
              ausfällt, verlegt wird oder ein neues Spiel ansteht.
            </Leistung>
            <Leistung icon={ClipboardList} titel="Training und Übungen">
              Trainings nach den Trainingsschemata für Kinder- und Juniorenfussball zusammenstellen, Übungen mit
              Feld-Diagramm erfassen, auf dem Platz durchführen oder drucken.
            </Leistung>
            <Leistung icon={Bot} titel="KI-Assistent" className="sm:col-span-2 lg:col-span-3">
              Verbinde deinen KI-Assistenten, etwa Claude, mit KiFu: Er stellt Trainings zusammen, legt Termine an
              und pflegt die Spielerliste — mit deinen Rechten und nur, wenn du es erlaubst.
            </Leistung>
          </div>
        </div>
      </section>

      {/* Welche Übungen KiFu mitbringt (AK 4–6). */}
      <section aria-labelledby="uebungen-titel" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="uebungen-titel" className="type-headline-medium text-on-surface">
          {MANUAL_UEBUNGEN_ANZAHL} Übungen aus dem Manual Kinderfussball
        </h2>
        <p className="type-body-large mt-3 max-w-3xl text-on-surface-mittel">
          KiFu unterstützt den Kinderfussball (G, F, E) und den Juniorenfussball (D, C, B, A). Die Übungen aus dem
          Manual decken den Kinderfussball ab; für den Juniorenfussball erfasst ihr eigene Übungen und teilt sie in
          der Community.
        </p>
        <p className="type-body-medium mt-2 text-on-surface-tief">{SFV_HINWEIS}</p>
        {beispiele.length > 0 && (
          <ul className="mt-8 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-4 p-0">
            {beispiele.map((ex) => (
              <li key={ex.slug}>
                <ExerciseCard ex={ex} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* So geht es los, und was es kostet (AK 7, 8; Epic #668 EK 5). */}
      <section aria-labelledby="start-weg-titel" className="bg-elev-01">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 id="start-weg-titel" className="type-headline-medium text-on-surface">
              So startest du
            </h2>
            <ol className="mt-6 flex list-none flex-col gap-5 p-0">
              <Schritt nummer={1} titel="Konto erstellen">
                Mit E-Mail-Adresse und Passwort, ohne Einladung.
              </Schritt>
              <Schritt nummer={2} titel="Verein gründen oder aufnehmen lassen">
                Gründe deinen Verein und werde seine erste Person der Verwaltung — oder gib deine E-Mail-Adresse der
                Vereinsverwaltung oder den Trainer:innen eines Teams, damit sie dich aufnehmen.
              </Schritt>
              <Schritt nummer={3} titel="Teams und Spieler:innen anlegen">
                Teams anlegen, Spieler:innen aufnehmen, Termine planen und den privaten Link verteilen.
              </Schritt>
            </ol>
          </div>
          <div id="preis">
            <h2 className="type-headline-medium text-on-surface">Was es kostet</h2>
            <Card className="mt-6 bg-elev-00 p-5 sm:p-6">
              <p className="flex items-center gap-2">
                <Lozenge appearance="success">Heute gratis</Lozenge>
              </p>
              <p className="type-body-large mt-3 text-on-surface">
                KiFu ist heute gratis. Nach Einführung des Preismodells sind CHF {GEPLANTER_PREIS_CHF} pro Team und
                Monat geplant.
              </p>
              <p className="type-body-medium mt-3 text-on-surface-mittel">
                Ein Konto ohne Verein bleibt gratis. Es hat höchstens {KONTO_UEBUNGEN_MAX} eigene Übungen und{" "}
                {KONTO_TRAININGS_MAX} eigene Trainings; Teams, Spielerlisten und Kalender gibt es im Verein.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Offen und nah (AK 9). */}
      <section aria-labelledby="offen-titel" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 id="offen-titel" className="type-headline-medium text-on-surface">
          Offen und in Europa
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Leistung icon={Code2} titel="Open Source">
            Der Code von KiFu steht offen auf <ExternerLink href={REPO_URL}>GitHub</ExternerLink> (Lizenz CC BY-SA
            4.0). Ein Verein kann KiFu auch selbst betreiben.
          </Leistung>
          <Leistung icon={MapPin} titel="Wo die Daten liegen">
            Die Daten deines Teams liegen in einer Datenbank in Paris, die Anwendung läuft ebenfalls dort. Ausnahmen:
            «Fragen und Feedback» beantwortet ein KI-Dienst in den USA, Mitteilungen aufs Mobile stellen die Dienste
            der Gerätehersteller zu.
          </Leistung>
        </div>
      </section>

      {/* Zum Schluss noch einmal der Weg hinein (AK 3). */}
      <section aria-labelledby="schluss-titel" className="bg-elev-01">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 sm:px-6">
          <h2 id="schluss-titel" className="type-headline-medium text-on-surface">
            {angemeldet ? "Weiter mit deiner Arbeit" : "Bereit für die nächste Saison?"}
          </h2>
          <EinstiegKnoepfe angemeldet={angemeldet} />
        </div>
      </section>
    </>
  );
}

function EinstiegKnoepfe({ angemeldet, className }: { angemeldet: boolean; className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className ?? ""}`}>
      {angemeldet ? (
        <ButtonLink href="/" variant="filled">
          Zur App
        </ButtonLink>
      ) : (
        <>
          <ButtonLink href="/registrieren" variant="filled">
            Kostenlos registrieren
          </ButtonLink>
          <ButtonLink href="/login" variant="outlined">
            Anmelden
          </ButtonLink>
        </>
      )}
    </div>
  );
}

function Leistung({
  icon: Icon,
  titel,
  children,
  className,
}: {
  icon: LucideIcon;
  titel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-3 bg-elev-00 p-5 ${className ?? ""}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full betont text-on-surface">
        <Icon size={20} strokeWidth={2} aria-hidden />
      </span>
      <h3 className="type-title-large text-on-surface">{titel}</h3>
      <p className="type-body-medium text-on-surface-mittel">{children}</p>
    </Card>
  );
}

function Schritt({ nummer, titel, children }: { nummer: number; titel: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="type-title-medium flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
      >
        {nummer}
      </span>
      <div>
        <h3 className="type-title-medium text-on-surface">
          <span className="sr-only">Schritt {nummer}: </span>
          {titel}
        </h3>
        <p className="type-body-medium mt-1 text-on-surface-mittel">{children}</p>
      </div>
    </li>
  );
}

/* Das Bild neben dem Einstieg: ein Training, wie das Trainerteam es im
   Trainingsplan sieht — mit erfundenen Namen (AK 14). Reine Darstellung,
   für die Sprachausgabe als Bild beschrieben. */
function TerminBild() {
  const n = BEISPIEL_NAMEN;
  const [lena, noah, mia, elias] = n.spieler;
  return (
    <figure className="m-0">
      <Card
        role="img"
        aria-label={`Beispiel: das nächste Training des Teams ${n.team} im Verein «${n.verein}», 11 von 14 Spieler:innen angemeldet, ${mia} hat sich abgemeldet.`}
        className="p-5 shadow-sm sm:p-6"
      >
        <div aria-hidden>
          <p className="type-label-medium text-on-surface-mittel">
            {n.verein} · {n.team}
          </p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <p className="type-label-large text-primary">Als Nächstes</p>
              <p className="type-title-large mt-1 text-on-surface">Training · Mittwoch</p>
              <p className="type-body-medium mt-1 text-on-surface-mittel">17:30–19:00 · {n.ort}</p>
            </div>
            <Lozenge appearance="success">11/14</Lozenge>
          </div>
          <ul className="mt-5 flex list-none flex-col gap-2 p-0">
            <Zeile name={lena} status="Angemeldet" />
            <Zeile name={noah} status="Angemeldet" />
            <Zeile name={mia} status="Abgemeldet" />
            <Zeile name={elias} status="Schnuppern 1/4" />
          </ul>
        </div>
      </Card>
    </figure>
  );
}

function Zeile({ name, status }: { name: string; status: "Angemeldet" | "Abgemeldet" | "Schnuppern 1/4" }) {
  const ton = status === "Abgemeldet" ? "neutral" : status === "Angemeldet" ? "success" : "discovery";
  return (
    <li className="flex items-center justify-between gap-3 rounded-flaeche bg-elev-00 px-3 py-2">
      <span className="type-body-medium text-on-surface">{name}</span>
      <Lozenge appearance={ton}>{status}</Lozenge>
    </li>
  );
}
