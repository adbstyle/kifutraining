-- ============================================================================
-- Story 3 (Epic #72): Datenmodell für Fassungen mit Herkunftsangabe
-- ============================================================================
-- Die Zuordnung IST die Fassung: `training_exercises` trägt die Übungsinhalte
-- künftig selbst, statt sie live aus `exercises` zu joinen (Spike Gate 1).
-- Damit hängt ein Training von keiner Bibliotheks-Übung mehr ab.
--
-- Konstruktive Folgen des Modells:
--   * Fassungen können nie in Katalog, Suche oder Favoriten auftauchen — diese
--     Pfade lesen ausschliesslich `exercises` (Erfolgskriterium 7).
--   * Die Zugriffsregeln erben vollständig vom Training (bestehende te_*-
--     Policies); die Manual-Schreibsperre gilt für Fassungen nicht, genau das
--     macht Manual-Übungen im Training anpassbar.
--   * Der Manual-Seed schreibt nur `exercises` und kann keine Fassungen
--     erzeugen (NFR 5).
--
-- Die Inhaltsspalten sind nullable: der Bestand wird erst in der Überführungs-
-- Migration befüllt (Story 9). Bis dahin bleibt `exercise_id` bestehen und die
-- App liest weiter über den Join — kein Zwischenzustand ohne Inhalte.

-- ----------------------------------------------------------------------------
-- 1) Inhaltsfelder der Fassung
-- ----------------------------------------------------------------------------
-- Spiegelt die inhaltlichen Felder einer Trainer-Übung. Bewusst NICHT dabei:
-- slug, source, owner_id, visibility, search_text (Bibliotheks-Belange) sowie
-- trainingsteil/hauptteilkategorie/position/duration_min (liegen bereits hier).
alter table training_exercises
  add column name text,
  add column kategorien text[] not null default '{}',
  add column erscheinungsform text[] not null default '{}',
  add column feldtyp text check (feldtyp in ('kleinfeld','grossfeld','freies_feld')),
  add column anzahl_kinder jsonb,
  add column material text[] not null default '{}',
  add column methodischer_fahrplan jsonb,
  add column aufbau text,
  add column varianten text[] not null default '{}',
  add column bild_url text,
  add column bild_quelle text check (bild_quelle in ('foto','diagramm')),
  add column diagramm jsonb,
  add column herkunft_name text,
  add column herkunft_typ text check (herkunft_typ in ('manual','community','eigen')),
  add column herkunft_datum timestamptz;

-- Herkunft ist entweder vollständig gestempelt oder gar nicht (halbe Stempel
-- wären in der Anzeige nicht darstellbar).
alter table training_exercises add constraint te_herkunft_vollstaendig check (
  (herkunft_name is null and herkunft_typ is null and herkunft_datum is null)
  or (herkunft_name is not null and herkunft_typ is not null and herkunft_datum is not null)
);

-- ----------------------------------------------------------------------------
-- 2) Herkunft an Bibliotheks-Übungen und Diagramm-Kopien
-- ----------------------------------------------------------------------------
-- Zwei unabhängige Angaben (Story 6 AK 9): die Übung kann aus einer Fassung
-- übernommen sein (Story 7), ihr Diagramm zusätzlich aus einer Diagramm-Vorlage.
alter table exercises
  add column herkunft_name text,
  add column herkunft_typ text check (herkunft_typ in ('manual','community','eigen')),
  add column herkunft_datum timestamptz,
  add column diagramm_herkunft_name text,
  add column diagramm_herkunft_typ text check (diagramm_herkunft_typ in ('manual','community','eigen')),
  add column diagramm_herkunft_datum timestamptz;

alter table exercises add constraint ex_herkunft_vollstaendig check (
  (herkunft_name is null and herkunft_typ is null and herkunft_datum is null)
  or (herkunft_name is not null and herkunft_typ is not null and herkunft_datum is not null)
);
alter table exercises add constraint ex_diagramm_herkunft_vollstaendig check (
  (diagramm_herkunft_name is null and diagramm_herkunft_typ is null
     and diagramm_herkunft_datum is null)
  or (diagramm_herkunft_name is not null and diagramm_herkunft_typ is not null
     and diagramm_herkunft_datum is not null)
);

-- ----------------------------------------------------------------------------
-- 3) Unveränderlichkeit der Herkunft (Story 3 AK 6)
-- ----------------------------------------------------------------------------
-- Abgewiesen wird nur die echte WERTänderung eines bereits gesetzten Stempels
-- (`is distinct from`): das erstmalige Stempeln aus NULL heraus bleibt möglich
-- — die Überführung und die Diagramm-Übernahme stempeln nachträglich. Ein
-- Update, das dieselben Werte mitschreibt, darf nicht scheitern, sonst bricht
-- jede RPC, die pauschal alle Spalten setzt.
create or replace function herkunft_unveraenderlich() returns trigger
language plpgsql as $$
begin
  if old.herkunft_datum is not null and (
       new.herkunft_name  is distinct from old.herkunft_name
    or new.herkunft_typ   is distinct from old.herkunft_typ
    or new.herkunft_datum is distinct from old.herkunft_datum
  ) then
    raise exception 'Die Herkunftsangabe ist unveränderlich';
  end if;
  return new;
end;
$$;

create trigger te_herkunft_unveraenderlich before update on training_exercises
  for each row execute function herkunft_unveraenderlich();
create trigger ex_herkunft_unveraenderlich before update on exercises
  for each row execute function herkunft_unveraenderlich();

-- Die Diagramm-Herkunft ist BEWUSST veränderlich — anders als die Herkunft der
-- Fassung oder der Übung selbst. Grund: sie beschreibt nicht die Entstehung des
-- Datensatzes, sondern die Quelle seines aktuellen Diagramms. Übernimmt der
-- Trainer eine andere Diagramm-Vorlage, wechselt diese Quelle tatsächlich; ein
-- festgeschriebener Stempel würde dann eine falsche Aussage machen und die
-- zweite Übernahme überhaupt verhindern.

-- ----------------------------------------------------------------------------
-- 4) Freie Einordnung der Fassung (Story 3 AK 10)
-- ----------------------------------------------------------------------------
-- Der Guard erzwang bisher, dass Trainingsteil und Hauptteilkategorie der
-- Zuordnung mit der referenzierten Übung übereinstimmen, und übernahm die
-- Kategorie als Snapshot. Beides entfällt: die Einordnung einer Fassung ist
-- frei änderbar, eine Abweichung von der Vorlage blockiert nichts und wird
-- nicht gesondert angezeigt (Erfolgskriterium 9, revidiert am 2026-08-22).
-- Erhalten bleibt die Invariante «Kategorie genau bei Hauptteil»: ausserhalb
-- des Hauptteils wird sie zwangsweise geleert, damit der Biconditional-CHECK
-- auch bei einem Trainingsteil-Wechsel hält.
create or replace function training_exercise_phase_guard() returns trigger
language plpgsql as $$
begin
  if new.trainingsteil <> 'hauptteil' then
    new.hauptteilkategorie := null;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Technischen Schuldenposten schliessen (Story 3 AK 9)
-- ----------------------------------------------------------------------------
-- Der Biconditional-CHECK auf der Zuordnung ist seit seiner Anlage NOT VALID
-- (damals: Altbestand ungeprüft). Der Trigger hat die Invariante seither
-- durchgesetzt, der Bestand erfüllt sie also — jetzt validieren, damit die
-- Fassungs-Einordnung auf einer geprüften Invariante aufsetzt.
alter table training_exercises validate constraint training_ex_hkat_genau_bei_hauptteil;
