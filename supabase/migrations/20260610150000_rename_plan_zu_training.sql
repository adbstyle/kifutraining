-- ============================================================================
-- Begriffs-Rename: „Trainingsplan" -> „Training"
-- ============================================================================
-- Das Domänenobjekt ist fachlich eine einzelne Trainingseinheit (SFV:
-- „Trainingslektion"), kein Plan über mehrere Einheiten. Der Begriff wird
-- durchgängig auf „Training/Trainings" umgestellt:
--   training_plans  -> trainings
--   plan_exercises  -> training_exercises (Spalte plan_id -> training_id)
-- Pre-launch: destruktiver Rename zulässig (CLAUDE.md Lifecycle-Modus); RENAME
-- erhält Bestandsdaten ohnehin. ALTER ... RENAME zieht FKs/Indizes/Trigger/
-- Policies automatisch mit (OID-basiert) — nur plpgsql-Funktions-Bodies
-- referenzieren Tabellen als Text und müssen neu erstellt werden.

-- ----------------------------------------------------------------------------
-- 1) Tabellen + Spalte
-- ----------------------------------------------------------------------------
alter table training_plans rename to trainings;
alter table plan_exercises rename to training_exercises;
alter table training_exercises rename column plan_id to training_id;

-- ----------------------------------------------------------------------------
-- 2) Constraints (Namen tragen den alten Tabellen-/Spaltennamen weiter)
-- ----------------------------------------------------------------------------
alter table trainings rename constraint training_plans_pkey to trainings_pkey;
alter table trainings rename constraint training_plans_owner_id_fkey to trainings_owner_id_fkey;
alter table trainings rename constraint training_plans_visibility_check to trainings_visibility_check;
alter table trainings rename constraint plan_valid_stufen to training_valid_stufen;

alter table training_exercises rename constraint plan_exercises_pkey to training_exercises_pkey;
alter table training_exercises rename constraint plan_exercises_plan_id_fkey to training_exercises_training_id_fkey;
alter table training_exercises rename constraint plan_exercises_exercise_id_fkey to training_exercises_exercise_id_fkey;
alter table training_exercises rename constraint plan_exercises_trainingsteil_check to training_exercises_trainingsteil_check;
alter table training_exercises rename constraint plan_exercises_duration_min_check to training_exercises_duration_min_check;
alter table training_exercises rename constraint plan_exercises_hauptteilkategorie_check to training_exercises_hauptteilkategorie_check;
alter table training_exercises rename constraint plan_ex_hkat_genau_bei_hauptteil to training_ex_hkat_genau_bei_hauptteil;

-- ----------------------------------------------------------------------------
-- 3) Indizes
-- ----------------------------------------------------------------------------
alter index plan_exercises_plan_idx rename to training_exercises_training_idx;
alter index plan_exercises_exercise_idx rename to training_exercises_exercise_idx;
alter index plans_owner_idx rename to trainings_owner_idx;
alter index plans_search_text_trgm_idx rename to trainings_search_text_trgm_idx;
alter index plans_stufen_idx rename to trainings_stufen_idx;
alter index plan_ex_pos_nonhauptteil rename to training_ex_pos_nonhauptteil;
alter index plan_ex_pos_hauptteil rename to training_ex_pos_hauptteil;

-- ----------------------------------------------------------------------------
-- 4) Trigger + Policies
-- ----------------------------------------------------------------------------
alter trigger plans_set_updated_at on trainings rename to trainings_set_updated_at;
alter trigger plans_search on trainings rename to trainings_search;
alter trigger plan_enforce_publishable_trg on trainings rename to training_enforce_publishable_trg;
alter trigger plan_exercise_phase on training_exercises rename to training_exercise_phase;
alter trigger plan_exercises_touch on training_exercises rename to training_exercises_touch;

alter policy pl_select on trainings rename to tr_select;
alter policy pl_insert on trainings rename to tr_insert;
alter policy pl_update on trainings rename to tr_update;
alter policy pl_delete on trainings rename to tr_delete;
alter policy pe_select on training_exercises rename to te_select;
alter policy pe_insert on training_exercises rename to te_insert;
alter policy pe_update on training_exercises rename to te_update;
alter policy pe_delete on training_exercises rename to te_delete;

-- ----------------------------------------------------------------------------
-- 5) Trigger-Funktionen: umbenennen (OID bleibt, Trigger-Bindung intakt) und
--    Body mit neuen Tabellen-/Spaltennamen neu setzen
-- ----------------------------------------------------------------------------
alter function plans_search_refresh() rename to trainings_search_refresh;
alter function plan_exercise_phase_guard() rename to training_exercise_phase_guard;
alter function plan_exercises_touch_plan() rename to training_exercises_touch_training;
alter function plan_enforce_publishable() rename to training_enforce_publishable;

create or replace function trainings_search_refresh() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- lower(unaccent(name)) -> die App normalisiert den Suchbegriff identisch,
  -- bevor sie per ILIKE '%begriff%' matcht (lib/queries/trainings.ts).
  new.search_text := lower(unaccent(coalesce(new.name, '')));
  return new;
end;
$$;

create or replace function training_exercise_phase_guard() returns trigger
language plpgsql as $$
declare
  v_hkat text;
begin
  if new.exercise_id is not null then
    if not exists (
      select 1 from exercises e
      where e.id = new.exercise_id and e.trainingsteil = new.trainingsteil
    ) then
      raise exception
        'Übung % passt nicht zum Trainingsteil % der Phase', new.exercise_id, new.trainingsteil;
    end if;
    -- Platzhalter-Name sicherstellen (Fallback, falls die App ihn nicht setzt).
    if coalesce(new.exercise_name_cache, '') = '' then
      new.exercise_name_cache := (select name from exercises e where e.id = new.exercise_id);
    end if;
    -- Kategorie aus der Übung als Snapshot übernehmen (nur Hauptteil trägt eine).
    if new.trainingsteil = 'hauptteil' then
      select hauptteilkategorie into v_hkat from exercises e where e.id = new.exercise_id;
      new.hauptteilkategorie := v_hkat;
    end if;
  end if;
  -- Kategorie ausschliesslich bei Hauptteil-Zuordnungen; sonst immer NULL —
  -- unabhängig von exercise_id, damit auch Platzhalter-Zeilen den Biconditional-
  -- CHECK erfüllen (Hauptteil-Platzhalter behalten ihren bestehenden Snapshot).
  if new.trainingsteil <> 'hauptteil' then
    new.hauptteilkategorie := null;
  end if;
  return new;
end;
$$;

create or replace function training_exercises_touch_training() returns trigger
language plpgsql as $$
begin
  update trainings set updated_at = now()
   where id = coalesce(new.training_id, old.training_id);
  return null;
end;
$$;

create or replace function training_enforce_publishable() returns trigger
language plpgsql as $$
begin
  if new.visibility = 'public' then
    if coalesce(array_length(new.stufen, 1), 0) = 0
       or not exists (
         select 1 from training_exercises
         where training_id = new.id and trainingsteil = 'einleitung')
       or not exists (
         select 1 from training_exercises
         where training_id = new.id and trainingsteil = 'hauptteil') then
      new.visibility := 'private';
    end if;
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6) RPCs: Parameternamen ändern sich (p_plan_id -> p_training_id), das kann
--    CREATE OR REPLACE nicht — daher Drop + Neuanlage + Grants
-- ----------------------------------------------------------------------------
drop function publish_plan(uuid, boolean);
drop function unpublish_plan(uuid);
drop function move_plan_exercise(uuid, int);

-- publish_training: Vollständigkeitsprüfung + Namen der betroffenen Übungen.
-- Status:
--   incomplete         -> {missing:[...]} (stufe/einleitung/hauptteil), keine Mutation
--   needs_confirmation -> {count, names:[...]} eigener privater Übungen, keine Mutation
--   published          -> Training (und ggf. eigene private Übungen) auf public
create function publish_training(p_training_id uuid, p_include_private boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_private_count int;
  v_names text[];
  v_missing text[] := '{}';
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from trainings where id = p_training_id and owner_id = v_uid
  ) then
    raise exception 'training not found or not owned by caller';
  end if;

  -- Vollständigkeit (#26 AC3): mind. eine Stufe, Einleitung + Hauptteil belegt.
  if not exists (
    select 1 from trainings
    where id = p_training_id and coalesce(array_length(stufen, 1), 0) >= 1
  ) then
    v_missing := array_append(v_missing, 'stufe');
  end if;
  if not exists (
    select 1 from training_exercises where training_id = p_training_id and trainingsteil = 'einleitung'
  ) then
    v_missing := array_append(v_missing, 'einleitung');
  end if;
  if not exists (
    select 1 from training_exercises where training_id = p_training_id and trainingsteil = 'hauptteil'
  ) then
    v_missing := array_append(v_missing, 'hauptteil');
  end if;
  if array_length(v_missing, 1) >= 1 then
    return jsonb_build_object('status', 'incomplete', 'missing', to_jsonb(v_missing));
  end if;

  -- Betroffene eigene PRIVATE Übungen (Manual/fremde/Platzhalter zählen nicht).
  select count(distinct e.id),
         coalesce(array_agg(distinct e.name) filter (where e.name is not null), '{}')
    into v_private_count, v_names
  from training_exercises te
  join exercises e on e.id = te.exercise_id
  where te.training_id = p_training_id
    and e.owner_id = v_uid
    and e.visibility = 'private';

  if v_private_count > 0 and not p_include_private then
    return jsonb_build_object(
      'status', 'needs_confirmation',
      'count', v_private_count,
      'names', to_jsonb(v_names));
  end if;

  if v_private_count > 0 and p_include_private then
    update exercises set visibility = 'public'
      where id in (
        select distinct e.id
        from training_exercises te
        join exercises e on e.id = te.exercise_id
        where te.training_id = p_training_id
          and e.owner_id = v_uid
          and e.visibility = 'private'
      );
  end if;

  update trainings set visibility = 'public' where id = p_training_id;
  return jsonb_build_object('status', 'published');
end;
$$;

-- unpublish_training: öffentliches Training -> privat (#26 AC4). Mitveröffent-
-- lichte Übungen bleiben öffentlich (Story #14 Postcondition 4) — bewusst kein
-- Zurück-Privatisieren der Übungen.
create function unpublish_training(p_training_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  update trainings set visibility = 'private'
    where id = p_training_id and owner_id = v_uid;
end;
$$;

-- move_training_exercise: Umsortieren innerhalb des Trainingsteils bzw. der
-- Hauptteil-Unterkategorie. Der Nachbar wird auf dieselbe hauptteilkategorie
-- eingeschränkt; für andere Trainingsteile ist sie NULL — `is not distinct
-- from` matcht dann wie bisher alle Zeilen des Trainingsteils.
create function move_training_exercise(p_training_exercise_id uuid, p_dir int)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_training uuid;
  v_teil text;
  v_hkat text;
  v_pos int;
  v_other uuid;
  v_other_pos int;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select te.training_id, te.trainingsteil, te.hauptteilkategorie, te.position
    into v_training, v_teil, v_hkat, v_pos
  from training_exercises te
  join trainings t on t.id = te.training_id
  where te.id = p_training_exercise_id and t.owner_id = v_uid;
  if v_training is null then
    raise exception 'training exercise not found or not owned by caller';
  end if;

  if p_dir < 0 then
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position < v_pos
    order by position desc limit 1;
  else
    select id, position into v_other, v_other_pos
    from training_exercises
    where training_id = v_training and trainingsteil = v_teil
      and hauptteilkategorie is not distinct from v_hkat
      and position > v_pos
    order by position asc limit 1;
  end if;

  -- Am Rand: kein Nachbar -> nichts zu tun.
  if v_other is null then
    return;
  end if;

  update training_exercises set position = -1 where id = p_training_exercise_id;
  update training_exercises set position = v_pos where id = v_other;
  update training_exercises set position = v_other_pos where id = p_training_exercise_id;
end;
$$;

-- delete_account: Name bleibt, Body referenziert die neuen Tabellennamen.
-- Öffentliche Trainings anonymisiert erhalten (#26 AC7), private löschen.
create or replace function delete_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Übungen: öffentliche anonymisieren, private löschen.
  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from exercises where owner_id = v_uid and visibility = 'private';

  -- Trainings: öffentliche anonymisiert erhalten (unveränderlich via fehlende
  -- Update-Policy bei owner_id NULL), private löschen.
  update trainings set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from trainings where owner_id = v_uid;
end;
$$;

revoke all on function publish_training(uuid, boolean) from public, anon;
revoke all on function unpublish_training(uuid) from public, anon;
revoke all on function move_training_exercise(uuid, int) from public, anon;
grant execute on function publish_training(uuid, boolean) to authenticated;
grant execute on function unpublish_training(uuid) to authenticated;
grant execute on function move_training_exercise(uuid, int) to authenticated;
