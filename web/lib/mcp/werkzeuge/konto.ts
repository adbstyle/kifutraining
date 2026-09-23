import "server-only";
import { ok } from "@/lib/kern/ergebnis";
import { LeereEingabe, WerBinIchAusgabe } from "@/lib/mcp/eingaben";
import { VokabularSchema, baueVokabular } from "@/lib/mcp/vokabular";
import { werkzeug } from "@/lib/mcp/werkzeug";

/**
 * Werkzeuge rund um den Zugang selbst (Story #142).
 *
 * `wer_bin_ich` lässt den Trainer im KI-Client prüfen, mit welchem Konto der
 * Zugang verbunden ist — mit dem Namen, den KiFu auch sonst zeigt, und ohne
 * interne Kennungen (keine User-ID, keine Client-ID).
 *
 * `vokabular` liefert die Werte aller geführten Angaben (AK 9), damit der
 * Assistent Filter nicht rät. Es hängt an keinem Konto und liest keine Daten;
 * gezählt wird es trotzdem — jeder Werkzeug-Aufruf zählt gleich (AK 12).
 */
export const werBinIch = werkzeug({
  name: "wer_bin_ich",
  titel: "Verbundenes Konto",
  beschreibung:
    "Zeigt, mit welchem KiFu-Konto dieser Zugang verbunden ist: den Anzeigenamen und " +
    "die Adresse der Konto-Seite, auf der sich der Zugang widerrufen lässt.",
  nurLesen: true,
  eingabe: LeereEingabe,
  ausgabe: WerBinIchAusgabe,
  ausfuehren: async (_e, zugang) => {
    const { data, error } = await zugang.supabase.rpc("anzeige_name", {
      p_user: zugang.userId,
    });
    if (error) throw error; // → «technisch», Rohtext nur im Server-Log
    return ok({ anzeigename: String(data ?? ""), konto_url: zugang.url("konto") });
  },
});

export const vokabular = werkzeug({
  name: "vokabular",
  titel: "Werte der geführten Angaben",
  beschreibung:
    "Liefert je Altersstufe die zulässigen Werte samt Klartext: Alterskategorien, " +
    "Trainingsteile und ihre Blöcke (mit dem, was eine Übung dort trägt: " +
    "Erscheinungsform, Übungstyp, Pflicht zur Hauptteilkategorie, Ablaufform), " +
    "Hauptteilkategorien, Erscheinungsformen, Feldtypen und Übungstypen — dazu die " +
    "Werte des Filters «einordnung» von «uebungen_suchen». Ändert sich nur mit KiFu " +
    "selbst; einmal abrufen genügt.",
  nurLesen: true,
  eingabe: LeereEingabe,
  ausgabe: VokabularSchema,
  ausfuehren: async () => ok(baueVokabular()),
});
