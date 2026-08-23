"use client";

import { useState, useActionState, startTransition } from "react";
import { Save } from "lucide-react";
import {
  TextField,
  TextArea,
  Select,
  FilterChip,
  Button,
  SegmentedControl,
} from "@/components/ui";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import {
  trainingsteil as teilLabels,
  feldtyp as feldLabels,
  erscheinungsform as formLabels,
  hauptteilkategorie as hkatLabels,
  kategorienSlugs,
  trainingsteilSlugs,
  type TrainingsteilSlug,
} from "@/lib/vocab";
import {
  kategorieStufe,
  FAHRPLAN_TEILE,
  FREIES_SPIEL,
  brauchtFahrplan,
  ueberfuehreAblauf,
} from "@/lib/labels";
import { inputImageError, IMAGE_ACCEPT } from "@/lib/image";
import { compressImage } from "@/lib/image-compress";

export type ExerciseInitial = {
  name?: string;
  trainingsteil?: string;
  kategorien?: string[];
  feldtyp?: string | null;
  erscheinungsform?: string[];
  hauptteilkategorie?: string | null;
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
  submitLabel,
  afterName,
  bildEntfernenMoeglich = false,
  fussnote = "Neue Übungen sind zunächst privat (Entwurf).",
}: {
  action: (state: ExerciseFormState, form: FormData) => Promise<ExerciseFormState>;
  initial?: ExerciseInitial;
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

  const [teil, setTeil] = useState<string>(initial.trainingsteil ?? "");
  const [kat, setKat] = useState<string[]>(initial.kategorien ?? []);
  const [form, setForm] = useState<string[]>(initial.erscheinungsform ?? []);
  const [feld, setFeld] = useState<string>(initial.feldtyp ?? "");
  const [hkat, setHkat] = useState<string>(initial.hauptteilkategorie ?? "");
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

  const istFahrplan = brauchtFahrplan(teil, hkat);
  // Hauptteilkategorie ist genau bei Hauptteil-Übungen Pflicht (Enabler #21).
  const istHauptteil = teil === "hauptteil";
  // Das freie Spiel trägt eine Beschreibung statt des Fahrplans (Story 2).
  const istFreiesSpiel = istHauptteil && hkat === FREIES_SPIEL;
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  /** Einordnung wechseln und den bisherigen Ablauftext als Ausgangstext in die
   *  neue Form überführen (Story 2 AK 3) — redigiert wird von Hand. */
  function wechsleEinordnung(neuerTeil: string, neueHkat: string) {
    const nachher = brauchtFahrplan(neuerTeil, neueHkat);
    if (brauchtFahrplan(teil, hkat) !== nachher) {
      const neu = ueberfuehreAblauf(nachher, { offenStarten, ueben, wetteifern, aufbau });
      setOffenStarten(neu.offenStarten);
      setUeben(neu.ueben);
      setWetteifern(neu.wetteifern);
      setAufbau(neu.aufbau);
    }
    setTeil(neuerTeil);
    setHkat(neueHkat);
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
    fd.set("trainingsteil", teil);
    fd.set("kat", kat.join(","));
    // Erscheinungsform hängt am Trainingsteil, nicht an der Ablauf-Form: auch
    // das freie Spiel darf eine tragen (DB-Constraint).
    fd.set("form", FAHRPLAN_TEILE.has(teil) ? form.join(",") : "");
    fd.set("hauptteilkategorie", istHauptteil ? hkat : "");
    fd.set("feldtyp", feld);
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

      <TextField
        label="Name der Übung"
        name="name"
        defaultValue={initial.name}
        required
        error={!!err.name}
        supportingText={err.name ?? "Pflichtfeld"}
      />

      {afterName}

      <div>
        <p className={`type-label-small mb-2 ${err.trainingsteil ? "text-error" : "text-on-surface-variant"}`}>
          Trainingsteil
        </p>
        <SegmentedControl<TrainingsteilSlug>
          ariaLabel="Trainingsteil"
          value={(teil || null) as TrainingsteilSlug | null}
          onChange={(v) => wechsleEinordnung(v, hkat)}
          options={trainingsteilSlugs.map((t) => ({ value: t, label: teilLabels[t] }))}
        />
        {err.trainingsteil && <p className="type-body-small mt-1.5 text-error">{err.trainingsteil}</p>}
      </div>

      <Group title="Alterskategorie" error={err.kat}>
        {kategorienSlugs.map((k) => (
          <FilterChip key={k} selected={kat.includes(k)} onClick={() => toggle(kat, setKat, k)}>
            <span title={kategorieStufe[k]}>{k}</span>
          </FilterChip>
        ))}
      </Group>

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
            supportingText={err.ueben ?? "Pflichtfeld — mindestens ein Schritt, einer pro Zeile."}
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

      {istHauptteil && (
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

      {FAHRPLAN_TEILE.has(teil) && (
        <Group title="Erscheinungsform (optional)">
          {(Object.keys(formLabels) as (keyof typeof formLabels)[]).map((f) => (
            <FilterChip key={f} selected={form.includes(f)} onClick={() => toggle(form, setForm, f)}>
              {formLabels[f]}
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
          {isCompressing ? "Bild wird optimiert …" : isPending ? "Wird gespeichert …" : submitLabel}
        </Button>
        {fussnote && (
          <p className="type-body-small text-on-surface-variant">{fussnote}</p>
        )}
      </div>
    </form>
  );
}
