-- ============================================================================
-- Team-Trainingsplan (Epic 2026-08-16, revidiert 2026-08-24, Kopie-Modell):
-- Story 1 — Teams, Mitgliedschaft, Team-Eigentum, Termine, Anzeigename.
-- Ein Training gehört einer Person ODER einem Team; geteilt wird nie, kopiert
-- immer (dasselbe Paradigma wie die Übungsbibliothek).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Teams und gleichberechtigte Mitgliedschaft (AK 1–6)
-- ----------------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and char_length(btrim(name)) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger teams_set_updated_at before update on teams
  for each row execute function set_updated_at();

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
create index team_members_user_idx on team_members (user_id);

-- ----------------------------------------------------------------------------
-- 2) Trainings: Team-Eigentum, Herkunft, Vorlagen-Link (AK 7, 11, 20)
-- ----------------------------------------------------------------------------
alter table trainings
  add column team_id uuid references teams(id) on delete cascade,
  -- Herkunft der Kopie: nur Name des Ursprungs + Zeitpunkt, ohne Person
  -- (dasselbe Muster wie die Übungs-Fassungen; Ur-Herkunft bleibt bei Ketten).
  add column herkunft_name text,
  add column herkunft_datum timestamptz,
  -- Je persönlichem Training höchstens eine aktive Vorlage (Story 14 AK 3):
  -- der Link zeigt vom PERSÖNLICHEN Training auf seine veröffentlichte Kopie.
  add column vorlage_id uuid references trainings(id) on delete set null;

create index trainings_team_idx on trainings (team_id);
-- Der Selbst-Fremdschlüssel braucht seinen eigenen Index: ohne ihn sucht
-- `on delete set null` bei JEDEM Löschen eines Trainings die verweisenden
-- Zeilen per Seq-Scan (Vorlage ersetzen, Zurückziehen, Team auflösen).
create index trainings_vorlage_idx on trainings (vorlage_id)
  where vorlage_id is not null;

-- Nie Person UND Team zugleich; beide NULL = anonymisierte Vorlage (Bestand).
-- Alle drei CHECKs sind auf dem Bestand erfüllbar ohne Backfill: die geprüften
-- Spalten sind neu und damit überall NULL (forward-only, CLAUDE.md).
alter table trainings add constraint tr_ein_eigentuemer
  check (owner_id is null or team_id is null);
-- Team-Trainings sind nie öffentlich (AK 9): öffentlich sind nur Vorlagen.
alter table trainings add constraint tr_team_nie_public
  check (team_id is null or visibility = 'private');
alter table trainings add constraint tr_herkunft_vollstaendig
  check ((herkunft_name is null) = (herkunft_datum is null));

-- ----------------------------------------------------------------------------
-- 3) Termine: 1:1 an Team-Trainings (AK 12–19)
-- ----------------------------------------------------------------------------
create table training_termine (
  id uuid primary key default gen_random_uuid(),
  -- UNIQUE = höchstens ein Termin je Training (AK 15); je Termin eine eigene
  -- Trainings-Kopie, das erneute Ansetzen kopiert (Story 8).
  training_id uuid not null unique references trainings(id) on delete cascade,
  -- Zeit am Trainingsort (AK 17): bewusst date/time OHNE Zeitzone.
  datum date not null,
  beginn time,
  ort text,
  bemerkung text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_termine_plan_idx on training_termine (datum, beginn nulls last);
create trigger training_termine_set_updated_at before update on training_termine
  for each row execute function set_updated_at();

-- Termine gibt es nur für Team-Trainings (Epic Out of Scope 3).
create function termin_nur_fuer_team_trainings() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from trainings t
                 where t.id = new.training_id and t.team_id is not null) then
    raise exception 'TERMIN_NUR_FUER_TEAM_TRAININGS';
  end if;
  return new;
end;
$$;
create trigger termin_nur_fuer_team_trainings
  before insert or update of training_id on training_termine
  for each row execute function termin_nur_fuer_team_trainings();

-- ----------------------------------------------------------------------------
-- 4) Anzeigename (Story 2, Datenebene)
-- ----------------------------------------------------------------------------
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null
    check (btrim(display_name) <> '' and char_length(btrim(display_name)) <= 40),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Auto-Name aus der User-ID, nie aus der E-Mail (NFR 4); je Konto verschieden.
create function anzeige_name(p_user uuid) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select display_name from profiles where user_id = p_user),
    'Trainer:in ' || left(md5(p_user::text), 4)
  );
$$;

-- Berechnetes PostgREST-Feld: `select=...,urheber` an trainings (Story 15).
create function urheber(t trainings) returns text
language sql stable
set search_path = public, pg_temp
as $$
  select case when t.owner_id is null then null else anzeige_name(t.owner_id) end;
$$;

-- ----------------------------------------------------------------------------
-- 5) RLS
-- ----------------------------------------------------------------------------
-- Rekursionsfalle: eine team_members-Policy, die team_members abfragt,
-- rekursiert in Postgres — darum eine SECURITY-DEFINER-Prüf-Funktion.
create function ist_team_mitglied(p_team uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p_team is not null and exists (
    select 1 from team_members where team_id = p_team and user_id = auth.uid());
$$;
-- Ausführungsrecht bewusst AUCH für `anon`: die Funktion steht in der
-- trainings-SELECT-Policy, die anonyme Besucher für öffentliche Vorlagen
-- durchlaufen. Postgres garantiert kein Short-Circuit im OR — ohne Grant
-- scheiterte das anonyme Lesen mit «permission denied for function». Ein Leck
-- ist das nicht: ohne auth.uid() liefert sie immer false.
revoke all on function ist_team_mitglied(uuid) from public;
grant execute on function ist_team_mitglied(uuid) to anon, authenticated;

alter table teams enable row level security;
alter table team_members enable row level security;
alter table training_termine enable row level security;
alter table profiles enable row level security;

create policy teams_select on teams for select to authenticated
  using (ist_team_mitglied(id));
create policy teams_update on teams for update to authenticated
  using (ist_team_mitglied(id)) with check (ist_team_mitglied(id));
create policy teams_delete on teams for delete to authenticated
  using (ist_team_mitglied(id));
-- INSERT nur via RPC create_team (atomar mit erster Mitgliedschaft).

create policy tm_select on team_members for select to authenticated
  using (ist_team_mitglied(team_id));
create policy tm_delete on team_members for delete to authenticated
  using (ist_team_mitglied(team_id));
-- INSERT nur via RPC add_team_member (E-Mail-Auflösung braucht definer).

create policy tt_select on training_termine for select to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_insert on training_termine for insert to authenticated
  with check (exists (select 1 from trainings t
                      where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_update on training_termine for update to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));
create policy tt_delete on training_termine for delete to authenticated
  using (exists (select 1 from trainings t
                 where t.id = training_id and ist_team_mitglied(t.team_id)));

create policy pr_select on profiles for select using (true);
create policy pr_insert on profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy pr_update on profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Trainings-Policies neu: Vorlagen sind KONSTRUKTIV eingefroren — es gibt
-- schlicht keine Update-Policy für öffentliche Zeilen. Bearbeitbar sind nur
-- private persönliche Trainings (Eigentümer) und Team-Trainings (Mitglieder).
drop policy tr_select on trainings;
create policy tr_select on trainings for select
  using (visibility = 'public' or owner_id = auth.uid() or ist_team_mitglied(team_id));
drop policy tr_update on trainings;
-- USING trifft nur private eigene bzw. Team-Zeilen: eine bereits öffentliche
-- Vorlage ist damit für jedes UPDATE unerreichbar — das ist das Einfrieren.
-- WITH CHECK darf die Sichtbarkeit NICHT erneut auf privat festnageln, sonst
-- liesse sich der letzte Schritt des Veröffentlichens (die fertige private
-- Kopie freigeben) nicht ausführen; Fassungen lassen sich nur in ein privates
-- Training einfügen, die Vorlage entsteht deshalb privat und wird zuletzt
-- freigegeben.
create policy tr_update on trainings for update
  using ((owner_id = auth.uid() and visibility = 'private') or ist_team_mitglied(team_id))
  with check ((owner_id = auth.uid() and team_id is null) or ist_team_mitglied(team_id));
drop policy tr_delete on trainings;
-- Löschen: Eigentümer (persönlich UND Vorlage-zurückziehen) oder Team-Mitglied.
create policy tr_delete on trainings for delete
  using (owner_id = auth.uid() or ist_team_mitglied(team_id));
drop policy tr_insert on trainings;
create policy tr_insert on trainings for insert
  with check (owner_id = auth.uid() or ist_team_mitglied(team_id));

-- training_exercises erben die neue Logik.
drop policy te_select on training_exercises;
create policy te_select on training_exercises for select
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and (p.visibility = 'public' or p.owner_id = auth.uid()
                        or ist_team_mitglied(p.team_id))));
drop policy te_insert on training_exercises;
create policy te_insert on training_exercises for insert
  with check (exists (select 1 from trainings p
                      where p.id = training_id
                        and ((p.owner_id = auth.uid() and p.visibility = 'private')
                             or ist_team_mitglied(p.team_id))));
drop policy te_update on training_exercises;
create policy te_update on training_exercises for update
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and ((p.owner_id = auth.uid() and p.visibility = 'private')
                        or ist_team_mitglied(p.team_id))));
drop policy te_delete on training_exercises;
create policy te_delete on training_exercises for delete
  using (exists (select 1 from trainings p
                 where p.id = training_id
                   and ((p.owner_id = auth.uid() and p.visibility = 'private')
                        or ist_team_mitglied(p.team_id))));

-- Storage: Team-Bilder liegen unter team/<team_id>/<te_id>.<ext>, damit jedes
-- Mitglied sie ersetzen kann (Story 6 NFR 2); user/<uid>/ bleibt persönlich.
--
-- Die Pfad-Prüfung steckt in einer Funktion statt direkt in der Policy: ein
-- Cast `(storage.foldername(name))[2]::uuid` in der Policy würde bei jedem
-- Nicht-Team-Pfad einen Cast-Fehler werfen können (Postgres garantiert im AND
-- keine Auswertungsreihenfolge) und damit persönliche Uploads brechen.
create function ist_team_bildpfad(p_name text) returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_teile text[] := storage.foldername(p_name);
  v_team uuid;
begin
  if coalesce(v_teile[1], '') <> 'team' then return false; end if;
  begin
    v_team := v_teile[2]::uuid;
  exception when others then
    return false;
  end;
  return exists (
    select 1 from team_members where team_id = v_team and user_id = auth.uid());
end;
$$;
revoke all on function ist_team_bildpfad(text) from public;
grant execute on function ist_team_bildpfad(text) to authenticated;

create policy "exercise_images_team_write" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'exercise-images' and ist_team_bildpfad(name)
  );
create policy "exercise_images_team_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'exercise-images' and ist_team_bildpfad(name)
  ) with check (
    bucket_id = 'exercise-images' and ist_team_bildpfad(name)
  );
create policy "exercise_images_team_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'exercise-images' and ist_team_bildpfad(name)
  );

-- ----------------------------------------------------------------------------
-- 6) Ein Team ohne Mitglieder besteht nicht fort (AK 6)
-- ----------------------------------------------------------------------------
create function team_aufloesen_wenn_leer() returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from team_members where team_id = old.team_id) then
    delete from teams where id = old.team_id;  -- kaskadiert Trainings + Termine
  end if;
  return old;
end;
$$;
create trigger team_aufloesen_wenn_leer
  after delete on team_members
  for each row execute function team_aufloesen_wenn_leer();

-- ----------------------------------------------------------------------------
-- 7) Publish-Mechanik neu (Story 14: Publish = Kopie)
-- ----------------------------------------------------------------------------
-- Auto-Privatisierung ist obsolet: eine Vorlage ist eingefroren, es gibt
-- nichts mehr still zu korrigieren. Das Zurücksetzen weicht deshalb einer
-- Zurückweisung — die Vollständigkeit bleibt aber auf der Datenebene erzwungen,
-- nicht bloss in der App: sonst hinge die Invariante «eine Vorlage ist
-- vollständig» an einer einzigen TypeScript-Funktion, und ein Wettlauf zwischen
-- Gate und Freigabe erzeugte eine unvollständige, unveränderliche Vorlage.
drop trigger training_enforce_publishable_trg on trainings;
drop function training_enforce_publishable();
-- unpublish entfällt: Zurückziehen = DELETE der Vorlage durch den Urheber.
drop function unpublish_training(uuid);
drop function publish_training(uuid);

create function training_publish_gate() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- Nur der ÜBERGANG nach öffentlich wird geprüft. Eine bestehende Vorlage
  -- bleibt unangetastet — sonst scheiterte die Anonymisierung beim Löschen
  -- eines Kontos an Altbestand, den niemand mehr reparieren kann.
  if new.visibility <> 'public' then return new; end if;
  if tg_op = 'UPDATE' and old.visibility = 'public' then return new; end if;

  if coalesce(array_length(new.stufen, 1), 0) = 0 then
    raise exception 'TRAINING_UNVOLLSTAENDIG: stufe';
  end if;
  if not exists (select 1 from training_exercises
                 where training_id = new.id and trainingsteil = 'einleitung') then
    raise exception 'TRAINING_UNVOLLSTAENDIG: einleitung';
  end if;
  if not exists (select 1 from training_exercises
                 where training_id = new.id and trainingsteil = 'hauptteil') then
    raise exception 'TRAINING_UNVOLLSTAENDIG: hauptteil';
  end if;
  return new;
end;
$$;
create trigger training_publish_gate
  before insert or update of visibility on trainings
  for each row execute function training_publish_gate();

-- ----------------------------------------------------------------------------
-- 8) Konto-Löschung an das neue Modell anpassen
-- ----------------------------------------------------------------------------
-- Zwei Gründe für die Neufassung: (a) die Funktion zeigte noch auf die vor der
-- Umbenennung existierende Tabelle `training_plans` und wäre zur Laufzeit
-- gescheitert; (b) mit dem Kopie-Modell sind öffentliche Trainings Vorlagen —
-- sie bleiben anonymisiert bestehen, der Vorlagen-Link der (gelöschten)
-- persönlichen Trainings fällt über `on delete set null` von selbst weg.
-- Team-Mitgliedschaften kaskadieren über den auth.users-Fremdschlüssel; leert
-- das das Team, räumt der Auflösungs-Trigger es samt Team-Trainings ab.
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

  -- Favoriten des Kontos entfernen.
  delete from exercise_favorites where user_id = v_uid;

  -- Übungen: öffentliche anonymisieren, private löschen.
  update exercises set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from exercises where owner_id = v_uid and visibility = 'private';

  -- Trainings: öffentliche Vorlagen anonymisiert erhalten (unveränderlich via
  -- fehlende Update-Policy), alle übrigen eigenen löschen.
  update trainings set owner_id = null
    where owner_id = v_uid and visibility = 'public';
  delete from trainings where owner_id = v_uid;
end;
$$;
revoke all on function delete_account() from public, anon;
grant execute on function delete_account() to authenticated;

-- API-Grants (Gotcha 20260614120000: ohne Grants «permission denied»).
grant select, update, delete on teams to authenticated;
grant select, delete on team_members to authenticated;
grant select, insert, update, delete on training_termine to authenticated;
grant select on profiles to anon;
grant select, insert, update on profiles to authenticated;
