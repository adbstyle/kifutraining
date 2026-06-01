# M3-Designsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das KiFu-Designsystem („Taktik-Editorial") auf Material-3-Struktur heben — Color Roles, Elevation, State-Layers, Type-Scale, Lucide-Icons, Spacing-Grid, Layout-Size-Classes — und Styleguide + UI-Kit darauf migrieren, ohne die Identität zu verlieren.

**Architecture:** Zwei-Ebenen-Tokens (Primitives → semantische Rollen) im `@theme`-Block von `globals.css` (Tailwind v4). Komponenten konsumieren ab jetzt Rollen-Tokens. Type-Scale als `@utility`-Klassen. Icons via `lucide-react` + dünner `IconButton`. Der Styleguide bekommt Foundations-Sektionen und zeigt jede Rolle/jedes Token live.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4 (`@theme`/`@utility`), `lucide-react`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-01-m3-designsystem-design.md`

**Verifikations-Strategie (kein Unit-Test-Runner im Projekt):** Pro Task gilt als „grün": `cd web && npm run build` kompiliert ohne Fehler **und** `npm run typecheck` ist sauber **und** die im Task genannte Styleguide-Sektion rendert wie beschrieben. Visuelle Abnahme: `npm run dev` → `http://localhost:3000/styleguide`.

---

### Task 0: Branch anlegen

**Files:** — (Git)

- [ ] **Step 1: Feature-Branch erstellen**

Run:
```bash
cd /Users/adrianbader/Dev/kifu && git checkout -b feature/m3-designsystem
```
Expected: `Switched to a new branch 'feature/m3-designsystem'`

- [ ] **Step 2: Design-Spec committen**

```bash
git add docs/superpowers/specs/2026-06-01-m3-designsystem-design.md docs/superpowers/plans/2026-06-01-m3-designsystem.md
git commit -m "docs: M3-Designsystem Spec & Plan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 1: Color-Role-Tokens (Ebene 2)

**Files:**
- Modify: `web/app/globals.css` (im `@theme`-Block, nach den Primitives)

- [ ] **Step 1: Rollen-Tokens in `@theme` ergänzen**

Direkt nach dem `--color-kat-e`-Block (vor dem Typografie-Kommentar) einfügen:

```css
  /* ─── M3 Color Roles (Ebene 2 — zeigen auf Primitives, Dark-Scheme) ─── */
  /* Primary — Signal bleibt der einzige warme Hue */
  --color-primary: var(--color-signal);
  --color-on-primary: var(--color-rasen-950);
  --color-primary-container: var(--color-signal-dark);
  --color-on-primary-container: var(--color-chalk);

  /* Secondary — bewusst low-chroma (kein zweiter Hue) */
  --color-secondary: var(--color-chalk-dim);
  --color-on-secondary: var(--color-rasen-950);
  --color-secondary-container: var(--color-rasen-700);
  --color-on-secondary-container: var(--color-chalk);

  /* Error */
  --color-error: #f87171;
  --color-on-error: var(--color-rasen-950);
  --color-error-container: #5c1d18;
  --color-on-error-container: #fecaca;

  /* Surface-Familie — die Rasen-Leiter IST die M3 Elevation-Leiter */
  --color-surface: var(--color-rasen-950);
  --color-surface-dim: #07160f;
  --color-surface-bright: var(--color-rasen-800);
  --color-surface-container-lowest: #07160f;
  --color-surface-container-low: var(--color-rasen-900);
  --color-surface-container: var(--color-rasen-850);
  --color-surface-container-high: var(--color-rasen-800);
  --color-surface-container-highest: var(--color-rasen-700);
  --color-on-surface: var(--color-chalk);
  --color-on-surface-variant: var(--color-chalk-dim);

  /* Outline (= chalk-border-Anmutung) */
  --color-outline: color-mix(in oklab, var(--color-chalk) 28%, transparent);
  --color-outline-variant: color-mix(in oklab, var(--color-chalk) 12%, transparent);

  /* Inverse / Overlay */
  --color-inverse-surface: var(--color-chalk);
  --color-inverse-on-surface: var(--color-rasen-950);
  --color-inverse-primary: var(--color-signal-dark);
  --color-scrim: #000000;
  --color-shadow: #000000;
```

- [ ] **Step 2: Build + Typecheck verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build && npm run typecheck
```
Expected: Build erfolgreich, keine TS-Fehler. (Tailwind v4 generiert aus jedem `--color-*` automatisch `bg-*`/`text-*`/`border-*`-Utilities, z. B. `bg-surface-container-low`, `text-on-surface`, `border-outline`.)

- [ ] **Step 3: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(design): M3 Color-Role-Tokens (Dark-Scheme)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Elevation- & State-Layer-Konvention

**Files:**
- Modify: `web/app/globals.css` (Shadow-Tokens in `@theme`, Kommentar-Konvention)

- [ ] **Step 1: Elevation-Shadow-Tokens in `@theme` ergänzen** (nach den Color Roles)

```css
  /* ─── Elevation (Dark): Höhe primär über Surface-Container; Schatten ab L3.
     Konvention: Level N = bg-surface-container-* (siehe Spec §3) + shadow-eN.
     Ausnahme: Primary-CTA nutzt den Signatur-Schatten, NICHT diese Tokens. ─── */
  --shadow-e1: none;
  --shadow-e2: none;
  --shadow-e3: 0 2px 6px color-mix(in oklab, var(--color-scrim) 40%, transparent);
  --shadow-e4: 0 4px 12px color-mix(in oklab, var(--color-scrim) 50%, transparent);
  --shadow-e5: 0 8px 24px color-mix(in oklab, var(--color-scrim) 60%, transparent);
```

- [ ] **Step 2: State-Layer-Konvention als Kommentar dokumentieren**

Unter den Shadow-Tokens (reine Doku — State-Layers werden über Tailwind-Opacity-Utilities umgesetzt):

```css
  /* State-Layers (M3-Opazitäten) — in Komponenten via Opacity-Utilities:
     hover  → bg-on-surface/8   (auf aktiven Elementen: bg-primary/8)
     focus  → bg-on-surface/10
     pressed→ bg-on-surface/10  */
```

- [ ] **Step 3: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: Build erfolgreich. (`--shadow-e3` → Utility `shadow-e3`.)

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(design): Elevation-Shadow-Tokens + State-Layer-Konvention

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Type-Scale-Utilities (15 Rollen) + Basis-Headings

**Files:**
- Modify: `web/app/globals.css` (neue `@utility`-Blöcke + `@layer base` Headings)

- [ ] **Step 1: Type-Scale-Utilities ergänzen** (nach den bestehenden `@utility chalk-*`-Blöcken)

```css
/* ─── M3 Type-Scale → KiFu-Fonts (Spec §5). Tracking KiFu-getunt. ─── */
@utility type-display-large {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 57px; line-height: 64px; letter-spacing: 0.01em;
}
@utility type-display-medium {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 45px; line-height: 52px; letter-spacing: 0.01em;
}
@utility type-display-small {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 36px; line-height: 44px; letter-spacing: 0.012em;
}
@utility type-headline-large {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 32px; line-height: 40px; letter-spacing: 0.015em;
}
@utility type-headline-medium {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 28px; line-height: 36px; letter-spacing: 0.015em;
}
@utility type-headline-small {
  font-family: var(--font-display); font-weight: 400; text-transform: uppercase;
  font-size: 24px; line-height: 32px; letter-spacing: 0.015em;
}
@utility type-title-large {
  font-family: var(--font-body); font-weight: 600;
  font-size: 22px; line-height: 28px; letter-spacing: 0;
}
@utility type-title-medium {
  font-family: var(--font-body); font-weight: 600;
  font-size: 16px; line-height: 24px; letter-spacing: 0.01em;
}
@utility type-title-small {
  font-family: var(--font-body); font-weight: 600;
  font-size: 14px; line-height: 20px; letter-spacing: 0.01em;
}
@utility type-body-large {
  font-family: var(--font-body); font-weight: 400;
  font-size: 16px; line-height: 24px; letter-spacing: 0;
}
@utility type-body-medium {
  font-family: var(--font-body); font-weight: 400;
  font-size: 14px; line-height: 20px; letter-spacing: 0;
}
@utility type-body-small {
  font-family: var(--font-body); font-weight: 400;
  font-size: 12px; line-height: 16px; letter-spacing: 0.01em;
}
@utility type-label-large {
  font-family: var(--font-mono); font-weight: 700; text-transform: uppercase;
  font-size: 14px; line-height: 20px; letter-spacing: 0.08em;
}
@utility type-label-medium {
  font-family: var(--font-mono); font-weight: 700; text-transform: uppercase;
  font-size: 12px; line-height: 16px; letter-spacing: 0.1em;
}
@utility type-label-small {
  font-family: var(--font-mono); font-weight: 400; text-transform: uppercase;
  font-size: 11px; line-height: 16px; letter-spacing: 0.1em;
}
```

- [ ] **Step 2: Basis-Headings auf Type-Rollen umstellen**

Im `@layer base`-Block den `h1, h2, h3, h4`-Block ersetzen durch (Headings erben weiter Anton/uppercase über die Utilities; konkrete Größen setzen die Seiten via `type-*`-Klassen — die Basisregel hält nur Font/Transform/Leading konsistent):

```css
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 400;
    letter-spacing: 0.015em;
    text-transform: uppercase;
    line-height: 1;
  }
```
(Bewusst beibehalten: Die Basisregel bleibt als Fallback; Seiten nutzen für präzise Größen die `type-headline-*`/`type-display-*`-Utilities.)

- [ ] **Step 3: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: Build erfolgreich; Klassen `type-display-large` … `type-label-small` verfügbar.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css
git commit -m "feat(design): M3 Type-Scale-Utilities (15 Rollen)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: lucide-react + IconButton-Komponente

**Files:**
- Modify: `web/package.json` (Dependency)
- Create: `web/components/ui/IconButton.tsx`
- Modify: `web/components/ui/index.ts` (Export)

- [ ] **Step 1: Dependency installieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm install lucide-react@^0.460.0
```
Expected: `lucide-react` erscheint in `package.json` → `dependencies`.

- [ ] **Step 2: IconButton erstellen**

Create `web/components/ui/IconButton.tsx`:
```tsx
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type Size = "sm" | "md";

const sizes: Record<Size, { box: string; icon: number }> = {
  sm: { box: "h-9 w-9", icon: 20 }, // dicht
  md: { box: "h-11 w-11", icon: 24 }, // default, Touch-freundlich
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Pflicht: a11y-Label, da der Button nur ein Icon trägt. */
  label: string;
  size?: Size;
  /** aktiver/ausgewählter Zustand → primary-Farbe + State-Layer */
  active?: boolean;
}

/* IconButton nach M3: outlined Icon (Lucide) + State-Layer statt Fill.
   Default-Icon-Farbe on-surface-variant, aktiv primary. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, label, size = "md", active = false, className, ...props }, ref) => {
    const s = sizes[size];
    return (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          "disabled:opacity-40 disabled:pointer-events-none",
          s.box,
          active
            ? "text-primary bg-primary/10 hover:bg-primary/15"
            : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 active:bg-on-surface/10",
          className,
        )}
        {...props}
      >
        <Icon size={s.icon} strokeWidth={2} aria-hidden />
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
```

- [ ] **Step 3: Export ergänzen**

In `web/components/ui/index.ts` nach der `SegmentedControl`-Zeile anfügen:
```ts
export { IconButton } from "./IconButton";
export type { IconButtonProps } from "./IconButton";
```

- [ ] **Step 4: Typecheck verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck
```
Expected: Keine TS-Fehler.

- [ ] **Step 5: Commit**

```bash
git add web/package.json web/package-lock.json web/components/ui/IconButton.tsx web/components/ui/index.ts
git commit -m "feat(ui): lucide-react + IconButton (M3 State-Layer statt Fill)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Button auf Rollen-Tokens migrieren (CTA-Schatten bleibt)

**Files:**
- Modify: `web/components/ui/Button.tsx`

- [ ] **Step 1: `base`, `variants`, `sizes` auf Rollen + Label-Typo umstellen**

Ersetze die Konstanten `base`, `variants`, `sizes` in `web/components/ui/Button.tsx` durch:
```tsx
const base =
  "type-label-large inline-flex items-center justify-center gap-2 rounded-[3px] transition-[background-color,transform,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-40 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  // Signatur: orange Plakatknopf mit hartem Schlagschatten (KiFu-Marke, kein M3-Elevation-Layer)
  primary:
    "bg-primary text-on-primary hover:bg-signal-bright active:translate-y-px shadow-[0_3px_0_0_var(--color-signal-dark)] active:shadow-[0_1px_0_0_var(--color-signal-dark)]",
  secondary:
    "bg-transparent text-on-surface border-[1.5px] border-outline hover:bg-on-surface/8 active:translate-y-px",
  ghost:
    "bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8",
  danger:
    "bg-transparent text-error border-[1.5px] border-error/40 hover:bg-error/10 hover:text-on-error-container",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3",
  md: "h-11 px-5",
  lg: "h-14 px-7", // Spielfeldrand-Grösse (Touch ≥ 56px)
};
```
(Die Schriftgröße kommt jetzt aus `type-label-large`; die bisherigen `text-[11px]`/`text-xs`/`text-sm` entfallen aus `sizes`. `font-mono`/`uppercase`/`tracking` stecken in `type-label-large`.)

- [ ] **Step 2: Typecheck + Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: sauber.

- [ ] **Step 3: Visuelle Abnahme**

`npm run dev` → `/styleguide` Sektion „Buttons": Primary orange mit hartem Schatten unverändert; secondary/ghost/danger mit Outline/State-Layer.

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/Button.tsx
git commit -m "refactor(ui): Button auf Rollen-Tokens + Label-Typo (CTA-Schatten bleibt)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Card auf Elevation 1

**Files:**
- Modify: `web/components/ui/Card.tsx`

- [ ] **Step 1: Klassen auf Surface-Rolle + Outline umstellen**

Ersetze in `web/components/ui/Card.tsx` den `cn(...)`-Klassenstring durch:
```tsx
        "relative rounded-[4px] bg-surface-container-low border-[1.5px] border-outline",
```
(Elevation 1 = `surface-container-low` + Outline, kein Schatten; ersetzt `bg-rasen-900 chalk-border`.)

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/Card.tsx
git commit -m "refactor(ui): Card auf Elevation 1 (surface-container-low + outline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: SegmentedControl auf Rollen + Elevation 2 + State-Layer

**Files:**
- Modify: `web/components/ui/SegmentedControl.tsx`

- [ ] **Step 1: Container-Klassen (Elevation 2) anpassen**

Ersetze den Container-`cn(...)`-Block:
```tsx
      className={cn(
        "inline-flex gap-1 overflow-x-auto rounded-[4px] bg-surface-container border-[1.5px] border-outline p-1",
        className,
      )}
```

- [ ] **Step 2: Tab-Klassen auf Rollen + State-Layer + Label-Typo anpassen**

Ersetze den Tab-`cn(...)`-Block:
```tsx
            className={cn(
              "type-title-small shrink-0 rounded-[3px] px-4 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8",
            )}
```
(Tab-Beschriftung nutzt jetzt `type-title-small` statt `font-display text-lg uppercase tracking-wide`.)

- [ ] **Step 3: Typecheck + Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: sauber.

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/SegmentedControl.tsx
git commit -m "refactor(ui): SegmentedControl auf Rollen-Tokens, Elevation 2, State-Layer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Chip (FilterChip selected M3) + Badge migrieren

**Files:**
- Modify: `web/components/ui/Chip.tsx`
- Modify: `web/components/ui/Badge.tsx`

- [ ] **Step 1: FilterChip — Import ergänzen**

In `web/components/ui/Chip.tsx` die erste Importzeile-Gruppe um den Lucide-Import ergänzen (über dem `cn`-Import):
```tsx
import { Check } from "lucide-react";
```

- [ ] **Step 2: FilterChip — selected nach M3 (secondary-container + Check)**

Ersetze die gesamte `FilterChip`-Funktion (aktuell Zeilen 31–59) durch (Prop `className` bleibt erhalten, damit bestehende Aufrufer nicht brechen):
```tsx
export function FilterChip({
  selected = false,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "type-label-medium inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        selected
          ? "border-transparent bg-secondary-container text-on-secondary-container"
          : "border-outline text-on-surface-variant hover:bg-on-surface/8 hover:text-on-surface",
        className,
      )}
    >
      {selected && <Check size={14} strokeWidth={2.5} aria-hidden />}
      {children}
    </button>
  );
}
```
(`KategorieChip` bleibt unverändert — die festen `kat-*`-Farben sind eigenständig semantisch.)

- [ ] **Step 3: Badge — `tones`-Map auf Rollen-Tokens**

Ersetze in `web/components/ui/Badge.tsx` die `tones`-Konstante (Zeilen 5–13) durch (Basis-Span-Styling 10px-Mono-Micro-Label bleibt bewusst erhalten; nur Farben werden zu Rollen):
```tsx
const tones: Record<Tone, string> = {
  // Manual-Bestand: solide Kreide-Plakette (inverse-surface) — maximal "offiziell"
  manual: "bg-inverse-surface text-inverse-on-surface",
  // Eigener Entwurf (privat)
  entwurf: "border-[1.5px] border-outline text-on-surface-variant",
  // Eigene öffentliche Übung — signal-bright als bewusster heller Akzent
  oeffentlich: "bg-primary/15 text-signal-bright border-[1.5px] border-primary/40",
  neutral: "border-[1.5px] border-outline text-on-surface-variant",
};
```

- [ ] **Step 4: Typecheck + Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: sauber.

- [ ] **Step 5: Visuelle Abnahme**

`/styleguide` Sektion „Badges & Chips": selektierter FilterChip = gefüllte secondary-container-Pille mit Häkchen; Badges in Rollen-Farben.

- [ ] **Step 6: Commit**

```bash
git add web/components/ui/Chip.tsx web/components/ui/Badge.tsx
git commit -m "refactor(ui): FilterChip selected (M3 secondary-container + Check), Badge auf Rollen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: ExerciseCard + FieldPlaceholder migrieren

**Files:**
- Modify: `web/components/ui/ExerciseCard.tsx`
- Modify: `web/components/ui/FieldPlaceholder.tsx`

- [ ] **Step 1: ExerciseCard — Farbutilities & Typo auf Rollen**

Nimm in `web/components/ui/ExerciseCard.tsx` exakt diese Ersetzungen vor:

1. Zeile 27 — `<Card className="group overflow-hidden transition-colors hover:border-chalk/45">`
   → `<Card className="group overflow-hidden transition-colors hover:border-on-surface/45">`
2. Zeile 30 — `... focus-visible:ring-signal"` → `... focus-visible:ring-primary"`
3. Zeile 33 — `... border-b border-chalk/15">` → `... border-b border-outline-variant">`
4. Zeilen 60–62 — den `<h3>` ersetzen durch:
   ```tsx
          <h3 className="type-title-medium text-on-surface transition-colors group-hover:text-primary">
            {ex.name}
          </h3>
   ```
5. Zeilen 63–65 — den Meta-`<p>` ersetzen durch:
   ```tsx
          <p className="type-label-small mt-1 text-on-surface-variant">
            {meta}
          </p>
   ```
(`Badge`, `KategorieChip`, `Card`, `FieldPlaceholder` werden bereits migriert genutzt — keine Doppelarbeit.)

- [ ] **Step 2: FieldPlaceholder — Surface-Rolle + on-surface-Stroke**

In `web/components/ui/FieldPlaceholder.tsx`:

1. Zeile 9 — `"flex items-center justify-center bg-rasen-850 chalk-hatch"`
   → `"flex items-center justify-center bg-surface-container chalk-hatch"`
   (`chalk-hatch` bleibt — dokumentierte Diagramm-Ausnahme.)
2. Zeile 18 — `stroke="var(--color-chalk)"` → `stroke="var(--color-on-surface)"`
   (on-surface = chalk; bleibt damit auf Rollen-Ebene statt Primitive.)

- [ ] **Step 3: Typecheck + Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: sauber.

- [ ] **Step 4: Commit**

```bash
git add web/components/ui/ExerciseCard.tsx web/components/ui/FieldPlaceholder.tsx
git commit -m "refactor(ui): ExerciseCard & FieldPlaceholder auf Rollen-Tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Styleguide — Color-Roles-Sektion

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Color-Roles-Sektion einfügen**

Ersetze die bestehende `<Section n="01" title="Farben">…</Section>` durch eine Foundations-Color-Roles-Sektion. Definiere oben in der Datei (bei den `swatches`) zusätzlich:
```tsx
const surfaceLadder = [
  ["surface", "bg-surface"],
  ["surface-container-lowest", "bg-surface-container-lowest"],
  ["surface-container-low", "bg-surface-container-low"],
  ["surface-container", "bg-surface-container"],
  ["surface-container-high", "bg-surface-container-high"],
  ["surface-container-highest", "bg-surface-container-highest"],
];
const accentRoles = [
  ["primary", "bg-primary"],
  ["primary-container", "bg-primary-container"],
  ["secondary", "bg-secondary"],
  ["secondary-container", "bg-secondary-container"],
  ["error", "bg-error"],
  ["error-container", "bg-error-container"],
  ["outline", "bg-outline"],
];
```
Und die Sektion:
```tsx
      <Section n="01" title="Color Roles">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Semantische M3-Rollen über der KiFu-Palette. Surface-Leiter =
          Elevation-Leiter. Signal ist der einzige warme Hue.
        </p>
        <p className="type-label-small mb-2 text-on-surface-variant">Surface-Leiter</p>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {surfaceLadder.map(([name, bg]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
            </div>
          ))}
        </div>
        <p className="type-label-small mb-2 text-on-surface-variant">Akzent & Rollen</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {accentRoles.map(([name, bg]) => (
            <div key={name} className="rounded-[4px] border border-outline p-3">
              <div className={`mb-2 h-14 w-full rounded-[2px] border border-outline-variant ${bg}`} />
              <p className="type-label-small text-on-surface">{name}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="type-label-small text-on-surface-variant">Alterskategorien:</span>
          {kategorienSlugs.map((k) => (
            <KategorieChip key={k} k={k} />
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber.

- [ ] **Step 3: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Color-Roles-Sektion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Styleguide — Elevation-Sektion

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Elevation-Sektion nach „02 Typografie" einfügen** (vorläufig als neue Sektion; Nummerierung wird in Task 16 final geordnet)

```tsx
      <Section n="E" title="Elevation">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Höhe über Surface-Container; Schatten erst ab Level 3. Der CTA-Schatten
          ist eine eigene Signatur (siehe Buttons), kein Elevation-Level.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["0", "bg-surface", ""],
            ["1", "bg-surface-container-low border border-outline", ""],
            ["2", "bg-surface-container border border-outline", ""],
            ["3", "bg-surface-container-high", "shadow-e3"],
            ["4", "bg-surface-container-highest", "shadow-e4"],
            ["5", "bg-surface-container-highest", "shadow-e5"],
          ].map(([lvl, surface, shadow]) => (
            <div key={lvl} className={`flex h-20 items-center justify-center rounded-[4px] ${surface} ${shadow}`}>
              <span className="type-label-medium text-on-surface">L{lvl}</span>
            </div>
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber.

- [ ] **Step 3: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Elevation-Sektion

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Styleguide — Typografie-Specimen (15 Rollen)

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Bestehende „02 Typografie"-Sektion durch vollständiges Specimen ersetzen**

```tsx
      <Section n="02" title="Typografie — M3 Type-Scale">
        <div className="space-y-3">
          {[
            ["type-display-large", "Display Large · Anton 57"],
            ["type-display-medium", "Display Medium · Anton 45"],
            ["type-display-small", "Display Small · Anton 36"],
            ["type-headline-large", "Headline Large · Anton 32"],
            ["type-headline-medium", "Headline Medium · Anton 28"],
            ["type-headline-small", "Headline Small · Anton 24"],
            ["type-title-large", "Title Large · Source Serif 600 · 22"],
            ["type-title-medium", "Title Medium · Source Serif 600 · 16"],
            ["type-title-small", "Title Small · Source Serif 600 · 14"],
            ["type-body-large", "Body Large · Source Serif · 16"],
            ["type-body-medium", "Body Medium · Source Serif · 14"],
            ["type-body-small", "Body Small · Source Serif · 12"],
            ["type-label-large", "Label Large · Space Mono · 14"],
            ["type-label-medium", "Label Medium · Space Mono · 12"],
            ["type-label-small", "Label Small · Space Mono · 11"],
          ].map(([cls, label]) => (
            <div key={cls} className="border-b border-outline-variant pb-3">
              <p className={`${cls} text-on-surface`}>{label}</p>
            </div>
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber; alle 15 Specimen rendern mit korrekter Font/Größe.

- [ ] **Step 3: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Typografie-Specimen (15 Type-Scale-Rollen)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Styleguide — Spacing-Rampe

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Spacing-Sektion einfügen**

```tsx
      <Section n="S" title="Spacing — 4-dp-Grid">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Kanonische Schritte: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Keine
          willkürlichen Pixelwerte.
        </p>
        <div className="space-y-2">
          {[
            ["1", "4px"], ["2", "8px"], ["3", "12px"], ["4", "16px"],
            ["6", "24px"], ["8", "32px"], ["12", "48px"], ["16", "64px"],
          ].map(([step, px]) => (
            <div key={step} className="flex items-center gap-3">
              <span className="type-label-small w-16 text-on-surface-variant">{px}</span>
              <div className="h-4 bg-primary" style={{ width: px }} />
              <span className="type-label-small text-on-surface-variant">space-{step}</span>
            </div>
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber.

- [ ] **Step 3: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Spacing-Rampe (4-dp-Grid)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Styleguide — Iconography-Sektion

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Imports ergänzen**

Oben in `web/app/styleguide/page.tsx`:
```tsx
import { IconButton } from "@/components/ui";
import {
  Search, SlidersHorizontal, Plus, X, ChevronDown, ChevronRight,
  Check, Lock, Globe, BookOpen, Trash2, User,
} from "lucide-react";
```
(`IconButton` zum bestehenden `@/components/ui`-Import hinzufügen.)

- [ ] **Step 2: Iconography-Sektion einfügen**

```tsx
      <Section n="I" title="Iconography — Lucide">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          Open-Source Lucide, outlined, Strich 2px. „Selected" über Farbe +
          State-Layer (statt Fill). Größen 20 / 24 / 40.
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-5 text-on-surface-variant">
          {[Search, SlidersHorizontal, Plus, X, ChevronDown, ChevronRight, Check, Lock, Globe, BookOpen, Trash2, User].map(
            (Icon, i) => <Icon key={i} size={24} strokeWidth={2} aria-hidden />,
          )}
        </div>
        <div className="flex items-center gap-4">
          <IconButton icon={Search} label="Suchen" />
          <IconButton icon={SlidersHorizontal} label="Filter" active />
          <IconButton icon={Plus} label="Hinzufügen" size="sm" />
          <span className="type-label-small text-on-surface-variant">
            default · aktiv (State-Layer) · sm
          </span>
        </div>
      </Section>
```

- [ ] **Step 3: Typecheck + Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: sauber; Icons + IconButton-Zustände sichtbar.

- [ ] **Step 4: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Iconography-Sektion (Lucide + IconButton)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Styleguide — Layout/Structure-Sektion

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Layout-Sektion einfügen**

```tsx
      <Section n="L" title="Layout & Structure">
        <p className="type-body-medium mb-5 max-w-xl text-on-surface-variant">
          M3 Window Size Classes & Body-Margins. Content-Max-Width für
          Lesbarkeit; Spalten-Grid 4 / 8 / 12.
        </p>
        <div className="space-y-2">
          {[
            ["compact", "< 600", "Margin 16 · 4 Spalten"],
            ["medium", "600–840", "Margin 24 · 8 Spalten"],
            ["expanded", "840–1200", "Margin 24 · 12 Spalten"],
            ["large", "1200–1600", "zentriert, Max-Width"],
            ["extra-large", "> 1600", "zentriert, Max-Width"],
          ].map(([cls, range, note]) => (
            <div key={cls} className="flex flex-wrap items-baseline gap-3 border-b border-outline-variant pb-2">
              <span className="type-title-small w-28 text-on-surface">{cls}</span>
              <span className="type-label-medium text-primary">{range}</span>
              <span className="type-body-small text-on-surface-variant">{note}</span>
            </div>
          ))}
        </div>
      </Section>
```

- [ ] **Step 2: Build verifizieren**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run build
```
Expected: sauber.

- [ ] **Step 3: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Layout/Structure-Sektion (Size-Classes)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Sektions-Reihenfolge ordnen + Header auf Rollen + Schlussverifikation

**Files:**
- Modify: `web/app/styleguide/page.tsx`

- [ ] **Step 1: Sektionen final nummerieren & ordnen**

Bringe die `<Section>`-Blöcke in die Reihenfolge gemäß Spec §9 und vergib `n="01"…"11"`:
01 Color Roles · 02 Typografie · 03 Elevation · 04 Spacing · 05 Iconography · 06 Layout/Structure · 07 Buttons · 08 Badges & Chips · 09 Filter (interaktiv) · 10 Übungskarten · 11 Methodischer Fahrplan. (Die in Tasks 11/13/14/15 vergebenen Platzhalter `n="E/S/I/L"` durch finale Nummern ersetzen.)

- [ ] **Step 2: Header-Texte auf Rollen-Tokens umstellen**

Im `<header>` `text-chalk`→`text-on-surface`, `text-chalk-dim`→`text-on-surface-variant`, `text-signal`→`text-primary`; Headline auf `type-display-large` und das Eyebrow-`<p>` auf `type-label-medium`. Den `Section`-Titel-`<h2>` auf `type-headline-small` und die Nummer auf `type-label-medium text-primary` setzen.

- [ ] **Step 3: Primitive-Leakage-Check**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && grep -rn -E "rasen-[0-9]|chalk(-dim|-faint)?\b|text-signal|bg-signal" components/ui app/styleguide app/page.tsx 2>/dev/null | grep -v -E "signal-bright|signal-dark|chalk-border|chalk-hatch"
```
Expected: **Keine** Treffer außer den dokumentierten Ausnahmen (`signal-bright`/`signal-dark` im CTA, `chalk-border`/`chalk-hatch`, `kat-*` in KategorieChip). Jeden verbliebenen Treffer auf eine Rolle umstellen oder im Code-Kommentar als bewusste Ausnahme begründen.

- [ ] **Step 4: Vollständige Schlussverifikation**

Run:
```bash
cd /Users/adrianbader/Dev/kifu/web && npm run typecheck && npm run build
```
Expected: beide grün.

- [ ] **Step 5: Visuelle Gesamt-Abnahme**

`npm run dev` → `/styleguide`: alle 11 Sektionen vollständig, in Rollen-Farben, Type-Specimen korrekt, Icons/IconButton-Zustände, Elevation-Leiter sichtbar. Primary-CTA-Schatten unverändert.

- [ ] **Step 6: Commit**

```bash
git add web/app/styleguide/page.tsx
git commit -m "feat(styleguide): Sektionen final geordnet + Header auf Rollen-Tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Abschluss

- Branch `feature/m3-designsystem` enthält alle Commits.
- `npm run typecheck` + `npm run build` grün.
- Styleguide unter `/styleguide` zeigt das vollständige M3-System.
- Nächster Schritt nach Review: PR gegen `main` (separat, auf Zuruf).
