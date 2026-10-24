"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import { SectionMessage, Button, Dialog, Gefahrenzone, TextField } from "@/components/ui";
import {
  loeseTeamAuf,
  verlasseTeam,
  type MitgliedschaftResult,
} from "@/lib/actions/teams";

/** Was mit dem Team für alle verschwindet (#480 AK 3). */
export type AufloesungsFolgen = {
  trainings: number;
  termine: number;
  spiele: number;
  spieler: number;
  kader: number;
};

/* Team verlassen und Team auflösen (Story 13, #480) — in der Gefahrenzone der
   Teamverwaltung.

   Ein Team verschwindet nur, wenn die auslösende Person seinen Namen eingibt:
   beim Auflösen wie beim Austritt als letztes Mitglied (AK 5, 10). Geprüft
   wird beim Ausführen in der Datenbank (AK 11, 12) — die Oberfläche gibt den
   Knopf erst frei, wenn die Eingabe stimmt, entscheidet aber nichts. Darum
   kann der gewöhnliche Austritt in die Namensbestätigung umschlagen, wenn
   inzwischen alle anderen gegangen sind (PC 4), und der genannte Name kann
   sich ändern, wenn jemand das Team umbenannt hat (PC 3).

   Scheitert ein Weg, bleibt sein Dialog offen und nennt den Grund als Section
   Message — dort, wo der Trainer erneut bestätigen oder abbrechen kann. Eine
   Snackbar läge unter dem Dialog (Material, #234). Nur wenn es das Team nicht
   mehr gibt (PC 5), gibt es nichts mehr zu bestätigen: dann zurück zu den
   Teams, die es per Snackbar melden (`?weg=1`). */
export function TeamGefahrenzone({
  teamId,
  teamName,
  anzahlMitglieder,
  folgen,
}: {
  teamId: string;
  teamName: string;
  anzahlMitglieder: number;
  folgen: AufloesungsFolgen;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // `austritt`: als letztes Mitglied verlassen — dieselbe Bestätigung wie
  // beim Auflösen (AK 10), nur ein anderer Vorgang.
  const [offen, setOffen] = useState<"verlassen" | "aufloesen" | "austritt" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  // Der Name, den die Bestätigung verlangt: der angezeigte — oder der
  // aktuelle laut Datenbank, sobald sie einen anderen gemeldet hat (PC 3).
  const [gemeldet, setGemeldet] = useState<string | null>(null);
  const name = gemeldet ?? teamName;
  const [eingabe, setEingabe] = useState("");

  const letzte = anzahlMitglieder <= 1;
  // Exakt, mit Gross- und Kleinschreibung; Leerzeichen am Rand zählen nicht
  // (AK 6, 7), die Unicode-Normalform auch nicht. Dieselbe Regel wiederholt
  // die Datenbank.
  const passt = eingabe.trim().normalize("NFC") === name.normalize("NFC");

  function oeffnen(welcher: NonNullable<typeof offen>, mitHinweis: string | null = null) {
    // Der Dialog bleibt im DOM; jeder Anlauf beginnt leer.
    setFehler(null);
    setGemeldet(null);
    setHinweis(mitHinweis);
    setEingabe("");
    setOffen(welcher);
  }

  // Nur den eigenen Dialog schliessen: Wechselt der Austritt in die
  // Namensbestätigung (PC 4), meldet der zugehende Dialog sein `close` erst
  // danach — es darf den neuen nicht mitnehmen.
  function schliessen(...welche: NonNullable<typeof offen>[]) {
    if (!pending) setOffen((o) => (o && welche.includes(o) ? null : o));
  }

  function behandle(res: MitgliedschaftResult) {
    switch (res.status) {
      case "entfernt":
      case "aufgeloest":
        router.push("/teams");
        return;
      case "aufloesung_noetig":
        // Zwischen Anzeige und Ausführung sind die anderen ausgetreten:
        // nicht still auflösen, sondern die Bestätigung verlangen (PC 4).
        oeffnen(
          "austritt",
          "Inzwischen bist du das letzte Mitglied. Mit deinem Austritt löst sich das Team auf.",
        );
        setGemeldet(res.name);
        return;
      case "name_falsch":
        setGemeldet(res.name);
        setFehler(`Das Team heisst inzwischen «${res.name}». Gib diesen Namen ein, um fortzufahren.`);
        return;
      case "team_weg":
        setOffen(null);
        router.push("/teams?weg=1");
        return;
      case "fehler":
        setFehler(res.error);
    }
  }

  function verlassen() {
    startTransition(async () => behandle(await verlasseTeam(teamId)));
  }

  function bestaetigen() {
    if (!passt || pending) return;
    startTransition(async () =>
      behandle(
        offen === "austritt"
          ? await verlasseTeam(teamId, eingabe)
          : await loeseTeamAuf(teamId, eingabe),
      ),
    );
  }

  return (
    <Gefahrenzone
      beschreibung="Verlassen betrifft nur dich - ausser du bist das letzte Mitglied. Auflösen löscht das Team samt allen Inhalten für alle Mitglieder."
    >
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outlined"
          disabled={pending}
          onClick={() => oeffnen(letzte ? "austritt" : "verlassen")}
        >
          <LogOut size={18} strokeWidth={2} aria-hidden />
          Team verlassen
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => oeffnen("aufloesen")}>
          <Trash2 size={18} strokeWidth={2} aria-hidden />
          Team auflösen
        </Button>
      </div>

      <Dialog
        open={offen === "verlassen"}
        onClose={() => schliessen("verlassen")}
        title="Team verlassen?"
        actions={
          <>
            <Button variant="text" onClick={() => schliessen("verlassen")}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={verlassen} disabled={pending}>
              Verlassen
            </Button>
          </>
        }
      >
        {fehler && (
          <SectionMessage appearance="error" className="mb-4">
            {fehler}
          </SectionMessage>
        )}
        <p>
          Du siehst die Trainings und Termine dieses Teams danach nicht mehr.
          Das Team bleibt für die übrigen Mitglieder bestehen. Deine
          persönlichen Trainings - auch Kopien, die du zu dir übernommen hast -
          bleiben unberührt.
        </p>
      </Dialog>

      <NamensBestaetigung
        open={offen === "aufloesen" || offen === "austritt"}
        austritt={offen === "austritt"}
        name={name}
        eingabe={eingabe}
        onEingabe={setEingabe}
        passt={passt}
        pending={pending}
        fehler={fehler}
        hinweis={hinweis}
        folgen={folgen}
        onClose={() => schliessen("aufloesen", "austritt")}
        onBestaetigen={bestaetigen}
      />
    </Gefahrenzone>
  );
}

/** «1 Spiel», «2 Spiele». */
function n(zahl: number, eins: string, mehr: string) {
  return `${zahl} ${zahl === 1 ? eins : mehr}`;
}

/* Die Bestätigung per Namenseingabe (#480): was verloren geht, welcher Name
   einzugeben ist, und der Knopf erst frei, wenn die Eingabe stimmt.

   Die Eingabe verfälscht nichts von selbst — keine Autokorrektur, keine
   automatische Grossschreibung, keine Rechtschreibprüfung (NFR 1). Einfügen
   bleibt erlaubt (AK 8). Die Vorlesehilfe hört den verlangten Namen mit dem
   Feld (`aria-describedby`) und erfährt über eine Live-Region, wann der Knopf
   frei ist (NFR 3). */
function NamensBestaetigung({
  open,
  austritt,
  name,
  eingabe,
  onEingabe,
  passt,
  pending,
  fehler,
  hinweis,
  folgen,
  onClose,
  onBestaetigen,
}: {
  open: boolean;
  austritt: boolean;
  name: string;
  eingabe: string;
  onEingabe: (wert: string) => void;
  passt: boolean;
  pending: boolean;
  fehler: string | null;
  hinweis: string | null;
  folgen: AufloesungsFolgen;
  onClose: () => void;
  onBestaetigen: () => void;
}) {
  const formId = useId();
  const anleitungId = useId();
  const aktion = austritt ? "Verlassen und auflösen" : "Team auflösen";
  const warnung =
    hinweis ?? (austritt ? "Du bist das letzte Mitglied. Mit deinem Austritt löst sich das Team auf." : null);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={austritt ? "Team verlassen und auflösen?" : "Team auflösen?"}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" form={formId} variant="danger" disabled={!passt || pending}>
            {aktion}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onBestaetigen();
        }}
      >
        {fehler && <SectionMessage appearance="error">{fehler}</SectionMessage>}
        {warnung && <SectionMessage appearance="warning">{warnung}</SectionMessage>}
        <p className="flex items-start gap-2">
          <AlertTriangle
            size={18}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-error"
            aria-hidden
          />
          <span>Für alle Mitglieder verschwinden unwiderruflich:</span>
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{n(folgen.trainings, "Team-Training", "Team-Trainings")}</li>
          <li>{n(folgen.termine, "Trainingstermin", "Trainingstermine")} samt Abmeldungen und Anwesenheiten</li>
          <li>{n(folgen.spiele, "Spiel", "Spiele")} samt Meldungen und Aufgeboten</li>
          <li>die Spielerliste mit {n(folgen.spieler, "Spieler:in", "Spieler:innen")}</li>
          <li>{folgen.kader} Kader</li>
        </ul>
        <p>
          Persönliche Trainings der Mitglieder bleiben erhalten - auch Kopien aus diesem Team.
        </p>
        <p id={anleitungId}>
          Gib zur Bestätigung den Teamnamen{" "}
          «<span className="select-all font-medium text-on-surface">{name}</span>» ein.
        </p>
        <TextField
          label="Teamname"
          value={eingabe}
          onChange={(e) => onEingabe(e.target.value)}
          enterKeyHint="go"
          aria-describedby={anleitungId}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          // Passwort-Manager halten das Feld sonst für ein Login-Feld.
          data-1p-ignore
          data-lpignore="true"
        />
        {/* Dauerhaft im DOM, damit die Vorlesehilfe die Änderung ansagt. */}
        <span className="sr-only" role="status">
          {passt ? `Der Name stimmt. ${aktion} ist freigegeben.` : ""}
        </span>
      </form>
    </Dialog>
  );
}
