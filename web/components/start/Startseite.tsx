import {
  Bell,
  BookOpen,
  Bot,
  CalendarCheck,
  Check,
  ClipboardList,
  Info,
  Lock,
  Package,
  Shield,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ButtonLink, ExerciseCard, ExternerLink, SectionMessage, type ExerciseCardData } from "@/components/ui";
import { KiGespraeche, PrivaterLink, Spielerliste, TerminStand } from "@/components/start/StartBilder";
import { TextLink } from "@/components/start/RechtsSeite";
import { VORSCHAU_CLAIM } from "@/lib/auffindbar";
import { cn } from "@/lib/cn";
import { KONTO_TRAININGS_MAX, KONTO_UEBUNGEN_MAX } from "@/lib/konto-grenzen";
import { DATENSCHUTZ_PFAD } from "@/lib/rechtliches";
import { SPIELER_MAX } from "@/lib/spieler";
import {
  GEPLANTER_PREIS_CHF,
  KONTO_GELOESCHT_TEXT,
  MANUAL_UEBUNGEN_ANZAHL,
  UEBUNGEN_RUND,
  NUR_MIT_KONTO_TEXT,
  REPO_URL,
  SFV_HINWEIS,
} from "@/lib/startseite";
import { VEREIN_SPIELER_MAX, VEREIN_TEAMS_MAX } from "@/lib/verein";
import { loginAdresse } from "@/lib/weiterleitung";

/* Die Startseite (#670) nach dem Gestaltungsentwurf des Product Owners
   (Artboard «Startseite (nicht angemeldet)»): Aufbau, Abschnitte, Texte und
   Bilder wie dort. Eine Komponente für «/» (ohne Anmeldung) und
   «/startseite» (bewusst, auch angemeldet, #671 AK 1). Immer hell — das
   setzt das Layout der Gruppe `(start)`.

   Die Texte stehen wörtlich wie im Entwurf (PO-Entscheid); der Name ist
   «KiFu». Zahlen mit einer Quelle im Code (Manual-Übungen, Preis, Grenzen)
   kommen aus dieser Quelle. Der SFV steht nur im SFV_HINWEIS (Epic #668
   EK 12), darum fehlt er in den Sätzen des Entwurfs, die ihn nennen. Namen
   in den Bildern sind erfunden (AK 14; «FC Seewil» statt «FC Seefeld»).

   Bewusst anders als der Entwurf (dem PO gemeldet):
   - «Spieler:innen und Eltern» statt «Die Eltern» im Titel von «Team und
     Kalender» (#659: nie nur für Eltern).
   - Unter den Beispielen die Zahl der Manual-Übungen und der SFV-Hinweis
     (AK 4, 5); unter «Aus der Schweiz» der Verweis auf die Ausnahmen zum
     Datenort in der Datenschutzerklärung (AK 9).
   - «Material · bald» ist kein Link: Es gibt noch kein Ziel.
   - Form aus dem Kit: Radien (`rounded-dialog`, Knöpfe `rounded-flaeche`)
     und die Typo-Rollen statt der Pillen, Rundungen und Pixelgrössen des
     Entwurfs. Die Farben des Entwurfs stehen in der Startseiten-Palette. */

/** Wo man den KI-Assistenten verbindet (nur mit Konto). */
const VERBINDUNGEN_PFAD = "/konto/verbindungen";

/* Die Pastellflächen des Entwurfs: die Startseiten-Palette in globals.css
   (`.start-palette`, gesetzt vom Layout der Gruppe; Begründung dort). */
const PASTELL = {
  verein: "bg-(--start-verein)",
  team: "bg-(--start-team)",
  training: "bg-(--start-training)",
  ki: "bg-(--start-ki)",
} as const;

/** Die Kacheln unter dem Einstieg: je ein Bereich, ein Sprung zu seinem
 *  Abschnitt. Fläche und Zeichen in den Tönen des Entwurfs. */
const FUNKTIONEN: { label: string; ziel: string; icon: LucideIcon; ton: string }[] = [
  { label: "Verein", ziel: "#verein", icon: Shield, ton: `${PASTELL.verein} text-on-surface-mittel` },
  { label: "Team", ziel: "#team", icon: Users, ton: `${PASTELL.team} text-primary` },
  { label: "Kalender", ziel: "#team", icon: CalendarCheck, ton: "bg-(--start-kalender) text-(--start-on-kalender)" },
  { label: "Schnuppern", ziel: "#team", icon: UserPlus, ton: "bg-(--start-schnuppern) text-(--start-on-schnuppern)" },
  { label: "Mitteilungen", ziel: "#team", icon: Bell, ton: "bg-(--start-mitteilungen) text-(--start-on-mitteilungen)" },
  { label: "Training", ziel: "#training", icon: ClipboardList, ton: `${PASTELL.training} text-(--start-on-training)` },
  { label: "Übungen", ziel: "#training", icon: BookOpen, ton: "bg-(--start-uebungen) text-(--start-on-uebungen)" },
  { label: "KI-Assistent", ziel: "#ki", icon: Bot, ton: `${PASTELL.ki} text-(--start-on-ki)` },
];

/** Die vier Werkzeuge, die KiFu in einem vereint. */
const KOMBINATION: { titel: string; text: string; sonst: string; flaeche: string }[] = [
  {
    titel: "Vereinsverwaltung",
    text: "Teams und Trainer:innen führen, ein Spielerbestand für alle Teams, Import aus ClubCorner.",
    sonst: "sonst: eine Vereins-App",
    flaeche: PASTELL.verein,
  },
  {
    titel: "Teamverwaltung",
    text: "Kader, Termine, Spiele, Abmeldungen ohne Konto, Benachrichtigungen, Kalender-Abo.",
    sonst: "sonst: eine Team-App",
    flaeche: PASTELL.team,
  },
  {
    titel: "Trainingsvorbereitung",
    text: "Nach Trainingsschema bis zur Übung, mit Feld-Diagramm und Material.",
    sonst: "sonst: eine Trainings-App",
    flaeche: PASTELL.training,
  },
  {
    titel: "KI-Assistent",
    text: "Trägt Spiele ein, stellt Trainings zusammen – direkt in deinem Plan.",
    sonst: "sonst: nirgends",
    flaeche: PASTELL.ki,
  },
];

export function Startseite({
  beispiele,
  kontoGeloescht,
  nurMitKonto,
  angemeldet,
}: {
  /** Die Manual-Beispiele als Karten; leer, wenn sie nicht zu lesen waren. */
  beispiele: ExerciseCardData[];
  /** Nach «Konto löschen» (PC 2): die Bestätigung oben. */
  kontoGeloescht: boolean;
  /** Nach einem Verweis auf Übung, Training oder Katalog ohne Anmeldung
   *  (#669 PC 1): das Ziel des Verweises, sonst `null`. Der Hinweis oben
   *  führt über die Anmeldung dorthin zurück (PC 2). */
  nurMitKonto: string | null;
  /** Angemeldet (über «/startseite»): statt Registrieren der Weg zurück. */
  angemeldet: boolean;
}) {
  return (
    <>
      {nurMitKonto && (
        <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
          <SectionMessage
            icon={Lock}
            actions={
              <>
                <ButtonLink href={loginAdresse(nurMitKonto, "")} variant="link">
                  Anmelden
                </ButtonLink>
                <ButtonLink href="/registrieren" variant="link">
                  Kostenlos registrieren
                </ButtonLink>
              </>
            }
          >
            {NUR_MIT_KONTO_TEXT}
          </SectionMessage>
        </div>
      )}

      {kontoGeloescht && (
        <div className="mx-auto max-w-[1200px] px-4 pt-6 sm:px-6">
          <SectionMessage appearance="success">
            {KONTO_GELOESCHT_TEXT}
          </SectionMessage>
        </div>
      )}

      {/* Einstieg: der Claim, wofür KiFu da ist, und der Weg hinein (AK 2, 3). */}
      <section
        aria-labelledby="start-titel"
        className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-4 pb-10 pt-12 text-center sm:px-6 sm:pt-[72px]"
      >
        <h1 id="start-titel" className="type-display-small text-on-surface sm:type-display-large">
          {VORSCHAU_CLAIM.split(/(?<=\.) /).map((satz) => (
            <span key={satz} className="block">
              {satz}
            </span>
          ))}
        </h1>
        <p className="type-body-large max-w-[640px] text-on-surface-mittel">
          Verein, Teams, Termine, Abmeldungen und Trainings an einem Ort – und dein KI-Assistent erledigt die
          Vorarbeit. Für Trainer:innen und Vereine im Schweizer Kinder- und Juniorenfussball.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Registrieren angemeldet={angemeldet} />
        </div>
        <p className="type-body-medium text-on-surface-mittel">
          Heute gratis, ohne Einladung: registrieren, Verein gründen oder dich von deinem Team aufnehmen lassen.
        </p>
      </section>

      {/* Die Bereiche auf einen Blick, je ein Sprung zum Abschnitt. */}
      <nav
        id="funktionen"
        aria-label="Funktionen"
        className="mx-auto max-w-[1200px] scroll-mt-24 px-4 pb-[88px] pt-6 sm:px-6"
      >
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-3 p-0 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))]">
          {FUNKTIONEN.map((f) => (
            <li key={f.label}>
              <a
                href={f.ziel}
                className="state focus-ring flex h-full flex-col items-center gap-3 rounded-dialog border border-linie px-3 py-5 text-on-surface"
              >
                <Kachelzeichen icon={f.icon} ton={f.ton} />
                <span className="type-title-small">{f.label}</span>
              </a>
            </li>
          ))}
          {/* Kommt erst: kein Sprungziel, darum kein Link. */}
          <li className="flex flex-col items-center gap-3 rounded-dialog border border-dashed border-kante px-3 py-5 text-on-surface">
            <Kachelzeichen icon={Package} ton="betont text-on-surface-mittel" />
            <span className="type-title-small">
              Material <span className="font-medium text-on-surface-mittel">·&nbsp;bald</span>
            </span>
          </li>
        </ul>
      </nav>

      {/* Alles in einem Werkzeug. */}
      <section
        aria-labelledby="kombination"
        className="mx-auto flex max-w-[1200px] flex-col items-center gap-5 px-4 pb-24 text-center sm:px-6"
      >
        <span className="type-title-small text-primary">Alles in einem Werkzeug</span>
        <h2 id="kombination" className="type-headline-large max-w-[860px] text-on-surface sm:type-display-small">
          Andere führen deinen Verein. Andere organisieren dein Team. Andere planen Trainings. KiFu macht alles – mit
          KI.
        </h2>
        <p className="type-body-large max-w-[680px] text-on-surface-mittel">
          Verein, Team und Trainingsvorbereitung in einem Werkzeug, dazu ein KI-Assistent, der überall mitarbeitet. Das
          gibt es sonst nirgends – und niemand wechselt zwischen vier Apps oder pflegt dieselbe Spielerliste zweimal.
        </p>
        <ul className="m-0 mt-4 flex w-full list-none flex-wrap items-stretch justify-center gap-4 p-0">
          {/* Jedes Werkzeug ist ein Eintrag; das «+» dazwischen ist ein eigener,
              verborgener Eintrag — so bleibt die Liste vier Einträge lang (kein
              `display: contents` am li, das in WebKit die Rolle nimmt). */}
          {KOMBINATION.flatMap((k, i) => [
            ...(i > 0
              ? [
                  <li
                    key={`plus-${k.titel}`}
                    aria-hidden
                    className="type-headline-large w-full self-center text-center text-primary sm:w-auto"
                  >
                    +
                  </li>,
                ]
              : []),
            <li
              key={k.titel}
              className={cn(
                "flex min-w-0 max-w-[248px] flex-[1_1_200px] flex-col gap-2 rounded-dialog p-6 text-left",
                k.flaeche,
              )}
            >
              <h3 className="type-title-medium text-on-surface">{k.titel}</h3>
              <p className="type-body-medium text-on-surface-mittel">{k.text}</p>
              <p className="type-body-small mt-auto text-on-surface-mittel">{k.sonst}</p>
            </li>,
          ])}
        </ul>
      </section>

      {/* KI-Assistent. */}
      <section id="ki" aria-labelledby="ki-titel" className="scroll-mt-24 bg-elev-00">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-16 sm:px-6 sm:py-[88px] lg:flex-row lg:items-start">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-[1_1_360px]">
            <span className="type-title-small text-primary">KI-Assistent</span>
            <h2 id="ki-titel" className="type-headline-large text-on-surface sm:type-display-small">
              Sagen, was du brauchst. Erledigt.
            </h2>
            <p className="type-body-large text-on-surface-mittel">
              Verbinde KiFu mit deinem KI-Assistenten (MCP). Er kennt dein Team, deine Termine und die Übungen der
              Community und trägt alles direkt in deinen Trainingsplan ein. Du prüfst, passt an und gehst auf den Platz.
            </p>
            {/* Verbinden geht nur mit Konto: Ohne Anmeldung fehlt der Verweis (PO). */}
            {angemeldet && (
              <p className="type-title-small">
                <ButtonLink href={VERBINDUNGEN_PFAD} variant="link">
                  So verbindest du ihn
                </ButtonLink>
              </p>
            )}
          </div>
          <div className="min-w-0 lg:flex-[1_1_560px]">
            <KiGespraeche />
          </div>
        </div>
      </section>

      {/* Verein. */}
      <section id="verein" aria-labelledby="verein-titel" className="scroll-mt-24">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
          <Kopf eyebrow="Verein" id="verein-titel" titel="In einem Abend vom Verein zu allen Teams.">
            Vier Schritte, und jedes Team arbeitet mit derselben Spielerliste. Keine Kopien, keine verwaisten Listen nach
            dem Teamwechsel.
          </Kopf>
          <div className={cn("flex flex-col gap-8 rounded-dialog p-5 sm:p-10", PASTELL.verein)}>
            <ol className="m-0 grid list-none gap-x-10 gap-y-6 p-0 md:grid-cols-2">
              <Schritt nummer={1} titel="Verein gründen">
                Namen eingeben, bestätigen – du bist die erste Person der Vereinsverwaltung.
              </Schritt>
              <Schritt nummer={2} titel="Spielerliste aus ClubCorner holen">
                Die CSV-Datei einmal importieren; KiFu gleicht mit dem ganzen Verein ab.
              </Schritt>
              <Schritt nummer={3} titel="Teams anlegen und zuordnen">
                Trainer:innen über ihre E-Mail aufnehmen, Spieler:innen einem oder mehreren Teams zuordnen.
              </Schritt>
              <Schritt nummer={4} titel="Jede Spieler:in hat ihren Link">
                Ein Link für alle ihre Teams – die Familie meldet sich überall am selben Ort ab.
              </Schritt>
            </ol>
            <Spielerliste />
          </div>
        </div>
      </section>

      {/* Team und Kalender. */}
      <section id="team" aria-labelledby="team-titel" className="scroll-mt-24">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
          {/* Entwurf: «Die Eltern wissen, was läuft.» Angaben am privaten Link
              richten sich nie nur an Eltern (#659 AK 1–3, Wächter in check:kern). */}
          <Kopf eyebrow="Team und Kalender" id="team-titel" titel="Du weisst, wer kommt. Spieler:innen und Eltern wissen, was läuft.">
            Ein Termin, zwei Seiten: Du planst und siehst den Stand, Spieler:innen und Eltern melden sich ab und erfahren
            jede Änderung – ohne Konto, ohne Gruppenchat.
          </Kopf>
          <div className="grid gap-8 lg:grid-cols-2">
            <Seite
              flaeche={PASTELL.team}
              eyebrow="Für dich und dein Trainerteam"
              titel="Nie mehr «Wer kommt am Dienstag?» im Chat."
              punkte={[
                "Wer angemeldet ist, steht im Termin, nach Status gruppiert – beim Spiel mit Richtwert",
                "Trainings als Serie, Spiele mit Meldefrist und Aufgebot",
                "Ab Beginn «Da / Nicht da» nachtragen",
                "Ein Stand fürs ganze Trainerteam",
              ]}
            >
              <TerminStand />
            </Seite>
            <Seite
              flaeche={PASTELL.training}
              eyebrow="Für Spieler:innen und Eltern"
              titel="Informiert, bevor du schreibst."
              punkte={[
                "Ein privater Link für alle Teams, ganz ohne Konto",
                "Als App aufs Mobile, mit Mitteilung bei Ausfall oder Verlegung",
                "Treffpunkt, Infos zum Team und Kalender-Abo",
                "Abmelden bis zur Meldefrist",
              ]}
            >
              <PrivaterLink />
            </Seite>
          </div>
        </div>
      </section>

      {/* Training und Übungen: die Beispiele aus dem Manual (AK 4–6). */}
      <section id="training" aria-labelledby="training-titel" className="scroll-mt-24">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-4 py-16 sm:px-6 sm:py-24">
          <Kopf eyebrow="Training und Übungen" id="training-titel" titel="Am Sonntag vorbereitet. Am Dienstag auf dem Platz.">
            Trainings nach dem Trainingsschema zusammenstellen und auf dem Platz Schritt für Schritt durchführen – mit
            Feld-Diagramm statt Zettel.
          </Kopf>
          {beispiele.length > 0 && (
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {beispiele.map((ex) => (
                <li key={ex.slug} className="rounded-flaeche ring-1 ring-linie">
                  <ExerciseCard ex={ex} ohneLink />
                </li>
              ))}
            </ul>
          )}
          {/* Kein Weg in den Katalog (PO): Ohne Konto gibt es ihn nicht, angemeldet führt «Zur App» hinein. */}
          <p className="type-body-medium text-on-surface-mittel">
            Rund {UEBUNGEN_RUND} Übungen, und es werden laufend mehr: {MANUAL_UEBUNGEN_ANZAHL} Übungen aus dem Manual Kinderfussball, die übrigen hat die Community beigesteuert. {SFV_HINWEIS}
          </p>
        </div>
      </section>

      {/* Grundlegend anders (AK 9: Open Source, selbst betreibbar, Datenort). */}
      <section aria-labelledby="anders-titel" className="umkehr [--color-umkehr:var(--start-dunkel)]">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-16 sm:px-6 sm:py-[88px]">
          <div className="flex max-w-[720px] flex-col gap-3">
            <h2 id="anders-titel" className="type-headline-large sm:type-display-small">
              Grundlegend anders
            </h2>
            <p className="type-body-large text-on-umkehr/80">
              Von Trainer:innen für Trainer:innen gebaut. Nicht, um Daten zu verkaufen, sondern damit mehr Zeit für den
              Fussball bleibt.
            </p>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-8">
            <Grundsatz titel="Faire Preise, kein Gewinn">
              Die Preise decken die Kosten und die Weiterentwicklung. Jeder Franken fliesst zurück in KiFu.
            </Grundsatz>
            <Grundsatz titel="Open Source">
              Der ganze Code ist offen. Jede:r kann nachsehen, was mit den Daten des Teams geschieht – und KiFu auch selbst
              betreiben, etwa auf dem Server des eigenen Vereins.
            </Grundsatz>
            <Grundsatz titel="Aus der Schweiz">
              Gemacht für den Schweizer Fussball. Die Daten liegen in Europa.{" "}
              <TextLink href={DATENSCHUTZ_PFAD}>Alle Ausnahmen in der Datenschutzerklärung</TextLink>
            </Grundsatz>
            <Grundsatz titel="Daten der Spieler:innen geschützt">
              Spieler:innen und Eltern brauchen kein Konto. Nur das Trainerteam sieht, wer sich abgemeldet hat, und den
              Kader kennt nur das Team.
            </Grundsatz>
            <Grundsatz titel="Im Dialog mit euch">
              Das Entwicklungsteam arbeitet offen mit der Community: Melde Fehler, wünsch dir Funktionen oder bring selbst
              einen Pull Request ein. Was Trainer:innen brauchen, bestimmt, was als Nächstes kommt.
              {/* Weiss wie im Entwurf: Primary ist hier die Schrift der Fläche. */}
              <span className="type-title-small mt-2 block [--color-primary:var(--color-on-umkehr)]">
                <ExternerLink href={REPO_URL}>Auf GitHub mitreden</ExternerLink>
              </span>
            </Grundsatz>
          </div>
        </div>
      </section>

      {/* Preise (AK 7, 8; Epic #668 EK 5): heute gratis, geplanter Preis, Grenzen aus der einen Quelle. */}
      <section
        id="preise"
        aria-labelledby="preise-titel"
        className="mx-auto flex max-w-[1200px] scroll-mt-24 flex-col items-center gap-4 px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-[88px]"
      >
        <span className="type-title-small text-primary">Preise</span>
        <h2 id="preise-titel" className="type-headline-large text-on-surface sm:type-display-small">
          Heute gratis. Später fair pro Team.
        </h2>
        <p className="type-body-large max-w-[600px] text-on-surface-mittel">
          Du bezahlst pro Team. Die Preise decken Betrieb und Weiterentwicklung – kein Gewinn, jeder Franken fliesst
          zurück.
        </p>
        <SectionMessage appearance="discovery" icon={Info} className="mt-4 w-full max-w-[800px] text-left">
          <strong className="font-semibold">Offen für alle.</strong> Registrieren kann sich jede:r, ohne Zahlungsmittel.
          Wer zu einem bestehenden Team oder Verein gehört, bittet dort um Aufnahme; wer neu beginnt, gründet seinen
          Verein. KiFu bleibt gratis, bis das Preismodell eingeführt wird.
        </SectionMessage>
        <div className="mt-6 grid w-full max-w-[800px] gap-4 text-left sm:grid-cols-2">
          <Preis
            titel="Heute"
            unter="Bis das Preismodell eingeführt wird"
            preis="CHF 0"
          >
            <li>Alle Funktionen, auch der KI-Assistent</li>
            <li>
              Verein mit bis {VEREIN_TEAMS_MAX} Teams und {VEREIN_SPIELER_MAX} Spieler:innen
            </li>
            <li>
              Ohne Verein: {KONTO_UEBUNGEN_MAX} eigene Übungen, {KONTO_TRAININGS_MAX} Trainings
            </li>
            <li>Ohne Zahlungsmittel</li>
          </Preis>
          <Preis
            titel="Team"
            unter="Ab Einführung der Preise"
            preis={`CHF ${GEPLANTER_PREIS_CHF}`}
            proMonat
            hervorgehoben
          >
            <li>Bis {SPIELER_MAX} Spieler:innen</li>
            <li>Ganzes Trainerteam</li>
            <li>Unbeschränkt Termine und Spiele</li>
            <li>Deckt Betrieb und Weiterentwicklung</li>
          </Preis>
        </div>
        <p className="type-body-small mt-2 text-on-surface-mittel">
          Geplant: CHF {GEPLANTER_PREIS_CHF} pro Team und Monat, sobald das Preismodell eingeführt wird. Bis dahin ist
          alles gratis.
        </p>
      </section>
    </>
  );
}

/** Der Weg hinein im Einstieg: «Kostenlos registrieren» — angemeldet über
 *  «/startseite» stattdessen «Zur App». Sonst trägt ihn die klebende
 *  Kopfzeile (PO 2026-11-23), nicht jeder Abschnitt und keine Preiskarte. */
function Registrieren({ angemeldet }: { angemeldet: boolean }) {
  return angemeldet ? (
    <ButtonLink href="/" variant="filled">
      Zur App
    </ButtonLink>
  ) : (
    <ButtonLink href="/registrieren" variant="filled">
      Kostenlos registrieren
    </ButtonLink>
  );
}

function Kachelzeichen({ icon: Icon, ton }: { icon: LucideIcon; ton: string }) {
  return (
    <span aria-hidden className={cn("flex size-12 items-center justify-center rounded-dialog", ton)}>
      <Icon size={26} strokeWidth={2} />
    </span>
  );
}

/** Kopf eines Abschnitts: Rubrik, Titel, Einleitung. */
function Kopf({ eyebrow, id, titel, children }: { eyebrow: string; id: string; titel: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-[760px] flex-col gap-3">
      <span className="type-title-small text-primary">{eyebrow}</span>
      <h2 id={id} className="type-headline-large text-on-surface sm:type-display-small">
        {titel}
      </h2>
      <p className="type-body-large text-on-surface-mittel">{children}</p>
    </div>
  );
}

function Schritt({ nummer, titel, children }: { nummer: number; titel: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        aria-hidden
        className="type-title-medium flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary"
      >
        {nummer}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="type-title-large text-on-surface">
          <span className="sr-only">Schritt {nummer}: </span>
          {titel}
        </h3>
        <p className="type-body-large text-on-surface-mittel">{children}</p>
      </div>
    </li>
  );
}

/** Eine Seite des Termins (Trainerteam oder Eltern): Text und Bild auf ihrer Fläche. */
function Seite({
  flaeche,
  eyebrow,
  titel,
  punkte,
  children,
}: {
  flaeche: string;
  eyebrow: string;
  titel: string;
  punkte: string[];
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-7 rounded-dialog p-5 sm:p-9", flaeche)}>
      <div className="flex flex-1 flex-col gap-4">
        <span className="type-title-small text-primary">{eyebrow}</span>
        <h3 className="type-title-large text-on-surface">{titel}</h3>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {punkte.map((p) => (
            <li key={p} className="type-body-large flex gap-2.5 text-on-surface-mittel">
              <Check size={16} strokeWidth={3} aria-hidden className="mt-1 shrink-0 text-primary" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      {children}
    </div>
  );
}

function Grundsatz({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="type-title-medium">{titel}</h3>
      <p className="type-body-medium text-on-umkehr/80">{children}</p>
    </div>
  );
}

function Preis({
  titel,
  unter,
  preis,
  proMonat = false,
  hervorgehoben = false,
  children,
}: {
  titel: string;
  unter: string;
  preis: string;
  proMonat?: boolean;
  hervorgehoben?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-dialog p-7",
        hervorgehoben ? "border-2 border-primary bg-(--start-hervorgehoben)" : "border border-linie bg-elev-01",
      )}
    >
      <div className="flex flex-col gap-1">
        <h3 className="type-title-large text-on-surface">{titel}</h3>
        <p className="type-body-medium text-on-surface-mittel">{unter}</p>
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="type-display-small text-on-surface">{preis}</span>
        {proMonat && <span className="type-body-medium text-on-surface-mittel">pro Team und Monat</span>}
      </p>
      <ul className="type-body-medium m-0 flex list-none flex-col gap-2 p-0 text-on-surface">{children}</ul>
    </div>
  );
}
