"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button, Dialog, IconButton, TextField, Tooltip } from "@/components/ui";
import {
  benenneVariante,
  entferneVariante,
  verschiebeVariante,
} from "@/lib/actions/varianten";
import { zaehle } from "@/lib/labels";
import { VARIANTE_NAME_MAX, type Variante } from "@/lib/varianten";

/**
 * Die Varianten eines Trainings verwalten (#202): umbenennen, ordnen,
 * entfernen.
 *
 * Ein eigener Dialog statt dreier Bedienelemente an den Chips der Leiste: Die
 * Chips sind die WAHL der angezeigten Variante — hängte man Umbenennen und
 * Entfernen daran, bekäme jeder Klick zwei Bedeutungen. Hier stehen alle
 * Varianten untereinander, und zwischen ihnen lässt sich ordnen, was
 * nebeneinander liegende Chips nicht hergeben.
 *
 * Kein Umbenennen-Dialog innerhalb des Dialogs: die Zeile IST das Feld, genau
 * wie bei den Gruppen (`GruppenZeile`). Gespeichert wird beim Verlassen und
 * mit Enter, und was dabei schiefgeht, steht am Feld — nicht in einer Meldung
 * am Seitenrand, wo es weit weg von der Eingabe stünde.
 *
 * Umbenennen und Umsortieren wirken sofort, die Antwort des Servers bestätigt
 * sie nur. Die Reihenfolge ist dabei mehr als Anzeige: Sie entscheidet, welche
 * Variante beim Öffnen des Trainings gilt (#202 PC 3) — darum frischt jeder
 * geglückte Tausch die Serverdaten auf, damit die Chips der Leiste ihr folgen.
 */
export function VariantenVerwaltungDialog({
  open,
  onClose,
  varianten,
  fassungen,
  onGeaendert,
  onEntfernt,
  melde,
}: {
  open: boolean;
  onClose: () => void;
  /** Die Varianten in ihrer gespeicherten Reihenfolge. */
  varianten: readonly Variante[];
  /** Die Fassungen des Trainings — Grundlage der Rückfrage vor dem Entfernen
   *  (AK 6). Es genügt, was gezählt wird. */
  fassungen: readonly {
    varianteId: string | null;
    notiz: string | null;
    gruppen: readonly unknown[];
  }[];
  /** Umbenannt oder umsortiert: der Editor frischt die Serverdaten auf. */
  onGeaendert: () => void;
  /** Entfernt: der Editor wechselt nötigenfalls die angezeigte Variante,
   *  gleicht die Adresse an und quittiert. */
  onEntfernt: (variante: Variante) => void;
  /** Was nicht an ein Feld gehört, geht als Meldung an den Seitenrand. */
  melde: (text: string) => void;
}) {
  // Die Reihenfolge, wie sie hier gerade steht — der Tausch soll unter dem
  // Finger geschehen und nicht erst nach dem Rundlauf zum Server. Der
  // Serverstand bleibt die Quelle: Kommt er aufgefrischt herein, gilt er.
  const [liste, setListe] = useState<readonly Variante[]>(varianten);
  useEffect(() => {
    setListe(varianten);
  }, [varianten]);

  // Die Variante, deren Entfernen noch zu bestätigen ist (AK 5).
  const [weg, setWeg] = useState<Variante | null>(null);
  const [, startTransition] = useTransition();
  // Ein zweiter Klick, während der erste unterwegs ist, tauschte zweimal — die
  // Liste stünde dann anders als in der Datenbank. Ref statt State: die
  // Schranke muss beim nächsten Klick schon gelten, nicht erst beim nächsten
  // Rendern (Muster `GruppenZeile`).
  const unterwegs = useRef(false);

  // Welcher Chevron nach dem Tausch den Fokus trägt. React bewegt die Zeile
  // mitsamt ihren Knöpfen (gleicher Key), der Fokus bliebe also von selbst —
  // ausser am Rand: Dort wird der geklickte Knopf stumm, und ein
  // deaktivierter Knopf gibt den Fokus an den Seitenanfang ab. Dann führt der
  // Gegenknopf weiter.
  const knoepfe = useRef(new Map<string, HTMLButtonElement | null>());
  const fokusZiel = useRef<string | null>(null);
  useEffect(() => {
    const ziel = fokusZiel.current;
    if (!ziel) return;
    fokusZiel.current = null;
    const knopf = knoepfe.current.get(ziel);
    if (knopf && !knopf.disabled) {
      knopf.focus();
      return;
    }
    const [id, dir] = ziel.split("|");
    knoepfe.current.get(`${id}|${dir === "-1" ? "1" : "-1"}`)?.focus();
  });

  /** Eine Variante mit ihrem Nachbarn tauschen (AK 3). */
  function verschiebe(index: number, dir: -1 | 1) {
    const ziel = index + dir;
    if (ziel < 0 || ziel >= liste.length || unterwegs.current) return;
    const vorher = liste;
    const variante = liste[index];
    const neu = [...liste];
    neu[index] = neu[ziel];
    neu[ziel] = variante;
    setListe(neu);
    fokusZiel.current = `${variante.id}|${dir}`;
    unterwegs.current = true;
    startTransition(async () => {
      try {
        const r = await verschiebeVariante(variante.id, dir);
        if (r.ok) {
          onGeaendert();
          return;
        }
        // Zurücknehmen: sonst stünde hier eine Reihenfolge, die kein Training
        // trägt — und beim nächsten Öffnen sprängen die Varianten zurück.
        setListe(vorher);
        melde(r.error ?? "Verschieben fehlgeschlagen.");
      } finally {
        unterwegs.current = false;
      }
    });
  }

  /** Entfernen — mit Rückfrage, solange die Variante Übungen trägt (AK 5).
   *  Eine leere Variante ist bloss eine Bezeichnung; das quittiert die
   *  Snackbar, mehr braucht es nicht (dieselbe Schwelle wie bei den Gruppen). */
  function entfernen(variante: Variante) {
    if (fassungenVon(fassungen, variante.id).length > 0) {
      setWeg(variante);
      return;
    }
    entferneJetzt(variante);
  }

  function entferneJetzt(variante: Variante) {
    setWeg(null);
    if (unterwegs.current) return;
    unterwegs.current = true;
    startTransition(async () => {
      try {
        const r = await entferneVariante(variante.id);
        if (!r.ok) {
          melde(r.error ?? "Entfernen fehlgeschlagen.");
          return;
        }
        // Bleibt nur eine, gibt es nichts mehr zu verwalten: Die Wahl
        // verschwindet, und der Einstieg in diesen Dialog mit ihr (PC 4).
        // Solange er offen ist, zeigt er die eine Variante mit stummem
        // Entfernen-Knopf — dort ist die Regel «die letzte bleibt» (AK 7) zu
        // sehen, wo sie den Trainer betrifft.
        onEntfernt(variante);
      } finally {
        unterwegs.current = false;
      }
    });
  }

  const letzte = liste.length < 2;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title="Varianten verwalten"
        actions={
          <Button variant="text" onClick={onClose}>
            Fertig
          </Button>
        }
      >
        <p className="mb-4">
          Beim Öffnen zeigt das Training die vorderste Variante.
        </p>
        <ul className="flex flex-col gap-2">
          {liste.map((v, i) => (
            <li key={v.id} className="flex items-start gap-2">
              {/* Hoch/Runter wie an der Übungszeile — dasselbe Zeichenpaar für
                  dieselbe Handlung. */}
              <span className="mt-3 flex shrink-0 flex-col">
                <button
                  type="button"
                  ref={(el) => {
                    knoepfe.current.set(`${v.id}|-1`, el);
                  }}
                  aria-label={`„${v.name}" nach oben`}
                  onClick={() => verschiebe(i, -1)}
                  disabled={i === 0}
                  className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
                >
                  <ChevronUp size={16} strokeWidth={2.5} aria-hidden />
                </button>
                <button
                  type="button"
                  ref={(el) => {
                    knoepfe.current.set(`${v.id}|1`, el);
                  }}
                  aria-label={`„${v.name}" nach unten`}
                  onClick={() => verschiebe(i, 1)}
                  disabled={i === liste.length - 1}
                  className="focus-ring inline-flex h-5 w-6 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-on-surface/8 disabled:opacity-30"
                >
                  <ChevronDown size={16} strokeWidth={2.5} aria-hidden />
                </button>
              </span>

              <VarianteNameFeld variante={v} onGeaendert={onGeaendert} />

              {letzte ? (
                <Tooltip label="Die letzte Variante bleibt" placement="bottom">
                  <IconButton
                    icon={X}
                    label={`Variante „${v.name}" entfernen`}
                    size="md"
                    className="mt-1.5"
                    disabled
                  />
                </Tooltip>
              ) : (
                <IconButton
                  icon={X}
                  label={`Variante „${v.name}" entfernen`}
                  size="md"
                  className="mt-1.5"
                  onClick={() => entfernen(v)}
                />
              )}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Die Rückfrage steht NEBEN dem Verwaltungs-Dialog und nicht in ihm:
          Zwei ineinander gerenderte <dialog>-Elemente stapeln sich zwar im Top
          Layer, aber der äussere bliebe dabei der Fokus-Trap des inneren.
          Nebeneinander legt der Browser sie sauber übereinander. */}
      <Dialog
        open={weg != null}
        onClose={() => setWeg(null)}
        title={`Variante „${weg?.name ?? ""}" entfernen?`}
        actions={
          <>
            <Button variant="text" onClick={() => setWeg(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => weg && entferneJetzt(weg)}>
              Entfernen
            </Button>
          </>
        }
      >
        <p>{weg ? wegfallSatz(weg, fassungenVon(fassungen, weg.id)) : ""}</p>
      </Dialog>
    </>
  );
}

/** Eine Zeile des Dialogs: das offene Namensfeld (AK 1/2).
 *
 *  Eigener Baustein, damit jede Zeile ihren Entwurf, ihren Fehler und ihre
 *  Laufschranken für sich führt — genau wie `GruppenZeile`, von der auch das
 *  Speichern beim Verlassen stammt. */
function VarianteNameFeld({
  variante,
  onGeaendert,
}: {
  variante: Variante;
  onGeaendert: () => void;
}) {
  const [entwurf, setEntwurf] = useState(variante.name);
  const [fehler, setFehler] = useState<string | null>(null);
  // Der Name kann sich AUSSERHALB dieser Zeile ändern: Der Dialog bleibt
  // eingehängt, und «Variante hinzufügen» benennt dabei die bisherige um
  // (#201 AK 2). Ohne Abgleich zeigte die Zeile ewig den Namen von damals.
  // Der Serverstand gewinnt — eine Eingabe, die ihn noch nicht erreicht hat,
  // ist ein Entwurf und kein Stand. Anpassen beim Rendern statt in einem
  // Effekt: So steht nie ein Zwischenbild mit dem alten Namen auf dem Schirm.
  const gesehen = useRef(variante.name);
  if (gesehen.current !== variante.name) {
    gesehen.current = variante.name;
    setEntwurf(variante.name);
    setFehler(null);
  }
  // Was gerade unterwegs ist und welcher Text bereits eine Ablehnung hat. Ohne
  // beides speichert dieselbe Eingabe zweimal: Enter schickt sie los, der Klick
  // daneben ein zweites Mal — und eine abgelehnte Bezeichnung ginge bei jedem
  // weiteren Verlassen des Felds erneut zur Datenbank.
  const unterwegs = useRef<string | null>(null);
  const abgelehnt = useRef<string | null>(null);

  async function speichere() {
    const wert = entwurf.trim();
    // Ein unveränderter Name ist kein Speichervorgang — sonst schriebe schon
    // das Vorbeitabben in die Datenbank.
    if (wert === variante.name) {
      setFehler(null);
      return;
    }
    if (wert === unterwegs.current || wert === abgelehnt.current) return;
    unterwegs.current = wert;
    try {
      // Geprüft wird serverseitig: Die Regel steht dort gegen den Bestand, den
      // die Datenbank sieht, und ihre Meldung nennt sie bereits im Klartext —
      // dieselbe Arbeitsteilung wie bei den Gruppen. Die eigene bisherige
      // Bezeichnung zählt dabei nicht als vergeben (AK 2).
      const r = await benenneVariante(variante.id, wert);
      const problem = r.ok ? null : (r.error ?? "Speichern fehlgeschlagen.");
      abgelehnt.current = problem ? wert : null;
      setFehler(problem);
      // Der Name steht auch an den Chips der Leiste und in den Rückfragen —
      // darum frischt die geglückte Umbenennung die Serverdaten auf.
      if (!problem) onGeaendert();
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
    <TextField
      className="min-w-0 flex-1"
      label="Bezeichnung"
      // Sichtbar heisst jede Zeile „Bezeichnung"; für sich gelesen — in der
      // Feldliste eines Screenreaders — wären das lauter gleich benannte
      // Felder. Der a11y-Name nennt darum die Variante dazu und behält das
      // sichtbare Wort als Anfang, damit Sprachsteuerung es weiter trifft.
      aria-label={`Bezeichnung der Variante ${variante.name}`}
      value={entwurf}
      maxLength={VARIANTE_NAME_MAX}
      autoComplete="off"
      onChange={(e) => {
        setEntwurf(e.target.value);
        // Der Fehler gehört zum abgelehnten Stand; wer weiterschreibt, hat ihn
        // beantwortet — und darf denselben Text danach erneut abschicken.
        abgelehnt.current = null;
        if (fehler) setFehler(null);
      }}
      onBlur={() => void speichere()}
      onKeyDown={beiTaste}
      error={!!fehler}
      supportingText={fehler ?? undefined}
    />
  );
}

/** Die Fassungen einer Variante — was mit ihr wegfällt. */
function fassungenVon<T extends { varianteId: string | null }>(
  fassungen: readonly T[],
  varianteId: string,
): T[] {
  return fassungen.filter((f) => f.varianteId === varianteId);
}

/**
 * Was das Entfernen einer Variante kostet, als ein Satz (AK 6).
 *
 * Genannt wird nicht nur die Anzahl der Übungen: Notiz und Gruppenzuweisung
 * sind die Arbeit, die in dieser Variante steckt und die nirgends sonst steht.
 * Und was NICHT wegfällt, gehört in denselben Satz — die Gruppen-Definitionen
 * gehören dem Training und gelten für alle Varianten (PC 2); ohne den Nachsatz
 * läse der Trainer die Rückfrage als Angriff auf sein ganzes Training.
 */
function wegfallSatz(
  variante: Variante,
  fassungen: readonly { notiz: string | null; gruppen: readonly unknown[] }[],
): string {
  const n = fassungen.length;
  const mitNotiz = fassungen.filter((f) => f.notiz != null && f.notiz !== "").length;
  const mitGruppen = fassungen.filter((f) => f.gruppen.length > 0).length;

  const teile: string[] = [];
  // In der Einzahl ist die Zahl überflüssig: «1 Übung, davon 1 mit Notiz» sähe
  // aus wie ein Zählfehler. Der Satz wechselt dann die Wendung — «sie trägt
  // eine Notiz» statt eines Aufzählungs-Nachsatzes über ein einziges Stück.
  if (mitNotiz > 0) teile.push(n === 1 ? "eine Notiz" : `${mitNotiz} mit Notiz`);
  if (mitGruppen > 0)
    teile.push(n === 1 ? "eine Gruppenzuweisung" : `${mitGruppen} mit Gruppenzuweisung`);
  const davon =
    teile.length > 0 ? `, ${n === 1 ? "sie trägt" : "davon"} ${teile.join(" und ")}` : "";

  return (
    `Mit „${variante.name}" ${n === 1 ? "fällt" : "fallen"} ` +
    `${zaehle(n, "Übung", "Übungen")} weg${davon}. ` +
    "Die Gruppen selbst und die übrigen Varianten bleiben."
  );
}
