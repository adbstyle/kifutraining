import "server-only";
import { z } from "zod";
import { abgebildet, ok } from "@/lib/kern/ergebnis";
import { diagrammMaengel, setzeDiagramm } from "@/lib/kern/uebung-diagramm";
import { BEFUND_CODES, GRENZ_CODES } from "@/lib/diagramm-pruefung";
import { materialAusgabe, materialSchema } from "@/lib/material-ausgabe";
import { DiagrammKatalogSchema, baueDiagrammKatalog } from "@/lib/mcp/diagramm-katalog";
import { DiagrammEingabe, MANGEL_ERKLAERT, MangelAusgabe, alsMangel } from "@/lib/mcp/diagramm-eingaben";
import { LeereEingabe } from "@/lib/mcp/eingaben";
import { UEBUNG_KENNUNG_FEHLER, UebungKennung } from "@/lib/mcp/uebung-eingaben";
import { werkzeug, type Zugang } from "@/lib/mcp/werkzeug";

/**
 * Feld-Diagramme über den KI-Assistenten (Stories #145, #146).
 *
 * `diagramm_katalog_abrufen` sagt, was ein Diagramm führen kann (AK 1) — aus
 * lib/diagramm.ts und dem Symbol-Register abgeleitet, wie `vokabular` hängt
 * er an keinem Konto. `uebung_diagramm_setzen` ist ein dünner Adapter über
 * den Kern (lib/kern/uebung-diagramm.ts), der dieselben Grenzen prüft wie das
 * Speichern aus der Übungsmaske. Die Mängel (#146) reisen im Erfolg, nie als
 * Fehler; `uebung_diagramm_maengel_abrufen` liefert sie jederzeit.
 */

/** Kennung, Name und Seite der Übung. */
const Uebung = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  url: z.string().describe("Die Seite der Übung in KiFu."),
});
const uebung = (w: { id: string; slug: string; name: string }, zugang: Zugang) => ({
  id: w.id,
  slug: w.slug,
  name: w.name,
  url: zugang.url("uebung", w.slug),
});

const code = (c: keyof typeof MANGEL_ERKLAERT) => `${c} (${MANGEL_ERKLAERT[c]})`;
const MANGEL_CODES = BEFUND_CODES.filter((c) => !(GRENZ_CODES as readonly string[]).includes(c));

export const diagrammKatalogAbrufen = werkzeug({
  name: "diagramm_katalog_abrufen",
  titel: "Diagramm-Katalog",
  beschreibung:
    "Liefert, was ein Feld-Diagramm führen kann: Zeichenfläche und Koordinaten, jedes Symbol mit " +
    "Rahmenmass, Farbe, Drehbarkeit und Posen, die Hände der Figuren, Pfade, Formen, Text, Farben " +
    "und Grenzen, dazu Beispielelemente. Hängt an keinem Konto; einmal abrufen genügt, bevor du " +
    "«uebung_diagramm_setzen» aufrufst.",
  nurLesen: true,
  eingabe: LeereEingabe,
  ausgabe: DiagrammKatalogSchema,
  ausfuehren: async () => ok(baueDiagrammKatalog()),
});

export const uebungDiagrammSetzen = werkzeug({
  name: "uebung_diagramm_setzen",
  titel: "Feld-Diagramm setzen",
  beschreibung:
    "Setzt das Feld-Diagramm einer eigenen Übung, gleich welcher Altersstufe, oder ersetzt das " +
    "vorhandene vollständig. Die übrigen Angaben der Übung bleiben unverändert, ebenso ihre " +
    "Fassungen in Trainings. KiFu nimmt ein Diagramm nur an, wenn jedes Element auf der " +
    "Zeichenfläche liegt und nur Elemente und Werte vorkommen, die es führen kann (siehe " +
    "«diagramm_katalog_abrufen»). Sonst lehnt es mit «eingabe» ab und nennt in «verstoesse» jedes " +
    "betroffene Element samt Grund; dann wird nichts gespeichert. Ein leeres Diagramm wird " +
    "abgelehnt, ein Diagramm entfernen geht über diesen Zugang nicht. Mit dem Diagramm ersetzt " +
    "KiFu die gezählte Materialliste durch die aus dem Diagramm gezählte und nennt sie in " +
    "«material»; die freie Ergänzung bleibt. Hatte die Übung kein Bild, wird das Diagramm ihr " +
    "Bild; ein vorhandenes Foto bleibt das angezeigte Bild («angezeigtes_bild»). Zusätzlich meldet " +
    "«maengel» inhaltliche Befunde am gespeicherten Diagramm, je mit Element und Behebung: " +
    `${MANGEL_CODES.map(code).join(", ")}. Sie sind keine Fehler: Das Diagramm ist gespeichert. ` +
    "Setze es korrigiert erneut, bevor du es dem Trainer als fertig meldest. Eine leere Liste " +
    `heisst: nichts zu melden. ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kennung: UebungKennung, diagramm: DiagrammEingabe }),
  ausgabe: z.object({
    uebung: Uebung,
    anzahl_elemente: z.number().int(),
    angezeigtes_bild: z.enum(["diagramm", "foto"]),
    material: materialSchema(),
    maengel: z.array(MangelAusgabe),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeDiagramm(zugang.supabase, zugang.userId, { kennung: e.kennung, diagramm: e.diagramm }),
      (w) => ({
        uebung: uebung(w, zugang),
        anzahl_elemente: w.anzahlElemente,
        angezeigtes_bild: w.angezeigtesBild,
        material: materialAusgabe(w.material.liste, w.material.ergaenzung),
        maengel: w.maengel.map(alsMangel),
      }),
    ),
});

export const uebungDiagrammMaengelAbrufen = werkzeug({
  name: "uebung_diagramm_maengel_abrufen",
  titel: "Mängel des Feld-Diagramms",
  beschreibung:
    "Liefert die inhaltlichen Mängel des gespeicherten Feld-Diagramms einer eigenen Übung — auch " +
    "eines, das der Trainer in KiFu gezeichnet hat —, je mit Element und Behebung. Sie sind keine " +
    `Fehler und hindern nichts. Mängel: ${MANGEL_CODES.map(code).join(", ")}. Dazu stehen ` +
    `${GRENZ_CODES.map(code).join(", ")} für Angaben, die KiFu heute nicht mehr annähme (ein ` +
    "älteres Diagramm); vor einem erneuten Setzen sind sie zu beheben. Ob das Diagramm die Übung fachlich " +
    "richtig abbildet, beurteilt KiFu nicht. Eine leere Liste heisst: nichts zu melden. Ohne " +
    `Diagramm ist «hat_diagramm» false. ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: true,
  eingabe: z.object({ kennung: UebungKennung }),
  ausgabe: z.object({ uebung: Uebung, hat_diagramm: z.boolean(), maengel: z.array(MangelAusgabe) }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await diagrammMaengel(zugang.supabase, zugang.userId, { kennung: e.kennung }), (w) => ({
      uebung: uebung(w, zugang),
      hat_diagramm: w.hatDiagramm,
      maengel: w.befunde.map(alsMangel),
    })),
});
