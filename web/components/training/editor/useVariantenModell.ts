"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gleicheFolge, verschoben } from "@/lib/ordnung";
import {
  benenneVariante,
  entferneVariante,
  verschiebeVariante,
} from "@/lib/actions/varianten";
import type { Variante } from "@/lib/varianten";

/**
 * Das Varianten-Modell des Editors (#209): die Varianten des Hauptteils, ihre
 * Reihenfolge und ihre Bezeichnungen.
 *
 * Eigener Hook aus demselben Grund wie `useGruppenModell`: ein Zustand und drei
 * Aktionen darauf, die zusammengehören. Im Editor stünden sie zwischen Dauern,
 * Stufen und Dialogen.
 *
 * Umsortieren und Umbenennen wirken SOFORT und werden bei einem Fehler
 * zurückgenommen (AK 8): Der Tausch soll unter dem Finger geschehen und nicht
 * erst nach dem Rundlauf zum Server — stünde hier danach eine Reihenfolge, die
 * kein Training trägt, sprängen die Chips beim nächsten Öffnen zurück.
 *
 * Anders als bei den Gruppen frischt jede geglückte Änderung die Serverdaten
 * auf: Die Reihenfolge entscheidet, welche Variante beim Öffnen gilt (#202
 * PC 3), und die Bezeichnung steht ausserhalb dieser Leiste — in den
 * Rückfragen, im Stufen-Abgleich, in den Meldungen zu den
 * Veröffentlichungs-Bedingungen. Ein Chip-Klick an den Gruppen ändert dagegen
 * nur die Leiste selbst.
 *
 * Der Serverstand GEWINNT, sobald er hereinkommt: Verglichen wird die
 * Referenz der Prop (Muster `VarianteNameFeld`), denn genau eine neue Prop
 * bedeutet «der Server hat geantwortet». Eine Überlagerung, die sich erst
 * auflöst, wenn Reihenfolge und Namen übereinstimmen, wäre feiner — aber sie
 * hielte auch dann stand, wenn ein zweites Fenster etwas anderes gespeichert
 * hat, und behauptete einen Stand, den kein Training trägt. Beim Rendern
 * angeglichen statt in einem Effekt: So steht nie ein Zwischenbild mit der
 * alten Ordnung auf dem Schirm.
 */
export function useVariantenModell({
  varianten: vomServer,
  melde,
}: {
  /** Die Varianten, wie sie vom Server kamen (in ihrer `position`-Folge). */
  varianten: readonly Variante[];
  /** Was in die Snackbar geht: abgelehnte Änderungen. */
  melde: (text: string) => void;
}) {
  const router = useRouter();
  const [varianten, setVarianten] = useState<readonly Variante[]>(vomServer);
  const gesehen = useRef(vomServer);
  if (gesehen.current !== vomServer) {
    gesehen.current = vomServer;
    setVarianten(vomServer);
  }
  const [, startTransition] = useTransition();
  // Ein zweiter Klick, während der erste unterwegs ist, tauschte zweimal — die
  // Leiste stünde dann anders als die Datenbank. Refs statt State: die Schranke
  // muss beim nächsten Klick schon gelten, nicht erst beim nächsten Rendern.
  // Das Umbenennen braucht keine: Es läuft über den Dialog, und der hält seine
  // eigene.
  const verschiebt = useRef(false);
  const entfernt = useRef(false);

  /** Eine Variante mit ihrer Nachbarin tauschen (#202 AK 3). */
  function verschiebe(varianteId: string, dir: -1 | 1) {
    if (verschiebt.current) return;
    const index = varianten.findIndex((v) => v.id === varianteId);
    if (index < 0) return;
    const vorher = varianten;
    const neu = verschoben(varianten, index, dir);
    // Am Rand geschieht nichts — dann gibt es auch nichts zu schicken. Die
    // Leiste bietet den Eintrag dort gar nicht erst an; die Schranke steht
    // trotzdem, weil sie hier billiger ist als eine abgelehnte Runde zum Server.
    if (gleicheFolge(neu.map((v) => v.id), vorher.map((v) => v.id))) return;
    setVarianten(neu);
    verschiebt.current = true;
    startTransition(async () => {
      try {
        const r = await verschiebeVariante(varianteId, dir);
        if (r.ok) {
          router.refresh();
          return;
        }
        setVarianten(vorher);
        melde(r.error ?? "Verschieben fehlgeschlagen.");
      } finally {
        verschiebt.current = false;
      }
    });
  }

  /** Eine Variante umbenennen (#202 AK 1/2). Die Meldung geht zurück an den
   *  Dialog, statt in die Snackbar zu wandern: Sie gehört an das Feld, in das
   *  der Trainer gerade geschrieben hat. */
  async function benenne(varianteId: string, name: string): Promise<string | null> {
    const getrimmt = name.trim();
    const vorher = varianten;
    setVarianten((prev) =>
      prev.map((v) => (v.id === varianteId ? { ...v, name: getrimmt } : v)),
    );
    const r = await benenneVariante(varianteId, getrimmt);
    if (!r.ok) {
      setVarianten(vorher);
      return r.error ?? "Umbenennen fehlgeschlagen.";
    }
    startTransition(() => {
      router.refresh();
    });
    return null;
  }

  /**
   * Eine Variante entfernen (#202 AK 4, #209 AK 7). Die Rückfrage davor stellt
   * der Editor — hier wird sie nur noch ausgeführt.
   *
   * Zurück kommt, ob es geglückt ist: Der Editor muss danach die angezeigte
   * Variante wechseln, die Adresse angleichen und quittieren — und das darf er
   * nur, wenn die Variante wirklich weg ist.
   *
   * Die Leiste zieht sofort nach, obwohl der Editor gleich darauf die Seite
   * neu lädt: Bis der Serverstand da ist, stünde der Chip einer Variante da,
   * die es nicht mehr gibt. Die verbleibende Bezeichnung holt der Ladevorgang
   * nach — bei EINER Variante zeigt die Leiste ohnehin keine an.
   */
  async function entferne(variante: Variante): Promise<boolean> {
    if (entfernt.current) return false;
    entfernt.current = true;
    try {
      const r = await entferneVariante(variante.id);
      if (!r.ok) {
        melde(r.error ?? "Entfernen fehlgeschlagen.");
        return false;
      }
      setVarianten((prev) => prev.filter((v) => v.id !== variante.id));
      return true;
    } finally {
      entfernt.current = false;
    }
  }

  return { varianten, verschiebe, benenne, entferne };
}
