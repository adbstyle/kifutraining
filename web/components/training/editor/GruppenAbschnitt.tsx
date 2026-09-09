"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Users, X } from "lucide-react";
import { Button, Disclosure, IconButton, TextField } from "@/components/ui";
import { GRUPPE_NAME_MAX } from "@/lib/gruppen";

/** Meldung einer Gruppen-Aktion: `null` heisst „gespeichert". */
type Antwort = Promise<string | null>;

/** Der Einstieg in die Gruppen (Story #149) — steht rechts im Kartenkopf des
 *  Hauptteils, solange das Training keine Gruppe führt.
 *
 *  Er verschwindet mit der ersten Gruppe: ab dann ist der Abschnitt selbst der
 *  Zugang, und ein zweiter Weg dorthin verwirrte nur. Entfernt der Trainer die
 *  letzte Gruppe, kommt der Knopf zurück (PC 3). */
export function GruppenKnopf({ onOeffnen }: { onOeffnen: () => void }) {
  return (
    <Button variant="text" size="sm" onClick={onOeffnen}>
      <Users size={18} strokeWidth={2} aria-hidden />
      Gruppen
    </Button>
  );
}

/**
 * Die Gruppen eines Trainings verwalten (Story #149).
 *
 * Sitzt in der Hauptteil-Karte zwischen Kartenkopf und den Blöcken: Nur der
 * Hauptteil wird auf Gruppen verteilt, und dort gehört die Liste hin, statt in
 * einen eigenen Kasten irgendwo auf der Seite.
 *
 * Der Abschnitt beginnt zugeklappt und trägt die Anzahl am Kopf (AK 5) — die
 * Verteilung darunter bleibt dadurch ungestört sichtbar.
 *
 * Es gibt keinen Umbenennen-Dialog: die Zeile IST das Feld. Gespeichert wird
 * beim Verlassen des Felds und mit Enter; was dabei schiefgeht, steht als
 * Fehlertext am Feld und nicht in einer Meldung am Seitenrand — dort stünde es
 * weit weg von der Eingabe, die es betrifft.
 *
 * Die letzte Zeile ist dieselbe, nur leer: Hineinschreiben legt eine Gruppe an.
 * Ein eigener „Hinzufügen"-Knopf käme zum selben Ergebnis, verlangte aber einen
 * Klick mehr und eine zweite Erklärung.
 */
export function GruppenAbschnitt({
  gruppen,
  zeit,
  defaultOpen,
  warnung,
  onAnlegen,
  onUmbenennen,
  onEntfernen,
}: {
  gruppen: { id: string; name: string }[];
  /** Die Zeitsumme einer Gruppe als fertiger Satzanfang (`zeitText`). */
  zeit: (gruppeId: string) => string;
  /** Aufgeklappt einhängen — wenn der Trainer den Abschnitt eben erst über den
   *  „Gruppen"-Knopf geöffnet hat. Wirkt nur beim Einhängen. */
  defaultOpen: boolean;
  /** Der Konflikt-Kurztext zu einer Gruppe, sonst `undefined` (Story #150). */
  warnung: (gruppeId: string) => string | undefined;
  /** Legt an und meldet zurück, was der Anlage im Weg stand. */
  onAnlegen: (name: string) => Antwort;
  /** Benennt um und meldet zurück, was dem Umbenennen im Weg stand. */
  onUmbenennen: (id: string, name: string) => Antwort;
  onEntfernen: (gruppe: { id: string; name: string }) => void;
}) {
  return (
    <Disclosure
      title="Gruppen"
      count={gruppen.length}
      defaultOpen={defaultOpen}
      className="mt-4 border-b border-outline-variant pb-4"
    >
      <ul className="flex flex-col gap-2">
        {gruppen.map((g) => (
          <GruppenZeile
            key={g.id}
            gruppe={g}
            zeit={zeit(g.id)}
            warnung={warnung(g.id)}
            onUmbenennen={onUmbenennen}
            onEntfernen={onEntfernen}
          />
        ))}
        <NeueGruppenZeile onAnlegen={onAnlegen} />
      </ul>
    </Disclosure>
  );
}

/** Eine bestehende Gruppe: offenes Feld plus Entfernen-Knopf. */
function GruppenZeile({
  gruppe,
  zeit,
  warnung,
  onUmbenennen,
  onEntfernen,
}: {
  gruppe: { id: string; name: string };
  zeit: string;
  warnung?: string;
  onUmbenennen: (id: string, name: string) => Antwort;
  onEntfernen: (gruppe: { id: string; name: string }) => void;
}) {
  const [entwurf, setEntwurf] = useState(gruppe.name);
  const [fehler, setFehler] = useState<string | null>(null);
  // Was gerade zur Datenbank unterwegs ist, und welcher Text von dort bereits
  // eine Ablehnung hat. Ohne beides speichert dieselbe Eingabe zweimal: Enter
  // schickt sie los, der Klick daneben schickt sie ein zweites Mal hinterher,
  // und eine abgelehnte Änderung ginge bei jedem weiteren Verlassen des Felds
  // erneut zur Datenbank. Refs statt State: die Schranke muss beim nächsten
  // Aufruf schon gelten, nicht erst beim nächsten Rendern.
  const unterwegs = useRef<string | null>(null);
  const abgelehnt = useRef<string | null>(null);

  async function speichere() {
    const wert = entwurf.trim();
    // Ein unveränderter Name ist kein Speichervorgang: sonst schriebe jedes
    // Verlassen des Felds in die Datenbank, auch das blosse Vorbeitabben.
    if (wert === gruppe.name) {
      setFehler(null);
      return;
    }
    // Derselbe Text ein zweites Mal ist kein zweiter Auftrag — weder während
    // der erste läuft noch nachdem er beantwortet wurde. Wer weiterschreibt,
    // hebt die Schranke auf (siehe `onChange`).
    if (wert === unterwegs.current || wert === abgelehnt.current) return;
    unterwegs.current = wert;
    try {
      const problem = await onUmbenennen(gruppe.id, wert);
      abgelehnt.current = problem ? wert : null;
      setFehler(problem);
    } finally {
      unterwegs.current = null;
    }
  }

  function beiTaste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    // Kein Absenden eines umgebenden Formulars — die Zeile speichert selbst.
    e.preventDefault();
    void speichere();
  }

  return (
    <li className="flex items-start gap-3">
      <TextField
        className="min-w-0 flex-1"
        label="Bezeichnung"
        // Sichtbar heisst jede Zeile „Bezeichnung"; für sich gelesen — in der
        // Feldliste eines Screenreaders — wären das lauter gleich benannte
        // Felder. Der a11y-Name nennt darum die Gruppe dazu und behält das
        // sichtbare Wort als Anfang, damit Sprachsteuerung es weiter trifft.
        aria-label={`Bezeichnung der Gruppe ${gruppe.name}`}
        value={entwurf}
        maxLength={GRUPPE_NAME_MAX}
        autoComplete="off"
        onChange={(e) => {
          setEntwurf(e.target.value);
          // Der Fehler gehört zum abgelehnten Stand; wer weiterschreibt, hat
          // ihn beantwortet — und darf denselben Text danach erneut abschicken.
          abgelehnt.current = null;
          if (fehler) setFehler(null);
        }}
        onBlur={() => void speichere()}
        onKeyDown={beiTaste}
        error={!!fehler}
        /* Zwei Lagen: Der Fehler am Feld verdrängt alles — was sich nicht
           speichern lässt, ist dringender als jede Auskunft. Sonst steht dort
           die Zeitsumme (Story #151) und dahinter, wenn es etwas zu melden gibt,
           der Konflikt dieser Gruppe (Story #150). Nur der Konflikt ist
           bernstein: Die Zeitsumme ist eine Auskunft und keine Warnung, und
           färbte man die Zeile ganz, wäre nicht mehr zu sehen, was daran der
           Befund ist. */
        supportingText={
          fehler ?? (
            <>
              {zeit}
              {warnung && <span className="text-warning"> · {warnung}</span>}
            </>
          )
        }
      />
      <IconButton
        icon={X}
        label={`Gruppe ${gruppe.name} entfernen`}
        size="md"
        className="mt-1.5"
        onClick={() => onEntfernen(gruppe)}
      />
    </li>
  );
}

/** Die immer vorhandene leere Zeile — Hineinschreiben legt an. */
function NeueGruppenZeile({ onAnlegen }: { onAnlegen: (name: string) => Antwort }) {
  const [entwurf, setEntwurf] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = useRef<HTMLInputElement>(null);
  // Dieselbe Laufschranke wie in der Gruppenzeile — hier fällt sie besonders
  // auf: Enter legt an und räumt das Feld, der Klick daneben schickte denselben
  // Text ein zweites Mal los und bekäme die eigene Anlage als Kollision zurück
  // — die Meldung stünde dann unter einem leeren Feld.
  const unterwegs = useRef<string | null>(null);
  const abgelehnt = useRef<string | null>(null);

  async function lege() {
    const wert = entwurf.trim();
    if (!wert) {
      // Eine leere Zeile zu verlassen ist keine Eingabe, sondern der Normalfall.
      setFehler(null);
      return;
    }
    if (wert === unterwegs.current || wert === abgelehnt.current) return;
    unterwegs.current = wert;
    try {
      const problem = await onAnlegen(wert);
      abgelehnt.current = problem ? wert : null;
      setFehler(problem);
      // Nur die geglückte Anlage räumt das Feld: sonst wäre die abgelehnte
      // Bezeichnung weg und mit ihr die Möglichkeit, sie zu berichtigen. Und
      // nur, solange noch der angelegte Text drinsteht — wer während der
      // Anlage weitergeschrieben hat, soll seine Eingabe behalten.
      if (!problem) {
        setEntwurf((aktuell) => (aktuell.trim() === wert ? "" : aktuell));
        feld.current?.focus();
      }
    } finally {
      unterwegs.current = null;
    }
  }

  function beiTaste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    void lege();
  }

  return (
    <li className="flex items-start gap-3">
      <TextField
        ref={feld}
        className="min-w-0 flex-1"
        label="Bezeichnung"
        // Die leere Zeile trägt sichtbar dasselbe Label wie die Gruppen
        // darüber; der a11y-Name sagt, dass sie anlegt statt umzubenennen.
        aria-label="Bezeichnung der neuen Gruppe"
        value={entwurf}
        maxLength={GRUPPE_NAME_MAX}
        autoComplete="off"
        onChange={(e) => {
          setEntwurf(e.target.value);
          abgelehnt.current = null;
          if (fehler) setFehler(null);
        }}
        onBlur={() => void lege()}
        onKeyDown={beiTaste}
        error={!!fehler}
        supportingText={
          fehler ??
          "Hineinschreiben legt eine neue Gruppe an. Nur der Hauptteil wird verteilt."
        }
      />
      {/* Platzhalter statt Entfernen-Knopf: die leere Zeile hat nichts zu
          entfernen, und die Felder darüber sollen mit ihr fluchten. */}
      <span className="w-11 shrink-0" aria-hidden />
    </li>
  );
}
