-- ============================================================================
-- Story 2 (Epic #72): Vollständigkeitsregel je Hauptteilkategorie
-- ============================================================================
-- Die Hauptteilkategorie «Fussball spielen» ist das freie Spiel und trägt eine
-- Beschreibung im Feld `aufbau` statt des methodischen Fahrplans.
--
-- Reihenfolge in dieser Migration (Epic-NFR 4, CLAUDE.md forward-only): ERST
-- die alten Regeln lösen, DANN den Bestand bereinigen, DANN die neuen Regeln
-- setzen — alles atomar in einer Transaktion, damit nie ein Zustand entsteht,
-- in dem produktive Zeilen eine geltende Regel verletzen.
--
-- Das Lösen MUSS vor dem Backfill stehen: der Backfill räumt den Fahrplan einer
-- Hauptteil-Übung ab, und genau das verbietet die alte Regel
-- `ablauf_je_trainingsteil` («Hauptteil hat einen Fahrplan»). Auf einer leeren
-- CI-Datenbank fällt das nicht auf — es gibt keine solche Zeile —, auf Staging
-- und Prod dagegen scheiterte der Push daran (Lauf 32574394127 am 2026-08-22).

-- ----------------------------------------------------------------------------
-- 1) Alte Regeln lösen
-- ----------------------------------------------------------------------------
-- Beide werden weiter unten durch ihre kategorie-bewussten Nachfolger ersetzt;
-- innerhalb dieser Transaktion sieht keine andere Sitzung die Lücke.
alter table exercises drop constraint ablauf_je_trainingsteil;
alter table exercises drop constraint user_fahrplan_vollstaendig;

-- ----------------------------------------------------------------------------
-- 2) Backfill: «Fussball spielen»-Übungen ziehen ihren Ablauftext um
-- ----------------------------------------------------------------------------
-- PO-Entscheid 2026-08-22: die befüllten Fahrplan-Stufen werden in ihrer
-- Reihenfolge zu getrennten Absätzen zusammengeführt — ohne Textverlust und
-- ohne redaktionelle Eingriffe in fremden Text. Ein bereits vorhandener
-- aufbau-Text hat Vorrang (der Manual-Seed liefert die bereinigte Fassung).
update exercises
set aufbau = coalesce(
      nullif(btrim(aufbau), ''),
      nullif(btrim(concat_ws(
        E'\n\n',
        nullif(btrim(methodischer_fahrplan->>'offen_starten'), ''),
        nullif(btrim((
          select string_agg(stufe, E'\n\n')
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(methodischer_fahrplan->'ueben') = 'array'
                then methodischer_fahrplan->'ueben'
              else '[]'::jsonb
            end
          ) as t(stufe)
        )), ''),
        nullif(btrim(methodischer_fahrplan->>'wetteifern'), '')
      )), '')
    ),
    methodischer_fahrplan = null
where hauptteilkategorie = 'fussball-spielen'
  and methodischer_fahrplan is not null;

-- ----------------------------------------------------------------------------
-- 3) Ablauf-Form je Einordnung (ersetzt ablauf_je_trainingsteil)
-- ----------------------------------------------------------------------------
-- Neu kategorie-bewusst und mit Nicht-Leere-Prüfung auf dem Beschreibungstext
-- (PO: „vollständig heisst nicht leer"). Gilt für alle Quellen.
alter table exercises add constraint ablauf_je_einordnung check (
  case
    when hauptteilkategorie = 'fussball-spielen'
      then coalesce(btrim(aufbau), '') <> '' and methodischer_fahrplan is null
    when trainingsteil in ('einleitung', 'hauptteil')
      then methodischer_fahrplan is not null
    else coalesce(btrim(aufbau), '') <> ''
  end
);

-- ----------------------------------------------------------------------------
-- 4) Fahrplan-Vollständigkeit gilt neu für ALLE Quellen
-- ----------------------------------------------------------------------------
-- Der frühere Constraint nahm den Manual-Bestand aus, weil dort ueben/
-- wetteifern leer sein durften. Diese Ausnahme betraf genau eine Übung
-- (S. 81, Kategorie «Fussball spielen») — sie ist mit Schritt 1 in die
-- Beschreibung umgezogen. Damit kann die Regel quellenunabhängig gelten,
-- was Story 3 voraussetzt: die Fassung einer Manual-Übung im Training wird
-- nach denselben Regeln bewertet wie eine Trainer-Übung.
alter table exercises add constraint fahrplan_vollstaendig check (
  trainingsteil not in ('einleitung', 'hauptteil')
  -- NULL-sicherer Vergleich: `hauptteilkategorie = '…'` ergäbe bei Einleitungs-
  -- Übungen (Kategorie immer NULL) NULL, die ganze OR-Kette damit NULL — und ein
  -- CHECK lehnt nur FALSE ab. Ein unvollständiger Einleitungs-Fahrplan käme so
  -- ungeprüft durch.
  or hauptteilkategorie is not distinct from 'fussball-spielen'
  or (
    coalesce(methodischer_fahrplan->>'offen_starten', '') <> ''
    -- jsonb_typeof-Guard: schützt vor Fehler bei {"ueben": null} (JSON-null
    -- statt Array) — jsonb_array_length('null') würde sonst hart werfen.
    and jsonb_typeof(methodischer_fahrplan->'ueben') = 'array'
    and jsonb_array_length(methodischer_fahrplan->'ueben') >= 1
    and coalesce(methodischer_fahrplan->>'wetteifern', '') <> ''
  )
);
