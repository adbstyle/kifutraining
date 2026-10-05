"use client";

import { useEffect, useId, useMemo, useRef, useState, useActionState, startTransition } from "react";
import { ArrowLeftRight, ImagePlus, X } from "lucide-react";
import {
  TextField,
  TextArea,
  Select,
  MultiSelect,
  Button,
  AltersstufeField,
  Banner,
  FormAbschnitt,
  HeadlineField,
  Checkbox,
  Card,
  IconButton,
  Tooltip,
} from "@/components/ui";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import {
  feldtyp as feldLabels,
  uebungstyp as uebungstypLabels,
  uebungstypSlugs,
} from "@/lib/vocab";
import {
  kategorieStufe,
  ERSCHEINUNGSFORM_LABEL,
  HOECHSTANZAHL_SPIELER_LABEL,
  MINDESTANZAHL_SPIELER_LABEL,
  ueberfuehreAblauf,
} from "@/lib/labels";
import {
  FREIES_SPIEL,
  andereAltersstufe,
  brauchtFahrplan,
  erscheinungsformenFuer,
  kategorienFuer,
  traegtErscheinungsform,
  traegtFeldtyp,
  traegtHauptteilkategorie,
  traegtSpielfeldgroesse,
  traegtUebungstyp,
  FELDTYP_MIT_SPIELFELD,
  type Altersstufe,
} from "@/lib/altersstufe";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { EinordnungField } from "@/components/exercise/EinordnungField";
import { UmwandelnDialog, type Umwandlung } from "@/components/exercise/UmwandelnDialog";
import { SpielfeldgroesseField } from "@/components/exercise/SpielfeldgroesseField";
import {
  AenderungBanner,
  MaterialField,
  VorschlagBanner,
  listeAusZeilen,
  zeilenAus,
} from "@/components/exercise/MaterialField";
import {
  AENDERUNG_BEIBEHALTEN,
  AENDERUNG_UEBERNEHMEN,
  gleicheListe,
  materialAenderungen,
  materialBasisAusDiagramm,
  type MaterialPosten,
} from "@/lib/material";
import { DiagrammFeld } from "@/components/exercise/DiagrammFeld";
import { VerlassenWarnung } from "@/components/layout/VerlassenWarnung";
import { ZweiSpalten } from "@/components/layout/ZweiSpalten";
import { cn } from "@/lib/cn";
import { LEERES_DIAGRAMM, parseDiagramm, type DiagrammData } from "@/lib/diagramm";
import { inputImageError, IMAGE_ACCEPT } from "@/lib/image";
import { compressImage } from "@/lib/image-compress";


/** Was über und unter beiden Spalten steht (Name, Meldungen, Speichern), so
 *  breit wie sie: gestapelt in der Lesebreite des Inhalts, ab `xl` über
 *  Inhalt und Einordnung zusammen. */
const UEBER_BEIDEN = "max-w-4xl xl:max-w-none";


export type ExerciseInitial = {
  name?: string;
  trainingsteil?: string;
  kategorien?: string[];
  feldtyp?: string | null;
  spielfeld_laenge_m?: number | null;
  spielfeld_breite_m?: number | null;
  erscheinungsform?: string[];
  hauptteilkategorie?: string | null;
  uebungstyp?: string | null;
  anzahl_kinder?: { min?: number | null; max?: number | null } | null;
  /** Die freie Ergänzung zum Material. */
  material?: string[];
  /** Material aus dem Diagramm-Vorrat (Epic #266). */
  materialListe?: MaterialPosten[];
  methodischer_fahrplan?: {
    offen_starten?: string;
    ueben?: string[];
    wetteifern?: string | null;
  } | null;
  aufbau?: string | null;
  varianten?: string | null;
  bildUrl?: string | null;
};

export function ExerciseForm({
  action,
  initial = {},
  altersstufe: initialeStufe,
  stufenWahl,
  kontext,
  ueberfuehrbar = false,
  submitLabel,
  bildEntfernenMoeglich = false,
  fussnote,
  materialBasis = null,
  diagramm: gespeichertesDiagramm,
  vorlagenAusser,
  inSpalte,
}: {
  action: (state: ExerciseFormState, form: FormData) => Promise<ExerciseFormState>;
  initial?: ExerciseInitial;
  /** Nach welchem Lehrmittel erfasst wird. Beim Bearbeiten die gespeicherte
   *  Stufe der Übung bzw. die ihres Trainings, beim Erfassen die Vorbelegung. */
  altersstufe: Altersstufe;
  /** Darf der USER die Altersstufe hier wählen? Nur beim Erfassen — danach ist
   *  sie fest, und das Überführen ist ein eigener Weg (Story 4). */
  stufenWahl: "waehlbar" | "fest";
  /** Bibliotheks-Übung oder Fassung in einem Training. Steuert ausschliesslich
   *  die Beschriftung; die Felder selbst hängen an der Altersstufe. */
  kontext: "bibliothek" | "fassung";
  /** Darf die Übung hier in die andere Altersstufe überführt werden (Story 4)?
   *  Nur an einer eigenen Bibliotheks-Übung. Eine Fassung erbt die Altersstufe
   *  ihres Trainings und kann sie nie eigenständig wechseln. */
  ueberfuehrbar?: boolean;
  submitLabel: string;
  /** Erlaubt, das vorhandene Bild ohne Ersatz zu entfernen (Fassungen, Story 5). */
  bildEntfernenMoeglich?: boolean;
  /** Hinweis neben der Speichern-Schaltfläche. */
  fussnote?: React.ReactNode;
  /** Der Vorschlag bei der letzten Übernahme; `null` = nie übernommen. */
  materialBasis?: MaterialPosten[] | null;
  /** Das gespeicherte Feld-Diagramm; beim Erfassen nicht gesetzt. Gezeichnet
   *  wird in der Maske (#246, #247): Die Zeichnung geht mit dem Speichern mit,
   *  und der Material-Vorschlag folgt ihr live. */
  diagramm?: unknown;
  /** Die Bibliotheks-Übung, die nicht als ihre eigene Vorlage erscheint. */
  vorlagenAusser?: string;
  /** Die Maske steht nicht auf eigener Seite, sondern in der Spalte neben den
   *  Übungen eines Trainings (Epic #369, Story #372): eine Spalte in der
   *  Reihenfolge des Detail — Name, Diagramm, Beschreibung, Einordnung samt
   *  Material, Foto —, Sichern und Verwerfen klebend obenauf. Gesichert wird
   *  ohne Weiterleitung (`status: "gesichert"`); was dann geschieht, ebenso
   *  wie Verwerfen und Schliessen, entscheidet die Spalte. `onUngesichert`
   *  meldet ihr, ob ungesicherte Angaben anstehen — sie fragt dann nach,
   *  bevor ein Vorgang die Übung verlässt (AK 4). */
  inSpalte?: {
    onUngesichert: (ungesichert: boolean) => void;
    onGesichert: () => void;
    onVerwerfen: () => void;
    onSchliessen: () => void;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as ExerciseFormState);
  const formRef = useRef<HTMLFormElement>(null);
  // Scheitert das Speichern an einem Feld, rückt es ins Bild: In der geteilten
  // Maske scrollen die Spalten für sich, und das markierte Feld läge sonst
  // irgendwo darin, während oben nur die Meldung steht. Gesucht wird das erste
  // als ungültig markierte Feld, sonst der erste Fehlertext unter einem Feld
  // (die Auswahlfelder markieren sich nur so) — sichtbar, nicht die Meldung
  // und nicht ein Knopf in einem der Dialoge der Maske.
  useEffect(() => {
    if (state.status !== "error" || !state.errors || Object.keys(state.errors).length === 0) return;
    const form = formRef.current;
    const ziel =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      [...(form?.querySelectorAll<HTMLElement>(".text-error") ?? [])].find(
        (el) => el.offsetParent !== null && !el.closest('dialog, [role="alert"], [role="status"]'),
      );
    ziel?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);
  const err = state.errors ?? {};

  const [stufe, setStufe] = useState<Altersstufe>(initialeStufe);
  const [teil, setTeil] = useState<string>(initial.trainingsteil ?? "");
  const [kat, setKat] = useState<string[]>(initial.kategorien ?? []);
  const [form, setForm] = useState<string[]>(initial.erscheinungsform ?? []);
  const [feld, setFeld] = useState<string>(initial.feldtyp ?? "");
  const [laenge, setLaenge] = useState<string>(
    initial.spielfeld_laenge_m != null ? String(initial.spielfeld_laenge_m) : "",
  );
  const [breite, setBreite] = useState<string>(
    initial.spielfeld_breite_m != null ? String(initial.spielfeld_breite_m) : "",
  );
  const [hkat, setHkat] = useState<string>(initial.hauptteilkategorie ?? "");
  const [uebungstyp, setUebungstyp] = useState<string>(initial.uebungstyp ?? "");
  // Überführen in die andere Altersstufe (Story 4): der Dialog holt die
  // Angaben, das Formular schaltet um — geschrieben wird erst beim Speichern.
  const [dialogOffen, setDialogOffen] = useState(false);
  const [umwandlung, setUmwandlung] = useState(false);
  const [bildError, setBildError] = useState<string | null>(null);
  const [bildName, setBildName] = useState<string | null>(null);
  const bildRef = useRef<HTMLInputElement>(null);
  const bildKnopfId = useId();
  const bildNameId = useId();
  const [isCompressing, setIsCompressing] = useState(false);
  const [bildEntfernen, setBildEntfernen] = useState(false);

  // Ablauf-Texte kontrolliert: nur so kann der bisherige Text beim Wechsel der
  // Einordnung als Ausgangstext in die andere Form übernommen werden (Story 2).
  const [offenStarten, setOffenStarten] = useState(
    initial.methodischer_fahrplan?.offen_starten ?? "",
  );
  const [ueben, setUeben] = useState(initial.methodischer_fahrplan?.ueben?.join("\n") ?? "");
  const [wetteifern, setWetteifern] = useState(
    initial.methodischer_fahrplan?.wetteifern ?? "",
  );
  const [aufbau, setAufbau] = useState(initial.aufbau ?? "");

  // Material (Epic #266): die Zeilen der Liste und ob der Trainer den
  // Vorschlag in dieser Bearbeitung übernommen hat — nur dann setzt der
  // Server die Basis neu.
  const [materialZeilen, setMaterialZeilen] = useState(() =>
    zeilenAus(initial.materialListe ?? []),
  );
  const [materialError, setMaterialError] = useState<string | null>(null);

  // Die Zeichnung in der Maske (#246, #247) — beim Bearbeiten ab der
  // gespeicherten. Eine übernommene Vorlage macht das Diagramm beim Speichern
  // zum Bild der Übung (#61 PC4).
  const [anfangsDiagramm] = useState<DiagrammData>(
    () => parseDiagramm(gespeichertesDiagramm) ?? LEERES_DIAGRAMM,
  );
  const [diagramm, setDiagramm] = useState<DiagrammData>(anfangsDiagramm);
  const [ausVorlage, setAusVorlage] = useState(false);
  const [anfangsElemente] = useState(() => JSON.stringify(anfangsDiagramm.elemente));
  const diagrammGeaendert = useMemo(
    () => JSON.stringify(diagramm.elemente) !== anfangsElemente,
    [diagramm, anfangsElemente],
  );

  // Der Vorschlag folgt der Zeichnung in der Maske — er ändert sich, während
  // der Trainer zeichnet, und meldet eine Änderung schon vor dem Speichern
  // (#247 AK 6/7).
  const vorschlag = useMemo(() => materialBasisAusDiagramm(diagramm), [diagramm]);
  // Der Vorschlag, den der Trainer in dieser Bearbeitung übernommen oder mit
  // «Material beibehalten» quittiert hat; `null` = noch keiner. Er gilt als
  // Basis, bis gespeichert ist — zeichnet der Trainer danach weiter, meldet
  // der Änderungs-Hinweis den neuen Stand gegen genau diese Quittung.
  const [quittiert, setQuittiert] = useState<MaterialPosten[] | null>(null);
  const basis = quittiert ?? materialBasis;
  // Nur eine Quittung des AKTUELLEN Vorschlags wird mitgeschickt; der Server
  // setzt die Basis aus dem Diagramm, das er speichert.
  const basisBestaetigt = quittiert !== null && gleicheListe(quittiert, vorschlag);
  const aktuelleListe = listeAusZeilen(materialZeilen);
  const zeigtVorschlag =
    basis === null &&
    vorschlag.length > 0 &&
    !(aktuelleListe.ok && gleicheListe(aktuelleListe.liste, vorschlag));

  // Hat eine Diagrammänderung den übernommenen Vorschlag verändert (Story
  // #269)? Verglichen wird Vorschlag mit Basis — eigene Anpassungen an der
  // Liste zählen nicht.
  const aenderungen = materialAenderungen(basis, vorschlag);

  function uebernehmeVorschlag() {
    setMaterialZeilen(zeilenAus(vorschlag));
    setMaterialError(null);
    setQuittiert(vorschlag);
  }

  // Ungesicherte Angaben (#246 AK 7, #247 AK 8): getippt wurde in ein
  // Formularfeld, eine Auswahl weicht vom Anfang ab, oder die Zeichnung. Die
  // Auswahlen werden verglichen statt markiert — so gilt ein zurückgenommener
  // Wechsel nicht als Änderung, und Strict Mode kann kein Erst-Render-Flag
  // verwirren.
  const [eingetippt, setEingetippt] = useState(false);
  const auswahl = JSON.stringify([
    stufe, teil, kat, form, feld, laenge, breite, hkat, uebungstyp, materialZeilen,
    umwandlung, bildEntfernen,
  ]);
  const [anfangsAuswahl] = useState(auswahl);
  const ungesichert = eingetippt || auswahl !== anfangsAuswahl || diagrammGeaendert;
  // Nur beim Erfassen ist die Altersstufe wählbar — und ist noch nichts von
  // der Übung gespeichert.
  const erfassen = stufenWahl === "waehlbar";
  // Drei Aufbauten: Erfassen führt Schritt für Schritt durch eine Spalte —
  // Einordnung, Feld-Diagramm, Beschreibung, Material, Foto (PO 2026-10-02).
  // Bearbeiten teilt die Maske wie die Detailseite in Inhalt und Einordnung
  // (#353). In der Spalte eines Trainings steht sie in der Reihenfolge des
  // Detail untereinander (`inSpalte`, #372).
  const geteilt = !erfassen && !inSpalte;

  // Die Spalte erfährt jeden Wechsel; sie fragt damit vor dem Verlassen nach.
  // Über eine Ref: Die Rückrufe entstehen bei jedem Rendern der Spalte neu,
  // gemeldet wird aber nur, wenn sich hier etwas geändert hat — das Gesichert
  // genau einmal je Antwort des Servers.
  const spalteRef = useRef(inSpalte);
  spalteRef.current = inSpalte;
  useEffect(() => {
    spalteRef.current?.onUngesichert(ungesichert);
  }, [ungesichert]);
  useEffect(() => {
    if (state.status === "gesichert") spalteRef.current?.onGesichert();
  }, [state]);

  // Das Feld-Gating kommt geschlossen aus lib/altersstufe.ts — derselben
  // Quelle, gegen die die Server Action prüft und die die DB-CHECKs spiegelt.
  // Weicht das Formular davon ab, verlangt es entweder ein Feld, das der Server
  // verwirft, oder es verschweigt eines, das er einfordert.
  const istFahrplan = brauchtFahrplan(stufe, teil, hkat);
  const zeigtHkat = traegtHauptteilkategorie(stufe, teil);
  const zeigtForm = traegtErscheinungsform(stufe, teil);
  const zeigtTyp = traegtUebungstyp(stufe, teil);
  const zeigtFeldtyp = traegtFeldtyp(stufe);
  // Im Kinderfussball nur beim freien Feld (Story #272).
  const zeigtSpielfeld = traegtSpielfeldgroesse(stufe, feld || null);
  // Das freie Spiel trägt eine Beschreibung statt des Fahrplans (Story 2).
  const istFreiesSpiel = zeigtHkat && hkat === FREIES_SPIEL;

  // Was die neue Einordnung nicht kennt, verschwindet aus der Maske — und mit
  // ihm beim Speichern die bereits erfasste Angabe (`parseUebungsInhalt` leert
  // sie, die DB-CHECKs verbieten sie). Ohne Hinweis wäre der Verlust still:
  // Das Feld ist ja schon weg, wenn er eintritt. Genannt wird nur, was
  // tatsächlich etwas enthält (Story #128 AC 7). Der Fall entsteht heute beim
  // Umhängen ins Auffangen, die Regel selbst ist aber allgemein — sie gilt für
  // jede Einordnung, die eines der beiden Felder nicht trägt.
  const entfallend = [
    !zeigtForm && form.length > 0 ? "Erscheinungsform" : null,
    !zeigtTyp && uebungstyp ? "Übungstyp" : null,
  ].filter((f): f is string => f !== null);
  const entfallHinweis =
    entfallend.length === 0
      ? undefined
      : `${entfallend.join(" und ")} gibt es hier nicht — ${
          entfallend.length === 1
            ? "die erfasste Angabe entfällt"
            : "die erfassten Angaben entfallen"
        } beim Speichern.`;

  /** Einordnung wechseln und den bisherigen Ablauftext als Ausgangstext in die
   *  neue Form überführen (Story 2 AK 3) — redigiert wird von Hand. Gilt nur
   *  INNERHALB einer Altersstufe; der Stufenwechsel leert stattdessen. */
  function wechsleEinordnung(neuerTeil: string, neueHkat: string) {
    const nachher = brauchtFahrplan(stufe, neuerTeil, neueHkat);
    if (istFahrplan !== nachher) {
      const neu = ueberfuehreAblauf(nachher, { offenStarten, ueben, wetteifern, aufbau });
      setOffenStarten(neu.offenStarten);
      setUeben(neu.ueben);
      setWetteifern(neu.wetteifern);
      setAufbau(neu.aufbau);
    }
    setTeil(neuerTeil);
    setHkat(neueHkat);
  }

  /** Altersstufe wechseln — nur beim Erfassen möglich, an einer noch nicht
   *  gespeicherten Übung. Jedes stufenabhängige Feld beginnt leer: die beiden
   *  Manuals führen verschiedene Einordnungen, Alterskategorien,
   *  Erscheinungsformen und Ablaufformen, ein übernommener Wert wäre nie der
   *  richtige. Name, Material, Varianten, Anzahl Spieler:innen und Bild sind
   *  lehrmittelunabhängig und bleiben stehen. */
  function wechsleAltersstufe(neu: Altersstufe) {
    setStufe(neu);
    setTeil("");
    setKat([]);
    setForm([]);
    setHkat("");
    setUebungstyp("");
    setFeld("");
    setLaenge("");
    setBreite("");
    setOffenStarten("");
    setUeben("");
    setWetteifern("");
    setAufbau("");
  }

  /** Die Umwandlung in die andere Altersstufe vormerken (Story 4).
   *
   *  Anders als beim Erfassen wird hier nicht geleert, sondern überführt: Was
   *  die Zielstufe kennt, kommt aus dem Dialog (Einordnung, Alterskategorien,
   *  im Kinderfussball-Hauptteil die Kategorie), der Ablauftext wandert in die
   *  Form der Zielstufe (PC 2), und was sie nicht kennt, fällt weg (PC 4) —
   *  Erscheinungsformen, Übungstyp und ein Feldtyp ohne Meter. Die Meter des
   *  freien Felds bzw. die Spielfeldgrösse gehen mit (Story #272). Titel, Bild,
   *  Diagramm, Anzahl Spieler:innen, Material und Varianten bleiben unangetastet
   *  (PC 1); sie hängen an keinem Lehrmittel.
   *
   *  Gespeichert wird nichts: Erst das Absenden des Formulars macht die
   *  Umwandlung wirksam. Wer die Seite verlässt, lässt die Übung unverändert
   *  zurück (PC 5). */
  function ueberfuehre(u: Umwandlung) {
    const nachFahrplan = brauchtFahrplan(u.altersstufe, u.einordnung, u.hauptteilkategorie);
    if (istFahrplan !== nachFahrplan) {
      const neu = ueberfuehreAblauf(nachFahrplan, { offenStarten, ueben, wetteifern, aufbau });
      setOffenStarten(neu.offenStarten);
      setUeben(neu.ueben);
      setWetteifern(neu.wetteifern);
      setAufbau(neu.aufbau);
    }
    setStufe(u.altersstufe);
    setTeil(u.einordnung);
    setHkat(u.hauptteilkategorie ?? "");
    setKat(u.kategorien);
    // Stufenfremde Angaben: die beiden Manuals führen getrennte Kataloge.
    setForm([]);
    setUebungstyp("");
    // Die Meter reisen mit (Story #272 PC 2/5): Das freie Feld wird zur
    // Spielfeldgrösse des Juniorenfussballs, und eine Junioren-Übung mit
    // Spielfeldgrösse wird eine Übung auf freiem Feld. Ohne Meter gibt es
    // nichts zu übertragen, der Feldtyp beginnt dann leer.
    const mitMetern = zeigtSpielfeld && laenge !== "" && breite !== "";
    setFeld(u.altersstufe === "kinderfussball" && mitMetern ? FELDTYP_MIT_SPIELFELD : "");
    if (!mitMetern) {
      setLaenge("");
      setBreite("");
    }
    setUmwandlung(true);
    setDialogOffen(false);
  }

  // FormData direkt aus dem DOM bauen und die Chip-/Select-Werte aus dem State
  // explizit setzen. Verlässlicher als state-gesteuerte Hidden-Inputs, deren
  // Wert die Server-Action-Serialisierung nicht zuverlässig erfasst.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending || isCompressing) return; // gegen Doppel-Submit
    const fd = new FormData(e.currentTarget);

    // Bild im Browser verkleinern, bevor es gesendet wird: so erreicht nur die
    // kleine WebP-Fassung den Server (umgeht das Body-Limit, hält den Bucket
    // klein). Grosse Originale sind dadurch erlaubt; HEIC wird konvertiert.
    const bild = fd.get("bild");
    if (bild instanceof File && bild.size > 0) {
      const invalid = inputImageError(bild);
      if (invalid) {
        setBildError(invalid);
        return;
      }
      setBildError(null);
      setIsCompressing(true);
      try {
        fd.set("bild", await compressImage(bild));
      } catch {
        setBildError(
          "Das Foto konnte nicht verarbeitet werden. Bitte versuche es erneut oder wähle ein anderes Foto.",
        );
        return;
      } finally {
        setIsCompressing(false);
      }
    }

    setBildError(null);

    const material = listeAusZeilen(materialZeilen);
    if (!material.ok) {
      setMaterialError(material.error);
      return;
    }
    setMaterialError(null);
    fd.set("material_liste", JSON.stringify(material.liste));
    fd.set("material_basis_bestaetigen", basisBestaetigt ? "1" : "");

    // Die Altersstufe wertet das Erstellen aus; beim Bearbeiten nimmt die
    // Server Action die gespeicherte bzw. die des Trainings (Story 1 AC 9) —
    // ausser der Trainer hat die Umwandlung ausdrücklich bestätigt (Story 4
    // AK 2). Ohne diese Quittung ist der Wert wirkungslos.
    fd.set("altersstufe", stufe);
    fd.set("umwandlung_bestaetigt", umwandlung ? "1" : "");
    fd.set("trainingsteil", teil);
    fd.set("kat", kat.join(","));
    // Jedes gegatete Feld wird EXPLIZIT leer gesetzt, wenn es nicht gerendert
    // ist: sonst überlebte ein Altwert im DOM oder — schlimmer — ein von aussen
    // untergeschobener den Wechsel. Der Server verwirft ihn ohnehin (dort sitzt
    // die Trust-Boundary), aber das Formular soll dieselbe Aussage senden, die
    // es zeigt.
    fd.set("form", zeigtForm ? form.join(",") : "");
    fd.set("uebungstyp", zeigtTyp ? uebungstyp : "");
    fd.set("hauptteilkategorie", zeigtHkat ? hkat : "");
    fd.set("feldtyp", zeigtFeldtyp ? feld : "");
    fd.set("spielfeld_laenge", zeigtSpielfeld ? laenge : "");
    fd.set("spielfeld_breite", zeigtSpielfeld ? breite : "");
    fd.set("bild_entfernen", bildEntfernen ? "1" : "");
    // Die Zeichnung geht mit der Übung in einem Vorgang (#246 AK 5, #247
    // PC 1); geprüft wird sie auf dem Server.
    fd.set("diagramm", JSON.stringify(diagramm));
    fd.set("diagramm_aus_vorlage", ausVorlage ? "1" : "");
    startTransition(() => formAction(fd));
  }

  const spielfeldFeld = (
    <SpielfeldgroesseField
      laenge={laenge}
      breite={breite}
      onLaengeChange={setLaenge}
      onBreiteChange={setBreite}
      error={err.spielfeld}
    />
  );

  // Die Einordnung steht in der Spalte rechts, wie auf der Detailseite (Epic
  // #350, Story #353): Altersstufe, Alterskategorie, Trainingsteil oder Block,
  // Feld, Spielerzahl, Übungstyp, Erscheinungsform und Material. Schmal steht
  // sie VOR dem Inhalt — sie bestimmt, welche Felder der Inhalt verlangt
  // (Fahrplan oder Beschreibung). In der Spalte eines Trainings folgt sie wie
  // im Detail nach Diagramm und Beschreibung (#372). Herkunft und
  // Sichtbarkeit setzt die Detailseite.
  const einordnungAbschnitt = (
      <FormAbschnitt titel="Einordnung">
        <AltersstufeField
          wert={stufe}
          onChange={stufenWahl === "waehlbar" ? wechsleAltersstufe : undefined}
          festHinweis={
            kontext === "fassung"
              ? "Folgt dem Training — Felder und Werte kommen aus dessen Manual."
              : umwandlung
                ? "Wird beim Speichern übernommen."
                : undefined
          }
          aktion={
            ueberfuehrbar &&
            !umwandlung && (
              <Button
                type="button"
                variant="text"
                onClick={() => setDialogOffen(true)}
              >
                <ArrowLeftRight size={18} strokeWidth={2} aria-hidden />
                In den {altersstufeLabels[andereAltersstufe(stufe)]} überführen
              </Button>
            )
          }
        />

        {/* Die Werte stehen ausgeschrieben («G-Junior:innen») statt als blosser
            Buchstabe: In einer Optionsliste ist ein einzelnes «G» kein Wort,
            sondern ein Kürzel ohne Kontext — der Katalogfilter beschriftet sie
            aus demselben Grund so. Weder Suche noch Aktions-Fuss: drei bis vier
            kurze Werte liest man schneller, als man sie filtert. Passen alle
            gewählten Kategorien nicht in eine Zeile, bricht das Feld um. */}
        <MultiSelect
          label="Alterskategorie"
          options={kategorienFuer(stufe).map((k) => ({
            value: k,
            label: kategorieStufe[k as keyof typeof kategorieStufe],
          }))}
          value={kat}
          onChange={setKat}
          searchable={false}
          actions={false}
          error={!!err.kat}
          supportingText={err.kat}
        />

        {dialogOffen && (
          <UmwandelnDialog
            von={stufe}
            einordnung={teil}
            hauptteilkategorie={zeigtHkat ? hkat : null}
            onClose={() => setDialogOffen(false)}
            onConfirm={ueberfuehre}
          />
        )}

        {/* Im Kinderfussball-Hauptteil wählt dasselbe Feld die
            Hauptteilkategorie mit — wie den Block im Juniorenfussball. */}
        <EinordnungField
          altersstufe={stufe}
          wert={teil}
          hauptteilkategorie={zeigtHkat ? hkat : ""}
          onChange={wechsleEinordnung}
          error={err.trainingsteil ?? err.hauptteilkategorie}
          hinweis={entfallHinweis}
        />

        {/* Was das Feld beschreibt: im Kinderfussball der Feldtyp (beim
            freien Feld mit den Metern darunter), im Juniorenfussball gleich
            die Spielfeldgrösse. */}
        {zeigtFeldtyp && (
          <Select
            label="Feldtyp (optional)"
            value={feld}
            onChange={setFeld}
            options={(Object.keys(feldLabels) as (keyof typeof feldLabels)[]).map((t) => ({
              value: t,
              label: feldLabels[t],
            }))}
          />
        )}
        {zeigtSpielfeld && spielfeldFeld}

        {/* Die Spielerzahl als zwei Felder mit je eigenem Namen, wie jedes
            andere Feld der Maske — kein gemeinsamer Name über zwei
            Teilnamen (PO 2026-10-04). Ein Fehler betrifft die Spanne: Rot
            sind beide, die Meldung steht unter dem zweiten. */}
        <TextField
          label={MINDESTANZAHL_SPIELER_LABEL}
          name="anzahl_min"
          type="number"
          inputMode="numeric"
          min={1}
          error={!!err.anzahl_max}
          defaultValue={initial.anzahl_kinder?.min ?? undefined}
        />
        <TextField
          label={HOECHSTANZAHL_SPIELER_LABEL}
          name="anzahl_max"
          type="number"
          inputMode="numeric"
          min={1}
          error={!!err.anzahl_max}
          supportingText={err.anzahl_max}
          defaultValue={initial.anzahl_kinder?.max ?? undefined}
        />

        {/* Übungstyp: optionale Selbstauskunft des Junioren-Manuals, und nur
            in den Blöcken, in denen eine Spielform vorkommen kann. Ohne
            Hilfstext, wie die übrigen Felder der Maske. Danach die
            Erscheinungsform — in der Reihenfolge der Detailseite. */}
        {zeigtTyp && (
          <Select
            label="Übungstyp (optional)"
            value={uebungstyp}
            onChange={setUebungstyp}
            options={uebungstypSlugs.map((t) => ({ value: t, label: uebungstypLabels[t] }))}
          />
        )}
        {/* Die Erscheinungsformen des Manuals, dem diese Übung folgt — in
            der Reihenfolge ihrer Quelle. Eine Gruppierung nach Spielphasen
            hat der Product Owner bewusst abgelehnt (Story 12 Out of Scope 2). */}
        {zeigtForm && (
          <MultiSelect
            label="Erscheinungsform (optional)"
            options={erscheinungsformenFuer(stufe).map((f) => ({
              value: f,
              label: ERSCHEINUNGSFORM_LABEL[f] ?? f,
            }))}
            value={form}
            onChange={setForm}
          />
        )}
      </FormAbschnitt>
  );

  const materialAbschnitt = (
      <FormAbschnitt titel="Material (optional)" fehler={!!materialError}>
        {(titelId) => (
          <MaterialField
            beschriftetVon={titelId}
            zeilen={materialZeilen}
            onZeilenChange={(z) => {
              setMaterialZeilen(z);
              if (materialError) setMaterialError(null);
            }}
            ergaenzung={initial.material ?? []}
            error={materialError ?? undefined}
            hinweis={
              aenderungen.length > 0 ? (
                <AenderungBanner
                  aenderungen={aenderungen}
                  actions={
                    <>
                      <Button type="button" variant="text" onClick={() => setQuittiert(vorschlag)}>
                        {AENDERUNG_BEIBEHALTEN}
                      </Button>
                      <Button type="button" variant="text" onClick={uebernehmeVorschlag}>
                        {AENDERUNG_UEBERNEHMEN}
                      </Button>
                    </>
                  }
                />
              ) : zeigtVorschlag ? (
                <VorschlagBanner vorschlag={vorschlag} onUebernehmen={uebernehmeVorschlag} />
              ) : basisBestaetigt ? (
                <p className="type-body-small text-on-surface-mittel">
                  Wird mit dem Speichern übernommen.
                </p>
              ) : undefined
            }
          />
        )}
      </FormAbschnitt>
  );

  const einordnung = (
    <Card className="flex flex-col gap-10 p-5">
      {einordnungAbschnitt}
      {materialAbschnitt}
    </Card>
  );

  // Gezeichnet wird auch in der Spalte neben den Übungen eines Trainings
  // (#373) — dieselbe Fläche samt Vorlagen; die Zeichnung geht mit dem
  // Sichern der Übung mit, ungesichert gilt sie wie jede andere Angabe.
  const diagrammAbschnitt = (
    <FormAbschnitt titel="Feld-Diagramm (optional)">
      <DiagrammFeld
        initial={anfangsDiagramm}
        name={initial.name}
        vorlagenAusser={vorlagenAusser}
        schmalHinweis={
          erfassen
            ? "Zum Zeichnen braucht es einen breiteren Bildschirm. Erfasse die Übung hier ohne Diagramm — zeichnen kannst du es später beim Bearbeiten."
            : "Zum Zeichnen braucht es einen breiteren Bildschirm. Die übrigen Angaben kannst du hier bearbeiten."
        }
        onChange={(data, info) => {
          setDiagramm(data);
          if (info.ausVorlage) setAusVorlage(true);
        }}
      />

    </FormAbschnitt>
  );

  const beschreibungAbschnitt = (
    <FormAbschnitt titel="Beschreibung">
      {/* Welche Form der Ablauf hat, entscheidet der Trainingsteil — bis er
          gewählt ist, sagt der Abschnitt, wo das Feld bleibt. */}
      {!teil && (
        <p className="type-body-medium text-on-surface-mittel">
          Wähle zuerst den Trainingsteil — danach beschreibst du hier den Ablauf.
        </p>
      )}
      {/* Der methodische Fahrplan als drei gewöhnliche Textfelder in der
          Reihe des Abschnitts, wie die Varianten — ohne eigenen Rahmen und
          ohne Überschrift: die Feldnamen sagen, was hinein gehört. */}
      {teil && (istFahrplan ? (
        <>
          <TextArea
            label="Offen starten"
            name="offen_starten"
            value={offenStarten}
            onChange={(e) => setOffenStarten(e.target.value)}
            error={!!err.offen_starten}
            supportingText={err.offen_starten}
          />
          <TextArea
            label="Üben"
            name="ueben"
            value={ueben}
            onChange={(e) => setUeben(e.target.value)}
            error={!!err.ueben}
            supportingText={err.ueben}
          />
          <TextArea
            label="Wetteifern"
            name="wetteifern"
            value={wetteifern}
            onChange={(e) => setWetteifern(e.target.value)}
            error={!!err.wetteifern}
            supportingText={err.wetteifern}
          />
        </>
      ) : (
        <TextArea
          label={istFreiesSpiel ? "Beschreibung des Spiels" : "Aufbau / Beschreibung"}
          name="aufbau"
          value={aufbau}
          onChange={(e) => setAufbau(e.target.value)}
          error={!!err.aufbau}
          supportingText={err.aufbau}
        />
      ))}

      <TextArea
        label="Varianten (optional)"
        name="varianten"
        defaultValue={initial.varianten ?? ""}
      />
    </FormAbschnitt>
  );

  // Das Foto heisst Foto und steht zuletzt, weit weg vom Feld-Diagramm —
  // allein die Überschrift trägt die Unterscheidung (#246 AK 8). Trägt die
  // Übung beides, bleibt das Foto als Umschalt-Option erhalten; angezeigt
  // wird das Diagramm (PC 4).
  const fotoAbschnitt = (
    <FormAbschnitt titel="Foto (optional)">
      {(titelId) => (
        <div>
          {/* Das Dateifeld des Browsers beschriftet sich selbst, in der
              Sprache des Browsers («Choose file», «No file chosen») und in
              seinem Aussehen. Es bleibt darum unsichtbar im Formular — es
              trägt die Datei in die FormData —, bedient wird es über einen
              eigenen Knopf, daneben steht der Name der gewählten Datei. */}
          <input
            ref={bildRef}
            id="bild"
            name="bild"
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              setBildError(null);
              setBildName(e.target.files?.[0]?.name ?? null);
            }}
          />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="tonal"
              aria-labelledby={`${titelId} ${bildKnopfId}`}
              aria-describedby={bildNameId}
              onClick={() => bildRef.current?.click()}
            >
              <ImagePlus size={18} strokeWidth={2} aria-hidden />
              <span id={bildKnopfId}>{bildName ? "Anderes Foto wählen" : "Foto wählen"}</span>
            </Button>
            <span id={bildNameId} className="type-body-medium min-w-0 truncate text-on-surface-mittel">
              {bildName ?? (initial.bildUrl ? "Kein neues Foto gewählt" : "Kein Foto gewählt")}
            </span>
          </div>
          <p className={`type-body-small mt-1.5 ${err.bild || bildError ? "text-error" : "text-on-surface-mittel"}`}>
            {err.bild ?? bildError ?? "JPG, PNG, WebP oder HEIC. Grosse Fotos werden automatisch verkleinert."}
          </p>
          {initial.bildUrl && !err.bild && !bildError && (
            <p className="type-body-small mt-1 text-on-surface-mittel">
              {bildEntfernen
                ? "Das aktuelle Foto wird beim Speichern entfernt."
                : "Aktuelles Foto bleibt erhalten, wenn du keines hochlädst."}
            </p>
          )}
          {bildEntfernenMoeglich && initial.bildUrl && (
            <Checkbox
              label="Foto entfernen"
              className="mt-2"
              checked={bildEntfernen}
              onChange={(e) => setBildEntfernen(e.target.checked)}
            />
          )}
        </div>
      )}
    </FormAbschnitt>
  );

  // Der Knopf, der die Maske absendet — überall derselbe Wortlaut für die
  // Zwischenstände.
  const sendenKnopf = (
    <Button type="submit" disabled={isPending || isCompressing}>
      {isCompressing
        ? "Foto wird optimiert …"
        : isPending
          ? "Wird gespeichert …"
          : umwandlung
            ? "Umwandeln und speichern"
            : submitLabel}
    </Button>
  );

  // Speichern samt Hinweis: beim Erfassen am Schluss der Schritte, beim
  // Bearbeiten rechts neben dem Namen.
  const speichern = (
    <div className="flex items-center gap-3">
      {fussnote && <p className="type-body-small text-on-surface-mittel">{fussnote}</p>}
      {sendenKnopf}
    </div>
  );

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      // Die Spalte, in der die Maske steht, bleibt mit ungesicherten Angaben
      // auch schmal stehen (`ZweiSpalten` `nurBreit`).
      data-ungesichert={inSpalte && ungesichert ? "" : undefined}
      // Nur benannte Felder tragen Angaben; eine Suche in einem Dialog der
      // Maske (Vorlagen, Auswahllisten) ist keine.
      onInput={(e) => {
        if ((e.target as HTMLInputElement).name) setEingetippt(true);
      }}
      // Geteilt wächst das Formular ab `xl` auf die freie Höhe der Seite; Name
      // und Speichern stehen dann fest, dazwischen scrollen die Spalten.
      className={cn("flex flex-col gap-10", geteilt && "xl:min-h-0 xl:flex-1 xl:gap-6")}
    >
      {state.message && (
        <Banner tone="fehler" className={UEBER_BEIDEN}>
          {state.message}
        </Banner>
      )}

      <VerlassenWarnung
        // Während des Speicherns nicht: Die Weiterleitung nach dem Speichern
        // ist kein Verlassen.
        aktiv={ungesichert && !isPending}
        titel={erfassen ? "Erfassung verlassen?" : "Bearbeitung verlassen?"}
        text={
          erfassen
            ? "Die Übung ist noch nicht gespeichert. Wenn du die Seite verlässt, gehen deine Angaben und die Zeichnung verloren."
            : "Deine Änderungen sind noch nicht gespeichert. Wenn du die Seite verlässt, gehen sie verloren."
        }
      />

      {/* Die Umwandlung ist vorgemerkt, nicht geschehen: Das Formular zeigt
          bereits die Zielstufe, die Übung liegt aber unverändert in der
          Datenbank (Story 4 PC 5). Der Hinweis sagt, was noch fehlt. */}
      {umwandlung && (
        <Banner className={UEBER_BEIDEN}>
          Umwandlung vorgemerkt — sie wird mit «Umwandeln und speichern» wirksam.
        </Banner>
      )}

      {/* In der Spalte steht obenauf, was die Bearbeitung abschliesst — es
          klebt am oberen Rand, während die Spalte darunter scrollt. */}
      {inSpalte && (
        <div className="sticky top-0 z-10 -mx-1 flex items-center gap-1 bg-elev-00 px-1 py-2">
          <p className="type-title-small min-w-0 flex-1 text-on-surface-mittel">Übung bearbeiten</p>
          <Button
            type="button"
            variant="text"
            onClick={inSpalte.onVerwerfen}
            disabled={isPending || isCompressing}
          >
            {/* Ohne Änderung gibt es nichts zu verwerfen — dann führt derselbe
                Knopf bloss zurück ins Detail. */}
            {ungesichert ? "Verwerfen" : "Abbrechen"}
          </Button>
          {sendenKnopf}
          <Tooltip label="Übung schliessen">
            <IconButton icon={X} label="Übung schliessen" onClick={inSpalte.onSchliessen} />
          </Tooltip>
        </div>
      )}

      {/* Der Name ist die Überschrift der Maske — dasselbe Kopf-Feld wie der
          Trainingsname im Editor. Die echte Überschrift setzt die Seite.
          Beim Bearbeiten steht das Speichern rechts daneben (PO 2026-10-02):
          Die Spalten darunter scrollen, der Kopf bleibt — so ist es immer zur
          Hand. Ist es zu eng, bricht es unter den Namen. */}
      <div
        className={cn(
          UEBER_BEIDEN,
          geteilt && "flex flex-wrap items-start justify-end gap-x-6 gap-y-3",
        )}
      >
        <div className={cn(geteilt && "min-w-64 flex-1")}>
          <HeadlineField
            aria-label="Name der Übung"
            schrift="title"
            name="name"
            placeholder="Name der Übung"
            defaultValue={initial.name}
            required
            error={!!err.name}
            aria-describedby={err.name ? "name-fehler" : undefined}
          />
          {err.name && (
            <p id="name-fehler" className="type-body-small mt-1.5 text-error">
              {err.name}
            </p>
          )}
        </div>
        {geteilt && speichern}
      </div>

      {inSpalte ? (
        <>
          {diagrammAbschnitt}
          {beschreibungAbschnitt}
          {einordnung}
          {fotoAbschnitt}
          {fussnote && <p className="type-body-small text-on-surface-mittel">{fussnote}</p>}
        </>
      ) : geteilt ? (
        // Links der Inhalt — Bild, Ablauf, Foto —, rechts die Einordnung.
        <ZweiSpalten
          spalte={einordnung}
          spalteZuerst
          beiseite={false}
          className="xl:min-h-0 xl:flex-1"
        >
          <div className="flex flex-col gap-10">
            {diagrammAbschnitt}
            {beschreibungAbschnitt}
            {fotoAbschnitt}
          </div>
        </ZweiSpalten>
      ) : (
        <>
          {einordnungAbschnitt}
          {diagrammAbschnitt}
          {beschreibungAbschnitt}
          {materialAbschnitt}
          {fotoAbschnitt}
          <div className="flex items-center gap-3 border-t border-linie pt-5">{speichern}</div>
        </>
      )}
    </form>
  );
}
