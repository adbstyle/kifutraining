"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Dialog, Snackbar, Button, TextField } from "@/components/ui";
import { ExercisePickerDialog } from "../ExercisePickerDialog";
import { GesamtAbgleich } from "../ZeitAbgleich";
import { TrainingKopf } from "./TrainingKopf";
import { TeilKarte } from "./TeilKarte";
import { VariantenLeiste } from "./VariantenLeiste";
import { VarianteAnlegenDialog } from "./VarianteAnlegenDialog";
import { BezeichnungDialog } from "./BezeichnungDialog";
import { GruppenLeiste } from "./GruppenLeiste";
import { DurchlaufZeile } from "./DurchlaufZeile";
import { UebungsEtage } from "./UebungsEtage";
import { KonfliktListe } from "./KonfliktListe";
import { useGruppenModell } from "./useGruppenModell";
import { useVariantenModell } from "./useVariantenModell";
import { GRUPPE_NAME_MAX, istHauptteil, nameProblem, zeitKurz } from "@/lib/gruppen";
import type { ZeilenKontext } from "./ExerciseList";
import { GESAMTDAUER_JUNIOREN, type Einordnung } from "@/lib/junioren";
import {
  junioren_block as juniorenBlockLabels,
  type JuniorenBlockSlug,
} from "@/lib/vocab";
import {
  bedingungsMeldungFuer,
  fehlendeBedingungenAus,
} from "@/lib/training-bedingungen";
import { zaehle } from "@/lib/labels";
import {
  VARIANTE_NAME_MAX,
  VARIANTE_PARAM,
  aufloesungSatz,
  fassungenVon,
  sichtbareZuordnungen,
  varianteAus,
  varianteNameProblem,
  wegfallSatz,
  type Variante,
} from "@/lib/varianten";
import {
  TRAININGSTEILE,
  HAUPTTEILKATEGORIEN,
  editorGliederung,
  teilTraegtDauer,
  formatDuration,
} from "@/lib/training";
import {
  setExerciseDuration,
  setzeNotiz,
  moveTrainingExercise,
  removeTrainingExercise,
  renameTraining,
  setTrainingStufen,
  setTrainingZiel,
  deleteTraining,
} from "@/lib/actions/trainings";
import type { HauptteilkategorieSlug } from "@/lib/vocab";
import type { TrainingActionResult } from "@/lib/actions/trainings";
import type { TrainingDetail, TrainingExerciseItem } from "@/lib/queries/trainings";
import type { TeamUebersicht } from "@/lib/queries/teams";

/* Trainings-Editor (Stories #10/#11/#12). Eine Karte je Trainingsteil mit
   Übungs-Picker, Dauer-Erfassung, Umsortieren (Hoch/Runter) und Entfernen.
   Kopf: Name bearbeiten, Ziel, Stufen setzen, Training löschen. Was in welcher
   Karte und in welchem Block steht, beantwortet `editorGliederung` für beide
   Altersstufen; hier bleiben Zustand, Dialoge und die Aktionen.
   Struktur-Änderungen frischen die Serverdaten auf; Dauern und die
   Gruppenverteilung werden lokal überlagert (`useGruppenModell`), die
   Varianten ebenso (`useVariantenModell`) — dort allerdings mit Auffrischen
   hinterher, weil ihre Reihenfolge und ihre Bezeichnungen ausserhalb der
   Leiste weiterwirken. */
export function TrainingEditor({
  training,
  /** Die Teams des USERS — Ziele für „Ins Team stellen" (Team-Epic Story 5). */
  teams = [],
  /** Die Variante des Hauptteils aus der Adresse (#201 AK 6/7). Sie ist der
   *  Startwert, nicht die laufende Quelle: Gewechselt wird ohne Navigation. */
  varianteParam,
}: {
  training: TrainingDetail;
  teams?: TeamUebersicht[];
  varianteParam?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Offener Picker: die Ziel-Einordnung (Kinderfussball-Teil oder
  // Junioren-Block) und — im Kinderfussball-Hauptteil — die Unterkategorie.
  const [open, setOpen] = useState<{
    teil: Einordnung;
    hkat?: HauptteilkategorieSlug;
  } | null>(null);
  const [durations, setDurations] = useState<Record<string, number | null>>({});
  // Die lokal erfassten Notizen (Story #152) — wie die Dauern eine Überlagerung
  // der Serverdaten: Eine Notiz ändert die Gliederung nicht, und ein
  // `router.refresh()` nach jedem Speichern risse den Fokus aus der Zeile.
  const [notizen, setNotizen] = useState<Record<string, string | null>>({});
  const [stufen, setStufen] = useState<string[]>(training.stufen);
  const [ziel, setZiel] = useState<string>(training.ziel ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [nameInput, setNameInput] = useState(training.name);
  const [nameError, setNameError] = useState<string | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Die abweichenden Übungen aus dem Stufen-Abgleich — mit ihrer Variante, denn
  // der Abgleich umfasst alle (#201 AK 11).
  const [mismatch, setMismatch] = useState<
    { id: string; name: string; varianteId: string | null }[] | null
  >(null);
  // Der Bezeichnungs-Dialog der Gruppen (#209 AK 2/6) — anlegen und umbenennen
  // sind derselbe Dialog mit anderem Wortlaut, darum EIN Zustand.
  const [gruppeDialog, setGruppeDialog] = useState<
    { modus: "neu" } | { modus: "bearbeiten"; gruppe: { id: string; name: string } } | null
  >(null);
  // Die beiden Rückfragen der Gruppenverteilung (Story #150 AK 8/16). Sie
  // stehen hier und nicht im Modell: Was zu bestätigen ist, ist eine Frage der
  // Oberfläche — das Modell führt aus.
  const [gruppeWeg, setGruppeWeg] = useState<{ id: string; name: string } | null>(null);
  const [uebungWeg, setUebungWeg] = useState<TrainingExerciseItem | null>(null);
  // Die angezeigte Variante des Hauptteils (#201 AK 6). Beim Öffnen gilt die
  // aus der Adresse, sonst die erste (AK 7) — gemerkt wird nichts.
  const [aktiveVariante, setAktiveVariante] = useState<string | undefined>(
    () => varianteAus(varianteParam, training.varianten)?.id,
  );
  const [varianteDialog, setVarianteDialog] = useState(false);
  // Die Variante, deren Bezeichnung bearbeitet wird, und die, deren Entfernen
  // noch zu bestätigen ist (#209 AK 6/7).
  const [varianteBearbeiten, setVarianteBearbeiten] = useState<Variante | null>(null);
  const [varianteWeg, setVarianteWeg] = useState<Variante | null>(null);

  // Die Varianten samt ihrer Reihenfolge und ihren Bezeichnungen als ein Stück
  // (#209). Alles, was Varianten betrifft, rechnet ab hier mit DIESER Liste und
  // nicht mit `training.varianten`: Umsortieren und Umbenennen wirken sofort,
  // der Serverstand kommt nach.
  const variantenModell = useVariantenModell({
    varianten: training.varianten,
    melde: setNotice,
  });
  const varianten = variantenModell.varianten;

  // Die Variante, die wirklich gilt: Nach einem `router.refresh()` kann die
  // gewählte weg sein (in einem anderen Fenster entfernt) — dann fällt die
  // Anzeige auf die erste zurück, statt einen leeren Hauptteil zu zeigen.
  const aktive: Variante | undefined =
    varianten.find((v) => v.id === aktiveVariante) ?? varianten[0];
  // Gibt es überhaupt etwas zu wählen? Entscheidet über die Chips der Leiste,
  // über den Zusatz an den Meldungen und darüber, ob die Adresse eine Variante
  // trägt (#201 PC 5).
  const mehrereVarianten = varianten.length > 1;

  // Nach welchem Lehrmittel das Training gegliedert ist. Es folgt aus der
  // geführten Altersstufe, die ab dem Anlegen feststeht — nicht mehr aus den
  // Alterskategorien (Story 5 PC 2). Ein Junioren-Training ohne Alterskategorie
  // ist damit möglich und fällt trotzdem nie aufs Kinderfussball-Schema zurück.
  const junioren = training.altersstufe === "juniorenfussball";

  // Die lokal erfassten Dauern einmal über die Serverdaten legen — danach
  // rechnen Gliederung, Zeilen und die Konflikt-Rechnung mit demselben Stand,
  // und jede Summe geht sofort mit statt erst nach der Server-Antwort.
  // Memoisiert, weil das Gruppen-Modell seine Ableitungen daran hängt.
  const zuordnungen = useMemo(
    () =>
      training.exercises.map((e) => ({
        ...e,
        durationMin: e.id in durations ? durations[e.id] : e.durationMin,
        notiz: e.id in notizen ? notizen[e.id] : e.notiz,
      })),
    [training.exercises, durations, notizen],
  );

  // Was in der angezeigten Variante steht: ihre Hauptteil-Fassungen plus alles
  // ausserhalb des Hauptteils — das gilt für alle Varianten gemeinsam
  // (#201 PC 3). Daran hängen Gliederung, Summen und die Live-Vorschau der
  // Veröffentlichungs-Bedingungen; die Überlagerung der Dauern und Notizen
  // bleibt für ALLE Fassungen bestehen, damit ein Wechsel und zurück keine
  // ungespeicherte Eingabe verliert.
  const sichtbar = useMemo(
    () => sichtbareZuordnungen(zuordnungen, aktive?.id),
    [zuordnungen, aktive?.id],
  );

  // Gruppen, Verteilung und Konflikte als ein Stück (Stories #149/#150).
  // Gerechnet wird über die angezeigte Variante (#201 AK 9), gefragt und
  // aufgeräumt über alle (AK 10).
  const modell = useGruppenModell({
    trainingId: training.id,
    gruppenInitial: training.gruppen,
    zuordnungen: sichtbar,
    alleZuordnungen: zuordnungen,
    melde: setNotice,
  });

  /** Die Adresse an die angezeigte Variante angleichen — ohne Navigation.
   *
   *  `history.replaceState` statt `router.push`/`refresh`: Der Wechsel ist eine
   *  Frage der Anzeige, nicht der Daten — alle Varianten stehen bereits im
   *  Speicher. Ein Aufruf zum Server risse den lokalen Stand (Dauern, Notizen,
   *  Gruppenfolgen) mit sich und liesse die Karte flackern. Die Adresse zieht
   *  trotzdem mit, damit Neuladen, Lesezeichen und der Rückweg aus der
   *  Fassungs-Bearbeitung in derselben Variante landen.
   *
   *  Bei genau einer Variante fällt der Parameter weg: Ein Training ohne zweite
   *  Variante soll auch in der Adresszeile unverändert aussehen (PC 5). */
  function adresseFuer(varianteId: string | undefined, anzahl: number): URL {
    const url = new URL(window.location.href);
    if (anzahl > 1 && varianteId) url.searchParams.set(VARIANTE_PARAM, varianteId);
    else url.searchParams.delete(VARIANTE_PARAM);
    return url;
  }

  function schreibeAdresse(varianteId: string | undefined, anzahl: number) {
    window.history.replaceState(null, "", adresseFuer(varianteId, anzahl));
  }

  /** Adresse UND Serverstand in einem Zug — für Struktur-Änderungen an den
   *  Varianten (angelegt, entfernt), die den Serverstand ohnehin brauchen.
   *
   *  Bewusst `router.replace` statt `replaceState` + `router.refresh()`: Die
   *  Kombination lief im Produktions-Build ins Leere — der Refresh holte den
   *  neuen Stand vom Server, angezeigt wurde er aber erst nach einem Neuladen
   *  (gemessen 2026-09-11 auf Staging). Ein Wechsel der Adresse über den
   *  Router lädt die Seite für genau diese Adresse frisch und zeigt, was er
   *  geladen hat. */
  function navigiereZu(varianteId: string | undefined, anzahl: number) {
    const url = adresseFuer(varianteId, anzahl);
    startTransition(() => {
      router.replace(`${url.pathname}${url.search}`, { scroll: false });
    });
  }

  function wechsleVariante(varianteId: string) {
    setAktiveVariante(varianteId);
    schreibeAdresse(varianteId, varianten.length);
  }

  /** Eine Variante wurde angelegt (#201 AK 1, PC 1): Sie wird zur angezeigten —
   *  der Trainer will sie jetzt umbauen, dafür ist sie da. Aufgefrischt wird
   *  danach, weil die Kopie der Fassungen nur vom Server kommen kann. */
  function varianteAngelegt(varianteId: string, name: string) {
    setVarianteDialog(false);
    setAktiveVariante(varianteId);
    // Ab jetzt sind es mindestens zwei — die Adresse trägt die Variante.
    navigiereZu(varianteId, varianten.length + 1);
    setNotice(`Variante „${name}" angelegt.`);
  }

  /** Eine Variante entfernen — mit Rückfrage, sobald etwas daran hängt (#202
   *  AK 5) ODER die verbleibende aufgelöst wird (#209 AK 7). Der zweite Fall
   *  gilt auch bei einer LEEREN Variante: Mit ihr fällt zwar nichts weg, aber
   *  der Hauptteil verliert seine Aufteilung, und das soll niemand hinterher
   *  entdecken. Sonst bleibt es beim Entfernen ohne Rückfrage — eine leere
   *  Variante ist bloss eine Bezeichnung. */
  function varianteEntfernen(variante: Variante) {
    if (fassungenVon(fassungenLokal, variante.id).length > 0 || varianten.length === 2) {
      setVarianteWeg(variante);
      return;
    }
    void entferneVarianteJetzt(variante);
  }

  /** Die Variante ist weg (#202 AK 4, PC 1/2).
   *
   *  War es die angezeigte, rückt die erste verbleibende nach — dieselbe Regel
   *  wie beim Öffnen (#201 AK 7). Die Adresse zieht mit und verliert ihre
   *  Angabe, sobald nur noch eine Variante übrig ist: Ein Training ohne zweite
   *  soll auch in der Adresszeile unverändert aussehen (PC 4 / #201 PC 5). */
  async function entferneVarianteJetzt(variante: Variante) {
    setVarianteWeg(null);
    const rest = varianten.filter((v) => v.id !== variante.id);
    if (!(await variantenModell.entferne(variante))) return;
    const naechste = variante.id === aktive?.id ? rest[0]?.id : aktiveVariante;
    setAktiveVariante(naechste);
    navigiereZu(naechste, rest.length);
    // Bleibt eine einzige übrig, ist mehr geschehen als ein Entfernen: Der
    // Hauptteil trägt wieder keine Bezeichnung (Auflösung, #209 AK 7). Die
    // Quittung sagt es, weil die Leiste danach bloss stiller dasteht.
    setNotice(
      rest.length === 1
        ? `Variante „${variante.name}" entfernt. Der Hauptteil steht wieder als einer da.`
        : `Variante „${variante.name}" entfernt.`,
    );
  }

  /** Die Dauer einer Zuordnung setzen oder leeren (Story #11, #151 AK 6).
   *  Optimistisch mit Rücknahme: Wird die Änderung abgelehnt — am Auffangen,
   *  an einer inzwischen entfernten Zuordnung —, stünde sonst eine Dauer im
   *  Editor, die nie gespeichert wurde, und die Summen rechneten mit ihr. */
  function changeDuration(item: TrainingExerciseItem, next: number | null) {
    const vorher = item.durationMin;
    setDurations((prev) => ({ ...prev, [item.id]: next }));
    startTransition(async () => {
      const r = await setExerciseDuration(item.id, next);
      if (r.ok) return;
      setDurations((prev) => ({ ...prev, [item.id]: vorher }));
      setNotice(r.error ?? "Speichern fehlgeschlagen.");
    });
  }

  /** Die Notiz einer Zuordnung setzen, ändern oder entfernen (Story #152
   *  AK 1/2). Optimistisch mit Rücknahme, wie die Dauer: Wird das Speichern
   *  abgelehnt, stünde sonst ein Text im Editor, den kein Training trägt — und
   *  auf dem Platz stünde er dann nicht. */
  function changeNotiz(item: TrainingExerciseItem, text: string) {
    const vorher = item.notiz;
    setNotizen((prev) => ({ ...prev, [item.id]: text.trim() === "" ? null : text.trim() }));
    startTransition(async () => {
      const r = await setzeNotiz(item.id, text);
      if (r.ok) return;
      setNotizen((prev) => ({ ...prev, [item.id]: vorher }));
      setNotice(r.error ?? "Speichern fehlgeschlagen.");
    });
  }

  function move(item: TrainingExerciseItem, dir: -1 | 1) {
    modell.vergissFolge(item.id);
    startTransition(async () => {
      await moveTrainingExercise(item.id, dir);
      router.refresh();
    });
  }

  /** Die Meldung zu einer abgewiesenen Änderung.
   *
   *  Verweigert die Datenebene, weil ein öffentliches Training eine Bedingung
   *  verlöre, sagt ihre allgemeine Übersetzung bloss «in jeder Variante» — die
   *  Server-Action kennt die Bezeichnungen nicht. Hier sind sie da: Die Meldung
   *  nennt Variante UND Block (#204 AK 3). Bei genau einer Variante bleibt es
   *  beim Satz ohne Bezeichnung (Epic EK 7) — die Datenebene nennt dann schon
   *  keine. */
  function abweisung(r: TrainingActionResult, rueckfall: string): string {
    if (r.bedingung && r.varianteId && mehrereVarianten) {
      const name = varianten.find((v) => v.id === r.varianteId)?.name;
      if (name) return bedingungsMeldungFuer(r.bedingung, name);
    }
    return r.error ?? rueckfall;
  }

  /** Übung entfernen — mit Rückfrage, solange sie Gruppen trägt (AK 16). Die
   *  Tragweite ist dieselbe wie beim Entfernen einer Gruppe: Mit der Übung
   *  fallen ihre Zuweisungen weg, und die stehen nirgends sonst. Ohne
   *  Zuweisungen bleibt es beim Entfernen ohne Rückfrage. */
  function remove(item: TrainingExerciseItem) {
    if (modell.gruppenAn(item.id) > 0) {
      setUebungWeg(item);
      return;
    }
    entferneUebung(item);
  }

  function entferneUebung(item: TrainingExerciseItem) {
    setUebungWeg(null);
    modell.vergissFolge(item.id);
    startTransition(async () => {
      const r = await removeTrainingExercise(item.id);
      router.refresh();
      // Am öffentlichen Training kann das Entfernen abgelehnt werden — es wäre
      // die letzte Übung, die es dort braucht. Ohne Meldung sähe der Trainer
      // die Übung einfach stehenbleiben (Story A AK 7).
      if (!r.ok) setNotice(abweisung(r, "Entfernen fehlgeschlagen."));
    });
  }

  /** Alterskategorien setzen (Story #12 AC2). Die Altersstufe ist davon
   *  unberührt: Sie steht ab dem Anlegen fest, und die angebotenen Kategorien
   *  gehören ohnehin nur zu ihr (Story 5 AK 4/5). Eine stufenfremde Kategorie —
   *  etwa aus einem manipulierten Aufruf — weist die Server-Action ab und nennt
   *  den gangbaren Weg; die Meldung erscheint hier. */
  function changeStufen(next: string[]) {
    const vorher = stufen;
    setStufen(next);
    startTransition(async () => {
      const r = await setTrainingStufen(training.id, next);
      router.refresh();
      if (!r.ok) {
        // Auswahl zurücknehmen: sonst zeigte der Editor Stufen an, die nie
        // gespeichert wurden.
        setStufen(vorher);
        setNotice(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      if (r.mismatched && r.mismatched.length > 0) setMismatch(r.mismatched);
    });
  }

  function speichereZiel() {
    if (ziel.trim() === (training.ziel ?? "")) return;
    startTransition(async () => {
      const r = await setTrainingZiel(training.id, ziel);
      if (!r.ok) {
        setZiel(training.ziel ?? "");
        setNotice(r.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.refresh();
    });
  }

  function saveName() {
    startTransition(async () => {
      const r = await renameTraining(training.id, nameInput);
      if (r.ok) {
        setRenameOpen(false);
        router.refresh();
      } else {
        setNameError(r.error);
      }
    });
  }

  function removeMismatched(ids: string[]) {
    startTransition(async () => {
      let fehler: string | null = null;
      for (const id of ids) modell.vergissFolge(id);
      for (const id of ids) {
        const r = await removeTrainingExercise(id);
        if (!r.ok && !fehler) fehler = abweisung(r, "Entfernen fehlgeschlagen.");
      }
      setMismatch(null);
      router.refresh();
      if (fehler) setNotice(fehler);
    });
  }

  /** Eine Gruppe entfernen — mit Rückfrage, solange sie Übungen zugewiesen ist
   *  (AK 8). Ohne Zuweisungen fällt bloss eine Bezeichnung weg; das quittiert
   *  die Snackbar, mehr braucht es nicht. */
  function gruppeEntfernen(gruppe: { id: string; name: string }) {
    if (modell.zuweisungenVon(gruppe.id) > 0) {
      setGruppeWeg(gruppe);
      return;
    }
    void entferneGruppeJetzt(gruppe);
  }

  /** Die Gruppe ist weg (#149 AK 3).
   *
   *  Das Schliessen der Rückfrage und der Wegfall müssen in ZWEI Schritte
   *  fallen, darum das Warten auf den nächsten Tick: Der native `<dialog>` gibt
   *  den Fokus beim Schliessen dorthin zurück, wo er herkam — an die
   *  Menü-Hälfte des Chips. Geschähe beides im selben Commit, wäre dieser Chip
   *  in dem Moment schon entfernt, der Fokus fiele auf `<body>`, und die
   *  Nachführung der Gruppenleiste käme zu früh. So schliesst erst der Dialog,
   *  und der `wegZiel`-Effekt der Leiste setzt den Fokus danach auf den
   *  Nachrücker. Beim Entfernen einer Variante ergibt sich dieselbe Reihenfolge
   *  von selbst, weil dort auf die Antwort des Servers gewartet wird. */
  async function entferneGruppeJetzt(gruppe: { id: string; name: string }) {
    setGruppeWeg(null);
    await Promise.resolve();
    modell.entferne(gruppe);
  }

  // Was zum Veröffentlichen fehlt: so erscheint die Tragweite-Bestätigung nur
  // für ein veröffentlichbares Training. Die Action prüft es serverseitig
  // erneut. Eine Übung im Hauptteil braucht es nicht eigens zu prüfen — das
  // freie Spiel liegt dort und deckt es zwingend ab.
  const oeffentlich = training.visibility === "public";

  // Anlegen oder umbenennen? Der Gruppen-Dialog unterscheidet sich in sechs
  // Angaben, und jede fragte sonst dieselbe Bedingung erneut.
  const bearbeitet = gruppeDialog?.modus === "bearbeiten";

  // Live-Vorschau der Veröffentlichungs-Bedingungen aus dem lokalen Stand.
  // Dieselbe Funktion, die die Server Action nutzt — und dieselbe Regel, die
  // die Datenbank als Trust-Boundary durchsetzt (Story 7 AC 3).
  // Über ALLE Fassungen und alle Varianten, nicht über die angezeigte: Die
  // Hauptteil-Bedingung gilt je Variante (#204 AK 1), und der Trainer soll
  // beim Veröffentlichen sehen, welche Variante welchen Block nicht belegt hat
  // (AK 2) — auch die, die er gerade nicht vor sich hat.
  const fehlendeBedingungen = fehlendeBedingungenAus(
    training.altersstufe,
    stufen,
    zuordnungen,
    varianten,
  );

  // Die Fassungen aus dem LOKALEN Stand — Grundlage der Rückfrage vor dem
  // Entfernen einer Variante (#202 AK 6). Notiz und Gruppenfolge werden im
  // Editor überlagert und erst beim nächsten Auffrischen vom Server bestätigt;
  // zählte die Rückfrage die Serverdaten, fehlte die eben erfasste Notiz in
  // ihrer Aufstellung — und der Trainer verlöre sie ungewarnt.
  const fassungenLokal = zuordnungen.map((e) => ({
    varianteId: e.varianteId,
    notiz: e.notiz,
    gruppen: modell.folgeVon(e),
  }));

  const teile = editorGliederung(training.altersstufe, sichtbar);

  // Auffangen trägt keine Dauer und zählt weder zur Summe noch zum
  // „ohne Dauer"-Hinweis.
  const dauerItems = sichtbar.filter((e) => teilTraegtDauer(e.trainingsteil));
  const totalDuration = dauerItems.reduce<number>((a, it) => a + (it.durationMin ?? 0), 0);
  const totalMissing = dauerItems.filter((it) => it.durationMin == null).length;

  // Der Gruppen-Bereich der Hauptteil-Karte (#209 AK 1/3): die Leiste unter dem
  // Kartenkopf, die Konflikte im Kartenfuss. Die Leiste steht IMMER — ohne
  // Gruppe zeigt sie das Zeichen und den Knopf.
  const gruppenBereich = {
    leiste: (
      <GruppenLeiste
        gruppen={modell.gruppen}
        zeit={(id) => modell.zeiten.get(id)}
        // Die Summe gilt für die angezeigte Variante — bei mehreren sagt der
        // a11y-Name das auch, sonst läse man sie als Zeit des ganzen Trainings
        // (#201 AK 9).
        zeitZusatz={mehrereVarianten ? "in dieser Variante" : undefined}
        warnung={(id) => modell.befund.gruppenWarnung.get(id)}
        onHinzufuegen={() => setGruppeDialog({ modus: "neu" })}
        onBearbeiten={(gruppe) => setGruppeDialog({ modus: "bearbeiten", gruppe })}
        onVerschieben={modell.verschiebe}
        onEntfernen={gruppeEntfernen}
      />
    ),
    fuss: <KonfliktListe konflikte={modell.befund.konflikte} />,
  };

  const kontext: ZeilenKontext = {
    trainingId: training.id,
    // Nur bei mehreren Varianten: Sonst trüge jede Adresse eine Angabe, zu der
    // es keine Wahl gibt (PC 5).
    varianteId: mehrereVarianten ? aktive?.id : undefined,
    trainingStufen: stufen,
    // Die Etage steht an jeder Zeile — die Notiz gilt an jeder Übung jedes
    // Trainings (Story #152 AK 1). Der Durchlauf darin erscheint erst, wenn der
    // Block Gruppen trägt UND das Training welche führt: Ohne sie gäbe es
    // nichts zu verteilen, und «Alle gemeinsam» an jeder Zeile wäre eine
    // Antwort auf eine Frage, die niemand gestellt hat.
    etage: (item, traegtGruppen) => (
      <UebungsEtage
        uebungName={item.name}
        notiz={item.notiz}
        onNotiz={(text) => changeNotiz(item, text)}
        durchlauf={
          traegtGruppen && modell.gruppen.length > 0 ? (
            <DurchlaufZeile
              uebungName={item.name}
              folge={modell.folgeVon(item)}
              gruppen={modell.gruppen}
              wechselGesamt={modell.wechselGesamt}
              warnung={(gruppeId) =>
                modell.befund.chipWarnung.has(`${item.id}|${gruppeId}`)
                  ? modell.befund.gruppenWarnung.get(gruppeId)
                  : undefined
              }
              zeit={(gruppeId) => zeitKurz(modell.zeiten.get(gruppeId))}
              onFolge={(next) => modell.setzeFolge(item.id, next)}
            />
          ) : null
        }
      />
    ),
    dauerWarnung: (item) => modell.befund.dauerWarnung.has(item.id),
    onDuration: changeDuration,
    onMove: move,
    onRemove: remove,
  };

  return (
    <div className="flex flex-col gap-4">
      <TrainingKopf
        training={training}
        teams={teams}
        oeffentlich={oeffentlich}
        fehlendeBedingungen={fehlendeBedingungen}
        stufen={stufen}
        onStufen={changeStufen}
        ziel={ziel}
        onZielChange={setZiel}
        onZielSpeichern={speichereZiel}
        onUmbenennen={() => {
          setNameInput(training.name);
          setNameError(undefined);
          setRenameOpen(true);
        }}
        onLoeschen={() => setDeleteOpen(true)}
      />

      {/* Summenleiste */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border-[1.5px] border-outline bg-surface-container px-4 py-3">
        <span className="inline-flex items-center gap-2 type-title-medium text-on-surface">
          <Clock size={18} strokeWidth={2} aria-hidden />
          Gesamtdauer: {formatDuration(totalDuration)}
        </span>
        {/* Die Zeit-Orientierung gilt nur im Juniorenschema — das
            Kinderfussball-Manual gibt bewusst keine Zeiten vor (Story 6
            AC 5 / Out of Scope 1). */}
        {junioren && <GesamtAbgleich sum={totalDuration} soll={GESAMTDAUER_JUNIOREN} />}
        {totalMissing > 0 && (
          <span className="type-label-medium text-on-surface-variant">
            {totalMissing} {totalMissing === 1 ? "Übung ohne" : "Übungen ohne"} Dauer
          </span>
        )}
      </div>

      {teile.map((teil) => (
        <TeilKarte
          key={teil.key}
          teil={teil}
          kontext={kontext}
          onAdd={(block) => setOpen({ teil: block.einordnung, hkat: block.hkat })}
          // Varianten gibt es nur für den Hauptteil (#201 PC 4) — derselbe
          // Schlüssel in beiden Altersstufen wie bei den Gruppen.
          varianten={
            teil.key === "hauptteil" ? (
              <VariantenLeiste
                varianten={varianten}
                aktiv={aktive?.id}
                onWechsel={wechsleVariante}
                onHinzufuegen={() => setVarianteDialog(true)}
                onBearbeiten={setVarianteBearbeiten}
                onVerschieben={variantenModell.verschiebe}
                onEntfernen={varianteEntfernen}
              />
            ) : undefined
          }
          // Verteilt wird allein der Hauptteil — in beiden Altersstufen trägt er
          // denselben Schlüssel (Story #149 AK 9 / Epic Out of Scope 2).
          gruppen={teil.key === "hauptteil" ? gruppenBereich : undefined}
        />
      ))}

      {/* Ein Picker, gesteuert über `open` (Trainingsteil + ggf. Unterkategorie). */}
      {open &&
        (() => {
          const teilLabel =
            TRAININGSTEILE.find((t) => t.slug === open.teil)?.label ??
            juniorenBlockLabels[open.teil as JuniorenBlockSlug] ??
            open.teil;
          const sub = open.hkat
            ? HAUPTTEILKATEGORIEN.find((h) => h.slug === open.hkat)
            : undefined;
          return (
            <ExercisePickerDialog
              open
              onClose={() => setOpen(null)}
              trainingId={training.id}
              altersstufe={training.altersstufe}
              trainingsteil={open.teil}
              trainingsteilLabel={teilLabel}
              hauptteilkategorie={sub?.slug}
              hauptteilkategorieLabel={sub?.label}
              trainingStufen={stufen}
              // Im Hauptteil kommt die Übung in die angezeigte Variante
              // (#201 AK 8). Ausserhalb gibt es keine — dort gilt sie für alle.
              varianteId={istHauptteil(open.teil) ? aktive?.id : undefined}
              onAdded={() => {
                // Nur auffrischen: Die neue Übung bringt keine Zuweisungen mit
                // und lässt die der anderen Zeilen unberührt. Die lokalen
                // Folgen hängen an der Fassungs-ID, nicht an der Position —
                // sie pauschal zu vergessen, nähme jeder Zeile ihren
                // ungespeicherten Stand ohne Grund.
                router.refresh();
              }}
            />
          );
        })()}

      {/* Namen bearbeiten */}
      <Dialog
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Name bearbeiten"
        actions={
          <>
            <Button variant="text" onClick={() => setRenameOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="filled" onClick={saveName}>
              Speichern
            </Button>
          </>
        }
      >
        <TextField
          label="Name des Trainings"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          error={!!nameError}
          supportingText={nameError}
          autoFocus
        />
      </Dialog>

      {/* Stufen-Abweichungs-Hinweis */}
      <Dialog
        open={mismatch != null}
        onClose={() => setMismatch(null)}
        title="Übungen ausserhalb der Stufen"
        actions={
          <>
            <Button variant="text" onClick={() => setMismatch(null)}>
              Behalten
            </Button>
            <Button
              variant="danger"
              onClick={() => removeMismatched((mismatch ?? []).map((m) => m.id))}
            >
              Übungen entfernen
            </Button>
          </>
        }
      >
        <p className="mb-3">
          Diese zugeordneten Übungen decken keine der gewählten Stufen ab. Du
          kannst sie im Training behalten oder entfernen.
        </p>
        {/* Der Abgleich umfasst alle Varianten (#201 AK 11) — sonst bliebe eine
            abweichende Übung in der nicht gezeigten Variante unentdeckt. Bei
            mehreren Varianten trägt darum JEDE Hauptteil-Übung ihre Variante,
            nicht nur die aus einer anderen: Ohne Zusatz wäre nicht zu
            unterscheiden, ob eine Übung in der gezeigten Variante steht oder
            ausserhalb des Hauptteils. */}
        <ul className="flex flex-col gap-1">
          {(mismatch ?? []).map((m) => {
            const name = mehrereVarianten
              ? varianten.find((v) => v.id === m.varianteId)?.name
              : undefined;
            return (
              <li key={m.id} className="type-body-medium text-on-surface">
                · {m.name}
                {name && (
                  <span className="text-on-surface-variant"> (Variante „{name}")</span>
                )}
              </li>
            );
          })}
        </ul>
      </Dialog>

      {/* Training löschen */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Training löschen?"
        actions={
          <>
            <Button variant="text" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </Button>
            <form action={deleteTraining.bind(null, training.id)}>
              <Button type="submit" variant="danger">
                Endgültig löschen
              </Button>
            </form>
          </>
        }
      >
        <p>
          Das Training „{training.name}" und alle seine Übungszuordnungen werden
          unwiderruflich gelöscht.
        </p>
        {/* Beim öffentlichen Training ist das Löschen mehr als ein Aufräumen im
            eigenen Bestand: es verschwindet aus der Öffentlichkeit (AK 8). */}
        {oeffentlich && (
          <p className="mt-3">
            Das Training verschwindet damit auch aus dem öffentlichen Bestand.
            Kopien, die andere bereits übernommen haben, bleiben bestehen.
          </p>
        )}
      </Dialog>

      {/* Gruppe entfernen, solange sie Übungen zugewiesen ist (AK 8) */}
      <Dialog
        open={gruppeWeg != null}
        onClose={() => setGruppeWeg(null)}
        title={`${gruppeWeg?.name ?? "Gruppe"} entfernen?`}
        actions={
          <>
            <Button variant="text" onClick={() => setGruppeWeg(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => gruppeWeg && void entferneGruppeJetzt(gruppeWeg)}
            >
              Entfernen
            </Button>
          </>
        }
      >
        {/* Gezählt wird über ALLE Varianten: Die Gruppe gehört dem Training,
            und mit ihr fallen auch die Zuweisungen weg, die der Trainer gerade
            nicht sieht (#201 AK 10). */}
        <p>
          {gruppeWeg?.name} ist an{" "}
          {zaehle(gruppeWeg ? modell.zuweisungenVon(gruppeWeg.id) : 0, "Übung", "Übungen")}{" "}
          zugewiesen
          {gruppeWeg && mehrereVarianten
            ? aufteilungSatz(modell.zuweisungenJeVariante(gruppeWeg.id), varianten)
            : ""}
          . Die Zuweisungen fallen weg, die Übungen selbst bleiben unberührt.
        </p>
      </Dialog>

      {/* Übung entfernen, die Gruppen im Durchlauf trägt (AK 16) */}
      <Dialog
        open={uebungWeg != null}
        onClose={() => setUebungWeg(null)}
        title={`${uebungWeg?.name ?? "Übung"} entfernen?`}
        actions={
          <>
            <Button variant="text" onClick={() => setUebungWeg(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={() => uebungWeg && entferneUebung(uebungWeg)}>
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          Die Übung trägt {zaehle(uebungWeg ? modell.gruppenAn(uebungWeg.id) : 0, "Gruppe", "Gruppen")}{" "}
          im Durchlauf. Mit ihr fallen diese Zuweisungen weg; die Gruppen selbst
          bleiben bestehen.
        </p>
      </Dialog>

      {/* Variante hinzufügen (#201 AK 1/2). Nur mit einer angezeigten Variante,
          von der kopiert werden kann — ohne sie gäbe es keine Quelle. */}
      {aktive && (
        <VarianteAnlegenDialog
          open={varianteDialog}
          onClose={() => setVarianteDialog(false)}
          trainingId={training.id}
          aktive={aktive}
          varianten={varianten}
          onAngelegt={varianteAngelegt}
        />
      )}

      {/* Bezeichnung einer Variante bearbeiten (#209 AK 6) */}
      <BezeichnungDialog
        open={varianteBearbeiten != null}
        onClose={() => setVarianteBearbeiten(null)}
        titel="Variante bearbeiten"
        wert={varianteBearbeiten?.name ?? ""}
        max={VARIANTE_NAME_MAX}
        hilfetext={`Woran du sie erkennst, etwa „21 Kinder". Höchstens ${VARIANTE_NAME_MAX} Zeichen.`}
        // Die eigene bisherige Bezeichnung zählt nicht als vergeben — dafür
        // kennt `varianteNameProblem` die eigene ID.
        pruefe={(name) => varianteNameProblem(name, varianten, varianteBearbeiten?.id)}
        speichere={(name) =>
          varianteBearbeiten
            ? variantenModell.benenne(varianteBearbeiten.id, name)
            : Promise.resolve(null)
        }
      />

      {/* Variante entfernen — mit Rückfrage (#202 AK 5, #209 AK 7). Geschwister
          der übrigen Dialoge und nie in einem von ihnen: Zwei ineinander
          gerenderte <dialog> stapeln sich zwar im Top Layer, der äussere bliebe
          dabei aber der Fokus-Trap des inneren. */}
      <Dialog
        open={varianteWeg != null}
        onClose={() => setVarianteWeg(null)}
        title={`Variante „${varianteWeg?.name ?? ""}" entfernen?`}
        actions={
          <>
            <Button variant="text" onClick={() => setVarianteWeg(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={() => varianteWeg && void entferneVarianteJetzt(varianteWeg)}
            >
              Entfernen
            </Button>
          </>
        }
      >
        <p>
          {varianteWeg
            ? wegfallSatz(varianteWeg, fassungenVon(fassungenLokal, varianteWeg.id), {
                uebrigeVarianten: varianten.length > 2,
              })
            : ""}
          {/* Bei zweien ist das Entfernen zugleich die Auflösung der
              verbleibenden (#209 AK 7) — beides gehört in dieselbe Rückfrage. */}
          {varianteWeg && varianten.length === 2 && (
            <>
              {" "}
              {aufloesungSatz(
                varianten.find((v) => v.id !== varianteWeg.id) ?? varianteWeg,
              )}
            </>
          )}
        </p>
      </Dialog>

      {/* Gruppe anlegen und umbenennen — ein Dialog, zwei Wortlaute
          (#209 AK 2/6) */}
      <BezeichnungDialog
        open={gruppeDialog != null}
        onClose={() => setGruppeDialog(null)}
        titel={bearbeitet ? "Gruppe bearbeiten" : "Gruppe hinzufügen"}
        hinweis={
          bearbeitet
            ? undefined
            : "Verteilt wird nur der Hauptteil. Die Gruppe gilt für alle Varianten."
        }
        wert={bearbeitet ? gruppeDialog.gruppe.name : ""}
        max={GRUPPE_NAME_MAX}
        hilfetext={
          bearbeitet
            ? `Höchstens ${GRUPPE_NAME_MAX} Zeichen.`
            : `Woran du sie erkennst, etwa „Rot". Höchstens ${GRUPPE_NAME_MAX} Zeichen.`
        }
        aktion={bearbeitet ? "Speichern" : "Anlegen"}
        pruefe={(name) =>
          nameProblem(name, modell.gruppen, bearbeitet ? gruppeDialog.gruppe.id : undefined)
        }
        speichere={(name) =>
          bearbeitet ? modell.umbenennen(gruppeDialog.gruppe.id, name) : modell.anlegen(name)
        }
      />

      {/* Fest am unteren Rand statt im Fluss: der Editor ist eine lange Seite,
          und die Meldung gehört zu einer Aktion irgendwo darin. Am Seitenende
          eingehängt stünde sie mehr als tausend Bildpunkte unter dem Klick und
          erreichte den Trainer nie — was gerade die abgelehnten Änderungen an
          einem öffentlichen Training betrifft (Story A AK 7). */}
      <Snackbar
        open={notice != null}
        message={notice ?? ""}
        onClose={() => setNotice(null)}
        placement="fixed"
      />
    </div>
  );
}

/**
 * Wo die Zuweisungen einer Gruppe stehen — als Nachsatz zur Rückfrage vor dem
 * Entfernen (#201 AK 10).
 *
 * Die blosse Gesamtzahl liesse den Trainer glauben, er überblicke sie: Was er
 * sieht, ist eine Variante. Darum nennt der Satz jede Variante, in der die
 * Gruppe steht — in der Reihenfolge der Leiste, damit er sie dort wiederfindet.
 * Liegen alle in derselben, sagt er das statt einer Aufzählung von einem.
 */
function aufteilungSatz(
  je: { varianteId: string; anzahl: number }[],
  varianten: readonly Variante[],
): string {
  const geordnet = varianten
    .map((v) => ({ name: v.name, anzahl: je.find((e) => e.varianteId === v.id)?.anzahl ?? 0 }))
    .filter((e) => e.anzahl > 0);
  if (geordnet.length === 0) return "";
  // «alle» setzt eine Mehrzahl voraus, die es bei einer einzigen Zuweisung
  // nicht gibt: «ist an 1 Übung zugewiesen, alle in der Variante …».
  if (geordnet.length === 1)
    return `, ${geordnet[0].anzahl === 1 ? "" : "alle "}in der Variante „${geordnet[0].name}"`;
  // Das Wort «Variante» steht einmal am Anfang; die weiteren Glieder tragen
  // bloss den Namen — sonst stünde es in einem Satz drei- und viermal.
  const teile = geordnet.map(
    (e, i) => `${e.anzahl} in ${i === 0 ? "der Variante " : ""}„${e.name}"`,
  );
  const letzter = teile.pop();
  return `, davon ${teile.join(", ")} und ${letzter}`;
}
