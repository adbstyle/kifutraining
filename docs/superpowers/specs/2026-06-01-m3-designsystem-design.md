# Design: M3-Designsystem für KiFu („Taktik-Editorial" auf Material-3-Struktur)

**Datum:** 2026-06-01
**Status:** Entwurf zur Umsetzung
**Bezug:** Styleguide `web/app/styleguide`, Token-Quelle `web/app/globals.css`, UI-Kit `web/components/ui`

## Ziel & Leitentscheidung

Das bestehende Designsystem „Taktik-Editorial" (Chalk-on-Rasen, Signalorange als
einziger warmer Akzent, Anton/Source-Serif/Space-Mono) erhält die **semantische
Struktur und Disziplin von Material 3** — ohne seine Identität aufzugeben.

**Strategie (bestätigt): Hybrid — M3-System, KiFu-Look.**
Wir übernehmen M3s *Struktur*: Color Roles, Elevation-Levels, State-Layers,
Type-Scale-Rollen, Spacing-Grid, Layout-Size-Classes, Lucide-Icons mit
M3-Handhabung. Wir behalten die KiFu-*Werte*: unsere Palette, unsere Fonts und
den harten taktischen CTA-Schatten als Signatur.

**Scheme (bestätigt): nur Dark, zukunftsfest benannt.** Rollen werden
scheme-neutral benannt; ein späteres Light-Scheme ist nur ein Token-Override,
kein Refactoring.

### Identitäts-Regeln (nicht verhandelbar)
1. **Signal ist der einzige warme Hue.** `secondary`/`tertiary` bleiben
   low-chroma (Chalk/Rasen-Töne) — kein Farb-Wildwuchs.
2. **`kat-g/f/e` bleiben eigenständig semantisch** (Alterskategorien) und werden
   nie als M3-`tertiary` zweckentfremdet.
3. **Der harte CTA-Schlagschatten** (`0 3px 0 0 signal-dark`) ist KiFu-Marke,
   *kein* M3-Elevation-Layer, und bleibt erhalten.

## 1. Token-Architektur: zwei Ebenen (M3 „ref → system")

- **Ebene 1 — Primitives (unverändert):** `--color-rasen-*`, `--color-chalk*`,
  `--color-signal*`, `--color-kat-*`. Tonale Referenz.
- **Ebene 2 — Rollen (neu):** semantische Tokens, die auf Ebene 1 zeigen
  (`--color-primary: var(--color-signal)`).
- **Komponenten konsumieren ab jetzt Ebene-2-Rollen**, nicht Primitives.
- Beide Ebenen liegen im `@theme`-Block von `globals.css` (Tailwind v4).

## 2. Color Roles (Dark)

| Rolle | Wert (Ebene 1 / Hex) | Zweck |
|---|---|---|
| `--color-primary` | signal `#ff5722` | CTAs, aktiver Zustand |
| `--color-on-primary` | rasen-950 `#0a1f15` | Text/Icon auf primary |
| `--color-primary-container` | signal-dark `#c43e15` | gefüllte Akzentfläche |
| `--color-on-primary-container` | chalk `#f4f1e8` | Text auf primary-container |
| `--color-secondary` | chalk-dim `#b9bcae` | ruhiger Zweitakzent (low-chroma) |
| `--color-on-secondary` | rasen-950 | Text auf secondary |
| `--color-secondary-container` | rasen-700 `#1e4d37` | dezente gefüllte Fläche |
| `--color-on-secondary-container` | chalk | Text darauf |
| `--color-error` | `#f87171` | Fehler/Löschen |
| `--color-on-error` | rasen-950 | Text auf error |
| `--color-error-container` | `#5c1d18` | Fehlerfläche |
| `--color-on-error-container` | `#fecaca` | Text darauf |
| `--color-surface` | rasen-950 `#0a1f15` | Basis-Hintergrund |
| `--color-surface-dim` | `#07160f` | abgedunkelte Fläche |
| `--color-surface-bright` | rasen-800 `#163a29` | aufgehellte Fläche |
| `--color-surface-container-lowest` | `#07160f` | tiefste Container-Fläche |
| `--color-surface-container-low` | rasen-900 `#0f2a1d` | Elevation 1 |
| `--color-surface-container` | rasen-850 `#133523` | Elevation 2 |
| `--color-surface-container-high` | rasen-800 `#163a29` | Elevation 3 |
| `--color-surface-container-highest` | rasen-700 `#1e4d37` | Elevation 4/5 |
| `--color-on-surface` | chalk `#f4f1e8` | Text primär |
| `--color-on-surface-variant` | chalk-dim `#b9bcae` | Text sekundär, Icons |
| `--color-outline` | chalk @ 28% (color-mix) | Ränder (= `chalk-border`) |
| `--color-outline-variant` | chalk @ 12% | dezente Trennlinien |
| `--color-inverse-surface` | chalk `#f4f1e8` | Snackbar/invertiert |
| `--color-inverse-on-surface` | rasen-950 | Text auf inverse-surface |
| `--color-inverse-primary` | signal-dark `#c43e15` | primary auf inverse |
| `--color-scrim` | `#000000` | Overlay-Abdunklung |
| `--color-shadow` | `#000000` | Schattenfarbe |

`secondary`/`tertiary`-Container-Slots werden bewusst low-chroma gehalten; ein
echtes `tertiary` (kühler Akzent) wird erst eingeführt, wenn ein konkreter
Bedarf entsteht (YAGNI).

## 3. Elevation (Dark, hybrid)

M3-Dark drückt Höhe primär über **hellere Surface** aus (Surface-Container-Leiter
= unsere Rasen-Leiter), ergänzt ab Level 3 um echten Schatten.

| Level | Fläche (Rolle) | Zusatz | Einsatz |
|---|---|---|---|
| 0 | `surface` | — | Body |
| 1 | `surface-container-low` | `outline`-Rand | Karten |
| 2 | `surface-container` | `outline`-Rand | Chips, SegmentedControl |
| 3 | `surface-container-high` | `0 2px 6px scrim/40%` | Dropdowns |
| 4 | `surface-container-highest` | `0 4px 12px scrim/50%` | Menüs |
| 5 | `surface-container-highest` | `0 8px 24px scrim/60%` + scrim | Dialoge |

Als Tokens `--elevation-1 … --elevation-5` (Box-Shadow-Strings) plus Konvention,
welche Surface-Rolle je Level genutzt wird. **Ausnahme:** Primary-CTA behält den
Signatur-Schatten (siehe Identitäts-Regel 3).

## 4. State-Layers (M3-Opazitäten)

Ersetzen die heutigen ad-hoc `hover:bg-chalk/5`-Stellen.

- `--state-hover`: `on-surface` @ 8 %
- `--state-focus`: `on-surface` @ 10 %
- `--state-pressed`: `on-surface` @ 10 %
- Auf primary-/aktiven Elementen: `primary`-basierte Variante derselben Opazitäten.

Angewandt auf: `IconButton`, Listeneinträge, `SegmentedControl`, `FilterChip`.

## 5. Typografie: M3 Type-Scale (15 Rollen) → KiFu-Fonts

Skala/Hierarchie nach M3; Fonts und Tracking KiFu-getunt (M3-Tracking-Werte
gehen von Roboto aus und passen nicht 1:1 auf Versal-Anton / Space-Mono).

| Rolle | Größe/Zeilenhöhe | Tracking | Font / Gewicht | Transform |
|---|---|---|---|---|
| `type-display-large` | 57 / 64 | 0.01em | Anton 400 | uppercase |
| `type-display-medium` | 45 / 52 | 0.01em | Anton 400 | uppercase |
| `type-display-small` | 36 / 44 | 0.012em | Anton 400 | uppercase |
| `type-headline-large` | 32 / 40 | 0.015em | Anton 400 | uppercase |
| `type-headline-medium` | 28 / 36 | 0.015em | Anton 400 | uppercase |
| `type-headline-small` | 24 / 32 | 0.015em | Anton 400 | uppercase |
| `type-title-large` | 22 / 28 | 0 | Source Serif 600 | — |
| `type-title-medium` | 16 / 24 | 0.01em | Source Serif 600 | — |
| `type-title-small` | 14 / 20 | 0.01em | Source Serif 600 | — |
| `type-body-large` | 16 / 24 | 0 | Source Serif 400 | — |
| `type-body-medium` | 14 / 20 | 0 | Source Serif 400 | — |
| `type-body-small` | 12 / 16 | 0.01em | Source Serif 400 | — |
| `type-label-large` | 14 / 20 | 0.08em | Space Mono 700 | uppercase |
| `type-label-medium` | 12 / 16 | 0.1em | Space Mono 700 | uppercase |
| `type-label-small` | 11 / 16 | 0.1em | Space Mono 400 | uppercase |

- **Umsetzung:** je Rolle eine Utility-Klasse in `globals.css` (`@utility`), die
  size/line-height/tracking/weight/family/transform bündelt.
- Die Basis-Regeln für `h1–h4` werden auf diese Rollen umgestellt (kein
  Doppel-System mit den bisherigen Inline-Klassen).

## 6. Iconography: Lucide, nach M3-Prinzipien

- **Library:** `lucide-react` (ISC-Lizenz, open source) — neue Dependency in
  `web/package.json`.
- **Größen:** `20` (dicht) · **`24` (default)** · `40` (groß), als Tokens.
- **Strich:** einheitlich `2px`, Default-Zustand **outlined** (Chalk-Line-Anmutung).
- **Zustände:** M3 wechselt outlined→filled bei „selected". Lucide ist
  outline-only → „selected" wird über `primary`-Farbe **+ State-Layer-Pille**
  emuliert (dokumentierte Anpassung, kein Fill).
- **Farbe:** Icons default `on-surface-variant`; aktiv `primary`.
- **Komponente:** schlanker `IconButton` (Touch-Ziel ≥ 40 px, State-Layer, a11y
  `aria-label`-Pflicht) plus Konvention für direkten Lucide-Einsatz.
- **Kuratiertes App-Set** (im Styleguide gezeigt): `Search`,
  `SlidersHorizontal` (Filter), `Plus`, `X`, `ChevronDown`, `ChevronRight`,
  `Check`, `Lock` (privat), `Globe` (öffentlich), `BookOpen` (Manual), `Trash2`,
  `User`.

## 7. Spacing: 4-dp-Grid

- Tailwind v4 ist bereits 4 px-basiert. Verbindlich kanonische Schritte:
  `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64` (Tailwind `1/2/3/4/6/8/12/16`).
- Keine willkürlichen Pixelwerte (`p-[13px]`) mehr.
- Primär Disziplin + Doku; Styleguide zeigt die Spacing-Rampe.

## 8. Layout-Struktur (M3 foundations/structure)

- **Window Size Classes:** compact `<600` · medium `600–840` · expanded
  `840–1200` · large `1200–1600` · xl `>1600`.
- **Body-Margins:** compact `16` · ab medium `24`.
- **Content-Max-Width:** für Lesbarkeit begrenzt (Styleguide nutzt `max-w-5xl`).
- **Spalten-Grid:** 4 (compact) / 8 (medium) / 12 (expanded).
- Breakpoint-Werte an die Size-Classes ausgerichtet; Styleguide-Sektion
  illustriert Margins + Grid.

## 9. Styleguide-Neuaufbau (`web/app/styleguide/page.tsx`)

**Foundations:**
1. Color Roles (gruppierte Swatches: primary-Gruppe, Surface-Leiter, outline,
   error-Gruppe, on-* Paare; Alterskategorien separat)
2. Elevation (Level 0–5 als Demo-Karten)
3. Typografie (vollständiges 15-Rollen-Specimen)
4. Spacing (4-dp-Rampe)
5. Iconography (Set + Größen + Zustände)
6. Layout/Structure (Breakpoints, Margins, Grid)

**Components (auf Rollen-Tokens migriert):**
7. Buttons · 8. Badges & Chips · 9. Filter (interaktiv) · 10. Übungskarten ·
11. Methodischer Fahrplan

## 10. Komponenten-Migration (gezielt, keine Neuschreibung)

- **Button:** M3-Emphase-Varianten `filled · tonal · elevated · outlined ·
  text` (+ `danger`), gespeist aus `--button-*`-Component-Tokens (M3-Stil,
  zeigen auf System-Rollen). `filled` behält den **harten CTA-Signatur-Schatten**,
  `elevated` trägt den weichen `shadow-e3/e4`. Shape KiFu-eckig (`--button-shape`).
  Label-Typo `type-label-large`.
- **ButtonGroup:** M3 Connected Button Group — verbundene Aktions-Buttons,
  Außenecken gerundet, Innenecken eckig (`role="group"`). Abgegrenzt von der
  `SegmentedControl` (Single-Select-Auswahl).
- **Card:** `elevation-1` (surface-container-low + outline).
- **SegmentedControl:** `elevation-2`; aktiver Tab `primary`/`on-primary`;
  State-Layer auf inaktiven Tabs; Label-Typo.
- **Chips (M3-Familie):** `FilterChip` (selected = `secondary-container` +
  `Check`, optionales führendes Icon), `AssistChip` (führendes Icon, optional
  `elevated` mit `shadow-e3/e4`), `SuggestionChip` (nur Label), `InputChip`
  (führendes Icon + Entfernen-`X`) — gespeist aus `--chip-*`-Component-Tokens
  (M3-Stil), Shape KiFu-Pill (`--chip-shape`). `KategorieChip` bleibt
  domänenspezifisch (`kat-*`).
- **Badge, ExerciseCard, FieldPlaceholder:** auf Rollen-Tokens umstellen;
  `chalk-hatch` bleibt als Diagramm-Platzhalter.

## 11. Verifikation

- `npm run typecheck` muss grün bleiben (CI-Gate).
- Visuelle Abnahme über die Styleguide-Seite (`/styleguide`) — alle Foundations-
  und Component-Sektionen vollständig und mit Rollen-Tokens gerendert.
- Keine automatisierten Visual-Tests im MVP; manuelle Review am Styleguide.
- Grep-Check: keine Komponente referenziert nach Migration noch Primitives
  (`rasen-`, `chalk` direkt) statt Rollen — Ausnahmen dokumentiert (z. B.
  `chalk-hatch`, CTA-Schatten).

## 12. Scope & Nicht-Ziele

- **In Scope:** Token-Architektur, Color Roles, Elevation, State-Layers,
  Type-Scale, Icons (Lucide), Spacing-Doku, Layout-Size-Classes,
  Styleguide-Neuaufbau, Migration der bestehenden UI-Komponenten.
- **Nicht-Ziele:** Light-Scheme (nur vorbereitet), echtes `tertiary`,
  Material-Motion/Transitions-System, neue Feature-Komponenten außerhalb des
  Kits, automatisierte Visual-Regression-Tests.
