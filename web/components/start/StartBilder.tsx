import { Check, ChevronDown, Clock, EllipsisVertical, Shirt } from "lucide-react";
import { Kalenderblatt, Lozenge, buttonClasses } from "@/components/ui";
import { cn } from "@/lib/cn";
import { BEISPIEL_NAMEN } from "@/lib/startseite";
import { VEREIN_SPIELER_MAX } from "@/lib/verein";

/* Die Bilder der Startseite (#670), nach dem Gestaltungsentwurf: Ausschnitte
   der Anwendung, wie Trainerteam, Vereinsverwaltung und Eltern sie sehen —
   mit erfundenen Namen (AK 14, BEISPIEL_NAMEN). Reine Darstellung aus den
   Bausteinen des Kits: Für die Sprachausgabe ist jedes Bild ein Bild
   (`role="img"` mit Beschreibung), sein Inhalt ist stumm, und nichts darin
   lässt sich antippen. */

const n = BEISPIEL_NAMEN;
const [lena, noah, mia, ole, ava, elias, leo] = n.spieler;
const [bergtal, talwil] = n.gegner;

/** Die Fläche, auf der die Anwendung steht (Grund mit weissen Listen). */
function AppFlaeche({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="img" aria-label={label} className={cn("w-full rounded-flaeche bg-elev-00 p-4 text-on-surface", className)}>
      <div aria-hidden className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

/* ── KI-Assistent: zwei Gespräche ─────────────────────────────────────── */

function Gespraech({
  label,
  frage,
  children,
}: {
  label: string;
  frage: string;
  children: React.ReactNode;
}) {
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-3 rounded-dialog border border-linie bg-elev-01 p-4 sm:p-5">
      <div aria-hidden className="flex flex-col gap-3">
        <p className="type-body-medium max-w-[88%] self-end rounded-dialog bg-primary px-4 py-3.5 text-on-primary">{frage}</p>
        <div className="flex max-w-[94%] flex-col gap-2.5 self-start rounded-dialog bg-elev-00 px-4 py-3.5 text-on-surface">
          {children}
        </div>
      </div>
    </div>
  );
}

export function KiGespraeche() {
  return (
    <div className="flex flex-col gap-4">
      <Gespraech
        label="Beispiel: Spielplan in den Teamkalender eintragen"
        frage="Trag mir alle Spiele des Verbands in unseren Teamkalender ein. Besammlung jeweils 1 h vor Anpfiff, Abfahrt mit dem Auto immer ab unserem Heimfeld. Berechne die Zeiten entsprechend."
      >
        <p className="type-body-medium">
          Erledigt: 7 Spiele der Herbstrunde im Kalender. Besammlung 1 h vor Anpfiff, Abfahrt ab {n.heimfeld}:
        </p>
        <div className="type-body-small flex flex-col tabular-nums">
          <SpielZeile kopf werte={["Datum", "Spiel", "Abfahrt", "Anpfiff"]} />
          <SpielZeile werte={["Sa 1.11.", `${n.verein} – Da`, "08:35", "10:00"]} />
          <SpielZeile werte={["Sa 15.11.", `Da – ${bergtal} (Heim)`, "–", "13:30"]} />
          <SpielZeile letzte werte={["Sa 22.11.", `${talwil} – Da`, "07:50", "09:30"]} />
        </div>
        <p className="type-body-small text-on-surface-mittel">… und 4 weitere. Fahrzeit nach Routenplaner.</p>
      </Gespraech>
      <Gespraech
        label="Beispiel: aus dem Matchfazit ein Training erstellen"
        frage="Im letzten Match hatten wir Mühe, die Tiefe zu finden. Wir waren passiv und haben Umschaltmomente verpasst. Erstell mir ein erstes Training dazu für Dienstag."
      >
        <p className="type-body-medium">
          Erledigt: «Tiefe finden, schnell umschalten» für Di 18:00, abgestimmt auf die 13 Angemeldeten.
        </p>
        <ol className="type-body-medium flex list-none flex-col gap-1 p-0">
          <TeilZeile teil="Auffangen">Rondo 4:2, nach Ballgewinn sofort raus</TeilZeile>
          <TeilZeile teil="Einstieg">Passfolge mit Steilpass in die Tiefe</TeilZeile>
          <TeilZeile teil="Hauptteil">6:6 auf zwei Tore, Tor innert 6 s nach Ballgewinn zählt doppelt</TeilZeile>
          <TeilZeile teil="Abschluss">Freies Spiel 7:6</TeilZeile>
        </ol>
      </Gespraech>
    </div>
  );
}

function SpielZeile({ werte, kopf = false, letzte = false }: { werte: string[]; kopf?: boolean; letzte?: boolean }) {
  return (
    <div
      className={cn(
        "grid grid-cols-[3.75rem_minmax(0,1fr)_3rem_3rem] gap-2 py-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_3.75rem_3.75rem]",
        !letzte && "border-b border-linie",
        kopf && "font-semibold text-on-surface-mittel",
      )}
    >
      {werte.map((w) => (
        <span key={w}>{w}</span>
      ))}
    </div>
  );
}

function TeilZeile({ teil, children }: { teil: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="type-title-small w-[76px] shrink-0 text-on-surface-mittel">{teil}</span>
      <span>{children}</span>
    </li>
  );
}

/* ── Verein: die Spielerliste ─────────────────────────────────────────── */

const SPALTEN =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-3 md:grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_7rem_6rem_3rem]";

type LinkStand = "abgeholt" | "zugestellt" | "offen";
const LINK_TON = { abgeholt: "success", zugestellt: "information", offen: "neutral" } as const;

export function Spielerliste() {
  const zeilen: { name: string; jahrgang: number; teams: string[]; js: string; link: LinkStand }[] = [
    { name: lena, jahrgang: 2016, teams: ["F-Junior:innen", "E-Junior:innen"], js: "1823 4471", link: "abgeholt" },
    { name: noah, jahrgang: 2015, teams: ["E-Junior:innen"], js: "1790 2283", link: "zugestellt" },
    { name: mia, jahrgang: 2016, teams: ["F-Junior:innen", "E-Junior:innen"], js: "–", link: "abgeholt" },
    { name: ole, jahrgang: 2014, teams: [], js: "–", link: "offen" },
  ];
  return (
    <AppFlaeche
      label={`Beispiel: die Spielerliste im Verein «${n.verein}», 212 Spieler:innen, eine davon ohne Team, mit Teams, J+S-Nummer und Stand des privaten Links.`}
      className="gap-4"
    >
      {/* Wie die Seite seit #707: Krumen Verein › Spieler:innen mit den Aktionen, die Anzahl darunter. */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="type-title-medium text-on-surface">
            <span className="text-on-surface-mittel">{n.verein} › </span>Spieler:innen
          </p>
          <span className="flex shrink-0 items-center gap-2">
            <span className={buttonClasses("outlined")}>Spieler:innen importieren</span>
            <span className={buttonClasses("filled")}>Spieler:in hinzufügen</span>
          </span>
        </div>
        <p className="type-label-small text-on-surface-mittel">
          212 Spieler:innen · 1 ohne Team · höchstens {VEREIN_SPIELER_MAX} je Verein
        </p>
      </div>
      <div className="overflow-hidden rounded-flaeche bg-elev-01">
        <div className={cn(SPALTEN, "type-label-small border-b border-linie py-2 pl-4 pr-2 text-on-surface-mittel")}>
          <span className="hidden md:block" />
          <span>Vorname</span>
          <span>Nachname</span>
          <span className="hidden md:block">Jahrgang</span>
          <span className="hidden md:block">Teams</span>
          <span className="hidden md:block">J+S-Nummer</span>
          <span>Privater Link</span>
          <span className="hidden md:block" />
        </div>
        <ul className="m-0 list-none p-0">
          {zeilen.map((z) => {
            const [vorname, nachname] = z.name.split(" ");
            return (
              <li key={z.name} className={cn(SPALTEN, "min-h-12 items-center border-linie py-1 pl-4 pr-2 [&+&]:border-t")}>
                <span className="hidden size-[18px] rounded-klein kontur border-kante md:block" />
                <span className="type-body-medium">{vorname}</span>
                <span className="type-body-medium">{nachname}</span>
                <span className="type-body-medium hidden text-on-surface-mittel md:block">{z.jahrgang}</span>
                <span className="hidden flex-wrap gap-1 md:flex">
                  {z.teams.length === 0 ? (
                    <Lozenge appearance="warning">ohne Team</Lozenge>
                  ) : (
                    z.teams.map((t) => <Lozenge key={t}>{t}</Lozenge>)
                  )}
                </span>
                <span className="type-body-medium hidden text-on-surface-mittel md:block">{z.js}</span>
                <span>
                  <Lozenge appearance={LINK_TON[z.link]}>{z.link}</Lozenge>
                </span>
                <span className="hidden justify-center text-on-surface-mittel md:flex">
                  <EllipsisVertical size={20} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="type-body-small text-on-surface-mittel">4 von 212 angezeigt</p>
    </AppFlaeche>
  );
}

/* ── Team: der Stand eines Spiels fürs Trainerteam ────────────────────── */

type Meldung = "Angemeldet" | "Ohne Meldung" | "Abgemeldet";
const MELDUNG_TON = { Angemeldet: "success", "Ohne Meldung": "warning", Abgemeldet: "danger" } as const;

export function TerminStand() {
  const gruppen: { titel: Meldung; zahl: number; zeilen: [string, string][] }[] = [
    { titel: "Angemeldet", zahl: 10, zeilen: [[ava, "vor 2 Tagen"], [elias, "vor 5 Stunden"]] },
    { titel: "Ohne Meldung", zahl: 2, zeilen: [[lena, "noch keine Meldung"], [leo, "noch keine Meldung"]] },
    { titel: "Abgemeldet", zahl: 2, zeilen: [[noah, "vor 1 Tag"], [mia, "vor 3 Stunden"]] },
  ];
  return (
    <AppFlaeche label="Beispiel: der Stand eines Spiels im Team, 10 von 14 angemeldet, Richtwert 9 bis 11 – genügend; 2 ohne Meldung, 2 abgemeldet.">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Lozenge appearance="success">Genügend</Lozenge>
          <span className="type-body-small text-on-surface-mittel">Richtwert 9 bis 11</span>
        </div>
        <p className="type-headline-small">10 von 14 angemeldet</p>
        <p className="type-body-small text-on-surface-mittel">2 ohne Meldung · 2 abgemeldet</p>
        <p className="type-body-small text-on-surface-mittel">
          Meldefrist am privaten Link: Do., 27.11., 20:00 · Mitglieder melden bis zum Anpfiff
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {gruppen.map((g) => (
          <div key={g.titel} className="flex flex-col gap-1.5">
            <p className="type-label-small text-on-surface-mittel">
              {g.titel} · {g.zahl}
            </p>
            <ul className="m-0 list-none rounded-flaeche bg-elev-01 p-0">
              {g.zeilen.map(([name, wann]) => (
                <li key={name} className="flex min-h-12 items-center gap-3 border-linie px-4 py-1.5 [&+&]:border-t">
                  <span className="min-w-0 flex-1">
                    <span className={cn("type-body-medium block", g.titel === "Abgemeldet" && "text-on-surface-mittel")}>
                      {name}
                    </span>
                    <span className="type-body-small block text-on-surface-mittel">{wann}</span>
                  </span>
                  <Lozenge appearance={MELDUNG_TON[g.titel]}>
                    <span className="inline-flex items-center gap-0.5">
                      {g.titel}
                      <ChevronDown size={12} strokeWidth={2.5} />
                    </span>
                  </Lozenge>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </AppFlaeche>
  );
}

/* ── Eltern: die nächsten Termine am privaten Link ────────────────────── */

export function PrivaterLink() {
  return (
    <AppFlaeche label="Beispiel: die nächsten Termine am privaten Link – ein Training fällt aus, eines ist angemeldet, beim Spiel fehlt noch die Meldung.">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        <li className="flex flex-col gap-2 rounded-flaeche kontur border-linie p-3">
          <div className="flex items-start gap-3">
            <Kalenderblatt datum="2025-11-25" stand="gestrichen" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <Lozenge>Fällt aus</Lozenge>
              <span className="type-body-medium text-on-surface-mittel">18:00–19:30</span>
              <span className="type-body-small text-on-surface-mittel">E-Junior:innen</span>
              <span className="type-body-small text-on-surface-mittel">Platz gesperrt</span>
            </div>
          </div>
        </li>
        <li className="flex flex-col gap-2 rounded-flaeche bg-elev-01 p-3">
          <div className="flex items-start gap-3">
            <Kalenderblatt datum="2025-11-27" stand="leise" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <Lozenge appearance="success">Angemeldet</Lozenge>
              <span className="type-body-medium">18:00–19:30</span>
              <span className="type-body-small text-on-surface-mittel">E-Junior:innen</span>
              <span className="type-body-small text-primary underline">{n.heimfeld}</span>
            </div>
            <SchalterAn />
          </div>
          <span className="type-body-medium">Treffpunkt 17:50, beim Garderobengebäude</span>
        </li>
        <li className="flex flex-col gap-2 rounded-flaeche bg-elev-01 p-3">
          <div className="flex items-start gap-3">
            <Kalenderblatt datum="2025-11-29" stand="aktiv" />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <Lozenge appearance="warning">Ohne Meldung</Lozenge>
              <span className="type-title-small">
                {talwil} – {n.verein}
              </span>
              <span className="type-body-medium text-on-surface-mittel">10:00–11:30</span>
              <span className="type-body-small text-on-surface-mittel">E-Junior:innen</span>
              <span className="type-body-medium text-primary underline">{n.auswaerts}</span>
            </div>
          </div>
          <div className="type-body-small flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-linie pt-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> Bitte melden bis Do., 27.11., 20:00
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Shirt size={14} /> 10/14 · gesucht 9 bis 11
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={buttonClasses("umkehr")}>Anmelden</span>
            <span className={buttonClasses("outlined")}>Abmelden</span>
          </div>
          <span className="type-body-medium">Treffpunkt 08:35, Heimfeld {n.heimfeld}</span>
        </li>
      </ul>
    </AppFlaeche>
  );
}

/** Der Schalter «Mitteilungen» im Zustand an — nur das Bild davon. */
function SchalterAn() {
  return (
    <span className="relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full kontur border-kante">
      <span className="absolute left-[21px] size-[26px] rounded-full bg-on-surface-mittel" />
      <Check size={14} strokeWidth={3} className="absolute left-[27px] text-elev-01" />
    </span>
  );
}
