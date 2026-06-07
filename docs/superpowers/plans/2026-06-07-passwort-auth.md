# E-Mail/Passwort-Authentifizierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Magic-Link-Login durch E-Mail+Passwort-Auth mit Signup-Bestätigung und „Passwort vergessen" ersetzen.

**Architecture:** Supabase-native Auth (`signInWithPassword`/`signUp`/`resetPasswordForEmail`/`updateUser`). E-Mail-Links laufen über `token_hash`/`verifyOtp` (Route `/auth/confirm`) statt PKCE — geräteübergreifend stabil. Vier getrennte `(auth)`-Routen, je ein fokussiertes Server-Action + Client-Form. Alle `getUser()`-Aufrufe bleiben unverändert.

**Tech Stack:** Next.js 15 (App Router, Server Actions), `@supabase/ssr`, React 19 (`useActionState`/`useFormStatus`), Tailwind, Supabase CLI (lokal: Mailpit).

**Spec:** [docs/superpowers/specs/2026-06-07-passwort-auth-design.md](../specs/2026-06-07-passwort-auth-design.md) (Rev. 2)

**Testing-Hinweis:** `web/` hat **kein** JS-Test-Harness. Verifikation pro Task = `npm run typecheck`; Flows manuell gegen lokales Supabase + Mailpit (Task 10); optional Playwright-E2E (Task 11). Das entspricht der freigegebenen Spec (keine Unit-Tests für die dünnen Supabase-Passthrough-Actions).

**Branch:** `feature/passwort-auth` (bereits angelegt, enthält die Spec).

---

## File Structure

| Datei | Verantwortung | Aktion |
|---|---|---|
| `supabase/config.toml` | lokale Auth-Config (Confirm-Email, Passwort-Policy, Template-Pfade) | modify |
| `supabase/templates/confirmation.html` | Signup-Bestätigungsmail (DE, token_hash-Link) | create |
| `supabase/templates/recovery.html` | Passwort-Reset-Mail (DE, token_hash-Link) | create |
| `web/components/ui/PasswordField.tsx` | Passwortfeld mit Show/Hide-Toggle | create |
| `web/components/ui/index.ts` | Barrel-Export | modify |
| `web/app/styleguide/page.tsx` | PasswordField-Demo | modify |
| `web/lib/actions/auth.ts` | Server-Actions (login/register/reset/setNewPassword/resend) | rewrite |
| `web/app/auth/confirm/route.ts` | `verifyOtp`-Bestätigung (signup + recovery) | create |
| `web/app/(auth)/layout.tsx` | gemeinsame Auth-Shell (Back-Link + Zentrierung) | create |
| `web/app/(auth)/login/page.tsx` + `LoginForm.tsx` | Login | rewrite |
| `web/app/(auth)/registrieren/page.tsx` + `RegisterForm.tsx` | Registrierung | create |
| `web/app/(auth)/passwort-vergessen/page.tsx` + `ForgotPasswordForm.tsx` | Reset anfordern | create |
| `web/app/(auth)/passwort-neu/page.tsx` + `NewPasswordForm.tsx` | Neues Passwort setzen | create |

Befehle laufen aus `web/` (CLI via `--workdir ..`).

---

## Task 1: Lokale Supabase-Auth-Config + E-Mail-Templates

**Files:**
- Modify: `supabase/config.toml` (Abschnitt `[auth]` / `[auth.email]`)
- Create: `supabase/templates/confirmation.html`
- Create: `supabase/templates/recovery.html`

- [ ] **Step 1: Bestehende Werte in config.toml editieren (KEINE neuen Tabellen-Header!)**

> ⚠️ `[auth]`, `[auth.email]` und `[auth.rate_limit]` **existieren bereits** in `supabase/config.toml`.
> TOML verbietet doppelte Tabellen-Header — also **bestehende Zeilen ändern**, nichts duplizieren.

Drei bestehende Werte ändern:

```toml
# Zeile ~182, im bestehenden [auth]-Block:
minimum_password_length = 8        # war: 6

# Zeile ~199, im bestehenden [auth.rate_limit]-Block (Headroom fürs lokale Testen,
# sonst greift beim Durchspielen mehrerer Flows in Task 10 dasselbe Limit):
email_sent = 30                    # war: 2

# Zeile ~226, im bestehenden [auth.email]-Block:
enable_confirmations = true        # war: false
```

Und die zwei Template-Sub-Tabellen **neu hinzufügen** (die gibt es noch nicht — nur ein
auskommentiertes `[auth.email.template.invite]`-Beispiel). Ans Ende des `[auth.email]`-Abschnitts
(nach `otp_expiry`, vor dem auskommentierten `[auth.email.smtp]`):

```toml
[auth.email.template.confirmation]
subject = "Bestätige deine E-Mail-Adresse"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.recovery]
subject = "Passwort zurücksetzen"
content_path = "./supabase/templates/recovery.html"
```

- [ ] **Step 2: Bestätigungs-Template anlegen**

Create `supabase/templates/confirmation.html`:

```html
<h2>Willkommen bei KiFu</h2>
<p>Bestätige deine E-Mail-Adresse, um die Registrierung abzuschliessen:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/">
    E-Mail-Adresse bestätigen
  </a>
</p>
<p>Wenn du dich nicht registriert hast, ignoriere diese E-Mail einfach.</p>
```

- [ ] **Step 3: Recovery-Template anlegen**

Create `supabase/templates/recovery.html`:

```html
<h2>Passwort zurücksetzen</h2>
<p>Klicke auf den Link, um ein neues Passwort für dein KiFu-Konto zu setzen:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/passwort-neu">
    Neues Passwort setzen
  </a>
</p>
<p>Wenn du das nicht angefordert hast, ignoriere diese E-Mail.</p>
```

- [ ] **Step 4: Config validieren — Stack neu starten (NICHT nur db:reset)**

> `supabase db reset` lädt die **GoTrue-Auth-Config + Templates NICHT** neu (die werden nur bei
> `supabase start` gelesen). Deshalb den Stack stoppen und neu starten:

Run: `npm run db:stop && npm run db:start`
Expected: Stack fährt ohne Config-Parse-Fehler hoch (kein „duplicate key"/„duplicate table" zu
`[auth]`/`[auth.email]`). `npm run db:status` zeigt die Mailpit-URL. Confirmations sind jetzt aktiv.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml supabase/templates/confirmation.html supabase/templates/recovery.html
git commit -m "feat(auth): lokale Confirm-Email + versionierte DE-Mail-Templates (token_hash)"
```

---

## Task 2: PasswordField-UI-Komponente

**Files:**
- Create: `web/components/ui/PasswordField.tsx`
- Modify: `web/components/ui/index.ts`
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Komponente anlegen**

Create `web/components/ui/PasswordField.tsx` (wrappt `TextField`, blendet einen Show/Hide-Button über den rechten Rand der 56px-Inputzeile; `supportingText` bleibt darunter):

```tsx
"use client";

import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { TextField, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type" | "leadingIcon">;

/** Passwortfeld auf Basis von TextField mit Sichtbarkeits-Toggle.
 *  Der Toggle ist absolut an der rechten Kante der Inputzeile (h-14) verankert,
 *  damit er nicht mit dem darunterliegenden supportingText kollidiert. */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = useState(false);
    const Icon = show ? EyeOff : Eye;
    return (
      <div className={className}>
        <div className="relative">
          <TextField
            ref={ref}
            type={show ? "text" : "password"}
            className="[&_input]:pr-12"
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={show}
            className="focus-ring absolute right-2 top-0 flex h-14 items-center rounded-[3px] px-2 text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    );
  },
);
PasswordField.displayName = "PasswordField";
```

> Hinweis: `supportingText` des inneren TextField erscheint unter der Inputzeile — der Toggle (an `top-0 h-14`) überlappt ihn nicht. `[&_input]:pr-12` schafft rechts Platz fürs Auge-Icon.

- [ ] **Step 2: Export ergänzen**

Modify `web/components/ui/index.ts` — nach der `TextField`-Zeile einfügen:

```ts
export { PasswordField } from "./PasswordField";
export type { PasswordFieldProps } from "./PasswordField";
```

- [ ] **Step 3: Styleguide-Demo ergänzen**

Modify `web/app/styleguide/page.tsx`: Die bestehende `TextField`-Demo-Sektion suchen und unmittelbar danach eine analoge Demo einfügen (Import `PasswordField` oben ergänzen):

```tsx
<PasswordField label="Passwort" name="demo-pw" autoComplete="off"
  supportingText="Mit Auge-Icon ein-/ausblendbar." />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (keine TS-Fehler).

- [ ] **Step 5: Commit**

```bash
git add web/components/ui/PasswordField.tsx web/components/ui/index.ts web/app/styleguide/page.tsx
git commit -m "feat(ui): PasswordField mit Show/Hide-Toggle + Styleguide-Demo"
```

---

## Task 3: Server-Actions umschreiben

**Files:**
- Rewrite: `web/lib/actions/auth.ts`

- [ ] **Step 1: Datei komplett ersetzen**

`requestMagicLink`/`MagicLinkState` entfallen; `signOut`/`deleteAccount` bleiben inhaltlich gleich. Vollständiger neuer Inhalt von `web/lib/actions/auth.ts`:

```ts
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
  status: "idle" | "error" | "confirm" | "reset-sent";
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
    return {
      status: "error",
      email,
      message: notConfirmed
        ? "Bitte bestätige zuerst deine E-Mail-Adresse."
        : "E-Mail oder Passwort ist falsch.",
    };
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

  const { data: priv } = await supabase
    .from("exercises")
    .select("bild_url")
    .eq("owner_id", uid)
    .eq("visibility", "private");
  const paths = (priv ?? [])
    .map((p) => bildUrlToPath(p.bild_url))
    .filter((p): p is string => !!p);

  const { error } = await supabase.rpc("delete_account");
  if (error) return;

  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);

  try {
    await supabase.auth.signOut();
  } catch {
    /* ignorieren */
  }
  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(uid);

  revalidatePath("/");
  redirect("/?account_deleted=1");
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL — `LoginForm.tsx` importiert noch `requestMagicLink`/`MagicLinkState` (existieren nicht mehr). Das ist erwartet und wird in Task 5 behoben.

- [ ] **Step 3: Commit**

```bash
git add web/lib/actions/auth.ts
git commit -m "feat(auth): Server-Actions auf E-Mail/Passwort + Reset umstellen"
```

---

## Task 4: `/auth/confirm`-Route (verifyOtp)

**Files:**
- Create: `web/app/auth/confirm/route.ts`

- [ ] **Step 1: Route-Handler anlegen**

Create `web/app/auth/confirm/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Bestätigt Signup- und Recovery-Links über token_hash + verifyOtp.
 *  Im Gegensatz zum PKCE-Code-Tausch braucht das KEINEN code_verifier-Cookie
 *  -> funktioniert auch, wenn der Link auf einem anderen Gerät geöffnet wird. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") ? next : "/";

  // Auf den tatsächlichen Host weiterleiten; in Prod via APP_ORIGIN festnageln.
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = process.env.APP_ORIGIN ?? (host ? `${proto}://${host}` : origin);

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${base}${safeNext}`);
  }

  return NextResponse.redirect(`${base}/login?error=confirm`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: weiterhin nur der LoginForm-Fehler aus Task 3; **kein** neuer Fehler in `confirm/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/app/auth/confirm/route.ts
git commit -m "feat(auth): /auth/confirm Route (verifyOtp, cross-device-stabil)"
```

---

## Task 5: Auth-Layout + Login-Seite umbauen

**Files:**
- Create: `web/app/(auth)/layout.tsx`
- Rewrite: `web/app/(auth)/login/page.tsx`
- Rewrite: `web/app/(auth)/login/LoginForm.tsx`

- [ ] **Step 1: Gemeinsame Auth-Shell anlegen**

Create `web/app/(auth)/layout.tsx` (zieht Back-Link + Zentrierung aus den vier Seiten heraus, DRY):

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link
        href="/"
        className="focus-ring type-label-medium mb-6 inline-flex items-center gap-1.5 rounded-[3px] text-on-surface-variant transition-colors hover:text-on-surface"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden />
        Zum Katalog
      </Link>
      {children}
    </main>
  );
}
```

- [ ] **Step 2: Login-Seite ersetzen**

Rewrite `web/app/(auth)/login/page.tsx` (Shell kommt jetzt aus dem Layout; `error=confirm` aus der Confirm-Route behandeln):

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Anmelden — KiFu",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const redirect = sp.redirect?.startsWith("/") ? sp.redirect : "/";

  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Anmelden</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Melde dich mit E-Mail und Passwort an. Noch kein Konto?{" "}
          <a href="/registrieren" className="text-primary underline">Registrieren</a>.
        </p>
      </header>

      {sp.error && (
        <p className="type-body-small mb-4 rounded-[4px] border border-error/40 bg-error/10 p-3 text-on-surface">
          Der Bestätigungslink war ungültig oder abgelaufen. Bitte melde dich an
          oder fordere einen neuen Link an.
        </p>
      )}

      <Card className="p-6">
        <LoginForm redirect={redirect} />
      </Card>
    </>
  );
}
```

- [ ] **Step 3: LoginForm ersetzen**

Rewrite `web/app/(auth)/login/LoginForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { TextField, PasswordField, Button } from "@/components/ui";
import { login, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <LogIn size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird angemeldet …" : "Anmelden"}
    </Button>
  );
}

export function LoginForm({ redirect }: { redirect: string }) {
  const [state, formAction] = useActionState(login, initial);
  const isError = state.status === "error";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="redirect" value={redirect} />
      <TextField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={isError}
      />
      <PasswordField
        label="Passwort"
        name="password"
        autoComplete="current-password"
        required
        error={isError}
        supportingText={isError ? state.message : undefined}
      />
      <SubmitButton />
      <div className="flex justify-between">
        <Link href="/passwort-vergessen" className="type-label-medium text-primary underline">
          Passwort vergessen?
        </Link>
        <Link href="/registrieren" className="type-label-medium text-on-surface-variant underline">
          Registrieren
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (LoginForm-Fehler aus Task 3 ist jetzt behoben).

- [ ] **Step 5: Commit**

```bash
git add web/app/\(auth\)/layout.tsx web/app/\(auth\)/login/page.tsx web/app/\(auth\)/login/LoginForm.tsx
git commit -m "feat(auth): Login-Seite auf Passwort + gemeinsame Auth-Shell"
```

---

## Task 6: Registrieren-Seite

**Files:**
- Create: `web/app/(auth)/registrieren/page.tsx`
- Create: `web/app/(auth)/registrieren/RegisterForm.tsx`

- [ ] **Step 1: Seite anlegen**

Create `web/app/(auth)/registrieren/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Registrieren — KiFu",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Registrieren</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Erstelle ein Konto, um eigene Übungen anzulegen. Bereits registriert?{" "}
          <a href="/login" className="text-primary underline">Anmelden</a>.
        </p>
      </header>
      <Card className="p-6">
        <RegisterForm />
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Formular anlegen**

Create `web/app/(auth)/registrieren/RegisterForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, UserPlus } from "lucide-react";
import { TextField, PasswordField, Button } from "@/components/ui";
import { register, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <UserPlus size={18} strokeWidth={2} aria-hidden />
      {pending ? "Konto wird erstellt …" : "Konto erstellen"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(register, initial);

  if (state.status === "confirm") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck size={40} strokeWidth={1.5} className="text-primary" aria-hidden />
        <h2 className="type-title-large text-on-surface">Fast geschafft</h2>
        <p className="type-body-medium text-on-surface-variant">
          Wir haben einen Bestätigungslink an{" "}
          <strong className="text-on-surface">{state.email}</strong> geschickt.
          Öffne ihn, um deine Registrierung abzuschliessen.
        </p>
      </div>
    );
  }

  const isError = state.status === "error";
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        error={isError}
      />
      <PasswordField
        label="Passwort"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
        supportingText={isError ? state.message : "Mindestens 8 Zeichen."}
      />
      <PasswordField
        label="Passwort wiederholen"
        name="confirm"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
      />
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/\(auth\)/registrieren
git commit -m "feat(auth): Registrieren-Seite (Signup mit Bestätigungs-Screen)"
```

---

## Task 7: Passwort-vergessen-Seite

**Files:**
- Create: `web/app/(auth)/passwort-vergessen/page.tsx`
- Create: `web/app/(auth)/passwort-vergessen/ForgotPasswordForm.tsx`

- [ ] **Step 1: Seite anlegen**

Create `web/app/(auth)/passwort-vergessen/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Passwort vergessen — KiFu",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Passwort vergessen</h1>
        <p className="type-body-medium mt-2 text-on-surface-variant">
          Gib deine E-Mail-Adresse ein — wir senden dir einen Link zum Zurücksetzen.
        </p>
      </header>
      <Card className="p-6">
        <ForgotPasswordForm />
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Formular anlegen**

Create `web/app/(auth)/passwort-vergessen/ForgotPasswordForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MailCheck, Send } from "lucide-react";
import { TextField, Button } from "@/components/ui";
import { requestPasswordReset, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Send size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird gesendet …" : "Link senden"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initial);

  if (state.status === "reset-sent") {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <MailCheck size={40} strokeWidth={1.5} className="text-primary" aria-hidden />
        <h2 className="type-title-large text-on-surface">E-Mail unterwegs</h2>
        <p className="type-body-medium text-on-surface-variant">
          Falls ein Konto zu <strong className="text-on-surface">{state.email}</strong>{" "}
          existiert, haben wir einen Link zum Zurücksetzen geschickt.
        </p>
      </div>
    );
  }

  const isError = state.status === "error";
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <TextField
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
        error={isError}
        supportingText={isError ? state.message : undefined}
      />
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/\(auth\)/passwort-vergessen
git commit -m "feat(auth): Passwort-vergessen-Seite (neutrale Antwort)"
```

---

## Task 8: Passwort-neu-Seite

**Files:**
- Create: `web/app/(auth)/passwort-neu/page.tsx`
- Create: `web/app/(auth)/passwort-neu/NewPasswordForm.tsx`

- [ ] **Step 1: Seite anlegen (Session-Gate als Server Component)**

Create `web/app/(auth)/passwort-neu/page.tsx` — rendert das Formular nur bei aktiver Session (nach Recovery-Link); sonst Hinweis:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./NewPasswordForm";

export const metadata: Metadata = {
  title: "Neues Passwort — KiFu",
  robots: { index: false },
};

export default async function NewPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <header className="mb-8">
        <p className="type-label-medium text-primary">KiFu</p>
        <h1 className="type-headline-large mt-1 text-on-surface">Neues Passwort</h1>
      </header>
      <Card className="p-6">
        {user ? (
          <NewPasswordForm />
        ) : (
          <p className="type-body-medium text-on-surface-variant">
            Der Link ist ungültig oder abgelaufen.{" "}
            <Link href="/passwort-vergessen" className="text-primary underline">
              Neuen Link anfordern
            </Link>
            .
          </p>
        )}
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Formular anlegen**

Create `web/app/(auth)/passwort-neu/NewPasswordForm.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { PasswordField, Button } from "@/components/ui";
import { setNewPassword, type AuthState } from "@/lib/actions/auth";

const initial: AuthState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      <Check size={18} strokeWidth={2} aria-hidden />
      {pending ? "Wird gespeichert …" : "Passwort speichern"}
    </Button>
  );
}

export function NewPasswordForm() {
  const [state, formAction] = useActionState(setNewPassword, initial);
  const isError = state.status === "error";
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <PasswordField
        label="Neues Passwort"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
        supportingText={isError ? state.message : "Mindestens 8 Zeichen."}
      />
      <PasswordField
        label="Passwort wiederholen"
        name="confirm"
        autoComplete="new-password"
        required
        minLength={8}
        error={isError}
      />
      <SubmitButton />
    </form>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/\(auth\)/passwort-neu
git commit -m "feat(auth): Passwort-neu-Seite (updateUser via Recovery-Session)"
```

---

## Task 9: Magic-Link-Reste entfernen + Nav prüfen

**Files:**
- Verify/Modify: `web/components/layout/AppNav.tsx`
- Repo-weite Suche nach Resten

- [ ] **Step 1: Repo nach Magic-Link-Resten durchsuchen**

Run: `grep -rn "requestMagicLink\|MagicLinkState\|signInWithOtp\|Anmeldelink" web/app web/lib web/components`
Expected: **keine** Treffer mehr (außer ggf. im Plan/Spec-Doc, die nicht unter web/ liegen). Falls Treffer in `web/`: entsprechende Stelle auf die neuen Actions/Texte anpassen.

- [ ] **Step 2: Login-Link-Text in der Navigation prüfen**

`web/components/layout/AppNav.tsx` öffnen. Falls dort ein Login-Eintrag „Anmeldelink"/Magic-Link-Wording trägt, auf „Anmelden" korrigieren. Der Link-Pfad `/login` bleibt.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit (nur falls Änderungen)**

```bash
git add -A
git commit -m "chore(auth): Magic-Link-Reste entfernen / Nav-Wording"
```

---

## Task 10: Manuelle End-to-End-Verifikation (lokal + Mailpit)

**Files:** keine — Verifikation.

- [ ] **Step 1: Stack frisch hochfahren**

Run: `npm run db:reset && npm run dev`
Expected: DB sauber, Dev-Server auf `http://localhost:3000`. Mailpit-URL aus `npm run db:status` notieren (i. d. R. `http://127.0.0.1:54324`).

- [ ] **Step 2: Registrierung + Bestätigung**

`/registrieren` → E-Mail + Passwort (≥8) → „Fast geschafft"-Screen. In **Mailpit** die Mail öffnen, den „E-Mail-Adresse bestätigen"-Link klicken.
Expected: Redirect über `/auth/confirm?...&type=signup` → eingeloggt auf `/`.

- [ ] **Step 3: Cross-Device-Regression (Finding 1)**

Erneut registrieren (andere Adresse). Den Bestätigungslink aus Mailpit in einem **anderen Browser-Profil / Inkognito** (ohne die Signup-Cookies) öffnen.
Expected: trotzdem eingeloggt — beweist, dass `token_hash`/`verifyOtp` ohne `code_verifier`-Cookie funktioniert.

- [ ] **Step 4: Logout + Login**

Abmelden → `/login` → E-Mail + Passwort.
Expected: eingeloggt, Redirect auf Ziel. Falsches Passwort → „E-Mail oder Passwort ist falsch."

- [ ] **Step 5: Passwort vergessen → neu setzen**

`/passwort-vergessen` → E-Mail → neutrale Meldung. In Mailpit „Neues Passwort setzen" klicken → `/passwort-neu` → neues Passwort (2×) → Redirect `/konto`. Dann mit neuem Passwort einloggen.
Expected: alle Schritte erfolgreich.

- [ ] **Step 6: Geschützte Route ohne Login**

Ausgeloggt `/konto` aufrufen.
Expected: Redirect auf `/login?redirect=/konto` (Middleware unverändert).

---

## Task 11 (optional): Playwright-E2E Happy-Path

**Files:**
- Create: `web/e2e/auth.spec.ts` (nur falls Playwright im Projekt eingeführt wird)

- [ ] **Step 1:** Mit der `webapp-testing`-Skill einen Playwright-Test gegen den lokalen Dev-Server schreiben, der Register→Mailpit-Confirm→Logout→Login abdeckt (Mailpit-API `GET http://127.0.0.1:54324/api/v1/messages` zum Abgreifen des Links). Optional — nur wenn dauerhafte E2E gewünscht; sonst Task 10 (manuell) ist der Gate.

---

## Task 12 (Ops, manuell — kein Code): Prod aktivieren

**Files:** keine — Supabase-Dashboard + Vercel + Resend.

- [ ] **Step 1: Resend-SMTP einrichten**

Resend-Konto → Domain `ki-fu.ch` → SPF/DKIM-DNS im Infomaniak-Manager setzen → verifizieren → API-Key. In Supabase (Prod) → Auth → Emails → SMTP: `Host smtp.resend.com · Port 465 · User resend · Pass <API-Key> · Sender noreply@ki-fu.ch · Name KiFu`.

- [ ] **Step 2: Prod-Auth-Config**

Auth → Providers → Email: **Confirm email = ON**, Min-Password-Length 8. Die deutschen Templates ggf. ins Dashboard übernehmen (sie zeigen auf `{{ .SiteURL }}/auth/confirm?...`). Site URL/Allowlist sind bereits gesetzt.

- [ ] **Step 3: Clean-Slate-Reset (pre-launch)**

Prod-DB resetten + `auth.users` leeren, neu seeden (75 Manual-Übungen), Storage-Bucket `exercise-images` leeren. Vorgehen gemäss Spec (voller Reset).

- [ ] **Step 4: Deploy + Prod-Smoke-Test**

`feature/passwort-auth` → PR → Merge auf `main` (Vercel deployt automatisch; `supabase db push` nur bei Migrationsänderung — hier keine). APP_ORIGIN ist in Vercel gesetzt → Redeploy aktiviert es. Danach auf der Prod-App registrieren und den ki-fu.ch-Link cross-device testen.

---

## Self-Review (vom Plan-Autor)

**Spec-Abdeckung:** Routen (T5–T8), token_hash/verifyOtp (T4, T1-Templates), Enumeration-Obfuskation (T3 register), neutrale Reset-Antwort (T3 requestPasswordReset), Brute-Force/CAPTCHA (Folgeschritt, Spec — bewusst nicht im Code-Plan), Clean-Slate voller Reset (T12), versionierte Templates (T1), PasswordField/Styleguide (T2), Fehlermeldungen (T3), Open-Redirect-Guard (T3 `safeNext`, T4), Cross-Device-Test (T10/T11). ✅
**Platzhalter:** keine — alle Code-Schritte vollständig.
**Typkonsistenz:** `AuthState` (T3) wird in allen Forms (T5–T8) identisch verwendet; `EmailOtpType` in T4; `PasswordField`/`PasswordFieldProps` (T2) konsistent importiert.
