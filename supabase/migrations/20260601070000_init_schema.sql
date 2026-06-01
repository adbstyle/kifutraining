-- Kinderfussball Web-App — Initiales Schema (Übungs-Epic + Trainingsplaner-Epic)
-- Server-only-Architektur: RLS ist die Sicherheitsgrenze, siehe
-- docs/superpowers/specs/2026-05-31-webapp-architektur-plan-mvp.md (§4/§5).

create extension if not exists pg_trgm;

-- ============================================================================
-- Tabellen
-- ============================================================================

create table themen (
  id text primary key,                      -- sprechender Slug (= YAML-id)
  name text not null,
  trainingsteil text not null
    check (trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')),
  erscheinungsform text[] not null default '{}',
  ziele text[] not null default '{}',
  metaphern text[] not null default '{}',
  fragen_an_die_kinder text[] not null default '{}'
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  trainingsteil text not null
    check (trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')),
  erscheinungsform text[] not null default '{}',
  feldtyp text check (feldtyp in ('kleinfeld','grossfeld','freies_feld')),
  thema text references themen(id) on delete set null,
  kategorien text[] not null default '{}',          -- Teilmenge von {G,F,E}
  spielform text,
  anzahl_kinder jsonb,                               -- {min, empfohlen}
  material text[] not null default '{}',
  aufbau text not null,
  ueben text[] not null default '{}',
  wetteifern text,
  varianten text[] not null default '{}',
  bild_url text,
  source text not null default 'user' check (source in ('manual','user')),
  owner_id uuid references auth.users(id) on delete set null,
  visibility text not null default 'public' check (visibility in ('public','private')),
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Herkunfts-Konsistenz: Manual-Übungen haben nie einen Owner
  constraint manual_has_no_owner check (source <> 'manual' or owner_id is null),
  -- Hauptteil-spezifische Felder nur bei Hauptteil (Übungs-Epic EK2)
  constraint hauptteil_only_fields check (
    trainingsteil = 'hauptteil'
    or (erscheinungsform = '{}' and thema is null)
  ),
  -- nur gültige Alterskategorien
  constraint valid_kategorien check (kategorien <@ array['G','F','E'])
);

create table training_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  alterskategorie text check (alterskategorie in ('G','F','E')),   -- optional (Planer EK5)
  visibility text not null default 'private' check (visibility in ('public','private')),
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans(id) on delete cascade,
  trainingsteil text not null                          -- die Phase
    check (trainingsteil in ('auffangen','einleitung','hauptteil','ausklang')),
  exercise_id uuid references exercises(id) on delete set null,
  exercise_name_cache text,                            -- Platzhalter-Fallback (Planer EK / Frage 2)
  position int not null,
  duration_min int check (duration_min >= 0),          -- Dauer je Zuordnung (Planer Frage 1)
  unique (plan_id, trainingsteil, position)
);

-- ============================================================================
-- Indizes
-- ============================================================================

create index exercises_search_idx on exercises using gin (search_tsv);
create index exercises_name_trgm_idx on exercises using gin (name gin_trgm_ops);
create index exercises_filter_idx on exercises (trainingsteil, visibility);
create index exercises_owner_idx on exercises (owner_id);
create index exercises_thema_idx on exercises (thema);
create index plan_exercises_plan_idx on plan_exercises (plan_id);
create index plan_exercises_exercise_idx on plan_exercises (exercise_id);
create index plans_owner_idx on training_plans (owner_id);
create index plans_search_idx on training_plans using gin (search_tsv);

-- ============================================================================
-- Trigger-Funktionen
-- ============================================================================

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function exercises_search_refresh() returns trigger
language plpgsql as $$
begin
  new.search_tsv :=
      setweight(to_tsvector('german', coalesce(new.name, '')), 'A')
    || setweight(to_tsvector('german', coalesce(new.aufbau, '')), 'B')
    || setweight(to_tsvector('german', array_to_string(new.ueben, ' ')), 'C')
    || setweight(to_tsvector('german', array_to_string(new.material, ' ')), 'D');
  return new;
end;
$$;

create or replace function plans_search_refresh() returns trigger
language plpgsql as $$
begin
  new.search_tsv := to_tsvector('german', coalesce(new.name, ''));
  return new;
end;
$$;

-- Phasen-Bindung: eine zugeordnete Übung muss zum Trainingsteil der Phase passen
-- (Planer EK2). Sicherung auf DB-Ebene zusätzlich zur App-Filterung.
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
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Trigger
-- ============================================================================

create trigger exercises_set_updated_at before update on exercises
  for each row execute function set_updated_at();
create trigger exercises_search before insert or update on exercises
  for each row execute function exercises_search_refresh();

create trigger plans_set_updated_at before update on training_plans
  for each row execute function set_updated_at();
create trigger plans_search before insert or update on training_plans
  for each row execute function plans_search_refresh();

create trigger plan_exercise_phase before insert or update on plan_exercises
  for each row execute function plan_exercise_phase_guard();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table themen enable row level security;
alter table exercises enable row level security;
alter table training_plans enable row level security;
alter table plan_exercises enable row level security;

-- Themen: für alle lesbar, nicht über die App schreibbar (nur Seed via service_role).
create policy themen_select on themen for select using (true);

-- Übungen
create policy ex_select on exercises for select
  using (visibility = 'public' or owner_id = auth.uid());
create policy ex_insert on exercises for insert
  with check (owner_id = auth.uid() and source = 'user');
create policy ex_update on exercises for update
  using (owner_id = auth.uid() and source = 'user')
  with check (owner_id = auth.uid() and source = 'user');
create policy ex_delete on exercises for delete
  using (owner_id = auth.uid() and source = 'user');

-- Trainingspläne
create policy pl_select on training_plans for select
  using (visibility = 'public' or owner_id = auth.uid());
create policy pl_insert on training_plans for insert
  with check (owner_id = auth.uid());
create policy pl_update on training_plans for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy pl_delete on training_plans for delete
  using (owner_id = auth.uid());

-- Plan-Übungen: Sicht-/Schreibrecht erbt vom Eltern-Plan
create policy pe_select on plan_exercises for select using (
  exists (
    select 1 from training_plans p
    where p.id = plan_exercises.plan_id
      and (p.visibility = 'public' or p.owner_id = auth.uid())
  )
);
create policy pe_insert on plan_exercises for insert with check (
  exists (
    select 1 from training_plans p
    where p.id = plan_exercises.plan_id and p.owner_id = auth.uid()
  )
);
create policy pe_update on plan_exercises for update using (
  exists (
    select 1 from training_plans p
    where p.id = plan_exercises.plan_id and p.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from training_plans p
    where p.id = plan_exercises.plan_id and p.owner_id = auth.uid()
  )
);
create policy pe_delete on plan_exercises for delete using (
  exists (
    select 1 from training_plans p
    where p.id = plan_exercises.plan_id and p.owner_id = auth.uid()
  )
);
