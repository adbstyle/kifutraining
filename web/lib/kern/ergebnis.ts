// Das Ergebnis- und Fehlerprotokoll des Fachkerns (Spike #191 AK 1, Epic #190).
//
// Der Kern nimmt einen Client entgegen, der bereits als Nutzer spricht (Cookie-
// Session oder OAuth-Bearer), und tut nur Fachliches. Sein Ergebnis ist darum
// weder ein Redirect noch ein FormState noch ein MCP-Ergebnis, sondern diese
// eine Form, die beide Adapter — Server Action und MCP-Werkzeug — übersetzen.
//
// Konvention (verbindlich für lib/kern/**):
// - Eine Operation hat die Form `(supabase, userId, eingabe) → Promise<KernErgebnis<T>>`.
//   Der Client spricht bereits als Nutzer; die userId kommt als Parameter,
//   weil der Bearer-Client sie nicht selbst erfragen kann. Interne Helfer
//   (Laden, Position) dürfen davon abweichen.
// - Kern-Eingaben und `wert` sind camelCase (`trainingId`, `varianteId`);
//   die MCP-Adapter übersetzen nach snake_case.
// - `feld` nennt dagegen schon den Eingabenamen des KI-Werkzeugs in
//   snake_case (`training_id`, `exercise_id`, `hauptteilkategorie`), damit der
//   Assistent das Feld ohne Übersetzung findet. Die Oberfläche braucht davon
//   nur `name`.
// - Der Kern wirft nie; unerwartete Fehler werden `technisch`.
//
// REIN: keine Importe aus `next/*`, `server-only` oder Datenbank-Modulen —
// die Prüfskripte (`tsx scripts/pruefe-*.ts`) laden diese Datei ohne Server.
import { MELDUNG_VERGEBEN } from "@/lib/bezeichnung";
import { SERIE_MELDUNG } from "@/lib/serie";
import { TERMIN_MELDUNG } from "@/lib/termin";
import {
  bedingungAusFehler,
  fachlicheMeldung,
  fehlerMeldung,
  istRlsVerletzung,
  varianteAusFehler,
  type Bedingung,
  type FehlendeBedingung,
} from "@/lib/training-bedingungen";

/** Wie ein Fehler einzuordnen ist — damit der Assistent weiss, ob er die
 *  Eingabe korrigieren, eine Regel beachten, wiederholen oder aufgeben soll.
 *
 *  - `eingabe`: Form oder Wertebereich (leerer Name, 41 Zeichen, falsches Datum).
 *  - `regel`: Fachregel (Block passt nicht, Auffangen ohne Dauer, Team-Training
 *    nicht veröffentlichbar). `zulaessig` nennt, wo es sie gibt, die Werte.
 *  - `bedingung`: das Veröffentlichungs-Gate; trägt `bedingung`, `varianteId`,
 *    `fehlend`.
 *  - `nicht_gefunden`: die Kennung ist für dieses Konto nicht sichtbar. Ob sie
 *    nicht existiert oder jemand anderem privat gehört, bleibt bewusst
 *    ununterscheidbar (#193 OoS 7).
 *  - `keine_rechte`: sichtbar, aber nicht bearbeitbar — ein fremdes
 *    öffentliches Training oder eine Übung aus dem Manual bzw. eines anderen
 *    Kontos (PO 2026-09-23: eigene Meldung erlaubt, sie verrät nichts, was
 *    nicht ohnehin öffentlich ist).
 *  - `konflikt`: Nebenläufigkeit, etwa zwei Zuordnungen auf dieselbe Position;
 *    `wiederholbar: true` — nochmals senden genügt (#192 NFR 5).
 *  - `gebremst`: Aufruf-Begrenzung je Konto (#142 AK 12); `retryAfter` in
 *    Sekunden.
 *  - `technisch`: unerwartet; der Rohtext steht im Server-Log, nie hier. */
export type FehlerArt =
  | "eingabe"
  | "regel"
  | "bedingung"
  | "nicht_gefunden"
  | "keine_rechte"
  | "konflikt"
  | "gebremst"
  | "technisch";

/** Ein einzelner Verstoss einer abgelehnten Eingabe (#143 AK 6). `feld` ist
 *  der Eingabename des Werkzeugs, bei Verschachtelung mit Pfad
 *  («anzahl_kinder.max», «material.liste[1].menge»). `zulaessig` nennt, wo
 *  es eine Aufzählung gibt, die zulässigen Werte. */
export type Verstoss = { feld: string; meldung: string; zulaessig?: readonly string[] };

export type KernFehler = {
  ok: false;
  /** Fertige, wortgleich mit der Oberfläche formulierte Meldung. Nie ein
   *  roher Datenbank- oder Bibliothekstext. Heisst im MCP-Ergebnis gleich
   *  (`structuredContent.fehler.meldung`). */
  meldung: string;
  art: FehlerArt;
  /** Das betroffene Eingabefeld, wo es eines gibt (`name`, `stufen`, …). */
  feld?: string;
  /** Die zulässigen Werte, wo eine Aufzählung die Korrektur ohne Rückfrage
   *  erlaubt (Epic-NFR 3). */
  zulaessig?: readonly string[];
  /** Nur bei `art: "bedingung"`: die verletzte Veröffentlichungs-Bedingung
   *  (aus dem DB-Marker) samt Variante — der Editor spitzt die Meldung damit
   *  auf Variante und Block zu (#204 AK 3). */
  bedingung?: Bedingung;
  varianteId?: string;
  /** Nur beim Veröffentlichen: ALLE fehlenden Bedingungen, nicht nur die erste
   *  (#196 NFR 2). */
  fehlend?: FehlendeBedingung[];
  /** `true`, wenn ein unveränderter zweiter Versuch Erfolg verspricht. */
  wiederholbar?: boolean;
  /** Nur bei `art: "gebremst"`: Sekunden bis zum nächsten möglichen Aufruf. */
  retryAfter?: number;
  /** Nur bei `art: "keine_rechte"`: Das Training oder die Übung ist
   *  sichtbar, gehört aber jemand anderem (fremd und öffentlich, bei Übungen
   *  auch aus dem Manual). Ein fremdes Training meldet die Oberfläche wie
   *  «nicht gefunden» (`oberflaechenMeldung`), nur der KI-Weg eigens. */
  fremd?: true;
  /** Alle Verstösse einer abgelehnten Übung auf einmal, statt nur des
   *  ersten (#143 AK 6) — dann bleiben `feld` und `zulaessig` oben leer.
   *  Nie eine leere Liste. */
  verstoesse?: readonly Verstoss[];
  /** Zusatz nur für den Assistenten (die Oberfläche zeigt ihn nie), etwa
   *  «Es ist keine Kopie entstanden.» */
  hinweis?: string;
};

export type KernErgebnis<T = undefined> = { ok: true; wert: T } | KernFehler;

export function ok<T>(wert: T): KernErgebnis<T> {
  return { ok: true, wert };
}

/** Ein Ergebnis umformen: der Wert über `f`, ein Fehler unverändert. Der
 *  Normalfall jedes Adapters (camelCase → snake_case, Kennung → Adresse),
 *  ohne `if (!r.ok) return r;` in jedem Werkzeug. */
export function abgebildet<T, U>(r: KernErgebnis<T>, f: (wert: T) => U): KernErgebnis<U> {
  return r.ok ? ok(f(r.wert)) : r;
}

export function fehlschlag(
  art: FehlerArt,
  meldung: string,
  extra: Omit<Partial<KernFehler>, "ok" | "art" | "meldung"> = {},
): KernFehler {
  return { ok: false, art, meldung, ...extra };
}

/** Die Standard-Texte für «nicht sichtbar», je Gegenstand — wortgleich mit
 *  den bisherigen Meldungen der Server Actions. */
export const NICHT_GEFUNDEN = {
  uebung: "Diese Übung gibt es nicht oder sie ist für dein Konto nicht sichtbar.",
  /** Die Sätze «Termin/Training nicht gefunden.» stehen einmal in
   *  lib/termin.ts (`TERMIN_MELDUNG`) — die Datenebene meldet mit denselben. */
  training: TERMIN_MELDUNG.TRAINING_NICHT_GEFUNDEN,
  /** Eine Übung im Training (Fassung, `training_exercises`). */
  fassung: "Zuordnung nicht gefunden.",
  /** Eine Vorlage, die zugeordnet werden soll (Wortlaut des Pickers). */
  vorlage: "Übung nicht verfügbar.",
  /** Wie «Termin/Training»: der Satz steht einmal in lib/serie.ts
   *  (`SERIE_MELDUNG`), die Datenebene meldet mit demselben Marker. */
  team: SERIE_MELDUNG.TEAM_NICHT_GEFUNDEN,
  gruppe: "Gruppe nicht gefunden.",
  /** Ein Termin eines Team-Trainings (#198); sichtbar nur Mitgliedern. */
  termin: TERMIN_MELDUNG.TERMIN_NICHT_GEFUNDEN,
  /** Eine Variante des Hauptteils (#201, KI-Weg #263). Wortgleich mit den
   *  bisherigen Actions. */
  variante: "Variante nicht gefunden.",
} as const;

/** Ein sichtbares, aber nicht bearbeitbares Training — ein fremdes
 *  öffentliches (PO 2026-09-23). Nur der KI-Weg meldet das eigens; die
 *  Oberfläche bleibt bei «Training nicht gefunden.». */
export const FREMDES_TRAINING =
  "Dieses Training gehört jemand anderem. Du kannst es ansehen und übernehmen, aber nicht ändern.";

/** Eine sichtbare, aber nicht bearbeitbare Übung — aus dem Kifu-Manual, die
 *  öffentliche eines anderen Kontos oder eine verwaiste (#144 AK 4). Nur der
 *  KI-Weg meldet das eigens, wie beim Training. */
export const FREMDE_UEBUNG =
  "Diese Übung stammt aus dem Kifu-Manual oder gehört jemand anderem. Du kannst sie ansehen und " +
  "in deinen Bestand kopieren, aber nicht ändern.";

/** Zwei Aufrufe haben gleichzeitig dieselbe Position vergeben (Unique-Index
 *  `training_ex_pos_*`, #192 NFR 5). Nichts wurde überschrieben; ein zweiter
 *  Versuch rechnet die Position neu. */
export const MELDUNG_WIEDERHOLEN =
  "Gleichzeitig hat sich an derselben Stelle etwas geändert. Es genügt, es noch einmal zu versuchen.";

/** Ein Datenbankfehler als Kern-Fehler — dieselbe Übersetzung wie
 *  `fehlerMeldung` (die Meldung ist wortgleich), dazu die Einordnung:
 *
 *  1. eine verletzte Veröffentlichungs-Bedingung → `bedingung`, samt
 *     `bedingung`/`varianteId` zum Zuspitzen;
 *  2. eine andere fachliche Regel der Datenebene → `regel`;
 *  3. von der RLS abgewiesen → `keine_rechte`;
 *  4. sonst `technisch` — `fehlerMeldung` protokolliert den Rohtext.
 *
 *  Vorab: ein Deadlock (Postgres `40P01`) → `konflikt`, `wiederholbar`.
 *
 *  Eine Kollision an einem Unique-Index (23505) ordnet der Aufrufer selbst
 *  ein: nur er weiss, ob sie Nebenläufigkeit (`konflikt`) oder eine Regel
 *  (etwa ein doppelter Name) bedeutet. */
export function ausDbFehler(e: { message: string; code?: string }): KernFehler {
  // Ein Deadlock (40P01) bricht Postgres selbst ab und rollt zurück — nichts
  // wurde geschrieben, ein zweiter Versuch geht in aller Regel durch.
  if (e.code === "40P01") return fehlschlag("konflikt", MELDUNG_WIEDERHOLEN, { wiederholbar: true });
  const meldung = fehlerMeldung(e.message);
  const bedingung = bedingungAusFehler(e.message);
  if (bedingung)
    return fehlschlag("bedingung", meldung, {
      bedingung,
      varianteId: varianteAusFehler(e.message) ?? undefined,
    });
  if (fachlicheMeldung(e.message)) return fehlschlag("regel", meldung);
  if (istRlsVerletzung(e.message)) return fehlschlag("keine_rechte", meldung);
  return fehlschlag("technisch", meldung);
}

/** Das Problem einer Bezeichnung (`bezeichnungProblem`, Gruppe oder
 *  Variante) als Kern-Fehler: leer oder zu lang ist eine Eingabe, eine
 *  vergebene Bezeichnung eine Regel des Trainings. Geteilt von Gruppen und
 *  Varianten — dieselbe Regel, dieselbe Einordnung. */
export function bezeichnungsFehler(problem: string, feld: string): KernFehler {
  return fehlschlag(problem === MELDUNG_VERGEBEN ? "regel" : "eingabe", problem, { feld });
}

/** Ein Schreibfehler an einer Tabelle mit Namens-Unique-Index
 *  (`tg_name_je_training`, `tv_name_je_training`): 23505 ist die vergebene
 *  Bezeichnung — eine Regel, keine Nebenläufigkeit, die ein zweiter Versuch
 *  löste —, alles andere geht durch `ausDbFehler`. */
export function bezeichnungsSchreibFehler(
  e: { message: string; code?: string },
  feld = "name",
): KernFehler {
  return e.code === "23505" ? fehlschlag("regel", MELDUNG_VERGEBEN, { feld }) : ausDbFehler(e);
}
