import "server-only";
import { z } from "zod";
import { abgebildet, ok } from "@/lib/kern/ergebnis";
import { setzeDiagramm } from "@/lib/kern/uebung-diagramm";
import { materialAusgabe, materialSchema } from "@/lib/material-ausgabe";
import { DiagrammKatalogSchema, baueDiagrammKatalog } from "@/lib/mcp/diagramm-katalog";
import { DiagrammEingabe } from "@/lib/mcp/diagramm-eingaben";
import { LeereEingabe } from "@/lib/mcp/eingaben";
import { UEBUNG_KENNUNG_FEHLER, UebungKennung } from "@/lib/mcp/uebung-eingaben";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Feld-Diagramme über den KI-Assistenten (Story #145).
 *
 * `diagramm_katalog_abrufen` sagt, was ein Diagramm führen kann (AK 1) — aus
 * lib/diagramm.ts und dem Symbol-Register abgeleitet, wie `vokabular` hängt
 * er an keinem Konto. `uebung_diagramm_setzen` ist ein dünner Adapter über
 * den Kern (lib/kern/uebung-diagramm.ts), der dieselben Grenzen prüft wie das
 * Speichern aus der Übungsmaske.
 */

export const diagrammKatalogAbrufen = werkzeug({
  name: "diagramm_katalog_abrufen",
  titel: "Diagramm-Katalog",
  beschreibung:
    "Liefert, was ein Feld-Diagramm führen kann: Zeichenfläche und Koordinaten, jedes Symbol mit " +
    "Rahmenmass, Farbe, Drehbarkeit und Posen, Pfade, Formen, Text, Farben und Grenzen, dazu " +
    "Beispielelemente. Hängt an keinem Konto; einmal abrufen genügt, bevor du " +
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
    "betroffene Element samt Grund; dann wird nichts gespeichert. Angaben, die ein Element nicht " +
    "kennt, speichert KiFu nicht. Ein leeres Diagramm wird abgelehnt, ein Diagramm entfernen geht " +
    "über diesen Zugang nicht. Mit dem Diagramm ersetzt KiFu die gezählte Materialliste durch die " +
    "aus dem Diagramm gezählte und nennt sie in «material»; die freie Ergänzung bleibt. Hatte die " +
    "Übung kein Bild, wird das Diagramm ihr Bild; ein vorhandenes Foto bleibt das angezeigte Bild " +
    `(«angezeigtes_bild»). ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kennung: UebungKennung, diagramm: DiagrammEingabe }),
  ausgabe: z.object({
    uebung: z.object({
      id: z.string(),
      slug: z.string(),
      name: z.string(),
      url: z.string().describe("Die Seite der Übung in KiFu."),
    }),
    anzahl_elemente: z.number().int(),
    angezeigtes_bild: z.enum(["diagramm", "foto"]),
    material: materialSchema(),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await setzeDiagramm(zugang.supabase, zugang.userId, { kennung: e.kennung, diagramm: e.diagramm }),
      (w) => ({
        uebung: { id: w.id, slug: w.slug, name: w.name, url: zugang.url("uebung", w.slug) },
        anzahl_elemente: w.anzahlElemente,
        angezeigtes_bild: w.angezeigtesBild,
        material: materialAusgabe(w.material.liste, w.material.ergaenzung),
      }),
    ),
});
