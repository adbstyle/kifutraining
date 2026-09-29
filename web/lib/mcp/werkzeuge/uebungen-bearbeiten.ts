import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import {
  TRAGWEITE_UEBUNG_VEROEFFENTLICHEN,
  aendereUebung,
  legeUebungAn,
  setzeUebungAufEntwurf,
  veroeffentlicheUebung,
} from "@/lib/kern/uebungen";
import { materialAusgabe, materialSchema } from "@/lib/material-ausgabe";
import { Sichtbarkeit } from "@/lib/mcp/bausteine";
import {
  UEBUNG_ANGABEN,
  UEBUNG_KENNUNG_FEHLER,
  UebungAendernEingabe,
  UebungAnlegenEingabe,
  UebungKennung,
  alsUebungInhalt,
  alsUebungPatch,
} from "@/lib/mcp/uebung-eingaben";
import { werkzeug, type Zugang } from "@/lib/mcp/werkzeug";

/**
 * Eigene Übungen erfassen, ändern und öffentlich schalten (Epic #139, ab
 * Story #143).
 *
 * Dünne Adapter über den Fachkern (lib/kern/uebungen.ts), der dieselbe
 * Regelquelle wie das Übungsformular nutzt. Zod prüft nur Typ und Enum, streng
 * gegen unbekannte Felder; jede Fachregel prüft der Kern und nennt die
 * Verstösse auf einmal in `verstoesse` (#143 AK 6, NFR 2).
 *
 * Nie erreichbar (#144 OoS 1–3): eigene Übungen löschen, Manual- und fremde
 * Übungen ändern, Übungen in Trainings ändern.
 */

/** Kennung, slug und Seite der Übung — der Kopf jedes Ergebnisses hier. */
const Kopf = { id: z.string(), slug: z.string(), url: z.string().describe("Die Seite der Übung in KiFu.") };
const kopf = (w: { id: string; slug: string }, zugang: Zugang) => ({
  id: w.id,
  slug: w.slug,
  url: zugang.url("uebung", w.slug),
});

/** Was jedes Werkzeug hier zur Ablehnung einer Übung sagt. */
const ABLEHNUNG =
  "Was eine Regel verletzt, wird nicht still verworfen: Dann bleibt alles, wie es war, und " +
  "«verstoesse» nennt jede verletzte Angabe mit Feld, Grund und, wo es eine Aufzählung gibt, den " +
  "zulässigen Werten — auch einen Wert, der nicht zur Einordnung oder zur Altersstufe passt. Ist " +
  "die Einordnung ungültig oder fehlt im Hauptteil die Hauptteilkategorie, kann der nächste " +
  "Versuch weitere Verstösse nennen.";

// ── uebung_anlegen (#143) ───────────────────────────────────────────────────

export const uebungAnlegen = werkzeug({
  name: "uebung_anlegen",
  titel: "Übung anlegen",
  beschreibung:
    "Legt eine eigene Übung als privaten Entwurf an — sichtbar nur für dich und in KiFu unter " +
    "deinen eigenen Übungen, bis «uebung_veroeffentlichen» sie öffentlich schaltet. Aktuell nur " +
    `Kinderfussball. Es gelten dieselben Regeln wie im Formular in KiFu. ${ABLEHNUNG} Danach die ` +
    `ganze Übung korrigiert noch einmal senden. ${UEBUNG_ANGABEN} Die Werte samt Klartext liefert ` +
    "«vokabular». Ein Feld-Diagramm lässt sich in «diagramm» gleich mitgeben, mit denselben " +
    "Grenzen wie bei «uebung_diagramm_setzen»: Es wird das Bild der Übung, und KiFu zählt das " +
    "Material daraus selbst — dann «material.liste» weglassen, die Ergänzung bleibt möglich — und " +
    "nennt die gezählte Liste in «material». Verletzt das Diagramm eine Grenze, entsteht nichts, " +
    "und «verstoesse» nennt die betroffenen Elemente zusammen mit den übrigen Angaben. Fotos nimmt " +
    "das Werkzeug nicht an. Liefert Kennung, slug und die Adresse der Übung in KiFu.",
  nurLesen: false,
  eingabe: UebungAnlegenEingabe,
  ausgabe: z.object({
    ...Kopf,
    sichtbarkeit: z.literal("entwurf"),
    material: materialSchema().optional().describe("Nur mit Diagramm: das daraus gezählte Material."),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeUebungAn(zugang.supabase, zugang.userId, {
        ...alsUebungInhalt(e),
        altersstufe: e.altersstufe,
        diagramm: e.diagramm,
      }),
      (w) => ({
        ...kopf(w, zugang),
        sichtbarkeit: w.sichtbarkeit,
        ...(w.material && { material: materialAusgabe(w.material.liste, w.material.ergaenzung) }),
      }),
    ),
});

// ── uebung_aendern (#144) ───────────────────────────────────────────────────

export const uebungAendern = werkzeug({
  name: "uebung_aendern",
  titel: "Übung ändern",
  beschreibung:
    "Ändert einzelne Angaben einer eigenen Übung. Was du nicht nennst, bleibt, wie es ist; " +
    "«null» entfernt eine freiwillige Angabe. Bei «spielfeld» und «anzahl_kinder» ersetzt die " +
    "neue Angabe die bisherige als Ganzes, bei «material» je Teil («liste», «ergaenzung»). KiFu " +
    `prüft danach die ganze Übung mit denselben Regeln wie das Formular. ${ABLEHNUNG} Wechselt ` +
    "die Einordnung, prüft KiFu auch die gespeicherten Angaben, die die neue Einordnung nicht " +
    "kennt, und löscht sie nicht still, sondern nennt sie: mit «null» entfernen und die neuen " +
    "Pflichtangaben mitsenden. Welche Angaben es gibt, welche Pflicht sind und welche Werte " +
    "zulässig sind, steht bei «uebung_anlegen» und in «vokabular». Die Altersstufe ändert sich " +
    "nie; aktuell lassen sich nur Übungen des Kinderfussballs ändern. Bild und Feld-Diagramm " +
    "ändert dieses Werkzeug nicht — das Diagramm setzt «uebung_diagramm_setzen», die Sichtbarkeit " +
    "«uebung_veroeffentlichen» und " +
    "«uebung_auf_entwurf_setzen»; steht die Übung schon in einem Training, behält sie dort ihre " +
    `Fassung. ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: UebungAendernEingabe,
  ausgabe: z.object({ ...Kopf, sichtbarkeit: Sichtbarkeit }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await aendereUebung(zugang.supabase, zugang.userId, {
        kennung: e.kennung,
        altersstufe: e.altersstufe,
        aenderung: alsUebungPatch(e),
      }),
      (w) => ({ ...kopf(w, zugang), sichtbarkeit: w.sichtbarkeit }),
    ),
});

// ── uebung_veroeffentlichen / uebung_auf_entwurf_setzen (#144) ──────────────

export const uebungVeroeffentlichen = werkzeug({
  name: "uebung_veroeffentlichen",
  titel: "Übung veröffentlichen",
  beschreibung:
    "Schaltet eine eigene Übung öffentlich — ohne Rückfrage und in beiden Altersstufen. " +
    "Tragweite, die du dem Trainer vorher nennen solltest: " +
    `«${TRAGWEITE_UEBUNG_VEROEFFENTLICHEN}» Es entsteht keine Kopie: Die Übung bleibt ` +
    "bearbeitbar, und die Öffentlichkeit sieht jeweils den aktuellen Stand. Eine öffentliche " +
    `Übung bleibt öffentlich. ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kennung: UebungKennung }),
  ausgabe: z.object({ ...Kopf, sichtbarkeit: z.literal("oeffentlich"), tragweite: z.string() }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await veroeffentlicheUebung(zugang.supabase, zugang.userId, { kennung: e.kennung }), (w) => ({
      ...kopf(w, zugang),
      sichtbarkeit: w.sichtbarkeit,
      tragweite: w.tragweite,
    })),
});

export const uebungAufEntwurfSetzen = werkzeug({
  name: "uebung_auf_entwurf_setzen",
  titel: "Übung auf Entwurf setzen",
  beschreibung:
    "Nimmt eine eigene öffentliche Übung aus dem öffentlichen Bestand; sie bleibt als privater " +
    "Entwurf in deinem Bestand. Was andere bereits in ihre Trainings übernommen oder in ihren " +
    "Bestand kopiert haben, bleibt bestehen — es sind eigenständige Kopien; benachrichtigt wird " +
    `niemand. Ein Entwurf bleibt Entwurf. ${UEBUNG_KENNUNG_FEHLER}`,
  nurLesen: false,
  eingabe: z.object({ kennung: UebungKennung }),
  ausgabe: z.object({ ...Kopf, sichtbarkeit: z.literal("entwurf") }),
  ausfuehren: async (e, zugang) =>
    abgebildet(await setzeUebungAufEntwurf(zugang.supabase, zugang.userId, { kennung: e.kennung }), (w) => ({
      ...kopf(w, zugang),
      sichtbarkeit: w.sichtbarkeit,
    })),
});
