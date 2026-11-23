"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { oeffentlicherOrigin } from "@/lib/origin";
import { sichererRuecksprung } from "@/lib/weiterleitung";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";
import { eigeneBildPfade } from "@/lib/fassung";
import { loescheKonto } from "@/lib/kern/verein";
import { raeumeVerwaisteBilder } from "@/lib/storage-aufraeumen";
import { revalidiereMitgliedschaften, revalidiereVerein } from "@/lib/revalidate";
import {
  KONTO_LOESCHEN_TEXT,
  VEREIN_MELDUNG,
  kontoEinzigePersonInzwischenText,
  vereinHeisstInzwischenText,
} from "@/lib/verein";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;

export type AuthState = {
  status: "idle" | "error" | "confirm" | "reset-sent" | "needs-confirmation";
  message?: string;
  email?: string;
};

/** Login per E-Mail + Passwort (Story 5). */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // Dieselbe Prüfung wie auf der Login-Seite: Das Formularfeld lässt sich
  // auch ohne die Seite befüllen (#142, offene Weiterleitung).
  const next = sichererRuecksprung(formData.get("redirect"));

  if (!EMAIL_RE.test(email) || password.length === 0) {
    return { status: "error", message: "Bitte E-Mail und Passwort eingeben.", email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const notConfirmed =
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("not confirmed");
    // Eigener Status, damit die UI gezielt einen „erneut senden"-Button zeigen
    // kann (statt brüchigem String-Matching auf der Fehlermeldung).
    if (notConfirmed) return { status: "needs-confirmation", email };
    return { status: "error", email, message: "E-Mail oder Passwort ist falsch." };
  }
  redirect(next);
}

/** Registrierung. Zeigt IMMER den Bestätigungs-Screen (Supabase obfuskiert
 *  existierende Adressen -> Anti-Enumeration). */
export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  if (password.length < MIN_PW) {
    return { status: "error", message: `Das Passwort muss mindestens ${MIN_PW} Zeichen haben.`, email };
  }
  if (password !== confirm) {
    return { status: "error", message: "Die Passwörter stimmen nicht überein.", email };
  }

  const origin = await oeffentlicherOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    const weak = error.code === "weak_password";
    return {
      status: "error",
      email,
      message: weak
        ? `Das Passwort muss mindestens ${MIN_PW} Zeichen haben.`
        : "Registrierung fehlgeschlagen. Bitte später erneut versuchen.",
    };
  }
  return { status: "confirm", email };
}

/** Bestätigungsmail erneut senden (für „E-Mail noch nicht bestätigt"). */
export async function resendConfirmation(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) return { status: "error", message: "Ungültige E-Mail-Adresse." };
  const origin = await oeffentlicherOrigin();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  return { status: "confirm", email };
}

/** Passwort-Reset anfordern. Antwort IMMER neutral (Anti-Enumeration). */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }
  const origin = await oeffentlicherOrigin();
  const supabase = await createClient();
  // Fehler bewusst nicht durchreichen.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });
  return { status: "reset-sent", email };
}

/** Neues Passwort setzen (nutzt die aktive Recovery-Session). */
export async function setNewPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PW) {
    return { status: "error", message: `Das Passwort muss mindestens ${MIN_PW} Zeichen haben.` };
  }
  if (password !== confirm) {
    return { status: "error", message: "Die Passwörter stimmen nicht überein." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const same = error.code === "same_password";
    return {
      status: "error",
      message: same
        ? "Bitte ein neues, anderes Passwort wählen."
        : "Passwort konnte nicht gesetzt werden. Fordere den Link neu an.",
    };
  }
  redirect("/konto");
}

/** Abmelden (Story 5 EK3) und zurück zur Startseite. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/** Der Zustand des Dialogs «Konto löschen»: `fehler` ist der Klartext, wenn das
 *  Konto bleibt — sonst `null`. Gelingt das Löschen, leitet die Action weiter.
 *
 *  - `letzteVerwaltung`: Das Konto ist die letzte Person der Verwaltung, und
 *    dem Verein gehören weitere an (#577, #587 AK 13): Dort führt der Dialog zur
 *    Verwaltung, statt es erneut versuchen zu lassen.
 *  - `verein`: Das Konto ist inzwischen die einzige Person im Verein, der
 *    Dialog verlangt jetzt dessen Namen (Zahlen aus der Datenebene).
 *  - `aktuellerName`: Der Vereinsname stimmte nicht mehr; der Dialog zeigt
 *    jetzt diesen. */
export type KontoLoeschenZustand = {
  fehler: string | null;
  letzteVerwaltung?: boolean;
  verein?: { name: string; teams: number; spieler: number };
  aktuellerName?: string;
};

/** Konto löschen (Story 9, #587). Öffentliche Übungen bleiben anonymisiert
 *  erhalten, private werden samt Feld-Diagramm gelöscht, danach der Auth-User.
 *  Teams bleiben bestehen, auch wenn das Konto ihr letztes Mitglied war (#581).
 *  Ist das Konto die einzige Person eines Vereins, verschwindet der Verein mit
 *  ihm — aber nur mit dem eingegebenen Vereinsnamen (`vereinsname`, sonst
 *  `null`): Die Datenebene prüft ihn beim Ausführen selbst und antwortet
 *  sonst, ohne etwas anzufassen (`verein_bestaetigen`, `vereinsname_falsch`).
 *  Die letzte Verwaltung eines Vereins mit weiteren Personen löscht ihr Konto
 *  nicht (`letzte_verwaltung`).
 *
 *  Reihenfolge: Datenebene → Bilder → Anmeldung. Scheitert das Entfernen der
 *  Anmeldung, nachdem die Datenebene gelöscht hat, bleibt das Konto leer
 *  zurück und angemeldet; ein zweiter Versuch geht durch (`teilweise`). */
export async function deleteAccount(vereinsname: string | null): Promise<KontoLoeschenZustand> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Du bist nicht angemeldet." };
  const uid = user.id;

  // Bildpfade der privaten Übungen VOR dem Löschen merken (öffentliche bleiben
  // anonymisiert erhalten, ihre Bilder ebenso).
  const { data: priv } = await supabase
    .from("exercises")
    .select("bild_url")
    .eq("owner_id", uid)
    .eq("visibility", "private");

  // Dasselbe für die Fassungen in den privaten Trainings: sie tragen eigene
  // Bildkopien, und die Kaskade der Konto-Löschung entfernt nur die Zeilen
  // (Story 3 AK 13). Öffentliche Trainings bleiben anonymisiert erhalten —
  // ihre Bilder müssen bleiben.
  const { data: fassungen } = await supabase
    .from("training_exercises")
    .select("id, bild_url, trainings!inner ( owner_id, visibility )")
    .eq("trainings.owner_id", uid)
    .eq("trainings.visibility", "private");

  // Gelöscht wird nur die eigene Bildkopie der Fassung (Dateiname = ihre ID),
  // nie eine Datei, auf die eine bild_url sonst noch zeigen könnte — derselbe
  // Guard wie in allen anderen Löschwegen.
  const paths = [
    ...(priv ?? []).map((p) => bildUrlToPath(p.bild_url)).filter((p): p is string => !!p),
    ...eigeneBildPfade(fassungen ?? []),
  ];

  // Daten-Teil: anonymisiert öffentliche, löscht private Übungen + eigene
  // Trainings und, als einzige Person, den Verein.
  const r = await loescheKonto(supabase, uid, { vereinsname });
  if (!r.ok) return { fehler: r.meldung };
  const a = r.wert;
  if (a.status === "letzte_verwaltung")
    return {
      fehler: vereinsname?.trim() ? KONTO_LOESCHEN_TEXT.weiterePerson : VEREIN_MELDUNG.LETZTE_VERWALTUNG,
      letzteVerwaltung: true,
    };
  if (a.status === "verein_bestaetigen")
    return {
      fehler: kontoEinzigePersonInzwischenText(a.verein),
      verein: { name: a.verein, teams: a.teams, spieler: a.spieler },
    };
  if (a.status === "vereinsname_falsch")
    return { fehler: vereinHeisstInzwischenText(a.name, "konto"), aktuellerName: a.name };

  // Erst nach erfolgreichem RPC die verwaisten Bilder entfernen: die eigenen
  // mit der Sitzung, die des Vereins (Team-Trainings) mit dem Nachlauf — mit
  // dem Verein erlischt das Recht daran. Vor dem Entfernen der Anmeldung.
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  await raeumeVerwaisteBilder(eigeneBildPfade(a.bilder));

  // Die Anmeldung zuerst entfernen: Scheitert es, ist der Nutzer noch angemeldet
  // und kann es noch einmal versuchen.
  const { error: loeschFehler } = await createAdminClient().auth.admin.deleteUser(uid);
  if (loeschFehler) {
    console.error("[konto] Anmeldung entfernen", loeschFehler);
    // Die Daten sind weg, ein Verein womöglich mit: Leiste und Seiten sollen ihn
    // nicht weiter zeigen.
    revalidiereVerein();
    revalidiereMitgliedschaften();
    return { fehler: KONTO_LOESCHEN_TEXT.teilweise };
  }

  // Session-Cookies löschen (Best Effort): Das Konto ist weg, ein Fehlschlag
  // darf die Weiterleitung nicht blockieren; Cookies werden spätestens beim
  // nächsten getUser invalidiert.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignorieren */
  }

  revalidatePath("/");
  redirect("/?account_deleted=1");
}
