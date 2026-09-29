import "server-only";
import { z } from "zod";
import { abgebildet } from "@/lib/kern/ergebnis";
import { legeUebungAn } from "@/lib/kern/uebungen";
import { UEBUNG_ANGABEN, UebungAnlegenEingabe, alsUebungInhalt } from "@/lib/mcp/uebung-eingaben";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Eigene Übungen erfassen (Epic #139, ab Story #143).
 *
 * Dünne Adapter über den Fachkern (lib/kern/uebungen.ts), der dieselbe
 * Regelquelle wie das Übungsformular nutzt. Zod prüft nur Typ und Enum, streng
 * gegen unbekannte Felder; jede Fachregel prüft der Kern und nennt die
 * Verstösse auf einmal in `verstoesse` (#143 AK 6, NFR 2).
 */

// ── uebung_anlegen ──────────────────────────────────────────────────────────

export const uebungAnlegen = werkzeug({
  name: "uebung_anlegen",
  titel: "Übung anlegen",
  beschreibung:
    "Legt eine eigene Übung als privaten Entwurf an — sichtbar nur für dich und in KiFu unter " +
    "deinen eigenen Übungen. Aktuell nur Kinderfussball. Es gelten dieselben Regeln wie im " +
    "Formular in KiFu. Was eine Regel verletzt, wird nicht still verworfen: Dann entsteht nichts, " +
    "und «verstoesse» nennt jede verletzte Angabe mit Feld, Grund und, wo es eine Aufzählung " +
    "gibt, den zulässigen Werten — auch einen Wert, der nicht zur Einordnung oder zur Altersstufe " +
    "passt. Danach die ganze Übung korrigiert noch einmal senden. Ist die Einordnung ungültig oder " +
    "fehlt im Hauptteil die Hauptteilkategorie, kann der nächste Versuch weitere Verstösse nennen. " +
    `${UEBUNG_ANGABEN} Die Werte samt Klartext liefert «vokabular». Ein Feld-Diagramm und Fotos ` +
    "nimmt das Werkzeug nicht an. Liefert Kennung, slug und die Adresse der Übung in KiFu.",
  nurLesen: false,
  eingabe: UebungAnlegenEingabe,
  ausgabe: z.object({
    id: z.string(),
    slug: z.string(),
    /** Die Seite der Übung in KiFu. */
    url: z.string(),
    sichtbarkeit: z.literal("entwurf"),
  }),
  ausfuehren: async (e, zugang) =>
    abgebildet(
      await legeUebungAn(zugang.supabase, zugang.userId, {
        ...alsUebungInhalt(e),
        altersstufe: e.altersstufe,
      }),
      (w) => ({
        id: w.id,
        slug: w.slug,
        url: zugang.url("uebung", w.slug),
        sichtbarkeit: w.sichtbarkeit,
      }),
    ),
});
