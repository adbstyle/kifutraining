// Die Vorprüfung einer vollständigen Folge (Epic #190, #193 und #263).
//
// Zwei Werkzeuge setzen eine Reihenfolge in einem Zug: die Übungen eines
// Abschnitts (`setzeUebungsfolge`) und die Varianten des Hauptteils
// (`setzeVariantenfolge`). Beide verlangen die VOLLSTÄNDIGE Folge — jede
// Kennung des Bestands genau einmal — und nennen vorab, was fehlt, doppelt
// steht oder nicht dazugehört. Die Regel ist dieselbe, darum steht sie einmal
// hier; die RPCs prüfen dasselbe unter Sperre noch einmal.
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// die Prüfskripte laden diese Datei ohne Server.
import { fehlschlag, type KernFehler } from "@/lib/kern/ergebnis";

type Benannt = { id: string; name: string };

/** Was fehlt, doppelt steht oder nicht zum Bestand gehört — `null`, wenn
 *  `ids` genau den Bestand in einer Reihenfolge nennt.
 *
 *  Die Meldung beginnt mit dem Klartext des RPC-Markers (`doppelt`,
 *  `unvollstaendig`) und nennt dahinter die Betroffenen mit Namen und
 *  Kennung — der Name allein sagte nicht, welche gemeint ist, wenn zwei
 *  gleich heissen. `namen` kennt, wo es mehr gibt als den Bestand, auch die
 *  Namen fremder Kennungen (eine Übung aus einem anderen Abschnitt); eine
 *  unbekannte Kennung steht ohne Namen da. */
export function pruefeVollstaendigeFolge(
  ids: readonly string[],
  bestand: readonly Benannt[],
  o: {
    doppelt: string;
    unvollstaendig: string;
    /** Wovon die fremden nicht Teil sind: «Nicht in diesem ${bereich}: …». */
    bereich: string;
    /** Das Eingabefeld der Folge (`fassung_ids`, `variante_ids`). */
    feld: string;
    /** Namen über den Bestand hinaus; ohne Angabe nur die des Bestands. */
    namen?: ReadonlyMap<string, string>;
    /** Die Meldung für einen leeren Bestand — geprüft nach den Doppelten,
     *  vor der Vollständigkeit (dieselbe Reihenfolge wie die RPC). */
    leer?: { meldung: string; feld: string };
  },
): KernFehler | null {
  const namen = o.namen ?? new Map(bestand.map((b) => [b.id, b.name]));
  const genannt = (id: string) => (namen.has(id) ? `„${namen.get(id)}" (${id})` : id);

  const doppelt = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (doppelt.length > 0)
    return fehlschlag("regel", `${o.doppelt} Mehrfach: ${doppelt.map(genannt).join(", ")}.`, {
      feld: o.feld,
    });
  if (o.leer && bestand.length === 0) return fehlschlag("regel", o.leer.meldung, { feld: o.leer.feld });

  const imBestand = new Set(bestand.map((b) => b.id));
  const fehlen = bestand.filter((b) => !ids.includes(b.id));
  const fremd = ids.filter((id) => !imBestand.has(id));
  if (fehlen.length === 0 && fremd.length === 0) return null;
  const teile = [o.unvollstaendig];
  if (fehlen.length > 0) teile.push(`Es fehlen: ${fehlen.map((b) => genannt(b.id)).join(", ")}.`);
  if (fremd.length > 0) teile.push(`Nicht in diesem ${o.bereich}: ${fremd.map(genannt).join(", ")}.`);
  return fehlschlag("regel", teile.join(" "), {
    feld: o.feld,
    zulaessig: bestand.map((b) => b.id),
  });
}
