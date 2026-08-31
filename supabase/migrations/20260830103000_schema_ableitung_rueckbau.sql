set lock_timeout = '5s';

-- ============================================================================
-- Story 1 (Epic Übungswelten): Die Schema-Ableitung fällt
-- ============================================================================
-- Bis hierher war das Trainingsschema eine Ableitung aus den Alterskategorien
-- (`training_schema`), und ein Training konnte die Altersstufe wechseln —
-- mitsamt automatischer Umordnung aller Fassungen, einer Konserve für den
-- Rückweg und der «Nacharbeit» für alles, was im Zielschema keinen Platz fand.
-- Der Product Owner hat den Wechsel am 2026-08-30 ersatzlos gestrichen; damit
-- verlieren Umordnung, Konserve und Nacharbeit ihren einzigen Anwendungsfall.
--
-- Reihenfolge zwingend Trigger → Funktion → Spalte: Postgres trackt die
-- Abhängigkeit eines plpgsql-Rumpfs auf Spalten und Funktionen nicht. Ein
-- übersehener Verwender soll die Migration abbrechen lassen, statt still
-- mitgerissen zu werden — darum kein `cascade`.
--
-- Der Abbau ist wie beim Herkunfts-Abbau ein bewusster Einzelfall gegen die
-- forward-only-Regel: die Konserven-Spalten sind ein Gedächtnis für einen
-- Vorgang, den es nicht mehr gibt. Nutzdaten gehen nicht verloren — die
-- vorangegangene Bereinigungs-Migration hat sie ohnehin schon geleert.

-- ----------------------------------------------------------------------------
-- 1) Die beiden Schema-Gates
-- ----------------------------------------------------------------------------
-- Sie hielten Einordnung und Alterskategorien eines Trainings zusammen. Diese
-- Aufgabe übernehmen jetzt die CHECKs `te_trainingsteil_je_altersstufe` und
-- `training_stufen_je_altersstufe` — beide an der Zeile selbst, ohne zweite
-- Tabelle und ohne aufgeschobene Prüfung.
drop trigger te_schema_gate on training_exercises;
drop function training_exercise_schema_gate();

drop trigger trainings_schema_gate on trainings;
drop function trainings_schema_gate();

-- ----------------------------------------------------------------------------
-- 2) Der Stufen-Setzer
-- ----------------------------------------------------------------------------
-- Ersatzlos: Ohne Altersstufen-Wechsel bleibt nichts zu übertragen. Die
-- Applikation setzt die Alterskategorien künftig per direktem UPDATE; die
-- Berechtigung trägt die RLS-Policy `tr_update`, den Wertebereich der CHECK.
drop function set_training_stufen(uuid, text[]);

-- ----------------------------------------------------------------------------
-- 3) Die Ableitungs-Funktionen
-- ----------------------------------------------------------------------------
-- `training_schema` erriet die Altersstufe aus den Alterskategorien,
-- `training_schema_der_einordnung` aus dem Trainingsteil. Beide sind durch die
-- geführte Angabe `altersstufe` ersetzt (AC 3).
drop function training_schema(text[]);
drop function training_schema_der_einordnung(text);

-- ----------------------------------------------------------------------------
-- 4) Die Konserve
-- ----------------------------------------------------------------------------
-- Sie merkte sich die verlassene Einordnung, damit der Rückwechsel verlustfrei
-- blieb. Ohne Wechsel gibt es keinen Rückweg zu sichern.
alter table training_exercises
  drop column einordnung_vorher,
  drop column hauptteilkategorie_vorher;

-- ----------------------------------------------------------------------------
-- 5) Veröffentlichungs-Bedingungen je Altersstufe
-- ----------------------------------------------------------------------------
-- Verzweigt neu über `trainings.altersstufe` statt über die geratene
-- Schema-Ableitung. Zwei fachliche Änderungen:
--
--   * Die Nacharbeit-Bedingung entfällt — der Zustand kann nicht mehr
--     entstehen.
--   * Mindestens eine Alterskategorie gilt in BEIDEN Altersstufen. Bisher trug
--     der Junioren-Zweig sie nicht, weil ein Junioren-Training seine
--     Alterskategorie per Definition der Schema-Ableitung schon hatte. Diese
--     Definition ist weg: Ein Junioren-Training ohne Alterskategorie ist jetzt
--     möglich, und es soll nicht veröffentlichbar sein (PO 2026-08-30).
--
-- Die Funktion bleibt die einzige Quelle: das Öffentlich-Gate
-- (`training_pruefe_oeffentlich`) und die Vorabmeldung der Applikation nennen
-- dieselbe Regel.
create or replace function training_fehlende_bedingungen(p_training_id uuid)
returns text[]
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_stufen text[];
  v_altersstufe text;
  v_missing text[] := '{}';
  v_block text;
begin
  select stufen, altersstufe into v_stufen, v_altersstufe
    from trainings where id = p_training_id;
  if v_altersstufe is null then
    return v_missing; -- Training weg: nichts zu prüfen.
  end if;

  -- In beiden Altersstufen: mindestens eine Alterskategorie.
  if coalesce(array_length(v_stufen, 1), 0) = 0 then
    v_missing := array_append(v_missing, 'stufe');
  end if;

  if v_altersstufe = 'kinderfussball' then
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id and trainingsteil = 'einleitung') then
      v_missing := array_append(v_missing, 'einleitung');
    end if;
    -- Das freie Spiel liegt im Hauptteil: diese Bedingung deckt «mindestens
    -- eine Übung im Hauptteil» zwingend mit ab.
    if not exists (select 1 from training_exercises
                   where training_id = p_training_id
                     and hauptteilkategorie = 'fussball-spielen') then
      v_missing := array_append(v_missing, 'freies_spiel');
    end if;
  else
    -- Der Spiel-Block fehlt bewusst: als freies Spiel ist er von der Pflicht
    -- ausgenommen und behält nur den Hinweis.
    foreach v_block in array array[
      'jun-aufwaermen','jun-spielform-trainingsziel','jun-explosivitaet',
      'jun-spielformen','jun-ausklang']
    loop
      if not exists (select 1 from training_exercises
                     where training_id = p_training_id and trainingsteil = v_block) then
        v_missing := array_append(v_missing, v_block);
      end if;
    end loop;
  end if;

  return v_missing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) Mindestens eine Alterskategorie, ab dem Anlegen
-- ----------------------------------------------------------------------------
-- «Mindestens eine, immer — nicht erst beim Veröffentlichen» (PO 2026-08-30).
-- Bewusst NUR für neue Zeilen: bestehende Trainings ohne Alterskategorie
-- bleiben bearbeitbar, sie können bloss nicht veröffentlicht werden. Ein CHECK
-- ginge darum nicht — der gälte auch für jedes UPDATE einer Altzeile.
--
-- BEFORE INSERT statt eines aufgeschobenen Constraint-Triggers: die Bedingung
-- hängt allein an der neuen Zeile, es gibt keinen Zwischenzustand zu tolerieren,
-- und der Abbruch soll vor dem Schreiben kommen.
create function trainings_stufe_pflicht() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if coalesce(array_length(new.stufen, 1), 0) = 0 then
    raise exception 'STUFE_FEHLT: ein neues Training braucht mindestens eine Alterskategorie';
  end if;
  return new;
end;
$$;

create trigger trainings_stufe_pflicht
  before insert on trainings
  for each row execute function trainings_stufe_pflicht();

-- ----------------------------------------------------------------------------
-- 7) Selbstprüfung: nichts bleibt zurück
-- ----------------------------------------------------------------------------
-- Sucht in allen drei Formen, in denen ein Artefakt der Schema-Ableitung
-- überleben könnte. Ein Fund rollt die ganze Datei zurück; ein erfolgreicher
-- Deploy ist damit die Aussage «restlos abgebaut».
do $$
declare
  v_funde text;
begin
  select string_agg(fund, ', ' order by fund) into v_funde from (
    -- (1) Die abgebauten Funktionen — nach Name UND nach Rumpf, damit auch ein
    --     übersehener Aufrufer auffällt.
    (select format('Funktion %I', p.proname) as fund
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and (p.proname in ('training_schema','training_schema_der_einordnung',
                           'set_training_stufen',
                           'training_exercise_schema_gate','trainings_schema_gate')
             or p.prosrc like '%training_schema(%'
             or p.prosrc like '%set_training_stufen%'
             or p.prosrc like '%einordnung_vorher%'
             or p.prosrc like '%nacharbeit%'))
    union all
    -- (2) Die Konserven-Spalten
    (select format('Spalte %I.%I', table_name, column_name)
       from information_schema.columns
      where table_schema = 'public'
        and column_name in ('einordnung_vorher','hauptteilkategorie_vorher'))
    union all
    -- (3) Der Wert `nacharbeit` in Constraints und Daten
    (select format('Constraint %I an %s', c.conname, c.conrelid::regclass)
       from pg_constraint c
       join pg_class rel on rel.oid = c.conrelid
       join pg_namespace nn on nn.oid = rel.relnamespace
      where nn.nspname = 'public'
        and pg_get_constraintdef(c.oid) like '%nacharbeit%')
    union all
    (select 'Fassung mit Einordnung nacharbeit'
       from training_exercises where trainingsteil = 'nacharbeit' limit 1)
  ) f;

  if v_funde is not null then
    raise exception 'Rückbau der Schema-Ableitung unvollständig, zurückgeblieben: %', v_funde;
  end if;
end;
$$;

reset lock_timeout;
