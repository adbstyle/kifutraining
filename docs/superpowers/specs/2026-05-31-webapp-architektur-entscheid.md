# Architektur-Entscheid: Web-App (Teilprojekt 2)

**Datum:** 2026-05-31
**Status:** Entschieden (Grobarchitektur). Volles Spec folgt **nach** der Daten-Extraktion (Teilprojekt 1).

Diese Notiz hält die mit dem Auftraggeber getroffenen Architektur-Entscheidungen fest,
damit sie beim späteren Ausarbeiten des App-Specs nicht verloren gehen.

## Produktziel

Web-App, die alle Kinderfussball-Übungen anzeigt, filterbar macht und das Erstellen
eigener Übungen erlaubt.

## Getroffene Entscheidungen

- **Architektur:** Echte App mit Backend + Datenbank (nicht statisch).
- **Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres + Auth + Storage) ·
  Tailwind · Deployment auf Vercel.
- **Zugriffsmodell:** Öffentlich lesen (ansehen & filtern ohne Login); Login (Supabase
  Auth, Magic Link) nur zum Erstellen/Bearbeiten. Jeder bearbeitet nur seine eigenen
  Übungen; Manual-Übungen sind offiziell & schreibgeschützt.

## Daten-Beziehung Git ↔ DB

- Die **YAML in Git bleiben kanonisch** für die offiziellen Manual-Übungen (versioniert).
- Ein **Seed-Skript** importiert sie idempotent (Upsert per `id`) in Postgres
  (`quelle = manual`, `owner_id IS NULL`, in der UI read-only).
- **Selbst erstellte Übungen** leben nur in der DB (`quelle = user`, mit `owner_id`).

## Datenmodell (Postgres, Skizze)

- `exercises`: alle Felder des YAML-Schemas
  (`trainingsteil`, `erscheinungsform text[]`, `feldtyp`, `kategorien text[]`,
  `spielform`, `anzahl_kinder jsonb`, `material text[]`, `aufbau`, `ueben text[]`,
  `wetteifern`, `varianten text[]`, `bild_url`, `quelle`, `owner_id uuid null`, `thema`)
- `themen`: Themen-Metadaten (Ziele/Metaphern/Fragen)
- **Row Level Security:** SELECT für alle; INSERT/UPDATE/DELETE nur wenn
  `auth.uid() = owner_id`; Manual-Übungen (`owner_id IS NULL`) für niemanden änderbar.

## Seiten (MVP)

- `/` — Übungsliste mit Filter-Sidebar (Erscheinungsform, Feldtyp, Kategorie G/F/E,
  Spieleranzahl-Range, Trainingsteil, Volltextsuche) + Karten mit Diagramm
- `/uebung/[id]` — Detailansicht
- `/neu`, `/uebung/[id]/edit` — Formular (nur eingeloggt), optionaler Bild-Upload → Storage
- `/login` — Magic-Link

## Bewusst NICHT im MVP (YAGNI)

- Zeichen-Tool für Feld-Diagramme (eigene Übungen: vorerst optionaler Bild-Upload).
- Vereins-/Rollenverwaltung über das Owner-Modell hinaus.
- Trainingsplaner (mehrere Übungen zu einer Session bündeln) — mögliche spätere Phase.

## Filter-Vokabular

Kommt aus `data/vokabular.yaml` (mit-deployed), damit Dropdown-Werte und DB konsistent
mit den Schema-Enums bleiben.

## Nächster Schritt

Erst Teilprojekt 1 (Extraktion) umsetzen → echte Seed-Daten. Dann dieses Dokument zu
einem vollen App-Spec ausbauen (`brainstorming` → `writing-plans`).
