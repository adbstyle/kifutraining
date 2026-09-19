"use client";

import { Dialog, Button } from "@/components/ui";
import { bedingungText, type FehlendeBedingung } from "@/lib/training-bedingungen";
import type { Variante } from "@/lib/varianten";

/** Was gerade offen ist. `null` = nichts.
 *
 *  Den Zustand hält die Aktionsreihe, nicht dieser Baustein: Sie kennt den
 *  Menüeintrag, der ihn öffnet, und was danach geschehen soll. */
export type SichtbarkeitSchritt = "unvollstaendig" | "tragweite" | "rueckzug";

/* Die drei Rückfragen rund um die Sichtbarkeit eines Trainings (Story A).
 *
 * Veröffentlichen ist ein Zustand, keine Kopie: derselbe Datensatz wird
 * sichtbar und bleibt bearbeitbar. Zwei Zustände, ein Weg hin und zurück.
 *
 * Bis zu #249 brachte dieser Baustein seinen eigenen Knopf mit
 * (`SichtbarkeitControl`). Seit die Aktion im Überlaufmenü liegt, bleiben nur
 * die Rückfragen — der Auslöser gehört der Reihe. Die Verzweigung «fehlt noch
 * etwas?» trifft sie ebenfalls, denn sie kennt die fehlenden Bedingungen schon
 * für den Menüeintrag.
 *
 * Die Server Actions ruft der Aufrufer: Er weiss, was danach zu melden und
 * aufzufrischen ist. */
export function SichtbarkeitDialoge({
  schritt,
  onClose,
  fehlend,
  varianten,
  pending,
  onVeroeffentlichen,
  onAufEntwurf,
}: {
  schritt: SichtbarkeitSchritt | null;
  onClose: () => void;
  /** Was dem Training zum Veröffentlichen fehlt — für die Aufzählung im
   *  ersten Dialog. Die Action prüft es serverseitig erneut. */
  fehlend: readonly FehlendeBedingung[];
  /** Die Varianten des Hauptteils — nur zum Benennen des Fehlenden (#204
   *  AK 2). Bei genau einer bleibt sie ungenannt: Dann ist «die Variante» kein
   *  Begriff, den der Trainer je gesehen hat (#201 PC 5). */
  varianten: readonly Variante[];
  pending: boolean;
  onVeroeffentlichen: () => void;
  onAufEntwurf: () => void;
}) {
  const mehrereVarianten = varianten.length > 1;

  /** Der Name zur Variante, oder `undefined` wenn es nichts zu unterscheiden
   *  gibt. Eine unbekannte ID (die Variante wurde in einem anderen Fenster
   *  entfernt) bleibt ebenfalls ungenannt — die Bedingung selbst stimmt weiter. */
  function varianteName(id: string | null): string | undefined {
    if (!mehrereVarianten || !id) return undefined;
    return varianten.find((v) => v.id === id)?.name;
  }

  return (
    <>
      {/* Bedingungen noch nicht erfüllt */}
      <Dialog
        open={schritt === "unvollstaendig"}
        onClose={onClose}
        title="Noch nicht veröffentlichbar"
        actions={
          <Button variant="filled" onClick={onClose}>
            Verstanden
          </Button>
        }
      >
        <p className="mb-3">Zum Veröffentlichen fehlt noch:</p>
        <ul className="flex flex-col gap-1">
          {fehlend.map((b) => (
            <li
              key={`${b.bedingung}|${b.varianteId ?? ""}`}
              className="type-body-medium text-on-surface"
            >
              · {bedingungText(b.bedingung, varianteName(b.varianteId))}
            </li>
          ))}
        </ul>
      </Dialog>

      {/* Bestätigung der Tragweite — bei jedem Veröffentlichen (AK 2). */}
      <Dialog
        open={schritt === "tragweite"}
        onClose={onClose}
        title="Training veröffentlichen?"
        actions={
          <>
            <Button variant="text" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={onVeroeffentlichen} disabled={pending}>
              Veröffentlichen
            </Button>
          </>
        }
      >
        <p>
          Das Training wird für alle sichtbar — mit allen Inhalten, Bildern und
          Feld-Diagrammen. Dein Anzeigename steht als Urheber daran und ist für
          alle sichtbar.
        </p>
        <p className="mt-3">
          Du kannst es weiter bearbeiten; die Community sieht dann jeweils deinen
          aktuellen Stand. Solange es öffentlich ist, braucht es aber eine
          Alterskategorie sowie je eine Übung in der Einleitung und
          {mehrereVarianten ? " in jeder Variante im freien Spiel" : " im freien Spiel"}.
          Willst du das ändern, setze es zuerst auf Entwurf.
        </p>
      </Dialog>

      {/* Auf Entwurf setzen */}
      <Dialog
        open={schritt === "rueckzug"}
        onClose={onClose}
        title="Auf Entwurf setzen?"
        actions={
          <>
            <Button variant="text" onClick={onClose}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={onAufEntwurf} disabled={pending}>
              Auf Entwurf setzen
            </Button>
          </>
        }
      >
        <p>
          Das Training verschwindet aus dem öffentlichen Bestand und bleibt im
          Übrigen unberührt. Kopien, die andere bereits übernommen haben, bleiben
          bestehen — sie sind eigenständig.
        </p>
      </Dialog>
    </>
  );
}
