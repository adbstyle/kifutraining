"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_BUCKET, bildUrlToPath } from "@/lib/storage";

export type MagicLinkState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kanonischer Origin für Auth-Redirects. In Prod via APP_ORIGIN festnageln
 *  (gegen Host-Header-Spoofing); lokal aus den Request-Headern abgeleitet. */
async function appOrigin(): Promise<string> {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN;
  const h = await headers();
  const host = h.get("host") ?? "127.0.0.1:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

/** Passwortloser Login/Registrierung per Magic Link (Story 5 EK1/EK2).
 *  shouldCreateUser=true -> derselbe Flow legt bei Bedarf das Konto an. */
export async function requestMagicLink(
  _prev: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  const redirectTo = String(formData.get("redirect") ?? "/");
  const next = redirectTo.startsWith("/") ? redirectTo : "/";

  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Bitte eine gültige E-Mail-Adresse eingeben." };
  }

  const origin = await appOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: true,
    },
  });

  if (error) return { status: "error", message: error.message };
  return { status: "sent", email };
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

  // Daten-Teil: anonymisiert öffentliche, löscht private Übungen + eigene Pläne.
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
