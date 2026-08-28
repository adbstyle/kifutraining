"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { STORED_IMAGE_TYPES, storedImageError } from "@/lib/image";
import { parseUebungsInhalt } from "@/lib/uebung-form";
import type { ExerciseFormState } from "@/lib/actions/exercises";
import { parseDiagramm, MAX_ELEMENTE, type DiagrammData } from "@/lib/diagramm";
import {
  fassungUnvollstaendig,
  kopiereBild,
  userOrdner,
  kopiereDiagrammVon,
  entferneStorageObjekt,
  inhaltFelder,
  istEigeneFassungsDatei,
} from "@/lib/fassung";
import { revalidiereTraining } from "@/lib/revalidate";
import { TRAININGSTEIL_SLUGS } from "@/lib/training";
import { abbildungJuniorenZuKifu, NACHARBEIT } from "@/lib/junioren";
import { junioren_heimatSlugs } from "@/lib/vocab";
import { userSlug } from "@/lib/slug";
import { bearbeitungszielVon, bildOrdnerFuer } from "@/lib/training-zugriff";
import { fehlerMeldung } from "@/lib/training-bedingungen";

export type SaveFassungResult = { ok: true } | { ok: false; error: string };

/** Die Fassung samt ihrem Training laden und das Schreibrecht prüfen. Die RLS
 *  setzt es ohnehin durch; hier geht es um eine klare Meldung statt eines
 *  stillen Nulltreffers. */
async function ladeFassung(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fassungId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("training_exercises")
    .select(
      "id, training_id, trainingsteil, hauptteilkategorie, position, bild_url, bild_quelle, diagramm, trainings ( owner_id, team_id )",
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!data) return null;
  const training = data.trainings as unknown as {
    owner_id: string | null;
    team_id: string | null;
  } | null;
  if (!training) return null;

  // Die Zeile ist bereits geladen — die Bearbeitungsregel kommt aus der
  // gemeinsamen Quelle, statt sie hier ein zweites Mal zu formulieren.
  const ziel = bearbeitungszielVon(training, userId);
  return ziel ? { ...data, ziel } : null;
}

/** Die nächste freie Position im Zielabschnitt. Eine umgeordnete Fassung reiht
 *  sich am Ende ein (Story 5 AK 7). */
async function naechstePosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  trainingId: string,
  trainingsteil: string,
  hauptteilkategorie: string | null,
  eigeneId: string,
): Promise<number> {
  let q = supabase
    .from("training_exercises")
    .select("position")
    .eq("training_id", trainingId)
    .eq("trainingsteil", trainingsteil)
    .neq("id", eigeneId);
  q = hauptteilkategorie ? q.eq("hauptteilkategorie", hauptteilkategorie) : q;
  const { data } = await q.order("position", { ascending: false }).limit(1).maybeSingle();
  return (data?.position ?? -1) + 1;
}

/** Eine Fassung im Training bearbeiten (Story 5).
 *
 *  Es gelten dieselben Inhalts- und Vollständigkeitsregeln wie für eine
 *  Bibliotheks-Übung (NFR 1) — deshalb dieselbe Parse-Funktion. Geschrieben wird
 *  ausschliesslich an dieser Fassung; die Vorlage und andere Fassungen bleiben
 *  unberührt. */
export async function updateFassung(
  fassungId: string,
  _prev: ExerciseFormState,
  form: FormData,
): Promise<ExerciseFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Nicht angemeldet." };

  const fassung = await ladeFassung(supabase, fassungId, user.id);
  if (!fassung) return { status: "error", message: "Übung nicht gefunden." };

  const parsed = parseUebungsInhalt(form);
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const inhalt = parsed.row;

  // Trainingsteil und Kategorie hat parseUebungsInhalt bereits gegen das
  // Vokabular geprüft — hier nur noch als Werte gebraucht.
  const trainingsteil = String(inhalt.trainingsteil);
  const hkat = (inhalt.hauptteilkategorie as string | null) ?? null;

  const update: Record<string, unknown> = { ...inhalt };

  // Einordnungswechsel: die Fassung wandert ans Ende ihres neuen Abschnitts.
  // Die Kategorie ausserhalb des Hauptteils ist in `inhalt` bereits null —
  // einen DB-Trigger, der das erzwänge, gibt es seit dem Verweis-Abbau nicht
  // mehr, nur noch den Biconditional-CHECK.
  const wechsel =
    trainingsteil !== fassung.trainingsteil || hkat !== fassung.hauptteilkategorie;
  if (wechsel) {
    update.position = await naechstePosition(
      supabase,
      fassung.training_id,
      trainingsteil,
      trainingsteil === "hauptteil" ? hkat : null,
      fassungId,
    );
    // Die Konserve des Schema-Wechsels verfällt: sie gilt nur für Fassungen,
    // die seit der Übertragung unangetastet blieben. Sonst spränge eine von
    // Hand umgehängte Fassung beim Rückwechsel auf ihren alten Platz zurück
    // und die Handänderung ginge verloren (Epic #71).
    update.einordnung_vorher = null;
    update.hauptteilkategorie_vorher = null;
  }

  // Bild: ersetzen (neue Datei) oder entfernen (Schalter). Beides wirkt erst
  // beim Speichern; die alte Datei fällt erst nach erfolgreichem Schreiben.
  const datei = form.get("bild");
  const neuesBild = datei instanceof File && datei.size > 0;
  const entfernen = String(form.get("bild_entfernen") ?? "") === "1";
  const altPfad = bildUrlToPath(fassung.bild_url);
  let neuPfad: string | null = null;


  if (neuesBild) {
    const invalid = storedImageError(datei.type, datei.size);
    if (invalid) return { status: "error", errors: { bild: invalid } };
    // Bei Team-Trainings in den Team-Ordner, damit jedes Mitglied das Bild
    // ersetzen darf (Story 6 NFR 2). Dateiname = Fassungs-ID, wie überall.
    neuPfad = `${bildOrdnerFuer(fassung.ziel)}/${fassungId}.${STORED_IMAGE_TYPES[datei.type]}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(neuPfad, new Uint8Array(await datei.arrayBuffer()), {
        contentType: datei.type,
        upsert: true,
      });
    if (error) return { status: "error", errors: { bild: error.message } };
    update.bild_url = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(neuPfad).data.publicUrl;
    update.bild_quelle = "foto";
  } else if (entfernen) {
    update.bild_url = null;
    // Ohne Foto kann die Anzeige nicht mehr darauf zeigen; ein vorhandenes
    // Diagramm wird zum aktiven Bild.
    update.bild_quelle = fassung.diagramm ? "diagramm" : null;
  }

  const { error } = await supabase
    .from("training_exercises")
    .update(update)
    .eq("id", fassungId);

  if (error) {
    // Ein soeben hochgeladenes Bild wieder entfernen — ausser es hat den
    // weiterhin referenzierten alten Pfad überschrieben.
    if (neuPfad && neuPfad !== altPfad)
      await supabase.storage.from(STORAGE_BUCKET).remove([neuPfad]);
    // Wechselt die Einordnung so, dass ein öffentliches Training seine
    // Bedingungen verlöre, weist die Datenebene ab; die Meldung nennt den Weg
    // über den Entwurfszustand (Story A AK 7).
    return { status: "error", message: fehlerMeldung(error.message) };
  }

  // Erfolg: die alte Datei entfernen, wenn sie nicht mehr referenziert wird —
  // aber nur die eigene Kopie der Fassung, nie eine fremde oder geteilte Datei.
  if (
    altPfad &&
    altPfad !== neuPfad &&
    (neuesBild || entfernen) &&
    istEigeneFassungsDatei(altPfad, fassungId)
  )
    await supabase.storage.from(STORAGE_BUCKET).remove([altPfad]);

  revalidiereTraining(fassung.training_id, fassungId);
  redirect(`/training/${fassung.training_id}/edit?bearbeitet=1`);
}

/** Eine Fassung als eigene, zunächst private Vorlage in die Bibliothek
 *  übernehmen (Story 7).
 *
 *  Zulässig ist jede für den USER sichtbare Fassung — auch aus einem fremden
 *  öffentlichen Training. Es entsteht eine gewöhnliche Trainer-Übung mit eigener
 *  Bild- und Diagrammkopie; eine Verknüpfung zur Fassung gibt es nicht, spätere
 *  Änderungen wirken in keine Richtung. */
export async function uebernehmeInBibliothek(
  fassungId: string,
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  // RLS lässt Fassungen eigener und öffentlicher Trainings durch.
  const { data: f } = await supabase
    .from("training_exercises")
    .select(
      `name, trainingsteil, hauptteilkategorie, kategorien, erscheinungsform, feldtyp,
       anzahl_kinder, material, methodischer_fahrplan, aufbau, varianten,
       bild_url, bild_quelle, diagramm`,
    )
    .eq("id", fassungId)
    .maybeSingle();
  if (!f) return { ok: false, error: "Diese Übung ist nicht mehr verfügbar." };

  const mangel = fassungUnvollstaendig(f);
  if (mangel) return { ok: false, error: mangel };

  // Die Einordnung im Training ist nicht zwingend eine gültige Heimat für die
  // Bibliothek: ein Junioren-Block wie «Spielformen und unterstützende
  // Übungen» existiert dort nicht. Die Heimat folgt darum der Abbildungsregel
  // zurück — die drei Einstiegs-Unterblöcke sind selbst Heimaten und bleiben
  // wie sie sind (Entscheidungsdokument §4).
  const heimat = heimatAusEinordnung(f.trainingsteil, f.hauptteilkategorie);
  if (!heimat)
    return {
      ok: false,
      error: "Ordne die Übung zuerst einem Block zu, bevor du sie übernimmst.",
    };

  // ID vorab: sie benennt die Bildkopie, die vor dem Insert liegen muss.
  const uebungId = crypto.randomUUID();
  const bild = await kopiereBild(supabase, f.bild_url, userOrdner(user.id), uebungId);
  if (bild.error) return { ok: false, error: bild.error };

  const { data: angelegt, error } = await supabase
    .from("exercises")
    .insert({
      id: uebungId,
      slug: userSlug(f.name!),
      trainingsteil: heimat.trainingsteil,
      hauptteilkategorie: heimat.hauptteilkategorie,
      ...inhaltFelder(f),
      bild_url: bild.url,
      diagramm: kopiereDiagrammVon(f.diagramm),
      source: "user",
      owner_id: user.id,
      // Zunächst privat (PO-Entscheid): veröffentlicht wird bewusst separat.
      visibility: "private",
    })
    .select("slug")
    .single();

  if (error || !angelegt) {
    await entferneStorageObjekt(supabase, bild.pfad);
    return { ok: false, error: error?.message ?? "Übernehmen fehlgeschlagen." };
  }

  revalidatePath("/");
  return { ok: true, slug: angelegt.slug };
}

/** Das Diagramm einer Fassung speichern — das Pendant zu `saveDiagramm` für
 *  Bibliotheks-Übungen, nur dass das Schreibrecht am Training hängt. */
export async function saveFassungDiagramm(
  fassungId: string,
  data: DiagrammData,
): Promise<SaveFassungResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const fassung = await ladeFassung(supabase, fassungId, user.id);
  if (!fassung) return { ok: false, error: "Übung nicht gefunden." };

  const diagramm = parseDiagramm(data);
  if (!diagramm || diagramm.elemente.length > MAX_ELEMENTE)
    return { ok: false, error: "Ungültiges Diagramm." };

  // bild_quelle konsistent mitführen: das erste Element macht das Diagramm zum
  // aktiven Bild; wird es geleert, fällt die Wahl zurück.
  const leer = diagramm.elemente.length === 0;
  const bild_quelle = leer
    ? fassung.bild_quelle === "diagramm"
      ? fassung.bild_url
        ? "foto"
        : null
      : fassung.bild_quelle
    : (fassung.bild_quelle ?? "diagramm");

  const { error } = await supabase
    .from("training_exercises")
    .update({ diagramm, bild_quelle })
    .eq("id", fassungId);
  if (error) return { ok: false, error: error.message };

  revalidiereTraining(fassung.training_id, fassungId);
  return { ok: true };
}

/** Einordnung einer Fassung im Training → Heimat der neuen Bibliotheks-Übung.
 *  `null`, wenn die Fassung in der Nacharbeit liegt: dort hat sie gerade
 *  keinen Platz, und eine Heimat liesse sich nur raten. */
function heimatAusEinordnung(
  einordnung: string,
  hauptteilkategorie: string | null,
): { trainingsteil: string; hauptteilkategorie: string | null } | null {
  // Kinderfussball-Teile und die drei Junioren-Heimaten sind selbst Heimaten.
  if (
    (TRAININGSTEIL_SLUGS as readonly string[]).includes(einordnung) ||
    (junioren_heimatSlugs as readonly string[]).includes(einordnung)
  )
    return { trainingsteil: einordnung, hauptteilkategorie };
  const rueck = abbildungJuniorenZuKifu(einordnung);
  return rueck === NACHARBEIT ? null : rueck;
}
