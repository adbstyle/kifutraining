# Design: E-Mail-/Passwort-Authentifizierung (ersetzt Magic-Link)

**Datum:** 2026-06-07
**Status:** Entwurf zur Freigabe (Rev. 2 — Architektur-Review eingearbeitet)

> **Rev. 2** nach kritischem Senior-Architect-Review: Signup/Recovery laufen über den
> **`token_hash`/`verifyOtp`-Pfad** (geräteübergreifend stabil) statt PKCE-`exchangeCodeForSession`;
> Signup nutzt Supabase' Enumeration-Obfuskation; Brute-Force-/CAPTCHA-Schutz aufgenommen;
> Clean-Slate als voller DB-Reset; E-Mail-Templates versioniert.

## Ausgangslage & Motivation

Die App nutzt aktuell passwortlosen **Magic-Link-Login** (`signInWithOtp`). Problem: Magic-Link
verschickt bei **jedem Login** eine E-Mail. Der eingebaute Supabase-Mailversand ist stark
rate-limitiert und nicht prod-tauglich — beim Testen wurde das Stundenlimit erreicht
(`email rate limit exceeded`).

**Ziel:** Umstieg auf klassische **E-Mail + Passwort**-Authentifizierung mit
„Passwort vergessen"-Flow. Login braucht dann **keine** E-Mail mehr; E-Mail wird nur noch für
Signup-Bestätigung und Passwort-Reset gebraucht (selten, geringes Volumen).

## Entscheidungen (mit dem User abgestimmt)

1. **Signup mit Bestätigungsmail** — verifizierte Adressen (Confirm email = ON).
2. **Magic-Link komplett ersetzen** — nur noch Passwort, `signInWithOtp` fliegt raus.
3. **Bestehende Konten löschen** — Clean Slate (Prod ist pre-launch, keine echten User).
4. **Custom SMTP via Resend**, Absenderdomain **`ki-fu.ch`** (Infomaniak, DNS-Zugriff vorhanden).
5. **Routing-Ansatz A** — vier getrennte Routen, je ein fokussiertes Formular.
6. **E-Mail-Links via `token_hash`/`verifyOtp`** (nicht PKCE-`?code`) — Begründung siehe
   Finding 1 unten. Geräteübergreifend stabil.

## Scope-Grenzen (bewusst draussen, YAGNI)

OAuth/Social-Login, MFA/2FA, „E-Mail-Adresse ändern"-Flow, „Remember me"/Session-Tuning,
Passwort-Komplexitätsregeln über Mindestlänge hinaus. **CAPTCHA + Leaked-Password-Protection
sind als Folgeschritt vorgesehen (siehe Sicherheit), nicht Teil der ersten Umsetzung.**

---

## Architektur

### Routen

| Route | Zweck | Status |
|---|---|---|
| `/(auth)/login` | Login: E-Mail + Passwort | bestehende Seite umbauen |
| `/(auth)/registrieren` | Registrierung: E-Mail + Passwort + Wiederholung | neu |
| `/(auth)/passwort-vergessen` | Reset anfordern (nur E-Mail) | neu |
| `/(auth)/passwort-neu` | Neues Passwort setzen (via Recovery-Link) | neu |
| `/auth/confirm` | **`token_hash`/`verifyOtp`-Bestätigung** — Signup **und** Recovery | **neu** (ersetzt callback für E-Mail-Links) |
| `/auth/callback` | PKCE-Code-Tausch (nur für künftiges OAuth) | bleibt ungenutzt, bis OAuth kommt |

Alle Auth-Seiten tragen `robots: { index: false }` (wie bestehende Login-Seite).

> **Warum `/auth/confirm` statt `/auth/callback`?** Siehe **Finding 1**. PKCE-`exchangeCodeForSession`
> braucht den `code_verifier`-Cookie aus **demselben Browser** wie der Auth-Start. E-Mail-Bestätigungs-
> und Reset-Links werden aber häufig auf einem **anderen Gerät** geöffnet → Cookie fehlt → Link bricht.
> `verifyOtp({ type, token_hash })` braucht keinen Verifier → geräteübergreifend stabil.

### Datenfluss

**Registrierung:**
`register`-Action → `signUp({ email, password, options: { emailRedirectTo: ${origin}/auth/confirm?next=… } })`
→ **immer** State `"confirm"` (Bestätigungs-Screen „Mail unterwegs"), unabhängig davon, ob die Adresse
schon existiert — Supabase liefert bei existierender Adresse bewusst eine obfuskierte Antwort
(Anti-Enumeration). User klickt Link → `/auth/confirm?token_hash=…&type=signup&next=…` →
`verifyOtp({ type: 'signup', token_hash })` → eingeloggt → redirect auf `next` (Guard `startsWith("/")`).

**Login:**
`login`-Action → `signInWithPassword({ email, password })` → bei Erfolg `redirect(next)`.

**Passwort vergessen:**
`requestPasswordReset`-Action → `resetPasswordForEmail(email, { redirectTo: ${origin}/auth/confirm?next=/passwort-neu })`
→ **neutrale** Erfolgsmeldung (gleiche Antwort, ob Konto existiert oder nicht).
Mail-Link → `/auth/confirm?token_hash=…&type=recovery&next=/passwort-neu` →
`verifyOtp({ type: 'recovery', token_hash })` → Session aktiv → redirect `/passwort-neu`.

**Passwort neu setzen:**
`/passwort-neu` ist effektiv eine **„Passwort ändern"-Seite für eingeloggte User** — sie rendert das
Formular bei aktiver Session, sonst den Hinweis „Link abgelaufen, neu anfordern". (Die Recovery-Session
ist eine vollwertige Session, keine eingeschränkte — bewusst so akzeptiert, F6.)
`setNewPassword`-Action → `updateUser({ password })` → redirect `/konto`.

### Server-Actions — [web/lib/actions/auth.ts](../../../web/lib/actions/auth.ts)

`requestMagicLink` + `MagicLinkState` entfallen. Neu/unverändert:

- `login(prev, formData)` → `signInWithPassword`
- `register(prev, formData)` → `signUp` → **immer** `"confirm"`-State (keine „existiert bereits"-Verzweigung)
- `requestPasswordReset(prev, formData)` → `resetPasswordForEmail`
- `setNewPassword(prev, formData)` → `updateUser({ password })`
- `resendConfirmation(email)` → `auth.resend({ type: 'signup', email })` (für „Email not confirmed")
- `signOut()` / `deleteAccount()` → **unverändert**

Der `appOrigin()`-Helper (knüpft an den `APP_ORIGIN`-Fix an) wird für alle Redirect-URLs
wiederverwendet. Jede Action gibt ein typisiertes State-Objekt zurück (Muster wie bisher).
Der **Open-Redirect-Guard** (`next.startsWith("/")`) muss in **allen** Actions/Routen greifen,
die `next` verarbeiten (Login, Register, `/auth/confirm`) — wie heute schon im Callback (F8).

### Route-Handler — `web/app/auth/confirm/route.ts` (neu)

Liest `token_hash`, `type` (`signup` | `recovery`) und `next` aus der Query, ruft
`supabase.auth.verifyOtp({ type, token_hash })`. Bei Erfolg redirect auf `${appOrigin()}${safeNext}`,
sonst auf `/login?error=<grund>` (differenzierte Gründe statt pauschal `error=link`, F7).
Setzt — wie der bestehende Callback — die Session-Cookies via `@supabase/ssr`.

Alle `getUser()`-Aufrufe in Seiten, Queries und [middleware.ts](../../../web/lib/supabase/middleware.ts)
bleiben **unverändert** — die Session-Lese-Seite ist von der Auth-Methode unabhängig.

### UI-Komponenten (Styleguide-first)

Vier Client-Forms nach dem bestehenden `LoginForm`-Muster (`useActionState` + `useFormStatus`),
alle mit `TextField` / `Button` / `Card` aus `web/components/ui`:

- `LoginForm` (umbau), `RegisterForm`, `ForgotPasswordForm`, `NewPasswordForm`
- Passwortfelder: `type="password"`, korrektes `autoComplete` (`current-password` / `new-password`)
- Show/Hide-Toggle am Passwortfeld als **neuer Styleguide-Baustein** (im Styleguide ergänzen) —
  Umsetzung als kleine Erweiterung von `TextField` oder eigenes `PasswordField`.
- Querverlinkung Login ↔ Registrieren ↔ „Passwort vergessen?".

### Validierung

- E-Mail: bestehende `EMAIL_RE`.
- Passwort: Mindestlänge **8** (Supabase-Policy + clientseitig `minLength`).
- Registrierung + Passwort-neu: Wiederholungsfeld, clientseitiger Gleichheits-Check.

---

## Konfiguration

### Supabase Auth

- **Confirm email = ON** (Auth → Providers → Email).
- Lokal gespiegelt in [supabase/config.toml](../../../supabase/config.toml):
  `[auth.email] enable_confirmations = true`. Lokale Mails fängt **Mailpit/Inbucket** ab —
  kein echter Versand im Dev nötig.
- **Password-Policy:** Minimum-Länge 8 (Auth → Policies).
- **E-Mail-Templates** „Confirm signup" + „Reset password" auf **Deutsch** + **versioniert** in
  `config.toml` (`[auth.email.template.confirmation] content_path = "./supabase/templates/confirmation.html"`,
  analog `recovery`) → eine Quelle, lokal = prod, im Git (F5). Die Templates müssen auf den
  **`token_hash`-Pfad** zeigen, nicht auf `{{ .ConfirmationURL }}`:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/` (bzw. `type=recovery&next=/passwort-neu`).
  **Präzisierung:** Beim Template-Pfad ist `next` **pro Typ im Template fix verdrahtet** (signup → `/`,
  recovery → `/passwort-neu`) — die `emailRedirectTo`/`redirectTo`-Optionen der Actions bleiben gesetzt
  (Allowlist-Validierung + `{{ .RedirectTo }}`-Fallback), steuern den tatsächlichen Link aber nicht.
- Site URL + Redirect-Allowlist sind bereits auf `https://kifutraining.vercel.app` gesetzt;
  `/auth/confirm` + `/passwort-neu` sind vom `/**`-Wildcard abgedeckt.

### Sicherheit (Finding 3 + 6)

- **Brute-Force/Credential-Stuffing:** Passwort-Login ist eine neue Angriffsfläche (Magic-Link war
  immun). Erste Umsetzung stützt sich auf Supabase' eingebaute Auth-Rate-Limits; **CAPTCHA**
  (Cloudflare Turnstile / hCaptcha, in Supabase Auth integriert) ist als **Folgeschritt** eingeplant.
- **Leaked-Password-Protection** (HaveIBeenPwned) in Supabase aktivieren, sobald verfügbar —
  Mindestlänge 8 allein ist schwach.
- **Recovery-Session = vollwertige Session** (F6): Wer einen Recovery-Link abschliesst, ist voll
  eingeloggt, auch ohne neues Passwort zu setzen. Bewusst akzeptiert (Supabase-Standardverhalten).

### Custom SMTP via Resend (Prod)

Absenderdomain **`ki-fu.ch`** (unabhängig von der App-Domain `kifutraining.vercel.app`).

1. Resend-Konto → Domain `ki-fu.ch` hinzufügen → DNS-Records (SPF TXT + DKIM) im
   **Infomaniak-Manager** setzen → verifizieren.
2. Resend-API-Key erzeugen.
3. Supabase → Auth → Emails → SMTP Settings:
   `Host smtp.resend.com · Port 465 · User resend · Pass <API-Key> · Sender noreply@ki-fu.ch · Name KiFu`.
4. Danach Auth → Rate Limits höhersetzen (mit Custom SMTP unproblematisch).

### Clean-Slate-Migration (Prod, einmalig) — voller Reset (F4)

Statt chirurgischer DELETEs (riskiert verwaiste Storage-Objekte + Constraint-Verletzungen) der
saubere Weg, den der **pre-launch-Lifecycle** in [CLAUDE.md](../../../CLAUDE.md) explizit erlaubt:

1. Prod-DB **resetten** (Migrationen frisch anwenden) → leert auch `auth.users`.
2. **Neu seeden** (`npm run seed`) → die 75 Manual-Übungen wieder rein.
3. Storage-Bucket `exercise-images` leeren (nur die Manual-Bilder bleiben relevant).

Hintergrund FK (falls doch selektiv gelöscht würde): `exercises.owner_id` = `ON DELETE SET NULL`,
`training_plans.owner_id` + `exercise_favorites.user_id` = `ON DELETE CASCADE`; `source` ∈
`{'manual','user'}`. Der volle Reset umgeht diese Feinheiten komplett.

---

## Fehlerbehandlung (deutsche Meldungen)

| Supabase-Fehler | UI-Text |
|---|---|
| Invalid login credentials | „E-Mail oder Passwort ist falsch." |
| Email not confirmed | „Bitte bestätige zuerst deine E-Mail." + Button „Bestätigung erneut senden" |
| Weak password | „Das Passwort muss mindestens 8 Zeichen haben." |
| Same password (Reset) | „Bitte ein neues, anderes Passwort wählen." |
| sonst | generischer Fallback |

> **Kein** „E-Mail bereits registriert"-Fehler (F2): Bei Signup auf eine existierende Adresse
> zeigt die App denselben „Bitte E-Mail bestätigen"-Screen (Supabase obfuskiert die Antwort) —
> verhindert User-Enumeration und spart die Sonderbehandlung.

## Testing

- **Lokal:** `supabase start` → alle 4 Flows manuell durchspielen. Bestätigungs-/Reset-Mail in
  **Mailpit** öffnen und den `/auth/confirm?token_hash=…`-Link klicken (F9 — E2E muss den Link
  aus Mailpit ziehen, nicht nur „Mail kam an" prüfen).
- **Cross-Device-Regression (Finding 1):** Bestätigungslink in einem **anderen Browser-Profil**
  (ohne die Signup-Cookies) öffnen → muss trotzdem einloggen. Das ist der Beweis, dass der
  `token_hash`-Pfad das PKCE-Problem löst.
- `npm run typecheck` (CI-Gate).
- Optional: Playwright-E2E (Login + Register Happy-Path) gegen lokale DB via webapp-testing.
- Keine Unit-Tests für die dünnen Server-Actions (reine Supabase-Passthroughs).

## Offene Punkte / Risiken

- **DNS-Verifizierung `ki-fu.ch`** kann je nach Propagation etwas dauern — vor dem Prod-Test
  einplanen. Bis dahin lokal über Mailpit testbar.
- **CAPTCHA + Leaked-Password-Protection** sind bewusst Folgeschritt (siehe Sicherheit) —
  als eigenes Ticket nachziehen, bevor echte Nutzer skalieren.
