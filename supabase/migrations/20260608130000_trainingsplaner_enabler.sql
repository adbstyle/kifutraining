-- ============================================================================
-- Trainingsplaner — Datenmodell-/RPC-Angleichung (Epic #8, Enabler #9 + #26)
-- ============================================================================
-- Bringt das in init_schema bereits angelegte Plan-Modell auf den in Story #9
-- beschriebenen Zielzustand und setzt die in #26 gebündelten Deltas um:
--   1. Alterskategorie Einzelwert -> Stufen-Mehrfachwert (text[], analog
--      exercises.kategorien).
--   2. owner_id der Pläne: bei Konto-Löschung öffentliche Pläne anonymisiert
--      erhalten (owner_id NULL via ON DELETE SET NULL) statt kaskadiert löschen.
--   3. Plan-Suche: Volltext (tsvector) -> Teilstring (search_text + ILIKE),
--      konsistent mit der Übungssuche (Migration 20260608120000).
--   4. exercise_name_cache verlässlich beim Hinzufügen befüllen (Platzhalter-
--      Fallback bei gelöschter/unsichtbarer Übung).
--   5. publish_plan: Vollständigkeitsprüfung (Einleitung + Hauptteil belegt,
--      mind. eine Stufe) + Namen der betroffenen eigenen privaten Übungen;
--      unpublish_plan (öffentlich -> privat); Auto-Privat bei Unterschreiten.
--   6. updated_at des Plans bei jeder Änderung an seinen Zuordnungen anstossen
--      (Story #13: "letzte Änderung" gilt auch für Zuordnungen).
-- Pre-launch: keine nennenswerten Bestandsdaten, daher destruktive Umstellung
-- der Alterskategorie ohne Migration zulässig (CLAUDE.md Lifecycle-Modus).

create extension if not exists unaccent;

-- ----------------------------------------------------------------------------
-- 1) Alterskategorie (Einzelwert) -> Stufen (Mehrfachwert)
-- ----------------------------------------------------------------------------
alter table training_plans drop column alterskategorie;
alter table training_plans add column stufen text[] not null default '{}';
alter table training_plans
  add constraint plan_valid_stufen check (stufen <@ array['G','F','E']);

-- ----------------------------------------------------------------------------
-- 2) Eigentümer-Verweis: anonymisiert erhalten statt kaskadiert löschen
-- ----------------------------------------------------------------------------
alter table training_plans alter column owner_id drop not null;
alter table training_plans drop constraint training_plans_owner_id_fkey;
alter table training_plans
  add constraint training_plans_owner_id_fkey
  foreign key (owner_id) references auth.users(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3) Plan-Suche: search_tsv -> search_text (Teilstring, akzent-/case-insensitiv)
-- ----------------------------------------------------------------------------
drop index if exists plans_search_idx;
alter table training_plans drop column search_tsv;
alter table training_plans add column search_text text;

create or replace function plans_search_refresh() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  -- lower(unaccent(name)) -> die App normalisiert den Suchbegriff identisch,
  -- bevor sie per ILIKE '%begriff%' matcht (lib/queries/plans.ts).
  new.search_text := lower(unaccent(coalesce(new.name, '')));
  return new;
end;
$$;

-- Bestand backfillen, ohne updated_at zu verändern.
alter table training_plans disable trigger plans_set_updated_at;
update training_plans set search_text = lower(unaccent(coalesce(name, '')));
alter table training_plans enable trigger plans_set_updated_at;

create index plans_search_text_trgm_idx
  on training_plans using gin (search_text gin_trgm_ops);

-- Index für Stufen-Filter (Überlappung) der öffentlichen Plan-Suche.
create index plans_stufen_idx on training_plans using gin (stufen);

-- ----------------------------------------------------------------------------
-- 4) exercise_name_cache verlässlich befüllen + Phasen-Bindung (kombiniert)
-- ----------------------------------------------------------------------------
-- Erweitert den bestehenden Phasen-Guard: füllt den Platzhalter-Namen aus der
-- referenzierten Übung, falls er beim Hinzufügen nicht mitgegeben wurde (#26 AC2).
create or replace function plan_exercise_phase_guard() returns trigger
language plpgsql as $$
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
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5) Plan-updated_at bei Änderungen an Zuordnungen anstossen (Story #13)
-- ----------------------------------------------------------------------------
-- Das Touchen des Plans löst dessen BEFORE-UPDATE-Trigger aus — u.a. die
-- Auto-Privat-Regel (s.u.), sodass eine entfernte Pflicht-Übung einen
-- öffentlichen Plan automatisch privat schaltet.
create or replace function plan_exercises_touch_plan() returns trigger
language plpgsql as $$
begin
  update training_plans set updated_at = now()
   where id = coalesce(new.plan_id, old.plan_id);
  return null;
end;
$$;

create trigger plan_exercises_touch
  after insert or update or delete on plan_exercises
  for each row execute function plan_exercises_touch_plan();

-- ----------------------------------------------------------------------------
-- 6) Auto-Privat: ein öffentlicher Plan bleibt nur veröffentlichungsfähig
--    (#26 AC5). BEFORE UPDATE auf training_plans, damit die NEW-Stufen bereits
--    berücksichtigt werden; Zuordnungs-Vollständigkeit wird aus plan_exercises
--    gelesen (eine Zuordnung zählt unabhängig von der Auflösbarkeit der Übung).
-- ----------------------------------------------------------------------------
create or replace function plan_enforce_publishable() returns trigger
language plpgsql as $$
begin
  if new.visibility = 'public' then
    if coalesce(array_length(new.stufen, 1), 0) = 0
       or not exists (
         select 1 from plan_exercises
         where plan_id = new.id and trainingsteil = 'einleitung')
       or not exists (
         select 1 from plan_exercises
         where plan_id = new.id and trainingsteil = 'hauptteil') then
      new.visibility := 'private';
    end if;
  end if;
  return new;
end;
$$;

create trigger plan_enforce_publishable_trg
  before update on training_plans
  for each row execute function plan_enforce_publishable();

-- ----------------------------------------------------------------------------
-- 7) publish_plan: Vollständigkeitsprüfung + Namen der betroffenen Übungen
-- ----------------------------------------------------------------------------
-- Status:
--   incomplete         -> {missing:[...]} (stufe/einleitung/hauptteil), keine Mutation
--   needs_confirmation -> {count, names:[...]} eigener privater Übungen, keine Mutation
--   published          -> Plan (und ggf. eigene private Übungen) auf public
create or replace function publish_plan(p_plan_id uuid, p_include_private boolean default false)
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
    select 1 from training_plans where id = p_plan_id and owner_id = v_uid
  ) then
    raise exception 'plan not found or not owned by caller';
  end if;

  -- Vollständigkeit (#26 AC3): mind. eine Stufe, Einleitung + Hauptteil belegt.
  if not exists (
    select 1 from training_plans
    where id = p_plan_id and coalesce(array_length(stufen, 1), 0) >= 1
  ) then
    v_missing := array_append(v_missing, 'stufe');
  end if;
  if not exists (
    select 1 from plan_exercises where plan_id = p_plan_id and trainingsteil = 'einleitung'
  ) then
    v_missing := array_append(v_missing, 'einleitung');
  end if;
  if not exists (
    select 1 from plan_exercises where plan_id = p_plan_id and trainingsteil = 'hauptteil'
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
  from plan_exercises pe
  join exercises e on e.id = pe.exercise_id
  where pe.plan_id = p_plan_id
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
        from plan_exercises pe
        join exercises e on e.id = pe.exercise_id
        where pe.plan_id = p_plan_id
          and e.owner_id = v_uid
          and e.visibility = 'private'
      );
  end if;

  update training_plans set visibility = 'public' where id = p_plan_id;
  return jsonb_build_object('status', 'published');
end;
$$;

-- ----------------------------------------------------------------------------
-- 8) unpublish_plan: öffentlicher Plan -> privat (#26 AC4). Mitveröffentlichte
--    Übungen bleiben öffentlich (Story #14 Postcondition 4) — bewusst kein
--    Zurück-Privatisieren der Übungen.
-- ----------------------------------------------------------------------------
create or replace function unpublish_plan(p_plan_id uuid)
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
  update training_plans set visibility = 'private'
    where id = p_plan_id and owner_id = v_uid;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9) delete_account: öffentliche Pläne anonymisiert erhalten (#26 AC7)
-- ----------------------------------------------------------------------------
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

  -- Pläne: öffentliche anonymisiert erhalten (unveränderlich via fehlende
  -- Update-Policy bei owner_id NULL), private löschen.
  update training_plans set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from training_plans where owner_id = v_uid;
end;
$$;

revoke all on function publish_plan(uuid, boolean) from public, anon;
revoke all on function unpublish_plan(uuid) from public, anon;
revoke all on function delete_account() from public, anon;
grant execute on function publish_plan(uuid, boolean) to authenticated;
grant execute on function unpublish_plan(uuid) to authenticated;
grant execute on function delete_account() to authenticated;
