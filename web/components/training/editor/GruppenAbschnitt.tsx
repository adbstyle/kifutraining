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
  defaultOpen,
  onAnlegen,
  onUmbenennen,
  onEntfernen,
}: {
  gruppen: { id: string; name: string }[];
  /** Aufgeklappt einhängen — wenn der Trainer den Abschnitt eben erst über den
   *  „Gruppen"-Knopf geöffnet hat. Wirkt nur beim Einhängen. */
  defaultOpen: boolean;
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
  onUmbenennen,
  onEntfernen,
}: {
  gruppe: { id: string; name: string };
  onUmbenennen: (id: string, name: string) => Antwort;
  onEntfernen: (gruppe: { id: string; name: string }) => void;
}) {
  const [entwurf, setEntwurf] = useState(gruppe.name);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichere() {
    // Ein unveränderter Name ist kein Speichervorgang: sonst schriebe jedes
    // Verlassen des Felds in die Datenbank, auch das blosse Vorbeitabben.
    if (entwurf.trim() === gruppe.name) {
      setFehler(null);
      return;
    }
    setFehler(await onUmbenennen(gruppe.id, entwurf));
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
        value={entwurf}
        maxLength={GRUPPE_NAME_MAX}
        autoComplete="off"
        onChange={(e) => {
          setEntwurf(e.target.value);
          // Der Fehler gehört zum abgelehnten Stand; wer weiterschreibt, hat
          // ihn beantwortet.
          if (fehler) setFehler(null);
        }}
        onBlur={() => void speichere()}
        onKeyDown={beiTaste}
        error={!!fehler}
        // Task 5 rechnet die Zeitsumme der Gruppe aus; bis dahin steht hier der
        // Platzhalter, den die Gestaltung dafür vorsieht.
        supportingText={fehler ?? "Zugewiesen —"}
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

  async function lege() {
    if (!entwurf.trim()) {
      // Eine leere Zeile zu verlassen ist keine Eingabe, sondern der Normalfall.
      setFehler(null);
      return;
    }
    const problem = await onAnlegen(entwurf);
    setFehler(problem);
    // Nur die geglückte Anlage räumt das Feld: sonst wäre die abgelehnte
    // Bezeichnung weg und mit ihr die Möglichkeit, sie zu berichtigen.
    if (!problem) {
      setEntwurf("");
      feld.current?.focus();
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
        value={entwurf}
        maxLength={GRUPPE_NAME_MAX}
        autoComplete="off"
        onChange={(e) => {
          setEntwurf(e.target.value);
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
