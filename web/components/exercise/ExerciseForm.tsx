"use client";

import { useState, useActionState, startTransition } from "react";
import { ArrowLeftRight, Save } from "lucide-react";
import {
  TextField,
  TextArea,
  Select,
  FilterChip,
  Button,
  AltersstufeField,
} from "@/components/ui";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import {
  feldtyp as feldLabels,
  hauptteilkategorie as hkatLabels,
  uebungstyp as uebungstypLabels,
  uebungstypSlugs,
} from "@/lib/vocab";
import {
  kategorieStufe,
  UEBUNGSTYP_DEFINITION,
  ERSCHEINUNGSFORM_LABEL,
  ueberfuehreAblauf,
} from "@/lib/labels";
import {
  FREIES_SPIEL,
  andereAltersstufe,
  brauchtFahrplan,
  einordnungenFuer,
  erscheinungsformenFuer,
  kategorienFuer,
  teilDerEinordnung,
  traegtErscheinungsform,
  traegtFeldtyp,
  traegtHauptteilkategorie,
  traegtSpielfeldgroesse,
  traegtUebungstyp,
  type Altersstufe,
} from "@/lib/altersstufe";
import { altersstufe as altersstufeLabels } from "@/lib/vocab";
import { EinordnungField } from "@/components/exercise/EinordnungField";
import { UmwandelnDialog, type Umwandlung } from "@/components/exercise/UmwandelnDialog";
import { SpielfeldgroesseField } from "@/components/exercise/SpielfeldgroesseField";
import { inputImageError, IMAGE_ACCEPT } from "@/lib/image";
import { compressImage } from "@/lib/image-compress";

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
  material?: string[];
  methodischer_fahrplan?: {
    offen_starten?: string;
    ueben?: string[];
    wetteifern?: string | null;
  } | null;
  aufbau?: string | null;
  varianten?: string[];
  bildUrl?: string | null;
};

function Group({ title, error, children }: { title: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={`type-label-small mb-2 ${error ? "text-error" : "text-on-surface-variant"}`}>
        {title}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <p className="type-body-small mt-1.5 text-error">{error}</p>}
    </div>
  );
}


export function ExerciseForm({
  action,
  initial = {},
  altersstufe: initialeStufe,
  stufenWahl,
  kontext,
  ueberfuehrbar = false,
  submitLabel,
  afterName,
  bildEntfernenMoeglich = false,
  fussnote = "Neue Übungen sind zunächst privat (Entwurf).",
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
  /** Optionaler Slot direkt unter dem Namensfeld (z. B. die Diagramm-Vorschau). */
  afterName?: React.ReactNode;
  /** Erlaubt, das vorhandene Bild ohne Ersatz zu entfernen (Fassungen, Story 5). */
  bildEntfernenMoeglich?: boolean;
  /** Hinweis neben der Speichern-Schaltfläche. */
  fussnote?: React.ReactNode;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as ExerciseFormState);
  const err = state.errors ?? {};

  const [stufe, setStufe] = useState<Altersstufe>(initialeStufe);
  const [teil, setTeil] = useState<string>(initial.trainingsteil ?? "");
  // Nur Anzeige-Navigation im Juniorenschema: welcher Trainingsteil
  // aufgeschlagen ist. Gespeichert wird immer die Einordnung selbst.
  const [offenerTeil, setOffenerTeil] = useState<string>(
    teilDerEinordnung(initialeStufe, initial.trainingsteil ?? ""),
  );
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

  // Das Feld-Gating kommt geschlossen aus lib/altersstufe.ts — derselben
  // Quelle, gegen die die Server Action prüft und die die DB-CHECKs spiegelt.
  // Weicht das Formular davon ab, verlangt es entweder ein Feld, das der Server
  // verwirft, oder es verschweigt eines, das er einfordert.
  const istFahrplan = brauchtFahrplan(stufe, teil, hkat);
  const zeigtHkat = traegtHauptteilkategorie(stufe, teil);
  const zeigtForm = traegtErscheinungsform(stufe, teil);
  const zeigtTyp = traegtUebungstyp(stufe, teil);
  const zeigtFeldtyp = traegtFeldtyp(stufe);
  const zeigtSpielfeld = traegtSpielfeldgroesse(stufe);
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

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

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
    setOffenerTeil(teilDerEinordnung(stufe, neuerTeil));
    setHkat(neueHkat);
  }

  /** Im Juniorenschema den Trainingsteil aufschlagen. Er ist nicht selbst die
   *  Einordnung — gespeichert wird der Block. Damit Segment und Auswahl nie
   *  auseinanderlaufen (und das Formular nie still einen Block behält, den man
   *  gar nicht mehr sieht), zieht der Teilwechsel die Einordnung mit: liegt die
   *  bisherige in diesem Teil, bleibt sie; sonst gilt sein erster Block. */
  function wechsleTeil(neuerTeil: string) {
    const gruppe = einordnungenFuer(stufe).find((g) => g.teil === neuerTeil);
    if (!gruppe) return;
    if (gruppe.bloecke.length === 0) return wechsleEinordnung(neuerTeil, hkat);
    if (gruppe.bloecke.some((b) => b.slug === teil)) return setOffenerTeil(neuerTeil);
    wechsleEinordnung(gruppe.bloecke[0].slug, hkat);
  }

  /** Altersstufe wechseln — nur beim Erfassen möglich, an einer noch nicht
   *  gespeicherten Übung. Jedes stufenabhängige Feld beginnt leer: die beiden
   *  Manuals führen verschiedene Einordnungen, Alterskategorien,
   *  Erscheinungsformen und Ablaufformen, ein übernommener Wert wäre nie der
   *  richtige. Name, Material, Varianten, Anzahl Kinder und Bild sind
   *  lehrmittelunabhängig und bleiben stehen. */
  function wechsleAltersstufe(neu: Altersstufe) {
    setStufe(neu);
    setTeil("");
    setOffenerTeil(einordnungenFuer(neu)[0].teil);
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
   *  Erscheinungsformen, Übungstyp, Feldtyp bzw. Spielfeldgrösse. Titel, Bild,
   *  Diagramm, Anzahl Kinder, Material und Varianten bleiben unangetastet
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
    setOffenerTeil(teilDerEinordnung(u.altersstufe, u.einordnung));
    setHkat(u.hauptteilkategorie ?? "");
    setKat(u.kategorien);
    // Stufenfremde Angaben: die beiden Manuals führen getrennte Kataloge, und
    // Feldtyp und Spielfeldgrösse schliessen einander aus.
    setForm([]);
    setUebungstyp("");
    setFeld("");
    setLaenge("");
    setBreite("");
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
          "Das Bild konnte nicht verarbeitet werden. Bitte versuche es erneut oder wähle ein anderes Bild.",
        );
        return;
      } finally {
        setIsCompressing(false);
      }
    }

    setBildError(null);
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
    startTransition(() => formAction(fd));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-7">
      {state.message && (
        <p className="type-body-small rounded-[4px] border border-error/40 bg-error/10 p-3 text-on-surface">
          {state.message}
        </p>
      )}

      {/* Die Umwandlung ist vorgemerkt, nicht geschehen: Das Formular zeigt
          bereits die Zielstufe, die Übung liegt aber unverändert in der
          Datenbank (Story 4 PC 5). Der Hinweis sagt, was noch fehlt. */}
      {umwandlung && (
        <p className="type-body-small rounded-[4px] border border-primary/40 bg-primary/10 p-3 text-on-surface">
          Umwandlung vorgemerkt — sie wird mit «Umwandeln und speichern» wirksam.
        </p>
      )}

      <TextField
        label="Name der Übung"
        name="name"
        defaultValue={initial.name}
        required
        error={!!err.name}
        supportingText={err.name ?? "Pflichtfeld"}
      />

      {afterName}

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
              size="sm"
              onClick={() => setDialogOffen(true)}
            >
              <ArrowLeftRight size={18} strokeWidth={2} aria-hidden />
              In den {altersstufeLabels[andereAltersstufe(stufe)]} überführen
            </Button>
          )
        }
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

      {/* Die Einordnung liegt wieder offen statt in einem Auswahlmenü. Sie war
          eine Zeit lang ein Select, weil sieben Werte aus zwei Welten in einer
          Liste standen und keine Segmentleiste sie trug. Mit der Trennung der
          Altersstufen ist dieser Grund entfallen: Es sind nie mehr als vier
          Kinderfussball-Teile oder vier Junioren-Teile mit ihren Blöcken, und
          welche Einordnung gilt, entscheidet über die halbe Maske darunter —
          das gehört sichtbar, nicht eingeklappt (PO-Vorgabe 2026-08-30). */}
      <EinordnungField
        altersstufe={stufe}
        wert={teil}
        teil={offenerTeil}
        onTeilChange={wechsleTeil}
        onChange={(v) => wechsleEinordnung(v, hkat)}
        error={err.trainingsteil}
        supportingText={
          kontext === "fassung"
            ? "Wo die Übung in diesem Training liegt."
            : "Wo die Übung im Trainingsablauf ihren Platz hat."
        }
        hinweis={entfallHinweis}
      />

      <Group title="Alterskategorie" error={err.kat}>
        {kategorienFuer(stufe).map((k) => (
          <FilterChip key={k} selected={kat.includes(k)} onClick={() => toggle(kat, setKat, k)}>
            <span title={kategorieStufe[k as keyof typeof kategorieStufe]}>{k}</span>
          </FilterChip>
        ))}
      </Group>

      {zeigtFeldtyp && (
        <Select
          label="Feldtyp (optional)"
          className="max-w-xs"
          value={feld}
          onChange={setFeld}
          options={[
            { value: "", label: "— kein Feldtyp —" },
            ...(Object.keys(feldLabels) as (keyof typeof feldLabels)[]).map((t) => ({
              value: t,
              label: feldLabels[t],
            })),
          ]}
        />
      )}

      {zeigtSpielfeld && (
        <SpielfeldgroesseField
          laenge={laenge}
          breite={breite}
          onLaengeChange={setLaenge}
          onBreiteChange={setBreite}
          error={err.spielfeld}
        />
      )}

      {teil && (istFahrplan ? (
        <fieldset className="flex flex-col gap-5 rounded-[6px] border border-outline-variant p-5">
          <legend className="type-label-medium px-2 text-primary">Methodischer Fahrplan</legend>
          <TextArea
            label="① Offen starten"
            name="offen_starten"
            value={offenStarten}
            onChange={(e) => setOffenStarten(e.target.value)}
            error={!!err.offen_starten}
            supportingText={err.offen_starten ?? "Pflichtfeld — wie die Übung offen startet."}
          />
          <TextArea
            label="② Üben — ein Schritt pro Zeile"
            name="ueben"
            value={ueben}
            onChange={(e) => setUeben(e.target.value)}
            error={!!err.ueben}
            supportingText={
              err.ueben ?? "Pflichtfeld — mindestens ein Schritt, einer pro Zeile."
            }
          />
          <TextArea
            label="③ Wett-eifern"
            name="wetteifern"
            value={wetteifern}
            onChange={(e) => setWetteifern(e.target.value)}
            error={!!err.wetteifern}
            supportingText={err.wetteifern ?? "Pflichtfeld — der spielerische Wettkampf-Teil."}
          />
        </fieldset>
      ) : (
        <TextArea
          label={istFreiesSpiel ? "Beschreibung des Spiels" : "Aufbau / Beschreibung"}
          name="aufbau"
          value={aufbau}
          onChange={(e) => setAufbau(e.target.value)}
          error={!!err.aufbau}
          supportingText={
            err.aufbau ??
            (istFreiesSpiel
              ? "Pflichtfeld — wie das Spiel gespielt wird."
              : "Pflichtfeld — Aufbau und Ablauf der Übung.")
          }
        />
      ))}

      {zeigtHkat && (
        <div>
          <Select
            label="Hauptteilkategorie"
            className="max-w-xs"
            value={hkat}
            onChange={(v) => wechsleEinordnung(teil, v)}
            options={[
              { value: "", label: "— Kategorie wählen —" },
              ...(Object.keys(hkatLabels) as (keyof typeof hkatLabels)[]).map((k) => ({
                value: k,
                label: hkatLabels[k],
              })),
            ]}
          />
          <p className={`type-body-small mt-1.5 ${err.hauptteilkategorie ? "text-error" : "text-on-surface-variant"}`}>
            {err.hauptteilkategorie ?? "Pflichtfeld — der Trainingsinhalt des Hauptteils."}
          </p>
        </div>
      )}

      {/* Übungstyp: optionale Selbstauskunft des Junioren-Manuals, und nur in
          den Blöcken, in denen eine Spielform vorkommen kann. Die
          Kurzdefinition steht beim Zuweisen dabei — «Spielform» bezeichnet im
          Lehrmittel drei verschiedene Dinge (Story 9 AC 4). */}
      {zeigtTyp && (
        <div>
          <Select
            label="Übungstyp (optional)"
            value={uebungstyp}
            onChange={setUebungstyp}
            options={[
              { value: "", label: "— kein Übungstyp —" },
              ...uebungstypSlugs.map((t) => ({ value: t, label: uebungstypLabels[t] })),
            ]}
            supportingText={
              uebungstyp ? UEBUNGSTYP_DEFINITION[uebungstyp] : "Wie das Manual die Trainingsform einordnet."
            }
          />
        </div>
      )}

      {/* Die Erscheinungsformen des Manuals, dem diese Übung folgt — in der
          Reihenfolge ihrer Quelle. Eine Gruppierung nach Spielphasen hat der
          Product Owner bewusst abgelehnt (Story 12 Out of Scope 2). */}
      {zeigtForm && (
        <Group title="Erscheinungsform (optional)">
          {erscheinungsformenFuer(stufe).map((f) => (
            <FilterChip key={f} selected={form.includes(f)} onClick={() => toggle(form, setForm, f)}>
              {ERSCHEINUNGSFORM_LABEL[f] ?? f}
            </FilterChip>
          ))}
        </Group>
      )}

      <div>
        <p className={`type-label-small mb-2 ${err.anzahl_max ? "text-error" : "text-on-surface-variant"}`}>
          Anzahl Kinder
        </p>
        <div className="flex items-start gap-3 sm:max-w-sm">
          <TextField
            label="Minimum"
            name="anzahl_min"
            type="number"
            inputMode="numeric"
            min={1}
            className="flex-1"
            defaultValue={initial.anzahl_kinder?.min ?? undefined}
          />
          <span aria-hidden className="type-body-large flex h-14 items-center text-on-surface-variant">
            –
          </span>
          <TextField
            label="Maximum"
            name="anzahl_max"
            type="number"
            inputMode="numeric"
            min={1}
            className="flex-1"
            error={!!err.anzahl_max}
            defaultValue={initial.anzahl_kinder?.max ?? undefined}
          />
        </div>
        <p className={`type-body-small mt-1.5 ${err.anzahl_max ? "text-error" : "text-on-surface-variant"}`}>
          {err.anzahl_max ?? "Mindest- und Höchstzahl der Kinder, z. B. 4 bis 8. Leer lassen, wenn beliebig."}
        </p>
      </div>

      <TextArea label="Material (optional, eines pro Zeile)" name="material" defaultValue={initial.material?.join("\n")} />
      <TextArea label="Varianten (optional, eine pro Zeile)" name="varianten" defaultValue={initial.varianten?.join("\n")} />

      <div>
        <label htmlFor="bild" className="type-label-small mb-2 block text-on-surface-variant">
          Feld-Diagramm (optional)
        </label>
        <input
          id="bild"
          name="bild"
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={() => setBildError(null)}
          className="focus-ring type-body-medium block w-full rounded-(--field-shape) border-[1.5px] border-(--field-outline) text-on-surface-variant file:mr-4 file:border-0 file:bg-secondary-container file:px-4 file:py-2.5 file:font-mono file:text-xs file:uppercase file:tracking-wider file:text-on-secondary-container"
        />
        <p className={`type-body-small mt-1.5 ${err.bild || bildError ? "text-error" : "text-on-surface-variant"}`}>
          {err.bild ?? bildError ?? "JPG, PNG, WebP oder HEIC. Grosse Bilder werden automatisch verkleinert."}
        </p>
        {initial.bildUrl && !err.bild && !bildError && (
          <p className="type-body-small mt-1 text-on-surface-variant">
            {bildEntfernen
              ? "Das aktuelle Bild wird beim Speichern entfernt."
              : "Aktuelles Bild bleibt erhalten, wenn du keines hochlädst."}
          </p>
        )}
        {bildEntfernenMoeglich && initial.bildUrl && (
          <label className="mt-2 flex items-center gap-2 type-body-small text-on-surface-variant">
            <input
              type="checkbox"
              checked={bildEntfernen}
              onChange={(e) => setBildEntfernen(e.target.checked)}
              className="focus-ring h-4 w-4 accent-primary"
            />
            Bild entfernen
          </label>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-outline-variant pt-5">
        <Button type="submit" size="lg" disabled={isPending || isCompressing}>
          <Save size={20} strokeWidth={2} aria-hidden />
          {isCompressing
            ? "Bild wird optimiert …"
            : isPending
              ? "Wird gespeichert …"
              : umwandlung
                ? "Umwandeln und speichern"
                : submitLabel}
        </Button>
        {fussnote && (
          <p className="type-body-small text-on-surface-variant">{fussnote}</p>
        )}
      </div>
    </form>
  );
}
