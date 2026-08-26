-- ============================================================================
-- Story «Herkunftsangaben entfernen» (2026-08-25), Release 2: die Datenebene
-- ============================================================================
-- Release 1 hat Anzeige und Erfassung entfernt und ist seit 2026-08-26 auf
-- Produktion; kein Bundle liest oder schreibt die Herkunfts-Spalten mehr.
-- Damit ist NFR 1 erfüllt und dieser Drop im Deploy-Fenster ungefährlich —
-- in derselben Migration wie der Bundle-Swap hätte das alte Bundle in eben
-- diesem Fenster jede Trainings- und Übungsansicht verloren.
--
-- Der PO hat den restlosen Abbau am 2026-08-25 als bewussten Einzelfall gegen
-- die forward-only-Regel entschieden (CLAUDE.md, Story-Abschnitt 1): eine
-- stillgelegte Angabe, die niemand mehr sieht und niemand mehr pflegt, wäre
-- genau die Altlast, die diese Anwendung sich nicht leisten will. Nutzdaten
-- gehen dabei nicht verloren — die Angabe SELBST ist der Inhalt, der abgebaut
-- werden soll (PC 4).
--
-- Die beiden Trigger müssen zwingend MIT den Spalten fallen. Postgres trackt
-- die Abhängigkeit nicht: plpgsql löst Feldreferenzen erst zur Laufzeit auf,
-- der Drop bleibt also stumm — und danach scheitert JEDES Update auf exercises
-- bzw. training_exercises mit «record "old" has no field "herkunft_datum"».
-- Deshalb Reihenfolge Trigger → Funktion → Spalten.
--
-- Nicht betroffen: exercises.source (speist die bleibende Manual-Plakette,
-- Out of Scope 1), der Urheber eines Trainings und trainings.vorlage_id.
--
-- Kein explizites begin/commit: die Supabase-CLI klammert je Datei, damit ist
-- NFR 2 (kein halb abgebauter Zustand) ohne Zutun erfüllt.

-- ----------------------------------------------------------------------------
-- 1) Bestandsaufnahme vor dem Abbau
-- ----------------------------------------------------------------------------
-- Belegt, was hier tatsächlich verschwindet (NFR 2: «als vollständig
-- nachweisbar»). Die Zeilen landen dauerhaft im Deploy-Log der GitHub Action
-- und sind nach dem Drop nicht mehr erhebbar.
do $$
declare
  v_trainings_gesamt bigint;
  v_trainings_mit    bigint;
  v_te_gesamt        bigint;
  v_te_mit           bigint;
  v_ex_gesamt        bigint;
  v_ex_mit           bigint;
  v_ex_diagramm_mit  bigint;
begin
  select count(*), count(herkunft_name) into v_trainings_gesamt, v_trainings_mit
    from trainings;
  select count(*), count(herkunft_name) into v_te_gesamt, v_te_mit
    from training_exercises;
  select count(*), count(herkunft_name), count(diagramm_herkunft_name)
    into v_ex_gesamt, v_ex_mit, v_ex_diagramm_mit
    from exercises;

  raise notice 'Herkunfts-Abbau: trainings % von % Zeilen mit Herkunft',
    v_trainings_mit, v_trainings_gesamt;
  raise notice 'Herkunfts-Abbau: training_exercises % von % Zeilen mit Herkunft',
    v_te_mit, v_te_gesamt;
  raise notice 'Herkunfts-Abbau: exercises % von % Zeilen mit Herkunft, % mit Diagramm-Herkunft',
    v_ex_mit, v_ex_gesamt, v_ex_diagramm_mit;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2) Die Unveränderlichkeits-Regel entfällt
-- ----------------------------------------------------------------------------
-- Zuerst beide Trigger, dann die Funktion — ohne `cascade`, damit ein
-- übersehener weiterer Verwender die Migration abbrechen liesse, statt still
-- mitgerissen zu werden.
--
-- Davor eine Lock-Schranke: `drop column` braucht ACCESS EXCLUSIVE. Hängt eine
-- Session idle-in-transaction auf einer der drei Tabellen, stellt sich die DDL
-- in die Lock-Queue und blockiert ab da JEDEN neuen Lesezugriff darauf. Mit
-- Timeout bricht die Migration stattdessen sauber ab — der Deploy schlägt fehl
-- und ist nach dem Aufräumen der Blocker-Session unverändert wiederholbar.
--
-- Bewusst ohne `local`: die CLI führt die Datei zwar atomar aus, aber nicht in
-- einem Transaktions*block* im Sinne von Postgres. `set local` wirkt dort zwar,
-- protokolliert aber bei jedem Deploy die irreführende Warnung «SET LOCAL can
-- only be used in transaction blocks». Das einfache `set` reicht ebenso weit:
-- die CLI setzt den Sessionzustand zwischen Migrationsdateien zurück, die
-- Schranke endet also mit dieser Datei (beides mit CLI 2.115.0 gemessen).
set lock_timeout = '3s';

drop trigger te_herkunft_unveraenderlich on training_exercises;
drop trigger ex_herkunft_unveraenderlich on exercises;
drop function herkunft_unveraenderlich();

-- ----------------------------------------------------------------------------
-- 3) Die Spalten fallen (PC 4, NFR 3)
-- ----------------------------------------------------------------------------
-- Die zugehörigen CHECKs fallen automatisch mit ihrer Spalte und werden
-- deshalb NICHT einzeln gedroppt:
--   training_exercises: te_herkunft_vollstaendig,
--                       training_exercises_herkunft_typ_check
--   exercises:          ex_herkunft_vollstaendig,
--                       ex_diagramm_herkunft_vollstaendig,
--                       exercises_herkunft_typ_check,
--                       exercises_diagramm_herkunft_typ_check
--   trainings:          tr_herkunft_vollstaendig
alter table training_exercises
  drop column herkunft_name,
  drop column herkunft_typ,
  drop column herkunft_datum;

alter table exercises
  drop column herkunft_name,
  drop column herkunft_typ,
  drop column herkunft_datum,
  drop column diagramm_herkunft_name,
  drop column diagramm_herkunft_typ,
  drop column diagramm_herkunft_datum;

-- trainings trug nie einen Typ, nur Name und Datum der Ursprungs-Kopie.
alter table trainings
  drop column herkunft_name,
  drop column herkunft_datum;

-- ----------------------------------------------------------------------------
-- 4) Selbstprüfung: nichts bleibt zurück (NFR 3)
-- ----------------------------------------------------------------------------
-- Sucht in allen vier Formen, in denen ein Herkunfts-Artefakt überleben
-- könnte, und bricht die Migration ab, wenn eines gefunden wird. Findet die
-- Query nichts, liefert string_agg über null Zeilen NULL — genau das ist das
-- grüne Ergebnis.
do $$
declare
  v_funde text;
begin
  select string_agg(fund, ', ' order by fund) into v_funde from (
    -- (1) Spalten
    select format('Spalte %I.%I', table_name, column_name) as fund
      from information_schema.columns
     where table_schema = 'public'
       and column_name ilike '%herkunft%'
    union all
    -- (2) Constraints auf Relationen im Schema public — nach Name UND Definition
    select format('Constraint %I an %s', c.conname, c.conrelid::regclass)
      from pg_constraint c
      join pg_class rel on rel.oid = c.conrelid
      join pg_namespace n on n.oid = rel.relnamespace
     where n.nspname = 'public'
       and (c.conname ilike '%herkunft%'
            or pg_get_constraintdef(c.oid) ilike '%herkunft%')
    union all
    -- (3) Funktionen im Schema public — nach Name UND nach Rumpf
    select format('Funktion %I', p.proname)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and (p.proname ilike '%herkunft%' or p.prosrc ilike '%herkunft%')
    union all
    -- (4) Trigger (nur selbst angelegte, keine System-Trigger von Fremdschlüsseln)
    select format('Trigger %I an %s', t.tgname, t.tgrelid::regclass)
      from pg_trigger t
      join pg_class rel on rel.oid = t.tgrelid
      join pg_namespace n on n.oid = rel.relnamespace
     where not t.tgisinternal
       and n.nspname = 'public'
       and t.tgname ilike '%herkunft%'
  ) f;

  if v_funde is not null then
    raise exception 'Herkunfts-Abbau unvollständig, zurückgeblieben: %', v_funde;
  end if;

  raise notice 'Herkunfts-Abbau: Selbstprüfung grün, kein Artefakt zurückgeblieben';
end;
$$;
