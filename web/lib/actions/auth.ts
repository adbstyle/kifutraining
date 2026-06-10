"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PW = 8;

export type AuthState = {
  status: "idle" | "error" | "confirm" | "reset-sent" | "needs-confirmation";
  message?: string;
  email?: string;
};

/** Kanonischer Origin für Auth-Redirects. In Prod via APP_ORIGIN festnageln
 *  (gegen Host-Header-Spoofing); lokal aus den Request-Headern abgeleitet. */
async function appOrigin(): Promise<string> {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const h = await headers();
  const host = h.get("host") ?? "127.0.0.1:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function safeNext(raw: FormDataEntryValue | null): string {
  const v = String(raw ?? "/");
  return v.startsWith("/") ? v : "/";
}

/** Login per E-Mail + Passwort (Story 5). */
export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("redirect"));

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

  const origin = await appOrigin();
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
  const origin = await appOrigin();
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
  const origin = await appOrigin();
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

/** Konto löschen (Story 9). Öffentliche Übungen bleiben anonymisiert erhalten,
 *  private werden samt Feld-Diagramm gelöscht, danach der Auth-User. */
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const uid = user.id;

  // Bildpfade der privaten Übungen VOR dem Löschen merken (öffentliche bleiben
  // anonymisiert erhalten, ihre Bilder ebenso).
  const { data: priv } = await supabase
    .from("exercises")
    .select("bild_url")
    .eq("owner_id", uid)
    .eq("visibility", "private");
  const paths = (priv ?? [])
    .map((p) => bildUrlToPath(p.bild_url))
    .filter((p): p is string => !!p);

  // Daten-Teil: anonymisiert öffentliche, löscht private Übungen + eigene Trainings.
  const { error } = await supabase.rpc("delete_account");
  if (error) return;

  // Erst nach erfolgreichem RPC die verwaisten Diagramme entfernen.
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);

  // Session-Cookies löschen (Best Effort) — darf den unwiderruflichen
  // Auth-User-Löschschritt NICHT blockieren, falls signOut wirft.
  try {
    await supabase.auth.signOut();
  } catch {
    /* ignorieren: Cookies werden spätestens beim nächsten getUser invalidiert */
  }
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(uid);

  revalidatePath("/");
  redirect("/?account_deleted=1");
}
