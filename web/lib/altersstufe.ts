import {
  altersstufeSlugs,
  erscheinungsformSlugs,
  erscheinungsform_juniorenSlugs,
  hauptteilkategorieSlugs,
  trainingsteil as trainingsteilLabels,
  trainingsteilSlugs,
  junioren_blockSlugs,
  type AltersstufeSlug,
} from "@/lib/vocab";
import {
  BLOCK_ERSCHEINUNGSFORM,
  JUNIOREN_TEILE,
  abbildungKifuZuJunioren,
  abbildungJuniorenZuKifu,
} from "@/lib/junioren";

/**
 * Die Altersstufe — nach welchem Lehrmittel eine Übung und ein Training
 * geführt werden: Manual Fussball Kinder oder Manual Fussball Jugendliche
 * (Story 1, Epic Übungswelten).
 *
 * Sie ist die oberste Dimension: Alterskategorien, Einordnung,
 * Erscheinungsformen, Übungstyp, Feldtyp bzw. Spielfeldgrösse,
 * Hauptteilkategorie und die Ablaufform folgen aus ihr. Bis zu diesem Epic
 * wurden sie aus Alterskategorie und Trainingsteil erraten — diese Datei löst
 * das Raten ab und ist die EINE Quelle des Feld-Gatings für Formular, Server
 * Action und Ausgabe.
 *
 * Jede Funktion nennt den SQL-Constraint, den sie spiegelt. Die Datenbank ist
 * die Trust-Boundary, diese Datei die Sicht der Applikation auf dieselbe
 * Regel; beide MÜSSEN inhaltlich identisch bleiben.
 */

export type Altersstufe = AltersstufeSlug;

/** Beide Altersstufen in fachlicher Reihenfolge (Kinderfussball zuerst). */
export const ALTERSSTUFEN: readonly Altersstufe[] = altersstufeSlugs;

/** Ist dieser Wert eine Altersstufe? Guard für alles, was aus DB oder Formular
 *  als roher String kommt. */
export function istAltersstufe(wert: string | null | undefined): wert is Altersstufe {
  return !!wert && (altersstufeSlugs as readonly string[]).includes(wert);
}

/** Einen rohen Wert als Altersstufe lesen, mit Rückfall auf den Kinderfussball.
 *
 *  Der Rückfall ist eine fachliche Festlegung, keine Bequemlichkeit: Was keine
 *  gültige Altersstufe trägt, gilt als Kinderfussball (Story 1 AC 8) — der
 *  Manual-Bestand ist es per Definition, und die Spalten sind NOT NULL mit
 *  ebendiesem Default. In der Praxis ist das darum ein Typ-Guard gegen den
 *  rohen `string` aus Datenbank oder Formular.
 *
 *  Wo eine falsche Stufe NICHT still durchrutschen darf — beim Anlegen eines
 *  Trainings, beim Überführen einer Übung —, ist `istAltersstufe()` das
 *  richtige Werkzeug: dort wird abgewiesen statt zurückgefallen. */
export function alsAltersstufe(wert: string | null | undefined): Altersstufe {
  return istAltersstufe(wert) ? wert : "kinderfussball";
}

/** Die Alterskategorien SFV-Kinderfussball (G–E) bzw. -Juniorenfussball (D–A).
 *  Die Aufteilung ist überschneidungsfrei und deckt das ganze Vokabular ab.
 *
 *  Spiegelt die CHECKs `ex_kategorien_je_altersstufe`,
 *  `training_stufen_je_altersstufe` und `te_kategorien_je_altersstufe`. */
const KATEGORIEN: Record<Altersstufe, readonly string[]> = {
  kinderfussball: ["G", "F", "E"],
  juniorenfussball: ["D", "C", "B", "A"],
};

export function kategorienFuer(stufe: Altersstufe): readonly string[] {
  return KATEGORIEN[stufe];
}

/** Die Erscheinungsformen des jeweiligen Manuals. Die beiden Kataloge sind
 *  getrennt: was im Kinderfussball gilt, kennt das Junioren-Manual nicht und
 *  umgekehrt.
 *
 *  Spiegelt die CHECKs `erscheinungsform_je_altersstufe` und
 *  `te_erscheinungsform_je_altersstufe`. WELCHE Einordnungen überhaupt eine
 *  tragen dürfen, steht in `traegtErscheinungsform()`. */
export function erscheinungsformenFuer(stufe: Altersstufe): readonly string[] {
  return stufe === "juniorenfussball"
    ? erscheinungsform_juniorenSlugs
    : erscheinungsformSlugs;
}

/** Zu welcher Altersstufe gehört eine Einordnung? `null` für alles, was in
 *  keinem der beiden Lehrmittel vorkommt.
 *
 *  Spiegelt die CHECKs `ex_trainingsteil_je_altersstufe` und
 *  `te_trainingsteil_je_altersstufe`. */
export function altersstufeDerEinordnung(trainingsteil: string): Altersstufe | null {
  if ((trainingsteilSlugs as readonly string[]).includes(trainingsteil))
    return "kinderfussball";
  if ((junioren_blockSlugs as readonly string[]).includes(trainingsteil))
    return "juniorenfussball";
  return null;
}

// ── Einordnung ──────────────────────────────────────────────────────────────

/** Eine wählbare Einordnung: der Slug und sein Klartext. */
export type EinordnungsOption = { slug: string; label: string };

/** Ein Trainingsteil des Juniorenschemas mit seinen Blöcken. Der
 *  Kinderfussball kennt diese zweite Ebene nicht — dort ist die Liste der
 *  Blöcke leer und der Teil selbst die Einordnung. */
export type EinordnungsGruppe = {
  teil: string;
  label: string;
  bloecke: EinordnungsOption[];
};

/** Die Einordnungen, unter denen eine Übung dieser Altersstufe wählen kann.
 *
 *  Kinderfussball: die vier Trainingsteile des Manuals Fussball Kinder, flach
 *  — dort gibt es keine zweite Ebene, `bloecke` bleibt leer.
 *  Juniorenfussball: die vier Trainingsteile mit ihren insgesamt sieben Blöcken.
 *  Gewählt wird der Block; der Teil bleibt sichtbar, damit die Zugehörigkeit
 *  erkennbar ist (Story 3 AK 3). Auffangen und Abschluss tragen je genau einen
 *  Block und sind darum nicht untergliedert (Stories #127/#128).
 *
 *  Spiegelt die CHECKs `ex_trainingsteil_je_altersstufe` und
 *  `te_trainingsteil_je_altersstufe`: die Vereinigung aller hier genannten
 *  Slugs ist genau deren erlaubte Wertemenge. */
export function einordnungenFuer(stufe: Altersstufe): EinordnungsGruppe[] {
  if (stufe === "juniorenfussball")
    return JUNIOREN_TEILE.map((t) => ({
      teil: t.slug,
      label: t.label,
      bloecke: t.bloecke.map((b) => ({ slug: b.slug, label: b.label })),
    }));
  return trainingsteilSlugs.map((t) => ({
    teil: t,
    label: trainingsteilLabels[t],
    bloecke: [],
  }));
}

/** Alle wählbaren Einordnungs-Slugs einer Altersstufe, flach. Das ist die
 *  Wertemenge, gegen die die Server-Validierung prüft. */
export function einordnungsSlugsFuer(stufe: Altersstufe): string[] {
  return einordnungenFuer(stufe).flatMap((g) =>
    g.bloecke.length > 0 ? g.bloecke.map((b) => b.slug) : [g.teil],
  );
}

/** Zu welchem Trainingsteil gehört diese Einordnung? Im Kinderfussball ist sie
 *  der Teil selbst, im Juniorenfussball der Teil ihres Blocks. Ein unbekannter
 *  oder leerer Wert schlägt den ersten Teil auf — der Ausgangszustand einer
 *  noch nicht eingeordneten Übung. */
export function teilDerEinordnung(stufe: Altersstufe, einordnung: string): string {
  const gruppen = einordnungenFuer(stufe);
  const treffer = gruppen.find(
    (g) => g.teil === einordnung || g.bloecke.some((b) => b.slug === einordnung),
  );
  return (treffer ?? gruppen[0]).teil;
}

// ── Überführen in die andere Altersstufe ────────────────────────────────────

/** Die jeweils andere Altersstufe — es gibt genau zwei. */
export function andereAltersstufe(stufe: Altersstufe): Altersstufe {
  return stufe === "kinderfussball" ? "juniorenfussball" : "kinderfussball";
}

/** Wo eine Übung in der Zielstufe landen könnte, wenn sie überführt wird
 *  (Story 4 PC 3).
 *
 *  Ein VORSCHLAG, mehr nicht: der Trainer bestätigt oder wählt anders. `null`
 *  heisst «die Abbildungsregel kennt für diese Einordnung keine Entsprechung» —
 *  Explosivität etwa hat keine im Kinderfussball. Dann beginnt die Wahl leer.
 *  Das Auffangen hat seit Story #128 in beiden Richtungen eine Entsprechung.
 *
 *  Die Regel selbst steht in `lib/junioren.ts` und stammt aus dem abgenommenen
 *  Entscheidungsdokument; hier wird sie nur auf die Form gebracht, die das
 *  Übungsformular trägt (Einordnung + Hauptteilkategorie). */
export function ueberfuehrungsVorschlag(
  von: Altersstufe,
  einordnung: string,
  hauptteilkategorie: string | null,
): { einordnung: string; hauptteilkategorie: string | null } | null {
  if (von === "kinderfussball") {
    const block = abbildungKifuZuJunioren(einordnung, hauptteilkategorie);
    // Der Juniorenfussball kennt keine Hauptteilkategorie.
    return block ? { einordnung: block, hauptteilkategorie: null } : null;
  }
  const ziel = abbildungJuniorenZuKifu(einordnung);
  return ziel
    ? { einordnung: ziel.trainingsteil, hauptteilkategorie: ziel.hauptteilkategorie }
    : null;
}

// ── Feld-Gating ─────────────────────────────────────────────────────────────

/** Das freie Spiel am Ende des Kinderfussball-Hauptteils. Es folgt keiner
 *  methodischen Progression und trägt darum eine Beschreibung statt des
 *  Fahrplans.
 *
 *  Die EINE Definition dieses Slugs: Formular, Veröffentlichungs-Bedingungen
 *  und Feld-Gating lesen sie hier. Sie stand zeitweise dreifach in der
 *  Codebasis — dieselbe Zeichenkette an drei Orten, die auseinanderlaufen
 *  konnten, ohne dass es auffiel. */
export const FREIES_SPIEL = "fussball-spielen";

/** Trägt diese Einordnung Erscheinungsformen?
 *
 *  Kinderfussball: nur Einleitung und Hauptteil — Auffangen und Ausklang
 *  bleiben aussen vor. Juniorenfussball: alle Blöcke des Manuals, den Abschluss
 *  eingeschlossen. Er ist im Manual mehr als das Ausklingen des
 *  Kinderfussballs — Cool-down, Mobilität und Austausch, und der Austausch
 *  trifft «Positiv miteinander umgehen» (PO 2026-08-30).
 *
 *  Ausgenommen ist einzig `jun-auffangen`: Betreuung vor Trainingsbeginn, für
 *  die das Manual gar keine Erscheinungsform vorsieht — der Block steht
 *  ausserhalb des Manuals (Story #128). Damit gilt in beiden Altersstufen
 *  dasselbe: Das Auffangen trägt keine.
 *
 *  Spiegelt die CHECKs `erscheinungsform_je_altersstufe` und
 *  `te_erscheinungsform_je_altersstufe`. */
export function traegtErscheinungsform(stufe: Altersstufe, einordnung: string): boolean {
  if (stufe === "juniorenfussball")
    return (
      einordnung !== "jun-auffangen" &&
      (junioren_blockSlugs as readonly string[]).includes(einordnung)
    );
  return einordnung === "einleitung" || einordnung === "hauptteil";
}

/** Trägt diese Einordnung einen Übungstyp?
 *
 *  Nur im Juniorenfussball — der Kinderfussball kennt den Übungstyp gar nicht.
 *  Die Explosivität trägt ihn seit Story #133 wie die übrigen Blöcke, optional
 *  wie überall: Der Product Owner hat seinen Entscheid vom 2026-08-30, sie von
 *  der Typologie des Manuals auszunehmen, am 2026-09-01 für sie aufgehoben.
 *  Für den Abschluss gilt er unverändert weiter — dort gliedert die Typologie
 *  weiterhin nur spielnahe taktische Trainingsformen; das Auffangen steht
 *  ohnehin ganz ausserhalb des Manuals (Story #128).
 *
 *  Eine Positivliste: Ein neuer Block trägt erst einen Übungstyp, wenn er hier
 *  ausdrücklich genannt wird.
 *
 *  Spiegelt den CHECK `ex_uebungstyp_nur_junioren` (gleichnamig auf beiden
 *  Tabellen). */
export function traegtUebungstyp(stufe: Altersstufe, einordnung: string): boolean {
  return (
    stufe === "juniorenfussball" &&
    [
      "jun-aufwaermen",
      "jun-spielform-trainingsziel",
      "jun-explosivitaet",
      "jun-spielformen",
      "jun-spiel",
    ].includes(einordnung)
  );
}

/** Trägt eine Übung dieser Altersstufe einen Feldtyp?
 *
 *  Kleinfeld/Grossfeld/Freies Feld ist eine Kategorie des Manuals Fussball
 *  Kinder; das Junioren-Manual führt stattdessen eine Spielfeldgrösse in
 *  Metern.
 *
 *  Spiegelt den CHECK `ex_feldtyp_nur_kifu` (gleichnamig auf beiden Tabellen). */
export function traegtFeldtyp(stufe: Altersstufe): boolean {
  return stufe === "kinderfussball";
}

/** Trägt eine Übung dieser Altersstufe eine Spielfeldgrösse?
 *
 *  Das Gegenstück zum Feldtyp: nur im Juniorenfussball, wo das Manual sie zu
 *  praktisch jeder Trainingsform als eigene Angabe führt. Optional, aber
 *  paarweise — Länge und Breite in Metern.
 *
 *  Spiegelt die CHECKs `ex_spielfeld_nur_junioren` und
 *  `te_spielfeld_nur_junioren`. */
export function traegtSpielfeldgroesse(stufe: Altersstufe): boolean {
  return stufe === "juniorenfussball";
}

/** Trägt diese Einordnung eine Hauptteilkategorie?
 *
 *  Genau im Kinderfussball-Hauptteil, dort Pflicht. Der Juniorenfussball
 *  kennt sie nicht: er gliedert seinen Hauptteil bereits in die Blöcke
 *  «Spielformen und unterstützende Übungen» und «Spiel»; eine zweite
 *  Gliederungsebene wäre doppelt (PO 2026-08-30).
 *
 *  Spiegelt den CHECK `hauptteilkategorie_genau_bei_hauptteil` zusammen mit dem
 *  Trainingsteil-Wertebereich aus `ex_trainingsteil_je_altersstufe`: «hauptteil»
 *  ist im Juniorenfussball gar kein zulässiger Wert. */
export function traegtHauptteilkategorie(
  stufe: Altersstufe,
  einordnung: string,
): boolean {
  return stufe === "kinderfussball" && einordnung === "hauptteil";
}

/** Trägt der Ablauf hier den methodischen Fahrplan (statt eines
 *  zusammenhängenden Beschreibungstexts)?
 *
 *  Der Fahrplan «Offen starten – Üben – Wett-eifern» ist Didaktik des Manuals
 *  Fussball Kinder und bleibt ihm vorbehalten: eine Junioren-Übung trägt in
 *  jedem ihrer Blöcke einen Beschreibungstext, und zwar zwingend. Am Manual
 *  belegt — die Wörter «offen starten», «üben» und «wetteifern» kommen im
 *  Manual Fussball Jugendliche kein einziges Mal vor (PO 2026-08-30).
 *
 *  Im Kinderfussball gilt unverändert: Einleitung und Hauptteil tragen den
 *  Fahrplan, ausser das freie Spiel — es folgt keiner methodischen Progression
 *  und trägt eine Beschreibung. Die Kategorie wird nur im Hauptteil
 *  ausgewertet; ausserhalb trägt eine Übung ohnehin keine, und ein
 *  stehengebliebener Formularwert darf die Einleitung nicht um ihren Fahrplan
 *  bringen.
 *
 *  Spiegelt die CHECKs `ablauf_je_einordnung` und `te_ablauf_je_einordnung`. */
export function brauchtFahrplan(
  stufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie: string | null,
): boolean {
  if (stufe === "juniorenfussball") return false;
  if (einordnung !== "einleitung" && einordnung !== "hauptteil") return false;
  return !(einordnung === "hauptteil" && hauptteilkategorie === FREIES_SPIEL);
}

// ── Vorlagen für einen Trainingsblock ───────────────────────────────────────

/** Die Merkmale, die eine Bibliotheks-Übung tragen muss, um in einen
 *  bestimmten Block eines Trainings zu passen. */
export type VorlagenFilter = {
  /** Die Altersstufe des Trainings — die Übung muss dieselbe tragen. */
  altersstufe: Altersstufe;
  /** Die Ziel-Einordnung: ein Kinderfussball-Trainingsteil oder ein
   *  Junioren-Block. Die Übung muss dieselbe tragen. */
  trainingsteil: string;
  /** Nur im Kinderfussball-Hauptteil: die fixierte Unterkategorie. */
  hauptteilkategorie?: string;
  /** Zusätzlich zur Einordnung: Erscheinungsformen, die diesen Block ebenfalls
   *  füllen dürfen (Story #134). Leer bzw. fehlend heisst: allein die
   *  Einordnung zählt. Gefüllt wird das Feld aus `BLOCK_ERSCHEINUNGSFORM`
   *  (web/lib/junioren.ts) und nur im Juniorenfussball. */
  erscheinungsformen?: readonly string[];
};

/** Welche Bibliotheks-Übungen darf dieser Block eines Trainings aufnehmen?
 *
 *  Eine Übung passt genau dann, wenn ihre Altersstufe der des Trainings
 *  entspricht UND entweder ihre Einordnung dem Zielblock entspricht ODER sie
 *  eine Erscheinungsform trägt, die diesen Block anzieht (Story #134,
 *  `BLOCK_ERSCHEINUNGSFORM` in web/lib/junioren.ts) — im
 *  Kinderfussball-Hauptteil zusätzlich die Hauptteilkategorie. Der zweite Zweig
 *  gibt es nur im Juniorenfussball und nur für die zwei Blöcke, denen das
 *  Manual eine Athletik-Erscheinungsform zuordnet; im Kinderfussball bleibt es
 *  bei der Einordnung allein. Beide Altersstufen führen ihren eigenen Bestand;
 *  über die Stufengrenze wird nichts zugeordnet (Story 6 AK 1/2,
 *  Übungswelten).
 *
 *  Diese Funktion speist BEIDES: was der Picker anzeigt und was die Server
 *  Action beim Zuordnen akzeptiert (`pickExercises` und `addTrainingExercise`).
 *  Beide MÜSSEN dieselbe Antwort geben, sonst zeigte der Picker Treffer, die
 *  das Hinzufügen abweist. Wer die Antwort auf eine konkrete Vorlage braucht,
 *  nimmt `vorlagePasst()` gleich unten — die Anzeige stellt denselben Filter
 *  als Abfrage, die Annahme prüft ihn Zeile für Zeile.
 *
 *  `null` heisst: kein gültiges Zuordnungsziel für diese Altersstufe — der
 *  Block gehört dem anderen Lehrmittel an, oder die im Hauptteil zwingende
 *  Kategorie fehlt.
 *
 *  Spiegelt die CHECKs `te_trainingsteil_je_altersstufe`,
 *  `te_kategorien_je_altersstufe` und `hauptteilkategorie_genau_bei_hauptteil`
 *  zusammen mit dem Trigger `te_altersstufe_erben`, der einer Fassung die
 *  Altersstufe ihres Trainings gibt. */
export function vorlagenFilterFuer(
  stufe: Altersstufe,
  einordnung: string,
  hauptteilkategorie?: string | null,
): VorlagenFilter | null {
  if (!einordnungsSlugsFuer(stufe).includes(einordnung)) return null;
  // Die anziehende Erscheinungsform gibt es nur im Juniorenfussball und nur
  // dort, wo die Zuordnung einen Eintrag führt. Im Kinderfussball bleibt der
  // angebotene Bestand allein an die Einordnung gebunden (Story #134 Out of
  // Scope 5) — `BLOCK_ERSCHEINUNGSFORM` kennt ohnehin nur Junioren-Blöcke, die
  // Stufenprüfung hier macht das ausdrücklich.
  const anziehend =
    stufe === "juniorenfussball"
      ? BLOCK_ERSCHEINUNGSFORM[einordnung as keyof typeof BLOCK_ERSCHEINUNGSFORM]
      : undefined;
  const erscheinungsformen = anziehend ? [anziehend] : undefined;
  if (!traegtHauptteilkategorie(stufe, einordnung))
    return { altersstufe: stufe, trainingsteil: einordnung, erscheinungsformen };
  if (
    !hauptteilkategorie ||
    !(hauptteilkategorieSlugs as readonly string[]).includes(hauptteilkategorie)
  )
    return null;
  return { altersstufe: stufe, trainingsteil: einordnung, hauptteilkategorie };
}

/** Passt diese konkrete Vorlage in den Block, den der Filter beschreibt?
 *
 *  Das Gegenstück zur Abfrage, die `pickExercises` aus demselben Filter baut:
 *  Dort wird die Bedingung an die Datenbank gestellt, hier an eine bereits
 *  gelesene Zeile. Beide lesen dieselben Felder desselben Filters, damit der
 *  Picker nichts vorschlagen kann, was `addTrainingExercise` danach abweist
 *  (Story #134 NFR 1/3).
 *
 *  Die Altersstufe ist NICHT Teil dieser Antwort. Sie ist die oberste
 *  Dimension und braucht beim Zuordnen eine eigene Meldung — «passt nicht zu
 *  diesem Block» schickte den Trainer sonst einen Block suchen, den es für
 *  diese Übung gar nicht gibt. Der Aufrufer prüft sie darum davor.
 *
 *  Auf der Datenebene prüft dies KEIN Constraint: Seit dem Fassungsmodell gibt
 *  es keinen `plan_exercise_phase_guard` mehr, der eine Fassung inhaltlich
 *  gegen ihren Block hielte. Die Regel lebt allein in der Server Action, und
 *  das bleibt so — sie ist eine Vorschlags- und Annahmeregel für neue
 *  Zuordnungen, keine Invariante über dem Bestand (Story #134 NFR 4). */
export function vorlagePasst(
  filter: VorlagenFilter,
  vorlage: { trainingsteil: string; hauptteilkategorie: string | null; erscheinungsform?: string[] | null },
): boolean {
  // Zweig 1: die Einordnung. Im Kinderfussball-Hauptteil muss zusätzlich die
  // Unterkategorie stimmen — sie grenzt die Einordnung ein, sie ersetzt sie nicht.
  const ueberEinordnung =
    vorlage.trainingsteil === filter.trainingsteil &&
    (!filter.hauptteilkategorie ||
      vorlage.hauptteilkategorie === filter.hauptteilkategorie);
  if (ueberEinordnung) return true;
  // Zweig 2: die anziehende Erscheinungsform. Sie steht bewusst OHNE
  // Bedingung an die Einordnung der Vorlage da (PO-Entscheid 2026-09-01):
  // Kreuztreffer zwischen den beiden Zuordnungen sind gewollt.
  const formen = vorlage.erscheinungsform ?? [];
  return (filter.erscheinungsformen ?? []).some((f) => formen.includes(f));
}
