-- ============================================================================
-- Team-Trainingsplan: RPCs für Team anlegen, Trainer finden, aufnehmen
-- (Stories 3 und 4). Alles, was auth.users auflösen oder mehrere Tabellen
-- atomar anfassen muss, läuft als SECURITY-DEFINER-RPC mit Auth-/Mitglieds-
-- Prüfung als erster Anweisung.
-- ============================================================================

-- Team + erste Mitgliedschaft atomar (Story 3 PC 2).
create function create_team(p_name text) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_team uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if coalesce(btrim(p_name), '') = '' or char_length(btrim(p_name)) > 60 then
    raise exception 'TEAMNAME_UNGUELTIG';
  end if;
  insert into teams (name) values (btrim(p_name)) returning id into v_team;
  insert into team_members (team_id, user_id) values (v_team, v_uid);
  return v_team;
end;
$$;
revoke all on function create_team(text) from public, anon;
grant execute on function create_team(text) to authenticated;

-- Rate-Limit-Grundlage (Story 4 NFR 2): erfolglose Suchversuche je Konto.
create table trainer_suchversuche (
  user_id uuid not null references auth.users(id) on delete cascade,
  versucht_am timestamptz not null default now()
);
create index trainer_suchversuche_idx on trainer_suchversuche (user_id, versucht_am);
alter table trainer_suchversuche enable row level security;
-- Bewusst ohne Policy UND ohne Grant: die Tabelle gehört allein den
-- definer-RPCs. Der Revoke ist nötig, weil `alter default privileges`
-- (Migration 20260614120000) neuen Tabellen sonst volles DML an die
-- API-Rollen gibt — RLS ohne Policy blockte zwar ohnehin, aber die
-- Zugriffsfläche soll gar nicht erst entstehen.
revoke all on table trainer_suchversuche from anon, authenticated;

-- Vorschau (Story 4 AK 2): Trainer per E-Mail finden, Anzeigename zurückgeben.
-- Bewusste, dokumentierte Ausnahme von der Anti-Enumeration-Linie — nur für
-- Team-Mitglieder, gebremst auf 10 erfolglose Versuche je Stunde.
create function finde_trainer(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ziel uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  if (select count(*) from trainer_suchversuche
      where user_id = v_uid and versucht_am > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('status', 'gebremst');
  end if;

  select id into v_ziel from auth.users
   where lower(email) = lower(btrim(p_email))
     and email_confirmed_at is not null   -- nur bestätigte Konten (Story 4)
   limit 1;
  if v_ziel is null then
    insert into trainer_suchversuche (user_id) values (v_uid);
    return jsonb_build_object('status', 'nicht_gefunden');
  end if;
  if exists (select 1 from team_members
             where team_id = p_team_id and user_id = v_ziel) then
    return jsonb_build_object('status', 'bereits_mitglied');
  end if;
  return jsonb_build_object('status', 'gefunden', 'anzeige_name', anzeige_name(v_ziel));
end;
$$;
revoke all on function finde_trainer(uuid, text) from public, anon;
grant execute on function finde_trainer(uuid, text) to authenticated;

-- Aufnahme nach Bestätigung (Story 4 AK 6); Doppel-Aufnahme wirkt einmalig.
create function add_team_member(p_team_id uuid, p_email text) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_ziel uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team_id and user_id = v_uid) then
    raise exception 'not a member of this team';
  end if;
  select id into v_ziel from auth.users
   where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null
   limit 1;
  if v_ziel is null then return jsonb_build_object('status', 'nicht_gefunden'); end if;
  insert into team_members (team_id, user_id) values (p_team_id, v_ziel)
    on conflict do nothing;   -- gleichzeitige Aufnahme wirkt einmalig (PC 3)
  return jsonb_build_object('status', 'aufgenommen', 'anzeige_name', anzeige_name(v_ziel));
end;
$$;
revoke all on function add_team_member(uuid, text) from public, anon;
grant execute on function add_team_member(uuid, text) to authenticated;

-- Mitgliederliste ohne E-Mail (NFR 4).
create function team_mitglieder(p_team uuid) returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from team_members
                 where team_id = p_team and user_id = auth.uid()) then
    raise exception 'not a member of this team';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
           'user_id', m.user_id, 'anzeige_name', anzeige_name(m.user_id))
           order by m.created_at)
    from team_members m where m.team_id = p_team), '[]'::jsonb);
end;
$$;
revoke all on function team_mitglieder(uuid) from public, anon;
grant execute on function team_mitglieder(uuid) to authenticated;
